/**
 * useSidebarItem
 *
 * Hook for registering plugin sidebar items.
 * Items are automatically unregistered on unmount.
 *
 * @module sidebar/hooks
 */

import { useEffect, useRef } from "react"

import type { SidebarItemConfig, SidebarItemId } from "../schemas"
import { registerItem, unregisterItem } from "../atoms"

/**
 * Options for useSidebarItem.
 */
export interface UseSidebarItemOptions {
  /** Item configuration */
  item: SidebarItemConfig
  /** Whether registration is enabled (default: true) */
  enabled?: boolean
}

/**
 * Hook for registering a plugin sidebar item.
 *
 * The item is registered on mount and unregistered on unmount.
 * Use this hook in plugin components that need sidebar presence.
 *
 * @example
 * ```tsx
 * function MyPluginPanel() {
 *   useSidebarItem({
 *     item: {
 *       id: "my-plugin" as SidebarItemId,
 *       label: "My Plugin",
 *       icon: { type: "lucide", value: "puzzle" },
 *       group: "plugin",
 *       action: { _tag: "DrawerAction", drawerId: "my-plugin", side: "right" },
 *     },
 *   })
 *
 *   return <div>Plugin content</div>
 * }
 * ```
 */
export function useSidebarItem({ item, enabled = true }: UseSidebarItemOptions): void {
  // Track registered ID for cleanup
  const registeredIdRef = useRef<SidebarItemId | null>(null)

  useEffect(() => {
    if (!enabled) {
      // If disabled and previously registered, unregister
      if (registeredIdRef.current !== null) {
        unregisterItem(registeredIdRef.current)
        registeredIdRef.current = null
      }
      return
    }

    // Register item
    registerItem(item)
    registeredIdRef.current = item.id

    // Cleanup on unmount or when item changes
    return () => {
      if (registeredIdRef.current !== null) {
        unregisterItem(registeredIdRef.current)
        registeredIdRef.current = null
      }
    }
  }, [item, enabled])
}

/**
 * Hook for registering multiple plugin sidebar items.
 *
 * @example
 * ```tsx
 * function MyPluginSuite() {
 *   useSidebarItems({
 *     items: [
 *       { id: "plugin-a" as SidebarItemId, ... },
 *       { id: "plugin-b" as SidebarItemId, ... },
 *     ],
 *   })
 *
 *   return <div>Plugin suite</div>
 * }
 * ```
 */
export function useSidebarItems({
  items,
  enabled = true,
}: {
  items: SidebarItemConfig[]
  enabled?: boolean
}): void {
  const registeredIdsRef = useRef<SidebarItemId[]>([])

  useEffect(() => {
    if (!enabled) {
      // Unregister all if disabled
      for (const id of registeredIdsRef.current) {
        unregisterItem(id)
      }
      registeredIdsRef.current = []
      return
    }

    // Register all items
    for (const item of items) {
      registerItem(item)
    }
    registeredIdsRef.current = items.map((i) => i.id)

    // Cleanup on unmount
    return () => {
      for (const id of registeredIdsRef.current) {
        unregisterItem(id)
      }
      registeredIdsRef.current = []
    }
  }, [items, enabled])
}
