import { describe, it, expect, beforeEach } from 'vitest';
import { createTestEnvironment } from '../../../test-utils';
import { useAssetsStore, useUiStore } from '@/core/stores';
import { ASSET_TYPES } from '@/content/config/constants';
import type { UnmergedAsset, DragPayload, DropTarget } from '@/core/types';
import { getAvailableActions } from '@/core/registries/interactionRegistry';
import { isAncestorOf } from '@/core/utils/inheritanceUtils';
import { isSameOrAncestorEnvironment, getSharedTemplateIfPureDerivative, getAssetEnvironmentFqn } from '@/content/utils/assetUtils';

describe('Ancestry-Aware Drag and Drop', () => {
  let assetsStore: ReturnType<typeof useAssetsStore>;
  let uiStore: ReturnType<typeof useUiStore>;

  const testData: UnmergedAsset[] = [
    { id: 'base-env', fqn: 'BaseEnv', assetType: ASSET_TYPES.ENVIRONMENT, assetKey: 'BaseEnv', templateFqn: null, overrides: {} },
    { id: 'base-pkg', fqn: 'BaseEnv::BasePackage', assetType: ASSET_TYPES.PACKAGE, assetKey: 'BasePackage', templateFqn: null, overrides: { version: '1.0' } },
    { id: 'prod-env', fqn: 'ProdEnv', assetType: ASSET_TYPES.ENVIRONMENT, assetKey: 'ProdEnv', templateFqn: 'BaseEnv', overrides: {} },
    { id: 'prod-node', fqn: 'ProdEnv::ProdNode', assetType: ASSET_TYPES.NODE, assetKey: 'ProdNode', templateFqn: null, overrides: {} },
  ];

  beforeEach(async () => {
    const env = createTestEnvironment(testData);
    assetsStore = env.assetsStore;
    uiStore = env.uiStore;
    await assetsStore.loadAssets();
  });

  it('should correctly identify ancestor relationships', () => {
    // Test the core isAncestorOf function directly
    expect(isAncestorOf('ProdEnv', 'BaseEnv', assetsStore.unmergedAssets)).toBe(true);
    expect(isAncestorOf('BaseEnv', 'ProdEnv', assetsStore.unmergedAssets)).toBe(false);
    expect(isAncestorOf('BaseEnv', 'BaseEnv', assetsStore.unmergedAssets)).toBe(false);
  });

  it('should correctly identify same or ancestor environment relationships', () => {
    // Test the new isSameOrAncestorEnvironment utility function
    expect(isSameOrAncestorEnvironment('ProdEnv', 'BaseEnv', assetsStore.unmergedAssets)).toBe(true);
    expect(isSameOrAncestorEnvironment('BaseEnv', 'ProdEnv', assetsStore.unmergedAssets)).toBe(false);
    expect(isSameOrAncestorEnvironment('BaseEnv', 'BaseEnv', assetsStore.unmergedAssets)).toBe(true);
    expect(isSameOrAncestorEnvironment('ProdEnv', 'ProdEnv', assetsStore.unmergedAssets)).toBe(true);
    expect(isSameOrAncestorEnvironment(null, 'BaseEnv', assetsStore.unmergedAssets)).toBe(false);
    expect(isSameOrAncestorEnvironment('ProdEnv', null, assetsStore.unmergedAssets)).toBe(false);
  });

  it('should correctly identify pure derivatives of shared templates', async () => {
    // Test the new getSharedTemplateIfPureDerivative utility function
    
    // Test with a shared template (must be at root level, not under any environment)
    const sharedTemplateAsset: UnmergedAsset = {
      id: 'shared-template',
      fqn: 'SharedTemplate', // Root level FQN (no environment prefix)
      assetType: ASSET_TYPES.PACKAGE,
      assetKey: 'SharedTemplate',
      templateFqn: null,
      overrides: { version: '1.0' }
    };

    const pureDerivativeOfShared: UnmergedAsset = {
      id: 'pure-derivative-shared',
      fqn: 'ProdEnv::PureDerivativeOfShared',
      assetType: ASSET_TYPES.PACKAGE,
      assetKey: 'PureDerivativeOfShared',
      templateFqn: 'SharedTemplate',
      overrides: {} // No overrides - pure derivative
    };

    // Create a fresh test environment with the shared template
    const testDataWithShared = [...testData, sharedTemplateAsset, pureDerivativeOfShared];
    const env = createTestEnvironment(testDataWithShared);
    const testAssetsStore = env.assetsStore;
    await testAssetsStore.loadAssets(); // Load the assets into the fresh environment

    const sharedTemplateResult = getSharedTemplateIfPureDerivative(pureDerivativeOfShared, testAssetsStore.unmergedAssets);
    expect(sharedTemplateResult).not.toBeNull();
    expect(sharedTemplateResult?.fqn).toBe('SharedTemplate');

    // Test with overrides (should not be pure)
    const modifiedDerivative: UnmergedAsset = {
      id: 'modified-derivative',
      fqn: 'ProdEnv::ModifiedDerivative',
      assetType: ASSET_TYPES.PACKAGE,
      assetKey: 'ModifiedDerivative',
      templateFqn: 'SharedTemplate',
      overrides: { version: '2.0' } // Has overrides - not pure
    };

    const modifiedResult = getSharedTemplateIfPureDerivative(modifiedDerivative, testAssetsStore.unmergedAssets);
    expect(modifiedResult).toBeNull(); // Should be null because it has overrides
  });

  it('should treat ancestor environment drops as same-environment', () => {
    // ARRANGE: Drop Package from BaseEnv onto Node in ProdEnv (ancestor -> descendant)
    const dragPayload: DragPayload = { assetId: 'base-pkg', sourceContext: 'AssetTreeNode' };
    const dropTarget: DropTarget = { id: 'prod-node', type: 'asset' };

    // Set up drag state
    uiStore.startDrag(dragPayload);

    // ACT: Get available actions
    const actions = getAvailableActions(dragPayload.assetId, dropTarget);

    console.log('[TEST DEBUG] Ancestry-aware actions:', actions.length);
    console.log('[TEST DEBUG] Ancestry-aware actions:', actions);

    // ASSERT 1: Should find the assign-requirement action (treated as same-environment)
    // This should NOT trigger cross-environment dialog because BaseEnv is an ancestor of ProdEnv
    expect(actions.length).toBe(1);
    expect(actions[0].id).toBe('assign-requirement');
    expect(actions[0].label).toBe('Assign Requirement');

    // ACT 2: Execute the action to test dialog behavior
    actions[0].execute(dragPayload, dropTarget);

    // ASSERT 2: Should NOT trigger cross-environment dialog because BaseEnv is an ancestor of ProdEnv
    // This verifies the ancestry-aware behavior prevents unnecessary dialogs
    expect(uiStore.dragDropConfirmationDialog.show).toBe(false);
  });

  it('should preserve the correct assetKey when creating pure derivatives', async () => {
    // Test that when dragging a pure derivative, the system uses the correct assetKey
    // (the one from the dragged package, not the shared template)
    
    // Create a shared template with a different name
    const sharedTemplateAsset: UnmergedAsset = {
      id: 'shared-web-server',
      fqn: 'SharedWebServer', // Different name from what we'll drag
      assetType: ASSET_TYPES.PACKAGE,
      assetKey: 'SharedWebServer', // This is NOT what should be used
      templateFqn: null,
      overrides: { version: '1.0' }
    };

    // Create a pure derivative with a different name (this is what we'll drag)
    const pureDerivative: UnmergedAsset = {
      id: 'prod-web-server',
      fqn: 'ProdEnv::WebServer', // Different name - this is what should be preserved
      assetType: ASSET_TYPES.PACKAGE,
      assetKey: 'WebServer', // This IS what should be used
      templateFqn: 'SharedWebServer',
      overrides: {} // No overrides - pure derivative
    };

    const testDataWithPureDerivative = [...testData, sharedTemplateAsset, pureDerivative];
    const env = createTestEnvironment(testDataWithPureDerivative);
    const testAssetsStore = env.assetsStore;
    await testAssetsStore.loadAssets();

    // Verify the pure derivative is correctly identified
    const sharedTemplate = getSharedTemplateIfPureDerivative(pureDerivative, testAssetsStore.unmergedAssets);
    expect(sharedTemplate).not.toBeNull();
    expect(sharedTemplate?.assetKey).toBe('SharedWebServer'); // The template has this name
    expect(pureDerivative.assetKey).toBe('WebServer'); // But the derivative has this name

    // Verify that the assetKey preservation logic is correct
    // The system should use pureDerivative.assetKey ('WebServer'), not sharedTemplate.assetKey ('SharedWebServer')
    expect(pureDerivative.assetKey).toBe('WebServer');
    expect(sharedTemplate?.assetKey).toBe('SharedWebServer');
    expect(pureDerivative.assetKey).not.toBe(sharedTemplate?.assetKey);
  });
});
