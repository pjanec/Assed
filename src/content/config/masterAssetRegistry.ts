import type { AssetDefinition } from '@/core/types';
import { ASSET_TYPES } from '@/content/config/constants';
import { VIRTUAL_NODE_KINDS } from '@/content/logic/virtual-folders/kinds';

/**
 * A generic post-clone hook to fix templateFqn references.
 */
const fixTemplateFqn: AssetDefinition['postCloneFixup'] = (newlyClonedAsset, originalSourceAsset, cloneMap) => {
  const originalTemplateFqn = originalSourceAsset.templateFqn;

  if (!originalTemplateFqn) {
    return newlyClonedAsset;
  }

  if (cloneMap.has(originalTemplateFqn)) {
    newlyClonedAsset.templateFqn = cloneMap.get(originalTemplateFqn)!;
  }

  return newlyClonedAsset;
};

/**
 * Master Asset Registry with PerspectiveOverrides pattern.
 * This serves as the source of truth for all asset definitions.
 */
export const masterAssetRegistry: Record<string, AssetDefinition> = {
  [ASSET_TYPES.ROOT]: {
    label: { default: 'Root' },
    icon: { default: 'mdi-file-tree' },
    color: { default: 'grey' },
    isVisibleInExplorer: { default: true },
    isSupported: { default: true }, // Supported in all perspectives
    inspectorComponent: { 
      default: () => import('@/content/components/inspector/GenericAssetInspector.vue')
    },
    validChildren: [ASSET_TYPES.ENVIRONMENT, ASSET_TYPES.NODE, ASSET_TYPES.OPTION, ASSET_TYPES.PACKAGE, ASSET_TYPES.NAMESPACE_FOLDER],
    isCreatableAtRoot: false,
    creationModes: [],
    isRenameable: false,
    isDeletable: false,
    isStructuralFolder: true,
    sortOrder: 0,
  },
  [ASSET_TYPES.ENVIRONMENT]: {
    label: { default: 'Environment' },
    icon: { default: 'mdi-earth' },
    color: { default: 'success' },
    isVisibleInExplorer: { 
      default: true,
      package: false, // Hide in package editing perspective
    },
    isSupported: {
      default: true,
      environment: true,
      package: false, // NOT supported in package perspective
      lab: true
    },
    inspectorComponent: { 
      default: () => import('@/content/components/inspector/EnvironmentInspector.vue')
    },
    validChildren: [ASSET_TYPES.NODE, ASSET_TYPES.OPTION, ASSET_TYPES.PACKAGE, ASSET_TYPES.NAMESPACE_FOLDER],
    isCreatableAtRoot: true,
    creationModes: ['simple', 'full'],
    isRenameable: true,
    isDeletable: true,
    isStructuralFolder: false,
    postCloneFixup: fixTemplateFqn,
    virtualFolderProviders: [VIRTUAL_NODE_KINDS.GENERIC_MERGED_VIEW],
    sortOrder: 10,
    isShownInStats: true,
  },
  [ASSET_TYPES.NODE]: {
    label: { default: 'Node' },
    icon: { default: 'mdi-server' },
    color: { default: 'info' },
    isVisibleInExplorer: {
      default: true,
      package: false, // Hide in package editing perspective
    },
    isSupported: {
      default: true,
      environment: true,
      package: false, // NOT supported in package perspective
      lab: true
    },
    inspectorComponent: { 
      default: () => import('@/content/components/inspector/GenericAssetInspector.vue')
    },
    validChildren: [ASSET_TYPES.PACKAGE_KEY, ASSET_TYPES.NAMESPACE_FOLDER],
    isCreatableAtRoot: true,
    creationModes: ['simple', 'full'],
    isRenameable: true,
    isDeletable: true,
    isStructuralFolder: false,
    postCloneFixup: fixTemplateFqn,
    virtualFolderProviders: [VIRTUAL_NODE_KINDS.GENERIC_MERGED_VIEW],
    sortOrder: 20,
    isShownInStats: true,
  },
  [ASSET_TYPES.PACKAGE]: {
    label: { default: 'Package' },
    icon: { default: 'mdi-package-variant' },
    color: { default: 'warning' },
    isVisibleInExplorer: { default: true },
    isSupported: {
      default: true,
      environment: false, // NOT supported in environment perspective
      package: true,
      lab: true
    },
    inspectorComponent: { 
      default: () => import('@/content/components/inspector/GenericAssetInspector.vue')
    },
    validChildren: [],
    isCreatableAtRoot: true,
    creationModes: ['simple'],
    isRenameable: true,
    isDeletable: true,
    isStructuralFolder: false,
    initialOverrides: { Files: {} },
    postCloneFixup: fixTemplateFqn,
    sortOrder: 40,
    isShownInStats: true,
  },
  [ASSET_TYPES.PACKAGE_KEY]: {
    label: { default: 'Package Requirement' },
    icon: { default: 'mdi-link-variant' },
    color: { default: 'deep-purple' },
    isVisibleInExplorer: {
      default: true,
      package: false, // Hide in package editing perspective
    },
    isSupported: {
      default: true,
      environment: true,
      package: false, // NOT supported in package perspective
      lab: true
    },
    inspectorComponent: { 
      default: () => import('@/content/components/inspector/PackageKeyInspector.vue')
    },
    validChildren: [],
    isCreatableAtRoot: false,
    creationModes: ['simple'],
    isRenameable: true,
    isDeletable: true,
    isStructuralFolder: false,
    sortOrder: 50,
    isShownInStats: false,
  },
  [ASSET_TYPES.OPTION]: {
    label: { default: 'Option' },
    icon: { default: 'mdi-cog' },
    color: { default: 'purple' },
    isVisibleInExplorer: {
      default: true,
      package: false, // Hide in package editing perspective
    },
    isSupported: {
      default: true,
      environment: false, // NOT supported in environment perspective
      package: false, // NOT supported in package perspective
      lab: true
    },
    inspectorComponent: { 
      default: () => import('@/content/components/inspector/GenericAssetInspector.vue')
    },
    validChildren: [ASSET_TYPES.PACKAGE],
    isCreatableAtRoot: true,
    creationModes: ['simple'],
    isRenameable: true,
    isDeletable: true,
    isStructuralFolder: false,
    postCloneFixup: fixTemplateFqn,
    sortOrder: 30,
    isShownInStats: true,
  },
  [ASSET_TYPES.NAMESPACE_FOLDER]: {
    label: { default: 'Namespace Folder' },
    icon: { default: 'mdi-folder' },
    color: { default: 'primary' },
    isVisibleInExplorer: { default: true },
    isSupported: { default: true }, // Supported in all perspectives
    inspectorComponent: { 
      default: () => import('@/content/components/inspector/FolderInspector.vue')
    },
    validChildren: [],
    isCreatableAtRoot: true,
    creationModes: ['simple'],
    isRenameable: true,
    isDeletable: true,
    isStructuralFolder: true,
    sortOrder: 99,
  },
};

/**
 * Retrieves the asset registration for a given asset type from the master registry.
 */
export function getAssetRegistration(assetType: string | null | undefined): AssetDefinition | null {
  if (!assetType) return null;
  return masterAssetRegistry[assetType] || null;
}

/**
 * Retrieves the allowed child asset types for a given asset type.
 */
export function getValidChildTypes(assetType: string | null | undefined): string[] {
  if (!assetType) return [];
  return masterAssetRegistry[assetType]?.validChildren || [];
}

