/**
 * GEOINT Layout Atoms
 *
 * Reactive state for layout orchestration across Command Center, Focus Mode,
 * and Analytics Dashboard variants.
 *
 * @module geoint/atoms/layoutAtoms
 */

import { Atom } from '@effect-atom/atom'
import { PANEL_DIMENSIONS } from '../tokens'
import { geointRegistry } from './index'

// =============================================================================
// LAYOUT MODE
// =============================================================================

/**
 * Layout variant modes.
 * - command: 3-column Command Center layout
 * - focus: Full-screen map with floating panels
 * - analytics: Grid-based analytics dashboard
 */
export type LayoutMode = 'command' | 'focus' | 'analytics'

/**
 * Current layout mode.
 */
export const layoutModeAtom = Atom.make<LayoutMode>('command')

// =============================================================================
// SIDEBAR STATE
// =============================================================================

export type SidebarSection = 'search' | 'layers' | 'tools' | 'stats'

export interface SidebarState {
  readonly collapsed: boolean
  readonly width: number
  readonly activeSection: SidebarSection
}

const DEFAULT_SIDEBAR_STATE: SidebarState = {
  collapsed: false,
  width: PANEL_DIMENSIONS.sidebar.default,
  activeSection: 'search',
}

/**
 * Sidebar (left panel) state.
 */
export const sidebarStateAtom = Atom.make<SidebarState>(DEFAULT_SIDEBAR_STATE)

/**
 * Derived: Effective sidebar width based on collapsed state.
 */
export const sidebarWidthAtom = Atom.make((get): number => {
  const { collapsed, width } = get(sidebarStateAtom)
  return collapsed ? PANEL_DIMENSIONS.sidebar.collapsed : width
})

// =============================================================================
// INTEL PANEL STATE
// =============================================================================

export type IntelTab = 'entity' | 'results' | 'alerts' | 'collections'

export interface IntelPanelState {
  readonly collapsed: boolean
  readonly width: number
  readonly activeTab: IntelTab
}

const DEFAULT_INTEL_PANEL_STATE: IntelPanelState = {
  collapsed: false,
  width: PANEL_DIMENSIONS.intelPanel.default,
  activeTab: 'results',
}

/**
 * Intel panel (right panel) state.
 */
export const intelPanelStateAtom = Atom.make<IntelPanelState>(DEFAULT_INTEL_PANEL_STATE)

/**
 * Derived: Effective intel panel width based on collapsed state.
 */
export const intelPanelWidthAtom = Atom.make((get): number => {
  const { collapsed, width } = get(intelPanelStateAtom)
  return collapsed ? PANEL_DIMENSIONS.intelPanel.collapsed : width
})

// =============================================================================
// TIMELINE STATE
// =============================================================================

export type TimelineRange = '2h' | '12h' | '24h' | '7d' | 'custom'

export interface TimelineState {
  readonly collapsed: boolean
  readonly height: number
  readonly range: TimelineRange
  readonly playbackActive: boolean
  readonly playbackSpeed: number
  readonly currentTime: number | null
}

const DEFAULT_TIMELINE_STATE: TimelineState = {
  collapsed: true,
  height: PANEL_DIMENSIONS.drawer.default,
  range: '24h',
  playbackActive: false,
  playbackSpeed: 1,
  currentTime: null,
}

/**
 * Timeline panel (bottom drawer) state.
 */
export const timelineStateAtom = Atom.make<TimelineState>(DEFAULT_TIMELINE_STATE)

// =============================================================================
// ANIMATION STATE
// =============================================================================

export type AnimationPhase = 'idle' | 'enter' | 'exit' | 'transition'

export interface AnimationState {
  readonly phase: AnimationPhase
  readonly previousLayout: LayoutMode | null
  readonly staggerIndex: number
  readonly isAnimating: boolean
}

const DEFAULT_ANIMATION_STATE: AnimationState = {
  phase: 'idle',
  previousLayout: null,
  staggerIndex: 0,
  isAnimating: false,
}

/**
 * Animation orchestration state for layout transitions.
 */
export const animationStateAtom = Atom.make<AnimationState>(DEFAULT_ANIMATION_STATE)

// =============================================================================
// FLOATING PANELS (Focus Mode)
// =============================================================================

export interface FloatingPanelPosition {
  readonly x: number
  readonly y: number
}

export interface FloatingPanelSize {
  readonly width: number
  readonly height: number
}

export interface FloatingPanelState {
  readonly id: string
  readonly visible: boolean
  readonly minimized: boolean
  readonly position: FloatingPanelPosition
  readonly size: FloatingPanelSize
  readonly zIndex: number
}

export type FloatingPanelId = 'layers' | 'entity' | 'timeline' | 'search'

export type FloatingPanelsRecord = Record<FloatingPanelId, FloatingPanelState>

const DEFAULT_FLOATING_PANELS: FloatingPanelsRecord = {
  layers: {
    id: 'layers',
    visible: true,
    minimized: false,
    position: { x: 16, y: 80 },
    size: { width: 200, height: 300 },
    zIndex: 1,
  },
  entity: {
    id: 'entity',
    visible: true,
    minimized: false,
    position: { x: -396, y: 80 }, // Negative = from right
    size: { width: 380, height: 400 },
    zIndex: 2,
  },
  timeline: {
    id: 'timeline',
    visible: true,
    minimized: false,
    position: { x: 32, y: -120 }, // Negative y = from bottom
    size: { width: 800, height: 80 },
    zIndex: 3,
  },
  search: {
    id: 'search',
    visible: false,
    minimized: false,
    position: { x: 0, y: 80 }, // Centered (handled by CSS)
    size: { width: 400, height: 48 },
    zIndex: 10,
  },
}

/**
 * Floating panels registry for Focus Mode.
 */
export const floatingPanelsAtom = Atom.make<FloatingPanelsRecord>(DEFAULT_FLOATING_PANELS)

/**
 * Currently focused/active floating panel.
 */
export const activePanelAtom = Atom.make<FloatingPanelId | null>(null)

/**
 * Maximum z-index tracker for floating panels.
 */
export const maxPanelZIndexAtom = Atom.make<number>(3)

// =============================================================================
// LAYOUT ACTIONS
// =============================================================================

/**
 * Set layout mode with animation.
 */
export const setLayoutMode = (mode: LayoutMode) => {
  const current = geointRegistry.get(layoutModeAtom)
  if (current === mode) return

  // Set animation state
  geointRegistry.set(animationStateAtom, {
    phase: 'transition',
    previousLayout: current,
    staggerIndex: 0,
    isAnimating: true,
  })

  // Set new layout
  geointRegistry.set(layoutModeAtom, mode)
}

/**
 * Complete animation transition.
 */
export const completeLayoutTransition = () => {
  geointRegistry.set(animationStateAtom, {
    phase: 'idle',
    previousLayout: null,
    staggerIndex: 0,
    isAnimating: false,
  })
}

/**
 * Toggle sidebar collapsed state.
 */
export const toggleSidebar = () => {
  const current = geointRegistry.get(sidebarStateAtom)
  geointRegistry.set(sidebarStateAtom, {
    ...current,
    collapsed: !current.collapsed,
  })
}

/**
 * Set sidebar section.
 */
export const setSidebarSection = (section: SidebarSection) => {
  const current = geointRegistry.get(sidebarStateAtom)
  geointRegistry.set(sidebarStateAtom, {
    ...current,
    activeSection: section,
    collapsed: false, // Expand when selecting section
  })
}

/**
 * Toggle intel panel collapsed state.
 */
export const toggleIntelPanel = () => {
  const current = geointRegistry.get(intelPanelStateAtom)
  geointRegistry.set(intelPanelStateAtom, {
    ...current,
    collapsed: !current.collapsed,
  })
}

/**
 * Set intel panel tab.
 */
export const setIntelTab = (tab: IntelTab) => {
  const current = geointRegistry.get(intelPanelStateAtom)
  geointRegistry.set(intelPanelStateAtom, {
    ...current,
    activeTab: tab,
    collapsed: false, // Expand when selecting tab
  })
}

/**
 * Toggle timeline collapsed state.
 */
export const toggleTimeline = () => {
  const current = geointRegistry.get(timelineStateAtom)
  geointRegistry.set(timelineStateAtom, {
    ...current,
    collapsed: !current.collapsed,
  })
}

/**
 * Set timeline range.
 */
export const setTimelineRange = (range: TimelineRange) => {
  const current = geointRegistry.get(timelineStateAtom)
  geointRegistry.set(timelineStateAtom, {
    ...current,
    range,
  })
}

/**
 * Update floating panel position.
 */
export const updateFloatingPanelPosition = (id: FloatingPanelId, position: FloatingPanelPosition) => {
  const panels = geointRegistry.get(floatingPanelsAtom)
  const panel = panels[id]
  if (!panel) return

  geointRegistry.set(floatingPanelsAtom, {
    ...panels,
    [id]: { ...panel, position },
  })
}

/**
 * Update floating panel size.
 */
export const updateFloatingPanelSize = (id: FloatingPanelId, size: Partial<FloatingPanelSize>) => {
  const panels = geointRegistry.get(floatingPanelsAtom)
  const panel = panels[id]
  if (!panel) return

  geointRegistry.set(floatingPanelsAtom, {
    ...panels,
    [id]: { ...panel, size: { ...panel.size, ...size } },
  })
}

/**
 * Bring floating panel to front.
 */
export const bringPanelToFront = (id: FloatingPanelId) => {
  const panels = geointRegistry.get(floatingPanelsAtom)
  const panel = panels[id]
  if (!panel) return

  const maxZ = geointRegistry.get(maxPanelZIndexAtom) + 1
  geointRegistry.set(maxPanelZIndexAtom, maxZ)

  geointRegistry.set(floatingPanelsAtom, {
    ...panels,
    [id]: { ...panel, zIndex: maxZ },
  })
  geointRegistry.set(activePanelAtom, id)
}

/**
 * Toggle floating panel visibility.
 */
export const toggleFloatingPanel = (id: FloatingPanelId) => {
  const panels = geointRegistry.get(floatingPanelsAtom)
  const panel = panels[id]
  if (!panel) return

  geointRegistry.set(floatingPanelsAtom, {
    ...panels,
    [id]: { ...panel, visible: !panel.visible },
  })
}

/**
 * Minimize/restore floating panel.
 */
export const toggleFloatingPanelMinimize = (id: FloatingPanelId) => {
  const panels = geointRegistry.get(floatingPanelsAtom)
  const panel = panels[id]
  if (!panel) return

  geointRegistry.set(floatingPanelsAtom, {
    ...panels,
    [id]: { ...panel, minimized: !panel.minimized },
  })
}
