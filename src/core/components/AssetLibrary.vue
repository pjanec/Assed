<template>
  <div class="asset-library h-100 d-flex flex-column">
    <div class="library-header pa-4 border-b">
      <div class="d-flex align-center flex-wrap ga-2 mb-3">
        <h3 class="text-h6">Explorer</h3>
        <div class="d-flex align-center ga-2 ms-auto">
          <v-btn
            size="small"
            variant="tonal"
            icon
            @click="() => openTopLevelCreateDialog(null)"
          >
            <v-icon>mdi-plus</v-icon>
            <v-tooltip activator="parent" location="bottom">New Asset</v-tooltip>
          </v-btn>
        </div>
      </div>

      <v-text-field
        v-model="searchQuery"
        prepend-inner-icon="mdi-magnify"
        placeholder="Search assets..."
        variant="outlined"
        density="compact"
        hide-details
        clearable
      />
    </div>

    <div
      class="library-content flex-1-1 overflow-y-auto"
      :class="{ 'drag-over-active': isRootDraggingOver }"
      @contextmenu="handleRootContextMenu"
      @dragover.prevent="handleDragOver"
      @dragleave="handleDragLeave"
      @drop="handleDrop"
    >
      <v-progress-linear v-if="assetsStore.loading.assets" indeterminate color="primary" />
      
      <div v-else-if="filteredAssets.length === 0" class="pa-4 text-center">
        <v-icon size="48" color="grey-lighten-2" class="mb-2">mdi-folder-open-outline</v-icon>
        <p class="text-body-2 text-medium-emphasis">No assets found</p>
      </div>
      
      <v-list v-else density="compact" class="py-0">
        <AssetTreeNode
          v-for="namespace in rootNamespaces"
          :key="namespace.path"
          :node="namespace"
          :view-type="'namespace'"
          @select-asset="selectAsset"
        />
      </v-list>
    </div>

    <!-- Context menu is now handled by GlobalContextMenu component in App.vue -->

    <NewAssetDialog
      v-model="uiStore.newAssetDialog.show"
      :parent-asset="uiStore.newAssetDialog.parentAsset"
      :child-type="uiStore.newAssetDialog.childType"
      :prefilled-origin="uiStore.newAssetDialog.prefilledOrigin"
      @create="handleCreateAsset"
    />

    <NewFolderDialog
      v-model="uiStore.newFolderDialog.show"
      :parent-fqn="uiStore.newFolderDialog.parentFqn"
      @submit="handleCreateFolder"
      @update:model-value="!$event && uiStore.clearActionStates()"
    />

    <CloneAssetDialog
      v-model="uiStore.cloneDialogState.show"
      :title="dialogTitle"
      :original-asset-key="draggedAssetName"
      :parent-fqn="cloneParentFqn"
      @submit="handleDialogSubmit"
    />

  </div>
</template>


<script setup lang="ts">
import { computed, ref, type Ref } from 'vue'
// --- IMPORTS FOR STORES ---
import { useAssetsStore, useWorkspaceStore, useUiStore } from '@/core/stores/index';
import { CreateFolderCommand, CloneAssetCommand, DeriveAssetCommand } from '@/core/stores/workspace'
import { storeToRefs } from 'pinia'
import AssetTreeNode from './AssetTreeNode.vue'
import NewAssetDialog from './dialogs/NewAssetDialog.vue'
import NewFolderDialog from './dialogs/NewFolderDialog.vue'
import type { Asset, AssetTreeNode as AssetTreeNodeType, UnmergedAsset, InspectorPaneInfo } from '@/core/types';
import CloneAssetDialog from './dialogs/CloneAssetDialog.vue';
import { useDroppable } from '@/core/composables/useDroppable';
import { DROP_TARGET_TYPES, DIALOG_MODES, ROOT_ID } from '@/core/config/constants';

// Add these imports for the new system
import { getAvailableActions } from '@/core/registries/interactionRegistry';
import type { DropAction } from '@/core/registries/interactionRegistry';

const assetsStore = useAssetsStore()
const workspaceStore = useWorkspaceStore()
const uiStore = useUiStore() // Initialize the store

const { isDraggingOver: isRootDraggingOver, handleDragOver, handleDragLeave, handleDrop } = useDroppable({
  type: DROP_TARGET_TYPES.ROOT,
  id: ROOT_ID,
});

const draggedAssetName = computed(() => {
  // Read from either the dialog state or the general drag state
  const assetId = uiStore.cloneDialogState.draggedAssetId || uiStore.draggedAssetId;
  if (!assetId) return '';
  return assetsStore.unmergedAssets.find(a => a.id === assetId)?.assetKey || '';
});

// Reactive state
const searchQuery: Ref<string> = ref('')

// --- REMOVE local state for the dialog ---
// const showNewAssetDialog = ref(false);
// const newAssetParent = ref(null);
// const newAssetChildType = ref(null);
// const prefilledOrigin = ref(null);

// Root context menu state now managed by uiStore

// Dialog states are now managed by uiStore - no need for local refs

// Removed unused rootNodeForMenu - root context handled differently now

// Remove unused local dialog state - now managed by UI store
// const showCloneDialog = ref(false); // Now handled by uiStore.cloneDialogState.show
// const dropActionType = ref<'copy' | 'derive' | 'clone' | null>(null); // Now handled by uiStore.cloneDialogState.mode

// Computed properties that read from the global dialog state
const cloneParentFqn = computed(() => {
  const dropTarget = uiStore.cloneDialogState.dropTarget;
  if (!dropTarget) return null;

  let targetAsset = assetsStore.unmergedAssets.find(a => a.id === dropTarget.id);
  if (!targetAsset) {
    targetAsset = assetsStore.unmergedAssets.find(a => a.fqn === dropTarget.id);
  }
  return targetAsset ? targetAsset.fqn : (dropTarget.type !== DROP_TARGET_TYPES.ROOT ? dropTarget.id : null);
});

const dialogTitle = computed(() => {
  const mode = uiStore.cloneDialogState.mode;
  if (mode === DIALOG_MODES.COPY) return 'Copy Asset';
  if (mode === DIALOG_MODES.DERIVE) return 'Derive Asset';
  return 'Clone Asset'; // Default title
});


// Computed properties
const filteredAssets = computed((): Asset[] => {
  if (!searchQuery.value) {
    return assetsStore.assets
  }
  
  const query = searchQuery.value.toLowerCase()
  return assetsStore.assets.filter((asset: Asset) => 
    asset.assetKey.toLowerCase().includes(query) ||
    asset.fqn.toLowerCase().includes(query) ||
    asset.assetType.toLowerCase().includes(query)
  )
})

const rootNamespaces = computed(() => {
  if (searchQuery.value) {
    // When searching, show flat list with namespace context
    return filteredAssets.value.map((asset: Asset) => ({
      id: asset.id,
      path: asset.fqn,
      name: asset.assetKey,
      parent: null,
      children: [],
      assets: [asset],
      type: 'asset' as const,
      assetType: asset.assetType,
      namespaceContext: getNamespaceContext(asset),
      showContext: true
    }))
  }
  
  return assetsStore.getRootNamespaces
})


const handleRootContextMenu = (event: MouseEvent) => {
  if (event.target === event.currentTarget) {
    event.preventDefault();
    uiStore.showContextMenu({
      x: event.clientX,
      y: event.clientY,
      ctx: {
        kind: 'root-actions'
      }
    });
  }
};
// ------------------------------------------

// Helper functions
const getNamespaceContext = (asset: Asset): string => {
  const parts = asset.fqn.split('::')
  if (parts.length <= 1) {
    return asset.fqn // Show FQN for top-level assets
  }
  
  // Show parent namespace path
  const parentPath = parts.slice(0, -1).join(' → ')
  return parentPath
}

const selectAsset = (node: AssetTreeNodeType) => {
  // The function's only job now is to update the global state.
  // The watcher in EditorWorkbench.vue will handle the rest.
  uiStore.selectNode(node);
};

// This method handles the right-click "Open in New Inspector" action
// REPLACE this entire method
// Removed unused openInNew function

// --- REPLACE dialog-opening methods ---
const openTopLevelCreateDialog = (namespace: string | null = null) => {
  workspaceStore.openNewAssetDialog({ namespace });
};

// Removed unused openChildCreateDialog function

// --- Add this new method ---
// Removed unused handleAddAssetToFolder function

// This method is now only called by the context menu
// Removed unused openNewFolderDialog function

const handleCreateFolder = (newFolderName: string) => {
  const command = new CreateFolderCommand(uiStore.newFolderDialog.parentFqn || '', newFolderName);
  workspaceStore.executeCommand(command);

  // --- ADDED LOGIC ---
  const createdFolder = command.newFolder;

  // Pre-populate the details cache to prevent API calls for a new, unsaved asset
  assetsStore.assetDetails.set(createdFolder.id, {
    unmerged: createdFolder,
    merged: null, // New assets don't have a merged state yet
  });

  // Select the node in the explorer to make it the active item
  uiStore.selectNode({
    id: createdFolder.id,
    type: 'asset', // We treat it as an 'asset' for selection purposes
    name: createdFolder.assetKey,
    path: createdFolder.fqn
  });

  // Open an inspector for the newly created folder
  assetsStore.openInspector(createdFolder.id);
  // --- END ADDED LOGIC ---

  uiStore.clearActionStates(); // Close dialog through UI store
};

const handleCreateAsset = async (newAssetObject: Omit<UnmergedAsset, 'id'>) => {
  // The component's responsibility is now reduced to a single, clear call
  await workspaceStore.createNewAssetAndSelect(newAssetObject);
};


const handleDialogSubmit = (newAssetKey: string) => {
  // Read all necessary info from the store's dialog state
  const { mode, draggedAssetId } = uiStore.cloneDialogState;
  const parentFqn = cloneParentFqn.value;

  if (!mode || !draggedAssetId) return;

  if (mode === DIALOG_MODES.COPY) {
    const command = new CloneAssetCommand(draggedAssetId, parentFqn, newAssetKey);
    workspaceStore.executeCommand(command);
  } else if (mode === DIALOG_MODES.DERIVE) {
    const sourceAsset = assetsStore.unmergedAssets.find(a => a.id === draggedAssetId);
    if (sourceAsset) {
      const command = new DeriveAssetCommand(sourceAsset, parentFqn, newAssetKey);
      workspaceStore.executeCommand(command);
    }
  }

  // clearDragState will automatically close the dialog
  uiStore.clearDragState();
};

// ------------------------------------

</script>

<style scoped>
.library-header {
  background-color: rgb(var(--v-theme-surface-variant));
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.border-b {
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.library-content {
  position: relative;
}

/* Add this rule to your styles */
.drag-over-active {
  background-color: rgba(var(--v-theme-primary), 0.04) !important;
}
</style>







