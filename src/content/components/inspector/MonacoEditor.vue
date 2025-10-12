<template>
  <div ref="editorContainer" class="monaco-editor-container"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import * as monaco from 'monaco-editor'
import loader from '@monaco-editor/loader'

// Types
interface EditorOptions {
  automaticLayout?: boolean;
  fontSize?: number;
  tabSize?: number;
  insertSpaces?: boolean;
  wordWrap?: string;
  minimap?: { enabled: boolean };
  scrollBeyondLastLine?: boolean;
  renderLineHighlight?: string;
  selectionHighlight?: boolean;
  contextmenu?: boolean;
  lineNumbers?: string;
  glyphMargin?: boolean;
  folding?: boolean;
  lineDecorationsWidth?: number;
  lineNumbersMinChars?: number;
  scrollbar?: any;
  fixedOverflowWidgets?: boolean;
  readOnly?: boolean;
  value?: string;
  language?: string;
  theme?: string;
}

interface Props {
  value?: string;
  language?: string;
  theme?: string;
  options?: EditorOptions;
  readOnly?: boolean;
}

interface Emits {
  (e: 'change', value: string): void;
  (e: 'focus'): void;
  (e: 'blur'): void;
  (e: 'ready', editor: any): void;
}

// Props
const props = withDefaults(defineProps<Props>(), {
  value: '',
  language: 'json',
  theme: 'vs',
  options: () => ({}),
  readOnly: false
});

// Emits
const emit = defineEmits<Emits>();

// Refs
const editorContainer = ref<HTMLDivElement | null>(null)
let editor: any = null
let isUpdatingFromProps = false

// Default options
const defaultOptions: any = {
  automaticLayout: true,
  fontSize: 14,
  tabSize: 2,
  insertSpaces: true,
  wordWrap: 'on',
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  renderLineHighlight: 'line',
  selectionHighlight: false,
  contextmenu: true,
  lineNumbers: 'on',
  glyphMargin: false,
  folding: true,
  lineDecorationsWidth: 0,
  lineNumbersMinChars: 3,
  scrollbar: {
    vertical: 'visible',
    horizontal: 'visible', 
    useShadows: false,
    verticalScrollbarSize: 14,
    horizontalScrollbarSize: 14,
    verticalHasArrows: false,
    horizontalHasArrows: false,
    handleMouseWheel: true,
    alwaysConsumeMouseWheel: false
  },
  fixedOverflowWidgets: true
}

// Lifecycle
onMounted(() => {
  initEditor()
})

onUnmounted(() => {
  if (editor) {
    // Clean up resize observer
    if (editor._resizeObserver) {
      editor._resizeObserver.disconnect()
    }
    
    editor.dispose()
    editor = null
  }
})

// Watchers
watch(() => props.value, (newValue: string | undefined) => {
  if (editor && !isUpdatingFromProps) {
    const currentValue = editor.getValue()
    if (currentValue !== newValue) {
      editor.setValue(newValue || '')
    }
  }
})

watch(() => props.language, (newLanguage: string) => {
  if (editor) {
    const model = editor.getModel()
    if (model) {
      monaco.editor.setModelLanguage(model, newLanguage)
    }
  }
})

watch(() => props.theme, (newTheme: string) => {
  if (editor) {
    monaco.editor.setTheme(newTheme)
  }
})

watch(() => props.readOnly, (newReadOnly: boolean) => {
  if (editor) {
    editor.updateOptions({ readOnly: newReadOnly })
  }
})

watch(() => props.options, (newOptions: EditorOptions) => {
  if (editor) {
    editor.updateOptions(newOptions)
  }
}, { deep: true })

// Methods
async function initEditor(): Promise<void> {
  await nextTick()
  
  if (!editorContainer.value) {
    console.error('Monaco editor container not found')
    return
  }

  try {
    // Set Monaco loader configuration
    loader.config({ 
      paths: { 
        vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs' 
      } 
    })

    // Load Monaco editor
    const monacoInstance = await loader.init()
    
    // Merge options
    const options = {
      ...defaultOptions,
      ...props.options,
      value: props.value || '',
      language: props.language,
      theme: props.theme,
      readOnly: props.readOnly
    }

    // Create editor instance
    editor = monacoInstance.editor.create(editorContainer.value, options)

    // Set up event listeners
    setupEventListeners()

    // Configure JSON language features if language is JSON
    if (props.language === 'json') {
      setupJsonFeatures(monacoInstance)
    }

    emit('ready', editor)

  } catch (error) {
    console.error('Error initializing Monaco editor:', error)
  }
}

function setupEventListeners(): void {
  if (!editor) return

  // Content change
  editor.onDidChangeModelContent(() => {
    if (!isUpdatingFromProps) {
      const value = editor.getValue()
      emit('change', value)
    }
  })

  // Focus/blur events
  editor.onDidFocusEditorText(() => {
    emit('focus')
  })

  editor.onDidBlurEditorText(() => {
    emit('blur')
  })

  // Handle editor resize with improved throttling
  let resizeTimeout: ReturnType<typeof setTimeout> | null = null;
  let lastWidth = 0
  let lastHeight = 0
  
  const resizeObserver = new ResizeObserver((entries) => {
    if (editor && editorContainer.value && entries.length > 0) {
      const { width, height } = entries[0].contentRect
      
      // Only resize if dimensions actually changed significantly
      if (Math.abs(width - lastWidth) > 5 || Math.abs(height - lastHeight) > 5) {
        lastWidth = width
        lastHeight = height
        
        // Clear previous timeout
        if (resizeTimeout) {
          clearTimeout(resizeTimeout)
        }
        
        // Debounce the layout call with longer delay
        resizeTimeout = setTimeout(() => {
          if (editor && editor.getModel()) {
            editor.layout({ width: Math.floor(width), height: Math.floor(height) })
          }
        }, 150)
      }
    }
  })

  if (editorContainer.value) {
    resizeObserver.observe(editorContainer.value)
  }
  
  // Store the observer for cleanup
  editor._resizeObserver = resizeObserver
}

function setupJsonFeatures(monacoInstance: any): void {
  // Configure JSON language settings
  monacoInstance.languages.json.jsonDefaults.setDiagnosticsOptions({
    validate: true,
    allowComments: false,
    schemas: [],
    enableSchemaRequest: false
  })

  // Add JSON formatting command
  editor.addCommand(
    monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyF,
    () => {
      editor.trigger('format', 'editor.action.formatDocument', {})
    }
  )
}

// Public methods
function getValue(): string {
  return editor?.getValue() || ''
}

function setValue(value: string): void {
  if (editor) {
    isUpdatingFromProps = true
    editor.setValue(value || '')
    setTimeout(() => {
      isUpdatingFromProps = false
    }, 10)
  }
}

function focus(): void {
  editor?.focus()
}

function getSelection(): any {
  return editor?.getSelection()
}

function setSelection(selection: any): void {
  if (editor && selection) {
    editor.setSelection(selection)
  }
}

function insertText(text: string, position?: any): void {
  if (editor) {
    const pos = position || editor.getPosition()
    editor.executeEdits('insert-text', [{
      range: new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column),
      text: text
    }])
  }
}

function formatDocument(): void {
  if (editor) {
    editor.trigger('format', 'editor.action.formatDocument', {})
  }
}

// Expose methods
defineExpose({
  getValue,
  setValue,
  focus,
  getSelection,
  setSelection,
  insertText,
  formatDocument,
  getEditor: () => editor
})

</script>

<style scoped>
.monaco-editor-container {
  width: 100%;
  height: 100%;
  min-height: 200px;
}

/* Custom scrollbar styling to match Vuetify theme */
:deep(.monaco-scrollable-element > .scrollbar) {
  background-color: rgba(var(--v-theme-on-surface), 0.05);
}

:deep(.monaco-scrollable-element > .scrollbar > .slider) {
  background-color: rgba(var(--v-theme-on-surface), 0.2);
}

:deep(.monaco-scrollable-element > .scrollbar > .slider:hover) {
  background-color: rgba(var(--v-theme-on-surface), 0.3);
}

/* Ensure proper theming */
:deep(.monaco-editor) {
  --vscode-editor-background: rgb(var(--v-theme-surface));
  --vscode-editor-foreground: rgb(var(--v-theme-on-surface));
}
</style>







