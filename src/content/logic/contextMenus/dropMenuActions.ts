// src/content/logic/contextMenus/dropMenuActions.ts
import { inject } from 'vue';
import { useAssetsStore } from '@/core/stores/assets';
import { useWorkspaceStore } from '@/core/stores/workspace';
import { ContextMenuRegistryKey } from '@/core/registries/contextMenuRegistryKey';
import { useUiStore } from '@/core/stores/ui';
import type { ContextMenuAction, ContextMenuKind } from '@/core/types/ui';
import type { AssetTreeNode } from '@/core/types';
import { ASSET_TYPES } from '@/content/config/constants';
import { getAvailableActions } from '@/core/registries/interactionRegistry';
import { CONTEXT_MENU_KINDS, DIALOG_MODES, DROP_ACTION_IDS } from '@/core/config/constants';

export function useDropMenuActionsRegistration() {
  const registry = inject(ContextMenuRegistryKey);
  if (!registry) throw new Error('Registry not provided');

  const workspaceStore = useWorkspaceStore();
  const uiStore = useUiStore();

  const registerDropMenuActions = () => {
    // Use the new symbolic constant for the registry key
    registry.register(CONTEXT_MENU_KINDS.DROP_ACTIONS, (context: ContextMenuKind): ContextMenuAction[] => {
      if (context.kind !== CONTEXT_MENU_KINDS.DROP_ACTIONS) return [];
      
      const { draggable, droppable } = context;
      if (!draggable.assetId || !droppable.id) return [];

      // 1. Get the source of truth for actions from the interaction registry
      const availableDropActions = getAvailableActions(draggable.assetId, droppable);

      // 2. Convert the DropAction objects into ContextMenuAction objects
      const actions: ContextMenuAction[] = availableDropActions.map(action => ({
        id: action.id,
        label: action.label,
        icon: action.icon,
        execute: () => {
          // The logic is now unified: check the action's ID and execute
          if (action.id === DROP_ACTION_IDS.COPY || action.id === DROP_ACTION_IDS.DERIVE) {
            // These actions require a dialog, so we prompt for it
            uiStore.promptForCloneOrDerive(action.id, draggable.assetId, droppable);
          } else {
            // Other actions (like MOVE) can execute directly
            action.execute(draggable, droppable, workspaceStore);
          }
          uiStore.hideContextMenu();
        }
      }));

      return actions;
    });
  };

  return { registerDropMenuActions };
}
