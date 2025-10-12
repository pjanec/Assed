import type { Asset } from '@/core/types';

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
















