<template>
  <component
    :is="currentDialogComponent"
    v-if="currentDialogComponent"
    v-model="dialogState.show"
    :payload="dialogState.payload"
    @confirm="handleConfirm"
    @cancel="handleCancel"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useUiStore } from '@/core/stores';
import NodeCloneConfirmationDialog from './NodeCloneConfirmationDialog.vue';
import CrossEnvCopyDialog from './CrossEnvCopyDialog.vue';
import ResolveAndCopyDialog from './ResolveAndCopyDialog.vue';

const uiStore = useUiStore();
const dialogState = computed(() => uiStore.genericConfirmationState);

const currentDialogComponent = computed(() => {
  switch (dialogState.value.dialogType) {
    case 'node-clone-confirmation':
      return NodeCloneConfirmationDialog;
    case 'cross-environment-copy':
      return CrossEnvCopyDialog;
    case 'proactive-resolution':
      return ResolveAndCopyDialog;
    default:
      return null;
  }
});

const handleConfirm = () => {
  dialogState.value.resolver?.(true);
  uiStore.clearActionStates();
};

const handleCancel = () => {
  dialogState.value.resolver?.(false);
  uiStore.clearActionStates();
};
</script>
