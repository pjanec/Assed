import { describe, it, expect, beforeEach } from 'vitest';
import { createTestEnvironment } from '../../test-utils';
import { useCoreConfigStore } from '@/core/stores';
import { isDraggable } from '@/core/utils/assetTreeUtils';
import { ASSET_TYPES } from '@/content/config/constants';
import type { AssetTreeNode } from '@/core/types';

describe('isDraggable Utility with Perspective-Aware Rules', () => {
  let coreConfigStore: ReturnType<typeof useCoreConfigStore>;
  let env: ReturnType<typeof createTestEnvironment>;

  beforeEach(() => {
    env = createTestEnvironment([]);
    coreConfigStore = env.coreConfigStore;
  });

  it('should allow dragging when supported and non-synthetic in default perspective', () => {
    const configHub = (env as any).coreConfigStore ? (env as any).coreConfigStore : coreConfigStore;
    (configHub as any).$app?.config?.globalProperties?.$configHub?.setPerspective?.('default');

    const distroNode: AssetTreeNode = {
      id: 'distro-1',
      path: 'MyDistro',
      name: 'MyDistro',
      type: 'asset',
      assetType: ASSET_TYPES.DISTRO,
      children: []
    };

    const registry = coreConfigStore.effectiveAssetRegistry;
    expect(registry[ASSET_TYPES.DISTRO]).toBeDefined();

    expect(isDraggable(distroNode)).toBe(true);
  });

  
});


