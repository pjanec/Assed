import { registerValidationRule } from '@/core/registries/validationRegistry';
import { ASSET_TYPES } from '@/content/config/constants';
import { mustHavePackageChild } from './nodeRules';

export function registerAllValidationRules() {
  registerValidationRule(ASSET_TYPES.NODE, mustHavePackageChild);
  console.log("✅ Content validation rules successfully registered with the Core.");
}