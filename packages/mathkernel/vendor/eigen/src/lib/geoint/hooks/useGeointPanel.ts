/**
 * useGeointPanel Hook
 *
 * Panel state management for sidebar, intel, and timeline panels.
 * Provides reactive access to panel state and mutation actions.
 *
 * PATTERN: stx (State machine + Atoms + XState)
 * - Panel state in atoms for reactive subscriptions
 * - Optional machine sync for orchestrated transitions
 *
 * @module geoint/hooks/useGeointPanel
 */

import { useCallback, useMemo, useEffect, useRef } from 'react'
import { useAtomValue } from '@effect-atom/atom-react'
import {
  type SidebarSection,
  type IntelTab,
  type TimelineRange,
  sidebarStateAtom,
  intelPanelStateAtom,
  timelineStateAtom,
  toggleSidebar,
  setSidebarSection,
  toggleIntelPanel,
  setIntelTab,
  toggleTimeline,
  setTimelineRange,
} from '../atoms/layoutAtoms'
import { geointRegistry } from '../atoms'
import type { LayoutMachineRef } from '../machines/layoutMachine'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type PanelType = 'sidebar' | 'intel' | 'timeline'

export interface UseGeointSidebarResult {
  readonly collapsed: boolean
  readonly width: number
  readonly section: SidebarSection

  readonly toggle: () => void
  readonly expand: () => void
  readonly collapse: () => void
  readonly setSection: (section: SidebarSection) => void
}

export interface UseGeointIntelPanelResult {
  readonly collapsed: boolean
  readonly width: number
  readonly tab: IntelTab

  readonly toggle: () => void
  readonly expand: () => void
  readonly collapse: () => void
  readonly setTab: (tab: IntelTab) => void
}

export interface UseGeointTimelineResult {
  readonly collapsed: boolean
  readonly height: number
  readonly range: TimelineRange
  readonly playbackActive: boolean
  readonly playbackSpeed: number
  readonly currentTime: number | null

  readonly toggle: () => void
  readonly expand: () => void
  readonly collapse: () => void
  readonly setRange: (range: TimelineRange) => void
}

export interface UseGeointPanelOptions {
  /**
   * Optional XState machine reference for bidirectional sync.
   */
  readonly machineRef?: LayoutMachineRef
}

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar Hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hook for sidebar panel state.
 *
 * @example
 * ```tsx
 * function SidebarToggle() {
 *   const sidebar = useGeointSidebar()
 *
 *   return (
 *     <button onClick={sidebar.toggle}>
 *       {sidebar.collapsed ? 'Expand' : 'Collapse'}
 *     </button>
 *   )
 * }
 * ```
 */
export function useGeointSidebar(options?: UseGeointPanelOptions): UseGeointSidebarResult {
  const { machineRef } = options ?? {}

  const state = useAtomValue(sidebarStateAtom)
  const syncToMachine = useRef(false)

  // Bidirectional sync
  useEffect(() => {
    if (!machineRef) return

    const unsubscribe = geointRegistry.subscribe(sidebarStateAtom, (newState) => {
      if (syncToMachine.current) {
        syncToMachine.current = false
        return
      }

      const machineContext = machineRef.getSnapshot().context
      if (newState.collapsed !== machineContext.panels.sidebar.collapsed) {
        machineRef.send({ type: newState.collapsed ? 'COLLAPSE_SIDEBAR' : 'EXPAND_SIDEBAR' })
      }
      if (newState.activeSection !== machineContext.panels.sidebar.section) {
        machineRef.send({ type: 'SET_SIDEBAR_SECTION', section: newState.activeSection })
      }
    })

    return unsubscribe
  }, [machineRef])

  const toggle = useCallback(() => {
    if (machineRef) {
      syncToMachine.current = true
      machineRef.send({ type: 'TOGGLE_SIDEBAR' })
    } else {
      toggleSidebar()
    }
  }, [machineRef])

  const expand = useCallback(() => {
    if (machineRef) {
      syncToMachine.current = true
      machineRef.send({ type: 'EXPAND_SIDEBAR' })
    } else {
      const current = geointRegistry.get(sidebarStateAtom)
      geointRegistry.set(sidebarStateAtom, { ...current, collapsed: false })
    }
  }, [machineRef])

  const collapse = useCallback(() => {
    if (machineRef) {
      syncToMachine.current = true
      machineRef.send({ type: 'COLLAPSE_SIDEBAR' })
    } else {
      const current = geointRegistry.get(sidebarStateAtom)
      geointRegistry.set(sidebarStateAtom, { ...current, collapsed: true })
    }
  }, [machineRef])

  const setSection = useCallback(
    (section: SidebarSection) => {
      if (machineRef) {
        syncToMachine.current = true
        machineRef.send({ type: 'SET_SIDEBAR_SECTION', section })
      } else {
        setSidebarSection(section)
      }
    },
    [machineRef]
  )

  return useMemo(
    () => ({
      collapsed: state.collapsed,
      width: state.width,
      section: state.activeSection,
      toggle,
      expand,
      collapse,
      setSection,
    }),
    [state, toggle, expand, collapse, setSection]
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Intel Panel Hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hook for intel panel (right panel) state.
 *
 * @example
 * ```tsx
 * function IntelTabs() {
 *   const intel = useGeointIntelPanel()
 *
 *   return (
 *     <Tabs value={intel.tab} onValueChange={intel.setTab}>
 *       <TabsTrigger value="entity">Entity</TabsTrigger>
 *       <TabsTrigger value="results">Results</TabsTrigger>
 *       <TabsTrigger value="alerts">Alerts</TabsTrigger>
 *     </Tabs>
 *   )
 * }
 * ```
 */
export function useGeointIntelPanel(options?: UseGeointPanelOptions): UseGeointIntelPanelResult {
  const { machineRef } = options ?? {}

  const state = useAtomValue(intelPanelStateAtom)
  const syncToMachine = useRef(false)

  // Bidirectional sync
  useEffect(() => {
    if (!machineRef) return

    const unsubscribe = geointRegistry.subscribe(intelPanelStateAtom, (newState) => {
      if (syncToMachine.current) {
        syncToMachine.current = false
        return
      }

      const machineContext = machineRef.getSnapshot().context
      if (newState.collapsed !== machineContext.panels.intel.collapsed) {
        machineRef.send({ type: newState.collapsed ? 'COLLAPSE_INTEL' : 'EXPAND_INTEL' })
      }
      if (newState.activeTab !== machineContext.panels.intel.tab) {
        machineRef.send({ type: 'SET_INTEL_TAB', tab: newState.activeTab })
      }
    })

    return unsubscribe
  }, [machineRef])

  const toggle = useCallback(() => {
    if (machineRef) {
      syncToMachine.current = true
      machineRef.send({ type: 'TOGGLE_INTEL' })
    } else {
      toggleIntelPanel()
    }
  }, [machineRef])

  const expand = useCallback(() => {
    if (machineRef) {
      syncToMachine.current = true
      machineRef.send({ type: 'EXPAND_INTEL' })
    } else {
      const current = geointRegistry.get(intelPanelStateAtom)
      geointRegistry.set(intelPanelStateAtom, { ...current, collapsed: false })
    }
  }, [machineRef])

  const collapse = useCallback(() => {
    if (machineRef) {
      syncToMachine.current = true
      machineRef.send({ type: 'COLLAPSE_INTEL' })
    } else {
      const current = geointRegistry.get(intelPanelStateAtom)
      geointRegistry.set(intelPanelStateAtom, { ...current, collapsed: true })
    }
  }, [machineRef])

  const setTab = useCallback(
    (tab: IntelTab) => {
      if (machineRef) {
        syncToMachine.current = true
        machineRef.send({ type: 'SET_INTEL_TAB', tab })
      } else {
        setIntelTab(tab)
      }
    },
    [machineRef]
  )

  return useMemo(
    () => ({
      collapsed: state.collapsed,
      width: state.width,
      tab: state.activeTab,
      toggle,
      expand,
      collapse,
      setTab,
    }),
    [state, toggle, expand, collapse, setTab]
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Timeline Hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hook for timeline panel (bottom drawer) state.
 *
 * @example
 * ```tsx
 * function TimelineControls() {
 *   const timeline = useGeointTimeline()
 *
 *   return (
 *     <div>
 *       <button onClick={timeline.toggle}>
 *         {timeline.collapsed ? 'Show' : 'Hide'} Timeline
 *       </button>
 *       <select value={timeline.range} onChange={e => timeline.setRange(e.target.value)}>
 *         <option value="2h">2 Hours</option>
 *         <option value="12h">12 Hours</option>
 *         <option value="24h">24 Hours</option>
 *       </select>
 *     </div>
 *   )
 * }
 * ```
 */
export function useGeointTimeline(options?: UseGeointPanelOptions): UseGeointTimelineResult {
  const { machineRef } = options ?? {}

  const state = useAtomValue(timelineStateAtom)
  const syncToMachine = useRef(false)

  // Bidirectional sync
  useEffect(() => {
    if (!machineRef) return

    const unsubscribe = geointRegistry.subscribe(timelineStateAtom, (newState) => {
      if (syncToMachine.current) {
        syncToMachine.current = false
        return
      }

      const machineContext = machineRef.getSnapshot().context
      if (newState.collapsed !== machineContext.panels.timeline.collapsed) {
        machineRef.send({ type: newState.collapsed ? 'COLLAPSE_TIMELINE' : 'EXPAND_TIMELINE' })
      }
      if (newState.range !== machineContext.panels.timeline.range) {
        machineRef.send({ type: 'SET_TIMELINE_RANGE', range: newState.range })
      }
    })

    return unsubscribe
  }, [machineRef])

  const toggle = useCallback(() => {
    if (machineRef) {
      syncToMachine.current = true
      machineRef.send({ type: 'TOGGLE_TIMELINE' })
    } else {
      toggleTimeline()
    }
  }, [machineRef])

  const expand = useCallback(() => {
    if (machineRef) {
      syncToMachine.current = true
      machineRef.send({ type: 'EXPAND_TIMELINE' })
    } else {
      const current = geointRegistry.get(timelineStateAtom)
      geointRegistry.set(timelineStateAtom, { ...current, collapsed: false })
    }
  }, [machineRef])

  const collapse = useCallback(() => {
    if (machineRef) {
      syncToMachine.current = true
      machineRef.send({ type: 'COLLAPSE_TIMELINE' })
    } else {
      const current = geointRegistry.get(timelineStateAtom)
      geointRegistry.set(timelineStateAtom, { ...current, collapsed: true })
    }
  }, [machineRef])

  const setRange = useCallback(
    (range: TimelineRange) => {
      if (machineRef) {
        syncToMachine.current = true
        machineRef.send({ type: 'SET_TIMELINE_RANGE', range })
      } else {
        setTimelineRange(range)
      }
    },
    [machineRef]
  )

  return useMemo(
    () => ({
      collapsed: state.collapsed,
      height: state.height,
      range: state.range,
      playbackActive: state.playbackActive,
      playbackSpeed: state.playbackSpeed,
      currentTime: state.currentTime,
      toggle,
      expand,
      collapse,
      setRange,
    }),
    [state, toggle, expand, collapse, setRange]
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Lightweight Variants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hook for sidebar collapsed state only.
 */
export function useGeointSidebarCollapsed(): boolean {
  const state = useAtomValue(sidebarStateAtom)
  return state.collapsed
}

/**
 * Hook for intel panel collapsed state only.
 */
export function useGeointIntelCollapsed(): boolean {
  const state = useAtomValue(intelPanelStateAtom)
  return state.collapsed
}

/**
 * Hook for timeline collapsed state only.
 */
export function useGeointTimelineCollapsed(): boolean {
  const state = useAtomValue(timelineStateAtom)
  return state.collapsed
}
