import type { Asset } from '@/core/types';

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
















