<template>
  <div class="d-flex flex-column align-center justify-center h-100 pa-4 text-center">
    <v-icon size="64" color="primary" class="mb-4">
      {{ assetRegistry[asset.unmerged.assetType]?.icon || 'mdi-folder-question' }}
    </v-icon>
    <h4 class="text-h6 mb-2">{{ asset.unmerged.assetKey }}</h4>
    <p class="text-body-2 text-medium-emphasis">
      This is a {{ asset.unmerged.assetType.toLowerCase() }} node. You can add new assets inside it.
    </p>
    <v-btn
      color="primary"
      class="mt-4"
      prepend-icon="mdi-plus"
      @click="handleAddAsset"
    >
      Add New Asset Here
    </v-btn>
  </div>
</template>

<script setup>
import { useWorkspaceStore } from '@/core/stores';
import { assetRegistry } from '@/content/config/assetRegistry';

const props = defineProps({
  asset: { type: Object, required: true }
});

const workspaceStore = useWorkspaceStore();

const handleAddAsset = () => {
  const namespace = props.asset.unmerged.fqn; // The FQN is the namespace
  workspaceStore.openNewAssetDialog({ namespace });
};
</script>







