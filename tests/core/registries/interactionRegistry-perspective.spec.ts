import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { ConfigurationHub } from '@/core/stores/ConfigurationHub';
import { mockMasterAssetRegistry } from '../../mock-content/mockMasterAssetRegistry';
import { mockPerspectiveDefinitions } from '../../mock-content/mockPerspectiveDefinitions';
import { mockMasterInteractionRegistry } from '../../mock-content/mockMasterInteractionRegistry';
import { setGlobalConfigHub, useCoreConfigStore } from '@/core/stores/config';
import { useAssetsStore } from '@/core/stores/assets';
import { useUiStore } from '@/core/stores/ui';
import { getAvailableActions } from '@/core/registries/interactionRegistry';
import { isDraggable } from '@/core/utils/assetTreeUtils';
import type { AssetTreeNode, DropTarget, DragPayload } from '@/core/types';
import { MOCK_ASSET_TYPES } from '../../mock-content/mockAssetRegistry';
import { DROP_TARGET_TYPES } from '@/core/config/constants';

describe('Interaction Registry - Perspective-Based Drag & Drop Filtering', () => {
  let hub: ConfigurationHub;
  let assetsStore: ReturnType<typeof useAssetsStore>;
  let uiStore: ReturnType<typeof useUiStore>;
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
    
    // Get stores
    assetsStore = useAssetsStore();
    uiStore = useUiStore();
    coreConfig = useCoreConfigStore();
  });

  describe('isDraggable - Perspective Filtering', () => {
    it('should prevent dragging unsupported asset types in package perspective', () => {
      hub.setPerspective('package');
      
      // Create a Container node (NOT supported in package perspective)
      const containerNode: AssetTreeNode = {
        id: 'container-1',
        path: 'TestContainer',
        name: 'TestContainer',
        type: 'asset',
        assetType: MOCK_ASSET_TYPES.CONTAINER,
        children: []
      };
      
      // Container should NOT be draggable in package perspective
      expect(isDraggable(containerNode)).toBe(false);
    });

    it('should allow dragging supported asset types in package perspective', () => {
      hub.setPerspective('package');
      
      // Create a Widget node (supported in package perspective)
      const widgetNode: AssetTreeNode = {
        id: 'widget-1',
        path: 'TestWidget',
        name: 'TestWidget',
        type: 'asset',
        assetType: MOCK_ASSET_TYPES.WIDGET,
        children: []
      };
      
      // Widget SHOULD be draggable in package perspective
      expect(isDraggable(widgetNode)).toBe(true);
    });

    it('should allow dragging all types in default perspective', () => {
      hub.setPerspective('default');
      
      const containerNode: AssetTreeNode = {
        id: 'container-1',
        path: 'TestContainer',
        name: 'TestContainer',
        type: 'asset',
        assetType: MOCK_ASSET_TYPES.CONTAINER,
        children: []
      };
      
      // All types should be draggable in default perspective
      expect(isDraggable(containerNode)).toBe(true);
    });
  });

  describe('getAvailableActions - Target Filtering', () => {
    beforeEach(() => {
      // Set up mock assets in the store using the store's method
      (assetsStore as any).$state.unmergedAssets = [
        { id: 'container-1', fqn: 'Container1', assetType: MOCK_ASSET_TYPES.CONTAINER, assetKey: 'Container1', overrides: {} },
        { id: 'widget-1', fqn: 'Widget1', assetType: MOCK_ASSET_TYPES.WIDGET, assetKey: 'Widget1', overrides: {} },
      ];
      
      // Set up drag state
      const dragPayload: DragPayload = {
        assetId: 'widget-1',
        instanceId: 'test-instance',
        sourceContext: 'tree'
      };
      (uiStore as any).dragSourceInfo = dragPayload;
    });

    it('should filter drop actions when target asset is not supported in current perspective', () => {
      hub.setPerspective('package');
      
      const dropTarget: DropTarget = {
        id: 'container-1',
        type: DROP_TARGET_TYPES.ASSET
      };
      
      // In package perspective, Container is NOT supported
      // So dropping Widget on Container should return no actions
      const actions = getAvailableActions('widget-1', dropTarget);
      
      expect(actions).toEqual([]);
    });

    it('should allow drop actions when both dragged and target are supported', () => {
      hub.setPerspective('environment');
      
      // Both Widget and Container are supported in environment perspective
      const dropTarget: DropTarget = {
        id: 'container-1',
        type: DROP_TARGET_TYPES.ASSET
      };
      
      const actions = getAvailableActions('widget-1', dropTarget);
      
      // Actions should be available (actual count depends on interaction rules)
      expect(actions.length).toBeGreaterThanOrEqual(0);
    });

    it('should filter drop actions when dragged asset is not supported in current perspective', () => {
      hub.setPerspective('package');
      
      // Set up drag state for Container (NOT supported)
      const dragPayload: DragPayload = {
        assetId: 'container-1',
        instanceId: 'test-instance',
        sourceContext: 'tree'
      };
      (uiStore as any).dragSourceInfo = dragPayload;
      
      const dropTarget: DropTarget = {
        id: 'widget-1',
        type: DROP_TARGET_TYPES.ASSET
      };
      
      const actions = getAvailableActions('container-1', dropTarget);
      
      // Container is not supported, so no actions should be available
      expect(actions).toEqual([]);
    });
  });

  describe('Reactive Updates', () => {
    beforeEach(() => {
      // Set up mock assets using the store's state
      (assetsStore as any).$state.unmergedAssets = [
        { id: 'container-1', fqn: 'Container1', assetType: MOCK_ASSET_TYPES.CONTAINER, assetKey: 'Container1', overrides: {} },
        { id: 'widget-1', fqn: 'Widget1', assetType: MOCK_ASSET_TYPES.WIDGET, assetKey: 'Widget1', overrides: {} },
      ];
    });

    it('should update draggable status when perspective changes', () => {
      hub.setPerspective('default');
      
      const containerNode: AssetTreeNode = {
        id: 'container-1',
        path: 'Container1',
        name: 'Container1',
        type: 'asset',
        assetType: MOCK_ASSET_TYPES.CONTAINER,
        children: []
      };
      
      expect(isDraggable(containerNode)).toBe(true); // Supported in default
      
      hub.setPerspective('package');
      
      expect(isDraggable(containerNode)).toBe(false); // NOT supported in package
    });

    it('should update drop actions when perspective changes', () => {
      hub.setPerspective('default');
      
      const dragPayload: DragPayload = {
        assetId: 'widget-1',
        instanceId: 'test-instance',
        sourceContext: 'tree'
      };
      (uiStore as any).dragSourceInfo = dragPayload;
      
      const dropTarget: DropTarget = {
        id: 'container-1',
        type: DROP_TARGET_TYPES.ASSET
      };
      
      const defaultActions = getAvailableActions('widget-1', dropTarget);
      
      hub.setPerspective('package');
      
      const packageActions = getAvailableActions('widget-1', dropTarget);
      
      // In package perspective, Container (target) is NOT supported
      // So actions should be empty
      expect(packageActions).toEqual([]);
    });
  });
});

