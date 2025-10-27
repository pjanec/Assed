// File: tests/core/stores/property-merging-operations.spec.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { createTestEnvironment } from '../../test-utils';
import { useAssetsStore, useWorkspaceStore, useUiStore } from '@/core/stores';
import { MOCK_ASSET_TYPES } from '../../mock-content/mockAssetRegistry';
import type { UnmergedAsset } from '@/core/types';
import { calculateMergedAsset } from '@/core/utils/mergeUtils';
import { DeriveAssetCommand } from '@/core/stores/workspace';

describe('Core Operations: Deep Property Merging', () => {
  let assetsStore: ReturnType<typeof useAssetsStore>;

  // SCENARIO: A three-tier inheritance chain for properties: C -> B -> A.
  // Each level defines a piece of a nested 'conf' object.
  // The final merged result for C should combine all pieces correctly.
  const initialData: UnmergedAsset[] = [
    { // Top-level template
      id: 'tpl-a', fqn: 'TemplateA', assetType: MOCK_ASSET_TYPES.WIDGET as any, assetKey: 'TemplateA',
      templateFqn: null, overrides: { conf: { network: { port: 80, protocol: 'http' } } },
    },
    { // Mid-level template
      id: 'tpl-b', fqn: 'TemplateB', assetType: MOCK_ASSET_TYPES.WIDGET as any, assetKey: 'TemplateB',
      templateFqn: 'TemplateA', overrides: { conf: { network: { ssl: true }, storage: { size: '10GB' } } },
    },
    { // Final asset
      id: 'asset-c', fqn: 'AssetC', assetType: MOCK_ASSET_TYPES.WIDGET as any, assetKey: 'AssetC',
      templateFqn: 'TemplateB', overrides: { conf: { network: { port: 443 } } }, // Overrides port
    },
  ];

  beforeEach(async () => {
    const env = createTestEnvironment(initialData);
    assetsStore = env.assetsStore;
    // Must load assets AND details for merge calculation to work
    await assetsStore.loadAssets();
  });

  it('should correctly merge nested properties from a multi-level template chain', () => {
    // ARRANGE: The data is set up. We need to get the map of all assets.
    const allAssetsMap = new Map<string, UnmergedAsset>();
    assetsStore.assetsWithOverrides.forEach(a => allAssetsMap.set(a.id, a));

    // ACT: Calculate the merged state of the final asset in the chain
    const mergedResult = calculateMergedAsset('asset-c', allAssetsMap);

    // ASSERT: Check that the final properties object is correctly composed
    expect(mergedResult).not.toHaveProperty('error');

    if ('properties' in mergedResult) {
      const props = mergedResult.properties;
      expect(props.conf).toBeDefined();
      expect(props.conf.network).toBeDefined();
      expect(props.conf.storage).toBeDefined();

      // Check properties from TemplateA
      expect(props.conf.network.protocol).toBe('http');
      // Check properties from TemplateB
      expect(props.conf.network.ssl).toBe(true);
      expect(props.conf.storage.size).toBe('10GB');
      // Check the override from AssetC
      expect(props.conf.network.port).toBe(443);
    }
  });
});

describe('Core Operations: Move Operation Integrity', () => {
  let assetsStore: ReturnType<typeof useAssetsStore>;
  let workspaceStore: ReturnType<typeof useWorkspaceStore>;
  let uiStore: ReturnType<typeof useUiStore>;

  // SCENARIO: A parent with a child is moved into a new container.
  // The child's FQN must be updated to reflect the parent's new location.
  const initialData: UnmergedAsset[] = [
    {
      id: 'parent', fqn: 'Parent', assetType: MOCK_ASSET_TYPES.CONTAINER as any,
      assetKey: 'Parent', templateFqn: null, overrides: {},
    },
    {
      id: 'child', fqn: 'Parent::Child', assetType: MOCK_ASSET_TYPES.WIDGET as any,
      assetKey: 'Child', templateFqn: null, overrides: {},
    },
    {
      id: 'new-container', fqn: 'NewContainer', assetType: MOCK_ASSET_TYPES.CONTAINER as any,
      assetKey: 'NewContainer', templateFqn: null, overrides: {},
    },
  ];

  beforeEach(async () => {
    const env = createTestEnvironment(initialData);
    assetsStore = env.assetsStore;
    workspaceStore = env.workspaceStore;
    uiStore = env.uiStore;
    await assetsStore.loadAssets();
  });

  it('should update the FQN of all descendant assets when a parent is moved', async () => {
    // ACT: Move the 'Parent' asset to become a child of 'NewContainer'
    await workspaceStore.moveAsset('parent', 'NewContainer');

    // ASSERT 1: Since there are ripple effects (child FQN change), it should show confirmation dialog
    expect(uiStore.refactorConfirmationState).not.toBeNull();
    expect(uiStore.refactorConfirmationState?.mode).toBe('move');
    expect(uiStore.refactorConfirmationState?.consequences.fqnUpdates).toHaveLength(1); // Child FQN update

    // Confirm the move to execute it
    workspaceStore.confirmRefactor(uiStore.refactorConfirmationState!);

    // ASSERT 2: The workspace should have pending changes for both parent and child
    const pendingUpserts = workspaceStore.pendingChanges.upserted;
    expect(pendingUpserts.size).toBe(2);

    const movedParent = pendingUpserts.get('parent');
    const movedChild = pendingUpserts.get('child');

    expect(movedParent).toBeDefined();
    expect(movedParent?.fqn).toBe('NewContainer::Parent');

    expect(movedChild).toBeDefined();
    expect(movedChild?.fqn).toBe('NewContainer::Parent::Child');
  });
});

describe('Core Operations: Derive Operation Integrity', () => {
  let assetsStore: ReturnType<typeof useAssetsStore>;
  let workspaceStore: ReturnType<typeof useWorkspaceStore>;

  const initialData: UnmergedAsset[] = [
    {
      id: 'shared-tpl', fqn: 'SharedTemplate', assetType: MOCK_ASSET_TYPES.WIDGET as any,
      assetKey: 'SharedTemplate', templateFqn: null, overrides: {},
    },
    {
      id: 'distro-a', fqn: 'DistroA', assetType: MOCK_ASSET_TYPES.DISTRO as any,
      assetKey: 'DistroA', templateFqn: null, overrides: {},
    },
  ];

  beforeEach(async () => {
    const env = createTestEnvironment(initialData);
    assetsStore = env.assetsStore;
    workspaceStore = env.workspaceStore;
    await assetsStore.loadAssets();
  });

  it('should create a new asset with its templateFqn pointing to the source asset', () => {
    // ARRANGE
    const sourceAsset = assetsStore.unmergedAssets.find(a => a.id === 'shared-tpl');
    const targetParentFqn = 'EnvA';
    const newAssetKey = 'MyDerivedWidget';

    expect(sourceAsset).toBeDefined();

    // ACT: Execute the Derive command
    const command = new DeriveAssetCommand(sourceAsset!, targetParentFqn, newAssetKey);
    workspaceStore.executeCommand(command);

    // ASSERT: Check the properties of the newly created asset in pending changes
    const derivedAsset = workspaceStore.pendingChanges.upserted.get(command.derivedAsset.id);

    expect(derivedAsset).toBeDefined();
    expect(derivedAsset?.assetKey).toBe(newAssetKey);
    expect(derivedAsset?.fqn).toBe('EnvA::MyDerivedWidget');

    // This is the critical check for the "Derive" operation
    expect(derivedAsset?.templateFqn).toBe(sourceAsset!.fqn);
    expect(Object.keys(derivedAsset?.overrides || {})).toHaveLength(0); // Derived assets start with no overrides
  });
});
