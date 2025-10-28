<template>
  <DistroReassignmentDialog
    v-if="dialogState.dialogType === 'distro-reassignment' && dialogState.show"
    v-model="dialogState.show"
    :environment-name="dialogState.payload?.environmentName"
    :old-distro-fqn="dialogState.payload?.currentDistro"
    :new-distro-fqn="dialogState.payload?.newDistro"
    @confirm="handleConfirm"
    @update:model-value="(val: boolean) => {
      if (!val) {
        handleCancel();
      }
    }"
  />
  <component
    v-else-if="currentDialogComponent"
    :is="currentDialogComponent"
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
import CrossDistroCopyDialog from './CrossDistroCopyDialog.vue';
import ResolveAndCopyDialog from './ResolveAndCopyDialog.vue';
import DistroReassignmentDialog from './DistroReassignmentDialog.vue';

const uiStore = useUiStore();
const dialogState = computed(() => uiStore.genericConfirmationState);

const currentDialogComponent = computed(() => {
  switch (dialogState.value.dialogType) {
    case 'node-clone-confirmation':
      return NodeCloneConfirmationDialog;
    case 'cross-distro-copy':
      return CrossDistroCopyDialog;
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
