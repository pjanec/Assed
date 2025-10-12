<template>
  <div ref="editorContainer" class="json-editor-container"></div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue';
import JSONEditor from 'jsoneditor';
import 'jsoneditor/dist/jsoneditor.css';

// Props
const props = defineProps({
  modelValue: {
    type: [Object, Array],
    default: () => ({})
  },
  schema: {
    type: Object,
    default: () => ({})
  },
  mode: {
    type: String,
    default: 'tree' // 'tree', 'view', 'form', 'code', 'text'
  },
  options: {
    type: Object,
    default: () => ({})
  }
});

// Emits
const emit = defineEmits(['update:modelValue', 'error']);

// Refs
const editorContainer = ref(null);
let editor = null;
let isUpdatingFromProps = false;

// Default options
const defaultOptions = {
  mode: props.mode,
  modes: ['tree', 'view', 'form', 'code', 'text'],
  search: true,
  indentation: 2,
  sortObjectKeys: false,
  navigationBar: false,
  statusBar: false,
  mainMenuBar: false,
  enableSort: true,
  enableTransform: false,
  onChange: handleChange,
  onError: handleError,
  onModeChange: handleModeChange
};

// Lifecycle
onMounted(() => {
  initEditor();
});

onUnmounted(() => {
  if (editor) {
    editor.destroy();
    editor = null;
  }
});

// Watchers
watch(() => props.modelValue, (newValue) => {
  if (editor && !isUpdatingFromProps) {
    try {
      // Avoid re-setting if the content is identical
      if (JSON.stringify(editor.get()) !== JSON.stringify(newValue)) {
        editor.set(newValue || {});
      }
    } catch (error) {
      console.error('Error setting JSON editor value:', error);
    }
  }
}, { deep: true });

watch(() => props.schema, (newSchema) => {
  if (editor) {
    editor.setSchema(newSchema);
  }
}, { deep: true });

watch(() => props.mode, (newMode) => {
  if (editor && editor.getMode() !== newMode) {
    try {
      editor.setMode(newMode);
    } catch (error) {
      console.error('Error changing JSON editor mode:', error);
    }
  }
});

// Methods
async function initEditor() {
  await nextTick();
  
  if (!editorContainer.value) {
    console.error('Editor container not found');
    return;
  }

  try {
    const options = {
      ...defaultOptions,
      ...props.options
    };

    if (props.schema && Object.keys(props.schema).length > 0) {
      options.schema = props.schema;
    }

    editor = new JSONEditor(editorContainer.value, options);
    editor.set(props.modelValue || {});

  } catch (error) {
    console.error('Error initializing JSON editor:', error);
    emit('error', error);
  }
}

function handleChange() {
  if (!editor) return;
  
  try {
    isUpdatingFromProps = true;
    const value = editor.get();
    emit('update:modelValue', value);
  } catch (error) {
    // Suppress errors during typing in code mode
    if (!(editor.getMode() === 'code' || editor.getMode() === 'text')) {
      console.error('Error getting JSON editor value:', error);
      emit('error', error);
    }
  } finally {
    nextTick(() => {
      isUpdatingFromProps = false;
    });
  }
}

function handleError(error) {
  // We only emit structural/schema errors, not parse errors during typing
  if (editor && editor.getMode() !== 'code' && editor.getMode() !== 'text') {
    console.error('JSON Editor error:', error);
    emit('error', error);
  }
}

function handleModeChange(newMode, oldMode) {
  console.log('JSON Editor mode changed:', oldMode, '->', newMode);
}

function focusNode(path) {
  if (editor && editor.node) {
      const node = editor.node.findNodeByPath(path);
      if (node) {
          editor.scrollTo(node.dom.value, () => {
              node.focus();
          });
      }
  }
}


// Expose methods for parent component
defineExpose({
  get: () => editor?.get(),
  set: (value) => editor?.set(value),
  focusNode
});
</script>

<style scoped>
.json-editor-container {
  width: 100%;
  height: 100%;
  min-height: 200px;
}
:deep(.jsoneditor) {
  border: none;
}
:deep(.jsoneditor-menu) {
  background-color: rgb(var(--v-theme-surface-variant));
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
:deep(.jsoneditor-tree) {
  background-color: rgb(var(--v-theme-surface));
}
:deep(.jsoneditor-field),
:deep(.jsoneditor-value) {
  color: rgb(var(--v-theme-on-surface)) !important;
}
</style>








