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
    label: { default: 'Widget' },
    validChildren: [],
    icon: { default: 'mdi-toy-brick' },
    color: { default: 'blue' },
    inspectorComponent: { 
      default: () => import('@/core/components/InspectorPane.vue')
    },
    isCreatableAtRoot: true,
    creationModes: ['simple'],
    isRenameable: true,
    isDeletable: true,
    isStructuralFolder: false,
    postCloneFixup: fixTemplateFqn,
    sortOrder: 20,
    isShownInStats: true,
    isVisibleInExplorer: { default: true },
  },
  [MOCK_ASSET_TYPES.CONTAINER]: {
    label: { default: 'Container' },
    validChildren: [MOCK_ASSET_TYPES.WIDGET],
    icon: { default: 'mdi-archive' },
    color: { default: 'green' },
    isStructuralFolder: true,
    inspectorComponent: { 
      default: () => import('@/core/components/InspectorPane.vue')
    },
    isCreatableAtRoot: true,
    creationModes: ['simple'],
    isRenameable: true,
    isDeletable: true,
    postCloneFixup: fixTemplateFqn,
    sortOrder: 10,
    isShownInStats: true,
    virtualFolderProviders: ['AGGREGATED_VIEW'],
    isVisibleInExplorer: { default: true },
  },
  [MOCK_ASSET_TYPES.AGGREGATOR]: {
    label: { default: 'Aggregator' },
    validChildren: [],
    icon: { default: 'mdi-chart-donut' },
    color: { default: 'teal' },
    inspectorComponent: { 
      default: () => import('@/core/components/InspectorPane.vue')
    },
    isCreatableAtRoot: false,
    creationModes: [],
    isRenameable: false,
    isDeletable: false,
    isStructuralFolder: false,
    sortOrder: 50,
    isShownInStats: false,
    isSynthetic: true,
    isVisibleInExplorer: { default: false },
  },
  [MOCK_ASSET_TYPES.ENVIRONMENT]: {
    label: { default: 'Environment' },
    validChildren: [MOCK_ASSET_TYPES.NODE],
    icon: { default: 'mdi-earth' },
    color: { default: 'success' },
    inspectorComponent: { 
      default: () => import('@/core/components/InspectorPane.vue')
    },
    isCreatableAtRoot: true,
    creationModes: ['simple'],
    isRenameable: true,
    isDeletable: true,
    isStructuralFolder: false,
    postCloneFixup: fixTemplateFqn,
    virtualFolderProviders: ['GENERIC_MERGED_VIEW'],
    sortOrder: 10,
    isShownInStats: true,
    isVisibleInExplorer: { default: true },
  },
  [MOCK_ASSET_TYPES.NODE]: {
    label: { default: 'Node' },
    validChildren: [MOCK_ASSET_TYPES.PACKAGE],
    icon: { default: 'mdi-server' },
    color: { default: 'info' },
    inspectorComponent: { 
      default: () => import('@/core/components/InspectorPane.vue')
    },
    isCreatableAtRoot: true,
    creationModes: ['simple'],
    isRenameable: true,
    isDeletable: true,
    isStructuralFolder: false,
    postCloneFixup: fixTemplateFqn,
    sortOrder: 20,
    isShownInStats: true,
    isVisibleInExplorer: { default: true },
  },
  [MOCK_ASSET_TYPES.PACKAGE]: {
    label: { default: 'Package' },
    validChildren: [],
    icon: { default: 'mdi-package-variant' },
    color: { default: 'warning' },
    inspectorComponent: { 
      default: () => import('@/core/components/InspectorPane.vue')
    },
    isCreatableAtRoot: true,
    creationModes: ['simple'],
    isRenameable: true,
    isDeletable: true,
    isStructuralFolder: false,
    postCloneFixup: fixTemplateFqn,
    sortOrder: 40,
    isShownInStats: true,
    isVisibleInExplorer: { default: true },
  },
};