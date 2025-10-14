// File: tests/core/stores/complex-inheritance.spec.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { createTestEnvironment } from '../../test-utils';
import { useAssetsStore, useWorkspaceStore } from '@/core/stores';
import { CreateAssetCommand } from '@/core/stores/workspace';
import { MOCK_ASSET_TYPES, mockAssetRegistry } from '../../mock-content/mockAssetRegistry';
import type { UnmergedAsset } from '@/core/types';
import { resolveInheritedCollection } from '@/core/utils/inheritanceUtils';

// 1. Define the complete set of source assets for the test scenario
const initialData: UnmergedAsset[] = [
  // --- LEVEL 3 (Base Node Template) ---
  {
    id: 'node-template-base',
    fqn: 'TemplateNode',
    assetType: MOCK_ASSET_TYPES.CONTAINER as any,
    assetKey: 'TemplateNode',
    templateFqn: null,
    overrides: {},
  },
  {
    id: 'pkg-webservice',
    fqn: 'TemplateNode::WebServicePackage',
    assetType: MOCK_ASSET_TYPES.WIDGET as any,
    assetKey: 'WebServicePackage',
    templateFqn: null,
    overrides: { version: '1.0' },
  },

  // --- LEVEL 2 (Environment Template, which inherits from LEVEL 3) ---
  {
    id: 'env-template-e1',
    fqn: 'E1',
    assetType: MOCK_ASSET_TYPES.CONTAINER as any,
    assetKey: 'E1',
    templateFqn: null,
    overrides: {},
  },
  {
    id: 'node-n1-in-e1',
    fqn: 'E1::N1',
    assetType: MOCK_ASSET_TYPES.CONTAINER as any,
    assetKey: 'N1',
    templateFqn: 'TemplateNode', // This node inherits from the base node template
    overrides: {},
  },
  {
    id: 'pkg-config',
    fqn: 'E1::N1::ConfigPackage', // This package is specific to this intermediate template
    assetType: MOCK_ASSET_TYPES.WIDGET as any,
    assetKey: 'ConfigPackage',
    templateFqn: null,
    overrides: { setting: 'alpha' },
  },
];

describe('Complex Multi-Level Inheritance', () => {
  let assetsStore: ReturnType<typeof useAssetsStore>;
  let workspaceStore: ReturnType<typeof useWorkspaceStore>;

  beforeEach(async () => {
    // Use the existing test utility to set up a clean environment for each test
    const env = createTestEnvironment(initialData);
    assetsStore = env.assetsStore;
    workspaceStore = env.workspaceStore;
    await assetsStore.loadAssets();
  });

  it('should correctly assemble children from a multi-level template chain with local overrides', () => {
    // ARRANGE: Follow the workflow from the design document to create the final state

    // Step 1: Create E2, inheriting from E1
    const e2Asset = {
      assetType: MOCK_ASSET_TYPES.CONTAINER as any,
      assetKey: 'E2',
      fqn: 'E2',
      templateFqn: 'E1', // E2 inherits from E1
      overrides: {},
    };
    const e2Command = new CreateAssetCommand(e2Asset);
    workspaceStore.executeCommand(e2Command);
    const E2 = e2Command.newAsset;

    // Step 2: Create the explicit override node E2::N1
    const n2Asset = {
      assetType: MOCK_ASSET_TYPES.CONTAINER as any,
      assetKey: 'N1', // Key matches the node in E1, "shadowing" it
      fqn: 'E2::N1',
      templateFqn: 'E1::N1', // This override node inherits from the intermediate template
      overrides: {},
    };
    const n2Command = new CreateAssetCommand(n2Asset);
    workspaceStore.executeCommand(n2Command);
    const N2 = n2Command.newAsset;

    // Step 3: Add a new, local-only package B under the override node
    const bAsset = {
      assetType: MOCK_ASSET_TYPES.WIDGET as any,
      assetKey: 'PackageB',
      fqn: 'E2::N1::PackageB',
      templateFqn: null,
      overrides: { local: true },
    };
    const bCommand = new CreateAssetCommand(bAsset);
    workspaceStore.executeCommand(bCommand);
    const B = bCommand.newAsset;

    // ACT: Run the Resolution Engine on the final override node (N2)
    // We get the final state of N2 from the pending changes
    const finalN2State = workspaceStore.pendingChanges.upserted.get(N2.id);
    expect(finalN2State).toBeDefined();

    const mergedPackages = resolveInheritedCollection(
      finalN2State!,
      MOCK_ASSET_TYPES.WIDGET as any,
      assetsStore.unmergedAssets, // Use the live, combined list of assets
      mockAssetRegistry
    );

    // ASSERT: Check that the final collection is correct
    expect(mergedPackages).toHaveLength(3);

    const packageKeys = mergedPackages.map(p => p.assetKey).sort();
    expect(packageKeys).toEqual([
      'ConfigPackage',     // From the intermediate template (E1::N1)
      'PackageB',          // The local override
      'WebServicePackage', // From the base template (TemplateNode)
    ]);

    // Further verification of override precedence
    // Let's add an override for WebServicePackage and re-run
    const b2Asset = {
      assetType: MOCK_ASSET_TYPES.WIDGET as any,
      assetKey: 'WebServicePackage', // Key matches the one in TemplateNode
      fqn: 'E2::N1::WebServicePackage',
      templateFqn: null,
      overrides: { version: '2.0-custom' }, // Override the version
    };
    workspaceStore.executeCommand(new CreateAssetCommand(b2Asset));

    const finalMergedPackages = resolveInheritedCollection(
      finalN2State!,
      MOCK_ASSET_TYPES.WIDGET as any,
      assetsStore.unmergedAssets,
      mockAssetRegistry
    );

    expect(finalMergedPackages).toHaveLength(3); // Count should be the same
    const overriddenPackage = finalMergedPackages.find(p => p.assetKey === 'WebServicePackage');
    expect(overriddenPackage).toBeDefined();
    expect(overriddenPackage?.overrides.version).toBe('2.0-custom'); // The local override should win
  });
});
