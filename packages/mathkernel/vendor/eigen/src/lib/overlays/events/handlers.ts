/**
 * EventLog Handlers
 *
 * Event handlers that update Ref-based services when events are processed.
 * Each handler receives { payload, entry, conflicts } and calls existing service methods.
 */

import { EventLog } from "@effect/experimental"
import * as Effect from "effect/Effect"
import { OverlayRegistry } from "../services/OverlayRegistry"
import { PortHub } from "../services/PortHub"
import { ContainerEvents } from "./container"
import { OverlayEvents } from "./overlay"
import { PortEvents } from "./port"

// ─────────────────────────────────────────────────────────────
// Container Handlers
// ─────────────────────────────────────────────────────────────

/**
 * Handlers for ContainerEvents.
 * Returns a Layer providing the handler registrations.
 */
export const ContainerHandlersLive = EventLog.group(ContainerEvents, (handlers) =>
  handlers
    .handle("ContainerCreated", ({ payload }) =>
      Effect.gen(function* () {
        const registry = yield* OverlayRegistry
        yield* registry.createContainer(payload.containerId)
      })
    )
    .handle("ContainerDestroyed", ({ payload }) =>
      Effect.gen(function* () {
        const registry = yield* OverlayRegistry
        const hub = yield* PortHub
        // Clean up ports first, then container
        yield* hub.destroyContainerPorts(payload.containerId)
        yield* registry.destroyContainer(payload.containerId)
      })
    )
)

// ─────────────────────────────────────────────────────────────
// Overlay Handlers
// ─────────────────────────────────────────────────────────────

/**
 * Handlers for OverlayEvents.
 * Lifecycle transitions (register, enable, disable, suspend, resume).
 */
export const OverlayHandlersLive = EventLog.group(OverlayEvents, (handlers) =>
  handlers
    .handle("OverlayRegistered", ({ payload }) =>
      Effect.gen(function* () {
        const registry = yield* OverlayRegistry
        yield* registry.register(
          payload.containerId,
          payload.overlayId,
          payload.name,
          payload.visualPriority
        )
      })
    )
    .handle("OverlayUnregistered", ({ payload }) =>
      Effect.gen(function* () {
        const registry = yield* OverlayRegistry
        yield* registry.unregister(payload.containerId, payload.overlayId)
      })
    )
    .handle("OverlayEnabled", ({ payload }) =>
      Effect.gen(function* () {
        const registry = yield* OverlayRegistry
        yield* registry.enable(payload.containerId, payload.overlayId)
      })
    )
    .handle("OverlayDisabled", ({ payload }) =>
      Effect.gen(function* () {
        const registry = yield* OverlayRegistry
        yield* registry.disable(payload.containerId, payload.overlayId)
      })
    )
    .handle("OverlaySuspended", ({ payload }) =>
      Effect.gen(function* () {
        const registry = yield* OverlayRegistry
        yield* registry.suspend(payload.containerId, payload.overlayId)
      })
    )
    .handle("OverlayResumed", ({ payload }) =>
      Effect.gen(function* () {
        const registry = yield* OverlayRegistry
        yield* registry.resume(payload.containerId, payload.overlayId)
      })
    )
)

// ─────────────────────────────────────────────────────────────
// Port Handlers
// ─────────────────────────────────────────────────────────────

/**
 * Handlers for PortEvents.
 * Pub/sub operations.
 */
export const PortHandlersLive = EventLog.group(PortEvents, (handlers) =>
  handlers
    .handle("PortPublished", ({ payload }) =>
      Effect.gen(function* () {
        const hub = yield* PortHub
        yield* hub.publish(payload.containerId, payload.portId, payload.payload)
      })
    )
    .handle("PortDestroyed", ({ payload }) =>
      Effect.gen(function* () {
        const hub = yield* PortHub
        yield* hub.destroyPort(payload.containerId, payload.portId)
      })
    )
    .handle("ContainerPortsDestroyed", ({ payload }) =>
      Effect.gen(function* () {
        const hub = yield* PortHub
        yield* hub.destroyContainerPorts(payload.containerId)
      })
    )
)
