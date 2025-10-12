<template>
  <v-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:model-value', $event)"
    max-width="600px"
    persistent
  >
    <v-card v-if="asset">
      <v-card-title class="d-flex align-center">
        <v-icon class="me-2" color="error">mdi-cancel</v-icon>
        Cannot Delete Asset
      </v-card-title>
      <v-card-text>
        <p class="mb-4">
          Deletion of <strong>{{ asset.assetKey }}</strong> is blocked because it is used
          as a template by other assets. Please update the assets listed below before proceeding.
        </p>
        <AffectedAssetsViewer
          title="Blocking Dependencies"
          :changes="blockingDependenciesForViewer"
        >
          <template #change-details>
            </template>
        </AffectedAssetsViewer>
      </v-card-text>
      <v-card-actions class="px-6 pb-4 pt-2">
        <v-spacer />
        <v-btn color="primary" variant="tonal" @click="$emit('update:model-value', false)">OK</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue';
import AffectedAssetsViewer from './AffectedAssetsViewer.vue';

interface Asset {
  assetKey: string;
  id: string;
  fqn: string;
  assetType: string;
}

interface Props {
  modelValue: boolean;
  asset: Asset | null;
  blockingDependencies: Asset[];
}

const props = withDefaults(defineProps<Props>(), {
  asset: null,
  blockingDependencies: () => []
});

const emit = defineEmits<{
  (e: 'update:model-value', value: boolean): void;
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

const blockingDependenciesForViewer = computed(() => {
  return props.blockingDependencies.map(dep => ({ newState: dep }));
});
</script>







