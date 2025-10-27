<template>
  <div class="canvas-view h-100 d-flex flex-column">
    <!-- Canvas Header - only show when not embedded -->
    <div v-if="!isEmbedded" class="canvas-header pa-4 border-b">
      <div class="d-flex align-center justify-between">
        <div>
          <h3 class="text-h6 mb-1">
            {{ environmentName || 'Environment Editor' }}
          </h3>
          <p class="text-body-2 text-medium-emphasis mb-0">
            Drag and drop to modify the environment configuration
          </p>
        </div>
        
        <div class="d-flex ga-2">
          <v-btn
            icon="mdi-refresh"
            size="small"
            @click="refreshView"
          />
          <v-btn
            icon="mdi-fit-to-page-outline"
            size="small"
            @click="fitToView"
          />
        </div>
      </div>
    </div>

    <!-- Canvas Content -->
    <div class="canvas-content flex-1-1 pa-4 overflow-auto">
      <div v-if="loading" class="d-flex justify-center align-center h-100">
        <v-progress-circular indeterminate color="primary" size="64" />
      </div>
      
      <div v-else-if="!asset" class="d-flex flex-column justify-center align-center h-100">
        <v-icon size="96" color="grey-lighten-2" class="mb-4">
          mdi-earth-plus
        </v-icon>
        <h4 class="text-h5 text-medium-emphasis mb-2">
          No Environment Selected
        </h4>
        <p class="text-body-1 text-medium-emphasis text-center mb-4">
          Select an environment from the Explorer to start editing,<br>
          or create a new environment from the home page.
        </p>
        <v-btn
          color="primary"
          prepend-icon="mdi-home"
          @click="goHome"
        >
          Go to Home
        </v-btn>
      </div>
      
      <div v-else-if="!isNodeSupported" class="d-flex flex-column justify-center align-center h-100">
        <v-icon size="96" color="grey-lighten-2" class="mb-4">
          mdi-eye-off-outline
        </v-icon>
        <h4 class="text-h5 text-medium-emphasis mb-2">
          Nodes Not Available
        </h4>
        <p class="text-body-1 text-medium-emphasis text-center">
          Node assets are not supported in the current perspective.
        </p>
      </div>

      <div v-else class="environment-canvas">
        <!-- Environment Info Card -->
        <v-card class="mb-4" elevation="2">
          <v-card-title class="d-flex align-center">
            <v-icon class="me-2" color="success">mdi-earth</v-icon>
            {{ asset.assetKey }}
          </v-card-title>
          <v-card-subtitle>
            {{ asset.overrides?.description || 'Environment configuration' }}
          </v-card-subtitle>
        </v-card>

        <!-- Nodes Grid -->
        <div class="nodes-grid">
          <NodeCard
            v-for="node in environmentNodes"
            :key="node.id"
            :node="node"
            @click="selectNode"
            @package-click="selectPackage"
          />
          
          <!-- Add Node Card -->
          <v-card
            class="node-card add-node-card d-flex align-center justify-center"
            variant="outlined"
            @click="addNewNode"
          >
            <div class="text-center">
              <v-icon size="48" color="primary" class="mb-2">
                mdi-plus-circle-outline
              </v-icon>
              <p class="text-body-2 text-primary font-weight-medium">
                Add Node
              </p>
            </div>
          </v-card>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAssetsStore, useUiStore, useWorkspaceStore } from '@/core/stores'
import NodeCard from './NodeCard.vue'
import type { Asset, UnmergedAsset, AssetTreeNode } from '@/core/types'
import { ASSET_TYPES } from '@/content/config/constants'
import { ASSET_TREE_NODE_TYPES } from '@/core/config/constants'
import { useCoreConfigStore } from '@/core/stores/config'

// Props
interface Props {
  asset: UnmergedAsset
  isEmbedded?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isEmbedded: false
})

const router = useRouter()
const assetsStore = useAssetsStore()
const uiStore = useUiStore()
const workspaceStore = useWorkspaceStore()
const coreConfig = useCoreConfigStore()

const loading = ref<boolean>(false)

// Computed properties
const currentEnvironment = computed((): UnmergedAsset => props.asset)

const environmentName = computed((): string | undefined => {
  return currentEnvironment.value?.assetKey
})

const environmentNodes = computed((): Asset[] => {
  if (!currentEnvironment.value) return []
  
  // Find all nodes that belong to this environment
  return assetsStore.unmergedAssets.filter((asset: Asset) =>
    asset.assetType === ASSET_TYPES.NODE && 
    asset.fqn.startsWith(currentEnvironment.value.fqn + '::')
  )
})

const isNodeSupported = computed(() => {
  const nodeDef = coreConfig.effectiveAssetRegistry[ASSET_TYPES.NODE];
  return (nodeDef as any)?._isSupportedInCurrentPerspective !== false;
});

// Methods
const refreshView = (): void => {
  console.log('Refreshing canvas view')
}

const fitToView = (): void => {
  console.log('Fitting canvas to view')
}

const goHome = (): void => {
  router.push('/')
}



const selectNode = (nodeId: string): void => {
  const asset = assetsStore.unmergedAssets.find(a => a.id === nodeId);
  if (asset) {
    uiStore.selectNode({
      id: asset.id,
      type: ASSET_TREE_NODE_TYPES.ASSET,
      name: asset.id,
      path: asset.fqn
    });
  }
}

const selectPackage = (packageId: string): void => {
  const asset = assetsStore.unmergedAssets.find(a => a.id === packageId);
  if (asset) {
    uiStore.selectNode({
      id: asset.id,
      type: ASSET_TREE_NODE_TYPES.ASSET,
      name: asset.id,
      path: asset.fqn
    });
  }
}

const addNewNode = async (): Promise<void> => {
  if (!currentEnvironment.value) return;
  
  workspaceStore.openNewAssetDialog({ 
    parentAsset: currentEnvironment.value, 
    childType: ASSET_TYPES.NODE, 
    namespace: null 
  });
}
</script>

<style scoped>
.canvas-header {
  background-color: rgb(var(--v-theme-surface-variant));
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.border-b {
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.environment-canvas {
  max-width: 1200px;
  margin: 0 auto;
}

.nodes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.node-card {
  min-height: 200px;
}

.add-node-card {
  cursor: pointer;
  transition: all 0.2s;
  border: 2px dashed rgba(var(--v-theme-primary), 0.3);
}

.add-node-card:hover {
  border-color: rgba(var(--v-theme-primary), 0.6);
  background-color: rgba(var(--v-theme-primary), 0.04);
}
</style>
















