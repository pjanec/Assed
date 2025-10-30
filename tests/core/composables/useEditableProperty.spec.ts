import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ref, type Ref } from 'vue';
import { useEditableProperty } from '@/core/composables/useEditableProperty';
import type { AssetDetails } from '@/core/types';

const mockBaseTemplate = {
  properties: {
    name: 'Inherited Name',
    conf: {
      port: 80,
      ssl: false
    }
  }
};

const createMockAssetDetails = (overrides: Record<string, any>): AssetDetails => ({
  unmerged: {
    id: 'asset-123',
    fqn: 'MyAsset',
    assetType: 'Package' as any,
    assetKey: 'MyAsset',
    templateFqn: 'BaseTemplate',
    overrides: overrides
  },
  merged: mockBaseTemplate,
  isReadOnly: false
});

describe('useEditableProperty Composable', () => {
  let testAsset: Ref<AssetDetails>;
  let mockUpdateCallback: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    testAsset = ref(createMockAssetDetails({}));
    mockUpdateCallback = vi.fn();
  });

  it('should return inherited value and isOverridden=false when no override exists', () => {
    const { isOverridden, effectiveValue, mergedValue } = useEditableProperty(
      testAsset,
      'name',
      mockUpdateCallback
    );
    expect(isOverridden.value).toBe(false);
    expect(mergedValue.value).toBe('Inherited Name');
    expect(effectiveValue.value).toBe('Inherited Name');
  });

  it('should return local value and isOverridden=true when an override exists', () => {
    testAsset.value.unmerged.overrides = { name: 'Local Override' };
    const { isOverridden, effectiveValue, mergedValue } = useEditableProperty(
      testAsset,
      'name',
      mockUpdateCallback
    );
    expect(isOverridden.value).toBe(true);
    expect(mergedValue.value).toBe('Inherited Name');
    expect(effectiveValue.value).toBe('Local Override');
  });

  it('should handle deep paths for inherited values', () => {
    const { isOverridden, effectiveValue, mergedValue } = useEditableProperty(
      testAsset,
      'conf.port',
      mockUpdateCallback
    );
    expect(isOverridden.value).toBe(false);
    expect(mergedValue.value).toBe(80);
    expect(effectiveValue.value).toBe(80);
  });

  it('should handle deep paths for overridden values', () => {
    testAsset.value.unmerged.overrides = { conf: { port: 8080 } };
    const { isOverridden, effectiveValue, mergedValue } = useEditableProperty(
      testAsset,
      'conf.port',
      mockUpdateCallback
    );
    expect(isOverridden.value).toBe(true);
    expect(mergedValue.value).toBe(80);
    expect(effectiveValue.value).toBe(8080);
  });

  it('should return undefined if property does not exist anywhere', () => {
    const { isOverridden, effectiveValue, mergedValue } = useEditableProperty(
      testAsset,
      'non.existent.path',
      mockUpdateCallback
    );
    expect(isOverridden.value).toBe(false);
    expect(mergedValue.value).toBeUndefined();
    expect(effectiveValue.value).toBeUndefined();
  });

  it('should call onUpdateOverrides with new override when update is called', () => {
    const { update } = useEditableProperty(testAsset, 'name', mockUpdateCallback);
    update('New Override');
    expect(mockUpdateCallback).toHaveBeenCalledTimes(1);
    expect(mockUpdateCallback).toHaveBeenCalledWith({ name: 'New Override' });
  });

  it('should correctly merge deep updates', () => {
    testAsset.value.unmerged.overrides = { name: 'MyName' };
    const { update } = useEditableProperty(testAsset, 'conf.port', mockUpdateCallback);
    update(8080);
    expect(mockUpdateCallback).toHaveBeenCalledTimes(1);
    expect(mockUpdateCallback).toHaveBeenCalledWith({ name: 'MyName', conf: { port: 8080 } });
  });

  it('should overwrite existing deep values correctly', () => {
    testAsset.value.unmerged.overrides = { name: 'MyName', conf: { port: 8080, ssl: true } };
    const { update } = useEditableProperty(testAsset, 'conf.port', mockUpdateCallback);
    update(9090);
    expect(mockUpdateCallback).toHaveBeenCalledTimes(1);
    expect(mockUpdateCallback).toHaveBeenCalledWith({ name: 'MyName', conf: { port: 9090, ssl: true } });
  });

  it('should remove an override when reset is called', () => {
    testAsset.value.unmerged.overrides = { name: 'Local Override', other: 'test' };
    const { reset } = useEditableProperty(testAsset, 'name', mockUpdateCallback);
    reset();
    expect(mockUpdateCallback).toHaveBeenCalledTimes(1);
    expect(mockUpdateCallback).toHaveBeenCalledWith({ other: 'test' });
  });

  it('should remove a deep override when reset is called', () => {
    testAsset.value.unmerged.overrides = { conf: { port: 8080, ssl: true } };
    const { reset } = useEditableProperty(testAsset, 'conf.port', mockUpdateCallback);
    reset();
    expect(mockUpdateCallback).toHaveBeenCalledTimes(1);
    expect(mockUpdateCallback).toHaveBeenCalledWith({ conf: { ssl: true } });
  });

  it('should do nothing if reset is called on a non-overridden property', () => {
    const { reset } = useEditableProperty(testAsset, 'name', mockUpdateCallback);
    reset();
    expect(mockUpdateCallback).not.toHaveBeenCalled();
  });

  it('should update via v-model binding', () => {
    const { effectiveValue } = useEditableProperty(testAsset, 'name', mockUpdateCallback);
    effectiveValue.value = 'New Value';
    expect(mockUpdateCallback).toHaveBeenCalledTimes(1);
    expect(mockUpdateCallback).toHaveBeenCalledWith({ name: 'New Value' });
  });

  it('should not update if v-model sets the same value', () => {
    testAsset.value.unmerged.overrides = { name: 'Local' };
    const { effectiveValue } = useEditableProperty(testAsset, 'name', mockUpdateCallback);
    effectiveValue.value = 'Local';
    expect(mockUpdateCallback).not.toHaveBeenCalled();
  });

  it('should not update if asset is read-only', () => {
    testAsset.value.isReadOnly = true;
    const { update, reset, effectiveValue } = useEditableProperty(testAsset, 'name', mockUpdateCallback);
    update('Attempted Update');
    expect(mockUpdateCallback).not.toHaveBeenCalled();
    effectiveValue.value = 'Attempted v-model';
    expect(mockUpdateCallback).not.toHaveBeenCalled();
    reset();
    expect(mockUpdateCallback).not.toHaveBeenCalled();
  });
});


