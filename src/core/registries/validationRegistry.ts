import type { ValidationRule } from '@/core/types/validation';

const validationRules = new Map<string, ValidationRule[]>();

export function registerValidationRule(assetType: string, rule: ValidationRule) {
  if (!validationRules.has(assetType)) {
    validationRules.set(assetType, []);
  }
  validationRules.get(assetType)!.push(rule);
}

export function getValidationRulesForType(assetType: string): ValidationRule[] {
  return validationRules.get(assetType) || [];
}