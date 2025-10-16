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
        const assetsStore = useAssetsStore();
        const workspaceStore = useWorkspaceStore();
        const targetNode = assetsStore.unmergedAssets.find(a => a.id === dropTarget.id) as UnmergedAsset;
        if (!targetNode) return;

        // Simple clone to the target node; validation rules will highlight issues if any
        const cloneCommand = new CloneAssetCommand(dragPayload.assetId, targetNode.fqn, dragPayload.assetKey);
        workspaceStore.executeCommand(cloneCommand);
      },
    },
  ],
};

registerInteraction(ASSET_TYPES.PACKAGE, ASSET_TYPES.NODE, assignRequirementRule);
registerInteraction(ASSET_TYPES.PACKAGE_KEY, ASSET_TYPES.NODE, copyRequirementRule);


