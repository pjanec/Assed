import { useAssetsStore } from '@/core/stores/assets';
import type { DragPayload, DropTarget } from '@/core/types/drag-drop';
import { useUiStore } from '@/core/stores/ui';
import { useWorkspaceStore } from '@/core/stores/workspace';
import { MoveAssetCommand, CloneAssetCommand, DeriveAssetCommand } from '@/core/stores/workspace';
import type { UnmergedAsset } from '@/core/types';
import { DROP_TARGET_TYPES } from '../config/constants';

// The type definitions for actions and rules are updated to expect the full payload.
export interface DropAction {
  id: string;
  label: string;
  icon: string;
  cursor: 'move' | 'copy' | 'link' | 'none';
  opensDialog?: boolean; 
  execute: (dragPayload: DragPayload, dropTarget: DropTarget, workspaceStore: any) => void;
  isEnabled?: (dragPayload: DragPayload, dropTarget: DropTarget) => boolean;
}

export interface InteractionRule {
  validate?: (dragPayload: DragPayload, dropTarget: DropTarget) => boolean;
  actions: DropAction[] | ((dragPayload: DragPayload, dropTarget: DropTarget) => DropAction[]);
}

// The registry itself, mapping an interaction key (e.g., "Asset->Folder") to a rule.
const interactionRegistry = new Map<string, InteractionRule>();

// Helper to create a consistent key for the registry.
const getKey = (draggedType: string, targetType: string): string => `${draggedType}->${targetType}`;

/**
 * Registers a new interaction rule for a given source and target type.
 * @param draggedType The assetType of the dragged item.
 * @param targetType The type of the drop target (e.g., 'Folder', 'NodeCard').
 * @param rule The InteractionRule object defining the interaction.
 */
export const registerInteraction = (draggedType: string, targetType: string, rule: InteractionRule): void => {
  const key = getKey(draggedType, targetType);
  if (interactionRegistry.has(key)) {
    console.warn(`Interaction already registered for key: ${key}. Overwriting.`);
  }
  interactionRegistry.set(key, rule);
};

// A helper to resolve the type of the drop target. This will be crucial later.
const getTargetType = (dropTarget: DropTarget): string => {
    if (dropTarget.type === 'asset' || dropTarget.type === DROP_TARGET_TYPES.ROOT) {
        const assetsStore = useAssetsStore();
        const asset = assetsStore.unmergedAssets.find(a => a.id === dropTarget.id);
        if (asset) return asset.assetType;
        return 'Folder'; // Default for root or virtual folders
    }
    return dropTarget.type;
};

/**
 * The main function to query the registry. Given a dragged asset and a drop target,
 * it returns a list of all valid and enabled actions.
 * @param draggedAssetId The ID of the asset being dragged.
 * @param dropTarget A generic object representing the drop target.
 * @returns An array of valid DropAction objects.
 */
export const getAvailableActions = (draggedAssetId: string, dropTarget: DropTarget): DropAction[] => {
  const assetsStore = useAssetsStore();
  const uiStore = useUiStore();

  // Retrieve the full payload from the store
  const dragPayload = uiStore.dragSourceInfo;
  if (!dragPayload || dragPayload.assetId !== draggedAssetId) return [];

  const draggedAsset = assetsStore.unmergedAssets.find(a => a.id === dragPayload.assetId);
  if (!draggedAsset) return [];

  const draggedType = draggedAsset.assetType;
  const targetType = getTargetType(dropTarget);

  const specificKey = getKey(draggedType, targetType);
  const genericKey = getKey('Asset', targetType);
    
  let rule = interactionRegistry.get(specificKey) || interactionRegistry.get(genericKey);

  if (!rule) {
    return [];
  }
  
  // Pass the full payload to the rule's validation
  if (rule.validate && !rule.validate(dragPayload, dropTarget)) {
    return [];
  }

  // Pass the full payload to get the actions
  const actions = typeof rule.actions === 'function' 
    ? rule.actions(dragPayload, dropTarget)
    : rule.actions;

  return actions.filter(action => {
    // Pass the full payload for individual enabling checks
    return !action.isEnabled || action.isEnabled(dragPayload, dropTarget);
  });
};







