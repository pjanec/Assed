// stores/assets.ts - Asset management store
import { defineStore } from 'pinia'
import { useCoreConfigStore } from './config'
import { cloneDeep } from 'lodash-es';
import { inject, computed, type ComputedRef } from 'vue';
import type { 
  Asset, 
  AssetDetails, 
  AssetTreeNode, 
  InspectorPaneInfo, 
  SelectedNode, 
  LoadingStates,
  UnmergedAsset
} from '@/core/types'
import { virtualFolderDefinitions } from '@/content/logic/virtual-folders/definitions';
import { ASSET_TREE_NODE_TYPES } from '@/core/config/constants';
import type { ConfigurationHub } from './ConfigurationHub';

export interface ProjectStat {
  count: number;
  label: string;
  icon: string;
  color: string;
}

// --- vvv KEY CHANGES vvv ---
import { useUiStore } from './ui'; // Import the new UI store
import { useWorkspaceStore } from './workspace'; // This is now safe to import directly
// --- ^^^ KEY CHANGES ^^^ ---
import { generateUUID } from '@/core/utils/idUtils'; // Import the UUID generator
import * as InspectorHistory from '@/core/history/inspectorHistory';

// Helper to generate unique IDs for panes
const generatePaneId = (): string => `pane_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

interface AssetsState {
  // Asset manifest (lightweight list)
  assets: Asset[];
  
  // Detailed asset data cache
  assetDetails: Map<string, AssetDetails>;
  
  // REMOVE: selectedNode: SelectedNode | null;
  
  // Open inspector panes are now objects with a unique paneId
  openInspectors: InspectorPaneInfo[];
  
  // Loading states
  loading: LoadingStates;
  // Per-pane inspector navigation history
  inspectorHistoryByPane: Map<string, InspectorHistory.InspectorHistoryState>;
}

export const useAssetsStore = defineStore('assets', {
  state: (): AssetsState => ({
    // Asset manifest (lightweight list)
    assets: [],
    
    // Detailed asset data cache
    assetDetails: new Map(),
    
    // REMOVE: selectedNode: null,
    
    // Open inspector panes are now objects with a unique paneId
    openInspectors: [],
    
    // Loading states
    loading: {
      assets: false,
      assetDetails: new Set()
    },
    inspectorHistoryByPane: new Map(),
  }),

    // File: EnvEdit/src/stores/assets.ts

    // ... (state and actions remain the same) ...

    getters: {
    /**
     * NEW GETTER: Creates a live, unmerged view of the asset list by
     * combining the committed state with pending changes from the workspace.
     * This strips overrides for tree display purposes only.
     */
    unmergedAssets(): UnmergedAsset[] { // <-- CORRECTED TYPE
      const workspaceStore = useWorkspaceStore();
      // The logic correctly creates UnmergedAssets, so we just need to update the signature.
      const assetsMap = new Map(this.assets.map(a => [a.id, { ...a, overrides: {} }]));
      
      workspaceStore.pendingChanges.upserted.forEach((asset, assetId) => {
        assetsMap.set(assetId, asset);
      });
      
      workspaceStore.pendingChanges.deleted.forEach((asset, assetId) => {
        assetsMap.delete(assetId);
      });

      return Array.from(assetsMap.values());
    },

    /**
     * Creates a complete assets list with full overrides for virtual folder resolution.
     * This preserves all overrides unlike unmergedAssets which strips them for tree display.
     * Uses cached assetDetails when available, otherwise falls back to basic structure.
     */
    assetsWithOverrides(): UnmergedAsset[] {
      const workspaceStore = useWorkspaceStore();
      const assetsMap = new Map<string, UnmergedAsset>();
      
      // Start with committed assets - use cached details if available
      this.assets.forEach(asset => {
        const cachedDetails = this.assetDetails.get(asset.id);
        if (cachedDetails) {
          // Use the cached unmerged data which has the full overrides
          assetsMap.set(asset.id, cachedDetails.unmerged);
        } else {
          // Fallback to basic structure - overrides will be empty but that's better than nothing
          const unmergedAsset: UnmergedAsset = {
            ...asset,
            overrides: {}
          };
          assetsMap.set(asset.id, unmergedAsset);
        }
      });
      
      // Apply pending changes (these already have their overrides)
      workspaceStore.pendingChanges.upserted.forEach((asset, assetId) => {
        assetsMap.set(assetId, asset);
      });
      
      workspaceStore.pendingChanges.deleted.forEach((asset, assetId) => {
        assetsMap.delete(assetId);
      });

      return Array.from(assetsMap.values());
    },

    projectStats(state): ProjectStat[] {
      const coreConfig = useCoreConfigStore();
      const stats: Record<string, ProjectStat> = {};

      // Get effective registry from ConfigurationHub
      const assetRegistry = coreConfig.effectiveAssetRegistry;

      // 1. Dynamically initialize stats object from the injected registry
      for (const assetType in assetRegistry) {
        const definition = assetRegistry[assetType];
        if (definition && definition.isShownInStats) {
          // Unwrap PerspectiveOverrides
          const label = typeof definition.label === 'string' ? definition.label : definition.label.default;
          const icon = typeof definition.icon === 'string' ? definition.icon : definition.icon.default;
          const color = typeof definition.color === 'string' ? definition.color : definition.color.default;
          
          stats[assetType] = {
            label: label + 's', // simple pluralization
            count: 0,
            icon: icon,
            color: color,
          };
        }
      }

      // 2. Tally the counts from the actual assets
      state.assets.forEach(asset => {
        if (stats[asset.assetType]) {
          stats[asset.assetType].count++;
        }
      });

      // 3. Return the stats as an array, filtering out types that have a count of 0.
      return Object.values(stats).filter(stat => stat.count > 0);
    },
    
    getAsset: (state) => (id: string): Asset | undefined => {
        return state.assets.find(asset => asset.id === id);
    },

    // Get asset details by ID from cache
    getAssetDetails: (state) => (id: string): AssetDetails | undefined => {
        return state.assetDetails.get(id);
    },

    /**
     * NEW GETTER: Retrieves the most up-to-date "unmerged" details for an asset,
     * accounting for any pending changes in the workspace.
     */
    getUnmergedDetails: (state) => (id: string): AssetDetails | null => {
      const workspaceStore = useWorkspaceStore();
      const pendingAsset = workspaceStore.pendingChanges.upserted.get(id);
      const committedDetails = state.assetDetails.get(id);

      if (pendingAsset) {
        // If there's a pending change, it's the most current version.
        // Return it, but preserve the existing `merged` data if available.
        return {
          unmerged: pendingAsset,
          merged: committedDetails?.merged || null,
        };
      }
        
      // Otherwise, return the committed version from the cache.
      return committedDetails || null;
    },

    // Main logic to build the namespace view hierarchy
    getAssetsByNamespace(state): AssetTreeNode[] {
        const assetsToDisplay = this.unmergedAssets; // Use the live data
        if (assetsToDisplay.length === 0) return [];
        
        const nodeMap = new Map<string, AssetTreeNode>();
        const coreConfig = useCoreConfigStore();
        const effectiveRegistry = coreConfig.effectiveAssetRegistry;
        
        // Filter assets by isVisibleInExplorer based on current perspective
        const visibleAssets = assetsToDisplay.filter(asset => {
            const def = effectiveRegistry[asset.assetType];
            if (!def) return false;
            const isVisible = def.isVisibleInExplorer as any;
            return isVisible !== false;
        });

        visibleAssets.forEach(asset => { // Use only visible assets
        nodeMap.set(asset.fqn, {
            ...asset,
            path: asset.fqn,
            name: asset.assetKey,
            type: ASSET_TREE_NODE_TYPES.ASSET,
            children: [],
        });
        });

        nodeMap.forEach(node => {
        const parts = node.path.split('::');
        if (parts.length > 1) {
            const parentFqn = parts.slice(0, -1).join('::');
            
            if (!nodeMap.has(parentFqn)) {
                nodeMap.set(parentFqn, {
                    id: parentFqn,
                    path: parentFqn,
                    name: parts[parts.length - 2],
                    type: ASSET_TREE_NODE_TYPES.NAMESPACE,
                    children: [],
                    assetType: coreConfig.structuralAssetType as any,
                });
            }
            
            const parentNode = nodeMap.get(parentFqn);
            if (parentNode && !parentNode.children.some(c => c.id === node.id)) {
            parentNode.children.push(node);
            }
        }
        });

        // --- Second Pass: Inject Virtual Folders (No Caching) ---
        // Use assets with full overrides for virtual folder resolution
        const assetsWithFullOverrides = this.assetsWithOverrides;
        
        nodeMap.forEach(realNode => {
          if (realNode.assetType) {
            const definition = coreConfig.getAssetDefinition(realNode.assetType);
            if (definition?.virtualFolderProviders) {
              for (const providerKind of definition.virtualFolderProviders) {
                const provider = virtualFolderDefinitions[providerKind as unknown as keyof typeof virtualFolderDefinitions];
                if (!provider) continue;

                // Find the corresponding UnmergedAsset with full overrides
                const unmergedAsset = assetsWithFullOverrides.find(a => a.id === realNode.id);
                if (!unmergedAsset) continue;

                // Always execute the resolver with complete asset data; no cache check.
                const virtualChildren = provider.resolveChildren(unmergedAsset, assetsWithFullOverrides);

                if (virtualChildren.length > 0) {
                  const virtualFolder: AssetTreeNode = {
                    id: `${realNode.id}-${providerKind}`,
                    path: `${realNode.path}::${provider.name}`,
                    name: provider.name,
                    type: ASSET_TREE_NODE_TYPES.FOLDER,
                    children: virtualChildren,
                    virtualContext: { kind: providerKind, sourceAssetId: realNode.id }
                  };

                  realNode.children.unshift(virtualFolder);
                }
              }
            }
          }
        });
        
        const rootNodes: AssetTreeNode[] = [];
        nodeMap.forEach(node => {
        const isRoot = node.path.split('::').length === 1;
        if (isRoot) {
            rootNodes.push(node);
        }
        });

        return rootNodes;
    },
    
    getRootNamespaces(state): AssetTreeNode[] {
        const coreConfig = useCoreConfigStore();
        const rootNodes = this.getAssetsByNamespace;
        return rootNodes.sort((a, b) => {
            const aDef = coreConfig.getAssetDefinition(a.assetType!);
            const bDef = coreConfig.getAssetDefinition(b.assetType!);

            const aOrder = aDef ? aDef.sortOrder : 99;
            const bOrder = bDef ? bDef.sortOrder : 99;
              
            if (aOrder !== bOrder) return aOrder - bOrder;
            return a.name.localeCompare(b.name);
        });
    },
    
    // Reactive getter to find the latest tree node by id from the live tree
    getTreeNodeById(): (id: string) => AssetTreeNode | null {
      return (id: string): AssetTreeNode | null => {
        const rootNodes = this.getAssetsByNamespace as unknown as AssetTreeNode[];
        const search = (nodes: AssetTreeNode[]): AssetTreeNode | null => {
          for (const node of nodes) {
            if (node.id === id) return node;
            if (node.children && node.children.length) {
              const found = search(node.children);
              if (found) return found;
            }
          }
          return null;
        };
        return search(rootNodes);
      };
    },
    
    // REPLACE selectedAsset getter
    selectedNodeDetails: (state): AssetDetails | null => {
      // GETS DATA FROM THE UI STORE
      const uiStore = useUiStore();
      if (!uiStore.selectedNode) return null;
      if (uiStore.selectedNode.type === 'asset') {
        return state.assetDetails.get(uiStore.selectedNode.id) || null;
      }
      
      // If it's a folder or file-group, construct a display-only object
      if (uiStore.selectedNode.type === 'folder' || uiStore.selectedNode.type === 'file-group') {
        const typeName = uiStore.selectedNode.type === 'folder' ? 'Folder' : 'File Group';
        return {
          unmerged: {
            id: uiStore.selectedNode.id,
            assetKey: uiStore.selectedNode.name,
            assetType: typeName as any,
            fqn: uiStore.selectedNode.path, // Use path for FQN field
            overrides: {}
          },
          merged: null
        };
      }
      return null;
    },

    /**
     * Returns a list of valid templates for a given asset type and context.
     * This refactors logic previously in GeneralPropertiesEditor.
     */
    getValidTemplates: (state) => (assetType: string, fqn: string): Asset[] => {
      if (!assetType || !fqn) return [];

      const assetsByFqn = new Map(state.assets.map(a => [a.fqn, a]));

      const environmentFqns = new Set(
        state.assets
          .filter(a => a.assetType === 'Environment' && !a.fqn.includes('::'))
          .map(a => a.fqn)
      );

      const getAssetEnvironment = (assetFqn: string): string | null => {
        for (const envFqn of environmentFqns) {
          if (assetFqn.startsWith(envFqn + '::')) {
            return envFqn;
          }
        }
        return null;
      };

      const isCircularDependency = (potentialTemplate: Asset): boolean => {
        let current = potentialTemplate;
        const visited = new Set<string>([current.fqn]);

        while (current && current.templateFqn) {
          if (current.templateFqn === fqn) {
            return true; // Found a direct cycle
          }
          if (visited.has(current.templateFqn)) {
            return true; // Found a cycle within the template's own chain
          }
          visited.add(current.templateFqn);
          current = assetsByFqn.get(current.templateFqn)!;
        }
        return false;
      };

      const currentAssetEnv = getAssetEnvironment(fqn);

      return state.assets.filter(potentialTemplate => {
        // Rule 1: Must be the same asset type.
        if (potentialTemplate.assetType !== assetType) return false;

        // Rule 2: Cannot be the asset itself.
        if (potentialTemplate.fqn === fqn) return false;

        // Rule 3 (NEW): Traverse the entire inheritance chain to prevent cycles.
        if (isCircularDependency(potentialTemplate)) return false;

        // Rule 4: Enforce inheritance boundaries.
        const templateEnv = getAssetEnvironment(potentialTemplate.fqn);

        if (currentAssetEnv) {
          // Case A: The current asset is inside an environment.
          return templateEnv === null || templateEnv === currentAssetEnv;
        } else {
          // Case B: The current asset is a shared asset.
          return templateEnv === null;
        }
      });
    },

    // New getter for the active inspector component
    activeInspectorComponent(): (() => Promise<any>) | null {
      const coreConfig = useCoreConfigStore();
      const uiStore = useUiStore();
      const { selectedNode } = uiStore;
      
      if (!selectedNode) {
        return null;
      }
      
      let assetType: Asset['assetType'] | undefined = selectedNode.assetType;
      
      if (!assetType && (selectedNode.type === ASSET_TREE_NODE_TYPES.NAMESPACE || selectedNode.type === ASSET_TREE_NODE_TYPES.FOLDER)) {
        // This type assertion correctly informs TypeScript that the string is a valid AssetType.
        assetType = coreConfig.structuralAssetType as Asset['assetType'];
      }

      if (!assetType) {
        return null;
      }
      
      const registration = coreConfig.getAssetDefinition(assetType);
      if (!registration) return null;
      // Unwrap PerspectiveOverrides
      const inspector = registration.inspectorComponent;
      return typeof inspector === 'function' ? inspector : inspector.default;
    }

  },

  actions: {
    canHistoryBack(paneId: string): boolean {
      const hist = this.inspectorHistoryByPane.get(paneId);
      return hist ? InspectorHistory.canBack(hist) : false;
    },
    canHistoryForward(paneId: string): boolean {
      const hist = this.inspectorHistoryByPane.get(paneId);
      return hist ? InspectorHistory.canForward(hist) : false;
    },
    async loadAssets(): Promise<void> {
      this.loading.assets = true;
      try {
        const coreConfig = useCoreConfigStore();
        if (!coreConfig.persistenceAdapter) throw new Error("Persistence adapter not registered.");
        
        this.assets = await coreConfig.persistenceAdapter.loadAllAssets();
        
        // Pre-load asset details for all assets to ensure virtual folder resolution has access to full overrides
        // This is necessary because virtual folders may reference any asset in the system
        const detailPromises = this.assets.map(async (asset) => {
          try {
            const details = await coreConfig.persistenceAdapter!.loadAssetDetails(asset.id);
            this.assetDetails.set(asset.id, details);
          } catch (error) {
            console.warn(`Failed to pre-load asset details for ${asset.id}:`, error);
          }
        });
        
        await Promise.all(detailPromises);
        
        useWorkspaceStore().normalizeAssetStructure();
      } catch (error) {
        console.error('Failed to load assets:', error);
      } finally {
        this.loading.assets = false;
      }
    },

    async openInspectorFor(
      target: string | Pick<AssetTreeNode, 'id' | 'virtualContext' | 'assetType' | 'type'>,
      opts: { viewHint?: any; reuse?: boolean; focus?: boolean } = {}
    ): Promise<void> {
      const uiStore = useUiStore();
      const assetId = typeof target === 'string' ? target : target.id;
      const viewHint = opts.viewHint ?? (typeof target !== 'string' ? target.virtualContext?.viewHint : undefined) ?? (undefined as any);

      // Resolve if target is folder to avoid loading details for virtual folders
      const liveNode = this.getTreeNodeById(assetId);
      const isFolder = !!liveNode && liveNode.type === ASSET_TREE_NODE_TYPES.FOLDER;
      if (!isFolder) {
        // Preload details for smoother UI; synthetic handled in loadAssetDetails
        try {
          await this.loadAssetDetails({ id: assetId, type: ASSET_TREE_NODE_TYPES.ASSET } as AssetTreeNode, { force: false });
        } catch (e) {
          // Ignore preload errors here; UI can still open and show error states
        }
      }

      if (opts.reuse && this.openInspectors.length > 0) {
        const paneId = uiStore.activePaneId || this.openInspectors[0].paneId;
        this.updateInspectorContent(paneId, assetId);
        if (opts.focus !== false) uiStore.setActivePane(paneId);
      } else {
        this.openInspector(assetId);
        const paneId = this.openInspectors[this.openInspectors.length - 1]?.paneId;
        if (paneId) this._historyPush(paneId, assetId);
      }

      if (viewHint) {
        uiStore.selectedNodeViewHint = viewHint;
      }
    },

    _getOrCreateHistory(paneId: string): InspectorHistory.InspectorHistoryState {
      let hist = this.inspectorHistoryByPane.get(paneId);
      if (!hist) {
        hist = InspectorHistory.createHistory();
        this.inspectorHistoryByPane.set(paneId, hist);
      }
      return hist;
    },

    _historyPush(paneId: string, assetId: string): void {
      const hist = this._getOrCreateHistory(paneId);
      InspectorHistory.push(hist, assetId);
    },

    _historyReplace(paneId: string, assetId: string): void {
      const hist = this._getOrCreateHistory(paneId);
      InspectorHistory.replace(hist, assetId);
    },

    async historyBack(paneId: string): Promise<void> {
      const hist = this._getOrCreateHistory(paneId);
      const exists = async (id: string) => {
        if (this.assets.some(a => a.id === id)) return true;
        try {
          const coreConfig = useCoreConfigStore();
          if (!coreConfig.persistenceAdapter) return false;
          await coreConfig.persistenceAdapter.loadAssetDetails(id);
          return true;
        } catch {
          return false;
        }
      };
      const targetId = await InspectorHistory.back(hist, exists);
      if (targetId) {
        this.updateInspectorContent(paneId, targetId);
      }
    },

    async historyForward(paneId: string): Promise<void> {
      const hist = this._getOrCreateHistory(paneId);
      const exists = async (id: string) => {
        if (this.assets.some(a => a.id === id)) return true;
        try {
          const coreConfig = useCoreConfigStore();
          if (!coreConfig.persistenceAdapter) return false;
          await coreConfig.persistenceAdapter.loadAssetDetails(id);
          return true;
        } catch {
          return false;
        }
      };
      const targetId = await InspectorHistory.forward(hist, exists);
      if (targetId) {
        this.updateInspectorContent(paneId, targetId);
      }
    },
    
    async loadAssetDetails(node: AssetTreeNode, { force = false } = {}): Promise<AssetDetails> {
      const assetId = node.id;
      const coreConfig = useCoreConfigStore();

      // 1. VIRTUAL ASSET LOGIC (synthetic only; alias uses real details)
      if (node.virtualContext) {
        // If assetType is present, check registry for synthetic flag
        if (node.assetType) {
          const def = coreConfig.getAssetDefinition(node.assetType);
          if (def?.isSynthetic) {
            const details: AssetDetails = {
              unmerged: {
                id: node.id,
                assetKey: node.name,
                assetType: node.assetType,
                fqn: node.path,
                overrides: node.virtualContext.payload || {},
              } as any,
              merged: null,
              isReadOnly: true,
            };
            this.assetDetails.set(assetId, details);
            return details;
          }
        }
        // Non-synthetic virtual nodes (alias views) should fall through to real asset loading using node.id
      }

      // 2. REAL ASSET LOGIC (remains unchanged)
      const workspaceStore = useWorkspaceStore();

      if (this.assetDetails.has(assetId) && !force) {
        return this.assetDetails.get(assetId)!;
      }
      
      const isNewAsset = !this.assets.some(a => a.id === assetId);
      if (isNewAsset && workspaceStore.pendingChanges.upserted.has(assetId)) {
        const unmergedAsset = workspaceStore.pendingChanges.upserted.get(assetId)!;
        const details: AssetDetails = {
          unmerged: unmergedAsset,
          merged: null,
        };
        this.assetDetails.set(assetId, details);
        return details;
      }

      this.loading.assetDetails.add(assetId);
      try {
        const coreConfig = useCoreConfigStore();
        if (!coreConfig.persistenceAdapter) throw new Error("Persistence adapter not registered.");
        const details = await coreConfig.persistenceAdapter.loadAssetDetails(assetId);
        this.assetDetails.set(assetId, details);
        return details;
      } catch (error) {
        console.error(`Failed to load asset details for ${assetId}:`, error);
        throw error;
      } finally {
        this.loading.assetDetails.delete(assetId);
      }
    },

    // REVERT ACTIONS TO BE SYNCHRONOUS
    openInspector(assetId: string): void {
      const uiStore = useUiStore();
      const newPane: InspectorPaneInfo = { paneId: generatePaneId(), assetId: assetId };
      this.openInspectors.push(newPane);
      uiStore.setActivePane(newPane.paneId);
    },

    addInspector(assetId: string): void {
      const uiStore = useUiStore();
      const newPane: InspectorPaneInfo = { paneId: generatePaneId(), assetId: assetId };
      this.openInspectors.push(newPane);
      if (this.openInspectors.length === 1) {
        uiStore.setActivePane(newPane.paneId);
      }
    },

    closeInspector(paneId: string): void {
      const uiStore = useUiStore();
      const index = this.openInspectors.findIndex(p => p.paneId === paneId);
      if (index > -1) {
        this.openInspectors.splice(index, 1);
        this.inspectorHistoryByPane.delete(paneId);
        if (uiStore.activePaneId === paneId) {
          uiStore.setActivePane(this.openInspectors[0]?.paneId || null);
        }
      }
    },
      
    // Updates the content of a specific pane.
    updateInspectorContent(paneId: string, newAssetId: string): void {
      const inspector = this.openInspectors.find(p => p.paneId === paneId);
      if (inspector) {
        if (inspector.assetId !== newAssetId) {
          inspector.assetId = newAssetId;
          // user navigation: push to history
          this._historyPush(paneId, newAssetId);
        }
      }
    },

    closeInspectorByAssetId(assetId: string): void {
      const inspectorToClose = this.openInspectors.find(p => p.assetId === assetId);
      if (inspectorToClose) {
        this.closeInspector(inspectorToClose.paneId);
      }
    },    

    async previewMergedAssets(changes: { upserted: UnmergedAsset[], deleted: string[] }): Promise<any> {
      try {
        const coreConfig = useCoreConfigStore();
        if (!coreConfig.persistenceAdapter) throw new Error("Persistence adapter not registered.");
        const response = await coreConfig.persistenceAdapter.previewMergedAssets({
          openInspectorIds: this.openInspectors.map(p => p.assetId),
          changes
        });
        
        response.previews.forEach((preview: any) => {
          const existing = this.assetDetails.get(preview.id);
          if (existing) {
            existing.merged = preview.merged;
          }
        });
      } catch (error) {
        console.error('Failed to preview merged assets:', error);
        throw error;
      }
    }
  }
});







