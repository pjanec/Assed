<template>
  <div class="d-flex flex-column h-100">
    <!-- Common Tabs -->
    <v-tabs
      v-model="activeTab"
      bg-color="surface-variant"
      density="compact"
      slider-color="primary"
      grow
    >
      <v-tab value="settings" class="px-2 text-none">
        <v-tooltip activator="parent" location="bottom">Settings</v-tooltip>
        <v-icon>mdi-cog</v-icon>
      </v-tab>
      <v-tab value="tree" class="px-2 text-none">
        <v-tooltip activator="parent" location="bottom">Tree</v-tooltip>
        <v-icon>mdi-file-tree</v-icon>
      </v-tab>
      <v-tab value="source" class="px-2 text-none">
        <v-tooltip activator="parent" location="bottom">Source</v-tooltip>
        <v-icon>mdi-code-braces</v-icon>
      </v-tab>
      <v-tab v-if="asset.merged" value="merged" class="px-2 text-none">
        <v-tooltip activator="parent" location="bottom">Merged</v-tooltip>
        <v-icon>mdi-eye-outline</v-icon>
      </v-tab>
      <v-tab value="debug" class="px-2 text-none">
        <v-tooltip activator="parent" location="bottom">Debug</v-tooltip>
        <v-icon>mdi-bug-outline</v-icon>
      </v-tab>
    </v-tabs>

    <!-- Common Window -->
    <v-window v-model="activeTab" class="inspector-window-content flex-1-1">
      <!-- Slot for specific inspector settings -->
      <v-window-item value="settings" class="h-100">
        <div class="h-100 pa-2" style="overflow-y: auto;">
          <slot name="settings-panels"></slot>
        </div>
      </v-window-item>

      <!-- Common Tree View -->
      <v-window-item value="tree" class="h-100">
        <JSONEditor
          ref="treeEditor"
          :model-value="asset.unmerged.overrides"
          @update:modelValue="$emit('update:overrides', $event)"
          :schema="schema"
          mode="tree"
          :options="{ readOnly: props.isReadOnly }"
        />
      </v-window-item>

      <!-- Common Source View -->
      <v-window-item value="source" class="h-100" style="position: relative;">
        <div style="height: calc(100% - 33px);">
          <MonacoEditor
            class="h-100"
            :value="sourceOverridesCode"
            language="json"
            @change="handleSourceChange"
            :readOnly="props.isReadOnly"
          />
        </div>
        <div class="source-status-bar" style="position: absolute; bottom: 0; width: 100%; z-index: 1;">
          <v-btn
            :color="validationErrors.length > 0 ? 'error' : 'success'"
            density="compact"
            variant="text"
            @click="showValidationDialog = true"
            block
          >
            <v-icon class="me-2">{{ validationErrors.length > 0 ? 'mdi-alert-circle-outline' : 'mdi-check-circle-outline' }}</v-icon>
            {{ validationStatus }}
          </v-btn>
        </div>
      </v-window-item>

      <!-- Common Merged View -->
      <v-window-item v-if="asset.merged" value="merged" class="h-100">
         <v-alert
            v-if="asset.merged && asset.merged.error"
            type="error"
            variant="tonal"
            class="ma-2"
          >
            <strong>Merge Error:</strong> {{ asset.merged.error }}
          </v-alert>
        <MonacoEditor
          v-else
          :value="formattedMergedProperties"
          language="json"
          :options="{ readOnly: true }"
        />
      </v-window-item>

      <!-- Common Debug View -->
      <v-window-item value="debug" class="h-100">
        <MonacoEditor
          :value="sourceDebugCode"
          language="json"
          :options="{ readOnly: true }"
        />
      </v-window-item>
    </v-window>

    <!-- Common Validation Dialog -->
    <v-dialog v-model="showValidationDialog" max-width="600px">
      <v-card>
        <v-card-title>
          <v-icon class="me-2" color="error">mdi-alert-circle-outline</v-icon>
          Schema Issues
        </v-card-title>
        <v-card-text class="pa-0">
          <v-list v-if="validationErrors.length > 0">
            <v-list-item
              v-for="(error, i) in validationErrors"
              :key="i"
              @click="handleNavigateFromDialog(error)"
            >
              <v-list-item-title class="font-weight-bold">{{ error.message }}</v-list-item-title>
              <v-list-item-subtitle>Path: {{ error.path || 'root' }}</v-list-item-subtitle>
            </v-list-item>
          </v-list>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="primary" text @click="showValidationDialog = false">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import MonacoEditor from './MonacoEditor.vue';
import JSONEditor from './JSONEditor.vue';
import Ajv from 'ajv';
import type { AssetDetails } from '@/core/types';

interface ValidationError {
  path: string;
  message: string;
}

interface Props {
  asset: AssetDetails;
  schema?: object;
  isReadOnly?: boolean;
}

interface Emits {
  (e: 'update:overrides', overrides: Record<string, any>): void;
}

const props = withDefaults(defineProps<Props>(), {
  schema: () => ({}),
  isReadOnly: false,
});

const emit = defineEmits<Emits>();

const activeTab = ref<string>('settings');
const treeEditor = ref<any>(null);
const showValidationDialog = ref<boolean>(false);
const errorToFocus = ref<ValidationError | null>(null);

const sourceOverridesCode = computed((): string => 
  JSON.stringify(props.asset.unmerged.overrides || {}, null, 2)
);

const sourceDebugCode = computed((): string => 
  JSON.stringify(props.asset.unmerged, null, 2)
);

const formattedMergedProperties = computed((): string => {
  if (!props.asset.merged || !props.asset.merged.properties) return '{}';
  return JSON.stringify(props.asset.merged.properties, null, 2);
});

const validationErrors = computed((): ValidationError[] => {
  if (!props.schema || Object.keys(props.schema).length === 0) return [];
  const ajv = new Ajv({ allErrors: true });
  const validate = ajv.compile(props.schema);
  const valid = validate(props.asset.unmerged.overrides || {});
  if (!validate.errors) return [];

  return validate.errors.map(e => {
    let errorPath = (e as any).instancePath;
    if (errorPath === undefined && e.keyword === 'additionalProperties' && (e.params as any)?.additionalProperty) {
      errorPath = `/${(e.params as any).additionalProperty}`;
    }
    return { path: errorPath || '', message: e.message || 'Unknown error' };
  });
});

const validationStatus = computed((): string => {
  const count = validationErrors.value.length;
  if (count === 0) return 'Valid Schema';
  return `${count} Schema Issue${count > 1 ? 's' : ''}`;
});

let sourceChangeDebounce: ReturnType<typeof setTimeout> | null = null;
const handleSourceChange = (newSource: string): void => {
  if (sourceChangeDebounce) clearTimeout(sourceChangeDebounce);
  sourceChangeDebounce = setTimeout(() => {
    try {
      const newOverrides = JSON.parse(newSource);
      emit('update:overrides', newOverrides);
    } catch (e) {
      // Errors are handled by the validator, so we don't need to do anything here
    }
  }, 500);
};

const handleNavigateFromDialog = (error: ValidationError): void => {
  showValidationDialog.value = false;
  activeTab.value = 'tree';
  errorToFocus.value = error;
};

watch([activeTab, treeEditor], ([newTab, editorInstance]) => {
  if (newTab === 'tree' && editorInstance && errorToFocus.value) {
    if (typeof errorToFocus.value.path === 'string' && errorToFocus.value.path.length > 0) {
      const path = errorToFocus.value.path.substring(1).split('/');
      if (editorInstance.focusNode) {
        editorInstance.focusNode(path);
      }
    } else if (typeof errorToFocus.value.path === 'string') { // Root-level error
        if (editorInstance.focusNode) {
            editorInstance.focusNode([]);
        }
    }
    else {
      console.warn("Could not navigate to validation error because it has no path:", errorToFocus.value);
    }
    errorToFocus.value = null;
  }
});
</script>

<style scoped>
.inspector-window-content {
  position: relative;
  height: calc(100% - 36px);
  overflow: hidden;
}
.source-status-bar {
  border-top: 1px solid rgba(var(--v-border-color), 0.5);
  background-color: rgb(var(--custom-statusbar-background));
}
</style>








