import type { PerspectiveDefinition } from '@/core/types';

import { ASSET_TYPES } from './constants';

export const perspectiveDefinitions: Record<string, PerspectiveDefinition> = {
  default: {
    name: 'default',
    displayName: 'Asset Editor',
    icon: 'mdi-pencil',
  },
  // Environment perspective: focuses on environments and nodes
  environment: {
    name: 'environment',
    displayName: 'Environment Config',
    icon: 'mdi-earth',
  },
  // Package perspective: focuses on packages and their management
  package: {
    name: 'package',
    displayName: 'Package Editing',
    icon: 'mdi-package-variant',
  },
  // Lab perspective: all asset types supported by default (can be customized)
  lab: {
    name: 'lab',
    displayName: 'Lab Management',
    icon: 'mdi-flask',
  }
};

