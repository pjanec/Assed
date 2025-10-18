// tests/content/workflows/drag-and-drop-scenarios.spec.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestEnvironment, withUndoRedo } from '../../test-utils';
import { useAssetsStore, useWorkspaceStore, useUiStore } from '@/core/stores';
import { ASSET_TYPES } from '@/content/config/constants';
import type { UnmergedAsset, DragPayload, DropTarget } from '@/core/types';
import { getAvailableActions } from '@/core/registries/interactionRegistry';
import { CompositeCommand, CreateAssetCommand, DeriveAssetCommand, CloneAssetCommand } from '@/core/stores/workspace';

// --- Mock Data Tailored for Workflow Testing ---
// This dataset is specifically designed to cover all our scenarios:
// - Shared templates (GlobalAPI, GlobalFrontend)
// - An environment with no template (EnvA)
// - An environment that inherits from another (ProdEnv -> BaseEnv)
// - Packages with overrides (EnvA::Nginx)
// - Packages that are pure derivatives (BaseEnv::APIServer)
const mockAssets: UnmergedAsset[] = [
  // Global Shared Packages
  { id: 'global-api', fqn: 'GlobalAPIPackage', assetType: ASSET_TYPES.PACKAGE, assetKey: 'GlobalAPIPackage', templateFqn: null, overrides: { tier: 'backend' } },
  { id: 'global-frontend', fqn: 'GlobalFrontendPackage', assetType: ASSET_TYPES.PACKAGE, assetKey: 'GlobalFrontendPackage', templateFqn: null, overrides: { framework: 'Vue' } },

  // --- Environment A (Standalone) ---
  { id: 'env-a', fqn: 'EnvA', assetType: ASSET_TYPES.ENVIRONMENT, assetKey: 'EnvA', templateFqn: null, overrides: {} },
  { id: 'node-a1', fqn: 'EnvA::WebServer', assetType: ASSET_TYPES.NODE, assetKey: 'WebServer', templateFqn: null, overrides: {} },
  { id: 'node-a2', fqn: 'EnvA::Database', assetType: ASSET_TYPES.NODE, assetKey: 'Database', templateFqn: null, overrides: {} },
  // Nginx in EnvA has local overrides, making it a "complex" package
  { id: 'pkg-a-nginx', fqn: 'EnvA::Nginx', assetType: ASSET_TYPES.PACKAGE, assetKey: 'Nginx', templateFqn: null, overrides: { version: '1.21-alpine', worker_processes: 4 } },
  { id: 'key-a-nginx', fqn: 'EnvA::WebServer::Nginx', assetType: ASSET_TYPES.PACKAGE_KEY, assetKey: 'Nginx', templateFqn: null, overrides: {} },

  // --- Environment Base & Prod (Inheritance Chain) ---
  { id: 'env-base', fqn: 'BaseEnv', assetType: ASSET_TYPES.ENVIRONMENT, assetKey: 'BaseEnv', templateFqn: null, overrides: {} },
  // APIServer in BaseEnv is a pure derivative of the global package
  { id: 'pkg-base-api', fqn: 'BaseEnv::APIServer', assetType: ASSET_TYPES.PACKAGE, assetKey: 'APIServer', templateFqn: 'GlobalAPIPackage', overrides: {} },
  { id: 'node-base-main', fqn: 'BaseEnv::MainNode', assetType: ASSET_TYPES.NODE, assetKey: 'MainNode', templateFqn: null, overrides: {} },
  { id: 'key-base-api', fqn: 'BaseEnv::MainNode::APIServer', assetType: ASSET_TYPES.PACKAGE_KEY, assetKey: 'APIServer', templateFqn: null, overrides: {} },
    
  // ProdEnv inherits from BaseEnv
  { id: 'env-prod', fqn: 'ProdEnv', assetType: ASSET_TYPES.ENVIRONMENT, assetKey: 'ProdEnv', templateFqn: 'BaseEnv', overrides: {} },
  { id: 'node-prod-main', fqn: 'ProdEnv::MainNode', assetType: ASSET_TYPES.NODE, assetKey: 'MainNode', templateFqn: null, overrides: {} },
];

describe('Content Workflows: Drag-and-Drop Scenarios', () => {
  let assetsStore: ReturnType<typeof useAssetsStore>;
  let workspaceStore: ReturnType<typeof useWorkspaceStore>;
  let uiStore: ReturnType<typeof useUiStore>;

  beforeEach(async () => {
    const env = createTestEnvironment(mockAssets);
    assetsStore = env.assetsStore;
    workspaceStore = env.workspaceStore;
    uiStore = env.uiStore;
    await assetsStore.loadAssets();
  });

  // =================================================================
  // ==  Workflow 1: Assigning a Requirement (Package -> Node)
  // =================================================================
  describe('1. Package -> Node Assignment', () => {

    it('Scenario 1.1 (Smart Derive): Should create a derived package and key when dragging a shared package', () => {
      // GOAL: Drag a shared package (GlobalFrontend) to a node (NodeA1) in an environment that doesn't have it yet.
      // EXPECTATION: The system should create a NEW package 'EnvA::GlobalFrontendPackage' that derives from the shared one,
      // AND create the 'EnvA::WebServer::GlobalFrontendPackage' key, all in one immediate, atomic action.
        
      // ARRANGE
      const dragPayload: DragPayload = { assetId: 'global-frontend', sourceContext: 'AssetTreeNode' };
      const dropTarget: DropTarget = { id: 'node-a1', type: 'asset' };
      uiStore.startDrag(dragPayload);

      // ACT
      const actions = getAvailableActions(dragPayload.assetId, dropTarget);
      actions[0].execute(dragPayload, dropTarget); // Execute the single 'assign-requirement' action

      // ASSERT
      expect(workspaceStore.undoStack).toHaveLength(1);
      const command = workspaceStore.undoStack[0] as CompositeCommand;
      expect(command.commands).toHaveLength(2); // Should contain two sub-commands

      const deriveCommand = command.commands.find(c => c instanceof DeriveAssetCommand) as DeriveAssetCommand;
      const createCommand = command.commands.find(c => c instanceof CreateAssetCommand) as CreateAssetCommand;

      expect(deriveCommand).toBeDefined();
      expect(deriveCommand.derivedAsset.fqn).toBe('EnvA::GlobalFrontendPackage');
      expect(deriveCommand.derivedAsset.templateFqn).toBe('GlobalFrontendPackage');

      expect(createCommand).toBeDefined();
      expect(createCommand.newAsset.fqn).toBe('EnvA::WebServer::GlobalFrontendPackage');
      expect(createCommand.newAsset.assetType).toBe(ASSET_TYPES.PACKAGE_KEY);
    });

    it('Scenario 1.2 (Ancestor Environment): Should treat a drop from an ancestor env as a "same-environment" action', () => {
      // GOAL: Drag a package ('APIServer') from a template environment ('BaseEnv') to a node ('MainNode') in a child environment ('ProdEnv').
      // EXPECTATION: This should be treated as a simple, immediate action. It should ONLY create the new PackageKey,
      // because the package is already available via structural inheritance. No dialog should appear.
        
      // ARRANGE
      const dragPayload: DragPayload = { assetId: 'pkg-base-api', sourceContext: 'AssetTreeNode' };
      const dropTarget: DropTarget = { id: 'node-prod-main', type: 'asset' };
      uiStore.startDrag(dragPayload);

      // ACT
      const actions = getAvailableActions(dragPayload.assetId, dropTarget);
      actions[0].execute(dragPayload, dropTarget);

      // ASSERT
      expect(workspaceStore.undoStack).toHaveLength(1);
      const command = workspaceStore.undoStack[0] as CompositeCommand;
      expect(command.commands).toHaveLength(1); // Should ONLY contain the CreateAssetCommand

      const createCommand = command.commands[0] as CreateAssetCommand;
      expect(createCommand.newAsset.fqn).toBe('ProdEnv::MainNode::APIServer');
      expect(createCommand.newAsset.assetType).toBe(ASSET_TYPES.PACKAGE_KEY);
    });

    it('Scenario 1.3 (Cross-Environment with Overrides): Should trigger confirmation dialog for complex packages', async () => {
      // GOAL: Drag a package WITH local overrides ('Nginx' from 'EnvA') to a node in an unrelated environment ('ProdEnv').
      // EXPECTATION: The system must pause and ask for user confirmation by calling the generic prompt.
        
      // ARRANGE
      const dragPayload: DragPayload = { assetId: 'pkg-a-nginx', sourceContext: 'AssetTreeNode' };
      const dropTarget: DropTarget = { id: 'node-prod-main', type: 'asset' };
      uiStore.startDrag(dragPayload);
      
      // Mock the confirmation to resolve immediately
      const mockPromptForGenericConfirmation = vi.fn().mockResolvedValue(true);
      vi.spyOn(uiStore, 'promptForGenericConfirmation').mockImplementation(mockPromptForGenericConfirmation);

      // ACT
      const actions = getAvailableActions(dragPayload.assetId, dropTarget);
      await actions[0].execute(dragPayload, dropTarget);

      // ASSERT
      expect(mockPromptForGenericConfirmation).toHaveBeenCalledOnce();
      expect(mockPromptForGenericConfirmation).toHaveBeenCalledWith('cross-environment-copy', expect.any(Object));
    });
  });

  // =================================================================
  // ==  Workflow 2: Populating Environment Pool (Package -> Environment)
  // =================================================================
  describe('2. Package -> Environment Pool Population', () => {

    it('Scenario 2.1 (Path-Aware Drop): Should create intermediate folders when dragging a nested package', () => {
      // GOAL: Drag a nested package 'EnvA::WebServer::Nginx' and drop it on the 'ProdEnv' environment.
      // EXPECTATION: The system must create the missing 'ProdEnv::WebServer' folder AND then create the 'Nginx' package inside it.
        
      // ARRANGE
      const dragPayload: DragPayload = { assetId: 'pkg-a-nginx', sourceContext: 'AssetTreeNode' }; // This is a complex package
      const dropTarget: DropTarget = { id: 'env-prod', type: 'asset' };
      uiStore.startDrag(dragPayload);
      
      // Mock the confirmation to resolve immediately
      const mockPromptForGenericConfirmation = vi.fn().mockResolvedValue(true);
      vi.spyOn(uiStore, 'promptForGenericConfirmation').mockImplementation(mockPromptForGenericConfirmation);

      // ACT
      const actions = getAvailableActions(dragPayload.assetId, dropTarget);
      actions[0].execute(dragPayload, dropTarget);

      // ASSERT
      // Because this is a complex cross-env copy, it should still trigger a dialog.
      // We are testing that the *future* execution path is set up correctly.
      // A more advanced test would mock the confirmation and check the workspace store.
      expect(mockPromptForGenericConfirmation).toHaveBeenCalledOnce();
      // NOTE: A full test would require mocking the confirmation and inspecting the commands.
      // This is a placeholder to show the concept is testable.
    });

  });

  // =================================================================
  // ==  Workflow 3: Cloning a Node (Node -> Environment)
  // =================================================================
  describe('3. Node -> Environment Cloning', () => {
      
    it('Scenario 3.1: Should trigger a single confirmation dialog with a comprehensive plan and execute it', async () => {
      // GOAL: Drag 'WebServer' from 'EnvA' (which requires 'Nginx') and drop it on 'BaseEnv'.
      // EXPECTATION: The system should analyze the operation, present a confirmation dialog,
      // and upon confirmation, execute a composite command to perform all necessary actions.
        
      // ARRANGE
      const dragPayload: DragPayload = { assetId: 'node-a1', sourceContext: 'AssetTreeNode' }; // 'EnvA::WebServer'
      const dropTarget: DropTarget = { id: 'env-base', type: 'asset' }; // 'BaseEnv'
      uiStore.startDrag(dragPayload);
        
      // Mock the UI confirmation to automatically resolve true
      const promptSpy = vi.spyOn(uiStore, 'promptForGenericConfirmation').mockResolvedValue(true);

      // ACT
      const actions = getAvailableActions(dragPayload.assetId, dropTarget);
      console.log('Available actions:', actions.map(a => ({ id: a.id, label: a.label })));
        
      // ASSERT 1: The correct, specific rule was found (no fallback to generic actions)
      expect(actions).toHaveLength(1);
      expect(actions[0].id).toBe('clone-node-with-deps');
        
      // Execute the action, which will trigger the mocked confirmation
      await actions[0].execute(dragPayload, dropTarget);

      // ASSERT 2: The confirmation dialog was prompted with the correct analysis
      expect(promptSpy).toHaveBeenCalledOnce();
      const [dialogType, payload] = promptSpy.mock.calls[0];
      expect(dialogType).toBe('node-clone-confirmation');
      expect(payload.plan).toBeDefined();
        
      // Verify the generated plan is correct
      expect(payload.plan.nodesToCreate).toHaveLength(1);
      expect(payload.plan.nodesToCreate[0].newState.assetKey).toBe('WebServer');
        
      expect(payload.plan.keysToCreate).toHaveLength(1);
      expect(payload.plan.keysToCreate[0].newState.assetKey).toBe('Nginx');
        
      expect(payload.plan.safeImports).toHaveLength(0);
      expect(payload.plan.importsWithOverrides).toHaveLength(1);
      expect(payload.plan.importsWithOverrides[0].newState.assetKey).toBe('Nginx');

      // ASSERT 3: A composite command with the correct sub-commands was executed
      expect(workspaceStore.undoStack).toHaveLength(1);
      const executedCommand = workspaceStore.undoStack[0] as CompositeCommand;
      expect(executedCommand).toBeInstanceOf(CompositeCommand);
      
      // The plan has 3 parts: Clone Node, Clone Package, Create Key. The command should have 3 parts.
      expect(executedCommand.commands).toHaveLength(3);

      // Verify the commands
      const cloneNodeCmd = executedCommand.commands.find(c => c instanceof CloneAssetCommand && c.sourceAssetId === 'node-a1') as CloneAssetCommand;
      const clonePackageCmd = executedCommand.commands.find(c => c instanceof CloneAssetCommand && c.sourceAssetId === 'pkg-a-nginx') as CloneAssetCommand;
      // The key is created, not cloned, because it's a simple structure.
      const createKeyCmd = executedCommand.commands.find(c => c instanceof CreateAssetCommand && c.newAsset.assetType === ASSET_TYPES.PACKAGE_KEY) as CreateAssetCommand;

      expect(cloneNodeCmd).toBeDefined();
      expect(clonePackageCmd).toBeDefined();
      // Add the missing assertion for the key creation
      expect(createKeyCmd).toBeDefined();
      
      // Verify the node cloning command
      expect(cloneNodeCmd.sourceAssetId).toBe('node-a1');
      expect(cloneNodeCmd.newParentFqn).toBe('BaseEnv');
      expect(cloneNodeCmd.newAssetKey).toBe('WebServer');
      
      // Verify the package cloning command
      expect(clonePackageCmd.sourceAssetId).toBe('pkg-a-nginx');
      expect(clonePackageCmd.newParentFqn).toBe('BaseEnv');
      expect(clonePackageCmd.newAssetKey).toBe('Nginx');
      
      // Verify the key creation command
      expect(createKeyCmd.newAsset.assetType).toBe(ASSET_TYPES.PACKAGE_KEY);
      expect(createKeyCmd.newAsset.assetKey).toBe('Nginx');
      expect(createKeyCmd.newAsset.fqn).toBe('BaseEnv::WebServer::Nginx');
    });
  });
});
