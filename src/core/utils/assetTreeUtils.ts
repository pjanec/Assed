// src/core/utils/assetTreeUtils.ts - Shared utilities for AssetTreeNode operations
import type { UnmergedAsset, AssetTreeNode, SelectedNode } from '@/core/types';
import { ASSET_TREE_NODE_TYPES } from '@/core/config/constants';
import { useAssetsStore } from '@/core/stores/assets';

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