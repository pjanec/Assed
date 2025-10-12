// src/core/registries/contextMenuRegistry.ts
import type { ContextMenuAction, ContextMenuKind } from '../types/ui';
import type { AssetTreeNode } from '../types';
import type { CorePluginOptions } from '../plugin';

export type ContextMenuHandler = (context: ContextMenuKind) => ContextMenuAction[];

export interface ContextMenuRegistry {
  register: (contextKind: ContextMenuKind['kind'], handler: ContextMenuHandler) => void;
  isNodeInteractive: (node: AssetTreeNode) => boolean;
  getContextMenuActionsForContext: (context: ContextMenuKind) => ContextMenuAction[];
}

export function createContextMenuRegistry(options?: CorePluginOptions): ContextMenuRegistry {
  const handlers = new Map<ContextMenuKind['kind'], ContextMenuHandler>();
  const _isNodeInteractive = options?.isNodeInteractive ?? (() => false);

  const register = (contextKind: ContextMenuKind['kind'], handler: ContextMenuHandler) => {
    handlers.set(contextKind, handler);
  };

  const isNodeInteractive = (node: AssetTreeNode): boolean => {
    return _isNodeInteractive(node);
  };

  const getContextMenuActionsForContext = (context: ContextMenuKind): ContextMenuAction[] => {
    const handler = handlers.get(context.kind);
    // TypeScript knows `context` will be the correct type for the handler.
    return handler ? handler(context) : [];
  };

  return {
    register,
    isNodeInteractive,
    getContextMenuActionsForContext,
  };
}







