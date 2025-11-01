<template>
  <v-text-field
    v-model="handler.effectiveValue.value"
    :label="label"
    :variant="variant"
    :density="density"
    :readonly="readonly"
    :class="classes"
  >
    <template #prepend-inner>
      <div class="override-indicator">
        <v-tooltip v-if="handler.isOverridden.value" location="bottom">
          <template #activator="{ props }">
            <v-icon v-bind="props" color="primary" size="small">mdi-pencil</v-icon>
          </template>
          <span>This value is locally overridden</span>
        </v-tooltip>
        <v-icon v-else size="small" style="opacity: 0">mdi-pencil</v-icon>
      </div>
      <slot name="prepend-after-indicator"></slot>
    </template>
    <template #append-inner>
      <slot name="custom-append-inner"></slot>
      <v-tooltip v-if="handler.isOverridden.value" location="bottom">
        <template #activator="{ props }">
          <v-btn
            v-bind="props"
            icon="mdi-undo-variant"
            variant="text"
            density="compact"
            size="x-small"
            @click="handler.reset()"
          />
        </template>
        <span>Reset: remove local override</span>
      </v-tooltip>
      <slot name="append"></slot>
    </template>
  </v-text-field>
</template>

<script setup lang="ts">
import { toRef } from 'vue';
import { cloneDeep } from 'lodash-es';
import { useEditableProperty } from '@/core/composables/useEditableProperty';
import type { AssetDetails } from '@/core/types';
import { useWorkspaceStore, UpdateAssetCommand } from '@/core/stores/workspace';

const props = defineProps<{
  asset: AssetDetails,
  path: string,
  label?: string,
  variant?: 'outlined' | 'plain' | 'filled' | 'underlined' | 'solo' | 'solo-inverted' | 'solo-filled',
  density?: 'default' | 'comfortable' | 'compact',
  readonly?: boolean,
  classes?: string,
}>();

const workspaceStore = useWorkspaceStore();
const assetRef = toRef(props, 'asset');

const onUpdateOverrides = (newOverrides: Record<string, any>) => {
  if (props.readonly) return;
  const oldData = props.asset.unmerged;
  const newData = cloneDeep(oldData);
  newData.overrides = newOverrides;
  const command = new UpdateAssetCommand(oldData.id, oldData, newData);
  workspaceStore.executeCommand(command);
};

const handler = useEditableProperty(assetRef as any, props.path, onUpdateOverrides, {
  objectContainers: ['Resources', 'Files']
});
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


