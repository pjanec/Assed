<template>
  <v-card
    class="node-card"
    :class="{ 
      'node-card--selected': isSelected,
      'node-card--drag-over': isDraggingOver 
    }"
    elevation="2"
    @click="$emit('click', node.id)"
    @dragover.prevent="handleDragOver"
    @dragleave="handleDragLeave"
    @drop="handleDrop"
  >
    <v-card-title class="d-flex align-center">
      <v-icon class="me-2" color="info">mdi-server</v-icon>
      {{ node.assetKey }}
    </v-card-title>
    
    <v-card-subtitle>
      {{ node.fqn }}
    </v-card-subtitle>

    <v-card-text>
      <!-- Package List -->
      <div v-if="nodePackages.length > 0">
        <p class="text-subtitle-2 mb-2">Packages ({{ nodePackages.length }})</p>
        
        <div class="packages-list">
          <v-chip
            v-for="pkg in nodePackages"
            :key="pkg.id"
            :color="getAssetTypeColor(pkg.assetType)"
            size="small"
            class="ma-1"
            @click.stop="$emit('package-click', pkg.id)"
            v-dragsource="{ 
              assetId: pkg.id, 
              parentAssetId: props.node.id, 
              sourceContext: CONTENT_DRAG_CONTEXTS.NODE_CARD,
              instanceId: instanceId
            }"
          >
            <v-icon start>mdi-package-variant</v-icon>
            {{ pkg.assetKey }}
          </v-chip>
        </div>
      </div>
      
      <div v-else class="text-center py-4">
        <v-icon color="grey-lighten-1" size="32" class="mb-2">
          mdi-package-variant-plus
        </v-icon>
        <p class="text-body-2 text-medium-emphasis">
          No packages assigned
        </p>
      </div>
    </v-card-text>

    <v-card-actions>
      <v-btn
        size="small"
        prepend-icon="mdi-plus"
        @click.stop="addPackage"
      >
        Add Package
      </v-btn>
      
      <v-spacer />
      
      <v-btn
        icon="mdi-dots-vertical"
        size="small"
        @click.stop="showNodeMenu"
      />
    </v-card-actions>
  </v-card>
</template>

<script setup lang="ts">
import { computed, getCurrentInstance } from 'vue'
import { useAssetsStore, useUiStore } from '@/core/stores/index'
import { useDroppable } from '@/core/composables/useDroppable';
import { CONTENT_DRAG_CONTEXTS, ASSET_TYPES } from '@/content/config/constants';
import { getAssetTypeColor } from '@/content/utils/assetUtils';

interface Node {
  id: string;
  assetKey: string;
  fqn: string;
  assetType: string;
}

interface Props {
  node: Node;
}

const assetsStore = useAssetsStore()
const uiStore = useUiStore()

// Give each instance a unique ID for the drag-drop instance registry
const instance = getCurrentInstance();
const instanceId = `node-card-${instance?.uid}`;

// Expose a public API (even if empty for now)
defineExpose({});

// Props
const props = defineProps<Props>()

// Emits
const emit = defineEmits<{
  (e: 'click', nodeId: string): void;
  (e: 'package-click', packageId: string): void;
}>();

// Droppable composable for drag and drop functionality
const { isDraggingOver, handleDragOver, handleDragLeave, handleDrop } = useDroppable({
  type: 'asset',
  id: props.node.id,
});

// Computed properties
const isSelected = computed(() => {
  return uiStore.selectedNode?.id === props.node.id
})

const nodePackages = computed(() =>
  assetsStore.unmergedAssets.filter((p: any) =>
    p.assetType === ASSET_TYPES.PACKAGE && p.fqn.startsWith(props.node.fqn + '::')
  )
)

// Methods
// Note: Using the global utility instead of local logic

const addPackage = () => {
  // TODO: Implement add package dialog
  console.log('Adding package to node:', props.node.id)
}

const showNodeMenu = () => {
  // TODO: Implement node context menu
  console.log('Showing node menu for:', props.node.id)
}
</script>

<style scoped>
.node-card {
  cursor: pointer;
  transition: all 0.2s;
  border: 2px solid transparent;
}

.node-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
}

.node-card--selected {
  border-color: rgb(var(--v-theme-primary));
  background-color: rgba(var(--v-theme-primary), 0.04);
}

/* Style for when a valid package is dragged over */
.node-card--drag-over {
  outline: 2px dashed rgb(var(--v-theme-primary));
  outline-offset: 2px;
  background-color: rgba(var(--v-theme-primary), 0.1) !important;
}

.packages-list {
  max-height: 120px;
  overflow-y: auto;
}

/* --- START: MODIFICATION --- */
/* Add styling to make draggable chips more obvious */
.packages-list .v-chip[draggable="true"] {
  cursor: grab;
}
.packages-list .v-chip[draggable="true"]:active {
  cursor: grabbing;
}
/* --- END: MODIFICATION --- */
</style>
















