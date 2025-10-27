import { describe, it, expect } from 'vitest';
import type { PerspectiveOverrides, PerspectiveDefinition } from '@/core/types';
import { mockPerspectiveDefinitions } from '../../mock-content/mockPerspectiveDefinitions';
import { mockMasterAssetRegistry } from '../../mock-content/mockMasterAssetRegistry';

describe('Stage 1: Type System and Mock Data', () => {
  describe('PerspectiveOverrides Type', () => {
    it('should have valid PerspectiveOverrides structure', () => {
      const testOverride: PerspectiveOverrides<string> = {
        default: 'Default Value',
        environment: 'Environment Value'
      };
      expect(testOverride.default).toBe('Default Value');
      expect(testOverride.environment).toBe('Environment Value');
    });

    it('should allow optional perspective-specific values', () => {
      const testOverride: PerspectiveOverrides<number> = {
        default: 10,
        lab: 20
      };
      expect(testOverride.default).toBe(10);
      expect(testOverride.lab).toBe(20);
      expect(testOverride.environment).toBeUndefined();
      expect(testOverride.package).toBeUndefined();
    });
  });

  describe('Mock Perspective Definitions', () => {
    it('should have all required perspectives', () => {
      expect(mockPerspectiveDefinitions.default).toBeDefined();
      expect(mockPerspectiveDefinitions.environment).toBeDefined();
      expect(mockPerspectiveDefinitions.package).toBeDefined();
      expect(mockPerspectiveDefinitions.lab).toBeDefined();
    });

    it('should have display names for all perspectives', () => {
      expect(mockPerspectiveDefinitions.default.displayName).toBe('Full Editor');
      expect(mockPerspectiveDefinitions.environment.displayName).toBe('Environment View');
      expect(mockPerspectiveDefinitions.package.displayName).toBe('Package View');
      expect(mockPerspectiveDefinitions.lab.displayName).toBe('Lab View');
    });

    it('should have icons for all perspectives', () => {
      expect(mockPerspectiveDefinitions.default.icon).toBe('mdi-pencil');
      expect(mockPerspectiveDefinitions.environment.icon).toBe('mdi-earth');
      expect(mockPerspectiveDefinitions.package.icon).toBe('mdi-package');
      expect(mockPerspectiveDefinitions.lab.icon).toBe('mdi-flask');
    });

    it('should have supportedAssetTypes filters', () => {
      expect(mockPerspectiveDefinitions.default.supportedAssetTypes).toBeUndefined();
      expect(mockPerspectiveDefinitions.environment.supportedAssetTypes).toEqual(['Container', 'Widget']);
      expect(mockPerspectiveDefinitions.package.supportedAssetTypes).toEqual(['Aggregator', 'Widget']);
      expect(mockPerspectiveDefinitions.lab.supportedAssetTypes).toEqual(['Container']);
    });
  });

  describe('Mock Master Asset Registry', () => {
    it('should have perspective-aware properties in mock registry', () => {
      const containerDef = mockMasterAssetRegistry['Container'];
      expect(containerDef.label.default).toBe('Container');
      expect(containerDef.label.environment).toBe('Environment');
      expect(containerDef.label.lab).toBe('Lab Setup');
    });

    it('should have icon overrides', () => {
      const containerDef = mockMasterAssetRegistry['Container'];
      expect(containerDef.icon.default).toBe('mdi-archive');
      expect(containerDef.icon.lab).toBe('mdi-flask-outline');
    });

    it('should have color overrides', () => {
      const containerDef = mockMasterAssetRegistry['Container'];
      expect(containerDef.color.default).toBe('green');
      expect(containerDef.color.lab).toBe('purple');
    });

    it('should have isVisibleInExplorer for all assets', () => {
      Object.values(mockMasterAssetRegistry).forEach(def => {
        expect(def.isVisibleInExplorer).toBeDefined();
        expect(def.isVisibleInExplorer.default).toBeDefined();
        expect(typeof def.isVisibleInExplorer.default).toBe('boolean');
      });
    });

    it('should have visibility overrides for Aggregator in lab perspective', () => {
      const aggDef = mockMasterAssetRegistry['Aggregator'];
      expect(aggDef.isVisibleInExplorer.default).toBe(true);
      expect(aggDef.isVisibleInExplorer.lab).toBe(false);
    });

    it('should preserve non-perspective properties', () => {
      const containerDef = mockMasterAssetRegistry['Container'];
      expect(containerDef.validChildren).toContain('Widget');
      expect(containerDef.isCreatableAtRoot).toBe(true);
      expect(containerDef.creationModes).toEqual(['simple']);
      expect(containerDef.sortOrder).toBe(10);
    });

    it('should have all required properties with PerspectiveOverrides structure', () => {
      Object.entries(mockMasterAssetRegistry).forEach(([assetType, def]) => {
        expect(def.label).toHaveProperty('default');
        expect(typeof def.label).toBe('object');
        expect(typeof def.label.default).toBe('string');
        
        expect(def.icon).toHaveProperty('default');
        expect(typeof def.icon.default).toBe('string');
        
        expect(def.color).toHaveProperty('default');
        expect(typeof def.color.default).toBe('string');
        
        expect(def.isVisibleInExplorer).toHaveProperty('default');
        expect(typeof def.isVisibleInExplorer.default).toBe('boolean');
        
        expect(def.inspectorComponent).toHaveProperty('default');
        expect(typeof def.inspectorComponent.default).toBe('function');
      });
    });
  });

  describe('Type Safety', () => {
    it('should enforce default value requirement', () => {
      // @ts-expect-error - testing type safety
      const invalid: PerspectiveOverrides<string> = { environment: 'test' };
      // This should cause a TypeScript error but we're in runtime now
    });

    it('should allow all perspective properties', () => {
      const complete: PerspectiveOverrides<string> = {
        default: 'default',
        environment: 'env',
        package: 'pkg',
        lab: 'lab'
      };
      expect(complete.default).toBe('default');
      expect(complete.environment).toBe('env');
      expect(complete.package).toBe('pkg');
      expect(complete.lab).toBe('lab');
    });
  });
});

