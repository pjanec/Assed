// src/content/logic/contextMenus/contextMenuActions.ts
import { inject } from 'vue';
import { useAssetsStore } from '@/core/stores/assets';
import { useWorkspaceStore } from '@/core/stores/workspace';
import { ContextMenuRegistryKey } from '@/core/registries/contextMenuRegistryKey';
import { useUiStore } from '@/core/stores/ui';
import type { ContextMenuAction, ContextMenuKind } from '@/core/types/ui';
import type { AssetTreeNode, Asset } from '@/core/types';
import { getValidChildrenForFolder, getValidChildTypes, getEffectiveRegistry, isStructuralFolder } from '@/content/config/assetRegistry';
import { ASSET_TYPES } from '@/content/config/constants';
import { ROOT_ID } from '@/core/config/constants';
import { createTreeNodeFromAssetId } from '@/core/utils/assetTreeUtils';
import { virtualFolderDefinitions } from '@/content/logic/virtual-folders/definitions';

export function useContextMenuActionsRegistration() {
  const registry = inject(ContextMenuRegistryKey);
  if (!registry) throw new Error('Registry not provided');

  const assetsStore = useAssetsStore();
  const workspaceStore = useWorkspaceStore();
  const uiStore = useUiStore();

  const registerContextMenuActions = () => {

  // Handler for right-clicking the tree background
  registry.register('root-actions', (context: ContextMenuKind): ContextMenuAction[] => {
    if (context.kind !== 'root-actions') return [];
    
    // Create a virtual root node for the menu system
    const rootNode: AssetTreeNode = {
      id: ROOT_ID,
      path: '',
      name: ASSET_TYPES.ROOT,
      type: 'asset',
      assetType: undefined,
      children: []
    };

    return getNodeMenuActions(rootNode);
  });

  // Handler for right-clicking an asset tree node or node card
  registry.register('node-actions', (context: ContextMenuKind): ContextMenuAction[] => {
    if (context.kind !== 'node-actions') return [];
    const { node } = context;
    
    return getNodeMenuActions(node);
  });

  // Helper function to get menu actions for a node
  function getNodeMenuActions(node: AssetTreeNode): ContextMenuAction[] {
    // If a virtual folder defines custom menu actions, honor them
    if (node.virtualContext) {
      const provider = virtualFolderDefinitions[node.virtualContext.kind as unknown as keyof typeof virtualFolderDefinitions];
      if (provider?.getContextMenuActions) return provider.getContextMenuActions(node);
    }

    const actions: ContextMenuAction[] = [];

    // Treat alias nodes as real (ID is real); only block self-actions for folders/synthetics
    const isVirtual = !!node.virtualContext;

    // Add base actions for asset nodes (but not for virtual nodes)
    if (node.id !== ROOT_ID && (!isVirtual || node.type !== 'asset')) {
      actions.push({
        id: 'openInNew',
        label: 'Open in New Inspector',
        icon: 'mdi-open-in-new',
        execute: async () => {
          await assetsStore.openInspectorFor(node, { viewHint: node.virtualContext?.viewHint, reuse: false, focus: true });
          uiStore.hideContextMenu();
        }
      });

      // Rename action (only for renameable assets)
      if (node.assetType) {
        const registry = getEffectiveRegistry();
        const definition = registry[node.assetType];
        if (definition?.isRenameable ?? false) {
          actions.push({
            id: 'rename',
            label: 'Rename...',
            icon: 'mdi-form-textbox',
            execute: () => {
              uiStore.promptForRename({ assetId: node.id, assetKey: node.name });
              uiStore.hideContextMenu();
            }
          });
        }

        // Delete action (only for deletable assets)
        if (definition?.isDeletable ?? false) {
          actions.push({
            id: 'delete',
            label: 'Delete',
            icon: 'mdi-delete-outline',
            divider: true,
            execute: () => {
              workspaceStore.requestAssetDeletion(node.id);
              uiStore.hideContextMenu();
            }
          });
        }
      }
    }

    // For virtual folders (not alias assets), compute effective node; alias uses real id directly
    const effectiveNodeForChildren = isVirtual && node.type !== 'asset'
      ? assetsStore.unmergedAssets.find(a => a.id === node.virtualContext!.sourceAssetId)
      : node;

    if (!effectiveNodeForChildren) return [];

    // Add "Add New..." submenu if this node can have children
    const validChildren = getValidChildrenForNode(effectiveNodeForChildren as AssetTreeNode);
    if (validChildren.length > 0) {
      const submenuItems: ContextMenuAction[] = [];

      validChildren.forEach(childType => {
        const registry = getEffectiveRegistry();
        const definition = registry[childType];
        if (!definition || !definition.creationModes) return;

        // Filter by perspective support: check if this type is supported in current perspective
        if ((definition as any)._isSupportedInCurrentPerspective === false) {
          return; // Skip this type if not supported in current perspective
        }

        // Unwrap PerspectiveOverrides for label and icon
        const label = typeof definition.label === 'string' ? definition.label : definition.label.default;
        const icon = typeof definition.icon === 'string' ? definition.icon : definition.icon.default;

        // Simple creation mode
        if (definition.creationModes.includes('simple')) {
          submenuItems.push({
            id: `add-simple-${childType}`,
            label: `${label}...`,
            icon: icon,
            execute: () => {
              if (childType === ASSET_TYPES.NAMESPACE_FOLDER) {
                const parentFqn = (effectiveNodeForChildren.id === ROOT_ID) ? null : (effectiveNodeForChildren as AssetTreeNode).path;
                workspaceStore.openNewFolderDialog(parentFqn);
              } else {
                const parentAsset = (effectiveNodeForChildren.id !== ROOT_ID) ? (effectiveNodeForChildren as Asset) : null;
                const namespace = (effectiveNodeForChildren.assetType && isStructuralFolder(effectiveNodeForChildren.assetType) || effectiveNodeForChildren.id === ROOT_ID) ? (effectiveNodeForChildren as AssetTreeNode).path : null;
                workspaceStore.openNewAssetDialog({ parentAsset, childType, namespace });
              }
              uiStore.hideContextMenu();
            }
          });
        }

        // Full creation mode (from template)
        if (definition.creationModes.includes('full')) {
          submenuItems.push({
            id: `add-full-${childType}`,
            label: `${label} from Template...`,
            icon: icon,
            execute: () => {
              const parentAsset = (effectiveNodeForChildren.id !== ROOT_ID) ? (effectiveNodeForChildren as Asset) : null;
              const namespace = (effectiveNodeForChildren.assetType && isStructuralFolder(effectiveNodeForChildren.assetType) || effectiveNodeForChildren.id === ROOT_ID) ? (effectiveNodeForChildren as AssetTreeNode).path : null;
              workspaceStore.openNewAssetDialog({ parentAsset, childType, namespace });
              uiStore.hideContextMenu();
            }
          });
        }
      });

      if (submenuItems.length > 0) {
        submenuItems.sort((a, b) => a.label.localeCompare(b.label));
        
        const addNewAction: ContextMenuAction = {
          id: 'add-new',
          label: 'Add New...',
          icon: 'mdi-plus',
          divider: true,
          children: submenuItems
        };

        actions.unshift(addNewAction); // Add at the beginning
      }
    }

    return actions;
  }

  // Helper function to determine valid children for a node
  function getValidChildrenForNode(node: AssetTreeNode): string[] {
    const assetType = node.assetType;

    if (node.id === ROOT_ID) {
      const registry = getEffectiveRegistry();
      return Object.entries(registry)
        .filter(([, definition]) => definition.isCreatableAtRoot && (definition as any)._isSupportedInCurrentPerspective !== false)
        .map(([type]) => type);
    }
    
    if (!assetType) return [];
    
    const registry = getEffectiveRegistry();
    const definition = registry[assetType];
    if (definition?.isStructuralFolder) {
      return getValidChildrenForFolder(node as Asset);
    }
    return getValidChildTypes(assetType);
  }
  };

  return { registerContextMenuActions };
}