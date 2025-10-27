import type { App } from 'vue';

import { useCoreConfigStore, setGlobalConfigHub } from '@/core/stores/config';

// Import all content-specific registrations
import { masterAssetRegistry } from '@/content/config/masterAssetRegistry';
import { masterInteractionRegistry } from '@/content/config/masterInteractionRegistry';
import { perspectiveDefinitions } from '@/content/config/perspectiveDefinitions';
import { ASSET_TYPES } from '@/content/config/constants';
import { LocalStorageAdapter } from '@/content/adapters/LocalStorageAdapter';
import { registerAllValidationRules } from '@/content/logic/validation';
import { useContentHandlersRegistration } from '@/content/logic/contextMenus';
import { ConfigurationHub, type InteractionRuleEntry } from '@/core/stores/ConfigurationHub';
import { FOLDER_LIKE_INTERACTION_RULE } from '@/content/config/masterInteractionRegistry';

/**
 * This function contains the logic that MUST run from within a component's 
 * setup context, as it relies on `inject()`.
 */
export function registerContentHooks() {
    const { registerAllContentHandlers } = useContentHandlersRegistration();
    registerAllContentHandlers();
}

export const ContentPlugin = {
  install(app: App) {
    const coreConfigStore = useCoreConfigStore();

    // 1. Register Data Structures and Persistence
    coreConfigStore.registerAssetTypes(ASSET_TYPES);
    coreConfigStore.setStructuralAssetType(ASSET_TYPES.NAMESPACE_FOLDER);
    coreConfigStore.registerPersistenceAdapter(new LocalStorageAdapter());

    // 2. Build the complete interaction registry
    // First, use the master registry
    const completeInteractionRegistry: InteractionRuleEntry[] = [...masterInteractionRegistry];
    
    // Then, dynamically register folder-like rules for all container types
    // This needs to happen after ConfigurationHub is initialized and can be done lazily
    // For now, we'll pre-populate based on known container types
    const containerAssetTypes = Object.entries(masterAssetRegistry)
      .filter(([, def]) => {
        const isVisible = def.isVisibleInExplorer?.default ?? true;
        return isVisible && (def.isStructuralFolder || (def.validChildren?.length || 0) > 0);
      })
      .map(([type]) => type);

    // Add folder-like rules for each container type
    containerAssetTypes.forEach(type => {
      completeInteractionRegistry.push({
        draggedType: 'Asset',
        targetType: type,
        // perspectives undefined = applies to all perspectives
        rule: FOLDER_LIKE_INTERACTION_RULE
      });
    });

    // 3. Initialize ConfigurationHub with the complete interaction registry
    const configHub = new ConfigurationHub(
      masterAssetRegistry,
      perspectiveDefinitions,
      ASSET_TYPES.NAMESPACE_FOLDER,
      completeInteractionRegistry,
      'default'
    );
    
    // Store hub in app context for access by components
    app.provide('configHub', configHub);
    
    // Register hub globally so coreConfigStore getters can access it
    setGlobalConfigHub(configHub);

    // 4. Register Pluggable Business Logic
    registerAllValidationRules();

    console.log("✅ Content Plugin successfully installed with ConfigurationHub.");
  }
};