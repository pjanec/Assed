<template>
  <v-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:model-value', $event)"
    max-width="400px"
    persistent
  >
    <v-card>
      <v-card-title>{{ title }}</v-card-title>
      <v-card-text>
        <p class="text-body-2 mb-4">
          Enter a new name for the {{ actionVerb }} of <strong>{{ originalAssetKey }}</strong>.
        </p>
        <v-text-field
          v-model="newAssetKey"
          label="New Asset Name"
          :rules="[rules.required, rules.pattern, rules.unique]"
          autofocus
          @keyup.enter="handleSubmit"
        />
      </v-card-text>
        <v-card-actions>
            <v-spacer />
            <v-btn text @click="handleCancel">Cancel</v-btn>
            <v-btn color="primary" @click="handleSubmit" :disabled="!isValid">{{ actionWord }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useAssetsStore, useUiStore } from '@/core/stores/index';
import type { Asset } from '@/core/types';
import { DIALOG_MODES } from '@/core/config/constants';

interface Props {
  modelValue: boolean;
  originalAssetKey: string;
  parentFqn: string | null;
  title: string;
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Clone Asset'
});

const emit = defineEmits<{
  (e: 'update:model-value', value: boolean): void;
  (e: 'submit', newAssetKey: string): void;
}>();

const assetsStore = useAssetsStore();
const uiStore = useUiStore(); // <-- ADD THIS LINE
const newAssetKey = ref('');

// Computed properties to derive text from the title prop.
const actionWord = computed(() => props.title.split(' ')[0] || 'Submit'); // "Clone" or "Derive"
const actionVerb = computed(() => (actionWord.value === 'Clone' ? 'clone' : 'derivative'));

const rules = {
  required: (value: string) => !!value || 'Required.',
  pattern: (value: string) => /^[a-zA-Z0-9_.-]+$/.test(value) || 'Invalid characters.',
  unique: (value: string) => {
    if (!value) return true;
    
    const siblings = assetsStore.unmergedAssets.filter((a: Asset) => {
      const aParentFqn = a.fqn.includes('::') ? a.fqn.substring(0, a.fqn.lastIndexOf('::')) : null;
      return aParentFqn === props.parentFqn;
    });

    const isDuplicate = siblings.some((s: Asset) => s.assetKey.toLowerCase() === value.toLowerCase());
    return !isDuplicate || 'This name is already taken in this location.';
  }
};

const isValid = computed(() => {
  if (!newAssetKey.value) return false;
  return rules.required(newAssetKey.value) === true &&
         rules.pattern(newAssetKey.value) === true &&
         rules.unique(newAssetKey.value) === true;
});

// Watch both props to avoid race conditions
watch(
  () => [props.modelValue, props.originalAssetKey],
  ([isOpen, originalKey]) => {
    if (isOpen && originalKey) {
      // Get the mode directly from the single source of truth.
      const mode = uiStore.cloneDialogState.mode;

      // Use the symbolic constant for a safe comparison.
      newAssetKey.value = (mode === DIALOG_MODES.DERIVE)
        ? `Derived_${originalKey}`
        : `${originalKey}_copy`;
    } else if (!isOpen) {
      newAssetKey.value = '';
    }
  }
);

const handleSubmit = () => {
  if (isValid.value) {
    emit('submit', newAssetKey.value);
  } else {
    // This will provide a clear error if the form is somehow invalid
    console.error('Submit blocked: Form is not valid.', {
        key: newAssetKey.value,
        required: rules.required(newAssetKey.value),
        pattern: rules.pattern(newAssetKey.value),
        unique: rules.unique(newAssetKey.value)
    });
  }
};

// <<< --- ADD THIS NEW FUNCTION --- >>>
const handleCancel = () => {
  emit('update:model-value', false);
  uiStore.clearDragState(); // Also clear the drag state on cancel
}


const handleKeydown = (event: KeyboardEvent) => {
  if (props.modelValue && event.key === 'Escape') {
    handleCancel();
  }
};

onMounted(() => {
  window.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
});
</script>







