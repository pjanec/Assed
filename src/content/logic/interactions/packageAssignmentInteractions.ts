import { registerInteraction, type InteractionRule } from '@/core/registries/interactionRegistry';
import { useAssetsStore, useUiStore } from '@/core/stores';
import { useWorkspaceStore, CreateAssetCommand, DeriveAssetCommand, CloneAssetCommand, CompositeCommand, type PostCloneHook } from '@/core/stores/workspace';
import type { UnmergedAsset } from '@/core/types';
import type { DragPayload, DropTarget } from '@/core/types/drag-drop';
import { ASSET_TYPES } from '@/content/config/constants';
import { areInSameEnvironment, getAssetEnvironmentFqn, isSharedAsset } from '@/content/utils/assetUtils';
import { getPropertyInheritanceChain, calculateMergedAsset } from '@/content/utils/mergeUtils';
import { generatePropertiesDiff } from '@/core/utils/diff';

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
        const isCrossEnv = sourceEnv !== null && targetEnv !== null && sourceEnv !== targetEnv;
        if (isCrossEnv) {
          // Cross-Environment Workflow
          const allAssetsMap = new Map<string, UnmergedAsset>();
          assetsStore.unmergedAssets.forEach(a => allAssetsMap.set(a.id, a));
            
          const beforeChain = getPropertyInheritanceChain(sourcePackage, allAssetsMap);
          // For now, the "after" chain is just the target environment
          // In a full implementation, this would show the flattened/rebased chain
          const afterChain = [{ 
            assetKey: sourcePackage.assetKey, 
            fqn: `${targetEnv}::${sourcePackage.assetKey}`,
            assetType: sourcePackage.assetType 
          }];
            
          // The content layer KNOWS this is a cross-env copy and prepares the specific data.
          // It calls the GENERIC core action.
          uiStore.promptForDragDropConfirmation({
            dragPayload,
            dropTarget,
            displayPayload: {
              type: 'CrossEnvironmentCopy', // A hint for the content dialog
              inheritanceComparison: { before: beforeChain, after: afterChain }
            }
          });
        } else {
          // Intra-Environment: Ensure package exists, then create key
          const commands: (CreateAssetCommand | DeriveAssetCommand)[] = [];
          const targetEnvFqn = getAssetEnvironmentFqn(targetNode.fqn, assetsStore.unmergedAssets);
          if (targetEnvFqn) {
            const existingPackage = assetsStore.unmergedAssets.find(p =>
              p.assetType === ASSET_TYPES.PACKAGE &&
              p.assetKey === sourcePackage.assetKey &&
              getAssetEnvironmentFqn(p.fqn, assetsStore.unmergedAssets) === targetEnvFqn
            );
            if (!existingPackage) {
              commands.push(new DeriveAssetCommand(sourcePackage, targetEnvFqn, sourcePackage.assetKey));
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
        }
      },
    },
  ],
};

// --- Rule 2: Copying a Requirement (PackageKey -> Node) ---

/**
 * Defines the workflow for duplicating an existing package requirement.
 * This rule handles dragging a `PackageKey` from one `Node` to another.
 * Its purpose is to provide a quick way for users to replicate a dependency structure.
 * The logic will be enhanced in a later stage to proactively resolve dependencies
 * when copying across different environments.
 */

const copyRequirementRule: InteractionRule = {
  validate: (dragPayload: DragPayload, dropTarget: DropTarget) => {
    const assetsStore = useAssetsStore();
    const draggedKey = assetsStore.unmergedAssets.find(a => a.id === dragPayload.assetId);
    const targetNode = assetsStore.unmergedAssets.find(a => a.id === dropTarget.id);
    if (!draggedKey || !targetNode) return { isValid: false, reason: 'Asset not found.' };

    const sourceParentFqn = draggedKey.fqn.includes('::') 
      ? draggedKey.fqn.substring(0, draggedKey.fqn.lastIndexOf('::'))
      : null;
    if (sourceParentFqn === targetNode.fqn) {
      return { isValid: false, reason: "Cannot copy a requirement onto its own parent node." };
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
  actions: [
    {
      id: 'copy-requirement',
      label: 'Copy Requirement',
      icon: 'mdi-content-copy',
      cursor: 'copy',
      execute: (dragPayload: DragPayload, dropTarget: DropTarget) => {
        const workspaceStore = useWorkspaceStore();
        const assetsStore = useAssetsStore();
        const uiStore = useUiStore();

        const draggedKey = assetsStore.unmergedAssets.find(a => a.id === dragPayload.assetId) as UnmergedAsset;
        const targetNode = assetsStore.unmergedAssets.find(a => a.id === dropTarget.id) as UnmergedAsset;
        if (!draggedKey || !targetNode) return;

        const isCrossEnv = !areInSameEnvironment(draggedKey, targetNode, assetsStore.unmergedAssets);

        if (isCrossEnv) {
          // Cross-Environment PackageKey Copy - Proactive Resolution Workflow
          const targetEnvFqn = getAssetEnvironmentFqn(targetNode.fqn, assetsStore.unmergedAssets);
          const requiredPackageExistsInTarget = assetsStore.unmergedAssets.some(p => 
            p.assetType === ASSET_TYPES.PACKAGE && 
            p.assetKey === draggedKey.assetKey && 
            getAssetEnvironmentFqn(p.fqn, assetsStore.unmergedAssets) === targetEnvFqn
          );

          if (requiredPackageExistsInTarget) {
            // If the package already exists, just clone the key instantly.
            const cloneCommand = new CloneAssetCommand(dragPayload.assetId, targetNode.fqn, draggedKey.assetKey);
            workspaceStore.executeCommand(cloneCommand);
          } else {
            // If the package is missing, trigger the confirmation dialog.
            uiStore.promptForDragDropConfirmation({
              dragPayload,
              dropTarget,
              displayPayload: {
                type: 'ProactiveResolution', // A hint for the content dialog
                sourcePackageName: draggedKey.assetKey
              }
            });
          }
        } else {
          // Simple Clone for same-environment copy. This is the scenario you are testing.
          const cloneCommand = new CloneAssetCommand(dragPayload.assetId, targetNode.fqn, draggedKey.assetKey);
          workspaceStore.executeCommand(cloneCommand);
        }
      },
    },
  ],
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
        const sourcePackage = assetsStore.unmergedAssets.find(a => a.id === dragPayload.assetId) as UnmergedAsset;
        if (!sourcePackage) return;
          
        // This is always a cross-context copy, so we always show the dialog.
        // The logic for calculating inheritance chains is identical to the Package -> Node workflow.
        const allAssetsMap = new Map<string, UnmergedAsset>();
        assetsStore.unmergedAssets.forEach(a => allAssetsMap.set(a.id, a));
        const beforeChain = getPropertyInheritanceChain(sourcePackage, allAssetsMap);
          
        // For now, the "after" chain is just the target environment
        // In a full implementation, this would show the flattened/rebased chain
        const afterChain = [{ 
          assetKey: sourcePackage.assetKey, 
          fqn: `${dropTarget.id}::${sourcePackage.assetKey}`,
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
      },
    },
  ],
};

registerInteraction(ASSET_TYPES.PACKAGE, ASSET_TYPES.NODE, assignRequirementRule);
registerInteraction(ASSET_TYPES.PACKAGE_KEY, ASSET_TYPES.NODE, copyRequirementRule);
registerInteraction(ASSET_TYPES.PACKAGE, ASSET_TYPES.ENVIRONMENT, populatePackagePoolRule);

// Export the hook for use by the workspace store
export { crossEnvironmentCloneHook };


