import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { ConfigurationHub } from '@/core/stores/ConfigurationHub';
import { mockMasterAssetRegistry } from '../../mock-content/mockMasterAssetRegistry';
import { mockPerspectiveDefinitions } from '../../mock-content/mockPerspectiveDefinitions';
import { mockMasterInteractionRegistry } from '../../mock-content/mockMasterInteractionRegistry';

describe('Stage 3: ConfigurationHub Interaction Rules', () => {
  let hub: ConfigurationHub;

  beforeEach(() => {
    setActivePinia(createPinia());
    hub = new ConfigurationHub(
      mockMasterAssetRegistry,
      mockPerspectiveDefinitions,
      'Container',
      mockMasterInteractionRegistry,
      'default'
    );
  });

  describe('Default Perspective Rules', () => {
    it('should include all rules tagged with default', () => {
      const rules = hub.effectiveInteractionRules.value;
      expect(rules.has('Widget->Container')).toBe(true);
      expect(rules.has('Aggregator->Container')).toBe(true);
      expect(rules.has('Container->Container')).toBe(true);
      expect(rules.has('Widget->Widget')).toBe(true);
    });

    it('should have correct rule count in default perspective', () => {
      const rules = hub.effectiveInteractionRules.value;
      expect(rules.size).toBe(4);
    });
  });

  describe('Environment Perspective Rules', () => {
    it('should filter rules for environment perspective', () => {
      hub.setPerspective('environment');
      const rules = hub.effectiveInteractionRules.value;
      
      expect(rules.has('Widget->Container')).toBe(true); // Included
      expect(rules.has('Widget->Widget')).toBe(true); // Included
      expect(rules.has('Aggregator->Container')).toBe(false); // Excluded
      expect(rules.has('Container->Container')).toBe(false); // Excluded
    });

    it('should have correct rule count in environment perspective', () => {
      hub.setPerspective('environment');
      const rules = hub.effectiveInteractionRules.value;
      expect(rules.size).toBe(2);
    });
  });

  describe('Package Perspective Rules', () => {
    it('should filter rules for package perspective', () => {
      hub.setPerspective('package');
      const rules = hub.effectiveInteractionRules.value;
      
      expect(rules.has('Aggregator->Container')).toBe(true); // Included
      expect(rules.has('Widget->Widget')).toBe(true); // Included
      expect(rules.has('Widget->Container')).toBe(false); // Excluded
      expect(rules.has('Container->Container')).toBe(false); // Excluded
    });

    it('should have correct rule count in package perspective', () => {
      hub.setPerspective('package');
      const rules = hub.effectiveInteractionRules.value;
      expect(rules.size).toBe(2);
    });
  });

  describe('Lab Perspective Rules', () => {
    it('should filter rules for lab perspective', () => {
      hub.setPerspective('lab');
      const rules = hub.effectiveInteractionRules.value;
      
      expect(rules.has('Container->Container')).toBe(true); // Included
      expect(rules.has('Widget->Container')).toBe(false); // Excluded
      expect(rules.has('Aggregator->Container')).toBe(false); // Excluded
      expect(rules.has('Widget->Widget')).toBe(false); // Excluded
    });

    it('should have correct rule count in lab perspective', () => {
      hub.setPerspective('lab');
      const rules = hub.effectiveInteractionRules.value;
      expect(rules.size).toBe(1);
    });
  });

  describe('Rule Reactivity', () => {
    it('should reactively update rules when perspective changes', () => {
      let rules = hub.effectiveInteractionRules.value;
      expect(rules.size).toBe(4);

      hub.setPerspective('lab');
      rules = hub.effectiveInteractionRules.value;
      expect(rules.size).toBe(1);

      hub.setPerspective('default');
      rules = hub.effectiveInteractionRules.value;
      expect(rules.size).toBe(4);
    });

    it('should maintain rule content across perspective changes', () => {
      hub.setPerspective('lab');
      let rules = hub.effectiveInteractionRules.value;
      const containerRule = rules.get('Container->Container');
      expect(containerRule).toBeDefined();
      expect(containerRule?.actions[0].id).toBe('nest-container');

      hub.setPerspective('environment');
      rules = hub.effectiveInteractionRules.value;
      const widgetRule = rules.get('Widget->Container');
      expect(widgetRule).toBeDefined();
      expect(widgetRule?.actions[0].id).toBe('move-widget');
    });
  });

  describe('Rule Entry Integrity', () => {
    it('should preserve all rule properties', () => {
      const rules = hub.effectiveInteractionRules.value;
      const widgetContainerRule = rules.get('Widget->Container');
      
      expect(widgetContainerRule).toBeDefined();
      expect(Array.isArray(widgetContainerRule?.actions)).toBe(true);
      expect(widgetContainerRule?.actions[0]).toHaveProperty('id');
      expect(widgetContainerRule?.actions[0]).toHaveProperty('label');
      expect(widgetContainerRule?.actions[0]).toHaveProperty('execute');
    });

    it('should not mutate master interaction registry', () => {
      const original = mockMasterInteractionRegistry.find(
        r => r.draggedType === 'Widget' && r.targetType === 'Container'
      );
      hub.setPerspective('lab');
      const stillOriginal = mockMasterInteractionRegistry.find(
        r => r.draggedType === 'Widget' && r.targetType === 'Container'
      );
      expect(stillOriginal?.perspectives).toEqual(original?.perspectives);
    });
  });

  describe('Default behavior (Option B)', () => {
    it('should include rules without explicit perspectives in all perspectives', () => {
      // Create a test hub with a rule that has no perspectives array
      const universalRule: typeof mockMasterInteractionRegistry[0] = {
        draggedType: 'Aggregator',
        targetType: 'Widget',
        perspectives: undefined, // No explicit perspectives - should apply to all
        rule: {
          actions: [{
            id: 'universal-action',
            label: 'Universal Action',
            icon: 'mdi-star',
            cursor: 'default',
            execute: () => {}
          }]
        }
      };

      const testHub = new ConfigurationHub(
        mockMasterAssetRegistry,
        mockPerspectiveDefinitions,
        'Container',
        [...mockMasterInteractionRegistry, universalRule],
        'default'
      );

      // Should appear in default perspective
      let rules = testHub.effectiveInteractionRules.value;
      expect(rules.has('Aggregator->Widget')).toBe(true);

      // Should appear in lab perspective
      testHub.setPerspective('lab');
      rules = testHub.effectiveInteractionRules.value;
      expect(rules.has('Aggregator->Widget')).toBe(true);

      // Should appear in package perspective
      testHub.setPerspective('package');
      rules = testHub.effectiveInteractionRules.value;
      expect(rules.has('Aggregator->Widget')).toBe(true);
    });
  });
});

