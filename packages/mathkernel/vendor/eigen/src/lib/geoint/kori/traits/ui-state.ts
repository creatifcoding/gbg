/**
 * GEOINT UI State Traits
 *
 * UI-specific traits for entity state management.
 * These traits are attached to entities to track UI interactions.
 *
 * @module
 */

import { Schema } from 'effect'
import { defineTrait, registerTrait, type TraitId } from '../../../kori/schemas/trait'

// ─────────────────────────────────────────────────────────────────────────────
// UI State Trait
// ─────────────────────────────────────────────────────────────────────────────

/**
 * UIState trait - primary UI interaction state.
 *
 * This is the core trait for tracking how the user interacts with an entity.
 */
export const UIState = defineTrait('UIState', {
  /** Whether entity is currently selected */
  selected: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  /** Whether entity is currently hovered */
  hovered: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  /** Whether entity detail panel is expanded */
  expanded: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  /** Whether entity is highlighted (e.g., search match) */
  highlighted: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  /** Whether entity is pinned (persists across searches) */
  pinned: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  /** Whether entity has been viewed by user */
  viewed: Schema.optionalWith(Schema.Boolean, { default: () => false }),
})
export type UIState = typeof UIState.Type

/**
 * Default UIState values for new entities.
 */
export const DEFAULT_UI_STATE: UIState = {
  _tag: 'UIState',
  selected: false,
  hovered: false,
  expanded: false,
  highlighted: false,
  pinned: false,
  viewed: false,
}

// ─────────────────────────────────────────────────────────────────────────────
// UI Focus Trait
// ─────────────────────────────────────────────────────────────────────────────

/**
 * UIFocus trait - focus state for keyboard navigation.
 */
export const UIFocus = defineTrait('UIFocus', {
  /** Whether entity has keyboard focus */
  focused: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  /** Focus source (keyboard, mouse, programmatic) */
  focusSource: Schema.optional(Schema.Literal('keyboard', 'mouse', 'programmatic')),
  /** Tab index for navigation order */
  tabIndex: Schema.optional(Schema.Number),
})
export type UIFocus = typeof UIFocus.Type

// ─────────────────────────────────────────────────────────────────────────────
// UI Edit State Trait
// ─────────────────────────────────────────────────────────────────────────────

/**
 * UIEditState trait - edit mode state.
 */
export const UIEditState = defineTrait('UIEditState', {
  /** Whether entity is being edited */
  editing: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  /** Which field is being edited */
  editingField: Schema.optional(Schema.String),
  /** Pending changes not yet saved */
  hasPendingChanges: Schema.optionalWith(Schema.Boolean, { default: () => false }),
})
export type UIEditState = typeof UIEditState.Type

// ─────────────────────────────────────────────────────────────────────────────
// Registration
// ─────────────────────────────────────────────────────────────────────────────

registerTrait('UIState' as TraitId, UIState)
registerTrait('UIFocus' as TraitId, UIFocus)
registerTrait('UIEditState' as TraitId, UIEditState)
