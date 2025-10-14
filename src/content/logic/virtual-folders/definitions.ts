import type { UnmergedAsset, AssetTreeNode, VirtualNodeKind, ViewHint } from '@/core/types';
import type { DragPayload, DropTarget } from '@/core/types/drag-drop';
import type { DropAction } from '@/core/registries/interactionRegistry';
import type { ContextMenuAction } from '@/core/types/ui';
import { resolveMergedRequirements } from './resolvers';
import { VIEW_HINTS } from '@/core/config/constants';

// 1. Define the kinds as a constant object for type safety
export const VIRTUAL_NODE_KINDS = {
  MERGED_REQUIREMENTS: 'MERGED_REQUIREMENTS',
  LOCKED_INFO: 'LOCKED_INFO',
} as const;

// 2. Define the Virtual Folder "Blueprint" interface
export interface VirtualFolderDefinition {
  name: string;
  icon: string;
  resolveChildren: (sourceAsset: UnmergedAsset, allAssets: UnmergedAsset[]) => { nodes: AssetTreeNode[], dependencies: { direct: Set<string>, structural: Set<string> } };
  getDropActions?: (dragPayload: DragPayload, dropTarget: DropTarget) => DropAction[];
  getContextMenuActions?: (virtualNode: AssetTreeNode) => ContextMenuAction[];
  defaultViewHint?: ViewHint;
}

// 3. Create the registry of definitions
export const virtualFolderDefinitions: Record<VirtualNodeKind, VirtualFolderDefinition> = {
  [VIRTUAL_NODE_KINDS.MERGED_REQUIREMENTS]: {
    name: 'Merged Requirements',
    icon: 'mdi-playlist-check',
    resolveChildren: resolveMergedRequirements,
    defaultViewHint: VIEW_HINTS.MERGED,
    // No override hooks means this folder will use the default "proxy" behavior
  },

  [VIRTUAL_NODE_KINDS.LOCKED_INFO]: {
    name: 'Locked Info (Read-Only)',
    icon: 'mdi-information-off-outline',
    resolveChildren: () => ({ // A simple resolver for the example
      nodes: [{ id: 'locked-child-1', name: 'This is a read-only item.', path: '', type: 'asset', children: [] }],
      dependencies: { direct: new Set(), structural: new Set() }
    }),
    // Override hooks to disable all interactions
    getDropActions: () => [],
    getContextMenuActions: () => [],
  },
};