import type { ValidationRule } from '@/core/types/validation';
import { ASSET_TYPES } from '@/content/config/constants';

export const mustHavePackageChild: ValidationRule = (asset, allAssets) => {
  if (asset.assetType !== ASSET_TYPES.NODE) {
    return null;
  }

  const hasPackage = allAssets.some(
    a => a.assetType === ASSET_TYPES.PACKAGE && a.fqn.startsWith(asset.fqn + '::')
  );

  if (!hasPackage) {
    return {
      id: `${asset.id}-missing-package`,
      severity: 'warning',
      message: 'Node should have at least one Package child.',
      assetName: asset.assetKey,
      assetType: asset.assetType,
      assetId: asset.id,
    };
  }

  return null;
};