<template>
  <div>
    <v-list-item
      :class="[itemClass, { 'drag-over-active': isDraggingOver }]"
      :ripple="false"
      @click="handleClick"
      @contextmenu.prevent="handleContextMenu"
      v-dragsource="{ 
        assetId: node.id,
        sourceContext: CORE_DRAG_CONTEXTS.ASSET_TREE_NODE,
        instanceId: instanceId,
        disabled: !isAsset 
      }"
      @dragover.prevent="handleDragOver"
      @dragleave="handleDragLeave"
      @drop="handleDrop"
    >
      <template #prepend>
        <div class="d-flex align-center" :style="{ paddingLeft: `${depth * 16}px` }">
          <v-btn
            v-if="isContainer"
            icon
            size="x-small"
            variant="plain"
            @click.stop="toggleExpanded"
          >
            <v-icon>
              {{ isExpanded ? 'mdi-chevron-down' : 'mdi-chevron-right' }}
            </v-icon>
          </v-btn>
          <div v-else style="width: 24px;" />

          <v-icon :color="iconColor" class="me-2">
            {{ nodeIcon }}
          </v-icon>
        </div>
      </template>

      <v-list-item-title :class="titleClass">
        {{ node.name }}
      </v-list-item-title>

      <template #append v-if="isAsset">
        <v-chip
          :color="node.assetType ? coreConfig.getAssetTypeColor(node.assetType) : 'grey'"
          size="x-small"
          variant="flat"
        >
          {{ node.assetType }}
        </v-chip>
      </template>
    </v-list-item>

    <!-- Context menu is now handled by GlobalContextMenu component in App.vue -->

    <div v-if="isContainer && isExpanded">
      <AssetTreeNode
        v-for="child in node.children"
        :key="child.id"
        :node="child"
        :view-type="viewType"
        :depth="depth + 1"
        @select-asset="emit('select-asset', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, getCurrentInstance } from 'vue';
import { useUiStore } from '@/core/stores/index';
import { useCoreConfigStore } from '@/core/stores/config';
import { useDroppable } from '@/core/composables/useDroppable';
import { DROP_TARGET_TYPES , CORE_DRAG_CONTEXTS } from '@/core/config/constants';


import type { AssetTreeNode } from '@/core/types';

const uiStore = useUiStore();
const coreConfig = useCoreConfigStore();

// Give each instance a unique ID for the drag-drop instance registry
const instance = getCurrentInstance();
const instanceId = `asset-tree-node-${instance?.uid}`;

interface Props {
  node: AssetTreeNode;
  viewType: string;
  depth?: number;
}

const props = withDefaults(defineProps<Props>(), {
  depth: 0
});

const emit = defineEmits<{
  (e: 'select-asset', node: AssetTreeNode): void;
  // REMOVE the following emits as they are no longer needed for the context menu
  // (e: 'open-in-new', node: AssetTreeNode): void;
  // (e: 'rename-asset', payload: { assetId: string, assetKey: string }): void;
  // (e: 'delete-asset', assetId: string): void;
  // (e: 'add-child-asset', payload: { parentAsset: Asset, childType: string }): void;
  // (e: 'add-asset-to-folder', folderPath: string): void;
  // (e: 'add-sub-folder', parentFqn: string): void;
}>();

const { isDraggingOver, handleDragOver, handleDragLeave, handleDrop } = useDroppable({
  type: DROP_TARGET_TYPES.ASSET,
  id: props.node.id,
});




const isExpanded = ref(props.node.type !== 'asset');
watch(() => uiStore.nodeToExpand, (nodeId) => {
  if (nodeId && nodeId === props.node.id) {
    isExpanded.value = true;
    uiStore.setNodeToExpand(null);
  }
});

// Actions are now handled by the unified GlobalContextMenu system
const isContainer = computed(() => props.node.children && props.node.children.length > 0);
const isAsset = computed(() => !!props.node.assetType);

// Removed validChildTypes - this functionality should be handled by the content layer

const itemClass = computed(() => {
  const classes = [];
  if (isAsset.value) {
    classes.push('asset-item');
    if (uiStore.selectedNode && uiStore.selectedNode.id === props.node.id) {
      classes.push('v-list-item--active');
    }
  }
  return classes;
});


const handleClick = () => {
  uiStore.selectNode(props.node);
  if (isContainer.value) {
    toggleExpanded();
  }
};

const handleContextMenu = (event: MouseEvent) => {
  event.preventDefault();
  // Simplified check - allow context menu for assets and folders
  if (isAsset.value || props.node.type === 'folder' || props.node.type === 'namespace') {
    uiStore.showContextMenu({
      x: event.clientX,
      y: event.clientY,
      ctx: {
        kind: 'node-actions',
        node: props.node
      }
    });
  }
};


const toggleExpanded = () => { isExpanded.value = !isExpanded.value; };

// Expose a public API that interaction rules can access
defineExpose({
  isExpanded: computed(() => isExpanded.value),
  toggle: toggleExpanded,
});

const titleClass = computed(() => !isAsset.value && isContainer.value ? 'font-weight-medium' : 'font-weight-regular');
const iconColor = computed(() => isAsset.value && props.node.assetType ? coreConfig.getAssetTypeColor(props.node.assetType) : 'primary');

const nodeIcon = computed(() => {
  if (isAsset.value) {
    return coreConfig.getAssetIcon(props.node.assetType as any);
  }
  const typeIconMap: Record<string, string> = {
    'folder': isExpanded.value ? 'mdi-folder-open-outline' : 'mdi-folder-outline',
    'file-group': isExpanded.value ? 'mdi-file-multiple-outline' : 'mdi-file-multiple',
    'namespace': 'mdi-file-tree-outline'
  };
  return typeIconMap[props.node.type || ''] || 'mdi-folder-outline';
});
</script>

<style scoped>
.asset-item {
  cursor: pointer;
  transition: background-color 0.2s;
}
.asset-item:hover {
  background-color: rgba(var(--v-theme-primary), 0.04);
}
.drag-over-active {
  outline: 2px dashed rgb(var(--v-theme-primary));
  outline-offset: -2px;
  background-color: rgba(var(--v-theme-primary), 0.1) !important;
}


</style>








