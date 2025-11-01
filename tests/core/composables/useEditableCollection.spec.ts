import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ref, type Ref } from 'vue';
import { useEditableCollection } from '@/core/composables/useEditableCollection';
import type { AssetDetails } from '@/core/types';

const mkAsset = (overrides: Record<string, any>, merged: Record<string, any>): AssetDetails => ({
  unmerged: {
    id: 'asset-1',
    fqn: 'pkg::A',
    assetType: 'Package' as any,
    assetKey: 'A',
    templateFqn: 'base::T',
    overrides
  },
  merged: { properties: merged },
  isReadOnly: false
});

describe('useEditableCollection (map-like collections)', () => {
  let asset: Ref<AssetDetails>;
  let onUpdate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onUpdate = vi.fn();
    asset = ref(mkAsset({}, {
      Resources: {
        '0': { To: '/a', Fetcher: '' },
        '1': { To: '/b', Fetcher: 'Http' }
      }
    }));
  });

  it('exposes merged object and derived array with inherited flags', () => {
    const { collectionAsArray, collectionAsObject } =
      useEditableCollection(asset, 'Resources', onUpdate);
    expect(Object.keys(collectionAsObject.value)).toEqual(['0', '1']);
    const arr = collectionAsArray.value;
    expect(arr).toHaveLength(2);
    expect(arr[0].key).toBe('0');
    expect(arr[0].isInherited).toBe(true);
  });

  it('addItem creates an object key for numeric IDs (no array coercion)', () => {
    const { addItem } = useEditableCollection(asset, 'Resources', onUpdate);
    addItem('2', { To: '/c', Fetcher: '' });
    expect(onUpdate).toHaveBeenCalledTimes(1);
    const payload = onUpdate.mock.calls[0][0];
    expect(typeof payload.Resources).toBe('object');
    expect(Array.isArray(payload.Resources)).toBe(false);
    expect(Object.keys(payload.Resources)).toEqual(['2']);
    expect(payload.Resources['2']).toEqual({ To: '/c', Fetcher: '' });
  });

  it('updateItemProperty sets nested values and keeps parent as object', () => {
    const { addItem, updateItemProperty } =
      useEditableCollection(asset, 'Resources', onUpdate);
    addItem('2', { To: '/c', Fetcher: 'Http', Params: {} });
    onUpdate.mockClear();
    updateItemProperty('2', 'Params', { a: 1 });
    const payload = onUpdate.mock.calls[0][0];
    expect(payload.Resources['2'].Params).toEqual({ a: 1 });
    expect(Array.isArray(payload.Resources)).toBe(false);
  });

  it('removeItem deletes the key and cleans empty parent container', () => {
    const { addItem, removeItem } = useEditableCollection(asset, 'Resources', onUpdate);
    addItem('2', { To: '/c', Fetcher: '' });
    onUpdate.mockClear();
    removeItem('2');
    const payload = onUpdate.mock.calls[0][0];
    expect(payload.Resources).toBeUndefined();
  });
});


