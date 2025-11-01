import { computed, ref, inject, type Ref } from 'vue';
import { cloneDeep, get, set, unset, has } from 'lodash-es';
import type { AssetDetails } from '@/core/types';
import { useWorkspaceStore, UpdateAssetCommand } from '@/core/stores/workspace';

type CollectionItem = {
  key: string;
  value: any;
  isInherited: boolean;
};

export function useEditableCollection(
  assetDetails: Ref<AssetDetails>,
  collectionPath: string,
  onUpdateOverrides: (newOverrides: Record<string, any>) => void
) {
  const inspectorViewMode = inject<Ref<'merged' | 'local'>>('inspectorViewMode', undefined as any) || ref<'merged' | 'local'>('merged');

  const mergedCollection = computed(() =>
    get(assetDetails.value.merged?.properties, collectionPath, {}) || {}
  );

  const localCollection = computed(() =>
    get(assetDetails.value.unmerged.overrides, collectionPath, {}) || {}
  );

  const collectionAsObject = computed(() => {
    return inspectorViewMode.value === 'local'
      ? localCollection.value
      : { ...mergedCollection.value, ...localCollection.value };
  });

  const collectionAsArray = computed<CollectionItem[]>(() => {
    return Object.entries(collectionAsObject.value).map(([key, value]) => ({
      key,
      value,
      isInherited: !has(localCollection.value, key)
    }));
  });

  const addItem = (key: string, initialValue: any) => {
    if (assetDetails.value.isReadOnly) return;
    const newOverrides = cloneDeep(assetDetails.value.unmerged.overrides || {});
    const basePath = collectionPath.split('.');

    const parent = get(newOverrides, basePath);
    if (!parent || typeof parent !== 'object' || Array.isArray(parent)) {
      set(newOverrides, basePath, {} as any);
    }

    set(newOverrides, [...basePath, key], initialValue);
    onUpdateOverrides(newOverrides);
  };

  const removeItem = (key: string) => {
    if (assetDetails.value.isReadOnly) return;
    const newOverrides = cloneDeep(assetDetails.value.unmerged.overrides || {});
    const basePath = collectionPath.split('.');

    unset(newOverrides, [...basePath, key]);

    const parent = get(newOverrides, basePath);
    if (parent && typeof parent === 'object' && !Array.isArray(parent) && Object.keys(parent).length === 0) {
      unset(newOverrides, basePath);
    }
    onUpdateOverrides(newOverrides);
  };

  const updateItemProperty = (key: string, itemPropertyPath: string, value: any) => {
    if (assetDetails.value.isReadOnly) return;
    const newOverrides = cloneDeep(assetDetails.value.unmerged.overrides || {});
    const basePath = collectionPath.split('.');

    const parent = get(newOverrides, basePath);
    if (!parent || typeof parent !== 'object' || Array.isArray(parent)) {
      set(newOverrides, basePath, {} as any);
    }

    set(newOverrides, [...basePath, key, ...itemPropertyPath.split('.')], value);
    onUpdateOverrides(newOverrides);
  };

  return {
    collectionAsObject,
    collectionAsArray,
    addItem,
    removeItem,
    updateItemProperty
  };
}


