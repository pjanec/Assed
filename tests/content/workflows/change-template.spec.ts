import { describe, it, expect, beforeEach } from 'vitest';
import { createTestEnvironment, withUndoRedo } from '../../test-utils';
import { useAssetsStore, useWorkspaceStore, useUiStore } from '@/core/stores';
import { ASSET_TYPES } from '@/content/config/constants';
import type { UnmergedAsset } from '@/core/types';
import { UpdateAssetCommand } from '@/core/stores/workspace';
import { calculateMergedAsset } from '@/content/utils/mergeUtils';
import { generatePropertiesDiff } from '@/core/utils/diff';

describe('Stage 7 Workflow: Change Template with Confirmation', () => {
  let assetsStore: ReturnType<typeof useAssetsStore>;
  let workspaceStore: ReturnType<typeof useWorkspaceStore>;
  let uiStore: ReturnType<typeof useUiStore>;

  // SCENARIO: An asset's template will be changed, causing a diff in its merged properties.
  const initialData: UnmergedAsset[] = [
    { // The old template
      id: 'template-a',
      fqn: 'TemplateA',
      assetType: ASSET_TYPES.PACKAGE,
      assetKey: 'TemplateA',
      templateFqn: null,
      overrides: { port: 80, logging: 'standard', region: 'us-east-1' },
    },
    { // The new template
      id: 'template-b',
      fqn: 'TemplateB',
      assetType: ASSET_TYPES.PACKAGE,
      assetKey: 'TemplateB',
      templateFqn: null,
      overrides: { port: 443, logging: 'json', security: 'high' },
    },
    { // The asset to be modified
      id: 'asset-to-change',
      fqn: 'MyWebService',
      assetType: ASSET_TYPES.PACKAGE,
      assetKey: 'MyWebService',
      templateFqn: 'TemplateA', // Initially points to TemplateA
      overrides: { port: 8080 }, // Has a local override that should be preserved
    },
  ];

  beforeEach(async () => {
    const env = createTestEnvironment(initialData);
    assetsStore = env.assetsStore;
    workspaceStore = env.workspaceStore;
    uiStore = env.uiStore;
    await assetsStore.loadAssets();
  });

  it('should prompt for confirmation with a correct diff of merged properties', () => {
    // ARRANGE
    // Use assetsWithOverrides to get the full asset data with overrides preserved
    const assetToChange = assetsStore.assetsWithOverrides.find(a => a.id === 'asset-to-change')!;
    const oldTemplateFqn = assetToChange.templateFqn;
    const newTemplateFqn = 'TemplateB';

    // ACT: Simulate the logic from the GeneralPropertiesEditor's handleTemplateChange method
    // Use assetsWithOverrides to get the full asset data with overrides preserved
    const allAssetsMap = new Map(assetsStore.assetsWithOverrides.map(a => [a.id, a]));
      
    // 1. Calculate "before" state
    const stateBefore = calculateMergedAsset(assetToChange.id, allAssetsMap);

    // 2. Calculate "after" state (in memory)
    const tempAsset = { ...assetToChange, templateFqn: newTemplateFqn };
    const tempAssetsMap = new Map(allAssetsMap).set(tempAsset.id, tempAsset);
    const stateAfter = calculateMergedAsset(tempAsset.id, tempAssetsMap);

    // 3. Generate the diff
    const diff = generatePropertiesDiff(
      'properties' in stateBefore ? stateBefore.properties : null,
      'properties' in stateAfter ? stateAfter.properties : null
    );

    // 4. Prompt for confirmation by calling the uiStore action
    uiStore.promptForTemplateChange({ asset: assetToChange, oldTemplateFqn, newTemplateFqn, diff });

    // ASSERT: The UI store should now be in the correct state to show the dialog
    expect(uiStore.templateChangeDialog.show).toBe(true);
    expect(uiStore.templateChangeDialog.asset?.id).toBe('asset-to-change');
    expect(uiStore.templateChangeDialog.oldTemplateFqn).toBe('TemplateA');
    expect(uiStore.templateChangeDialog.newTemplateFqn).toBe('TemplateB');

    // Verify the diff is correct and shows added, modified, and removed properties
    const dialogDiff = uiStore.templateChangeDialog.diff;
    expect(dialogDiff).toHaveLength(3);
    expect(dialogDiff.find(c => c.path === 'security' && c.type === 'ADDED')?.newValue).toBe('high');
    expect(dialogDiff.find(c => c.path === 'logging' && c.type === 'MODIFIED')?.newValue).toBe('json');
    expect(dialogDiff.find(c => c.path === 'region' && c.type === 'REMOVED')?.oldValue).toBe('us-east-1');
    // The locally overridden 'port' should NOT appear in the diff, as it's unaffected.
    expect(dialogDiff.find(c => c.path === 'port')).toBeUndefined();
  });

  it('should execute a command to change the templateFqn upon confirmation', () => {
    // ARRANGE: Set up the dialog state
    const assetToChange = assetsStore.assetsWithOverrides.find(a => a.id === 'asset-to-change')!;
    uiStore.promptForTemplateChange({ asset: assetToChange, oldTemplateFqn: 'TemplateA', newTemplateFqn: 'TemplateB', diff: [] });

    // ACT: Simulate the user confirming the dialog
    workspaceStore.executeTemplateChange(assetToChange.id, 'TemplateB');
    uiStore.clearActionStates();

    // ASSERT
    expect(uiStore.templateChangeDialog.show).toBe(false);
    expect(workspaceStore.pendingChanges.upserted.has('asset-to-change')).toBe(true);

    const updatedAsset = workspaceStore.pendingChanges.upserted.get('asset-to-change');
    expect(updatedAsset?.templateFqn).toBe('TemplateB');

    expect(workspaceStore.undoStack).toHaveLength(1);
    expect(workspaceStore.undoStack[0]).toBeInstanceOf(UpdateAssetCommand);
  });

  it('should correctly undo and redo the "Change Template" action', async () => {
    // ARRANGE
    const assetId = 'asset-to-change';
    const newTemplateFqn = 'TemplateB';

    // Use the withUndoRedo harness to test the entire command lifecycle
    await withUndoRedo(workspaceStore, () => {
      // The action to test is executing the template change
      workspaceStore.executeTemplateChange(assetId, newTemplateFqn);
    });

    // Final state check (after undo and redo)
    const finalState = workspaceStore.pendingChanges.upserted.get(assetId);
    expect(finalState?.templateFqn).toBe(newTemplateFqn);
  });
});
