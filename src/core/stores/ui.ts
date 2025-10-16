import { defineStore } from 'pinia';
import type { 
  SelectedNode, 
  NewAssetDialogState, 
  NewFolderDialogState, 
  DeleteConfirmationDialogState,
  DeleteBlockedDialogState,
  RefactorConfirmationState,
  Asset,
  Change
} from '@/core/types';
import type { MenuState, ContextMenuKind } from '@/core/types/ui';
import { DIALOG_MODES, DROP_TARGET_TYPES, VIEW_HINTS } from '@/core/config/constants';
import type { ViewHint } from '@/core/types';
import type { DragPayload, DropTarget } from '@/core/types/drag-drop';

export type ExposedComponentAPI = Record<string, any>;


// The old DragSourceInfo interface is now removed.

interface CloneDialogState {
  show: boolean;
  mode: typeof DIALOG_MODES[keyof typeof DIALOG_MODES] | null;
  draggedAssetId: string | null;
  dropTarget: DropTarget | null;
}

interface RenameState {
  show: boolean;
  assetId: string | null;
  assetKey: string | null;
}

// Generic interface for drag-drop confirmation dialogs
interface DragDropConfirmationDialogState {
  show: boolean;
  dragPayload: DragPayload | null;
  dropTarget: DropTarget | null;
  // An arbitrary payload for the content-layer component to use.
  // The core does not know or care what is in this object.
  displayPayload: Record<string, any> | null;
}

// New interface for clear overrides dialog
interface ClearOverridesDialogState {
  show: boolean;
  asset: Asset | null;
  changes: Change[];
}

// New interface for template change dialog
interface TemplateChangeDialogState {
  show: boolean;
  asset: Asset | null;
  oldTemplateFqn: string | null;
  newTemplateFqn: string | null;
  diff: Change[];
}

interface UiState {
  activePaneId: string | null;
  selectedNode: SelectedNode | null;
  activeContextMenuId: string | null;
  nodeToExpand: string | null;
  // --- CHANGE: Use the new DragPayload interface ---
  dragSourceInfo: DragPayload | null;
  // ---------------------------------------------
  dragSourceContext: string | null;
  // A temporary map to hold references to the API of components being dragged.
  dragInstanceRegistry: Map<string, ExposedComponentAPI>;
  dropContextMenu: {
    show: boolean;
    x: number;
    y: number;
  };
  rootContextMenu: {
    show: boolean;
    x: number;
    y: number;
  };
  isDropHandling: boolean;
  isDropMenuPending: boolean;
  isDialogPending: boolean; // This property is added
  dropTarget: DropTarget | null;
  explorerView: 'folder' | 'namespace';
  editorView: 'canvas' | 'matrix';
  
  // New FSM-based context menu system
  contextMenu: MenuState;
  
  // All dialog states now live here
  cloneDialogState: CloneDialogState;
  renameState: RenameState;
  newAssetDialog: NewAssetDialogState;
  newFolderDialog: NewFolderDialogState;
  deleteConfirmationDialog: DeleteConfirmationDialogState;
  deleteBlockedDialog: DeleteBlockedDialogState;
  refactorConfirmationState: RefactorConfirmationState | null; // Can be null
  // Generic drag-drop confirmation dialog
  dragDropConfirmationDialog: DragDropConfirmationDialogState;
  // Clear overrides dialog
  clearOverridesDialog: ClearOverridesDialogState;
  // Template change dialog
  templateChangeDialog: TemplateChangeDialogState;
  // View-model hint for selected node
  selectedNodeViewHint: ViewHint | null;
  // Persist active tab per inspector pane
  inspectorActiveTab: Map<string, string>;
}

export const useUiStore = defineStore('ui', {
  state: (): UiState => ({
    activePaneId: null,
    selectedNode: null,
    activeContextMenuId: null,
    nodeToExpand: null,
    dragSourceInfo: null,
    dragSourceContext: null,
    dragInstanceRegistry: new Map(),
    dropContextMenu: {
      show: false,
      x: 0,
      y: 0,
    },
    rootContextMenu: { show: false, x: 0, y: 0 },
    isDropHandling: false,
    isDropMenuPending: false,
    isDialogPending: false, // Initialize the new state property
    dropTarget: null,
    explorerView: 'folder',
    editorView: 'canvas',
    
    // Initialize all dialog states
    cloneDialogState: { show: false, mode: null, draggedAssetId: null, dropTarget: null },
    renameState: { show: false, assetId: null, assetKey: null },
    newAssetDialog: { show: false, parentAsset: null, childType: null, prefilledOrigin: null },
    newFolderDialog: { show: false, parentFqn: null },
    deleteConfirmationDialog: { show: false, asset: null, impact: { deletableChildren: [] } },
    deleteBlockedDialog: { show: false, asset: null, impact: { blockingDependencies: [] } },
    refactorConfirmationState: null,
    dragDropConfirmationDialog: { show: false, dragPayload: null, dropTarget: null, displayPayload: null },
    clearOverridesDialog: { show: false, asset: null, changes: [] },
    templateChangeDialog: { show: false, asset: null, oldTemplateFqn: null, newTemplateFqn: null, diff: [] },
    selectedNodeViewHint: null,
    inspectorActiveTab: new Map(),
    
    // Initialize the new FSM context menu
    contextMenu: { state: 'closed' },
  }),
  getters: {
    isDragging: (state) => !!state.dragSourceInfo,
    draggedAssetId: (state) => state.dragSourceInfo?.assetId || null,
  },
  actions: {
    setActivePane(paneId: string | null) {
      this.activePaneId = paneId;
    },
    selectNode(nodeData?: SelectedNode | null, viewHint: ViewHint = VIEW_HINTS.DEFAULT) {
      if (!nodeData) {
        this.selectedNode = null;
        this.selectedNodeViewHint = null;
        return;
      }
      this.selectedNode = {
        id: nodeData.id,
        type: nodeData.type,
        name: nodeData.name,
        path: nodeData.path,
        virtualContext: nodeData.virtualContext,
        assetType: nodeData.assetType, // <-- ADD THIS LINE
      };
      this.selectedNodeViewHint = viewHint;
    },
    setInspectorTab(paneId: string, tabId: string) {
      this.inspectorActiveTab.set(paneId, tabId);
    },
    getInspectorTab(paneId: string): string | null {
      return this.inspectorActiveTab.get(paneId) || null;
    },
    setActiveContextMenu(menuId: string | null) {
      this.activeContextMenuId = menuId;
    },
    setNodeToExpand(nodeId: string | null) {
      this.nodeToExpand = nodeId;
    },
    // --- CHANGE: Update the action's signature ---
    startDrag(sourceInfo: DragPayload) {
      console.log(`[DEBUG STORE] startDrag: Setting isDialogPending to false.`);
      this.dragSourceInfo = sourceInfo;
      this.isDialogPending = false; // Set the flag to false on new drag
    },
    // ------------------------------------------
    setDropTarget(target: DropTarget | null) {
      this.dropTarget = target;
    },
    /**
     * Registers a component's exposed API during a drag operation.
     */
    registerDragInstance(instanceId: string, api: ExposedComponentAPI) {
      this.dragInstanceRegistry.set(instanceId, api);
    },
    /**
     * Unregisters a component's API when the drag operation ends.
     */
    unregisterDragInstance(instanceId: string) {
      this.dragInstanceRegistry.delete(instanceId);
    },
    clearDragState() {
      console.log(`[DEBUG STORE] clearDragState: Clearing all drag-related state.`);
      this.dragSourceInfo = null;
      this.dragInstanceRegistry.clear();
      this.dropContextMenu.show = false;
      this.isDropHandling = false;
      this.isDropMenuPending = false;
      this.isDialogPending = false; // Reset the flag
      this.dropTarget = null;
      this.closeCloneDialog();
    },
    showDropContextMenu({ x, y }: { x: number, y: number }) {
      this.dropContextMenu = { show: true, x, y };
    },
    hideDropContextMenu() {
      this.dropContextMenu.show = false;
    },
    showRootContextMenu({ x, y }: { x: number, y: number }) {
      this.rootContextMenu = { show: true, x, y };
    },
    hideRootContextMenu() {
      this.rootContextMenu.show = false;
    },
    closeCloneDialog() {
      this.cloneDialogState = {
        show: false,
        mode: null,
        draggedAssetId: null,
        dropTarget: null,
      };
    },
    closeRenamePrompt() {
      this.renameState = { show: false, assetId: null, assetKey: null };
    },
    
    toggleExplorerView(): void {
      this.explorerView = this.explorerView === 'folder' ? 'namespace' : 'folder';
    },
      
    toggleEditorView(): void {
      this.editorView = this.editorView === 'canvas' ? 'matrix' : 'canvas';
    },

    // Generic Action to close all dialogs and reset drag state
    clearActionStates() {
      this.dragSourceInfo = null;
      this.dropContextMenu.show = false;
      this.isDropHandling = false;
      this.isDropMenuPending = false;
      this.isDialogPending = false;
      this.dropTarget = null;
      // Close all dialogs
      this.cloneDialogState.show = false;
      this.renameState.show = false;
      this.newAssetDialog.show = false;
      this.newFolderDialog.show = false;
      this.deleteConfirmationDialog.show = false;
      this.deleteBlockedDialog.show = false;
      this.refactorConfirmationState = null;
      this.dragDropConfirmationDialog.show = false;
      this.clearOverridesDialog.show = false;
      this.templateChangeDialog.show = false;
    },

    // Generic action to prompt for ANY drag-drop confirmation
    promptForDragDropConfirmation(payload: {
      dragPayload: DragPayload;
      dropTarget: DropTarget;
      displayPayload: Record<string, any>; // The content layer provides the specific data
    }) {
      this.dragDropConfirmationDialog = {
        show: true,
        dragPayload: payload.dragPayload,
        dropTarget: payload.dropTarget,
        displayPayload: payload.displayPayload,
      };
    },

    // Clear Overrides
    promptForClearOverrides(payload: { asset: Asset, changes: Change[] }) {
      this.clearOverridesDialog = {
        show: true,
        asset: payload.asset,
        changes: payload.changes,
      };
    },

    // Template Change
    promptForTemplateChange(payload: {
      asset: Asset;
      oldTemplateFqn: string | null;
      newTemplateFqn: string | null;
      diff: Change[];
    }) {
      this.templateChangeDialog = {
        show: true,
        asset: payload.asset,
        oldTemplateFqn: payload.oldTemplateFqn,
        newTemplateFqn: payload.newTemplateFqn,
        diff: payload.diff,
      };
    },

    // New Asset / Folder
    promptForNewAsset(payload: { parentAsset?: Asset | null; childType?: string | null; namespace?: string | null; } = {}) {
        this.newAssetDialog = {
            show: true,
            parentAsset: payload.parentAsset || null,
            childType: payload.childType || null,
            prefilledOrigin: payload.namespace || null
        };
    },
    promptForNewFolder(parentFqn: string | null) {
        this.newFolderDialog = { show: true, parentFqn };
    },

    // Clone / Derive
    promptForCloneOrDerive(mode: typeof DIALOG_MODES[keyof typeof DIALOG_MODES], draggedAssetId: string, dropTarget: DropTarget) {
      this.isDialogPending = true;
      this.cloneDialogState = { show: true, mode, draggedAssetId, dropTarget };
    },

    // Rename
    promptForRename({ assetId, assetKey }: { assetId: string, assetKey: string }) {
      this.renameState = { show: true, assetId, assetKey };
    },

    // Refactor (Move/Rename with consequences)
    promptForRefactor(payload: RefactorConfirmationState) {
        this.refactorConfirmationState = { ...payload, show: true };
    },

    // Delete
    promptForDeletion(payload: { asset: Asset, impact: { deletableChildren: Asset[] } }) {
      this.deleteConfirmationDialog = { show: true, ...payload };
    },

    // Blocked Deletion
    promptForBlockedDeletion(payload: { asset: Asset, impact: { blockingDependencies: Asset[] } }) {
      this.deleteBlockedDialog = { show: true, ...payload };
    },

    // New FSM-based context menu actions
    /**
     * Shows the context menu by transitioning the state.
     * This is the single entry point for any component wanting to show a menu.
     * @param payload - The position and the strongly-typed context.
     */
    showContextMenu(payload: { x: number; y: number; ctx: ContextMenuKind }) {
      if (this.contextMenu.state !== 'closed') {
        // Optional: handle rapid clicks by ignoring them or closing the previous menu first
        return;
      }
      // Transition to the 'opening' state. The UI component will handle the next transition.
      this.contextMenu = {
        state: 'opening',
        x: payload.x,
        y: payload.y,
        ctx: payload.ctx,
      };
    },

    /**
     * Acknowledges that the menu is now visually open.
     * This action should be called by the GlobalContextMenu component.
     */
    confirmMenuOpened() {
        if (this.contextMenu.state === 'opening') {
            this.contextMenu = {
                ...this.contextMenu,
                state: 'open',
            };
        }
    },

    /**
     * Hides the context menu by transitioning back to the 'closed' state.
     */
    hideContextMenu() {
      if (this.contextMenu.state !== 'closed') {
        this.contextMenu = { state: 'closed' };
      }
    },
  },
});








