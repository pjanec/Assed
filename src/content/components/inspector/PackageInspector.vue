<template>
  <BaseInspector :asset="asset" @update:overrides="handleOverridesChange">
    <template #settings-panels>
      <v-expansion-panels v-model="expandedPanels" multiple variant="accordion">
        <v-expansion-panel value="general">
          <v-expansion-panel-title class="text-body-2 custom-panel-title">
            <v-icon class="me-2" size="small">mdi-pencil-box-outline</v-icon>
            General Properties
          </v-expansion-panel-title>
          <v-expansion-panel-text class="pa-0">
            <GeneralPropertiesEditor :asset="asset" :is-read-only="asset.isReadOnly" />
          </v-expansion-panel-text>
        </v-expansion-panel>

        <v-expansion-panel value="payload">
          <v-expansion-panel-title class="text-body-2 custom-panel-title">
            <v-icon class="me-2" size="small">mdi-package-down</v-icon>
            Payload
          </v-expansion-panel-title>
          <v-expansion-panel-text class="pa-0">
            <PayloadEditor :asset="asset" :is-read-only="asset.isReadOnly" />
          </v-expansion-panel-text>
        </v-expansion-panel>

        <v-expansion-panel value="fileDistrib">
          <v-expansion-panel-title class="text-body-2 custom-panel-title">
            <v-icon class="me-2" size="small">mdi-folder-sync-outline</v-icon>
            File Distribution
          </v-expansion-panel-title>
          <v-expansion-panel-text class="pa-0">
            <FileDistribEditor :asset="asset" :is-read-only="asset.isReadOnly" />
          </v-expansion-panel-text>
        </v-expansion-panel>

        <v-expansion-panel value="resources">
          <v-expansion-panel-title class="text-body-2 custom-panel-title">
            <v-icon class="me-2" size="small">mdi-cloud-download-outline</v-icon>
            Resources
          </v-expansion-panel-title>
          <v-expansion-panel-text class="pa-0">
            <ResourcesEditor :asset="asset" :is-read-only="asset.isReadOnly" />
          </v-expansion-panel-text>
        </v-expansion-panel>

        <v-expansion-panel value="scripts">
          <v-expansion-panel-title class="text-body-2 custom-panel-title">
            <v-icon class="me-2" size="small">mdi-script-text-outline</v-icon>
            Scripts
          </v-expansion-panel-title>
          <v-expansion-panel-text class="pa-0">
            <ScriptsEditor :asset="asset" :is-read-only="asset.isReadOnly" />
          </v-expansion-panel-text>
        </v-expansion-panel>

        <v-expansion-panel value="files">
          <v-expansion-panel-title class="text-body-2 custom-panel-title">
            <v-icon class="me-2" size="small">mdi-file-multiple-outline</v-icon>
            Skeleton Files
          </v-expansion-panel-title>
          <v-expansion-panel-text class="ma-0 pa-0">
            <SkeletonFilesEditor
              :files="asset.unmerged.overrides.Files || {}"
              @update:files="handleSubObjectChange('Files', $event)"
              :is-read-only="asset.isReadOnly"
            />
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>
    </template>
  </BaseInspector>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useWorkspaceStore , UpdateAssetCommand } from '@/core/stores/workspace';

import BaseInspector from './BaseInspector.vue';
import GeneralPropertiesEditor from './GeneralPropertiesEditor.vue';
import PayloadEditor from './PayloadEditor.vue';
import FileDistribEditor from './FileDistribEditor.vue';
import ResourcesEditor from './ResourcesEditor.vue';
import ScriptsEditor from './ScriptsEditor.vue';
import SkeletonFilesEditor from './SkeletonFilesEditor.vue';
import type { AssetDetails } from '@/core/types';

// Helper function to deep clone objects
function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

interface Props {
  asset: AssetDetails;
}

const props = defineProps<Props>();

const workspaceStore = useWorkspaceStore();
const expandedPanels = ref<string[]>(['general']);

const handleOverridesChange = (newOverrides: Record<string, any>): void => {
  // Prevent editing read-only assets (e.g., virtual assets)
  if (props.asset.isReadOnly) {
    return;
  }
  
  const oldData = props.asset.unmerged;
  const newData = deepClone(oldData);
  newData.overrides = newOverrides;
  const command = new UpdateAssetCommand(props.asset.unmerged.id, oldData, newData);
  workspaceStore.executeCommand(command);
};

const handleSubObjectChange = (key: string, value: any): void => {
  if (props.asset.isReadOnly) {
    return;
  }
  const oldData = props.asset.unmerged;
  const newData = deepClone(oldData);
  if (!newData.overrides) newData.overrides = {};
  (newData.overrides as any)[key] = value;
  const command = new UpdateAssetCommand(props.asset.unmerged.id, oldData, newData);
  workspaceStore.executeCommand(command);
};

// GeneralPropertiesEditor handles the general fields (incl. Technical Name) via useEditableProperty
</script>

<style scoped>
:deep(.custom-panel-title) {
  background-color: rgba(var(--v-theme-primary), 0.08);
  font-weight: 600 !important;
  color: rgb(var(--v-theme-on-surface));
}
:deep(.v-expansion-panel-text__wrapper) {
  padding: 0 !important;
  background-color: rgb(var(--v-theme-surface));
}
</style>







