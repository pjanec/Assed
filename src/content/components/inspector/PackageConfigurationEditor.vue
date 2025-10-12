<template>
  <div class="package-config-editor pa-2 h-100">
    <!-- This component acts as a host for the specialized editors -->
    <!-- It will eventually contain the accordion with editors for -->
    <!-- Payload, FileDistrib, Resources, Scripts, etc. -->
    <!-- For now, we will use a generic JSONEditor as a placeholder -->
    <!-- until the specialized ones are built. -->
    <JSONEditor
      :model-value="modelValue"
      @update:modelValue="$emit('update:modelValue', $event)"
      :schema="schema"
      mode="tree"
    />
  </div>
</template>

<script setup>
import JSONEditor from './JSONEditor.vue';
import { schemas } from '@/content/schemas/packageSchema';
import { computed } from 'vue';

defineProps({
  modelValue: { type: Object, required: true },
});
defineEmits(['update:modelValue']);

// This component uses the main 'package' schema to validate its content.
// This is appropriate for both Package assets and the 'overrides' of Skeleton assets.
const schema = computed(() => schemas.value?.package || {});

</script>

<style scoped>
.package-config-editor {
  overflow-y: auto;
}
</style>








