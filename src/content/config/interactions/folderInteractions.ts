import type { InteractionRule, DropAction } from '@/core/registries/interactionRegistry';
import type { DragPayload, DropTarget } from '@/core/types/drag-drop';
import type { UnmergedAsset } from '@/core/types';
import { DROP_ACTION_IDS, DROP_TARGET_TYPES } from '@/core/config/constants';
import { getValidChildrenForFolder, getValidChildTypes, isCreatableAtRoot, getEffectiveRegistry } from '@/content/config/assetRegistry';
import { useAssetsStore } from '@/core/stores';
import { MoveAssetCommand } from '@/core/stores/workspace';

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
    
    let targetAsset = assetsStore.unmergedAssets.find(a => a.id === dropTarget.id);
    if (!targetAsset) {
        targetAsset = assetsStore.unmergedAssets.find(a => a.fqn === dropTarget.id);
    }
    
    const targetFqn = targetAsset 
        ? targetAsset.fqn 
        : (dropTarget.type !== DROP_TARGET_TYPES.ROOT ? dropTarget.id : null);

    const parentFqn = draggedAsset?.fqn.split('::').slice(0, -1).join('::') || null;
    return parentFqn !== targetFqn;
  }
};

export const COPY_ACTION: DropAction = {
  id: DROP_ACTION_IDS.COPY,
  label: 'Copy Here',
  icon: 'mdi-content-copy',
  cursor: 'copy',
  execute: (dragPayload: DragPayload, dropTarget: DropTarget, workspaceStore: any) => {
    console.log('Triggering Copy Action. A dialog should open.');
  }
};

export const DERIVE_ACTION: DropAction = {
  id: DROP_ACTION_IDS.DERIVE,
  label: 'Derive Here',
  icon: 'mdi-source-fork',
  cursor: 'link',
  execute: (dragPayload: DragPayload, dropTarget: DropTarget, workspaceStore: any) => {
    console.log('Triggering Derive Action. A dialog should open.');
  }
};

export const FOLDER_LIKE_INTERACTION_RULE: InteractionRule = {
  validate: (dragPayload: DragPayload, dropTarget: DropTarget) => {
    const assetsStore = useAssetsStore();
    const draggedAsset = assetsStore.unmergedAssets.find(a => a.id === dragPayload.assetId);

    if (dropTarget.type === DROP_TARGET_TYPES.ROOT) {
      if (!draggedAsset) return { isValid: false };
      if (isCreatableAtRoot(draggedAsset.assetType)) {
        return { isValid: true };
      } else {
        return { isValid: false };
      }
    }

    const targetAsset = assetsStore.unmergedAssets.find(a => a.id === dropTarget.id);
    if (!draggedAsset || !targetAsset) return { isValid: false };

    if (targetAsset.fqn && targetAsset.fqn.startsWith(draggedAsset.fqn)) {
      return { isValid: false, reason: 'Cannot drop an asset into itself or its children.' };
    }

    // Check structural folder via registry
    const registry = getEffectiveRegistry();
    const definition = registry[targetAsset.assetType!];
    const validChildren = definition?.isStructuralFolder
      ? getValidChildrenForFolder(targetAsset as UnmergedAsset)
      : getValidChildTypes(targetAsset.assetType);

    if (!validChildren.includes(draggedAsset.assetType)) {
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

