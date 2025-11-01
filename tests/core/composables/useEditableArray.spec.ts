import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ref, type Ref } from 'vue';
import { useEditableArray } from '@/core/composables/useEditableArray';
import type { AssetDetails } from '@/core/types';

type Part = { From: string; To: string };

const mkAsset = (overrides: Record<string, any>, merged: Record<string, any>): AssetDetails => ({
  unmerged: {
    id: 'asset-2',
    fqn: 'pkg::B',
    assetType: 'Package' as any,
    assetKey: 'B',
    templateFqn: 'base::T',
    overrides
  },
  merged: { properties: merged },
  isReadOnly: false
});

describe('useEditableArray (array-like collections)', () => {
  let asset: Ref<AssetDetails>;
  let onUpdate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onUpdate = vi.fn();
    asset = ref(mkAsset({}, {
      FileDistrib: { Parts: [{ From: 'a', To: '/x' }, { From: 'b', To: '/y' }] }
    }));
  });

  it('exposes merged items and inherited flags based on identity key', () => {
    const { items, isInherited } =
      useEditableArray<Part>(asset, 'FileDistrib.Parts', onUpdate, { identityKey: 'From' });
    expect(items.value).toHaveLength(2);
    expect(isInherited(items.value[0])).toBe(true);
  });

  it('addItem pushes into overrides array and removeItem cleans up', () => {
    const { addItem, removeItem } =
      useEditableArray<Part>(asset, 'FileDistrib.Parts', onUpdate, { identityKey: 'From' });
    addItem({ From: 'c', To: '/z' });
    expect(onUpdate).toHaveBeenCalledTimes(1);
    let payload = onUpdate.mock.calls[0][0];
    expect(Array.isArray(payload?.FileDistrib?.Parts)).toBe(true);
    expect(payload.FileDistrib.Parts).toEqual([{ From: 'c', To: '/z' }]);

    onUpdate.mockClear();
    removeItem(0);
    payload = onUpdate.mock.calls[0][0];
    expect(payload?.FileDistrib?.Parts).toBeUndefined();
  });
});


