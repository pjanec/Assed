import type { ValidationRule } from '@/core/types/validation';
import { ASSET_TYPES } from '@/content/config/constants';
import { getAssetDistroFqn } from '@/content/utils/assetUtils';

/**
 * VALIDATION ERROR: Unresolved Requirement
 * Checks if a PackageKey points to a Package that actually exists within the same distro.
 */
export const unresolvedRequirement: ValidationRule = (asset, allAssets) => {
  // This rule only applies to PackageKey assets.
  if (asset.assetType !== ASSET_TYPES.PACKAGE_KEY) {
    return null;
  }

  // Find the distro this PackageKey belongs to.
  const distroFqn = getAssetDistroFqn(asset.fqn, allAssets);
  if (!distroFqn) {
    // A PackageKey outside a distro is always considered unresolved.
    return {
      id: `${asset.id}-no-distro`,
      severity: 'error',
      message: `Package Requirement '${asset.assetKey}' must be located within a Distro.`,
      assetId: asset.id,
      assetName: asset.assetKey,
      assetType: asset.assetType,
    };
  }

  // Check if any Package in the same distro can fulfill this requirement.
  const isResolved = allAssets.some(
    (pkg) =>
      pkg.assetType === ASSET_TYPES.PACKAGE &&
      pkg.assetKey === asset.assetKey &&
      getAssetDistroFqn(pkg.fqn, allAssets) === distroFqn
  );

  if (!isResolved) {
    return {
      id: `${asset.id}-unresolved`,
      severity: 'error',
      message: `The node requires the key '${asset.assetKey}', but it is not defined in the distro's package pool.`,
      assetId: asset.id,
      assetName: asset.assetKey,
      assetType: asset.assetType,
    };
  }

  return null;
};

/**
 * VALIDATION WARNING: Unused Package
 * Checks if a Package defined in a distro's package pool is actually used by any PackageKey.
 */
export const unusedPackage: ValidationRule = (asset, allAssets) => {
  // This rule only applies to Package assets.
  if (asset.assetType !== ASSET_TYPES.PACKAGE) {
    return null;
  }

  // Find the distro this Package belongs to. Shared packages are exempt.
  const distroFqn = getAssetDistroFqn(asset.fqn, allAssets);
  if (!distroFqn) {
    return null;
  }

  // Check if any PackageKey in the same distro references this package's assetKey.
  const isUsed = allAssets.some(
    (key) =>
      key.assetType === ASSET_TYPES.PACKAGE_KEY &&
      key.assetKey === asset.assetKey &&
      getAssetDistroFqn(key.fqn, allAssets) === distroFqn
  );

  if (!isUsed) {
    return {
      id: `${asset.id}-unused`,
      severity: 'warning',
      message: `Package '${asset.assetKey}' is defined in the distro but is not used by any node.`,
      assetId: asset.id,
      assetName: asset.assetKey,
      assetType: asset.assetType,
    };
  }

  return null;
};


