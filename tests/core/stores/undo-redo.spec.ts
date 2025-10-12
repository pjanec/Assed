import { describe, it, beforeEach } from 'vitest';
import { createTestEnvironment, withUndoRedo } from '../../test-utils';
import { CreateAssetCommand } from '@/core/stores/workspace';
import { MOCK_ASSET_TYPES } from '../../mock-content/mockAssetRegistry';
import type { UnmergedAsset } from '@/core/types';

const initialData: UnmergedAsset[] = [
  { id: 'container-1', fqn: 'MyContainer', assetType: MOCK_ASSET_TYPES.CONTAINER, assetKey: 'MyContainer', overrides: {} },
  { id: 'widget-1', fqn: 'MyWidget', assetType: MOCK_ASSET_TYPES.WIDGET, assetKey: 'MyWidget', overrides: {} },
];

describe('Undo/Redo Engine', () => {
  let workspaceStore: any, assetsStore: any;

  beforeEach(async () => {
    const env = createTestEnvironment(initialData);
    workspaceStore = env.workspaceStore;
    assetsStore = env.assetsStore;
    await assetsStore.loadAssets();
  });

  it('should correctly undo and redo a single move operation', async () => {
    // We wrap the entire operation inside our test harness
    await withUndoRedo(workspaceStore, () => {
      workspaceStore.moveAsset('widget-1', 'MyContainer');
    });
  });

  it('should correctly undo and redo a complex sequence of operations', async () => {
    await withUndoRedo(workspaceStore, async () => {
      // 1. Create a new asset
      const createCommand = new CreateAssetCommand({
        assetType: MOCK_ASSET_TYPES.WIDGET,
        assetKey: 'NewWidget',
        fqn: 'NewWidget',
        templateFqn: null,
        overrides: {},
      });
      workspaceStore.executeCommand(createCommand);
      const newAssetId = createCommand.newAsset.id;

      // 2. Rename the new asset
      workspaceStore.renameAsset(newAssetId, 'RenamedWidget');

      // 3. Move the renamed asset
      workspaceStore.moveAsset(newAssetId, 'MyContainer');
    });
  });
});