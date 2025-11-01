// stores/workspace.ts - Workspace and editing state management
import { defineStore } from 'pinia'
import { useCoreConfigStore } from './config'
import { useUiStore } from '@/core/stores/ui'
import { cloneDeep, isEqual } from 'lodash-es';
import { generateAssetDiff, generatePropertiesDiff } from '@/core/utils/diff';
import { generateUUID } from '@/core/utils/idUtils';
import { calculateMergedAsset } from '@/core/utils/mergeUtils';
import { useAssetsStore } from '@/core/stores/assets';
import type { CloneMap } from '@/core/types'; 

export type PostCloneHook = (
  newlyClonedAsset: UnmergedAsset,
  originalSourceAsset: UnmergedAsset,
  cloneMap: CloneMap
) => UnmergedAsset;

import type { 
  Asset, 
  UnmergedAsset, 
  AssetTreeNode,
  PendingChanges, 
  NewAssetDialogState, 
  DeleteConfirmationDialogState,
  ChangeItem,
  AssetDetails,
  RefactorConsequences,
  FqnUpdate,
  TemplateLinkUpdate
} from '@/core/types';
import type { DragPayload, DropTarget } from '@/core/types/drag-drop';
import { getValidationRulesForType } from '@/core/registries/validationRegistry';
import type { ValidationIssue } from '@/core/types/validation';
import { createTreeNodeFromAssetId } from '@/core/utils/assetTreeUtils';

interface Command {
  execute(workspace: any, assetsStore?: any): void;
  unexecute(workspace: any): void;
}

export class CompositeCommand implements Command {
  private commands: Command[];

  constructor(commands: Command[]) {
    this.commands = commands;
  }

  execute(workspace: any, assetsStore: any): void {
    this.commands.forEach(cmd => cmd.execute(workspace, assetsStore));
  }

  unexecute(workspace: any): void {
    [...this.commands].reverse().forEach(cmd => cmd.unexecute(workspace));
  }
}

interface RefactorConfirmationState {
  mode: 'rename' | 'move';
  assetId: string;
  consequences: RefactorConsequences;
}

interface CascadingChanges {
  oldFqn: string;
  newFqn: string;
  fqnUpdates: { assetId: string; oldFqn: string; newFqn: string }[];
  templateLinkUpdates: { assetId: string; oldTemplateFqn: string; newTemplateFqn: string }[];
  linkedOverrideUpdates?: { assetId: string; oldAssetKey: string; newAssetKey: string; oldFqn: string; newFqn: string }[];
}

interface NewFolderDialogState {
  show: boolean;
  parentFqn: string | null;
}

interface WorkspaceState {
  // Pending changes (not yet saved)
  pendingChanges: PendingChanges;
  
  // Command history for undo/redo
  undoStack: Command[];
  redoStack: Command[];
  _rippleEffectCache: Map<string, ChangeItem[]> | null;
  


  // Save state
  saving: boolean;
  lastSaved: Date | null;
}

export const useWorkspaceStore = defineStore('workspace', {
  state: (): WorkspaceState => ({
    
    // Pending changes (not yet saved)
    pendingChanges: {
      upserted: new Map(), // Map<assetId, UnmergedAssetDto>
      deleted: new Map() // Map<assetId, UnmergedAssetDto>
    },
    
    // Command history for undo/redo
    undoStack: [],
    redoStack: [],
    _rippleEffectCache: null,
    


    // Save state
    saving: false,
    lastSaved: null
  }),

  getters: {
    hasUnsavedChanges: (state): boolean => {
      return state.pendingChanges.upserted.size > 0 || state.pendingChanges.deleted.size > 0
    },
    
    canUndo: (state): boolean => {
      return state.undoStack.length > 0
    },
    
    canRedo: (state): boolean => {
      return state.redoStack.length > 0
    },
    
    // Get current change set for API calls
    changeSet: (state): { upserted: UnmergedAsset[], deleted: string[] } => {
      return {
        upserted: Array.from(state.pendingChanges.upserted.values()),
        deleted: Array.from(state.pendingChanges.deleted.keys()) // <-- CHANGE THIS LINE (.keys())
      }
    },

    // Ripple effect analysis for changed templates
    rippleEffectChanges: (state): Map<string, ChangeItem[]> => {
      // The getter is now simple and fast. It just returns the pre-calculated data.
      return state._rippleEffectCache ?? new Map();
    },

    /**
     * NEW GETTER: Generates a structured overview of all pending changes,
     * categorized into modified, added, and deleted, including diffs for modifications.
     */
    structuredChanges(state) {
      const assetsStore = useAssetsStore();
      const added: any[] = [];
      const modified: any[] = [];
      const deleted: any[] = [];

      // Get the original saved state from the main assets list.
      const originalStateMap = new Map<string, Asset>();
      assetsStore.assets.forEach(asset => originalStateMap.set(asset.id, asset));

      // Categorize DELETED assets
      state.pendingChanges.deleted.forEach((deletedAsset, id) => {
          deleted.push({ oldState: deletedAsset });
      });

      // Categorize ADDED and MODIFIED assets
      state.pendingChanges.upserted.forEach((upsertedAsset, id) => {
        const originalAsset = originalStateMap.get(id);
        if (!originalAsset) {
          // If it's in upserted but not in the original map, it's a new asset.
          added.push({ newState: upsertedAsset });
        } else {
          // It exists in both, so it might be modified.
          const originalDetail = assetsStore.assetDetails.get(id)?.unmerged;
          if (originalDetail) {
            const diff = generateAssetDiff(originalDetail, upsertedAsset);
            if (diff.length > 0) {
              modified.push({ newState: upsertedAsset, oldState: originalDetail, diff });
            }
          }
        }
      });

      return { modified, added, deleted };
    },

    validationStatusMap(state): Map<string, 'error' | 'warning'> {
      const statusMap = new Map<string, 'error' | 'warning'>();

      for (const issue of this.validationIssues) {
        const currentStatus = statusMap.get(issue.assetId);

        if (issue.severity === 'error') {
          statusMap.set(issue.assetId, 'error');
        } else if (issue.severity === 'warning' && !currentStatus) {
          statusMap.set(issue.assetId, 'warning');
        }
      }

      return statusMap;
    },

    validationIssues(state): ValidationIssue[] {
      const assetsStore = useAssetsStore();
      const unmergedAssets = assetsStore.unmergedAssets;
      const allIssues: ValidationIssue[] = [];

      if (!unmergedAssets || unmergedAssets.length === 0) {
        return [];
      }

      unmergedAssets.forEach(asset => {
        // --- 1. Run Generic Core Rules ---
        if (!asset.assetKey || !asset.assetKey.trim()) {
          allIssues.push({
            id: `${asset.id}-empty-name`,
            severity: 'error',
            message: `Asset has an empty or invalid name.`,
            assetName: asset.assetKey || '(unnamed)',
            assetType: asset.assetType,
            assetId: asset.id,
          });
        }

        // --- 2. Run Pluggable Content Rules ---
        const rulesForType = getValidationRulesForType(asset.assetType);
        for (const rule of rulesForType) {
          const issue = rule(asset, unmergedAssets);
          if (issue) {
            allIssues.push(issue);
          }
        }
      });

      return allIssues;
    }
  },

  actions: {
    
    // REMOVE THE FOLLOWING ACTIONS:
    // setActivePane(paneId: string | null) { ... }
    // setActiveContextMenu(menuId: string | null) { ... }
    // setNodeToExpand(nodeId: string | null) { ... }

    // Delegate to UI store for dialog management
    openNewAssetDialog({ parentAsset = null, childType = null, namespace = null }: {   
      parentAsset?: Asset | null;   
      childType?: string | null;   
      namespace?: string | null;   
    } = {}): void {
      const uiStore = useUiStore();
      uiStore.promptForNewAsset({ parentAsset, childType, namespace });
    },
    // Delegate to UI store for folder dialog management
    openNewFolderDialog(parentFqn: string | null): void {
      const uiStore = useUiStore();
      uiStore.promptForNewFolder(parentFqn);
    },

    // Execute cross-distro copy with "Flatten and Rebase" logic
    async executeCrossDistroCopy(dragPayload: any, dropTarget: any) {
      const assetsStore = useAssetsStore();
      const sourcePackage = assetsStore.unmergedAssets.find(a => a.id === dragPayload.assetId);
      const targetNode = assetsStore.unmergedAssets.find(a => a.id === dropTarget.id);

      if (!sourcePackage || !targetNode) {
        console.error("Cannot execute cross-distro copy: source or target not found.");
        return;
      }

      // Import the hook from the content layer
      const { crossDistroCloneHook } = await import('@/content/config/interactions/packageAssignmentInteractions');
      const { ASSET_TYPES } = await import('@/content/config/constants');

      // This is the core logic that executes on confirmation
      const commands = [];

      // Command 1: The "Flatten and Rebase" Clone
      const cloneCommand = new CloneAssetCommand(
        sourcePackage.id,
        targetNode.fqn,
        sourcePackage.assetKey,
        crossDistroCloneHook // The injectable hook is passed here
      );
      commands.push(cloneCommand);

      // Command 2: Create the PackageKey
      const keyCreateCommand = new CreateAssetCommand({
        assetType: ASSET_TYPES.PACKAGE_KEY,
        assetKey: sourcePackage.assetKey,
        fqn: `${targetNode.fqn}::${sourcePackage.assetKey}`,
        templateFqn: null,
        overrides: {},
      });
      commands.push(keyCreateCommand);

      this.executeCommand(new CompositeCommand(commands));
    },

    // Execute clear overrides action
    executeClearOverrides(assetId: string) {
      const assetsStore = useAssetsStore();
      const assetDetails = assetsStore.getUnmergedDetails(assetId);
      if (!assetDetails) {
        console.error(`Cannot clear overrides: Asset with ID ${assetId} not found.`);
        return;
      }

      const oldData = assetDetails.unmerged;
      const newData = cloneDeep(oldData);
      newData.overrides = {}; // The core of the operation

      const command = new UpdateAssetCommand(assetId, oldData, newData);
      this.executeCommand(command);
    },

    // Execute template change action
    executeTemplateChange(assetId: string, newTemplateFqn: string | null) {
      const assetsStore = useAssetsStore();
      const assetDetails = assetsStore.getUnmergedDetails(assetId);
      if (!assetDetails) {
        console.error(`Cannot change template: Asset with ID ${assetId} not found.`);
        return;
      }

      const oldData = assetDetails.unmerged;
      const newData = cloneDeep(oldData);
      newData.templateFqn = newTemplateFqn;

      const command = new UpdateAssetCommand(assetId, oldData, newData);
      this.executeCommand(command);
    },
    // ---------------------

    
    // Execute a command and add to undo stack
    executeCommand(command: Command): void {
      this.invalidateAllCaches();
      const assetsStore = useAssetsStore(); // Get the store instance here
      try {
        // Pass both `this` (the workspace) and the assetsStore to the command
        command.execute(this, assetsStore); 
        this.undoStack.push(command);
        this.redoStack = []; // Clear redo stack when new command is executed
      } catch (error) {
        console.error('Failed to execute command:', error);
        throw error;
      }
    },
    
    // Undo the last command
    undo(): void {
      this.invalidateAllCaches();
      if (!this.canUndo) return
      
      const command = this.undoStack.pop()!
      try {
        command.unexecute(this)
        this.redoStack.push(command)
      } catch (error) {
        console.error('Failed to undo command:', error)
        // Re-add to undo stack if unexecute failed
        this.undoStack.push(command)
        throw error
      }
    },
    
    // Redo the last undone command
    redo(): void {
      this.invalidateAllCaches();
      if (!this.canRedo) return;
      
      const command = this.redoStack.pop()!;
      const assetsStore = useAssetsStore(); // FIX: Get the assetsStore instance
      try {
        command.execute(this, assetsStore); // FIX: Pass it as the second argument
        this.undoStack.push(command);
      } catch (error) {
        console.error('Failed to redo command:', error);
        this.redoStack.push(command);
        throw error;
      }
    },
    
    // Update an asset's data (used by commands)
    updateAsset(asset: UnmergedAsset): void {
      this.pendingChanges.upserted.set(asset.id, asset)
    },
    
    // Delete an asset (used by commands)  
    deleteAsset(asset: UnmergedAsset): void { // <-- It's better to pass the whole asset
      this.pendingChanges.deleted.set(asset.id, asset); // <-- CHANGE THIS LINE
      this.pendingChanges.upserted.delete(asset.id);
    },
        
    // Restore an asset from deletion (used by undo)
    restoreAsset(asset: UnmergedAsset): void {
      const assetsStore = useAssetsStore();
      // Always remove it from the "deleted" set
      this.pendingChanges.deleted.delete(asset.id);

      // If the asset does NOT exist in the original committed list,
      // it must have been a new creation. We must put it back in the "upserted" map
      // to make it reappear as a pending change.
      if (!assetsStore.getAsset(asset.id)) {
        this.pendingChanges.upserted.set(asset.id, asset);
      }
      // If it DID exist in the original committed list, we do nothing else.
      // This correctly restores it without creating a "ghost change".
    },

    // Save all pending changes
    async saveChanges(): Promise<boolean> {
      if (!this.hasUnsavedChanges) return true
      
      this.saving = true
      try {
        const coreConfig = useCoreConfigStore();
        if (!coreConfig.persistenceAdapter) throw new Error("Persistence adapter not registered.");
        
        const savedChangeSet = this.changeSet;

        await coreConfig.persistenceAdapter.commitChanges(savedChangeSet)
        
        const assetsStore = useAssetsStore();
        
        const reloadPromises = savedChangeSet.upserted.map(asset => {
          const treeNode = createTreeNodeFromAssetId(asset.id);
          return treeNode ? assetsStore.loadAssetDetails(treeNode, { force: true }) : Promise.resolve();
        }).filter(promise => promise !== Promise.resolve());
        savedChangeSet.deleted.forEach(assetId => assetsStore.assetDetails.delete(assetId));
        
        await Promise.all(reloadPromises);
        
        await assetsStore.loadAssets(); // Refresh the main asset list

        this.pendingChanges.upserted.clear()
        this.pendingChanges.deleted.clear()
        this.undoStack = []
        this.redoStack = []
        this.lastSaved = new Date()
        
        return true
      } catch (error) {
        console.error('Failed to save changes:', error)
        throw error
      } finally {
        this.saving = false
      }
    },
    
    // Discard all pending changes
    discardChanges(): void {
      this.invalidateAllCaches();
      this.pendingChanges.upserted.clear()
      this.pendingChanges.deleted.clear()
      this.undoStack = []
      this.redoStack = []
    },

    /**
     * Performs a "dry run" of an FQN change to find all cascading changes.
     * This is now generic and used by both Rename and Move.
     * PREVIOUSLY NAMED: calculateRenameConsequences
     */
    calculateFqnChangeConsequences({ assetId, newFqn }: { assetId: string; newFqn: string }) {
      const assetsStore = useAssetsStore();
      const assetToRefactor = assetsStore.unmergedAssets.find(a => a.id === assetId);
      if (!assetToRefactor) return { fqnUpdates: [], templateLinkUpdates: [], linkedOverrideUpdates: [] };

      const oldFqn = assetToRefactor.fqn;

      const fqnUpdates: any[] = [];
      const templateLinkUpdates: any[] = [];
      const linkedOverrideUpdates: any[] = [];

      // Find all descendants and calculate their new FQNs
      assetsStore.unmergedAssets.forEach(asset => {
        if (asset.fqn.startsWith(oldFqn + '::')) {
          const newChildFqn = asset.fqn.replace(oldFqn, newFqn);
          fqnUpdates.push({
            assetId: asset.id,
            assetKey: asset.assetKey,
            oldFqn: asset.fqn,
            newFqn: newChildFqn
          });
        }
      });

      // Find all assets that use the old FQN as a template
      assetsStore.unmergedAssets.forEach(asset => {
        if (asset.templateFqn === oldFqn) {
          templateLinkUpdates.push({
            assetId: asset.id,
            assetKey: asset.assetKey,
            oldTemplateFqn: oldFqn,
            newTemplateFqn: newFqn
          });
        }
      });

      // Note: Do not include the primary asset itself here; callers track it separately.

      // New: Detect linked overrides when renaming a child of a template parent
      const oldParts = oldFqn.split('::');
      if (oldParts.length > 1) {
        const parentFqn = oldParts.slice(0, -1).join('::');
        const oldAssetKey = oldParts[oldParts.length - 1];
        const newAssetKey = newFqn.split('::').pop() as string;

        // Find assets that inherit from the parent template
        const inheritingAssets = assetsStore.unmergedAssets.filter(a => a.templateFqn === parentFqn);
        for (const inheriting of inheritingAssets) {
          const overrideChildFqn = `${inheriting.fqn}::${oldAssetKey}`;
          const overrideChild = assetsStore.unmergedAssets.find(a => a.fqn === overrideChildFqn);
          if (overrideChild) {
            const newOverrideFqn = `${inheriting.fqn}::${newAssetKey}`;
            linkedOverrideUpdates.push({
              assetId: overrideChild.id,
              oldAssetKey: overrideChild.assetKey,
              newAssetKey,
              oldFqn: overrideChild.fqn,
              newFqn: newOverrideFqn
            });
          }
        }
      }

      return { fqnUpdates, templateLinkUpdates, linkedOverrideUpdates };
    },

    invalidateAllCaches() {
      this._invalidateRippleCache();
      // When you add more caches, you'll add their invalidation calls here.
      // e.g., this._invalidateValidationCache();
    },

    _invalidateRippleCache() {
      this._rippleEffectCache = null;
    },

    calculateRippleEffect(): void {
      const assetsStore = useAssetsStore();
      this._rippleEffectCache = null; // Invalidate cache at the start

      if (!this.hasUnsavedChanges || assetsStore.assets.length === 0) {
        this._rippleEffectCache = new Map();
        return;
      }

      // --- 1. Construct "Before" and "After" states IN MEMORY ---
      const dbBefore = new Map<string, UnmergedAsset>();
      assetsStore.assets.forEach(asset => {
        const details = assetsStore.assetDetails.get(asset.id);
        if (details) {
          dbBefore.set(asset.id, details.unmerged);
        }
      });
      
      const dbAfter = new Map(dbBefore);
      this.pendingChanges.upserted.forEach((asset, id) => dbAfter.set(id, asset));
      this.pendingChanges.deleted.forEach((asset, id) => dbAfter.delete(id));
      
      // --- 2. Identify Changed Templates & Build Dependency Map ---
      const templateMap = new Map<string, string[]>(); // Key: templateFqn, Value: assetId[]
      assetsStore.assets.forEach(asset => {
        if (asset.templateFqn) {
          if (!templateMap.has(asset.templateFqn)) {
            templateMap.set(asset.templateFqn, []);
          }
          templateMap.get(asset.templateFqn)!.push(asset.id);
        }
      });
      
      const changedTemplateFqns = new Set<string>();
      this.pendingChanges.upserted.forEach(asset => {
        if (templateMap.has(asset.fqn)) {
          changedTemplateFqns.add(asset.fqn);
        }
      });
      if (changedTemplateFqns.size === 0) {
        this._rippleEffectCache = new Map();
        return;
      }

      // --- 3. Find All Affected Assets via Traversal ---
      const affectedAssetIds = new Set<string>();
      const queue = [...changedTemplateFqns];
      const visited = new Set(queue);
      while (queue.length > 0) {
        const currentFqn = queue.shift()!;
        const childrenIds = templateMap.get(currentFqn) || [];
        for (const childId of childrenIds) {
            affectedAssetIds.add(childId);
            const childAsset = assetsStore.getAsset(childId);
            if(childAsset && !visited.has(childAsset.fqn)) {
                visited.add(childAsset.fqn);
                queue.push(childAsset.fqn);
            }
        }
      }

      // --- 4. Calculate Diffs for Affected Assets ---
      const rippleDiffs: ChangeItem[] = [];
      affectedAssetIds.forEach(assetId => {
        if (this.pendingChanges.upserted.has(assetId)) return;

        const stateBefore = calculateMergedAsset(assetId, dbBefore);
        const stateAfter = calculateMergedAsset(assetId, dbAfter);

        if ('properties' in stateBefore && 'properties' in stateAfter) {
          const diff = generatePropertiesDiff(stateBefore.properties, stateAfter.properties);
          if (diff.length > 0) {
            const assetInfo = assetsStore.getAsset(assetId);
            if (assetInfo) {
              rippleDiffs.push({ newState: assetInfo, diff });
            }
          }
        }
      });
      
      // --- 5. Group by Distro and Cache the Result ---
      const groupedByEnv = new Map<string, ChangeItem[]>();
      rippleDiffs.forEach(item => {
        const fqnParts = item.newState.fqn.split('::');
        const envName = fqnParts.length > 1 ? fqnParts[0] : '(Global)';
        if (!groupedByEnv.has(envName)) {
          groupedByEnv.set(envName, []);
        }
        groupedByEnv.get(envName)!.push(item);
      });
      
      this._rippleEffectCache = groupedByEnv;
    },

    /**
     * Initiates the rename process. It will either execute directly
     * or set state to prompt for user confirmation if there are ripple effects.
     */
    async renameAsset(assetId: string, newAssetKey: string) {
      const assetsStore = useAssetsStore();
      // Ensure the full asset details are loaded before proceeding
      const treeNode = createTreeNodeFromAssetId(assetId);
      if (treeNode) {
        await assetsStore.loadAssetDetails(treeNode);
      }
        
      const assetToRename = assetsStore.unmergedAssets.find(a => a.id === assetId);
      if (!assetToRename) {
        console.error("Rename failed: Could not find asset with ID", assetId);
        return;
      }

      const oldFqn = assetToRename.fqn;
      const fqnParts = oldFqn.split('::');
      fqnParts[fqnParts.length - 1] = newAssetKey;
      const newFqn = fqnParts.join('::');

      const consequences = this.calculateFqnChangeConsequences({ assetId, newFqn });
        
      const fullConsequences: RefactorConsequences = {
        ...consequences,
        oldFqn,
        newFqn,
        oldAssetKey: assetToRename.assetKey,
        newAssetKey,
      };

      const hasRippleEffect = consequences.fqnUpdates.length > 0 || consequences.templateLinkUpdates.length > 0;

      if (hasRippleEffect) {
        // Logic has consequences, so we pause and ask the user for confirmation.
        // Delegate to UI store for confirmation dialog
        const uiStore = useUiStore();
        uiStore.promptForRefactor({
          mode: 'rename',
          assetId,
          consequences: fullConsequences,
          show: true
        });
      } else {
        // Simple rename with no side effects. Execute it directly.
        const command = new ApplyRefactoringCommand(
          assetId,
          oldFqn,
          newFqn,
          fullConsequences,
          { old: assetToRename.assetKey, new: newAssetKey }
        );
        this.executeCommand(command);
      }
    },

    /**
     * Executes the refactoring after the user has confirmed via the dialog.
     * UI components pass the confirmation data when calling this method.
     */
    confirmRefactor(refactorData: { mode: string, assetId: string, consequences: any }) {
      const { mode, assetId, consequences } = refactorData;
      const { oldFqn, newFqn, oldAssetKey, newAssetKey } = consequences;

      const assetKeyChange = mode === 'rename' ? { old: oldAssetKey, new: newAssetKey } : null;

      const command = new ApplyRefactoringCommand(
        assetId,
        oldFqn,
        newFqn,
        consequences,
        assetKeyChange
      );
      this.executeCommand(command);

      // Clear UI state through uiStore
      const uiStore = useUiStore();
      uiStore.clearActionStates();
    },

    /**
     * Cancels the refactoring and closes the confirmation dialog.
     */
    cancelRefactor() {
      const uiStore = useUiStore();
      uiStore.clearActionStates();
    },

    /**
     * Initiates the move process. Similar to rename but changes the asset's position in the hierarchy.
     */
    async moveAsset(draggedAssetId: string, newParentFqn: string | null) {
      const assetsStore = useAssetsStore();
      const treeNode = createTreeNodeFromAssetId(draggedAssetId);
      if (treeNode) {
        await assetsStore.loadAssetDetails(treeNode);
      }
        
      const draggedAsset = assetsStore.unmergedAssets.find(a => a.id === draggedAssetId);
      if (!draggedAsset) {
        console.error("Move failed: Could not find asset with ID", draggedAssetId);
        return;
      }

      const oldFqn = draggedAsset.fqn;
      const newFqn = newParentFqn ? `${newParentFqn}::${draggedAsset.assetKey}` : draggedAsset.assetKey;

      const consequences = this.calculateFqnChangeConsequences({ assetId: draggedAssetId, newFqn });
        
      const fullConsequences: RefactorConsequences = {
        ...consequences,
        oldFqn,
        newFqn,
        oldAssetKey: draggedAsset.assetKey,
        newAssetKey: draggedAsset.assetKey, // assetKey doesn't change on move
      };

      const hasRippleEffect = consequences.fqnUpdates.length > 0 || consequences.templateLinkUpdates.length > 0;

      if (hasRippleEffect) {
        // Delegate to UI store for confirmation
        const uiStore = useUiStore();
        uiStore.promptForRefactor({
          mode: 'move',
          assetId: draggedAssetId,
          consequences: fullConsequences,
          show: true
        });
      } else {
        const command = new ApplyRefactoringCommand(
          draggedAssetId,
          oldFqn,
          newFqn,
          fullConsequences,
          null // no assetKey change for moves
        );
        this.executeCommand(command);
      }
    },

    /**
     * Scans the current asset list for virtual parent folders and creates them
     * as new, pending assets. This makes the project structure whole.
     */
    normalizeAssetStructure(): void {
      const assetsStore = useAssetsStore();
      const coreConfigStore = useCoreConfigStore();
      const folderAssetType = coreConfigStore.structuralAssetType;

      if (!folderAssetType) {
        console.error("normalizeAssetStructure cannot run: Structural asset type has not been configured in CoreConfigStore.");
        return;
      }

      const allAssetFqns = new Set(assetsStore.unmergedAssets.map(a => a.fqn));
      const commandsToExecute: CreateFolderCommand[] = [];

      assetsStore.unmergedAssets.forEach(asset => {
        const parts = asset.fqn.split('::');
        if (parts.length > 1) {
          for (let i = 1; i < parts.length; i++) {
            const parentFqn = parts.slice(0, i).join('::');
            if (!allAssetFqns.has(parentFqn)) {
              const parentOfParentFqn = i > 1 ? parts.slice(0, i - 1).join('::') : '';
              const folderName = parts[i - 1];
              
              commandsToExecute.push(new CreateFolderCommand(parentOfParentFqn, folderName));
              
              allAssetFqns.add(parentFqn);
            }
          }
        }
      });
      
      if (commandsToExecute.length > 0) {
        this.redoStack = [];
        commandsToExecute.forEach(cmd => {
          cmd.execute(this, assetsStore);
          this.undoStack.push(cmd);
        });
      }
    },

    // --- ADD THE NEW DELETION ACTIONS ---

    /**
     * Performs an impact analysis for deleting an asset.
     */
    calculateDeletionImpact(assetId: string) {
      const assetsStore = useAssetsStore();
      const assetToDelete = assetsStore.unmergedAssets.find(a => a.id === assetId);
      if (!assetToDelete) return { deletableChildren: [], blockingDependencies: [] };

      const fqnsToDelete = new Set([assetToDelete.fqn]);
      const deletableChildren: Asset[] = [];

      // 1. Find all descendant assets
      assetsStore.unmergedAssets.forEach(asset => {
        if (asset.id !== assetId && asset.fqn.startsWith(assetToDelete.fqn + '::')) {
          fqnsToDelete.add(asset.fqn);
          deletableChildren.push(asset);
        }
      });

      // 2. Find any assets that use the target or its descendants as a template
      const blockingDependencies = assetsStore.unmergedAssets.filter(asset =>
        asset.templateFqn &&
        !fqnsToDelete.has(asset.fqn) && // Ensure it's not an asset that's already being deleted
        fqnsToDelete.has(asset.templateFqn)
      );

      return { deletableChildren, blockingDependencies };
    },

    /**
     * 1. RENAME `initiateDelete` to `requestAssetDeletion`.
     * This is the single entry point for any component wanting to delete an asset.
     */
    requestAssetDeletion(assetId: string): void {
      const coreConfig = useCoreConfigStore();
      const assetsStore = useAssetsStore();
      
      const asset: UnmergedAsset | undefined = assetsStore.unmergedAssets.find(a => a.id === assetId);
      if (!asset) return;

      // Calculate all assets that would be deleted
      const assetsToDelete = [asset];
      const definition = coreConfig.getAssetDefinition(asset.assetType);
      const isContainer = definition?.isStructuralFolder || (definition && definition.validChildren.length > 0);

      if (isContainer) {
        const descendants: UnmergedAsset[] = assetsStore.unmergedAssets.filter(a =>
          a.fqn !== asset.fqn && a.fqn.startsWith(asset.fqn + '::')
        );
        assetsToDelete.push(...descendants);
      }

      const impact = this.calculateDeletionImpact(assetId);

      // Delegate to UI store for dialog management
      const uiStore = useUiStore();
      if (impact.blockingDependencies.length > 0) {
        uiStore.promptForBlockedDeletion({ asset, impact });
      } else {
        uiStore.promptForDeletion({ asset, impact: { deletableChildren: assetsToDelete.slice(1) } });
      }
    },

    /**
     * Execute deletion of assets. Called by UI components when deletion is confirmed.
     * Retrieves deletion data from uiStore and executes business logic.
     */
    confirmDeletion(): void {
      const uiStore = useUiStore();
      const { asset, impact } = uiStore.deleteConfirmationDialog;
      if (!asset) return;
      
      // Re-create the list of assets to delete from the UI store's state
      const assetsToDelete = [asset, ...impact.deletableChildren];

      if (assetsToDelete.length > 0) {
        const command = new DeleteAssetsCommand(assetsToDelete as UnmergedAsset[]);
        this.executeCommand(command);
      }
      
      // Clear UI state through uiStore
      uiStore.clearActionStates();
    },

    /**
     * Cancel deletion workflow. Called by UI components when deletion is cancelled.
     * Delegates UI state management to uiStore.
     */
    cancelDeletion(): void {
      const uiStore = useUiStore();
      uiStore.clearActionStates();
    },
    // --- END NEW DELETION ACTIONS ---

    // New centralized workflow action
    async createNewAssetAndSelect(newAssetObject: Omit<UnmergedAsset, 'id'>) {
      const assetsStore = useAssetsStore();
      const uiStore = useUiStore();

      // 1. Create and execute the command to generate the asset
      const command = new CreateAssetCommand(newAssetObject);
      this.executeCommand(command);
      const createdAsset = command.newAsset;

      if (!createdAsset) {
        console.error("Asset creation failed.");
        return;
      }
        
      // 2. Expand the parent node in the asset tree
      if (uiStore.newAssetDialog.parentAsset) {
        uiStore.nodesToExpand.add(uiStore.newAssetDialog.parentAsset.id);
      }

      // 3. Select the new asset in the UI (this will automatically load details and open inspector via EditorWorkbench watcher)
      uiStore.selectNode({ id: createdAsset.id, type: 'asset', name: createdAsset.assetKey, path: createdAsset.fqn });
    }
  }
})

// Command pattern implementations for undo/redo

export class ApplyRefactoringCommand implements Command {
  private primaryAssetId: string;
  private oldFqn: string;
  private newFqn: string;
  private oldAssetKey: string | null;
  private newAssetKey: string | null;
  private cascadingChanges: CascadingChanges;

  constructor(
    primaryAssetId: string,
    oldFqn: string,
    newFqn: string,
    cascadingChanges: CascadingChanges,
    assetKeyChange: { old: string, new: string } | null = null
  ) {
    this.primaryAssetId = primaryAssetId;
    this.oldFqn = oldFqn;
    this.newFqn = newFqn;
    this.cascadingChanges = cascadingChanges;
    this.oldAssetKey = assetKeyChange ? assetKeyChange.old : null;
    this.newAssetKey = assetKeyChange ? assetKeyChange.new : null;
  }

  private _apply(workspace: any, direction: 'execute' | 'unexecute'): void {
    const assetsStore = useAssetsStore();
    const isExecuting = direction === 'execute';

    const applyChange = (assetId: string, changes: Record<string, any>) => {
      const currentAsset = workspace.pendingChanges.upserted.get(assetId) ||
                          assetsStore.getAssetDetails(assetId)?.unmerged;
      if (!currentAsset) return;

      const updatedAsset = cloneDeep(currentAsset);
      Object.assign(updatedAsset, changes);

      const originalCommittedAsset = assetsStore.getAssetDetails(assetId)?.unmerged;
      const wasCommitted = !!assetsStore.getAsset(assetId);

      if (!isExecuting && wasCommitted && isEqual(updatedAsset, originalCommittedAsset)) {
        workspace.pendingChanges.upserted.delete(assetId);
      } else {
        workspace.updateAsset(updatedAsset);
      }
    };

    // Apply primary change
    const primaryChanges: Record<string, any> = { fqn: isExecuting ? this.newFqn : this.oldFqn };
    if (this.newAssetKey !== null && this.oldAssetKey !== null) {
      primaryChanges.assetKey = isExecuting ? this.newAssetKey : this.oldAssetKey;
    }
    applyChange(this.primaryAssetId, primaryChanges);

    // Apply cascading FQN updates
    this.cascadingChanges.fqnUpdates.forEach((c: any) => {
      applyChange(c.assetId, { fqn: isExecuting ? c.newFqn : c.oldFqn });
    });
    // Apply cascading template updates
    this.cascadingChanges.templateLinkUpdates.forEach((c: any) => {
      applyChange(c.assetId, { templateFqn: isExecuting ? c.newTemplateFqn : c.oldTemplateFqn });
    });

    // Apply linked override updates (rename overridden children to keep links)
    if (this.cascadingChanges.linkedOverrideUpdates && this.cascadingChanges.linkedOverrideUpdates.length > 0) {
      this.cascadingChanges.linkedOverrideUpdates.forEach((c: any) => {
        applyChange(c.assetId, {
          assetKey: isExecuting ? c.newAssetKey : c.oldAssetKey,
          fqn: isExecuting ? c.newFqn : c.oldFqn
        });
      });
    }
  }

  execute(workspace: any): void {
    console.log('[DEBUG 4] ApplyRefactoringCommand: execute triggered.');
    this._apply(workspace, 'execute');
  }

  unexecute(workspace: any): void {
    this._apply(workspace, 'unexecute');
  }
}

export class MoveAssetCommand implements Command {
  constructor(
    public assetId: string,
    public oldOrigin: string,
    public newOrigin: string,
    public oldFqn: string,
    public newFqn: string
  ) {}
  
  execute(workspace: any): void {
    console.log(`Moving ${this.assetId}: ${this.oldOrigin} -> ${this.newOrigin}`)
  }
  
  unexecute(workspace: any): void {
    console.log(`Reverting move ${this.assetId}: ${this.newOrigin} -> ${this.oldOrigin}`)
  }
}

export class UpdateAssetCommand implements Command {
  private oldData: UnmergedAsset;
  private newData: UnmergedAsset;

  constructor(assetId: string, oldData: UnmergedAsset, newData: UnmergedAsset) {
    this.oldData = cloneDeep(oldData);
    this.newData = cloneDeep(newData);
  }

  execute(workspace: any): void {
    // Prevent updating read-only assets (e.g., virtual assets)
    const assetsStore = useAssetsStore();
    const assetDetails = assetsStore.getAssetDetails(this.newData.id);
    if (assetDetails?.isReadOnly) {
      console.warn(`Attempted to update read-only asset ${this.newData.id}. Operation blocked.`);
      return;
    }
    
    workspace.updateAsset(this.newData)
  }
  
  unexecute(workspace: any): void {
    const assetsStore = useAssetsStore();
    // Get the original, pristine state of the asset from before any changes.
    const originalCommittedAsset = assetsStore.getAssetDetails(this.oldData.id)?.unmerged;

    // Compare the state we are reverting to (this.oldData) with the original committed state.
    if (isEqual(this.oldData, originalCommittedAsset)) {
      // If they are the same, this undo removes all pending changes for this asset.
      // So, we remove it from the 'upserted' map.
      workspace.pendingChanges.upserted.delete(this.oldData.id);
    } else {
      // If they are different, it means there were other changes before this one.
      // In this case, we just revert to the previous state in the undo stack.
      workspace.updateAsset(this.oldData);
    }
  }

}


export class CreateAssetCommand implements Command {
  public newAsset: UnmergedAsset;
  /**
   * @param newAssetObject - The complete, normalized asset object to create.
   */
  constructor(newAssetObject: Omit<UnmergedAsset, 'id'>) {
    const coreConfig = useCoreConfigStore();
    const definition = coreConfig.getAssetDefinition(newAssetObject.assetType);
    const initialOverrides = definition?.initialOverrides || {};
    this.newAsset = {
      ...newAssetObject,
      id: generateUUID(),
      overrides: { ...initialOverrides, ...(newAssetObject.overrides || {}) }
    } as UnmergedAsset;
  }

  execute(workspace: any): void {
    const assetsStore = useAssetsStore();
    workspace.pendingChanges.upserted.set(this.newAsset.id, this.newAsset);
    
    // Pre-populate the details cache
    const newAssetDetails: AssetDetails = {
      unmerged: this.newAsset,
      merged: null,
    };
    assetsStore.assetDetails.set(this.newAsset.id, newAssetDetails);
  }

  unexecute(workspace: any): void {
    const assetsStore = useAssetsStore();
    workspace.pendingChanges.upserted.delete(this.newAsset.id);
    assetsStore.closeInspectorByAssetId(this.newAsset.id);

    // Also remove it from the details cache
    assetsStore.assetDetails.delete(this.newAsset.id);
  }
}

export class CreateFolderCommand implements Command {
  public newFolder: UnmergedAsset;

  constructor(parentFqn: string, newFolderName: string) {
    const fqn = parentFqn ? `${parentFqn}::${newFolderName}` : newFolderName;
    const coreConfigStore = useCoreConfigStore();
    if (!coreConfigStore.structuralAssetType) {
      throw new Error("Cannot create folder: Structural asset type has not been configured.");
    }
    
    this.newFolder = {
      id: generateUUID(),
      fqn,
      assetType: coreConfigStore.structuralAssetType as UnmergedAsset['assetType'],
      assetKey: newFolderName,
      templateFqn: null,
      overrides: {}
    };
  }

  execute(workspace: any, assetsStore: any): void {
    workspace.pendingChanges.upserted.set(this.newFolder.id, this.newFolder);
    
    const newFolderDetails: AssetDetails = {
      unmerged: this.newFolder,
      merged: null,
    };
    assetsStore.assetDetails.set(this.newFolder.id, newFolderDetails);
  }

  unexecute(workspace: any): void {
    const assetsStore = useAssetsStore();
    // Remove the folder from pending changes and close its inspector if open.
    workspace.pendingChanges.upserted.delete(this.newFolder.id);
    assetsStore.closeInspectorByAssetId(this.newFolder.id);

    // Also remove it from the details cache
    assetsStore.assetDetails.delete(this.newFolder.id);
  }
}

export class DeleteAssetsCommand implements Command {
  constructor(public assetsToDelete: UnmergedAsset[]) {}

  execute(workspace: any): void {
    // This is a batch delete. The logic is generic enough.
    // We store the full asset object to allow for a perfect undo.
    this.assetsToDelete.forEach(asset => {
      workspace.pendingChanges.deleted.set(asset.id, asset);
    });
  }

  unexecute(workspace: any): void {
    // On undo, remove the assets from the "deleted" list.
    // The `restoreAsset` logic will correctly handle re-adding them
    // to "upserted" if they were brand new.
    this.assetsToDelete.forEach(asset => {
      workspace.restoreAsset(asset);
    });
  }
}

export class DeleteAssetCommand implements Command {
  public backfilledFolders: UnmergedAsset[] = [];

  /**
   * @param assetsToDelete - An array of the full, unmerged asset objects to be deleted.
   */
  constructor(public assetsToDelete: UnmergedAsset[]) {}

  execute(workspace: any): void {
    const assetsStore = useAssetsStore();
    
    // If deleting a NamespaceFolder, find all descendant assets
    const allAssetsToDelete = this.findAllDescendants(workspace);
    
    // Delete all assets
    allAssetsToDelete.forEach(asset => {
      workspace.deleteAsset(asset.id);
      assetsStore.closeInspectorByAssetId(asset.id);
    });

    // Perform backfilling for functional assets (non-folders)
    this.assetsToDelete.forEach(asset => {
      const coreConfig = useCoreConfigStore();
      if (!coreConfig.getAssetDefinition(asset.assetType)?.isStructuralFolder) {
        this.backfillFolders(workspace, asset.fqn);
      }
    });
  }

  unexecute(workspace: any): void {
    // Remove backfilled folders first
    this.backfilledFolders.forEach(folder => {
      workspace.pendingChanges.upserted.delete(folder.id);
    });
    this.backfilledFolders = [];

    // Restore the original asset objects
    this.assetsToDelete.forEach(asset => {
      workspace.restoreAsset(asset);
    });
  }

  private findAllDescendants(workspace: any): UnmergedAsset[] {
    const assetsStore = useAssetsStore();
    const allAssets = [...this.assetsToDelete];
    
    this.assetsToDelete.forEach(asset => {
      const coreConfig = useCoreConfigStore();
      if (coreConfig.getAssetDefinition(asset.assetType)?.isStructuralFolder) {
        // Find all assets whose FQN starts with this folder's FQN
        const descendants = assetsStore.assets.filter(a => 
          a.fqn.startsWith(asset.fqn + '::') && !allAssets.some(existing => existing.id === a.id)
        );
        allAssets.push(...descendants.map(a => ({ ...a, overrides: {} } as UnmergedAsset)));
      }
    });
    
    return allAssets;
  }

  private backfillFolders(workspace: any, deletedAssetFqn: string): void {
    const assetsStore = useAssetsStore();
    const fqnParts = deletedAssetFqn.split('::');
    
    // Create NamespaceFolder assets for each parent level if they don't exist
    for (let i = 1; i < fqnParts.length; i++) {
      const parentFqn = fqnParts.slice(0, i).join('::');
      
      // Check if parent folder exists as a real asset or pending change
      const existingAsset = assetsStore.assets.find(asset => asset.fqn === parentFqn);
      const pendingAsset = Array.from(workspace.pendingChanges.upserted.values())
        .find((asset: any) => asset.fqn === parentFqn);
      
      if (!existingAsset && !pendingAsset) {
        const coreConfig = useCoreConfigStore();
        const backfilledFolder: UnmergedAsset = {
          id: generateUUID(),
          fqn: parentFqn,
          assetType: coreConfig.structuralAssetType,
          assetKey: fqnParts[i - 1],
          templateFqn: null,
          overrides: {}
        } as UnmergedAsset;
        
        workspace.pendingChanges.upserted.set(backfilledFolder.id, backfilledFolder);
        this.backfilledFolders.push(backfilledFolder);
      }
    }
  }
}

/**
 * Command to create a new asset that derives from a source asset.
 * This sets the new asset's templateFqn to the source asset's fqn.
 */
export class DeriveAssetCommand implements Command {
  public derivedAsset: UnmergedAsset;

  constructor(
    sourceAsset: UnmergedAsset,
    newParentFqn: string | null,
    newAssetKey: string
  ) {
    const fqn = newParentFqn ? `${newParentFqn}::${newAssetKey}` : newAssetKey;

    this.derivedAsset = {
      id: generateUUID(),
      fqn,
      assetType: sourceAsset.assetType,
      assetKey: newAssetKey,
      // This is the core of the "Derive" action: link to the source asset.
      templateFqn: sourceAsset.fqn,
      // A derived asset always starts with no overrides.
      overrides: {}
    };
  }

  public execute(workspace: any, assetsStore: any): void {
    // Add the new asset to the pending changes.
    workspace.pendingChanges.upserted.set(this.derivedAsset.id, this.derivedAsset);

    // Pre-populate the asset details cache for a smooth UI experience.
    // This ensures the new asset appears immediately in the inspector if selected.
    assetsStore.assetDetails.set(this.derivedAsset.id, {
      unmerged: this.derivedAsset,
      merged: null,
    });
  }

  public unexecute(workspace: any): void {
    // Remove the asset from pending changes to undo the action.
    workspace.pendingChanges.upserted.delete(this.derivedAsset.id);

    // Clean up related state.
    useAssetsStore().closeInspectorByAssetId(this.derivedAsset.id);
    useAssetsStore().assetDetails.delete(this.derivedAsset.id);
  }
}

export class CloneAssetCommand implements Command {
  private sourceAssetId: string;
  private newParentFqn: string | null;
  private newAssetKey: string;
  private clonedAssetIds: string[] = [];
  private postCloneHookOverride?: PostCloneHook;

  constructor(sourceAssetId: string, newParentFqn: string | null, newAssetKey: string, postCloneHookOverride?: PostCloneHook) {
    this.sourceAssetId = sourceAssetId;
    this.newParentFqn = newParentFqn;
    this.newAssetKey = newAssetKey;
    this.postCloneHookOverride = postCloneHookOverride;
  }

  execute(workspace: any, assetsStore: any): void {
    const finalClonedAssets: UnmergedAsset[] = [];
    const cloneMap: CloneMap = new Map<string, string>();

    const _cloneRecursive = (
      sourceAssetId: string,
      targetParentFqn: string | null,
      targetAssetKey: string
    ) => {
      const sourceAsset = assetsStore.unmergedAssets.find((a: UnmergedAsset) => a.id === sourceAssetId);
        
      if (!sourceAsset) {
        console.error(`Clone failed: Source asset with ID ${sourceAssetId} not found.`);
        return;
      }

      // 1. Create the basic clone with a new ID and FQN
      let newAsset: UnmergedAsset = {
        ...cloneDeep(sourceAsset),
        id: generateUUID(),
        assetKey: targetAssetKey,
        fqn: targetParentFqn ? `${targetParentFqn}::${targetAssetKey}` : targetAssetKey,
      };

      // 2. Update the cloneMap with the FQN transformation
      cloneMap.set(sourceAsset.fqn, newAsset.fqn);

      // 3. Look up and apply the post-clone hook if it exists (override takes precedence)
      const coreConfig = useCoreConfigStore();
      const definition = coreConfig.getAssetDefinition(newAsset.assetType);
      if (this.postCloneHookOverride) {
        newAsset = this.postCloneHookOverride(newAsset, sourceAsset, cloneMap);
      } else if (definition?.postCloneFixup) {
        newAsset = definition.postCloneFixup(newAsset, sourceAsset, cloneMap);
      }
        
      // 4. Add the finalized asset to our collection
      finalClonedAssets.push(newAsset);
        
      // 5. Recurse for children
      const children = assetsStore.unmergedAssets.filter((a: UnmergedAsset) => 
        a.fqn.startsWith(sourceAsset.fqn + '::') &&
        a.fqn.split('::').length === sourceAsset.fqn.split('::').length + 1
      );
        
      for (const child of children) {
        _cloneRecursive(child.id, newAsset.fqn, child.assetKey);
      }
    };

    // Start the recursive cloning process
    _cloneRecursive(this.sourceAssetId, this.newParentFqn, this.newAssetKey);

    // Finalize the command by applying all changes to the workspace
    this.clonedAssetIds = [];
    finalClonedAssets.forEach(asset => {
      this.clonedAssetIds.push(asset.id);
      workspace.pendingChanges.upserted.set(asset.id, asset);
    });
  }

  unexecute(workspace: any): void {
    // Undo is simple: remove all the assets that were created
    this.clonedAssetIds.forEach(id => {
      workspace.pendingChanges.upserted.delete(id);
      useAssetsStore().closeInspectorByAssetId(id);
      useAssetsStore().assetDetails.delete(id);
    });
  }
}








