import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { ConfigurationHub } from '@/core/stores/ConfigurationHub';
import { mockMasterAssetRegistry } from '../../mock-content/mockMasterAssetRegistry';
import { mockPerspectiveDefinitions } from '../../mock-content/mockPerspectiveDefinitions';
import { mockMasterInteractionRegistry } from '../../mock-content/mockMasterInteractionRegistry';
import { useCoreConfigStore, setGlobalConfigHub } from '@/core/stores/config';

describe('NewAssetDialog - Perspective-Based Filtering', () => {
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
    
    // Set global config hub so the store can access it
    setGlobalConfigHub(hub);
    
    // Get the core config store to test the filtering logic
    coreConfig = useCoreConfigStore();
  });

  describe('Default Perspective', () => {
    it('should show all creatable asset types in default perspective', () => {
      hub.setPerspective('default');
      
      const effectiveRegistry = coreConfig.effectiveAssetRegistry;
      
      // In default perspective, all types should be supported
      // Mock data: Container and Widget are isCreatableAtRoot
      const creatableTypes = Object.entries(effectiveRegistry)
        .filter(([, def]) => def.isCreatableAtRoot)
        .map(([type]) => type);
      
      expect(creatableTypes.length).toBeGreaterThan(0);
      
      // All creatable types should be supported in default perspective
      const supportedTypes = creatableTypes.filter((type) => {
        const def = effectiveRegistry[type];
        return (def as any)._isSupportedInCurrentPerspective !== false;
      });
      
      expect(supportedTypes.length).toBe(creatableTypes.length);
    });
  });

  describe('Distro Perspective', () => {
    it('should filter asset types based on supportedAssetTypes', () => {
      hub.setPerspective('distro');
      
      const effectiveRegistry = coreConfig.effectiveAssetRegistry;
      
      // Get all creatable types
      const allCreatableTypes = Object.entries(effectiveRegistry)
        .filter(([, def]) => def.isCreatableAtRoot)
        .map(([type]) => type);
      
      // Get types that should be shown (creatable AND supported)
      const shownTypes = allCreatableTypes.filter((type) => {
        const def = effectiveRegistry[type];
        return (def as any)._isSupportedInCurrentPerspective !== false;
      });
      
      // Distro perspective supports: Container, Widget (from mockPerspectiveDefinitions)
      // Aggregator is NOT supported
      
      const containerSupported = shownTypes.includes('Container');
      const widgetSupported = shownTypes.includes('Widget');
      const aggregatorSupported = shownTypes.includes('Aggregator');
      
      // Container and Widget should be supported, Aggregator should not
      expect(containerSupported).toBe(true);
      expect(widgetSupported).toBe(true);
      expect(aggregatorSupported).toBe(false);
    });
  });

  describe('Package Perspective', () => {
    it('should filter asset types for package editing', () => {
      hub.setPerspective('package');
      
      const effectiveRegistry = coreConfig.effectiveAssetRegistry;
      
      // Get all creatable types (isCreatableAtRoot = true)
      const allCreatableTypes = Object.entries(effectiveRegistry)
        .filter(([, def]) => def.isCreatableAtRoot)
        .map(([type]) => type);
      
      // Get types that should be shown (creatable AND supported in current perspective)
      const shownTypes = allCreatableTypes.filter((type) => {
        const def = effectiveRegistry[type];
        return (def as any)._isSupportedInCurrentPerspective !== false;
      });
      
      // Package perspective supports: Widget (from mockPerspectiveDefinitions)
      // Container is NOT supported
      // Note: Aggregator is in supportedAssetTypes but isCreatableAtRoot = false, so it won't appear
      
      const containerSupported = shownTypes.includes('Container');
      const widgetSupported = shownTypes.includes('Widget');
      
      expect(containerSupported).toBe(false);
      expect(widgetSupported).toBe(true);
      // All shown types should be creatable
      expect(allCreatableTypes).toContain('Widget');
    });
  });

  describe('Lab Perspective', () => {
    it('should support only Container in lab perspective', () => {
      hub.setPerspective('lab');
      
      const effectiveRegistry = coreConfig.effectiveAssetRegistry;
      
      // Get all creatable types
      const allCreatableTypes = Object.entries(effectiveRegistry)
        .filter(([, def]) => def.isCreatableAtRoot)
        .map(([type]) => type);
      
      // Get types that should be shown
      const shownTypes = allCreatableTypes.filter((type) => {
        const def = effectiveRegistry[type];
        return (def as any)._isSupportedInCurrentPerspective !== false;
      });
      
      // Lab perspective supports only Container (from mockPerspectiveDefinitions)
      // Note: Aggregator has isVisibleInExplorer=false in lab perspective, so it won't be in registry
      const containerSupported = shownTypes.includes('Container');
      const widgetSupported = shownTypes.includes('Widget');
      
      expect(containerSupported).toBe(true);
      expect(widgetSupported).toBe(false);
    });
  });

  describe('Reactive Updates', () => {
    it('should update filtered types when perspective changes', () => {
      hub.setPerspective('default');
      
      const defaultRegistry = coreConfig.effectiveAssetRegistry;
      const defaultTypes = Object.entries(defaultRegistry)
        .filter(([, def]) => def.isCreatableAtRoot && (def as any)._isSupportedInCurrentPerspective !== false)
        .map(([type]) => type);
      
      hub.setPerspective('package');
      
      const packageRegistry = coreConfig.effectiveAssetRegistry;
      const packageTypes = Object.entries(packageRegistry)
        .filter(([, def]) => def.isCreatableAtRoot && (def as any)._isSupportedInCurrentPerspective !== false)
        .map(([type]) => type);
      
      // Package perspective should have different filtered types than default
      expect(defaultTypes).not.toEqual(packageTypes);
    });
  });
});

