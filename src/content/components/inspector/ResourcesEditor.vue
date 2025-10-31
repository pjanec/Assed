<template>
  <div class="pa-4">
    <v-expansion-panels variant="accordion">
      <v-expansion-panel
        v-for="(resource, id) in resources"
        :key="id"
      >
        <v-expansion-panel-title>
          <div class="d-flex align-center justify-space-between w-100">
            <span>
              {{ id }}
              <span v-if="isResourceInherited[id]" class="text-caption text-medium-emphasis ms-1">(inherited)</span>
            </span>
            <v-btn
              v-if="!isResourceInherited[id] || inspectorViewMode === 'local'"
              icon="mdi-delete-outline"
              size="x-small"
              variant="text"
              @click.stop="removeResource(String(id))"
              :disabled="isReadOnly"
            />
          </div>
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <MergedTextField
            :asset="asset"
            :path="`Resources.${String(id)}.To`"
            label="Path (To)"
            density="compact"
            variant="outlined"
            class="mb-4"
            :readonly="isReadOnly"
          />
          <MergedSelect
            :asset="asset"
            :path="`Resources.${String(id)}.Fetcher`"
            :items="fetcherTypes"
            label="Fetcher"
            density="compact"
            variant="outlined"
            class="mb-4"
            :readonly="isReadOnly"
          />
          <div v-if="resource.Fetcher">
            <h5 class="text-caption mb-2">Fetcher Parameters</h5>
            <JSONEditor
              :model-value="get(resources, `${id}.Params`, {}) || {}"
              @update:modelValue="updateParams(String(id), $event)"
              :schema="getFetcherSchema(get(resources, `${id}.Fetcher`))"
              mode="tree"
              :options="{ readOnly: isReadOnly }"
            />
          </div>
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>
    <v-btn
      block
      variant="tonal"
      size="small"
      @click="showAddDialog = true"
      class="mt-4"
      :disabled="isReadOnly"
    >
      Add Resource
    </v-btn>

    <v-dialog v-model="showAddDialog" max-width="400px">
      <v-card>
        <v-card-title>Add New Resource</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="newResourceId"
            label="Resource ID"
            autofocus
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn text @click="cancelAddResource">Cancel</v-btn>
          <v-btn color="primary" @click="addResource" :disabled="!newResourceId">Add</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, inject } from 'vue';
import { cloneDeep, get } from 'lodash-es';
import { schemas, getFetcherSchema } from '@/content/schemas/packageSchema';
import JSONEditor from './JSONEditor.vue';
import type { AssetDetails } from '@/core/types';
import type { Ref } from 'vue';
import { useWorkspaceStore, UpdateAssetCommand } from '@/core/stores/workspace';
import MergedTextField from './controls/MergedTextField.vue';
import MergedSelect from './controls/MergedSelect.vue';

const props = defineProps<{ asset: AssetDetails, isReadOnly?: boolean }>();
const workspaceStore = useWorkspaceStore();

const inspectorViewMode = inject<Ref<'merged' | 'local'>>('inspectorViewMode', ref('merged'));

const resources = computed(() => {
  if (inspectorViewMode.value === 'local') {
    return props.asset.unmerged.overrides?.Resources || {};
  } else {
    return props.asset.merged?.properties?.Resources || {};
  }
});

const isResourceInherited = computed(() => {
  const mergedResources = props.asset.merged?.properties?.Resources || {};
  const overriddenResources = props.asset.unmerged.overrides?.Resources || {};
  const result: Record<string, boolean> = {};
  Object.keys(mergedResources).forEach(id => {
    result[id] = !(id in overriddenResources);
  });
  return result;
});
const showAddDialog = ref(false);
const newResourceId = ref('');

const fetcherTypes = computed(() => Object.keys(schemas.value?.fetchers || {}));

const updateParams = (id: string, newParams: Record<string, any>) => {
  if (props.isReadOnly) return;
  const oldData = props.asset.unmerged;
  const newData = cloneDeep(oldData);
  if (!newData.overrides) newData.overrides = {} as any;
  if (!newData.overrides.Resources) (newData.overrides as any).Resources = {} as any;
  if (!(newData.overrides as any).Resources[id]) (newData.overrides as any).Resources[id] = {} as any;
  (newData.overrides as any).Resources[id].Params = newParams || {};
  const cmd = new UpdateAssetCommand(oldData.id, oldData, newData);
  workspaceStore.executeCommand(cmd);
};

const addResource = () => {
  if (props.isReadOnly || !newResourceId.value) return;
  
  const mergedResources = props.asset.merged?.properties?.Resources || {};
  const overriddenResources = props.asset.unmerged.overrides?.Resources || {};
  const allResources = { ...mergedResources, ...overriddenResources };
  
  if (allResources[newResourceId.value]) {
    cancelAddResource();
    return;
  }
  
  const oldData = props.asset.unmerged;
  const newData = cloneDeep(oldData);
  if (!newData.overrides) newData.overrides = {} as any;
  if (!newData.overrides.Resources) (newData.overrides as any).Resources = {} as any;
  (newData.overrides as any).Resources[newResourceId.value] = { To: '', Fetcher: '', Params: {} };
  const cmd = new UpdateAssetCommand(oldData.id, oldData, newData);
  workspaceStore.executeCommand(cmd);
  cancelAddResource();
};

const removeResource = (id: string) => {
  if (props.isReadOnly) return;
  
  // Only allow deletion of overridden resources, not inherited ones
  const isInherited = inspectorViewMode.value === 'merged' && isResourceInherited.value[id];
  if (isInherited) return;
  
  const oldData = props.asset.unmerged;
  const newData = cloneDeep(oldData);
  
  // Delete from overrides
  if ((newData.overrides as any)?.Resources?.[id]) {
    delete (newData.overrides as any).Resources[id];
    
    // Clean up empty Resources object if no resources remain
    const resources = (newData.overrides as any).Resources;
    if (resources && Object.keys(resources).length === 0) {
      delete (newData.overrides as any).Resources;
    }
  }
  
  const cmd = new UpdateAssetCommand(oldData.id, oldData, newData);
  workspaceStore.executeCommand(cmd);
};

const cancelAddResource = () => {
  showAddDialog.value = false;
  newResourceId.value = '';
};
</script>








