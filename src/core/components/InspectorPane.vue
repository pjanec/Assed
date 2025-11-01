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

              <!-- Template navigation button (compact, next to name/FQN) -->
              <v-tooltip v-if="viewModel" location="bottom">
                <template #activator="{ props }">
                  <v-btn
                    v-bind="props"
                    icon="mdi-link-variant"
                    variant="text"
                    class="template-nav-btn"
                    size="x-small"
                    density="compact"
                    :disabled="!templateTargetId"
                    @click.stop="goToTemplate"
                  />
                </template>
                <span>{{ viewModel.unmerged.templateFqn || 'No template' }}</span>
              </v-tooltip>
            </div>
          </div>
        </div>
        <h3 v-else class="text-h6">Inspector</h3>
        
        <div class="d-flex ga-1 flex-shrink-0 inspector-header-actions">
          <v-tooltip location="bottom">
            <template #activator="{ props }">
              <v-btn
                v-bind="props"
                icon="mdi-arrow-left"
                size="x-small"
                density="compact"
                :disabled="!canGoBack"
                @click="goBack"
              />
            </template>
            <span>Back</span>
          </v-tooltip>
          <v-tooltip location="bottom">
            <template #activator="{ props }">
              <v-btn
                v-bind="props"
                icon="mdi-arrow-right"
                size="x-small"
                density="compact"
                :disabled="!canGoForward"
                @click="goForward"
              />
            </template>
            <span>Forward</span>
          </v-tooltip>
          <v-tooltip location="bottom">
            <template #activator="{ props }">
              <v-btn
                v-bind="props"
                :icon="inspectorViewMode === 'merged' ? 'mdi-eye-outline' : 'mdi-pencil-outline'"
                size="x-small"
                density="compact"
                @click="toggleInspectorViewMode()"
              />
            </template>
            <span>{{ inspectorViewMode === 'merged' ? 'Merged View (effective values)' : 'Local Overrides View (raw overrides)' }}</span>
          </v-tooltip>
          <v-tooltip location="bottom">
            <template #activator="{ props }">
              <v-btn
                v-bind="props"
                icon="mdi-crosshairs-gps"
                size="x-small"
                density="compact"
                @click="focusInTree"
              />
            </template>
            <span>Focus in Tree</span>
          </v-tooltip>
          <v-tooltip location="bottom">
            <template #activator="{ props }">
              <v-btn
                v-bind="props"
                :icon="uiStore.activePaneId === paneId ? 'mdi-lock' : 'mdi-lock-open-outline'"
                size="x-small"
                density="compact"
                @click="uiStore.setActivePane(paneId)"
              />
            </template>
            <span>Lock to current asset</span>
          </v-tooltip>
          <v-tooltip location="bottom">
            <template #activator="{ props }">
              <v-btn
                v-bind="props"
                icon="mdi-close-circle-outline"
                size="x-small"
                density="compact"
                @click="closeInspector"
              />
            </template>
            <span>Close</span>
          </v-tooltip>
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
          :key="assetId"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, onBeforeUnmount, watch, ref, provide, type Ref } from 'vue';
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

// Per-inspector view mode (merged vs local)
const inspectorViewMode = ref<'merged' | 'local'>('merged');
provide<Ref<'merged' | 'local'>>('inspectorViewMode', inspectorViewMode);
const toggleInspectorViewMode = () => {
  inspectorViewMode.value = inspectorViewMode.value === 'merged' ? 'local' : 'merged';
};

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

// Template navigation target resolution
const templateTargetId = computed<string | null>(() => {
  const fqn = viewModel.value?.unmerged.templateFqn;
  if (!fqn) return null;
  const target = assetsStore.$state.assets.find(a => a.fqn === fqn);
  return target ? target.id : null;
});

const goToTemplate = () => {
  if (!templateTargetId.value) return;
  assetsStore.updateInspectorContent(props.paneId, templateTargetId.value);
};

// Memoize component by asset type to prevent recreation
const componentCache = new Map<string, any>();

// Use defineAsyncComponent to handle loading/error states gracefully
const asyncComponent = computed(() => {
  const live = assetsStore.getTreeNodeById(props.assetId);
  // Virtual Folder inspector path
  if (live && live.type === 'folder') {
    const kind = live.virtualContext?.kind as any;
    const cacheKey = `folder-${kind || 'generic'}`;
    
    if (!componentCache.has(cacheKey)) {
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
      componentCache.set(cacheKey, defineAsyncComponent({ loader, delay: 200 }));
    }
    return componentCache.get(cacheKey);
  }

  if (!viewModel.value) return null as any;
  const assetType = viewModel.value.unmerged.assetType as any;
  if (!assetType) return null as any;
  
  const cacheKey = `asset-${assetType}`;
  if (!componentCache.has(cacheKey)) {
    const registration = coreConfig.getAssetDefinition(assetType);
    if (!registration) return null as any;
    // Unwrap PerspectiveOverrides
    const inspectorComp = registration.inspectorComponent;
    const loader = typeof inspectorComp === 'function' ? inspectorComp : inspectorComp.default;
    if (!loader) return null as any;
    componentCache.set(cacheKey, defineAsyncComponent({ loader, delay: 200 }));
  }
  return componentCache.get(cacheKey);
});

const closeInspector = () => {
  assetsStore.closeInspector(props.paneId);
};

// lock behavior removed; icon now reflects focus state only

const goBack = async () => {
  await assetsStore.historyBack(props.paneId);
};

const goForward = async () => {
  await assetsStore.historyForward(props.paneId);
};

const focusInTree = () => {
  if (props.assetId) {
    uiStore.focusAssetInTree(props.assetId);
  }
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

// Reset the local view mode when switching assets in this pane
watch(() => props.assetId, () => {
  inspectorViewMode.value = 'merged';
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

/* Compact header icon buttons (approx 60% of default) */
.inspector-header :deep(.v-btn.v-btn--icon) {
  --v-btn-size: 22px;
  --v-btn-height: 22px;
  min-width: 22px;
  width: 22px;
  height: 22px;
}

.inspector-header :deep(.v-btn .v-icon) {
  font-size: 0.85rem;
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








