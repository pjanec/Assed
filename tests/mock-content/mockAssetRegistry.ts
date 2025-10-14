import type { AssetDefinition } from '@/core/types';

export const MOCK_ASSET_TYPES = {
  WIDGET: 'Widget',
  CONTAINER: 'Container',
  AGGREGATOR: 'Aggregator',
} as const;

export const mockAssetRegistry: Record<string, AssetDefinition> = {
  [MOCK_ASSET_TYPES.WIDGET]: {
    label: 'Widget',
    validChildren: [],
    icon: 'mdi-toy-brick',
    color: 'blue',
    // --- Properties added to satisfy the AssetDefinition type ---
    inspectorComponent: () => import('@/core/components/InspectorPane.vue'), // A placeholder component
    isCreatableAtRoot: true,
    creationModes: ['simple'],
    isRenameable: true,
    isDeletable: true,
    isFolder: false,
    sortOrder: 20,
    isShownInStats: true,
  },
  [MOCK_ASSET_TYPES.CONTAINER]: {
    label: 'Container',
    validChildren: [MOCK_ASSET_TYPES.WIDGET],
    icon: 'mdi-archive',
    color: 'green',
    isFolder: true,
    // --- Properties added to satisfy the AssetDefinition type ---
    inspectorComponent: () => import('@/core/components/InspectorPane.vue'), // A placeholder component
    isCreatableAtRoot: true,
    creationModes: ['simple'],
    isRenameable: true,
    isDeletable: true,
    sortOrder: 10,
    isShownInStats: true,
    // Provide synthetic aggregator via virtual folder provider
    virtualFolderProviders: ['AGGREGATED_VIEW'],
  },
  [MOCK_ASSET_TYPES.AGGREGATOR]: {
    label: 'Aggregator',
    validChildren: [],
    icon: 'mdi-chart-donut',
    color: 'teal',
    inspectorComponent: () => import('@/core/components/InspectorPane.vue'),
    isCreatableAtRoot: false,
    creationModes: [],
    isRenameable: false,
    isDeletable: false,
    isFolder: false,
    sortOrder: 50,
    isShownInStats: false,
    // Critical: mark as synthetic
    isSynthetic: true,
  },
};