/**
 * EmbeddedBlockWrapper Types
 *
 * Shared wrapper for embedded blocks (MapBlock, Scene3DBlock, etc.)
 * Provides foldable behavior, badges, delete-key-only close, and settings panels.
 *
 * @module editor/v3/extensions/blocks/EmbeddedBlockWrapper/types
 */

import type { ReactNode, ComponentType } from 'react';
import type { NodeViewProps } from '@tiptap/react';

// =============================================================================
// Block Tag Types
// =============================================================================

export type BlockTag =
  | 'map'
  | '3d'
  | 'data-grid'
  | 'chart'
  | 'embed'
  | 'media'
  | 'custom';

export interface BlockBadge {
  /** Tag identifier for styling */
  readonly tag: BlockTag;
  /** Display label */
  readonly label: string;
  /** Icon component (lucide-react compatible) */
  readonly icon?: ComponentType<{ size?: number; className?: string }>;
  /** Accent color (CSS color or VANTA token key) */
  readonly color?: string;
}

// =============================================================================
// Wrapper State
// =============================================================================

export type FoldState = 'expanded' | 'collapsed' | 'minimized';

export interface EmbeddedBlockState {
  /** Current fold state */
  readonly foldState: FoldState;
  /** Whether settings panel is open */
  readonly settingsOpen: boolean;
  /** Active settings tab */
  readonly activeTab: string;
  /** Whether block is selected in editor */
  readonly isSelected: boolean;
  /** Whether block is being hovered */
  readonly isHovered: boolean;
}

// =============================================================================
// Settings Tab
// =============================================================================

export interface SettingsTab {
  /** Tab identifier */
  readonly id: string;
  /** Tab label */
  readonly label: string;
  /** Tab icon */
  readonly icon?: ComponentType<{ size?: number; className?: string }>;
  /** Tab content renderer */
  readonly content: ReactNode;
}

// =============================================================================
// Wrapper Props
// =============================================================================

export interface EmbeddedBlockWrapperProps {
  /** TipTap NodeViewProps (node, editor, selected, deleteNode, etc.) */
  readonly nodeViewProps: NodeViewProps;
  /** Block badge configuration */
  readonly badge: BlockBadge;
  /** Settings tabs (optional) */
  readonly tabs?: readonly SettingsTab[];
  /** Initial fold state */
  readonly initialFoldState?: FoldState;
  /** Whether to allow minimized state (vs just collapsed) */
  readonly allowMinimize?: boolean;
  /** Content height when expanded (px or CSS value) */
  readonly expandedHeight?: number | string;
  /** Content height when collapsed (px or CSS value) */
  readonly collapsedHeight?: number | string;
  /** Children (the actual block content) */
  readonly children: ReactNode;
  /** Callback when fold state changes */
  readonly onFoldChange?: (state: FoldState) => void;
  /** Custom CSS class */
  readonly className?: string;
}

// =============================================================================
// Context Value
// =============================================================================

export interface EmbeddedBlockContextValue {
  /** Current wrapper state */
  readonly state: EmbeddedBlockState;
  /** Block badge */
  readonly badge: BlockBadge;
  /** Available settings tabs */
  readonly tabs: readonly SettingsTab[];
  /** Whether block is editable */
  readonly isEditable: boolean;
  /** Actions */
  readonly actions: {
    readonly toggleFold: () => void;
    readonly expand: () => void;
    readonly collapse: () => void;
    readonly minimize: () => void;
    readonly toggleSettings: () => void;
    readonly setActiveTab: (tabId: string) => void;
  };
}
