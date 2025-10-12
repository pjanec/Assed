<template>
  <v-dialog
    :model-value="modelValue"
    @update:model-value="emit('update:model-value', $event)"
    max-width="400px"
    persistent
  >
    <v-card>
      <v-card-title>Rename Asset</v-card-title>
      <v-card-text>
        <p class="text-body-2 mb-4">
          Renaming asset: <strong>{{ assetKey }}</strong>
        </p>
        <v-text-field
          v-model="newAssetKey"
          label="New Asset Key"
          :rules="[rules.required, rules.pattern, rules.unique]"
          autofocus
          @keyup.enter="handleRename"
        />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn text @click="emit('update:model-value', false)">Cancel</v-btn>
        <v-btn color="primary" @click="handleRename" :disabled="!isValid">Rename</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useAssetsStore } from '@/core/stores/index';

interface Props {
  modelValue: boolean;
  assetKey: string;
  assetId: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'update:model-value', value: boolean): void;
  (e: 'submit', assetKey: string): void;
}>();

// --- START: Added logic for Escape key ---
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
// --- END: Added logic for Escape key ---

const assetsStore = useAssetsStore();
const newAssetKey = ref('');

const rules = {
  required: (value: string) => !!value || 'Required.',
  pattern: (value: string) => /^[a-zA-Z0-9_.-]+$/.test(value) || 'Invalid characters. Use a-z, 0-9, _, -, .',
  unique: (value: string) => {
    if (!value || !props.assetId) return true;
    
    const assetToRename = assetsStore.unmergedAssets.find((a: any) => a.id === props.assetId);
    if (!assetToRename) return true;

    const parentFqn = assetToRename.fqn.includes('::')
      ? assetToRename.fqn.substring(0, assetToRename.fqn.lastIndexOf('::'))
      : null;

    const siblings = assetsStore.unmergedAssets.filter((a: any) => {
      const aParentFqn = a.fqn.includes('::') ? a.fqn.substring(0, a.fqn.lastIndexOf('::')) : null;
      return a.id !== props.assetId && aParentFqn === parentFqn;
    });

    const isDuplicate = siblings.some((s: any) => s.assetKey.toLowerCase() === value.toLowerCase());
    return !isDuplicate || 'This name is already taken in this location.';
  }
};

const isValid = computed(() => {
  return rules.required(newAssetKey.value) === true &&
         rules.pattern(newAssetKey.value) === true &&
         rules.unique(newAssetKey.value) === true;
});

watch(() => props.modelValue, (isOpen: boolean) => {
  if (isOpen) {
    newAssetKey.value = props.assetKey;
  }
});

const handleRename = () => {
  if (isValid.value) {
    emit('submit', newAssetKey.value);
  }
};
</script>e






