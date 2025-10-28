<template>
  <v-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:model-value', $event)"
    max-width="500px"
    persistent
  >
    <v-card>
      <v-card-title class="d-flex align-center">
        <v-icon class="me-2" color="warning">mdi-alert-outline</v-icon>
        Confirm Distro Reassignment
      </v-card-title>
      <v-card-text>
        <p class="mb-2">
          You are about to change the Source Distro for Environment
          '<strong>{{ environmentName }}</strong>'.
        </p>
        <p class="mb-4">
          Changing the Distro may cause existing Node Assignments (NodeKeys) on
          Machines within this Environment to become unresolved if the required
          Nodes do not exist in the new Distro.
        </p>
        <v-divider class="my-3" />
        <v-row dense>
          <v-col cols="12" sm="6">
            <div class="text-caption">Current Distro:</div>
            <v-chip size="small" variant="tonal">{{ oldDistroFqn || 'None' }}</v-chip>
          </v-col>
          <v-col cols="12" sm="6">
            <div class="text-caption">New Distro:</div>
            <v-chip size="small" variant="tonal" color="primary">{{ newDistroFqn }}</v-chip>
          </v-col>
        </v-row>
      </v-card-text>
      <v-card-actions class="px-6 pb-4 pt-2">
        <v-spacer />
        <v-btn variant="text" @click="emit('update:model-value', false)">Cancel</v-btn>
        <v-btn color="warning" variant="elevated" @click="emit('confirm')">Confirm Reassignment</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';

interface Props {
  modelValue: boolean;
  environmentName?: string;
  oldDistroFqn?: string | null;
  newDistroFqn?: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'update:model-value', value: boolean): void;
  (e: 'confirm'): void;
}>();

const handleKeydown = (event: KeyboardEvent) => {
  if (props.modelValue && event.key === 'Escape') {
    emit('update:model-value', false);
  }
};

onMounted(() => {
  window.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
});
</script>


