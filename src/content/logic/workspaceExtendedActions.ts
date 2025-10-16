import { useAssetsStore, useWorkspaceStore } from '@/core/stores';
import {
  CompositeCommand,
  CloneAssetCommand,
  CreateAssetCommand,
  DeriveAssetCommand,
  type PostCloneHook,
} from '@/core/stores/workspace';
import type { UnmergedAsset } from '@/core/types';
import type { DragPayload, DropTarget } from '@/core/types/drag-drop';
import { ASSET_TYPES } from '@/content/config/constants';
import { getAssetEnvironmentFqn, isSharedAsset } from '@/content/utils/assetUtils';
import { getPropertyInheritanceChain, calculateMergedAsset } from '@/content/utils/mergeUtils';
import { generatePropertiesDiff } from '@/core/utils/diff';

/**
 * An injectable hook for the CloneAssetCommand that creates a functionally identical
 * but structurally independent copy of a package for cross-environment operations.
 * It "flattens" environment-specific inherited properties into local overrides
 * and "rebases" the template link to the highest-level shared ancestor.
 */
const crossEnvironmentCloneHook: PostCloneHook = (newlyClonedAsset, originalSourceAsset, cloneMap) => {
  const assetsStore = useAssetsStore();
  const allAssetsMap = new Map<string, UnmergedAsset>();
  assetsStore.assetsWithOverrides.forEach(a => allAssetsMap.set(a.id, a));

  const mergedResult = calculateMergedAsset(originalSourceAsset.id, allAssetsMap);
  if ('error' in mergedResult) {
    console.error("Failed to calculate merged state during clone:", mergedResult.error);
    newlyClonedAsset.templateFqn = null;
    newlyClonedAsset.overrides = {};
    return newlyClonedAsset;
  }
  const finalSourceProperties = mergedResult.properties;

  const inheritanceChain = getPropertyInheritanceChain(originalSourceAsset, allAssetsMap);
  let highestSharedAncestor: UnmergedAsset | null = null;
  for (const asset of inheritanceChain.slice().reverse()) {
    if (isSharedAsset(asset, assetsStore.unmergedAssets)) {
      highestSharedAncestor = asset;
      break;
    }
  }

  if (highestSharedAncestor) {
    const ancestorMergedResult = calculateMergedAsset(highestSharedAncestor.id, allAssetsMap);
    if ('properties' in ancestorMergedResult) {
      newlyClonedAsset.templateFqn = highestSharedAncestor.fqn;
      newlyClonedAsset.overrides = generatePropertiesDiff(ancestorMergedResult.properties, finalSourceProperties);
    } else {
      newlyClonedAsset.templateFqn = null;
      newlyClonedAsset.overrides = finalSourceProperties;
    }
  } else {
    newlyClonedAsset.templateFqn = null;
    newlyClonedAsset.overrides = finalSourceProperties;
  }

  return newlyClonedAsset;
};

/**
 * Executes the full "Resolve and Copy" workflow.
 * This is a CONTENT-LAYER action called after a user confirms a dialog.
 */
export function executeResolveAndCopy(dragPayload: DragPayload, dropTarget: DropTarget) {
  const assetsStore = useAssetsStore();
  const workspaceStore = useWorkspaceStore();
  const sourceKey = assetsStore.unmergedAssets.find(a => a.id === dragPayload.assetId);
  const sourcePackage = assetsStore.unmergedAssets.find(a => 
    a.assetType === ASSET_TYPES.PACKAGE && 
    getAssetEnvironmentFqn(a.fqn, assetsStore.unmergedAssets) === getAssetEnvironmentFqn(sourceKey!.fqn, assetsStore.unmergedAssets) &&
    a.assetKey === sourceKey!.assetKey
  );
  const targetNode = assetsStore.unmergedAssets.find(a => a.id === dropTarget.id);

  if (!sourcePackage || !targetNode) {
    console.error("Cannot execute Resolve and Copy: source package or target node not found.");
    return;
  }
    
  const commands = [];
  const targetEnvFqn = getAssetEnvironmentFqn(targetNode.fqn, assetsStore.unmergedAssets);

  const cloneCommand = new CloneAssetCommand(
    sourcePackage.id,
    targetEnvFqn,
    sourcePackage.assetKey,
    crossEnvironmentCloneHook
  );
  commands.push(cloneCommand);

  const keyCreateCommand = new CreateAssetCommand({
    assetType: ASSET_TYPES.PACKAGE_KEY,
    assetKey: sourcePackage.assetKey,
    fqn: `${targetNode.fqn}::${sourcePackage.assetKey}`,
    templateFqn: null,
    overrides: {},
  });
  commands.push(keyCreateCommand);

  workspaceStore.executeCommand(new CompositeCommand(commands));
}

/**
 * Executes the full "Cross-Environment Copy" workflow.
 * This is a CONTENT-LAYER action called after a user confirms a dialog.
 */
export function executeCrossEnvCopy(dragPayload: DragPayload, dropTarget: DropTarget) {
  const assetsStore = useAssetsStore();
  const workspaceStore = useWorkspaceStore();
  const sourcePackage = assetsStore.unmergedAssets.find(a => a.id === dragPayload.assetId);
  const targetNode = assetsStore.unmergedAssets.find(a => a.id === dropTarget.id);

  if (!sourcePackage || !targetNode) {
    console.error("Cannot execute cross-env copy: source or target not found.");
    return;
  }

  const commands = [];
  const targetEnvFqn = getAssetEnvironmentFqn(targetNode.fqn, assetsStore.unmergedAssets);

  const cloneCommand = new CloneAssetCommand(
    sourcePackage.id,
    targetEnvFqn,
    sourcePackage.assetKey,
    crossEnvironmentCloneHook
  );
  commands.push(cloneCommand);

  const keyCreateCommand = new CreateAssetCommand({
    assetType: ASSET_TYPES.PACKAGE_KEY,
    assetKey: sourcePackage.assetKey,
    fqn: `${targetNode.fqn}::${sourcePackage.assetKey}`,
    templateFqn: null,
    overrides: {},
  });
  commands.push(keyCreateCommand);

  workspaceStore.executeCommand(new CompositeCommand(commands));
}

/**
 * Executes a "Flatten and Rebase" clone to copy a package into an environment's pool.
 * Called after a user confirms a cross-environment drag-and-drop onto an Environment asset.
 */
export function executePoolCopy(dragPayload: DragPayload, dropTarget: DropTarget) {
  const assetsStore = useAssetsStore();
  const workspaceStore = useWorkspaceStore();
  const sourcePackage = assetsStore.unmergedAssets.find(a => a.id === dragPayload.assetId);
  const targetEnv = assetsStore.unmergedAssets.find(a => a.id === dropTarget.id);

  if (!sourcePackage || !targetEnv) {
    console.error("Cannot execute pool copy: source package or target environment not found.");
    return;
  }

  // This command only needs to create the package itself.
  const cloneCommand = new CloneAssetCommand(
    sourcePackage.id,
    targetEnv.fqn, // The new parent is the environment itself
    sourcePackage.assetKey,
    crossEnvironmentCloneHook
  );

  workspaceStore.executeCommand(cloneCommand);
}