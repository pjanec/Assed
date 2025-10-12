import type { UnmergedAsset } from '@/core/types';

export interface ValidationIssue {
  id: string; // A unique ID for the issue, e.g., `${asset.id}-rule-name`
  severity: 'warning' | 'error';
  message: string;
  assetName: string;
  assetType: string;
  assetId: string;
}

export type ValidationRule = (
  asset: UnmergedAsset, 
  allAssets: UnmergedAsset[]
) => ValidationIssue | null;