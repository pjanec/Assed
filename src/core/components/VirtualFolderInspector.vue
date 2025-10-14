<template>
  <div class="d-flex flex-column h-100 pa-3">
    <div class="d-flex align-center mb-2">
      <v-icon class="me-2">mdi-folder-outline</v-icon>
      <span class="text-subtitle-1 font-weight-medium">{{ folder.name }}</span>
    </div>
    <div class="text-body-2 text-medium-emphasis mb-4 text-truncate">{{ folder.path }}</div>

    <div class="text-subtitle-2 mb-2">Children ({{ folder.children?.length || 0 }})</div>
    <div class="flex-1-1 overflow-y-auto">
      <v-list density="compact">
        <v-list-item v-for="child in folder.children" :key="child.id">
          <template #prepend>
            <v-icon class="me-2">{{ child.type === nodeTypes.FOLDER ? 'mdi-folder-outline' : 'mdi-file-outline' }}</v-icon>
          </template>
          <v-list-item-title class="text-truncate">{{ child.name }}</v-list-item-title>
        </v-list-item>
        <v-list-item v-if="!folder.children || folder.children.length === 0">
          <v-list-item-title class="text-medium-emphasis">No children</v-list-item-title>
        </v-list-item>
      </v-list>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AssetTreeNode } from '@/core/types';
import { ASSET_TREE_NODE_TYPES as nodeTypes } from '@/core/config/constants';

interface Props { folder: AssetTreeNode }
defineProps<Props>();
</script>

<style scoped>
.text-truncate { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
</style>


