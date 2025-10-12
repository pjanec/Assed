import { defineStore } from 'pinia';
import type { PersistenceAdapter } from '@/core/types/persistence';
import type { AssetDefinition, Asset } from '@/core/types';

export const useCoreConfigStore = defineStore('coreConfig', {
  state: () => ({
    structuralAssetType: '' as string,
    persistenceAdapter: null as PersistenceAdapter | null,
    assetRegistry: {} as Record<string, AssetDefinition>,
    assetTypes: {} as Record<string, string>,
  }),

  getters: {
    getAssetDefinition: (state) => (assetType: string | null | undefined): AssetDefinition | null => {
      if (!assetType) return null;
      return state.assetRegistry[assetType] || null;
    },

    getAssetIcon: (state) => (assetType: Asset['assetType']): string => {
        const definition = state.assetRegistry[assetType];
        return definition ? definition.icon : 'mdi-file-question-outline';
    },

    getAssetTypeColor: (state) => (assetType: Asset['assetType']): string => {
        const definition = state.assetRegistry[assetType];
        return definition ? definition.color : 'grey';
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

    registerAssetRegistry(registry: Record<string, AssetDefinition>) {
      if (!registry || Object.keys(registry).length === 0) {
        throw new Error("Configuration Error: A valid asset registry must be provided.");
      }
      this.assetRegistry = registry;
    },
    
    registerAssetTypes(types: Record<string, string>) {
      if (!types || Object.keys(types).length === 0) {
        throw new Error("Configuration Error: Asset types must be provided.");
      }
      this.assetTypes = types;
    }
  },
});