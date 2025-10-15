// Import asset types from content layer
import type { ASSET_TYPES } from '@/content/config/constants';
import { ASSET_TREE_NODE_TYPES, VIEW_HINTS } from '@/core/config/constants';

// Create a reusable type from the constant
type AssetType = typeof ASSET_TYPES[keyof typeof ASSET_TYPES];

// Define the strict type for tree node types
export type AssetTreeNodeType = typeof ASSET_TREE_NODE_TYPES[keyof typeof ASSET_TREE_NODE_TYPES];

// Virtual Node types - using string to avoid circular dependency issues
export type VirtualNodeKind = string;

export type ViewHint = typeof VIEW_HINTS[keyof typeof VIEW_HINTS];

// Represents the metadata attached to a virtual node
export interface VirtualNodeContext {
  kind: VirtualNodeKind;
  sourceAssetId: string;
  isReadOnly?: boolean;
  payload?: any;
  viewHint?: ViewHint;
}

/**
 * Represents the lightweight asset information used in the explorer list.
 */
export interface Asset {
  id: string;
  fqn: string;
  assetType: AssetType;
  assetKey: string;
  templateFqn?: string | null;
}

/**
 * Represents the full, unmerged asset data with overrides.
 */
export interface UnmergedAsset extends Asset {
  overrides: Record<string, any>;
}

/**
 * Represents a node in the explorer tree view.
 * It can be an asset, a folder, a file-group, or a namespace.
 */
export interface AssetTreeNode extends Partial<Asset> {
  id: string;
  path: string;
  name: string;
  type: AssetTreeNodeType;
  children: AssetTreeNode[];
  virtualContext?: VirtualNodeContext;
}

/**
 * Represents an open inspector pane in the UI.
 */
export interface InspectorPaneInfo {
  paneId: string;
  assetId: string;
}

/**
 * Represents detailed asset information including merged/unmerged states.
 */
export interface AssetDetails {
  unmerged: UnmergedAsset;
  merged: any | null;
  isReadOnly?: boolean;
}

/**
 * Represents a selected node in the asset tree.
 */
export interface SelectedNode {
  id: string;
  type: AssetTreeNodeType;
  name: string;
  path: string;
  virtualContext?: VirtualNodeContext;
  assetType?: Asset['assetType'];
}

/**
 * Represents loading states for various operations.
 */
export interface LoadingStates {
  assets: boolean;
  assetDetails: Set<string>;
}

/**
 * Represents build information.
 */
export interface Build {
  id: string;
  status: 'Running' | 'Queued' | 'Completed' | 'Failed';
  startTime: string;
  endTime?: string;
  [key: string]: any;
}

/**
 * Represents pending changes in the workspace.
 */
export interface PendingChanges {
  upserted: Map<string, UnmergedAsset>;
  deleted: Map<string, UnmergedAsset>;
}

/**
 * Dialog state for new asset creation.
 */
export interface NewAssetDialogState {
  show: boolean;
  parentAsset: Asset | null;
  childType: string | null;
  prefilledOrigin: string | null;
}

/**
 * Dialog state for delete confirmation.
 */
export interface DeleteConfirmationDialogState {
  show: boolean;
  asset: Asset | null;
  impact: {
    deletableChildren: Asset[];
  };
}

/**
 * Represents a change in the diff system.
 */
export interface Change {
  type: 'MODIFIED' | 'ADDED' | 'REMOVED';
  path: string;
  oldValue?: any;
  newValue?: any;
}

/**
 * Represents a change item with asset state and diff.
 */
export interface ChangeItem {
  newState: {
    id: string;
    assetKey: string;
    fqn: string;
    assetType: AssetType | string; // Allow string for flexibility if needed
  };
  diff?: Change[];
}

/**
 * Represents a single FQN update operation during refactoring.
 */
export interface FqnUpdate {
  assetId: string;
  assetKey: string;
  oldFqn: string;
  newFqn: string;
}

/**
 * Represents a template link update operation during refactoring.
 */
export interface TemplateLinkUpdate {
  assetId: string;
  assetKey: string;
  oldTemplateFqn: string;
  newTemplateFqn: string;
}

/**
 * Represents an update to a locally overriding child that must stay linked to its template sibling.
 */
export interface LinkedOverrideUpdate {
  assetId: string;
  oldAssetKey: string;
  newAssetKey: string;
  oldFqn: string;
  newFqn: string;
}

/**
 * Detailed consequences of a refactoring operation.
 */
export interface RefactorConsequences {
  fqnUpdates: FqnUpdate[];
  templateLinkUpdates: TemplateLinkUpdate[];
  linkedOverrideUpdates?: LinkedOverrideUpdate[];
  oldFqn: string;
  newFqn: string;
  oldAssetKey: string;
  newAssetKey: string;
}

/**
 * State for the refactor confirmation (rename/move) dialog.
 */
export interface RefactorConfirmationState {
  show: boolean;
  mode: 'rename' | 'move';
  assetId: string;
  consequences: RefactorConsequences;
}

/**
 * Dialog state for new folder creation.
 */
export interface NewFolderDialogState {
  show: boolean;
  parentFqn: string | null;
}

/**
 * State for the deletion blocked dialog.
 */
export interface DeleteBlockedDialogState {
  show: boolean;
  asset: Asset | null;
  impact: {
    blockingDependencies: Asset[];
  };
}

export type CloneMap = Map<string, string>;

export interface ValidationRules {
  requiredProperties?: string[];
  mustHaveChildOfType?: string[];
}

export interface AssetDefinition {
  label: string;
  validChildren: string[];
  validationRules?: ValidationRules;
  icon: string;
  color: string;
  inspectorComponent: () => Promise<import('vue').Component>;
  isCreatableAtRoot: boolean;
  creationModes: ('simple' | 'full')[];
  isRenameable?: boolean;
  isDeletable?: boolean;
  isStructuralFolder?: boolean;
  sortOrder: number;
  isShownInStats?: boolean;
  initialOverrides?: Record<string, any>;
  postCloneFixup?: (
    newlyClonedAsset: UnmergedAsset,
    originalSourceAsset: UnmergedAsset,
    cloneMap: CloneMap
  ) => UnmergedAsset;
  virtualFolderProviders?: VirtualNodeKind[];
  isSynthetic?: boolean;
}







