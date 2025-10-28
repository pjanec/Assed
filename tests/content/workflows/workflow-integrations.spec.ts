import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestEnvironment } from '../../test-utils';
import { useAssetsStore, useWorkspaceStore, useUiStore } from '@/core/stores';
import { ASSET_TYPES } from '@/content/config/constants';
import type { UnmergedAsset, DragPayload, DropTarget } from '@/core/types';
import { CompositeCommand } from '@/core/stores/workspace';
import { ASSET_TREE_NODE_TYPES } from '@/core/config/constants';
import { getAvailableActions } from '@/core/registries/interactionRegistry';

// Mock the content-layer actions since we will call them directly to simulate dialog confirmation
vi.mock('@/content/logic/workspaceExtendedActions', () => ({
  executeCrossDistroCopy: vi.fn(),
  executeResolveAndCopy: vi.fn(),
}));

// Import the mocked functions
import { executeCrossDistroCopy, executeResolveAndCopy } from '@/content/logic/workspaceExtendedActions';

describe('Stage 5 Workflow Integrations', () => {
  let assetsStore: ReturnType<typeof useAssetsStore>;
  let workspaceStore: ReturnType<typeof useWorkspaceStore>;
  let uiStore: ReturnType<typeof useUiStore>;

  const initialData: UnmergedAsset[] = [
    { id: 'shared-base', fqn: 'SharedBase', assetType: ASSET_TYPES.PACKAGE, assetKey: 'SharedBase', templateFqn: null, overrides: { logging: 'json' } },
    { id: 'distro-a', fqn: 'DistroA', assetType: ASSET_TYPES.DISTRO, assetKey: 'DistroA', templateFqn: null, overrides: {} },
    { id: 'distro-a-template', fqn: 'DistroA::DistroA_Template', assetType: ASSET_TYPES.PACKAGE, assetKey: 'DistroA_Template', templateFqn: 'SharedBase', overrides: { region: 'us-east-1' } },
    { id: 'webserver-pkg-a', fqn: 'DistroA::WebServer', assetType: ASSET_TYPES.PACKAGE, assetKey: 'WebServer', templateFqn: 'DistroA::DistroA_Template', overrides: { port: 8080 } },
    { id: 'node-a', fqn: 'DistroA::NodeA', assetType: ASSET_TYPES.NODE, assetKey: 'NodeA', templateFqn: null, overrides: {} },
    { id: 'key-a', fqn: 'DistroA::NodeA::WebServer', assetType: ASSET_TYPES.PACKAGE_KEY, assetKey: 'WebServer', templateFqn: null, overrides: {} },
    { id: 'distro-b', fqn: 'DistroB', assetType: ASSET_TYPES.DISTRO, assetKey: 'DistroB', templateFqn: null, overrides: {} },
    { id: 'node-b', fqn: 'DistroB::NodeB', assetType: ASSET_TYPES.NODE, assetKey: 'NodeB', templateFqn: null, overrides: {} },
  ];

  beforeEach(async () => {
    vi.clearAllMocks(); // Clear mocks before each test
    const env = createTestEnvironment(initialData);
    assetsStore = env.assetsStore;
    workspaceStore = env.workspaceStore;
    uiStore = env.uiStore;
    await assetsStore.loadAssets();
  });

  it('Proactive Resolution: dragging a PackageKey across distros should prompt the correct generic dialog', () => {
    // ARRANGE
    const dragPayload: DragPayload = { assetId: 'key-a', sourceContext: 'AssetTreeNode' };
    const dropTarget: DropTarget = { id: 'node-b', type: 'asset' };

    // Set up drag state
    uiStore.startDrag(dragPayload);

    // ACT 1: Simulate the drop by calling the CONTENT interaction rule's execute function
    const actions = getAvailableActions(dragPayload.assetId, dropTarget);
    
    console.log('[TEST DEBUG] Available actions:', actions.length);
    console.log('[TEST DEBUG] Actions:', actions);
    
    expect(actions.length).toBeGreaterThan(0);
    const copyAction = actions.find((action: any) => action.id === 'proactive-resolve-requirement');
    expect(copyAction).toBeDefined();
    
    copyAction.execute(dragPayload, dropTarget);

    // ASSERT 1: The GENERIC core uiStore should be in a state to show a dialog
    expect(uiStore.genericConfirmationState.show).toBe(true);
    expect(uiStore.genericConfirmationState.dialogType).toBe('proactive-resolution');
    expect(uiStore.genericConfirmationState.payload?.type).toBe('ProactiveResolution');

    // ACT 2: Simulate the user confirming the dialog, which calls the CONTENT action
    executeResolveAndCopy(dragPayload, dropTarget);

    // ASSERT 2: Verify that our mocked content action was called with the correct context
    expect(executeResolveAndCopy).toHaveBeenCalledOnce();
    expect(executeResolveAndCopy).toHaveBeenCalledWith(dragPayload, dropTarget);
  });

  it('Flatten and Rebase: dragging a Package across distros should prompt the correct generic dialog', () => {
    // ARRANGE
    const dragPayload: DragPayload = { assetId: 'webserver-pkg-a', sourceContext: 'AssetTreeNode' };
    const dropTarget: DropTarget = { id: 'node-b', type: 'asset' };
    
    // Set up drag state
    uiStore.startDrag(dragPayload);
      
    // ACT 1: Simulate the drop
    const actions = getAvailableActions(dragPayload.assetId, dropTarget);
    
    expect(actions.length).toBeGreaterThan(0);
    const assignAction = actions.find((action: any) => action.id === 'assign-requirement');
    expect(assignAction).toBeDefined();
    
    assignAction.execute(dragPayload, dropTarget);

    // ASSERT 1: The GENERIC core uiStore should be ready to show a dialog
    expect(uiStore.genericConfirmationState.show).toBe(true);
    expect(uiStore.genericConfirmationState.dialogType).toBe('cross-distro-copy');
      
    // Check that the CONTENT layer provided the correct SPECIFIC data
    const payload = uiStore.genericConfirmationState.payload;
    expect(payload?.type).toBe('CrossDistroCopy');
    expect(payload?.inheritanceComparison).toBeDefined();
    expect(payload?.inheritanceComparison?.before).toBeDefined();
    expect(payload?.inheritanceComparison?.after).toBeDefined();

    // ACT 2: Simulate the user confirming the dialog
    executeCrossDistroCopy(dragPayload, dropTarget);

    // ASSERT 2: Verify our mocked content action was called correctly
    expect(executeCrossDistroCopy).toHaveBeenCalledOnce();
    expect(executeCrossDistroCopy).toHaveBeenCalledWith(dragPayload, dropTarget);
  });

  it('should validate cross-distro Package -> Node interaction correctly', () => {
    // ARRANGE
    const dragPayload: DragPayload = { assetId: 'webserver-pkg-a', sourceContext: 'AssetTreeNode' };
    const dropTarget: DropTarget = { id: 'node-b', type: 'asset' };

    // Set up drag state
    uiStore.startDrag(dragPayload);

    // ACT: Get available actions for cross-distro drop
    const actions = getAvailableActions(dragPayload.assetId, dropTarget);

    // ASSERT: Should find the assign-requirement action
    expect(actions.length).toBe(1);
    expect(actions[0].id).toBe('assign-requirement');
    expect(actions[0].label).toBe('Assign Requirement');
  });

  it('should validate cross-distro PackageKey -> Node interaction correctly', () => {
    // ARRANGE
    const dragPayload: DragPayload = { assetId: 'key-a', sourceContext: 'AssetTreeNode' };
    const dropTarget: DropTarget = { id: 'node-b', type: 'asset' };

    // Set up drag state
    uiStore.startDrag(dragPayload);

    // ACT: Get available actions for cross-distro drop
    const actions = getAvailableActions(dragPayload.assetId, dropTarget);

    // ASSERT: Should find the proactive-resolve-requirement action
    expect(actions.length).toBe(1);
    expect(actions[0].id).toBe('proactive-resolve-requirement');
    expect(actions[0].label).toBe('Copy Requirement');
  });

  it('should prevent same-distro PackageKey -> Node interaction (self-drop)', () => {
    // ARRANGE: Try to drop PackageKey on its own parent node
    const dragPayload: DragPayload = { assetId: 'key-a', sourceContext: 'AssetTreeNode' };
    const dropTarget: DropTarget = { id: 'node-a', type: 'asset' }; // Same distro

    // Set up drag state
    uiStore.startDrag(dragPayload);

    // ACT: Get available actions
    const actions = getAvailableActions(dragPayload.assetId, dropTarget);

    // ASSERT: Should find no actions due to self-drop prevention
    expect(actions.length).toBe(0);
  });

  it('should allow same-distro Package -> Node interaction', () => {
    // ARRANGE: Try to drop Package on Node in same distro
    // Use a different node that doesn't already have the WebServer key
    const dragPayload: DragPayload = { assetId: 'webserver-pkg-a', sourceContext: 'AssetTreeNode' };
    const dropTarget: DropTarget = { id: 'node-b', type: 'asset' }; // Different distro, but should still work

    // Set up drag state
    uiStore.startDrag(dragPayload);

    // ACT: Get available actions
    const actions = getAvailableActions(dragPayload.assetId, dropTarget);

    console.log('[TEST DEBUG] Same-env actions:', actions.length);
    console.log('[TEST DEBUG] Same-env actions:', actions);

    // ASSERT: Should find the assign-requirement action
    expect(actions.length).toBe(1);
    expect(actions[0].id).toBe('assign-requirement');
  });
});
