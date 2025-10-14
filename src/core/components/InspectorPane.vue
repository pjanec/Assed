<template>
  <div class="inspector-pane h-100 d-flex flex-column">
    <!-- Inspector Header -->
    <div class="inspector-header pa-3 border-b">
      <div class="d-flex align-center justify-between">
        <div v-if="!isFolder && viewModel" class="d-flex align-center flex-1-1 min-width-0">
          <v-icon
            :color="coreConfig.getAssetTypeColor(viewModel.unmerged.assetType)"
            class="me-3 flex-shrink-0"
          >
            {{ coreConfig.getAssetIcon(viewModel.unmerged.assetType) }}
          </v-icon>
          <div class="flex-1-1 min-width-0">
            <!-- Main title row with compact secondary info -->
            <div class="d-flex align-center ga-4">
              <v-tooltip v-if="viewModel" location="bottom">
                <template #activator="{ props }">
                  <span class="text-h6 font-weight-medium text-truncate" v-bind="props">
                    {{ viewModel.unmerged.assetKey }}
                  </span>
                </template>
                <div v-if="viewModel" class="d-flex flex-column">
                  <span class="text-h6 font-weight-medium">{{ viewModel.unmerged.assetKey }}</span>
                  <span class="text-body-2" >{{ viewModel.unmerged.fqn }}</span>
                </div>
              </v-tooltip>

              <!-- FQN on a single line -->
              <div class="asset-secondary-info flex-shrink-1 min-width-0">
                <div class="text-body-2 text-medium-emphasis text-truncate">
                  {{ viewModel.unmerged.fqn }}
                </div>
              </div>
            </div>
          </div>
        </div>
        <h3 v-else class="text-h6">Inspector</h3>
        
        <div class="d-flex ga-1 flex-shrink-0">
          <v-btn
            icon="mdi-arrow-left"
            size="small"
            :disabled="!canGoBack"
            @click="goBack"
          />
          <v-btn
            icon="mdi-arrow-right"
            size="small"
            :disabled="!canGoForward"
            @click="goForward"
          />
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
      <div v-if="!isFolder && !viewModel" class="d-flex flex-column justify-center align-center h-100">
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
        <!-- When virtual folder, pass folder node instead of asset details -->
        <component
          v-if="isFolder"
          :is="asyncComponent"
          :folder="liveFolderNode"
        />
        <component
          v-else
          :is="asyncComponent"
          :asset="viewModel!"
          :is-read-only="viewModel!.isReadOnly"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, onBeforeUnmount, watch } from 'vue';
import { useAssetsStore, useUiStore } from '@/core/stores/index';
import { useCoreConfigStore } from '@/core/stores/config';
import type { AssetDetails, InspectorPaneInfo } from '@/core/types';
import { VIEW_HINTS } from '@/core/config/constants';
import { cloneDeep } from 'lodash-es';

interface Props {
  assetId: string;
  paneId: string;
}

const props = defineProps<Props>();

const assetsStore = useAssetsStore();
const uiStore = useUiStore();
const coreConfig = useCoreConfigStore();

const viewModel = computed((): AssetDetails | null => {
  // 1. Identify synthetic assets from the live tree
  const liveTreeNode = assetsStore.getTreeNodeById(props.assetId);
  const definition = liveTreeNode?.assetType ? coreConfig.getAssetDefinition(liveTreeNode.assetType as any) : null;
  if (definition?.isSynthetic && liveTreeNode?.virtualContext) {
    return {
      unmerged: {
        id: liveTreeNode.id,
        assetKey: liveTreeNode.name,
        assetType: liveTreeNode.assetType as any,
        fqn: liveTreeNode.path,
        overrides: liveTreeNode.virtualContext.payload || {},
      } as any,
      merged: null,
      isReadOnly: true,
    };
  }

  // 2. Alias presenter logic
  const realDetails = assetsStore.getUnmergedDetails(props.assetId);
  if (!realDetails) return null;
  if (uiStore.selectedNodeViewHint === VIEW_HINTS.MERGED && uiStore.selectedNode?.id === props.assetId && realDetails.merged) {
    const mergedViewModel = cloneDeep(realDetails);
    mergedViewModel.unmerged.overrides = realDetails.merged.properties || {};
    mergedViewModel.unmerged.templateFqn = null as any;
    mergedViewModel.isReadOnly = true;
    return mergedViewModel;
  }

  // 3. Default editable
  return realDetails;
});

const isActive = computed(() => uiStore.activePaneId === props.paneId);
const liveFolderNode = computed(() => assetsStore.getTreeNodeById(props.assetId));
const isFolder = computed(() => !!liveFolderNode.value && liveFolderNode.value.type === 'folder');

const canGoBack = computed(() => assetsStore.canHistoryBack(props.paneId));
const canGoForward = computed(() => assetsStore.canHistoryForward(props.paneId));

// Use defineAsyncComponent to handle loading/error states gracefully
const asyncComponent = computed(() => {
  const live = assetsStore.getTreeNodeById(props.assetId);
  // Virtual Folder inspector path
  if (live && live.type === 'folder') {
    const kind = live.virtualContext?.kind as any;
    const loader = async () => {
      const mod = await import('@/content/logic/virtual-folders/definitions');
      const provider = kind ? (mod as any).virtualFolderDefinitions[kind] : undefined;
      if (provider?.inspectorComponent) {
        const comp = await provider.inspectorComponent();
        return comp;
      }
      const generic = await import('@/core/components/VirtualFolderInspector.vue');
      return generic.default;
    };
    return defineAsyncComponent({ loader, delay: 200 });
  }

  if (!viewModel.value) return null as any;
  const assetType = viewModel.value.unmerged.assetType as any;
  if (!assetType) return null as any;
  const registration = coreConfig.getAssetDefinition(assetType);
  const loader = registration ? registration.inspectorComponent : null;
  if (!loader) return null as any;
  return defineAsyncComponent({ loader, delay: 200 });
});

const closeInspector = () => {
  assetsStore.closeInspector(props.paneId);
};

const toggleActive = () => {
  uiStore.setActivePane(props.paneId);
};

const goBack = async () => {
  await assetsStore.historyBack(props.paneId);
};

const goForward = async () => {
  await assetsStore.historyForward(props.paneId);
};

// Expose current pane id to BaseInspector for tab persistence
onMounted(() => {
  (window as any).CURRENT_INSPECTOR_PANE_ID = props.paneId;
});

watch(() => props.paneId, (newId) => {
  (window as any).CURRENT_INSPECTOR_PANE_ID = newId;
});

onBeforeUnmount(() => {
  if ((window as any).CURRENT_INSPECTOR_PANE_ID === props.paneId) {
    delete (window as any).CURRENT_INSPECTOR_PANE_ID;
  }
});
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








