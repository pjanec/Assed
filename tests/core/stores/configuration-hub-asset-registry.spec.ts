import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { ConfigurationHub } from '@/core/stores/ConfigurationHub';
import { mockMasterAssetRegistry } from '../../mock-content/mockMasterAssetRegistry';
import { mockPerspectiveDefinitions } from '../../mock-content/mockPerspectiveDefinitions';
import { mockMasterInteractionRegistry } from '../../mock-content/mockMasterInteractionRegistry';

describe('Stage 2: ConfigurationHub Asset Registry', () => {
  let hub: ConfigurationHub;

  beforeEach(() => {
    setActivePinia(createPinia());
    hub = new ConfigurationHub(
      mockMasterAssetRegistry,
      mockPerspectiveDefinitions,
      'Container', // structural type
      mockMasterInteractionRegistry,
      'default'
    );
  });

  describe('Initialization', () => {
    it('should initialize with default perspective', () => {
      expect(hub.currentPerspective.value).toBe('default');
    });

    it('should have all assets visible in default perspective', () => {
      const registry = hub.effectiveAssetRegistry.value;
      expect(registry['Container']).toBeDefined();
      expect(registry['Widget']).toBeDefined();
      expect(registry['Aggregator']).toBeDefined();
    });
  });

  describe('Label Override Resolution', () => {
    it('should use default labels in default perspective', () => {
      const registry = hub.effectiveAssetRegistry.value;
      expect(registry['Container'].label).toBe('Container');
      expect(registry['Widget'].label).toBe('Widget');
    });

    it('should apply environment perspective label overrides', () => {
      hub.setPerspective('environment');
      const registry = hub.effectiveAssetRegistry.value;
      expect(registry['Container'].label).toBe('Environment');
      expect(registry['Widget'].label).toBe('Widget'); // No override
    });

    it('should apply lab perspective label overrides', () => {
      hub.setPerspective('lab');
      const registry = hub.effectiveAssetRegistry.value;
      expect(registry['Container'].label).toBe('Lab Setup');
    });

    it('should apply package perspective label overrides', () => {
      hub.setPerspective('package');
      const registry = hub.effectiveAssetRegistry.value;
      expect(registry['Widget'].label).toBe('Package Widget');
    });
  });

  describe('Icon and Color Override Resolution', () => {
    it('should apply lab perspective icon and color overrides', () => {
      hub.setPerspective('lab');
      const registry = hub.effectiveAssetRegistry.value;
      expect(registry['Container'].icon).toBe('mdi-flask-outline');
      expect(registry['Container'].color).toBe('purple');
    });

    it('should use defaults when no override exists', () => {
      hub.setPerspective('environment');
      const registry = hub.effectiveAssetRegistry.value;
      expect(registry['Widget'].icon).toBe('mdi-toy-brick');
      expect(registry['Widget'].color).toBe('blue');
    });
  });

  describe('Visibility Filtering', () => {
    it('should filter assets by supportedAssetTypes in environment perspective', () => {
      hub.setPerspective('environment');
      const registry = hub.effectiveAssetRegistry.value;
      expect(registry['Container']).toBeDefined();
      expect(registry['Widget']).toBeDefined();
      expect(registry['Aggregator']).toBeDefined(); // Always in registry (for icons/definitions)
      // Check supported types
      expect(registry['Container']._isSupportedInCurrentPerspective).toBe(true);
      expect(registry['Widget']._isSupportedInCurrentPerspective).toBe(true);
      expect(registry['Aggregator']._isSupportedInCurrentPerspective).toBe(false);
    });

    it('should filter assets by supportedAssetTypes in package perspective', () => {
      hub.setPerspective('package');
      const registry = hub.effectiveAssetRegistry.value;
      expect(registry['Container']).toBeDefined(); // Always in registry
      expect(registry['Widget']).toBeDefined();
      expect(registry['Aggregator']).toBeDefined();
      // Check supported types - Container is NOT in package's supportedAssetTypes
      expect(registry['Container']._isSupportedInCurrentPerspective).toBe(false);
      expect(registry['Widget']._isSupportedInCurrentPerspective).toBe(true);
      expect(registry['Aggregator']._isSupportedInCurrentPerspective).toBe(true);
    });

    it('should filter assets by supportedAssetTypes in lab perspective', () => {
      hub.setPerspective('lab');
      const registry = hub.effectiveAssetRegistry.value;
      expect(registry['Container']).toBeDefined();
      expect(registry['Widget']).toBeDefined(); // Always in registry
      expect(registry['Aggregator']).toBeUndefined(); // Actually filtered out by isVisibleInExplorer=false
      // Check supported types
      expect(registry['Widget']._isSupportedInCurrentPerspective).toBe(false);
    });

    it('should hide assets with isVisibleInExplorer set to false', () => {
      hub.setPerspective('lab');
      const registry = hub.effectiveAssetRegistry.value;
      // Aggregator has isVisibleInExplorer.lab = false
      expect(registry['Aggregator']).toBeUndefined();
    });
  });

  describe('Perspective Switching', () => {
    it('should reactively update registry when perspective changes', () => {
      const initialRegistry = hub.effectiveAssetRegistry.value;
      expect(initialRegistry['Container'].label).toBe('Container');

      hub.setPerspective('environment');
      const updatedRegistry = hub.effectiveAssetRegistry.value;
      expect(updatedRegistry['Container'].label).toBe('Environment');
    });

    it('should handle multiple perspective switches', () => {
      hub.setPerspective('environment');
      expect(hub.effectiveAssetRegistry.value['Container'].label).toBe('Environment');

      hub.setPerspective('lab');
      expect(hub.effectiveAssetRegistry.value['Container'].label).toBe('Lab Setup');

      hub.setPerspective('default');
      expect(hub.effectiveAssetRegistry.value['Container'].label).toBe('Container');
    });

    it('should ignore invalid perspective names', () => {
      const initial = hub.currentPerspective.value;
      hub.setPerspective('invalid' as any);
      expect(hub.currentPerspective.value).toBe(initial);
    });
  });

  describe('Registry Integrity', () => {
    it('should preserve all non-perspective properties', () => {
      const registry = hub.effectiveAssetRegistry.value;
      const containerDef = registry['Container'];
      expect(containerDef.validChildren).toContain('Widget');
      expect(containerDef.isCreatableAtRoot).toBe(true);
      expect(containerDef.creationModes).toEqual(['simple']);
      expect(containerDef.sortOrder).toBe(10);
    });

    it('should not mutate master registry', () => {
      const original = mockMasterAssetRegistry['Container'].label.default;
      hub.setPerspective('lab');
      expect(mockMasterAssetRegistry['Container'].label.default).toBe(original);
    });
  });
});

