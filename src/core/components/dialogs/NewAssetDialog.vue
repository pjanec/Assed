<template>
  <v-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:model-value', $event)"
    max-width="600px"
    persistent
  >
    <v-card>
      <v-card-title class="d-flex align-center">
        <v-icon class="me-2">mdi-plus-box-outline</v-icon>
        {{ dialogTitle }}
      </v-card-title>

      <v-card-text>
        <v-form @submit.prevent="handleCreate">
          <v-select
            v-if="!isChildMode"
            v-model="form.assetType"
            :items="assetTypes"
            label="Asset Type*"
            variant="outlined"
            density="compact"
            class="mb-4"
            :rules="[rules.required]"
            autofocus
          />

          <v-text-field
            v-model="form.technicalName"
            label="Technical Name*"
            variant="outlined"
            density="compact"
            class="mb-4"
            :rules="[rules.required, rules.pattern, rules.unique]"
            hint="Allowed characters: a-z, 0-9, _, -, ."
            persistent-hint
            :autofocus="isChildMode"
          />

          <v-text-field
            v-model="form.title"
            label="Title (Optional)"
            variant="outlined"
            density="compact"
            class="mb-4"
          />

          <v-text-field
            v-model="form.location"
            label="Location"
            variant="outlined"
            density="compact"
            class="mb-4"
            readonly
            persistent-hint
            hint="The folder where this asset will be created."
          />

          <v-text-field
            :value="generatedFqn"
            label="FQN (Fully Qualified Name)"
            variant="outlined"
            density="compact"
            class="mb-4"
            readonly
          />

          <v-autocomplete
            v-model="form.templateFqn"
            :items="availableTemplates"
            item-title="assetKey"
            item-value="fqn"
            label="Template (Optional)"
            variant="outlined"
            density="compact"
            clearable
          >
            <template v-slot:item="{ props, item }">
              <v-list-item v-bind="props" :subtitle="item.raw.fqn"></v-list-item>
            </template>
          </v-autocomplete>
        </v-form>
      </v-card-text>

      <v-card-actions class="px-6 pb-4 pt-2">
        <v-spacer />
        <v-btn variant="text" @click="handleCancel">Cancel</v-btn>
        <v-btn
          color="primary"
          variant="elevated"
          :disabled="!isValid"
          @click="handleCreate"
        >
          <v-icon class="me-2">mdi-check</v-icon>
          Create
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useAssetsStore } from '@/core/stores/index';
import { useCoreConfigStore } from '@/core/stores/config';

interface ParentAsset {
  assetKey: string;
  fqn: string;
  id: string;
}

interface Props {
  modelValue: boolean;
  parentAsset: ParentAsset | null;
  childType: string | null; // e.g., 'Node', 'Package'
  prefilledOrigin: string | null;
}

const props = withDefaults(defineProps<Props>(), {
  parentAsset: null,
  childType: null,
  prefilledOrigin: null
});

const emit = defineEmits<{
  (e: 'update:model-value', value: boolean): void;
  (e: 'create', asset: any): void;
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
const coreConfig = useCoreConfigStore();

const form = ref({
  assetType: '',
  technicalName: '',
  title: '',
  location: '',
  templateFqn: null
});

// -- Computed Properties --
const isChildMode = computed(() => !!props.parentAsset || !!props.childType);

const assetTypes = computed(() => {
  // Use the core config store to get available asset types
  return Object.entries(coreConfig.assetRegistry)
    .filter(([, definition]) => definition.isCreatableAtRoot)
    .map(([type]) => type);
});


const dialogTitle = computed(() => {
  if (isChildMode.value && props.parentAsset && props.childType) {
    return `Add New ${props.childType} to '${props.parentAsset.assetKey}'`;
  }
  return 'Create New Shared Asset';
});

const generatedFqn = computed(() => {
  if (!form.value.technicalName) {
    return form.value.location ? `${form.value.location}::` : '';
  }
  return form.value.location 
    ? `${form.value.location}::${form.value.technicalName}`
    : form.value.technicalName;
});

const availableTemplates = computed(() => {
    const type = isChildMode.value ? props.childType : form.value.assetType;
    if (!type) return [];
    return assetsStore.getValidTemplates(type, generatedFqn.value);
});

// -- Validation Rules --
const rules = {
  required: (value: any) => !!value || 'This field is required.',
  pattern: (value: string) => /^[a-zA-Z0-9_.-]+$/.test(value) || 'Invalid characters.',
  isCompleteFilePath: (value: string) => (!!value && value.endsWith('.json')) || 'Origin must be a complete .json file path.',
  unique: (value: string) => {
    if (!value) return true;
    const fqn = generatedFqn.value.toLowerCase();

    const isDuplicate = assetsStore.unmergedAssets.some((a: any) => a.fqn.toLowerCase() === fqn);
    return !isDuplicate || 'This name results in a duplicate FQN at this location.';
  }
};

const isValid = computed(() => {
    const commonRules = rules.required(form.value.technicalName) === true &&
                        rules.pattern(form.value.technicalName) === true &&
                        rules.unique(form.value.technicalName) === true;
    
 if (isChildMode.value) {
        return commonRules;
    }
    return commonRules &&
           rules.required(form.value.assetType) === true;
});

// -- Watchers --
watch(() => props.modelValue, (isOpen: boolean) => {
  if (isOpen) {
    resetForm();
    if (props.parentAsset && props.childType) {
      form.value.location = props.parentAsset.fqn;
      form.value.assetType = props.childType;
    } else if (props.prefilledOrigin) {
      form.value.location = props.prefilledOrigin;
    }
  }
});

// -- Methods --
const resetForm = () => {
  form.value = {
    assetType: '',
    technicalName: '',
    title: '',
    location: '',
    templateFqn: null
  };
};

const handleCreate = () => {
  if (!isValid.value) return;

  const newAsset: any = {
    assetType: isChildMode.value ? props.childType : form.value.assetType,
    assetKey: form.value.technicalName,
    fqn: generatedFqn.value,
    templateFqn: form.value.templateFqn,
    overrides: {} as any
  };
    
  if (form.value.title) {
    newAsset.overrides.Title = form.value.title;
  }

  emit('create', newAsset);
  emit('update:model-value', false);
};

const handleCancel = () => {
  emit('update:model-value', false);
};

</script>






