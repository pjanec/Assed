import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestEnvironment } from '../../test-utils';
import { MOCK_ASSET_TYPES } from '../../mock-content/mockAssetRegistry';
import type { UnmergedAsset, AssetTreeNode } from '@/core/types';

vi.mock('@/content/logic/virtual-folders/definitions', async () => {
  const { resolveAggregatedView } = await vi.importActual('../../mock-content/mockVirtualFolders');
  return {
    VIRTUAL_NODE_KINDS: { GENERIC_MERGED_VIEW: 'GENERIC_MERGED_VIEW' },
    virtualFolderDefinitions: {
      AGGREGATED_VIEW: {
        name: 'Aggregated View',
        icon: 'mdi-chart-donut',
        resolveChildren: resolveAggregatedView,
      },
    },
  };
});

const testData: UnmergedAsset[] = [
  { id: 'container-1', fqn: 'RootContainer', assetType: MOCK_ASSET_TYPES.CONTAINER as any, assetKey: 'RootContainer', overrides: {} },
  { id: 'widget-1', fqn: 'RootContainer::Widget1', assetType: MOCK_ASSET_TYPES.WIDGET as any, assetKey: 'Widget1', overrides: {} },
  { id: 'subfolder-1', fqn: 'RootContainer::SubFolder', assetType: MOCK_ASSET_TYPES.CONTAINER as any, assetKey: 'SubFolder', overrides: {} },
  { id: 'widget-2', fqn: 'RootContainer::SubFolder::Widget2', assetType: MOCK_ASSET_TYPES.WIDGET as any, assetKey: 'Widget2', overrides: {} },
];

describe('Synthetic Asset Architecture', () => {
  let assetsStore: any;

  beforeEach(async () => {
    const env = createTestEnvironment(testData);
    assetsStore = env.assetsStore;
    await assetsStore.loadAssets();
  });

  it('should generate a synthetic aggregator node with a stable, hierarchical ID', () => {
    const rootContainerNode = assetsStore.getAssetsByNamespace.find((n: AssetTreeNode) => n.path === 'RootContainer');
    expect(rootContainerNode).toBeDefined();
    const virtualFolder = rootContainerNode.children.find((c: AssetTreeNode) => c.type === 'folder');
    expect(virtualFolder).toBeDefined();
    const syntheticNode = virtualFolder.children.find((c: AssetTreeNode) => (c.assetType as any) === (MOCK_ASSET_TYPES.AGGREGATOR as any));
    expect(syntheticNode).toBeDefined();
    expect(syntheticNode.id).toBe('RootContainer::(synthetic:aggregated)');
  });
});


