<template>
  <div class="d-flex flex-column h-100 pa-4">
    <div class="d-flex align-center mb-2">
      <v-icon class="me-2" :color="iconColor">{{ icon }}</v-icon>
      <span class="text-h6 font-weight-medium">{{ asset.unmerged.assetKey }}</span>
    </div>
    <div class="text-body-2 text-medium-emphasis mb-4 text-truncate">{{ asset.unmerged.fqn }}</div>

    <v-divider class="mb-4"></v-divider>

    <div v-if="resolvedNode">
      <v-alert
        type="success"
        variant="tonal"
        class="mb-4"
        :icon="coreConfig.getAssetIcon(ASSET_TYPES.NODE_KEY)"
      >
        Node assignment is resolved.
      </v-alert>

      <div class="text-subtitle-2 mb-1">Resolved To Node</div>
      <v-card variant="outlined">
        <v-list-item>
          <template #prepend>
            <v-icon :color="coreConfig.getAssetTypeColor(ASSET_TYPES.NODE)">
              {{ coreConfig.getAssetIcon(ASSET_TYPES.NODE) }}
            </v-icon>
          </template>
          <v-list-item-title class="font-weight-medium">{{ resolvedNode.assetKey }}</v-list-item-title>
          <v-list-item-subtitle>{{ resolvedNode.fqn }}</v-list-item-subtitle>
          <template #append>
            <v-btn
              size="small"
              variant="text"
              icon="mdi-open-in-new"
              @click="inspectNode"
            >
              <v-tooltip activator="parent" location="bottom">Inspect Node (Read-Only)</v-tooltip>
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
        <div class="font-weight-bold">Unresolved Node Assignment</div>
        The node '{{ asset.unmerged.assetKey }}' could not be found in the Environment's selected Distro ({{ parentEnvironment?.overrides?.distroFqn || 'None Selected' }}).
      </v-alert>

      <v-btn
        block
        color="primary"
        variant="tonal"
        prepend-icon="mdi-magnify"
        :disabled="!parentEnvironment?.overrides?.distroFqn || asset.isReadOnly"
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
import type { AssetDetails, UnmergedAsset, Asset } from '@/core/types';
import { ASSET_TYPES } from '@/content/config/constants';
import { getParentPath } from '@/core/utils/fqnUtils';

interface Props {
  asset: AssetDetails;
}

const props = defineProps<Props>();

const assetsStore = useAssetsStore();
const uiStore = useUiStore();
const workspaceStore = useWorkspaceStore();
const coreConfig = useCoreConfigStore();

const parentMachine = computed<UnmergedAsset | undefined>(() => {
  const parentFqn = getParentPath(props.asset.unmerged.fqn);
  if (!parentFqn) return undefined;
  return assetsStore.unmergedAssets.find(a => a.fqn === parentFqn);
});

const parentEnvironment = computed<UnmergedAsset | undefined>(() => {
  if (!parentMachine.value) return undefined;
  const grandparentFqn = getParentPath(parentMachine.value.fqn);
  if (!grandparentFqn) return undefined;
  return assetsStore.unmergedAssets.find(a => a.fqn === grandparentFqn && a.assetType === ASSET_TYPES.ENVIRONMENT);
});

const resolvedNode = computed<UnmergedAsset | undefined>(() => {
  const nodeKey = props.asset.unmerged;
  const env = parentEnvironment.value;
  if (!env?.overrides?.distroFqn) return undefined;

  const targetDistroFqn = env.overrides.distroFqn;

  return assetsStore.unmergedAssets.find(a =>
    a.assetType === ASSET_TYPES.NODE &&
    a.assetKey === nodeKey.assetKey &&
    (a.fqn === targetDistroFqn || a.fqn.startsWith(targetDistroFqn + '::'))
  );
});

const icon = computed(() => resolvedNode.value ? coreConfig.getAssetIcon(ASSET_TYPES.NODE_KEY) : 'mdi-key-chain-variant-off');
const iconColor = computed(() => resolvedNode.value ? coreConfig.getAssetTypeColor(ASSET_TYPES.NODE_KEY) : 'error');

const inspectNode = () => {
  if (resolvedNode.value) {
    assetsStore.openInspectorFor(resolvedNode.value.id, { reuse: true, focus: true });
  }
};

const handleResolve = async () => {
  const env = parentEnvironment.value;
  if (!env?.overrides?.distroFqn || props.asset.isReadOnly) return;

  const targetDistroFqn = env.overrides.distroFqn;

  const validNodes = assetsStore.unmergedAssets.filter(a =>
    a.assetType === ASSET_TYPES.NODE &&
    (a.fqn === targetDistroFqn || a.fqn.startsWith(targetDistroFqn + '::'))
  );

  try {
    const selectedNode = await uiStore.promptForAssetSelection({
      title: `Resolve Node Assignment: '${props.asset.unmerged.assetKey}'`,
      items: validNodes as Asset[],
    });

    if (selectedNode) {
      await workspaceStore.renameAsset(props.asset.unmerged.id, selectedNode.assetKey);
    }
  } catch (error) {
    console.log("Asset selection was cancelled or failed:", error);
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


