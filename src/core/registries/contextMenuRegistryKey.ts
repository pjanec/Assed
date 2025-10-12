// src/core/registries/contextMenuRegistryKey.ts
import type { InjectionKey } from 'vue';
import type { ContextMenuRegistry } from './contextMenuRegistry';

export const ContextMenuRegistryKey: InjectionKey<ContextMenuRegistry> = Symbol('ContextMenuRegistry');