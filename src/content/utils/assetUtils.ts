// src/utils/assetUtils.js
import type { Asset } from '@/core/types';
import { useAssetsStore } from '@/core/stores/assets';
import { assetRegistry } from '@/content/config/assetRegistry';
import { isAncestorOf } from '@/core/utils/inheritanceUtils';

/**
 * Returns the appropriate Material Design Icon name for a given asset type.
 * @param {string} assetType - The type of the asset (e.g., 'Package').
 * @returns {string} The MDI icon name.
 */
export const getAssetIcon = (assetType: Asset['assetType']): string => {
  return assetRegistry[assetType]?.icon || 'mdi-file-question-outline';
};

/**
 * Returns the appropriate theme color for a given asset type.
 * @param {string} assetType - The type of the asset.
 * @returns {string} The Vuetify color name.
 */
export const getAssetTypeColor = (assetType: Asset['assetType']): string => {
  return assetRegistry[assetType]?.color || 'grey';
};

/**
 * Find the nearest functional parent asset (non-NamespaceFolder) for smart context menus.
 * @param {Asset} asset - The asset to find the nearest functional parent for.
 * @returns {Asset | null} The nearest functional parent or null if none found.
 */
export function findNearestFunctionalParent(asset: Asset): Asset | null {
  const assetsStore = useAssetsStore();
  const assetsMap = new Map(assetsStore.unmergedAssets.map(a => [a.fqn, a]));

  let current: Asset | null = asset;
  while (current) {
    if (!current.fqn) return null;
    const parentFqn = current.fqn.substring(0, current.fqn.lastIndexOf('::'));
    if (!parentFqn) {
      return null; // We've reached the root
    }

    const parent = assetsMap.get(parentFqn);
    if (parent && !assetRegistry[parent.assetType]?.isStructuralFolder) {
      return parent;
    }
    current = parent || null;
  }
  return null; // Should not be reached if structure is sound
}

// Helper to get all top-level environment FQNs for efficient lookup
const getEnvironmentFqns = (allAssets: Asset[]): Set<string> => {
  return new Set(
    allAssets
      .filter(a => a.assetType === 'Environment' && !a.fqn.includes('::'))
      .map(a => a.fqn)
  );
};

/**
 * Determines the FQN of the top-level environment an asset belongs to.
 * @param assetFqn The FQN of the asset to check.
 * @param allAssets A complete list of all assets in the project.
 * @returns The environment FQN, or null if it's a shared/global asset.
 */
export function getAssetEnvironmentFqn(assetFqn: string, allAssets: Asset[]): string | null {
  const envFqns = getEnvironmentFqns(allAssets);
  for (const envFqn of envFqns) {
    // An asset belongs to an environment if its FQN starts with the environment's FQN followed by '::'
    if (assetFqn.startsWith(envFqn + '::')) {
      return envFqn;
    }
  }
  // If no match is found, it's a shared asset.
  return null;
}

/**
 * Checks if two assets reside within the same top-level environment.
 * @param assetA The first asset.
 * @param assetB The second asset.
 * @param allAssets A complete list of all assets in the project.
 * @returns True if both assets are in the same environment, false otherwise.
 */
export function areInSameEnvironment(assetA: Asset, assetB: Asset, allAssets: Asset[]): boolean {
  const envA = getAssetEnvironmentFqn(assetA.fqn, allAssets);
  const envB = getAssetEnvironmentFqn(assetB.fqn, allAssets);
  // Both must be non-null (i.e., not shared) and their environment FQNs must be identical.
  return !!envA && envA === envB;
}

/**
 * Checks if an asset is a "shared" asset (i.e., not located under any environment).
 * @param asset The asset to check.
 * @param allAssets A complete list of all assets in the project.
 * @returns True if the asset is shared, false otherwise.
 */
export function isSharedAsset(asset: Asset, allAssets: Asset[]): boolean {
  return getAssetEnvironmentFqn(asset.fqn, allAssets) === null;
}

/**
 * Checks if two environment FQNs are the same or if one is an ancestor of the other.
 * @param childEnvFqn The FQN of the environment that might be the descendant.
 * @param potentialAncestorEnvFqn The FQN of the environment that might be the ancestor.
 * @param allAssets A complete list of all assets in the project.
 * @returns True if the environments are identical or if the potential ancestor is in the child's chain.
 */
export function isSameOrAncestorEnvironment(childEnvFqn: string | null, potentialAncestorEnvFqn: string | null, allAssets: Asset[]): boolean {
  // If either environment doesn't exist in this context, they aren't compatible.
  if (!childEnvFqn || !potentialAncestorEnvFqn) {
    return false;
  }
    
  // They are compatible if they are the same OR if one is an ancestor of the other.
  return (childEnvFqn === potentialAncestorEnvFqn) || isAncestorOf(childEnvFqn, potentialAncestorEnvFqn, allAssets);
}
















