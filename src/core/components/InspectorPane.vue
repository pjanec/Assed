<template>
  <div class="inspector-pane h-100 d-flex flex-column">
    <!-- Inspector Header -->
    <div class="inspector-header pa-3 border-b">
      <div class="d-flex align-center justify-between">
        <div v-if="selectedNodeDetails" class="d-flex align-center flex-1-1 min-width-0">
          <v-icon
            :color="coreConfig.getAssetTypeColor(selectedNodeDetails.unmerged.assetType)"
            class="me-3 flex-shrink-0"
          >
            {{ coreConfig.getAssetIcon(selectedNodeDetails.unmerged.assetType) }}
          </v-icon>
          <div class="flex-1-1 min-width-0">
            <!-- Main title row with compact secondary info -->
            <div class="d-flex align-center ga-4">
              <span class="text-h6 font-weight-medium text-truncate">
                {{ selectedNodeDetails.unmerged.assetKey }}
              </span>
              <!-- FQN on a single line -->
              <div class="asset-secondary-info flex-shrink-1 min-width-0">
                <div class="text-body-2 text-medium-emphasis text-truncate">
                  {{ selectedNodeDetails.unmerged.fqn }}
                </div>
              </div>
            </div>
          </div>
        </div>
        <h3 v-else class="text-h6">Inspector</h3>
        
        <div class="d-flex ga-1 flex-shrink-0">
          <v-btn
            :icon="isActive ? 'mdi-pin' : 'mdi-pin-outline'"
            size="small"
            @click="toggleActive"
          />
          <v-btn
            icon="mdi-close-circle-outline"
            size="small"
            @click="closeInspector"
          />
        </div>
      </div>
    </div>

    <!-- Inspector Content -->
    <div class="inspector-content flex-1-1 overflow-y-auto">
      <div v-if="!selectedNodeDetails" class="d-flex flex-column justify-center align-center h-100">
        <v-icon size="64" color="grey-lighten-2" class="mb-4">
          mdi-information-outline
        </v-icon>
        <h4 class="text-h6 text-medium-emphasis mb-2">
          No Asset Selected
        </h4>
        <p class="text-body-2 text-medium-emphasis text-center">
          Select an asset from the Explorer<br>
          to view and edit its properties.
        </p>
      </div>

      <!-- DYNAMIC INSPECTOR COMPONENT -->
      <div v-else class="h-100">
        <component :is="asyncComponent" :asset="selectedNodeDetails" v-if="activeInspectorComponent" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue';
import { useAssetsStore, useUiStore } from '@/core/stores/index';
import { useCoreConfigStore } from '@/core/stores/config';
import { storeToRefs } from 'pinia';
import type { AssetDetails, InspectorPaneInfo } from '@/core/types';

interface Props {
  assetId: string;
  paneId: string;
}

const props = defineProps<Props>();

const assetsStore = useAssetsStore();
const uiStore = useUiStore();
const coreConfig = useCoreConfigStore();
const { activeInspectorComponent } = storeToRefs(assetsStore);

const selectedNodeDetails = computed((): AssetDetails | null => {
  if (!props.paneId) return null;
      
  const pane = assetsStore.openInspectors.find((p: InspectorPaneInfo) => p.paneId === props.paneId);
  if (!pane || !pane.assetId) return null;

  // This handles virtual nodes like namespaces for display purposes.
  const node = uiStore.selectedNode;
  if (node && node.id === pane.assetId && node.type === 'namespace') {
    const assetDetails = assetsStore.getAssetDetails(node.id);
    if (!assetDetails) {
      return {
        unmerged: {
          id: node.id,
          assetKey: node.name,
          assetType: coreConfig.structuralAssetType as any,
          fqn: node.path,
          overrides: {},
        } as any,
        merged: null
      };
    }
  }

  // The main logic is now beautifully simple: just ask the assetsStore for the data.
  return assetsStore.getUnmergedDetails(pane.assetId);
});

const isActive = computed(() => uiStore.activePaneId === props.paneId);

// Use defineAsyncComponent to handle loading/error states gracefully
const asyncComponent = computed(() => {
  if (!activeInspectorComponent.value) {
    return null;
  }
  return defineAsyncComponent({
    loader: activeInspectorComponent.value,
    delay: 200,
  });
});

const closeInspector = () => {
  assetsStore.closeInspector(props.paneId);
};

const toggleActive = () => {
  uiStore.setActivePane(props.paneId);
};
</script>

<style scoped>
.inspector-header {
  background-color: rgb(var(--v-theme-surface-variant));
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.inspector-content {
  position: relative;
}
.min-width-0 {
  min-width: 0;
}
.text-truncate {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.asset-secondary-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/* Responsive header layout - stack vertically on narrow panes */
@media (max-width: 500px) {
  .d-flex.align-center.ga-4 {
    flex-direction: column;
    align-items: flex-start !important;
    gap: 8px !important;
  }
  
  .asset-secondary-info {
    align-self: stretch;
  }
}
</style>








