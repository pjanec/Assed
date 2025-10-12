// src/utils/diff.js
import { isObject, isEqual } from 'lodash-es';
import type { UnmergedAsset, Change } from '@/core/types';

/**
 * A map to define unique keys for specific array paths.
 * This makes array diffing deterministic.
 */
const ARRAY_KEY_MAP: Record<string, string> = {
  'overrides.FileDistrib.Parts': 'From',
  'properties.FileDistrib.Parts': 'From', // Also for merged properties
};

/**
 * A recursive function to compare two objects or values.
 * @param {*} oldValue The original value/object.
 * @param {*} newValue The new value/object.
 * @param {string} path The current dot-notation path.
 * @returns {Array} An array of change objects.
 */
function compare(oldValue: any, newValue: any, path: string): Change[] {
  const changes: Change[] = [];
  if (isEqual(oldValue, newValue)) {
    return [];
  }

  if (oldValue === undefined) {
      changes.push({ type: 'ADDED', path, newValue });
      return changes;
  }
   if (newValue === undefined) {
      changes.push({ type: 'REMOVED', path, oldValue });
      return changes;
  }
  if (!isObject(oldValue) || !isObject(newValue) || Array.isArray(oldValue) !== Array.isArray(newValue)) {
      changes.push({ type: 'MODIFIED', path, oldValue, newValue });
      return changes;
  }
  
  if (Array.isArray(oldValue)) {
    const key = ARRAY_KEY_MAP[path];
    if (key) {
        const oldMap = new Map((Array.isArray(oldValue) ? oldValue : []).map((item: any) => [item[key], item]));
        const newMap = new Map((Array.isArray(newValue) ? newValue : []).map((item: any) => [item[key], item]));
      const allKeys = new Set([...oldMap.keys(), ...newMap.keys()]);

      allKeys.forEach(k => {
        const oldItem = oldMap.get(k);
        const newItem = newMap.get(k);
        const itemPath = `${path}[${key}=${k}]`;

        if (oldItem && !newItem) {
          changes.push({ type: 'REMOVED', path: itemPath, oldValue: oldItem });
        } else if (!oldItem && newItem) {
          changes.push({ type: 'ADDED', path: itemPath, newValue: newItem });
        } else if (!isEqual(oldItem, newItem)) {
          changes.push(...compare(oldItem, newItem, itemPath));
        }
      });
    } else {
      changes.push({ type: 'MODIFIED', path, oldValue, newValue });
    }
    return changes;
  }

  const allKeys = new Set([...Object.keys(oldValue), ...Object.keys(newValue)]);
    allKeys.forEach(key => {
      const newPath = path ? `${path}.${key}` : key;
      changes.push(...compare(
        oldValue && typeof oldValue === 'object' ? (oldValue as Record<string, any>)[key] : undefined,
        newValue && typeof newValue === 'object' ? (newValue as Record<string, any>)[key] : undefined,
        newPath
      ));
  });
  return changes;
}

/**
 * Generates a diff between two full, unmerged asset states.
 * Used for DIRECTLY modified assets.
 * @param {object} oldState The original UnmergedAssetDto.
 * @param {object} newState The new UnmergedAssetDto.
 * @returns {Array} An array of change objects.
 */
export function generateAssetDiff(oldState: UnmergedAsset | null, newState: UnmergedAsset | null): Change[] {
  return compare(oldState || {}, newState || {}, '');
}

/**
 * Generates a diff between two MERGED properties objects.
 * Used for calculating the RIPPLE EFFECT.
 * @param {object} oldProps The original merged properties.
 * @param {object} newProps The new merged properties.
 * @returns {Array} An array of change objects.
 */
export function generatePropertiesDiff(oldProps: Record<string, any> | null, newProps: Record<string, any> | null): Change[] {
  return compare(oldProps || {}, newProps || {}, '');
}







