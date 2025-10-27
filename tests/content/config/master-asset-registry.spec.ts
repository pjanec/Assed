import { describe, it, expect } from 'vitest';
import { masterAssetRegistry } from '@/content/config/masterAssetRegistry';
import { ASSET_TYPES } from '@/content/config/constants';

describe('Stage 4: Production Master Asset Registry', () => {
  describe('Registry Structure', () => {
    it('should have all required asset types', () => {
      expect(masterAssetRegistry[ASSET_TYPES.ROOT]).toBeDefined();
      expect(masterAssetRegistry[ASSET_TYPES.ENVIRONMENT]).toBeDefined();
      expect(masterAssetRegistry[ASSET_TYPES.NODE]).toBeDefined();
      expect(masterAssetRegistry[ASSET_TYPES.PACKAGE]).toBeDefined();
      expect(masterAssetRegistry[ASSET_TYPES.PACKAGE_KEY]).toBeDefined();
      expect(masterAssetRegistry[ASSET_TYPES.OPTION]).toBeDefined();
      expect(masterAssetRegistry[ASSET_TYPES.NAMESPACE_FOLDER]).toBeDefined();
    });

    it('should have PerspectiveOverrides structure for all perspective-aware properties', () => {
      Object.entries(masterAssetRegistry).forEach(([assetType, def]) => {
        expect(def.label).toHaveProperty('default');
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

    it('should have all assets visible by default', () => {
      Object.entries(masterAssetRegistry).forEach(([assetType, def]) => {
        expect(def.isVisibleInExplorer.default).toBe(true);
      });
    });
  });

  describe('Backward Compatibility', () => {
    it('should have same default labels as original registry', () => {
      expect(masterAssetRegistry[ASSET_TYPES.ROOT].label.default).toBe('Root');
      expect(masterAssetRegistry[ASSET_TYPES.ENVIRONMENT].label.default).toBe('Environment');
      expect(masterAssetRegistry[ASSET_TYPES.NODE].label.default).toBe('Node');
      expect(masterAssetRegistry[ASSET_TYPES.PACKAGE].label.default).toBe('Package');
      expect(masterAssetRegistry[ASSET_TYPES.PACKAGE_KEY].label.default).toBe('Package Requirement');
      expect(masterAssetRegistry[ASSET_TYPES.OPTION].label.default).toBe('Option');
      expect(masterAssetRegistry[ASSET_TYPES.NAMESPACE_FOLDER].label.default).toBe('Namespace Folder');
    });

    it('should have same icons as original registry', () => {
      expect(masterAssetRegistry[ASSET_TYPES.ROOT].icon.default).toBe('mdi-file-tree');
      expect(masterAssetRegistry[ASSET_TYPES.ENVIRONMENT].icon.default).toBe('mdi-earth');
      expect(masterAssetRegistry[ASSET_TYPES.NODE].icon.default).toBe('mdi-server');
      expect(masterAssetRegistry[ASSET_TYPES.PACKAGE].icon.default).toBe('mdi-package-variant');
      expect(masterAssetRegistry[ASSET_TYPES.PACKAGE_KEY].icon.default).toBe('mdi-link-variant');
      expect(masterAssetRegistry[ASSET_TYPES.OPTION].icon.default).toBe('mdi-cog');
      expect(masterAssetRegistry[ASSET_TYPES.NAMESPACE_FOLDER].icon.default).toBe('mdi-folder');
    });

    it('should preserve all non-perspective properties', () => {
      const envDef = masterAssetRegistry[ASSET_TYPES.ENVIRONMENT];
      expect(envDef.validChildren).toContain(ASSET_TYPES.NODE);
      expect(envDef.isCreatableAtRoot).toBe(true);
      expect(envDef.creationModes).toContain('simple');
      expect(envDef.isRenameable).toBe(true);
      expect(envDef.isDeletable).toBe(true);
      expect(envDef.isShownInStats).toBe(true);
    });

    it('should preserve structural folder flags', () => {
      expect(masterAssetRegistry[ASSET_TYPES.ROOT].isStructuralFolder).toBe(true);
      expect(masterAssetRegistry[ASSET_TYPES.ENVIRONMENT].isStructuralFolder).toBe(false);
      expect(masterAssetRegistry[ASSET_TYPES.NAMESPACE_FOLDER].isStructuralFolder).toBe(true);
    });

    it('should preserve post-clone fixup hooks', () => {
      const envDef = masterAssetRegistry[ASSET_TYPES.ENVIRONMENT];
      expect(envDef.postCloneFixup).toBeDefined();
      expect(typeof envDef.postCloneFixup).toBe('function');
      
      const nodeDef = masterAssetRegistry[ASSET_TYPES.NODE];
      expect(nodeDef.postCloneFixup).toBeDefined();
    });

    it('should preserve virtual folder providers', () => {
      const envDef = masterAssetRegistry[ASSET_TYPES.ENVIRONMENT];
      expect(envDef.virtualFolderProviders).toBeDefined();
      expect(Array.isArray(envDef.virtualFolderProviders)).toBe(true);
    });

    it('should preserve initial overrides', () => {
      const packageDef = masterAssetRegistry[ASSET_TYPES.PACKAGE];
      expect(packageDef.initialOverrides).toBeDefined();
      expect(packageDef.initialOverrides?.Files).toBeDefined();
    });
  });

  describe('Helper Functions', () => {
    it('should retrieve asset registration correctly', () => {
      const rootDef = masterAssetRegistry[ASSET_TYPES.ROOT];
      const envDef = masterAssetRegistry[ASSET_TYPES.ENVIRONMENT];
      
      expect(rootDef).toBeDefined();
      expect(rootDef.label.default).toBe('Root');
      
      expect(envDef).toBeDefined();
      expect(envDef.label.default).toBe('Environment');
    });

    it('should retrieve valid child types correctly', () => {
      const rootChildren = masterAssetRegistry[ASSET_TYPES.ROOT].validChildren;
      expect(rootChildren).toContain(ASSET_TYPES.ENVIRONMENT);
      expect(rootChildren).toContain(ASSET_TYPES.NODE);
      
      const envChildren = masterAssetRegistry[ASSET_TYPES.ENVIRONMENT].validChildren;
      expect(envChildren).toContain(ASSET_TYPES.NODE);
      expect(envChildren).toContain(ASSET_TYPES.PACKAGE);
    });
  });
});

