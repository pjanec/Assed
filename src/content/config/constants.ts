// Business domain constants - these define the asset types for this specific application

export const ASSET_TYPES = {
  ROOT: 'Root',
  NAMESPACE_FOLDER: 'NamespaceFolder',
  ENVIRONMENT: 'Environment',
  NODE: 'Node',
  PACKAGE: 'Package',
  OPTION: 'Option',
} as const;

// Defines drag source contexts originating from the Content application layer.
export const CONTENT_DRAG_CONTEXTS = {
  NODE_CARD: 'NodeCard',
} as const;

// Content-specific virtual node kinds (business-level kinds)
export const CONTENT_VIRTUAL_NODE_KINDS = {
  MERGED_REQUIREMENTS: 'MERGED_REQUIREMENTS',
} as const;











