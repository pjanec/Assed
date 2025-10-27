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
      <div v-if="nodeRequirements.length > 0">
        <p class="text-subtitle-2 mb-2">Requirements ({{ nodeRequirements.length }})</p>

        <div class="packages-list">
          <v-chip
            v-for="requirement in nodeRequirements"
            :key="requirement.id"
            :color="coreConfig.getAssetTypeColor(requirement.assetType)"
            size="small"
            class="ma-1"
            @click.stop="openRequirement(requirement.id)"
            @contextmenu.prevent="showRequirementMenu($event, requirement)"
            v-dragsource="{ 
              assetId: requirement.id, 
              parentAssetId: props.node.id, 
              sourceContext: CONTENT_DRAG_CONTEXTS.NODE_CARD,
              instanceId: instanceId
            }"
          >
            <v-icon start>{{ coreConfig.getAssetIcon(requirement.assetType) }}</v-icon>
            {{ requirement.assetKey }}
          </v-chip>
        </div>
      </div>

      <div v-else class="text-center py-4">
        <v-icon color="grey-lighten-1" size="32" class="mb-2">
          mdi-link-variant-plus
        </v-icon>
        <p class="text-body-2 text-medium-emphasis">
          No requirements assigned
        </p>
      </div>
    </v-card-text>

    <v-card-actions>
      <v-btn
        size="small"
        prepend-icon="mdi-plus"
        @click.stop="addRequirement"
      >
        Add Requirement
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
import { useAssetsStore, useUiStore, useWorkspaceStore, CreateAssetCommand, CompositeCommand } from '@/core/stores'
import { useDroppable } from '@/core/composables/useDroppable';
import { CONTENT_DRAG_CONTEXTS, ASSET_TYPES } from '@/content/config/constants';
import { getAssetDistroFqn, isSharedAsset } from '@/content/utils/assetUtils';
import type { Asset, UnmergedAsset } from '@/core/types';
import { useCoreConfigStore } from '@/core/stores/config';
import { ASSET_TREE_NODE_TYPES, CONTEXT_MENU_KINDS } from '@/core/config/constants';
import { ensurePackageInDistroPool } from '@/content/logic/workspaceExtendedActions';
import { createTreeNodeFromAsset } from '@/core/utils/assetTreeUtils';

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
const workspaceStore = useWorkspaceStore()
const coreConfig = useCoreConfigStore()

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

const nodeRequirements = computed(() =>
  assetsStore.unmergedAssets.filter((p: any) =>
    p.assetType === ASSET_TYPES.PACKAGE_KEY && p.fqn.startsWith(props.node.fqn + '::')
  ).sort((a, b) => a.assetKey.localeCompare(b.assetKey))
)

// Methods
// Note: Using the global utility instead of local logic

const addRequirement = async () => {
  const node = props.node;
  if (!node) return;

  try {
    const allAssets = assetsStore.unmergedAssets;
    const nodeDistroFqn = getAssetDistroFqn(node.fqn, allAssets);

    const packageKeyDef = coreConfig.effectiveAssetRegistry[ASSET_TYPES.PACKAGE_KEY];
    if (!packageKeyDef || (packageKeyDef as any)._isSupportedInCurrentPerspective === false) {
       console.warn("Cannot add requirement: PackageKey assets are not supported in the current perspective.");
       return;
    }

    const availablePackages = allAssets.filter(a =>
      a.assetType === ASSET_TYPES.PACKAGE &&
      (isSharedAsset(a, allAssets) || getAssetDistroFqn(a.fqn, allAssets) === nodeDistroFqn)
    );

    const existingRequirementKeys = new Set(
      allAssets
        .filter(a => a.assetType === ASSET_TYPES.PACKAGE_KEY && a.fqn.startsWith(node.fqn + '::'))
        .map(a => a.assetKey)
    );

    const packagesToAdd = availablePackages.filter(
      pkg => !existingRequirementKeys.has(pkg.assetKey)
    ).sort((a, b) => a.assetKey.localeCompare(b.assetKey));

    if (packagesToAdd.length === 0) {
      console.log("No available packages to add a requirement for.");
      return;
    }

    const selectedPackage = await uiStore.promptForAssetSelection({
      title: `Add Requirement to '${node.assetKey}'`,
      items: packagesToAdd,
    });

    if (selectedPackage) {
      const commands = [];
      
      const poolCommands = ensurePackageInDistroPool(selectedPackage as UnmergedAsset, nodeDistroFqn);
      commands.push(...poolCommands);
      
      const keyCommand = new CreateAssetCommand({
        assetType: ASSET_TYPES.PACKAGE_KEY,
        assetKey: selectedPackage.assetKey,
        fqn: `${node.fqn}::${selectedPackage.assetKey}`,
        templateFqn: null,
        overrides: {},
      });
      commands.push(keyCommand);
      
      if (commands.length === 1) {
        workspaceStore.executeCommand(keyCommand);
      } else {
        workspaceStore.executeCommand(new CompositeCommand(commands));
      }
    }
  } catch (error) {
    console.log("Add requirement cancelled or failed:", error);
  }
};

const showNodeMenu = () => {
  // TODO: Implement node context menu
  console.log('Showing node menu for:', props.node.id)
}

const openRequirement = (requirementId: string) => {
  const node = assetsStore.getTreeNodeById(requirementId);
  if (node) {
    assetsStore.openInspectorFor(node, { reuse: true, focus: true });
  } else {
     assetsStore.openInspectorFor(requirementId, { reuse: true, focus: true });
  }
}

const showRequirementMenu = (event: MouseEvent, requirement: UnmergedAsset) => {
  event.preventDefault();
  
  let treeNode = assetsStore.getTreeNodeById(requirement.id);
  
  if (!treeNode) {
    treeNode = createTreeNodeFromAsset(requirement);
  } else if (treeNode.virtualContext) {
    treeNode = { ...treeNode, virtualContext: undefined };
  }

  uiStore.showContextMenu({
    x: event.clientX,
    y: event.clientY,
    ctx: {
      kind: CONTEXT_MENU_KINDS.NODE_ACTIONS,
      node: treeNode,
    },
  });
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
















