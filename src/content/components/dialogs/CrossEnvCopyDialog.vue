<template>
  <v-dialog
    :model-value="dialogState.show"
    @update:model-value="!$event && handleCancel()"
    max-width="600px"
    persistent
  >
    <v-card v-if="comparison">
      <v-card-title class="d-flex align-center">
        <v-icon class="me-2" color="warning">mdi-alert-circle-outline</v-icon>
        Cross-Environment Copy
      </v-card-title>

      <v-card-text>
        <div class="mb-4">
          <p class="text-body-1 mb-2">
            You are about to copy an asset from one environment to another. This will change the asset's inheritance chain.
          </p>
          <p class="text-body-2 text-medium-emphasis">
            The asset will be "flattened" and "rebased" to the target environment, which may affect its properties and behavior.
          </p>
        </div>

        <v-divider class="my-4"></v-divider>

        <div class="mb-4">
          <h4 class="text-subtitle-1 mb-3">Inheritance Chain Comparison</h4>
          
          <div class="d-flex">
            <!-- Before Chain -->
            <div class="flex-1 me-4">
              <h5 class="text-subtitle-2 mb-2 text-error">Before (Current)</h5>
              <v-card variant="outlined" class="pa-3">
                <div v-for="(item, index) in comparison.before" :key="index" class="d-flex align-center mb-2">
                  <v-icon size="small" class="me-2" :color="getChainItemColor(item)">{{ getChainItemIcon(item) }}</v-icon>
                  <div>
                    <div class="text-body-2 font-weight-medium">{{ item.assetKey }}</div>
                    <div class="text-caption text-medium-emphasis">{{ item.fqn }}</div>
                  </div>
                </div>
              </v-card>
            </div>

            <!-- Arrow -->
            <div class="d-flex align-center">
              <v-icon color="primary" size="large">mdi-arrow-right</v-icon>
            </div>

            <!-- After Chain -->
            <div class="flex-1 ms-4">
              <h5 class="text-subtitle-2 mb-2 text-success">After (Target)</h5>
              <v-card variant="outlined" class="pa-3">
                <div v-for="(item, index) in comparison.after" :key="index" class="d-flex align-center mb-2">
                  <v-icon size="small" class="me-2" :color="getChainItemColor(item)">{{ getChainItemIcon(item) }}</v-icon>
                  <div>
                    <div class="text-body-2 font-weight-medium">{{ item.assetKey }}</div>
                    <div class="text-caption text-medium-emphasis">{{ item.fqn }}</div>
                  </div>
                </div>
              </v-card>
            </div>
          </div>
        </div>

        <v-alert type="warning" variant="tonal" class="mb-4">
          <div class="font-weight-bold">Warning</div>
          <div>This operation cannot be undone. The asset's inheritance will be permanently changed.</div>
        </v-alert>
      </v-card-text>

      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn variant="text" @click="handleCancel">Cancel</v-btn>
        <v-btn color="primary" variant="elevated" @click="handleConfirm">Confirm Copy</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useUiStore, useWorkspaceStore } from '@/core/stores';
import { useCoreConfigStore } from '@/core/stores/config';
import { ASSET_TYPES } from '@/content/config/constants';

const uiStore = useUiStore();
const workspaceStore = useWorkspaceStore();
const coreConfig = useCoreConfigStore();

// This component now reads from the generic state object.
const dialogState = computed(() => uiStore.dragDropConfirmationDialog);

// It knows how to interpret the generic displayPayload because it's a content component.
const comparison = computed(() => {
  if (dialogState.value.displayPayload?.type === 'CrossEnvironmentCopy') {
    return dialogState.value.displayPayload.inheritanceComparison;
  }
  return null;
});

const getChainItemIcon = (item: any) => {
  return coreConfig.getAssetIcon(item.assetType);
};

const getChainItemColor = (item: any) => {
  return coreConfig.getAssetTypeColor(item.assetType);
};

const handleCancel = () => {
  uiStore.clearActionStates();
};

const handleConfirm = () => {
  const { dragPayload, dropTarget } = dialogState.value;
  if (dragPayload && dropTarget) {
    // The dialog's only job is to tell the workspace to execute the confirmed action.
    // The complex command construction belongs in the interaction rule itself.
    workspaceStore.executeCrossEnvCopy(dragPayload, dropTarget);
  }
  uiStore.clearActionStates();
};
</script>

<style scoped>
.flex-1 {
  flex: 1;
}
</style>
