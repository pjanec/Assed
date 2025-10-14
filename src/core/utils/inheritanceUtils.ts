import type { UnmergedAsset, AssetDefinition } from '@/core/types';

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
  const fqnToAssetMap = new Map(allAssets.map(a => [a.fqn, a]));

  const localChildren = findFunctionalChildren(startAsset, childAssetType, allAssets, assetRegistry);
  localChildren.forEach(child => {
    finalCollection.set(child.assetKey, child);
  });

  let currentTemplateFqn = startAsset.templateFqn;
  const visitedTemplates = new Set<string>([startAsset.fqn]);

  while (currentTemplateFqn && !visitedTemplates.has(currentTemplateFqn)) {
    visitedTemplates.add(currentTemplateFqn);
    const templateAsset = fqnToAssetMap.get(currentTemplateFqn);

    if (templateAsset) {
      const inheritedChildren = findFunctionalChildren(templateAsset, childAssetType, allAssets, assetRegistry);

      inheritedChildren.forEach(child => {
        if (!finalCollection.has(child.assetKey)) {
          finalCollection.set(child.assetKey, child);
        }
      });

      currentTemplateFqn = templateAsset.templateFqn;
    } else {
      break;
    }
  }

  return Array.from(finalCollection.values());
}


