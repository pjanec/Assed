<template>
  <v-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:model-value', $event)"
    max-width="800px"
    persistent
  >
    <v-card v-if="payload">
      <v-card-title class="d-flex align-center">
        <v-icon class="me-2" color="primary">mdi-content-copy</v-icon>
        Confirm Node Clone
      </v-card-title>
      <v-card-text class="pt-4" style="max-height: 70vh; overflow-y: auto;">
        <p class="mb-4">
          Cloning node '<strong>{{ payload.sourceNode.assetKey }}</strong>' into distro '<strong>{{ payload.targetEnv.assetKey }}</strong>' will perform the following actions. Please review.
        </p>
          
        <AffectedAssetsViewer
          title="Node to be Cloned"
          :changes="payload.plan.nodesToCreate"
        />

        <AffectedAssetsViewer
          v-if="payload.plan.keysToCreate.length > 0"
          title="Requirements to be Cloned"
          :changes="payload.plan.keysToCreate"
          class="mt-4"
        />
          
        <AffectedAssetsViewer
          v-if="payload.plan.safeImports.length > 0"
          title="Missing Packages (Safe Imports)"
          :changes="payload.plan.safeImports"
          class="mt-4"
        />
          
        <AffectedAssetsViewer
          v-if="payload.plan.importsWithOverrides.length > 0"
          title="Missing Packages (Imports with Overrides for Review)"
          :changes="payload.plan.importsWithOverrides"
          class="mt-4"
        />
      </v-card-text>
      <v-card-actions class="px-6 pb-4 pt-4">
        <v-spacer />
        <v-btn text @click="$emit('cancel')">Cancel</v-btn>
        <v-btn color="primary" variant="elevated" @click="$emit('confirm')">Clone Node and Dependencies</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import AffectedAssetsViewer from '@/core/components/dialogs/AffectedAssetsViewer.vue';

withDefaults(defineProps<{ modelValue: boolean; payload: any }>(), {
  modelValue: false,
  payload: null
});
defineEmits(['update:model-value', 'confirm', 'cancel']);
</script>
