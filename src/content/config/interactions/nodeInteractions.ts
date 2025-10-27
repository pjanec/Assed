import type { InteractionRule } from '@/core/registries/interactionRegistry';
import type { InteractionRuleEntry } from '@/core/stores/ConfigurationHub';
import type { DragPayload, DropTarget } from '@/core/types/drag-drop';
import type { UnmergedAsset } from '@/core/types';
import { ASSET_TYPES } from '@/content/config/constants';
import { useAssetsStore, useUiStore, useWorkspaceStore } from '@/core/stores';
import { CloneAssetCommand, CreateAssetCommand, DeriveAssetCommand, CompositeCommand } from '@/core/stores/workspace';
import { getAssetEnvironmentFqn, getSharedTemplateIfPureDerivative } from '@/content/utils/assetUtils';
import { generatePropertiesDiff } from '@/core/utils/diff';
import { isSharedAsset } from '@/content/utils/assetUtils';
import { crossEnvironmentCloneHook } from './packageAssignmentInteractions';

function analyzeNodeCloneDependencies(sourceNodeId: string, targetEnvFqn: string): any {
  const assetsStore = useAssetsStore();
  const allAssets = assetsStore.unmergedAssets;
  const sourceNode = allAssets.find(a => a.id === sourceNodeId)!;
  
  const plan = {
    nodesToCreate: [] as any[],
    keysToCreate: [] as any[],
    safeImports: [] as any[],
    importsWithOverrides: [] as any[],
    commands: [] as any[],
  };

  plan.nodesToCreate.push({ newState: { ...sourceNode, fqn: `${targetEnvFqn}::${sourceNode.assetKey}` } });
  plan.commands.push(new CloneAssetCommand(sourceNode.id, targetEnvFqn, sourceNode.assetKey));

  const keysToClone = allAssets.filter(a => a.assetType === ASSET_TYPES.PACKAGE_KEY && a.fqn.startsWith(sourceNode.fqn + '::'));
  
  for (const key of keysToClone) {
    plan.keysToCreate.push({ newState: { ...key, fqn: `${targetEnvFqn}::${sourceNode.assetKey}::${key.assetKey}` } });

    plan.commands.push(new CreateAssetCommand({
        assetType: ASSET_TYPES.PACKAGE_KEY,
        assetKey: key.assetKey,
        fqn: `${targetEnvFqn}::${sourceNode.assetKey}::${key.assetKey}`,
        templateFqn: null,
        overrides: {},
    }));

    const sourcePackageEnv = getAssetEnvironmentFqn(sourceNode.fqn, allAssets);
    const sourcePackage = allAssets.find(p => p.assetType === ASSET_TYPES.PACKAGE && p.assetKey === key.assetKey && getAssetEnvironmentFqn(p.fqn, allAssets) === sourcePackageEnv);
    const targetPackage = allAssets.find(p => p.assetType === ASSET_TYPES.PACKAGE && p.assetKey === key.assetKey && getAssetEnvironmentFqn(p.fqn, allAssets) === targetEnvFqn);

    if (!targetPackage && sourcePackage) {
      const sharedTemplate = getSharedTemplateIfPureDerivative(sourcePackage, allAssets);
      if (sharedTemplate) {
        plan.safeImports.push({ newState: { ...sourcePackage, fqn: `${targetEnvFqn}::${sourcePackage.assetKey}` } });
        plan.commands.push(new DeriveAssetCommand(sharedTemplate as UnmergedAsset, targetEnvFqn, sourcePackage.assetKey));
      } else {
        const tempClonedAsset = crossEnvironmentCloneHook({} as UnmergedAsset, sourcePackage, new Map());
        const diff = generatePropertiesDiff(null, tempClonedAsset.overrides);
        plan.importsWithOverrides.push({
          newState: { ...sourcePackage, fqn: `${targetEnvFqn}::${sourcePackage.assetKey}` },
          diff: diff,
        });
        plan.commands.push(new CloneAssetCommand(sourcePackage.id, targetEnvFqn, sourcePackage.assetKey, crossEnvironmentCloneHook));
      }
    }
  }
  return plan;
}

const cloneNodeToEnvRule: InteractionRule = {
  validate: (dragPayload, dropTarget) => {
    const assetsStore = useAssetsStore();
    const sourceNode = assetsStore.unmergedAssets.find(a => a.id === dragPayload.assetId)!;
    
    const targetEnv = assetsStore.unmergedAssets.find(a => a.id === dropTarget.id);
    if (!targetEnv) return { isValid: false, reason: 'Target environment not found' };

    const existingNode = assetsStore.unmergedAssets.find(a => a.fqn === `${targetEnv.fqn}::${sourceNode.assetKey}`);
    
    if (existingNode) {
      return { isValid: false, reason: `Environment already contains a node named '${sourceNode.assetKey}'.` };
    }
    return { isValid: true };
  },
  actions: [{
    id: 'clone-node-with-deps',
    label: 'Clone Node with Dependencies',
    icon: 'mdi-content-copy',
    cursor: 'copy',
    execute: async (dragPayload, dropTarget) => {
      const uiStore = useUiStore();
      const workspaceStore = useWorkspaceStore();
      const assetsStore = useAssetsStore();
      const sourceNode = assetsStore.unmergedAssets.find(a => a.id === dragPayload.assetId)!;
      const targetEnv = assetsStore.unmergedAssets.find(a => a.id === dropTarget.id)!;

      const plan = analyzeNodeCloneDependencies(sourceNode.id, targetEnv.fqn);

      const confirmed = await uiStore.promptForGenericConfirmation('node-clone-confirmation', {
        sourceNode,
        targetEnv,
        plan,
      });

      if (confirmed) {
        workspaceStore.executeCommand(new CompositeCommand(plan.commands));
      }
    },
  }],
};

export const nodeInteractions: InteractionRuleEntry[] = [
  {
    draggedType: ASSET_TYPES.NODE,
    targetType: ASSET_TYPES.ENVIRONMENT,
    rule: cloneNodeToEnvRule
  },
];

