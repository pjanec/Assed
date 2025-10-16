<template>
  <v-dialog
    :model-value="dialogState.show"
    @update:model-value="!$event && handleCancel()"
    max-width="600px"
    persistent
  >
    <v-card v-if="dialogState.asset">
      <v-card-title class="d-flex align-center">
        <v-icon class="me-2" color="warning">mdi-alert-outline</v-icon>
        Confirm Clear Overrides
      </v-card-title>
      <v-card-text>
        <p class="mb-4">
          You are about to delete all {{ changes.length }} local override(s) on
          <strong>{{ dialogState.asset.assetKey }}</strong>.
          The asset will fully revert to the values from its template.
        </p>

        <div class="text-subtitle-1 mb-2">Changes to be applied:</div>
        <div class="diff-content rounded pa-2" style="max-height: 300px; overflow-y: auto;">
          <div
            v-for="(change, index) in changes"
            :key="index"
            class="diff-item diff-item--removed"
          >
            <v-icon size="small" class="me-2">mdi-minus-circle</v-icon>
            <div class="diff-path me-2">{{ change.path }}:</div>
            <div class="diff-value text-decoration-line-through">
              {{ JSON.stringify(change.oldValue) }}
            </div>
          </div>
        </div>
      </v-card-text>
      <v-card-actions class="px-6 pb-4 pt-2">
        <v-spacer />
        <v-btn variant="text" @click="handleCancel">Cancel</v-btn>
        <v-btn color="warning" variant="elevated" @click="handleConfirm">Clear Overrides</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useUiStore, useWorkspaceStore } from '@/core/stores';
import type { Change } from '@/core/types';

const uiStore = useUiStore();
const workspaceStore = useWorkspaceStore();

const dialogState = computed(() => uiStore.clearOverridesDialog);
const changes = computed<Change[]>(() => dialogState.value.changes || []);

const handleCancel = () => {
  uiStore.clearActionStates();
};

const handleConfirm = () => {
  const assetId = dialogState.value.asset?.id;
  if (assetId) {
    workspaceStore.executeClearOverrides(assetId);
  }
  uiStore.clearActionStates();
};
</script>

<style scoped>
.diff-content { background-color: rgba(0, 0, 0, 0.02); font-family: monospace; font-size: 0.8rem; }
.diff-item { display: flex; align-items: center; padding: 2px 4px; }
.diff-item--removed { color: #d32f2f; }
.diff-path { font-weight: bold; }
.diff-value { white-space: pre-wrap; word-break: break-all; }
</style>
