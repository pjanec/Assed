// mockData.js - Sample data for the Asset Editor
// This represents the data structure that would be returned by the real API

export const mockData = {
  // ... (recentDistros and builds arrays remain the same) ...
  recentDistros: [
    {
      id: 'uuid-200',
      name: 'DataCenter-minimal',
      status: 'Draft',
      lastModified: '2025-09-08T14:30:00Z',
      description: 'A minimal configuration for the Data Center distro'
    },
    {
      id: 'uuid-201',
      name: 'Dev-Env',
      status: 'Committed',
      lastModified: '2025-09-07T16:45:00Z',
      description: 'Production distro for Data Center'
    }
  ],
  builds: [
    {
      id: 'build-1694123456789',
      distro: 'DataCenter-minimal',
      distroId: 'uuid-200',
      status: 'Successful',
      commitMessage: 'Initial deployment setup',
      triggeredBy: 'jane.doe@asseted.com',
      startTime: '2025-09-08T10:00:00Z',
      endTime: '2025-09-08T10:02:30Z',
      duration: 150000,
      log: '[10:00:00] Build started...\n[10:01:00] Fetching resources...\n[10:02:00] Deploying 5 packages...\n[10:02:30] Build successful.'
    },
    {
      id: 'build-1694037056789',
      distro: 'Dev-Env',
      distroId: 'uuid-201',
      status: 'Failed',
      commitMessage: 'Add new web server configuration',
      triggeredBy: 'john.smith@asseted.com',
      startTime: '2025-09-07T15:00:00Z',
      endTime: '2025-09-07T15:01:15Z',
      duration: 75000,
      log: '[15:00:00] Build started...\n[15:01:00] ERROR: Nginx package failed to install. Check permissions.'
    },
    {
      id: 'build-1693950656789',
      distro: 'Dev-Env',
      distroId: 'uuid-201',
      status: 'Successful',
      commitMessage: 'Initial setup for dev distro',
      triggeredBy: 'john.smith@asseted.com',
      startTime: '2025-09-06T12:00:00Z',
      endTime: '2025-09-06T12:03:00Z',
      duration: 180000,
      log: '[12:00:00] Build started...\n[12:03:00] Build successful.'
    }
  ],

  // Assets manifest (lightweight list for Explorer tree)
  assets: [
    // --- ADDED START ---
    {
      id: 'uuid-tpl-001',
      fqn: 'Shared-WebServer-Template',
  assetType: 'Package' as const,
      assetKey: 'Shared-WebServer-Template',

    },
    {
      id: 'uuid-tpl-002',
      fqn: 'BaseWebServer',
  assetType: 'Package' as const,
      assetKey: 'BaseWebServer',

    },
    // --- ADDED END ---
    {
      id: 'uuid-skel-001',
      fqn: 'skeletons::SampleSkeletons::SampleUser',
  assetType: 'Package' as const,
      assetKey: 'SampleUser',

    },
    {
      id: 'uuid-skel-002',
      fqn: 'skeletons::SampleSkeletons::SampleService',
  assetType: 'Package' as const,
      assetKey: 'SampleService',

    },
    {
      id: 'uuid-200',
      fqn: 'DataCenter-minimal',
  assetType: 'Distro' as const,
      assetKey: 'DataCenter-minimal',

    },
    {
      id: 'uuid-201',
      fqn: 'Dev-Env',
  assetType: 'Distro' as const,
      assetKey: 'Dev-Env',

    },
    {
      id: 'uuid-100',
      fqn: 'DataCenter-minimal::WebServer',
  assetType: 'Node' as const,
      assetKey: 'WebServer',

    },
    {
      id: 'uuid-101', 
      fqn: 'DataCenter-minimal::Database',
  assetType: 'Node' as const,
      assetKey: 'Database',

    },
    {
      id: 'uuid-103',
      fqn: 'Dev-Env::WebServer',
  assetType: 'Node' as const,
      assetKey: 'WebServer', 

    },
    {
      id: 'uuid-001',
      fqn: 'BasePackage',
  assetType: 'Package' as const,
      assetKey: 'BasePackage',

    },
    {
      id: 'uuid-002',
      fqn: 'NodeManager-bin',
  assetType: 'Package' as const,
      assetKey: 'NodeManager-bin',

    },
    {
      id: 'uuid-003',
      fqn: 'StorageGuard-bin',
  assetType: 'Package' as const,
      assetKey: 'StorageGuard-bin',

    },
    {
      id: 'uuid-102',
      fqn: 'DataCenter-minimal::WebServer::Nginx',
  assetType: 'Package' as const,
      assetKey: 'Nginx',

    },
    {
      id: 'uuid-110',
      fqn: 'DataCenter-minimal::WebServer::PHP-FPM',
  assetType: 'Package' as const,
      assetKey: 'PHP-FPM',

    },
    {
      id: 'uuid-111', 
      fqn: 'DataCenter-minimal::WebServer::SSL-Certs',
  assetType: 'Package' as const,
      assetKey: 'SSL-Certs',

    },
    {
      id: 'uuid-104',
      fqn: 'DataCenter-minimal::Database::PostgreSQL', 
  assetType: 'Package' as const,
      assetKey: 'PostgreSQL',

    },
    {
      id: 'uuid-112',
      fqn: 'DataCenter-minimal::Database::Redis',
  assetType: 'Package' as const,
      assetKey: 'Redis',

    },
    {
      id: 'uuid-113',
      fqn: 'DataCenter-minimal::Database::DB-Backup',
  assetType: 'Package' as const,
      assetKey: 'DB-Backup',

    },
    {
      id: 'uuid-205',
      fqn: 'DataCenter-minimal::Options',
  assetType: 'Option' as const,
      assetKey: 'Options',

    },
    {
      id: 'uuid-206',
      fqn: 'DataCenter-minimal::Options::LoadBalancer',
  assetType: 'Option' as const,
      assetKey: 'LoadBalancer',

    }
  ],

  // Unmerged asset data
  unmergedAssets: {
    // --- ADDED START ---
    'uuid-tpl-001': {
      id: 'uuid-tpl-001',
      fqn: 'Shared-WebServer-Template',
  assetType: 'Package' as const,
      assetKey: 'Shared-WebServer-Template',

      templateFqn: null,
      overrides: {
        name: 'shared-webserver-tpl',
        conf: {
          port: 80,
          ssl: false,
          license: 'MIT'
        }
      }
    },
    'uuid-tpl-002': {
      id: 'uuid-tpl-002',
      fqn: 'BaseWebServer',
  assetType: 'Package' as const,
      assetKey: 'BaseWebServer',

      templateFqn: 'Shared-WebServer-Template',
      overrides: {
        name: 'base-webserver',
        conf: {
          resources: {
            cpu: '0.5 cores'
          }
        }
      }
    },
    // --- ADDED END ---

    'uuid-skel-001': {
      id: 'uuid-skel-001',
  assetType: 'Package' as const,
      fqn: 'skeletons::SampleSkeletons::SampleUser',
      assetKey: 'SampleUser',

      templateFqn: null,
      overrides: {
        "name": "Sample User Skeleton",
        "Files": {
          "tools/install.ps1": { "content": "Write-Host 'Running User Install Script'" },
          "tools/backup.ps1": { "content": "Write-Host 'Backing up user data...'" }
        }
      },
    },

    'uuid-skel-002': {
      id: 'uuid-skel-002',
  assetType: 'Package' as const,
      fqn: 'skeletons::SampleSkeletons::SampleService',
      assetKey: 'SampleService',

      templateFqn: null,
      overrides: {
        "name": "Sample Service Skeleton",
        "Files": {
          "tools/start.ps1": { "content": "Start-Service -Name 'SampleService'" },
          "tools/stop.ps1": { "content": "Stop-Service -Name 'SampleService'" },
          "data/icon.png": { "content": "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAFJElEQVR42tWWC1CUVRTH/7ss7xZY2FXACMiKcBpQdC3EFumBr8xRXhakw5gQlYPOJIholDCAIkmUTQ5mRmjZgI0gTx/ApmThIOVjVEodEFhY0eHlsss+Ot/u0liyy/LZjNPd+eb79p577/mdc+4593LwiBvn/wBg9UoWsjVcpGi1D6CINPG4gDUPo1oFomo/RAV1aycC4L2cidLw2UuXpywuhgoj0EDHyk572KFn5CoyS2PQ1tWBrrOYcvFHyM0BcEI2InTO7Bn1BbEnIB+9DbVWbbHbxhqDy+PyILIWIPqz6Uha9gbae2UoqautOLENK82tZbMgA2Vpq3Jfe8FvGQZG+qHTsYsB35aP67JWFDfmIefNUvKkEtE7AlV1myE0B+AkyURP41aZXaeijawfZaWcaVMcPfH9mXxUnz+IaW5PwYrDw6WOFtSkQGQOQLj+Wz95QVwt2gevkSvZxN7QvPl+SC4JR+kn19bJzuOmMTJ36bluCoAjTsDCYIl/dV7sUXQMXDHOmWzWGqCnO83B21+JcbK4K/ymFBeoi4kl49JhUyvyxO8gJjFubUlUyHvo6b/BynLGa/bWjvByCEJo1lRIt+Fx6u42AhgsNTHXdn4q8pKjU9a/FLAC8qEbLKxnALRwtpuCEaUG8QWLZI0fYSZ19/7tGjOrOkoycLwwsSRY6OKKAUUvawAR/0n80XUFaQcS2whgHnXfvn+MqVWdCaBp/4aqGVY8BYaVfSwAdHoAX7dglJ3diy8Pf1H0cwFSYdh8EwK4hmahryG9A5fvVEKjL0DsAPyFS/DxkdWolzbtbPoUWSQYtARAtDAPvTUfyNEq/4YGcScNwCjXUeGeJVpNGTAbzcc7I34/jGoSKSYC4Mxdh1fFEt/a3XE1uNBTxg6AquZjtiI8I1hOGSBiMsCHurtgSD+zANaSVKSHiOdmbI0owmXZERpkxQJAA2cHL7jaBSAyX4yGdHhQdw/wz4o23qr281OwI/71+PXLxKtwo6+BBQAFgACmCcToH9Ti3T2RV6Xb8SIJ5A+4e5zZ/LDt+DVp6aZnQ/znof1ukxFgUvYTgBr+7itQ3vwdvq7a09yQiUUkuGMJgCAsE5fy1x7wcLAfQt9gG10m2ACMIsgrEYXVaag4eayIzqJNJOi3BEAYlg15UVIV7mla0T/cMWkAJgO0WhUk3rnYeGgBpLUXE1uKcZBEwxMBcAKjEeQaiHOntrSj6VaO3pWWhIDJep3OsL+Y+DvYCCH22AxJlgBDVxBBJ3EliZQTAXADohHsNhOnT6Wp8Et3Ag2wNlzozGsnpTqoNRoqWlq9+4WO/vB0XoLIXUFMBnjDkILq8QBslu6CUkkimk+TDW/mP/Ntyd7n0iA7GyA3fg3NGyUIFXyFizGiEOD9fSuV9en6GvBACo4BuITnoqcmtdvmHoaodqmNoyy7gnDox4MNth6KRPBzAoicXMkTCgQ9kYzqlmMoKi88Jc1GDP51CN0PIAzdgh+SItaGzXk6BKNqld6dljY9gBUPVzsvofLcPsSELqA7gAee99yNhP3+OFPe/tbloyinoQOmAPjOXgiQbMDp+PAo+Ex1128my69gVKg5XIKwxm9/XoAr3wU+bjGoOLcXVT/VSaU5WGOMv8oUAI+eqQExiHWfhWyKuxXjAMvVG98cw14Ymzd4C4fPfo4c+rxptF5nbr49PUytdjd+P2xjrGWqngyG4qM2NXAMgDnubI3Kef8BAHPnY47dEXo0lnjwkbVHDvAXnJv0a69W4OkAAAAASUVORK5CYII=", "format":"base64" }
        }
      },
    },


    'uuid-200': {
      id: 'uuid-200',
      fqn: 'DataCenter-minimal',
  assetType: 'Distro' as const,
      assetKey: 'DataCenter-minimal', 

      templateFqn: null,
      overrides: {
        name: 'DataCenter-minimal',
        title: 'Data Center Minimal Distro',
        description: 'A minimal configuration for the Data Center distro'
      }
    },
    'uuid-102': {
      id: 'uuid-102', 
      fqn: 'DataCenter-minimal::WebServer::Nginx',
  assetType: 'Package' as const,
      assetKey: 'Nginx',

      // --- MODIFIED ---
      templateFqn: 'BaseWebServer',
      overrides: {
        name: 'nginx',
        conf: {
          // This version overrides the version from any template
          version: '1.21.0'
          // Port and SSL are now inherited
        }
      }
    },
    'uuid-001': {
      id: 'uuid-001',
      fqn: 'BasePackage',
  assetType: 'Package' as const,
      assetKey: 'BasePackage',

      templateFqn: null,
      overrides: {
        name: 'base-package',
        skeleton: 'skeletons/base',
        baseVersion: '1.0.0',
        conf: {
          author: 'Data Services Team',
          license: 'MIT',
          buildSystem: 'cmake'
        }
      }
    },
    'uuid-003': {
      id: 'uuid-003',
      fqn: 'StorageGuard-bin',
  assetType: 'Package' as const,
      assetKey: 'StorageGuard-bin',

      templateFqn: 'BasePackage',
      overrides: {
        name: 'storageguard-bin',
        baseVersion: '2.5.0',
        conf: {
          buildSystem: 'msbuild'
        }
      }
    },
    'uuid-110': {
      id: 'uuid-110',
      fqn: 'DataCenter-minimal::WebServer::PHP-FPM',
  assetType: 'Package' as const,
      assetKey: 'PHP-FPM',

      templateFqn: 'BasePackage',
      overrides: {
        name: 'php-fpm',
        conf: {
          version: '8.2',
          maxChildren: 50,
          memoryLimit: '256M'
        }
      }
    },
    'uuid-111': {
      id: 'uuid-111',
      fqn: 'DataCenter-minimal::WebServer::SSL-Certs',
  assetType: 'Package' as const,
      assetKey: 'SSL-Certs',

      templateFqn: 'BasePackage',
      overrides: {
        name: 'ssl-certs',
        conf: {
          certType: 'letsencrypt',
          autoRenew: true,
          domains: ['example.com', '*.example.com']
        }
      }
    },
    'uuid-112': {
      id: 'uuid-112',
      fqn: 'DataCenter-minimal::Database::Redis',
  assetType: 'Package' as const,
      assetKey: 'Redis',

      templateFqn: 'BasePackage',
      overrides: {
        name: 'redis',
        conf: {
          version: '7.0',
          maxMemory: '1GB',
          persistence: true
        }
      }
    },
    'uuid-113': {
      id: 'uuid-113',
      fqn: 'DataCenter-minimal::Database::DB-Backup',
  assetType: 'Package' as const,
      assetKey: 'DB-Backup',

      templateFqn: 'BasePackage',
      overrides: {
        name: 'db-backup',
        conf: {
          schedule: '0 2 * * *',
          retention: '30 days',
          compression: true
        }
      }
    },
    'uuid-205': {
      id: 'uuid-205',
      fqn: 'DataCenter-minimal::Options',
  assetType: 'Option' as const,
      assetKey: 'Options',

      templateFqn: null,
      overrides: {
        name: 'options',
        description: 'Distro options and configurations',
        enabled: true
      }
    },
    'uuid-206': {
      id: 'uuid-206',
      fqn: 'DataCenter-minimal::Options::LoadBalancer',
  assetType: 'Option' as const,
      assetKey: 'LoadBalancer',

      templateFqn: null,
      overrides: {
        name: 'load-balancer',
        description: 'Balancing the load of app on node',
        enabled: true,
      }
    }
  },
};
















