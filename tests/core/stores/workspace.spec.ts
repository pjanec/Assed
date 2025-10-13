import { describe, it, expect, beforeEach } from 'vitest';
import { createTestEnvironment } from '../../test-utils';
import { MOCK_ASSET_TYPES } from '../../mock-content/mockAssetRegistry';
import { ApplyRefactoringCommand } from '../../../src/core/stores/workspace';
import type { UnmergedAsset, AssetTreeNode } from '../../../src/core/types';
import { createTreeNodeFromAsset } from '../../../src/core/utils/assetTreeUtils';

const initialData: UnmergedAsset[] = [
  { id: 'widget-1', fqn: 'MyWidget', assetType: MOCK_ASSET_TYPES.WIDGET, assetKey: 'MyWidget', overrides: {} },
  { id: 'container-1', fqn: 'MyContainer', assetType: MOCK_ASSET_TYPES.CONTAINER, assetKey: 'MyContainer', overrides: {} },
];

describe('Core Workspace Operations - Move Asset', () => {
  let assetsStore: any, workspaceStore: any;

  beforeEach(() => {
    const env = createTestEnvironment(initialData);
    assetsStore = env.assetsStore;
    workspaceStore = env.workspaceStore;
  });

  it('should correctly update an asset\'s FQN when moved', async () => {
    // 1. ARRANGE: Load initial state
    await assetsStore.loadAssets();
    
    const widget = assetsStore.unmergedAssets.find((a: UnmergedAsset) => a.id === 'widget-1');
    const container = assetsStore.unmergedAssets.find((a: UnmergedAsset) => a.id === 'container-1');
    expect(widget.fqn).toBe('MyWidget');
    
    // Create AssetTreeNode for loadAssetDetails using shared utility
    const widgetTreeNode = createTreeNodeFromAsset(widget);
    
    await assetsStore.loadAssetDetails(widgetTreeNode); // Pre-populate the details cache

    // 2. ACT: Perform the core operation by calling the store action
    // Let's test a move that doesn't create ripple effects - moving to root level
    await workspaceStore.moveAsset(widget.id, null);

    // 3. ASSERT: Check the state of the stores
    expect(workspaceStore.hasUnsavedChanges).toBe(true);
    const movedWidget = workspaceStore.pendingChanges.upserted.get('widget-1');
    expect(movedWidget?.fqn).toBe('MyWidget'); // Moving to root level
    expect(workspaceStore.undoStack[0]).toBeInstanceOf(ApplyRefactoringCommand);
  });
});