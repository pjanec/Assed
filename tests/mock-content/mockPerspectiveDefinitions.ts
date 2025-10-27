import type { PerspectiveDefinition } from '@/core/types';

export const mockPerspectiveDefinitions: Record<string, PerspectiveDefinition> = {
  default: {
    name: 'default',
    displayName: 'Full Editor',
    icon: 'mdi-pencil',
    // No supportedAssetTypes - all types supported
  },
  environment: {
    name: 'environment',
    displayName: 'Environment View',
    icon: 'mdi-earth',
    supportedAssetTypes: ['Container', 'Widget'] // Aggregator not supported
  },
  package: {
    name: 'package',
    displayName: 'Package View',
    icon: 'mdi-package',
    supportedAssetTypes: ['Aggregator', 'Widget'] // Container not supported
  },
  lab: {
    name: 'lab',
    displayName: 'Lab View',
    icon: 'mdi-flask',
    supportedAssetTypes: ['Container'] // Only containers supported
  }
};

