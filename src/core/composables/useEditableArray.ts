import { computed, inject, ref, type Ref } from 'vue';
import { cloneDeep, get, set, unset } from 'lodash-es';
import type { AssetDetails } from '@/core/types';

export interface UseEditableArrayOptions<T = any> {
  identityKey?: keyof T & string;
}

export function useEditableArray<T = any>(
  assetDetails: Ref<AssetDetails>,
  arrayPath: string,
  onUpdateOverrides: (newOverrides: Record<string, any>) => void,
  options?: UseEditableArrayOptions<T>
) {
  const inspectorViewMode = inject<Ref<'merged' | 'local'>>('inspectorViewMode', undefined as any) || ref<'merged' | 'local'>('merged');

  const mergedItems = computed<T[]>(() => {
    return (get(assetDetails.value.merged?.properties, arrayPath, []) as T[]) || [];
  });

  const localItems = computed<T[]>(() => {
    return (get(assetDetails.value.unmerged.overrides, arrayPath, []) as T[]) || [];
  });

  const items = computed<T[]>(() => {
    return inspectorViewMode.value === 'local' ? localItems.value : mergedItems.value;
  });

  const localIdentitySet = computed<Set<string>>(() => {
    const key = options?.identityKey;
    if (!key) return new Set();
    return new Set((localItems.value || []).map((it: any) => String(it?.[key])));
  });

  const isInherited = (item: T): boolean => {
    const key = options?.identityKey;
    if (!key) {
      return localItems.value.length === 0; // if no local override exists, everything shown (merged) is inherited
    }
    const id = (item as any)?.[key];
    return !localIdentitySet.value.has(String(id));
  };

  const addItem = (value: T) => {
    if (assetDetails.value.isReadOnly) return;
    const newOverrides = cloneDeep(assetDetails.value.unmerged.overrides || {});
    const current = (get(newOverrides, arrayPath, []) as T[]) || [];
    const next = Array.isArray(current) ? current.slice() : [];
    next.push(value);
    set(newOverrides, arrayPath, next);
    onUpdateOverrides(newOverrides);
  };

  const removeItem = (index: number) => {
    if (assetDetails.value.isReadOnly) return;
    const newOverrides = cloneDeep(assetDetails.value.unmerged.overrides || {});
    const current = (get(newOverrides, arrayPath, []) as T[]) || [];
    const next = Array.isArray(current) ? current.slice() : [];
    next.splice(index, 1);
    if (next.length === 0) {
      unset(newOverrides, arrayPath);
    } else {
      set(newOverrides, arrayPath, next);
    }
    onUpdateOverrides(newOverrides);
  };

  return {
    mergedItems,
    localItems,
    items,
    isInherited,
    addItem,
    removeItem,
  };
}


