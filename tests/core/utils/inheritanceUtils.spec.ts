import { describe, it, expect, beforeEach } from 'vitest';
import { createTestEnvironment } from '../../test-utils';
import { ASSET_TYPES } from '@/content/config/constants';
import type { UnmergedAsset, Asset } from '@/core/types';
import { getInheritanceChain, isAncestorOf } from '@/core/utils/inheritanceUtils';

// Test data covering linear, broken, and circular chains
const testData: Asset[] = [
  { id: 'A', fqn: 'A', assetType: ASSET_TYPES.PACKAGE, assetKey: 'A', templateFqn: null },
  { id: 'B', fqn: 'B', assetType: ASSET_TYPES.PACKAGE, assetKey: 'B', templateFqn: 'A' },
  { id: 'C', fqn: 'C', assetType: ASSET_TYPES.PACKAGE, assetKey: 'C', templateFqn: 'B' },
  { id: 'D', fqn: 'D', assetType: ASSET_TYPES.PACKAGE, assetKey: 'D', templateFqn: 'NON_EXISTENT' }, // Broken chain
  { id: 'circ-A', fqn: 'circA', assetType: ASSET_TYPES.PACKAGE, assetKey: 'circA', templateFqn: 'circB' },
  { id: 'circ-B', fqn: 'circB', assetType: ASSET_TYPES.PACKAGE, assetKey: 'circB', templateFqn: 'circA' },
];

describe('Asset Inheritance Utilities', () => {
    
  describe('getInheritanceChain', () => {
    it('should return the correct, ordered ancestor chain', () => {
      const chain = getInheritanceChain('C', testData);
      expect(chain).toHaveLength(2);
      expect(chain.map(a => a.fqn)).toEqual(['B', 'A']);
    });

    it('should return an empty array for an asset with no template', () => {
      const chain = getInheritanceChain('A', testData);
      expect(chain).toHaveLength(0);
    });

    it('should gracefully handle a broken template link', () => {
      const chain = getInheritanceChain('D', testData);
      expect(chain).toHaveLength(0); // Stops when 'NON_EXISTENT' is not found
    });

    it('should not enter an infinite loop for circular dependencies', () => {
      const chain = getInheritanceChain('circA', testData);
      // It should return the chain up to the point of the cycle
      expect(chain.map(a => a.fqn)).toEqual(['circB', 'circA']);
    });
  });

  describe('isAncestorOf (Refactored)', () => {
    it('should correctly identify a direct or indirect ancestor', () => {
      expect(isAncestorOf('C', 'B', testData)).toBe(true); // Direct
      expect(isAncestorOf('C', 'A', testData)).toBe(true); // Indirect
    });

    it('should return false for non-ancestors or self', () => {
      expect(isAncestorOf('C', 'D', testData)).toBe(false); // Unrelated
      expect(isAncestorOf('A', 'C', testData)).toBe(false); // Wrong direction
      expect(isAncestorOf('C', 'C', testData)).toBe(false); // Self
    });
  });
});
