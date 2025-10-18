import { registerInteraction, type DropAction, type InteractionRule } from '@/core/registries/interactionRegistry';
import { useAssetsStore, useUiStore } from '@/core/stores';
import { useWorkspaceStore } from '@/core/stores/workspace';
import { DeriveAssetCommand, CloneAssetCommand } from '@/core/stores/workspace';
import type { UnmergedAsset, Asset } from '@/core/types';
import type { DragPayload, DropTarget } from '@/core/types/drag-drop';
import { areInSameEnvironment, isSharedAsset, getAssetEnvironmentFqn } from '@/content/utils/assetUtils';
import { DROP_ACTION_IDS, DROP_TARGET_TYPES } from '@/core/config/constants';
import { ASSET_TYPES } from '@/content/config/constants';

/**
 * Defines the MOVE action. This triggers the refactoring confirmation workflow.
 */
const MOVE_PACKAGE: DropAction = {
  id: DROP_ACTION_IDS.MOVE,
  label: 'Move Package',
  icon: 'mdi-file-move',
  cursor: 'move',
  execute: (dragPayload: DragPayload, dropTarget: DropTarget, workspaceStore: any) => {
    const assetsStore = useAssetsStore();
    let newParentFqn: string | null = null;
    
    // Determine the FQN of the new parent based on the drop target.
    if (dropTarget.type === DROP_TARGET_TYPES.ROOT) {
        newParentFqn = null;
    } else {
        const dropTargetAsset = assetsStore.unmergedAssets.find(a => a.id === dropTarget.id);
        if (dropTargetAsset) {
            newParentFqn = dropTargetAsset.fqn;
        }
    }

    workspaceStore.moveAsset(dragPayload.assetId, newParentFqn);
  },
};

/**
 * Defines a smart COPY action. It checks for naming conflicts before executing.
 * If a conflict exists, it prompts for a new name; otherwise, it copies directly.
 */
const COPY_PACKAGE: DropAction = {
  id: DROP_ACTION_IDS.COPY,
  label: 'Copy Package',
  icon: 'mdi-content-copy',
  cursor: 'copy',
  opensDialog: true,
  execute: (dragPayload: DragPayload, dropTarget: DropTarget, workspaceStore: any) => {
    const assetsStore = useAssetsStore();
    const uiStore = useUiStore();
    const draggedAsset = assetsStore.unmergedAssets.find(a => a.id === dragPayload.assetId);
    const targetNode = assetsStore.unmergedAssets.find(a => a.id === dropTarget.id);

    if (!draggedAsset || !targetNode) return;

    const children = assetsStore.unmergedAssets.filter(a => a.fqn.startsWith(targetNode.fqn + '::'));
    const isNameTaken = children.some(child => child.assetKey === draggedAsset.assetKey);

    if (isNameTaken) {
      uiStore.promptForCloneOrDerive(DROP_ACTION_IDS.COPY, dragPayload.assetId, dropTarget);
    } else {
      const command = new CloneAssetCommand(dragPayload.assetId, targetNode.fqn, draggedAsset.assetKey);
      workspaceStore.executeCommand(command);
    }
  },
};

/**
 * Defines a smart DERIVE action. It checks for naming conflicts.
 * If a conflict exists, it prompts for a new name; otherwise, it derives directly.
 */
const DERIVE_PACKAGE: DropAction = {
  id: DROP_ACTION_IDS.DERIVE,
  label: 'Derive Package',
  icon: 'mdi-source-fork',
  cursor: 'link',
  opensDialog: true,
  execute: (dragPayload: DragPayload, dropTarget: DropTarget, workspaceStore: any) => {
    const assetsStore = useAssetsStore();
    const uiStore = useUiStore();
    const sourceAsset = assetsStore.unmergedAssets.find(a => a.id === dragPayload.assetId) as UnmergedAsset;
    const targetNode = assetsStore.unmergedAssets.find(a => a.id === dropTarget.id) as UnmergedAsset;

    if (!sourceAsset || !targetNode) return;

    const children = assetsStore.unmergedAssets.filter(a => a.fqn.startsWith(targetNode.fqn + '::'));
    const isNameTaken = children.some(child => child.assetKey === sourceAsset.assetKey);

    if (isNameTaken) {
      uiStore.promptForCloneOrDerive(DROP_ACTION_IDS.DERIVE, dragPayload.assetId, dropTarget);
    } else {
      const command = new DeriveAssetCommand(sourceAsset, targetNode.fqn, sourceAsset.assetKey);
      workspaceStore.executeCommand(command);
    }
  },
};

/**
 * Determines the correct drop action based on the source and target context.
 */
function getPackageDropAction(draggedAsset: Asset, targetAsset: Asset, dragPayload: DragPayload): DropAction[] {
  const assetsStore = useAssetsStore();
  const allAssets = assetsStore.unmergedAssets;
  const uiStore = useUiStore();
  const sourceParentId = dragPayload.parentAssetId; // Use parentAssetId from payload

  // Case 1: Dragged from the asset library (not from a node card).
  if (!sourceParentId) {
    if (isSharedAsset(draggedAsset, allAssets)) {
      return [DERIVE_PACKAGE];
    } else {
      const draggedEnv = getAssetEnvironmentFqn(draggedAsset.fqn, allAssets);
      const targetEnv = getAssetEnvironmentFqn(targetAsset.fqn, allAssets);
      return draggedEnv !== targetEnv ? [COPY_PACKAGE] : [MOVE_PACKAGE];
    }
  }

  // Case 2: Dragged from within a node card to another node card.
  const sourceParentAsset = allAssets.find(a => a.id === sourceParentId);
  if (!sourceParentAsset) return [];

  return areInSameEnvironment(sourceParentAsset, targetAsset, allAssets) ? [MOVE_PACKAGE] : [COPY_PACKAGE];
}

// Register the interaction rules for both Node and Option targets.
[ASSET_TYPES.NODE, ASSET_TYPES.OPTION].forEach(targetType => {
  registerInteraction(ASSET_TYPES.PACKAGE, targetType, {
    validate: (dragPayload: DragPayload, dropTarget: DropTarget) => {
      // Rule: Disallow dropping a package onto the node it already belongs to.
      if (dropTarget.id === dragPayload.parentAssetId) {
        return { isValid: false, reason: 'Cannot drop a package onto its own parent node.' };
      }
      return { isValid: true };
    },
    actions: (dragPayload: DragPayload, dropTarget: DropTarget) => {
      const assetsStore = useAssetsStore();
      const draggedAsset = assetsStore.unmergedAssets.find(a => a.id === dragPayload.assetId);
      const targetAsset = assetsStore.unmergedAssets.find(a => a.id === dropTarget.id);

      if (!draggedAsset || !targetAsset) return [];
      
      // Pass the full payload to the helper function
      return getPackageDropAction(draggedAsset, targetAsset, dragPayload);
    },
  } as InteractionRule);
});

















