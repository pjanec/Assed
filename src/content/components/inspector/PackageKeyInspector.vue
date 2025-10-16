<template>
  <div class="d-flex flex-column h-100 pa-4">
    <div class="d-flex align-center mb-2">
      <v-icon class="me-2" :color="iconColor">{{ icon }}</v-icon>
      <span class="text-h6 font-weight-medium">{{ asset.unmerged.assetKey }}</span>
    </div>
    <div class="text-body-2 text-medium-emphasis mb-4 text-truncate">{{ asset.unmerged.fqn }}</div>

    <v-divider class="mb-4"></v-divider>

    <div v-if="resolvedPackage">
      <v-alert
        type="success"
        variant="tonal"
        class="mb-4"
        :icon="coreConfig.getAssetIcon(ASSET_TYPES.PACKAGE_KEY)"
      >
        Requirement is resolved.
      </v-alert>

      <div class="text-subtitle-2 mb-1">Resolved To</div>
      <v-card variant="outlined">
        <v-list-item>
          <template #prepend>
            <v-icon :color="coreConfig.getAssetTypeColor(ASSET_TYPES.PACKAGE)">
              {{ coreConfig.getAssetIcon(ASSET_TYPES.PACKAGE) }}
            </v-icon>
          </template>
          <v-list-item-title class="font-weight-medium">{{ resolvedPackage.assetKey }}</v-list-item-title>
          <v-list-item-subtitle>{{ resolvedPackage.fqn }}</v-list-item-subtitle>
          <template #append>
            <v-btn
              size="small"
              variant="text"
              icon="mdi-open-in-new"
              @click="inspectPackage"
            >
              <v-tooltip activator="parent" location="bottom">Inspect Package</v-tooltip>
            </v-btn>
          </template>
        </v-list-item>
      </v-card>
    </div>

    <div v-else>
      <v-alert
        type="error"
        variant="tonal"
        class="mb-4"
        icon="mdi-alert-circle-outline"
      >
        <div class="font-weight-bold">Unresolved Requirement</div>
        The package '{{ asset.unmerged.assetKey }}' could not be found in the environment's package pool.
      </v-alert>

      <v-btn
        block
        color="primary"
        variant="tonal"
        prepend-icon="mdi-magnify"
        @click="handleResolve"
      >
        Resolve...
      </v-btn>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useAssetsStore, useUiStore, useWorkspaceStore } from '@/core/stores';
import { useCoreConfigStore } from '@/core/stores/config';
import type { AssetDetails, UnmergedAsset } from '@/core/types';
import { ASSET_TYPES } from '@/content/config/constants';
import { getAssetEnvironmentFqn } from '@/content/utils/assetUtils';

interface Props {
  asset: AssetDetails;
}

const props = defineProps<Props>();

const assetsStore = useAssetsStore();
const uiStore = useUiStore();
const workspaceStore = useWorkspaceStore();
const coreConfig = useCoreConfigStore();

const resolvedPackage = computed<UnmergedAsset | undefined>(() => {
  const packageKey = props.asset.unmerged;
  const allAssets = assetsStore.unmergedAssets;

  // 1. Find the environment this PackageKey belongs to.
  const envFqn = getAssetEnvironmentFqn(packageKey.fqn, allAssets);
  if (!envFqn) {
    return undefined; // A PackageKey must be in an environment to resolve.
  }

  // 2. Search for a Package within that same environment that has a matching assetKey.
  return allAssets.find(a =>
    a.assetType === ASSET_TYPES.PACKAGE &&
    a.assetKey === packageKey.assetKey &&
    getAssetEnvironmentFqn(a.fqn, allAssets) === envFqn
  );
});

const icon = computed(() => resolvedPackage.value ? coreConfig.getAssetIcon(ASSET_TYPES.PACKAGE_KEY) : 'mdi-link-variant-off');
const iconColor = computed(() => resolvedPackage.value ? coreConfig.getAssetTypeColor(ASSET_TYPES.PACKAGE_KEY) : 'error');

const inspectPackage = () => {
  if (resolvedPackage.value) {
    assetsStore.openInspectorFor(resolvedPackage.value.id, { reuse: true, focus: true });
  }
};

// The resolution logic
const handleResolve = async () => {
  const allAssets = assetsStore.unmergedAssets;
  const envFqn = getAssetEnvironmentFqn(props.asset.unmerged.fqn, allAssets);

  // Filter for valid packages within the same environment
  const validPackages = allAssets.filter(a =>
    a.assetType === ASSET_TYPES.PACKAGE &&
    getAssetEnvironmentFqn(a.fqn, allAssets) === envFqn
  );

  try {
    const selectedPackage = await uiStore.promptForAssetSelection({
      title: `Resolve Requirement: '${props.asset.unmerged.assetKey}'`,
      items: validPackages,
    });

    if (selectedPackage) {
      // Renaming the PackageKey's assetKey is the correct action to "re-link" it.
      // This reuses our robust refactoring logic.
      workspaceStore.renameAsset(props.asset.unmerged.id, selectedPackage.assetKey);
    }
  } catch (error) {
    console.error("Asset selection was cancelled or failed:", error);
  }
};
</script>

<style scoped>
.text-truncate {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>


