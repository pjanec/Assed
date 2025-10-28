import { useUiStore, useWorkspaceStore, useAssetsStore } from '@/core/stores';
import { UpdateAssetCommand, CreateAssetCommand, DeriveAssetCommand, CompositeCommand } from '@/core/stores/workspace';
import type { InteractionRule } from '@/core/registries/interactionRegistry';
import type { InteractionRuleEntry } from '@/core/stores/ConfigurationHub';
import { ASSET_TYPES } from '@/content/config/constants';
import type { DragPayload, DropTarget } from '@/core/types/drag-drop';
import { useWorkspaceStore as getWorkspaceStore } from '@/core/stores/workspace';
import { isSameEnvironmentForNodeAssignment, getDistroForAsset, getEnvironmentForAsset } from '@/content/utils/assetUtils';
import { resolveInheritedCollection } from '@/core/utils/inheritanceUtils';
import { useCoreConfigStore } from '@/core/stores/config';
import { cloneDeep } from 'lodash-es';

const assignDistroToEnvironmentRule: InteractionRule = {
  validate: () => ({ isValid: true }),
  actions: [{
    id: 'assign-distro-to-env',
    label: 'Set as Source Distro',
    icon: 'mdi-target-arrow',
    cursor: 'link',
    execute: async (dragPayload: DragPayload, dropTarget: DropTarget) => {
      const uiStore = useUiStore();
      const assetsStore = useAssetsStore();
      const workspaceStore = useWorkspaceStore();

      const distroAsset = assetsStore.unmergedAssets.find(a => a.id === dragPayload.assetId);
      const environmentAsset = assetsStore.unmergedAssets.find(a => a.id === dropTarget.id);

      if (!distroAsset || !environmentAsset) {
        console.error('Assign Distro failed: Assets not found.');
        uiStore.clearActionStates();
        return;
      }

      const oldDistroFqn = (environmentAsset as any).overrides?.distroFqn as string | null | undefined;
      const newDistroFqn = distroAsset.fqn;

      if (oldDistroFqn && oldDistroFqn !== newDistroFqn) {
        try {
          const confirmed = await uiStore.promptForGenericConfirmation('distro-reassignment', {
            environmentName: environmentAsset.assetKey,
            currentDistro: oldDistroFqn || 'None',
            newDistro: newDistroFqn,
          });
          if (!confirmed) {
            uiStore.clearActionStates();
            return;
          }
        } catch (error) {
          console.error('Distro reassignment prompt failed:', error);
          uiStore.clearActionStates();
          return;
        }
      }

      const command = new UpdateAssetCommand(
        environmentAsset.id,
        environmentAsset,
        {
          ...environmentAsset,
          overrides: {
            ...(environmentAsset as any).overrides,
            distroFqn: newDistroFqn,
          },
        } as any
      );
      workspaceStore.executeCommand(command);
      uiStore.clearActionStates();
    }
  }]
};

const reassignNodeKeyRule: InteractionRule = {
  validate: (dragPayload: DragPayload, dropTarget: DropTarget) => {
    const assetsStore = useAssetsStore();
    const nodeKeyAsset = assetsStore.unmergedAssets.find(a => a.id === dragPayload.assetId);
    const targetNodeAsset = assetsStore.unmergedAssets.find(a => a.id === dropTarget.id);

    if (!nodeKeyAsset || nodeKeyAsset.assetType !== ASSET_TYPES.NODE_KEY ||
        !targetNodeAsset || targetNodeAsset.assetType !== ASSET_TYPES.NODE) {
      return { isValid: false, reason: "Invalid drag/drop types." };
    }

    if (targetNodeAsset.assetKey === nodeKeyAsset.assetKey) {
      return { isValid: false, reason: "Cannot reassign to the same Node type." };
    }

    const machineAsset = assetsStore.unmergedAssets.find(a => a.id === dragPayload.parentAssetId);
    if (!machineAsset) return { isValid: false, reason: "Source machine not found." };

    const expectedNewKeyFqn = `${machineAsset.fqn}::${targetNodeAsset.assetKey}`;
    const existingKey = assetsStore.unmergedAssets.find(key => key.fqn === expectedNewKeyFqn);

    if (existingKey) {
      return { isValid: false, reason: `Machine '${machineAsset.assetKey}' already has Node '${targetNodeAsset.assetKey}' assigned.` };
    }

    return { isValid: true };
  },
  actions: [{
    id: 'reassign-nodekey',
    label: 'Reassign Node',
    icon: 'mdi-file-move',
    cursor: 'move',
    execute: (dragPayload: DragPayload, dropTarget: DropTarget) => {
      const assetsStore = useAssetsStore();
      const workspaceStore = getWorkspaceStore();
      const targetNodeAsset = assetsStore.unmergedAssets.find(a => a.id === dropTarget.id);

      if (!targetNodeAsset) {
        console.error("Reassign failed: Target node not found.");
        return;
      }

      workspaceStore.renameAsset(dragPayload.assetId, targetNodeAsset.assetKey);
    }
  }]
};

// Assign a Machine to a Node (create NodeKey under Machine for the Node)
const assignMachineToNodeRule: InteractionRule = {
  validate: (dragPayload, dropTarget) => {
    const assetsStore = useAssetsStore();
    const machine = assetsStore.unmergedAssets.find(a => a.id === dragPayload.assetId);
    const node = assetsStore.unmergedAssets.find(a => a.id === dropTarget.id);
    if (!machine || !node || machine.assetType !== ASSET_TYPES.MACHINE || node.assetType !== ASSET_TYPES.NODE) {
      return { isValid: false, reason: 'Invalid drag and drop types.' };
    }
    const nodeDistro = getDistroForAsset(node as any, assetsStore.assetsWithOverrides);
    if (!nodeDistro) {
      return { isValid: false, reason: 'Could not resolve Node’s distro.' };
    }
    const ok = isSameEnvironmentForNodeAssignment(machine as any, node as any, assetsStore.assetsWithOverrides);
    if (!ok) {
      return { isValid: false, reason: 'This Machine does not belong to the Environment that uses this Node\'s distro.' };
    }
    // Duplicate check: Machine already has NodeKey for this Node
    const expectedKeyFqn = `${machine.fqn}::${node.assetKey}`;
    const existing = assetsStore.unmergedAssets.find(a => a.assetType === ASSET_TYPES.NODE_KEY && a.fqn === expectedKeyFqn);
    if (existing) {
      return { isValid: false, reason: `Machine already assigned to '${node.assetKey}'.` };
    }
    return { isValid: true };
  },
  actions: [
    {
      id: 'assign-machine-to-node',
      label: 'Assign to Node',
      icon: 'mdi-link-plus',
      cursor: 'link',
      execute: (dragPayload, dropTarget) => {
        const assetsStore = useAssetsStore();
        const workspaceStore = getWorkspaceStore();
        const coreConfig = useCoreConfigStore();
        const machine = assetsStore.unmergedAssets.find(a => a.id === dragPayload.assetId)!;
        const node = assetsStore.unmergedAssets.find(a => a.id === dropTarget.id)!;

        // Identify the environment that effectively uses this machine for the node's distro
        const nodeDistro = getDistroForAsset(node as any, assetsStore.assetsWithOverrides);
        const environments = assetsStore.assetsWithOverrides.filter(a => a.assetType === ASSET_TYPES.ENVIRONMENT);
        const targetEnv = environments.find(env => {
          const selected = (env as any).overrides?.distroFqn as string | undefined;
          if (!selected || !nodeDistro) return false;
          const matches = selected === (nodeDistro as any).fqn || (nodeDistro as any).fqn.startsWith(selected + '::');
          if (!matches) return false;
          const envMachines = resolveInheritedCollection(env as any, ASSET_TYPES.MACHINE, assetsStore.assetsWithOverrides, coreConfig.effectiveAssetRegistry);
          return envMachines.some(m => m.id === machine.id);
        });

        if (!targetEnv) {
          // Fallback: create under current machine
          workspaceStore.executeCommand(new CreateAssetCommand({
            assetType: ASSET_TYPES.NODE_KEY,
            assetKey: node.assetKey,
            fqn: `${machine.fqn}::${node.assetKey}`,
            templateFqn: null,
            overrides: {},
          }));
          return;
        }

        const owningEnv = getEnvironmentForAsset(machine as any, assetsStore.assetsWithOverrides);
        const ownedByTarget = owningEnv && owningEnv.id === (targetEnv as any).id;

        const existingLocalMachine = assetsStore.unmergedAssets.find(a =>
          a.assetType === ASSET_TYPES.MACHINE && a.fqn === `${(targetEnv as any).fqn}::${machine.assetKey}`
        );

        const commands: (DeriveAssetCommand | CreateAssetCommand)[] = [];
        let targetMachineFqn = machine.fqn;
        if (!ownedByTarget) {
          if (existingLocalMachine) {
            targetMachineFqn = (existingLocalMachine as any).fqn;
          } else {
            const deriveCmd = new DeriveAssetCommand(machine as any, (targetEnv as any).fqn, machine.assetKey);
            commands.push(deriveCmd);
            targetMachineFqn = deriveCmd.derivedAsset.fqn;
          }
        }

        const keyFqn = `${targetMachineFqn}::${node.assetKey}`;
        if (!assetsStore.unmergedAssets.some(a => a.assetType === ASSET_TYPES.NODE_KEY && a.fqn === keyFqn)) {
          commands.push(new CreateAssetCommand({
            assetType: ASSET_TYPES.NODE_KEY,
            assetKey: node.assetKey,
            fqn: keyFqn,
            templateFqn: null,
            overrides: {},
          }));
        }

        if (commands.length > 0) {
          workspaceStore.executeCommand(commands.length > 1 ? new CompositeCommand(commands) : commands[0]);
        }
      }
    }
  ]
};

// Assign a Node to a Machine (create NodeKey under Machine for the Node)
const assignNodeToMachineRule: InteractionRule = {
  validate: (dragPayload, dropTarget) => {
    const assetsStore = useAssetsStore();
    const node = assetsStore.unmergedAssets.find(a => a.id === dragPayload.assetId);
    const machine = assetsStore.unmergedAssets.find(a => a.id === dropTarget.id);

    if (!node || !machine || node.assetType !== ASSET_TYPES.NODE || machine.assetType !== ASSET_TYPES.MACHINE) {
      return { isValid: false, reason: 'Invalid drag and drop types.' };
    }

    const nodeDistro = getDistroForAsset(node as any, assetsStore.assetsWithOverrides);
    if (!nodeDistro) {
      return { isValid: false, reason: 'Could not resolve Node\'s distro.' };
    }

    // Inheritance-aware environment check handles inherited machines under the active environment
    const ok = isSameEnvironmentForNodeAssignment(machine as any, node as any, assetsStore.assetsWithOverrides);
    if (!ok) {
      return { isValid: false, reason: 'This Machine does not belong to the Environment that uses this Node\'s distro.' };
    }

    // Duplicate check: Machine already has NodeKey for this Node
    const expectedKeyFqn = `${machine.fqn}::${node.assetKey}`;
    const existing = assetsStore.unmergedAssets.find(a => a.assetType === ASSET_TYPES.NODE_KEY && a.fqn === expectedKeyFqn);
    if (existing) {
      return { isValid: false, reason: `Machine already assigned to '${node.assetKey}'.` };
    }

    return { isValid: true };
  },
  actions: [{
    id: 'assign-node-to-machine',
    label: 'Assign to Machine',
    icon: 'mdi-link-plus',
    cursor: 'link',
    execute: (dragPayload, dropTarget) => {
      const assetsStore = useAssetsStore();
      const workspaceStore = getWorkspaceStore();
      const coreConfig = useCoreConfigStore();

      const node = assetsStore.unmergedAssets.find(a => a.id === dragPayload.assetId)!;
      const machine = assetsStore.unmergedAssets.find(a => a.id === dropTarget.id)!;

      // Identify the environment that is effectively using this machine for the node's distro
      const nodeDistro = getDistroForAsset(node as any, assetsStore.assetsWithOverrides);
      if (!nodeDistro) return;

      const environments = assetsStore.unmergedAssets.filter(a => a.assetType === ASSET_TYPES.ENVIRONMENT);
      const targetEnv = environments.find(env => {
        const selected = (env as any).overrides?.distroFqn as string | undefined;
        if (!selected) return false;
        const matches = selected === nodeDistro.fqn || nodeDistro.fqn.startsWith(selected + '::');
        if (!matches) return false;
        const envMachines = resolveInheritedCollection(
          env as any,
          ASSET_TYPES.MACHINE,
          assetsStore.unmergedAssets,
          coreConfig.effectiveAssetRegistry
        );
        return envMachines.some(m => m.id === machine.id);
      });

      // Fallback: if not found, simply create key under current machine
      if (!targetEnv) {
        workspaceStore.executeCommand(new CreateAssetCommand({
          assetType: ASSET_TYPES.NODE_KEY,
          assetKey: node.assetKey,
          fqn: `${machine.fqn}::${node.assetKey}`,
          templateFqn: null,
          overrides: {},
        }));
        return;
      }

      // Ensure a local derived machine exists under the target environment
      const owningEnv = getEnvironmentForAsset(machine as any, assetsStore.assetsWithOverrides);
      const ownedByTarget = owningEnv && owningEnv.id === targetEnv.id;

      const existingLocalMachine = assetsStore.unmergedAssets.find(a =>
        a.assetType === ASSET_TYPES.MACHINE && a.fqn === `${targetEnv.fqn}::${machine.assetKey}`
      );

      const commands: (DeriveAssetCommand | CreateAssetCommand)[] = [];
      let targetMachineFqn = machine.fqn;

      if (!ownedByTarget) {
        if (existingLocalMachine) {
          targetMachineFqn = (existingLocalMachine as any).fqn;
        } else {
          const deriveCmd = new DeriveAssetCommand(machine as any, targetEnv.fqn, machine.assetKey);
          commands.push(deriveCmd);
          targetMachineFqn = deriveCmd.derivedAsset.fqn;
        }
      }

      const keyFqn = `${targetMachineFqn}::${node.assetKey}`;
      if (!assetsStore.unmergedAssets.some(a => a.assetType === ASSET_TYPES.NODE_KEY && a.fqn === keyFqn)) {
        commands.push(new CreateAssetCommand({
          assetType: ASSET_TYPES.NODE_KEY,
          assetKey: node.assetKey,
          fqn: keyFqn,
          templateFqn: null,
          overrides: {},
        }));
      }

      if (commands.length > 0) {
        workspaceStore.executeCommand(commands.length > 1 ? new CompositeCommand(commands) : commands[0]);
      }
    }
  }]
};

// Reassign a NodeKey to a different Machine (keep assetKey, change parent FQN)
const reassignNodeKeyToMachineRule: InteractionRule = {
  validate: (dragPayload, dropTarget) => {
    const assetsStore = useAssetsStore();
    const nodeKeyAsset = assetsStore.unmergedAssets.find(a => a.id === dragPayload.assetId);
    const targetMachineAsset = assetsStore.unmergedAssets.find(a => a.id === dropTarget.id);

    if (!nodeKeyAsset || nodeKeyAsset.assetType !== ASSET_TYPES.NODE_KEY ||
        !targetMachineAsset || targetMachineAsset.assetType !== ASSET_TYPES.MACHINE) {
      return { isValid: false, reason: 'Invalid drag/drop types.' };
    }

    // Get source machine from parentAssetId or FQN
    const sourceMachineAsset = assetsStore.unmergedAssets.find(a => a.id === dragPayload.parentAssetId);
    if (!sourceMachineAsset) {
      // Fallback: extract from FQN
      const fqnParts = nodeKeyAsset.fqn.split('::');
      if (fqnParts.length < 2) {
        return { isValid: false, reason: 'Could not determine source machine.' };
      }
      const sourceMachineFqn = fqnParts.slice(0, -1).join('::');
      const found = assetsStore.unmergedAssets.find(a => a.fqn === sourceMachineFqn && a.assetType === ASSET_TYPES.MACHINE);
      if (!found) {
        return { isValid: false, reason: 'Source machine not found.' };
      }
      if (found.id === targetMachineAsset.id) {
        return { isValid: false, reason: 'Cannot move to the same machine.' };
      }
    } else {
      if (sourceMachineAsset.id === targetMachineAsset.id) {
        return { isValid: false, reason: 'Cannot move to the same machine.' };
      }
    }

    // Duplicate check: Target machine already has NodeKey for this node type
    const expectedNewKeyFqn = `${targetMachineAsset.fqn}::${nodeKeyAsset.assetKey}`;
    const existingKey = assetsStore.unmergedAssets.find(key => key.fqn === expectedNewKeyFqn);
    if (existingKey) {
      return { isValid: false, reason: `Machine '${targetMachineAsset.assetKey}' already has Node '${nodeKeyAsset.assetKey}' assigned.` };
    }

    return { isValid: true };
  },
  actions: [{
    id: 'reassign-nodekey-to-machine',
    label: 'Move to Machine',
    icon: 'mdi-file-move',
    cursor: 'move',
    execute: (dragPayload, dropTarget) => {
      const assetsStore = useAssetsStore();
      const workspaceStore = getWorkspaceStore();
      const nodeKeyAsset = assetsStore.unmergedAssets.find(a => a.id === dragPayload.assetId);
      const targetMachineAsset = assetsStore.unmergedAssets.find(a => a.id === dropTarget.id);

      if (!nodeKeyAsset || !targetMachineAsset) {
        console.error('Reassign failed: Assets not found.');
        return;
      }

      const oldFqn = nodeKeyAsset.fqn;
      const newFqn = `${targetMachineAsset.fqn}::${nodeKeyAsset.assetKey}`;

      console.debug('[DND][Execute] Moving NodeKey to different Machine:', { 
        nodeKey: oldFqn, 
        targetMachine: targetMachineAsset.fqn,
        newFqn 
      });

      // Use UpdateAssetCommand to change FQN
      const oldData = nodeKeyAsset;
      const newData = cloneDeep(oldData);
      newData.fqn = newFqn;

      const command = new UpdateAssetCommand(nodeKeyAsset.id, oldData, newData);
      workspaceStore.executeCommand(command);
    }
  }]
};

export const infrastructureInteractions: InteractionRuleEntry[] = [
  {
    draggedType: ASSET_TYPES.DISTRO,
    targetType: ASSET_TYPES.ENVIRONMENT,
    perspectives: ['environment', 'default'],
    rule: assignDistroToEnvironmentRule,
  },
  {
    draggedType: ASSET_TYPES.MACHINE,
    targetType: ASSET_TYPES.NODE,
    perspectives: ['environment', 'default'],
    rule: assignMachineToNodeRule,
  },
  {
    draggedType: ASSET_TYPES.NODE_KEY,
    targetType: ASSET_TYPES.NODE,
    perspectives: ['environment', 'default'],
    rule: reassignNodeKeyRule,
  },
  {
    draggedType: ASSET_TYPES.NODE,
    targetType: ASSET_TYPES.MACHINE,
    perspectives: ['default', 'environment'],
    rule: assignNodeToMachineRule,
  },
  {
    draggedType: ASSET_TYPES.NODE_KEY,
    targetType: ASSET_TYPES.MACHINE,
    perspectives: ['default', 'environment'],
    rule: reassignNodeKeyToMachineRule,
  },
];


