import type { InteractionRule } from '@/core/registries/interactionRegistry';
import type { PerspectiveName } from '@/core/types';

export interface InteractionRuleEntry {
  draggedType: string;
  targetType: string;
  perspectives?: PerspectiveName[]; // Optional - if omitted, applies to all perspectives
  rule: InteractionRule;
}

export const mockMasterInteractionRegistry: InteractionRuleEntry[] = [
  {
    draggedType: 'Widget',
    targetType: 'Container',
    perspectives: ['default', 'distro'],
    rule: {
      actions: [{
        id: 'move-widget',
        label: 'Move Widget',
        icon: 'mdi-arrow-right',
        cursor: 'move',
        execute: () => {}
      }]
    }
  },
  {
    draggedType: 'Aggregator',
    targetType: 'Container',
    perspectives: ['default', 'package'],
    rule: {
      actions: [{
        id: 'add-aggregator',
        label: 'Add Aggregator',
        icon: 'mdi-plus',
        cursor: 'copy',
        execute: () => {}
      }]
    }
  },
  {
    draggedType: 'Container',
    targetType: 'Container',
    perspectives: ['default', 'lab'],
    rule: {
      actions: [{
        id: 'nest-container',
        label: 'Nest Container',
        icon: 'mdi-folder-move',
        cursor: 'move',
        execute: () => {}
      }]
    }
  },
  {
    draggedType: 'Widget',
    targetType: 'Widget',
    perspectives: ['default', 'distro', 'package'],
    rule: {
      actions: [{
        id: 'link-widgets',
        label: 'Link Widgets',
        icon: 'mdi-link',
        cursor: 'link',
        execute: () => {}
      }]
    }
  }
];

