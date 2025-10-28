<template>
  <v-card
    class="machine-card"
    :class="{ 'machine-card--drag-over': isDraggingOver }"
    :style="machineCardStyle"
    @click="$emit('click', machine.id)"
    @dragover.prevent="handleDragOver"
    @dragleave="handleDragLeave"
    @drop="handleDrop"
  >
    <v-card-title class="d-flex align-center">
      <v-icon class="me-2" :color="machineColor">{{ coreConfig.getAssetIcon(ASSET_TYPES.MACHINE) }}</v-icon>
      {{ machine.assetKey }}
    </v-card-title>

    <v-card-subtitle>
      {{ machine.fqn }}
    </v-card-subtitle>

    <v-card-text>
      <div v-if="assignedNodeKeys.length > 0">
        <div class="keys-list">
          <v-chip
            v-for="nodeKey in assignedNodeKeys"
            :key="nodeKey.id"
            :color="nodeColor"
            variant="tonal"
            size="small"
            class="ma-1"
            @click.stop="openNodeOrKeyInspector(nodeKey)"
            @contextmenu.prevent="showNodeKeyMenu($event, nodeKey)"
            v-dragsource="{ assetId: nodeKey.id, parentAssetId: props.machine.id, sourceContext: 'MachineCardChip' }"
          >
            <v-icon start>{{ coreConfig.getAssetIcon(ASSET_TYPES.NODE) }}</v-icon>
            {{ nodeKey.assetKey }}
          </v-chip>
        </div>
      </div>

      <div v-else class="text-center py-4">
        <v-icon color="grey-lighten-1" size="32" class="mb-2">{{ coreConfig.getAssetIcon(ASSET_TYPES.NODE) }}</v-icon>
        <p class="text-body-2 text-medium-emphasis">No nodes assigned</p>
      </div>
    </v-card-text>

    <v-card-actions>
      <v-btn size="small" prepend-icon="mdi-plus" @click.stop="addNodeAssignment">
        Assign Node
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { UnmergedAsset } from '@/core/types';
import { useAssetsStore, useCoreConfigStore, useUiStore, useWorkspaceStore, CreateAssetCommand } from '@/core/stores';
import { ASSET_TYPES } from '@/content/config/constants';
import { createTreeNodeFromAsset } from '@/core/utils/assetTreeUtils';
import { CONTEXT_MENU_KINDS, DROP_TARGET_TYPES } from '@/core/config/constants';
import { useDroppable } from '@/core/composables/useDroppable';
import { getEnvironmentForAsset } from '@/content/utils/assetUtils';

interface Machine { id: string; assetKey: string; fqn: string; assetType: string; }
interface Props { machine: Machine; }
const props = defineProps<Props>();
defineEmits(['click']);

const assetsStore = useAssetsStore();
const coreConfig = useCoreConfigStore();
const uiStore = useUiStore();
const workspaceStore = useWorkspaceStore();

const machineColor = computed(() => coreConfig.getAssetTypeColor(ASSET_TYPES.MACHINE));
const nodeColor = computed(() => coreConfig.getAssetTypeColor(ASSET_TYPES.NODE));

const machineCardStyle = computed(() => {
  const color = machineColor.value;
  return {
    backgroundColor: `rgba(var(--v-theme-${color}), 0.03)`
  };
});

const { isDraggingOver, handleDragOver, handleDragLeave, handleDrop } = useDroppable({
  type: DROP_TARGET_TYPES.ASSET,
  id: props.machine.id,
});

const assignedNodeKeys = computed(() =>
  assetsStore.unmergedAssets
    .filter(key => key.assetType === ASSET_TYPES.NODE_KEY && key.fqn.startsWith(props.machine.fqn + '::'))
    .sort((a, b) => a.assetKey.localeCompare(b.assetKey))
);

const parentEnvironment = computed<UnmergedAsset | undefined>(() => {
  // Use ancestry walk over full overrides set to resolve owning environment reliably
  const env = getEnvironmentForAsset(props.machine as unknown as UnmergedAsset, assetsStore.assetsWithOverrides);
  return env as UnmergedAsset | undefined;
});

const selectedDistroFqn = computed(() => parentEnvironment.value?.overrides?.distroFqn as string | undefined);

const findResolvedNode = (nodeKey: UnmergedAsset): UnmergedAsset | undefined => {
  if (!selectedDistroFqn.value) return undefined;
  return assetsStore.unmergedAssets.find(node =>
    node.assetType === ASSET_TYPES.NODE &&
    node.assetKey === nodeKey.assetKey &&
    (node.fqn === selectedDistroFqn.value || node.fqn.startsWith(selectedDistroFqn.value + '::'))
  );
};

const openNodeOrKeyInspector = (nodeKey: UnmergedAsset) => {
  const resolvedNode = findResolvedNode(nodeKey);
  const targetId = resolvedNode ? resolvedNode.id : nodeKey.id;
  const nodeToOpen = assetsStore.getTreeNodeById(targetId);
  if (nodeToOpen) {
    assetsStore.openInspectorFor(nodeToOpen, { reuse: true, focus: true });
  } else {
    assetsStore.openInspectorFor(targetId, { reuse: true, focus: true });
  }
};

const showNodeKeyMenu = (event: MouseEvent, nodeKey: UnmergedAsset) => {
  event.preventDefault();
  const treeNode = assetsStore.getTreeNodeById(nodeKey.id) ?? createTreeNodeFromAsset(nodeKey);
  if (treeNode) {
    uiStore.showContextMenu({ x: event.clientX, y: event.clientY, ctx: { kind: CONTEXT_MENU_KINDS.NODE_ACTIONS, node: treeNode } });
  }
};

const addNodeAssignment = async () => {
  if (!selectedDistroFqn.value) {
    console.warn('Cannot assign node: Parent environment has no distro selected.');
    return;
  }

  const availableNodes = assetsStore.assetsWithOverrides.filter(node =>
    node.assetType === ASSET_TYPES.NODE &&
    (node.fqn === selectedDistroFqn.value || node.fqn.startsWith(selectedDistroFqn.value + '::'))
  );

  const existingKeys = new Set(assignedNodeKeys.value.map(k => k.assetKey));
  const nodesToAdd = availableNodes.filter(n => !existingKeys.has(n.assetKey));
  if (nodesToAdd.length === 0) {
    // Show an empty picker to provide user feedback that nothing is available
    await uiStore.promptForAssetSelection({ title: `No available nodes to assign`, items: [] as unknown as any[] });
    return;
  }

  try {
    const selectedNode = await uiStore.promptForAssetSelection({
      title: `Assign Node to '${props.machine.assetKey}'`,
      items: nodesToAdd as unknown as any[],
    });

    if (selectedNode) {
      const command = new CreateAssetCommand({
        assetType: ASSET_TYPES.NODE_KEY,
        assetKey: selectedNode.assetKey,
        fqn: `${props.machine.fqn}::${selectedNode.assetKey}`,
        templateFqn: null,
        overrides: {},
      });
      workspaceStore.executeCommand(command);
    }
  } catch (error) {
    console.log('Node assignment cancelled or failed:', error);
  }
};

</script>

<style scoped>
.keys-list { max-height: 120px; overflow-y: auto; }
.machine-card {
  transition: all 0.2s;
  border: 2px solid transparent;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.machine-card .v-card-text {
  flex: 1 1 auto;
}

.machine-card .v-card-actions {
  margin-top: auto;
}
.machine-card:hover { transform: translateY(-2px); box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
.machine-card--drag-over {
  outline: 2px dashed rgb(var(--v-theme-primary));
  outline-offset: 2px;
  background-color: rgba(var(--v-theme-primary), 0.05);
}
</style>


