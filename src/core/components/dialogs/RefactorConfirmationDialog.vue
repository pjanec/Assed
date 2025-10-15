<template>
  <v-dialog
    :model-value="modelValue"
    @update:model-value="emit('update:model-value', $event)"
    max-width="800px"
    persistent
  >
    <v-card>
      <v-card-title class="d-flex align-center">
        <v-icon class="me-2" color="primary">{{ mode === 'rename' ? 'mdi-form-textbox' : 'mdi-file-move' }}</v-icon>
        Confirm {{ mode === 'rename' ? 'Rename' : 'Move' }}
      </v-card-title>
      <v-card-text class="pt-4" style="max-height: 70vh; overflow-y: auto;">
        <div v-if="totalAffectedCount > 0">
          <p class="mb-4">
            {{ mode === 'rename' ? 'Renaming' : 'Moving' }} <strong>{{ consequences.oldFqn }}</strong> to <strong>{{ consequences.newFqn }}</strong> will affect the following <strong>{{ totalAffectedCount }}</strong> asset(s). Please review the changes.
          </p>
          <AffectedAssetsViewer
            v-if="fqnUpdatesForViewer.length > 0"
            title="FQN Updates"
            :changes="fqnUpdatesForViewer"
            class="mb-4"
          />
          <AffectedAssetsViewer
            v-if="templateLinkUpdatesForViewer.length > 0"
            title="Template Link Updates"
            :changes="templateLinkUpdatesForViewer"
          />
          <AffectedAssetsViewer
            v-if="linkedOverrideUpdatesForViewer.length > 0"
            title="Linked Override Updates"
            :changes="linkedOverrideUpdatesForViewer"
            class="mt-4"
          />
        </div>
        <div v-else>
           <p class="mb-4">
            You are {{ mode === 'rename' ? 'renaming' : 'moving' }} <strong>{{ consequences.oldAssetKey }}</strong> to <strong>{{ consequences.newAssetKey }}</strong>.
          </p>
          <v-alert
            type="success"
            variant="tonal"
            icon="mdi-shield-check-outline"
          >
            This is a safe {{ mode }}. No other assets in the project will be affected.
          </v-alert>
        </div>
      </v-card-text>
      <v-card-actions class="px-6 pb-4 pt-4">
        <v-spacer />
        <v-btn variant="text" @click="emit('update:model-value', false)">Cancel</v-btn>
        <v-btn color="primary" variant="elevated" @click="emit('confirm')">Confirm {{ mode === 'rename' ? 'Rename' : 'Move' }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue';
import AffectedAssetsViewer from './AffectedAssetsViewer.vue';
import { useAssetsStore } from '@/core/stores/index';

interface Consequences {
  oldFqn: string;
  newFqn: string;
  oldAssetKey: string;
  newAssetKey: string;
  fqnUpdates?: any[];
  templateLinkUpdates?: any[];
  linkedOverrideUpdates?: { assetId: string; oldAssetKey: string; newAssetKey: string; oldFqn: string; newFqn: string }[];
}

interface Props {
  modelValue: boolean;
  consequences: Consequences;
  mode: 'rename' | 'move';
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'update:model-value', value: boolean): void;
  (e: 'confirm'): void;
}>();

const assetsStore = useAssetsStore();

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

const fqnUpdatesForViewer = computed((): { oldState: any; newState: any }[] => {
  return (props.consequences.fqnUpdates || []).map((fqnUpdate: any) => {
    const asset = assetsStore.unmergedAssets.find(a => a.id === fqnUpdate.assetId);
    if (!asset) return null;
    return {
      oldState: { ...asset, fqn: fqnUpdate.oldFqn },
      newState: { ...asset, fqn: fqnUpdate.newFqn }
    };
  }).filter(item => item !== null);
});

const templateLinkUpdatesForViewer = computed((): { oldState: any; newState: any }[] => {
  return (props.consequences.templateLinkUpdates || []).map((templateUpdate: any) => {
    const asset = assetsStore.unmergedAssets.find(a => a.id === templateUpdate.assetId);
    if (!asset) return null;
    return {
      oldState: { ...asset, templateFqn: templateUpdate.oldTemplateFqn },
      newState: { ...asset, templateFqn: templateUpdate.newTemplateFqn }
    };
  }).filter(item => item !== null);
});

const linkedOverrideUpdatesForViewer = computed((): { oldState: any; newState: any }[] => {
  return (props.consequences.linkedOverrideUpdates || []).map((update: any) => {
    const asset = assetsStore.unmergedAssets.find(a => a.id === update.assetId);
    if (!asset) return null;
    return {
      oldState: { ...asset, assetKey: update.oldAssetKey, fqn: update.oldFqn },
      newState: { ...asset, assetKey: update.newAssetKey, fqn: update.newFqn }
    };
  }).filter(item => item !== null);
});

const totalAffectedCount = computed(() => {
  return fqnUpdatesForViewer.value.length + templateLinkUpdatesForViewer.value.length + linkedOverrideUpdatesForViewer.value.length;
});
</script>







