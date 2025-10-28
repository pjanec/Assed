import type { App } from 'vue';
import { useCoreConfigStore } from '@/core/stores';
import { setGlobalConfigHub } from '@/core/stores/config';
import { MOCK_ASSET_TYPES, mockAssetRegistry } from './mockAssetRegistry';
import type { MockPersistenceAdapter } from './MockPersistenceAdapter';
import { ConfigurationHub } from '@/core/stores/ConfigurationHub';
import { mockPerspectiveDefinitions } from './mockPerspectiveDefinitions';
// Use the real master interaction registry in tests to get actual interaction rules
import { masterInteractionRegistry } from '@/content/config/masterInteractionRegistry';
import { FOLDER_LIKE_INTERACTION_RULE } from '@/content/config/masterInteractionRegistry';
import { infrastructureInteractions } from '@/content/config/interactions/infrastructureInteractions';
import type { InteractionRuleEntry } from '@/core/stores/ConfigurationHub';

// Import validation rules to ensure they are registered during tests
import { registerAllValidationRules } from '@/content/logic/validation';

export const createMockContentPlugin = (mockAdapter: MockPersistenceAdapter) => ({
  install(app: App) {
    const coreConfigStore = useCoreConfigStore();
    
    coreConfigStore.registerAssetTypes(MOCK_ASSET_TYPES);
    coreConfigStore.registerPersistenceAdapter(mockAdapter);
    coreConfigStore.setStructuralAssetType(MOCK_ASSET_TYPES.CONTAINER);
    
    // Build the complete interaction registry for tests
    // Use the real master registry to get actual interaction rules
    const completeInteractionRegistry: InteractionRuleEntry[] = [
      ...masterInteractionRegistry,
      ...infrastructureInteractions,
    ];
    
    // Add folder-like rules for all container types (similar to plugin.ts)
    const containerAssetTypes = Object.entries(mockAssetRegistry)
      .filter(([, def]) => {
        const isVisible = def.isVisibleInExplorer?.default ?? true;
        return isVisible && (def.isStructuralFolder || (def.validChildren?.length || 0) > 0);
      })
      .map(([type]) => type);

    containerAssetTypes.forEach(type => {
      completeInteractionRegistry.push({
        draggedType: 'Asset',
        targetType: type,
        // perspectives undefined = applies to all perspectives
        rule: FOLDER_LIKE_INTERACTION_RULE
      });
    });

    // Initialize ConfigurationHub for tests
    const configHub = new ConfigurationHub(
      mockAssetRegistry,
      mockPerspectiveDefinitions,
      MOCK_ASSET_TYPES.CONTAINER,
      completeInteractionRegistry,
      'default'
    );
    
    setGlobalConfigHub(configHub);
    
    // Register validation rules
    registerAllValidationRules();
  }
});