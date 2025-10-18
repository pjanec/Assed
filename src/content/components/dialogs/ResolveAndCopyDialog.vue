<template>
  <v-dialog
    :model-value="modelValue"
    @update:model-value="!$event && handleCancel()"
    max-width="500px"
    persistent
  >
    <v-card v-if="sourcePackageName">
      <v-card-title class="d-flex align-center">
        <v-icon class="me-2" color="info">mdi-lightbulb-on-outline</v-icon>
        Resolve and Copy Requirement
      </v-card-title>
      <v-card-text>
        <p class="mb-4">
          You are copying the requirement for '<strong>{{ sourcePackageName }}</strong>'.
        </p>
        <p>
          This package does not exist in the target environment yet. To resolve this, a new, functionally identical copy of the package will be created in the environment's package pool.
        </p>
      </v-card-text>
      <v-card-actions class="px-6 pb-4 pt-2">
        <v-spacer />
        <v-btn variant="text" @click="handleCancel">Cancel</v-btn>
        <v-btn color="primary" variant="elevated" @click="$emit('confirm')">Create Package & Assign</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{
  modelValue: boolean;
  payload: any;
}>(), {
  modelValue: false,
  payload: null
});
const emit = defineEmits(['update:model-value', 'confirm', 'cancel']);

const sourcePackageName = computed(() => {
  return props.payload?.sourcePackageName || null;
});

const handleCancel = () => {
  emit('cancel');
};
</script>
