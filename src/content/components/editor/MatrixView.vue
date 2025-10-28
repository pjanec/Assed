<template>
  <div class="matrix-view h-100 d-flex flex-column">
    <!-- Matrix Header - only show when not embedded -->
    <div v-if="!isEmbedded" class="matrix-header pa-4 border-b">
      <div class="d-flex align-center justify-between">
        <div>
          <h3 class="text-h6 mb-1">
            Node × Package Matrix
          </h3>
          <p class="text-body-2 text-medium-emphasis mb-0">
            Manage package assignments across all nodes
          </p>
        </div>
        
        <div class="d-flex ga-2 align-center">
          <v-btn
            icon="mdi-refresh"
            size="small"
            @click="refreshMatrix"
          />
          <v-btn
            icon="mdi-export"
            size="small"
            @click="exportMatrix"
          />
        </div>
      </div>
    </div>

    <div class="matrix-content flex-1-1 overflow-auto" :class="{ 'drag-over-active': isMatrixDraggingOver }" @dragover.prevent="handleDragOver" @dragleave="handleDragLeave" @drop="handleDrop">
      <div v-if="!asset" class="d-flex flex-column justify-center align-center h-100">
        <v-icon size="96" color="grey-lighten-2" class="mb-4">
          mdi-table-large
        </v-icon>
        <h4 class="text-h5 text-medium-emphasis mb-2">
          No Distro Selected
        </h4>
        <p class="text-body-1 text-medium-emphasis">
          Select an distro to view the package matrix
        </p>
      </div>
      
      <div v-else-if="!isNodeSupported || !isPackageSupported" class="pa-8 text-center">
        <v-icon size="64" color="grey-lighten-2" class="mb-4">
          mdi-eye-off-outline
        </v-icon>
        <h4 class="text-h6 text-medium-emphasis mb-2">
          Matrix Not Available
        </h4>
        <p class="text-body-2 text-medium-emphasis">
          {{ !isNodeSupported ? 'Node' : 'Package' }} assets are not supported in the current perspective.
        </p>
      </div>
      
      <div v-else-if="matrixData.nodes.length === 0 || matrixData.packages.length === 0" class="pa-8 text-center">
        <v-icon size="64" color="grey-lighten-2" class="mb-4">
          mdi-table-off
        </v-icon>
        <h4 class="text-h6 text-medium-emphasis mb-2">
          No Data Available
        </h4>
        <p class="text-body-2 text-medium-emphasis">
          This distro has no nodes or packages to display in the matrix
        </p>
      </div>
      
      <!-- Matrix Table -->
      <div v-else class="matrix-table">
        <!-- Filter Box Above Table -->
        <div class="px-4 py-2">
          <v-text-field
            v-model="packageFilter"
            placeholder="Filter packages..."
            density="compact"
            hide-details
            prepend-inner-icon="mdi-magnify"
            clearable
            style="max-width: 300px;"
          />
        </div>
        
        <table class="w-100">
          <thead>
            <tr>
              <th class="matrix-cell matrix-cell--header matrix-cell--corner">
                <div class="d-flex justify-space-between align-center w-100">
                  <span :style="packageTitleStyle" class="font-weight-medium">Packages ↓ |</span>
                  <span :style="nodeTitleStyle" class="font-weight-medium">Nodes →</span>
                </div>
              </th>
              <th
                v-for="node in matrixData.nodes"
                :key="node.id"
                class="matrix-cell matrix-cell--header matrix-cell--node"
              >
                <div class="node-header">
                  <v-icon class="mb-1" :color="nodeColor">{{ coreConfig.getAssetIcon(ASSET_TYPES.NODE) }}</v-icon>
                  <div class="text-caption font-weight-medium">
                    {{ node.assetKey }}
                  </div>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="pkg in matrixData.packages" :key="pkg.id">
              <td class="matrix-cell matrix-cell--header matrix-cell--package">
                <div class="package-header">
                  <v-icon class="me-2" :color="packageColor">{{ coreConfig.getAssetIcon(ASSET_TYPES.PACKAGE) }}</v-icon>
                  <span class="text-body-2 font-weight-medium">
                    {{ pkg.assetKey }}
                  </span>
                </div>
              </td>
              <td
                v-for="node in matrixData.nodes"
                :key="`${pkg.id}-${node.id}`"
                class="matrix-cell matrix-cell--data"
              >
                <MatrixCell
                  :package="pkg"
                  :node="node"
                  :assigned="isPackageAssigned(pkg.id, node.id)"
                  @toggle="toggleAssignment"
                  @click="selectAssignment"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useTheme } from 'vuetify'
import { useAssetsStore, useUiStore, useWorkspaceStore, CreateAssetCommand, DeleteAssetsCommand } from '@/core/stores'
import MatrixCell from './MatrixCell.vue'
import type { Asset, AssetTreeNode, UnmergedAsset } from '@/core/types'
import { ASSET_TYPES } from '@/content/config/constants'
import { ASSET_TREE_NODE_TYPES, DROP_TARGET_TYPES } from '@/core/config/constants'
import { useDroppable } from '@/core/composables/useDroppable'
import { useCoreConfigStore } from '@/core/stores/config'

// Props
interface Props {
  asset: Asset
  isEmbedded?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isEmbedded: false
})

const assetsStore = useAssetsStore()
const uiStore = useUiStore()
const workspaceStore = useWorkspaceStore()
const coreConfig = useCoreConfigStore()
const theme = useTheme()

const packageFilter = ref<string>('')

const packageColor = computed(() => coreConfig.getAssetTypeColor(ASSET_TYPES.PACKAGE));
const nodeColor = computed(() => coreConfig.getAssetTypeColor(ASSET_TYPES.NODE));

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

const packageTitleStyle = computed(() => {
  const colorName = packageColor.value;
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

const {
  isDraggingOver: isMatrixDraggingOver,
  handleDragOver,
  handleDragLeave,
  handleDrop
} = useDroppable({
  type: DROP_TARGET_TYPES.ASSET,
  id: props.asset.id,
});

// Computed properties
const currentDistro = computed((): Asset | null => props.asset)

const isNodeSupported = computed(() => {
  const nodeDef = coreConfig.effectiveAssetRegistry[ASSET_TYPES.NODE];
  return (nodeDef as any)?._isSupportedInCurrentPerspective !== false;
});

const isPackageSupported = computed(() => {
  const packageDef = coreConfig.effectiveAssetRegistry[ASSET_TYPES.PACKAGE];
  return (packageDef as any)?._isSupportedInCurrentPerspective !== false;
});

interface MatrixData {
  nodes: Asset[]
  packages: Asset[]
}

const matrixData = computed((): MatrixData => {
  if (!currentDistro.value) {
    return { nodes: [], packages: [] }
  }
  
  const envFqn = currentDistro.value.fqn
  
  // Get nodes for this distro
  const nodes = assetsStore.unmergedAssets.filter((asset: Asset) => 
    asset.assetType === ASSET_TYPES.NODE && 
    asset.fqn.startsWith(envFqn + '::')
  )
  
  // Get all packages in the distro (both node-specific and generic)
  let packages = assetsStore.unmergedAssets.filter((asset: Asset) => 
    asset.assetType === ASSET_TYPES.PACKAGE && (
      asset.fqn.startsWith(envFqn + '::') || // Distro-specific packages
      !asset.fqn.includes('::') // Generic packages
    )
  )
  
  // Apply package filter if provided
  if (packageFilter.value) {
    const filterLower = packageFilter.value.toLowerCase()
    packages = packages.filter((pkg: Asset) => 
      pkg.assetKey.toLowerCase().includes(filterLower) ||
      pkg.fqn.toLowerCase().includes(filterLower)
    )
  }
  
  return { nodes, packages }
})

const unmergedById = computed((): Map<string, UnmergedAsset> => {
  const m = new Map<string, UnmergedAsset>();
  for (const a of assetsStore.unmergedAssets) m.set(a.id, a);
  return m;
});

const isPackageAssigned = (packageId: string, nodeId: string): boolean => {
  const pkg = unmergedById.value.get(packageId);
  const node = unmergedById.value.get(nodeId);
  if (!pkg || !node) return false;

  const expectedKeyFqn = `${node.fqn}::${pkg.assetKey}`;
  return assetsStore.unmergedAssets.some(
    a => a.assetType === ASSET_TYPES.PACKAGE_KEY && a.fqn === expectedKeyFqn
  );
};

const toggleAssignment = (packageId: string, nodeId: string): void => {
  const pkg = unmergedById.value.get(packageId);
  const node = unmergedById.value.get(nodeId);
  if (!pkg || !node) return;

  const expectedKeyFqn = `${node.fqn}::${pkg.assetKey}`;
  const existingKey = assetsStore.unmergedAssets.find(
    a => a.assetType === ASSET_TYPES.PACKAGE_KEY && a.fqn === expectedKeyFqn
  );

  if (existingKey) {
    const command = new DeleteAssetsCommand([existingKey as UnmergedAsset]);
    workspaceStore.executeCommand(command);
  } else {
    const packageKeyDef = coreConfig.effectiveAssetRegistry[ASSET_TYPES.PACKAGE_KEY];
    if (!packageKeyDef || (packageKeyDef as any)._isSupportedInCurrentPerspective === false) {
       console.warn("Cannot add requirement: PackageKey assets are not supported in the current perspective.");
       return;
    }

    const command = new CreateAssetCommand({
      assetType: ASSET_TYPES.PACKAGE_KEY,
      assetKey: pkg.assetKey,
      fqn: expectedKeyFqn,
      templateFqn: null,
      overrides: {},
    });
    workspaceStore.executeCommand(command);
  }
};

const selectAssignment = (packageId: string, nodeId: string): void => {
  const pkg = unmergedById.value.get(packageId);
  const node = unmergedById.value.get(nodeId);
  if (!pkg || !node) return;

  const expectedKeyFqn = `${node.fqn}::${pkg.assetKey}`;
  const existingKey = assetsStore.unmergedAssets.find(
    a => a.assetType === ASSET_TYPES.PACKAGE_KEY && a.fqn === expectedKeyFqn
  );

  if (existingKey) {
    const keyNode = assetsStore.getTreeNodeById(existingKey.id);
    if (keyNode) {
      assetsStore.openInspectorFor(keyNode, { reuse: true, focus: true });
    } else {
      assetsStore.openInspectorFor(existingKey.id, { reuse: true, focus: true });
    }
  }
};

const refreshMatrix = (): void => {
  console.log('Refreshing matrix')
}

const exportMatrix = (): void => {
  console.log('Exporting matrix')
}
</script>

<style scoped>
.matrix-header {
  background-color: rgb(var(--v-theme-surface-variant));
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.border-b {
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.matrix-table {
  padding: 0;
}

.matrix-table table {
  border-collapse: separate;
  border-spacing: 1px;
}

.matrix-cell {
  border: 1px solid rgba(var(--v-border-color), 0.3);
  background-color: rgb(var(--v-theme-surface));
  padding: 4px;
  text-align: center;
  vertical-align: middle;
}

.matrix-cell--header {
  background-color: rgba(var(--v-theme-surface-variant), 0.6);
  font-weight: 500;
}

.matrix-cell--corner {
  min-width: 150px;
  position: relative;
  text-align: left;
}

.matrix-cell--corner > div {
  width: 100%;
}

.matrix-cell--node {
  min-width: 100px;
}

.matrix-cell--package {
  min-width: 200px;
  text-align: left;
}

.matrix-cell--data {
  width: 60px;
  height: 40px;
}

.node-header {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.package-header {
  display: flex;
  align-items: center;
}

.drag-over-active {
  background-color: rgba(var(--v-theme-primary), 0.04) !important;
  outline: 1px dashed rgba(var(--v-theme-primary), 0.3);
  outline-offset: -1px;
}
</style>
















