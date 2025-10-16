import type { UnmergedAsset } from "@/core/types";

// This deepMerge utility is generic and can be shared.
function deepMerge(base: Record<string, any>, override: Record<string, any>): Record<string, any> {
  const merged: Record<string, any> = { ...base };
  for (const key in override) {
    if (Object.prototype.hasOwnProperty.call(override, key)) {
      if (typeof override[key] === 'object' && override[key] !== null && !Array.isArray(override[key]) && typeof merged[key] === 'object' && merged[key] !== null && !Array.isArray(merged[key])) {
        merged[key] = deepMerge(merged[key], override[key]);
      } else {
        merged[key] = override[key];
      }
    }
  }
  return merged;
}

/**
 * Calculates the final "merged" state of an asset by traversing its template inheritance chain.
 * This is a core business rule, independent of how assets are stored.
 * @param assetId The ID of the asset to merge.
 * @param allAssets A map of all available assets (ID -> UnmergedAsset) for lookup.
 * @returns The final merged properties, or an object with an error property if something goes wrong.
 */
export function calculateMergedAsset(assetId: string, allAssets: Map<string, UnmergedAsset>): { properties: Record<string, any> } | { error: string } {
  const asset = allAssets.get(assetId);
  if (!asset) {
    return { error: `Asset with ID ${assetId} not found during merge.` };
  }

  const inheritanceChain: UnmergedAsset[] = [];
  let mergedProperties: Record<string, any> = {};

  const fqnToIdMap = new Map<string, string>();
  allAssets.forEach(a => fqnToIdMap.set(a.fqn, a.id));

  let currentAsset: UnmergedAsset | undefined = asset;
  const chainCheck = new Set<string>([currentAsset.fqn]);

  while (currentAsset && currentAsset.templateFqn) {
    if (chainCheck.has(currentAsset.templateFqn)) {
      return { error: `Circular dependency detected in template chain for asset ${asset.fqn}` };
    }

    chainCheck.add(currentAsset.templateFqn);
    
    const templateId = fqnToIdMap.get(currentAsset.templateFqn);
    if (!templateId) {
      return { error: `Template asset with FQN "${currentAsset.templateFqn}" not found for asset ${currentAsset.fqn}` };
    }
    
    const templateAsset = allAssets.get(templateId);
    if (!templateAsset) {
      return { error: `Template asset with ID "${templateId}" not found.` };
    }
    
    inheritanceChain.unshift(templateAsset);
    currentAsset = templateAsset;
  }

  for (const template of inheritanceChain) {
      mergedProperties = deepMerge(mergedProperties, template.overrides || {});
  }
  mergedProperties = deepMerge(mergedProperties, asset.overrides || {});

  return { properties: mergedProperties };
}

/**
 * Gets the inheritance chain for an asset, showing the template hierarchy.
 * This is used for displaying "before and after" states in cross-environment copy dialogs.
 * @param asset The asset to get the inheritance chain for.
 * @param allAssets A map of all available assets (ID -> UnmergedAsset) for lookup.
 * @returns An array of assets representing the inheritance chain from base to derived.
 */
export function getPropertyInheritanceChain(asset: UnmergedAsset, allAssets: Map<string, UnmergedAsset>): UnmergedAsset[] {
  const inheritanceChain: UnmergedAsset[] = [asset];
  const fqnToIdMap = new Map<string, string>();
  allAssets.forEach(a => fqnToIdMap.set(a.fqn, a.id));

  let currentAsset: UnmergedAsset | undefined = asset;
  const chainCheck = new Set<string>([currentAsset.fqn]);

  while (currentAsset && currentAsset.templateFqn) {
    if (chainCheck.has(currentAsset.templateFqn)) {
      // Circular dependency detected, return what we have so far
      break;
    }

    chainCheck.add(currentAsset.templateFqn);
    
    const templateId = fqnToIdMap.get(currentAsset.templateFqn);
    if (!templateId) {
      // Template not found, return what we have so far
      break;
    }
    
    const templateAsset = allAssets.get(templateId);
    if (!templateAsset) {
      // Template asset not found, return what we have so far
      break;
    }
    
    inheritanceChain.push(templateAsset);
    currentAsset = templateAsset;
  }

  return inheritanceChain;
}