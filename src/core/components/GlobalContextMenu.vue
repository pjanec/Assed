<!-- src/core/components/GlobalContextMenu.vue -->
<template>
  <v-menu
    v-model="isMenuVisible"
    :style="{ left: `${x}px`, top: `${y}px` }"
    absolute
    @update:modelValue="onMenuClose"
  >
    <v-list density="compact">
      <template v-for="action in actions" :key="action.id">
        <v-divider v-if="action.divider" class="my-1" />

        <!-- Nested Submenu Rendering -->
        <v-menu
          v-if="action.children && action.children.length > 0"
          open-on-hover
          location="end"
          :close-on-content-click="false"
        >
          <template #activator="{ props }">
            <v-list-item v-bind="props" :disabled="action.disabled">
              <template #prepend><v-icon size="small">{{ action.icon }}</v-icon></template>
              <v-list-item-title>{{ action.label }}</v-list-item-title>
              <template #append><v-icon size="small">mdi-chevron-right</v-icon></template>
            </v-list-item>
          </template>
          <v-list dense>
            <v-list-item
              v-for="childAction in action.children"
              :key="childAction.id"
              @click="executeAction(childAction)"
              :disabled="childAction.disabled"
            >
              <template #prepend><v-icon size="small">{{ childAction.icon }}</v-icon></template>
              <v-list-item-title>{{ childAction.label }}</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-menu>

        <!-- Standard Item Rendering -->
        <v-list-item v-else @click="executeAction(action)" :disabled="action.disabled">
          <template #prepend><v-icon size="small">{{ action.icon }}</v-icon></template>
          <v-list-item-title>{{ action.label }}</v-list-item-title>
        </v-list-item>
      </template>
    </v-list>
  </v-menu>
</template>

<script setup lang="ts">
import { ref, watch, inject, nextTick } from 'vue';
import { useUiStore } from '@/core/stores/ui';
import type { ContextMenuAction } from '@/core/types/ui';
import { ContextMenuRegistryKey } from '@/core/registries/contextMenuRegistryKey';

const uiStore = useUiStore();
const registry = inject(ContextMenuRegistryKey);

if (!registry) {
  throw new Error('Fatal Error: ContextMenuRegistry was not provided by the CorePlugin.');
}

const isMenuVisible = ref(false);
const x = ref(0);
const y = ref(0);
const actions = ref<ContextMenuAction[]>([]);

// Watch the FSM state from the store
watch(() => uiStore.contextMenu, async (menuState) => {
  if (menuState.state === 'opening') {
    x.value = menuState.x;
    y.value = menuState.y;
    actions.value = registry.getContextMenuActionsForContext(menuState.ctx);
      
    // Do not show menu if no actions are available
    if (actions.value.length === 0) {
        uiStore.hideContextMenu();
        return;
    }

    // Use nextTick to ensure the menu is placed before it is shown
    await nextTick();
    isMenuVisible.value = true;
    // Confirm to the store that the menu is now visually open
    uiStore.confirmMenuOpened();
  } else if (menuState.state === 'closed') {
    isMenuVisible.value = false;
    actions.value = [];
  }
}, { deep: true });

const executeAction = (action: ContextMenuAction) => {
  // The store will close the menu visually after execution
  if (action.execute) {
    action.execute(); // Simply call the pre-configured, zero-argument function.
  }
  uiStore.hideContextMenu();
};

// When v-menu closes itself (e.g., on content click), sync the store state
const onMenuClose = (visible: boolean) => {
  if (!visible && uiStore.contextMenu.state !== 'closed') {
    uiStore.hideContextMenu();
  }
};
</script>