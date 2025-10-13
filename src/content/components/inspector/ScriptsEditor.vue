<template>
  <div class="pa-4">
    <v-select
      v-model="selectedOperation"
      :items="operations"
      label="Operation"
      variant="outlined"
      density="compact"
      class="mb-4"
      :readonly="isReadOnly"
    ></v-select>

    <v-divider></v-divider>

    <div v-if="selectedOperation" class="mt-4">
      <h4 class="text-subtitle-1 mb-2">Scripts for '{{ selectedOperation }}'</h4>
      <v-expansion-panels variant="accordion">
        <v-expansion-panel v-for="(script, index) in scriptsForOperation" :key="index">
          <v-expansion-panel-title>
            <div class="d-flex align-center justify-space-between w-100">
              <span>Script {{ index + 1 }}</span>
              <v-btn
                icon="mdi-delete-outline"
                size="x-small"
                variant="text"
                @click.stop="removeScript(index)"
                :disabled="isReadOnly"
              />
            </div>
          </v-expansion-panel-title>
          <v-expansion-panel-text>
            <v-select
              :model-value="script.Stage"
              @update:modelValue="updateScript(index, 'Stage', $event)"
              :items="['First', 'Last']"
              label="Stage"
              density="compact"
              variant="outlined"
              class="mb-2"
              :readonly="isReadOnly"
            />
             <v-text-field
              :model-value="script.File"
              @update:modelValue="updateScript(index, 'File', $event)"
              label="File (Optional)"
              density="compact"
              variant="outlined"
              class="mb-2"
              messages="Path relative to payload folder."
              :readonly="isReadOnly"
            />
            <div class="editor-container" v-if="!script.File">
              <h5 class="text-caption mb-1">Script Lines (if no file is specified)</h5>
               <MonacoEditor
                :value="(script.Lines || []).join('\n')"
                @change="updateScript(index, 'Lines', $event.split('\n'))"
                language="powershell"
                :readOnly="isReadOnly"
                :options="{ lineNumbers: 'off', glyphMargin: false, folding: false }"
              />
            </div>
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>

       <v-btn block variant="tonal" size="small" @click="addScript" class="mt-4" :disabled="isReadOnly">
        Add Script to '{{ selectedOperation }}'
      </v-btn>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { cloneDeep } from 'lodash-es';
import MonacoEditor from './MonacoEditor.vue';

const props = defineProps({
  modelValue: { type: Object, default: () => ({}) },
  isReadOnly: { type: Boolean, default: false },
});
const emit = defineEmits(['update:modelValue']);

const scripts = computed(() => props.modelValue || {});
const operations = computed(() => Object.keys(scripts.value.Operations || {}));
const selectedOperation = ref(operations.value[0] || null);

watch(operations, (newOps) => {
  if (!newOps.includes(selectedOperation.value)) {
    selectedOperation.value = newOps[0] || null;
  }
});

const scriptsForOperation = computed(() => {
  return scripts.value.Operations?.[selectedOperation.value] || [];
});

const updateScript = (index, field, value) => {
  if (props.isReadOnly) return;
  const newData = cloneDeep(scripts.value);
  newData.Operations[selectedOperation.value][index][field] = value;
  emit('update:modelValue', newData);
};

const addScript = () => {
  if (props.isReadOnly) return;
  const newData = cloneDeep(scripts.value);
  if (!newData.Operations) newData.Operations = {};
  if (!newData.Operations[selectedOperation.value]) newData.Operations[selectedOperation.value] = [];
  newData.Operations[selectedOperation.value].push({ Stage: 'First', Interpretter: 'Powershell' });
  emit('update:modelValue', newData);
};

const removeScript = (index) => {
  if (props.isReadOnly) return;
  const newData = cloneDeep(scripts.value);
  newData.Operations[selectedOperation.value].splice(index, 1);
  emit('update:modelValue', newData);
};
</script>

<style scoped>
.editor-container {
  border: 1px solid rgba(var(--v-border-color), 0.5);
  border-radius: 4px;
  height: 200px;
}
</style>








