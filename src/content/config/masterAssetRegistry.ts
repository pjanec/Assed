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
    validChildren: [ASSET_TYPES.DISTRO, ASSET_TYPES.NODE, ASSET_TYPES.OPTION, ASSET_TYPES.PACKAGE, ASSET_TYPES.NAMESPACE_FOLDER, ASSET_TYPES.ENVIRONMENT],
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
    isVisibleInExplorer: { default: true },
    isSupported: { default: true },
    inspectorComponent: { 
      default: () => import('@/content/components/inspector/EnvironmentInspector.vue')
    },
    validChildren: [ASSET_TYPES.MACHINE, ASSET_TYPES.NAMESPACE_FOLDER],
    isCreatableAtRoot: true,
    creationModes: ['simple'],
    isRenameable: true,
    isDeletable: true,
    isStructuralFolder: false,
    sortOrder: 5,
    isShownInStats: true,
  },
  [ASSET_TYPES.DISTRO]: {
    label: { default: 'Distro' },
    icon: { default: 'mdi-application-brackets' },
    color: { default: 'blue' },
    isVisibleInExplorer: { 
      default: true,
      package: false,
      environment: true,
    },
    isSupported: {
      default: true,
      distro: true,
      package: false,
      environment: false,
    },
    inspectorComponent: { 
      default: () => import('@/content/components/inspector/DistroInspector.vue')
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
    color: { default: 'red-lighten-2' },
    isVisibleInExplorer: {
      default: true,
      package: false,
      environment: true,
    },
    isSupported: {
      default: true,
      distro: true,
      package: false,
      environment: false,
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
    isVisibleInExplorer: { 
      default: true,
      environment: false,
    },
    isSupported: {
      default: true,
      distro: false,
      package: true,
      environment: false,
    },
    inspectorComponent: { 
      default: () => import('@/content/components/inspector/PackageInspector.vue')
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
    icon: { default: 'mdi-package-variant' },
    color: { default: 'deep-purple' },
    isVisibleInExplorer: {
      default: true,
      package: false,
      environment: false,
    },
    isSupported: {
      default: true,
      distro: true,
      package: false,
      environment: false,
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
      package: false,
      environment: false,
    },
    isSupported: {
      default: true,
      distro: false,
      package: false,
      environment: false,
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
    validChildren: [ASSET_TYPES.ENVIRONMENT],
    isCreatableAtRoot: true,
    creationModes: ['simple'],
    isRenameable: true,
    isDeletable: true,
    isStructuralFolder: true,
    sortOrder: 99,
  },
  [ASSET_TYPES.MACHINE]: {
    label: { default: 'Machine' },
    icon: { default: 'mdi-desktop-tower-monitor' },
    color: { default: 'cyan-darken-1' },
    isVisibleInExplorer: { default: true },
    isSupported: { default: true },
    inspectorComponent: { 
      default: () => import('@/content/components/inspector/MachineInspector.vue')
    },
    validChildren: [ASSET_TYPES.NODE_KEY, ASSET_TYPES.NAMESPACE_FOLDER],
    isCreatableAtRoot: false,
    creationModes: ['simple'],
    isRenameable: true,
    isDeletable: true,
    isStructuralFolder: false,
    sortOrder: 15,
    isShownInStats: true,
  },
  [ASSET_TYPES.NODE_KEY]: {
    label: { default: 'Node Assignment' },
    icon: { default: 'mdi-server' },
    color: { default: 'deep-purple' },
    isVisibleInExplorer: {
      default: true,
      package: false,
      environment: true,
    },
    isSupported: {
      default: true,
      distro: false,
      package: false,
      environment: true,
    },
    inspectorComponent: { 
      default: () => import('@/content/components/inspector/NodeKeyInspector.vue')
    },
    validChildren: [],
    isCreatableAtRoot: false,
    creationModes: [],
    isRenameable: true,
    isDeletable: true,
    isStructuralFolder: false,
    sortOrder: 25,
    isShownInStats: false,
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

