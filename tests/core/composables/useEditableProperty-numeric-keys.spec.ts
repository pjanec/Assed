import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ref, type Ref } from 'vue';
import { useEditableProperty } from '@/core/composables/useEditableProperty';
import type { AssetDetails } from '@/core/types';

const mkAsset = (overrides: Record<string, any>, merged: Record<string, any>): AssetDetails => ({
  unmerged: {
    id: 'asset-3',
    fqn: 'pkg::C',
    assetType: 'Package' as any,
    assetKey: 'C',
    templateFqn: 'base::T',
    overrides
  },
  merged: { properties: merged },
  isReadOnly: false
});

describe('useEditableProperty (numeric keys in map containers)', () => {
  let asset: Ref<AssetDetails>;
  let onUpdate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onUpdate = vi.fn();
    asset = ref(mkAsset({}, {
      Resources: { '1': { To: '/from-merged' } }
    }));
  });

  it('sets Resources.1.To without turning Resources into an array', () => {
    const { update } = useEditableProperty(
      asset,
      'Resources.1.To',
      onUpdate,
      { objectContainers: ['Resources', 'Files'] }
    );
    update('/local');
    const payload = onUpdate.mock.calls[0][0];
    expect(Array.isArray(payload.Resources)).toBe(false);
    expect(Object.keys(payload.Resources)).toEqual(['1']);
    expect(payload.Resources['1'].To).toBe('/local');
  });

  it('resets a map entry and cleans empty parent when needed', () => {
    asset.value.unmerged.overrides = { Resources: { '2': { To: '/local' } } };
    const { reset } = useEditableProperty(
      asset,
      'Resources.2.To',
      onUpdate,
      { objectContainers: ['Resources', 'Files'] }
    );
    reset();
    const payload = onUpdate.mock.calls[0][0];
    expect(payload.Resources).toBeUndefined();
  });
});


