/**
 * Interaction Registry - Query Layer
 * 
 * This module provides the public API for looking up drag-and-drop interaction rules.
 * It acts as a thin query layer over ConfigurationHub's effectiveInteractionRules.
 * 
 * Architecture:
 * - masterInteractionRegistry.ts: Declarative rule definitions (data layer)
 * - ConfigurationHub: Perspective-aware filtering (business logic)
 * - interactionRegistry.ts: Query API for UI components (presentation layer)
 * 
 * @see masterInteractionRegistry.ts for rule definitions
 * @see ConfigurationHub.effectiveInteractionRules for filtered rules
 */

import { useAssetsStore } from '@/core/stores/assets';
import type { DragPayload, DropTarget } from '@/core/types/drag-drop';
import { useUiStore } from '@/core/stores/ui';
import { useWorkspaceStore } from '@/core/stores/workspace';
import { MoveAssetCommand, CloneAssetCommand, DeriveAssetCommand } from '@/core/stores/workspace';
import type { UnmergedAsset } from '@/core/types';
import { DROP_TARGET_TYPES } from '../config/constants';
import { virtualFolderDefinitions } from '@/content/logic/virtual-folders/definitions';
import { globalConfigHub } from '@/core/stores/config';

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

export interface ValidationResult {
  isValid: boolean;
  reason?: string;
}

export interface InteractionRule {
  validate?: (dragPayload: DragPayload, dropTarget: DropTarget) => ValidationResult;
  actions: DropAction[] | ((dragPayload: DragPayload, dropTarget: DropTarget) => DropAction[]);
}

// Helper to create a consistent key for the registry.
const getKey = (draggedType: string, targetType: string): string => `${draggedType}->${targetType}`;

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
 * Gets all available drag-and-drop actions for the given asset and drop target.
 * 
 * This function:
 * 1. Validates the drop operation (via getDropValidation)
 * 2. Resolves the drop target type (asset type or generic 'Folder')
 * 3. Queries ConfigurationHub.effectiveInteractionRules (perspective-filtered)
 * 4. Applies rule precedence (specific type -> generic 'Asset')
 * 5. Filters actions by their isEnabled callbacks
 * 
 * Perspective filtering is handled by ConfigurationHub - this function only queries the already-filtered rules.
 * 
 * @param draggedAssetId The ID of the asset being dragged
 * @param dropTarget The drop target (can be asset, root, or virtual folder)
 * @returns Array of valid and enabled DropAction objects
 */
export const getAvailableActions = (draggedAssetId: string, dropTarget: DropTarget): DropAction[] => {
  const validationResult = getDropValidation(draggedAssetId, dropTarget);
  if (!validationResult.isValid) {
    return [];
  }

  const assetsStore = useAssetsStore();
  const uiStore = useUiStore();
  const dragPayload = uiStore.dragSourceInfo;
  if (!dragPayload || dragPayload.assetId !== draggedAssetId) return [];

  const draggedAsset = assetsStore.unmergedAssets.find(a => a.id === dragPayload.assetId);
  if (!draggedAsset) return [];

  // Check if dragged asset type is supported in current perspective
  if (!globalConfigHub) return [];
  const draggedDef = globalConfigHub.effectiveAssetRegistry.value[draggedAsset.assetType];
  if (draggedDef && (draggedDef as any)._isSupportedInCurrentPerspective === false) {
    return []; // Dragged asset type not supported in current perspective
  }

  let effectiveDropTarget = dropTarget;

  // Handle virtual context: check for override hooks or proxy to real asset
  if (dropTarget.virtualContext) {
    const providerKind = dropTarget.virtualContext.kind as unknown as keyof typeof virtualFolderDefinitions;
    const provider = virtualFolderDefinitions[providerKind];

    // If the virtual folder has custom drop actions, use them instead
    if (provider?.getDropActions) {
      return provider.getDropActions(dragPayload, dropTarget);
    }

    // Otherwise, proxy to the real source asset
    const realSourceAsset = assetsStore.unmergedAssets.find(a => a.id === dropTarget.virtualContext!.sourceAssetId);
    if (realSourceAsset) {
      effectiveDropTarget = { id: realSourceAsset.id, type: DROP_TARGET_TYPES.ASSET };
    }
  }

  const draggedType = draggedAsset.assetType;
  
  // Check if target is an asset and if it's supported in current perspective
  const targetAsset = assetsStore.unmergedAssets.find(a => a.id === effectiveDropTarget.id);
  if (targetAsset) {
    const targetDef = globalConfigHub.effectiveAssetRegistry.value[targetAsset.assetType];
    if (targetDef && (targetDef as any)._isSupportedInCurrentPerspective === false) {
      return []; // Target asset type not supported in current perspective
    }
  }
  
  const targetType = getTargetType(effectiveDropTarget);

  const specificKey = getKey(draggedType, targetType);
  const genericKey = getKey('Asset', targetType);
    
  // Get rules from ConfigurationHub's effective interaction registry
  const effectiveRules = globalConfigHub?.effectiveInteractionRules.value;
  if (!effectiveRules) {
    return [];
  }
  
  // Apply the same precedence logic here.
  let rule = effectiveRules.get(specificKey);
  if (!rule) {
    rule = effectiveRules.get(genericKey);
  }
    
  if (!rule) {
    return [];
  }

  // Pass the full payload to get the actions
  const actions = typeof rule.actions === 'function' 
    ? rule.actions(dragPayload, effectiveDropTarget)
    : rule.actions;

  const filteredActions = actions.filter((action: DropAction) => {
    // Pass the full payload for individual enabling checks
    return !action.isEnabled || action.isEnabled(dragPayload, effectiveDropTarget);
  });

  return filteredActions;
};

/**
 * Gets the validation result for a potential drop, including the reason for failure.
 */
export const getDropValidation = (draggedAssetId: string, dropTarget: DropTarget): ValidationResult => {
  const assetsStore = useAssetsStore();
  const uiStore = useUiStore();
  const dragPayload = uiStore.dragSourceInfo;
  if (!dragPayload || dragPayload.assetId !== draggedAssetId) return { isValid: false, reason: 'Drag information is missing.' };

  const draggedAsset = assetsStore.unmergedAssets.find(a => a.id === dragPayload.assetId);
  if (!draggedAsset) return { isValid: false, reason: 'Source asset not found.' };

  // Check if dragged asset type is supported in current perspective
  if (!globalConfigHub) return { isValid: false };
  const draggedDef = globalConfigHub.effectiveAssetRegistry.value[draggedAsset.assetType];
  if (draggedDef && (draggedDef as any)._isSupportedInCurrentPerspective === false) {
    return { isValid: false, reason: 'Dragged asset not supported in current perspective' };
  }

  let effectiveDropTarget = dropTarget;
  if (dropTarget.virtualContext) {
    const providerKind = dropTarget.virtualContext.kind as unknown as keyof typeof virtualFolderDefinitions;
    const provider = virtualFolderDefinitions[providerKind];
    if (provider?.getDropActions) {
      return { isValid: provider.getDropActions(dragPayload, dropTarget).length > 0 };
    }
    const realSourceAsset = assetsStore.unmergedAssets.find(a => a.id === dropTarget.virtualContext!.sourceAssetId);
    if (realSourceAsset) {
      effectiveDropTarget = { id: realSourceAsset.id, type: DROP_TARGET_TYPES.ASSET };
    }
  }

  // Check if target is an asset and if it's supported in current perspective
  const targetAsset = assetsStore.unmergedAssets.find(a => a.id === effectiveDropTarget.id);
  if (targetAsset) {
    const targetDef = globalConfigHub.effectiveAssetRegistry.value[targetAsset.assetType];
    if (targetDef && (targetDef as any)._isSupportedInCurrentPerspective === false) {
      return { isValid: false, reason: 'Target asset not supported in current perspective' };
    }
  }

  const draggedType = draggedAsset.assetType;
  const targetType = getTargetType(effectiveDropTarget);

  const specificKey = getKey(draggedType, targetType);
  const genericKey = getKey('Asset', targetType);
    
  // Get rules from ConfigurationHub's effective interaction registry
  const effectiveRules = globalConfigHub?.effectiveInteractionRules.value;
  if (!effectiveRules) {
    return { isValid: false };
  }
  
  let rule = effectiveRules.get(specificKey);
  if (!rule) {
    rule = effectiveRules.get(genericKey);
  }
    
  if (!rule) {
    // If no rule is found at all, the drop is fundamentally unsupported.
    // Return isValid: false with NO REASON.
    return { isValid: false };
  }

  if (rule.validate) {
    return rule.validate(dragPayload, effectiveDropTarget);
  }

  return { isValid: true };
};







