import type { PersistenceAdapter } from '@/core/types/persistence';
import type { UnmergedAsset, Asset, AssetDetails, Build, ChangeItem } from '@/core/types';
import { mockData } from '@/content/services/mockData';
import { config } from '@/config';
import { calculateMergedAsset } from '@/content/utils/mergeUtils';

export class LocalStorageAdapter implements PersistenceAdapter {
  private dbKey: string;
  private buildHistoryKey: string;

  constructor() {
    this.dbKey = 'asseted_db';
    this.buildHistoryKey = 'asseted_build_history';
    this._initializeDb();
  }

  // --- Adapter Interface Implementation ---

  async loadAllAssets(): Promise<Asset[]> {
    await this.delay(150);
    const db = this._getDb();
    return Object.values(db).map(({ id, fqn, assetType, assetKey, templateFqn }) => ({
        id, fqn, assetType, assetKey, templateFqn
    }));
  }

  async loadAssetDetails(id: string): Promise<AssetDetails> {
    await this.delay(100);
    const db = this._getDb();
    const asset = db[id];
    if (!asset) {
      throw new Error(`Asset with id ${id} not found`);
    }

    // Use the shared utility function
    const assetMap = new Map(Object.entries(db));
    const mergedResult = calculateMergedAsset(id, assetMap);
    return { 
      unmerged: JSON.parse(JSON.stringify(asset)), 
      merged: mergedResult 
    };
  }

  async commitChanges(changes: { upserted: UnmergedAsset[], deleted: string[] }): Promise<{ success: boolean }> {
    await this.delay(500);
    const db = this._getDb();
    
    changes.deleted.forEach(id => delete db[id]);
    changes.upserted.forEach(asset => db[asset.id] = asset);

    // Run validation checks before saving
    this._validateDb(db);
    this._setDb(db);

    console.log('Changes saved successfully via LocalStorageAdapter:', changes);
    return { success: true };
  }

  async previewMergedAssets(request: { changes: { deleted: string[]; upserted: UnmergedAsset[] }; openInspectorIds: string[]; }): Promise<{ previews: { id: string; merged: any; }[]; }> {
    await this.delay(50);
    const tempDb = this._getDb();

    request.changes.deleted.forEach(id => delete tempDb[id]);
    request.changes.upserted.forEach(asset => tempDb[asset.id] = asset);

    const assetMap = new Map(Object.entries(tempDb));
    const previews = request.openInspectorIds.map(id => {
      const merged = tempDb[id] ? calculateMergedAsset(id, assetMap) : null;
      return { id, merged };
    });

    return { previews };
  }

  async loadBuilds(): Promise<Build[]> {
    await this.delay(100);
    return this._getBuildHistory();
  }

  async startBuild(request: { environmentId: string; commitMessage: string; triggeredBy?: string; }): Promise<{ buildId: string; }> {
    await this.delay(200);
    const history = this._getBuildHistory();
    const db = this._getDb();
    const environment = db[request.environmentId];

    if (!environment) {
        throw new Error(`Environment with ID ${request.environmentId} not found.`);
    }

    const newBuild: Build = {
      id: `build-${Date.now()}`,
      environment: environment.assetKey,
      environmentId: request.environmentId,
      status: 'Queued' as const,
      commitMessage: request.commitMessage,
      triggeredBy: request.triggeredBy || 'local.user@asseted.com',
      startTime: new Date().toISOString(),
      endTime: undefined,
      duration: undefined,
      log: 'Build has been queued...'
    };

    history.unshift(newBuild);
    this._setBuildHistory(history);

    this._simulateBuildProcess(newBuild.id);

    return { buildId: newBuild.id };
  }

  // --- Private Helper Methods (moved from apiService) ---

  private delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private _initializeDb() {
    if (!localStorage.getItem(this.dbKey)) {
      const db: Record<string, UnmergedAsset> = {};
      const allAssets: Record<string, UnmergedAsset> = { ...mockData.unmergedAssets };

      mockData.assets.forEach(asset => {
        if (!allAssets[asset.id]) {
          allAssets[asset.id] = { ...asset, templateFqn: null, overrides: {} };
        }
      });

      for (const asset of Object.values(allAssets)) {
        if (asset) db[asset.id] = JSON.parse(JSON.stringify(asset));
      }

      this._setDb(db);
    }

    if (!localStorage.getItem(this.buildHistoryKey)) {
      this._setBuildHistory((mockData.builds || []) as Build[]);
    }
  }

  private _getDb(): Record<string, UnmergedAsset> {
    return JSON.parse(localStorage.getItem(this.dbKey) || '{}');
  }

  private _setDb(db: Record<string, UnmergedAsset>) {
    localStorage.setItem(this.dbKey, JSON.stringify(db));
  }

  private _validateDb(db: Record<string, UnmergedAsset>) {
    const fqnCounts: Record<string, number> = {};
    for (const asset of Object.values(db)) {
        if (asset) fqnCounts[asset.fqn] = (fqnCounts[asset.fqn] || 0) + 1;
    }

    const fqnCollisions = Object.entries(fqnCounts).filter(([, count]) => count > 1);
    if (fqnCollisions.length > 0) {
        throw new Error(`FQN Collision detected: ${fqnCollisions.map(([fqn]) => fqn).join(', ')}`);
    }

    const assetMap = new Map(Object.entries(db));
    for (const assetId in db) {
        if (!db[assetId]) continue;
        const result = calculateMergedAsset(assetId, assetMap);
        if ('error' in result) {
            throw new Error(`Validation failed during save: ${result.error}`);
        }
    }
  }



  // Build simulation methods
  private _getBuildHistory(): Build[] {
    return JSON.parse(localStorage.getItem(this.buildHistoryKey) || '[]');
  }

  private _setBuildHistory(history: Build[]) {
    localStorage.setItem(this.buildHistoryKey, JSON.stringify(history));
  }

  private _simulateBuildProcess(buildId: string) {
    // This logic remains the same
    const updateBuild = (status: Build['status'], logMessage: string, isComplete: boolean = false) => {
        const history = this._getBuildHistory();
        const buildIndex = history.findIndex(b => b.id === buildId);
        if (buildIndex > -1) {
            history[buildIndex].status = status;
            if (isComplete) history[buildIndex].endTime = new Date().toISOString();
            this._setBuildHistory(history);
        }
    };

    setTimeout(() => updateBuild('Running', 'Starting...'), 2000);
    setTimeout(() => updateBuild('Completed', 'Build complete!', true), 5000);
  }
}