import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestEnvironment, withUndoRedo } from '../../test-utils';
import { useAssetsStore, useWorkspaceStore, useUiStore } from '@/core/stores';
import { ASSET_TYPES } from '@/content/config/constants';
import type { UnmergedAsset } from '@/core/types';
import { generatePropertiesDiff } from '@/core/utils/diff';
import { UpdateAssetCommand } from '@/core/stores/workspace';

describe('Stage 6 Workflow: Reset Overrides', () => {
  let assetsStore: ReturnType<typeof useAssetsStore>;
  let workspaceStore: ReturnType<typeof useWorkspaceStore>;
  let uiStore: ReturnType<typeof useUiStore>;

  // SCENARIO: An asset with local overrides will have its overrides cleared.
  const initialData: UnmergedAsset[] = [
    {
      id: 'template-1',
      fqn: 'BaseTemplate',
      assetType: ASSET_TYPES.PACKAGE,
      assetKey: 'BaseTemplate',
      templateFqn: null,
      overrides: { port: 80, logging: 'standard' },
    },
    {
      id: 'asset-with-overrides',
      fqn: 'MyWebService',
      assetType: ASSET_TYPES.PACKAGE,
      assetKey: 'MyWebService',
      templateFqn: 'BaseTemplate',
      overrides: { port: 8080, ssl: true }, // These are the overrides to be cleared
    },
  ];

  beforeEach(async () => {
    const env = createTestEnvironment(initialData);
    assetsStore = env.assetsStore;
    workspaceStore = env.workspaceStore;
    uiStore = env.uiStore;
    await assetsStore.loadAssets();
  });

  it('should prompt for confirmation with a correct diff of removed properties', () => {
    // ARRANGE: Get the asset we want to modify
    // Use assetsWithOverrides to get the full asset data with overrides preserved
    const assetToReset = assetsStore.assetsWithOverrides.find(a => a.id === 'asset-with-overrides');
    expect(assetToReset).toBeDefined();
    expect(Object.keys(assetToReset!.overrides || {})).toHaveLength(2);

    // ACT: Simulate the user clicking the "Clear Local Overrides" button
    // This involves calculating the diff and calling the uiStore action.
    const changes = generatePropertiesDiff(assetToReset!.overrides, {});
    uiStore.promptForClearOverrides({ asset: assetToReset!, changes });

    // ASSERT: The UI store should now be in the correct state to show the dialog
    expect(uiStore.clearOverridesDialog.show).toBe(true);
    expect(uiStore.clearOverridesDialog.asset?.id).toBe('asset-with-overrides');
      
    // Verify the diff is correct and only shows removed properties
    const dialogChanges = uiStore.clearOverridesDialog.changes;
    expect(dialogChanges).toHaveLength(2);
    expect(dialogChanges.every(c => c.type === 'REMOVED')).toBe(true);
    expect(dialogChanges.find(c => c.path === 'port')?.oldValue).toBe(8080);
    expect(dialogChanges.find(c => c.path === 'ssl')?.oldValue).toBe(true);
  });

  it('should execute a command to clear overrides upon confirmation', () => {
    // ARRANGE: Set up the dialog state as if the user has already clicked the button
    const assetToReset = assetsStore.assetsWithOverrides.find(a => a.id === 'asset-with-overrides')!;
    const changes = generatePropertiesDiff(assetToReset.overrides, {});
    uiStore.promptForClearOverrides({ asset: assetToReset, changes });

    // ACT: Simulate the user confirming the dialog
    workspaceStore.executeClearOverrides(assetToReset.id);
    uiStore.clearActionStates();

    // ASSERT: The dialog is closed and the workspace has the correct pending change
    expect(uiStore.clearOverridesDialog.show).toBe(false);
    expect(workspaceStore.pendingChanges.upserted.has('asset-with-overrides')).toBe(true);

    const updatedAsset = workspaceStore.pendingChanges.upserted.get('asset-with-overrides');
    expect(updatedAsset?.overrides).toEqual({}); // The overrides are now an empty object

    // Verify it's an undoable command
    expect(workspaceStore.undoStack).toHaveLength(1);
    expect(workspaceStore.undoStack[0]).toBeInstanceOf(UpdateAssetCommand);
  });

  it('should correctly undo and redo the "Clear Overrides" action', async () => {
    // ARRANGE
    const assetId = 'asset-with-overrides';
    const assetToReset = assetsStore.assetsWithOverrides.find(a => a.id === assetId)!;

    // Use the withUndoRedo harness to test the entire command lifecycle
    await withUndoRedo(workspaceStore, () => {
      // The action to test is executing the clear overrides command
      workspaceStore.executeClearOverrides(assetId);
    });

    // Final state check (after undo and redo)
    const finalState = workspaceStore.pendingChanges.upserted.get(assetId);
    expect(finalState?.overrides).toEqual({});
  });
});
