/**
 * Drawer Stack Context
 *
 * Provider for drawer stack management with z-index ordering,
 * slot registration, and animation coordination.
 *
 * @module
 */

import {
  createContext,
  useContext,
  useCallback,
  useRef,
  useMemo,
  type ReactNode,
} from 'react'
import { nanoid } from 'nanoid'
import { Atom, useAtom, useAtomValue } from '@effect-atom/atom-react'
import type {
  DrawerConfig,
  DrawerInstance,
  DrawerStackState,
  DrawerSlot,
  DrawerSlotType,
  DrawerAnimationState,
} from './types'
import { initialDrawerStackState, DEFAULT_DRAWER_CONFIG } from './types'

// =============================================================================
// ATOMS (Module-level for stable references)
// =============================================================================

const drawerStackAtom = Atom.make<DrawerStackState>(initialDrawerStackState)
const slotRegistryAtom = Atom.make<Map<DrawerSlotType, DrawerSlot>>(new Map())

// Base z-index for drawer system (above FloatingPanels)
const BASE_Z_INDEX = 10000
const Z_INDEX_GAP = 10

// =============================================================================
// CONTEXT
// =============================================================================

interface DrawerStackContextValue {
  /** Current stack state (reactive) */
  state: DrawerStackState
  /** Push a new drawer onto the stack */
  push: (config: DrawerConfig) => string
  /** Pop a drawer by ID */
  pop: (id: string) => void
  /** Pop all drawers */
  popAll: () => void
  /** Replace a drawer (animated switch) */
  replace: (id: string, config: DrawerConfig) => string
  /** Bring a drawer to front */
  bringToFront: (id: string) => void
  /** Get drawer by ID */
  getDrawer: (id: string) => DrawerInstance | undefined
  /** Get drawers for a specific slot */
  getDrawersForSlot: (slotId: DrawerSlotType) => DrawerInstance[]
  /** Register a slot for portal targeting */
  registerSlot: (slot: DrawerSlot) => void
  /** Unregister a slot */
  unregisterSlot: (slotId: DrawerSlotType) => void
  /** Get registered slot */
  getSlot: (slotId: DrawerSlotType) => DrawerSlot | undefined
  /** Update drawer animation state */
  setAnimationState: (id: string, state: DrawerAnimationState) => void
}

const DrawerStackContext = createContext<DrawerStackContextValue | null>(null)

// =============================================================================
// PROVIDER
// =============================================================================

interface DrawerStackProviderProps {
  children: ReactNode
}

export function DrawerStackProvider({ children }: DrawerStackProviderProps) {
  const [state, setState] = useAtom(drawerStackAtom)
  const [slots, setSlots] = useAtom(slotRegistryAtom)

  // Track next z-index
  const nextZIndexRef = useRef(BASE_Z_INDEX)

  // -------------------------------------------------------------------------
  // Push drawer onto stack
  // -------------------------------------------------------------------------
  const push = useCallback(
    (config: DrawerConfig): string => {
      const id = config.id || nanoid()
      const zIndex = nextZIndexRef.current
      nextZIndexRef.current += Z_INDEX_GAP

      const instance: DrawerInstance = {
        ...DEFAULT_DRAWER_CONFIG,
        ...config,
        id,
        zIndex,
        animationState: 'entering',
        openedAt: Date.now(),
      }

      setState((prev) => ({
        ...prev,
        drawers: [...prev.drawers, instance],
        zOrder: [...prev.zOrder, id],
        transitioning: id,
      }))

      // Call onOpen callback
      config.onOpen?.()

      return id
    },
    [setState]
  )

  // -------------------------------------------------------------------------
  // Pop drawer from stack
  // -------------------------------------------------------------------------
  const pop = useCallback(
    (id: string): void => {
      const drawer = state.drawers.find((d) => d.id === id)
      if (!drawer) return

      // Set to exiting state (animation will handle removal)
      setState((prev) => ({
        ...prev,
        drawers: prev.drawers.map((d) =>
          d.id === id ? { ...d, animationState: 'exiting' as const } : d
        ),
        transitioning: id,
      }))

      // Call onClose callback
      drawer.onClose?.()
    },
    [state.drawers, setState]
  )

  // -------------------------------------------------------------------------
  // Pop all drawers
  // -------------------------------------------------------------------------
  const popAll = useCallback((): void => {
    setState((prev) => ({
      ...prev,
      drawers: prev.drawers.map((d) => ({
        ...d,
        animationState: 'exiting' as const,
      })),
      transitioning: 'all',
    }))
  }, [setState])

  // -------------------------------------------------------------------------
  // Replace drawer (animated switch)
  // -------------------------------------------------------------------------
  const replace = useCallback(
    (id: string, config: DrawerConfig): string => {
      pop(id)
      // Stagger new drawer opening
      return push(config)
    },
    [pop, push]
  )

  // -------------------------------------------------------------------------
  // Bring drawer to front
  // -------------------------------------------------------------------------
  const bringToFront = useCallback(
    (id: string): void => {
      setState((prev) => {
        const drawer = prev.drawers.find((d) => d.id === id)
        if (!drawer) return prev

        const newZIndex = nextZIndexRef.current
        nextZIndexRef.current += Z_INDEX_GAP

        return {
          ...prev,
          drawers: prev.drawers.map((d) =>
            d.id === id ? { ...d, zIndex: newZIndex } : d
          ),
          zOrder: [...prev.zOrder.filter((i) => i !== id), id],
        }
      })
    },
    [setState]
  )

  // -------------------------------------------------------------------------
  // Get drawer by ID
  // -------------------------------------------------------------------------
  const getDrawer = useCallback(
    (id: string): DrawerInstance | undefined => {
      return state.drawers.find((d) => d.id === id)
    },
    [state.drawers]
  )

  // -------------------------------------------------------------------------
  // Get drawers for slot
  // -------------------------------------------------------------------------
  const getDrawersForSlot = useCallback(
    (slotId: DrawerSlotType): DrawerInstance[] => {
      return state.drawers
        .filter((d) => d.slot === slotId && d.animationState !== 'exited')
        .sort((a, b) => a.zIndex - b.zIndex)
    },
    [state.drawers]
  )

  // -------------------------------------------------------------------------
  // Register slot
  // -------------------------------------------------------------------------
  const registerSlot = useCallback(
    (slot: DrawerSlot): void => {
      setSlots((prev) => {
        const next = new Map(prev)
        next.set(slot.id, slot)
        return next
      })
    },
    [setSlots]
  )

  // -------------------------------------------------------------------------
  // Unregister slot
  // -------------------------------------------------------------------------
  const unregisterSlot = useCallback(
    (slotId: DrawerSlotType): void => {
      setSlots((prev) => {
        const next = new Map(prev)
        next.delete(slotId)
        return next
      })
    },
    [setSlots]
  )

  // -------------------------------------------------------------------------
  // Get slot
  // -------------------------------------------------------------------------
  const getSlot = useCallback(
    (slotId: DrawerSlotType): DrawerSlot | undefined => {
      return slots.get(slotId)
    },
    [slots]
  )

  // -------------------------------------------------------------------------
  // Set animation state
  // -------------------------------------------------------------------------
  const setAnimationState = useCallback(
    (id: string, animState: DrawerAnimationState): void => {
      setState((prev) => {
        // If exited, remove from stack
        if (animState === 'exited') {
          const drawer = prev.drawers.find((d) => d.id === id)
          drawer?.onExited?.()

          return {
            ...prev,
            drawers: prev.drawers.filter((d) => d.id !== id),
            zOrder: prev.zOrder.filter((i) => i !== id),
            transitioning: prev.transitioning === id ? null : prev.transitioning,
          }
        }

        // If visible, call onEntered
        if (animState === 'visible') {
          const drawer = prev.drawers.find((d) => d.id === id)
          drawer?.onEntered?.()
        }

        return {
          ...prev,
          drawers: prev.drawers.map((d) =>
            d.id === id ? { ...d, animationState: animState } : d
          ),
          transitioning:
            animState === 'visible' && prev.transitioning === id
              ? null
              : prev.transitioning,
        }
      })
    },
    [setState]
  )

  // -------------------------------------------------------------------------
  // Context value
  // -------------------------------------------------------------------------
  const value = useMemo(
    (): DrawerStackContextValue => ({
      state,
      push,
      pop,
      popAll,
      replace,
      bringToFront,
      getDrawer,
      getDrawersForSlot,
      registerSlot,
      unregisterSlot,
      getSlot,
      setAnimationState,
    }),
    [
      state,
      push,
      pop,
      popAll,
      replace,
      bringToFront,
      getDrawer,
      getDrawersForSlot,
      registerSlot,
      unregisterSlot,
      getSlot,
      setAnimationState,
    ]
  )

  return (
    <DrawerStackContext.Provider value={value}>
      {children}
    </DrawerStackContext.Provider>
  )
}

// =============================================================================
// HOOK
// =============================================================================

/**
 * Access drawer stack context.
 *
 * @throws Error if used outside DrawerStackProvider
 */
export function useDrawerStack(): DrawerStackContextValue {
  const context = useContext(DrawerStackContext)
  if (!context) {
    throw new Error('useDrawerStack must be used within DrawerStackProvider')
  }
  return context
}

/**
 * Safe version that returns null when no provider exists.
 * Use this for components that should gracefully no-op without provider.
 */
export function useDrawerStackSafe(): DrawerStackContextValue | null {
  return useContext(DrawerStackContext)
}

// =============================================================================
// SELECTORS (for optimized subscriptions)
// =============================================================================

/**
 * Get current drawer count.
 */
export function useDrawerCount(): number {
  const state = useAtomValue(drawerStackAtom)
  return state.drawers.length
}

/**
 * Check if any drawer is open.
 */
export function useHasOpenDrawers(): boolean {
  const state = useAtomValue(drawerStackAtom)
  return state.drawers.length > 0
}

/**
 * Get top drawer ID.
 */
export function useTopDrawerId(): string | null {
  const state = useAtomValue(drawerStackAtom)
  return state.zOrder[state.zOrder.length - 1] ?? null
}

// =============================================================================
// EXPORTS
// =============================================================================

export { drawerStackAtom, slotRegistryAtom }
