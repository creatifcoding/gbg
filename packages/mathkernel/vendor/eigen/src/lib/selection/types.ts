/**
 * Selection System Types
 *
 * Marquee selection + grouping for card-based UI.
 *
 * @module
 */

import { Schema } from 'effect'

// =============================================================================
// Schemas
// =============================================================================

export const Position = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
})
export type Position = typeof Position.Type

export const Rect = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  width: Schema.Number,
  height: Schema.Number,
})
export type Rect = typeof Rect.Type

export const SelectionMode = Schema.Literal('replace', 'add', 'toggle')
export type SelectionMode = typeof SelectionMode.Type

export const GroupState = Schema.Struct({
  id: Schema.String,
  memberIds: Schema.Array(Schema.String),
  createdAt: Schema.Number,
})
export type GroupState = typeof GroupState.Type

// =============================================================================
// State
// =============================================================================

export interface SelectionState {
  /** Currently selected item IDs */
  selectedIds: Set<string>
  /** Active marquee rectangle (null when not dragging) */
  marqueeRect: Rect | null
  /** Is marquee drag in progress */
  isSelecting: boolean
  /** Modifier key state */
  modifiers: {
    shift: boolean
    ctrl: boolean
    alt: boolean
  }
  /** Groups of items */
  groups: Map<string, GroupState>
  /** Map of itemId -> groupId for fast lookup */
  itemToGroup: Map<string, string>
}

// =============================================================================
// Events
// =============================================================================

export type SelectionEvent =
  | { type: 'START_MARQUEE'; position: Position; mode: SelectionMode }
  | { type: 'UPDATE_MARQUEE'; position: Position }
  | { type: 'END_MARQUEE'; itemsInRect: string[] }
  | { type: 'CANCEL_MARQUEE' }
  | { type: 'SELECT_ITEM'; id: string; mode: SelectionMode }
  | { type: 'SELECT_ITEMS'; ids: string[]; mode: SelectionMode }
  | { type: 'DESELECT_ITEM'; id: string }
  | { type: 'DESELECT_ALL' }
  | { type: 'SELECT_ALL'; ids: string[] }
  | { type: 'GROUP_SELECTED' }
  | { type: 'UNGROUP_SELECTED' }
  | { type: 'DELETE_SELECTED' }
  | { type: 'UPDATE_MODIFIERS'; modifiers: { shift: boolean; ctrl: boolean; alt: boolean } }

// =============================================================================
// Selectable Item Interface
// =============================================================================

export interface SelectableItem {
  id: string
  getBounds: () => DOMRect | null
}

// =============================================================================
// Config
// =============================================================================

export interface SelectionConfig {
  /** Minimum drag distance before marquee activates (px) */
  activationDistance?: number
  /** Color for selection ring */
  selectionColor?: 'cyan' | 'orange' | 'violet' | 'green'
  /** Enable grouping feature */
  enableGrouping?: boolean
  /** Custom hotkeys */
  hotkeys?: {
    selectAll?: string      // default: 'ctrl+a'
    deselectAll?: string    // default: 'escape'
    group?: string          // default: 'shift+g'
    ungroup?: string        // default: 'shift+u'
    delete?: string         // default: 'delete' or 'backspace'
  }
}
