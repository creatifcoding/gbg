/**
 * Overlay State Atoms
 *
 * Core mutable atoms that own overlay system state.
 * Services and hooks operate on these atoms directly.
 *
 * Architecture:
 * - Atoms ARE the source of truth (not Effect.Ref)
 * - Services are stateless — they read/write atoms
 * - Components subscribe to atoms → automatic reactivity
 */

import { Atom } from "@effect-atom/atom-react"
import {
  type ContainerId,
  type OverlayId,
  type ContainerState,
  type OverlayInstance,
  type OverlayState,
  ContainerState as ContainerStateClass,
  OverlayInstance as OverlayInstanceClass,
} from "../schemas"

// ─────────────────────────────────────────────────────────────
// Core State Atom
// ─────────────────────────────────────────────────────────────

/**
 * The single source of truth for all container state.
 * Map of ContainerId → ContainerState
 *
 * NOTE: Uses keepAlive to persist across registry instances.
 */
export const containersStateAtom = Atom.keepAlive(
  Atom.make<Map<ContainerId, ContainerState>>(new Map())
)

// ─────────────────────────────────────────────────────────────
// Derived Atoms
// ─────────────────────────────────────────────────────────────

/**
 * List of all container IDs.
 */
export const containerIdsAtom = Atom.make((get) => {
  const containers = get(containersStateAtom)
  return Array.from(containers.keys())
})

/**
 * Atom family for individual container state.
 */
export const containerAtom = Atom.family((containerId: ContainerId) =>
  Atom.make((get) => {
    const containers = get(containersStateAtom)
    return containers.get(containerId) ?? null
  })
)

/**
 * Atom family for active overlays in a container (LIFO order).
 */
export const activeOverlaysAtom = Atom.family((containerId: ContainerId) =>
  Atom.make((get) => {
    const container = get(containerAtom(containerId))
    if (!container) return []
    return container.activeOverlays.filter((o) => o.state === "active")
  })
)

/**
 * Atom family for checking if container exists.
 */
export const containerExistsAtom = Atom.family((containerId: ContainerId) =>
  Atom.make((get) => {
    const containers = get(containersStateAtom)
    return containers.has(containerId)
  })
)

/**
 * Atom family for checking if an overlay is active.
 */
export const isOverlayActiveAtom = Atom.family(
  ({ containerId, overlayId }: { containerId: ContainerId; overlayId: OverlayId }) =>
    Atom.make((get) => {
      const overlays = get(activeOverlaysAtom(containerId))
      return overlays.some((o) => o.id === overlayId)
    })
)

// ─────────────────────────────────────────────────────────────
// Mutation Functions (pure, return new state)
// ─────────────────────────────────────────────────────────────

/**
 * Create a new container.
 */
export const createContainer = (
  containers: Map<ContainerId, ContainerState>,
  containerId: ContainerId
): Map<ContainerId, ContainerState> => {
  if (containers.has(containerId)) return containers // idempotent
  const next = new Map(containers)
  next.set(
    containerId,
    new ContainerStateClass({
      id: containerId,
      activeOverlays: [],
      registeredOverlays: [],
      enabled: true,
    })
  )
  return next
}

/**
 * Destroy a container.
 */
export const destroyContainer = (
  containers: Map<ContainerId, ContainerState>,
  containerId: ContainerId
): Map<ContainerId, ContainerState> => {
  if (!containers.has(containerId)) return containers
  const next = new Map(containers)
  next.delete(containerId)
  return next
}

/**
 * Register an overlay in a container.
 */
export const registerOverlay = (
  containers: Map<ContainerId, ContainerState>,
  containerId: ContainerId,
  overlayId: OverlayId,
  name: string,
  visualPriority: number = 0
): Map<ContainerId, ContainerState> => {
  // Auto-create container if needed
  let updated = containers.has(containerId)
    ? containers
    : createContainer(containers, containerId)

  const container = updated.get(containerId)!
  if (container.registeredOverlays.includes(overlayId)) return updated

  const next = new Map(updated)
  next.set(
    containerId,
    new ContainerStateClass({
      ...container,
      registeredOverlays: [...container.registeredOverlays, overlayId],
    })
  )
  return next
}

/**
 * Unregister an overlay from a container.
 */
export const unregisterOverlay = (
  containers: Map<ContainerId, ContainerState>,
  containerId: ContainerId,
  overlayId: OverlayId
): Map<ContainerId, ContainerState> => {
  const container = containers.get(containerId)
  if (!container) return containers

  const next = new Map(containers)
  next.set(
    containerId,
    new ContainerStateClass({
      ...container,
      registeredOverlays: container.registeredOverlays.filter((id) => id !== overlayId),
      activeOverlays: container.activeOverlays.filter((o) => o.id !== overlayId),
    })
  )
  return next
}

/**
 * Enable (activate) an overlay.
 */
export const enableOverlay = (
  containers: Map<ContainerId, ContainerState>,
  containerId: ContainerId,
  overlayId: OverlayId,
  name?: string,
  visualPriority: number = 0
): Map<ContainerId, ContainerState> => {
  // Auto-create container if needed
  let updated = containers.has(containerId)
    ? containers
    : createContainer(containers, containerId)

  const container = updated.get(containerId)!

  // Check if already active
  const existingIdx = container.activeOverlays.findIndex((o) => o.id === overlayId)
  if (existingIdx >= 0 && container.activeOverlays[existingIdx].state === "active") {
    return updated
  }

  const next = new Map(updated)

  if (existingIdx >= 0) {
    // Already in list, update state and move to top (LIFO)
    const overlay = container.activeOverlays[existingIdx]
    const withoutOverlay = container.activeOverlays.filter((_, i) => i !== existingIdx)
    const updatedOverlay = new OverlayInstanceClass({
      ...overlay,
      state: "active" as OverlayState,
      activatedAt: Date.now(),
      stackPosition: withoutOverlay.length,
    })
    next.set(
      containerId,
      new ContainerStateClass({
        ...container,
        activeOverlays: [...withoutOverlay, updatedOverlay],
      })
    )
  } else {
    // New overlay instance
    const newOverlay = new OverlayInstanceClass({
      id: overlayId,
      name: name ?? (overlayId as string),
      state: "active" as OverlayState,
      activatedAt: Date.now(),
      visualPriority,
      stackPosition: container.activeOverlays.length,
    })
    next.set(
      containerId,
      new ContainerStateClass({
        ...container,
        activeOverlays: [...container.activeOverlays, newOverlay],
      })
    )
  }

  return next
}

/**
 * Disable (deactivate) an overlay.
 */
export const disableOverlay = (
  containers: Map<ContainerId, ContainerState>,
  containerId: ContainerId,
  overlayId: OverlayId
): Map<ContainerId, ContainerState> => {
  const container = containers.get(containerId)
  if (!container) return containers

  const idx = container.activeOverlays.findIndex((o) => o.id === overlayId)
  if (idx < 0) return containers

  const next = new Map(containers)
  next.set(
    containerId,
    new ContainerStateClass({
      ...container,
      activeOverlays: container.activeOverlays.filter((_, i) => i !== idx),
    })
  )
  return next
}

/**
 * Toggle an overlay's active state.
 */
export const toggleOverlay = (
  containers: Map<ContainerId, ContainerState>,
  containerId: ContainerId,
  overlayId: OverlayId
): Map<ContainerId, ContainerState> => {
  const container = containers.get(containerId)
  const isActive = container?.activeOverlays.some(
    (o) => o.id === overlayId && o.state === "active"
  )

  return isActive
    ? disableOverlay(containers, containerId, overlayId)
    : enableOverlay(containers, containerId, overlayId)
}

/**
 * Suspend an overlay.
 */
export const suspendOverlay = (
  containers: Map<ContainerId, ContainerState>,
  containerId: ContainerId,
  overlayId: OverlayId
): Map<ContainerId, ContainerState> => {
  const container = containers.get(containerId)
  if (!container) return containers

  const idx = container.activeOverlays.findIndex((o) => o.id === overlayId)
  if (idx < 0) return containers

  const overlay = container.activeOverlays[idx]
  if (overlay.state !== "active") return containers

  const updatedOverlay = new OverlayInstanceClass({
    ...overlay,
    state: "suspended" as OverlayState,
  })

  const newOverlays = [...container.activeOverlays]
  newOverlays[idx] = updatedOverlay

  const next = new Map(containers)
  next.set(
    containerId,
    new ContainerStateClass({
      ...container,
      activeOverlays: newOverlays,
    })
  )
  return next
}

/**
 * Resume a suspended overlay.
 */
export const resumeOverlay = (
  containers: Map<ContainerId, ContainerState>,
  containerId: ContainerId,
  overlayId: OverlayId
): Map<ContainerId, ContainerState> => {
  const container = containers.get(containerId)
  if (!container) return containers

  const idx = container.activeOverlays.findIndex((o) => o.id === overlayId)
  if (idx < 0) return containers

  const overlay = container.activeOverlays[idx]
  if (overlay.state !== "suspended") return containers

  const updatedOverlay = new OverlayInstanceClass({
    ...overlay,
    state: "active" as OverlayState,
  })

  const newOverlays = [...container.activeOverlays]
  newOverlays[idx] = updatedOverlay

  const next = new Map(containers)
  next.set(
    containerId,
    new ContainerStateClass({
      ...container,
      activeOverlays: newOverlays,
    })
  )
  return next
}
