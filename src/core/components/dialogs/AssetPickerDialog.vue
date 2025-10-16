<template>
  <v-dialog
    :model-value="dialogState.show"
    @update:model-value="!$event && handleCancel()"
    max-width="600px"
    persistent
  >
    <v-card v-if="dialogState.show">
      <v-card-title>{{ dialogState.title }}</v-card-title>
      <v-card-text>
        <v-text-field
          v-model="searchQuery"
          label="Search..."
          prepend-inner-icon="mdi-magnify"
          variant="outlined"
          density="compact"
          hide-details
          autofocus
          class="mb-4"
        />
        <v-list class="border rounded" style="max-height: 40vh; overflow-y: auto;">
          <v-list-item
            v-for="item in filteredItems"
            :key="item.id"
            @click="selectedAsset = item"
            :active="selectedAsset?.id === item.id"
          >
            <template #prepend>
              <v-icon :color="coreConfig.getAssetTypeColor(item.assetType)">
                {{ coreConfig.getAssetIcon(item.assetType) }}
              </v-icon>
            </template>
            <v-list-item-title>{{ item.assetKey }}</v-list-item-title>
            <v-list-item-subtitle>{{ item.fqn }}</v-list-item-subtitle>
          </v-list-item>
          <v-list-item v-if="filteredItems.length === 0">
            <v-list-item-title class="text-medium-emphasis text-center">No matching assets found.</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-card-text>
      <v-card-actions class="px-6 pb-4 pt-2">
        <v-spacer />
        <v-btn variant="text" @click="handleCancel">Cancel</v-btn>
        <v-btn color="primary" variant="elevated" :disabled="!selectedAsset" @click="handleSelect">Select</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useUiStore, useCoreConfigStore } from '@/core/stores';
import type { Asset } from '@/core/types';

const uiStore = useUiStore();
const coreConfig = useCoreConfigStore();

const searchQuery = ref('');
const selectedAsset = ref<Asset | null>(null);

const dialogState = computed(() => uiStore.assetPickerDialog);
const items = computed<Asset[]>(() => dialogState.value.items || []);

const filteredItems = computed(() => {
  if (!searchQuery.value) return items.value;
  const lowerQuery = searchQuery.value.toLowerCase();
  return items.value.filter(item => 
    item.assetKey.toLowerCase().includes(lowerQuery) ||
    item.fqn.toLowerCase().includes(lowerQuery)
  );
});

watch(() => dialogState.value.show, (isOpen) => {
  if (isOpen) {
    searchQuery.value = '';
    selectedAsset.value = null;
  }
});

const handleCancel = () => {
  dialogState.value.resolver?.(null); // Resolve with null on cancel
  uiStore.clearActionStates();
};

const handleSelect = () => {
  dialogState.value.resolver?.(selectedAsset.value);
  uiStore.clearActionStates();
};
</script>
