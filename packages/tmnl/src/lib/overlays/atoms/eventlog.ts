/**
 * EventLog-Aware Atoms
 *
 * Overlay atoms that use EventLog for state mutations.
 * Operations write events instead of calling services directly.
 *
 * Import these instead of the base atoms when EventLog is enabled.
 */

import { Atom } from "@effect-atom/atom"
import { EventLog, EventJournal, Reactivity } from "@effect/experimental"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Stream from "effect/Stream"
import * as Option from "effect/Option"
import {
  type ContainerId,
  type OverlayId,
  type OverlayEventTag,
  type OverlayEvent,
} from "../schemas"
import { OverlayRegistry, PortHub, EventDispatcher, OverlayServicesLive, type EventHandler } from "../services"
import {
  OverlayEventLogSchema,
  ContainerHandlersLive,
  OverlayHandlersLive,
  PortHandlersLive,
  ContainerReactivityLive,
  OverlayReactivityLive,
  PortReactivityLive,
  Keys,
} from "../events"

// ─────────────────────────────────────────────────────────────
// Layer Composition
// ─────────────────────────────────────────────────────────────

/**
 * Full EventLog layer combining:
 * - Base services (Registry, PortHub, EventDispatcher)
 * - EventLog + EventJournal (memory for now)
 * - All handlers
 * - All reactivity bindings
 */
export const OverlayEventLogLive = Layer.mergeAll(
  // Base services
  OverlayServicesLive,
  // EventLog infrastructure with memory journal
  EventJournal.layerMemory,
  Reactivity.layer,
).pipe(
  // Add handlers that update services on event processing
  Layer.provideMerge(ContainerHandlersLive),
  Layer.provideMerge(OverlayHandlersLive),
  Layer.provideMerge(PortHandlersLive),
  // Add reactivity bindings for auto-invalidation
  Layer.provideMerge(ContainerReactivityLive),
  Layer.provideMerge(OverlayReactivityLive),
  Layer.provideMerge(PortReactivityLive),
)

// ─────────────────────────────────────────────────────────────
// Runtime Atom
// ─────────────────────────────────────────────────────────────

/**
 * Runtime atom with EventLog support.
 * Use this instead of overlayRuntimeAtom when EventLog is enabled.
 */
export const overlayEventLogRuntimeAtom = Atom.runtime(OverlayEventLogLive)

// ─────────────────────────────────────────────────────────────
// Reactive Query Atoms
// ─────────────────────────────────────────────────────────────

/**
 * Container IDs atom using Reactivity.stream().
 * Auto-updates when ContainerCreated/Destroyed events fire.
 */
export const containerIdsAtom = overlayEventLogRuntimeAtom.atom(
  Reactivity.stream(
    [Keys.containers],
    Effect.gen(function* () {
      const registry = yield* OverlayRegistry
      return yield* registry.listContainers()
    })
  ).pipe(
    Stream.runLast,
    Effect.map((opt) => Option.getOrElse(opt, () => [] as ReadonlyArray<ContainerId>))
  )
)

/**
 * Active overlays atom family using Reactivity.stream().
 * Auto-updates when any overlay event fires.
 */
export const activeOverlaysAtom = Atom.family((containerId: ContainerId) =>
  overlayEventLogRuntimeAtom.atom(
    Reactivity.stream(
      [Keys.overlays, Keys.containers],
      Effect.gen(function* () {
        const registry = yield* OverlayRegistry
        return yield* registry.getActiveOverlays(containerId)
      })
    ).pipe(
      Stream.runLast,
      Effect.map((opt) => Option.getOrElse(opt, () => []))
    )
  )
)

/**
 * Container state atom family using Reactivity.stream().
 */
export const containerAtom = Atom.family((containerId: ContainerId) =>
  overlayEventLogRuntimeAtom.atom(
    Reactivity.stream(
      [Keys.containers],
      Effect.gen(function* () {
        const registry = yield* OverlayRegistry
        return yield* registry.getContainer(containerId)
      })
    ).pipe(
      Stream.runLast,
      Effect.map((opt) => Option.flatten(opt))
    )
  )
)

// ─────────────────────────────────────────────────────────────
// EventLog Operations
// ─────────────────────────────────────────────────────────────

/**
 * Container operations that write events.
 */
export const containerOps = {
  /**
   * Create a container by writing ContainerCreated event.
   */
  create: overlayEventLogRuntimeAtom.fn<ContainerId>()((containerId) =>
    Effect.gen(function* () {
      const log = yield* EventLog
      yield* log.write("ContainerCreated", {
        containerId,
        timestamp: Date.now(),
      })
    })
  ),

  /**
   * Destroy a container by writing ContainerDestroyed event.
   */
  destroy: overlayEventLogRuntimeAtom.fn<ContainerId>()((containerId) =>
    Effect.gen(function* () {
      const log = yield* EventLog
      yield* log.write("ContainerDestroyed", { containerId })
    })
  ),
}

/**
 * Overlay lifecycle operations that write events.
 */
type OverlayRef = { containerId: ContainerId; overlayId: OverlayId }

type OverlayRegistration = {
  containerId: ContainerId
  overlayId: OverlayId
  name: string
  visualPriority: number
  handlers: Record<string, EventHandler<unknown>>
}

export const overlayOps = {
  /**
   * Register an overlay by writing OverlayRegistered event.
   * Also registers DOM event handlers with the dispatcher.
   */
  register: overlayEventLogRuntimeAtom.fn<OverlayRegistration>()(
    ({ containerId, overlayId, name, visualPriority, handlers }) =>
      Effect.gen(function* () {
        const log = yield* EventLog
        const dispatcher = yield* EventDispatcher

        // Write the registration event
        yield* log.write("OverlayRegistered", {
          containerId,
          overlayId,
          name,
          visualPriority,
        })

        // Register DOM event handlers (not EventLog events)
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
   * Unregister an overlay by writing OverlayUnregistered event.
   */
  unregister: overlayEventLogRuntimeAtom.fn<OverlayRef>()(({ containerId, overlayId }) =>
    Effect.gen(function* () {
      const log = yield* EventLog
      const dispatcher = yield* EventDispatcher

      yield* dispatcher.unregisterOverlay(containerId, overlayId)
      yield* log.write("OverlayUnregistered", { containerId, overlayId })
    })
  ),

  /**
   * Enable an overlay by writing OverlayEnabled event.
   */
  enable: overlayEventLogRuntimeAtom.fn<OverlayRef>()(({ containerId, overlayId }) =>
    Effect.gen(function* () {
      const log = yield* EventLog
      yield* log.write("OverlayEnabled", {
        containerId,
        overlayId,
        activatedAt: Date.now(),
      })
    })
  ),

  /**
   * Disable an overlay by writing OverlayDisabled event.
   */
  disable: overlayEventLogRuntimeAtom.fn<OverlayRef>()(({ containerId, overlayId }) =>
    Effect.gen(function* () {
      const log = yield* EventLog
      yield* log.write("OverlayDisabled", { containerId, overlayId })
    })
  ),

  /**
   * Toggle overlay state.
   * Checks current state and writes appropriate event.
   */
  toggle: overlayEventLogRuntimeAtom.fn<OverlayRef>()(({ containerId, overlayId }) =>
    Effect.gen(function* () {
      const registry = yield* OverlayRegistry
      const log = yield* EventLog

      const isActive = yield* registry.isActive(containerId, overlayId)

      if (isActive) {
        yield* log.write("OverlayDisabled", { containerId, overlayId })
      } else {
        yield* log.write("OverlayEnabled", {
          containerId,
          overlayId,
          activatedAt: Date.now(),
        })
      }
    })
  ),

  /**
   * Suspend an overlay by writing OverlaySuspended event.
   */
  suspend: overlayEventLogRuntimeAtom.fn<OverlayRef>()(({ containerId, overlayId }) =>
    Effect.gen(function* () {
      const log = yield* EventLog
      yield* log.write("OverlaySuspended", { containerId, overlayId })
    })
  ),

  /**
   * Resume an overlay by writing OverlayResumed event.
   */
  resume: overlayEventLogRuntimeAtom.fn<OverlayRef>()(({ containerId, overlayId }) =>
    Effect.gen(function* () {
      const log = yield* EventLog
      yield* log.write("OverlayResumed", { containerId, overlayId })
    })
  ),
}

/**
 * Port operations that write events.
 */
type PortRef = { containerId: ContainerId; portId: string }
type PublishRef = PortRef & { payload: unknown }

export const portOps = {
  /**
   * Publish to a port by writing PortPublished event.
   */
  publish: overlayEventLogRuntimeAtom.fn<PublishRef>()(({ containerId, portId, payload }) =>
    Effect.gen(function* () {
      const log = yield* EventLog
      yield* log.write("PortPublished", {
        containerId,
        portId: portId as any,
        payload,
        timestamp: Date.now(),
      })
    })
  ),

  /**
   * Destroy a port by writing PortDestroyed event.
   */
  destroy: overlayEventLogRuntimeAtom.fn<PortRef>()(({ containerId, portId }) =>
    Effect.gen(function* () {
      const log = yield* EventLog
      yield* log.write("PortDestroyed", {
        containerId,
        portId: portId as any,
      })
    })
  ),
}

/**
 * DOM event dispatch (not EventLog events).
 * This still uses the dispatcher directly since DOM events
 * aren't persisted - they're ephemeral pointer/keyboard events.
 */
type DispatchArgs = {
  containerId: ContainerId
  event: OverlayEvent
}

export const dispatchOps = {
  dispatch: overlayEventLogRuntimeAtom.fn<DispatchArgs>()(({ containerId, event }) =>
    Effect.gen(function* () {
      const dispatcher = yield* EventDispatcher
      return yield* dispatcher.dispatch(containerId, event)
    })
  ),
}
