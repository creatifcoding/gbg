/**
 * useGeointLayout Hook
 *
 * Layout mode management with bidirectional XState-Atom sync.
 * Provides reactive access to layout state and transition actions.
 *
 * PATTERN: stx (State machine + Atoms + XState)
 * - Machine owns state transitions and orchestration
 * - Atoms provide reactive subscriptions for React
 * - Sync actions keep both in harmony
 *
 * @module geoint/hooks/useGeointLayout
 */

import { useCallback, useMemo, useEffect, useRef } from 'react'
import { useAtomValue } from '@effect-atom/atom-react'
import {
  type LayoutMode,
  layoutModeAtom,
  animationStateAtom,
  setLayoutMode,
} from '../atoms/layoutAtoms'
import { geointRegistry } from '../atoms'
import type { LayoutMachineRef } from '../machines/layoutMachine'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface UseGeointLayoutResult {
  // State
  readonly layout: LayoutMode
  readonly previousLayout: LayoutMode | null
  readonly isAnimating: boolean
  readonly animationPhase: 'idle' | 'exit' | 'enter' | 'transition'

  // Layout modes
  readonly isCommand: boolean
  readonly isFocus: boolean
  readonly isAnalytics: boolean

  // Actions
  readonly setLayout: (layout: LayoutMode) => void
  readonly cycleLayout: () => void
  readonly toCommand: () => void
  readonly toFocus: () => void
  readonly toAnalytics: () => void
}

export interface UseGeointLayoutOptions {
  /**
   * Optional XState machine reference for bidirectional sync.
   * If provided, layout changes dispatch events to the machine.
   */
  readonly machineRef?: LayoutMachineRef
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const LAYOUT_CYCLE: LayoutMode[] = ['command', 'focus', 'analytics']

function getNextLayout(current: LayoutMode): LayoutMode {
  const idx = LAYOUT_CYCLE.indexOf(current)
  return LAYOUT_CYCLE[(idx + 1) % LAYOUT_CYCLE.length]
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook Implementation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hook for layout mode management.
 *
 * Works standalone (atoms only) or with XState machine for bidirectional sync.
 *
 * @example
 * ```tsx
 * // Standalone (atoms only)
 * function LayoutSwitcher() {
 *   const { layout, setLayout, isAnimating } = useGeointLayout()
 *
 *   return (
 *     <div className={cn(isAnimating && 'pointer-events-none')}>
 *       <button onClick={() => setLayout('command')}>Command</button>
 *       <button onClick={() => setLayout('focus')}>Focus</button>
 *       <button onClick={() => setLayout('analytics')}>Analytics</button>
 *     </div>
 *   )
 * }
 *
 * // With machine (bidirectional sync)
 * function ShellContent({ actorRef }: { actorRef: LayoutMachineRef }) {
 *   const layout = useGeointLayout({ machineRef: actorRef })
 *   // Changes sync to both atoms and machine
 * }
 * ```
 */
export function useGeointLayout(options?: UseGeointLayoutOptions): UseGeointLayoutResult {
  const { machineRef } = options ?? {}

  // Subscribe to atoms
  const layout = useAtomValue(layoutModeAtom)
  const animationState = useAtomValue(animationStateAtom)

  // Track if we should sync to machine
  const syncToMachine = useRef(false)

  // Bidirectional sync: when layout atom changes externally, sync to machine
  useEffect(() => {
    if (!machineRef) return

    // Subscribe to atom changes
    const unsubscribe = geointRegistry.subscribe(layoutModeAtom, (newLayout) => {
      // Avoid feedback loop: only sync if not triggered by machine
      if (syncToMachine.current) {
        syncToMachine.current = false
        return
      }

      const machineLayout = machineRef.getSnapshot().context.currentLayout
      if (newLayout !== machineLayout) {
        // Atom changed externally, sync to machine
        machineRef.send({ type: 'SET_LAYOUT', layout: newLayout })
      }
    })

    return unsubscribe
  }, [machineRef])

  // Actions
  const setLayoutAction = useCallback(
    (newLayout: LayoutMode) => {
      if (newLayout === layout) return

      if (machineRef) {
        // Machine mode: send event (machine syncs to atoms via entry actions)
        syncToMachine.current = true
        machineRef.send({ type: 'SET_LAYOUT', layout: newLayout })
      } else {
        // Atom-only mode: update atom directly
        setLayoutMode(newLayout)
      }
    },
    [layout, machineRef]
  )

  const cycleLayout = useCallback(() => {
    const next = getNextLayout(layout)
    setLayoutAction(next)
  }, [layout, setLayoutAction])

  const toCommand = useCallback(() => setLayoutAction('command'), [setLayoutAction])
  const toFocus = useCallback(() => setLayoutAction('focus'), [setLayoutAction])
  const toAnalytics = useCallback(() => setLayoutAction('analytics'), [setLayoutAction])

  return useMemo(
    () => ({
      // State
      layout,
      previousLayout: animationState.previousLayout,
      isAnimating: animationState.isAnimating,
      animationPhase: animationState.phase,
      // Layout mode flags
      isCommand: layout === 'command',
      isFocus: layout === 'focus',
      isAnalytics: layout === 'analytics',
      // Actions
      setLayout: setLayoutAction,
      cycleLayout,
      toCommand,
      toFocus,
      toAnalytics,
    }),
    [layout, animationState, setLayoutAction, cycleLayout, toCommand, toFocus, toAnalytics]
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Lightweight Variants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hook for just layout mode (minimal subscription).
 */
export function useGeointLayoutMode(): LayoutMode {
  return useAtomValue(layoutModeAtom)
}

/**
 * Hook for animation state only.
 */
export function useGeointLayoutAnimation() {
  const animationState = useAtomValue(animationStateAtom)
  return useMemo(
    () => ({
      phase: animationState.phase,
      previousLayout: animationState.previousLayout,
      isAnimating: animationState.isAnimating,
    }),
    [animationState]
  )
}

/**
 * Hook for checking specific layout mode.
 */
export function useIsGeointLayout(mode: LayoutMode): boolean {
  const layout = useAtomValue(layoutModeAtom)
  return layout === mode
}
