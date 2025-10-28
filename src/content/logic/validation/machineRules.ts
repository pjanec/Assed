import type { ValidationRule, ValidationIssue } from '@/core/types/validation';
import type { UnmergedAsset } from '@/core/types';
import { ASSET_TYPES } from '@/content/config/constants';
import { getParentPath } from '@/core/utils/fqnUtils';
import { useAssetsStore } from '@/core/stores';
import { calculateMergedAsset } from '@/core/utils/mergeUtils';
import { getAssetDistroFqn } from '@/content/utils/assetUtils';
import { isEqual } from 'lodash-es';

export const unresolvedNodeKey: ValidationRule = (asset, allAssets): ValidationIssue | null => {
  if (asset.assetType !== ASSET_TYPES.NODE_KEY) {
    return null;
  }

  const parentMachineFqn = getParentPath(asset.fqn);
  if (!parentMachineFqn) return null;

  const grandparentEnvironmentFqn = getParentPath(parentMachineFqn);
  if (!grandparentEnvironmentFqn) {
    return {
      id: `${asset.id}-no-env`,
      severity: 'error',
      message: `Node Assignment '${asset.assetKey}' must be located under a Machine within an Environment.`,
      assetId: asset.id, assetName: asset.assetKey, assetType: asset.assetType,
    };
  }

  const environmentAsset = allAssets.find(a => a.fqn === grandparentEnvironmentFqn && a.assetType === ASSET_TYPES.ENVIRONMENT) as UnmergedAsset | undefined;
  if (!environmentAsset) {
    return null;
  }

  const targetDistroFqn = (environmentAsset as UnmergedAsset).overrides?.distroFqn as string | undefined;
  if (!targetDistroFqn) {
    return {
      id: `${asset.id}-no-distro-selected`,
      severity: 'warning',
      message: `Node Assignment '${asset.assetKey}' cannot be validated because the parent Environment '${environmentAsset.assetKey}' has no Source Distro selected.`,
      assetId: asset.id, assetName: asset.assetKey, assetType: asset.assetType,
    };
  }

  const isResolved = allAssets.some(node =>
    node.assetType === ASSET_TYPES.NODE &&
    node.assetKey === asset.assetKey &&
    (node.fqn === targetDistroFqn || node.fqn.startsWith(targetDistroFqn + '::'))
  );

  if (!isResolved) {
    return {
      id: `${asset.id}-unresolved-node`,
      severity: 'error',
      message: `The required Node '${asset.assetKey}' is not defined in the selected Distro '${targetDistroFqn}'.`,
      assetId: asset.id, assetName: asset.assetKey, assetType: asset.assetType,
    };
  }

  return null;
};

/**
 * Validates a Machine asset for configuration and package collisions
 * based on its assigned NodeKeys.
 */
export const detectMachineCollisions: ValidationRule = (asset, allAssets): ValidationIssue | null => {
  if (asset.assetType !== ASSET_TYPES.MACHINE) {
    return null;
  }

  const machine = asset;
  const assetsStore = useAssetsStore();

  // Find the parent environment by going up the FQN tree
  const parts = machine.fqn.split('::');
  const parentEnvFqn = parts.slice(0, -1).join('::');
  
  const environmentAsset = allAssets.find(a => a.fqn === parentEnvFqn && a.assetType === ASSET_TYPES.ENVIRONMENT);
  
  // Get the full asset details to access overrides
  let selectedDistroFqn: string | undefined = undefined;
  if (environmentAsset) {
    const envDetails = assetsStore.assetDetails.get(environmentAsset.id);
    selectedDistroFqn = envDetails?.unmerged?.overrides?.distroFqn;
  }

  if (!selectedDistroFqn) {
    return {
      id: `${machine.id}-no-distro-for-collision-check`,
      severity: 'warning',
      message: 'Cannot check for collisions: Parent Environment has no Source Distro selected.',
      assetId: machine.id,
      assetName: machine.assetKey,
      assetType: machine.assetType,
    };
  }

  const assignedNodeKeys = allAssets.filter(key =>
    key.assetType === ASSET_TYPES.NODE_KEY &&
    key.fqn.startsWith(machine.fqn + '::')
  );

  if (assignedNodeKeys.length < 2) {
    return null;
  }

  // Build a proper assetsMap for merge calculation
  const allAssetsMap = new Map();
  for (const asset of allAssets) {
    const details = assetsStore.assetDetails.get(asset.id);
    if (details) {
      allAssetsMap.set(asset.id, details.unmerged);
    }
  }
  
  const machinePackages = new Map<string, { version?: string; sourceNodeKeyFqn: string; incompatibleWith?: string[] }>();
  const machineProperties = new Map<string, { value: any; sourceNodeKeyFqn: string }>();
  let hasErrors = false;
  const errorMessages: string[] = [];

  for (const nodeKey of assignedNodeKeys) {
    const resolvedNode = allAssets.find(n =>
      n.assetType === ASSET_TYPES.NODE &&
      n.assetKey === nodeKey.assetKey &&
      (n.fqn === selectedDistroFqn || n.fqn.startsWith(selectedDistroFqn + '::'))
    );

    if (!resolvedNode) continue;

    const nodeMergedResult = calculateMergedAsset(resolvedNode.id, allAssetsMap);
    if ('properties' in nodeMergedResult && nodeMergedResult.properties) {
      const flatProps = flattenObject(nodeMergedResult.properties);
      for (const path in flatProps) {
        if (machineProperties.has(path)) {
          const existing = machineProperties.get(path)!;
          if (!isEqual(existing.value, flatProps[path])) {
            hasErrors = true;
            errorMessages.push(`Configuration Collision: Property '${path}' defined differently by '${nodeKey.fqn}' (${JSON.stringify(flatProps[path])}) and '${existing.sourceNodeKeyFqn}' (${JSON.stringify(existing.value)}).`);
          }
        } else {
          machineProperties.set(path, { value: flatProps[path], sourceNodeKeyFqn: nodeKey.fqn });
        }
      }
    }

    const requiredPackageKeys = allAssets.filter(pk =>
      pk.assetType === ASSET_TYPES.PACKAGE_KEY && pk.fqn.startsWith(resolvedNode.fqn + '::')
    );

    for (const pkgKey of requiredPackageKeys) {
      const resolvedPackage = allAssets.find(p =>
        p.assetType === ASSET_TYPES.PACKAGE &&
        p.assetKey === pkgKey.assetKey &&
        (p.fqn === selectedDistroFqn || p.fqn.startsWith(selectedDistroFqn + '::') || getAssetDistroFqn(p.fqn, allAssets) === null)
      );

      if (!resolvedPackage) continue;

      const packageMergedResult = calculateMergedAsset(resolvedPackage.id, allAssetsMap);
      let version: string | undefined = undefined;
      let incompatibleWith: string[] | undefined = undefined;
      if ('properties' in packageMergedResult && packageMergedResult.properties) {
        version = packageMergedResult.properties?.version;
        incompatibleWith = packageMergedResult.properties?.incompatibleWith;
      }

      const packageIdentifier = resolvedPackage.assetKey;

      if (machinePackages.has(packageIdentifier)) {
        const existing = machinePackages.get(packageIdentifier)!;
        if (version && existing.version && version !== existing.version) {
          hasErrors = true;
          errorMessages.push(`Package Version Collision: Node '${nodeKey.assetKey}' requires '${packageIdentifier}' version '${version}', but Node '${existing.sourceNodeKeyFqn.split('::').pop()}' requires version '${existing.version}'.`);
        }
      } else {
        machinePackages.set(packageIdentifier, { version, sourceNodeKeyFqn: nodeKey.fqn, incompatibleWith });
      }
    }
  }

  const packageList = Array.from(machinePackages.entries());
  for (let i = 0; i < packageList.length; i++) {
    const [pkgAIdentifier, pkgAData] = packageList[i];
    if (!pkgAData.incompatibleWith || pkgAData.incompatibleWith.length === 0) continue;

    for (let j = i + 1; j < packageList.length; j++) {
      const [pkgBIdentifier, pkgBData] = packageList[j];

      if (pkgAData.incompatibleWith.some(pattern => matchesIncompatibility(pkgBIdentifier, pattern))) {
        hasErrors = true;
        errorMessages.push(`Indirect Package Collision: '${pkgAIdentifier}' (from '${pkgAData.sourceNodeKeyFqn.split('::').pop()}') is incompatible with '${pkgBIdentifier}' (from '${pkgBData.sourceNodeKeyFqn.split('::').pop()}').`);
      }
      if (pkgBData.incompatibleWith?.some(pattern => matchesIncompatibility(pkgAIdentifier, pattern))) {
        hasErrors = true;
        errorMessages.push(`Indirect Package Collision: '${pkgBIdentifier}' (from '${pkgBData.sourceNodeKeyFqn.split('::').pop()}') is incompatible with '${pkgAIdentifier}' (from '${pkgAData.sourceNodeKeyFqn.split('::').pop()}').`);
      }
    }
  }

  if (hasErrors) {
    return {
      id: `${machine.id}-collision`,
      severity: 'error',
      message: `Machine has ${errorMessages.length} collision(s):\n- ${errorMessages.join('\n- ')}`,
      assetId: machine.id,
      assetName: machine.assetKey,
      assetType: machine.assetType,
    };
  }

  return null;
};

function flattenObject(obj: any, parentKey = '', res: Record<string, any> = {}): Record<string, any> {
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const newKey = parentKey ? `${parentKey}.${key}` : key;
      if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
        flattenObject(obj[key], newKey, res);
      } else {
        res[newKey] = obj[key];
      }
    }
  }
  return res;
}

function matchesIncompatibility(packageName: string, pattern: string): boolean {
  if (pattern.endsWith('::*')) {
    const basePattern = pattern.slice(0, -3);
    return packageName.startsWith(basePattern + '::');
  }
  return packageName === pattern;
}


