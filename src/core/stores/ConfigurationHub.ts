/**
 * ConfigurationHub - Central Configuration Service
 * 
 * Provides perspective-aware configuration for assets and interactions.
 * 
 * Responsibilities:
 * - Manages currentPerspective state (reactive)
 * - Resolves PerspectiveOverrides to effective values based on active perspective
 * - Filters asset registry by isVisibleInExplorer and supportedAssetTypes
 * - Filters interaction rules by perspective tags
 * 
 * Architecture:
 * - Input: master registries (complete definitions)
 * - Processing: perspective-aware resolution
 * - Output: effective registries (filtered and resolved for current perspective)
 * 
 * @see masterAssetRegistry.ts for asset definitions
 * @see masterInteractionRegistry.ts for interaction rule definitions
 */

import { ref, computed, type Ref, type ComputedRef } from 'vue';
import type { AssetDefinition, PerspectiveName, PerspectiveDefinition, PerspectiveOverrides } from '@/core/types';

export interface InteractionRuleEntry {
  draggedType: string;
  targetType: string;
  perspectives?: string[]; // Optional - if omitted, applies to all perspectives (Option B)
  rule: import('@/core/registries/interactionRegistry').InteractionRule;
}

export class ConfigurationHub {
  public readonly currentPerspective: Ref<string>;
  private perspectiveDefinitions: Record<string, PerspectiveDefinition>;
  private masterAssetRegistry: Record<string, AssetDefinition>;
  private masterInteractionRegistry: InteractionRuleEntry[];
  private structuralAssetType: string;

  constructor(
    masterAssetRegistry: Record<string, AssetDefinition>,
    perspectiveDefinitions: Record<string, PerspectiveDefinition>,
    structuralAssetType: string,
    masterInteractionRegistry: InteractionRuleEntry[],
    initialPerspective: string = 'default'
  ) {
    this.currentPerspective = ref(initialPerspective);
    this.masterAssetRegistry = masterAssetRegistry;
    this.perspectiveDefinitions = perspectiveDefinitions;
    this.structuralAssetType = structuralAssetType;
    this.masterInteractionRegistry = masterInteractionRegistry;
  }

  /**
   * Resolves a perspective-aware property to its effective value.
   * Uses Option B default behavior: undefined key falls back to 'default'.
   * 
   * @example
   * getEffectiveValue({ default: 'A', package: 'B' }) // Returns 'A' or 'B' based on currentPerspective
   */
  private getEffectiveValue<T>(overrides: PerspectiveOverrides<T>): T {
    return overrides[this.currentPerspective.value] ?? overrides.default;
  }

  /**
   * Sets the active perspective and triggers reactive updates to effective registries.
   * @param newPerspective The perspective name to activate
   */
  public setPerspective(newPerspective: string): void {
    if (this.perspectiveDefinitions[newPerspective]) {
      this.currentPerspective.value = newPerspective;
      console.log(`[ConfigurationHub] Perspective changed to: ${newPerspective}`);
    } else {
      console.warn(`[ConfigurationHub] Unknown perspective: ${newPerspective}`);
    }
  }

  /**
   * Perspective-filtered asset registry.
   * 
   * Features:
   * - Resolves PerspectiveOverrides to plain values
   * - Filters by isVisibleInExplorer for tree display
   * - Adds _isSupportedInCurrentPerspective flag for workflow logic
   * 
   * @returns ComputedRef that updates when currentPerspective changes
   */
  public effectiveAssetRegistry: ComputedRef<Record<string, any>> = computed(() => {
    const effectiveRegistry: Record<string, AssetDefinition> = {};
    const currentPerspectiveDef = this.perspectiveDefinitions[this.currentPerspective.value];
    const supportedTypes = currentPerspectiveDef?.supportedAssetTypes 
      ? new Set(currentPerspectiveDef.supportedAssetTypes) 
      : null;

    for (const assetType in this.masterAssetRegistry) {
      const masterDef = this.masterAssetRegistry[assetType];

      // Resolve isVisibleInExplorer from master definition (independent of supportedAssetTypes)
      const isVisible = this.getEffectiveValue(masterDef.isVisibleInExplorer || { default: true });
      
      // Note: isVisibleInExplorer is independent of supportedAssetTypes
      // - isVisibleInExplorer: Controls visibility in the asset tree (UI display)
      // - supportedAssetTypes: Controls what types are "supported" in this perspective (creation, workflows, interactions)
      if (!isVisible) continue;

      // Resolve all perspective-aware properties to plain values
      const unwrappedLabel = this.getEffectiveValue(masterDef.label);
      const unwrappedIcon = this.getEffectiveValue(masterDef.icon);
      const unwrappedColor = this.getEffectiveValue(masterDef.color);
      const unwrappedInspector = this.getEffectiveValue(masterDef.inspectorComponent);
      
      // Compute isSupported from the asset's isSupported flag
      // Priority: use asset's isSupported flag if present, otherwise fall back to perspective's supportedAssetTypes
      const assetIsSupported = masterDef.isSupported 
        ? this.getEffectiveValue(masterDef.isSupported) 
        : undefined;
      
      const isSupportedInPerspective = assetIsSupported !== undefined
        ? assetIsSupported !== false // true if explicitly supported, false if explicitly not
        : (!supportedTypes || supportedTypes.has(assetType)); // Fall back to perspective list
      
      const unwrappedDef = {
        ...masterDef,
        label: unwrappedLabel,
        icon: unwrappedIcon,
        color: unwrappedColor,
        isVisibleInExplorer: isVisible,
        inspectorComponent: unwrappedInspector,
        // Add a computed property indicating if this type is "supported" in the current perspective
        _isSupportedInCurrentPerspective: isSupportedInPerspective
      } as any;
      
      effectiveRegistry[assetType] = unwrappedDef;
    }

    return effectiveRegistry;
  });

  /**
   * Perspective-filtered interaction rules.
   * 
   * Features:
   * - Applies Option B default behavior (undefined perspectives = all perspectives)
   * - Explicitly tags rules with perspectives to restrict their scope
   * 
   * @returns ComputedRef Map of rules filtered by current perspective
   */
  public effectiveInteractionRules: ComputedRef<Map<string, import('@/core/registries/interactionRegistry').InteractionRule>> = computed(() => {
    const currentPerspective = this.currentPerspective.value;
    const filteredMap = new Map<string, import('@/core/registries/interactionRegistry').InteractionRule>();

    for (const entry of this.masterInteractionRegistry) {
      // If perspectives is undefined, apply to all perspectives (default behavior)
      // Otherwise, check if current perspective is in the list
      const shouldInclude = !entry.perspectives || entry.perspectives.includes(currentPerspective);
      
      if (shouldInclude) {
        const key = `${entry.draggedType}->${entry.targetType}`;
        filteredMap.set(key, entry.rule);
      }
    }

    return filteredMap;
  });
}

