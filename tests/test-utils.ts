import { createApp } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { CorePlugin } from '@/core/plugin';
import { createMockContentPlugin } from './mock-content/MockContentPlugin';
import { MockPersistenceAdapter } from './mock-content/MockPersistenceAdapter';
import { useAssetsStore, useWorkspaceStore, useUiStore } from '@/core/stores';
import { useCoreConfigStore } from '@/core/stores/config';
import type { UnmergedAsset } from '@/core/types';
import { createVuetify } from 'vuetify';

export function createTestEnvironment(initialDbData: UnmergedAsset[] = []) {
  const app = createApp({});
  const pinia = createPinia();
  app.use(pinia);
  setActivePinia(pinia);

  const vuetify = createVuetify();
  app.use(vuetify);

  const mockAdapter = new MockPersistenceAdapter(initialDbData);
  const mockContentPlugin = createMockContentPlugin(mockAdapter);

  // Install the actual CorePlugin (System Under Test)
  app.use(CorePlugin);
  // Install our mock ContentPlugin (Test Double)
  app.use(mockContentPlugin);

  return {
    assetsStore: useAssetsStore(),
    workspaceStore: useWorkspaceStore(),
    uiStore: useUiStore(),
    coreConfigStore: useCoreConfigStore(),
    mockAdapter,
  };
}

/**
 * Creates a serializable and comparable snapshot of the workspace's pending changes.
 */
function getChangeSnapshot(workspaceStore: any) {
  return {
    upserted: Object.fromEntries(workspaceStore.pendingChanges.upserted),
    deleted: Object.fromEntries(workspaceStore.pendingChanges.deleted),
  };
}

/**
 * A test harness that wraps an action and verifies that undo/redo operations
 * correctly revert and re-apply the resulting state changes.
 * @param workspaceStore The instance of the workspace store.
 * @param action A function that performs one or more workspace commands.
 */
export async function withUndoRedo(workspaceStore: any, action: () => void | Promise<void>) {
  const beforeState = getChangeSnapshot(workspaceStore);

  await Promise.resolve(action());
  const afterState = getChangeSnapshot(workspaceStore);

  // --- UNDO PHASE ---
  while (workspaceStore.canUndo) {
    workspaceStore.undo();
  }
  const fullyUndoneState = getChangeSnapshot(workspaceStore);
  expect(fullyUndoneState).toEqual(beforeState);

  // --- REDO PHASE ---
  while (workspaceStore.canRedo) {
    workspaceStore.redo();
  }
  const fullyRedoneState = getChangeSnapshot(workspaceStore);
  expect(fullyRedoneState).toEqual(afterState);
}