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
import { useAssetsStore } from './assets';

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

// New interface for the asset picker dialog state
interface AssetPickerDialogState {
  show: boolean;
  title: string;
  items: Asset[];
  // A promise resolver to return the selected asset asynchronously
  resolver: ((value: Asset | null) => void) | null;
}

interface GenericConfirmationState {
  show: boolean;
  dialogType: string | null;
  payload: any;
  resolver: ((confirmed: boolean) => void) | null;
}

interface UiState {
  activePaneId: string | null;
  selectedNode: SelectedNode | null;
  activeContextMenuId: string | null;
  nodesToExpand: Set<string>;
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
  
  // Drag invalidation feedback
  isDragInvalid: boolean;
  dragInvalidationReason: string | null;
  cursorX: number;
  cursorY: number;
  
  // All dialog states now live here
  cloneDialogState: CloneDialogState;
  renameState: RenameState;
  newAssetDialog: NewAssetDialogState;
  newFolderDialog: NewFolderDialogState;
  deleteConfirmationDialog: DeleteConfirmationDialogState;
  deleteBlockedDialog: DeleteBlockedDialogState;
  refactorConfirmationState: RefactorConfirmationState | null; // Can be null
  // Clear overrides dialog
  clearOverridesDialog: ClearOverridesDialogState;
  // Template change dialog
  templateChangeDialog: TemplateChangeDialogState;
  // Asset picker dialog
  assetPickerDialog: AssetPickerDialogState;
  // Generic confirmation dialog
  genericConfirmationState: GenericConfirmationState;
  // View-model hint for selected node
  selectedNodeViewHint: ViewHint | null;
  // Persist active tab per inspector pane
  inspectorActiveTab: Map<string, string>;
  assetToFocusInTree: string | null;
}

export const useUiStore = defineStore('ui', {
  state: (): UiState => ({
    activePaneId: null,
    selectedNode: null,
    activeContextMenuId: null,
    nodesToExpand: new Set(),
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
    clearOverridesDialog: { show: false, asset: null, changes: [] },
    templateChangeDialog: { show: false, asset: null, oldTemplateFqn: null, newTemplateFqn: null, diff: [] },
    assetPickerDialog: { show: false, title: '', items: [], resolver: null },
    genericConfirmationState: { show: false, dialogType: null, payload: null, resolver: null },
    selectedNodeViewHint: null,
    inspectorActiveTab: new Map(),
    assetToFocusInTree: null,
    
    // Initialize the new FSM context menu
    contextMenu: { state: 'closed' },
    
    // Initialize drag invalidation state
    isDragInvalid: false,
    dragInvalidationReason: null,
    cursorX: 0,
    cursorY: 0,
  }),
  getters: {
    isDragging: (state) => !!state.dragSourceInfo,
    draggedAssetId: (state) => state.dragSourceInfo?.assetId || null,
  },
  actions: {
    async manageInteractionLifecycle(handler: () => Promise<void>) {
      if (this.isDialogPending) {
        console.warn("Blocked a new interaction because one is already pending.");
        return;
      }
      this.isDialogPending = true;
      try {
        await handler();
      } finally {
        this.clearActionStates();
      }
    },

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
    setDragValidationState(isInvalid: boolean, reason: string | null) {
      this.isDragInvalid = isInvalid;
      this.dragInvalidationReason = reason;
    },

    setDragInvalidationReason(reason: string | null) {
      this.dragInvalidationReason = reason;
    },

    setCursorPosition(x: number, y: number) {
      this.cursorX = x;
      this.cursorY = y;
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
      this.isDragInvalid = false;
      this.dragInvalidationReason = null;
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
      this.clearOverridesDialog.show = false;
      this.templateChangeDialog.show = false;
      this.assetPickerDialog.show = false;
      this.genericConfirmationState.show = false;
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

    /**
     * Opens the asset picker dialog and returns a promise that resolves
     * with the selected asset or null if canceled.
     */
    promptForAssetSelection(payload: { title: string; items: Asset[] }): Promise<Asset | null> {
      return new Promise((resolve) => {
        this.assetPickerDialog = {
          show: true,
          title: payload.title,
          items: payload.items,
          resolver: resolve,
        };
      });
    },

    /**
     * Pauses a workflow and prompts for confirmation using a content-specific dialog.
     * @param dialogType A key for the content layer to identify which dialog to show.
     * @param payload Data to be passed as props to the content dialog.
     * @returns A promise that resolves to `true` if confirmed, `false` if cancelled.
     */
    promptForGenericConfirmation(dialogType: string, payload: any): Promise<boolean> {
      return new Promise((resolve) => {
        this.isDialogPending = true;
        this.genericConfirmationState = {
          show: true,
          dialogType,
          payload,
          resolver: resolve,
        };
      });
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
      if (this.isDialogPending) {
        return;
      }
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

    /**
     * Orchestrates focusing an asset in the tree.
     * This expands all parents and then sets the target asset to be focused.
     * @param assetId The ID of the asset to focus.
     */
    focusAssetInTree(assetId: string) {
      if (!assetId) return;

      const assetsStore = useAssetsStore();
      const asset = assetsStore.unmergedAssets.find(a => a.id === assetId);
      if (!asset) return;

      this.nodesToExpand.clear();
      this.assetToFocusInTree = null;

      const fqnParts = asset.fqn.split('::');

      for (let i = 1; i < fqnParts.length; i++) {
        const parentFqn = fqnParts.slice(0, i).join('::');
        const parentAsset = assetsStore.unmergedAssets.find(a => a.fqn === parentFqn);
        if (parentAsset) {
          this.nodesToExpand.add(parentAsset.id);
        }
      }

      this.assetToFocusInTree = assetId;
    },

    /**
     * Clears the focus state. Called by AssetTreeNode after it has focused.
     */
    clearAssetToFocus() {
      this.assetToFocusInTree = null;
    },
  },
});








