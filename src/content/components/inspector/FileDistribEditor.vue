<template>
  <div class="pa-4">
    <v-text-field
      :model-value="fileDistrib.To"
      @update:modelValue="updateField('To', $event)"
      label="Destination Root (To)"
      variant="outlined"
      density="compact"
      class="mb-4"
      :readonly="isReadOnly"
    ></v-text-field>

    <v-row>
      <v-col>
        <v-select
          :model-value="fileDistrib.Transport"
          @update:modelValue="updateField('Transport', $event)"
          :items="['copy', 'link', 'sync']"
          label="Default Transport"
          variant="outlined"
          density="compact"
          :readonly="isReadOnly"
        ></v-select>
      </v-col>
      <v-col>
        <v-select
          :model-value="fileDistrib.ConflictPolicy"
          @update:modelValue="updateField('ConflictPolicy', $event)"
          :items="['join', 'purge', 'replace', 'skip']"
          label="Default Conflict Policy"
          variant="outlined"
          density="compact"
          :readonly="isReadOnly"
        ></v-select>
      </v-col>
    </v-row>

    <v-divider class="my-4"></v-divider>

    <h4 class="text-subtitle-1 mb-2">Distribution Parts</h4>
    <div v-for="(part, index) in fileDistrib.Parts" :key="index" class="part-item mb-2">
       <v-text-field
        :model-value="part.From"
        @update:modelValue="updatePart(index, 'From', $event)"
        label="From"
        variant="outlined"
        density="compact"
        hide-details
        :readonly="isReadOnly"
      ></v-text-field>
       <v-text-field
        :model-value="part.To"
        @update:modelValue="updatePart(index, 'To', $event)"
        label="To"
        variant="outlined"
        density="compact"
        hide-details
        :readonly="isReadOnly"
      ></v-text-field>
      <v-btn icon="mdi-delete-outline" variant="text" size="small" @click="removePart(index)" :disabled="isReadOnly"></v-btn>
    </div>
     <v-btn block variant="tonal" size="small" @click="addPart" :disabled="isReadOnly">Add Part</v-btn>

  </div>
</template>

<script setup>
import { computed } from 'vue';
import { cloneDeep } from 'lodash-es';

const props = defineProps({
  modelValue: { type: Object, default: () => ({ Parts: [] }) },
  isReadOnly: { type: Boolean, default: false },
});

const emit = defineEmits(['update:modelValue']);

const fileDistrib = computed(() => props.modelValue || { Parts: [] });

const updateField = (field, value) => {
  if (props.isReadOnly) return;
  const newData = cloneDeep(fileDistrib.value);
  newData[field] = value;
  emit('update:modelValue', newData);
};

const updatePart = (index, field, value) => {
  if (props.isReadOnly) return;
  const newData = cloneDeep(fileDistrib.value);
  newData.Parts[index][field] = value;
  emit('update:modelValue', newData);
}

const addPart = () => {
  if (props.isReadOnly) return;
  const newData = cloneDeep(fileDistrib.value);
  if (!newData.Parts) newData.Parts = [];
  newData.Parts.push({ From: '', To: '' });
  emit('update:modelValue', newData);
}

const removePart = (index) => {
  if (props.isReadOnly) return;
  const newData = cloneDeep(fileDistrib.value);
  newData.Parts.splice(index, 1);
  emit('update:modelValue', newData);
}
</script>

<style scoped>
.part-item {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 8px;
  align-items: center;
}
</style>








