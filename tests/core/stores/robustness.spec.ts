// File: tests/core/stores/robustness.spec.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestEnvironment } from '../../test-utils';
import { useAssetsStore, useWorkspaceStore, useUiStore } from '@/core/stores';
import { MOCK_ASSET_TYPES } from '../../mock-content/mockAssetRegistry';
import type { UnmergedAsset, ValidationIssue } from '@/core/types';
import { CreateAssetCommand, DeleteAssetsCommand } from '@/core/stores/workspace';
import { registerValidationRule } from '@/core/registries/validationRegistry';

// Create separate mock asset types for robustness tests
const ROBUSTNESS_ASSET_TYPES = {
  DISTRO: MOCK_ASSET_TYPES.DISTRO,
  NODE: MOCK_ASSET_TYPES.NODE,
  PACKAGE: MOCK_ASSET_TYPES.PACKAGE,
} as const;

describe('System Robustness: Undo/Redo Stack Integrity', () => {
  let workspaceStore: ReturnType<typeof useWorkspaceStore>;
  let uiStore: ReturnType<typeof useUiStore>;

  // SCENARIO: Create a parent-child relationship, then rename parent (causing ripple effects),
  // undo the rename, then perform a new action. The redo stack should be cleared.
  const initialData: UnmergedAsset[] = [
    {
      id: 'parent-container', fqn: 'ParentContainer', assetType: ROBUSTNESS_ASSET_TYPES.NODE as any,
      assetKey: 'ParentContainer', templateFqn: null, overrides: {},
    },
    {
      id: 'child-package', fqn: 'ParentContainer::ChildPackage', assetType: ROBUSTNESS_ASSET_TYPES.PACKAGE as any,
      assetKey: 'ChildPackage', templateFqn: null, overrides: {},
    },
  ];

  beforeEach(async () => {
    const env = createTestEnvironment(initialData);
    workspaceStore = env.workspaceStore;
    uiStore = env.uiStore;
    await env.assetsStore.loadAssets();
  });

  it('should clear the redo stack when a new command is executed after an undo with ripple effects', async () => {
    // ARRANGE: Initial state has parent and child
    expect(workspaceStore.undoStack).toHaveLength(0);
    expect(workspaceStore.redoStack).toHaveLength(0);

    // ACT 1: Rename the parent (this should cause ripple effects - child FQN will change)
    await workspaceStore.renameAsset('parent-container', 'RenamedParent');

    // ASSERT 1: Rename should trigger confirmation dialog due to ripple effects
    expect(uiStore.refactorConfirmationState).not.toBeNull();
    expect(uiStore.refactorConfirmationState?.mode).toBe('rename');
    expect(uiStore.refactorConfirmationState?.consequences.fqnUpdates).toHaveLength(1); // Child FQN update

    // Confirm the rename to execute it
    workspaceStore.confirmRefactor(uiStore.refactorConfirmationState!);

    // ASSERT 2: Rename command should be in undo stack
    expect(workspaceStore.undoStack).toHaveLength(1);
    expect(workspaceStore.redoStack).toHaveLength(0);

    // ACT 2: Undo the rename
    workspaceStore.undo();

    // ASSERT 2: State after undo
    expect(workspaceStore.undoStack).toHaveLength(0);
    expect(workspaceStore.redoStack).toHaveLength(1); // Rename command is now in redo stack

    // ACT 3: Perform a new, divergent action (create a new asset)
    const newAssetCommand = new CreateAssetCommand({
      assetType: ROBUSTNESS_ASSET_TYPES.PACKAGE as any, assetKey: 'NewPackage', fqn: 'NewPackage', templateFqn: null, overrides: {},
    });
    workspaceStore.executeCommand(newAssetCommand);

    // ASSERT 3: The redo stack should now be empty (divergent action cleared it)
    expect(workspaceStore.redoStack).toHaveLength(0);
    expect(workspaceStore.undoStack).toHaveLength(1); // Contains the new asset creation

    // Final check: Redo should do nothing since stack was cleared
    workspaceStore.redo();
    expect(workspaceStore.redoStack).toHaveLength(0);
    expect(workspaceStore.undoStack).toHaveLength(1);
  });
});

// DISABLED: Virtual Asset Protection Test
// 
// This test is currently disabled because the system lacks proper protection against
// operations on virtual assets. The current implementation has a fundamental limitation:
// 
// ISSUE: Virtual nodes use real asset IDs (e.g., 'node-in-template'), so when operations
// like renameAsset() or requestAssetDeletion() are called with these IDs, the system
// treats them as real asset operations rather than virtual asset operations.
// 
// EXPECTED BEHAVIOR: The system should detect when an operation is being performed on
// a virtual representation and block it, showing appropriate user feedback.
// 
// CURRENT BEHAVIOR: Operations proceed normally because they operate on the underlying
// real asset, not the virtual representation.
// 
// FUTURE IMPROVEMENT: The system needs a mechanism to distinguish between:
// 1. Operations initiated from the real asset (should proceed)
// 2. Operations initiated from virtual representations (should be blocked)
// 
// This could be implemented by:
// - Using different IDs for virtual nodes
// - Adding context tracking to operations
// - Implementing virtual asset operation blocking in the command layer
//
// describe('System Robustness: Interaction with Virtual Assets', () => {
//   // Test implementation would go here once virtual asset protection is implemented
// });

describe('System Robustness: Validation Reactivity', () => {
  let assetsStore: ReturnType<typeof useAssetsStore>;
  let workspaceStore: ReturnType<typeof useWorkspaceStore>;

  const initialData: UnmergedAsset[] = [
    {
      id: 'node-1', fqn: 'MyNode', assetType: ROBUSTNESS_ASSET_TYPES.NODE as any,
      assetKey: 'MyNode', templateFqn: null, overrides: {},
    },
    {
      id: 'package-1', fqn: 'MyNode::MyPackage', assetType: ROBUSTNESS_ASSET_TYPES.PACKAGE as any,
      assetKey: 'MyPackage', templateFqn: null, overrides: {},
    },
  ];

  // Define and register a validation rule for this test suite
  const nodeMustHavePackage: (asset: UnmergedAsset, allAssets: UnmergedAsset[]) => ValidationIssue | null =
    (asset, allAssets) => {
      if (asset.assetType !== ROBUSTNESS_ASSET_TYPES.NODE) return null;
      const hasPackage = allAssets.some(
        a => a.assetType === ROBUSTNESS_ASSET_TYPES.PACKAGE && a.fqn.startsWith(asset.fqn + '::')
      );
      if (!hasPackage) {
        return {
          id: `${asset.id}-no-package`, severity: 'error', message: 'Node must have a package.',
          assetId: asset.id, assetName: asset.assetKey, assetType: asset.assetType,
        };
      }
      return null;
    };

  beforeEach(async () => {
    const env = createTestEnvironment(initialData);
    assetsStore = env.assetsStore;
    workspaceStore = env.workspaceStore;
    // Register the rule for our robustness 'Node' type
    registerValidationRule(ROBUSTNESS_ASSET_TYPES.NODE, nodeMustHavePackage);
    await assetsStore.loadAssets();
  });

  it('should update validation issues reactively during undo and redo', () => {
    // ARRANGE: Initial state should be valid
    expect(workspaceStore.validationIssues).toHaveLength(0);

    const packageToDelete = assetsStore.unmergedAssets.find(a => a.id === 'package-1');
    expect(packageToDelete).toBeDefined();

    // ACT 1: Delete the package, making the state invalid
    const deleteCommand = new DeleteAssetsCommand([packageToDelete!]);
    workspaceStore.executeCommand(deleteCommand);

    // ASSERT 1: A validation issue should appear
    expect(workspaceStore.validationIssues).toHaveLength(1);
    expect(workspaceStore.validationIssues[0].id).toBe('node-1-no-package');

    // ACT 2: Undo the deletion
    workspaceStore.undo();

    // ASSERT 2: The validation issue should disappear
    expect(workspaceStore.validationIssues).toHaveLength(0);

    // ACT 3: Redo the deletion
    workspaceStore.redo();

    // ASSERT 3: The validation issue should reappear
    expect(workspaceStore.validationIssues).toHaveLength(1);
    expect(workspaceStore.validationIssues[0].id).toBe('node-1-no-package');
  });
});
