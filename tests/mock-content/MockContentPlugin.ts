import type { App } from 'vue';
import { useCoreConfigStore } from '@/core/stores/config';
import { MOCK_ASSET_TYPES, mockAssetRegistry } from './mockAssetRegistry';
import type { MockPersistenceAdapter } from './MockPersistenceAdapter';

export const createMockContentPlugin = (mockAdapter: MockPersistenceAdapter) => ({
  install(app: App) {
    const coreConfigStore = useCoreConfigStore();
    
    coreConfigStore.registerAssetRegistry(mockAssetRegistry);
    coreConfigStore.registerAssetTypes(MOCK_ASSET_TYPES);
    coreConfigStore.registerPersistenceAdapter(mockAdapter);
    // --- ADD THIS LINE ---
    coreConfigStore.setStructuralAssetType(MOCK_ASSET_TYPES.CONTAINER);
  }
});