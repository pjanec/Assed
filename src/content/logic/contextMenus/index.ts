// src/content/logic/contextMenus/index.ts
import { useContextMenuActionsRegistration } from './contextMenuActions';
import { useDropMenuActionsRegistration } from './dropMenuActions';

/**
 * Composable that provides all content-layer context menu registration functions.
 * Must be called from within a Vue component's setup function.
 */
export function useContentHandlersRegistration() {
  const { registerContextMenuActions } = useContextMenuActionsRegistration();
  const { registerDropMenuActions } = useDropMenuActionsRegistration();

  const registerAllContentHandlers = () => {
    registerContextMenuActions();
    registerDropMenuActions();
  };

  return { registerAllContentHandlers, registerContextMenuActions, registerDropMenuActions };
}

// Re-export individual composables for flexibility
export { useContextMenuActionsRegistration, useDropMenuActionsRegistration };