<template>
  <div class="pa-4">
    <MergedTextField
      :asset="asset"
      path="FileDistrib.To"
      label="Destination Root (To)"
      variant="outlined"
      density="compact"
      class="mb-4"
      :readonly="isReadOnly"
    />

    <v-row>
      <v-col>
        <MergedSelect
          :asset="asset"
          path="FileDistrib.Transport"
          :items="['copy', 'link', 'sync']"
          label="Default Transport"
          variant="outlined"
          density="compact"
          :readonly="isReadOnly"
        />
      </v-col>
      <v-col>
        <MergedSelect
          :asset="asset"
          path="FileDistrib.ConflictPolicy"
          :items="['join', 'purge', 'replace', 'skip']"
          label="Default Conflict Policy"
          variant="outlined"
          density="compact"
          :readonly="isReadOnly"
        />
      </v-col>
    </v-row>

    <v-divider class="my-4"></v-divider>

    <h4 class="text-subtitle-1 mb-2">Distribution Parts</h4>
    <div v-for="(part, index) in parts" :key="index" class="part-item mb-2">
      <MergedTextField
        :asset="asset"
        :path="`FileDistrib.Parts[${index}].From`"
        label="From"
        variant="outlined"
        density="compact"
        hide-details
        :readonly="isReadOnly || isInherited(part)"
      >
        <template #prepend-after-indicator>
          <v-chip v-if="isInherited(part)" size="x-small" label class="ms-1">Inherited</v-chip>
        </template>
      </MergedTextField>
      <MergedTextField
        :asset="asset"
        :path="`FileDistrib.Parts[${index}].To`"
        label="To"
        variant="outlined"
        density="compact"
        hide-details
        :readonly="isReadOnly || isInherited(part)"
      />
      <v-btn icon="mdi-delete-outline" variant="text" size="small" @click="removePart(index)" :disabled="isReadOnly || isInherited(part)"></v-btn>
    </div>
    <v-btn block variant="tonal" size="small" @click="addPart" :disabled="isReadOnly">Add Part</v-btn>

  </div>
</template>

<script setup lang="ts">
import { computed, inject, type Ref, toRef } from 'vue';
import { cloneDeep, get, unset } from 'lodash-es';
import type { AssetDetails } from '@/core/types';
import { useWorkspaceStore, UpdateAssetCommand } from '@/core/stores/workspace';
import MergedTextField from './controls/MergedTextField.vue';
import MergedSelect from './controls/MergedSelect.vue';
import { useEditableArray } from '@/core/composables/useEditableArray';

const props = defineProps<{
  asset: AssetDetails,
  isReadOnly?: boolean,
}>();

const workspaceStore = useWorkspaceStore();

const assetRef = toRef(props, 'asset');

const onUpdateOverrides = (newOverrides: Record<string, any>) => {
  if (props.isReadOnly) return;
  const oldData = props.asset.unmerged;
  const newData = cloneDeep(oldData);
  newData.overrides = newOverrides;
  const cmd = new UpdateAssetCommand(oldData.id, oldData, newData);
  workspaceStore.executeCommand(cmd);
};

const { items: parts, isInherited, addItem, removeItem } = useEditableArray<any>(assetRef as any, 'FileDistrib.Parts', onUpdateOverrides, { identityKey: 'From' });

const addPart = () => {
  addItem({ From: '', To: '' });
};

const removePart = (index: number) => {
  removeItem(index);
};
</script>

<style scoped>
.part-item {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 8px;
  align-items: center;
}
</style>








