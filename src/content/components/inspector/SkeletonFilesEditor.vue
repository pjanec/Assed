<template>
  <div class="skeleton-files-editor d-flex flex-column h-100">
    <!-- File Management Toolbar & List -->
    <div class="file-list-container" :style="{ height: `${fileListHeight}px` }">
      <v-toolbar density="compact" flat color="transparent">
        <v-toolbar-title class="text-caption font-weight-bold">FILES</v-toolbar-title>
        <v-spacer></v-spacer>
        <v-btn
          size="small"
          prepend-icon="mdi-plus"
          variant="tonal"
          @click="showAddDialog = true"
        >
          Add File
        </v-btn>
      </v-toolbar>
      <v-divider />
      <v-list density="compact" nav class="pa-0 file-list overflow-y-auto">
        <v-list-item
          v-for="(file, index) in localFiles"
          :key="index"
          :active="selectedFileIndex === index"
          @click="selectFile(index)"
        >
          <template #prepend>
            <v-icon size="small">mdi-file-code-outline</v-icon>
          </template>
          <v-list-item-title class="text-caption">{{ file.fileName }}</v-list-item-title>
          <template #append>
            <v-btn
              icon="mdi-delete-outline"
              size="x-small"
              variant="text"
              class="delete-btn"
              @click.stop="promptRemoveFile(index)"
            />
          </template>
        </v-list-item>
      </v-list>
    </div>

    <!-- Horizontal Resizer -->
    <div class="horizontal-resizer" @mousedown.prevent="startResize"></div>

    <!-- Inline Editor Pane -->
    <div class="inline-editor-container flex-1-1">
       <v-toolbar v-if="selectedFile" density="compact" flat color="transparent">
        <v-toolbar-title class="text-caption font-weight-bold text-medium-emphasis">
          EDITING: {{ selectedFile.fileName }}
        </v-toolbar-title>
        <v-spacer></v-spacer>
        <v-btn
          size="small"
          prepend-icon="mdi-open-in-new"
          variant="tonal"
          @click="showModalEditor = true"
        >
          Pop-out
        </v-btn>
      </v-toolbar>
      <div class="editor-wrapper">
        <MonacoEditor
          v-if="selectedFile"
          :key="selectedFile.fileName"
          :value="selectedFile.content"
          :language="fileLanguage"
          @change="onFileContentChange"
        />
        <div v-else class="d-flex align-center justify-center h-100 text-medium-emphasis text-caption">
          Select a file to view its content
        </div>
      </div>
    </div>

    <!-- Dialogs -->
    <v-dialog v-model="showAddDialog" max-width="400px" persistent>
      <v-card>
        <v-card-title>Add New File</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="newFileName"
            label="File Path"
            placeholder="e.g., tools/new-script.ps1"
            autofocus
            @keyup.enter="handleAddNewFile"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn text @click="cancelAddFile">Cancel</v-btn>
          <v-btn color="primary" @click="handleAddNewFile" :disabled="!newFileName">Add</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="showRemoveDialog" max-width="400px" persistent>
      <v-card>
        <v-card-title class="text-h6">Confirm Deletion</v-card-title>
        <v-card-text>
          Are you sure you want to delete <strong>{{ fileToRemove?.fileName }}</strong>?
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn text @click="cancelRemoveFile">Cancel</v-btn>
          <v-btn color="error" @click="handleRemoveFile">Delete</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="showModalEditor" fullscreen transition="dialog-bottom-transition">
       <v-card v-if="selectedFile">
        <v-toolbar color="primary" dark>
          <v-toolbar-title>Editing File: {{ selectedFile.fileName }}</v-toolbar-title>
          <v-spacer></v-spacer>
          <v-btn icon dark @click="showModalEditor = false"><v-icon>mdi-close</v-icon></v-btn>
        </v-toolbar>
        <div class="modal-editor-wrapper">
          <MonacoEditor
            :key="`modal-${selectedFile.fileName}`"
            :value="selectedFile.content"
            :language="fileLanguage"
            @change="onFileContentChange"
          />
        </div>
      </v-card>
    </v-dialog>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import MonacoEditor from './MonacoEditor.vue';

interface FileItem {
  fileName: string;
  content: string;
}

interface FileContent { 
  content: string; 
}

interface FileToRemove extends FileItem {
  index: number;
}

interface Props {
  files?: Record<string, FileContent>;
}

interface Emits {
  (e: 'update:files', files: Record<string, FileContent>): void;
}

const props = withDefaults(defineProps<Props>(), {
  files: () => ({}),
});
const emit = defineEmits<Emits>();

// Helper function to deep clone objects
function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

// Convert incoming dictionary to an array for the template
const localFiles = computed<FileItem[]>(() => {
  return Object.entries(props.files).map(([fileName, value]) => ({
    fileName,
    content: value.content
  }));
});

const selectedFileIndex = ref<number | null>(localFiles.value.length > 0 ? 0 : null);
const showAddDialog = ref<boolean>(false);
const newFileName = ref<string>('');
const showRemoveDialog = ref<boolean>(false);
const fileToRemove = ref<FileToRemove | null>(null);
const showModalEditor = ref<boolean>(false);
const fileListHeight = ref<number>(200);

watch(() => props.files, (newVal: Record<string, FileContent>) => {
  // Reset selectedFileIndex if the files change
  const newFilesArray = Object.entries(newVal).map(([fileName, value]) => ({
    fileName,
    content: value.content
  }));
  if (selectedFileIndex.value !== null && selectedFileIndex.value >= newFilesArray.length) {
    selectedFileIndex.value = newFilesArray.length > 0 ? 0 : null;
  }
}, { deep: true });

const selectedFile = computed((): FileItem | null => {
  return selectedFileIndex.value !== null ? localFiles.value[selectedFileIndex.value] : null;
});

const fileLanguage = computed((): string => {
  if (!selectedFile.value) return 'plaintext';
  const extension = selectedFile.value.fileName.split('.').pop();
  switch (extension) {
    case 'ps1': return 'powershell';
    case 'json': return 'json';
    case 'xml': return 'xml';
    case 'yml':
    case 'yaml': return 'yaml';
    default: return 'plaintext';
  }
});

const selectFile = (index: number): void => {
  selectedFileIndex.value = index;
};

const onFileContentChange = (newContent: string): void => {
  if (selectedFile.value && selectedFile.value.content !== newContent) {
    const updatedFiles = { ...props.files };
    updatedFiles[selectedFile.value.fileName] = { content: newContent };
    emit('update:files', updatedFiles);
  }
};

const handleAddNewFile = (): void => {
  if (!newFileName.value || Object.keys(props.files).includes(newFileName.value)) return;
  const updatedFiles = { ...props.files };
  updatedFiles[newFileName.value] = { content: '' };
  emit('update:files', updatedFiles);
  
  // Select the new file
  const newFilesArray = Object.entries(updatedFiles).map(([fileName, value]) => ({
    fileName,
    content: value.content
  }));
  selectedFileIndex.value = newFilesArray.length - 1;
  cancelAddFile();
};

const cancelAddFile = (): void => { 
  showAddDialog.value = false; 
  newFileName.value = ''; 
};

const promptRemoveFile = (index: number): void => {
  fileToRemove.value = { ...localFiles.value[index], index };
  showRemoveDialog.value = true;
};

const handleRemoveFile = (): void => {
  if (fileToRemove.value === null) return;
  const fileNameToRemove = fileToRemove.value.fileName;
  const updatedFiles = { ...props.files };
  delete updatedFiles[fileNameToRemove];
  emit('update:files', updatedFiles);

  // Update selected file index
  const newFilesArray = Object.entries(updatedFiles).map(([fileName, value]) => ({
    fileName,
    content: value.content
  }));
  
  if (selectedFileIndex.value === fileToRemove.value.index) {
    selectedFileIndex.value = newFilesArray.length > 0 ? 0 : null;
  } else if (selectedFileIndex.value !== null && selectedFileIndex.value > fileToRemove.value.index) {
    selectedFileIndex.value--;
  }
  cancelRemoveFile();
};

const cancelRemoveFile = (): void => { 
  showRemoveDialog.value = false; 
  fileToRemove.value = null; 
};

const startResize = (e: MouseEvent): void => {
  const startY = e.clientY;
  const startHeight = fileListHeight.value;
  
  const onMouseMove = (moveEvent: MouseEvent): void => {
    const newHeight = startHeight + (moveEvent.clientY - startY);
    fileListHeight.value = Math.max(100, Math.min(500, newHeight)); // Constrain height
  };
  
  const onMouseUp = (): void => {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  };
  
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
};

// Helper to avoid unnecessary updates
function isEqual(arr1: FileItem[], arr2: FileItem[]): boolean {
  if (arr1.length !== arr2.length) return false;
  for (let i = 0; i < arr1.length; i++) {
    if (arr1[i].fileName !== arr2[i].fileName || arr1[i].content !== arr2[i].content) {
      return false;
    }
  }
  return true;
}

</script>

<style scoped>
.skeleton-files-editor { overflow: hidden; }
.file-list-container {
  min-height: 100px;
  max-height: 500px;
  display: flex;
  flex-direction: column;
}
.file-list {
  flex-grow: 1;
}
.delete-btn {
  opacity: 0;
  transition: opacity 0.2s ease-in-out;
}
.v-list-item:hover .delete-btn {
  opacity: 1;
}
.horizontal-resizer {
  height: 5px;
  cursor: ns-resize;
  background-color: rgba(var(--v-border-color), 0.5);
  transition: background-color 0.2s;
}
.horizontal-resizer:hover {
  background-color: rgb(var(--v-theme-primary));
}
.inline-editor-container {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 100px;
}
.editor-wrapper {
  flex-grow: 1;
  position: relative;
}
.modal-editor-wrapper {
  height: calc(100vh - 64px); /* Fullscreen minus toolbar */
}
</style>







