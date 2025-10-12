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

    <!-- Matrix Content -->
    <div class="matrix-content flex-1-1 overflow-auto">
      <div v-if="!asset" class="d-flex flex-column justify-center align-center h-100">
        <v-icon size="96" color="grey-lighten-2" class="mb-4">
          mdi-table-large
        </v-icon>
        <h4 class="text-h5 text-medium-emphasis mb-2">
          No Environment Selected
        </h4>
        <p class="text-body-1 text-medium-emphasis">
          Select an environment to view the package matrix
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
          This environment has no nodes or packages to display in the matrix
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
                <div class="d-flex align-center">
                  <span>Packages</span>
                  <v-icon class="ms-2">mdi-arrow-down</v-icon>
                </div>
                <div class="corner-label">Nodes →</div>
              </th>
              <th
                v-for="node in matrixData.nodes"
                :key="node.id"
                class="matrix-cell matrix-cell--header matrix-cell--node"
              >
                <div class="node-header">
                  <v-icon class="mb-1">mdi-server</v-icon>
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
                  <v-icon class="me-2">mdi-package-variant</v-icon>
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
                  @click="selectPackage"
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
import { useAssetsStore } from '@/core/stores/assets'
import MatrixCell from './MatrixCell.vue'
import type { Asset } from '@/core/types'
import { ASSET_TYPES } from '@/content/config/constants'

// Props
interface Props {
  asset: Asset
  isEmbedded?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isEmbedded: false
})

const assetsStore = useAssetsStore()

// Reactive state
const packageFilter = ref<string>('')

// Computed properties
const currentEnvironment = computed((): Asset | null => props.asset)

interface MatrixData {
  nodes: Asset[]
  packages: Asset[]
}

const matrixData = computed((): MatrixData => {
  if (!currentEnvironment.value) {
    return { nodes: [], packages: [] }
  }
  
  const envFqn = currentEnvironment.value.fqn
  
  // Get nodes for this environment
  const nodes = assetsStore.unmergedAssets.filter((asset: Asset) => 
    asset.assetType === ASSET_TYPES.NODE && 
    asset.fqn.startsWith(envFqn + '::')
  )
  
  // Get all packages in the environment (both node-specific and generic)
  let packages = assetsStore.unmergedAssets.filter((asset: Asset) => 
    asset.assetType === ASSET_TYPES.PACKAGE && (
      asset.fqn.startsWith(envFqn + '::') || // Environment-specific packages
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

// Look up *unmerged* assets by id for assignment checks
const unmergedById = computed((): Map<string, Asset> => {
  const m = new Map<string, Asset>()
  for (const a of assetsStore.unmergedAssets) m.set(a.id, a)
  return m
})

const isPackageAssigned = (packageId: string, nodeId: string): boolean => {
  const pkg = unmergedById.value.get(packageId)
  const node = unmergedById.value.get(nodeId)
  return !!pkg && !!node && pkg.fqn.startsWith(node.fqn + '::')
}

const toggleAssignment = (packageId: string, nodeId: string): void => {
  console.log('Toggling assignment:', packageId, nodeId)
}

const selectPackage = async (packageId: string): Promise<void> => {
  try {
    await assetsStore.loadAssetDetails(packageId)
    assetsStore.openInspector(packageId)
  } catch (error) {
    console.error('Failed to select package:', error)
  }
}

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
  min-width: fit-content;
  padding: 16px;
}

.matrix-table table {
  border-collapse: separate;
  border-spacing: 1px;
}

.matrix-cell {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  background-color: rgb(var(--v-theme-surface));
  padding: 8px;
  text-align: center;
  vertical-align: middle;
}

.matrix-cell--header {
  background-color: rgb(var(--v-theme-surface-variant));
  font-weight: 600;
}

.matrix-cell--corner {
  position: relative;
  min-width: 150px;
  background: linear-gradient(
    135deg,
    rgb(var(--v-theme-surface-variant)) 50%,
    rgb(var(--v-theme-primary)) 50%
  );
}

.corner-label {
  position: absolute;
  bottom: 4px;
  right: 4px;
  font-size: 0.75rem;
  color: white;
  font-weight: 500;
}

.matrix-cell--node {
  min-width: 100px;
  writing-mode: vertical-rl;
  text-orientation: mixed;
}

.matrix-cell--package {
  min-width: 200px;
  text-align: left;
}

.matrix-cell--data {
  width: 100px;
  height: 60px;
  padding: 4px;
}

.node-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 4px;
}

.package-header {
  display: flex;
  align-items: center;
  justify-content: flex-start;
}
</style>
















