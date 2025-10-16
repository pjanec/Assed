import { registerInteraction, type InteractionRule } from '@/core/registries/interactionRegistry';
import { useAssetsStore, useUiStore } from '@/core/stores';
import { useWorkspaceStore, CreateAssetCommand, DeriveAssetCommand, CloneAssetCommand, CompositeCommand } from '@/core/stores/workspace';
import type { UnmergedAsset } from '@/core/types';
import type { DragPayload, DropTarget } from '@/core/types/drag-drop';
import { ASSET_TYPES } from '@/content/config/constants';
import { areInSameEnvironment, getAssetEnvironmentFqn } from '@/content/utils/assetUtils';

// --- Rule 1: Assigning a Requirement (Package -> Node) ---
/**
 * Defines the primary workflow for assigning a package requirement to a node.
 * This rule handles dragging a full `Package` asset onto a `Node`.
 * It intelligently handles both same-environment and cross-environment scenarios
 * to ensure environment isolation and data integrity.
 */
const assignRequirementRule: InteractionRule = {
  validate: (dragPayload: DragPayload, dropTarget: DropTarget): boolean => {
    const assetsStore = useAssetsStore();
    const draggedAsset = assetsStore.unmergedAssets.find(a => a.id === dragPayload.assetId);
    const targetNode = assetsStore.unmergedAssets.find(a => a.id === dropTarget.id);
    if (!draggedAsset || !targetNode) return false;

    // Validation: No Duplicate Keys under the target node
    const existingKeys = assetsStore.unmergedAssets.filter(
      a => a.assetType === ASSET_TYPES.PACKAGE_KEY && a.fqn.startsWith(targetNode.fqn + '::')
    );
    const isDuplicate = existingKeys.some(key => key.assetKey === draggedAsset.assetKey);
    return !isDuplicate;
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

        const sourcePackage = assetsStore.unmergedAssets.find(a => a.id === dragPayload.assetId) as UnmergedAsset;
        const targetNode = assetsStore.unmergedAssets.find(a => a.id === dropTarget.id) as UnmergedAsset;
        if (!sourcePackage || !targetNode) return;

        const sourceEnv = getAssetEnvironmentFqn(sourcePackage.fqn, assetsStore.unmergedAssets);
        const targetEnv = getAssetEnvironmentFqn(targetNode.fqn, assetsStore.unmergedAssets);
        const isCrossEnv = sourceEnv !== null && targetEnv !== null && sourceEnv !== targetEnv;
        if (isCrossEnv) {
          // Placeholder for a cross-environment dialog (Stage 5)
          console.log('Cross-environment copy detected. Dialog will be implemented in Stage 5.');
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
  validate: (dragPayload: DragPayload, dropTarget: DropTarget): boolean => {
    const assetsStore = useAssetsStore();
    const draggedKey = assetsStore.unmergedAssets.find(a => a.id === dragPayload.assetId);
    const targetNode = assetsStore.unmergedAssets.find(a => a.id === dropTarget.id);
    if (!draggedKey || !targetNode) return false;

    // Rule 1: Prevent dropping onto the same parent node it already belongs to.
    // This is the primary fix for the reported bug.
    const sourceParentFqn = draggedKey.fqn.includes('::') 
      ? draggedKey.fqn.substring(0, draggedKey.fqn.lastIndexOf('::'))
      : null;
    if (sourceParentFqn === targetNode.fqn) {
      return false;
    }

    // Rule 2: No Duplicate Keys in the target node. This check is now safe.
    const existingKeys = assetsStore.unmergedAssets.filter(
      a => a.assetType === ASSET_TYPES.PACKAGE_KEY && a.fqn.startsWith(targetNode.fqn + '::')
    );
    const isDuplicate = existingKeys.some(key => key.assetKey === draggedKey.assetKey);
    return !isDuplicate;
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
          // This is the placeholder for the proactive resolution workflow.
          // For now, it will clone the key, which will correctly show a validation error.
          console.log("Cross-environment PackageKey copy detected. Proactive resolution will be implemented in Stage 5.");
          const cloneCommand = new CloneAssetCommand(dragPayload.assetId, targetNode.fqn, draggedKey.assetKey);
          workspaceStore.executeCommand(cloneCommand);
        } else {
          // Simple Clone for same-environment copy. This is the scenario you are testing.
          const cloneCommand = new CloneAssetCommand(dragPayload.assetId, targetNode.fqn, draggedKey.assetKey);
          workspaceStore.executeCommand(cloneCommand);
        }
      },
    },
  ],
};

registerInteraction(ASSET_TYPES.PACKAGE, ASSET_TYPES.NODE, assignRequirementRule);
registerInteraction(ASSET_TYPES.PACKAGE_KEY, ASSET_TYPES.NODE, copyRequirementRule);


