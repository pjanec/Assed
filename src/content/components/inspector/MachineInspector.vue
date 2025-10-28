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
            <GeneralPropertiesEditor :asset="asset" :is-read-only="asset.isReadOnly" />
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>
    </template>
  </BaseInspector>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useWorkspaceStore } from '@/core/stores';
import { UpdateAssetCommand } from '@/core/stores/workspace';
import BaseInspector from './BaseInspector.vue';
import GeneralPropertiesEditor from './GeneralPropertiesEditor.vue';
import type { AssetDetails } from '@/core/types';
import { cloneDeep } from 'lodash-es';

interface Props { asset: AssetDetails }
const props = defineProps<Props>();

const workspaceStore = useWorkspaceStore();
const expandedPanels = ref(['general']);

const handleOverridesChange = (newOverrides: Record<string, any>) => {
  if (props.asset.isReadOnly) return;
  const oldData = props.asset.unmerged;
  const newData = cloneDeep(oldData);
  newData.overrides = newOverrides;
  const command = new UpdateAssetCommand(props.asset.unmerged.id, oldData, newData);
  workspaceStore.executeCommand(command);
};
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


