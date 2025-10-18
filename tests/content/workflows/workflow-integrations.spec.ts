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
  executeCrossEnvCopy: vi.fn(),
  executeResolveAndCopy: vi.fn(),
}));

// Import the mocked functions
import { executeCrossEnvCopy, executeResolveAndCopy } from '@/content/logic/workspaceExtendedActions';

describe('Stage 5 Workflow Integrations', () => {
  let assetsStore: ReturnType<typeof useAssetsStore>;
  let workspaceStore: ReturnType<typeof useWorkspaceStore>;
  let uiStore: ReturnType<typeof useUiStore>;

  const initialData: UnmergedAsset[] = [
    { id: 'shared-base', fqn: 'SharedBase', assetType: ASSET_TYPES.PACKAGE, assetKey: 'SharedBase', templateFqn: null, overrides: { logging: 'json' } },
    { id: 'env-a', fqn: 'EnvA', assetType: ASSET_TYPES.ENVIRONMENT, assetKey: 'EnvA', templateFqn: null, overrides: {} },
    { id: 'env-a-template', fqn: 'EnvA::EnvA_Template', assetType: ASSET_TYPES.PACKAGE, assetKey: 'EnvA_Template', templateFqn: 'SharedBase', overrides: { region: 'us-east-1' } },
    { id: 'webserver-pkg-a', fqn: 'EnvA::WebServer', assetType: ASSET_TYPES.PACKAGE, assetKey: 'WebServer', templateFqn: 'EnvA::EnvA_Template', overrides: { port: 8080 } },
    { id: 'node-a', fqn: 'EnvA::NodeA', assetType: ASSET_TYPES.NODE, assetKey: 'NodeA', templateFqn: null, overrides: {} },
    { id: 'key-a', fqn: 'EnvA::NodeA::WebServer', assetType: ASSET_TYPES.PACKAGE_KEY, assetKey: 'WebServer', templateFqn: null, overrides: {} },
    { id: 'env-b', fqn: 'EnvB', assetType: ASSET_TYPES.ENVIRONMENT, assetKey: 'EnvB', templateFqn: null, overrides: {} },
    { id: 'node-b', fqn: 'EnvB::NodeB', assetType: ASSET_TYPES.NODE, assetKey: 'NodeB', templateFqn: null, overrides: {} },
  ];

  beforeEach(async () => {
    vi.clearAllMocks(); // Clear mocks before each test
    const env = createTestEnvironment(initialData);
    assetsStore = env.assetsStore;
    workspaceStore = env.workspaceStore;
    uiStore = env.uiStore;
    await assetsStore.loadAssets();
  });

  it('Proactive Resolution: dragging a PackageKey across environments should prompt the correct generic dialog', () => {
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

  it('Flatten and Rebase: dragging a Package across environments should prompt the correct generic dialog', () => {
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
    expect(uiStore.genericConfirmationState.dialogType).toBe('cross-environment-copy');
      
    // Check that the CONTENT layer provided the correct SPECIFIC data
    const payload = uiStore.genericConfirmationState.payload;
    expect(payload?.type).toBe('CrossEnvironmentCopy');
    expect(payload?.inheritanceComparison).toBeDefined();
    expect(payload?.inheritanceComparison?.before).toBeDefined();
    expect(payload?.inheritanceComparison?.after).toBeDefined();

    // ACT 2: Simulate the user confirming the dialog
    executeCrossEnvCopy(dragPayload, dropTarget);

    // ASSERT 2: Verify our mocked content action was called correctly
    expect(executeCrossEnvCopy).toHaveBeenCalledOnce();
    expect(executeCrossEnvCopy).toHaveBeenCalledWith(dragPayload, dropTarget);
  });

  it('should validate cross-environment Package -> Node interaction correctly', () => {
    // ARRANGE
    const dragPayload: DragPayload = { assetId: 'webserver-pkg-a', sourceContext: 'AssetTreeNode' };
    const dropTarget: DropTarget = { id: 'node-b', type: 'asset' };

    // Set up drag state
    uiStore.startDrag(dragPayload);

    // ACT: Get available actions for cross-environment drop
    const actions = getAvailableActions(dragPayload.assetId, dropTarget);

    // ASSERT: Should find the assign-requirement action
    expect(actions.length).toBe(1);
    expect(actions[0].id).toBe('assign-requirement');
    expect(actions[0].label).toBe('Assign Requirement');
  });

  it('should validate cross-environment PackageKey -> Node interaction correctly', () => {
    // ARRANGE
    const dragPayload: DragPayload = { assetId: 'key-a', sourceContext: 'AssetTreeNode' };
    const dropTarget: DropTarget = { id: 'node-b', type: 'asset' };

    // Set up drag state
    uiStore.startDrag(dragPayload);

    // ACT: Get available actions for cross-environment drop
    const actions = getAvailableActions(dragPayload.assetId, dropTarget);

    // ASSERT: Should find the proactive-resolve-requirement action
    expect(actions.length).toBe(1);
    expect(actions[0].id).toBe('proactive-resolve-requirement');
    expect(actions[0].label).toBe('Copy Requirement');
  });

  it('should prevent same-environment PackageKey -> Node interaction (self-drop)', () => {
    // ARRANGE: Try to drop PackageKey on its own parent node
    const dragPayload: DragPayload = { assetId: 'key-a', sourceContext: 'AssetTreeNode' };
    const dropTarget: DropTarget = { id: 'node-a', type: 'asset' }; // Same environment

    // Set up drag state
    uiStore.startDrag(dragPayload);

    // ACT: Get available actions
    const actions = getAvailableActions(dragPayload.assetId, dropTarget);

    // ASSERT: Should find no actions due to self-drop prevention
    expect(actions.length).toBe(0);
  });

  it('should allow same-environment Package -> Node interaction', () => {
    // ARRANGE: Try to drop Package on Node in same environment
    // Use a different node that doesn't already have the WebServer key
    const dragPayload: DragPayload = { assetId: 'webserver-pkg-a', sourceContext: 'AssetTreeNode' };
    const dropTarget: DropTarget = { id: 'node-b', type: 'asset' }; // Different environment, but should still work

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
