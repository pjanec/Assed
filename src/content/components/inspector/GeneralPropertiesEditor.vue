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
        :model-value="asset.unmerged.templateFqn"
        @update:model-value="handleTemplateChange"
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

    <v-divider class="my-4"></v-divider>
    <div class="d-flex align-center">
      <div class="flex-grow-1">
        <div class="text-subtitle-2">Reset to Template</div>
        <div class="text-caption text-medium-emphasis">
          This will remove all local property overrides from this asset.
        </div>
      </div>
      <v-btn
        color="warning"
        variant="tonal"
        size="small"
        :disabled="!hasOverrides || isReadOnly"
        @click="handleClearOverrides"
      >
        Clear Local Overrides
      </v-btn>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch, nextTick } from 'vue'; // Import ref, watch, and nextTick
import { useAssetsStore, useWorkspaceStore, useUiStore } from '@/core/stores';
import { UpdateAssetCommand } from '@/core/stores/workspace';
import { cloneDeep } from 'lodash-es';
import { generatePropertiesDiff } from '@/core/utils/diff';
import { calculateMergedAsset } from '@/core/utils/mergeUtils';

const props = defineProps({
  asset: { type: Object, required: true },
  isReadOnly: { type: Boolean, default: false },
});

const assetsStore = useAssetsStore();
const workspaceStore = useWorkspaceStore();
const uiStore = useUiStore();

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
  // Prevent editing read-only assets (e.g., virtual assets)
  if (props.isReadOnly) {
    return;
  }
  
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

// Template Change Handler with Confirmation
const handleTemplateChange = (newTemplateFqn) => {
  if (props.isReadOnly) return;

  const oldTemplateFqn = props.asset.unmerged.templateFqn;
  if (oldTemplateFqn === newTemplateFqn) return; // No change

  // 1. Calculate "before" state
  const allAssetsMap = new Map(assetsStore.unmergedAssets.map(a => [a.id, a]));
  const stateBefore = calculateMergedAsset(props.asset.unmerged.id, allAssetsMap);

  // 2. Calculate "after" state (in memory)
  const tempAsset = cloneDeep(props.asset.unmerged);
  tempAsset.templateFqn = newTemplateFqn;
  const tempAssetsMap = new Map(allAssetsMap).set(tempAsset.id, tempAsset);
  const stateAfter = calculateMergedAsset(tempAsset.id, tempAssetsMap);

  // 3. Generate the diff
  const diff = generatePropertiesDiff(
    'properties' in stateBefore ? stateBefore.properties : null,
    'properties' in stateAfter ? stateAfter.properties : null
  );

  // 4. Prompt for confirmation
  uiStore.promptForTemplateChange({
    asset: props.asset.unmerged,
    oldTemplateFqn: oldTemplateFqn || null,
    newTemplateFqn: newTemplateFqn || null,
    diff,
  });
};

// Logic for Clear Overrides
const hasOverrides = computed(() => {
  return props.asset.unmerged.overrides && Object.keys(props.asset.unmerged.overrides).length > 0;
});

const handleClearOverrides = () => {
  if (!hasOverrides.value || props.isReadOnly) return;

  // 1. Calculate the diff between current overrides and an empty object
  const changes = generatePropertiesDiff(props.asset.unmerged.overrides, {});

  // 2. Call the UI store to open the confirmation dialog
  uiStore.promptForClearOverrides({
    asset: props.asset.unmerged,
    changes,
  });
};

// REMOVE the old `availableTemplates` computed property entirely.
// const availableTemplates = computed(() => { ... });
</script>

<style scoped>
.general-properties-editor {
  overflow-y: auto;
}
</style>







