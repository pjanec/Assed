// src/core/utils/assetTreeUtils.ts - Shared utilities for AssetTreeNode operations
import type { UnmergedAsset, AssetTreeNode, SelectedNode } from '@/core/types';
import { ASSET_TREE_NODE_TYPES } from '@/core/config/constants';
import { useAssetsStore } from '@/core/stores/assets';
import { useCoreConfigStore, globalConfigHub } from '@/core/stores/config';

/**
 * Creates an AssetTreeNode from an asset ID by looking it up in the assets store.
 * @param assetId - The ID of the asset to convert
 * @returns AssetTreeNode or null if asset not found
 */
export const createTreeNodeFromAssetId = (assetId: string): AssetTreeNode | null => {
  const assetsStore = useAssetsStore();
  const asset = assetsStore.unmergedAssets.find(a => a.id === assetId);
  if (!asset) return null;
  
  return {
    ...asset,
    path: asset.fqn,
    name: asset.id,
    type: ASSET_TREE_NODE_TYPES.ASSET,
    children: []
  };
};

/**
 * Creates an AssetTreeNode from an UnmergedAsset object.
 * @param asset - The UnmergedAsset to convert
 * @returns AssetTreeNode
 */
export const createTreeNodeFromAsset = (asset: UnmergedAsset): AssetTreeNode => {
  return {
    ...asset,
    path: asset.fqn,
    name: asset.id,
    type: ASSET_TREE_NODE_TYPES.ASSET,
    children: []
  };
};

/**
 * Creates an AssetTreeNode from a SelectedNode, handling the missing children property.
 * @param selectedNode - The SelectedNode to convert
 * @returns AssetTreeNode or null if conversion not possible
 */
export const createTreeNodeFromSelectedNode = (selectedNode: SelectedNode | any): AssetTreeNode | null => {
  if (!selectedNode) return null;
  
  // If it's already an AssetTreeNode, return it
  if ('children' in selectedNode) return selectedNode;
  
  // If it has an id, try to find the asset
  if (selectedNode.id) {
    const assetsStore = useAssetsStore();
    const asset = assetsStore.unmergedAssets.find(a => a.id === selectedNode.id);
    if (asset) {
      return {
        ...asset,
        path: asset.fqn,
        name: asset.id,
        type: ASSET_TREE_NODE_TYPES.ASSET,
        children: [],
        virtualContext: selectedNode.virtualContext
      };
    }
  }
  
  // Fallback: create from SelectedNode properties
  return {
    ...selectedNode,
    children: [],
    assetType: undefined // Optional Asset properties
  };
};

/**
 * Checks if a tree node represents a real, concrete asset.
 * @param node The AssetTreeNode to check.
 * @returns True if the node is of type 'asset'.
 */
export function isRealAsset(node: AssetTreeNode | null | undefined): boolean {
  return !!node && node.type === ASSET_TREE_NODE_TYPES.ASSET;
}

/**
 * Checks if a tree node should be draggable by the user.
 * An asset is draggable if it's a real asset and not a synthetic one.
 * @param node The AssetTreeNode to check.
 * @returns True if the user should be able to start a drag operation from this node.
 */
export function isDraggable(node: AssetTreeNode | null | undefined): boolean {
  if (!isRealAsset(node) || !node?.id) {
    return false;
  }

  const assetsStore = useAssetsStore();
  const coreConfig = useCoreConfigStore();

  const assetExists = assetsStore.unmergedAssets.some(a => a.id === node.id);
  if (!assetExists) {
    const definition = node.assetType ? coreConfig.getAssetDefinition(node.assetType) : null;
    if (!definition || (definition as any).isSynthetic) return false;
    const effectiveDef = node.assetType ? coreConfig.effectiveAssetRegistry[node.assetType] : null;
    if (!effectiveDef) return false;
    return (effectiveDef as any)._isSupportedInCurrentPerspective !== false;
  }

  const draggedType = node.assetType as string | undefined;
  if (!draggedType) return false;
  const rules = globalConfigHub?.effectiveInteractionRules.value;
  if (!rules) return false;
  const hasRuleForFolder = rules.has(`${draggedType}->Folder`) || rules.has(`Asset->Folder`);
  return hasRuleForFolder;
}