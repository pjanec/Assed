<template>
  <div class="pa-4">
    <v-expansion-panels variant="accordion">
      <v-expansion-panel
        v-for="item in resources"
        :key="item.key"
      >
        <v-expansion-panel-title>
          <div class="d-flex align-center justify-space-between w-100">
            <span>
              {{ item.key }}
              <span v-if="item.isInherited" class="text-caption text-medium-emphasis ms-1">(inherited)</span>
            </span>
            <v-btn
              v-if="!item.isInherited"
              icon="mdi-delete-outline"
              size="x-small"
              variant="text"
              @click.stop="removeResource(item.key)"
              :disabled="isReadOnly"
            />
          </div>
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <MergedTextField
            :asset="asset"
            :path="`Resources.${item.key}.To`"
            label="Path (To)"
            density="compact"
            variant="outlined"
            class="mb-4"
            :readonly="isReadOnly"
          />
          <MergedSelect
            :asset="asset"
            :path="`Resources.${item.key}.Fetcher`"
            :items="fetcherTypes"
            label="Fetcher"
            density="compact"
            variant="outlined"
            class="mb-4"
            :readonly="isReadOnly"
          />
          <div v-if="item.value && item.value.Fetcher">
            <h5 class="text-caption mb-2">Fetcher Parameters</h5>
            <JSONEditor
              :model-value="item.value?.Params || {}"
              @update:modelValue="updateParams(item.key, $event)"
              :schema="getFetcherSchema(item.value?.Fetcher)"
              :mode="isReadOnly ? 'view' : 'tree'"
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
import { ref, computed, toRef } from 'vue';
import { cloneDeep, get } from 'lodash-es';
import { schemas, getFetcherSchema } from '@/content/schemas/packageSchema';
import JSONEditor from './JSONEditor.vue';
import type { AssetDetails } from '@/core/types';
import { useWorkspaceStore, UpdateAssetCommand } from '@/core/stores/workspace';
import MergedTextField from './controls/MergedTextField.vue';
import MergedSelect from './controls/MergedSelect.vue';
import { useEditableCollection } from '@/core/composables/useEditableCollection';

const props = defineProps<{ asset: AssetDetails, isReadOnly?: boolean }>();
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

const {
  collectionAsArray: resources,
  collectionAsObject: resourcesObj,
  addItem,
  removeItem,
  updateItemProperty
} = useEditableCollection(assetRef as any, 'Resources', onUpdateOverrides);
const showAddDialog = ref(false);
const newResourceId = ref('');

const fetcherTypes = computed(() => Object.keys(schemas.value?.fetchers || {}));

const updateParams = (id: string, newParams: Record<string, any>) => {
  updateItemProperty(id, 'Params', newParams || {});
};

const addResource = () => {
  if (props.isReadOnly || !newResourceId.value) return;
  if (resourcesObj.value[newResourceId.value]) {
    cancelAddResource();
    return;
  }
  addItem(newResourceId.value, { To: '', Fetcher: '', Params: {} });
  cancelAddResource();
};

const removeResource = (id: string) => {
  removeItem(id);
};

const cancelAddResource = () => {
  showAddDialog.value = false;
  newResourceId.value = '';
};
</script>








