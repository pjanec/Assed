<template>
  <BaseInspector :asset="asset" @update:overrides="handleOverridesChange">
    <template #settings-panels>
      <v-expansion-panels v-model="expandedPanels" multiple variant="accordion">
        <v-expansion-panel value="general">
          <v-expansion-panel-title class="text-body-2 custom-panel-title">
            <v-icon class="me-2" size="small">mdi-pencil-box-outline</v-icon>
            General Properties
          </v-expansion-panel-title>
          <v-expansion-panel-text>
            <GeneralPropertiesEditor :asset="asset" :is-read-only="asset.isReadOnly" />
          </v-expansion-panel-text>
        </v-expansion-panel>
        <v-expansion-panel value="canvas">
          <v-expansion-panel-title class="text-body-2 custom-panel-title">
            <div class="d-flex align-center justify-between w-100">
              <div class="d-flex align-center">
                <v-icon class="me-2" size="small">mdi-view-dashboard</v-icon>
                Canvas / Matrix View
              </div>
              <div class="d-flex ga-1" @click.stop>
                <v-btn-toggle
                  v-model="editorView"
                  variant="outlined"
                  color="primary"
                  size="x-small"
                >
                  <v-btn value="canvas" size="x-small">
                    <v-icon size="16">mdi-view-dashboard</v-icon>
                  </v-btn>
                  <v-btn value="matrix" size="x-small">
                    <v-icon size="16">mdi-table</v-icon>
                  </v-btn>
                </v-btn-toggle>
              </div>
            </div>
          </v-expansion-panel-title>
          <v-expansion-panel-text class="pa-0">
            <div class="canvas-matrix-content">
              <div v-if="editorView === 'canvas'" class="canvas-wrapper">
                <CanvasView :asset="asset.unmerged" :is-embedded="true" />
              </div>
              <div v-else class="matrix-wrapper">
                <MatrixView :asset="asset.unmerged" :is-embedded="true" />
              </div>
            </div>
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>
    </template>
  </BaseInspector>
</template>

<script setup>
import { ref } from 'vue';
import { useWorkspaceStore } from '@/core/stores';
import { UpdateAssetCommand } from '@/core/stores/workspace';
import BaseInspector from './BaseInspector.vue';
import GeneralPropertiesEditor from './GeneralPropertiesEditor.vue';
import CanvasView from '@/content/components/editor/CanvasView.vue';
import MatrixView from '@/content/components/editor/MatrixView.vue';
import { cloneDeep } from 'lodash-es';

const props = defineProps({
  asset: { type: Object, required: true }
});

const workspaceStore = useWorkspaceStore();
const expandedPanels = ref(['general', 'canvas']);
const editorView = ref('canvas');

const handleOverridesChange = (newOverrides) => {
  const oldData = props.asset.unmerged;
  const newData = cloneDeep(oldData);
  newData.overrides = newOverrides;
  const command = new UpdateAssetCommand(props.asset.unmerged.id, oldData, newData);
  workspaceStore.executeCommand(command);
};
</script>

<style scoped>
:deep(.custom-panel-title) {
  background-color: rgba(var(--v-theme-primary), 0.08);
  font-weight: 600 !important;
  color: rgb(var(--v-theme-on-surface));
}
:deep(.v-expansion-panel-text__wrapper) {
  padding: 0 !important;
  background-color: rgb(var(--v-theme-surface));
}
.canvas-matrix-content {
  min-height: 400px;
  max-height: 60vh;
  position: relative;
}
.canvas-wrapper,
.matrix-wrapper {
  height: 100%;
  display: flex;
  flex-direction: column;
}
</style>








