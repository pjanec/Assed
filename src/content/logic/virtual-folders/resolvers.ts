import type { UnmergedAsset, AssetTreeNode } from '@/core/types';
import { ASSET_TYPES } from '@/content/config/constants';
import { ASSET_TREE_NODE_TYPES } from '@/core/config/constants';
import { VIRTUAL_NODE_KINDS, virtualFolderDefinitions } from './definitions';
import { calculateMergedAsset } from '@/content/utils/mergeUtils';

/**
 * Calculates the final "merged" state of all child packages for a Node.
 * It traces each package's full inheritance chain, computes the merged properties,
 * and returns virtual nodes representing this merged state, along with all discovered
 * dependencies for efficient caching.
 */
export function resolveMergedRequirements(
  node: UnmergedAsset,
  allAssets: UnmergedAsset[]
): AssetTreeNode[] {

  const virtualNodes: AssetTreeNode[] = [];
  const allAssetsMap = new Map(allAssets.map(a => [a.id, a]));
  const fqnMap = new Map(allAssets.map(a => [a.fqn, a]));

  // 2. Find ALL descendant packages of the node (any depth).
  const childPackages = allAssets.filter(a =>
    a.assetType === ASSET_TYPES.PACKAGE &&
    a.fqn.startsWith(node.fqn + '::')
  );

  // 3. Process each child package.
  const provider = virtualFolderDefinitions[VIRTUAL_NODE_KINDS.MERGED_REQUIREMENTS];

  for (const pkg of childPackages) {
    // 3a. Reuse the existing central utility to perform the merge calculation.
    const mergedResult = calculateMergedAsset(pkg.id, allAssetsMap);

  // 3b. (Dependency tracking removed)

    // 3c. Create the virtual node that will be displayed in the UI.
    const virtualNode: AssetTreeNode = {
      id: pkg.id, // Use REAL asset ID (alias pattern)
      name: pkg.assetKey, // Use the real package name for display consistency
      path: `${node.fqn}::Merged Requirements::${pkg.assetKey}`,
      type: ASSET_TREE_NODE_TYPES.ASSET,
      assetType: pkg.assetType,
      children: [],
      virtualContext: {
        kind: VIRTUAL_NODE_KINDS.MERGED_REQUIREMENTS,
        sourceAssetId: node.id,
        isReadOnly: true,
        payload: ('properties' in mergedResult) ? mergedResult.properties : { error: mergedResult.error },
        viewHint: provider?.defaultViewHint,
      },
    };

    virtualNodes.push(virtualNode);
  }

  // 4. Return the generated nodes.
  return virtualNodes;
}