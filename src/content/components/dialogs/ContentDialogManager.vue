<template>
  <NodeCloneConfirmationDialog
    v-if="dialogState.dialogType === 'node-clone-confirmation'"
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

const uiStore = useUiStore();
const dialogState = computed(() => uiStore.genericConfirmationState);

const handleConfirm = () => {
  dialogState.value.resolver?.(true);
  uiStore.clearActionStates();
};

const handleCancel = () => {
  dialogState.value.resolver?.(false);
  uiStore.clearActionStates();
};
</script>
