/**
 * Sidebar Atoms
 *
 * Effect-atom state management for the sidebar system.
 * Atoms ARE the source of truth — no Effect.Ref needed.
 *
 * Architecture:
 * - sidebarItemsAtom: Map<id, config> — registered sidebar items
 * - sidebarActiveIdAtom: current active item ID
 * - sidebarCollapsedAtom: collapse state
 * - sidebarPluginOrderAtom: persisted plugin order
 * - sortedSidebarItemsAtom: derived sorted view
 *
 * @module sidebar/atoms
 */

import { Atom, Registry } from "@effect-atom/atom"
import * as Option from "effect/Option"
import type { SidebarItemId, SidebarItemConfig } from "../schemas"

// ─────────────────────────────────────────────────────────────
// Registry Singleton
// ─────────────────────────────────────────────────────────────

/**
 * Shared registry for sidebar atoms.
 * Enables synchronous get/set operations outside of Effect context.
 */
export const sidebarRegistry = Registry.make()

// ─────────────────────────────────────────────────────────────
// localStorage Keys
// ─────────────────────────────────────────────────────────────

const STORAGE_KEY_COLLAPSED = "tmnl:sidebar:collapsed"
const STORAGE_KEY_PLUGIN_ORDER = "tmnl:sidebar:plugin-order"

// ─────────────────────────────────────────────────────────────
// Storage Helpers
// ─────────────────────────────────────────────────────────────

/**
 * Load collapsed state from localStorage.
 */
const loadCollapsed = (): boolean => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_COLLAPSED)
    return stored === "true"
  } catch {
    return false
  }
}

/**
 * Load plugin order from localStorage.
 */
const loadPluginOrder = (): SidebarItemId[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_PLUGIN_ORDER)
    if (!stored) return []
    return JSON.parse(stored) as SidebarItemId[]
  } catch {
    return []
  }
}

/**
 * Persist collapsed state to localStorage.
 */
const persistCollapsed = (collapsed: boolean): void => {
  try {
    localStorage.setItem(STORAGE_KEY_COLLAPSED, String(collapsed))
  } catch {
    // localStorage may be unavailable (SSR, private mode)
  }
}

/**
 * Persist plugin order to localStorage.
 */
const persistPluginOrder = (order: SidebarItemId[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY_PLUGIN_ORDER, JSON.stringify(order))
  } catch {
    // localStorage may be unavailable
  }
}

// ─────────────────────────────────────────────────────────────
// Core State Atoms
// ─────────────────────────────────────────────────────────────

/**
 * Registry of all sidebar items, keyed by ID.
 * Core items are registered from config, plugin items via useSidebarItem hook.
 */
export const sidebarItemsAtom = Atom.make<Map<SidebarItemId, SidebarItemConfig>>(
  new Map()
)

/**
 * Currently active sidebar item ID.
 * Updated on route match, drawer open, etc.
 * `Option.none()` means no item is active.
 */
export const sidebarActiveIdAtom = Atom.make<Option.Option<SidebarItemId>>(
  Option.none()
)

/**
 * Whether the sidebar is collapsed.
 * Persisted to localStorage.
 */
export const sidebarCollapsedAtom = Atom.make<boolean>(loadCollapsed())

/**
 * User-defined order for plugin items.
 * Only IDs are stored; actual items come from sidebarItemsAtom.
 * Persisted to localStorage.
 */
export const sidebarPluginOrderAtom = Atom.make<SidebarItemId[]>(loadPluginOrder())

// ─────────────────────────────────────────────────────────────
// Derived Atoms
// ─────────────────────────────────────────────────────────────

/**
 * Core items sorted by order.
 */
export const coreItemsAtom = Atom.make((get) => {
  const items = get(sidebarItemsAtom)
  return Array.from(items.values())
    .filter((item) => item.group === "core")
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
})

/**
 * Plugin items sorted by user-defined order.
 * Items not in the order array are appended at the end.
 */
export const pluginItemsAtom = Atom.make((get) => {
  const items = get(sidebarItemsAtom)
  const order = get(sidebarPluginOrderAtom)

  const plugins = Array.from(items.values()).filter(
    (item) => item.group === "plugin"
  )

  // Sort by order array, with unordered items at end
  const orderMap = new Map(order.map((id, idx) => [id, idx]))

  return plugins.sort((a, b) => {
    const aIdx = orderMap.get(a.id) ?? Number.MAX_SAFE_INTEGER
    const bIdx = orderMap.get(b.id) ?? Number.MAX_SAFE_INTEGER
    if (aIdx !== bIdx) return aIdx - bIdx
    // Fall back to natural order for unordered items
    return (a.order ?? 0) - (b.order ?? 0)
  })
})

/**
 * All items sorted: core first, then plugins.
 * This is the primary view for rendering.
 */
export const sortedSidebarItemsAtom = Atom.make((get) => {
  const core = get(coreItemsAtom)
  const plugins = get(pluginItemsAtom)
  return { core, plugins }
})

// ─────────────────────────────────────────────────────────────
// Mutations
// ─────────────────────────────────────────────────────────────

/**
 * Register a sidebar item.
 */
export const registerItem = (item: SidebarItemConfig): void => {
  sidebarRegistry.update(sidebarItemsAtom, (items) => {
    const next = new Map(items)
    next.set(item.id, item)
    return next
  })
}

/**
 * Unregister a sidebar item.
 */
export const unregisterItem = (id: SidebarItemId): void => {
  sidebarRegistry.update(sidebarItemsAtom, (items) => {
    const next = new Map(items)
    next.delete(id)
    return next
  })
}

/**
 * Set the active sidebar item.
 */
export const setActiveId = (id: SidebarItemId | null): void => {
  sidebarRegistry.set(
    sidebarActiveIdAtom,
    id === null ? Option.none() : Option.some(id)
  )
}

/**
 * Clear the active sidebar item.
 */
export const clearActiveId = (): void => {
  sidebarRegistry.set(sidebarActiveIdAtom, Option.none())
}

/**
 * Toggle sidebar collapsed state.
 */
export const toggleCollapsed = (): void => {
  sidebarRegistry.update(sidebarCollapsedAtom, (current) => {
    const next = !current
    persistCollapsed(next)
    return next
  })
}

/**
 * Set sidebar collapsed state.
 */
export const setCollapsed = (collapsed: boolean): void => {
  sidebarRegistry.set(sidebarCollapsedAtom, collapsed)
  persistCollapsed(collapsed)
}

/**
 * Reorder plugin items.
 * Called after Ctrl+drag completes.
 */
export const reorderPlugins = (newOrder: SidebarItemId[]): void => {
  sidebarRegistry.set(sidebarPluginOrderAtom, newOrder)
  persistPluginOrder(newOrder)
}
