export const VIRTUAL_NODE_KINDS = {
  GENERIC_MERGED_VIEW: 'GENERIC_MERGED_VIEW',
  LOCKED_INFO: 'LOCKED_INFO',
} as const;

export type VirtualNodeKind = typeof VIRTUAL_NODE_KINDS[keyof typeof VIRTUAL_NODE_KINDS];


