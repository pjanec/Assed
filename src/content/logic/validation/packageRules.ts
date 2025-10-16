import type { ValidationRule } from '@/core/types/validation';
import { ASSET_TYPES } from '@/content/config/constants';
import { getAssetEnvironmentFqn } from '@/content/utils/assetUtils';

/**
 * VALIDATION ERROR: Unresolved Requirement
 * Checks if a PackageKey points to a Package that actually exists within the same environment.
 */
export const unresolvedRequirement: ValidationRule = (asset, allAssets) => {
  // This rule only applies to PackageKey assets.
  if (asset.assetType !== ASSET_TYPES.PACKAGE_KEY) {
    return null;
  }

  // Find the environment this PackageKey belongs to.
  const envFqn = getAssetEnvironmentFqn(asset.fqn, allAssets);
  if (!envFqn) {
    // A PackageKey outside an environment is always considered unresolved.
    return {
      id: `${asset.id}-no-env`,
      severity: 'error',
      message: `Package Requirement '${asset.assetKey}' must be located within an Environment.`,
      assetId: asset.id,
      assetName: asset.assetKey,
      assetType: asset.assetType,
    };
  }

  // Check if any Package in the same environment can fulfill this requirement.
  const isResolved = allAssets.some(
    (pkg) =>
      pkg.assetType === ASSET_TYPES.PACKAGE &&
      pkg.assetKey === asset.assetKey &&
      getAssetEnvironmentFqn(pkg.fqn, allAssets) === envFqn
  );

  if (!isResolved) {
    return {
      id: `${asset.id}-unresolved`,
      severity: 'error',
      message: `The node requires the key '${asset.assetKey}', but it is not defined in the environment's package pool.`,
      assetId: asset.id,
      assetName: asset.assetKey,
      assetType: asset.assetType,
    };
  }

  return null;
};

/**
 * VALIDATION WARNING: Unused Package
 * Checks if a Package defined in an environment's package pool is actually used by any PackageKey.
 */
export const unusedPackage: ValidationRule = (asset, allAssets) => {
  // This rule only applies to Package assets.
  if (asset.assetType !== ASSET_TYPES.PACKAGE) {
    return null;
  }

  // Find the environment this Package belongs to. Shared packages are exempt.
  const envFqn = getAssetEnvironmentFqn(asset.fqn, allAssets);
  if (!envFqn) {
    return null;
  }

  // Check if any PackageKey in the same environment references this package's assetKey.
  const isUsed = allAssets.some(
    (key) =>
      key.assetType === ASSET_TYPES.PACKAGE_KEY &&
      key.assetKey === asset.assetKey &&
      getAssetEnvironmentFqn(key.fqn, allAssets) === envFqn
  );

  if (!isUsed) {
    return {
      id: `${asset.id}-unused`,
      severity: 'warning',
      message: `Package '${asset.assetKey}' is defined in the environment but is not used by any node.`,
      assetId: asset.id,
      assetName: asset.assetKey,
      assetType: asset.assetType,
    };
  }

  return null;
};


