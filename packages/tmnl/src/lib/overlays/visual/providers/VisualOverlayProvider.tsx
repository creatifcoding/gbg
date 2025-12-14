/**
 * Visual Overlay Provider
 *
 * Unified provider for all visual overlay types (drawer, modal, toast,
 * command-palette, top-bar, sidebar). Exposes operations for opening,
 * closing, and suppressing overlays.
 *
 * Architecture:
 * - Uses shared overlayRegistry from atoms
 * - Operations mutate atoms via registry.update()
 * - Derived atoms auto-update via effect-atom reactivity
 * - Content stored in separate in-memory registry (ReactNode not serializable)
 *
 * @module
 */

import {
  createContext,
  useContext,
  useCallback,
  useMemo,
  type ReactNode,
} from "react"
import { nanoid } from "nanoid"
import { useAtomValue } from "@effect-atom/atom-react"
import {
  // Registry
  overlayRegistry,
  OverlayRegistryProvider,
  // Visual atoms
  visualOverlaysAtom,
  zOrderByTypeAtom,
  slotsAtom,
  visibleOverlayIdsAtom,
  hasBlockingOverlayAtom,
  // Visual mutations
  openOverlay as openOverlayMutation,
  closeOverlay as closeOverlayMutation,
  removeOverlay as removeOverlayMutation,
  setAnimationState as setAnimationStateMutation,
  bringToFront as bringToFrontMutation,
  sendToBack as sendToBackMutation,
  registerSlot as registerSlotMutation,
  unregisterSlot as unregisterSlotMutation,
  updateSlotBounds as updateSlotBoundsMutation,
  // Content registry
  registerContent,
  getContent,
  unregisterContent,
  // Suppression atoms
  suppressionsAtom,
  addSuppression,
  removeSuppression,
  toggleSuppression,
  clearAllSuppressions,
  clearTypeSuppressions,
} from "../../atoms"
import {
  type VisualOverlayId,
  type VisualOverlayType,
  type VisualOverlayConfig,
  type VisualOverlayInstance,
  type SlotId,
  type OverlayAnimationState,
  type SuppressionKey,
  typeSuppressionKey,
  instanceSuppressionKey,
} from "../../schemas/visual"
import { GLOBAL_SLOT_ID, getAnimationDuration } from "../constants"

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

/**
 * Open overlay options common to all types.
 */
interface OpenOverlayOptions<C extends VisualOverlayConfig> {
  /** Override generated ID */
  id?: string
  /** Overlay configuration */
  config: C
  /** Content to render */
  content: ReactNode
}

/**
 * Context value exposed by VisualOverlayProvider.
 */
export interface VisualOverlayContextValue {
  // ─── State Accessors ───────────────────────────────────────
  /** All visible overlay IDs */
  visibleOverlayIds: VisualOverlayId[]
  /** Whether any blocking overlay (modal/command-palette) is open */
  hasBlockingOverlay: boolean

  // ─── Core Operations ───────────────────────────────────────
  /** Open any overlay type */
  open: <C extends VisualOverlayConfig>(
    type: VisualOverlayType,
    options: OpenOverlayOptions<C>
  ) => VisualOverlayId
  /** Close overlay (starts exit animation) */
  close: (id: VisualOverlayId) => void
  /** Close all overlays of a type */
  closeAllOfType: (type: VisualOverlayType) => void
  /** Remove overlay after exit animation */
  remove: (id: VisualOverlayId) => void
  /** Set animation state */
  setAnimationState: (id: VisualOverlayId, state: OverlayAnimationState) => void
  /** Bring overlay to front of its type stack */
  bringToFront: (id: VisualOverlayId) => void
  /** Send overlay to back of its type stack */
  sendToBack: (id: VisualOverlayId) => void

  // ─── Content Access ────────────────────────────────────────
  /** Get content for overlay */
  getOverlayContent: (key: string) => ReactNode | undefined

  // ─── Slot Management ───────────────────────────────────────
  /** Register a slot for overlay rendering */
  registerSlot: (
    id: SlotId,
    containerId: string,
    bounds?: { x: number; y: number; width: number; height: number }
  ) => void
  /** Unregister a slot */
  unregisterSlot: (id: SlotId) => void
  /** Update slot bounds */
  updateSlotBounds: (
    id: SlotId,
    bounds: { x: number; y: number; width: number; height: number }
  ) => void

  // ─── Suppression ───────────────────────────────────────────
  /** Add suppression (type-level or instance-level) */
  suppress: (key: SuppressionKey) => void
  /** Remove suppression */
  unsuppress: (key: SuppressionKey) => void
  /** Toggle suppression */
  toggleSuppress: (key: SuppressionKey) => void
  /** Clear all suppressions */
  clearSuppressions: () => void
  /** Clear suppressions for a type */
  clearTypeSuppressions: (type: VisualOverlayType) => void
  /** Suppress all overlays of a type */
  suppressType: (type: VisualOverlayType) => void
  /** Unsuppress all overlays of a type */
  unsuppressType: (type: VisualOverlayType) => void
  /** Suppress a specific instance */
  suppressInstance: (type: VisualOverlayType, id: string) => void
  /** Unsuppress a specific instance */
  unsuppressInstance: (type: VisualOverlayType, id: string) => void
}

const VisualOverlayContext = createContext<VisualOverlayContextValue | null>(null)

// ─────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────

export interface VisualOverlayProviderProps {
  children: ReactNode
}

/**
 * VisualOverlayProvider
 *
 * Unified provider for visual overlay management. Wrap your app root
 * with this provider to enable overlay operations throughout the tree.
 *
 * @example
 * ```tsx
 * function App() {
 *   return (
 *     <VisualOverlayProvider>
 *       <GlobalSlot />
 *       <RouterProvider router={router} />
 *     </VisualOverlayProvider>
 *   )
 * }
 * ```
 */
export function VisualOverlayProvider({ children }: VisualOverlayProviderProps) {
  // ─── State Subscriptions ─────────────────────────────────────
  const visibleOverlayIds = useAtomValue(visibleOverlayIdsAtom, {
    registry: overlayRegistry,
  })
  const hasBlockingOverlay = useAtomValue(hasBlockingOverlayAtom, {
    registry: overlayRegistry,
  })

  // ─── Core Operations ─────────────────────────────────────────

  /**
   * Open an overlay of any type.
   */
  const open = useCallback(
    <C extends VisualOverlayConfig>(
      type: VisualOverlayType,
      options: OpenOverlayOptions<C>
    ): VisualOverlayId => {
      const id = (options.id ?? nanoid()) as VisualOverlayId
      const contentKey = `overlay-${id}-${Date.now()}`

      // Register content in memory registry
      registerContent(contentKey, options.content)

      // Update atoms via registry
      overlayRegistry.update(visualOverlaysAtom, (overlays) => {
        const zOrders = overlayRegistry.get(zOrderByTypeAtom)
        const result = openOverlayMutation(
          overlays,
          zOrders,
          id,
          type,
          options.config,
          contentKey
        )
        // Update z-orders as side effect
        overlayRegistry.set(zOrderByTypeAtom, result.zOrders)
        return result.overlays
      })

      return id
    },
    []
  )

  /**
   * Close an overlay (starts exit animation).
   */
  const close = useCallback((id: VisualOverlayId): void => {
    overlayRegistry.update(visualOverlaysAtom, (overlays) =>
      closeOverlayMutation(overlays, id)
    )
  }, [])

  /**
   * Close all overlays of a specific type.
   */
  const closeAllOfType = useCallback((type: VisualOverlayType): void => {
    const overlays = overlayRegistry.get(visualOverlaysAtom)
    for (const [id, instance] of overlays) {
      if (instance.type === type && !instance.isExiting && !instance.hasExited) {
        overlayRegistry.update(visualOverlaysAtom, (current) =>
          closeOverlayMutation(current, id)
        )
      }
    }
  }, [])

  /**
   * Remove overlay from state (after exit animation completes).
   */
  const remove = useCallback((id: VisualOverlayId): void => {
    overlayRegistry.update(visualOverlaysAtom, (overlays) => {
      const zOrders = overlayRegistry.get(zOrderByTypeAtom)
      const result = removeOverlayMutation(overlays, zOrders, id)
      // Update z-orders as side effect
      overlayRegistry.set(zOrderByTypeAtom, result.zOrders)
      return result.overlays
    })
  }, [])

  /**
   * Update animation state.
   */
  const setAnimationState = useCallback(
    (id: VisualOverlayId, state: OverlayAnimationState): void => {
      overlayRegistry.update(visualOverlaysAtom, (overlays) =>
        setAnimationStateMutation(overlays, id, state)
      )

      // Auto-remove after exit animation completes
      if (state === "exited") {
        // Small delay to ensure animation cleanup
        setTimeout(() => remove(id), 50)
      }
    },
    [remove]
  )

  /**
   * Bring overlay to front of its type stack.
   */
  const bringToFront = useCallback((id: VisualOverlayId): void => {
    overlayRegistry.update(visualOverlaysAtom, (overlays) => {
      const zOrders = overlayRegistry.get(zOrderByTypeAtom)
      const result = bringToFrontMutation(overlays, zOrders, id)
      overlayRegistry.set(zOrderByTypeAtom, result.zOrders)
      return result.overlays
    })
  }, [])

  /**
   * Send overlay to back of its type stack.
   */
  const sendToBack = useCallback((id: VisualOverlayId): void => {
    overlayRegistry.update(visualOverlaysAtom, (overlays) => {
      const zOrders = overlayRegistry.get(zOrderByTypeAtom)
      const result = sendToBackMutation(overlays, zOrders, id)
      overlayRegistry.set(zOrderByTypeAtom, result.zOrders)
      return result.overlays
    })
  }, [])

  // ─── Content Access ──────────────────────────────────────────

  const getOverlayContent = useCallback((key: string): ReactNode | undefined => {
    return getContent(key)
  }, [])

  // ─── Slot Management ─────────────────────────────────────────

  const registerSlotOp = useCallback(
    (
      id: SlotId,
      containerId: string,
      bounds?: { x: number; y: number; width: number; height: number }
    ): void => {
      overlayRegistry.update(slotsAtom, (slots) =>
        registerSlotMutation(slots, id, containerId, bounds)
      )
    },
    []
  )

  const unregisterSlotOp = useCallback((id: SlotId): void => {
    overlayRegistry.update(slotsAtom, (slots) => unregisterSlotMutation(slots, id))
  }, [])

  const updateSlotBoundsOp = useCallback(
    (
      id: SlotId,
      bounds: { x: number; y: number; width: number; height: number }
    ): void => {
      overlayRegistry.update(slotsAtom, (slots) =>
        updateSlotBoundsMutation(slots, id, bounds)
      )
    },
    []
  )

  // ─── Suppression Operations ──────────────────────────────────

  const suppress = useCallback((key: SuppressionKey): void => {
    overlayRegistry.update(suppressionsAtom, (s) => addSuppression(s, key))
  }, [])

  const unsuppress = useCallback((key: SuppressionKey): void => {
    overlayRegistry.update(suppressionsAtom, (s) => removeSuppression(s, key))
  }, [])

  const toggleSuppress = useCallback((key: SuppressionKey): void => {
    overlayRegistry.update(suppressionsAtom, (s) => toggleSuppression(s, key))
  }, [])

  const clearSuppressionsOp = useCallback((): void => {
    overlayRegistry.update(suppressionsAtom, clearAllSuppressions)
  }, [])

  const clearTypeSuppressionsOp = useCallback((type: VisualOverlayType): void => {
    overlayRegistry.update(suppressionsAtom, (s) => clearTypeSuppressions(s, type))
  }, [])

  const suppressType = useCallback((type: VisualOverlayType): void => {
    const key = typeSuppressionKey(type)
    overlayRegistry.update(suppressionsAtom, (s) => addSuppression(s, key))
  }, [])

  const unsuppressType = useCallback((type: VisualOverlayType): void => {
    const key = typeSuppressionKey(type)
    overlayRegistry.update(suppressionsAtom, (s) => removeSuppression(s, key))
  }, [])

  const suppressInstance = useCallback(
    (type: VisualOverlayType, id: string): void => {
      const key = instanceSuppressionKey(type, id)
      overlayRegistry.update(suppressionsAtom, (s) => addSuppression(s, key))
    },
    []
  )

  const unsuppressInstance = useCallback(
    (type: VisualOverlayType, id: string): void => {
      const key = instanceSuppressionKey(type, id)
      overlayRegistry.update(suppressionsAtom, (s) => removeSuppression(s, key))
    },
    []
  )

  // ─── Context Value ───────────────────────────────────────────

  const value = useMemo(
    (): VisualOverlayContextValue => ({
      // State
      visibleOverlayIds,
      hasBlockingOverlay,
      // Core operations
      open,
      close,
      closeAllOfType,
      remove,
      setAnimationState,
      bringToFront,
      sendToBack,
      // Content
      getOverlayContent,
      // Slots
      registerSlot: registerSlotOp,
      unregisterSlot: unregisterSlotOp,
      updateSlotBounds: updateSlotBoundsOp,
      // Suppression
      suppress,
      unsuppress,
      toggleSuppress,
      clearSuppressions: clearSuppressionsOp,
      clearTypeSuppressions: clearTypeSuppressionsOp,
      suppressType,
      unsuppressType,
      suppressInstance,
      unsuppressInstance,
    }),
    [
      visibleOverlayIds,
      hasBlockingOverlay,
      open,
      close,
      closeAllOfType,
      remove,
      setAnimationState,
      bringToFront,
      sendToBack,
      getOverlayContent,
      registerSlotOp,
      unregisterSlotOp,
      updateSlotBoundsOp,
      suppress,
      unsuppress,
      toggleSuppress,
      clearSuppressionsOp,
      clearTypeSuppressionsOp,
      suppressType,
      unsuppressType,
      suppressInstance,
      unsuppressInstance,
    ]
  )

  return (
    <OverlayRegistryProvider>
      <VisualOverlayContext.Provider value={value}>
        {children}
      </VisualOverlayContext.Provider>
    </OverlayRegistryProvider>
  )
}

// ─────────────────────────────────────────────────────────────
// Hooks
// ─────────────────────────────────────────────────────────────

/**
 * Access visual overlay context.
 *
 * @throws Error if used outside VisualOverlayProvider
 */
export function useVisualOverlay(): VisualOverlayContextValue {
  const context = useContext(VisualOverlayContext)
  if (!context) {
    throw new Error(
      "useVisualOverlay must be used within VisualOverlayProvider"
    )
  }
  return context
}

/**
 * Safe version that returns null when no provider exists.
 * Use this for components that should gracefully no-op without provider.
 */
export function useVisualOverlaySafe(): VisualOverlayContextValue | null {
  return useContext(VisualOverlayContext)
}

// ─────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────

export { VisualOverlayContext }
