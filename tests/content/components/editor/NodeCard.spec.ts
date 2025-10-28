import { render, screen } from '@testing-library/vue';
import { createTestingPinia } from '@pinia/testing';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { createVuetify } from 'vuetify';
import { createApp } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { CorePlugin } from '@/core/plugin';
import { createMockContentPlugin } from '../../../mock-content/MockContentPlugin';
import { MockPersistenceAdapter } from '../../../mock-content/MockPersistenceAdapter';

import NodeCard from '@/content/components/editor/NodeCard.vue';
import { useUiStore, useAssetsStore } from '@/core/stores';
import { ASSET_TYPES } from '@/content/config/constants';
import { vDragsource } from '@/core/directives/dragsource';

// Mock the Vuetify components used in NodeCard
const vuetifyStubs = {
  VCard: { template: '<div><slot name="title"/><slot name="subtitle"/><slot/></div>' },
  VCardTitle: { template: '<div><slot/></div>' },
  VCardSubtitle: { template: '<div><slot/></div>' },
  VCardText: { template: '<div><slot/></div>' },
  VCardActions: { template: '<div><slot/></div>' },
  VChip: { template: '<span><slot/></span>' },
  VIcon: { template: '<i><slot/></i>' },
  VBtn: { template: '<button><slot/></button>' },
  VSpacer: { template: '<div/>' },
};

describe('NodeCard.vue', () => {
  let vuetify: any;
  
  beforeEach(() => {
    const app = createApp({});
    const pinia = createPinia();
    app.use(pinia);
    setActivePinia(pinia);

    vuetify = createVuetify();
    app.use(vuetify);

    const mockAdapter = new MockPersistenceAdapter([]);
    const mockContentPlugin = createMockContentPlugin(mockAdapter);

    app.use(CorePlugin);
    app.use(mockContentPlugin);
  });

  const mockNode = {
    id: 'uuid-100',
    assetKey: 'WebServer',
    fqn: 'DataCenter-minimal::WebServer',
    assetType: ASSET_TYPES.NODE,
  } as const;

  const mockRequirements = [
    {
      id: 'uuid-102',
      assetKey: 'Nginx',
      fqn: 'DataCenter-minimal::WebServer::Nginx',
      assetType: ASSET_TYPES.PACKAGE_KEY,
    },
  ] as const;

   // Helper function to render with all necessary globals
   const renderNodeCard = (props: any) => {
    const assetsStore = useAssetsStore();
    assetsStore.assets = [mockNode, ...mockRequirements];

    return render(NodeCard, {
      props,
      global: {
        plugins: [vuetify],
        stubs: vuetifyStubs,
        directives: {
          dragsource: vDragsource
        }
      },
    });
   }

  it('renders the node name and FQN correctly', () => {
    renderNodeCard({ node: mockNode });

    expect(screen.getByText('WebServer')).toBeInTheDocument();
    expect(screen.getByText('DataCenter-minimal::WebServer')).toBeInTheDocument();
  });

  it('displays a list of assigned requirements', () => {
    renderNodeCard({ node: mockNode });

    expect(screen.getByText('Requirements (1)')).toBeInTheDocument();
    expect(screen.getByText('Nginx')).toBeInTheDocument();
  });

  it('applies a "selected" class when the node is selected in the UI store', () => {
    // Setup the selected node BEFORE rendering
    const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: false });
    const assetsStore = useAssetsStore();
    assetsStore.assets = [mockNode, ...mockRequirements];
    const uiStore = useUiStore();
    uiStore.selectedNode = { id: 'uuid-100', type: 'asset', name: 'WebServer', path: '...' };

    const vuetify = createVuetify();

    const { container } = render(NodeCard, {
      props: { node: mockNode },
      global: {
        plugins: [pinia, vuetify],
        stubs: vuetifyStubs,
        directives: {
          dragsource: vDragsource
        }
      },
    });

    expect(container.firstChild).toHaveClass('node-card--selected');
  });
});


















