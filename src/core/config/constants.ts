export const DIALOG_MODES = { COPY: 'copy', DERIVE: 'derive' } as const;

export const DROP_TARGET_TYPES = { ASSET: 'asset', ROOT: 'root' } as const;

export const CORE_DRAG_CONTEXTS = { ASSET_TREE_NODE: 'AssetTreeNode' } as const;

export const DROP_ACTION_IDS = {
  MOVE: 'move',
  COPY: 'copy',
  DERIVE: 'derive',
  DERIVE_ON_NODE: 'derive-on-node',
} as const;

export const REFACTOR_MODES = {
  RENAME: 'rename',
  MOVE: 'move',
} as const;

/** A well-known, static ID for the virtual root node and drop zone. */
export const ROOT_ID = 'ROOT';

export const CONTEXT_MENU_KINDS = {
  ROOT_ACTIONS: 'root-actions',
  NODE_ACTIONS: 'node-actions',
  DROP_ACTIONS: 'drop-actions',
} as const;

export const ASSET_TREE_NODE_TYPES = {
  ASSET: 'asset',
  FOLDER: 'folder',
  FILE_GROUP: 'file-group',
  NAMESPACE: 'namespace',
} as const;

// Generic UI view hints used by presenter logic
export const VIEW_HINTS = {
  DEFAULT: 'default',
  MERGED: 'merged',
} as const;

// Core-level virtual node kinds (mechanisms, not business kinds)
export const VIRTUAL_NODE_KINDS = {
  SYNTHETIC_ASSET: 'SYNTHETIC_ASSET',
} as const;