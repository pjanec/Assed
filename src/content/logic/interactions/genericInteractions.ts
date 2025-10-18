import { useAssetsStore } from '@/core/stores/assets';
import { useWorkspaceStore } from '@/core/stores/workspace';
import { MoveAssetCommand, CloneAssetCommand, DeriveAssetCommand } from '@/core/stores/workspace';
import type { DropAction, InteractionRule } from '@/core/registries/interactionRegistry';
import { registerInteraction } from '@/core/registries/interactionRegistry';
import type { DragPayload, DropTarget } from '@/core/types/drag-drop';
import type { UnmergedAsset } from '@/core/types';
import { getValidChildrenForFolder, getValidChildTypes, assetRegistry } from '@/content/config/assetRegistry';
import { ASSET_TYPES } from '@/content/config/constants';
import { DROP_ACTION_IDS, DROP_TARGET_TYPES } from '@/core/config/constants';

// --- Reusable, Standard Actions ---

export const MOVE_ACTION: DropAction = {
  id: DROP_ACTION_IDS.MOVE,
  label: 'Move Here',
  icon: 'mdi-file-move',
  cursor: 'move',
  execute: (dragPayload: DragPayload, dropTarget: DropTarget, workspaceStore: any) => {
    let newParentFqn: string | null = null;
    const assetsStore = useAssetsStore();

    if (dropTarget.type === DROP_TARGET_TYPES.ROOT) {
      newParentFqn = null;
    } else {
      const dropTargetAsset = assetsStore.unmergedAssets.find(a => a.id === dropTarget.id);
      newParentFqn = dropTargetAsset ? dropTargetAsset.fqn : dropTarget.id;
    }

    workspaceStore.moveAsset(dragPayload.assetId, newParentFqn);
  },
  isEnabled: (dragPayload: DragPayload, dropTarget: DropTarget) => {
    const assetsStore = useAssetsStore();
    const draggedAsset = assetsStore.unmergedAssets.find(a => a.id === dragPayload.assetId);
    
    // First, try to find the target asset by its UUID.
    let targetAsset = assetsStore.unmergedAssets.find(a => a.id === dropTarget.id);
    // If that fails, it's likely a virtual folder where the ID is the FQN.
    if (!targetAsset) {
        targetAsset = assetsStore.unmergedAssets.find(a => a.fqn === dropTarget.id);
    }
    
    // Determine the FQN of the target. For virtual folders, the ID is the FQN.
    // For the root drop zone, it should be null.
    const targetFqn = targetAsset 
        ? targetAsset.fqn 
        : (dropTarget.type !== DROP_TARGET_TYPES.ROOT ? dropTarget.id : null);

    const parentFqn = draggedAsset?.fqn.split('::').slice(0, -1).join('::') || null;

    // The logic is to prevent a move into the *same parent folder*.
    return parentFqn !== targetFqn;
  }
};

export const COPY_ACTION: DropAction = {
  id: DROP_ACTION_IDS.COPY,
  label: 'Copy Here',
  icon: 'mdi-content-copy',
  cursor: 'copy',
  execute: (dragPayload: DragPayload, dropTarget: DropTarget, workspaceStore: any) => {
    // The logic to open the naming dialog will be handled by the UI directive later.
    // For now, the command execution is the key part.
    // This part will need a placeholder for the new name.
    console.log('Triggering Copy Action. A dialog should open.');
  }
};

export const DERIVE_ACTION: DropAction = {
  id: DROP_ACTION_IDS.DERIVE,
  label: 'Derive Here',
  icon: 'mdi-source-fork',
  cursor: 'link',
  execute: (dragPayload: DragPayload, dropTarget: DropTarget, workspaceStore: any) => {
    // Similar to Copy, this will eventually be triggered after a naming dialog.
    console.log('Triggering Derive Action. A dialog should open.');
  }
};

// --- Rule Registration ---

// Define the interaction rule once to keep it DRY
const FOLDER_LIKE_INTERACTION_RULE: InteractionRule = {
  validate: (dragPayload: DragPayload, dropTarget: DropTarget) => {
    const assetsStore = useAssetsStore();
    const draggedAsset = assetsStore.unmergedAssets.find(a => a.id === dragPayload.assetId);

    // Handle the root drop target explicitly
    if (dropTarget.type === DROP_TARGET_TYPES.ROOT) {
      if (!draggedAsset) return { isValid: false };
      const draggedAssetDef = assetRegistry[draggedAsset.assetType];
      if (draggedAssetDef?.isCreatableAtRoot) {
        return { isValid: true };
      } else {
        // This is a structural incompatibility, not a business rule failure.
        // Return isValid: false with NO REASON to prevent the tooltip.
        return { isValid: false };
      }
    }

    // The rest of the logic is for asset-to-asset drops
    const targetAsset = assetsStore.unmergedAssets.find(a => a.id === dropTarget.id);

    if (!draggedAsset || !targetAsset) return { isValid: false };

    // Check 1: Prevent dropping an asset into itself or its own children
    if (targetAsset.fqn && targetAsset.fqn.startsWith(draggedAsset.fqn)) {
      return { isValid: false, reason: 'Cannot drop an asset into itself or its children.' };
    }

    // Check 2: Use assetRegistry to check for valid parent-child relationship
    const definition = assetRegistry[targetAsset.assetType!];
    const validChildren = definition?.isStructuralFolder
      ? getValidChildrenForFolder(targetAsset as UnmergedAsset)
      : getValidChildTypes(targetAsset.assetType);

    if (!validChildren.includes(draggedAsset.assetType)) {
      // This is a structural incompatibility, not a business rule failure.
      // Return isValid: false with NO REASON to prevent the tooltip.
      return { isValid: false };
    }
    
    return { isValid: true };
  },
  actions: [
    MOVE_ACTION,
    COPY_ACTION,
    DERIVE_ACTION
  ]
};

// Dynamically generate the list of container asset types from the registry
const containerAssetTypes = Object.entries(assetRegistry)
  .filter(([, def]) => def.isStructuralFolder || def.validChildren.length > 0)
  .map(([type]) => type);

// Register the same rule for all container types
containerAssetTypes.forEach(type => {
  registerInteraction('Asset', type, FOLDER_LIKE_INTERACTION_RULE);
});

// Also register for the generic 'Folder' type used by the root drop target
registerInteraction('Asset', 'Folder', FOLDER_LIKE_INTERACTION_RULE);
















