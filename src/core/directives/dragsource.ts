import { useUiStore } from '@/core/stores/ui';
import type { DragPayload, DropTarget } from '@/core/types/drag-drop';
import type { Directive, ComponentPublicInstance } from 'vue';

// The directive now expects the full DragPayload and an optional disabled flag
export const vDragsource: Directive<HTMLElement, DragPayload & { disabled?: boolean }> = {
  mounted(el, binding) {
    const componentInstance = (binding.instance as ComponentPublicInstance);
    const sourceInfo = binding.value;
    if (sourceInfo.disabled) {
      el.removeAttribute('draggable');
      return;
    }

    el.setAttribute('draggable', 'true');

    const handleDragStart = (event: DragEvent) => {
      const uiStore = useUiStore();
      const sourceInfo = binding.value;
      
      if (sourceInfo.instanceId && componentInstance) {
        uiStore.registerDragInstance(sourceInfo.instanceId, componentInstance);
      }
      uiStore.startDrag(sourceInfo);
      el.classList.add('is-dragging');
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'all';
        event.dataTransfer.setData('text/plain', sourceInfo.assetId);
      }
    };

    const handleDragEnd = () => {
      const uiStore = useUiStore();
      const sourceInfo = binding.value;
      if (sourceInfo.instanceId) {
        uiStore.unregisterDragInstance(sourceInfo.instanceId);
      }
      setTimeout(() => {
        if (!uiStore.isDropMenuPending && !uiStore.isDialogPending) {
          uiStore.clearDragState();
        }
      }, 0);
      el.classList.remove('is-dragging');
    };

    el.addEventListener('dragstart', handleDragStart);
    el.addEventListener('dragend', handleDragEnd);

    (el as any)._dragsourceHandlers = { handleDragStart, handleDragEnd };
  },

  unmounted(el) {
    const handlers = (el as any)._dragsourceHandlers;
    if (handlers) {
      el.removeEventListener('dragstart', handlers.handleDragStart);
      el.removeEventListener('dragend', handlers.handleDragEnd);
    }
  }
};








