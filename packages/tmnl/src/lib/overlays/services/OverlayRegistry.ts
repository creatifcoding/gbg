/**
 * OverlayRegistry Service
 *
 * Manages containers and overlay lifecycle.
 * Single source of truth for which overlays are active in which containers.
 */

import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Ref from "effect/Ref"
import * as Option from "effect/Option"
import * as Array from "effect/Array"
import {
  type ContainerId,
  type OverlayId,
  OverlayInstance,
  ContainerState,
  type OverlayState,
} from "../schemas"

// ─────────────────────────────────────────────────────────────
// Service Interface
// ─────────────────────────────────────────────────────────────

/** Operations provided by OverlayRegistry */
export interface OverlayRegistryOps {
  // ─── Container Management ───
  /** Create a new container */
  readonly createContainer: (id: ContainerId) => Effect.Effect<void>
  /** Destroy a container and all its overlays */
  readonly destroyContainer: (id: ContainerId) => Effect.Effect<void>
  /** Get container state */
  readonly getContainer: (id: ContainerId) => Effect.Effect<Option.Option<ContainerState>>
  /** List all container IDs */
  readonly listContainers: () => Effect.Effect<ReadonlyArray<ContainerId>>

  // ─── Overlay Registration ───
  /** Register an overlay definition for a container (makes it available) */
  readonly register: (
    containerId: ContainerId,
    overlayId: OverlayId,
    name: string,
    visualPriority?: number
  ) => Effect.Effect<void>
  /** Unregister an overlay from a container */
  readonly unregister: (containerId: ContainerId, overlayId: OverlayId) => Effect.Effect<void>

  // ─── Overlay Lifecycle ───
  /** Enable (activate) an overlay in a container */
  readonly enable: (containerId: ContainerId, overlayId: OverlayId) => Effect.Effect<void>
  /** Disable (deactivate) an overlay in a container */
  readonly disable: (containerId: ContainerId, overlayId: OverlayId) => Effect.Effect<void>
  /** Toggle overlay active state */
  readonly toggle: (containerId: ContainerId, overlayId: OverlayId) => Effect.Effect<void>
  /** Suspend an overlay (temporarily pause without deactivating) */
  readonly suspend: (containerId: ContainerId, overlayId: OverlayId) => Effect.Effect<void>
  /** Resume a suspended overlay */
  readonly resume: (containerId: ContainerId, overlayId: OverlayId) => Effect.Effect<void>

  // ─── Query ───
  /** Get active overlays in LIFO order (last = most recently enabled) */
  readonly getActiveOverlays: (containerId: ContainerId) => Effect.Effect<ReadonlyArray<OverlayInstance>>
  /** Check if an overlay is active */
  readonly isActive: (containerId: ContainerId, overlayId: OverlayId) => Effect.Effect<boolean>
  /** Get a specific overlay instance */
  readonly getOverlay: (
    containerId: ContainerId,
    overlayId: OverlayId
  ) => Effect.Effect<Option.Option<OverlayInstance>>
}

// ─────────────────────────────────────────────────────────────
// Service Tag
// ─────────────────────────────────────────────────────────────

export class OverlayRegistry extends Context.Tag("tmnl/overlays/OverlayRegistry")<
  OverlayRegistry,
  OverlayRegistryOps
>() {
  /**
   * Default implementation using Effect.Ref for state
   */
  static Default = Layer.effect(
    OverlayRegistry,
    Effect.gen(function* () {
      // State: Map of ContainerId -> ContainerState
      const containersRef = yield* Ref.make<Map<ContainerId, ContainerState>>(new Map())

      // ─── Helpers ───

      /** Ensure container exists, creating it if necessary */
      const ensureContainer = (id: ContainerId): Effect.Effect<void> =>
        Ref.update(containersRef, (map) => {
          if (map.has(id)) return map
          const next = new Map(map)
          next.set(
            id,
            new ContainerState({
              id,
              activeOverlays: [],
              registeredOverlays: [],
              enabled: true,
            })
          )
          return next
        })

      const updateContainer = (
        id: ContainerId,
        fn: (state: ContainerState) => ContainerState
      ): Effect.Effect<void> =>
        Ref.update(containersRef, (map) => {
          const current = map.get(id)
          if (!current) return map
          const next = new Map(map)
          next.set(id, fn(current))
          return next
        })

      /** Get container, auto-creating if it doesn't exist */
      const getContainerOrCreate = (id: ContainerId): Effect.Effect<ContainerState> =>
        Effect.gen(function* () {
          yield* ensureContainer(id)
          const map = yield* Ref.get(containersRef)
          // Safe to assert non-null after ensureContainer
          return map.get(id)!
        })

      // ─── Implementation ───

      return OverlayRegistry.of({
        // Container Management
        createContainer: (id) =>
          Ref.update(containersRef, (map) => {
            if (map.has(id)) return map // idempotent
            const next = new Map(map)
            next.set(
              id,
              new ContainerState({
                id,
                activeOverlays: [],
                registeredOverlays: [],
                enabled: true,
              })
            )
            return next
          }),

        destroyContainer: (id) =>
          Ref.update(containersRef, (map) => {
            const next = new Map(map)
            next.delete(id)
            return next
          }),

        getContainer: (id) =>
          Effect.map(Ref.get(containersRef), (map) => Option.fromNullable(map.get(id))),

        listContainers: () =>
          Effect.map(Ref.get(containersRef), (map) => Array.fromIterable(map.keys())),

        // Overlay Registration
        register: (containerId, overlayId, name, visualPriority = 0) =>
          Effect.gen(function* () {
            // Auto-create container if it doesn't exist
            yield* ensureContainer(containerId)
            yield* updateContainer(containerId, (state) => {
              // Check if already registered
              if (state.registeredOverlays.includes(overlayId)) {
                return state
              }
              return new ContainerState({
                ...state,
                registeredOverlays: [...state.registeredOverlays, overlayId],
              })
            })
          }),

        unregister: (containerId, overlayId) =>
          updateContainer(containerId, (state) => {
            return new ContainerState({
              ...state,
              registeredOverlays: state.registeredOverlays.filter((id) => id !== overlayId),
              activeOverlays: state.activeOverlays.filter((o) => o.id !== overlayId),
            })
          }),

        // Overlay Lifecycle
        enable: (containerId, overlayId) =>
          Effect.gen(function* () {
            // Auto-create container if it doesn't exist
            const container = yield* getContainerOrCreate(containerId)

            // Check if already active
            const existing = container.activeOverlays.find((o) => o.id === overlayId)
            if (existing?.state === "active") return

            yield* updateContainer(containerId, (state) => {
              const existingIdx = state.activeOverlays.findIndex((o) => o.id === overlayId)

              if (existingIdx >= 0) {
                // Already in list, just update state and move to top (LIFO)
                const overlay = state.activeOverlays[existingIdx]
                const withoutOverlay = state.activeOverlays.filter((_, i) => i !== existingIdx)
                const updatedOverlay = new OverlayInstance({
                  ...overlay,
                  state: "active" as OverlayState,
                  activatedAt: Date.now(),
                  stackPosition: withoutOverlay.length,
                })
                return new ContainerState({
                  ...state,
                  activeOverlays: [...withoutOverlay, updatedOverlay],
                })
              }

              // Not in list, create new instance
              // Need to find overlay info from registration
              const newOverlay = new OverlayInstance({
                id: overlayId,
                name: overlayId as string, // Will be replaced with actual name from Overlay class
                state: "active" as OverlayState,
                activatedAt: Date.now(),
                visualPriority: 0,
                stackPosition: state.activeOverlays.length,
              })

              return new ContainerState({
                ...state,
                activeOverlays: [...state.activeOverlays, newOverlay],
              })
            })
          }),

        disable: (containerId, overlayId) =>
          updateContainer(containerId, (state) => {
            const idx = state.activeOverlays.findIndex((o) => o.id === overlayId)
            if (idx < 0) return state

            const overlay = state.activeOverlays[idx]
            const updatedOverlay = new OverlayInstance({
              ...overlay,
              state: "inactive" as OverlayState,
              activatedAt: null,
            })

            // Remove from active list (inactive overlays are not in the stack)
            return new ContainerState({
              ...state,
              activeOverlays: state.activeOverlays.filter((_, i) => i !== idx),
            })
          }),

        toggle: (containerId, overlayId) =>
          Effect.gen(function* () {
            const isCurrentlyActive = yield* OverlayRegistry.pipe(
              Effect.flatMap((r) => r.isActive(containerId, overlayId))
            )
            if (isCurrentlyActive) {
              yield* OverlayRegistry.pipe(Effect.flatMap((r) => r.disable(containerId, overlayId)))
            } else {
              yield* OverlayRegistry.pipe(Effect.flatMap((r) => r.enable(containerId, overlayId)))
            }
          }),

        suspend: (containerId, overlayId) =>
          updateContainer(containerId, (state) => {
            const idx = state.activeOverlays.findIndex((o) => o.id === overlayId)
            if (idx < 0) return state

            const overlay = state.activeOverlays[idx]
            if (overlay.state !== "active") return state

            const updatedOverlay = new OverlayInstance({
              ...overlay,
              state: "suspended" as OverlayState,
            })

            const newOverlays = [...state.activeOverlays]
            newOverlays[idx] = updatedOverlay

            return new ContainerState({
              ...state,
              activeOverlays: newOverlays,
            })
          }),

        resume: (containerId, overlayId) =>
          updateContainer(containerId, (state) => {
            const idx = state.activeOverlays.findIndex((o) => o.id === overlayId)
            if (idx < 0) return state

            const overlay = state.activeOverlays[idx]
            if (overlay.state !== "suspended") return state

            const updatedOverlay = new OverlayInstance({
              ...overlay,
              state: "active" as OverlayState,
            })

            const newOverlays = [...state.activeOverlays]
            newOverlays[idx] = updatedOverlay

            return new ContainerState({
              ...state,
              activeOverlays: newOverlays,
            })
          }),

        // Query
        getActiveOverlays: (containerId) =>
          Effect.map(Ref.get(containersRef), (map) => {
            const container = map.get(containerId)
            if (!container) return []
            return container.activeOverlays.filter((o) => o.state === "active")
          }),

        isActive: (containerId, overlayId) =>
          Effect.map(Ref.get(containersRef), (map) => {
            const container = map.get(containerId)
            if (!container) return false
            return container.activeOverlays.some(
              (o) => o.id === overlayId && o.state === "active"
            )
          }),

        getOverlay: (containerId, overlayId) =>
          Effect.map(Ref.get(containersRef), (map) => {
            const container = map.get(containerId)
            if (!container) return Option.none()
            return Option.fromNullable(
              container.activeOverlays.find((o) => o.id === overlayId)
            )
          }),
      })
    })
  )
}
