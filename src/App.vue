<template>
  <v-app>
    <router-view />
    <!-- Add the single global context menu renderer -->
    <GlobalContextMenu />
    <DragFeedbackTooltip />
    <ContentDialogManager />
  </v-app>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import GlobalContextMenu from '@/core/components/GlobalContextMenu.vue';
import DragFeedbackTooltip from '@/core/components/DragFeedbackTooltip.vue';
import ContentDialogManager from '@/content/components/dialogs/ContentDialogManager.vue';

// Import the single, clear setup function from the content plugin file
import { registerContentHooks } from '@/content/plugin';

// Register context menu handlers and other component-dependent logic on mount
onMounted(() => {
  registerContentHooks();
  console.log('✅ Content context menu handlers successfully registered.');
});
</script>

<style>
/* Global styles */

/* Optional but recommended: Add a global style to change the cursor
   during a drag, providing better user feedback.
*/
.drag-active {
  cursor: grabbing !important;
}

/* Fix dark overlay issues caused by Vuetify's automatic theming */
.v-application {
  --custom-statusbar-background: 220, 220, 220; /* The light grey you wanted */
  /* Force light theme colors */
  --v-theme-surface-variant: 248, 248, 248 !important;
  --v-theme-on-surface-variant: 33, 33, 33 !important;
}

/* Override any automatic dark overlays on headers */
.canvas-header,
.matrix-header,
.inspector-header,
.v-toolbar,
.v-app-bar {
  background-color: rgb(248, 248, 248) !important;
  color: rgb(33, 33, 33) !important;
}

/* Fix header action buttons - make them dark and right-aligned */
.canvas-header .v-btn,
.matrix-header .v-btn,
.inspector-header .v-btn {
  color: rgb(33, 33, 33) !important;
}

.canvas-header .d-flex:last-child,
.matrix-header .d-flex:last-child,
.inspector-header .d-flex:last-child {
  margin-left: auto !important;
}

/* Fix matrix table headers specifically */
.matrix-cell--header {
  background-color: rgb(248, 248, 248) !important;
  color: rgb(33, 33, 33) !important;
}

/* Fix JSON editor top-level items with dark backgrounds */
:deep(.jsoneditor-tree .jsoneditor-node.jsoneditor-object > .jsoneditor-button),
:deep(.jsoneditor-tree .jsoneditor-node.jsoneditor-array > .jsoneditor-button) {
  background-color: transparent !important;
}

:deep(.jsoneditor-tree .jsoneditor-node.jsoneditor-object > .jsoneditor-field),
:deep(.jsoneditor-tree .jsoneditor-node.jsoneditor-array > .jsoneditor-field),
:deep(.jsoneditor-tree .jsoneditor-node > .jsoneditor-field) {
  background-color: rgb(var(--v-theme-surface)) !important;
  color: rgb(var(--v-theme-on-surface)) !important;
}

/* Drag and Drop Visual Feedback Styles */

/* Provides visual feedback for the element currently being dragged. */
.is-dragging {
  opacity: 0.5;
  background-color: #e0e0e0;
}

/* Provides visual feedback for a valid drop target being hovered over. */
.drag-over {
  outline: 2px dashed #42a5f5; /* A blue dashed outline */
  outline-offset: 2px;
  background-color: #e3f2fd !important; /* A light blue background */
}
</style>







