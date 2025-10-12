<template>
  <v-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:model-value', $event)"
    max-width="400px"
    persistent
  >
    <v-card>
      <v-card-title>Create New Folder</v-card-title>
      <v-card-text>
        <p v-if="parentFqn" class="text-body-2 mb-4">
          Creating folder inside: <strong>{{ parentFqn }}</strong>
        </p>
        <v-text-field
          v-model="newFolderName"
          label="Folder Name"
          :rules="[rules.required, rules.pattern, rules.unique]"
          autofocus
          @keyup.enter="handleSubmit"
        />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn text @click="$emit('update:model-value', false)">Cancel</v-btn>
        <v-btn color="primary" @click="handleSubmit" :disabled="!isValid">Create</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useAssetsStore } from '@/core/stores/index';

interface Props {
  modelValue: boolean;
  parentFqn: string | null;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'update:model-value', value: boolean): void;
  (e: 'submit', folderName: string): void;
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

const assetsStore = useAssetsStore();
const newFolderName = ref('');

const rules = {
  required: (value: string) => !!value || 'Required.',
  pattern: (value: string) => /^[a-zA-Z0-9_.-]+$/.test(value) || 'Invalid characters.',
  unique: (value: string) => {
    if (!value) return true;
    const newFqn = props.parentFqn ? `${props.parentFqn}::${value}` : value;
    const isDuplicate = assetsStore.unmergedAssets.some((a: any) => a.fqn.toLowerCase() === newFqn.toLowerCase());
    return !isDuplicate || 'A folder or asset with this name already exists here.';
  }
};

const isValid = computed(() => {
  return rules.required(newFolderName.value) === true &&
         rules.pattern(newFolderName.value) === true &&
         rules.unique(newFolderName.value) === true;
});

watch(() => props.modelValue, (isOpen) => {
  if (isOpen) {
    newFolderName.value = '';
  }
});

const handleSubmit = () => {
  if (isValid.value) {
    emit('submit', newFolderName.value);
  }
};
</script>







