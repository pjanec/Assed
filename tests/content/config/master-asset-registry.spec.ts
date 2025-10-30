import { describe, it, expect } from 'vitest';
import { masterAssetRegistry } from '@/content/config/masterAssetRegistry';
import { ASSET_TYPES } from '@/content/config/constants';

describe('Stage 4: Production Master Asset Registry', () => {
  describe('Registry Structure', () => {
    it('should have all required asset types', () => {
      expect(masterAssetRegistry[ASSET_TYPES.ROOT]).toBeDefined();
      expect(masterAssetRegistry[ASSET_TYPES.DISTRO]).toBeDefined();
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
      expect(masterAssetRegistry[ASSET_TYPES.DISTRO].label.default).toBe('Distro');
      expect(masterAssetRegistry[ASSET_TYPES.NODE].label.default).toBe('Node');
      expect(masterAssetRegistry[ASSET_TYPES.PACKAGE].label.default).toBe('Package');
      expect(masterAssetRegistry[ASSET_TYPES.PACKAGE_KEY].label.default).toBe('Package Requirement');
      expect(masterAssetRegistry[ASSET_TYPES.OPTION].label.default).toBe('Option');
      expect(masterAssetRegistry[ASSET_TYPES.NAMESPACE_FOLDER].label.default).toBe('Namespace Folder');
    });

    it('should have expected default icons per current registry', () => {
      expect(masterAssetRegistry[ASSET_TYPES.ROOT].icon.default).toBe('mdi-file-tree');
      expect(masterAssetRegistry[ASSET_TYPES.DISTRO].icon.default).toBe('mdi-application-brackets');
      expect(masterAssetRegistry[ASSET_TYPES.NODE].icon.default).toBe('mdi-server');
      expect(masterAssetRegistry[ASSET_TYPES.PACKAGE].icon.default).toBe('mdi-package-variant');
      expect(masterAssetRegistry[ASSET_TYPES.PACKAGE_KEY].icon.default).toBe('mdi-package-variant');
      expect(masterAssetRegistry[ASSET_TYPES.OPTION].icon.default).toBe('mdi-cog');
      expect(masterAssetRegistry[ASSET_TYPES.NAMESPACE_FOLDER].icon.default).toBe('mdi-folder');
    });

    it('should preserve all non-perspective properties', () => {
      const distroDef = masterAssetRegistry[ASSET_TYPES.DISTRO];
      expect(distroDef.validChildren).toContain(ASSET_TYPES.NODE);
      expect(distroDef.isCreatableAtRoot).toBe(true);
      expect(distroDef.creationModes).toContain('simple');
      expect(distroDef.isRenameable).toBe(true);
      expect(distroDef.isDeletable).toBe(true);
      expect(distroDef.isShownInStats).toBe(true);
    });

    it('should preserve structural folder flags', () => {
      expect(masterAssetRegistry[ASSET_TYPES.ROOT].isStructuralFolder).toBe(true);
      expect(masterAssetRegistry[ASSET_TYPES.DISTRO].isStructuralFolder).toBe(false);
      expect(masterAssetRegistry[ASSET_TYPES.NAMESPACE_FOLDER].isStructuralFolder).toBe(true);
    });

    it('should preserve post-clone fixup hooks', () => {
      const distroDef = masterAssetRegistry[ASSET_TYPES.DISTRO];
      expect(distroDef.postCloneFixup).toBeDefined();
      expect(typeof distroDef.postCloneFixup).toBe('function');
      
      const nodeDef = masterAssetRegistry[ASSET_TYPES.NODE];
      expect(nodeDef.postCloneFixup).toBeDefined();
    });

    it('should preserve virtual folder providers', () => {
      const distroDef = masterAssetRegistry[ASSET_TYPES.DISTRO];
      expect(distroDef.virtualFolderProviders).toBeDefined();
      expect(Array.isArray(distroDef.virtualFolderProviders)).toBe(true);
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
      const distroDef = masterAssetRegistry[ASSET_TYPES.DISTRO];
      
      expect(rootDef).toBeDefined();
      expect(rootDef.label.default).toBe('Root');
      
      expect(distroDef).toBeDefined();
      expect(distroDef.label.default).toBe('Distro');
    });

    it('should retrieve valid child types correctly', () => {
      const rootChildren = masterAssetRegistry[ASSET_TYPES.ROOT].validChildren;
      expect(rootChildren).toContain(ASSET_TYPES.DISTRO);
      expect(rootChildren).toContain(ASSET_TYPES.NODE);
      
      const distroChildren = masterAssetRegistry[ASSET_TYPES.DISTRO].validChildren;
      expect(distroChildren).toContain(ASSET_TYPES.NODE);
      expect(distroChildren).toContain(ASSET_TYPES.PACKAGE);
    });
  });
});

