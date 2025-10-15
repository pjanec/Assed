<template>
  <div>
    <v-list-item
      :class="[itemClass, { 
        'drag-over-active': isDraggingOver,
        'node--read-only': isSelfReadOnly 
      }]"
      :ripple="false"
      @click="handleClick"
      @contextmenu.prevent="handleContextMenu"
      v-dragsource="{ 
        assetId: node.id,
        sourceContext: CORE_DRAG_CONTEXTS.ASSET_TREE_NODE,
        instanceId: instanceId,
        disabled: !isDraggable 
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

          <div class="icon-wrapper me-2">
            <v-icon :color="iconColor" data-testid="base-icon" :aria-label="baseIcon">
              {{ baseIcon }}
            </v-icon>

            <v-icon
              v-if="inheritanceIcon"
              class="inheritance-overlay"
              data-testid="inheritance-overlay"
              :aria-label="inheritanceIcon"
            >
              {{ inheritanceIcon }}
            </v-icon>
          </div>
        </div>
      </template>

      <v-list-item-title :class="titleClass">
        {{ node.name }}
      </v-list-item-title>

      
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
import { useUiStore, useAssetsStore } from '@/core/stores/index';
import { useCoreConfigStore } from '@/core/stores/config';
import { useDroppable } from '@/core/composables/useDroppable';
import { DROP_TARGET_TYPES, CORE_DRAG_CONTEXTS, CONTEXT_MENU_KINDS, ASSET_TREE_NODE_TYPES, VIEW_HINTS } from '@/core/config/constants';


import type { AssetTreeNode } from '@/core/types';

const uiStore = useUiStore();
const coreConfig = useCoreConfigStore();
const assetsStore = useAssetsStore();

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

// Compute virtual context and read-only state
const isSelfReadOnly = computed(() => !!props.node.virtualContext);
const isAsset = computed(() => props.node.type === ASSET_TREE_NODE_TYPES.ASSET);

// An item cannot be dragged if it's not a real asset OR if it's a virtual folder itself.
const isDraggable = computed(() => isAsset.value && !isSelfReadOnly.value);

const { isDraggingOver, handleDragOver, handleDragLeave, handleDrop } = useDroppable({
  type: DROP_TARGET_TYPES.ASSET,
  id: props.node.id,
  virtualContext: props.node.virtualContext,
});




// Start collapsed for virtual folders to avoid clutter; otherwise, expand non-asset nodes by default
const isExpanded = ref(props.node.virtualContext ? false : (props.node.type !== 'asset'));
watch(() => uiStore.nodeToExpand, (nodeId) => {
  if (nodeId && nodeId === props.node.id) {
    isExpanded.value = true;
    uiStore.setNodeToExpand(null);
  }
});

// Actions are now handled by the unified GlobalContextMenu system
const isContainer = computed(() => props.node.children && props.node.children.length > 0);

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
  const viewHint = (props.node.virtualContext && (props.node as any).virtualContext.viewHint) || VIEW_HINTS.DEFAULT;
  uiStore.selectNode(props.node, viewHint);
  assetsStore.openInspectorFor(props.node, { viewHint, reuse: true, focus: true });
  if (isContainer.value) {
    toggleExpanded();
  }
};

const handleContextMenu = (event: MouseEvent) => {
  event.preventDefault();
  uiStore.showContextMenu({
    x: event.clientX,
    y: event.clientY,
    ctx: {
      kind: CONTEXT_MENU_KINDS.NODE_ACTIONS,
      node: props.node
    }
  });
};


const toggleExpanded = () => { isExpanded.value = !isExpanded.value; };

// Expose a public API that interaction rules can access
defineExpose({
  isExpanded: computed(() => isExpanded.value),
  toggle: toggleExpanded,
});

const titleClass = computed(() => !isAsset.value && isContainer.value ? 'font-weight-medium' : 'font-weight-regular');
const iconColor = computed(() => isAsset.value && props.node.assetType ? coreConfig.getAssetTypeColor(props.node.assetType) : 'primary');

// Determines the BASE icon for the asset or folder
const baseIcon = computed<string>(() => {
  if (props.node.virtualContext && (props.node as any).icon) {
    return (props.node as any).icon;
  }

  if (isAsset.value) {
    return coreConfig.getAssetIcon(props.node.assetType as any);
  }

  const typeIconMap: Record<string, string> = {
    [ASSET_TREE_NODE_TYPES.FOLDER]: isExpanded.value ? 'mdi-folder-open-outline' : 'mdi-folder-outline',
    [ASSET_TREE_NODE_TYPES.FILE_GROUP]: isExpanded.value ? 'mdi-file-multiple-outline' : 'mdi-file-multiple',
    [ASSET_TREE_NODE_TYPES.NAMESPACE]: 'mdi-file-tree-outline'
  } as Record<string, string>;
  return typeIconMap[props.node.type as string] || 'mdi-folder-outline';
});

// Determines the OVERLAY icon for inheritance state
const inheritanceIcon = computed<string | null>(() => {
  if (!isAsset.value) {
    return null;
  }

  const hasTemplate = !!props.node.templateFqn;
  const hasOverrides = !!(props.node as any).overrides && Object.keys((props.node as any).overrides || {}).length > 0;

  if (hasTemplate) {
    if (hasOverrides) {
      return 'mdi-pencil';
    }
    return 'mdi-link-variant';
  }

  return null;
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

.node--read-only {
  opacity: 0.7;
}

.node--read-only:hover {
  background-color: transparent !important; /* Prevent hover effect */
}


/* Additive inheritance overlay styles */
.icon-wrapper {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.inheritance-overlay {
  position: absolute;
  bottom: -2px;
  right: -4px;
  font-size: 0.8em;
  background-color: var(--v-background-base, white);
  border-radius: 50%;
  line-height: 1;
  color: var(--v-primary-base, #1976D2);
}
</style>








