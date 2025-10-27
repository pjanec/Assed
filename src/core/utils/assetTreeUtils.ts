// src/core/utils/assetTreeUtils.ts - Shared utilities for AssetTreeNode operations
import type { UnmergedAsset, AssetTreeNode, SelectedNode } from '@/core/types';
import { ASSET_TREE_NODE_TYPES } from '@/core/config/constants';
import { useAssetsStore } from '@/core/stores/assets';
import { useCoreConfigStore } from '@/core/stores/config';

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
  if (!isRealAsset(node)) {
    return false;
  }

  // Check the asset registry to see if the asset type is synthetic.
  const coreConfig = useCoreConfigStore();
  const definition = node?.assetType ? coreConfig.getAssetDefinition(node.assetType) : null;
    
  // Draggable if it's NOT synthetic AND supported in current perspective
  if (!definition) return false;
  
  // Check if asset type is synthetic
  if (definition.isSynthetic) return false;
  
  // Check if asset type is supported in current perspective
  if (!node?.assetType) return false;
  
  const effectiveRegistry = coreConfig.effectiveAssetRegistry;
  const effectiveDef = effectiveRegistry[node.assetType];
  if (!effectiveDef) return false;
  
  // Only draggable if supported in current perspective
  return (effectiveDef as any)._isSupportedInCurrentPerspective !== false;
}