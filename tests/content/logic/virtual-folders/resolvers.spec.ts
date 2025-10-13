import { describe, it, expect, beforeEach } from 'vitest';
import { createTestEnvironment } from '../../../test-utils';
import { ASSET_TYPES } from '../../../../src/content/config/constants';
import { resolveMergedRequirements } from '../../../../src/content/logic/virtual-folders/resolvers';
import type { UnmergedAsset } from '../../../../src/core/types';

describe('Virtual Folder Resolvers - Merged Requirements', () => {
  let assetsStore: any, workspaceStore: any;

  const templateAsset: UnmergedAsset = {
    id: 'template-1',
    fqn: 'BaseWebServer',
    assetType: ASSET_TYPES.PACKAGE,
    assetKey: 'BaseWebServer',
    templateFqn: null,
    overrides: {
      name: 'base-server',
      conf: {
        port: 80,
        ssl: false,
        license: 'MIT',
        resources: {
          cpu: '0.5 cores'
        }
      }
    }
  };

  const realAsset: UnmergedAsset = {
    id: 'real-1',
    fqn: 'DataCenter-minimal::WebServer::Nginx',
    assetType: ASSET_TYPES.PACKAGE,
    assetKey: 'Nginx',
    templateFqn: 'BaseWebServer',
    overrides: {
      name: 'nginx',
      conf: {
        version: '1.21.0'
      }
    }
  };

  const nodeAsset: UnmergedAsset = {
    id: 'node-1',
    fqn: 'DataCenter-minimal::WebServer',
    assetType: ASSET_TYPES.NODE,
    assetKey: 'WebServer',
    templateFqn: null,
    overrides: {}
  };

  const initialData: UnmergedAsset[] = [templateAsset, realAsset, nodeAsset];

  beforeEach(() => {
    const env = createTestEnvironment(initialData);
    assetsStore = env.assetsStore;
    workspaceStore = env.workspaceStore;
  });

  it('should produce identical merged properties for virtual assets as real assets', async () => {
    // 1. ARRANGE: Load assets (this now pre-loads asset details for all assets)
    await assetsStore.loadAssets();

    // 2. ACT: Test the virtual folder resolver with assets that have overrides
    const assetsWithOverrides = assetsStore.assetsWithOverrides;
    const result = resolveMergedRequirements(nodeAsset, assetsWithOverrides);

    // 3. ASSERT: Verify the virtual asset has the correct merged properties
    expect(result.nodes).toHaveLength(1);
    
    const virtualNode = result.nodes[0];
    expect(virtualNode.virtualContext?.payload).toBeDefined();
    
    const virtualMergedProperties = virtualNode.virtualContext?.payload;
    
    // The virtual asset should have the same merged properties as the real asset
    // This should include both template properties AND the asset's own overrides
    expect(virtualMergedProperties).toEqual({
      name: 'nginx', // From real asset overrides
      conf: {
        port: 80,        // From template
        ssl: false,      // From template
        license: 'MIT',  // From template
        resources: {     // From template
          cpu: '0.5 cores'
        },
        version: '1.21.0' // From real asset overrides (overwrites template)
      }
    });
  });

  it('should fail when assets have empty overrides (the bug we fixed)', async () => {
    // 1. ARRANGE: Load assets but DON'T populate asset details cache
    await assetsStore.loadAssets();
    
    // Use unmergedAssets which strips overrides (the old buggy behavior)
    const assetsWithoutOverrides = assetsStore.unmergedAssets;
    
    // 2. ACT: Test the virtual folder resolver with assets that have empty overrides
    const result = resolveMergedRequirements(nodeAsset, assetsWithoutOverrides);

    // 3. ASSERT: Verify the virtual asset has incomplete merged properties
    expect(result.nodes).toHaveLength(1);
    
    const virtualNode = result.nodes[0];
    const virtualMergedProperties = virtualNode.virtualContext?.payload;
    
    // The bug: when assets have empty overrides, the template lookup fails
    // because the template asset also has empty overrides in unmergedAssets
    // This results in an empty merged result instead of template properties
    expect(virtualMergedProperties).toEqual({});
  });

  it('should handle assets with no template correctly', async () => {
    // 1. ARRANGE: Create an asset with no template
    const standaloneAsset: UnmergedAsset = {
      id: 'standalone-1',
      fqn: 'DataCenter-minimal::WebServer::Standalone',
      assetType: ASSET_TYPES.PACKAGE,
      assetKey: 'Standalone',
      templateFqn: null,
      overrides: {
        name: 'standalone-server',
        conf: {
          port: 8080,
          custom: 'value'
        }
      }
    };

    const testData = [...initialData, standaloneAsset];
    const env = createTestEnvironment(testData);
    assetsStore = env.assetsStore;
    workspaceStore = env.workspaceStore;
    
    await assetsStore.loadAssets();
    
    // Load asset details
    const standaloneAssetTreeNode = {
      id: standaloneAsset.id,
      type: 'ASSET' as const,
      assetType: standaloneAsset.assetType
    };
    await assetsStore.loadAssetDetails(standaloneAssetTreeNode);

    // 2. ACT: Test with the standalone asset
    const assetsWithOverrides = assetsStore.assetsWithOverrides;
    const result = resolveMergedRequirements(nodeAsset, assetsWithOverrides);

    // 3. ASSERT: Should have 2 virtual nodes now (Nginx + Standalone)
    expect(result.nodes).toHaveLength(2);
    
    const standaloneVirtualNode = result.nodes.find(n => n.name === 'Standalone');
    expect(standaloneVirtualNode).toBeDefined();
    
    const standaloneMergedProperties = standaloneVirtualNode?.virtualContext?.payload;
    
    // Should only have its own overrides since there's no template
    expect(standaloneMergedProperties).toEqual({
      name: 'standalone-server',
      conf: {
        port: 8080,
        custom: 'value'
      }
    });
  });
});
