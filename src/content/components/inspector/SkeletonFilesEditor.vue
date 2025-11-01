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
          :disabled="isReadOnly"
        >
          Add File
        </v-btn>
      </v-toolbar>
      <v-divider />
      <v-list density="compact" nav class="pa-0 file-list overflow-y-auto">
        <v-list-item
          v-for="(file, index) in files"
          :key="file.key"
          :active="selectedFileIndex === index"
          @click="selectFile(index)"
        >
          <template #prepend>
            <v-icon size="small">mdi-file-code-outline</v-icon>
          </template>
          <v-list-item-title class="text-caption">
            {{ file.key }}
            <span v-if="file.isInherited" class="text-caption text-medium-emphasis ms-1">(inherited)</span>
          </v-list-item-title>
          <template #append>
            <v-btn
              v-if="!file.isInherited"
              icon="mdi-delete-outline"
              size="x-small"
              variant="text"
              class="delete-btn"
              @click.stop="promptRemoveFile(index)"
              :disabled="isReadOnly"
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
          EDITING: {{ selectedFile.key }}
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
          :key="selectedFile.key"
          :value="selectedFile.value.content"
          :language="fileLanguage"
          @change="onFileContentChange"
          :readOnly="isReadOnly"
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
          Are you sure you want to delete <strong>{{ fileToRemove?.key }}</strong>?
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
            :key="`modal-${selectedFile.key}`"
            :value="selectedFile.value.content"
            :language="fileLanguage"
            @change="onFileContentChange"
            :readOnly="isReadOnly"
          />
        </div>
      </v-card>
    </v-dialog>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, toRef } from 'vue';
import { cloneDeep } from 'lodash-es';
import type { AssetDetails } from '@/core/types';
import { useWorkspaceStore, UpdateAssetCommand } from '@/core/stores/workspace';
import MonacoEditor from './MonacoEditor.vue';
import { useEditableCollection } from '@/core/composables/useEditableCollection';

interface FileToRemove {
  key: string;
  value: any;
  isInherited?: boolean;
  index: number;
}

interface Props {
  asset: AssetDetails;
  isReadOnly?: boolean;
}

const props = defineProps<Props>();
const workspaceStore = useWorkspaceStore();

const assetRef = toRef(props, 'asset');

const onUpdateOverrides = (newOverrides: Record<string, any>) => {
  if (props.isReadOnly) return;
  const oldData = props.asset.unmerged;
  const newData = cloneDeep(oldData);
  newData.overrides = newOverrides;
  const cmd = new UpdateAssetCommand(oldData.id, oldData, newData);
  workspaceStore.executeCommand(cmd);
};

const {
  collectionAsArray: files,
  collectionAsObject: filesObj,
  addItem,
  removeItem,
  updateItemProperty
} = useEditableCollection(assetRef as any, 'Files', onUpdateOverrides);

const selectedFileIndex = ref<number | null>(files.value.length > 0 ? 0 : null);
const showAddDialog = ref<boolean>(false);
const newFileName = ref<string>('');
const showRemoveDialog = ref<boolean>(false);
const fileToRemove = ref<FileToRemove | null>(null);
const showModalEditor = ref<boolean>(false);
const fileListHeight = ref<number>(200);

watch(files, (newFilesArray) => {
  // Reset selectedFileIndex if the files change
  if (selectedFileIndex.value !== null && selectedFileIndex.value >= newFilesArray.length) {
    selectedFileIndex.value = newFilesArray.length > 0 ? 0 : null;
  }
});

const selectedFile = computed((): any | null => {
  return selectedFileIndex.value !== null ? files.value[selectedFileIndex.value] : null;
});

const fileLanguage = computed((): string => {
  if (!selectedFile.value) return 'plaintext';
  const extension = selectedFile.value.key.split('.').pop();
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
  if (props.isReadOnly || !selectedFile.value) return;
  updateItemProperty(selectedFile.value.key, 'content', newContent);
};

const handleAddNewFile = (): void => {
  if (props.isReadOnly || !newFileName.value) return;
  if (filesObj.value[newFileName.value]) {
    cancelAddFile();
    return;
  }
  addItem(newFileName.value, { content: '' });
  setTimeout(() => {
    const index = files.value.findIndex(f => f.key === newFileName.value);
    if (index !== -1) selectedFileIndex.value = index;
  }, 0);
  cancelAddFile();
};

const cancelAddFile = (): void => { 
  showAddDialog.value = false; 
  newFileName.value = ''; 
};

const promptRemoveFile = (index: number): void => {
  fileToRemove.value = { ...files.value[index], index } as any;
  showRemoveDialog.value = true;
};

const handleRemoveFile = (): void => {
  if (props.isReadOnly || fileToRemove.value === null) return;
  const fileNameToRemove = fileToRemove.value.key;
  if (fileToRemove.value.isInherited) {
    cancelRemoveFile();
    return;
  }
  removeItem(fileNameToRemove);
  setTimeout(() => {
    const filesArray = files.value;
    if (selectedFileIndex.value !== null && selectedFileIndex.value >= filesArray.length) {
      selectedFileIndex.value = filesArray.length > 0 ? 0 : null;
    } else if (selectedFileIndex.value !== null && fileToRemove.value !== null && selectedFileIndex.value > fileToRemove.value.index) {
      selectedFileIndex.value--;
    }
  }, 0);
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







