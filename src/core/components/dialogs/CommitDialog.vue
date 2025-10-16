<template>
  <v-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:model-value', $event)"
    max-width="800"
    persistent
  >
    <v-card>
      <v-card-title class="d-flex align-center">
        <v-icon class="me-2" color="success">mdi-content-save</v-icon>
        Commit Changes
      </v-card-title>

      <v-card-text class="pt-4" style="max-height: 70vh; overflow-y: auto;">
        <div v-if="modifiedAssets.length > 0" class="mb-4">
          <h4 class="text-subtitle-1 mb-2">Modified ({{ modifiedAssets.length }})</h4>
          <v-expansion-panels variant="accordion">
            <v-expansion-panel
              v-for="item in modifiedAssets"
              :key="item.newState.id"
            >
              <v-expansion-panel-title>
                <div class="d-flex align-center">
                   <v-icon :color="coreConfig.getAssetTypeColor(item.newState.assetType as any)" class="me-3">{{ coreConfig.getAssetIcon(item.newState.assetType as any) }}</v-icon>
                  <div>
                    <div class="font-weight-medium">{{ item.newState.assetKey }}</div>
                    <div class="text-caption text-medium-emphasis">{{ item.newState.fqn }}</div>
                  </div>
                </div>
                <v-spacer />
                <v-btn
                  icon="mdi-open-in-new"
                  size="x-small"
                  variant="text"
                  class="me-2"
                  @click.stop="emit('navigateToAsset', item.newState.id)"
                />
                <v-chip size="small" variant="tonal" class="ms-4">{{ item.diff.length }} change{{ item.diff.length > 1 ? 's' : '' }}</v-chip>
              </v-expansion-panel-title>
              <v-expansion-panel-text class="diff-content">
                <div v-for="(change, index) in item.diff" :key="index" class="diff-item" :class="`diff-item--${change.type.toLowerCase()}`">
                  <v-icon size="small" class="me-2">{{ getChangeIcon(change.type) }}</v-icon>
                  <div class="diff-path me-2">{{ change.path }}:</div>
                  <div class="diff-value">
                    <span v-if="change.type === 'REMOVED' || change.type === 'MODIFIED'" class="text-decoration-line-through text-error me-2">{{ JSON.stringify(change.oldValue) }}</span>
                    <v-icon v-if="change.type === 'MODIFIED'" color="grey" class="mx-1">mdi-arrow-right</v-icon>
                    <span v-if="change.type === 'ADDED' || change.type === 'MODIFIED'" class="text-success">{{ JSON.stringify(change.newValue) }}</span>
                  </div>
                </div>
              </v-expansion-panel-text>
            </v-expansion-panel>
          </v-expansion-panels>
        </div>

        <div v-if="totalAffectedCount > 0" class="mb-4">
          <AffectedAssetsViewer
            title="Affected by Ripple Effect"
            :changes="allRippleChanges"
            @navigateToAsset="onNavigateToAsset"
          />
        </div>

        <div v-if="addedAssets.length > 0" class="mb-4">
          <h4 class="text-subtitle-1 mb-2">Added ({{ addedAssets.length }})</h4>
          <v-list density="compact" class="border rounded">
            <v-list-item v-for="item in addedAssets" :key="item.newState.id">
              <template #prepend>
                <v-icon :color="coreConfig.getAssetTypeColor(item.newState.assetType as any)" class="me-3">
                  {{ coreConfig.getAssetIcon(item.newState.assetType as any) }}
                </v-icon>
              </template>
              <v-list-item-title class="font-weight-medium">{{ item.newState.assetKey }}</v-list-item-title>
              <v-list-item-subtitle class="text-medium-emphasis">{{ item.newState.fqn }}</v-list-item-subtitle>
              <template #append>
                <v-btn
                  icon="mdi-open-in-new"
                  size="x-small"
                  variant="text"
                  class="ms-2"
                  @click.stop="onNavigateToAsset(item.newState.id)"
                />
              </template>
            </v-list-item>
          </v-list>
        </div>

        <div v-if="deletedAssets.length > 0" class="mb-4">
          <h4 class="text-subtitle-1 mb-2">Deleted ({{ deletedAssets.length }})</h4>
          <v-list density="compact" class="border rounded">
            <v-list-item v-for="item in deletedAssets" :key="item.oldState?.id || item.newState.id">
              <template #prepend>
                <v-icon :color="coreConfig.getAssetTypeColor((item.oldState?.assetType || item.newState.assetType) as any)" class="me-3">
                  {{ coreConfig.getAssetIcon((item.oldState?.assetType || item.newState.assetType) as any) }}
                </v-icon>
              </template>
              <v-list-item-title class="font-weight-medium">{{ item.oldState?.assetKey || item.newState.assetKey }}</v-list-item-title>
              <v-list-item-subtitle class="text-medium-emphasis">{{ item.oldState?.fqn || item.newState.fqn }}</v-list-item-subtitle>
            </v-list-item>
          </v-list>
        </div>

        <div class="mt-6">
          <h4 class="text-subtitle-1 mb-3">Commit Message</h4>
          <v-textarea
            v-model="commitMessage"
            label="Describe your changes..."
            variant="outlined"
            rows="3"
            :rules="commitMessageRules"
            hide-details="auto"
          />
        </div>
      </v-card-text>

      <v-card-actions class="px-6 pb-4 pt-4">
        <v-spacer />
        <v-btn variant="text" @click="handleCancel">Cancel</v-btn>
        <v-btn
          color="success"
          variant="elevated"
          :disabled="!canCommit"
          :loading="saving"
          @click="handleCommit"
        >
          <v-icon class="me-2">mdi-check</v-icon>
          Commit Changes
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue';
import { useCoreConfigStore } from '@/core/stores/config';
import { useWorkspaceStore } from '@/core/stores/workspace';
import type { ChangeItem, Change } from '@/core/types';
import AffectedAssetsViewer from './AffectedAssetsViewer.vue';

const coreConfig = useCoreConfigStore();

interface AssetChange {
  newState: {
    id: string;
    assetKey: string;
    fqn: string;
    assetType: string;
  };
  oldState?: {
    id: string;
    assetKey: string;
    fqn: string;
    assetType: string;
  };
  diff: Change[];
}

interface StructuredChanges {
  modified: AssetChange[];
  added: AssetChange[];
  deleted: AssetChange[];
}

interface Props {
  modelValue: boolean;
  saving?: boolean;
  structuredChanges: StructuredChanges;
  rippleEffectChanges: Map<string, ChangeItem[]>;
}

const props = withDefaults(defineProps<Props>(), {
  saving: false,
  structuredChanges: () => ({ modified: [], added: [], deleted: [] }),
  rippleEffectChanges: () => new Map(),
});

const emit = defineEmits<{
  (e: 'update:model-value', value: boolean): void;
  (e: 'save', payload: { message: string }): void;
  (e: 'navigateToAsset', assetId: string): void;
}>();

const workspaceStore = useWorkspaceStore();


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


const commitMessage = ref('');

const modifiedAssets = computed(() => props.structuredChanges.modified);
const addedAssets = computed(() => props.structuredChanges.added);
const deletedAssets = computed(() => props.structuredChanges.deleted);

const totalAffectedCount = computed(() => {
  let count = 0;
  for (const changes of props.rippleEffectChanges.values()) {
    count += changes.length;
  }
  return count;
});

const allRippleChanges = computed(() => {
  if (!props.rippleEffectChanges) return [];
  // Array.from(map.values()) gets an array of arrays (e.g., [[env1_changes], [env2_changes]])
  // .flat() combines them into a single array: [change1, change2, change3, ...]
  return Array.from(props.rippleEffectChanges.values()).flat();
});

const changesCount = computed(() => modifiedAssets.value.length + addedAssets.value.length + deletedAssets.value.length);

const commitMessageRules = [
  (v: string) => !!v || 'Commit message is required',
  (v: string) => (v && v.length >= 10) || 'Commit message must be at least 10 characters',
];

const canCommit = computed(() => {
  return commitMessage.value && commitMessage.value.length >= 10 && changesCount.value > 0;
});

watch(() => props.modelValue, (isOpen: boolean) => {
  if (isOpen) {
    // When the dialog opens, explicitly call the action to calculate the ripple effect.
    workspaceStore.calculateRippleEffect();
      
    // Also reset the commit message here.
    commitMessage.value = '';
  }
});

const getChangeIcon = (type: string): string => {
  const icons: Record<string, string> = {
    MODIFIED: 'mdi-pencil-circle',
    ADDED: 'mdi-plus-circle',
    REMOVED: 'mdi-minus-circle',
  };
  return icons[type] || 'mdi-help-circle';
};

const handleCancel = () => emit('update:model-value', false);

const handleCommit = () => {
  if (!canCommit.value) return;
  emit('save', { message: commitMessage.value });
};

const onNavigateToAsset = (assetId: string) => {
  emit('update:model-value', false);
  emit('navigateToAsset', assetId);
};
</script>

<style scoped>
.border {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.rounded {
  border-radius: 4px;
}
.diff-content {
  background-color: rgba(0, 0, 0, 0.02);
  font-family: monospace;
  font-size: 0.8rem;
}
.diff-item {
  display: flex;
  align-items: center;
  padding: 2px 4px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}
.diff-item:last-child {
  border-bottom: none;
}
.diff-item--added { color: #2e7d32; }
.diff-item--removed { color: #d32f2f; }
.diff-item--modified { color: #0288d1; }
.diff-path {
  font-weight: bold;
}
.diff-value {
  white-space: pre-wrap;
  word-break: break-all;
}
</style>






