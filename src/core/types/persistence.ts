import type { Asset, AssetDetails, Build, ChangeItem, UnmergedAsset } from '../types';

/**
 * Defines the contract for a persistence layer.
 * The Core stores will use this interface to load and save data,
 * remaining completely unaware of the underlying implementation (e.g., localStorage, REST API).
 */
export interface PersistenceAdapter {
  // Asset-related methods
  loadAllAssets(): Promise<Asset[]>;
  loadAssetDetails(id: string): Promise<AssetDetails>;
  commitChanges(changes: { upserted: UnmergedAsset[]; deleted: string[] }): Promise<{ success: boolean }>;
  previewMergedAssets(request: {
    changes: { deleted: string[]; upserted: UnmergedAsset[] };
    openInspectorIds: string[];
  }): Promise<{ previews: { id: string; merged: any }[] }>;

  // Build-related methods
  loadBuilds(): Promise<Build[]>;
  startBuild(request: {
    environmentId: string;
    commitMessage: string;
    triggeredBy?: string;
  }): Promise<{ buildId: string }>;
}