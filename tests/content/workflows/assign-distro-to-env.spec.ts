import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestEnvironment } from '../../test-utils';
import { ASSET_TYPES } from '@/content/config/constants';
import { getAvailableActions } from '@/core/registries/interactionRegistry';
import type { DropTarget, UnmergedAsset } from '@/core/types';
import { globalConfigHub } from '@/core/stores/config';

describe('Assign Distro to Environment - Drag and Drop', () => {
  let assetsStore: ReturnType<typeof import('@/core/stores').useAssetsStore>;
  let uiStore: ReturnType<typeof import('@/core/stores').useUiStore>;
  let workspaceStore: ReturnType<typeof import('@/core/stores').useWorkspaceStore>;

  beforeEach(() => {
    const mockDistro: UnmergedAsset = {
      id: 'distro-1',
      fqn: 'env::D1',
      assetType: ASSET_TYPES.DISTRO,
      assetKey: 'D1',
      templateFqn: null,
      overrides: {}
    };
    const mockEnvironment: UnmergedAsset = {
      id: 'env-1',
      fqn: 'EnvA',
      assetType: ASSET_TYPES.ENVIRONMENT,
      assetKey: 'EnvA',
      templateFqn: null,
      overrides: {}
    };

    const env = createTestEnvironment([mockDistro, mockEnvironment]);
    assetsStore = env.assetsStore;
    uiStore = env.uiStore;
    workspaceStore = env.workspaceStore;
  });

  it('assigns distro immediately when none is set', async () => {
    await assetsStore.loadAssets();
    
    (uiStore as any).dragSourceInfo = { assetId: 'distro-1', sourceContext: 'test' };
    
    if (globalConfigHub) {
      globalConfigHub.setPerspective('environment');
    }
    
    const dropTarget: DropTarget = { id: 'env-1', type: 'asset' };
    const actions = getAvailableActions('distro-1', dropTarget);
    expect(actions.length).toBeGreaterThan(0);
    const action = actions.find(a => a.id === 'assign-distro-to-env') || actions[0];
    const spy = vi.spyOn(workspaceStore, 'executeCommand');
    await action.execute((uiStore as any).dragSourceInfo, dropTarget, workspaceStore);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('prompts for confirmation when replacing an existing distro, cancels gracefully', async () => {
    await assetsStore.loadAssets();
    
    const envAsset = assetsStore.unmergedAssets.find((a: UnmergedAsset) => a.id === 'env-1');
    if (envAsset) {
      envAsset.overrides.distroFqn = 'env::D0';
    }
    (uiStore as any).dragSourceInfo = { assetId: 'distro-1', sourceContext: 'test' };
    
    if (globalConfigHub) {
      globalConfigHub.setPerspective('environment');
    }
    
    const dropTarget: DropTarget = { id: 'env-1', type: 'asset' };
    const actions = getAvailableActions('distro-1', dropTarget);
    expect(actions.length).toBeGreaterThan(0);
    const action = actions.find(a => a.id === 'assign-distro-to-env') || actions[0];
    const confirmSpy = vi.spyOn(uiStore as any, 'promptForGenericConfirmation').mockResolvedValue(false);
    const execSpy = vi.spyOn(workspaceStore, 'executeCommand');
    await action.execute((uiStore as any).dragSourceInfo, dropTarget, workspaceStore);
    expect(confirmSpy).toHaveBeenCalledOnce();
    expect(execSpy).not.toHaveBeenCalled();
  });

  it('prompts for confirmation when replacing an existing distro, confirms update', async () => {
    await assetsStore.loadAssets();
    
    const envAsset = assetsStore.unmergedAssets.find((a: UnmergedAsset) => a.id === 'env-1');
    if (envAsset) {
      envAsset.overrides.distroFqn = 'env::D0';
    }
    (uiStore as any).dragSourceInfo = { assetId: 'distro-1', sourceContext: 'test' };
    
    if (globalConfigHub) {
      globalConfigHub.setPerspective('environment');
    }
    
    const dropTarget: DropTarget = { id: 'env-1', type: 'asset' };
    const actions = getAvailableActions('distro-1', dropTarget);
    expect(actions.length).toBeGreaterThan(0);
    const action = actions.find(a => a.id === 'assign-distro-to-env') || actions[0];
    vi.spyOn(uiStore as any, 'promptForGenericConfirmation').mockResolvedValue(true);
    const execSpy = vi.spyOn(workspaceStore, 'executeCommand');
    await action.execute((uiStore as any).dragSourceInfo, dropTarget, workspaceStore);
    expect(execSpy).toHaveBeenCalledTimes(1);
  });
});


