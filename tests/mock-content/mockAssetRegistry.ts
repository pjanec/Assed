import type { AssetDefinition } from '@/core/types';

export const MOCK_ASSET_TYPES = {
  WIDGET: 'Widget',
  CONTAINER: 'Container',
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
  },
};