import type { UnmergedAsset } from "@/core/types";
import { getInheritanceChain } from '@/core/utils/inheritanceUtils';

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

  const allAssetsArray = Array.from(allAssets.values());
  const inheritanceChain = getInheritanceChain(asset.fqn, allAssetsArray);

  // The returned chain is from parent -> grandparent, so we reverse it to merge from the top down.
  const reversedChain = [...inheritanceChain].reverse();
    
  let mergedProperties: Record<string, any> = {};

  for (const template of reversedChain) {
      mergedProperties = deepMerge(mergedProperties, template.overrides || {});
  }
  // Finally, merge the asset's own overrides.
  mergedProperties = deepMerge(mergedProperties, asset.overrides || {});

  return { properties: mergedProperties };
}

/**
 * REFACTORED to use the new generic utility.
 */
export function getPropertyInheritanceChain(asset: UnmergedAsset, allAssets: Map<string, UnmergedAsset>): UnmergedAsset[] {
  const allAssetsArray = Array.from(allAssets.values());
  const ancestors = getInheritanceChain(asset.fqn, allAssetsArray);
    
  // The function's purpose is to return the full chain including the start asset.
  return [asset, ...ancestors];
}