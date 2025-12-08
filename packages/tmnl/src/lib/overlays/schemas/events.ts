/**
 * Overlay System — Event Schemas
 *
 * DOM event abstractions for overlay handlers.
 * Uses TaggedStruct for discriminated event unions.
 */

import { Schema } from "effect"
import { ContainerId, OverlayId } from "./core"

// ─────────────────────────────────────────────────────────────
// Shared Components
// ─────────────────────────────────────────────────────────────

/** Modifier keys state */
export const Modifiers = Schema.Struct({
  shift: Schema.Boolean,
  ctrl: Schema.Boolean,
  alt: Schema.Boolean,
  meta: Schema.Boolean,
})
export type Modifiers = typeof Modifiers.Type

/** Mouse button identifier */
export const PointerButton = Schema.Literal(
  "left",
  "middle",
  "right",
  "back",
  "forward",
)
export type PointerButton = typeof PointerButton.Type

/** 2D vector (untagged for embedding) */
export const Vec2 = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
})
export type Vec2 = typeof Vec2.Type

// ─────────────────────────────────────────────────────────────
// Pointer Events (TaggedStruct for each type)
// ─────────────────────────────────────────────────────────────

const PointerEventBase = {
  containerId: ContainerId,
  position: Vec2,
  delta: Vec2,
  buttons: Schema.Array(PointerButton),
  modifiers: Modifiers,
  targetId: Schema.NullOr(Schema.String),
  timestamp: Schema.Number,
  pointerId: Schema.Number,
}

export const PointerDown = Schema.TaggedStruct("PointerDown", {
  ...PointerEventBase,
  button: PointerButton,
})
export type PointerDown = typeof PointerDown.Type

export const PointerMove = Schema.TaggedStruct("PointerMove", {
  ...PointerEventBase,
})
export type PointerMove = typeof PointerMove.Type

export const PointerUp = Schema.TaggedStruct("PointerUp", {
  ...PointerEventBase,
  button: PointerButton,
})
export type PointerUp = typeof PointerUp.Type

export const PointerEnter = Schema.TaggedStruct("PointerEnter", {
  ...PointerEventBase,
})
export type PointerEnter = typeof PointerEnter.Type

export const PointerLeave = Schema.TaggedStruct("PointerLeave", {
  ...PointerEventBase,
})
export type PointerLeave = typeof PointerLeave.Type

export const PointerCancel = Schema.TaggedStruct("PointerCancel", {
  ...PointerEventBase,
})
export type PointerCancel = typeof PointerCancel.Type

/** Union of all pointer events */
export const PointerEvent = Schema.Union(
  PointerDown,
  PointerMove,
  PointerUp,
  PointerEnter,
  PointerLeave,
  PointerCancel,
)
export type PointerEvent = typeof PointerEvent.Type

// ─────────────────────────────────────────────────────────────
// Keyboard Events (TaggedStruct for each type)
// ─────────────────────────────────────────────────────────────

const KeyEventBase = {
  containerId: ContainerId,
  key: Schema.String,
  code: Schema.String,
  modifiers: Modifiers,
  repeat: Schema.Boolean,
  timestamp: Schema.Number,
}

export const KeyDown = Schema.TaggedStruct("KeyDown", {
  ...KeyEventBase,
})
export type KeyDown = typeof KeyDown.Type

export const KeyUp = Schema.TaggedStruct("KeyUp", {
  ...KeyEventBase,
})
export type KeyUp = typeof KeyUp.Type

export const KeyPress = Schema.TaggedStruct("KeyPress", {
  ...KeyEventBase,
})
export type KeyPress = typeof KeyPress.Type

/** Union of all keyboard events */
export const KeyEvent = Schema.Union(KeyDown, KeyUp, KeyPress)
export type KeyEvent = typeof KeyEvent.Type

// ─────────────────────────────────────────────────────────────
// Wheel Event
// ─────────────────────────────────────────────────────────────

export const WheelEvent = Schema.TaggedStruct("WheelEvent", {
  containerId: ContainerId,
  position: Vec2,
  deltaX: Schema.Number,
  deltaY: Schema.Number,
  deltaZ: Schema.Number,
  modifiers: Modifiers,
  timestamp: Schema.Number,
})
export type WheelEvent = typeof WheelEvent.Type

// ─────────────────────────────────────────────────────────────
// Custom Events (for overlay-to-overlay communication)
// ─────────────────────────────────────────────────────────────

export const CustomEvent = Schema.TaggedStruct("CustomEvent", {
  /** Custom event subtype (e.g., "selection:changed") */
  subtype: Schema.String,
  containerId: ContainerId,
  sourceOverlayId: Schema.NullOr(OverlayId),
  payload: Schema.Unknown,
  timestamp: Schema.Number,
})
export type CustomEvent = typeof CustomEvent.Type

// ─────────────────────────────────────────────────────────────
// Focus Events
// ─────────────────────────────────────────────────────────────

export const FocusIn = Schema.TaggedStruct("FocusIn", {
  containerId: ContainerId,
  targetId: Schema.NullOr(Schema.String),
  timestamp: Schema.Number,
})
export type FocusIn = typeof FocusIn.Type

export const FocusOut = Schema.TaggedStruct("FocusOut", {
  containerId: ContainerId,
  targetId: Schema.NullOr(Schema.String),
  timestamp: Schema.Number,
})
export type FocusOut = typeof FocusOut.Type

export const FocusEvent = Schema.Union(FocusIn, FocusOut)
export type FocusEvent = typeof FocusEvent.Type

// ─────────────────────────────────────────────────────────────
// Union of All Events
// ─────────────────────────────────────────────────────────────

/** Any overlay event — discriminated by _tag */
export const OverlayEvent = Schema.Union(
  // Pointer
  PointerDown,
  PointerMove,
  PointerUp,
  PointerEnter,
  PointerLeave,
  PointerCancel,
  // Keyboard
  KeyDown,
  KeyUp,
  KeyPress,
  // Wheel
  WheelEvent,
  // Focus
  FocusIn,
  FocusOut,
  // Custom
  CustomEvent,
)
export type OverlayEvent = typeof OverlayEvent.Type

// ─────────────────────────────────────────────────────────────
// Event Tag Type (for handler registration)
// ─────────────────────────────────────────────────────────────

/** All possible event tags */
export const OverlayEventTag = Schema.Literal(
  "PointerDown",
  "PointerMove",
  "PointerUp",
  "PointerEnter",
  "PointerLeave",
  "PointerCancel",
  "KeyDown",
  "KeyUp",
  "KeyPress",
  "WheelEvent",
  "FocusIn",
  "FocusOut",
  "CustomEvent",
)
export type OverlayEventTag = typeof OverlayEventTag.Type
