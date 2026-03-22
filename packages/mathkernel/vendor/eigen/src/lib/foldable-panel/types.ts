/**
 * FoldablePanel Types
 *
 * Framework-agnostic types for foldable panels.
 * Used by both standalone panels and TipTap-wrapped blocks.
 *
 * @module foldable-panel/types
 */

import type { ReactNode, ComponentType } from 'react';

// =============================================================================
// Panel Tag Types
// =============================================================================

export type PanelTag =
  | 'map'
  | '3d'
  | 'data-grid'
  | 'chart'
  | 'embed'
  | 'media'
  | 'custom';

export interface PanelBadge {
  /** Tag identifier for styling */
  readonly tag: PanelTag;
  /** Display label */
  readonly label: string;
  /** Icon component (lucide-react compatible) */
  readonly icon?: ComponentType<{ size?: number; className?: string }>;
  /** Accent color (CSS color or VANTA token key) */
  readonly color?: string;
}

// =============================================================================
// Panel State
// =============================================================================

export type FoldState = 'expanded' | 'collapsed' | 'minimized';

export type StreamStatus = 'idle' | 'connecting' | 'connected' | 'error';

export interface FoldablePanelState {
  /** Current fold state */
  readonly foldState: FoldState;
  /** Whether settings panel is open */
  readonly settingsOpen: boolean;
  /** Active settings tab */
  readonly activeTab: string;
  /** Whether panel is selected */
  readonly isSelected: boolean;
  /** Whether panel is being hovered */
  readonly isHovered: boolean;
  /** Stream connection status */
  readonly streamStatus: StreamStatus;
  /** Stream error message (if status is 'error') */
  readonly streamError: string | null;
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
// Panel Props (Framework-Agnostic)
// =============================================================================

export interface FoldablePanelProps {
  /** Unique panel identifier */
  readonly panelId: string;
  /** Panel badge configuration */
  readonly badge: PanelBadge;
  /** Settings tabs (optional) */
  readonly tabs?: readonly SettingsTab[];
  /** Initial fold state */
  readonly initialFoldState?: FoldState;
  /** Whether to allow minimized state (vs just collapsed) */
  readonly allowMinimize?: boolean;
  /** Content height when expanded (px) */
  readonly expandedHeight?: number;
  /** Content height when collapsed (px) */
  readonly collapsedHeight?: number;
  /** Children (the actual panel content) */
  readonly children: ReactNode;
  /** Callback when fold state changes */
  readonly onFoldChange?: (state: FoldState) => void;
  /** Custom CSS class */
  readonly className?: string;
  /** Whether panel is selected (from external state) */
  readonly isSelected?: boolean;
  /** Whether the panel content is editable */
  readonly isEditable?: boolean;
  /** Custom name for the panel (displayed in header) */
  readonly customName?: string;
  /** Callback when panel name is changed */
  readonly onRename?: (newName: string) => Promise<void>;
  /** Callback when delete is requested */
  readonly onDelete?: () => void;
  /** Whether to show the drag handle */
  readonly showDragHandle?: boolean;
  /** Whether to show the focus mode button */
  readonly showFocusButton?: boolean;
  /** Callback when focus mode is requested */
  readonly onEnterFocus?: () => void;
}

// =============================================================================
// Panel Actions
// =============================================================================

export interface FoldablePanelActions {
  readonly toggleFold: () => void;
  readonly expand: () => void;
  readonly collapse: () => void;
  readonly minimize: () => void;
  readonly toggleSettings: () => void;
  readonly setActiveTab: (tabId: string) => void;
  readonly setSelected: (selected: boolean) => void;
  readonly setHovered: (hovered: boolean) => void;
  readonly setStreamStatus: (status: StreamStatus) => void;
  readonly setStreamError: (error: string | null) => void;
  readonly setCustomHeight: (height: number | null) => void;
  readonly resetCustomHeight: () => void;
  readonly toggleSettingsExpanded: () => void;
  readonly setSettingsExpanded: (expanded: boolean) => void;
}

// =============================================================================
// Context Value
// =============================================================================

export interface FoldablePanelContextValue {
  /** Current panel state */
  readonly state: FoldablePanelState;
  /** Panel badge */
  readonly badge: PanelBadge;
  /** Available settings tabs */
  readonly tabs: readonly SettingsTab[];
  /** Whether panel is editable */
  readonly isEditable: boolean;
  /** Actions */
  readonly actions: FoldablePanelActions;
}
