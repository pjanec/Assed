# Interaction Rules Architecture

## Overview

This directory contains **domain-specific interaction rules** for drag-and-drop operations in the Asset Editor. All rules are **declarative** and **perspective-aware**, allowing the UI to adapt based on the active editing perspective.

## Directory Structure

- `folderInteractions.ts` - Generic folder-like drag-and-drop interactions
- `packageInteractions.ts` - Package-to-Node/Option interactions  
- `packageAssignmentInteractions.ts` - Package assignment workflows
- `nodeInteractions.ts` - Node-to-Distro cloning interactions

## Architecture Flow

```
Domain-Specific Files (this directory)
        ↓ (exports InteractionRuleEntry[])
        
masterInteractionRegistry.ts
        ↓ (aggregates and spreads arrays)
        
plugin.ts
        ↓ (initializes ConfigurationHub)
        
ConfigurationHub
        ↓ (filters by perspective)
        
effectiveInteractionRules (ComputedRef)
        ↓
        
interactionRegistry.ts (query layer)
        ↓
        
UI Components
```

## Key Concepts

### Hybrid Perspective Configuration

Perspective support is defined using a **hybrid approach**:

1. **Assets declare where they're supported** using `isSupported: PerspectiveOverrides<boolean>` in the asset registry:
   ```typescript
   {
     PACKAGE: {
       isSupported: { 
         default: true,     // Supported in default
         distro: false, // NOT supported in distro perspective
         package: true,      // IS supported in package perspective
         lab: true
       }
     }
   }
   ```

2. **Perspectives use computed lists** - The `supportedAssetTypes` in perspective definitions is computed automatically from the asset declarations.

This hybrid approach provides:
- **Consistency**: All perspective-aware properties follow the same `PerspectiveOverrides<T>` pattern
- **Convenience**: Perspectives still have their `supportedAssetTypes` list for quick reference
- **Maintainability**: Add a new perspective by updating only the asset declarations, not multiple places

### Option B: Default Perspective Behavior

If a rule's `perspectives` field is `undefined`, it applies to **all perspectives**:

```typescript
{
  draggedType: 'Asset',
  targetType: 'Folder',
  // perspectives undefined = applies to all perspectives
  rule: FOLDER_LIKE_INTERACTION_RULE
}
```

To restrict a rule to specific perspectives:

```typescript
{
  draggedType: ASSET_TYPES.PACKAGE,
  targetType: ASSET_TYPES.NODE,
  perspectives: ['default', 'distro'], // Only applies to these
  rule: someRule
}
```

### Domain-Specific Export Pattern

Each file should export an array:

```typescript
export const domainInteractions: InteractionRuleEntry[] = [
  { draggedType: TYPE1, targetType: TYPE2, rule: rule1 },
  { draggedType: TYPE3, targetType: TYPE4, rule: rule2 },
];
```

This allows clean aggregation in `masterInteractionRegistry.ts`:

```typescript
export const masterInteractionRegistry: InteractionRuleEntry[] = [
  ...folderInteractions,
  ...packageInteractions,
  ...packageAssignmentInteractions,
  ...nodeInteractions,
];
```

## How to Add New Interactions

1. **Create or update a domain file** - Place rule in the appropriate file
2. **Export as an array** - Use `InteractionRuleEntry[]` format
3. **Update masterInteractionRegistry.ts** - Add spread operator for your array

Example:

```typescript
// In your domain file
export const myDomainInteractions: InteractionRuleEntry[] = [
  { draggedType: 'X', targetType: 'Y', rule: myRule }
];

// In masterInteractionRegistry.ts
export const masterInteractionRegistry: InteractionRuleEntry[] = [
  ...existingRules,
  ...myDomainInteractions, // Add your new rules
];
```

## Testing

Each domain file can be tested independently since it exports a plain array. The `ConfigurationHub` tests verify perspective filtering works correctly.

See: `tests/core/stores/configuration-hub-interactions.spec.ts`

