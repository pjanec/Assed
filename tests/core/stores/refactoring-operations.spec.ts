// File: tests/core/stores/refactoring-operations.spec.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { createTestEnvironment } from '../../test-utils';
import { useAssetsStore, useWorkspaceStore, useUiStore } from '@/core/stores';
import { MOCK_ASSET_TYPES } from '../../mock-content/mockAssetRegistry';
import type { UnmergedAsset } from '@/core/types';
import { CreateAssetCommand, CloneAssetCommand } from '@/core/stores/workspace';
import { REFACTOR_MODES } from '@/core/config/constants';

describe('Core Refactoring: Rename with Ripple Effects', () => {
  let assetsStore: ReturnType<typeof useAssetsStore>;
  let workspaceStore: ReturnType<typeof useWorkspaceStore>;
  let uiStore: ReturnType<typeof useUiStore>;

  // SCENARIO: ContainerA is both a parent (to ChildWidget) and a template (for DependentWidget).
  // Renaming it should trigger both FQN updates and template link updates.
  const initialData: UnmergedAsset[] = [
    {
      id: 'container-a', fqn: 'ContainerA', assetType: MOCK_ASSET_TYPES.CONTAINER as any,
      assetKey: 'ContainerA', templateFqn: null, overrides: {},
    },
    {
      id: 'child-widget', fqn: 'ContainerA::ChildWidget', assetType: MOCK_ASSET_TYPES.WIDGET as any,
      assetKey: 'ChildWidget', templateFqn: null, overrides: {},
    },
    {
      id: 'dependent-widget', fqn: 'DependentWidget', assetType: MOCK_ASSET_TYPES.CONTAINER as any,
      assetKey: 'DependentWidget', templateFqn: 'ContainerA', overrides: {}, // Depends on ContainerA
    },
  ];

  beforeEach(async () => {
    const env = createTestEnvironment(initialData);
    assetsStore = env.assetsStore;
    workspaceStore = env.workspaceStore;
    uiStore = env.uiStore;
    await assetsStore.loadAssets();
  });

  it('should calculate and apply combined FQN and template link updates', async () => {
    // ACT 1: Initiate the rename, which should trigger the confirmation dialog
    await workspaceStore.renameAsset('container-a', 'RenamedContainer');

    // ASSERT 1: The UI store should now hold the state for the confirmation dialog
    expect(uiStore.refactorConfirmationState).not.toBeNull();
    expect(uiStore.refactorConfirmationState?.show).toBe(true);
    expect(uiStore.refactorConfirmationState?.mode).toBe(REFACTOR_MODES.RENAME);

    const consequences = uiStore.refactorConfirmationState!.consequences;
    expect(consequences.fqnUpdates).toHaveLength(1); // For ChildWidget
    expect(consequences.fqnUpdates[0].newFqn).toBe('RenamedContainer::ChildWidget');
    expect(consequences.templateLinkUpdates).toHaveLength(1); // For DependentWidget
    expect(consequences.templateLinkUpdates[0].newTemplateFqn).toBe('RenamedContainer');

    // ACT 2: Simulate the user confirming the refactor
    workspaceStore.confirmRefactor(uiStore.refactorConfirmationState!);

    // ASSERT 2: The workspace should now contain all the pending changes
    const pendingUpserts = workspaceStore.pendingChanges.upserted;
    expect(pendingUpserts.size).toBe(3);

    const renamedContainer = pendingUpserts.get('container-a');
    const updatedChild = pendingUpserts.get('child-widget');
    const updatedDependent = pendingUpserts.get('dependent-widget');

    expect(renamedContainer?.assetKey).toBe('RenamedContainer');
    expect(renamedContainer?.fqn).toBe('RenamedContainer');
    expect(updatedChild?.fqn).toBe('RenamedContainer::ChildWidget');
    expect(updatedDependent?.templateFqn).toBe('RenamedContainer');
  });
});

describe('Core Refactoring: Delete with Blocking Dependencies', () => {
  let assetsStore: ReturnType<typeof useAssetsStore>;
  let workspaceStore: ReturnType<typeof useWorkspaceStore>;
  let uiStore: ReturnType<typeof useUiStore>;

  const initialData: UnmergedAsset[] = [
    {
      id: 'template-widget', fqn: 'TemplateWidget', assetType: MOCK_ASSET_TYPES.WIDGET as any,
      assetKey: 'TemplateWidget', templateFqn: null, overrides: {},
    },
    {
      id: 'my-widget', fqn: 'MyWidget', assetType: MOCK_ASSET_TYPES.WIDGET as any,
      assetKey: 'MyWidget', templateFqn: 'TemplateWidget', overrides: {}, // Depends on TemplateWidget
    },
  ];

  beforeEach(async () => {
    const env = createTestEnvironment(initialData);
    assetsStore = env.assetsStore;
    workspaceStore = env.workspaceStore;
    uiStore = env.uiStore;
    await assetsStore.loadAssets();
  });

  it('should block the deletion of an asset used as a template', () => {
    // ACT: Attempt to delete the asset that is a dependency
    workspaceStore.requestAssetDeletion('template-widget');

    // ASSERT: The deletion should be blocked and the appropriate dialog state set
    expect(uiStore.deleteBlockedDialog.show).toBe(true);
    expect(uiStore.deleteBlockedDialog.asset?.id).toBe('template-widget');
    expect(uiStore.deleteBlockedDialog.impact.blockingDependencies).toHaveLength(1);
    expect(uiStore.deleteBlockedDialog.impact.blockingDependencies[0].id).toBe('my-widget');

    // Verify that no deletion command was actually executed
    expect(workspaceStore.pendingChanges.deleted.size).toBe(0);
  });
});

describe('Core Refactoring: Clone with Internal Template Links', () => {
  let assetsStore: ReturnType<typeof useAssetsStore>;
  let workspaceStore: ReturnType<typeof useWorkspaceStore>;

  // SCENARIO: ContainerA has two children, WidgetX and WidgetY.
  // WidgetY's template points to WidgetX *within the same parent*.
  // When we clone ContainerA, the new WidgetY_clone must point to WidgetX_clone, not the original.
  const initialData: UnmergedAsset[] = [
    {
      id: 'container-a', fqn: 'ContainerA', assetType: MOCK_ASSET_TYPES.CONTAINER as any,
      assetKey: 'ContainerA', templateFqn: null, overrides: {},
    },
    {
      id: 'widget-x', fqn: 'ContainerA::WidgetX', assetType: MOCK_ASSET_TYPES.WIDGET as any,
      assetKey: 'WidgetX', templateFqn: null, overrides: {},
    },
    {
      id: 'widget-y', fqn: 'ContainerA::WidgetY', assetType: MOCK_ASSET_TYPES.WIDGET as any,
      assetKey: 'WidgetY', templateFqn: 'ContainerA::WidgetX', overrides: {}, // Internal link
    },
  ];

  beforeEach(async () => {
    const env = createTestEnvironment(initialData);
    assetsStore = env.assetsStore;
    workspaceStore = env.workspaceStore;
    await assetsStore.loadAssets();
  });

  it('should correctly re-map internal templateFqn links during a deep clone', () => {
    // ARRANGE: The data is set up in the `beforeEach` hook.

    // ACT: Execute a clone command on the parent container
    const cloneCommand = new CloneAssetCommand('container-a', null, 'ClonedContainerA');
    workspaceStore.executeCommand(cloneCommand);

    // ASSERT: Check the newly created assets in pending changes
    const pendingUpserts = workspaceStore.pendingChanges.upserted;
    expect(pendingUpserts.size).toBe(3); // The parent and its two children

    const clonedContainer = Array.from(pendingUpserts.values()).find(a => a.assetKey === 'ClonedContainerA');
    const clonedWidgetX = Array.from(pendingUpserts.values()).find(a => a.fqn === 'ClonedContainerA::WidgetX');
    const clonedWidgetY = Array.from(pendingUpserts.values()).find(a => a.fqn === 'ClonedContainerA::WidgetY');

    expect(clonedContainer).toBeDefined();
    expect(clonedWidgetX).toBeDefined();
    expect(clonedWidgetY).toBeDefined();

    // The critical assertion:
    // The new WidgetY's templateFqn should point to the FQN of the new WidgetX, not the original.
    expect(clonedWidgetY?.templateFqn).toBe('ClonedContainerA::WidgetX');
  });
});
