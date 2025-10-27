import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { cleanup, render } from '@testing-library/vue';
import AssetTreeNode from '@/core/components/AssetTreeNode.vue';
import type { AssetTreeNode as AssetTreeNodeType } from '@/core/types';
import { ASSET_TREE_NODE_TYPES } from '@/core/config/constants';
import { createVuetify } from 'vuetify';
import { createApp } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { CorePlugin } from '@/core/plugin';
import { createMockContentPlugin } from '../../mock-content/MockContentPlugin';
import { MockPersistenceAdapter } from '../../mock-content/MockPersistenceAdapter';
import { MOCK_ASSET_TYPES } from '../../mock-content/mockAssetRegistry';

afterEach(() => {
  cleanup();
});

function setup() {
  const app = createApp({});
  const pinia = createPinia();
  app.use(pinia);
  setActivePinia(pinia);

  const vuetify = createVuetify();
  app.use(vuetify);

  const mockAdapter = new MockPersistenceAdapter([]);
  const mockContentPlugin = createMockContentPlugin(mockAdapter);

  app.use(CorePlugin);
  app.use(mockContentPlugin);

  return { vuetify, pinia };
}

const standaloneAssetNode: AssetTreeNodeType = {
  id: 'standalone',
  name: 'Standalone Asset',
  path: '/standalone',
  type: ASSET_TREE_NODE_TYPES.ASSET,
  assetType: MOCK_ASSET_TYPES.PACKAGE as any,
  templateFqn: null,
  children: [],
};

const pureLinkAssetNode: AssetTreeNodeType = {
  id: 'purelink',
  name: 'Pure Link Asset',
  path: '/purelink',
  type: ASSET_TREE_NODE_TYPES.ASSET,
  assetType: MOCK_ASSET_TYPES.PACKAGE as any,
  templateFqn: 'core::SomeTemplate',
  children: [],
};

const overrideAssetNode: AssetTreeNodeType = {
  id: 'override',
  name: 'Override Asset',
  path: '/override',
  type: ASSET_TREE_NODE_TYPES.ASSET,
  assetType: MOCK_ASSET_TYPES.PACKAGE as any,
  templateFqn: 'core::SomeTemplate',
  children: [],
  // @ts-expect-error - partial type accommodates optional overrides
  overrides: { property: 'newValue' },
};

describe('AssetTreeNode Inheritance Icons', () => {
  let vuetify: any;
  let pinia: any;

  beforeEach(() => {
    const { vuetify: v, pinia: p } = setup();
    vuetify = v;
    pinia = p;
  });

  it('renders only the base icon for a standalone asset', async () => {
    const { getByTestId, queryByTestId } = render(AssetTreeNode, {
      props: { node: standaloneAssetNode, viewType: 'default' },
      global: { plugins: [pinia, vuetify] },
    });

    const baseIcon = getByTestId('base-icon');
    expect(baseIcon).toBeInTheDocument();
    expect(baseIcon.getAttribute('aria-label')).toBe('mdi-package-variant');
    expect(queryByTestId('inheritance-overlay')).toBeNull();
  });

  it('renders a link overlay for a pure link asset', async () => {
    const { getByTestId } = render(AssetTreeNode, {
      props: { node: pureLinkAssetNode, viewType: 'default' },
      global: { plugins: [pinia, vuetify] },
    });

    const overlay = getByTestId('inheritance-overlay');
    expect(overlay).toBeInTheDocument();
    expect(overlay.getAttribute('aria-label')).toBe('mdi-link-variant');
  });

  it('renders a pencil overlay for an override asset', async () => {
    const { getByTestId } = render(AssetTreeNode, {
      props: { node: overrideAssetNode, viewType: 'default' },
      global: { plugins: [pinia, vuetify] },
    });

    const overlay = getByTestId('inheritance-overlay');
    expect(overlay).toBeInTheDocument();
    expect(overlay.getAttribute('aria-label')).toBe('mdi-pencil');
  });
});


