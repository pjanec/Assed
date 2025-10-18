import { ref, onUnmounted, type Ref } from 'vue';
import { useUiStore } from '@/core/stores/ui';
import { useWorkspaceStore } from '@/core/stores/workspace';
import { getAvailableActions, getDropValidation } from '@/core/registries/interactionRegistry';
import type { DragPayload, DropTarget } from '@/core/types/drag-drop';
import { useAssetsStore } from '@/core/stores/assets';
import { DROP_ACTION_IDS } from '../config/constants';
import { CONTEXT_MENU_KINDS } from '@/core/config/constants';

/**
 * A Vue Composable for handling drop events on an element.
 *
 * @param dropTargetInfo - A reactive ref or object containing the type and id of the drop target.
 * @returns Reactive state and event handlers to be bound to a template element.
 */
export function useDroppable(dropTargetInfo: DropTarget) {
  const uiStore = useUiStore();
  const assetsStore = useAssetsStore();
  const workspaceStore = useWorkspaceStore();
  
  // A reactive flag to indicate if a valid draggable is hovering over this target.
  const isDraggingOver = ref(false);

  // Checks if the currently dragged asset can be dropped here.
  const canDropHere = (): boolean => {
    const { draggedAssetId } = uiStore;
    if (!draggedAssetId) return false;
    const actions = getAvailableActions(draggedAssetId, dropTargetInfo);
    return actions.length > 0;
  };

  // --- EVENT HANDLERS ---

  const handleDragOver = (event: DragEvent) => {
    event.stopPropagation();
    uiStore.setCursorPosition(event.clientX, event.clientY);
    const { draggedAssetId } = uiStore;
    if (!draggedAssetId) return;
      
    const validationResult = getDropValidation(draggedAssetId, dropTargetInfo);

    // Always clear any previous reason at the start of evaluation.
    uiStore.setDragInvalidationReason(null);

    if (validationResult.isValid) {
      // The drop is valid. Allow it and show the highlight.
      event.preventDefault();   
      isDraggingOver.value = true;
    } else {
      // The drop is invalid.
      isDraggingOver.value = false; // Do not show any highlight.
        
      // IMPORTANT: Only set the invalidation reason if the rule provided one.
      // If `reason` is undefined, the tooltip will not appear.
      if (validationResult.reason) {
        uiStore.setDragInvalidationReason(validationResult.reason);
      }
        
      // By NOT calling event.preventDefault(), the browser will show the "blocked" cursor.
    }
  };

  const handleDragLeave = () => {
    isDraggingOver.value = false;
    uiStore.setDragInvalidationReason(null);
  };

  const handleDrop = (event: DragEvent) => {
    event.stopPropagation();
    event.preventDefault();
    isDraggingOver.value = false;
    uiStore.setDragInvalidationReason(null);
    
    const { dragSourceInfo } = uiStore;
    if (!dragSourceInfo) return;

    const availableActions = getAvailableActions(dragSourceInfo.assetId, dropTargetInfo);

    const targetAsset = assetsStore.unmergedAssets.find(a => a.id === dropTargetInfo.id);
    console.log(`[DEBUG 3] Drop Event: Dropped on Target ID = ${dropTargetInfo.id}, Target FQN = ${targetAsset?.fqn || 'N/A (Root)'}`);
    console.log(`[DEBUG 3.1] Found ${availableActions.length} available actions.`);

    if (availableActions.length === 0) {
      console.log(`[DEBUG 4] Action: No valid action. Clearing drag state.`);
      uiStore.clearDragState();
    } else if (availableActions.length === 1) {
      const action = availableActions[0];
      console.log(`[DEBUG 4] Action: Exactly one action found ('${action.id}'). Executing immediately.`);
      
      action.execute(dragSourceInfo, dropTargetInfo, workspaceStore);

      // Only clear state for actions that DON'T open a dialog.
      // The dialog itself is now responsible for cleanup on cancel/submit.
      if (!action.opensDialog) {
        uiStore.clearDragState();
      }
    } else {
      console.log(`[DEBUG 4] Action: Multiple actions found. Showing context menu.`);
      uiStore.showContextMenu({
        x: event.clientX,
        y: event.clientY,
        ctx: {
          kind: CONTEXT_MENU_KINDS.DROP_ACTIONS,
          draggable: dragSourceInfo,
          droppable: dropTargetInfo,
        },
      });
    }
  };

  return {
    isDraggingOver,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  };
}







