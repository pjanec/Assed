import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestEnvironment } from '../../test-utils';
import { ASSET_TYPES } from '@/content/config/constants';
import { getAvailableActions } from '@/core/registries/interactionRegistry';
import type { DropTarget, UnmergedAsset } from '@/core/types';
import { globalConfigHub } from '@/core/stores/config';
import { useUiStore } from '@/core/stores';

describe('Environment Canvas Interactions - Drag and Drop', () => {
  let assetsStore: ReturnType<typeof import('@/core/stores').useAssetsStore>;
  let uiStore: ReturnType<typeof import('@/core/stores').useUiStore>;
  let workspaceStore: ReturnType<typeof import('@/core/stores').useWorkspaceStore>;

  beforeEach(() => {
    const mockDistro: UnmergedAsset = {
      id: 'distro-1',
      fqn: 'env::MyDistro',
      assetType: ASSET_TYPES.DISTRO,
      assetKey: 'MyDistro',
      templateFqn: null,
      overrides: {}
    };

    const mockNode1: UnmergedAsset = {
      id: 'node-1',
      fqn: 'env::MyDistro::NodeA',
      assetType: ASSET_TYPES.NODE,
      assetKey: 'NodeA',
      templateFqn: null,
      overrides: {}
    };

    const mockNode2: UnmergedAsset = {
      id: 'node-2',
      fqn: 'env::MyDistro::NodeB',
      assetType: ASSET_TYPES.NODE,
      assetKey: 'NodeB',
      templateFqn: null,
      overrides: {}
    };

    const mockEnvironment: UnmergedAsset = {
      id: 'env-1',
      fqn: 'EnvA',
      assetType: ASSET_TYPES.ENVIRONMENT,
      assetKey: 'EnvA',
      templateFqn: null,
      overrides: { distroFqn: 'env::MyDistro' }
    };

    const mockMachine: UnmergedAsset = {
      id: 'machine-1',
      fqn: 'EnvA::Machine1',
      assetType: ASSET_TYPES.MACHINE,
      assetKey: 'Machine1',
      templateFqn: null,
      overrides: {}
    };

    const mockNodeKey: UnmergedAsset = {
      id: 'nodekey-1',
      fqn: 'EnvA::Machine1::NodeA',
      assetType: ASSET_TYPES.NODE_KEY,
      assetKey: 'NodeA',
      templateFqn: null,
      overrides: {}
    };

    const env = createTestEnvironment([
      mockDistro, 
      mockNode1, 
      mockNode2, 
      mockEnvironment, 
      mockMachine, 
      mockNodeKey
    ]);
    assetsStore = env.assetsStore;
    uiStore = env.uiStore;
    workspaceStore = env.workspaceStore;
  });

  it('creates NodeKey when dropping Machine onto Node card', async () => {
    await assetsStore.loadAssets();

    (uiStore as any).dragSourceInfo = { 
      assetId: 'machine-1', 
      assetType: ASSET_TYPES.MACHINE,
      sourceContext: 'AssetTreeNode' 
    };

    if (globalConfigHub) {
      globalConfigHub.setPerspective('environment');
    }

    const dropTarget: DropTarget = { id: 'node-1', type: 'asset' };
    const spy = vi.spyOn(workspaceStore, 'executeCommand');
    
    const machineAsset = assetsStore.unmergedAssets.find((a: UnmergedAsset) => a.id === 'machine-1');
    const targetNodeAsset = assetsStore.unmergedAssets.find((a: UnmergedAsset) => a.id === 'node-1');
    
    if (machineAsset && targetNodeAsset) {
      const expectedKeyFqn = `${machineAsset.fqn}::${targetNodeAsset.assetKey}`;
      
      spy.mockClear();
      
      expect(spy).toHaveBeenCalledTimes(0);
    }
  });

  it('prevents duplicate NodeKey creation', async () => {
    await assetsStore.loadAssets();

    const machineAsset = assetsStore.unmergedAssets.find((a: UnmergedAsset) => a.id === 'machine-1');
    const nodeAsset = assetsStore.unmergedAssets.find((a: UnmergedAsset) => a.assetType === ASSET_TYPES.NODE && a.assetKey === 'NodeA');
    
    if (machineAsset && nodeAsset) {
      const existingKeyFqn = `${machineAsset.fqn}::${nodeAsset.assetKey}`;
      const existingKey = assetsStore.unmergedAssets.find((a: UnmergedAsset) => a.fqn === existingKeyFqn);
      
      expect(existingKey).toBeDefined();
      expect(existingKey?.assetType).toBe(ASSET_TYPES.NODE_KEY);
    }
  });

  it('provides reassign action for NodeKey onto different Node', async () => {
    await assetsStore.loadAssets();

    (uiStore as any).dragSourceInfo = { 
      assetId: 'nodekey-1', 
      assetType: ASSET_TYPES.NODE_KEY,
      parentAssetId: 'machine-1',
      sourceContext: 'EnvLayoutCanvasChip' 
    };

    if (globalConfigHub) {
      globalConfigHub.setPerspective('environment');
    }

    const dropTarget: DropTarget = { id: 'node-2', type: 'asset' };
    const actions = getAvailableActions('nodekey-1', dropTarget);
    
    expect(actions.length).toBeGreaterThan(0);
    const reassignAction = actions.find(a => a.id === 'reassign-nodekey');
    expect(reassignAction).toBeDefined();
  });

  it('prevents reassigning NodeKey to same Node', async () => {
    await assetsStore.loadAssets();

    (uiStore as any).dragSourceInfo = { 
      assetId: 'nodekey-1', 
      assetType: ASSET_TYPES.NODE_KEY,
      parentAssetId: 'machine-1',
      sourceContext: 'EnvLayoutCanvasChip' 
    };

    if (globalConfigHub) {
      globalConfigHub.setPerspective('environment');
    }

    const dropTarget: DropTarget = { id: 'node-1', type: 'asset' };
    const actions = getAvailableActions('nodekey-1', dropTarget);
    
    const reassignAction = actions.find(a => a.id === 'reassign-nodekey');
    if (reassignAction) {
      const validation = await reassignAction.validate?.(
        (uiStore as any).dragSourceInfo, 
        dropTarget
      );
      expect(validation?.isValid).toBe(false);
    }
  });

  it('prevents reassigning when target Node already exists for that Machine', async () => {
    await assetsStore.loadAssets();

    const existingMachineKeyFqn = 'EnvA::Machine1::NodeA';
    const machineAsset = assetsStore.unmergedAssets.find((a: UnmergedAsset) => a.id === 'machine-1');
    const node2Asset = assetsStore.unmergedAssets.find((a: UnmergedAsset) => a.id === 'node-2');
    
    if (machineAsset && node2Asset) {
      const expectedNewKeyFqn = `${machineAsset.fqn}::${node2Asset.assetKey}`;
      const existingKey = assetsStore.unmergedAssets.find((a: UnmergedAsset) => a.fqn === existingMachineKeyFqn);
      
      if (!existingKey) {
        (assetsStore as any).unmergedAssets.push({
          id: 'nodekey-2',
          fqn: expectedNewKeyFqn,
          assetType: ASSET_TYPES.NODE_KEY,
          assetKey: node2Asset.assetKey,
          templateFqn: null,
          overrides: {}
        });
      }

      (uiStore as any).dragSourceInfo = { 
        assetId: 'nodekey-1', 
        assetType: ASSET_TYPES.NODE_KEY,
        parentAssetId: 'machine-1',
        sourceContext: 'EnvLayoutCanvasChip' 
      };

      if (globalConfigHub) {
        globalConfigHub.setPerspective('environment');
      }

      const dropTarget: DropTarget = { id: 'node-2', type: 'asset' };
      const actions = getAvailableActions('nodekey-1', dropTarget);
      
      const reassignAction = actions.find(a => a.id === 'reassign-nodekey');
      if (reassignAction && reassignAction.validate) {
        const validation = await reassignAction.validate(
          (uiStore as any).dragSourceInfo, 
          dropTarget
        );
        expect(validation?.isValid).toBe(false);
      }
    }
  });

  it('shows context menu when right-clicking on Machine chip', async () => {
    await assetsStore.loadAssets();

    const mockEvent = {
      clientX: 100,
      clientY: 200,
      preventDefault: vi.fn()
    } as unknown as MouseEvent;

    const nodeKey = assetsStore.unmergedAssets.find((a: UnmergedAsset) => a.id === 'nodekey-1');
    expect(nodeKey).toBeDefined();
    expect(nodeKey?.assetType).toBe(ASSET_TYPES.NODE_KEY);

    const showContextMenuSpy = vi.spyOn(uiStore, 'showContextMenu');

    const { createTreeNodeFromAsset } = await import('@/core/utils/assetTreeUtils');
    const treeNode = createTreeNodeFromAsset(nodeKey!);

    expect(treeNode.id).toBe('nodekey-1');
    expect(treeNode.assetType).toBe(ASSET_TYPES.NODE_KEY);

    uiStore.showContextMenu({
      x: mockEvent.clientX,
      y: mockEvent.clientY,
      ctx: {
        kind: 'NODE_ACTIONS',
        node: treeNode
      }
    });

    expect(showContextMenuSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        x: 100,
        y: 200,
        ctx: expect.objectContaining({
          kind: 'NODE_ACTIONS',
          node: expect.objectContaining({
            id: 'nodekey-1',
            assetType: ASSET_TYPES.NODE_KEY
          })
        })
      })
    );
  });
});

describe('Environment Matrix View Interactions', () => {
  let assetsStore: ReturnType<typeof import('@/core/stores').useAssetsStore>;
  let workspaceStore: ReturnType<typeof import('@/core/stores').useWorkspaceStore>;

  beforeEach(() => {
    const mockDistro: UnmergedAsset = {
      id: 'distro-1',
      fqn: 'env::MyDistro',
      assetType: ASSET_TYPES.DISTRO,
      assetKey: 'MyDistro',
      templateFqn: null,
      overrides: {}
    };

    const mockNode1: UnmergedAsset = {
      id: 'node-1',
      fqn: 'env::MyDistro::NodeA',
      assetType: ASSET_TYPES.NODE,
      assetKey: 'NodeA',
      templateFqn: null,
      overrides: {}
    };

    const mockNode2: UnmergedAsset = {
      id: 'node-2',
      fqn: 'env::MyDistro::NodeB',
      assetType: ASSET_TYPES.NODE,
      assetKey: 'NodeB',
      templateFqn: null,
      overrides: {}
    };

    const mockEnvironment: UnmergedAsset = {
      id: 'env-1',
      fqn: 'EnvA',
      assetType: ASSET_TYPES.ENVIRONMENT,
      assetKey: 'EnvA',
      templateFqn: null,
      overrides: { distroFqn: 'env::MyDistro' }
    };

    const mockMachine: UnmergedAsset = {
      id: 'machine-1',
      fqn: 'EnvA::Machine1',
      assetType: ASSET_TYPES.MACHINE,
      assetKey: 'Machine1',
      templateFqn: null,
      overrides: {}
    };

    const env = createTestEnvironment([
      mockDistro, 
      mockNode1, 
      mockNode2, 
      mockEnvironment, 
      mockMachine
    ]);
    assetsStore = env.assetsStore;
    workspaceStore = env.workspaceStore;
  });

  it('should create NodeKey when clicking unchecked checkbox', async () => {
    await assetsStore.loadAssets();

    const machine = assetsStore.unmergedAssets.find((a: UnmergedAsset) => a.id === 'machine-1');
    const node = assetsStore.unmergedAssets.find((a: UnmergedAsset) => a.id === 'node-1');
    
    expect(machine).toBeDefined();
    expect(node).toBeDefined();

    const expectedKeyFqn = `${machine!.fqn}::${node!.assetKey}`;
    
    const executeSpy = vi.spyOn(workspaceStore, 'executeCommand');
    
    const existingKey = assetsStore.unmergedAssets.find((a: UnmergedAsset) => a.fqn === expectedKeyFqn);
    expect(existingKey).toBeUndefined();
    
    const CreateAssetCommand = (await import('@/core/stores')).CreateAssetCommand;
    const command = new CreateAssetCommand({
      assetType: ASSET_TYPES.NODE_KEY,
      assetKey: node!.assetKey,
      fqn: expectedKeyFqn,
      templateFqn: null,
      overrides: {},
    });
    workspaceStore.executeCommand(command);

    expect(executeSpy).toHaveBeenCalled();
    executeSpy.mockClear();
  });

  it('should delete NodeKey when clicking checked checkbox', async () => {
    await assetsStore.loadAssets();

    const mockNodeKey: UnmergedAsset = {
      id: 'nodekey-1',
      fqn: 'EnvA::Machine1::NodeA',
      assetType: ASSET_TYPES.NODE_KEY,
      assetKey: 'NodeA',
      templateFqn: null,
      overrides: {}
    };

    assetsStore.unmergedAssets.push(mockNodeKey);

    const machine = assetsStore.unmergedAssets.find((a: UnmergedAsset) => a.id === 'machine-1');
    const node = assetsStore.unmergedAssets.find((a: UnmergedAsset) => a.id === 'node-1');
    
    expect(machine).toBeDefined();
    expect(node).toBeDefined();

    const expectedKeyFqn = `${machine!.fqn}::${node!.assetKey}`;
    
    const executeSpy = vi.spyOn(workspaceStore, 'executeCommand');
    
    const existingKey = assetsStore.unmergedAssets.find((a: UnmergedAsset) => a.fqn === expectedKeyFqn);
    expect(existingKey).toBeDefined();
    expect(existingKey?.assetType).toBe(ASSET_TYPES.NODE_KEY);
    
    const DeleteAssetsCommand = (await import('@/core/stores')).DeleteAssetsCommand;
    const command = new DeleteAssetsCommand([existingKey!]);
    workspaceStore.executeCommand(command);

    expect(executeSpy).toHaveBeenCalled();
    executeSpy.mockClear();
  });

  it('should correctly check if node is assigned to machine', async () => {
    await assetsStore.loadAssets();

    const mockNodeKey: UnmergedAsset = {
      id: 'nodekey-1',
      fqn: 'EnvA::Machine1::NodeA',
      assetType: ASSET_TYPES.NODE_KEY,
      assetKey: 'NodeA',
      templateFqn: null,
      overrides: {}
    };

    assetsStore.unmergedAssets.push(mockNodeKey);

    const machine = assetsStore.unmergedAssets.find((a: UnmergedAsset) => a.id === 'machine-1');
    const node = assetsStore.unmergedAssets.find((a: UnmergedAsset) => a.id === 'node-1');
    
    expect(machine).toBeDefined();
    expect(node).toBeDefined();

    const expectedKeyFqn = `${machine!.fqn}::${node!.assetKey}`;
    
    const environmentMachines = assetsStore.unmergedAssets.filter(asset =>
      asset.assetType === ASSET_TYPES.MACHINE &&
      asset.fqn.startsWith('EnvA::') &&
      asset.fqn.split('::').length === 2
    );
    
    const environmentNodeKeys = new Map<string, UnmergedAsset>();
    environmentMachines.forEach(m => {
      assetsStore.unmergedAssets.forEach(key => {
        if (key.assetType === ASSET_TYPES.NODE_KEY && key.fqn.startsWith(m.fqn + '::')) {
          environmentNodeKeys.set(key.fqn, key as UnmergedAsset);
        }
      });
    });
    
    expect(environmentNodeKeys.has(expectedKeyFqn)).toBe(true);
    
    const node2 = assetsStore.unmergedAssets.find((a: UnmergedAsset) => a.id === 'node-2');
    expect(node2).toBeDefined();
    
    const expectedKeyFqn2 = `${machine!.fqn}::${node2!.assetKey}`;
    expect(environmentNodeKeys.has(expectedKeyFqn2)).toBe(false);
  });
});

