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
            <MergedSelect
              v-if="selectedOperation"
              :asset="asset"
              :path="`Scripts.Operations.${selectedOperation}[${index}].Stage`"
              :items="['First', 'Last']"
              label="Stage"
              density="compact"
              variant="outlined"
              class="mb-2"
              :readonly="isReadOnly"
            />
            <MergedTextField
              v-if="selectedOperation"
              :asset="asset"
              :path="`Scripts.Operations.${selectedOperation}[${index}].File`"
              label="File (Optional)"
              density="compact"
              variant="outlined"
              class="mb-2"
              :readonly="isReadOnly"
            >
              <template #append-inner>
                <span class="text-caption text-medium-emphasis">Path relative to payload folder.</span>
              </template>
            </MergedTextField>
            <div class="editor-container" v-if="!script.File">
              <h5 class="text-caption mb-1">Script Lines (if no file is specified)</h5>
               <MonacoEditor
                :value="(script.Lines || []).join('\n')"
                @change="updateLines(index, $event)"
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

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { cloneDeep } from 'lodash-es';
import type { AssetDetails } from '@/core/types';
import { useWorkspaceStore, UpdateAssetCommand } from '@/core/stores/workspace';
import MonacoEditor from './MonacoEditor.vue';
import MergedTextField from './controls/MergedTextField.vue';
import MergedSelect from './controls/MergedSelect.vue';

const props = defineProps<{
  asset: AssetDetails,
  isReadOnly?: boolean,
}>();

const workspaceStore = useWorkspaceStore();

const scripts = computed(() => props.asset.unmerged.overrides?.Scripts || {});
const operations = computed(() => Object.keys(scripts.value.Operations || {}));
const selectedOperation = ref(operations.value[0] || null);

watch(operations, (newOps) => {
  if (selectedOperation.value && !newOps.includes(selectedOperation.value)) {
    selectedOperation.value = newOps[0] || null;
  }
});

const scriptsForOperation = computed(() => {
  if (!selectedOperation.value) return [];
  return scripts.value.Operations?.[selectedOperation.value] || [];
});

const updateLines = (index: number, newContent: string) => {
  if (props.isReadOnly || !selectedOperation.value) return;
  const oldData = props.asset.unmerged;
  const newData = cloneDeep(oldData);
  if (!newData.overrides) newData.overrides = {} as any;
  if (!newData.overrides.Scripts) (newData.overrides as any).Scripts = {} as any;
  if (!newData.overrides.Scripts.Operations) (newData.overrides as any).Scripts.Operations = {} as any;
  if (!newData.overrides.Scripts.Operations[selectedOperation.value]) {
    (newData.overrides as any).Scripts.Operations[selectedOperation.value] = [];
  }
  if (!(newData.overrides as any).Scripts.Operations[selectedOperation.value][index]) {
    (newData.overrides as any).Scripts.Operations[selectedOperation.value][index] = {};
  }
  (newData.overrides as any).Scripts.Operations[selectedOperation.value][index].Lines = newContent.split('\n');
  const cmd = new UpdateAssetCommand(oldData.id, oldData, newData);
  workspaceStore.executeCommand(cmd);
};

const addScript = () => {
  if (props.isReadOnly || !selectedOperation.value) return;
  const oldData = props.asset.unmerged;
  const newData = cloneDeep(oldData);
  if (!newData.overrides) newData.overrides = {} as any;
  if (!newData.overrides.Scripts) (newData.overrides as any).Scripts = {} as any;
  if (!newData.overrides.Scripts.Operations) (newData.overrides as any).Scripts.Operations = {} as any;
  if (!newData.overrides.Scripts.Operations[selectedOperation.value]) {
    (newData.overrides as any).Scripts.Operations[selectedOperation.value] = [];
  }
  (newData.overrides as any).Scripts.Operations[selectedOperation.value].push({ Stage: 'First', Interpretter: 'Powershell' });
  const cmd = new UpdateAssetCommand(oldData.id, oldData, newData);
  workspaceStore.executeCommand(cmd);
};

const removeScript = (index: number) => {
  if (props.isReadOnly || !selectedOperation.value) return;
  const oldData = props.asset.unmerged;
  const newData = cloneDeep(oldData);
  if (!newData.overrides?.Scripts?.Operations?.[selectedOperation.value]) return;
  
  const scripts = (newData.overrides as any).Scripts.Operations[selectedOperation.value];
  scripts.splice(index, 1);
  
  // Clean up empty arrays and objects
  if (scripts.length === 0) {
    delete (newData.overrides as any).Scripts.Operations[selectedOperation.value];
    if (Object.keys((newData.overrides as any).Scripts.Operations).length === 0) {
      delete (newData.overrides as any).Scripts.Operations;
      if (Object.keys((newData.overrides as any).Scripts).length === 0) {
        delete (newData.overrides as any).Scripts;
      }
    }
  }
  
  const cmd = new UpdateAssetCommand(oldData.id, oldData, newData);
  workspaceStore.executeCommand(cmd);
};
</script>

<style scoped>
.editor-container {
  border: 1px solid rgba(var(--v-border-color), 0.5);
  border-radius: 4px;
  height: 200px;
}
</style>








