import type { InteractionRule, DropAction, ValidationResult } from '@/core/registries/interactionRegistry';
import type { InteractionRuleEntry } from '@/core/stores/ConfigurationHub';
import type { DragPayload, DropTarget } from '@/core/types/drag-drop';
import type { UnmergedAsset } from '@/core/types';
import { ASSET_TYPES } from '@/content/config/constants';
import { areInSameDistro, getAssetDistroFqn, isSharedAsset, isSameOrAncestorDistro, getSharedTemplateIfPureDerivative } from '@/content/utils/assetUtils';
import { getPropertyInheritanceChain, calculateMergedAsset } from '@/core/utils/mergeUtils';
import { generatePropertiesDiff } from '@/core/utils/diff';
import { getIntermediatePath, getParentPath, getAssetName } from '@/core/utils/fqnUtils';
import { ensurePathExists } from '@/core/utils/pathUtils';
import { executeCrossDistroCopy, executeResolveAndCopy, executePoolCopy } from '@/content/logic/workspaceExtendedActions';
import { useAssetsStore, useUiStore } from '@/core/stores';
import { useWorkspaceStore } from '@/core/stores/workspace';
import { CloneAssetCommand, DeriveAssetCommand, CreateAssetCommand, CompositeCommand, type PostCloneHook } from '@/core/stores/workspace';

export const crossDistroCloneHook: PostCloneHook = (newlyClonedAsset, originalSourceAsset, cloneMap) => {
  const assetsStore = useAssetsStore();
  const allAssetsMap = new Map<string, UnmergedAsset>();
  assetsStore.assetsWithOverrides.forEach(a => allAssetsMap.set(a.id, a));

  const mergedResult = calculateMergedAsset(originalSourceAsset.id, allAssetsMap);
  if ('error' in mergedResult) {
    console.error("Failed to calculate merged state during clone:", mergedResult.error);
    newlyClonedAsset.templateFqn = null;
    newlyClonedAsset.overrides = {};
    return newlyClonedAsset;
  }
  const finalSourceProperties = mergedResult.properties;

  const inheritanceChain = getPropertyInheritanceChain(originalSourceAsset, allAssetsMap);
  let highestSharedAncestor: UnmergedAsset | null = null;
  for (const asset of inheritanceChain.slice().reverse()) {
    if (isSharedAsset(asset, assetsStore.unmergedAssets)) {
      highestSharedAncestor = asset;
      break;
    }
  }

  if (highestSharedAncestor) {
    const ancestorMergedResult = calculateMergedAsset(highestSharedAncestor.id, allAssetsMap);
    if ('properties' in ancestorMergedResult) {
      newlyClonedAsset.templateFqn = highestSharedAncestor.fqn;
      newlyClonedAsset.overrides = generatePropertiesDiff(ancestorMergedResult.properties, finalSourceProperties);
    } else {
      newlyClonedAsset.templateFqn = null;
      newlyClonedAsset.overrides = finalSourceProperties;
    }
  } else {
    newlyClonedAsset.templateFqn = null;
    newlyClonedAsset.overrides = finalSourceProperties;
  }
  return newlyClonedAsset;
};

const assignRequirementRule: InteractionRule = {
  validate: (dragPayload: DragPayload, dropTarget: DropTarget) => {
    const assetsStore = useAssetsStore();
    const draggedAsset = assetsStore.unmergedAssets.find(a => a.id === dragPayload.assetId);
    const targetNode = assetsStore.unmergedAssets.find(a => a.id === dropTarget.id);
    if (!draggedAsset || !targetNode) return { isValid: false, reason: 'Asset not found.' };

    const existingKeys = assetsStore.unmergedAssets.filter(
      a => a.assetType === ASSET_TYPES.PACKAGE_KEY && a.fqn.startsWith(targetNode.fqn + '::')
    );
    const isDuplicate = existingKeys.some(key => key.assetKey === draggedAsset.assetKey);
    
    if (isDuplicate) {
      return { isValid: false, reason: `Node already has a requirement for '${draggedAsset.assetKey}'.` };
    }
    return { isValid: true };
  },
  actions: [
    {
      id: 'assign-requirement',
      label: 'Assign Requirement',
      icon: 'mdi-link-plus',
      cursor: 'link',
      execute: async (dragPayload: DragPayload, dropTarget: DropTarget) => {
        const assetsStore = useAssetsStore();
        const workspaceStore = useWorkspaceStore();
        const uiStore = useUiStore();

        const sourcePackage = assetsStore.unmergedAssets.find(a => a.id === dragPayload.assetId) as UnmergedAsset;
        const targetNode = assetsStore.unmergedAssets.find(a => a.id === dropTarget.id) as UnmergedAsset;
        if (!sourcePackage || !targetNode) return;

        const sourceDistro = getAssetDistroFqn(sourcePackage.fqn, assetsStore.unmergedAssets);
        const targetDistro = getAssetDistroFqn(targetNode.fqn, assetsStore.unmergedAssets);
        const sharedTemplate = getSharedTemplateIfPureDerivative(sourcePackage, assetsStore.unmergedAssets);

        if (isSharedAsset(sourcePackage, assetsStore.unmergedAssets) || isSameOrAncestorDistro(targetDistro, sourceDistro, assetsStore.unmergedAssets)) {
          const commands: (CreateAssetCommand | DeriveAssetCommand)[] = [];
          if (isSharedAsset(sourcePackage, assetsStore.unmergedAssets)) {
            const existingPackageInPool = assetsStore.unmergedAssets.find(p =>
              p.assetType === ASSET_TYPES.PACKAGE &&
              p.assetKey === sourcePackage.assetKey &&
              getAssetDistroFqn(p.fqn, assetsStore.unmergedAssets) === targetDistro
            );
            if (!existingPackageInPool) {
              commands.push(new DeriveAssetCommand(sourcePackage, targetDistro, sourcePackage.assetKey));
            }
          }
          const keyCreate = new CreateAssetCommand({
            assetType: ASSET_TYPES.PACKAGE_KEY,
            assetKey: sourcePackage.assetKey,
            fqn: `${targetNode.fqn}::${sourcePackage.assetKey}`,
            templateFqn: null,
            overrides: {},
          });
          commands.push(keyCreate);
          workspaceStore.executeCommand(new CompositeCommand(commands));
        } else if (sharedTemplate) {
          const commands: (CreateAssetCommand | DeriveAssetCommand)[] = [];
          commands.push(new DeriveAssetCommand(sharedTemplate as UnmergedAsset, targetDistro, sourcePackage.assetKey));
          const keyCreate = new CreateAssetCommand({
            assetType: ASSET_TYPES.PACKAGE_KEY,
            assetKey: sourcePackage.assetKey,
            fqn: `${targetNode.fqn}::${sourcePackage.assetKey}`,
            templateFqn: null,
            overrides: {},
          });
          commands.push(keyCreate);
          workspaceStore.executeCommand(new CompositeCommand(commands));
        } else {
          const allAssetsMap = new Map<string, UnmergedAsset>();
          assetsStore.unmergedAssets.forEach(a => allAssetsMap.set(a.id, a));
          const beforeChain = getPropertyInheritanceChain(sourcePackage, allAssetsMap);
          const afterChain = [{ 
            assetKey: sourcePackage.assetKey, 
            fqn: `${targetDistro}::${sourcePackage.assetKey}`,
            assetType: sourcePackage.assetType 
          }];
          const confirmed = await uiStore.promptForGenericConfirmation('cross-distro-copy', {
            type: 'CrossDistroCopy',
            inheritanceComparison: { before: beforeChain, after: afterChain }
          });
          if (confirmed) {
            executeCrossDistroCopy(dragPayload, dropTarget);
          }
        }
      },
    },
  ],
};

const MOVE_REQUIREMENT: DropAction = {
  id: 'move-requirement',
  label: 'Move Requirement',
  icon: 'mdi-file-move',
  cursor: 'move',
  execute: (dragPayload, dropTarget, workspaceStore) => {
    const assetsStore = useAssetsStore();
    const targetNode = assetsStore.unmergedAssets.find(a => a.id === dropTarget.id);
    if (!targetNode) return;
    workspaceStore.moveAsset(dragPayload.assetId, targetNode.fqn);
  },
};

const COPY_REQUIREMENT_SAME_ENV: DropAction = {
  id: 'copy-requirement-same-env',
  label: 'Copy Requirement',
  icon: 'mdi-content-copy',
  cursor: 'copy',
  execute: (dragPayload, dropTarget, workspaceStore) => {
    const assetsStore = useAssetsStore();
    const draggedKey = assetsStore.unmergedAssets.find(a => a.id === dragPayload.assetId);
    const targetNode = assetsStore.unmergedAssets.find(a => a.id === dropTarget.id);
    if (!draggedKey || !targetNode) return;
    const command = new CloneAssetCommand(dragPayload.assetId, targetNode.fqn, draggedKey.assetKey);
    workspaceStore.executeCommand(command);
  },
};

const PROACTIVE_RESOLUTION_ACTION: DropAction = {
  id: 'proactive-resolve-requirement',
  label: 'Copy Requirement',
  icon: 'mdi-content-copy',
  cursor: 'copy',
  execute: async (dragPayload, dropTarget) => {
    const workspaceStore = useWorkspaceStore();
    const assetsStore = useAssetsStore();
    const uiStore = useUiStore();
    const draggedKey = assetsStore.unmergedAssets.find(a => a.id === dragPayload.assetId) as UnmergedAsset;
    const targetNode = assetsStore.unmergedAssets.find(a => a.id === dropTarget.id) as UnmergedAsset;
    if (!draggedKey || !targetNode) return;

    const targetDistroFqn = getAssetDistroFqn(targetNode.fqn, assetsStore.unmergedAssets);
    const requiredPackageExistsInTarget = assetsStore.unmergedAssets.some(p => 
      p.assetType === ASSET_TYPES.PACKAGE && 
      p.assetKey === draggedKey.assetKey && 
      getAssetDistroFqn(p.fqn, assetsStore.unmergedAssets) === targetDistroFqn
    );

    if (requiredPackageExistsInTarget) {
      const cloneCommand = new CloneAssetCommand(dragPayload.assetId, targetNode.fqn, draggedKey.assetKey);
      workspaceStore.executeCommand(cloneCommand);
    } else {
      const confirmed = await uiStore.promptForGenericConfirmation('proactive-resolution', {
        type: 'ProactiveResolution',
        sourcePackageName: draggedKey.assetKey
      });
      if (confirmed) {
        executeResolveAndCopy(dragPayload, dropTarget);
      }
    }
  },
};

export const copyRequirementRule: InteractionRule = {
  validate: (dragPayload: DragPayload, dropTarget: DropTarget): ValidationResult => {
    const assetsStore = useAssetsStore();
    const draggedKey = assetsStore.unmergedAssets.find(a => a.id === dragPayload.assetId);
    const targetNode = assetsStore.unmergedAssets.find(a => a.id === dropTarget.id);
    if (!draggedKey || !targetNode) return { isValid: false };

    const sourceParentFqn = draggedKey.fqn.includes('::') 
      ? draggedKey.fqn.substring(0, draggedKey.fqn.lastIndexOf('::'))
      : null;
    if (sourceParentFqn === targetNode.fqn) {
      return { isValid: false, reason: "Cannot move or copy a requirement onto its own parent." };
    }

    const existingKeys = assetsStore.unmergedAssets.filter(
      a => a.assetType === ASSET_TYPES.PACKAGE_KEY && a.fqn.startsWith(targetNode.fqn + '::')
    );
    const isDuplicate = existingKeys.some(key => key.assetKey === draggedKey.assetKey);
    if (isDuplicate) {
      return { isValid: false, reason: `Node already has a requirement for '${draggedKey.assetKey}'.` };
    }
    return { isValid: true };
  },
  actions: (dragPayload: DragPayload, dropTarget: DropTarget): DropAction[] => {
    const assetsStore = useAssetsStore();
    const draggedKey = assetsStore.unmergedAssets.find(a => a.id === dragPayload.assetId);
    const targetNode = assetsStore.unmergedAssets.find(a => a.id === dropTarget.id);

    if (!draggedKey || !targetNode) return [];
    const isSameDistro = areInSameDistro(draggedKey, targetNode, assetsStore.unmergedAssets);
    return isSameDistro ? [MOVE_REQUIREMENT, COPY_REQUIREMENT_SAME_ENV] : [PROACTIVE_RESOLUTION_ACTION];
  },
};

export const populatePackagePoolRule: InteractionRule = {
  validate: (dragPayload: DragPayload, dropTarget: DropTarget) => {
    const assetsStore = useAssetsStore();
    const draggedAsset = assetsStore.unmergedAssets.find(a => a.id === dragPayload.assetId);
    const targetDistro = assetsStore.unmergedAssets.find(a => a.id === dropTarget.id);

    if (!draggedAsset || !targetDistro || draggedAsset.assetType !== ASSET_TYPES.PACKAGE || targetDistro.assetType !== ASSET_TYPES.DISTRO) {
      return { isValid: false, reason: 'Invalid asset types for this operation.' };
    }

    const directChildren = assetsStore.unmergedAssets.filter(
      a => a.fqn.startsWith(targetDistro.fqn + '::') && a.fqn.split('::').length === targetDistro.fqn.split('::').length + 1
    );
    const isDuplicate = directChildren.some(
      child => child.assetType === ASSET_TYPES.PACKAGE && child.assetKey === draggedAsset.assetKey
    );
    
    if (isDuplicate) {
      return { isValid: false, reason: `Distro already has a package named '${draggedAsset.assetKey}'.` };
    }
    return { isValid: true };
  },
  actions: [
    {
      id: 'copy-to-distro',
      label: 'Copy to Distro',
      icon: 'mdi-content-copy',
      cursor: 'copy',
      execute: async (dragPayload: DragPayload, dropTarget: DropTarget) => {
        const uiStore = useUiStore();
        const assetsStore = useAssetsStore();
        const workspaceStore = useWorkspaceStore();
        const sourcePackage = assetsStore.unmergedAssets.find(a => a.id === dragPayload.assetId) as UnmergedAsset;
        const targetDistro = assetsStore.unmergedAssets.find(a => a.id === dropTarget.id) as UnmergedAsset;
        if (!sourcePackage || !targetDistro) return;

        const sourceDistroFqn = getAssetDistroFqn(sourcePackage.fqn, assetsStore.unmergedAssets);
        const intermediatePath = getIntermediatePath(sourcePackage.fqn, sourceDistroFqn);
        const relativeFolderPath = getParentPath(intermediatePath);
        const finalAssetName = getAssetName(intermediatePath);
        const finalParentFqn = ensurePathExists(targetDistro.fqn, relativeFolderPath);
        const sharedTemplate = getSharedTemplateIfPureDerivative(sourcePackage, assetsStore.unmergedAssets);

        if (isSharedAsset(sourcePackage, assetsStore.unmergedAssets) || sharedTemplate) {
          const templateToDeriveFrom = isSharedAsset(sourcePackage, assetsStore.unmergedAssets) ? sourcePackage : sharedTemplate;
          if (templateToDeriveFrom) {
            const command = new DeriveAssetCommand(
              templateToDeriveFrom as UnmergedAsset, 
              finalParentFqn,
              finalAssetName
            );
            workspaceStore.executeCommand(command);
          }
        } else {
          const allAssetsMap = new Map<string, UnmergedAsset>();
          assetsStore.unmergedAssets.forEach(a => allAssetsMap.set(a.id, a));
          const beforeChain = getPropertyInheritanceChain(sourcePackage, allAssetsMap);
          const afterChain = [{ 
            assetKey: finalAssetName, 
            fqn: `${finalParentFqn}::${finalAssetName}`,
            assetType: sourcePackage.assetType 
          }];
          const confirmed = await uiStore.promptForGenericConfirmation('cross-distro-copy', {
            type: 'CrossDistroCopy',
            inheritanceComparison: { before: beforeChain, after: afterChain }
          });
          if (confirmed) {
            executePoolCopy(dragPayload, dropTarget);
          }
        }
      },
    },
  ],
};

export const packageAssignmentRules: InteractionRuleEntry[] = [
  {
    draggedType: ASSET_TYPES.PACKAGE,
    targetType: ASSET_TYPES.NODE,
    rule: assignRequirementRule
  },
  {
    draggedType: ASSET_TYPES.PACKAGE_KEY,
    targetType: ASSET_TYPES.NODE,
    rule: copyRequirementRule
  },
  {
    draggedType: ASSET_TYPES.PACKAGE,
    targetType: ASSET_TYPES.DISTRO,
    rule: populatePackagePoolRule
  },
];

