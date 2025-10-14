import type { AssetDefinition } from '@/core/types';

/**
 * A generic post-clone hook to fix templateFqn references.
 * This can be reused by any asset type that has a templateFqn property.
 */
const fixTemplateFqn: AssetDefinition['postCloneFixup'] = (newlyClonedAsset, originalSourceAsset, cloneMap) => {
  const originalTemplateFqn = originalSourceAsset.templateFqn;

  // If the original didn't have a template, there's nothing to do.
  if (!originalTemplateFqn) {
    return newlyClonedAsset;
  }

  // Check if the original template is part of the assets being cloned.
  if (cloneMap.has(originalTemplateFqn)) {
    // It is an internal reference. Rewrite it to point to the new clone.
    newlyClonedAsset.templateFqn = cloneMap.get(originalTemplateFqn)!;
  } else {
    // It's an external, shared template. The reference is already correct, so no change is needed.
    // The newlyClonedAsset.templateFqn already holds the correct original value.
  }

  return newlyClonedAsset;
};

export const MOCK_ASSET_TYPES = {
  WIDGET: 'Widget',
  CONTAINER: 'Container',
  AGGREGATOR: 'Aggregator',
  ENVIRONMENT: 'Environment',
  NODE: 'Node',
  PACKAGE: 'Package',
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
    isStructuralFolder: false,
    postCloneFixup: fixTemplateFqn,
    sortOrder: 20,
    isShownInStats: true,
  },
  [MOCK_ASSET_TYPES.CONTAINER]: {
    label: 'Container',
    validChildren: [MOCK_ASSET_TYPES.WIDGET],
    icon: 'mdi-archive',
    color: 'green',
    isStructuralFolder: true,
    // --- Properties added to satisfy the AssetDefinition type ---
    inspectorComponent: () => import('@/core/components/InspectorPane.vue'), // A placeholder component
    isCreatableAtRoot: true,
    creationModes: ['simple'],
    isRenameable: true,
    isDeletable: true,
    postCloneFixup: fixTemplateFqn,
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
    isStructuralFolder: false,
    sortOrder: 50,
    isShownInStats: false,
    // Critical: mark as synthetic
    isSynthetic: true,
  },
  [MOCK_ASSET_TYPES.ENVIRONMENT]: {
    label: 'Environment',
    validChildren: [MOCK_ASSET_TYPES.NODE],
    icon: 'mdi-earth',
    color: 'success',
    inspectorComponent: () => import('@/core/components/InspectorPane.vue'),
    isCreatableAtRoot: true,
    creationModes: ['simple'],
    isRenameable: true,
    isDeletable: true,
    isStructuralFolder: false,
    postCloneFixup: fixTemplateFqn,
    virtualFolderProviders: ['GENERIC_MERGED_VIEW'],
    sortOrder: 10,
    isShownInStats: true,
  },
  [MOCK_ASSET_TYPES.NODE]: {
    label: 'Node',
    validChildren: [MOCK_ASSET_TYPES.PACKAGE],
    icon: 'mdi-server',
    color: 'info',
    inspectorComponent: () => import('@/core/components/InspectorPane.vue'),
    isCreatableAtRoot: true,
    creationModes: ['simple'],
    isRenameable: true,
    isDeletable: true,
    isStructuralFolder: false,
    postCloneFixup: fixTemplateFqn,
    sortOrder: 20,
    isShownInStats: true,
  },
  [MOCK_ASSET_TYPES.PACKAGE]: {
    label: 'Package',
    validChildren: [],
    icon: 'mdi-package-variant',
    color: 'warning',
    inspectorComponent: () => import('@/core/components/InspectorPane.vue'),
    isCreatableAtRoot: true,
    creationModes: ['simple'],
    isRenameable: true,
    isDeletable: true,
    isStructuralFolder: false,
    postCloneFixup: fixTemplateFqn,
    sortOrder: 40,
    isShownInStats: true,
  },
};