import { registerValidationRule } from '@/core/registries/validationRegistry';
import { ASSET_TYPES } from '@/content/config/constants';
import { mustHavePackageChild } from './nodeRules';
import { unresolvedRequirement, unusedPackage } from './packageRules';

export function registerAllValidationRules() {
  registerValidationRule(ASSET_TYPES.NODE, mustHavePackageChild);
  registerValidationRule(ASSET_TYPES.PACKAGE_KEY, unresolvedRequirement);
  registerValidationRule(ASSET_TYPES.PACKAGE, unusedPackage);
  console.log("✅ Content validation rules successfully registered with the Core.");
}