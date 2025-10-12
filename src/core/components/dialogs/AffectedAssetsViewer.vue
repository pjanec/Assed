<template>
  <div v-if="changes.length > 0">
    <h4 class="text-subtitle-1 mb-2">{{ title }} ({{ changes.length }})</h4>
    <v-expansion-panels variant="accordion">
      <v-expansion-panel
        v-for="item in changes"
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
          <v-chip v-if="item.diff" size="small" variant="tonal" class="ms-4">{{ item.diff.length }} change{{ item.diff.length > 1 ? 's' : '' }}</v-chip>
        </v-expansion-panel-title>
        <v-expansion-panel-text class="diff-content">
          <slot name="change-details" :item="item">
            <div v-for="(change, index) in item.diff" :key="index" class="diff-item" :class="`diff-item--${change.type.toLowerCase()}`">
              <v-icon size="small" class="me-2">{{ getChangeIcon(change.type) }}</v-icon>
              <div class="diff-path me-2">{{ change.path }}:</div>
              <div class="diff-value">
                <span v-if="change.type === 'REMOVED' || change.type === 'MODIFIED'" class="text-decoration-line-through text-error me-2">{{ JSON.stringify(change.oldValue) }}</span>
                <v-icon v-if="change.type === 'MODIFIED'" color="grey" class="mx-1">mdi-arrow-right</v-icon>
                <span v-if="change.type === 'ADDED' || change.type === 'MODIFIED'" class="text-success">{{ JSON.stringify(change.newValue) }}</span>
              </div>
            </div>
          </slot>
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>
  </div>
</template>

<script setup lang="ts">
import { useCoreConfigStore } from '@/core/stores/config';
import type { ChangeItem } from '@/core/types';

const coreConfig = useCoreConfigStore();

interface Props {
  title: string;
  changes: ChangeItem[];
}

defineProps<Props>();

const getChangeIcon = (type: string): string => {
  const icons: Record<string, string> = { 
    MODIFIED: 'mdi-pencil-circle', 
    ADDED: 'mdi-plus-circle', 
    REMOVED: 'mdi-minus-circle' 
  };
  return icons[type] || 'mdi-help-circle';
};
</script>

<style scoped>
.diff-content { background-color: rgba(0, 0, 0, 0.02); font-family: monospace; font-size: 0.8rem; }
.diff-item { display: flex; align-items: center; padding: 2px 4px; border-bottom: 1px solid rgba(0, 0, 0, 0.05); }
.diff-item:last-child { border-bottom: none; }
.diff-item--added { color: #2e7d32; }
.diff-item--removed { color: #d32f2f; }
.diff-item--modified { color: #0288d1; }
.diff-path { font-weight: bold; }
.diff-value { white-space: pre-wrap; word-break: break-all; }
</style>







