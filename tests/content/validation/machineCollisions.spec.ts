import { describe, it, expect, beforeEach } from 'vitest';
import { createTestEnvironment } from '../../test-utils';
import { ASSET_TYPES } from '@/content/config/constants';
import type { UnmergedAsset } from '@/core/types';
import { getValidationRulesForType } from '@/core/registries/validationRegistry';

describe('Machine Collision Detection', () => {
  it('should pass validation for machine with no collisions', async () => {
    const distro: UnmergedAsset = {
      id: 'distro-1',
      fqn: 'TestDistro',
      assetType: ASSET_TYPES.DISTRO,
      assetKey: 'TestDistro',
      templateFqn: null,
      overrides: {}
    };

    const node1: UnmergedAsset = {
      id: 'node-1',
      fqn: 'TestDistro::WebServerNode',
      assetType: ASSET_TYPES.NODE,
      assetKey: 'WebServerNode',
      templateFqn: null,
      overrides: {}
    };

    const node2: UnmergedAsset = {
      id: 'node-2',
      fqn: 'TestDistro::DatabaseNode',
      assetType: ASSET_TYPES.NODE,
      assetKey: 'DatabaseNode',
      templateFqn: null,
      overrides: {}
    };

    const environment: UnmergedAsset = {
      id: 'env-1',
      fqn: 'TestEnv',
      assetType: ASSET_TYPES.ENVIRONMENT,
      assetKey: 'TestEnv',
      templateFqn: null,
      overrides: {
        distroFqn: 'TestDistro'
      }
    };

    const machine: UnmergedAsset = {
      id: 'machine-1',
      fqn: 'TestEnv::MachineA',
      assetType: ASSET_TYPES.MACHINE,
      assetKey: 'MachineA',
      templateFqn: null,
      overrides: {}
    };

    const nodeKey1: UnmergedAsset = {
      id: 'nodekey-1',
      fqn: 'TestEnv::MachineA::WebServerNode',
      assetType: ASSET_TYPES.NODE_KEY,
      assetKey: 'WebServerNode',
      templateFqn: null,
      overrides: {}
    };

    const nodeKey2: UnmergedAsset = {
      id: 'nodekey-2',
      fqn: 'TestEnv::MachineA::DatabaseNode',
      assetType: ASSET_TYPES.NODE_KEY,
      assetKey: 'DatabaseNode',
      templateFqn: null,
      overrides: {}
    };

    const env = createTestEnvironment([distro, node1, node2, environment, machine, nodeKey1, nodeKey2]);
    await env.assetsStore.loadAssets();

    // Load asset details for all assets to ensure overrides are available
    for (const asset of [distro, node1, node2, environment, machine, nodeKey1, nodeKey2]) {
      const details = await env.mockAdapter.loadAssetDetails(asset.id);
      env.assetsStore.assetDetails.set(asset.id, details);
    }

    const rules = getValidationRulesForType(ASSET_TYPES.MACHINE);
    const collisionRule = rules.find(r => r.toString().includes('detectMachineCollisions')) || rules[rules.length - 1];
    const issue = collisionRule(machine, env.assetsStore.unmergedAssets);

    expect(issue).toBeNull();
  });

  it('should detect property collision', async () => {
    const distro: UnmergedAsset = {
      id: 'distro-1',
      fqn: 'TestDistro',
      assetType: ASSET_TYPES.DISTRO,
      assetKey: 'TestDistro',
      templateFqn: null,
      overrides: {}
    };

    const node1: UnmergedAsset = {
      id: 'node-1',
      fqn: 'TestDistro::WebServerNode',
      assetType: ASSET_TYPES.NODE,
      assetKey: 'WebServerNode',
      templateFqn: null,
      overrides: {
        config: { port: 80 }
      }
    };

    const node2: UnmergedAsset = {
      id: 'node-2',
      fqn: 'TestDistro::DatabaseNode',
      assetType: ASSET_TYPES.NODE,
      assetKey: 'DatabaseNode',
      templateFqn: null,
      overrides: {
        config: { port: 8081 }
      }
    };

    const environment: UnmergedAsset = {
      id: 'env-1',
      fqn: 'TestEnv',
      assetType: ASSET_TYPES.ENVIRONMENT,
      assetKey: 'TestEnv',
      templateFqn: null,
      overrides: {
        distroFqn: 'TestDistro'
      }
    };

    const machine: UnmergedAsset = {
      id: 'machine-1',
      fqn: 'TestEnv::MachineA',
      assetType: ASSET_TYPES.MACHINE,
      assetKey: 'MachineA',
      templateFqn: null,
      overrides: {}
    };

    const nodeKey1: UnmergedAsset = {
      id: 'nodekey-1',
      fqn: 'TestEnv::MachineA::WebServerNode',
      assetType: ASSET_TYPES.NODE_KEY,
      assetKey: 'WebServerNode',
      templateFqn: null,
      overrides: {}
    };

    const nodeKey2: UnmergedAsset = {
      id: 'nodekey-2',
      fqn: 'TestEnv::MachineA::DatabaseNode',
      assetType: ASSET_TYPES.NODE_KEY,
      assetKey: 'DatabaseNode',
      templateFqn: null,
      overrides: {}
    };

    const env = createTestEnvironment([distro, node1, node2, environment, machine, nodeKey1, nodeKey2]);
    await env.assetsStore.loadAssets();

    // Load asset details for all assets to ensure overrides are available
    for (const asset of [distro, node1, node2, environment, machine, nodeKey1, nodeKey2]) {
      const details = await env.mockAdapter.loadAssetDetails(asset.id);
      env.assetsStore.assetDetails.set(asset.id, details);
    }

    const rules = getValidationRulesForType(ASSET_TYPES.MACHINE);
    const collisionRule = rules.find(r => r.toString().includes('detectMachineCollisions')) || rules[rules.length - 1];
    const issue = collisionRule(machine, env.assetsStore.unmergedAssets);

    expect(issue).toBeDefined();
    expect(issue?.severity).toBe('error');
    expect(issue?.message).toContain('Configuration Collision');
    expect(issue?.message).toContain('port');
  });

  it('should detect indirect package collision via incompatibleWith', async () => {
    const distro: UnmergedAsset = {
      id: 'distro-1',
      fqn: 'TestDistro',
      assetType: ASSET_TYPES.DISTRO,
      assetKey: 'TestDistro',
      templateFqn: null,
      overrides: {}
    };

    const node1: UnmergedAsset = {
      id: 'node-1',
      fqn: 'TestDistro::WebServerNode',
      assetType: ASSET_TYPES.NODE,
      assetKey: 'WebServerNode',
      templateFqn: null,
      overrides: {}
    };

    const node2: UnmergedAsset = {
      id: 'node-2',
      fqn: 'TestDistro::DatabaseNode',
      assetType: ASSET_TYPES.NODE,
      assetKey: 'DatabaseNode',
      templateFqn: null,
      overrides: {}
    };

    const package1: UnmergedAsset = {
      id: 'pkg-1',
      fqn: 'TestDistro::Nginx',
      assetType: ASSET_TYPES.PACKAGE,
      assetKey: 'Nginx',
      templateFqn: null,
      overrides: {
        incompatibleWith: ['Apache']
      }
    };

    const package2: UnmergedAsset = {
      id: 'pkg-2',
      fqn: 'TestDistro::Apache',
      assetType: ASSET_TYPES.PACKAGE,
      assetKey: 'Apache',
      templateFqn: null,
      overrides: {}
    };

    const packageKey1: UnmergedAsset = {
      id: 'pkg-key-1',
      fqn: 'TestDistro::WebServerNode::Nginx',
      assetType: ASSET_TYPES.PACKAGE_KEY,
      assetKey: 'Nginx',
      templateFqn: null,
      overrides: {}
    };

    const packageKey2: UnmergedAsset = {
      id: 'pkg-key-2',
      fqn: 'TestDistro::DatabaseNode::Apache',
      assetType: ASSET_TYPES.PACKAGE_KEY,
      assetKey: 'Apache',
      templateFqn: null,
      overrides: {}
    };

    const environment: UnmergedAsset = {
      id: 'env-1',
      fqn: 'TestEnv',
      assetType: ASSET_TYPES.ENVIRONMENT,
      assetKey: 'TestEnv',
      templateFqn: null,
      overrides: {
        distroFqn: 'TestDistro'
      }
    };

    const machine: UnmergedAsset = {
      id: 'machine-1',
      fqn: 'TestEnv::MachineA',
      assetType: ASSET_TYPES.MACHINE,
      assetKey: 'MachineA',
      templateFqn: null,
      overrides: {}
    };

    const nodeKey1: UnmergedAsset = {
      id: 'nodekey-1',
      fqn: 'TestEnv::MachineA::WebServerNode',
      assetType: ASSET_TYPES.NODE_KEY,
      assetKey: 'WebServerNode',
      templateFqn: null,
      overrides: {}
    };

    const nodeKey2: UnmergedAsset = {
      id: 'nodekey-2',
      fqn: 'TestEnv::MachineA::DatabaseNode',
      assetType: ASSET_TYPES.NODE_KEY,
      assetKey: 'DatabaseNode',
      templateFqn: null,
      overrides: {}
    };

    const env = createTestEnvironment([
      distro, node1, node2, package1, package2, packageKey1, packageKey2,
      environment, machine, nodeKey1, nodeKey2
    ]);
    await env.assetsStore.loadAssets();

    // Load asset details for all assets to ensure overrides are available
    const allAssets = [distro, node1, node2, package1, package2, packageKey1, packageKey2, environment, machine, nodeKey1, nodeKey2];
    for (const asset of allAssets) {
      const details = await env.mockAdapter.loadAssetDetails(asset.id);
      env.assetsStore.assetDetails.set(asset.id, details);
    }

    const rules = getValidationRulesForType(ASSET_TYPES.MACHINE);
    const collisionRule = rules.find(r => r.toString().includes('detectMachineCollisions')) || rules[rules.length - 1];
    const issue = collisionRule(machine, env.assetsStore.unmergedAssets);

    expect(issue).toBeDefined();
    expect(issue?.severity).toBe('error');
    expect(issue?.message).toContain('Indirect Package Collision');
    expect(issue?.message).toContain('Nginx');
    expect(issue?.message).toContain('Apache');
  });

  it('should return warning when environment has no distro selected', async () => {
    const environment: UnmergedAsset = {
      id: 'env-1',
      fqn: 'TestEnv',
      assetType: ASSET_TYPES.ENVIRONMENT,
      assetKey: 'TestEnv',
      templateFqn: null,
      overrides: {}
    };

    const machine: UnmergedAsset = {
      id: 'machine-1',
      fqn: 'TestEnv::MachineA',
      assetType: ASSET_TYPES.MACHINE,
      assetKey: 'MachineA',
      templateFqn: null,
      overrides: {}
    };

    const nodeKey1: UnmergedAsset = {
      id: 'nodekey-1',
      fqn: 'TestEnv::MachineA::WebServerNode',
      assetType: ASSET_TYPES.NODE_KEY,
      assetKey: 'WebServerNode',
      templateFqn: null,
      overrides: {}
    };

    const nodeKey2: UnmergedAsset = {
      id: 'nodekey-2',
      fqn: 'TestEnv::MachineA::DatabaseNode',
      assetType: ASSET_TYPES.NODE_KEY,
      assetKey: 'DatabaseNode',
      templateFqn: null,
      overrides: {}
    };

    const env = createTestEnvironment([environment, machine, nodeKey1, nodeKey2]);
    await env.assetsStore.loadAssets();

    // Load asset details for all assets to ensure overrides are available
    for (const asset of [environment, machine, nodeKey1, nodeKey2]) {
      const details = await env.mockAdapter.loadAssetDetails(asset.id);
      env.assetsStore.assetDetails.set(asset.id, details);
    }

    const rules = getValidationRulesForType(ASSET_TYPES.MACHINE);
    const collisionRule = rules.find(r => r.toString().includes('detectMachineCollisions')) || rules[rules.length - 1];
    const issue = collisionRule(machine, env.assetsStore.unmergedAssets);

    expect(issue).toBeDefined();
    expect(issue?.severity).toBe('warning');
    expect(issue?.message).toContain('no Source Distro selected');
  });
});

