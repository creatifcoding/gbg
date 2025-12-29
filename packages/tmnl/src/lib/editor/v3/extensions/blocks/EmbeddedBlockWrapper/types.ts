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
import type { StreamBinding } from '@/lib/connection-ports';
import type {
  PortId,
  PortDirection,
  PortPosition,
  PortDataType,
  LinkPort,
} from '@/lib/dataplane';

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

export type StreamStatus = 'idle' | 'connecting' | 'connected' | 'error';

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
  /** Stream connection status */
  readonly streamStatus: StreamStatus;
  /** Stream error message (if status is 'error') */
  readonly streamError: string | null;
}

// =============================================================================
// Stream Binding Configuration
// =============================================================================

export interface StreamBindingConfig {
  /** Stream binding specification */
  readonly binding: StreamBinding;
  /** Whether to auto-connect on mount */
  readonly autoConnect?: boolean;
  /** Reconnect delay on error (ms) */
  readonly reconnectDelayMs?: number;
  /** Max reconnect attempts (0 = infinite) */
  readonly maxReconnectAttempts?: number;
}

// =============================================================================
// Dataplane Port Configuration
// =============================================================================

/**
 * Configuration for a single dataplane port.
 * Ports are registered automatically on mount and cleaned up on unmount.
 */
export interface PortConfig {
  /** Direction of data flow (in, out, or bidirectional) */
  readonly direction: PortDirection;
  /** Type of data this port handles */
  readonly dataType: PortDataType;
  /** Visual position on the block edge */
  readonly position: PortPosition;
  /** Optional human-readable label */
  readonly label?: string;
}

/**
 * Dataplane configuration for EmbeddedBlockWrapper.
 * Enables data linking between blocks via the d2ts differential dataflow graph.
 */
export interface DataplaneConfig {
  /** Whether dataplane features are enabled for this block */
  readonly enabled: boolean;
  /** Port configurations (registered automatically on mount) */
  readonly ports?: readonly PortConfig[];
  /** Whether to show port indicators visually */
  readonly showIndicators?: boolean;
}

/**
 * State for registered dataplane ports.
 * Exposed via EmbeddedBlockContext for child components.
 */
export interface DataplaneState {
  /** Registered ports for this block (null if not yet registered) */
  readonly ports: ReadonlyArray<LinkPort>;
  /** Map from port position to port ID for quick lookup */
  readonly portIdByPosition: ReadonlyMap<PortPosition, PortId>;
  /** Whether all configured ports are registered */
  readonly isReady: boolean;
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
  /** Stream binding configuration for AVA integration */
  readonly streamConfig?: StreamBindingConfig;
  /** Callback when stream status changes */
  readonly onStreamStatusChange?: (status: StreamStatus) => void;
  /** Dataplane configuration for d2ts linking */
  readonly dataplaneConfig?: DataplaneConfig;
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
  /** Stream binding configuration (if provided) */
  readonly streamConfig?: StreamBindingConfig;
  /** Dataplane state (ports, connection info) */
  readonly dataplane?: DataplaneState;
  /** Actions */
  readonly actions: {
    readonly toggleFold: () => void;
    readonly expand: () => void;
    readonly collapse: () => void;
    readonly minimize: () => void;
    readonly toggleSettings: () => void;
    readonly setActiveTab: (tabId: string) => void;
    /** Connect to stream (manual trigger) */
    readonly connectStream: () => void;
    /** Disconnect from stream */
    readonly disconnectStream: () => void;
    /** Reconnect to stream after error */
    readonly reconnectStream: () => void;
  };
}
