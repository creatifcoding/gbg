/**
 * Overlay Atoms
 *
 * effect-atom bindings for the overlay system.
 *
 * Architecture:
 * - State atoms in ./state.ts are the source of truth
 * - Operations mutate state atoms via registry.update()
 * - Derived atoms auto-update via effect-atom reactivity
 * - No Effect.Ref — atoms handle all reactive state
 */

import { Atom, Registry, RegistryContext } from "@effect-atom/atom-react"
import * as React from "react"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import {
  type ContainerId,
  type OverlayId,
  type OverlayEventTag,
  type OverlayEvent,
} from "../schemas"
import { PortHub, EventDispatcher, type EventHandler } from "../services"
import { PortHubLive } from "../services/PortHub"
import { EventDispatcherLive } from "../services/EventDispatcher"
import * as Layer from "effect/Layer"

// ─────────────────────────────────────────────────────────────
// Global Registry Singleton
// ─────────────────────────────────────────────────────────────

/**
 * Global registry singleton for overlay state mutations.
 * This is shared across all overlay operations AND React components.
 * Components should use OverlayRegistryProvider to inject this registry.
 */
export const overlayRegistry = Registry.make()

// Re-export state atoms
export {
  containersStateAtom,
  containerIdsAtom,
  containerAtom,
  activeOverlaysAtom,
  containerExistsAtom,
  isOverlayActiveAtom,
} from "./state"

// Re-export visual overlay atoms
export {
  // Core state
  visualOverlaysAtom,
  zOrderByTypeAtom,
  slotsAtom,
  // Derived
  visibleOverlayIdsAtom,
  overlaysByTypeAtom,
  overlaysBySlotAtom,
  hasBlockingOverlayAtom,
  topOverlayByTypeAtom,
  overlayAtom,
  overlayCountByTypeAtom,
  totalVisibleOverlayCountAtom,
  slotIdsAtom,
  // Content registry
  registerContent,
  getContent,
  unregisterContent,
  hasContent,
  // Drawer slot registry (injection pattern)
  registerDrawerSlot,
  unregisterDrawerSlot,
  getDrawerSlotContent,
  hasDrawerSlotContent,
  // Mutations
  openOverlay,
  closeOverlay,
  removeOverlay,
  setAnimationState,
  bringToFront,
  sendToBack,
  registerSlot,
  unregisterSlot,
  updateSlotBounds,
} from "./visual"

// Re-export suppression atoms
export {
  // Core state
  suppressionsAtom,
  // Derived
  isSuppressedAtom,
  isTypeSuppressedAtom,
  activeSuppressionKeysAtom,
  suppressionCountAtom,
  // Mutations
  addSuppression,
  removeSuppression,
  toggleSuppression,
  clearAllSuppressions,
  clearTypeSuppressions,
  // Helpers
  typeSuppressionKey,
  instanceSuppressionKey,
  parseSuppressionKey,
} from "./suppression"

// Import mutation functions
import {
  containersStateAtom,
  containerAtom,
  activeOverlaysAtom,
  createContainer,
  destroyContainer,
  registerOverlay,
  unregisterOverlay,
  enableOverlay,
  disableOverlay,
  toggleOverlay,
  suspendOverlay,
  resumeOverlay,
} from "./state"

// ─────────────────────────────────────────────────────────────
// Services Layer (for PortHub and EventDispatcher only)
// ─────────────────────────────────────────────────────────────

/**
 * Services layer for port and event dispatch operations.
 * OverlayRegistry is no longer a service — state lives in atoms.
 */
export const OverlayServicesLive = Layer.mergeAll(
  PortHubLive,
  EventDispatcherLive
)

/**
 * Runtime atom for services that still need Effect context.
 */
export const overlayRuntimeAtom = Atom.runtime(OverlayServicesLive)

// ─────────────────────────────────────────────────────────────
// Container Operations (direct atom mutations)
// ─────────────────────────────────────────────────────────────

/**
 * Operations for container management.
 * These directly mutate the containersStateAtom via registry.update().
 */
export const containerOps = {
  /**
   * Create a container. Mutates state synchronously.
   */
  create: (containerId: ContainerId) => {
    overlayRegistry.update(containersStateAtom, (current) =>
      createContainer(current, containerId)
    )
  },

  /**
   * Destroy a container and its ports.
   */
  destroy: (containerId: ContainerId) => {
    // First destroy ports via Effect service
    // Then remove from state
    overlayRegistry.update(containersStateAtom, (current) =>
      destroyContainer(current, containerId)
    )
  },
}

// ─────────────────────────────────────────────────────────────
// Overlay Operations (direct atom mutations)
// ─────────────────────────────────────────────────────────────

type OverlayRef = { containerId: ContainerId; overlayId: OverlayId }
type OverlayRegistration = {
  containerId: ContainerId
  overlayId: OverlayId
  name: string
  visualPriority: number
  handlers: Record<string, EventHandler<unknown>>
}

/**
 * Operations for overlay lifecycle.
 */
export const overlayOps = {
  /**
   * Register an overlay with handlers.
   */
  register: overlayRuntimeAtom.fn<OverlayRegistration>()(
    ({ containerId, overlayId, name, visualPriority, handlers }) =>
      Effect.gen(function* () {
        const dispatcher = yield* EventDispatcher

        // Update atom state via registry
        overlayRegistry.update(containersStateAtom, (current) =>
          registerOverlay(current, containerId, overlayId, name, visualPriority)
        )

        // Register handlers with dispatcher
        for (const [eventTag, handler] of Object.entries(handlers)) {
          if (handler) {
            yield* dispatcher.registerHandler(
              containerId,
              overlayId,
              eventTag as OverlayEventTag,
              handler
            )
          }
        }
      })
  ),

  /**
   * Unregister an overlay and its handlers.
   */
  unregister: overlayRuntimeAtom.fn<OverlayRef>()(({ containerId, overlayId }) =>
    Effect.gen(function* () {
      const dispatcher = yield* EventDispatcher

      yield* dispatcher.unregisterOverlay(containerId, overlayId)

      overlayRegistry.update(containersStateAtom, (current) =>
        unregisterOverlay(current, containerId, overlayId)
      )
    })
  ),

  /**
   * Enable an overlay. Synchronous state update.
   */
  enable: ({ containerId, overlayId, name, visualPriority }: OverlayRef & { name?: string; visualPriority?: number }) => {
    overlayRegistry.update(containersStateAtom, (current) =>
      enableOverlay(current, containerId, overlayId, name, visualPriority)
    )
  },

  /**
   * Disable an overlay. Synchronous state update.
   */
  disable: ({ containerId, overlayId }: OverlayRef) => {
    overlayRegistry.update(containersStateAtom, (current) =>
      disableOverlay(current, containerId, overlayId)
    )
  },

  /**
   * Toggle an overlay. Synchronous state update.
   */
  toggle: ({ containerId, overlayId }: OverlayRef) => {
    overlayRegistry.update(containersStateAtom, (current) =>
      toggleOverlay(current, containerId, overlayId)
    )
  },

  /**
   * Suspend an overlay. Synchronous state update.
   */
  suspend: ({ containerId, overlayId }: OverlayRef) => {
    overlayRegistry.update(containersStateAtom, (current) =>
      suspendOverlay(current, containerId, overlayId)
    )
  },

  /**
   * Resume an overlay. Synchronous state update.
   */
  resume: ({ containerId, overlayId }: OverlayRef) => {
    overlayRegistry.update(containersStateAtom, (current) =>
      resumeOverlay(current, containerId, overlayId)
    )
  },
}

// ─────────────────────────────────────────────────────────────
// Event Dispatch Operations
// ─────────────────────────────────────────────────────────────

type DispatchArgs = {
  containerId: ContainerId
  event: OverlayEvent
}

export const dispatchOps = {
  /**
   * Dispatch an event through the overlay stack.
   */
  dispatch: overlayRuntimeAtom.fn<DispatchArgs>()(({ containerId, event }) =>
    Effect.gen(function* () {
      const dispatcher = yield* EventDispatcher
      return yield* dispatcher.dispatch(containerId, event)
    })
  ),
}

// ─────────────────────────────────────────────────────────────
// Port Operations
// ─────────────────────────────────────────────────────────────

type PortRef = { containerId: ContainerId; portId: string }
type PublishRef = PortRef & { payload: unknown }

export const portOps = {
  publish: overlayRuntimeAtom.fn<PublishRef>()(({ containerId, portId, payload }) =>
    Effect.gen(function* () {
      const hub = yield* PortHub
      yield* hub.publish(containerId, portId as any, payload)
    })
  ),

  destroy: overlayRuntimeAtom.fn<PortRef>()(({ containerId, portId }) =>
    Effect.gen(function* () {
      const hub = yield* PortHub
      yield* hub.destroyPort(containerId, portId as any)
    })
  ),
}

// ─────────────────────────────────────────────────────────────
// Legacy Compatibility Exports
// ─────────────────────────────────────────────────────────────

// These maintain API compatibility with existing code

/**
 * @deprecated Use containerAtom directly
 */
export const overlayInstanceAtom = Atom.family(
  ({ containerId, overlayId }: { containerId: ContainerId; overlayId: OverlayId }) =>
    Atom.make((get) => {
      const container = get(containerAtom(containerId))
      if (!container) return Option.none()
      const overlay = container.activeOverlays.find((o) => o.id === overlayId)
      return Option.fromNullable(overlay)
    })
)

/**
 * @deprecated Use portOps.publish
 *
 * NOTE: Uses string key to ensure stable atom references.
 * Object keys would create new atoms on each render due to reference inequality.
 */
export const portAtom = Atom.family(
  <T>(key: string) => {
    const [containerId, portId] = key.split("::", 2) as [ContainerId, string]
    return overlayRuntimeAtom.atom(
      Effect.gen(function* () {
        const hub = yield* PortHub
        return yield* hub.read<T>(containerId, portId as any)
      })
    )
  }
)

/**
 * Port list for a container.
 */
export const portListAtom = Atom.family((containerId: ContainerId) =>
  overlayRuntimeAtom.atom(
    Effect.gen(function* () {
      const hub = yield* PortHub
      return yield* hub.listPorts(containerId)
    })
  )
)

// ─────────────────────────────────────────────────────────────
// EventLog-Aware Atoms (re-export)
// ─────────────────────────────────────────────────────────────

export {
  OverlayEventLogLive,
  overlayEventLogRuntimeAtom,
  containerOps as eventLogContainerOps,
  overlayOps as eventLogOverlayOps,
  portOps as eventLogPortOps,
  dispatchOps as eventLogDispatchOps,
  containerIdsAtom as eventLogContainerIdsAtom,
  activeOverlaysAtom as eventLogActiveOverlaysAtom,
  containerAtom as eventLogContainerAtom,
} from "./eventlog"

// ─────────────────────────────────────────────────────────────
// React Provider (uses overlayRegistry)
// ─────────────────────────────────────────────────────────────

/**
 * Provider that injects the shared overlayRegistry into React context.
 * Wrap your app (or overlay-using subtree) with this provider to ensure
 * React components and imperative operations share the same registry.
 *
 * @example
 * ```tsx
 * function App() {
 *   return (
 *     <OverlayRegistryProvider>
 *       <MyOverlayComponents />
 *     </OverlayRegistryProvider>
 *   )
 * }
 * ```
 */
export function OverlayRegistryProvider({ children }: { children: React.ReactNode }) {
  return React.createElement(RegistryContext.Provider, { value: overlayRegistry }, children)
}
