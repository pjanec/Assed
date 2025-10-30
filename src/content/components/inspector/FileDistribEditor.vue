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
        :readonly="isReadOnly"
      />
      <MergedTextField
        :asset="asset"
        :path="`FileDistrib.Parts[${index}].To`"
        label="To"
        variant="outlined"
        density="compact"
        hide-details
        :readonly="isReadOnly"
      />
      <v-btn icon="mdi-delete-outline" variant="text" size="small" @click="removePart(index)" :disabled="isReadOnly"></v-btn>
    </div>
    <v-btn block variant="tonal" size="small" @click="addPart" :disabled="isReadOnly">Add Part</v-btn>

  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { cloneDeep, get, unset } from 'lodash-es';
import type { AssetDetails } from '@/core/types';
import { useWorkspaceStore, UpdateAssetCommand } from '@/core/stores/workspace';
import MergedTextField from './controls/MergedTextField.vue';
import MergedSelect from './controls/MergedSelect.vue';

const props = defineProps<{
  asset: AssetDetails,
  isReadOnly?: boolean,
}>();

const workspaceStore = useWorkspaceStore();

const parts = computed(() => get(props.asset.unmerged.overrides || {}, 'FileDistrib.Parts', []) as any[]);

const addPart = () => {
  if (props.isReadOnly) return;
  const oldData = props.asset.unmerged;
  const newData = cloneDeep(oldData);
  const currentParts = get(newData, 'overrides.FileDistrib.Parts', []);
  const next = Array.isArray(currentParts) ? currentParts.slice() : [];
  next.push({ From: '', To: '' });
  if (!newData.overrides) newData.overrides = {} as any;
  if (!newData.overrides.FileDistrib) (newData.overrides as any).FileDistrib = {} as any;
  (newData.overrides as any).FileDistrib.Parts = next;
  const cmd = new UpdateAssetCommand(oldData.id, oldData, newData);
  workspaceStore.executeCommand(cmd);
};

const removePart = (index: number) => {
  if (props.isReadOnly) return;
  const oldData = props.asset.unmerged;
  const newData = cloneDeep(oldData);
  const currentParts = get(newData, 'overrides.FileDistrib.Parts', []);
  const next = Array.isArray(currentParts) ? currentParts.slice() : [];
  next.splice(index, 1);
  if (!newData.overrides) newData.overrides = {} as any;
  
  if (next.length === 0) {
    // Remove Parts override entirely to allow inheritance
    if (newData.overrides.FileDistrib) {
      unset(newData.overrides, 'FileDistrib.Parts');
      
      // Clean up empty FileDistrib object if it has no other properties
      const fileDistrib = (newData.overrides as any).FileDistrib;
      if (fileDistrib && Object.keys(fileDistrib).length === 0) {
        delete (newData.overrides as any).FileDistrib;
      }
    }
  } else {
    if (!newData.overrides.FileDistrib) (newData.overrides as any).FileDistrib = {} as any;
    (newData.overrides as any).FileDistrib.Parts = next;
  }
  
  const cmd = new UpdateAssetCommand(oldData.id, oldData, newData);
  workspaceStore.executeCommand(cmd);
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








