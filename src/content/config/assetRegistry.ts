// File: src/config/assetRegistry.ts

import type { Asset, UnmergedAsset, AssetDefinition, CloneMap, ValidationRules } from '@/core/types';
import type { Component } from 'vue';
import { findNearestFunctionalParent } from '@/content/utils/assetUtils';
import { ASSET_TYPES } from '@/content/config/constants';

/**
 * Define a reusable type for the async component loader
 */
type AsyncComponentLoader = () => Promise<Component>;



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

/**
 * The Asset Registry serves as the single source of truth for all
 * business logic, hierarchy rules, and validation related to the asset model.
 */
export const assetRegistry: Record<string, AssetDefinition> = {
  [ASSET_TYPES.ROOT]: {
    label: 'Root',
    validChildren: [ASSET_TYPES.ENVIRONMENT, ASSET_TYPES.NODE, ASSET_TYPES.OPTION, ASSET_TYPES.PACKAGE, ASSET_TYPES.NAMESPACE_FOLDER],
    icon: 'mdi-file-tree',
    color: 'grey',
    inspectorComponent: () => import('@/content/components/inspector/GenericAssetInspector.vue'),
    isCreatableAtRoot: false,
    creationModes: [],
    isRenameable: false,
    isDeletable: false,
    isFolder: true,
    sortOrder: 0,
  },
  [ASSET_TYPES.ENVIRONMENT]: {
    label: 'Environment',
    validChildren: [ASSET_TYPES.NODE, ASSET_TYPES.OPTION, ASSET_TYPES.NAMESPACE_FOLDER],
    icon: 'mdi-earth',
    color: 'success',
    inspectorComponent: () => import('@/content/components/inspector/EnvironmentInspector.vue'),
    isCreatableAtRoot: true,
    creationModes: ['simple', 'full'],
    isRenameable: true,
    isDeletable: true,
    isFolder: false,
    postCloneFixup: fixTemplateFqn,
    sortOrder: 10,
    isShownInStats: true,
  },
  [ASSET_TYPES.NODE]: {
    label: 'Node',
    validChildren: [ASSET_TYPES.PACKAGE, ASSET_TYPES.NAMESPACE_FOLDER],
    icon: 'mdi-server',
    color: 'info',
    inspectorComponent: () => import('@/content/components/inspector/GenericAssetInspector.vue'),
    isCreatableAtRoot: true,
    creationModes: ['simple', 'full'],
    isRenameable: true,
    isDeletable: true,
    isFolder: false,
    postCloneFixup: fixTemplateFqn,
    sortOrder: 20,
    isShownInStats: true,
  },
  [ASSET_TYPES.PACKAGE]: {
    label: 'Package',
    validChildren: [],
    icon: 'mdi-package-variant',
    color: 'warning',
    inspectorComponent: () => import('@/content/components/inspector/GenericAssetInspector.vue'),
    isCreatableAtRoot: true,
    creationModes: ['simple'],
    isRenameable: true,
    isDeletable: true,
    isFolder: false,
    initialOverrides: { Files: {} },
    postCloneFixup: fixTemplateFqn,
    sortOrder: 40,
    isShownInStats: true,
  },
  [ASSET_TYPES.OPTION]: {
    label: 'Option',
    validChildren: [ASSET_TYPES.PACKAGE],
    icon: 'mdi-cog',
    color: 'purple',
    inspectorComponent: () => import('@/content/components/inspector/GenericAssetInspector.vue'),
    isCreatableAtRoot: true,
    creationModes: ['simple'],
    isRenameable: true,
    isDeletable: true,
    isFolder: false,
    postCloneFixup: fixTemplateFqn,
    sortOrder: 30,
    isShownInStats: true,
  },
  [ASSET_TYPES.NAMESPACE_FOLDER]: {
    label: 'Namespace Folder',
    validChildren: [],
    icon: 'mdi-folder',
    color: 'primary',
    inspectorComponent: () => import('@/content/components/inspector/FolderInspector.vue'),
    isCreatableAtRoot: true,
    creationModes: ['simple'],
    isRenameable: true,
    isDeletable: true,
    isFolder: true,
    sortOrder: 99,
  },
};

/**
 * Retrieves the asset registration for a given asset type.
 * @param assetType The type of the asset (e.g., 'Environment', 'Node').
 * @returns The asset registration or null if not found.
 */
export function getAssetRegistration(assetType: string | null | undefined): AssetDefinition | null {
  if (!assetType) return null;
  return assetRegistry[assetType] || null;
}

/**
 * Retrieves the allowed child asset types for a given asset type.
 * @param assetType The type of the asset (e.g., 'Environment', 'Node').
 * @returns An array of strings representing the valid child types.
 */
export function getValidChildTypes(assetType: string | null | undefined): string[] {
  if (!assetType) return [];
  return assetRegistry[assetType]?.validChildren || [];
}

/**
 * Retrieves the valid child types for a folder or namespace based on its
 * functional parent in the hierarchy.
 * @param folderAsset The NamespaceFolder asset.
 * @returns An array of strings representing valid child types.
 */
export function getValidChildrenForFolder(folderAsset: Asset): string[] {
    const functionalParent = findNearestFunctionalParent(folderAsset);
    const parentType = functionalParent ? functionalParent.assetType : ASSET_TYPES.ROOT;
    const children = getValidChildTypes(parentType);
    
    // A folder can always contain another sub-folder.
    if (!children.includes(ASSET_TYPES.NAMESPACE_FOLDER)) {
        children.push(ASSET_TYPES.NAMESPACE_FOLDER);
    }
    return children;
}

















