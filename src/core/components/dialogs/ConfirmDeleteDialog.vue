<template>
  <v-dialog
    :model-value="modelValue"
    @update:model-value="cancelDelete"
    max-width="500px"
  >
    <v-card>
      <v-card-title class="text-h5">Confirm Deletion</v-card-title>
      <v-card-text>
        Are you sure you want to delete the following asset(s)?
        <v-list dense>
          <v-list-item
            v-for="asset in assetsToDisplay"
            :key="asset.fqn"
            class="pa-0"
          >
            <template v-slot:prepend>
              <v-icon :icon="coreConfig.getAssetIcon(asset.assetType)" :color="coreConfig.getAssetTypeColor(asset.assetType)" class="mr-2"></v-icon>
            </template>
            <v-list-item-title>{{ asset.fqn }}</v-list-item-title>
          </v-list-item>
        </v-list>
        This action cannot be undone directly, but you can undo the change before committing.
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn text @click="cancelDelete">Cancel</v-btn>
        <v-btn color="red-darken-1" variant="tonal" @click="confirmDelete">Delete</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useCoreConfigStore } from '@/core/stores/config';
import type { Asset } from '@/core/types'

const coreConfig = useCoreConfigStore();

const props = defineProps<{
  modelValue: boolean
  assetToDelete: Asset | null
  deletableChildren: Asset[]
}>()

const assetsToDisplay = computed(() => {
  if (!props.assetToDelete) return []
  return [props.assetToDelete, ...props.deletableChildren]
})

// The emits can be simplified if the parent is calling store actions directly
const emit = defineEmits(['update:model-value', 'confirm']);
const cancelDelete = () => emit('update:model-value', false);
const confirmDelete = () => emit('confirm');
</script>







