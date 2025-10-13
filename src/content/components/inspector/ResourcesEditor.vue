<template>
  <div class="pa-4">
    <v-expansion-panels variant="accordion">
      <v-expansion-panel
        v-for="(resource, id) in resources"
        :key="id"
      >
        <v-expansion-panel-title>
          <div class="d-flex align-center justify-space-between w-100">
            <span>{{ id }}</span>
            <v-btn
              icon="mdi-delete-outline"
              size="x-small"
              variant="text"
              @click.stop="removeResource(id)"
              :disabled="isReadOnly"
            />
          </div>
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <v-text-field
            :model-value="resource.To"
            @update:modelValue="updateResource(id, 'To', $event)"
            label="Path (To)"
            density="compact"
            variant="outlined"
            class="mb-4"
            :readonly="isReadOnly"
          />
          <v-select
            :model-value="resource.Fetcher"
            @update:modelValue="updateResource(id, 'Fetcher', $event)"
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
              :model-value="resource.Params || {}"
              @update:modelValue="updateResource(id, 'Params', $event)"
              :schema="getFetcherSchema(resource.Fetcher)"
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

<script setup>
import { ref, computed } from 'vue';
import { cloneDeep } from 'lodash-es';
import { schemas, getFetcherSchema } from '@/content/schemas/packageSchema';
import JSONEditor from './JSONEditor.vue';

const props = defineProps({
  modelValue: { type: Object, default: () => ({}) },
  isReadOnly: { type: Boolean, default: false },
});
const emit = defineEmits(['update:modelValue']);

const resources = computed(() => props.modelValue || {});
const showAddDialog = ref(false);
const newResourceId = ref('');

const fetcherTypes = computed(() => Object.keys(schemas.value?.fetchers || {}));

const updateResource = (id, field, value) => {
  if (props.isReadOnly) return;
  const newResources = cloneDeep(resources.value);
  if (!newResources[id]) newResources[id] = {};
  newResources[id][field] = value;

  // When changing fetcher, reset params
  if (field === 'Fetcher') {
    newResources[id].Params = {};
  }

  emit('update:modelValue', newResources);
};

const addResource = () => {
  if (props.isReadOnly) return;
  if (!newResourceId.value || resources.value[newResourceId.value]) return;
  const newResources = cloneDeep(resources.value);
  newResources[newResourceId.value] = { To: '', Fetcher: '', Params: {} };
  emit('update:modelValue', newResources);
  cancelAddResource();
};

const removeResource = (id) => {
  if (props.isReadOnly) return;
  const newResources = cloneDeep(resources.value);
  delete newResources[id];
  emit('update:modelValue', newResources);
};

const cancelAddResource = () => {
  showAddDialog.value = false;
  newResourceId.value = '';
};
</script>








