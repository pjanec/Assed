// src/content/logic/contextMenus/contextMenuActions.ts
import { inject } from 'vue';
import { useAssetsStore } from '@/core/stores/assets';
import { useWorkspaceStore } from '@/core/stores/workspace';
import { ContextMenuRegistryKey } from '@/core/registries/contextMenuRegistryKey';
import { useUiStore } from '@/core/stores/ui';
import type { ContextMenuAction, ContextMenuKind } from '@/core/types/ui';
import type { AssetTreeNode, Asset } from '@/core/types';
import { getValidChildrenForFolder, getValidChildTypes, assetRegistry } from '@/content/config/assetRegistry';
import { ASSET_TYPES } from '@/content/config/constants';
import { ROOT_ID } from '@/core/config/constants';

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
    const actions: ContextMenuAction[] = [];

    // Add base actions for asset nodes
    if (node.id !== ROOT_ID) {
      actions.push({
        id: 'openInNew',
        label: 'Open in New Inspector',
        icon: 'mdi-open-in-new',
        execute: () => {
          assetsStore.loadAssetDetails(node.id).then(() => {
            assetsStore.addInspector(node.id);
          });
          uiStore.hideContextMenu();
        }
      });

      // Rename action (only for renameable assets)
      if (node.assetType) {
        const definition = assetRegistry[node.assetType];
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

    // Add "Add New..." submenu if this node can have children
    const validChildren = getValidChildrenForNode(node);
    if (validChildren.length > 0) {
      const submenuItems: ContextMenuAction[] = [];

      validChildren.forEach(childType => {
        const definition = assetRegistry[childType];
        if (!definition || !definition.creationModes) return;

        // Simple creation mode
        if (definition.creationModes.includes('simple')) {
          submenuItems.push({
            id: `add-simple-${childType}`,
            label: `${definition.label}...`,
            icon: definition.icon,
            execute: () => {
              if (childType === ASSET_TYPES.NAMESPACE_FOLDER) {
                const parentFqn = (node.id === ROOT_ID) ? null : node.path;
                workspaceStore.openNewFolderDialog(parentFqn);
              } else {
                const parentAsset = (node.id !== ROOT_ID) ? (node as Asset) : null;
                const namespace = (assetRegistry[node.assetType!]?.isFolder || node.id === ROOT_ID) ? node.path : null;
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
            label: `${definition.label} from Template...`,
            icon: definition.icon,
            execute: () => {
              const parentAsset = (node.id !== ROOT_ID) ? (node as Asset) : null;
              const namespace = (assetRegistry[node.assetType!]?.isFolder || node.id === ROOT_ID) ? node.path : null;
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
      return Object.entries(assetRegistry)
        .filter(([, definition]) => definition.isCreatableAtRoot)
        .map(([type]) => type);
    }
    
    if (!assetType) return [];
    
    const definition = assetRegistry[assetType];
    if (definition?.isFolder) {
      return getValidChildrenForFolder(node as Asset);
    }
    return getValidChildTypes(assetType);
  }
  };

  return { registerContextMenuActions };
}