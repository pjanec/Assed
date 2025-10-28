<template>
  <div class="environment-layout-editor h-100 d-flex flex-column">
    <div class="layout-content flex-1-1 overflow-auto pa-4">
      <div v-if="!selectedDistroFqn" class="text-center text-medium-emphasis mt-8">
        Please select a Source Distro in the Environment's General Properties.
      </div>

      <div v-else-if="isLoading" class="d-flex justify-center align-center h-100">
        <v-progress-circular indeterminate color="primary" />
      </div>

      <div v-else-if="props.displayMode === 'matrix'" class="matrix-view-container">
        <table class="matrix-table w-100">
          <thead>
            <tr>
              <th class="matrix-cell matrix-cell--header matrix-cell--corner">
                <div class="d-flex justify-space-between align-center w-100">
                  <span :style="machineTitleStyle" class="font-weight-medium">Machines ↓ |</span>
                  <span :style="nodeTitleStyle" class="font-weight-medium">Nodes →</span>
                </div>
              </th>
              <th v-for="node in availableNodes" :key="node.id" class="matrix-cell matrix-cell--header matrix-cell--node">
                <div class="node-header">
                  <v-icon class="mb-1" :color="nodeColor">{{ coreConfig.getAssetIcon(node.assetType) }}</v-icon>
                  <div class="text-caption font-weight-medium">{{ node.assetKey }}</div>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="machine in environmentMachines" :key="machine.id">
              <td class="matrix-cell matrix-cell--header matrix-cell--machine">
                <div class="d-flex align-center">
                  <v-icon class="me-2" :color="machineColor">{{ coreConfig.getAssetIcon(machine.assetType) }}</v-icon>
                  <span class="text-body-2 font-weight-medium">{{ machine.assetKey }}</span>
                </div>
              </td>
              <td v-for="node in availableNodes" :key="`${machine.id}-${node.id}`" class="matrix-cell matrix-cell--data">
                <v-checkbox-btn
                  :model-value="isNodeAssigned(machine.id, node.assetKey)"
                  @update:modelValue="toggleNodeAssignment(machine.id, node.assetKey)"
                  color="primary"
                  density="compact"
                  hide-details
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else-if="props.displayMode === 'nodes'" class="canvas-view-container item-grid">
        <v-card
          v-for="node in availableNodes"
          :key="node.id"
          class="node-assignment-card"
          :class="{ 'drop-target-active': getDroppable(node.id).isDraggingOver.value }"
          :style="nodeCardStyle"
          elevation="1"
          @dragover.prevent="getDroppable(node.id).handleDragOver"
          @dragleave="getDroppable(node.id).handleDragLeave"
          @drop.prevent.stop="getDroppable(node.id).handleDrop($event)"
        >
          <v-card-title class="d-flex align-center text-body-2 font-weight-medium">
            <v-icon class="me-2" :color="nodeColor">{{ coreConfig.getAssetIcon(node.assetType) }}</v-icon>
            {{ node.assetKey }}
          </v-card-title>
          <v-divider />
          <v-card-text class="pa-2">
            <div class="assigned-machines-list">
              <v-chip
                v-for="assignment in getAssignmentsForNode(node.assetKey)"
                :key="assignment.nodeKey.id"
                size="small"
                class="ma-1"
                :color="machineColor"
                variant="tonal"
                label
                :draggable="true"
                v-dragsource="{ assetId: assignment.nodeKey.id, parentAssetId: assignment.machine.id, sourceContext: 'EnvLayoutCanvasChip', assetType: ASSET_TYPES.NODE_KEY }"
                @contextmenu.prevent="showNodeKeyMenuFromChip($event, assignment.nodeKey)"
              >
                <v-icon start size="small">{{ coreConfig.getAssetIcon(ASSET_TYPES.MACHINE) }}</v-icon>
                {{ assignment.machine.assetKey }}
              </v-chip>
              <div v-if="getAssignmentsForNode(node.assetKey).length === 0" class="text-center py-4">
                <v-icon color="grey-lighten-1" size="32" class="mb-2">{{ coreConfig.getAssetIcon(ASSET_TYPES.MACHINE) }}</v-icon>
                <p class="text-body-2 text-medium-emphasis">No machines assigned</p>
              </div>
            </div>
          </v-card-text>
          <v-card-actions>
            <v-btn
              size="small"
              prepend-icon="mdi-plus"
              @click.stop="addMachineAssignment(node)"
            >
              Assign Machine
            </v-btn>
          </v-card-actions>
        </v-card>
      </div>
    </div>
  </div>
 </template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useTheme } from 'vuetify';
import { useAssetsStore, useCoreConfigStore, useWorkspaceStore, CreateAssetCommand, DeleteAssetsCommand } from '@/core/stores';
import { DeriveAssetCommand, CompositeCommand } from '@/core/stores/workspace';
import type { UnmergedAsset } from '@/core/types';
import { ASSET_TYPES } from '@/content/config/constants';
import { useDroppable } from '@/core/composables/useDroppable';
import { vDragsource } from '@/core/directives/dragsource';
import { useUiStore } from '@/core/stores/ui';
import { CONTEXT_MENU_KINDS, DROP_TARGET_TYPES } from '@/core/config/constants';
import { createTreeNodeFromAsset } from '@/core/utils/assetTreeUtils';
import { resolveInheritedCollection } from '@/core/utils/inheritanceUtils';
import { calculateMergedAsset } from '@/core/utils/mergeUtils';
import { getEnvironmentForAsset } from '@/content/utils/assetUtils';

interface Props {
  environmentAsset: UnmergedAsset;
  displayMode: 'nodes' | 'matrix';
}
const props = defineProps<Props>();
const isLoading = ref(false);

const assetsStore = useAssetsStore();
const coreConfig = useCoreConfigStore();
const workspaceStore = useWorkspaceStore();
const uiStore = useUiStore();
const theme = useTheme();

const nodeColor = computed(() => coreConfig.getAssetTypeColor(ASSET_TYPES.NODE));
const machineColor = computed(() => coreConfig.getAssetTypeColor(ASSET_TYPES.MACHINE));

const getColorValue = (colorName: string) => {
  const colors = theme.current.value.colors;
  if (colors[colorName]) {
    return colors[colorName];
  }
  const parts = colorName.split('-');
  if (parts.length === 3 && (parts[1] === 'darken' || parts[1] === 'lighten')) {
    const camelKey = `${parts[0]}${parts[1].charAt(0).toUpperCase() + parts[1].slice(1)}${parts[2]}`;
    if (colors[camelKey]) {
      return colors[camelKey];
    }
  }
  return null;
};

const machineTitleStyle = computed(() => {
  const colorName = machineColor.value;
  const colorValue = getColorValue(colorName);
  if (colorValue) {
    return { color: colorValue };
  }
  return { color: `rgb(var(--v-theme-${colorName}))` };
});

const nodeTitleStyle = computed(() => {
  const colorName = nodeColor.value;
  const colorValue = getColorValue(colorName);
  if (colorValue) {
    return { color: colorValue };
  }
  return { color: `rgb(var(--v-theme-${colorName}))` };
});

const nodeCardStyle = computed(() => {
  const color = nodeColor.value;
  return {
    backgroundColor: `rgba(var(--v-theme-${color}), 0.03)`
  };
});

const selectedDistroFqn = computed(() => {
  if (!props.environmentAsset) return undefined;
  
  // Calculate merged properties to get inherited distroFqn
  const allAssetsMap = new Map(assetsStore.unmergedAssets.map(a => [a.id, a]));
  const merged = calculateMergedAsset(props.environmentAsset.id, allAssetsMap);
  if ('error' in merged) {
    // Fallback to unmerged if merge calculation fails
    return props.environmentAsset?.overrides?.distroFqn as string | undefined;
  }
  return merged.properties?.distroFqn as string | undefined;
});

const environmentMachines = computed(() => {
  if (!props.environmentAsset) return [];

  return resolveInheritedCollection(
    props.environmentAsset,
    ASSET_TYPES.MACHINE,
    assetsStore.unmergedAssets,
    coreConfig.effectiveAssetRegistry
  ).sort((a, b) => a.assetKey.localeCompare(b.assetKey));
});

const availableNodes = computed(() => {
  if (!selectedDistroFqn.value) return [] as UnmergedAsset[];

  const distroAsset = assetsStore.unmergedAssets.find(a => a.fqn === selectedDistroFqn.value);
  if (!distroAsset) return [] as UnmergedAsset[];

  return resolveInheritedCollection(
    distroAsset,
    ASSET_TYPES.NODE,
    assetsStore.unmergedAssets,
    coreConfig.effectiveAssetRegistry
  ).sort((a, b) => a.assetKey.localeCompare(b.assetKey));
});

const environmentNodeKeys = computed(() => {
  const keys = new Map<string, UnmergedAsset>();
  environmentMachines.value.forEach(machine => {
    assetsStore.unmergedAssets.forEach(key => {
      if (key.assetType === ASSET_TYPES.NODE_KEY && key.fqn.startsWith(machine.fqn + '::')) {
        keys.set(key.fqn, key as UnmergedAsset);
      }
    });
  });
  return keys;
});

const isNodeAssigned = (machineId: string, nodeAssetKey: string): boolean => {
  const machine = environmentMachines.value.find(m => m.id === machineId);
  if (!machine) return false;
  const expectedKeyFqn = `${machine.fqn}::${nodeAssetKey}`;
  return environmentNodeKeys.value.has(expectedKeyFqn);
};

const toggleNodeAssignment = (machineId: string, nodeAssetKey: string) => {
  const machine = environmentMachines.value.find(m => m.id === machineId);
  if (!machine) return;

  const expectedKeyFqn = `${machine.fqn}::${nodeAssetKey}`;
  const existingKey = environmentNodeKeys.value.get(expectedKeyFqn);

  if (existingKey) {
    const command = new DeleteAssetsCommand([existingKey]);
    workspaceStore.executeCommand(command);
  } else {
    const command = new CreateAssetCommand({
      assetType: ASSET_TYPES.NODE_KEY,
      assetKey: nodeAssetKey,
      fqn: expectedKeyFqn,
      templateFqn: null,
      overrides: {},
    });
    workspaceStore.executeCommand(command);
  }
};

interface NodeAssignmentInfo { machine: UnmergedAsset; nodeKey: UnmergedAsset; }
const getAssignmentsForNode = (nodeAssetKey: string): NodeAssignmentInfo[] => {
  const assignments: NodeAssignmentInfo[] = [];
  environmentNodeKeys.value.forEach((nodeKey, keyFqn) => {
    if (nodeKey.assetKey === nodeAssetKey) {
      const machineFqn = keyFqn.substring(0, keyFqn.lastIndexOf('::'));
      const machine = environmentMachines.value.find(m => m.fqn === machineFqn);
      if (machine) assignments.push({ machine: machine as UnmergedAsset, nodeKey });
    }
  });
  return assignments.sort((a, b) => a.machine.assetKey.localeCompare(b.machine.assetKey));
};

const showNodeKeyMenuFromChip = (event: MouseEvent, nodeKey: UnmergedAsset) => {
  event.preventDefault();
  
  let treeNode = assetsStore.getTreeNodeById(nodeKey.id);

  if (!treeNode) {
    treeNode = createTreeNodeFromAsset(nodeKey);
    console.warn(`NodeKey ${nodeKey.fqn} not found directly in tree, creating temporary node for context menu.`);
  }

  const nodeForMenu = { ...treeNode, virtualContext: undefined };

  uiStore.showContextMenu({
    x: event.clientX,
    y: event.clientY,
    ctx: {
      kind: CONTEXT_MENU_KINDS.NODE_ACTIONS,
      node: nodeForMenu,
    },
  });
};

// Per-node droppable instances, matching NodeCard/MachineCard pattern
const droppablesByNodeId = new Map<string, ReturnType<typeof useDroppable>>();
const getDroppable = (nodeId: string) => {
  let inst = droppablesByNodeId.get(nodeId);
  if (!inst) {
    inst = useDroppable({ type: DROP_TARGET_TYPES.ASSET, id: nodeId });
    droppablesByNodeId.set(nodeId, inst);
  }
  return inst;
};

const addMachineAssignment = async (node: UnmergedAsset) => {
  const assignedMachines = getAssignmentsForNode(node.assetKey).map(a => a.machine.id);
  const machinesToAdd = environmentMachines.value.filter(m => !assignedMachines.includes(m.id));
  
  if (machinesToAdd.length === 0) {
    await uiStore.promptForAssetSelection({ title: `No available machines to assign`, items: [] as unknown as any[] });
    return;
  }

  try {
    const selectedMachine = await uiStore.promptForAssetSelection({
      title: `Assign Machine to '${node.assetKey}'`,
      items: machinesToAdd as unknown as any[],
    });

    if (!selectedMachine) return;

    const currentEnv = props.environmentAsset;
    const owningEnv = getEnvironmentForAsset(selectedMachine as unknown as UnmergedAsset, assetsStore.unmergedAssets);
    const ownedByCurrentEnv = owningEnv && owningEnv.id === currentEnv.id;

    const existingLocalMachine = assetsStore.unmergedAssets.find(a =>
      a.assetType === ASSET_TYPES.MACHINE && a.fqn === `${currentEnv.fqn}::${(selectedMachine as any).assetKey}`
    ) as UnmergedAsset | undefined;

    const commands: (DeriveAssetCommand | CreateAssetCommand)[] = [];

    let targetMachineFqn = (selectedMachine as any).fqn as string;
    if (!ownedByCurrentEnv) {
      if (existingLocalMachine) {
        targetMachineFqn = existingLocalMachine.fqn;
      } else {
        const deriveCmd = new DeriveAssetCommand(selectedMachine as unknown as UnmergedAsset, currentEnv.fqn, (selectedMachine as any).assetKey);
        commands.push(deriveCmd);
        targetMachineFqn = deriveCmd.derivedAsset.fqn;
      }
    }

    const targetKeyFqn = `${targetMachineFqn}::${node.assetKey}`;
    const exists = assetsStore.unmergedAssets.some(a => a.assetType === ASSET_TYPES.NODE_KEY && a.fqn === targetKeyFqn);
    if (!exists) {
      commands.push(new CreateAssetCommand({
        assetType: ASSET_TYPES.NODE_KEY,
        assetKey: node.assetKey,
        fqn: targetKeyFqn,
        templateFqn: null,
        overrides: {},
      }));
    }

    if (commands.length > 0) {
      workspaceStore.executeCommand(commands.length > 1 ? new CompositeCommand(commands) : commands[0]);
    }
  } catch (error) {
    console.log('Machine assignment cancelled or failed:', error);
  }
};

// Kept to support programmatic assignment paths
const handleDropMachineOnNodeCard = (dragPayload: any, targetNodeAsset: UnmergedAsset) => {
  if (dragPayload.assetType !== ASSET_TYPES.MACHINE) {
    console.warn("Drop rejected: Only Machine assets can be assigned here.");
    uiStore.clearDragState();
    return;
  }

  const machineAsset = assetsStore.unmergedAssets.find(a => a.id === dragPayload.assetId);
  if (!machineAsset) {
    console.error("Drop failed: Source machine asset not found.");
    uiStore.clearDragState();
    return;
  }

  const isValidMachine = environmentMachines.value.some(m => m.id === machineAsset.id);
  if (!isValidMachine) {
    uiStore.setDragValidationState(true, 'This Machine does not belong to the selected Environment.');
    uiStore.clearDragState();
    return;
  }

  // If already assigned to current FQN, exit
  const expectedKeyFqnCurrent = `${machineAsset.fqn}::${targetNodeAsset.assetKey}`;
  if (environmentNodeKeys.value.has(expectedKeyFqnCurrent)) {
    uiStore.clearDragState();
    return;
  }

  const currentEnv = props.environmentAsset;
  const owningEnv = getEnvironmentForAsset(machineAsset as unknown as UnmergedAsset, assetsStore.unmergedAssets);
  const ownedByCurrentEnv = owningEnv && owningEnv.id === currentEnv.id;

  const existingLocalMachine = assetsStore.unmergedAssets.find(a =>
    a.assetType === ASSET_TYPES.MACHINE && a.fqn === `${currentEnv.fqn}::${(machineAsset as any).assetKey}`
  ) as UnmergedAsset | undefined;

  const commands: (DeriveAssetCommand | CreateAssetCommand)[] = [];
  let targetMachineFqn = (machineAsset as any).fqn as string;
  if (!ownedByCurrentEnv) {
    if (existingLocalMachine) {
      targetMachineFqn = existingLocalMachine.fqn;
    } else {
      const deriveCmd = new DeriveAssetCommand(machineAsset as unknown as UnmergedAsset, currentEnv.fqn, (machineAsset as any).assetKey);
      commands.push(deriveCmd);
      targetMachineFqn = deriveCmd.derivedAsset.fqn;
    }
  }

  const expectedKeyFqnRetargeted = `${targetMachineFqn}::${targetNodeAsset.assetKey}`;
  const exists = assetsStore.unmergedAssets.some(a => a.assetType === ASSET_TYPES.NODE_KEY && a.fqn === expectedKeyFqnRetargeted);
  if (!exists) {
    commands.push(new CreateAssetCommand({
      assetType: ASSET_TYPES.NODE_KEY,
      assetKey: targetNodeAsset.assetKey,
      fqn: expectedKeyFqnRetargeted,
      templateFqn: null,
      overrides: {},
    }));
  }

  if (commands.length > 0) {
    workspaceStore.executeCommand(commands.length > 1 ? new CompositeCommand(commands) : commands[0]);
  }
  uiStore.clearDragState();
};

// Removed local vDroptarget directive in favor of direct handlers

watch([selectedDistroFqn, () => props.environmentAsset], () => {
  // Placeholder for async loading if needed
}, { immediate: true });
</script>

<style scoped>
.environment-layout-editor { border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); border-radius: 4px; }
.layout-content { background-color: rgba(var(--v-theme-surface), 0.5); }
.border-b { border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); }

.matrix-table { border-collapse: separate; border-spacing: 1px; }
.matrix-cell { border: 1px solid rgba(var(--v-border-color), 0.3); background-color: rgb(var(--v-theme-surface)); padding: 4px; text-align: center; vertical-align: middle; }
.matrix-cell--header { background-color: rgba(var(--v-theme-surface-variant), 0.6); font-weight: 500; }
.matrix-cell--corner { min-width: 150px; position: relative; }
.matrix-cell--corner > div { width: 100%; }
.matrix-cell--node { min-width: 100px; }
.matrix-cell--machine { min-width: 150px; text-align: left; }
.matrix-cell--data { width: 60px; height: 40px; }
.node-header { display: flex; flex-direction: column; align-items: center; }

.item-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 16px; }
.node-assignment-card { transition: box-shadow 0.2s ease-in-out; display: flex; flex-direction: column; height: 100%; }
.node-assignment-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
.assigned-machines-list { min-height: 40px; max-height: 150px; overflow-y: auto; }

.node-assignment-card .v-card-text { flex: 1 1 auto; }
.node-assignment-card .v-card-actions { margin-top: auto; }

.node-assignment-card.drop-target-active {
  outline: 2px dashed rgb(var(--v-theme-primary));
  outline-offset: 2px;
  background-color: rgba(var(--v-theme-primary), 0.05);
}
</style>


