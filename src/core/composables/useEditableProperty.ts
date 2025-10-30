import { computed, type Ref, inject, ref } from 'vue';
import { get, set, unset, has, cloneDeep } from 'lodash-es';
import type { AssetDetails } from '@/core/types';

/**
 * Manages the "Show Merged, Edit Override" logic for a single property
 * in an asset inspector.
 *
 * @param assetDetails A Ref containing the full AssetDetails (unmerged and merged)
 * @param propertyPath The dot-notation path to the property (e.g., 'name', 'conf.network.port')
 * @param onUpdateOverrides A callback function that will be invoked with the
 * complete new `overrides` object when a change occurs.
 */
export function useEditableProperty(
  assetDetails: Ref<AssetDetails>,
  propertyPath: string,
  onUpdateOverrides: (newOverrides: Record<string, any>) => void
) {
  const inspectorViewMode = inject<Ref<'merged' | 'local'>>('inspectorViewMode', ref<'merged' | 'local'>('merged'));
  /**
   * (Read-only) The final calculated value inherited from the template chain.
   * Returns `undefined` if the property doesn't exist in the merged properties.
   */
  const mergedValue = computed<any>(() => {
    if (!assetDetails.value.merged || 'error' in assetDetails.value.merged) {
      return undefined;
    }
    return get(assetDetails.value.merged.properties, propertyPath);
  });

  /**
   * (Read-only) The raw local value from the `unmerged.overrides` object.
   * Returns `undefined` if a local override is not set for this path.
   */
  const localOverride = computed<any>(() => {
    return get(assetDetails.value.unmerged.overrides, propertyPath);
  });

  /**
   * (Read-only) True if a local override exists for this exact property path.
   */
  const isOverridden = computed<boolean>(() => {
    return has(assetDetails.value.unmerged.overrides, propertyPath);
  });

  /**
   * The "copy-on-write" update function.
   * Creates a deep clone of the current overrides and applies the new value
   * using the property path, then emits the full new overrides object.
   */
  const update = (newValue: any) => {
    if (assetDetails.value.isReadOnly) {
      console.warn('Attempted to edit a read-only asset.');
      return;
    }

    const newOverrides = cloneDeep(assetDetails.value.unmerged.overrides || {});
    set(newOverrides, propertyPath, newValue);
    onUpdateOverrides(newOverrides);
  };

  /**
   * The "reset" function.
   * Creates a deep clone of the current overrides and removes the property
   * at the specified path, then emits the full new overrides object.
   */
  const reset = () => {
    if (assetDetails.value.isReadOnly || !isOverridden.value) {
      return;
    }

    const newOverrides = cloneDeep(assetDetails.value.unmerged.overrides || {});
    unset(newOverrides, propertyPath);
    onUpdateOverrides(newOverrides);
  };

  /**
   * (Read/Write) The primary value for use with `v-model`.
   * - `get`: Returns the local override if it exists, otherwise falls back to the merged value.
   * - `set`: Calls the `update` function to create/update the override.
   */
  const effectiveValue = computed<any>({
    get: () => {
      if (inspectorViewMode.value === 'local') {
        return localOverride.value;
      }
      return isOverridden.value ? localOverride.value : mergedValue.value;
    },
    set: (newValue) => {
      const currentValue = inspectorViewMode.value === 'local'
        ? localOverride.value
        : (isOverridden.value ? localOverride.value : mergedValue.value);
      if (newValue === currentValue) {
        return;
      }
      update(newValue);
    }
  });

  return {
    isOverridden,
    effectiveValue,
    mergedValue,
    update,
    reset
  };
}


