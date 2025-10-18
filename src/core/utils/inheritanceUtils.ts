import type { UnmergedAsset, AssetDefinition, Asset } from '@/core/types';

/**
 * The new, generic utility to traverse the inheritance chain.
 * This is now the single source of truth for inheritance traversal.
 * @param startAssetFqn The FQN of the asset to start the traversal from.
 * @param allAssets A complete list of all assets in the project.
 * @returns An array of ancestor assets, from immediate parent to the root of the chain.
 */
export function getInheritanceChain<T extends Asset>(startAssetFqn: string, allAssets: T[]): T[] {
  const chain: T[] = [];
  const fqnToAssetMap = new Map(allAssets.map(a => [a.fqn, a]));
    
  let currentAsset = fqnToAssetMap.get(startAssetFqn);
  const visited = new Set<string>(); // To prevent infinite loops

  while (currentAsset?.templateFqn && !visited.has(currentAsset.fqn)) {
    visited.add(currentAsset.fqn);
      
    const parentAsset = fqnToAssetMap.get(currentAsset.templateFqn);
    if (!parentAsset) {
      break; // The chain is broken, stop here.
    }
      
    chain.push(parentAsset);
    currentAsset = parentAsset;
  }

  return chain;
}

/**
 * Checks if a potential ancestor is in the structural inheritance chain of a child asset.
 */
export function isAncestorOf(childFqn: string, potentialAncestorFqn: string, allAssets: Asset[]): boolean {
  return getInheritanceChain(childFqn, allAssets).some(ancestor => ancestor.fqn === potentialAncestorFqn);
}

function findFunctionalChildren(
  parentAsset: Pick<UnmergedAsset, 'fqn'>,
  childAssetType: string,
  allAssets: UnmergedAsset[],
  assetRegistry: Record<string, AssetDefinition>
): UnmergedAsset[] {
  const functionalChildren: UnmergedAsset[] = [];
  const queue: UnmergedAsset[] = [];

  const parentFqn = parentAsset.fqn || '';
  const parentFqnPartsCount = parentFqn ? parentFqn.split('::').length : 0;

  allAssets.forEach(asset => {
    const isDirectChild = parentFqn
      ? asset.fqn.startsWith(parentFqn + '::')
      : !asset.fqn.includes('::');

    if (isDirectChild && asset.fqn.split('::').length === parentFqnPartsCount + 1) {
      queue.push(asset);
    }
  });

  while (queue.length > 0) {
    const currentAsset = queue.shift();
    if (!currentAsset) continue;

    const definition = assetRegistry[currentAsset.assetType];

    if (currentAsset.assetType === childAssetType) {
      functionalChildren.push(currentAsset);
    }

    if (definition?.isStructuralFolder) {
      const currentFqnPartsCount = currentAsset.fqn.split('::').length;
      allAssets.forEach(asset => {
        if (asset.fqn.startsWith(currentAsset.fqn + '::') && asset.fqn.split('::').length === currentFqnPartsCount + 1) {
          queue.push(asset);
        }
      });
    }
  }

  return functionalChildren;
}

export function resolveInheritedCollection(
  startAsset: UnmergedAsset,
  childAssetType: string,
  allAssets: UnmergedAsset[],
  assetRegistry: Record<string, AssetDefinition>
): UnmergedAsset[] {
  const finalCollection = new Map<string, UnmergedAsset>();

  // 1. Get local children (no change here)
  const localChildren = findFunctionalChildren(startAsset, childAssetType, allAssets, assetRegistry);
  localChildren.forEach(child => {
    finalCollection.set(child.assetKey, child);
  });

  // 2. Get the entire inheritance chain in one call.
  const inheritanceChain = getInheritanceChain(startAsset.fqn, allAssets);

  // 3. Iterate through the chain to find and add inherited children.
  for (const templateAsset of inheritanceChain) {
    const inheritedChildren = findFunctionalChildren(templateAsset, childAssetType, allAssets, assetRegistry);

    inheritedChildren.forEach(child => {
      // Only add if a more specific version hasn't already been added.
      if (!finalCollection.has(child.assetKey)) {
        finalCollection.set(child.assetKey, child);
      }
    });
  }

  return Array.from(finalCollection.values());
}


