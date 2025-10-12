import { vi } from 'vitest';
import type { PersistenceAdapter } from '@/core/types/persistence';
import type { Asset, AssetDetails, UnmergedAsset, Build } from '@/core/types';

export class MockPersistenceAdapter implements PersistenceAdapter {
  db = new Map<string, UnmergedAsset>();

  constructor(initialData: UnmergedAsset[] = []) {
    initialData.forEach(asset => this.db.set(asset.id, asset));
  }

  loadAllAssets = vi.fn(async (): Promise<Asset[]> => Array.from(this.db.values()));

  loadAssetDetails = vi.fn(async (id: string): Promise<AssetDetails> => {
    const asset = this.db.get(id);
    if (!asset) throw new Error('Not found');
    // Simulate a simple merge for testing purposes
    return { unmerged: asset, merged: { properties: asset.overrides } };
  });

  commitChanges = vi.fn(async (changes: { upserted: UnmergedAsset[], deleted: string[] }) => {
    changes.upserted.forEach(asset => this.db.set(asset.id, asset));
    changes.deleted.forEach(id => this.db.delete(id));
    return { success: true };
  });

  // Mock other methods as needed, even if they're empty spies
  previewMergedAssets = vi.fn(async () => ({ previews: [] }));
  loadBuilds = vi.fn(async (): Promise<Build[]> => []);
  startBuild = vi.fn(async () => ({ buildId: 'mock-build-123' }));
}