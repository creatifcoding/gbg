/**
 * Visual Overlay Atoms
 *
 * Core state atoms for the visual overlay orchestration layer.
 * Atoms ARE the source of truth — no Effect.Ref needed.
 *
 * Architecture:
 * - visualOverlaysAtom: Map<id, instance> — all overlay instances
 * - zOrderByTypeAtom: Map<type, id[]> — stacking order per type
 * - slotsAtom: Map<slotId, registration> — registered slots
 * - Content stored in separate registry (ReactNode not serializable)
 *
 * @module
 */

import * as Atom from "@effect-atom/atom/Atom"
import type { ReactNode } from "react"
import {
  type VisualOverlayId,
  type VisualOverlayType,
  type VisualOverlayConfig,
  type VisualOverlayInstance,
  type SlotId,
  type OverlayAnimationState,
  type SlotRegistration,
  VisualOverlayInstance as VisualOverlayInstanceClass,
  SlotRegistration as SlotRegistrationClass,
} from "../schemas/visual"
import { calculateZIndex, GLOBAL_SLOT_ID } from "../visual/constants"

// ─────────────────────────────────────────────────────────────
// Content Registry (non-serializable, in-memory)
// ─────────────────────────────────────────────────────────────

/**
 * In-memory registry for ReactNode content.
 * Keyed by contentKey from VisualOverlayInstance.
 * Separate from atoms because ReactNode isn't serializable.
 */
const contentRegistry = new Map<string, ReactNode>()

/**
 * Register content for an overlay.
 */
export const registerContent = (key: string, content: ReactNode): void => {
  contentRegistry.set(key, content)
}

/**
 * Get content for an overlay.
 */
export const getContent = (key: string): ReactNode | undefined => {
  return contentRegistry.get(key)
}

/**
 * Unregister content for an overlay.
 */
export const unregisterContent = (key: string): void => {
  contentRegistry.delete(key)
}

/**
 * Check if content exists.
 */
export const hasContent = (key: string): boolean => {
  return contentRegistry.has(key)
}

// ─────────────────────────────────────────────────────────────
// Core State Atoms
// ─────────────────────────────────────────────────────────────

/**
 * All visual overlay instances, keyed by ID.
 * This is the single source of truth for overlay state.
 */
export const visualOverlaysAtom = Atom.make<Map<VisualOverlayId, VisualOverlayInstance>>(
  new Map()
).pipe(Atom.keepAlive)

/**
 * Z-order per overlay type (last element = top).
 * Tracks stacking order within each type tier.
 */
export const zOrderByTypeAtom = Atom.make<Map<VisualOverlayType, VisualOverlayId[]>>(
  new Map([
    ["drawer", []],
    ["modal", []],
    ["toast", []],
    ["command-palette", []],
    ["top-bar", []],
    ["sidebar", []],
  ])
).pipe(Atom.keepAlive)

/**
 * Registered slots for overlay rendering.
 */
export const slotsAtom = Atom.make<Map<SlotId, SlotRegistration>>(
  new Map()
).pipe(Atom.keepAlive)

// ─────────────────────────────────────────────────────────────
// Derived Atoms
// ─────────────────────────────────────────────────────────────

/**
 * All visible overlay IDs (entering or visible animation state).
 */
export const visibleOverlayIdsAtom = Atom.make((get) => {
  const overlays = get(visualOverlaysAtom)
  return Array.from(overlays.values())
    .filter((o) => o.isVisible)
    .map((o) => o.id)
})

/**
 * Overlays by type, in z-order (last = top).
 */
export const overlaysByTypeAtom = Atom.family((type: VisualOverlayType) =>
  Atom.make((get) => {
    const overlays = get(visualOverlaysAtom)
    const zOrder = get(zOrderByTypeAtom).get(type) ?? []
    return zOrder
      .map((id) => overlays.get(id))
      .filter((o): o is VisualOverlayInstance => o !== undefined && !o.hasExited)
  })
)

/**
 * Overlays by slot (for slot-scoped types like drawer, sidebar).
 */
export const overlaysBySlotAtom = Atom.family((slotId: SlotId) =>
  Atom.make((get) => {
    const overlays = get(visualOverlaysAtom)
    return Array.from(overlays.values())
      .filter((o) => {
        if (o.hasExited) return false
        const config = o.config
        if (config._tag === "DrawerConfig" || config._tag === "SidebarConfig") {
          return config.slot === slotId
        }
        return false
      })
      .sort((a, b) => a.zIndex - b.zIndex)
  })
)

/**
 * Check if any blocking overlay is open (modal or command palette).
 */
export const hasBlockingOverlayAtom = Atom.make((get) => {
  const modals = get(overlaysByTypeAtom("modal"))
  const palettes = get(overlaysByTypeAtom("command-palette"))
  return modals.some((m) => m.isVisible) || palettes.some((p) => p.isVisible)
})

/**
 * Top (frontmost) overlay of a type.
 */
export const topOverlayByTypeAtom = Atom.family((type: VisualOverlayType) =>
  Atom.make((get) => {
    const overlays = get(overlaysByTypeAtom(type))
    const visible = overlays.filter((o) => o.isVisible)
    return visible[visible.length - 1] ?? null
  })
)

/**
 * Get overlay instance by ID.
 */
export const overlayAtom = Atom.family((id: VisualOverlayId) =>
  Atom.make((get) => {
    const overlays = get(visualOverlaysAtom)
    return overlays.get(id) ?? null
  })
)

/**
 * Count of visible overlays by type.
 */
export const overlayCountByTypeAtom = Atom.family((type: VisualOverlayType) =>
  Atom.make((get) => {
    const overlays = get(overlaysByTypeAtom(type))
    return overlays.filter((o) => o.isVisible).length
  })
)

/**
 * Total count of all visible overlays.
 */
export const totalVisibleOverlayCountAtom = Atom.make((get) => {
  return get(visibleOverlayIdsAtom).length
})

/**
 * Get all registered slot IDs.
 */
export const slotIdsAtom = Atom.make((get) => {
  const slots = get(slotsAtom)
  return Array.from(slots.keys())
})

// ─────────────────────────────────────────────────────────────
// Mutation Functions (pure, return new state)
// ─────────────────────────────────────────────────────────────

/**
 * Get overlay type from config tag.
 */
function getTypeFromConfig(config: VisualOverlayConfig): VisualOverlayType {
  switch (config._tag) {
    case "DrawerConfig": return "drawer"
    case "ModalConfig": return "modal"
    case "ToastConfig": return "toast"
    case "CommandPaletteConfig": return "command-palette"
    case "TopBarConfig": return "top-bar"
    case "SidebarConfig": return "sidebar"
  }
}

/**
 * Open a new visual overlay.
 * Creates instance, adds to overlays map, and updates z-order.
 */
export const openOverlay = (
  overlays: Map<VisualOverlayId, VisualOverlayInstance>,
  zOrders: Map<VisualOverlayType, VisualOverlayId[]>,
  id: VisualOverlayId,
  type: VisualOverlayType,
  config: VisualOverlayConfig,
  contentKey: string,
): {
  overlays: Map<VisualOverlayId, VisualOverlayInstance>
  zOrders: Map<VisualOverlayType, VisualOverlayId[]>
} => {
  // Get current z-order for type
  const currentOrder = zOrders.get(type) ?? []
  const stackPosition = currentOrder.length
  const zIndex = calculateZIndex(type, stackPosition, config.zIndexOffset ?? 0)

  // Create instance
  const instance = new VisualOverlayInstanceClass({
    id,
    type,
    config,
    animationState: "entering",
    zIndex,
    openedAt: Date.now(),
    contentKey,
  })

  // Update overlays map
  const nextOverlays = new Map(overlays)
  nextOverlays.set(id, instance)

  // Update z-order
  const nextZOrders = new Map(zOrders)
  nextZOrders.set(type, [...currentOrder, id])

  return { overlays: nextOverlays, zOrders: nextZOrders }
}

/**
 * Close a visual overlay (start exit animation).
 * Sets animation state to "exiting".
 */
export const closeOverlay = (
  overlays: Map<VisualOverlayId, VisualOverlayInstance>,
  id: VisualOverlayId,
): Map<VisualOverlayId, VisualOverlayInstance> => {
  const instance = overlays.get(id)
  if (!instance || instance.isExiting || instance.hasExited) {
    return overlays
  }

  const next = new Map(overlays)
  next.set(id, new VisualOverlayInstanceClass({
    ...instance,
    animationState: "exiting",
  }))
  return next
}

/**
 * Remove overlay from state (after exit animation completes).
 * Also cleans up content registry.
 */
export const removeOverlay = (
  overlays: Map<VisualOverlayId, VisualOverlayInstance>,
  zOrders: Map<VisualOverlayType, VisualOverlayId[]>,
  id: VisualOverlayId,
): {
  overlays: Map<VisualOverlayId, VisualOverlayInstance>
  zOrders: Map<VisualOverlayType, VisualOverlayId[]>
} => {
  const instance = overlays.get(id)
  if (!instance) return { overlays, zOrders }

  // Remove from overlays
  const nextOverlays = new Map(overlays)
  nextOverlays.delete(id)

  // Remove from z-order
  const nextZOrders = new Map(zOrders)
  const currentOrder = nextZOrders.get(instance.type) ?? []
  nextZOrders.set(instance.type, currentOrder.filter((i) => i !== id))

  // Clean up content
  unregisterContent(instance.contentKey)

  return { overlays: nextOverlays, zOrders: nextZOrders }
}

/**
 * Update animation state.
 */
export const setAnimationState = (
  overlays: Map<VisualOverlayId, VisualOverlayInstance>,
  id: VisualOverlayId,
  state: OverlayAnimationState,
): Map<VisualOverlayId, VisualOverlayInstance> => {
  const instance = overlays.get(id)
  if (!instance) return overlays

  const next = new Map(overlays)
  next.set(id, new VisualOverlayInstanceClass({
    ...instance,
    animationState: state,
  }))
  return next
}

/**
 * Bring overlay to front of its type stack.
 * Recalculates z-indices for affected overlays.
 */
export const bringToFront = (
  overlays: Map<VisualOverlayId, VisualOverlayInstance>,
  zOrders: Map<VisualOverlayType, VisualOverlayId[]>,
  id: VisualOverlayId,
): {
  overlays: Map<VisualOverlayId, VisualOverlayInstance>
  zOrders: Map<VisualOverlayType, VisualOverlayId[]>
} => {
  const instance = overlays.get(id)
  if (!instance) return { overlays, zOrders }

  const currentOrder = zOrders.get(instance.type) ?? []
  const idx = currentOrder.indexOf(id)
  if (idx === currentOrder.length - 1) {
    // Already on top
    return { overlays, zOrders }
  }

  // Reorder: move to end
  const newOrder = [...currentOrder.filter((i) => i !== id), id]
  const nextZOrders = new Map(zOrders)
  nextZOrders.set(instance.type, newOrder)

  // Recalculate z-indices for this type
  const nextOverlays = new Map(overlays)
  newOrder.forEach((overlayId, position) => {
    const overlay = nextOverlays.get(overlayId)
    if (overlay) {
      const newZ = calculateZIndex(instance.type, position, overlay.config.zIndexOffset ?? 0)
      if (overlay.zIndex !== newZ) {
        nextOverlays.set(overlayId, new VisualOverlayInstanceClass({
          ...overlay,
          zIndex: newZ,
        }))
      }
    }
  })

  return { overlays: nextOverlays, zOrders: nextZOrders }
}

/**
 * Send overlay to back of its type stack.
 */
export const sendToBack = (
  overlays: Map<VisualOverlayId, VisualOverlayInstance>,
  zOrders: Map<VisualOverlayType, VisualOverlayId[]>,
  id: VisualOverlayId,
): {
  overlays: Map<VisualOverlayId, VisualOverlayInstance>
  zOrders: Map<VisualOverlayType, VisualOverlayId[]>
} => {
  const instance = overlays.get(id)
  if (!instance) return { overlays, zOrders }

  const currentOrder = zOrders.get(instance.type) ?? []
  const idx = currentOrder.indexOf(id)
  if (idx === 0) {
    // Already at back
    return { overlays, zOrders }
  }

  // Reorder: move to front
  const newOrder = [id, ...currentOrder.filter((i) => i !== id)]
  const nextZOrders = new Map(zOrders)
  nextZOrders.set(instance.type, newOrder)

  // Recalculate z-indices for this type
  const nextOverlays = new Map(overlays)
  newOrder.forEach((overlayId, position) => {
    const overlay = nextOverlays.get(overlayId)
    if (overlay) {
      const newZ = calculateZIndex(instance.type, position, overlay.config.zIndexOffset ?? 0)
      if (overlay.zIndex !== newZ) {
        nextOverlays.set(overlayId, new VisualOverlayInstanceClass({
          ...overlay,
          zIndex: newZ,
        }))
      }
    }
  })

  return { overlays: nextOverlays, zOrders: nextZOrders }
}

// ─────────────────────────────────────────────────────────────
// Slot Mutations
// ─────────────────────────────────────────────────────────────

/**
 * Register a slot for overlay rendering.
 */
export const registerSlot = (
  slots: Map<SlotId, SlotRegistration>,
  id: SlotId,
  containerId: string,
  bounds?: { x: number; y: number; width: number; height: number },
): Map<SlotId, SlotRegistration> => {
  const next = new Map(slots)
  next.set(id, new SlotRegistrationClass({
    id,
    containerId,
    bounds,
  }))
  return next
}

/**
 * Unregister a slot.
 */
export const unregisterSlot = (
  slots: Map<SlotId, SlotRegistration>,
  id: SlotId,
): Map<SlotId, SlotRegistration> => {
  if (!slots.has(id)) return slots
  const next = new Map(slots)
  next.delete(id)
  return next
}

/**
 * Update slot bounds (for panel slots on resize).
 */
export const updateSlotBounds = (
  slots: Map<SlotId, SlotRegistration>,
  id: SlotId,
  bounds: { x: number; y: number; width: number; height: number },
): Map<SlotId, SlotRegistration> => {
  const slot = slots.get(id)
  if (!slot) return slots

  const next = new Map(slots)
  next.set(id, new SlotRegistrationClass({
    ...slot,
    bounds,
  }))
  return next
}
