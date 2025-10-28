<template>
  <v-app>
    <!-- Application Header -->
    <v-app-bar app color="primary" dark>
      <v-btn
        icon="mdi-arrow-left"
        @click="goHome"
      />
      
      <v-app-bar-title>
        Distro Editor
      </v-app-bar-title>

      <v-spacer />

      <!-- Perspective Switcher -->
      <div class="perspective-switcher mx-2">
        <v-select
          v-model="currentPerspective"
          :items="availablePerspectives"
          item-title="title"
          item-value="value"
          label="Perspective"
          density="compact"
          variant="outlined"
          hide-details
          style="min-width: 200px; background-color: rgba(255, 255, 255, 0.1);"
        />
      </div>

      <v-spacer />

      <!-- Action Buttons -->
      <v-btn
        prepend-icon="mdi-undo"
        :disabled="!canUndo"
        @click="undo"
        class="me-2"
      >
        Undo
      </v-btn>
      
      <v-btn
        prepend-icon="mdi-redo"
        :disabled="!canRedo" 
        @click="redo"
        class="me-2"
      >
        Redo
      </v-btn>

      <v-btn
        prepend-icon="mdi-content-save"
        color="success"
        :disabled="!hasUnsavedChanges"
        :loading="saving"
        @click="openCommitDialog"
      >
        Commit Changes
      </v-btn>
    </v-app-bar>

    <v-main class="main-content">
      <div class="workbench-layout d-flex">
        <!-- Left Pane: Asset Explorer -->
        <div 
          class="explorer-pane"
          :style="{ width: `${leftPaneWidth}px` }"
        >
          <AssetLibrary/>
        </div>

        <!-- Left Separator -->
        <div 
          class="pane-separator vertical"
          @mousedown="startResize($event, 'left')"
        ></div>

        <!-- Inspector Panes Container -->
        <div class="d-flex flex-1-1 inspector-container">
          <template v-for="(inspector, index) in openInspectors" :key="inspector.paneId">
            <!-- Inspector Separator (except for first pane) -->
            <div
              v-if="index > 0"
              class="pane-separator vertical"
              @mousedown="startResize($event, index - 1)"
            ></div>

            <!-- Inspector Wrapper -->
            <div 
              class="inspector-wrapper" 
              :style="{ 
                width: inspectorWidths[index] || '100%',
                flexGrow: 0,
                flexShrink: 0,
                flexBasis: inspectorWidths[index] || '100%'
              }"
            >
              <InspectorPane :asset-id="inspector.assetId" :pane-id="inspector.paneId" />
            </div>
          </template>
        </div>
      </div>
    </v-main>

    <!-- Status Bar -->
    <v-footer app height="32" class="status-bar pa-0">
      <div class="d-flex align-center w-100 px-3">
        <div class="d-flex align-center ga-2">
          <!-- Issue Indicators -->
          <v-btn
            v-if="validationIssues.length > 0"
            size="x-small"
            variant="text"
            :color="hasErrors ? 'error' : 'warning'"
            @click="showValidationDialog = true"
          >
            <v-icon size="14" class="me-1">
              {{ hasErrors ? 'mdi-alert-circle' : 'mdi-alert' }}
            </v-icon>
            {{ validationIssues.length }} {{ validationIssues.length === 1 ? 'issue' : 'issues' }}
          </v-btn>
          
          <span v-else class="text-caption text-success">
            <v-icon size="14" class="me-1">mdi-check-circle</v-icon>
            No issues
          </span>
        </div>
        
        <v-spacer />
        
        <div class="d-flex align-center ga-4 text-caption">
          <!-- Selected Asset Info -->
          <span v-if="selectedAssetInfo">
            Selected: {{ selectedAssetInfo }}
          </span>
          
          <!-- View Mode -->
          <span>
            View: {{ editorView }}
          </span>
        </div>
      </div>
    </v-footer>

    <!-- Commit Dialog -->
    <CommitDialog
      v-model="showCommitDialog"
      :structured-changes="structuredChanges"
      :saving="saving"
      :ripple-effect-changes="rippleEffectChanges"
      @save="handleSave"
      @navigateToAsset="handleNavigateToAsset"
    />

    <!-- Rename Dialogs -->
    <RenameInputDialog
      v-model="renameState.show"
      :asset-key="renameState.assetKey || ''"
      :asset-id="renameState.assetId || ''"
      @submit="handleRenameSubmit"
      @update:model-value="!$event && uiStore.closeRenamePrompt()"
    />

    <RefactorConfirmationDialog
      v-if="uiStore.refactorConfirmationState"
      :model-value="uiStore.refactorConfirmationState.show"
      :consequences="uiStore.refactorConfirmationState.consequences"
      :mode="uiStore.refactorConfirmationState.mode"
      @update:model-value="workspaceStore.cancelRefactor"
      @confirm="() => uiStore.refactorConfirmationState && workspaceStore.confirmRefactor(uiStore.refactorConfirmationState)"
    />

    <ConfirmDeleteDialog
      :model-value="uiStore.deleteConfirmationDialog.show"
      :asset-to-delete="uiStore.deleteConfirmationDialog.asset"
      :deletable-children="uiStore.deleteConfirmationDialog.impact.deletableChildren"
      @update:model-value="!$event && workspaceStore.cancelDeletion()"
      @confirm="workspaceStore.confirmDeletion"
    />

    <DeletionBlockedDialog
      v-model="uiStore.deleteBlockedDialog.show"
      :asset="uiStore.deleteBlockedDialog.asset"
      :blocking-dependencies="uiStore.deleteBlockedDialog.impact.blockingDependencies"
    />

    <!-- Validation Issues Dialog -->
    <v-dialog v-model="showValidationDialog" max-width="800px">
      <v-card>
        <v-card-title>
          <v-icon class="me-2" :color="hasErrors ? 'error' : 'warning'">
            {{ hasErrors ? 'mdi-alert-circle' : 'mdi-alert' }}
          </v-icon>
          Validation Issues
        </v-card-title>
        
        <v-card-text>
          <v-list>
            <v-list-item
              v-for="issue in validationIssues"
              :key="issue.id"
              @click="navigateToIssue(issue)"
              class="validation-issue-item"
            >
              <template #prepend>
                <v-icon :color="issue.severity === 'error' ? 'error' : 'warning'">
                  {{ issue.severity === 'error' ? 'mdi-close-circle' : 'mdi-alert-circle' }}
                </v-icon>
              </template>
              
              <v-list-item-title>{{ issue.message }}</v-list-item-title>
              <v-list-item-subtitle>
                {{ issue.assetName }} ({{ issue.assetType }})
              </v-list-item-subtitle>
            </v-list-item>
          </v-list>
        </v-card-text>
        
        <v-card-actions>
          <v-spacer />
          <v-btn @click="showValidationDialog = false">
            Close
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>


    <!-- Clear Overrides Dialog -->
    <ClearOverridesDialog 
      v-if="uiStore.clearOverridesDialog.show"
    />

    <!-- Template Change Dialog -->
    <TemplateChangeDialog 
      v-if="uiStore.templateChangeDialog.show"
    />

    <!-- Asset Picker Dialog -->
    <AssetPickerDialog 
      v-if="uiStore.assetPickerDialog.show"
    />
  </v-app>
</template>

<script setup lang="ts">
import { computed, onMounted, watch, ref, type Ref, inject } from 'vue';
import { storeToRefs } from 'pinia';
import { generateAssetDiff } from '@/core/utils/diff';
import { useRouter } from 'vue-router';
import { useAssetsStore, useWorkspaceStore, useUiStore } from '@/core/stores/index';
import { ConfigurationHub } from '@/core/stores/ConfigurationHub';
import { perspectiveDefinitions } from '@/content/config/perspectiveDefinitions';
import AssetLibrary from '@/core/components/AssetLibrary.vue'
import InspectorPane from '@/core/components/InspectorPane.vue'
import CommitDialog from '@/core/components/dialogs/CommitDialog.vue'
import RenameInputDialog from '@/core/components/dialogs/RenameInputDialog.vue';
import RefactorConfirmationDialog from '@/core/components/dialogs/RefactorConfirmationDialog.vue'
import ConfirmDeleteDialog from '@/core/components/dialogs/ConfirmDeleteDialog.vue'
import DeletionBlockedDialog from '@/core/components/dialogs/DeletionBlockedDialog.vue'
import ClearOverridesDialog from '@/core/components/dialogs/ClearOverridesDialog.vue';
import TemplateChangeDialog from '@/core/components/dialogs/TemplateChangeDialog.vue';
import AssetPickerDialog from '@/core/components/dialogs/AssetPickerDialog.vue';

import type { Asset, UnmergedAsset, AssetTreeNode } from '@/core/types';
import type { ValidationIssue } from '@/core/types/validation';
import type { DragPayload, DropTarget } from '@/core/types/drag-drop';
import { ASSET_TREE_NODE_TYPES } from '@/core/config/constants';
import { createTreeNodeFromSelectedNode } from '@/core/utils/assetTreeUtils';

const router = useRouter()
const assetsStore = useAssetsStore()
const workspaceStore = useWorkspaceStore()
const uiStore = useUiStore() // Initialize uiStore

// Get ConfigurationHub from app context
const configHub = inject<ConfigurationHub>('configHub');
if (!configHub) {
  console.warn('ConfigurationHub not found in context');
}

// Perspective switcher logic
const currentPerspective = computed({
  get: () => configHub?.currentPerspective.value || 'default',
  set: (value: string) => {
    if (configHub) {
      configHub.setPerspective(value);
    }
  }
});

const availablePerspectives = computed(() => {
  return Object.entries(perspectiveDefinitions).map(([key, def]) => ({
    value: key,
    title: def.displayName
  }));
});

// Reactive state
const showCommitDialog: Ref<boolean> = ref(false)
const showValidationDialog: Ref<boolean> = ref(false)
const leftPaneWidth: Ref<number> = ref(300)
const inspectorWidths: Ref<string[]> = ref([])
const isResizing: Ref<boolean> = ref(false)
const resizeType: Ref<string | number | null> = ref(null)

const { renameState } = storeToRefs(uiStore); // Get reactive state for rename dialog
let newAssetKeyValue = '' // To store the new key between dialogs
let movePayload: { draggedAssetId: string, dropTargetId: string } | null = null;

// Computed properties
const editorView = computed({
  get: () => uiStore.editorView,
  set: (value) => {
    if (value === 'canvas' || value === 'matrix') {
      // Best practice: Use an action to change state
      if (uiStore.editorView !== value) {
        uiStore.toggleEditorView();
      }
    }
  }
})

const hasUnsavedChanges = computed((): boolean => workspaceStore.hasUnsavedChanges)
const canUndo = computed((): boolean => workspaceStore.canUndo)
const canRedo = computed((): boolean => workspaceStore.canRedo)
const saving = computed((): boolean => workspaceStore.saving)
const changeSet = computed(() => workspaceStore.changeSet)
const rippleEffectChanges = computed(() => workspaceStore.rippleEffectChanges)

const { assetDetails } = storeToRefs(assetsStore);
const { pendingChanges, structuredChanges, validationIssues } = storeToRefs(workspaceStore);
const { openInspectors } = storeToRefs(assetsStore);
const { selectedNode } = storeToRefs(uiStore);

// --- Open/Update inspector when selection changes (assets or folders) ---
watch(selectedNode, async (newNode) => {
  if (!newNode) return;

  // The node type check is still valid.
  if (newNode.type === ASSET_TREE_NODE_TYPES.ASSET) {
    // Pass the ENTIRE newNode object, not just its ID.
    // This provides `loadAssetDetails` with the necessary virtualContext.
    const treeNode = createTreeNodeFromSelectedNode(newNode);
    if (treeNode) {
      await assetsStore.loadAssetDetails(treeNode);
    }
  }

  // Open a new inspector if none, otherwise update the active one
  const { activePaneId } = storeToRefs(uiStore);

  if (openInspectors.value.length === 0) {
    assetsStore.openInspectorFor(newNode.id, { reuse: true, focus: true });
  } else {
    const activePane = openInspectors.value.find((p: any) => p.paneId === activePaneId.value);
    const targetPaneId = activePane ? activePane.paneId : openInspectors.value[0].paneId;
    assetsStore.updateInspectorContent(targetPaneId, newNode.id);
  }
}, { deep: true });

// Status bar computed properties

const hasErrors = computed((): boolean => {
  return validationIssues.value.some((issue: ValidationIssue) => issue.severity === 'error')
})

const selectedAssetInfo = computed((): string | null => {
  // --- FIX: Assign to a local constant to help TypeScript's type analysis ---
  const currentNode = selectedNode.value;
  if (!currentNode) {
    return null;
  }
  
  // Now, using 'currentNode' is guaranteed to be safe.
  const asset = assetsStore.unmergedAssets.find(a => a.id === currentNode.id);
  return asset ? `${asset.assetKey} (${asset.assetType})` : null;
});

// structuredChanges is now retrieved from workspaceStore via storeToRefs


// Refactor request watcher removed - now handled through uiStore dialog prompts

// Watch for changes in open inspectors to recalculate widths
watch(() => openInspectors.value.length, (newLength, oldLength) => {
  const totalPanes = newLength;
  
  if (totalPanes === 0) {
    inspectorWidths.value = [];
    return;
  }

  if (oldLength !== undefined && newLength > oldLength) {
    const totalCurrentWidth = inspectorWidths.value.reduce((sum, w) => sum + parseFloat(w), 0);
    const newPaneWidth = 100 / totalPanes;
    const scaleFactor = (100 - newPaneWidth) / (totalCurrentWidth || 100);

    inspectorWidths.value = inspectorWidths.value.map(w => `${parseFloat(w) * scaleFactor}%`);
    inspectorWidths.value.push(`${newPaneWidth}%`);
  } else if (oldLength !== undefined && newLength < oldLength) {
    const equalWidth = `${100 / totalPanes}%`;
    inspectorWidths.value = new Array(totalPanes).fill(equalWidth);
  }
}, { immediate: true })

// Action handlers
const goHome = () => {
  if (hasUnsavedChanges.value) {
    if (!confirm('You have unsaved changes. Are you sure you want to leave?')) {
      return
    }
  }
  router.push('/')
}

const navigateToIssue = (issue: ValidationIssue) => {
  const asset = assetsStore.unmergedAssets.find(a => a.id === issue.assetId);
  if (asset) {
    uiStore.selectNode({
      id: asset.id,
      type: ASSET_TREE_NODE_TYPES.ASSET,
      name: asset.id,
      path: asset.fqn
    });
    showValidationDialog.value = false
  }
}

const undo = () => {
  workspaceStore.undo()
}

const redo = () => {
  workspaceStore.redo()
}

const openCommitDialog = () => {
  showCommitDialog.value = true
}

const handleSave = async ({ message }: { message: string }) => {
  try {
    await workspaceStore.saveChanges();
    showCommitDialog.value = false;
  } catch (error) {
    console.error('Save failed:', error);
    showCommitDialog.value = false;
  }
};

const handleNavigateToAsset = (assetId: string) => {
  if (!assetId) return;
  showCommitDialog.value = false;
  const asset = assetsStore.unmergedAssets.find(a => a.id === assetId);
  if (asset) {
    uiStore.selectNode({
      id: asset.id,
      type: ASSET_TREE_NODE_TYPES.ASSET,
      name: asset.id,
      path: asset.fqn
    });
  }
};

// Pane resize functionality
const startResize = (event: MouseEvent, type: 'left' | number) => {
  event.preventDefault()
  isResizing.value = true
  resizeType.value = type
    
  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing.value) return
    
    const workbench = document.querySelector('.workbench-layout')
    if (!workbench) return
    
    const rect = workbench.getBoundingClientRect()
    
    if (resizeType.value === 'left') {
      const newWidth = e.clientX - rect.left
      const totalWidth = rect.width
      const minInspectorSpace = Math.max(100, openInspectors.value.length * 50)
      const maxLeftWidth = totalWidth - minInspectorSpace - 8
      
      leftPaneWidth.value = Math.max(200, Math.min(maxLeftWidth, newWidth))
    } else if (typeof resizeType.value === 'number') {
      const dividerIndex = resizeType.value
      const inspectorContainer = workbench.querySelector('.inspector-container')
      if (!inspectorContainer) return
      
      const containerRect = inspectorContainer.getBoundingClientRect()
      const containerWidth = containerRect.width
      
      let cumulativeWidth = 0
      const panePositions = []
      
      for (let i = 0; i < inspectorWidths.value.length; i++) {
        panePositions.push(cumulativeWidth)
        cumulativeWidth += (parseFloat(inspectorWidths.value[i]) / 100) * containerWidth
      }
      
      const mouseX = e.clientX - containerRect.left
      const leftPaneIndex = dividerIndex
      const rightPaneIndex = dividerIndex + 1
      const leftPaneStart = panePositions[leftPaneIndex]
      const rightPaneEnd = leftPaneStart + 
        (parseFloat(inspectorWidths.value[leftPaneIndex]) / 100) * containerWidth +
        (parseFloat(inspectorWidths.value[rightPaneIndex]) / 100) * containerWidth
      
      const totalTwoPaneWidth = rightPaneEnd - leftPaneStart
      const newLeftPaneWidth = Math.max(50, Math.min(totalTwoPaneWidth - 50, mouseX - leftPaneStart))
      const newRightPaneWidth = totalTwoPaneWidth - newLeftPaneWidth
      
      const newLeftPercent = (newLeftPaneWidth / containerWidth) * 100
      const newRightPercent = (newRightPaneWidth / containerWidth) * 100
      
      const minPercent = 3
      if (newLeftPercent >= minPercent && newRightPercent >= minPercent) {
        inspectorWidths.value[leftPaneIndex] = `${newLeftPercent}%`
        inspectorWidths.value[rightPaneIndex] = `${newRightPercent}%`
      }
    }
  }
  
  const handleMouseUp = () => {
    isResizing.value = false
    resizeType.value = null
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
  }
  
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
}

// Prevent accidental navigation with unsaved changes
window.addEventListener('beforeunload', (event) => {
  if (hasUnsavedChanges.value) {
    event.preventDefault()
    event.returnValue = ''
  }
})


const handleRenameSubmit = (newAssetKey: string) => {
  if (!renameState.value.assetId) return;

  // The component just declares its intent.
  workspaceStore.renameAsset(renameState.value.assetId, newAssetKey);

  // The rename dialog can now be closed immediately.
  uiStore.closeRenamePrompt();
};




</script>

<style scoped>
.main-content {
  display: flex;
  flex-direction: column;
}

.workbench-layout {
  display: flex;
  flex: 1 1 auto;
  height: 0;
  user-select: none;
}

.explorer-pane {
  min-width: 200px;
  flex-shrink: 0;
  background-color: rgb(var(--v-theme-surface));
  border-right: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  height: 100%;
  display: flex;
  flex-direction: column;
}

.inspector-container {
  height: 100%;
  overflow: hidden;
}

.inspector-wrapper {
  min-width: 50px;
  background-color: rgb(var(--v-theme-surface));
  border-right: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.pane-separator {
  background-color: rgba(var(--v-border-color), var(--v-border-opacity));
  cursor: col-resize;
  transition: background-color 0.2s;
  flex-shrink: 0;
}

.pane-separator.vertical {
  width: 4px;
  height: 100%;
}

.pane-separator:hover {
  background-color: rgb(var(--v-theme-primary));
}

.status-bar {
  /* This is the key change to use your custom variable */
  background-color: rgb(var(--custom-statusbar-background)) !important;
  border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  font-size: 12px;
}

.validation-issue-item {
  cursor: pointer;
}

.validation-issue-item:hover {
  background-color: rgba(var(--v-theme-primary), 0.04);
}
</style>

















