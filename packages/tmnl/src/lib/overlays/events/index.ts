/**
 * Overlay System Events
 *
 * EventLog integration for event-sourced overlay state management.
 * Combines all event groups into a unified schema.
 */

import { EventLog } from "@effect/experimental"

// ─────────────────────────────────────────────────────────────
// Event Groups
// ─────────────────────────────────────────────────────────────

export { ContainerEvents } from "./container"
export type {
  ContainerCreatedPayload,
  ContainerDestroyedPayload,
} from "./container"

export { OverlayEvents } from "./overlay"
export type {
  OverlayRegisteredPayload,
  OverlayUnregisteredPayload,
  OverlayEnabledPayload,
  OverlayDisabledPayload,
  OverlaySuspendedPayload,
  OverlayResumedPayload,
} from "./overlay"

export { PortEvents } from "./port"
export type {
  PortPublishedPayload,
  PortDestroyedPayload,
  ContainerPortsDestroyedPayload,
} from "./port"

// ─────────────────────────────────────────────────────────────
// Combined Schema
// ─────────────────────────────────────────────────────────────

import { ContainerEvents } from "./container"
import { OverlayEvents } from "./overlay"
import { PortEvents } from "./port"

/**
 * Combined EventLog schema for the entire overlay system.
 * Use with EventLog.makeClient() to get a typed event writer.
 */
export const OverlayEventLogSchema = EventLog.schema(
  ContainerEvents,
  OverlayEvents,
  PortEvents,
)

// ─────────────────────────────────────────────────────────────
// Event Tags (for handler registration)
// ─────────────────────────────────────────────────────────────

/** All container event tags */
export type ContainerEventTag =
  | "ContainerCreated"
  | "ContainerDestroyed"

/** All overlay event tags */
export type OverlayEventTag =
  | "OverlayRegistered"
  | "OverlayUnregistered"
  | "OverlayEnabled"
  | "OverlayDisabled"
  | "OverlaySuspended"
  | "OverlayResumed"

/** All port event tags */
export type PortEventTag =
  | "PortPublished"
  | "PortDestroyed"
  | "ContainerPortsDestroyed"

/** All overlay system event tags */
export type OverlaySystemEventTag =
  | ContainerEventTag
  | OverlayEventTag
  | PortEventTag

// ─────────────────────────────────────────────────────────────
// Handlers
// ─────────────────────────────────────────────────────────────

export {
  ContainerHandlersLive,
  OverlayHandlersLive,
  PortHandlersLive,
} from "./handlers"

// ─────────────────────────────────────────────────────────────
// Reactivity
// ─────────────────────────────────────────────────────────────

export {
  Keys,
  ContainerReactivityLive,
  OverlayReactivityLive,
  PortReactivityLive,
  containerKey,
  overlayKey,
  portKey,
} from "./reactivity"

// ─────────────────────────────────────────────────────────────
// Startup Replay
// ─────────────────────────────────────────────────────────────

export {
  replayEvents,
  StartupReplayLive,
  type ReplayStats,
} from "./startup"
