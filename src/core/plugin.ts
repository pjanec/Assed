// src/core/plugin.ts
import type { App } from 'vue';
import { createContextMenuRegistry } from '@/core/registries/contextMenuRegistry';
import { ContextMenuRegistryKey } from '@/core/registries/contextMenuRegistryKey';
import type { AssetTreeNode } from '@/core/types';

export interface CorePluginOptions {
  isNodeInteractive?: (node: AssetTreeNode) => boolean;
}

export const CorePlugin = {
  install(app: App, options?: CorePluginOptions) {
    const registry = createContextMenuRegistry(options);
    app.provide(ContextMenuRegistryKey, registry);
  }
};