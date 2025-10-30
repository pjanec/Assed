<template>
  <div class="pa-4">
    <v-select
      v-model="fromHandler.effectiveValue.value"
      :items="['side', 'fetch']"
      label="Shipping Method (From)"
      variant="outlined"
      density="compact"
      class="mb-4"
      :readonly="isReadOnly"
    >
      <template #prepend-inner>
        <v-tooltip v-if="fromHandler.isOverridden.value" location="bottom">
          <template #activator="{ props }">
            <v-icon v-bind="props" color="primary">mdi-pencil</v-icon>
          </template>
          <span>This value is locally overridden</span>
        </v-tooltip>
      </template>
      <template #append-inner>
        <v-tooltip v-if="fromHandler.isOverridden.value" location="bottom">
          <template #activator="{ props }">
            <v-btn
              v-bind="props"
              icon="mdi-undo-variant"
              variant="text"
              density="compact"
              size="x-small"
              @click="fromHandler.reset()"
            />
          </template>
          <span>Reset: remove local override</span>
        </v-tooltip>
      </template>
    </v-select>

    <v-checkbox
      v-model="fetchOnInstallHandler.effectiveValue.value"
      label="Fetch Resources on Install"
      density="compact"
      messages="If checked, 'Resources' will be downloaded during deployment."
      :readonly="isReadOnly"
    >
      <template #prepend>
        <div class="override-indicator">
          <v-tooltip v-if="fetchOnInstallHandler.isOverridden.value" location="bottom">
            <template #activator="{ props }">
              <v-icon v-bind="props" color="primary" size="small">mdi-pencil</v-icon>
            </template>
            <span>This value is locally overridden</span>
          </v-tooltip>
          <v-icon v-else size="small" style="opacity: 0">mdi-pencil</v-icon>
        </div>
      </template>
      <template #label>
        Fetch Resources on Install
      </template>
      <template #append>
        <v-tooltip v-if="fetchOnInstallHandler.isOverridden.value" location="bottom">
          <template #activator="{ props }">
            <v-btn
              v-bind="props"
              icon="mdi-undo-variant"
              variant="text"
              density="compact"
              size="x-small"
              @click="fetchOnInstallHandler.reset()"
            />
          </template>
          <span>Reset: remove local override</span>
        </v-tooltip>
      </template>
    </v-checkbox>
  </div>
  
</template>

<script setup lang="ts">
import { toRef } from 'vue';
import { cloneDeep } from 'lodash-es';
import { useEditableProperty } from '@/core/composables/useEditableProperty';
import type { AssetDetails } from '@/core/types';
import { useWorkspaceStore, UpdateAssetCommand } from '@/core/stores/workspace';

const props = defineProps<{
  asset: AssetDetails,
  isReadOnly?: boolean,
}>();

const workspaceStore = useWorkspaceStore();

const assetRef = toRef(props, 'asset');

const handleOverridesUpdate = (newOverrides: Record<string, any>) => {
  if (props.isReadOnly) return;
  const oldData = props.asset.unmerged;
  const newData = cloneDeep(oldData);
  newData.overrides = newOverrides;
  const command = new UpdateAssetCommand(props.asset.unmerged.id, oldData, newData);
  workspaceStore.executeCommand(command);
};

const fromHandler = useEditableProperty(assetRef as any, 'Payload.From', handleOverridesUpdate);
const fetchOnInstallHandler = useEditableProperty(assetRef as any, 'Payload.FetchResourcesOnInstall', handleOverridesUpdate);
</script>

<style scoped>
.override-indicator {
  display: inline-flex;
  width: 16px;
  justify-content: center;
  align-items: center;
}
:deep(.v-input__prepend) {
  margin-right: 4px;
}
</style>








