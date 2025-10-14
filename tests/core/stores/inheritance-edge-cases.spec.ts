// File: tests/core/stores/inheritance-edge-cases.spec.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { createTestEnvironment } from '../../test-utils';
import { useAssetsStore, useWorkspaceStore } from '@/core/stores';
import { MOCK_ASSET_TYPES, mockAssetRegistry } from '../../mock-content/mockAssetRegistry';
import type { UnmergedAsset } from '@/core/types';
import { resolveInheritedCollection } from '@/core/utils/inheritanceUtils';
import { CreateAssetCommand } from '@/core/stores/workspace';

describe('Inheritance Edge Case: The "Leapfrog" Override', () => {
  let assetsStore: ReturnType<typeof useAssetsStore>;
  let workspaceStore: ReturnType<typeof useWorkspaceStore>;

  // SCENARIO: FinalAsset -> IntermediateTemplate -> BaseTemplate
  // BaseTemplate has children A and B.
  // IntermediateTemplate has NO children of its own.
  // FinalAsset has a local override for A.
  // The engine must "leapfrog" the intermediate template to find B.
  const leapfrogData: UnmergedAsset[] = [
    // --- Base Template (has children) ---
    {
      id: 'base-tpl', fqn: 'BaseTemplate', assetType: MOCK_ASSET_TYPES.CONTAINER as any,
      assetKey: 'BaseTemplate', templateFqn: null, overrides: {},
    },
    {
      id: 'pkg-a-base', fqn: 'BaseTemplate::PackageA', assetType: MOCK_ASSET_TYPES.WIDGET as any,
      assetKey: 'PackageA', templateFqn: null, overrides: { version: '1.0' },
    },
    {
      id: 'pkg-b-base', fqn: 'BaseTemplate::PackageB', assetType: MOCK_ASSET_TYPES.WIDGET as any,
      assetKey: 'PackageB', templateFqn: null, overrides: {},
    },

    // --- Intermediate Template (pass-through, no children) ---
    {
      id: 'intermediate-tpl', fqn: 'IntermediateTemplate', assetType: MOCK_ASSET_TYPES.CONTAINER as any,
      assetKey: 'IntermediateTemplate', templateFqn: 'BaseTemplate', overrides: {},
    },
  ];

  beforeEach(async () => {
    const env = createTestEnvironment(leapfrogData);
    assetsStore = env.assetsStore;
    workspaceStore = env.workspaceStore;
    await assetsStore.loadAssets();
  });

  it('should find inherited assets even if an intermediate template has no children', () => {
    // ARRANGE: Create the final asset that inherits from the intermediate template
    const finalAssetCommand = new CreateAssetCommand({
      assetType: MOCK_ASSET_TYPES.CONTAINER as any, assetKey: 'FinalAsset', fqn: 'FinalAsset',
      templateFqn: 'IntermediateTemplate', overrides: {},
    });
    workspaceStore.executeCommand(finalAssetCommand);
    const finalAsset = finalAssetCommand.newAsset;

    // Add a local override for PackageA
    const overrideACommand = new CreateAssetCommand({
      assetType: MOCK_ASSET_TYPES.WIDGET as any, assetKey: 'PackageA', fqn: 'FinalAsset::PackageA',
      templateFqn: null, overrides: { version: '2.0-local' },
    });
    workspaceStore.executeCommand(overrideACommand);

    // ACT: Resolve the collection for the final asset
    const mergedPackages = resolveInheritedCollection(
      finalAsset,
      MOCK_ASSET_TYPES.WIDGET as any,
      assetsStore.unmergedAssets,
      mockAssetRegistry
    );

    // ASSERT: The result should contain the local override AND the leapfrogged package
    expect(mergedPackages).toHaveLength(2);

    const finalPackageA = mergedPackages.find(p => p.assetKey === 'PackageA');
    const finalPackageB = mergedPackages.find(p => p.assetKey === 'PackageB');

    expect(finalPackageA).toBeDefined();
    expect(finalPackageA?.overrides.version).toBe('2.0-local'); // It's the local override

    expect(finalPackageB).toBeDefined(); // It successfully found PackageB from the BaseTemplate
    expect(finalPackageB?.id).toBe('pkg-b-base');
  });
});

describe('Inheritance Edge Case: Circular Dependency', () => {
  let assetsStore: ReturnType<typeof useAssetsStore>;
  let workspaceStore: ReturnType<typeof useWorkspaceStore>;

  // SCENARIO: MyAsset -> TemplateA -> TemplateB -> TemplateA ...
  // The engine must detect the cycle and not crash.
  const circularData: UnmergedAsset[] = [
    {
      id: 'tpl-a', fqn: 'TemplateA', assetType: MOCK_ASSET_TYPES.CONTAINER as any,
      assetKey: 'TemplateA', templateFqn: 'TemplateB', overrides: {}, // Points to B
    },
    {
      id: 'pkg-a-tpl', fqn: 'TemplateA::PackageFromA', assetType: MOCK_ASSET_TYPES.WIDGET as any,
      assetKey: 'PackageFromA', templateFqn: null, overrides: {},
    },
    {
      id: 'tpl-b', fqn: 'TemplateB', assetType: MOCK_ASSET_TYPES.CONTAINER as any,
      assetKey: 'TemplateB', templateFqn: 'TemplateA', overrides: {}, // Points back to A
    },
    {
      id: 'pkg-b-tpl', fqn: 'TemplateB::PackageFromB', assetType: MOCK_ASSET_TYPES.WIDGET as any,
      assetKey: 'PackageFromB', templateFqn: null, overrides: {},
    },
  ];

  beforeEach(async () => {
    const env = createTestEnvironment(circularData);
    assetsStore = env.assetsStore;
    workspaceStore = env.workspaceStore;
    await assetsStore.loadAssets();
  });

  it('should gracefully handle and break a circular template dependency', () => {
    // ARRANGE: Create the final asset that initiates the circular chain
    const myAssetCommand = new CreateAssetCommand({
      assetType: MOCK_ASSET_TYPES.CONTAINER as any, assetKey: 'MyAsset', fqn: 'MyAsset',
      templateFqn: 'TemplateA', overrides: {},
    });
    workspaceStore.executeCommand(myAssetCommand);
    const myAsset = myAssetCommand.newAsset;

    // Add a local package that should be the only result
    const localPackageCommand = new CreateAssetCommand({
      assetType: MOCK_ASSET_TYPES.WIDGET as any, assetKey: 'LocalPackageC', fqn: 'MyAsset::LocalPackageC',
      templateFqn: null, overrides: {},
    });
    workspaceStore.executeCommand(localPackageCommand);

    // ACT: Run the Resolution Engine. This should not throw an error or enter an infinite loop.
    let mergedPackages: UnmergedAsset[] = [];
    expect(() => {
      mergedPackages = resolveInheritedCollection(
        myAsset,
        MOCK_ASSET_TYPES.WIDGET as any,
        assetsStore.unmergedAssets,
        mockAssetRegistry
      );
    }).not.toThrow();

    // ASSERT: The engine should have stopped and returned only the assets it found before the cycle.
    // In this case, it finds the local package C, then TemplateA's package, then TemplateB's package.
    // When it tries to go back to TemplateA, it detects the cycle and stops.
    expect(mergedPackages).toHaveLength(3);

    const packageKeys = mergedPackages.map(p => p.assetKey).sort();
    expect(packageKeys).toEqual([
      'LocalPackageC', // The local override is always found first
      'PackageFromA',  // Found from TemplateA
      'PackageFromB',  // Found from TemplateB
    ]);
  });
});
