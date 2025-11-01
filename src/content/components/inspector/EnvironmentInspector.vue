<template>
  <BaseInspector :asset="asset" @update:overrides="handleOverridesChange">
    <template #settings-panels>
      <v-expansion-panels v-model="expandedPanels" multiple variant="accordion">
        <v-expansion-panel value="general">
          <v-expansion-panel-title class="text-body-2 custom-panel-title">
            <v-icon class="me-2" size="small">mdi-pencil-box-outline</v-icon>
            General Properties
          </v-expansion-panel-title>
          <v-expansion-panel-text>
            <GeneralPropertiesEditor :asset="asset" :is-read-only="asset.isReadOnly">
              <template #asset-specific-properties>
                <div class="mt-4">
                  <MergedTextField
                    :asset="asset"
                    path="distroFqn"
                    label="Source Distro FQN"
                    variant="outlined"
                    density="compact"
                    :readonly="isReadOnly"
                    @click="openDistroPicker"
                  >
                    <template #custom-append-inner>
                      <v-icon
                        icon="mdi-dots-horizontal"
                        @click.stop="openDistroPicker"
                        style="cursor: pointer;"
                        class="me-2"
                      />
                    </template>
                  </MergedTextField>
                </div>
              </template>
            </GeneralPropertiesEditor>
          </v-expansion-panel-text>
        </v-expansion-panel>
        <v-expansion-panel value="assignments">
          <v-expansion-panel-title class="text-body-2 custom-panel-title">
            <div class="d-flex align-center justify-space-between w-100">
              <div class="d-flex align-center">
                <v-icon class="me-2" size="small">mdi-sitemap</v-icon>
                <span>Assignment Layout & Machines</span>
              </div>
              <div class="d-flex align-center ga-2" @click.stop>
              <v-chip
                size="small"
                variant="tonal"
                :color="selectedDistroFqn ? distroColor : 'grey'"
                class="me-2 text-truncate"
                style="max-width: 200px;"
                @click.stop="openDistroPicker"
              >
                <v-tooltip activator="parent" location="bottom">
                  {{ selectedDistroFqn ? 'Click to change Source Distro' : 'Click to select Source Distro' }}
                </v-tooltip>
                {{ selectedDistroFqn || 'None Selected' }}
              </v-chip>
              <v-btn-toggle
                v-model="assignmentViewMode"
                variant="outlined"
                density="compact"
                mandatory
                color="primary"
                group
                size="x-small"
                @click.stop
              >
                <v-btn value="nodes">
                  <v-icon :color="nodeIconColor" :style="nodeIconStyle">{{ coreConfig.getAssetIcon(ASSET_TYPES.NODE) }}</v-icon>
                  <v-tooltip activator="parent" location="bottom">Node Card View</v-tooltip>
                </v-btn>
                <v-btn value="machines">
                  <v-icon :color="machineIconColor" :style="machineIconStyle">{{ coreConfig.getAssetIcon(ASSET_TYPES.MACHINE) }}</v-icon>
                  <v-tooltip activator="parent" location="bottom">Machine Card View</v-tooltip>
                </v-btn>
                <v-btn value="matrix">
                  <v-icon :color="matrixIconColor" :style="matrixIconStyle">mdi-table</v-icon>
                  <v-tooltip activator="parent" location="bottom">Matrix View</v-tooltip>
                </v-btn>
              </v-btn-toggle>
              </div>
            </div>
          </v-expansion-panel-title>
          <v-expansion-panel-text class="pa-0">
            <div class="assignments-content">
              <EnvironmentMachinesView
                v-if="assignmentViewMode === 'machines'"
                :environment-asset="asset.unmerged"
              />
              <EnvironmentLayoutEditor
                v-else
                :environment-asset="asset.unmerged"
                :display-mode="assignmentViewMode"
              />
            </div>
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>
    </template>
  </BaseInspector>
  
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useWorkspaceStore, useAssetsStore, useUiStore, useCoreConfigStore } from '@/core/stores';
import { UpdateAssetCommand } from '@/core/stores/workspace';
import BaseInspector from './BaseInspector.vue';
import GeneralPropertiesEditor from './GeneralPropertiesEditor.vue';
import MergedTextField from './controls/MergedTextField.vue';
import EnvironmentLayoutEditor from '@/content/components/editor/EnvironmentLayoutEditor.vue';
import EnvironmentMachinesView from '@/content/components/editor/EnvironmentMachinesView.vue';
import type { AssetDetails } from '@/core/types';
import { cloneDeep } from 'lodash-es';
import { ASSET_TYPES } from '@/content/config/constants';
import { calculateMergedAsset } from '@/core/utils/mergeUtils';

interface Props { asset: AssetDetails }
const props = defineProps<Props>();

const workspaceStore = useWorkspaceStore();
const assetsStore = useAssetsStore();
const uiStore = useUiStore();
const coreConfig = useCoreConfigStore();
const expandedPanels = ref(['general', 'assignments']);
const assignmentViewMode = ref<'nodes' | 'machines' | 'matrix'>('nodes');
const isReadOnly = computed(() => props.asset.isReadOnly);

const selectedDistroFqn = computed(() => {
  if (!props.asset.unmerged) return undefined;
  
  const allAssetsMap = new Map(assetsStore.unmergedAssets.map(a => [a.id, a]));
  const merged = calculateMergedAsset(props.asset.unmerged.id, allAssetsMap);
  if ('error' in merged) {
    return props.asset.unmerged?.overrides?.distroFqn as string | undefined;
  }
  return merged.properties?.distroFqn as string | undefined;
});

const selectedDistroAsset = computed(() => {
  const distroFqn = selectedDistroFqn.value;
  if (!distroFqn) return null;
  return assetsStore.unmergedAssets.find(a => a.fqn === distroFqn && a.assetType === ASSET_TYPES.DISTRO) || null;
});

const distroColor = computed(() => {
  if (selectedDistroAsset.value) {
    return coreConfig.getAssetTypeColor(ASSET_TYPES.DISTRO);
  }
  return 'primary';
});

const nodeColor = computed(() => coreConfig.getAssetTypeColor(ASSET_TYPES.NODE));
const machineColor = computed(() => coreConfig.getAssetTypeColor(ASSET_TYPES.MACHINE));

const nodeIconColor = computed(() => nodeColor.value);
const nodeIconStyle = computed(() => {
  const isActive = assignmentViewMode.value === 'nodes';
  return { opacity: isActive ? 1 : 0.75 };
});

const machineIconColor = computed(() => machineColor.value);
const machineIconStyle = computed(() => {
  const isActive = assignmentViewMode.value === 'machines';
  return { opacity: isActive ? 1 : 0.75 };
});

const matrixIconColor = computed(() => 'primary');
const matrixIconStyle = computed(() => {
  const isActive = assignmentViewMode.value === 'matrix';
  return { opacity: isActive ? 1 : 0.75 };
});

const handleOverridesChange = (newOverrides: Record<string, any>) => {
  if (props.asset.isReadOnly) return;
  const oldData = props.asset.unmerged;
  const newData = cloneDeep(oldData);
  newData.overrides = newOverrides;
  const command = new UpdateAssetCommand(props.asset.unmerged.id, oldData, newData);
  workspaceStore.executeCommand(command);
};

const openDistroPicker = async () => {
  if (props.asset.isReadOnly) return;
  const availableDistros = assetsStore.unmergedAssets.filter(a => a.assetType === ASSET_TYPES.DISTRO);
  try {
    const selectedDistro = await uiStore.promptForAssetSelection({ title: 'Select Source Distro', items: availableDistros });
    if (selectedDistro) {
      const oldData = props.asset.unmerged;
      const newData = cloneDeep(oldData);
      if (!newData.overrides) newData.overrides = {} as any;
      (newData.overrides as any).distroFqn = selectedDistro.fqn;
      const command = new UpdateAssetCommand(props.asset.unmerged.id, oldData, newData);
      workspaceStore.executeCommand(command);
    }
  } catch (err) {
    console.log('Distro selection cancelled or failed:', err);
  }
};
</script>

<style scoped>
:deep(.custom-panel-title) {
  background-color: rgba(var(--v-theme-primary), 0.08);
  font-weight: 600 !important;
  color: rgb(var(--v-theme-on-surface));
}

:deep(.v-expansion-panel-title__content) {
  width: 100%;
}

:deep(.v-expansion-panel-text__wrapper) {
  padding: 0 !important;
  background-color: rgb(var(--v-theme-surface));
}
.layout-editor-content {
  min-height: 400px;
  max-height: 70vh;
  position: relative;
  display: flex;
  flex-direction: column;
}
.assignments-content {
  min-height: 400px;
  max-height: 70vh;
  position: relative;
  display: flex;
  flex-direction: column;
}
.cursor-pointer {
  cursor: pointer;
}
</style>


