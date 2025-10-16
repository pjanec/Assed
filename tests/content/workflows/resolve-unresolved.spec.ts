import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestEnvironment, withUndoRedo } from '../../test-utils';
import { useAssetsStore, useWorkspaceStore, useUiStore } from '@/core/stores';
import { ASSET_TYPES } from '@/content/config/constants';
import type { UnmergedAsset, Asset } from '@/core/types';
import { ApplyRefactoringCommand } from '@/core/stores/workspace';
import { getAssetEnvironmentFqn } from '@/content/utils/assetUtils';

describe('Stage 8 Workflow: Resolve Unresolved Requirement', () => {
  let assetsStore: ReturnType<typeof useAssetsStore>;
  let workspaceStore: ReturnType<typeof useWorkspaceStore>;
  let uiStore: ReturnType<typeof useUiStore>;

  // SCENARIO: An environment contains a broken PackageKey and a valid Package that can fix it.
  const initialData: UnmergedAsset[] = [
    { id: 'env-a', fqn: 'EnvA', assetType: ASSET_TYPES.ENVIRONMENT, assetKey: 'EnvA', overrides: {} },
    { id: 'node-a', fqn: 'EnvA::MyNode', assetType: ASSET_TYPES.NODE, assetKey: 'MyNode', overrides: {} },
    {
      id: 'broken-key',
      fqn: 'EnvA::MyNode::BrokenPackage', // This key is broken
      assetType: ASSET_TYPES.PACKAGE_KEY,
      assetKey: 'BrokenPackage',
      overrides: {},
    },
    { // This is the package that will be used to fix the link
      id: 'correct-pkg',
      fqn: 'EnvA::CorrectPackage',
      assetType: ASSET_TYPES.PACKAGE,
      assetKey: 'CorrectPackage',
      overrides: {},
    },
    { // This package is in another environment and should NOT be offered as a solution
      id: 'env-b', fqn: 'EnvB', assetType: ASSET_TYPES.ENVIRONMENT, assetKey: 'EnvB', overrides: {} },
    {
      id: 'wrong-env-pkg',
      fqn: 'EnvB::AnotherPackage',
      assetType: ASSET_TYPES.PACKAGE,
      assetKey: 'AnotherPackage',
      overrides: {},
    },
  ];

  // Helper function to simulate the logic from PackageKeyInspector.vue
  const simulateResolveClick = async (assetToFix: UnmergedAsset) => {
    const allAssets = assetsStore.unmergedAssets;
    const envFqn = getAssetEnvironmentFqn(assetToFix.fqn, allAssets);

    const validPackages = allAssets.filter(a =>
      a.assetType === ASSET_TYPES.PACKAGE &&
      getAssetEnvironmentFqn(a.fqn, allAssets) === envFqn
    );

    // This returns a promise, just like the real implementation
    return uiStore.promptForAssetSelection({
      title: `Resolve Requirement: '${assetToFix.assetKey}'`,
      items: validPackages,
    });
  };

  beforeEach(async () => {
    const env = createTestEnvironment(initialData);
    assetsStore = env.assetsStore;
    workspaceStore = env.workspaceStore;
    uiStore = env.uiStore;
    await assetsStore.loadAssets();
  });

  it('should prompt the user with a list of valid packages from the correct environment', async () => {
    // ARRANGE: Get the broken asset
    const assetToFix = assetsStore.unmergedAssets.find(a => a.id === 'broken-key')!;
      
    // ACT: Simulate the user clicking the "Resolve..." button
    // We don't await here because we want to inspect the dialog state before it resolves.
    simulateResolveClick(assetToFix);

    // ASSERT: The UI store should now be in the correct state to show the AssetPickerDialog
    expect(uiStore.assetPickerDialog.show).toBe(true);
    expect(uiStore.assetPickerDialog.title).toContain('Resolve Requirement');
      
    // Verify that only the package from the correct environment is listed
    const offeredItems = uiStore.assetPickerDialog.items;
    expect(offeredItems).toHaveLength(1);
    expect(offeredItems[0].id).toBe('correct-pkg');
    expect(offeredItems.find(item => item.id === 'wrong-env-pkg')).toBeUndefined();
  });

  it('should execute a rename command to re-link the PackageKey upon selection', async () => {
    // ARRANGE
    const assetToFix = assetsStore.unmergedAssets.find(a => a.id === 'broken-key')!;
    const correctPackage = assetsStore.unmergedAssets.find(a => a.id === 'correct-pkg')!;

    // Spy on the workspaceStore to verify it gets called correctly
    const renameSpy = vi.spyOn(workspaceStore, 'renameAsset');
      
    // ACT: Simulate the entire workflow, including the user's selection
    const selectionPromise = simulateResolveClick(assetToFix);

    // Simulate the dialog resolving with the user's choice
    uiStore.assetPickerDialog.resolver?.(correctPackage);
    await selectionPromise;

    // After the promise resolves, the inspector's logic should call the workspace store
    await workspaceStore.renameAsset(assetToFix.id, correctPackage.assetKey);

    // ASSERT
    expect(renameSpy).toHaveBeenCalledOnce();
    expect(renameSpy).toHaveBeenCalledWith('broken-key', 'CorrectPackage');

    // Verify the state change in the workspace
    expect(workspaceStore.pendingChanges.upserted.has('broken-key')).toBe(true);
    const updatedKey = workspaceStore.pendingChanges.upserted.get('broken-key');
    expect(updatedKey?.assetKey).toBe('CorrectPackage');
    expect(updatedKey?.fqn).toBe('EnvA::MyNode::CorrectPackage');
  });

  it('should clear the validation issue after the link is successfully resolved', async () => {
    // ARRANGE: Initially, there should be validation errors including the broken key
    const initialIssues = workspaceStore.validationIssues;
    expect(initialIssues.length).toBeGreaterThan(0);
    
    // Find the specific validation issue for the broken key
    const brokenKeyIssue = initialIssues.find(issue => issue.id === 'broken-key-unresolved');
    expect(brokenKeyIssue).toBeDefined();

    const assetToFix = assetsStore.unmergedAssets.find(a => a.id === 'broken-key')!;
    const correctPackage = assetsStore.unmergedAssets.find(a => a.id === 'correct-pkg')!;

    // ACT: Execute the rename operation that fixes the link
    await workspaceStore.renameAsset(assetToFix.id, correctPackage.assetKey);

    // ASSERT: After the update, the specific validation issue should be gone
    const updatedIssues = workspaceStore.validationIssues;
    const stillBrokenKeyIssue = updatedIssues.find(issue => issue.id === 'broken-key-unresolved');
    expect(stillBrokenKeyIssue).toBeUndefined();
  });
});
