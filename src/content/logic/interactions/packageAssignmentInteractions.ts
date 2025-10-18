import { registerInteraction, type InteractionRule, type DropAction, type ValidationResult } from '@/core/registries/interactionRegistry';
import { useAssetsStore, useUiStore } from '@/core/stores';
import { useWorkspaceStore, CreateAssetCommand, DeriveAssetCommand, CloneAssetCommand, CompositeCommand, type PostCloneHook } from '@/core/stores/workspace';
import type { UnmergedAsset } from '@/core/types';
import type { DragPayload, DropTarget } from '@/core/types/drag-drop';
import { ASSET_TYPES } from '@/content/config/constants';
import { areInSameEnvironment, getAssetEnvironmentFqn, isSharedAsset, isSameOrAncestorEnvironment, getSharedTemplateIfPureDerivative } from '@/content/utils/assetUtils';
import { isAncestorOf } from '@/core/utils/inheritanceUtils';
import { getPropertyInheritanceChain, calculateMergedAsset } from '@/core/utils/mergeUtils';
import { generatePropertiesDiff } from '@/core/utils/diff';
import { getIntermediatePath, getParentPath, getAssetName } from '@/core/utils/fqnUtils';
import { ensurePathExists } from '@/core/utils/pathUtils';

// --- The "Flatten and Rebase" Algorithm ---
/**
 * An injectable hook for the CloneAssetCommand that creates a functionally identical
 * but structurally independent copy of a package for cross-environment operations.
 * It "flattens" environment-specific inherited properties into local overrides
 * and "rebases" the template link to the highest-level shared ancestor.
 */
const crossEnvironmentCloneHook: PostCloneHook = (newlyClonedAsset, originalSourceAsset, cloneMap) => {
  const assetsStore = useAssetsStore();
  const allAssetsMap = new Map<string, UnmergedAsset>();
  // Use assetsWithOverrides to ensure full data is available for calculation
  assetsStore.assetsWithOverrides.forEach(a => allAssetsMap.set(a.id, a));

  // 1. Calculate final merged state of the original asset in its source context
  const mergedResult = calculateMergedAsset(originalSourceAsset.id, allAssetsMap);
  if ('error' in mergedResult) {
    console.error("Failed to calculate merged state during clone:", mergedResult.error);
    newlyClonedAsset.templateFqn = null; // Failsafe: break inheritance on error
    newlyClonedAsset.overrides = {};
    return newlyClonedAsset;
  }
  const finalSourceProperties = mergedResult.properties;

  // 2. Find the highest shared ancestor in the property inheritance chain
  const inheritanceChain = getPropertyInheritanceChain(originalSourceAsset, allAssetsMap);
  let highestSharedAncestor: UnmergedAsset | null = null;
  // Walk the chain from the root ancestor downwards
  for (const asset of inheritanceChain.slice().reverse()) {
    if (isSharedAsset(asset, assetsStore.unmergedAssets)) {
      highestSharedAncestor = asset;
      break;
    }
  }

  // 3. Rebase the templateFqn and calculate the minimal necessary overrides
  if (highestSharedAncestor) {
    const ancestorMergedResult = calculateMergedAsset(highestSharedAncestor.id, allAssetsMap);
    if ('properties' in ancestorMergedResult) {
      newlyClonedAsset.templateFqn = highestSharedAncestor.fqn;
      // The new overrides are the "diff" between the final state and the new base state
      newlyClonedAsset.overrides = generatePropertiesDiff(ancestorMergedResult.properties, finalSourceProperties);
    } else {
      // Failsafe if ancestor merge fails
      newlyClonedAsset.templateFqn = null;
      newlyClonedAsset.overrides = finalSourceProperties;
    }
  } else {
    // No shared ancestor found, so flatten everything into overrides
    newlyClonedAsset.templateFqn = null;
    newlyClonedAsset.overrides = finalSourceProperties;
  }

  return newlyClonedAsset;
};

// --- Rule 1: Assigning a Requirement (Package -> Node) ---
/**
 * Defines the primary workflow for assigning a package requirement to a node.
 * This rule handles dragging a full `Package` asset onto a `Node`.
 * It intelligently handles both same-environment and cross-environment scenarios
 * to ensure environment isolation and data integrity.
 */
const assignRequirementRule: InteractionRule = {
  validate: (dragPayload: DragPayload, dropTarget: DropTarget) => {
    const assetsStore = useAssetsStore();
    const draggedAsset = assetsStore.unmergedAssets.find(a => a.id === dragPayload.assetId);
    const targetNode = assetsStore.unmergedAssets.find(a => a.id === dropTarget.id);
    if (!draggedAsset || !targetNode) return { isValid: false, reason: 'Asset not found.' };

    // Validation: No Duplicate Keys under the target node
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
      execute: (dragPayload: DragPayload, dropTarget: DropTarget) => {
        const assetsStore = useAssetsStore();
        const workspaceStore = useWorkspaceStore();
        const uiStore = useUiStore();

        const sourcePackage = assetsStore.unmergedAssets.find(a => a.id === dragPayload.assetId) as UnmergedAsset;
        const targetNode = assetsStore.unmergedAssets.find(a => a.id === dropTarget.id) as UnmergedAsset;
        if (!sourcePackage || !targetNode) return;

        const sourceEnv = getAssetEnvironmentFqn(sourcePackage.fqn, assetsStore.unmergedAssets);
        const targetEnv = getAssetEnvironmentFqn(targetNode.fqn, assetsStore.unmergedAssets);

        const sharedTemplate = getSharedTemplateIfPureDerivative(sourcePackage, assetsStore.unmergedAssets);

        if (isSharedAsset(sourcePackage, assetsStore.unmergedAssets) || isSameOrAncestorEnvironment(targetEnv, sourceEnv, assetsStore.unmergedAssets)) {
          // This block is for same-env, ancestor-env, and shared-to-env drops. The logic is already correct.
          // Execute the immediate, dialog-free "Smart Derive" workflow.
          const commands: (CreateAssetCommand | DeriveAssetCommand)[] = [];
            
          if (isSharedAsset(sourcePackage, assetsStore.unmergedAssets)) {
            const existingPackageInPool = assetsStore.unmergedAssets.find(p =>
              p.assetType === ASSET_TYPES.PACKAGE &&
              p.assetKey === sourcePackage.assetKey &&
              getAssetEnvironmentFqn(p.fqn, assetsStore.unmergedAssets) === targetEnv
            );
            if (!existingPackageInPool) {
              commands.push(new DeriveAssetCommand(sourcePackage, targetEnv, sourcePackage.assetKey));
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
          // NEW CASE: It's a cross-env drop, BUT the source is a pure derivative.
          // We can treat this as a simple derive action without a dialog.
          const commands: (CreateAssetCommand | DeriveAssetCommand)[] = [];
          // Derive from the original shared template, not the intermediate package.
          // Use the assetKey of the package that was dragged, not the shared template's assetKey
          commands.push(new DeriveAssetCommand(sharedTemplate as UnmergedAsset, targetEnv, sourcePackage.assetKey));
          // Create the key
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
          // It's a true, complex cross-environment action that requires user confirmation.
          const allAssetsMap = new Map<string, UnmergedAsset>();
          assetsStore.unmergedAssets.forEach(a => allAssetsMap.set(a.id, a));
            
          const beforeChain = getPropertyInheritanceChain(sourcePackage, allAssetsMap);
          const afterChain = [{ 
            assetKey: sourcePackage.assetKey, 
            fqn: `${targetEnv}::${sourcePackage.assetKey}`,
            assetType: sourcePackage.assetType 
          }];
            
          uiStore.promptForDragDropConfirmation({
            dragPayload,
            dropTarget,
            displayPayload: {
              type: 'CrossEnvironmentCopy',
              inheritanceComparison: { before: beforeChain, after: afterChain }
            }
          });
        }
      },
    },
  ],
};

// --- NEW ACTION DEFINITIONS ---

/**
 * ACTION 1: Moves a PackageKey within the same environment.
 */
const MOVE_REQUIREMENT: DropAction = {
  id: 'move-requirement',
  label: 'Move Requirement',
  icon: 'mdi-file-move',
  cursor: 'move',
  execute: (dragPayload, dropTarget, workspaceStore) => {
    const assetsStore = useAssetsStore();
    const targetNode = assetsStore.unmergedAssets.find(a => a.id === dropTarget.id);
    if (!targetNode) return;
      
    // Use the existing, robust moveAsset logic
    workspaceStore.moveAsset(dragPayload.assetId, targetNode.fqn);
  },
};

/**
 * ACTION 2: Copies (clones) a PackageKey within the same environment.
 */
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

    // Use the existing CloneAssetCommand for a simple clone
    const command = new CloneAssetCommand(dragPayload.assetId, targetNode.fqn, draggedKey.assetKey);
    workspaceStore.executeCommand(command);
  },
};

/**
 * ACTION 3: Handles the cross-environment "Proactive Resolution" workflow.
 * This contains the logic from the old rule's execute function.
 */
const PROACTIVE_RESOLUTION_ACTION: DropAction = {
  id: 'proactive-resolve-requirement',
  label: 'Copy Requirement',
  icon: 'mdi-content-copy',
  cursor: 'copy',
  execute: (dragPayload, dropTarget) => {
    const workspaceStore = useWorkspaceStore();
    const assetsStore = useAssetsStore();
    const uiStore = useUiStore();

    const draggedKey = assetsStore.unmergedAssets.find(a => a.id === dragPayload.assetId) as UnmergedAsset;
    const targetNode = assetsStore.unmergedAssets.find(a => a.id === dropTarget.id) as UnmergedAsset;
    if (!draggedKey || !targetNode) return;

    const targetEnvFqn = getAssetEnvironmentFqn(targetNode.fqn, assetsStore.unmergedAssets);
    const requiredPackageExistsInTarget = assetsStore.unmergedAssets.some(p => 
      p.assetType === ASSET_TYPES.PACKAGE && 
      p.assetKey === draggedKey.assetKey && 
      getAssetEnvironmentFqn(p.fqn, assetsStore.unmergedAssets) === targetEnvFqn
    );

    if (requiredPackageExistsInTarget) {
      const cloneCommand = new CloneAssetCommand(dragPayload.assetId, targetNode.fqn, draggedKey.assetKey);
      workspaceStore.executeCommand(cloneCommand);
    } else {
      uiStore.promptForDragDropConfirmation({
        dragPayload,
        dropTarget,
        displayPayload: {
          type: 'ProactiveResolution',
          sourcePackageName: draggedKey.assetKey
        }
      });
    }
  },
};

// --- END: NEW ACTION DEFINITIONS ---

// --- Rule 2: Copying a Requirement (PackageKey -> Node) ---

/**
 * Defines the workflow for duplicating an existing package requirement.
 * This rule now dynamically provides 'Move' and 'Copy' options based on context.
 */
const copyRequirementRule: InteractionRule = {
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

    const isSameEnv = areInSameEnvironment(draggedKey, targetNode, assetsStore.unmergedAssets);

    if (isSameEnv) {
      // If in the same environment, offer both Move and Copy.
      return [MOVE_REQUIREMENT, COPY_REQUIREMENT_SAME_ENV];
    } else {
      // If cross-environment, offer only the Proactive Resolution (Copy) action.
      return [PROACTIVE_RESOLUTION_ACTION];
    }
  },
};

/**
 * Defines the workflow for populating an environment's package pool.
 * This rule handles dragging a `Package` asset directly onto an `Environment` asset,
 * triggering the safe "Flatten and Rebase" copy mechanism.
 */
const populatePackagePoolRule: InteractionRule = {
  validate: (dragPayload: DragPayload, dropTarget: DropTarget) => {
    const assetsStore = useAssetsStore();
    const draggedAsset = assetsStore.unmergedAssets.find(a => a.id === dragPayload.assetId);
    const targetEnv = assetsStore.unmergedAssets.find(a => a.id === dropTarget.id);

    if (!draggedAsset || !targetEnv || draggedAsset.assetType !== ASSET_TYPES.PACKAGE || targetEnv.assetType !== ASSET_TYPES.ENVIRONMENT) {
      return { isValid: false, reason: 'Invalid asset types for this operation.' };
    }

    // Validation: No Duplicate Keys in the target environment's pool.
    const directChildren = assetsStore.unmergedAssets.filter(
      a => a.fqn.startsWith(targetEnv.fqn + '::') && a.fqn.split('::').length === targetEnv.fqn.split('::').length + 1
    );
    const isDuplicate = directChildren.some(
      child => child.assetType === ASSET_TYPES.PACKAGE && child.assetKey === draggedAsset.assetKey
    );
    
    if (isDuplicate) {
      return { isValid: false, reason: `Environment already has a package named '${draggedAsset.assetKey}'.` };
    }
    
    return { isValid: true };
  },
  actions: [
    {
      id: 'copy-to-environment',
      label: 'Copy to Environment',
      icon: 'mdi-content-copy',
      cursor: 'copy',
      execute: (dragPayload: DragPayload, dropTarget: DropTarget) => {
        const uiStore = useUiStore();
        const assetsStore = useAssetsStore();
        const workspaceStore = useWorkspaceStore();
        const sourcePackage = assetsStore.unmergedAssets.find(a => a.id === dragPayload.assetId) as UnmergedAsset;
        const targetEnv = assetsStore.unmergedAssets.find(a => a.id === dropTarget.id) as UnmergedAsset;
        if (!sourcePackage || !targetEnv) return;

        // 1. Calculate the relative structure using our new utilities
        const sourceEnvFqn = getAssetEnvironmentFqn(sourcePackage.fqn, assetsStore.unmergedAssets);
        const intermediatePath = getIntermediatePath(sourcePackage.fqn, sourceEnvFqn);
        const relativeFolderPath = getParentPath(intermediatePath);
        const finalAssetName = getAssetName(intermediatePath);

        // 2. Ensure the target folder structure exists, creating it if necessary.
        // This returns the FQN of the final parent folder for our new asset.
        const finalParentFqn = ensurePathExists(targetEnv.fqn, relativeFolderPath);
          
        // 3. Perform the "Purity Check" to decide the creation method
        const sharedTemplate = getSharedTemplateIfPureDerivative(sourcePackage, assetsStore.unmergedAssets);

        if (isSharedAsset(sourcePackage, assetsStore.unmergedAssets) || sharedTemplate) {
          // If the source is shared OR it's a pure derivative, create a simple derivative.
          // The template is either the source itself (if shared) or its shared ancestor.
          const templateToDeriveFrom = isSharedAsset(sourcePackage, assetsStore.unmergedAssets) ? sourcePackage : sharedTemplate;

          if (templateToDeriveFrom) {
            const command = new DeriveAssetCommand(
              templateToDeriveFrom as UnmergedAsset, 
              finalParentFqn, // Place it in the correct final folder
              finalAssetName  // Use the original asset's name
            );
            workspaceStore.executeCommand(command);
          }
        } else {
          // It's a complex package from another env. Show the confirmation dialog.
          // Note: The dialog itself would need a minor update to use the `finalParentFqn`
          // and `finalAssetName` upon confirmation, but for now, we just open it.
          const allAssetsMap = new Map<string, UnmergedAsset>();
          assetsStore.unmergedAssets.forEach(a => allAssetsMap.set(a.id, a));
          const beforeChain = getPropertyInheritanceChain(sourcePackage, allAssetsMap);
              
          const afterChain = [{ 
            assetKey: finalAssetName, 
            fqn: `${finalParentFqn}::${finalAssetName}`,
            assetType: sourcePackage.assetType 
          }];

          uiStore.promptForDragDropConfirmation({
            dragPayload,
            dropTarget,
            displayPayload: {
              type: 'CrossEnvironmentCopy',
              inheritanceComparison: { before: beforeChain, after: afterChain }
            }
          });
        }
      },
    },
  ],
};

registerInteraction(ASSET_TYPES.PACKAGE, ASSET_TYPES.NODE, assignRequirementRule);
registerInteraction(ASSET_TYPES.PACKAGE_KEY, ASSET_TYPES.NODE, copyRequirementRule);
registerInteraction(ASSET_TYPES.PACKAGE, ASSET_TYPES.ENVIRONMENT, populatePackagePoolRule);

// Export the hook for use by the workspace store
export { crossEnvironmentCloneHook };


