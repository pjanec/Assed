<template>
  <div class="pa-4">
    <v-select
      :model-value="payload.From"
      @update:modelValue="updateField('From', $event)"
      :items="['side', 'fetch']"
      label="Shipping Method (From)"
      variant="outlined"
      density="compact"
      class="mb-4"
    ></v-select>
    <v-checkbox
      :model-value="payload.FetchResourcesOnInstall"
      @update:modelValue="updateField('FetchResourcesOnInstall', $event)"
      label="Fetch Resources on Install"
      density="compact"
      messages="If checked, 'Resources' will be downloaded during deployment."
    ></v-checkbox>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { cloneDeep } from 'lodash-es';

const props = defineProps({
  modelValue: { type: Object, default: () => ({}) },
});

const emit = defineEmits(['update:modelValue']);

const payload = computed(() => props.modelValue || {});

const updateField = (field, value) => {
  const newPayload = cloneDeep(payload.value);
  newPayload[field] = value;
  emit('update:modelValue', newPayload);
};
</script>








