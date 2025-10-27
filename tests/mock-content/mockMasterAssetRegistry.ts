import type { AssetDefinition } from '@/core/types';
import { MOCK_ASSET_TYPES, mockAssetRegistry } from './mockAssetRegistry';

export const mockMasterAssetRegistry: Record<string, AssetDefinition> = {
  [MOCK_ASSET_TYPES.CONTAINER]: {
    label: { 
      default: 'Container',
      environment: 'Environment',
      lab: 'Lab Setup'
    },
    icon: { 
      default: 'mdi-archive',
      lab: 'mdi-flask-outline'
    },
    color: { 
      default: 'green',
      lab: 'purple'
    },
    isVisibleInExplorer: { default: true },
    inspectorComponent: { 
      default: () => import('@/core/components/InspectorPane.vue')
    },
    validChildren: [MOCK_ASSET_TYPES.WIDGET],
    isCreatableAtRoot: true,
    creationModes: ['simple'],
    isRenameable: true,
    isDeletable: true,
    isStructuralFolder: true,
    postCloneFixup: mockAssetRegistry[MOCK_ASSET_TYPES.CONTAINER].postCloneFixup,
    sortOrder: 10,
    isShownInStats: true,
    virtualFolderProviders: ['AGGREGATED_VIEW']
  },
  [MOCK_ASSET_TYPES.WIDGET]: {
    label: { 
      default: 'Widget',
      package: 'Package Widget'
    },
    icon: { default: 'mdi-toy-brick' },
    color: { default: 'blue' },
    isVisibleInExplorer: { default: true },
    inspectorComponent: { 
      default: () => import('@/core/components/InspectorPane.vue')
    },
    validChildren: [],
    isCreatableAtRoot: true,
    creationModes: ['simple'],
    isRenameable: true,
    isDeletable: true,
    isStructuralFolder: false,
    postCloneFixup: mockAssetRegistry[MOCK_ASSET_TYPES.WIDGET].postCloneFixup,
    sortOrder: 20,
    isShownInStats: true
  },
  [MOCK_ASSET_TYPES.AGGREGATOR]: {
    label: { default: 'Aggregator' },
    icon: { default: 'mdi-chart-donut' },
    color: { default: 'teal' },
    isVisibleInExplorer: { 
      default: true,
      lab: false // Hidden in lab view
    },
    inspectorComponent: { 
      default: () => import('@/core/components/InspectorPane.vue')
    },
    validChildren: [],
    isCreatableAtRoot: false,
    creationModes: [],
    isRenameable: false,
    isDeletable: false,
    isStructuralFolder: false,
    sortOrder: 50,
    isShownInStats: false,
    isSynthetic: true
  }
};

