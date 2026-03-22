/**
 * EventDispatcher Service
 *
 * Routes events through the overlay stack with LIFO conflict resolution.
 * Events flow from most-recently-enabled overlay to oldest.
 *
 * NOTE: This service is stateless for handler storage only.
 * Active overlays are passed in from atoms (React context).
 */

import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Ref from "effect/Ref"
import * as Option from "effect/Option"
import {
  type ContainerId,
  type OverlayId,
  type OverlayEvent,
  type OverlayEventTag,
  type HandlerResult,
  type OverlayInstance,
} from "../schemas"

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

/** Handler function signature */
export type EventHandler<T = unknown> = (
  event: OverlayEvent,
  context: HandlerContext
) => Effect.Effect<HandlerResult>

/** Context passed to event handlers */
export interface HandlerContext {
  /** Container ID where event occurred */
  readonly containerId: ContainerId
  /** Overlay ID that owns this handler */
  readonly overlayId: OverlayId
  /** Delegate to next overlay in stack */
  readonly delegate: () => Effect.Effect<HandlerResult>
}

/** Handler registration */
export interface HandlerRegistration {
  readonly overlayId: OverlayId
  readonly eventTag: OverlayEventTag
  readonly handler: EventHandler
}

/** Dispatch result */
export interface DispatchResult {
  /** Final result of event handling */
  readonly result: HandlerResult
  /** Overlay that handled the event (if any) */
  readonly handledBy: Option.Option<OverlayId>
  /** Overlays that saw the event (for broadcast) */
  readonly seenBy: ReadonlyArray<OverlayId>
}

// ─────────────────────────────────────────────────────────────
// Service Interface
// ─────────────────────────────────────────────────────────────

/** Operations provided by EventDispatcher */
export interface EventDispatcherOps {
  /**
   * Register an event handler for an overlay.
   * Use unregisterOverlay to clean up.
   */
  readonly registerHandler: (
    containerId: ContainerId,
    overlayId: OverlayId,
    eventTag: OverlayEventTag,
    handler: EventHandler
  ) => Effect.Effect<void>

  /**
   * Unregister all handlers for an overlay.
   */
  readonly unregisterOverlay: (
    containerId: ContainerId,
    overlayId: OverlayId
  ) => Effect.Effect<void>

  /**
   * Dispatch an event through the overlay stack.
   * Events flow LIFO: most recently enabled overlay first.
   *
   * @param containerId - Container ID
   * @param event - The event to dispatch
   * @param activeOverlays - Active overlays from atom (passed by caller)
   */
  readonly dispatch: (
    containerId: ContainerId,
    event: OverlayEvent,
    activeOverlays?: ReadonlyArray<OverlayInstance>
  ) => Effect.Effect<DispatchResult>

  /**
   * Check if any overlay handles a specific event type.
   */
  readonly hasHandler: (
    containerId: ContainerId,
    eventTag: OverlayEventTag
  ) => Effect.Effect<boolean>
}

// ─────────────────────────────────────────────────────────────
// Service Tag
// ─────────────────────────────────────────────────────────────

/** Handler storage key */
type HandlerKey = `${ContainerId}:${OverlayId}:${OverlayEventTag}`

const makeHandlerKey = (
  containerId: ContainerId,
  overlayId: OverlayId,
  eventTag: OverlayEventTag
): HandlerKey => `${containerId}:${overlayId}:${eventTag}` as HandlerKey

export class EventDispatcher extends Context.Tag("tmnl/overlays/EventDispatcher")<
  EventDispatcher,
  EventDispatcherOps
>() {
  /**
   * Default implementation - stateless except for handler storage
   */
  static Default = Layer.effect(
    EventDispatcher,
    Effect.gen(function* () {
      // State: Map of HandlerKey -> EventHandler
      const handlersRef = yield* Ref.make<Map<HandlerKey, EventHandler>>(new Map())

      // ─── Implementation ───

      return EventDispatcher.of({
        registerHandler: (containerId, overlayId, eventTag, handler) =>
          Ref.update(handlersRef, (map) => {
            const next = new Map(map)
            next.set(makeHandlerKey(containerId, overlayId, eventTag), handler)
            return next
          }),

        unregisterOverlay: (containerId, overlayId) =>
          Ref.update(handlersRef, (map) => {
            const prefix = `${containerId}:${overlayId}:`
            const next = new Map(map)
            for (const key of map.keys()) {
              if (key.startsWith(prefix)) {
                next.delete(key)
              }
            }
            return next
          }),

        dispatch: (containerId, event, activeOverlays = []) =>
          Effect.gen(function* () {
            const handlers = yield* Ref.get(handlersRef)

            // Extract event tag
            const eventTag = event._tag as OverlayEventTag

            // TRACE: Log dispatch entry
            yield* Effect.log(`[DISPATCH] container=${containerId} event=${eventTag} activeOverlays=${activeOverlays.length} handlers=${handlers.size}`)

            // Track which overlays saw the event
            const seenBy: OverlayId[] = []
            let handledBy: Option.Option<OverlayId> = Option.none()
            let finalResult: HandlerResult = "delegate"

            // Iterate in reverse (LIFO - most recent first)
            for (let i = activeOverlays.length - 1; i >= 0; i--) {
              const overlay = activeOverlays[i]
              const key = makeHandlerKey(containerId, overlay.id, eventTag)
              const handler = handlers.get(key)

              if (!handler) continue

              seenBy.push(overlay.id)

              // Create handler context with delegate capability
              const context: HandlerContext = {
                containerId,
                overlayId: overlay.id,
                delegate: () =>
                  Effect.succeed("delegate" as HandlerResult),
              }

              // Execute handler
              const result = yield* handler(event, context)

              // TRACE: Log handler result
              yield* Effect.log(`[DISPATCH] overlay=${overlay.id} result=${result}`)

              if (result === "handled") {
                handledBy = Option.some(overlay.id)
                finalResult = "handled"
                break // Stop propagation
              } else if (result === "broadcast") {
                handledBy = Option.some(overlay.id)
                finalResult = "broadcast"
                // Continue to let others see it
              }
              // result === "delegate" -> continue to next overlay
            }

            return {
              result: finalResult,
              handledBy,
              seenBy,
            }
          }),

        hasHandler: (containerId, eventTag) =>
          Effect.map(Ref.get(handlersRef), (map) => {
            const prefix = `${containerId}:`
            const suffix = `:${eventTag}`
            for (const key of map.keys()) {
              if (key.startsWith(prefix) && key.endsWith(suffix)) {
                return true
              }
            }
            return false
          }),
      })
    })
  )
}

/**
 * Standalone layer export for direct composition.
 */
export const EventDispatcherLive = EventDispatcher.Default
