import type { DROP_TARGET_TYPES } from "../config/constants";

/**
 * The payload attached to a draggable element. It contains all information
 * the system needs to understand the origin and context of the drag.
 */
export interface DragPayload {
  // The unique ID of the asset being dragged.
  assetId: string;
  // An opaque string identifier for the source component type (e.g., 'AssetTreeNode').
  sourceContext: string;
  // A unique ID for the specific component instance initiating the drag.
  instanceId?: string;
  // The ID of the parent asset if the item is being dragged from a nested context.
  parentAssetId?: string;
  // Allows for any other optional context to be added by components.
  [key: string]: any;
}

type DropTargetType = typeof DROP_TARGET_TYPES[keyof typeof DROP_TARGET_TYPES];

/**
 * Information about the element being dropped on.
 */
export interface DropTarget {
  // A unique ID for the target (e.g., an asset UUID or a static string like 'ROOT').
  id: string;
  // A semantic type for the target (e.g., 'asset', 'root').
  type: DropTargetType;
}