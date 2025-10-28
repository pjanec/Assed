// src/services/apiService.js
// ... (imports and deepMerge function remain the same) ...
import { mockData } from './mockData';
import { config } from '../../config';
import type { UnmergedAsset, Asset } from '../../core/types';

function deepMerge(base: Record<string, any>, override: Record<string, any>): Record<string, any> {
  const merged: Record<string, any> = { ...base };
  for (const key in override) {
    if (Object.prototype.hasOwnProperty.call(override, key)) {
      if (typeof override[key] === 'object' && override[key] !== null && !Array.isArray(override[key]) && typeof merged[key] === 'object' && merged[key] !== null && !Array.isArray(merged[key])) {
        merged[key] = deepMerge(merged[key], override[key]);
      } else {
        merged[key] = override[key]; // Replace arrays and primitives
      }
    }
  }
  return merged;
}


class ApiService {
  baseUrl: string;
  dbKey: string;
  buildHistoryKey: string;
  constructor() {
    this.baseUrl = config.apiBaseUrl;
    this.dbKey = 'asseted_db';
    this.buildHistoryKey = 'asseted_build_history';
    this._initializeDb();
  }

  // =================================================================
  // PRIVATE METHODS - DATABASE & CORE LOGIC
  // =================================================================

  _initializeDb() {
    if (!localStorage.getItem(this.dbKey)) {
      console.log('Initializing local storage database...');
  const db: Record<string, UnmergedAsset> = {};
  const allAssets: Record<string, UnmergedAsset> = { ...mockData.unmergedAssets };

      mockData.assets.forEach(asset => {
        if (!allAssets[asset.id]) {
          allAssets[asset.id] = {
            id: asset.id,
            fqn: asset.fqn,
            assetType: asset.assetType,
            assetKey: asset.assetKey,
            templateFqn: null,
            overrides: {},
          };
        }
      });
      
      for (const asset of Object.values(allAssets)) {
        if (asset) {
          db[asset.id] = JSON.parse(JSON.stringify(asset));
        }
      }
      localStorage.setItem(this.dbKey, JSON.stringify(db));
    }
    if (!localStorage.getItem(this.buildHistoryKey)) {
      localStorage.setItem(this.buildHistoryKey, JSON.stringify(mockData.builds || []));
    }
  }

  _getDb(): Record<string, UnmergedAsset> {
    return JSON.parse(localStorage.getItem(this.dbKey) || '{}') as Record<string, UnmergedAsset>;
  }

  _setDb(db: Record<string, UnmergedAsset>) {
    localStorage.setItem(this.dbKey, JSON.stringify(db));
  }

  _calculateMergedAsset(assetId: string, db: Record<string, UnmergedAsset>) {
    const asset = db[assetId];
    if (!asset) {
      console.warn(`Asset with ID ${assetId} not found during merge.`);
      return null;
    }

    const inheritanceChain = [];
    let mergedProperties = {};

  const fqnToIdMap: Record<string, string> = Object.values(db).reduce((acc: Record<string, string>, val) => {
        if (val) acc[val.fqn] = val.id;
        return acc;
    }, {});

    let currentAsset = asset;
    const chainCheck = new Set([currentAsset.fqn]);

    while (currentAsset && currentAsset.templateFqn) {
      if (chainCheck.has(currentAsset.templateFqn)) {
        throw new Error(`Circular dependency detected in template chain for asset ${asset.fqn}`);
      }
      chainCheck.add(currentAsset.templateFqn);
      
      const templateId = fqnToIdMap[currentAsset.templateFqn];
      const templateAsset = db[templateId];
      
      if (!templateAsset) {
        throw new Error(`Template asset with FQN "${currentAsset.templateFqn}" not found for asset ${currentAsset.fqn}`);
      }
      
      inheritanceChain.unshift(templateAsset);
      currentAsset = templateAsset;
    }

    for (const template of inheritanceChain) {
        mergedProperties = deepMerge(mergedProperties, template.overrides || {});
    }
    mergedProperties = deepMerge(mergedProperties, asset.overrides || {});

  const propertySources: Record<string, string> = {};
  const trackSources = (obj: Record<string, any>, path: string, sourceFqn: string) => {
        for(const key in obj) {
            const newPath = path ? `${path}.${key}` : key;
            if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
                trackSources(obj[key], newPath, sourceFqn);
            } else {
                propertySources[newPath] = sourceFqn;
            }
        }
    };
    [...inheritanceChain, asset].forEach(a => trackSources(a.overrides, '', a.fqn));

    return {
      id: asset.id,
      fqn: asset.fqn,
      assetType: asset.assetType,
      assetKey: asset.assetKey,
      inheritanceChain: inheritanceChain.map(a => a.fqn),
      properties: mergedProperties,
      propertySources,
    };
  }

  // =================================================================
  // PUBLIC API METHODS
  // =================================================================

  delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async getAssets(): Promise<Asset[]> {
    await this.delay(150);
    const db = this._getDb();
    // The lightweight asset list MUST include `templateFqn` and `assetKey`.
    return Object.values(db).map(({ id, fqn, assetType, assetKey, templateFqn }) => ({ // MODIFIED
        id, fqn, assetType, assetKey, templateFqn // MODIFIED
    }));
  }

  async getAssetDetails(id: string): Promise<{ unmerged: UnmergedAsset, merged: any }> {
    await this.delay(100);
    const db = this._getDb();
    const asset = db[id];
    if (!asset) {
      throw new Error(`Asset with id ${id} not found`);
    }

    try {
        const merged = this._calculateMergedAsset(id, db);
        return { unmerged: JSON.parse(JSON.stringify(asset)), merged };
    } catch(e) {
        console.error("Failed to calculate merged asset:", e);
        const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred';
        return { 
          unmerged: JSON.parse(JSON.stringify(asset)), 
          merged: { error: errorMessage } 
        };
    }
  }

  async previewMergedAssets(request: { changes: { deleted: string[], upserted: UnmergedAsset[] }, openInspectorIds: string[] }) {
    await this.delay(50);
    const tempDb = this._getDb();

    (request.changes.deleted || []).forEach(id => delete tempDb[id]);
    (request.changes.upserted || []).forEach(asset => tempDb[asset.id] = asset);

    const previews = request.openInspectorIds.map(id => {
      let merged = null;
      try {
        if (tempDb[id]) {
            merged = this._calculateMergedAsset(id, tempDb);
        }
      } catch (e) {
          console.error("Preview merge failed:", e);
          const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred';
          merged = { error: errorMessage };
      }
      return { id, merged };
    });

    return { previews };
  }

  async saveChanges(request: { deleted: string[], upserted: UnmergedAsset[] }) {
    await this.delay(500);
    const db = this._getDb();
    const tempDb = { ...db };
    (request.deleted || []).forEach(id => delete tempDb[id]);
    (request.upserted || []).forEach(asset => tempDb[asset.id] = asset);

  const fqnCounts: Record<string, number> = {};
    for (const asset of Object.values(tempDb)) {
        if (asset) fqnCounts[asset.fqn] = (fqnCounts[asset.fqn] || 0) + 1;
    }
    const fqnCollisions = Object.entries(fqnCounts).filter(([, count]) => count > 1);
    if (fqnCollisions.length > 0) {
        throw new Error(`FQN Collision detected: ${fqnCollisions.map(([fqn]) => fqn).join(', ')}`);
    }

    for (const assetId in tempDb) {
        if (!tempDb[assetId]) continue;
        try {
            this._calculateMergedAsset(assetId, tempDb);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'An unknown validation error occurred';
            throw new Error(`Validation failed: ${errorMessage}`);
        }
    }

    this._setDb(tempDb);
    console.log('Changes saved successfully:', request);
    return { success: true };
  }

  // =================================================================
  // BUILD SERVER SIMULATION
  // =================================================================

  _getBuildHistory(): any[] {
    return JSON.parse(localStorage.getItem(this.buildHistoryKey) || '[]');
  }

  _setBuildHistory(history: any[]) {
    localStorage.setItem(this.buildHistoryKey, JSON.stringify(history));
  }
  
  async getBuilds(): Promise<any[]> {
    await this.delay(100);
    return this._getBuildHistory();
  }
  
  async startBuild(request: { 
    distroId: string, 
    commitMessage: string, 
    triggeredBy?: string 
  }) {
    await this.delay(200);
    const history = this._getBuildHistory();
    const db = this._getDb();
    const distro = db[request.distroId];

    if (!distro) {
        throw new Error(`Distro with ID ${request.distroId} not found.`);
    }

    const newBuild = {
      id: `build-${Date.now()}`,
      distro: distro.assetKey,
      distroId: request.distroId,
      status: 'Queued',
      commit: request.commitMessage,
      triggeredBy: request.triggeredBy || 'local.user@asseted.com',
      startTime: new Date().toISOString(),
      endTime: null,
      duration: null,
      log: 'Build has been queued...'
    };

    history.unshift(newBuild);
    this._setBuildHistory(history);

    this._simulateBuildProcess(newBuild.id);

    return { buildId: newBuild.id };
  }

  _simulateBuildProcess(buildId: string) {
    const updateBuild = (status: string, logMessage: string, isComplete: boolean = false) => {
        const history = this._getBuildHistory();
        const buildIndex = history.findIndex(b => b.id === buildId);
        if (buildIndex > -1) {
            history[buildIndex].status = status;
            history[buildIndex].log += `\n[${new Date().toLocaleTimeString()}] ${logMessage}`;
            if (isComplete) {
                history[buildIndex].endTime = new Date().toISOString();
                const start = new Date(history[buildIndex].startTime);
                history[buildIndex].duration = +new Date() - +start;
            }
            this._setBuildHistory(history);
        }
    };
    
    setTimeout(() => updateBuild('Running', 'Starting build process...'), 2000);
    setTimeout(() => updateBuild('Running', 'Validating distro configuration...'), 4000);
    setTimeout(() => updateBuild('Running', 'Fetching resources for 5 packages...'), 7000);
    setTimeout(() => updateBuild('Running', 'Compiling assets...'), 11000);

    setTimeout(() => {
        const success = Math.random() > 0.2;
        if (success) {
            updateBuild('Successful', 'Build completed successfully!', true);
        } else {
            updateBuild('Failed', 'ERROR: Package compilation failed for storageguard-bin. See logs for details.', true);
        }
    }, 15000);
  }
}

export const apiService = new ApiService();
















