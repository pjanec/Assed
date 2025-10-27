import type { InteractionRuleEntry } from '@/core/stores/ConfigurationHub';
import { ASSET_TYPES } from '@/content/config/constants';

// Import domain-specific interaction rules
import { FOLDER_LIKE_INTERACTION_RULE } from './interactions/folderInteractions';
import { packageInteractions } from './interactions/packageInteractions';
import { packageAssignmentRules } from './interactions/packageAssignmentInteractions';
import { nodeInteractions } from './interactions/nodeInteractions';

/**
 * Master Interaction Registry
 * 
 * Aggregates all interaction rules from domain-specific modules.
 * Uses Option B default behavior: if perspectives is undefined, rule applies to all perspectives.
 * 
 * @see ConfigurationHub.effectiveInteractionRules for perspective-filtered view
 */
export const masterInteractionRegistry: InteractionRuleEntry[] = [
  // Generic folder-like rule for all container types
  {
    draggedType: 'Asset',
    targetType: 'Folder',
    // perspectives undefined = applies to all perspectives
    rule: FOLDER_LIKE_INTERACTION_RULE
  },
  
  // Spread all domain-specific arrays
  ...packageInteractions,
  ...packageAssignmentRules,
  ...nodeInteractions,
];

// Re-export for use in plugin.ts
export { FOLDER_LIKE_INTERACTION_RULE } from './interactions/folderInteractions';
export { crossDistroCloneHook } from './interactions/packageAssignmentInteractions';
