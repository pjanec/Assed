import type { UnmergedAsset, AssetTreeNode } from '@/core/types';
import { ASSET_TREE_NODE_TYPES } from '@/core/config/constants';
import { virtualFolderDefinitions } from './definitions';
import { VIRTUAL_NODE_KINDS, type VirtualNodeKind } from './kinds';
import { calculateMergedAsset } from '@/core/utils/mergeUtils';
import { assetRegistry } from '@/content/config/assetRegistry';
import { resolveInheritedCollection } from '@/core/utils/inheritanceUtils';
import { ASSET_TYPES } from '@/content/config/constants';

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
  const provider = virtualFolderDefinitions[VIRTUAL_NODE_KINDS.GENERIC_MERGED_VIEW];

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
        kind: VIRTUAL_NODE_KINDS.GENERIC_MERGED_VIEW,
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

/**
 * A generic resolver that finds all functional (non-structural) descendants of a source asset,
 * calculates their merged state, and organizes them into virtual sub-folders based on asset type.
 */
export function resolveGenericMergedView(
  sourceAsset: UnmergedAsset,
  allAssets: UnmergedAsset[]
): AssetTreeNode[] {
  const allAssetsMap = new Map(allAssets.map(a => [a.id, a]));

  // Candidate child types: registry-defined children plus common functional types
  const potentialChildTypes = new Set<string>([
    ...(assetRegistry[sourceAsset.assetType]?.validChildren || []),
    ASSET_TYPES.PACKAGE,
    ASSET_TYPES.OPTION,
  ]);

  const provider = virtualFolderDefinitions[VIRTUAL_NODE_KINDS.GENERIC_MERGED_VIEW];
  const subFolders: AssetTreeNode[] = [];

  potentialChildTypes.forEach(assetType => {
    if (assetType === ASSET_TYPES.NAMESPACE_FOLDER) return;

    // Start with children directly under the source asset according to structural inheritance
    const byKey = new Map<string, UnmergedAsset>();
    resolveInheritedCollection(sourceAsset, assetType, allAssets, assetRegistry)
      .forEach(a => byKey.set(a.assetKey, a));

    // If this child type commonly sits under functional intermediaries (e.g., Packages under Nodes),
    // walk one functional hop through those intermediaries and include their children unless overridden locally.
    const directFunctionalChildren = (assetRegistry[sourceAsset.assetType]?.validChildren || [])
      .filter(t => !assetRegistry[t]?.isStructuralFolder);

    const intermediaryTypes = directFunctionalChildren.filter(t => (assetRegistry[t]?.validChildren || []).includes(assetType));

    intermediaryTypes.forEach(intermediaryType => {
      const intermediaries = resolveInheritedCollection(sourceAsset, intermediaryType, allAssets, assetRegistry);
      intermediaries.forEach(interAsset => {
        resolveInheritedCollection(interAsset as UnmergedAsset, assetType, allAssets, assetRegistry)
          .forEach(child => {
            if (!byKey.has(child.assetKey)) {
              byKey.set(child.assetKey, child);
            }
          });
      });
    });

    const finalChildren = Array.from(byKey.values());
    if (finalChildren.length === 0) return;

    const children: AssetTreeNode[] = finalChildren.map(asset => {
      const mergedResult = calculateMergedAsset(asset.id, allAssetsMap);
      return {
        id: asset.id,
        name: asset.assetKey,
        path: `${sourceAsset.fqn}::Merged View::${assetType}::${asset.assetKey}`,
        type: ASSET_TREE_NODE_TYPES.ASSET,
        assetType: asset.assetType,
        children: [],
        virtualContext: {
          kind: VIRTUAL_NODE_KINDS.GENERIC_MERGED_VIEW,
          sourceAssetId: sourceAsset.id,
          isReadOnly: true,
          payload: ('properties' in mergedResult) ? mergedResult.properties : { error: (mergedResult as any).error },
          viewHint: provider?.defaultViewHint,
        },
      } as AssetTreeNode;
    }).sort((a, b) => a.name.localeCompare(b.name));

    const subFolderNode: AssetTreeNode = {
      id: `${sourceAsset.id}-merged-${assetType}`,
      name: `${assetType}s`,
      path: `${sourceAsset.fqn}::Merged View::${assetType}s`,
      type: ASSET_TREE_NODE_TYPES.FOLDER,
      children,
      virtualContext: { kind: VIRTUAL_NODE_KINDS.GENERIC_MERGED_VIEW, sourceAssetId: sourceAsset.id },
    } as AssetTreeNode;

    subFolders.push(subFolderNode);
  });

  return subFolders.sort((a, b) => a.name.localeCompare(b.name));
}