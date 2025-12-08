/**
 * Overlay System
 *
 * Container-scoped, composable capability modules inspired by Emacs minor-modes.
 * Built on Effect with Schema-backed types.
 *
 * @example
 * ```tsx
 * import { OverlayRegistry, PortHub, EventDispatcher } from "@/lib/overlays"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 *
 * // Create the runtime layer
 * const OverlayLive = Layer.mergeAll(
 *   OverlayRegistry.Default,
 *   PortHub.Default,
 *   EventDispatcher.Default
 * )
 *
 * // Use in an Effect program
 * const program = Effect.gen(function* () {
 *   const registry = yield* OverlayRegistry
 *   const ports = yield* PortHub
 *
 *   yield* registry.createContainer("main-canvas" as ContainerId)
 *   yield* ports.publish("main-canvas" as ContainerId, "ready" as PortId, { status: "ok" })
 * })
 * ```
 */

// ─────────────────────────────────────────────────────────────
// Schemas
// ─────────────────────────────────────────────────────────────

export * from "./schemas"

// ─────────────────────────────────────────────────────────────
// Services
// ─────────────────────────────────────────────────────────────

export {
  OverlayRegistry,
  type OverlayRegistryOps,
  PortHub,
  type PortHubOps,
  type PortMessage,
  EventDispatcher,
  type EventDispatcherOps,
  type EventHandler,
  type HandlerContext,
  type HandlerRegistration,
  type DispatchResult,
  OverlayServicesLive,
} from "./services"

// ─────────────────────────────────────────────────────────────
// Overlay Class
// ─────────────────────────────────────────────────────────────

export {
  Overlay,
  createOverlay,
  composeOverlays,
  type Modifier,
  type ActivationContext,
  type ActivationPredicate,
  type OverlayHandlerContext,
  type TypedEventHandler,
  type OverlayHandlerMap,
  type PortConfig,
  type OverlayConfig,
} from "./Overlay"

// ─────────────────────────────────────────────────────────────
// Atoms (effect-atom bindings)
// ─────────────────────────────────────────────────────────────

export {
  overlayRuntimeAtom,
  overlayRegistry,
  OverlayRegistryProvider,
  containerAtom,
  containerIdsAtom,
  activeOverlaysAtom,
  overlayInstanceAtom,
  isOverlayActiveAtom,
  portAtom,
  portListAtom,
  containerOps,
  overlayOps,
  dispatchOps,
  portOps,
} from "./atoms"

// ─────────────────────────────────────────────────────────────
// React Hooks
// ─────────────────────────────────────────────────────────────

export {
  useOverlayContainer,
  type UseOverlayContainerOptions,
  type UseOverlayContainerResult,
  useOverlay,
  type UseOverlayOptions,
  type UseOverlayResult,
  usePort,
  usePublish,
  type UsePortOptions,
  type UsePortResult,
  useEventDispatch,
  type UseEventDispatchOptions,
  type UseEventDispatchResult,
  useEventStream,
  type UseEventStreamOptions,
  type UseEventStreamResult,
} from "./hooks"

// ─────────────────────────────────────────────────────────────
// Events (EventLog integration)
// ─────────────────────────────────────────────────────────────

export {
  // Event Groups
  ContainerEvents,
  OverlayEvents,
  PortEvents,
  OverlayEventLogSchema,
  // Handlers
  ContainerHandlersLive,
  OverlayHandlersLive,
  PortHandlersLive,
  // Reactivity
  Keys,
  ContainerReactivityLive,
  OverlayReactivityLive,
  PortReactivityLive,
  containerKey,
  overlayKey,
  portKey,
  // Event Tags
  type ContainerEventTag,
  type OverlayEventTag as OverlayLifecycleEventTag,
  type PortEventTag,
  type OverlaySystemEventTag,
  // Payload types
  type ContainerCreatedPayload,
  type ContainerDestroyedPayload,
  type OverlayRegisteredPayload,
  type OverlayUnregisteredPayload,
  type OverlayEnabledPayload,
  type OverlayDisabledPayload,
  type OverlaySuspendedPayload,
  type OverlayResumedPayload,
  type PortPublishedPayload,
  type PortDestroyedPayload,
  type ContainerPortsDestroyedPayload,
  // Startup Replay
  replayEvents,
  StartupReplayLive,
  type ReplayStats,
} from "./events"

// ─────────────────────────────────────────────────────────────
// EventLog Atoms (event-sourced state)
// ─────────────────────────────────────────────────────────────

export {
  OverlayEventLogLive,
  overlayEventLogRuntimeAtom,
  eventLogContainerOps,
  eventLogOverlayOps,
  eventLogPortOps,
  eventLogDispatchOps,
  eventLogContainerIdsAtom,
  eventLogActiveOverlaysAtom,
  eventLogContainerAtom,
} from "./atoms"

// ─────────────────────────────────────────────────────────────
// SCADA Overlays (Industrial HMI)
// ─────────────────────────────────────────────────────────────

export * as scada from "./scada"
