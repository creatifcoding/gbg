/**
 * Reactivity Bindings
 *
 * Maps overlay events to invalidation keys for Reactivity.stream().
 * When an event is written, the associated keys are invalidated,
 * causing subscribed atoms to re-run their queries.
 *
 * Note: EventLog.groupReactivity takes static keys per event tag.
 * For dynamic keys (based on payload), use Reactivity.invalidate()
 * in handlers directly.
 */

import { EventLog } from "@effect/experimental"
import { ContainerEvents } from "./container"
import { OverlayEvents } from "./overlay"
import { PortEvents } from "./port"

// ─────────────────────────────────────────────────────────────
// Static Invalidation Keys
// ─────────────────────────────────────────────────────────────

/**
 * Static invalidation key namespaces.
 * These are invalidated whenever ANY event of that type fires.
 *
 * For more granular invalidation (per container/overlay),
 * use Reactivity.invalidate() in handlers with dynamic keys.
 */
export const Keys = {
  /** Any container change */
  containers: "containers",
  /** Any overlay change */
  overlays: "overlays",
  /** Any port change */
  ports: "ports",
} as const

// ─────────────────────────────────────────────────────────────
// Container Reactivity
// ─────────────────────────────────────────────────────────────

/**
 * Reactivity bindings for container events.
 * All container events invalidate the "containers" key.
 */
export const ContainerReactivityLive = EventLog.groupReactivity(
  ContainerEvents,
  [Keys.containers]
)

// ─────────────────────────────────────────────────────────────
// Overlay Reactivity
// ─────────────────────────────────────────────────────────────

/**
 * Reactivity bindings for overlay events.
 * All overlay events invalidate the "overlays" key.
 */
export const OverlayReactivityLive = EventLog.groupReactivity(
  OverlayEvents,
  [Keys.overlays, Keys.containers] // Container state includes active overlays
)

// ─────────────────────────────────────────────────────────────
// Port Reactivity
// ─────────────────────────────────────────────────────────────

/**
 * Reactivity bindings for port events.
 * All port events invalidate the "ports" key.
 */
export const PortReactivityLive = EventLog.groupReactivity(
  PortEvents,
  [Keys.ports]
)

// ─────────────────────────────────────────────────────────────
// Dynamic Invalidation Helpers
// ─────────────────────────────────────────────────────────────

/**
 * Creates dynamic invalidation key for a specific container.
 * Use with Reactivity.stream() for per-container subscriptions.
 */
export const containerKey = (containerId: string): string =>
  `container:${containerId}`

/**
 * Creates dynamic invalidation key for a specific overlay.
 */
export const overlayKey = (containerId: string, overlayId: string): string =>
  `overlay:${containerId}:${overlayId}`

/**
 * Creates dynamic invalidation key for a specific port.
 */
export const portKey = (containerId: string, portId: string): string =>
  `port:${containerId}:${portId}`
