import { ASSET_TREE_NODE_TYPES, VIRTUAL_NODE_KINDS } from '@/core/config/constants';
import type { UnmergedAsset, AssetTreeNode } from '@/core/types';
import { MOCK_ASSET_TYPES } from './mockAssetRegistry';

export function resolveAggregatedView(
  sourceAsset: UnmergedAsset,
  allAssets: UnmergedAsset[]
): AssetTreeNode[] {
  const descendants = allAssets.filter(a => a.fqn.startsWith(sourceAsset.fqn + '::'));
  const containedFqns = descendants.map(d => d.fqn);
  const syntheticId = `${sourceAsset.fqn}::(synthetic:aggregated)`;

  const syntheticNode: AssetTreeNode = {
    id: syntheticId,
    name: 'Aggregated View',
    path: syntheticId,
    type: ASSET_TREE_NODE_TYPES.ASSET,
    assetType: MOCK_ASSET_TYPES.AGGREGATOR as any,
    children: [],
    virtualContext: {
      kind: VIRTUAL_NODE_KINDS.SYNTHETIC_ASSET,
      sourceAssetId: sourceAsset.id,
      isReadOnly: true,
      payload: { containedAssets: containedFqns },
    },
  };

  return [syntheticNode];
}


