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
import { getAssetDistroFqn, isSharedAsset, getSharedTemplateIfPureDerivative, isSameOrAncestorDistro } from '@/content/utils/assetUtils';
import { getPropertyInheritanceChain, calculateMergedAsset } from '@/core/utils/mergeUtils';
import { generatePropertiesDiff } from '@/core/utils/diff';

/**
 * An injectable hook for the CloneAssetCommand that creates a functionally identical
 * but structurally independent copy of a package for cross-distro operations.
 * It "flattens" distro-specific inherited properties into local overrides
 * and "rebases" the template link to the highest-level shared ancestor.
 */
const crossDistroCloneHook: PostCloneHook = (newlyClonedAsset, originalSourceAsset, cloneMap) => {
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
    getAssetDistroFqn(a.fqn, assetsStore.unmergedAssets) === getAssetDistroFqn(sourceKey!.fqn, assetsStore.unmergedAssets) &&
    a.assetKey === sourceKey!.assetKey
  );
  const targetNode = assetsStore.unmergedAssets.find(a => a.id === dropTarget.id);

  if (!sourcePackage || !targetNode) {
    console.error("Cannot execute Resolve and Copy: source package or target node not found.");
    return;
  }
    
  const commands = [];
  const targetDistroFqn = getAssetDistroFqn(targetNode.fqn, assetsStore.unmergedAssets);

  const cloneCommand = new CloneAssetCommand(
    sourcePackage.id,
    targetDistroFqn,
    sourcePackage.assetKey,
    crossDistroCloneHook
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
 * Executes the full "Cross-Distro Copy" workflow.
 * This is a CONTENT-LAYER action called after a user confirms a dialog.
 */
export function executeCrossDistroCopy(dragPayload: DragPayload, dropTarget: DropTarget) {
  const assetsStore = useAssetsStore();
  const workspaceStore = useWorkspaceStore();
  const sourcePackage = assetsStore.unmergedAssets.find(a => a.id === dragPayload.assetId);
  const targetNode = assetsStore.unmergedAssets.find(a => a.id === dropTarget.id);

  if (!sourcePackage || !targetNode) {
    console.error("Cannot execute cross-distro copy: source or target not found.");
    return;
  }

  const commands = [];
  const targetDistroFqn = getAssetDistroFqn(targetNode.fqn, assetsStore.unmergedAssets);

  const cloneCommand = new CloneAssetCommand(
    sourcePackage.id,
    targetDistroFqn,
    sourcePackage.assetKey,
    crossDistroCloneHook
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
 * Executes a "Flatten and Rebase" clone to copy a package into a distro's pool.
 * Called after a user confirms a cross-distro drag-and-drop onto a Distro asset.
 */
export function executePoolCopy(dragPayload: DragPayload, dropTarget: DropTarget) {
  const assetsStore = useAssetsStore();
  const workspaceStore = useWorkspaceStore();
  const sourcePackage = assetsStore.unmergedAssets.find(a => a.id === dragPayload.assetId);
  const targetDistro = assetsStore.unmergedAssets.find(a => a.id === dropTarget.id);

  if (!sourcePackage || !targetDistro) {
    console.error("Cannot execute pool copy: source package or target distro not found.");
    return;
  }

  // This command only needs to create the package itself.
  const cloneCommand = new CloneAssetCommand(
    sourcePackage.id,
    targetDistro.fqn, // The new parent is the distro itself
    sourcePackage.assetKey,
    crossDistroCloneHook
  );

  workspaceStore.executeCommand(cloneCommand);
}

/**
 * Returns commands needed to ensure a package exists in the target distro's pool.
 * This is a shared utility used by both drag-drop interactions and manual requirement assignment.
 */
export function ensurePackageInDistroPool(sourcePackage: UnmergedAsset, targetDistroFqn: string | null): (DeriveAssetCommand | CreateAssetCommand)[] {
  if (!targetDistroFqn) {
    return [];
  }

  const assetsStore = useAssetsStore();
  const sourceDistro = getAssetDistroFqn(sourcePackage.fqn, assetsStore.unmergedAssets);
  const sharedTemplate = getSharedTemplateIfPureDerivative(sourcePackage, assetsStore.unmergedAssets);
  const commands: (DeriveAssetCommand | CreateAssetCommand)[] = [];

  if (isSharedAsset(sourcePackage, assetsStore.unmergedAssets) || isSameOrAncestorDistro(targetDistroFqn, sourceDistro, assetsStore.unmergedAssets)) {
    const existingPackageInPool = assetsStore.unmergedAssets.find(p =>
      p.assetType === ASSET_TYPES.PACKAGE &&
      p.assetKey === sourcePackage.assetKey &&
      getAssetDistroFqn(p.fqn, assetsStore.unmergedAssets) === targetDistroFqn
    );
    
    if (!existingPackageInPool) {
      if (isSharedAsset(sourcePackage, assetsStore.unmergedAssets)) {
        commands.push(new DeriveAssetCommand(sourcePackage, targetDistroFqn, sourcePackage.assetKey));
      }
    }
  } else if (sharedTemplate) {
    commands.push(new DeriveAssetCommand(sharedTemplate as UnmergedAsset, targetDistroFqn, sourcePackage.assetKey));
  }

  return commands;
}