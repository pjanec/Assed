<template>
  <div
    class="matrix-cell-content"
    :class="cellClass"
    @click="handleClick"
  >
    <v-btn
      :icon="assigned ? 'mdi-check-circle' : 'mdi-plus-circle-outline'"
      :color="assigned ? 'success' : 'grey-lighten-1'"
      size="small"
      variant="flat"
      @click.stop="handleToggle"
    />
    
    <div v-if="assigned" class="text-caption mt-1">
      Assigned
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Package {
  id: string;
  [key: string]: any;
}

interface Node {
  id: string;
  [key: string]: any;
}

interface Props {
  package: Package;
  node: Node;
  assigned: boolean;
}

// Props
const props = withDefaults(defineProps<Props>(), {
  assigned: false
})

const emit = defineEmits<{
  (e: 'toggle', packageId: string, nodeId: string): void;
  (e: 'click', packageId: string, nodeId: string): void;
}>();

// Computed properties
const cellClass = computed(() => {
  return {
    'matrix-cell-content--assigned': props.assigned,
    'matrix-cell-content--hover': true
  }
})

// Methods
const handleToggle = () => {
  emit('toggle', props.package.id, props.node.id)
}

const handleClick = () => {
  emit('click', props.package.id, props.node.id)
}
</script>

<style scoped>
.matrix-cell-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
  padding: 4px;
}

.matrix-cell-content--hover:hover {
  background-color: rgba(var(--v-theme-primary), 0.04);
}

.matrix-cell-content--assigned {
  background-color: rgba(var(--v-theme-success), 0.1);
}

.matrix-cell-content--assigned:hover {
  background-color: rgba(var(--v-theme-success), 0.2);
}
</style>
















