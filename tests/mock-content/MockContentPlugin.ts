import type { App } from 'vue';
import { useCoreConfigStore } from '@/core/stores/config';
import { MOCK_ASSET_TYPES, mockAssetRegistry } from './mockAssetRegistry';
import type { MockPersistenceAdapter } from './MockPersistenceAdapter';

// Import interaction rules to ensure they are registered during tests
import '@/content/logic/interactions/genericInteractions';
import '@/content/logic/interactions/packageAssignmentInteractions';
import '@/content/logic/interactions/nodeInteractions';

// Import validation rules to ensure they are registered during tests
import { registerAllValidationRules } from '@/content/logic/validation';

export const createMockContentPlugin = (mockAdapter: MockPersistenceAdapter) => ({
  install(app: App) {
    const coreConfigStore = useCoreConfigStore();
    
    coreConfigStore.registerAssetRegistry(mockAssetRegistry);
    coreConfigStore.registerAssetTypes(MOCK_ASSET_TYPES);
    coreConfigStore.registerPersistenceAdapter(mockAdapter);
    coreConfigStore.setStructuralAssetType(MOCK_ASSET_TYPES.CONTAINER);
    
    // Register validation rules
    registerAllValidationRules();
  }
});