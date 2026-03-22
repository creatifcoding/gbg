/**
 * GeointShell Compound Component
 *
 * Root layout orchestrator for GEOINT dashboard with three variants:
 * - Command: 3-column command center (sidebar, map, intel panel)
 * - Focus: Full-screen map with floating panels
 * - Analytics: Grid-based analytics dashboard
 *
 * Uses XState layoutMachine for state management and anime.js for transitions.
 *
 * @example
 * ```tsx
 * <GeointShell layout="command" onLayoutChange={setLayout}>
 *   <GeointShell.Header>
 *     <GlobalSearch />
 *   </GeointShell.Header>
 *   <GeointShell.Sidebar>
 *     <SearchPanel />
 *     <LayerPalette />
 *   </GeointShell.Sidebar>
 *   <GeointShell.Map>
 *     <GeointMap />
 *   </GeointShell.Map>
 *   <GeointShell.Intel>
 *     <EntityCard />
 *   </GeointShell.Intel>
 *   <GeointShell.Timeline>
 *     <TimelinePanel />
 *   </GeointShell.Timeline>
 * </GeointShell>
 * ```
 *
 * @module geoint/components/GeointShell
 */

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useMemo,
  memo,
  type FC,
  type ReactNode,
  type CSSProperties,
} from 'react'
import { useMachine } from '@xstate/react'
import { cn } from '@/lib/utils'
import {
  layoutMachine,
  type LayoutContext,
  type LayoutEvent,
  type LayoutMachineRef,
  type FloatingPanelConfig,
} from '../machines/layoutMachine'
import {
  type LayoutMode,
  type SidebarSection,
  type IntelTab,
  type TimelineRange,
  type FloatingPanelId,
  type FloatingPanelPosition,
  type FloatingPanelSize,
} from '../atoms/layoutAtoms'
import {
  PANEL_DIMENSIONS,
  TIMING,
  EASING,
  Z_INDEX,
  SHADOW,
} from '../tokens'
import { GeointRegistryProvider } from '../kori'
import { KoriBridgeProvider } from '../hooks'

// =============================================================================
// CONTEXT
// =============================================================================

interface GeointShellContextValue {
  /** Current layout mode */
  readonly layout: LayoutMode
  /** XState actor reference */
  readonly actorRef: LayoutMachineRef
  /** Send event to state machine */
  readonly send: (event: LayoutEvent) => void
  /** Current context from machine */
  readonly context: LayoutContext
  /** State matching helpers */
  readonly matches: {
    command: boolean
    focus: boolean
    analytics: boolean
    transitioning: boolean
  }
  /** Panel state helpers */
  readonly panels: {
    sidebar: {
      collapsed: boolean
      section: SidebarSection
      toggle: () => void
      setSection: (section: SidebarSection) => void
    }
    intel: {
      collapsed: boolean
      tab: IntelTab
      toggle: () => void
      setTab: (tab: IntelTab) => void
    }
    timeline: {
      collapsed: boolean
      range: TimelineRange
      toggle: () => void
      setRange: (range: TimelineRange) => void
    }
  }
  /** Floating panel helpers (Focus mode) */
  readonly floating: {
    panels: Record<FloatingPanelId, FloatingPanelConfig>
    move: (id: FloatingPanelId, position: FloatingPanelPosition) => void
    resize: (id: FloatingPanelId, size: Partial<FloatingPanelSize>) => void
    toggleVisibility: (id: FloatingPanelId) => void
    toggleMinimize: (id: FloatingPanelId) => void
    bringToFront: (id: FloatingPanelId) => void
  }
  /** Layout switching */
  readonly setLayout: (layout: LayoutMode) => void
  readonly toggleLayout: () => void
  /** Animation state */
  readonly isAnimating: boolean
}

const GeointShellContext = createContext<GeointShellContextValue | null>(null)

/**
 * Hook to access shell context.
 */
export function useGeointShell(): GeointShellContextValue {
  const ctx = useContext(GeointShellContext)
  if (!ctx) {
    throw new Error('useGeointShell must be used within GeointShell')
  }
  return ctx
}

// =============================================================================
// ROOT COMPONENT
// =============================================================================

export interface GeointShellProps {
  readonly children: ReactNode
  /** Initial layout mode */
  readonly layout?: LayoutMode
  /** Callback when layout changes */
  readonly onLayoutChange?: (layout: LayoutMode) => void
  /** Custom class name */
  readonly className?: string
}

/**
 * GeointShell Root - Layout orchestrator container.
 */
const Root: FC<GeointShellProps> = memo(({
  children,
  layout: initialLayout,
  onLayoutChange,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const initialLayoutSent = useRef(false)

  const [snapshot, send, actorRef] = useMachine(layoutMachine)

  // Set initial layout from prop if provided and different from persisted
  useEffect(() => {
    if (initialLayout && !initialLayoutSent.current) {
      const currentLayout = snapshot.context.currentLayout
      if (initialLayout !== currentLayout) {
        send({ type: 'SET_LAYOUT', layout: initialLayout })
      }
      initialLayoutSent.current = true
    }
  }, [initialLayout, snapshot.context.currentLayout, send])

  // Notify parent of layout changes
  useEffect(() => {
    if (onLayoutChange && snapshot.context.currentLayout) {
      onLayoutChange(snapshot.context.currentLayout)
    }
  }, [snapshot.context.currentLayout, onLayoutChange])

  // Keyboard shortcut handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        const key = e.key.toLowerCase()
        // Layout shortcuts: Meta+1/2/3
        if (['1', '2', '3', 'b', 'e', 't'].includes(key)) {
          e.preventDefault()
          send({
            type: 'KEYBOARD_SHORTCUT',
            key,
            modifiers: { meta: e.metaKey, ctrl: e.ctrlKey, shift: e.shiftKey },
          })
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [send])

  // Build context value
  const contextValue = useMemo<GeointShellContextValue>(() => {
    const ctx = snapshot.context

    return {
      layout: ctx.currentLayout,
      actorRef,
      send,
      context: ctx,
      matches: {
        command: snapshot.matches('command'),
        focus: snapshot.matches('focus'),
        analytics: snapshot.matches('analytics'),
        transitioning: snapshot.matches('transitioning'),
      },
      panels: {
        sidebar: {
          collapsed: ctx.panels.sidebar.collapsed,
          section: ctx.panels.sidebar.section,
          toggle: () => send({ type: 'TOGGLE_SIDEBAR' }),
          setSection: (section) => send({ type: 'SET_SIDEBAR_SECTION', section }),
        },
        intel: {
          collapsed: ctx.panels.intel.collapsed,
          tab: ctx.panels.intel.tab,
          toggle: () => send({ type: 'TOGGLE_INTEL' }),
          setTab: (tab) => send({ type: 'SET_INTEL_TAB', tab }),
        },
        timeline: {
          collapsed: ctx.panels.timeline.collapsed,
          range: ctx.panels.timeline.range,
          toggle: () => send({ type: 'TOGGLE_TIMELINE' }),
          setRange: (range) => send({ type: 'SET_TIMELINE_RANGE', range }),
        },
      },
      floating: {
        panels: ctx.floatingPanels,
        move: (id, position) => send({ type: 'MOVE_PANEL', id, position }),
        resize: (id, size) => send({ type: 'RESIZE_PANEL', id, size }),
        toggleVisibility: (id) => send({ type: 'TOGGLE_PANEL_VISIBILITY', id }),
        toggleMinimize: (id) => send({ type: 'TOGGLE_PANEL_MINIMIZE', id }),
        bringToFront: (id) => send({ type: 'BRING_PANEL_TO_FRONT', id }),
      },
      setLayout: (layout) => send({ type: 'SET_LAYOUT', layout }),
      toggleLayout: () => send({ type: 'TOGGLE_LAYOUT' }),
      isAnimating: ctx.isAnimating,
    }
  }, [snapshot, actorRef, send])

  // Layout-specific grid styles
  // Uses CSS custom properties for responsive panel dimensions (see globals.css)
  const gridStyles = useMemo<CSSProperties>(() => {
    const layout = snapshot.context.currentLayout
    const { sidebar, intel, timeline } = snapshot.context.panels

    if (layout === 'command') {
      // When collapsed via user interaction, use collapsed size
      // Otherwise, use CSS variable (responsive to container width)
      const sidebarWidth = sidebar.collapsed
        ? `${PANEL_DIMENSIONS.sidebar.collapsed}px`
        : 'var(--geoint-sidebar-width, 320px)'
      const intelWidth = intel.collapsed
        ? `${PANEL_DIMENSIONS.intelPanel.collapsed}px`
        : 'var(--geoint-intel-width, 380px)'
      const timelineHeight = timeline.collapsed
        ? `${PANEL_DIMENSIONS.drawer.collapsed}px`
        : 'var(--geoint-timeline-height, 300px)'

      return {
        display: 'grid',
        gridTemplateColumns: `${sidebarWidth} 1fr ${intelWidth}`,
        gridTemplateRows: `auto 1fr ${timelineHeight}`,
        gridTemplateAreas: `
          "header header header"
          "sidebar map intel"
          "timeline timeline timeline"
        `,
        height: '100%',
        overflow: 'hidden',
        transition: `grid-template-columns ${TIMING.panel}ms ${EASING.out}, grid-template-rows ${TIMING.panel}ms ${EASING.out}`,
      }
    }

    if (layout === 'focus') {
      // Use drawer.expanded as minimum height anchor (matches timeline height in command mode)
      const minMapHeight = PANEL_DIMENSIONS.drawer.expanded // 500px
      return {
        display: 'grid',
        gridTemplateColumns: '1fr',
        gridTemplateRows: `auto minmax(${minMapHeight}px, 1fr)`,
        gridTemplateAreas: `
          "header"
          "map"
        `,
        height: '100%',
        overflow: 'hidden',
      }
    }

    // Analytics layout
    return {
      display: 'grid',
      gridTemplateColumns: '1fr',
      gridTemplateRows: 'auto 1fr 1fr',
      gridTemplateAreas: `
        "header"
        "top"
        "bottom"
      `,
      height: '100%',
      overflow: 'hidden',
      gap: '16px',
      padding: '16px',
    }
  }, [snapshot.context.currentLayout, snapshot.context.panels])

  return (
    <GeointRegistryProvider>
      <KoriBridgeProvider>
        <GeointShellContext.Provider value={contextValue}>
          <div
            ref={containerRef}
            className={cn(
              'bg-surface-base text-text-primary h-full min-h-0',
              snapshot.context.isAnimating && 'pointer-events-none',
              className
            )}
            style={gridStyles}
            data-geoint-shell
            data-layout={snapshot.context.currentLayout}
            data-animating={snapshot.context.isAnimating}
          >
            {children}
          </div>
        </GeointShellContext.Provider>
      </KoriBridgeProvider>
    </GeointRegistryProvider>
  )
})

Root.displayName = 'GeointShell'

// =============================================================================
// HEADER COMPONENT
// =============================================================================

export interface HeaderProps {
  readonly children: ReactNode
  readonly className?: string
}

/**
 * GeointShell.Header - Top navigation bar.
 */
const Header: FC<HeaderProps> = memo(({ children, className }) => {
  return (
    <header
      className={cn(
        'flex items-center gap-4 px-4 h-12',
        'bg-surface-elevated border-b border-border-subtle',
        'z-[100]',
        className
      )}
      style={{ gridArea: 'header' }}
    >
      {children}
    </header>
  )
})

Header.displayName = 'GeointShell.Header'

// =============================================================================
// SIDEBAR COMPONENT
// =============================================================================

export interface SidebarProps {
  readonly children: ReactNode
  readonly className?: string
}

/**
 * GeointShell.Sidebar - Left panel for search, layers, tools.
 * Hidden in Focus mode.
 */
const Sidebar: FC<SidebarProps> = memo(({ children, className }) => {
  const { layout, panels } = useGeointShell()
  const sidebarRef = useRef<HTMLDivElement>(null)

  // Hidden in focus mode
  if (layout === 'focus') return null

  const { collapsed } = panels.sidebar

  return (
    <aside
      ref={sidebarRef}
      className={cn(
        'flex flex-col bg-surface-elevated border-r border-border-subtle',
        'overflow-hidden transition-all',
        collapsed && 'w-12',
        className
      )}
      style={{
        gridArea: 'sidebar',
        transitionDuration: `${TIMING.panel}ms`,
        transitionTimingFunction: EASING.out,
      }}
      data-slot="sidebar"
      data-collapsed={collapsed}
    >
      {!collapsed && (
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4">
          {children}
        </div>
      )}
      {collapsed && (
        <div className="flex flex-col items-center py-4 gap-2">
          {/* Collapsed sidebar icons rendered by children */}
        </div>
      )}
    </aside>
  )
})

Sidebar.displayName = 'GeointShell.Sidebar'

// =============================================================================
// MAP COMPONENT
// =============================================================================

export interface MapProps {
  readonly children: ReactNode
  readonly className?: string
}

/**
 * GeointShell.Map - Main map container.
 * Full-screen in Focus mode, centered in other modes.
 */
const MapSlot: FC<MapProps> = memo(({ children, className }) => {
  const { layout } = useGeointShell()

  return (
    <main
      className={cn(
        'relative overflow-hidden min-h-0',
        className
      )}
      style={{
        gridArea: layout === 'analytics' ? 'top' : 'map',
      }}
    >
      {children}

      {/* Floating panels overlay for Focus mode */}
      {layout === 'focus' && (
        <FloatingPanelsContainer>
          {/* Floating panels are managed via context */}
        </FloatingPanelsContainer>
      )}
    </main>
  )
})

MapSlot.displayName = 'GeointShell.Map'

// =============================================================================
// INTEL PANEL COMPONENT
// =============================================================================

export interface IntelProps {
  readonly children: ReactNode
  readonly className?: string
}

/**
 * GeointShell.Intel - Right panel for entity details, results, alerts.
 * Becomes floating in Focus mode.
 */
const Intel: FC<IntelProps> = memo(({ children, className }) => {
  const { layout, panels, floating } = useGeointShell()

  // In focus mode, render as floating panel
  if (layout === 'focus') {
    const panelConfig = floating.panels.entity
    if (!panelConfig.visible) return null

    return (
      <FloatingPanel
        id="entity"
        config={panelConfig}
        className={className}
      >
        {children}
      </FloatingPanel>
    )
  }

  const { collapsed } = panels.intel

  return (
    <aside
      className={cn(
        'flex flex-col bg-surface-elevated border-l border-border-subtle',
        'overflow-hidden transition-all',
        collapsed && 'w-12',
        className
      )}
      style={{
        gridArea: 'intel',
        transitionDuration: `${TIMING.panel}ms`,
        transitionTimingFunction: EASING.out,
      }}
      data-slot="intel"
      data-collapsed={collapsed}
    >
      {!collapsed && (
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4">
          {children}
        </div>
      )}
    </aside>
  )
})

Intel.displayName = 'GeointShell.Intel'

// =============================================================================
// TIMELINE COMPONENT
// =============================================================================

export interface TimelineProps {
  readonly children: ReactNode
  readonly className?: string
}

/**
 * GeointShell.Timeline - Bottom drawer for temporal controls.
 * Becomes floating in Focus mode.
 */
const Timeline: FC<TimelineProps> = memo(({ children, className }) => {
  const { layout, panels, floating } = useGeointShell()

  // In focus mode, render as floating panel
  if (layout === 'focus') {
    const panelConfig = floating.panels.timeline
    if (!panelConfig.visible) return null

    return (
      <FloatingPanel
        id="timeline"
        config={panelConfig}
        className={cn('rounded-lg', className)}
      >
        {children}
      </FloatingPanel>
    )
  }

  const { collapsed } = panels.timeline

  // Hidden in analytics mode
  if (layout === 'analytics') return null

  return (
    <div
      className={cn(
        'bg-surface-elevated border-t border-border-subtle',
        'overflow-hidden transition-all',
        className
      )}
      style={{
        gridArea: 'timeline',
        transitionDuration: `${TIMING.panel}ms`,
        transitionTimingFunction: EASING.out,
      }}
      data-slot="timeline"
      data-collapsed={collapsed}
    >
      {!collapsed && (
        <div className="h-full p-4">
          {children}
        </div>
      )}
      {collapsed && (
        <div className="h-12 flex items-center px-4">
          {/* Collapsed timeline bar */}
        </div>
      )}
    </div>
  )
})

Timeline.displayName = 'GeointShell.Timeline'

// =============================================================================
// ANALYTICS GRID COMPONENTS
// =============================================================================

export interface AnalyticsTopProps {
  readonly children: ReactNode
  readonly className?: string
}

/**
 * GeointShell.AnalyticsTop - Top row in analytics layout.
 */
const AnalyticsTop: FC<AnalyticsTopProps> = memo(({ children, className }) => {
  const { layout } = useGeointShell()

  if (layout !== 'analytics') return null

  return (
    <div
      className={cn(
        'grid grid-cols-[60%_40%] gap-4',
        className
      )}
      style={{ gridArea: 'top' }}
    >
      {children}
    </div>
  )
})

AnalyticsTop.displayName = 'GeointShell.AnalyticsTop'

export interface AnalyticsBottomProps {
  readonly children: ReactNode
  readonly className?: string
}

/**
 * GeointShell.AnalyticsBottom - Bottom row in analytics layout.
 */
const AnalyticsBottom: FC<AnalyticsBottomProps> = memo(({ children, className }) => {
  const { layout } = useGeointShell()

  if (layout !== 'analytics') return null

  return (
    <div
      className={cn(
        'grid grid-cols-[60%_40%] gap-4',
        className
      )}
      style={{ gridArea: 'bottom' }}
    >
      {children}
    </div>
  )
})

AnalyticsBottom.displayName = 'GeointShell.AnalyticsBottom'

// =============================================================================
// FLOATING PANEL SYSTEM
// =============================================================================

interface FloatingPanelsContainerProps {
  readonly children?: ReactNode
}

/**
 * Container for floating panels in Focus mode.
 */
const FloatingPanelsContainer: FC<FloatingPanelsContainerProps> = ({ children }) => {
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: Z_INDEX.floating }}
    >
      {children}
    </div>
  )
}

interface FloatingPanelProps {
  readonly id: FloatingPanelId
  readonly config: FloatingPanelConfig
  readonly children: ReactNode
  readonly className?: string
}

/**
 * Individual floating panel with drag/resize.
 */
const FloatingPanel: FC<FloatingPanelProps> = memo(({
  id,
  config,
  children,
  className,
}) => {
  const { floating } = useGeointShell()
  const panelRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const dragStart = useRef({ x: 0, y: 0 })

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) return // Only drag from header

    isDragging.current = true
    dragStart.current = {
      x: e.clientX - config.position.x,
      y: e.clientY - config.position.y,
    }

    floating.bringToFront(id)

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return
      floating.move(id, {
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y,
      })
    }

    const handleMouseUp = () => {
      isDragging.current = false
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }, [id, config.position, floating])

  if (config.minimized) {
    return (
      <button
        className={cn(
          'absolute pointer-events-auto',
          'w-10 h-10 rounded-full',
          'bg-surface-elevated border border-border-subtle',
          'flex items-center justify-center',
          'hover:bg-surface-highlight transition-colors',
          'shadow-md'
        )}
        style={{
          left: config.position.x >= 0 ? config.position.x : undefined,
          right: config.position.x < 0 ? Math.abs(config.position.x) : undefined,
          top: config.position.y >= 0 ? config.position.y : undefined,
          bottom: config.position.y < 0 ? Math.abs(config.position.y) : undefined,
          zIndex: config.zIndex,
        }}
        onClick={() => floating.toggleMinimize(id)}
      >
        {/* Minimized icon */}
      </button>
    )
  }

  return (
    <div
      ref={panelRef}
      className={cn(
        'absolute pointer-events-auto',
        'bg-surface-elevated rounded-lg border border-border-subtle',
        'shadow-lg overflow-hidden',
        'flex flex-col',
        className
      )}
      style={{
        left: config.position.x >= 0 ? config.position.x : undefined,
        right: config.position.x < 0 ? Math.abs(config.position.x) : undefined,
        top: config.position.y >= 0 ? config.position.y : undefined,
        bottom: config.position.y < 0 ? Math.abs(config.position.y) : undefined,
        width: config.size.width,
        height: config.size.height,
        zIndex: config.zIndex,
        boxShadow: SHADOW.floating,
      }}
    >
      {/* Drag handle header */}
      <div
        className="h-8 flex items-center justify-between px-2 bg-surface-highlight cursor-move border-b border-border-subtle"
        onMouseDown={handleMouseDown}
      >
        <span className="text-xs text-text-secondary font-medium uppercase">
          {id}
        </span>
        <div className="flex items-center gap-1">
          <button
            className="w-5 h-5 rounded hover:bg-surface-base transition-colors flex items-center justify-center"
            onClick={() => floating.toggleMinimize(id)}
          >
            <span className="text-text-secondary text-xs">—</span>
          </button>
          <button
            className="w-5 h-5 rounded hover:bg-surface-base transition-colors flex items-center justify-center"
            onClick={() => floating.toggleVisibility(id)}
          >
            <span className="text-text-secondary text-xs">×</span>
          </button>
        </div>
      </div>

      {/* Panel content */}
      <div className="flex-1 overflow-auto p-3">
        {children}
      </div>
    </div>
  )
})

FloatingPanel.displayName = 'FloatingPanel'

// =============================================================================
// COMPOUND EXPORT
// =============================================================================

/**
 * GeointShell compound component.
 *
 * @example
 * ```tsx
 * <GeointShell layout="command">
 *   <GeointShell.Header>...</GeointShell.Header>
 *   <GeointShell.Sidebar>...</GeointShell.Sidebar>
 *   <GeointShell.Map>...</GeointShell.Map>
 *   <GeointShell.Intel>...</GeointShell.Intel>
 *   <GeointShell.Timeline>...</GeointShell.Timeline>
 * </GeointShell>
 * ```
 */
export const GeointShell = Object.assign(Root, {
  Header,
  Sidebar,
  Map: MapSlot,
  Intel,
  Timeline,
  AnalyticsTop,
  AnalyticsBottom,
})

export default GeointShell
