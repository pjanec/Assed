import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { ConfigurationHub } from '@/core/stores/ConfigurationHub';
import { mockMasterAssetRegistry } from '../../../mock-content/mockMasterAssetRegistry';
import { mockPerspectiveDefinitions } from '../../../mock-content/mockPerspectiveDefinitions';
import { mockMasterInteractionRegistry } from '../../../mock-content/mockMasterInteractionRegistry';
import { setGlobalConfigHub } from '@/core/stores/config';
import { useCoreConfigStore } from '@/core/stores/config';
import { getEffectiveRegistry } from '@/content/config/assetRegistry';
import type { AssetTreeNode } from '@/core/types';
import { MOCK_ASSET_TYPES } from '../../../mock-content/mockAssetRegistry';
import { ROOT_ID } from '@/core/config/constants';

describe('ContextMenuActions - Perspective-Based Filtering', () => {
  let hub: ConfigurationHub;
  let coreConfig: ReturnType<typeof useCoreConfigStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    hub = new ConfigurationHub(
      mockMasterAssetRegistry,
      mockPerspectiveDefinitions,
      'Container', // structural type
      mockMasterInteractionRegistry,
      'default'
    );
    
    // Set global config hub
    setGlobalConfigHub(hub);
    
    // Get the core config store
    coreConfig = useCoreConfigStore();
  });

  describe('Valid Child Types Filtering', () => {
    it('should filter out unsupported child types in package perspective', () => {
      hub.setPerspective('package');
      
      const effectiveRegistry = coreConfig.effectiveAssetRegistry;
      
      // Container can have Widget as a child (from mockMasterAssetRegistry)
      // In package perspective:
      // - Container is NOT supported
      // - Widget IS supported
      
      // Check that Widget is supported in package perspective
      const widgetDef = effectiveRegistry['Widget'];
      expect(widgetDef).toBeDefined();
      expect((widgetDef as any)._isSupportedInCurrentPerspective).toBe(true);
      
      // Container should NOT be supported in package perspective
      const containerDef = effectiveRegistry['Container'];
      expect(containerDef).toBeDefined();
      expect((containerDef as any)._isSupportedInCurrentPerspective).toBe(false);
    });

    it('should show all supported child types in environment perspective', () => {
      hub.setPerspective('environment');
      
      const effectiveRegistry = coreConfig.effectiveAssetRegistry;
      
      // In environment perspective, both Container and Widget are supported
      const containerDef = effectiveRegistry['Container'];
      const widgetDef = effectiveRegistry['Widget'];
      
      expect((containerDef as any)._isSupportedInCurrentPerspective).toBe(true);
      expect((widgetDef as any)._isSupportedInCurrentPerspective).toBe(true);
    });

    it('should show only Container child types in lab perspective', () => {
      hub.setPerspective('lab');
      
      const effectiveRegistry = coreConfig.effectiveAssetRegistry;
      
      // In lab perspective, only Container is supported
      const containerDef = effectiveRegistry['Container'];
      const widgetDef = effectiveRegistry['Widget'];
      
      expect((containerDef as any)._isSupportedInCurrentPerspective).toBe(true);
      expect((widgetDef as any)._isSupportedInCurrentPerspective).toBe(false);
    });
  });

  describe('Creatable at Root Filtering', () => {
    it('should filter creatable-at-root types by perspective', () => {
      hub.setPerspective('package');
      
      const effectiveRegistry = coreConfig.effectiveAssetRegistry;
      
      // Get all types that are creatable at root
      const creatableAtRoot = Object.entries(effectiveRegistry)
        .filter(([, def]) => def.isCreatableAtRoot)
        .map(([type]) => type);
      
      // Get types that are both creatable AND supported
      const supportedCreatable = creatableAtRoot.filter((type) => {
        const def = effectiveRegistry[type];
        return (def as any)._isSupportedInCurrentPerspective !== false;
      });
      
      // Package perspective supports: Widget, Aggregator
      // Container is NOT supported
      const containerSupported = supportedCreatable.includes('Container');
      const widgetSupported = supportedCreatable.includes('Widget');
      
      expect(containerSupported).toBe(false);
      expect(widgetSupported).toBe(true);
    });
  });

  describe('Reactive Updates', () => {
    it('should update supported status when perspective changes', () => {
      // Start in default perspective
      hub.setPerspective('default');
      
      const defaultRegistry = coreConfig.effectiveAssetRegistry;
      const defaultWidgetSupported = (defaultRegistry['Widget'] as any)._isSupportedInCurrentPerspective;
      const defaultContainerSupported = (defaultRegistry['Container'] as any)._isSupportedInCurrentPerspective;
      
      // Switch to package perspective
      hub.setPerspective('package');
      
      const packageRegistry = coreConfig.effectiveAssetRegistry;
      const packageWidgetSupported = (packageRegistry['Widget'] as any)._isSupportedInCurrentPerspective;
      const packageContainerSupported = (packageRegistry['Container'] as any)._isSupportedInCurrentPerspective;
      
      // Status should change
      expect(defaultWidgetSupported).toBe(true); // Widget supported in default
      expect(packageWidgetSupported).toBe(true); // Widget supported in package
      expect(defaultContainerSupported).toBe(true); // Container supported in default
      expect(packageContainerSupported).toBe(false); // Container NOT supported in package
    });
  });
});
