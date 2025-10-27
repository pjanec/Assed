// File: src/config/assetRegistry.ts
// This file provides dynamic access to the asset registry via ConfigurationHub
// All helper functions read from the perspective-aware effective registry

import type { Asset, AssetDefinition } from '@/core/types';
import { globalConfigHub } from '@/core/stores/config';
import { ASSET_TYPES } from '@/content/config/constants';
import { findNearestFunctionalParent } from '@/content/utils/assetUtils';

/**
 * Gets the effective asset registry based on the current perspective.
 * This function reads from ConfigurationHub which provides perspective-aware data.
 */
export function getEffectiveRegistry(): Record<string, AssetDefinition> {
  if (!globalConfigHub) {
    throw new Error('ConfigurationHub not initialized. Cannot access asset registry.');
  }
  return globalConfigHub.effectiveAssetRegistry.value;
}

/**
 * Retrieves the asset registration for a given asset type.
 * @param assetType The type of the asset (e.g., 'Environment', 'Node').
 * @returns The asset registration or null if not found.
 */
export function getAssetRegistration(assetType: string | null | undefined): AssetDefinition | null {
  if (!assetType) return null;
  const registry = getEffectiveRegistry();
  return registry[assetType] || null;
}

/**
 * Retrieves the allowed child asset types for a given asset type.
 * @param assetType The type of the asset (e.g., 'Environment', 'Node').
 * @returns An array of strings representing the valid child types.
 */
export function getValidChildTypes(assetType: string | null | undefined): string[] {
  if (!assetType) return [];
  const registry = getEffectiveRegistry();
  return registry[assetType]?.validChildren || [];
}

/**
 * Retrieves the valid child types for a folder or namespace based on its
 * functional parent in the hierarchy.
 * @param folderAsset The NamespaceFolder asset.
 * @returns An array of strings representing valid child types.
 */
export function getValidChildrenForFolder(folderAsset: Asset): string[] {
    const registry = getEffectiveRegistry();
    const isStructural = registry[folderAsset.assetType!]?.isStructuralFolder === true;
    const parentType = isStructural
      ? (findNearestFunctionalParent(folderAsset)?.assetType || ASSET_TYPES.ROOT)
      : folderAsset.assetType;
    const children = getValidChildTypes(parentType);
    
    // A folder can always contain another sub-folder.
    if (!children.includes(ASSET_TYPES.NAMESPACE_FOLDER)) {
        children.push(ASSET_TYPES.NAMESPACE_FOLDER);
    }
    return children;
}

/**
 * Returns all asset type keys from the effective registry.
 */
export function getAllAssetTypes(): string[] {
  return Object.keys(getEffectiveRegistry());
}

/**
 * Checks if an asset type is a structural folder.
 */
export function isStructuralFolder(type: string | null | undefined): boolean {
  if (!type) return false;
  const registry = getEffectiveRegistry();
  return registry[type]?.isStructuralFolder ?? false;
}

/**
 * Checks if an asset type can be created at the root level.
 */
export function isCreatableAtRoot(type: string | null | undefined): boolean {
  if (!type) return false;
  const registry = getEffectiveRegistry();
  return registry[type]?.isCreatableAtRoot ?? false;
}

















