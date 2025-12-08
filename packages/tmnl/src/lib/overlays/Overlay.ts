/**
 * Overlay Class
 *
 * Container-scoped, composable capability module inspired by Emacs minor-modes.
 * Defines event handlers, port subscriptions, and activation logic.
 *
 * @example
 * ```tsx
 * const DragOverlay = new Overlay({
 *   id: "drag" as OverlayId,
 *   name: "Drag Handler",
 *   handlers: {
 *     PointerDown: (event, ctx) =>
 *       Effect.gen(function* () {
 *         if (event.button === "left") {
 *           yield* ctx.publish("drag:state" as PortId, { dragging: true })
 *           return "handled"
 *         }
 *         return "delegate"
 *       }),
 *     PointerUp: (event, ctx) =>
 *       Effect.gen(function* () {
 *         yield* ctx.publish("drag:state" as PortId, { dragging: false })
 *         return "handled"
 *       }),
 *   },
 *   ports: {
 *     subscriptions: ["selection:changed" as PortId],
 *     publications: ["drag:state" as PortId],
 *   },
 *   activationPredicate: (ctx) =>
 *     Effect.succeed(ctx.modifiers.includes("shift")),
 * })
 * ```
 */

import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import type { Scope } from "effect/Scope"
import {
  type OverlayId,
  type PortId,
  type ContainerId,
  type OverlayEvent,
  type OverlayEventTag,
  type HandlerResult,
} from "./schemas"
import {
  OverlayRegistry,
  PortHub,
  EventDispatcher,
  type EventHandler,
  type HandlerContext,
} from "./services"

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

/** Modifier keys for activation predicates */
export type Modifier = "shift" | "ctrl" | "alt" | "meta"

/** Context passed to activation predicates */
export interface ActivationContext {
  /** Current modifier keys pressed */
  readonly modifiers: ReadonlyArray<Modifier>
  /** Container where activation is being evaluated */
  readonly containerId: ContainerId
  /** Read a port value */
  readonly readPort: <T>(portId: PortId) => Effect.Effect<Option.Option<T>>
}

/** Activation predicate function */
export type ActivationPredicate = (ctx: ActivationContext) => Effect.Effect<boolean>

/** Handler context with overlay-specific operations */
export interface OverlayHandlerContext extends HandlerContext {
  /** Publish to a port */
  readonly publish: <T>(portId: PortId, payload: T) => Effect.Effect<void>
  /** Read from a port */
  readonly readPort: <T>(portId: PortId) => Effect.Effect<Option.Option<T>>
}

/** Typed event handler for a specific event tag */
export type TypedEventHandler<T extends OverlayEventTag> = (
  event: Extract<OverlayEvent, { _tag: T }>,
  context: OverlayHandlerContext
) => Effect.Effect<HandlerResult>

/** Handler map keyed by event tag */
export type OverlayHandlerMap = {
  [K in OverlayEventTag]?: TypedEventHandler<K>
}

/** Port configuration */
export interface PortConfig {
  /** Ports this overlay subscribes to */
  readonly subscriptions?: ReadonlyArray<PortId>
  /** Ports this overlay publishes to */
  readonly publications?: ReadonlyArray<PortId>
}

/** Overlay definition configuration */
export interface OverlayConfig {
  /** Unique identifier */
  readonly id: OverlayId
  /** Human-readable name */
  readonly name: string
  /** Visual z-index priority (higher = renders on top) */
  readonly visualPriority?: number
  /** Event handlers keyed by event tag */
  readonly handlers?: OverlayHandlerMap
  /** Port subscriptions and publications */
  readonly ports?: PortConfig
  /** Predicate for automatic activation */
  readonly activationPredicate?: ActivationPredicate
  /** Called when overlay is enabled */
  readonly onEnable?: (containerId: ContainerId) => Effect.Effect<void>
  /** Called when overlay is disabled */
  readonly onDisable?: (containerId: ContainerId) => Effect.Effect<void>
}

// ─────────────────────────────────────────────────────────────
// Overlay Class
// ─────────────────────────────────────────────────────────────

/**
 * Overlay class — a composable capability module.
 *
 * Overlays define event handlers, channel communication, and activation logic.
 * They are container-scoped and follow LIFO conflict resolution.
 */
export class Overlay {
  readonly id: OverlayId
  readonly name: string
  readonly visualPriority: number
  readonly handlers: OverlayHandlerMap
  readonly ports: PortConfig
  readonly activationPredicate: ActivationPredicate | undefined
  readonly onEnable: ((containerId: ContainerId) => Effect.Effect<void>) | undefined
  readonly onDisable: ((containerId: ContainerId) => Effect.Effect<void>) | undefined

  constructor(config: OverlayConfig) {
    this.id = config.id
    this.name = config.name
    this.visualPriority = config.visualPriority ?? 0
    this.handlers = config.handlers ?? {}
    this.ports = config.ports ?? {}
    this.activationPredicate = config.activationPredicate
    this.onEnable = config.onEnable
    this.onDisable = config.onDisable
  }

  // ─── Registration ───

  /**
   * Register this overlay with a container.
   * Returns a scoped effect that unregisters on scope finalization.
   */
  register(containerId: ContainerId): Effect.Effect<void, never, Scope> {
    return Effect.gen(this, function* () {
      const registry = yield* OverlayRegistry
      const dispatcher = yield* EventDispatcher

      // Register with the registry
      yield* registry.register(containerId, this.id, this.name, this.visualPriority)

      // Register all event handlers
      for (const [eventTag, handler] of Object.entries(this.handlers)) {
        if (handler) {
          const wrappedHandler = this.wrapHandler(
            containerId,
            handler as TypedEventHandler<OverlayEventTag>
          )
          yield* dispatcher.registerHandler(
            containerId,
            this.id,
            eventTag as OverlayEventTag,
            wrappedHandler
          )
        }
      }
    }).pipe(
      Effect.acquireRelease(() =>
        Effect.gen(this, function* () {
          const registry = yield* OverlayRegistry
          const dispatcher = yield* EventDispatcher

          yield* dispatcher.unregisterOverlay(containerId, this.id)
          yield* registry.unregister(containerId, this.id)
        })
      )
    )
  }

  // ─── Lifecycle ───

  /**
   * Enable this overlay in a container.
   */
  enable(containerId: ContainerId): Effect.Effect<void> {
    return Effect.gen(this, function* () {
      const registry = yield* OverlayRegistry
      yield* registry.enable(containerId, this.id)

      if (this.onEnable) {
        yield* this.onEnable(containerId)
      }
    })
  }

  /**
   * Disable this overlay in a container.
   */
  disable(containerId: ContainerId): Effect.Effect<void> {
    return Effect.gen(this, function* () {
      const registry = yield* OverlayRegistry

      if (this.onDisable) {
        yield* this.onDisable(containerId)
      }

      yield* registry.disable(containerId, this.id)
    })
  }

  /**
   * Toggle this overlay in a container.
   */
  toggle(containerId: ContainerId): Effect.Effect<void> {
    return Effect.gen(this, function* () {
      const registry = yield* OverlayRegistry
      const isActive = yield* registry.isActive(containerId, this.id)

      if (isActive) {
        yield* this.disable(containerId)
      } else {
        yield* this.enable(containerId)
      }
    })
  }

  // ─── Activation Predicate ───

  /**
   * Check if this overlay should be activated given the current context.
   */
  shouldActivate(ctx: ActivationContext): Effect.Effect<boolean> {
    if (!this.activationPredicate) {
      return Effect.succeed(false)
    }
    return this.activationPredicate(ctx)
  }

  // ─── Port Helpers ───

  /**
   * Publish a message to a port.
   */
  publish<T>(containerId: ContainerId, portId: PortId, payload: T): Effect.Effect<void> {
    return Effect.gen(function* () {
      const hub = yield* PortHub
      yield* hub.publish(containerId, portId, payload)
    })
  }

  /**
   * Read the latest value from a port.
   */
  readPort<T>(containerId: ContainerId, portId: PortId): Effect.Effect<Option.Option<T>> {
    return Effect.gen(function* () {
      const hub = yield* PortHub
      return yield* hub.read<T>(containerId, portId)
    })
  }

  // ─── Handler Access ───

  /**
   * Get all wrapped handlers for registration.
   * Used by atom-based registration to access handlers through shared runtime.
   */
  getWrappedHandlers(containerId: ContainerId): Record<string, EventHandler> {
    const wrapped: Record<string, EventHandler> = {}

    for (const [eventTag, handler] of Object.entries(this.handlers)) {
      if (handler) {
        wrapped[eventTag] = this.wrapHandler(
          containerId,
          handler as TypedEventHandler<OverlayEventTag>
        )
      }
    }

    return wrapped
  }

  // ─── Private Helpers ───

  /**
   * Wrap a typed handler to inject overlay-specific context.
   */
  private wrapHandler(
    containerId: ContainerId,
    handler: TypedEventHandler<OverlayEventTag>
  ): EventHandler {
    return (event: OverlayEvent, baseContext: HandlerContext): Effect.Effect<HandlerResult> => {
      const overlayContext: OverlayHandlerContext = {
        ...baseContext,
        publish: <T>(portId: PortId, payload: T) =>
          this.publish(containerId, portId, payload),
        readPort: <T>(portId: PortId) => this.readPort<T>(containerId, portId),
      }

      return handler(event as any, overlayContext)
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Factory Helpers
// ─────────────────────────────────────────────────────────────

/**
 * Create an overlay with type inference for handlers.
 *
 * @example
 * ```ts
 * const myOverlay = createOverlay({
 *   id: "my-overlay" as OverlayId,
 *   name: "My Overlay",
 *   handlers: {
 *     PointerDown: (event, ctx) => Effect.succeed("handled"),
 *   },
 * })
 * ```
 */
export const createOverlay = (config: OverlayConfig): Overlay => new Overlay(config)

/**
 * Compose multiple overlays into a registration effect.
 *
 * @example
 * ```ts
 * const registration = composeOverlays(containerId, [
 *   DragOverlay,
 *   SelectionOverlay,
 *   KeyboardOverlay,
 * ])
 * ```
 */
export const composeOverlays = (
  containerId: ContainerId,
  overlays: ReadonlyArray<Overlay>
): Effect.Effect<void, never, Scope> =>
  Effect.forEach(overlays, (overlay) => overlay.register(containerId), {
    discard: true,
  })
