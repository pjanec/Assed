import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { PersistenceAdapter } from '@/core/types/persistence';
import type { AssetDefinition, Asset } from '@/core/types';

// Global reference to ConfigurationHub
let globalConfigHub: any = null;

export function setGlobalConfigHub(hub: any) {
  globalConfigHub = hub;
}

// Export for use in assetRegistry.ts
export { globalConfigHub };

export const useCoreConfigStore = defineStore('coreConfig', {
  state: () => ({
    structuralAssetType: '' as string,
    persistenceAdapter: null as PersistenceAdapter | null,
    assetTypes: {} as Record<string, string>,
  }),

  getters: {
    /**
     * Returns the effective asset registry based on current perspective.
     * Access via coreConfig.effectiveAssetRegistry in components.
     */
    effectiveAssetRegistry(): Record<string, AssetDefinition> {
      // Use ConfigurationHub's effective registry
      if (globalConfigHub) {
        return globalConfigHub.effectiveAssetRegistry.value;
      }
      throw new Error('ConfigurationHub not initialized. Cannot access effective asset registry.');
    },

    /**
     * Returns the master asset registry (unfiltered).
     * Used for getting icons/colors for assets that may be filtered by perspective.
     */
    masterAssetRegistry(): Record<string, AssetDefinition> {
      if (globalConfigHub) {
        return globalConfigHub.masterAssetRegistry;
      }
      throw new Error('ConfigurationHub not initialized. Cannot access master asset registry.');
    },

    getAssetDefinition(): (assetType: string | null | undefined) => AssetDefinition | null {
      const registry = this.effectiveAssetRegistry;
      return (assetType: string | null | undefined): AssetDefinition | null => {
        if (!assetType) return null;
        return registry[assetType] || null;
      };
    },

    getAssetIcon(): (assetType: Asset['assetType']) => string {
      return (assetType: Asset['assetType']): string => {
        const definition = this.effectiveAssetRegistry[assetType];
        if (!definition) {
          console.warn(`[getAssetIcon] No definition for asset type: ${assetType}`);
          return 'mdi-file-question-outline';
        }
        const icon = definition.icon as any;
        return icon || 'mdi-file-question-outline';
      };
    },

    getAssetTypeColor(): (assetType: Asset['assetType']) => string {
      const registry = this.effectiveAssetRegistry;
      return (assetType: Asset['assetType']): string => {
        const definition = registry[assetType];
        if (!definition) return 'grey';
        // ConfigurationHub.unwrapDef already converts PerspectiveOverrides to plain strings
        const color = definition.color as any;
        return color || 'grey';
      };
    }
  },

  actions: {
    setStructuralAssetType(assetType: string) {
      this.structuralAssetType = assetType;
    },
    
    registerPersistenceAdapter(adapter: PersistenceAdapter) {
      if (!adapter) {
        throw new Error("Configuration Error: A valid persistence adapter must be provided.");
      }

      this.persistenceAdapter = adapter;
    },

    
    registerAssetTypes(types: Record<string, string>) {
      if (!types || Object.keys(types).length === 0) {
        throw new Error("Configuration Error: Asset types must be provided.");
      }
      this.assetTypes = types;
    }
  },
});