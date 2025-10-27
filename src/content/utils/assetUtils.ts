// src/utils/assetUtils.js
import type { Asset } from '@/core/types';
import { useAssetsStore } from '@/core/stores/assets';
import { getEffectiveRegistry } from '@/content/config/assetRegistry';
import { isAncestorOf } from '@/core/utils/inheritanceUtils';

/**
 * Returns the appropriate Material Design Icon name for a given asset type.
 * @param {string} assetType - The type of the asset (e.g., 'Package').
 * @returns {string} The MDI icon name.
 */
export const getAssetIcon = (assetType: Asset['assetType']): string => {
  const registry = getEffectiveRegistry();
  const def = registry[assetType];
  if (!def) return 'mdi-file-question-outline';
  // ConfigurationHub already returns unwrapped plain string values
  const icon = def.icon as any;
  return icon || 'mdi-file-question-outline';
};

/**
 * Returns the appropriate theme color for a given asset type.
 * @param {string} assetType - The type of the asset.
 * @returns {string} The Vuetify color name.
 */
export const getAssetTypeColor = (assetType: Asset['assetType']): string => {
  const registry = getEffectiveRegistry();
  const def = registry[assetType];
  if (!def) return 'grey';
  // ConfigurationHub already returns unwrapped plain string values
  const color = def.color as any;
  return color || 'grey';
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
    if (parent) {
      const registry = getEffectiveRegistry();
      if (!registry[parent.assetType]?.isStructuralFolder) {
        return parent;
      }
    }
    current = parent || null;
  }
  return null; // Should not be reached if structure is sound
}

// Helper to get all top-level distro FQNs for efficient lookup
const getDistroFqns = (allAssets: Asset[]): Set<string> => {
  return new Set(
    allAssets
      .filter(a => a.assetType === 'Distro' && !a.fqn.includes('::'))
      .map(a => a.fqn)
  );
};

/**
 * Determines the FQN of the top-level distro an asset belongs to.
 * @param assetFqn The FQN of the asset to check.
 * @param allAssets A complete list of all assets in the project.
 * @returns The distro FQN, or null if it's a shared/global asset.
 */
export function getAssetDistroFqn(assetFqn: string, allAssets: Asset[]): string | null {
  const distroFqns = getDistroFqns(allAssets);
  for (const distroFqn of distroFqns) {
    // An asset belongs to a distro if its FQN starts with the distro's FQN followed by '::'
    if (assetFqn.startsWith(distroFqn + '::')) {
      return distroFqn;
    }
  }
  // If no match is found, it's a shared asset.
  return null;
}

/**
 * Checks if two assets reside within the same top-level distro.
 * @param assetA The first asset.
 * @param assetB The second asset.
 * @param allAssets A complete list of all assets in the project.
 * @returns True if both assets are in the same distro, false otherwise.
 */
export function areInSameDistro(assetA: Asset, assetB: Asset, allAssets: Asset[]): boolean {
  const distroA = getAssetDistroFqn(assetA.fqn, allAssets);
  const distroB = getAssetDistroFqn(assetB.fqn, allAssets);
  // Both must be non-null (i.e., not shared) and their distro FQNs must be identical.
  return !!distroA && distroA === distroB;
}

/**
 * Checks if an asset is a "shared" asset (i.e., not located under any distro).
 * @param asset The asset to check.
 * @param allAssets A complete list of all assets in the project.
 * @returns True if the asset is shared, false otherwise.
 */
export function isSharedAsset(asset: Asset, allAssets: Asset[]): boolean {
  return getAssetDistroFqn(asset.fqn, allAssets) === null;
}

/**
 * Checks if two distro FQNs are the same or if one is an ancestor of the other.
 * @param childDistroFqn The FQN of the distro that might be the descendant.
 * @param potentialAncestorDistroFqn The FQN of the distro that might be the ancestor.
 * @param allAssets A complete list of all assets in the project.
 * @returns True if the distros are identical or if the potential ancestor is in the child's chain.
 */
export function isSameOrAncestorDistro(childDistroFqn: string | null, potentialAncestorDistroFqn: string | null, allAssets: Asset[]): boolean {
  // If either distro doesn't exist in this context, they aren't compatible.
  if (!childDistroFqn || !potentialAncestorDistroFqn) {
    return false;
  }
    
  // They are compatible if they are the same OR if one is an ancestor of the other.
  return (childDistroFqn === potentialAncestorDistroFqn) || isAncestorOf(childDistroFqn, potentialAncestorDistroFqn, allAssets);
}

/**
 * Checks if an asset is a "pure derivative" of a shared global template.
 * A pure derivative has a templateFqn pointing to a shared asset and has no local overrides.
 * @param asset The asset to check.
 * @param allAssets A complete list of all assets in the project.
 * @returns The shared template asset if the check passes, otherwise null.
 */
export function getSharedTemplateIfPureDerivative(asset: Asset, allAssets: Asset[]): Asset | null {
  // 1. Must have a template
  if (!asset.templateFqn) {
    return null;
  }

  // 2. Overrides object must be empty (only for UnmergedAsset)
  if ('overrides' in asset && asset.overrides && Object.keys(asset.overrides).length > 0) {
    return null;
  }

  // 3. Find the template and check if it's shared
  const templateAsset = allAssets.find(a => a.fqn === asset.templateFqn);
  if (templateAsset && isSharedAsset(templateAsset, allAssets)) {
    return templateAsset;
  }

  return null;
}
















