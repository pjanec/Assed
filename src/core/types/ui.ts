// src/core/types/ui.ts

import type { DROP_TARGET_TYPES } from '../config/constants';
import type { DragPayload, DropTarget } from './drag-drop';

/**
 * A discriminated union for type-safe context menu contexts.
 * Each type explicitly defines the data required for its handler.
 */
export type ContextMenuKind =
  | { kind: 'root-actions' }
  | { kind: 'node-actions'; node: import('../types').AssetTreeNode }
  | { kind: 'drop-actions'; draggable: DragPayload; droppable: DropTarget };


/**
 * The structure for a single action item in the context menu.
 * The `execute` function is a thunk (a function without arguments)
 * that captures the necessary context when it's created.
 */
export interface ContextMenuAction {
  id: string;
  label: string;
  icon: string;
  divider?: boolean;
  disabled?: boolean;
  execute?: () => void;
  children?: ContextMenuAction[];
}

/**
 * A finite state machine (FSM) for the context menu's lifecycle.
 * This prevents impossible states (e.g., being both open and closed).
 */
export type MenuState =
  | { state: 'closed' }
  | { state: 'opening'; ctx: ContextMenuKind; x: number; y: number }
  | { state: 'open'; ctx: ContextMenuKind; x: number; y: number };

// Keep other UI-related types if they exist, or add them here.
export interface UiState {
  isRightPanelCollapsed: boolean;
  activeAssetId: string | null;
  // The new FSM state for the context menu
  contextMenu: MenuState;
}