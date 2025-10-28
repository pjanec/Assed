// src/utils/assetUtils.js
import type { Asset, UnmergedAsset } from '@/core/types';
import { useAssetsStore } from '@/core/stores/assets';
import { getEffectiveRegistry } from '@/content/config/assetRegistry';
import { isAncestorOf, resolveInheritedCollection } from '@/core/utils/inheritanceUtils';
import { ASSET_TYPES } from '@/content/config/constants';

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

  // Structural FQN ancestry (not template inheritance):
  // compatible if equal or child is under ancestor path.
  if (childDistroFqn === potentialAncestorDistroFqn) return true;
  return childDistroFqn.startsWith(potentialAncestorDistroFqn + '::');
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

// ---- Environment Canvas helpers ----

// Walk up FQN to find nearest ancestor of given type (e.g., Environment/Distro), skipping namespace folders
export function findAncestorAssetOfType(fqn: string, targetType: string, assets: UnmergedAsset[]): UnmergedAsset | null {
  const parts = fqn.split('::');
  for (let i = parts.length; i >= 1; i--) {
    const prefix = parts.slice(0, i).join('::');
    const found = assets.find(a => a.fqn === prefix && a.assetType === targetType);
    if (found) return found as UnmergedAsset;
  }
  return null;
}

export function getEnvironmentForAsset(asset: UnmergedAsset, assets: UnmergedAsset[]): UnmergedAsset | null {
  return findAncestorAssetOfType(asset.fqn, ASSET_TYPES.ENVIRONMENT, assets);
}

export function getDistroForAsset(asset: UnmergedAsset, assets: UnmergedAsset[]): UnmergedAsset | null {
  return findAncestorAssetOfType(asset.fqn, ASSET_TYPES.DISTRO, assets);
}

// Machine belongs to Environment that selected the same distro as the Node's owning distro
export function isSameEnvironmentForNodeAssignment(machine: UnmergedAsset, node: UnmergedAsset, assets: UnmergedAsset[]): boolean {
  const nodeDistro = getDistroForAsset(node, assets);
  if (!nodeDistro) return false;

  const effectiveRegistry = getEffectiveRegistry();

  // Find all environments that use this node's distro (directly or via distro inheritance)
  const environmentsUsingNodeDistro = assets.filter(env => {
    if (env.assetType !== ASSET_TYPES.ENVIRONMENT) return false;
    const selectedDistro = (env as any).overrides?.distroFqn as string | undefined;
    if (!selectedDistro) return false;
    return selectedDistro === nodeDistro.fqn ||
           isSameOrAncestorDistro(nodeDistro.fqn, selectedDistro, assets as unknown as Asset[]);
  });

  // Check if the machine belongs to any of these environments (directly or via inheritance)
  for (const env of environmentsUsingNodeDistro) {
    const envMachines = resolveInheritedCollection(
      env,
      ASSET_TYPES.MACHINE,
      assets,
      effectiveRegistry
    );
    if (envMachines.some(m => m.id === machine.id)) {
      return true;
    }
  }

  // Fallback to original logic for backward compatibility
  const env = getEnvironmentForAsset(machine, assets);
  if (!env) return false;
  const selectedDistro = (env as any).overrides?.distroFqn as string | undefined;
  const ok = !!selectedDistro && (
    selectedDistro === nodeDistro.fqn ||
    isSameOrAncestorDistro(nodeDistro.fqn, selectedDistro, assets as unknown as Asset[])
  );
  if (!ok) {
    console.debug('[DND][EnvCheck] Mismatch:', {
      machine: machine.fqn,
      env: env.fqn,
      selectedDistro,
      node: node.fqn,
      nodeDistro: nodeDistro.fqn,
    });
  }
  return ok;
}
















