<template>
  <v-dialog
    :model-value="dialogState.show"
    @update:model-value="!$event && handleCancel()"
    max-width="800px"
    persistent
  >
    <v-card v-if="dialogState.asset">
      <v-card-title class="d-flex align-center">
        <v-icon class="me-2" color="primary">mdi-swap-horizontal-bold</v-icon>
        Confirm Template Change
      </v-card-title>
      <v-card-text>
        <p class="mb-4">
          You are changing the template for <strong>{{ dialogState.asset.assetKey }}</strong>. This will alter the final merged properties of the asset.
        </p>

        <v-row>
          <v-col cols="6">
            <div class="text-caption">From Template:</div>
            <v-chip size="small" variant="tonal">{{ dialogState.oldTemplateFqn || 'None' }}</v-chip>
          </v-col>
          <v-col cols="6">
            <div class="text-caption">To Template:</div>
            <v-chip size="small" variant="tonal" color="primary">{{ dialogState.newTemplateFqn || 'None' }}</v-chip>
          </v-col>
        </v-row>

        <div class="mt-4">
          <AffectedAssetsViewer
            title="Resulting Changes to Merged Properties"
            :changes="changesForViewer"
          />
        </div>

      </v-card-text>
      <v-card-actions class="px-6 pb-4 pt-2">
        <v-spacer />
        <v-btn variant="text" @click="handleCancel">Cancel</v-btn>
        <v-btn color="primary" variant="elevated" @click="handleConfirm">Confirm Change</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useUiStore, useWorkspaceStore } from '@/core/stores';
import AffectedAssetsViewer from './AffectedAssetsViewer.vue';

const uiStore = useUiStore();
const workspaceStore = useWorkspaceStore();

const dialogState = computed(() => uiStore.templateChangeDialog);

const changesForViewer = computed(() => {
  if (!dialogState.value.asset || !dialogState.value.diff) return [];
  // Wrap the diff in the structure the viewer expects
  return [{
    newState: dialogState.value.asset,
    diff: dialogState.value.diff,
  }];
});

const handleCancel = () => {
  uiStore.clearActionStates();
};

const handleConfirm = () => {
  const { asset, newTemplateFqn } = dialogState.value;
  if (asset) {
    workspaceStore.executeTemplateChange(asset.id, newTemplateFqn);
  }
  uiStore.clearActionStates();
};
</script>
