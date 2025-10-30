<template>
  <div class="pa-4">
    <MergedSelect
      :asset="asset"
      path="Payload.From"
      :items="['side', 'fetch']"
      label="Shipping Method (From)"
      variant="outlined"
      density="compact"
      class="mb-4"
      :readonly="isReadOnly"
    />

    <MergedCheckbox
      :asset="asset"
      path="Payload.FetchResourcesOnInstall"
      label="Fetch Resources on Install"
      density="compact"
      :readonly="isReadOnly"
    />
  </div>
  
</template>

<script setup lang="ts">
import type { AssetDetails } from '@/core/types';
import MergedSelect from './controls/MergedSelect.vue';
import MergedCheckbox from './controls/MergedCheckbox.vue';

const props = defineProps<{
  asset: AssetDetails,
  isReadOnly?: boolean,
}>();
</script>

<style scoped>
</style>








