<template>
  <div class="general-properties-editor pa-4">
    <v-form>
      <v-text-field
        :model-value="asset.unmerged.assetKey"
        label="Asset Key (Display Name)"
        variant="outlined"
        density="compact"
        readonly
        class="mb-4"
        hint="This is the structural identifier and cannot be changed here."
        persistent-hint
      >
        <template v-slot:prepend-inner>
          <v-icon color="primary">mdi-key-variant</v-icon>
        </template>
      </v-text-field>

      <v-text-field
        v-model="editableTechnicalName"
        label="Technical Name (for build process)"
        variant="outlined"
        density="compact"
        class="mb-4"
        hint="File-system friendly name used during builds."
        persistent-hint
        :readonly="isReadOnly"
      ></v-text-field>

      <v-text-field
        :model-value="asset.unmerged.fqn"
        label="FQN (Fully Qualified Name)"
        variant="outlined"
        density="compact"
        readonly
        class="mb-4"
      >
        <template v-slot:prepend-inner>
          <v-icon color="info">mdi-information-outline</v-icon>
        </template>
      </v-text-field>

      <v-autocomplete
        v-model="editableTemplateFqn"
        :items="lazyLoadedTemplates"  
        :loading="isLoadingTemplates" 
        @focus="loadAvailableTemplates" 
        item-title="assetKey"
        item-value="fqn"
        label="Template"
        variant="outlined"
        :readonly="isReadOnly"
        density="compact"
        clearable
        class="mb-4"
      >
        <template v-slot:item="{ props, item }">
          <v-list-item v-bind="props" :subtitle="item.raw.fqn"></v-list-item>
        </template>
      </v-autocomplete>

    </v-form>
  </div>
</template>

<script setup>
import { computed, ref, watch, nextTick } from 'vue'; // Import ref, watch, and nextTick
import { useAssetsStore, useWorkspaceStore } from '@/core/stores';
import { UpdateAssetCommand } from '@/core/stores/workspace';
import { cloneDeep } from 'lodash-es';

const props = defineProps({
  asset: { type: Object, required: true },
  isReadOnly: { type: Boolean, default: false },
});

const assetsStore = useAssetsStore();
const workspaceStore = useWorkspaceStore();

// --- START: NEW LAZY-LOADING STATE ---
const lazyLoadedTemplates = ref([]);
const isLoadingTemplates = ref(false);
const haveTemplatesBeenLoaded = ref(false);

// This function will be called only when the user interacts with the dropdown.
const loadAvailableTemplates = async () => {
  // 1. If we've already loaded the list for this asset, do nothing.
  if (haveTemplatesBeenLoaded.value) return;

  // 2. Show a loading spinner in the dropdown.
  isLoadingTemplates.value = true;
  await nextTick(); // Allows the UI to update with the spinner.

  // 3. Perform the expensive calculation.
  const currentAsset = props.asset.unmerged;
  if (currentAsset) {
    lazyLoadedTemplates.value = assetsStore.getValidTemplates(currentAsset.assetType, currentAsset.fqn);
  }
  
  // 4. Mark as loaded and hide the spinner.
  haveTemplatesBeenLoaded.value = true;
  isLoadingTemplates.value = false;
};

// This watcher resets the state whenever a new asset is selected in the inspector.
watch(() => props.asset.unmerged.id, () => {
  lazyLoadedTemplates.value = [];
  isLoadingTemplates.value = false;
  haveTemplatesBeenLoaded.value = false;
}, { immediate: true });
// --- END: NEW LAZY-LOADING STATE ---


const emitChange = (field, newValue, isOverride = false) => {
  const oldData = props.asset.unmerged;
  const newData = cloneDeep(oldData);
  
  if (isOverride) {
    if (!newData.overrides) newData.overrides = {};
    newData.overrides[field] = newValue;
  } else {
    newData[field] = newValue;
  }

  const command = new UpdateAssetCommand(props.asset.unmerged.id, oldData, newData);
  workspaceStore.executeCommand(command);
};

const editableTechnicalName = computed({
  get: () => props.asset.unmerged.overrides?.name || '',
  set: (value) => emitChange('name', value, true),
});

const editableTemplateFqn = computed({
  get: () => props.asset.unmerged.templateFqn,
  set: (value) => emitChange('templateFqn', value || null),
});

// REMOVE the old `availableTemplates` computed property entirely.
// const availableTemplates = computed(() => { ... });
</script>

<style scoped>
.general-properties-editor {
  overflow-y: auto;
}
</style>







