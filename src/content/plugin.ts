import type { App } from 'vue';

import { useCoreConfigStore } from '@/core/stores/config';

// Import all content-specific registrations
import { assetRegistry } from '@/content/config/assetRegistry';
import { ASSET_TYPES } from '@/content/config/constants';
import { LocalStorageAdapter } from '@/content/adapters/LocalStorageAdapter';
import { registerAllValidationRules } from '@/content/logic/validation';
import { useContentHandlersRegistration } from '@/content/logic/contextMenus';

// Import interaction rules to ensure they are registered when the plugin is installed
import '@/content/logic/interactions/genericInteractions';
import '@/content/logic/interactions/packageInteractions';
//import '@/content/logic/interactions/nodeCardInteractions';

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
    coreConfigStore.registerAssetRegistry(assetRegistry);
    coreConfigStore.registerAssetTypes(ASSET_TYPES);
    coreConfigStore.setStructuralAssetType(ASSET_TYPES.NAMESPACE_FOLDER);
    coreConfigStore.registerPersistenceAdapter(new LocalStorageAdapter());

    // 2. Register Pluggable Business Logic
    registerAllValidationRules();

    // Note: Interaction rules are registered automatically by importing their files above.

    console.log("✅ Content Plugin successfully installed.");
  }
};