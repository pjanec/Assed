import { describe, it, expect, beforeEach } from 'vitest';
import { createTestEnvironment } from '../../../test-utils';
import { ASSET_TYPES } from '../../../../src/content/config/constants';
import { getAvailableActions } from '../../../../src/core/registries/interactionRegistry';
import type { UnmergedAsset } from '../../../../src/core/types';
import type { DragPayload, DropTarget } from '../../../../src/core/types/drag-drop';

describe('Package Assignment Interactions', () => {
  let assetsStore: any;
  let uiStore: any;

  // Test data setup
  const environment: UnmergedAsset = {
    id: 'env-1',
    fqn: 'TestEnv',
    assetType: ASSET_TYPES.ENVIRONMENT,
    assetKey: 'TestEnv',
    templateFqn: null,
    overrides: {}
  };

  const sourceNode: UnmergedAsset = {
    id: 'node-1',
    fqn: 'TestEnv::SourceNode',
    assetType: ASSET_TYPES.NODE,
    assetKey: 'SourceNode',
    templateFqn: null,
    overrides: {}
  };

  const targetNode: UnmergedAsset = {
    id: 'node-2',
    fqn: 'TestEnv::TargetNode',
    assetType: ASSET_TYPES.NODE,
    assetKey: 'TargetNode',
    templateFqn: null,
    overrides: {}
  };

  const packageKey: UnmergedAsset = {
    id: 'pkg-key-1',
    fqn: 'TestEnv::SourceNode::react',
    assetType: ASSET_TYPES.PACKAGE_KEY,
    assetKey: 'react',
    templateFqn: null,
    overrides: {}
  };

  const initialData: UnmergedAsset[] = [
    environment,
    sourceNode,
    targetNode,
    packageKey
  ];

  beforeEach(async () => {
    const env = createTestEnvironment(initialData);
    assetsStore = env.assetsStore;
    uiStore = env.uiStore;
    await assetsStore.loadAssets();
  });

  it('should find available actions for PackageKey -> Node drag and drop', () => {
    // Setup drag payload
    const dragPayload: DragPayload = {
      assetId: packageKey.id,
      sourceContext: 'ASSET_TREE_NODE',
      instanceId: 'test-instance'
    };

    // Setup drop target
    const dropTarget: DropTarget = {
      id: targetNode.id,
      type: 'asset'
    };

    // Set the drag source info in the UI store
    uiStore.startDrag(dragPayload);

    // Get available actions
    const actions = getAvailableActions(packageKey.id, dropTarget);

    console.log('[TEST DEBUG] Available actions:', actions);
    console.log('[TEST DEBUG] Actions count:', actions.length);
    
    if (actions.length > 0) {
      console.log('[TEST DEBUG] First action:', actions[0]);
    }

    // The test should find at least one action (copy-requirement)
    expect(actions.length).toBeGreaterThan(0);
    
    const copyAction = actions.find(action => action.id === 'copy-requirement');
    expect(copyAction).toBeDefined();
    expect(copyAction?.label).toBe('Copy Requirement');
  });

  it('should validate PackageKey -> Node interaction correctly', () => {
    // Setup drag payload
    const dragPayload: DragPayload = {
      assetId: packageKey.id,
      sourceContext: 'ASSET_TREE_NODE',
      instanceId: 'test-instance'
    };

    // Setup drop target
    const dropTarget: DropTarget = {
      id: targetNode.id,
      type: 'asset'
    };

    // Set the drag source info in the UI store
    uiStore.startDrag(dragPayload);

    // Get available actions
    const actions = getAvailableActions(packageKey.id, dropTarget);

    console.log('[TEST DEBUG] Validation test - Available actions:', actions.length);

    // Should find the copy-requirement action
    const copyAction = actions.find(action => action.id === 'copy-requirement');
    expect(copyAction).toBeDefined();

    // The action should be enabled
    if (copyAction?.isEnabled) {
      const isEnabled = copyAction.isEnabled(dragPayload, dropTarget);
      console.log('[TEST DEBUG] Action enabled:', isEnabled);
      expect(isEnabled).toBe(true);
    }
  });

  it('should prevent duplicate PackageKey creation', () => {
    // First, create a PackageKey under the target node
    const existingPackageKey: UnmergedAsset = {
      id: 'pkg-key-2',
      fqn: 'TestEnv::TargetNode::react',
      assetType: ASSET_TYPES.PACKAGE_KEY,
      assetKey: 'react',
      templateFqn: null,
      overrides: {}
    };

    // Add the existing package key to the store
    assetsStore.unmergedAssets.push(existingPackageKey);

    // Setup drag payload
    const dragPayload: DragPayload = {
      assetId: packageKey.id,
      sourceContext: 'ASSET_TREE_NODE',
      instanceId: 'test-instance'
    };

    // Setup drop target
    const dropTarget: DropTarget = {
      id: targetNode.id,
      type: 'asset'
    };

    // Set the drag source info in the UI store
    uiStore.startDrag(dragPayload);

    // Get available actions
    const actions = getAvailableActions(packageKey.id, dropTarget);

    console.log('[TEST DEBUG] Duplicate test - Available actions:', actions.length);

    // Should not find any actions due to duplicate validation
    expect(actions.length).toBe(0);
  });
});
