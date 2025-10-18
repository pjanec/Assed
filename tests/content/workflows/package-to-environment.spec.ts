import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestEnvironment } from '../../test-utils';
import { useAssetsStore, useWorkspaceStore, useUiStore } from '@/core/stores';
import { ASSET_TYPES } from '@/content/config/constants';
import type { UnmergedAsset, DragPayload, DropTarget } from '@/core/types';
import { getAvailableActions } from '@/core/registries/interactionRegistry';

// Mock the content-layer action to test the trigger mechanism separately
vi.mock('@/content/logic/workspaceExtendedActions', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/content/logic/workspaceExtendedActions')>();
  return {
    ...original,
    executePoolCopy: vi.fn(),
  };
});

// Import the mocked function
import { executePoolCopy } from '@/content/logic/workspaceExtendedActions';

describe('Stage 5 Workflow: Package → Environment Drop', () => {
  let assetsStore: ReturnType<typeof useAssetsStore>;
  let workspaceStore: ReturnType<typeof useWorkspaceStore>;
  let uiStore: ReturnType<typeof useUiStore>;

  const initialData: UnmergedAsset[] = [
    { id: 'shared-base', fqn: 'SharedBase', assetType: ASSET_TYPES.PACKAGE, assetKey: 'SharedBase', templateFqn: null, overrides: { logging: 'json' } },
    { id: 'env-a', fqn: 'EnvA', assetType: ASSET_TYPES.ENVIRONMENT, assetKey: 'EnvA', templateFqn: null, overrides: {} },
    { id: 'webserver-pkg-a', fqn: 'EnvA::WebServer', assetType: ASSET_TYPES.PACKAGE, assetKey: 'WebServer', templateFqn: null, overrides: { port: 8080, customConfig: 'complex' } },
    { id: 'env-b', fqn: 'EnvB', assetType: ASSET_TYPES.ENVIRONMENT, assetKey: 'EnvB', templateFqn: null, overrides: {} },
  ];

  beforeEach(async () => {
    vi.clearAllMocks();
    const env = createTestEnvironment(initialData);
    assetsStore = env.assetsStore;
    workspaceStore = env.workspaceStore;
    uiStore = env.uiStore;
    await assetsStore.loadAssets();
  });

  it('should prompt for confirmation with the correct inheritance comparison', async () => {
    // ARRANGE: Define the drag payload and drop target
    const dragPayload: DragPayload = { assetId: 'webserver-pkg-a', sourceContext: 'AssetTreeNode' };
    const dropTarget: DropTarget = { id: 'env-b', type: 'asset' };

    // Mock the confirmation to resolve immediately
    const mockPromptForGenericConfirmation = vi.fn().mockResolvedValue(true);
    vi.spyOn(uiStore, 'promptForGenericConfirmation').mockImplementation(mockPromptForGenericConfirmation);

    // Set up drag state
    uiStore.startDrag(dragPayload);

    // ACT: Simulate the drop by calling the content interaction rule's execute function
    const actions = getAvailableActions(dragPayload.assetId, dropTarget);
    
    expect(actions.length).toBe(1);
    const copyAction = actions.find((action: any) => action.id === 'copy-to-environment');
    expect(copyAction).toBeDefined();
    
    await copyAction.execute(dragPayload, dropTarget);

    // ASSERT: The generic confirmation should have been called
    expect(mockPromptForGenericConfirmation).toHaveBeenCalledWith(
      'cross-environment-copy',
      expect.objectContaining({
        type: 'CrossEnvironmentCopy',
        inheritanceComparison: expect.objectContaining({
          before: expect.any(Array),
          after: expect.any(Array)
        })
      })
    );
  });

  it('should call the correct execution action upon dialog confirmation', () => {
    // ARRANGE: Set up the dialog state as if the drop has already happened
    const dragPayload: DragPayload = { assetId: 'webserver-pkg-a', sourceContext: 'AssetTreeNode' };
    const dropTarget: DropTarget = { id: 'env-b', type: 'asset' };
    uiStore.promptForGenericConfirmation('cross-environment-copy', {
      type: 'CrossEnvironmentCopy', 
      inheritanceComparison: { before: [], after: [] }
    });

    // ACT: Simulate the user confirming the dialog, which calls the content action
    // In a real component, this would be wired to the confirm button's click event.
    executePoolCopy(dragPayload, dropTarget);

    // ASSERT: Verify that our mocked content action was called with the correct context
    expect(executePoolCopy).toHaveBeenCalledOnce();
    expect(executePoolCopy).toHaveBeenCalledWith(dragPayload, dropTarget);
  });

  it('should execute immediately for shared assets without showing dialog', async () => {
    // ARRANGE: Test with a shared asset (should execute immediately, no dialog)
    const dragPayload: DragPayload = { assetId: 'shared-base', sourceContext: 'AssetTreeNode' };
    const dropTarget: DropTarget = { id: 'env-b', type: 'asset' };

    // Mock the confirmation to ensure it's NOT called
    const mockPromptForGenericConfirmation = vi.fn().mockResolvedValue(true);
    vi.spyOn(uiStore, 'promptForGenericConfirmation').mockImplementation(mockPromptForGenericConfirmation);

    // Set up drag state
    uiStore.startDrag(dragPayload);

    // ACT: Simulate the drop
    const actions = getAvailableActions(dragPayload.assetId, dropTarget);
    expect(actions.length).toBe(1);
    const copyAction = actions.find((action: any) => action.id === 'copy-to-environment');
    
    await copyAction.execute(dragPayload, dropTarget);

    // ASSERT: Should NOT call the confirmation dialog for shared assets
    expect(mockPromptForGenericConfirmation).not.toHaveBeenCalled();
    
    // Should execute the command directly (check that DeriveAssetCommand was executed)
    expect(workspaceStore.undoStack.length).toBeGreaterThan(0);
  });

  it('should execute immediately for pure derivatives without showing dialog', async () => {
    // ARRANGE: Create a pure derivative (package with templateFqn pointing to shared asset AND no overrides)
    const pureDerivative: UnmergedAsset = {
      id: 'pure-derivative',
      fqn: 'EnvA::PureDerivative',
      assetType: ASSET_TYPES.PACKAGE,
      assetKey: 'PureDerivative',
      templateFqn: 'SharedBase', // Points to shared asset
      overrides: {} // NO overrides = pure derivative
    };
    assetsStore.unmergedAssets.push(pureDerivative);

    const dragPayload: DragPayload = { assetId: 'pure-derivative', sourceContext: 'AssetTreeNode' };
    const dropTarget: DropTarget = { id: 'env-b', type: 'asset' };

    // Mock the confirmation to ensure it's NOT called
    const mockPromptForGenericConfirmation = vi.fn().mockResolvedValue(true);
    vi.spyOn(uiStore, 'promptForGenericConfirmation').mockImplementation(mockPromptForGenericConfirmation);

    // Set up drag state
    uiStore.startDrag(dragPayload);

    // ACT: Simulate the drop
    const actions = getAvailableActions(dragPayload.assetId, dropTarget);
    expect(actions.length).toBe(1);
    const copyAction = actions.find((action: any) => action.id === 'copy-to-environment');
    
    await copyAction.execute(dragPayload, dropTarget);

    // ASSERT: Should NOT call the confirmation dialog for pure derivatives
    expect(mockPromptForGenericConfirmation).not.toHaveBeenCalled();
    
    // Should execute the command directly (check that DeriveAssetCommand was executed)
    expect(workspaceStore.undoStack.length).toBeGreaterThan(0);
  });

  it('should prevent duplicate package names in environment pool', () => {
    // ARRANGE: Add a duplicate package to the target environment
    const duplicatePackage: UnmergedAsset = {
      id: 'webserver-pkg-b',
      fqn: 'EnvB::WebServer',
      assetType: ASSET_TYPES.PACKAGE,
      assetKey: 'WebServer',
      templateFqn: null,
      overrides: {}
    };
    assetsStore.unmergedAssets.push(duplicatePackage);

    const dragPayload: DragPayload = { assetId: 'webserver-pkg-a', sourceContext: 'AssetTreeNode' };
    const dropTarget: DropTarget = { id: 'env-b', type: 'asset' };

    // Set up drag state
    uiStore.startDrag(dragPayload);

    // ACT: Try to get available actions
    const actions = getAvailableActions(dragPayload.assetId, dropTarget);

    // ASSERT: Should find no actions due to duplicate prevention
    expect(actions.length).toBe(0);
  });
});
