/**
 * Overlay System — Core Schemas
 *
 * Identity types and fundamental structures.
 * Uses TaggedStruct/TaggedClass for discriminated unions.
 */

import { Schema } from "effect"

// ─────────────────────────────────────────────────────────────
// Identity (Branded primitives)
// ─────────────────────────────────────────────────────────────

/** Unique identifier for an overlay definition */
export const OverlayId = Schema.String.pipe(
  Schema.brand("OverlayId"),
  Schema.minLength(1),
)
export type OverlayId = typeof OverlayId.Type

/** Unique identifier for a container (canvas, panel, viewport) */
export const ContainerId = Schema.String.pipe(
  Schema.brand("ContainerId"),
  Schema.minLength(1),
)
export type ContainerId = typeof ContainerId.Type

/** Unique identifier for a port */
export const PortId = Schema.String.pipe(
  Schema.brand("PortId"),
  Schema.minLength(1),
)
export type PortId = typeof PortId.Type

// ─────────────────────────────────────────────────────────────
// Geometry (Tagged for pattern matching in transforms)
// ─────────────────────────────────────────────────────────────

/** 2D position */
export const Position = Schema.TaggedStruct("Position", {
  x: Schema.Number,
  y: Schema.Number,
})
export type Position = typeof Position.Type

/** Rectangular bounds */
export const Bounds = Schema.TaggedStruct("Bounds", {
  x: Schema.Number,
  y: Schema.Number,
  width: Schema.Number,
  height: Schema.Number,
})
export type Bounds = typeof Bounds.Type

/** Size dimensions */
export const Size = Schema.TaggedStruct("Size", {
  width: Schema.Number,
  height: Schema.Number,
})
export type Size = typeof Size.Type

// ─────────────────────────────────────────────────────────────
// Overlay State (Literal union)
// ─────────────────────────────────────────────────────────────

/** Lifecycle state of an overlay within a container */
export const OverlayState = Schema.Literal(
  "inactive",   // Not active in container
  "active",     // Active and handling events
  "suspended",  // Temporarily paused (e.g., modal open)
)
export type OverlayState = typeof OverlayState.Type

// ─────────────────────────────────────────────────────────────
// Overlay Instance (TaggedClass for entity with methods)
// ─────────────────────────────────────────────────────────────

/** Runtime instance of an overlay in a container */
export class OverlayInstance extends Schema.TaggedClass<OverlayInstance>()(
  "OverlayInstance",
  {
    /** Overlay definition ID */
    id: OverlayId,
    /** Human-readable name */
    name: Schema.NonEmptyString,
    /** Current lifecycle state */
    state: OverlayState,
    /** Timestamp when activated (ms since epoch), null if inactive */
    activatedAt: Schema.NullOr(Schema.Number),
    /** Visual z-index priority (higher = on top) */
    visualPriority: Schema.Number,
    /** Position in LIFO stack (0 = bottom, higher = more recent) */
    stackPosition: Schema.Number,
  }
) {
  /** Check if overlay is currently active */
  get isActive(): boolean {
    return this.state === "active"
  }

  /** Check if overlay can handle events */
  get canHandle(): boolean {
    return this.state === "active"
  }
}

// ─────────────────────────────────────────────────────────────
// Handler Result (Literal union)
// ─────────────────────────────────────────────────────────────

/** Result returned by event handlers */
export const HandlerResult = Schema.Literal(
  "handled",    // Event consumed, stop propagation
  "delegate",   // Pass to next overlay in stack
  "broadcast",  // Handled, but also let others see it
)
export type HandlerResult = typeof HandlerResult.Type

// ─────────────────────────────────────────────────────────────
// Container State (TaggedClass for entity)
// ─────────────────────────────────────────────────────────────

/** State of an overlay container */
export class ContainerState extends Schema.TaggedClass<ContainerState>()(
  "ContainerState",
  {
    /** Container identifier */
    id: ContainerId,
    /** Active overlays in LIFO order (last = most recent) */
    activeOverlays: Schema.Array(OverlayInstance),
    /** Registered overlay IDs (available but not necessarily active) */
    registeredOverlays: Schema.Array(OverlayId),
    /** Whether container is accepting events */
    enabled: Schema.Boolean,
  }
) {
  /** Get the topmost (most recently enabled) overlay */
  get topOverlay(): OverlayInstance | undefined {
    return this.activeOverlays[this.activeOverlays.length - 1]
  }

  /** Check if a specific overlay is active */
  isOverlayActive(overlayId: OverlayId): boolean {
    return this.activeOverlays.some((o) => o.id === overlayId)
  }

  /** Get overlay by ID */
  getOverlay(overlayId: OverlayId): OverlayInstance | undefined {
    return this.activeOverlays.find((o) => o.id === overlayId)
  }
}
