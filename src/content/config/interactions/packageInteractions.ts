import type { InteractionRule, DropAction } from '@/core/registries/interactionRegistry';
import type { InteractionRuleEntry } from '@/core/stores/ConfigurationHub';
import type { DragPayload, DropTarget } from '@/core/types/drag-drop';
import { ASSET_TYPES } from '@/content/config/constants';
import { useAssetsStore, useUiStore } from '@/core/stores';
import { DeriveAssetCommand, CloneAssetCommand } from '@/core/stores/workspace';
import type { UnmergedAsset } from '@/core/types';
import { DROP_ACTION_IDS, DROP_TARGET_TYPES } from '@/core/config/constants';
import { areInSameDistro, isSharedAsset, getAssetDistroFqn } from '@/content/utils/assetUtils';

const MOVE_PACKAGE: DropAction = {
  id: DROP_ACTION_IDS.MOVE,
  label: 'Move Package',
  icon: 'mdi-file-move',
  cursor: 'move',
  execute: (dragPayload: DragPayload, dropTarget: DropTarget, workspaceStore: any) => {
    const assetsStore = useAssetsStore();
    let newParentFqn: string | null = null;
    
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

export function getPackageDropAction(draggedAsset: any, targetAsset: any, dragPayload: DragPayload): DropAction[] {
  const assetsStore = useAssetsStore();
  const allAssets = assetsStore.unmergedAssets;
  const sourceParentId = dragPayload.parentAssetId;

  if (!sourceParentId) {
    if (isSharedAsset(draggedAsset, allAssets)) {
      return [DERIVE_PACKAGE];
    } else {
      const draggedDistro = getAssetDistroFqn(draggedAsset.fqn, allAssets);
      const targetDistro = getAssetDistroFqn(targetAsset.fqn, allAssets);
      return draggedDistro !== targetDistro ? [COPY_PACKAGE] : [MOVE_PACKAGE];
    }
  }

  const sourceParentAsset = allAssets.find(a => a.id === sourceParentId);
  if (!sourceParentAsset) return [];

  return areInSameDistro(sourceParentAsset, targetAsset, allAssets) ? [MOVE_PACKAGE] : [COPY_PACKAGE];
}

const packageToNodeRule: InteractionRule = {
  validate: (dragPayload: DragPayload, dropTarget: DropTarget) => {
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
    return getPackageDropAction(draggedAsset, targetAsset, dragPayload);
  },
};

export const packageInteractions: InteractionRuleEntry[] = [
  {
    draggedType: ASSET_TYPES.PACKAGE,
    targetType: ASSET_TYPES.NODE,
    rule: packageToNodeRule
  },
  {
    draggedType: ASSET_TYPES.PACKAGE,
    targetType: ASSET_TYPES.OPTION,
    rule: packageToNodeRule
  },
];

