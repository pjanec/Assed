import { useAssetsStore } from '@/core/stores/assets';
import { DeriveAssetCommand } from '@/core/stores/workspace';
import type { DropAction, InteractionRule } from '@/core/registries/interactionRegistry';
import { registerInteraction } from '@/core/registries/interactionRegistry';
import type { UnmergedAsset } from '@/core/types';
import type { DragPayload, DropTarget } from '@/core/types/drag-drop';
import { ASSET_TYPES } from '@/content/config/constants';

/**
 * A specialized action to automatically derive a package onto a node.
 */
const DERIVE_ON_NODE_ACTION: DropAction = {
  id: 'derive-on-node',
  label: 'Derive on Node', // This won't be seen as it's the only action
  icon: 'mdi-source-fork',
  cursor: 'link',
  execute: (dragPayload: DragPayload, dropTarget: DropTarget, workspaceStore: any) => {
    const assetsStore = useAssetsStore();
    const sourceAsset = assetsStore.unmergedAssets.find(a => a.id === dragPayload.assetId) as UnmergedAsset | undefined;
    const targetNode = assetsStore.unmergedAssets.find(a => a.id === dropTarget.id) as UnmergedAsset | undefined;

    if (!sourceAsset || !targetNode) {
      console.error('Could not find source or target asset for derive operation.');
      return;
    }

    // Create and execute the command. The new asset will keep the source's key.
    const command = new DeriveAssetCommand(sourceAsset, targetNode.fqn, sourceAsset.assetKey);
    workspaceStore.executeCommand(command);
  },
};

/**
 * The interaction rule for dropping a Package asset onto a Node asset.
 */
const PACKAGE_TO_NODE_INTERACTION: InteractionRule = {
  /**
   * Validates if the drop is allowed before showing any actions.
   */
  validate: (dragPayload: DragPayload, dropTarget: DropTarget) => {
    const assetsStore = useAssetsStore();
    const draggedAsset = assetsStore.unmergedAssets.find(a => a.id === dragPayload.assetId);
    const targetNode = assetsStore.unmergedAssets.find(a => a.id === dropTarget.id);

    // Basic validation: ensure both assets exist and types are correct.
    if (!draggedAsset || !targetNode || draggedAsset.assetType !== ASSET_TYPES.PACKAGE || targetNode.assetType !== ASSET_TYPES.NODE) {
      return false;
    }

    // Collision check: ensure a package with the same key doesn't already exist on this node.
    const existingChildren = assetsStore.unmergedAssets.filter(
      a => a.fqn.startsWith(targetNode.fqn + '::') && a.fqn.split('::').length === targetNode.fqn.split('::').length + 1
    );

    const isNameTaken = existingChildren.some(child => child.assetKey === draggedAsset.assetKey);
    
    // --- ADD THIS LOG ---
    console.log(`[DEBUG 2.5] Validating 'PACKAGE_TO_NODE_INTERACTION': Is name '${draggedAsset.assetKey}' taken on target? ${isNameTaken}`);
      
    // The drop is valid only if the name is not taken.
    return !isNameTaken;
  },
  /**
   * Since there is only one action, it will be executed automatically without a menu.
   */
  actions: [DERIVE_ON_NODE_ACTION],
};

// Register the specific rule for Package -> Node interactions.
registerInteraction(ASSET_TYPES.PACKAGE, ASSET_TYPES.NODE, PACKAGE_TO_NODE_INTERACTION);
















