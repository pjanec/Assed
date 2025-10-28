<template>
  <div class="environment-machines-view h-100 d-flex flex-column">
    <div v-if="machines.length === 0" class="text-center text-medium-emphasis mt-8">
      <v-icon color="grey-lighten-1" size="48" class="mb-2">mdi-desktop-tower-monitor</v-icon>
      <p class="text-body-1">No machines in this environment</p>
    </div>

    <div v-else class="machines-grid-container flex-1-1 overflow-auto pa-4">
      <div class="item-grid">
        <MachineCard
          v-for="machine in machines"
          :key="machine.id"
          :machine="machine"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useAssetsStore, useCoreConfigStore } from '@/core/stores';
import { ASSET_TYPES } from '@/content/config/constants';
import type { UnmergedAsset } from '@/core/types';
import { resolveInheritedCollection } from '@/core/utils/inheritanceUtils';
import MachineCard from './MachineCard.vue';

interface Props {
  environmentAsset: UnmergedAsset;
}

const props = defineProps<Props>();
const assetsStore = useAssetsStore();
const coreConfig = useCoreConfigStore();

const machines = computed(() => {
  if (!props.environmentAsset) return [];

  return resolveInheritedCollection(
    props.environmentAsset,
    ASSET_TYPES.MACHINE,
    assetsStore.unmergedAssets,
    coreConfig.effectiveAssetRegistry
  ).sort((a, b) => a.assetKey.localeCompare(b.assetKey));
});
</script>

<style scoped>
.environment-machines-view {
  min-height: 400px;
  max-height: 70vh;
}

.item-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}
</style>
