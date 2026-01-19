/**
 * Panel State Schema
 *
 * Effect Schema definitions for InteractiveChartPanel state.
 * Provides type-safe state management with runtime validation.
 *
 * @module charts/interactive-panel/schemas/panel-state
 */

import { Schema, Option } from 'effect';

/**
 * Branded PanelId for type-safe panel identification.
 *
 * @example
 * ```ts
 * const panelId: PanelId = 'chart-1' as PanelId;
 * // Or use Schema.decode for runtime validation
 * ```
 */
export const PanelId = Schema.String.pipe(Schema.brand('PanelId'));
export type PanelId = typeof PanelId.Type;

/**
 * Cast a string to PanelId (unsafe - for internal use).
 */
export function asPanelId(value: string): PanelId {
  return value as PanelId;
}

/**
 * Panel fold states.
 *
 * - expanded: Full height, content visible
 * - collapsed: Reduced height, content partially visible
 * - minimized: Header only, content hidden
 */
export const FoldState = Schema.Literal('expanded', 'collapsed', 'minimized');
export type FoldState = typeof FoldState.Type;

/**
 * Stream connection status for AI-powered features.
 */
export const StreamStatus = Schema.Literal('idle', 'connecting', 'connected', 'error');
export type StreamStatus = typeof StreamStatus.Type;

/**
 * Panel state schema.
 *
 * Contains all mutable state for an InteractiveChartPanel instance.
 * Used with Atom.family for per-panel state isolation.
 */
export const PanelState = Schema.Struct({
  /** Current fold state */
  foldState: FoldState,
  /** Whether settings drawer is open */
  settingsOpen: Schema.Boolean,
  /** Currently active tab ID */
  activeTab: Schema.String, // TabId at runtime
  /** Whether panel is being hovered */
  isHovered: Schema.Boolean,
  /** Whether panel is selected */
  isSelected: Schema.Boolean,
  /** Custom height override (None = use default) */
  customHeight: Schema.OptionFromNullOr(Schema.Number),
  /** Whether settings panel is expanded to full panel */
  settingsExpanded: Schema.Boolean,
  /** Stream connection status */
  streamStatus: StreamStatus,
  /** Stream error message (if status is 'error') */
  streamError: Schema.NullOr(Schema.String),
  /** Last update timestamp */
  updatedAt: Schema.Number,
});

/**
 * PanelState type extracted from schema.
 */
export type PanelState = typeof PanelState.Type;

/**
 * Default panel state values.
 * Used when creating new panel state atoms.
 */
export const DEFAULT_PANEL_STATE: PanelState = {
  foldState: 'expanded',
  settingsOpen: false,
  activeTab: 'style',
  isHovered: false,
  isSelected: false,
  customHeight: Option.none(),
  settingsExpanded: false,
  streamStatus: 'idle',
  streamError: null,
  updatedAt: Date.now(),
};

/**
 * Create initial panel state with overrides.
 *
 * @example
 * ```ts
 * const state = createPanelState({ foldState: 'collapsed' });
 * // state.foldState === 'collapsed'
 * // state.activeTab === 'style' (default)
 * ```
 */
export function createPanelState(
  overrides: Partial<Omit<PanelState, 'customHeight' | 'updatedAt'>> & {
    customHeight?: number | null;
  } = {}
): PanelState {
  return {
    ...DEFAULT_PANEL_STATE,
    ...overrides,
    customHeight: overrides.customHeight !== undefined
      ? overrides.customHeight === null
        ? Option.none()
        : Option.some(overrides.customHeight)
      : DEFAULT_PANEL_STATE.customHeight,
    updatedAt: Date.now(),
  };
}

/**
 * Panel state patch for partial updates.
 */
export interface PanelStatePatch {
  foldState?: FoldState;
  settingsOpen?: boolean;
  activeTab?: string;
  isHovered?: boolean;
  isSelected?: boolean;
  customHeight?: number | null;
  settingsExpanded?: boolean;
  streamStatus?: StreamStatus;
  streamError?: string | null;
}

/**
 * Apply a patch to panel state.
 *
 * @example
 * ```ts
 * const newState = applyPanelPatch(state, { settingsOpen: true });
 * ```
 */
export function applyPanelPatch(
  state: PanelState,
  patch: PanelStatePatch
): PanelState {
  const result = { ...state, updatedAt: Date.now() };

  if (patch.foldState !== undefined) result.foldState = patch.foldState;
  if (patch.settingsOpen !== undefined) result.settingsOpen = patch.settingsOpen;
  if (patch.activeTab !== undefined) result.activeTab = patch.activeTab;
  if (patch.isHovered !== undefined) result.isHovered = patch.isHovered;
  if (patch.isSelected !== undefined) result.isSelected = patch.isSelected;
  if (patch.settingsExpanded !== undefined) result.settingsExpanded = patch.settingsExpanded;
  if (patch.streamStatus !== undefined) result.streamStatus = patch.streamStatus;
  if (patch.streamError !== undefined) result.streamError = patch.streamError;

  if (patch.customHeight !== undefined) {
    result.customHeight = patch.customHeight === null
      ? Option.none()
      : Option.some(patch.customHeight);
  }

  return result;
}

/**
 * Serializable panel state (for persistence).
 * Converts Option to nullable for JSON compatibility.
 */
export interface SerializablePanelState {
  foldState: FoldState;
  settingsOpen: boolean;
  activeTab: string;
  isHovered: boolean;
  isSelected: boolean;
  customHeight: number | null;
  settingsExpanded: boolean;
  streamStatus: StreamStatus;
  streamError: string | null;
  updatedAt: number;
}

/**
 * Convert PanelState to serializable format.
 */
export function toPersistence(state: PanelState): SerializablePanelState {
  return {
    ...state,
    customHeight: Option.getOrNull(state.customHeight),
  };
}

/**
 * Convert serializable format to PanelState.
 */
export function fromPersistence(data: SerializablePanelState): PanelState {
  return {
    ...data,
    customHeight: data.customHeight === null
      ? Option.none()
      : Option.some(data.customHeight),
  };
}
