/**
 * Overlay Services — Exports
 *
 * Architecture change:
 * - OverlayRegistry is DEPRECATED — state lives in atoms (./atoms/state.ts)
 * - PortHub and EventDispatcher remain as Effect services
 * - Services are composed in ./atoms/index.ts
 */

// PortHub — typed pub/sub for overlay communication
export {
  PortHub,
  PortHubLive,
  type PortHubOps,
  type PortMessage,
} from "./PortHub"

// EventDispatcher — LIFO event routing
export {
  EventDispatcher,
  EventDispatcherLive,
  type EventDispatcherOps,
  type EventHandler,
  type HandlerContext,
  type HandlerRegistration,
  type DispatchResult,
} from "./EventDispatcher"

// Legacy: OverlayRegistry is deprecated but kept for backwards compat
// New code should use atoms directly
export {
  OverlayRegistry,
  type OverlayRegistryOps,
} from "./OverlayRegistry"

// Combined layer is now in atoms/index.ts
// This export is for backwards compatibility only
import * as Layer from "effect/Layer"
import { PortHubLive } from "./PortHub"
import { EventDispatcherLive } from "./EventDispatcher"

/** @deprecated Use OverlayServicesLive from ./atoms instead */
export const OverlayServicesLive = Layer.mergeAll(
  PortHubLive,
  EventDispatcherLive
)
