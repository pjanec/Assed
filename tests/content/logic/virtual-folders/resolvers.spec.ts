import { describe, it, expect, beforeEach } from 'vitest';
import { createTestEnvironment } from '../../../test-utils';
import { ASSET_TYPES } from '../../../../src/content/config/constants';
import { resolveGenericMergedView } from '../../../../src/content/logic/virtual-folders/resolvers';
import type { UnmergedAsset } from '../../../../src/core/types';

describe('Virtual Folder Resolvers - Generic Merged View', () => {
  let assetsStore: any;

  const templateDistro: UnmergedAsset = {
    id: 'template-1',
    fqn: 'BaseDistro',
    assetType: ASSET_TYPES.DISTRO,
    assetKey: 'BaseDistro',
    templateFqn: null,
    overrides: {}
  };

  const inheritedPackage: UnmergedAsset = {
    id: 'pkg-1-inherited',
    fqn: 'BaseDistro::BaseWebServer',
    assetType: ASSET_TYPES.PACKAGE,
    assetKey: 'BaseWebServer',
    templateFqn: null,
    overrides: { port: 80, logging: 'standard' }
  };

  const startAsset: UnmergedAsset = {
    id: 'distro-1-start',
    fqn: 'ProdDistro',
    assetType: ASSET_TYPES.DISTRO,
    assetKey: 'ProdDistro',
    templateFqn: 'BaseDistro',
    overrides: {}
  };

  const overridePackage: UnmergedAsset = {
    id: 'pkg-2-override',
    fqn: 'ProdDistro::BaseWebServer',
    assetType: ASSET_TYPES.PACKAGE,
    assetKey: 'BaseWebServer',
    templateFqn: null,
    overrides: { port: 443, ssl: true }
  };

  const localPackage: UnmergedAsset = {
    id: 'pkg-3-local',
    fqn: 'ProdDistro::APIServer',
    assetType: ASSET_TYPES.PACKAGE,
    assetKey: 'APIServer',
    templateFqn: null,
    overrides: { threads: 4 }
  };

  const initialData: UnmergedAsset[] = [
    templateDistro, inheritedPackage, startAsset, overridePackage, localPackage
  ];

  beforeEach(async () => {
    const env = createTestEnvironment(initialData);
    assetsStore = env.assetsStore;
    await assetsStore.loadAssets();
  });

  it('should correctly resolve inherited, overridden, and local child assets', () => {
    const assetsWithOverrides = assetsStore.assetsWithOverrides;
    const result = resolveGenericMergedView(startAsset, assetsWithOverrides);

    expect(result).toHaveLength(1);
    const packagesFolder = result[0];
    expect(packagesFolder.name).toBe('Packages');
    expect(packagesFolder.children).toHaveLength(2);

    const webServerNode = packagesFolder.children.find(c => c.name === 'BaseWebServer');
    expect(webServerNode).toBeDefined();
    expect(webServerNode?.id).toBe('pkg-2-override');
    expect(webServerNode?.virtualContext?.payload).toEqual({ port: 443, ssl: true });

    const apiServerNode = packagesFolder.children.find(c => c.name === 'APIServer');
    expect(apiServerNode).toBeDefined();
    expect(apiServerNode?.id).toBe('pkg-3-local');
    expect(apiServerNode?.virtualContext?.payload).toEqual({ threads: 4 });
  });
});
