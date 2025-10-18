<template>
  <div
    v-if="uiStore.dragInvalidationReason"
    class="drag-feedback-tooltip"
    :style="{ top: `${uiStore.cursorY}px`, left: `${uiStore.cursorX}px` }"
  >
    <v-chip color="error" variant="elevated" size="small">
      <v-icon start size="small">mdi-cancel</v-icon>
      {{ uiStore.dragInvalidationReason }}
    </v-chip>
  </div>
</template>

<script setup lang="ts">
import { useUiStore } from '@/core/stores/ui';

const uiStore = useUiStore();
</script>

<style scoped>
.drag-feedback-tooltip {
  position: fixed;
  pointer-events: none;
  z-index: 9999;
  transform: translate(15px, 15px);
}
</style>