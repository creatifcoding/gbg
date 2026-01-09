/**
 * GeointDashboard - Main Dashboard Layout System
 *
 * Orchestrates the GEOINT interface with three layout variants:
 * - Command Center: Three-column layout for full operator workflow
 * - Focus Mode: Map-centric with floating panels
 * - Dashboard Grid: Multi-pane analytics view
 *
 * Features:
 * - XState machine for complex state management
 * - effect-atom for reactive state
 * - CSS Grid layout system
 * - anime.js transitions between layouts
 * - Compound component architecture
 *
 * @module geoint/components/GeointDashboard
 */

import {
  FC,
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  createContext,
  useContext,
  type ReactNode,
} from 'react'
import { useActor } from '@xstate/react'
import { useAtomValue } from '@effect-atom/atom-react'
import { Atom } from '@effect-atom/atom'
import { animate } from 'animejs'
import {
  PanelLeft,
  PanelRight,
  Maximize2,
  Grid3X3,
  Layers,
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { dashboardMachine } from '../machines/dashboardMachine'
import { GeointMap, type GeointMapProps, createGeointInstanceAtoms, disposeGeointInstanceAtoms } from './GeointMap'
import { SearchPanel, type SearchPanelProps } from './SearchPanel'
import { EntityPanelContent, openEntityPanel } from './EntityPanel'
import { RadialCommandDial, useRadialDial, useCtrlClickDial } from './RadialCommandDial'
import { VirtualizedSearchResults } from './VirtualizedSearchResults'
import {
  resultsAtom,
  selectedResultAtom,
} from '../atoms'
import { searchResultToEntity } from '../cards/registry'
import { TIMING, EASING } from '../tokens'
import type { SearchResultItem, BBox, IntelSource } from '../schemas'

// =============================================================================
// TYPES
// =============================================================================

export type LayoutMode = 'command' | 'focus' | 'grid'

export interface GeointDashboardProps {
  /** Initial layout mode */
  initialLayout?: LayoutMode
  /** Instance ID for multi-instance support */
  instanceId?: string
  /** Map props */
  mapProps?: Partial<GeointMapProps>
  /** Search panel props */
  searchProps?: Partial<SearchPanelProps>
  /** Header content slot */
  headerSlot?: ReactNode
  /** Additional CSS classes */
  className?: string
  /** Enable keyboard shortcuts */
  enableShortcuts?: boolean
}

export interface DashboardContextValue {
  layoutMode: LayoutMode
  setLayoutMode: (mode: LayoutMode) => void
  searchPanelOpen: boolean
  toggleSearchPanel: () => void
  entityPanelOpen: boolean
  toggleEntityPanel: () => void
  layerPaletteOpen: boolean
  toggleLayerPalette: () => void
  isCompact: boolean
  toggleCompact: () => void
}

// =============================================================================
// CONTEXT
// =============================================================================

const DashboardContext = createContext<DashboardContextValue | null>(null)

export const useDashboardContext = () => {
  const ctx = useContext(DashboardContext)
  if (!ctx) throw new Error('useDashboardContext must be used within GeointDashboard')
  return ctx
}

// =============================================================================
// ATOMS
// =============================================================================

export const dashboardLayoutAtom = Atom.make<LayoutMode>('command')
export const searchPanelOpenAtom = Atom.make(true)
export const entityPanelOpenAtom = Atom.make(true)
export const layerPaletteOpenAtom = Atom.make(false)
export const compactModeAtom = Atom.make(false)

// =============================================================================
// LAYOUT BUTTON
// =============================================================================

interface LayoutButtonProps {
  mode: LayoutMode
  currentMode: LayoutMode
  onClick: (mode: LayoutMode) => void
  icon: typeof Grid3X3
  label: string
}

const LayoutButton: FC<LayoutButtonProps> = memo(function LayoutButton({
  mode,
  currentMode,
  onClick,
  icon: Icon,
  label,
}) {
  return (
    <button
      onClick={() => onClick(mode)}
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
        mode === currentMode
          ? 'bg-accent-primary/20 text-accent-primary'
          : 'text-text-tertiary hover:bg-surface-3 hover:text-text-secondary'
      )}
      title={label}
    >
      <Icon className="h-4 w-4" />
      <span className="hidden md:inline">{label}</span>
    </button>
  )
})

// =============================================================================
// HEADER
// =============================================================================

interface DashboardHeaderProps {
  layoutMode: LayoutMode
  onLayoutChange: (mode: LayoutMode) => void
  onToggleSearch: () => void
  onToggleEntity: () => void
  onToggleLayers: () => void
  searchOpen: boolean
  entityOpen: boolean
  layersOpen: boolean
  headerSlot?: ReactNode
}

const DashboardHeader: FC<DashboardHeaderProps> = memo(function DashboardHeader({
  layoutMode,
  onLayoutChange,
  onToggleSearch,
  onToggleEntity,
  onToggleLayers,
  searchOpen,
  entityOpen,
  layersOpen,
  headerSlot,
}) {
  return (
    <header className="flex items-center justify-between px-4 py-2 bg-surface-1 border-b border-border-subtle">
      {/* Left: Brand + Layout buttons */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-text-primary font-semibold">
          <Layers className="h-5 w-5 text-accent-primary" />
          <span className="hidden sm:inline">GEOINT COP</span>
        </div>

        <div className="flex items-center gap-1 p-1 bg-surface-2 rounded-lg">
          <LayoutButton
            mode="command"
            currentMode={layoutMode}
            onClick={onLayoutChange}
            icon={PanelLeft}
            label="Command"
          />
          <LayoutButton
            mode="focus"
            currentMode={layoutMode}
            onClick={onLayoutChange}
            icon={Maximize2}
            label="Focus"
          />
          <LayoutButton
            mode="grid"
            currentMode={layoutMode}
            onClick={onLayoutChange}
            icon={Grid3X3}
            label="Grid"
          />
        </div>
      </div>

      {/* Center: Custom slot */}
      {headerSlot && (
        <div className="flex-1 flex justify-center px-4">
          {headerSlot}
        </div>
      )}

      {/* Right: Panel toggles */}
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleSearch}
          className={cn(
            'p-2 rounded-md transition-colors',
            searchOpen ? 'bg-accent-primary/20 text-accent-primary' : 'text-text-tertiary hover:bg-surface-3'
          )}
          title="Toggle search panel"
        >
          <PanelLeft className="h-4 w-4" />
        </button>
        <button
          onClick={onToggleEntity}
          className={cn(
            'p-2 rounded-md transition-colors',
            entityOpen ? 'bg-accent-primary/20 text-accent-primary' : 'text-text-tertiary hover:bg-surface-3'
          )}
          title="Toggle entity panel"
        >
          <PanelRight className="h-4 w-4" />
        </button>
        <button
          onClick={onToggleLayers}
          className={cn(
            'p-2 rounded-md transition-colors',
            layersOpen ? 'bg-accent-primary/20 text-accent-primary' : 'text-text-tertiary hover:bg-surface-3'
          )}
          title="Toggle layer palette"
        >
          <Layers className="h-4 w-4" />
        </button>
        <button className="p-2 rounded-md text-text-tertiary hover:bg-surface-3 transition-colors">
          <Settings className="h-4 w-4" />
        </button>
      </div>
    </header>
  )
})

// =============================================================================
// COMMAND CENTER LAYOUT
// =============================================================================

interface CommandLayoutProps {
  searchPanel: ReactNode
  mapPanel: ReactNode
  entityPanel: ReactNode
  searchOpen: boolean
  entityOpen: boolean
}

const CommandLayout: FC<CommandLayoutProps> = memo(function CommandLayout({
  searchPanel,
  mapPanel,
  entityPanel,
  searchOpen,
  entityOpen,
}) {
  const containerRef = useRef<HTMLDivElement>(null)

  return (
    <div
      ref={containerRef}
      className="flex-1 grid transition-all duration-300"
      style={{
        gridTemplateColumns: `${searchOpen ? '280px' : '0px'} 1fr ${entityOpen ? '320px' : '0px'}`,
      }}
    >
      {/* Search Panel */}
      <div
        className={cn(
          'overflow-hidden transition-all duration-300 border-r border-border-subtle bg-surface-0',
          !searchOpen && 'w-0 border-r-0'
        )}
      >
        {searchOpen && searchPanel}
      </div>

      {/* Map Panel */}
      <div className="relative min-w-0">
        {mapPanel}
      </div>

      {/* Entity Panel */}
      <div
        className={cn(
          'overflow-hidden transition-all duration-300 border-l border-border-subtle bg-surface-0',
          !entityOpen && 'w-0 border-l-0'
        )}
      >
        {entityOpen && entityPanel}
      </div>
    </div>
  )
})

// =============================================================================
// FOCUS MODE LAYOUT
// =============================================================================

interface FocusLayoutProps {
  mapPanel: ReactNode
  searchPanel: ReactNode
  searchOpen: boolean
  entityPanel: ReactNode
  entityOpen: boolean
}

const FocusLayout: FC<FocusLayoutProps> = memo(function FocusLayout({
  mapPanel,
  searchPanel,
  searchOpen,
  entityPanel,
  entityOpen,
}) {
  const searchRef = useRef<HTMLDivElement>(null)
  const entityRef = useRef<HTMLDivElement>(null)

  // Animate floating panels
  useEffect(() => {
    if (searchRef.current) {
      animate(searchRef.current, {
        translateX: searchOpen ? ['-100%', '0%'] : ['0%', '-100%'],
        opacity: searchOpen ? [0, 1] : [1, 0],
        duration: TIMING.normal,
        ease: EASING.anime.out,
      })
    }
  }, [searchOpen])

  useEffect(() => {
    if (entityRef.current) {
      animate(entityRef.current, {
        translateY: entityOpen ? ['100%', '0%'] : ['0%', '100%'],
        opacity: entityOpen ? [0, 1] : [1, 0],
        duration: TIMING.normal,
        ease: EASING.anime.out,
      })
    }
  }, [entityOpen])

  return (
    <div className="flex-1 relative">
      {/* Full-width map */}
      <div className="absolute inset-0">
        {mapPanel}
      </div>

      {/* Floating search panel */}
      <div
        ref={searchRef}
        className={cn(
          'absolute top-4 left-4 w-80 max-h-[calc(100%-2rem)] bg-surface-1/95 backdrop-blur-sm rounded-lg shadow-lg overflow-hidden',
          !searchOpen && 'pointer-events-none opacity-0'
        )}
      >
        {searchPanel}
      </div>

      {/* Floating entity panel (bottom drawer) */}
      <div
        ref={entityRef}
        className={cn(
          'absolute bottom-0 left-0 right-0 h-[40%] bg-surface-1/95 backdrop-blur-sm rounded-t-xl shadow-lg overflow-hidden',
          !entityOpen && 'pointer-events-none opacity-0'
        )}
      >
        <div className="flex justify-center py-2 border-b border-border-subtle">
          <div className="w-12 h-1 bg-surface-3 rounded-full" />
        </div>
        {entityPanel}
      </div>
    </div>
  )
})

// =============================================================================
// GRID LAYOUT
// =============================================================================

interface GridLayoutProps {
  mapPanel: ReactNode
  searchPanel: ReactNode
  resultsPanel: ReactNode
  statsWidget: ReactNode
  timelineWidget: ReactNode
}

const GridLayout: FC<GridLayoutProps> = memo(function GridLayout({
  mapPanel,
  searchPanel,
  resultsPanel,
  statsWidget,
  timelineWidget,
}) {
  return (
    <div
      className="flex-1 grid gap-2 p-2 bg-surface-0"
      style={{
        gridTemplateColumns: '2fr 1fr',
        gridTemplateRows: '1fr auto',
      }}
    >
      {/* Primary Map */}
      <div className="row-span-1 rounded-lg overflow-hidden border border-border-subtle">
        {mapPanel}
      </div>

      {/* Results Panel */}
      <div className="row-span-2 flex flex-col rounded-lg overflow-hidden border border-border-subtle bg-surface-1">
        <div className="p-3 border-b border-border-subtle">
          {searchPanel}
        </div>
        <div className="flex-1 overflow-hidden">
          {resultsPanel}
        </div>
      </div>

      {/* Bottom widgets */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-border-subtle bg-surface-1 p-3">
          {statsWidget}
        </div>
        <div className="rounded-lg border border-border-subtle bg-surface-1 p-3">
          {timelineWidget}
        </div>
      </div>
    </div>
  )
})

// =============================================================================
// STATS WIDGET
// =============================================================================

const StatsWidget: FC = memo(function StatsWidget() {
  const results = useAtomValue(resultsAtom)

  const stats = {
    tracks: results.filter((r: SearchResultItem) => r.source === 'track').length,
    pois: results.filter((r: SearchResultItem) => r.source === 'osm').length,
    flights: results.filter((r: SearchResultItem) => r.source === 'opensky' || r.source === 'adsb_lol').length,
    features: results.filter((r: SearchResultItem) => r.source === 'feature').length,
  }

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-text-secondary">Statistics</div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="flex justify-between">
          <span className="text-text-tertiary">Tracks</span>
          <span className="font-mono text-text-primary">{stats.tracks}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-tertiary">POIs</span>
          <span className="font-mono text-text-primary">{stats.pois}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-tertiary">Flights</span>
          <span className="font-mono text-text-primary">{stats.flights}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-tertiary">Features</span>
          <span className="font-mono text-text-primary">{stats.features}</span>
        </div>
      </div>
    </div>
  )
})

// =============================================================================
// TIMELINE WIDGET
// =============================================================================

const TimelineWidget: FC = memo(function TimelineWidget() {
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-text-secondary">Timeline</div>
      <div className="flex items-end gap-[2px] h-8">
        {Array.from({ length: 24 }, (_, i) => {
          const height = Math.random() * 100
          return (
            <div
              key={i}
              className="flex-1 bg-accent-primary/40 rounded-t-sm transition-all hover:bg-accent-primary"
              style={{ height: `${Math.max(10, height)}%` }}
            />
          )
        })}
      </div>
      <div className="flex justify-between text-[10px] text-text-quaternary">
        <span>00:00</span>
        <span>12:00</span>
        <span>23:59</span>
      </div>
    </div>
  )
})

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const GeointDashboard: FC<GeointDashboardProps> = memo(function GeointDashboard({
  initialLayout = 'command',
  instanceId = 'dashboard-default',
  mapProps,
  searchProps,
  headerSlot,
  className,
  enableShortcuts = true,
}) {
  // XState actor
  const [_state, send] = useActor(dashboardMachine)

  // Local UI state
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(initialLayout)
  const [searchOpen, setSearchOpen] = useState(true)
  const [entityOpen, setEntityOpen] = useState(true)
  const [layersOpen, setLayersOpen] = useState(false)
  const [isCompact, setIsCompact] = useState(false)

  // Radial dial
  const dial = useRadialDial()

  // Atom values
  const results = useAtomValue(resultsAtom)
  const selectedResult = useAtomValue(selectedResultAtom)

  // Container ref for animations
  const containerRef = useRef<HTMLDivElement>(null)

  // Initialize geoint instance atoms
  useEffect(() => {
    createGeointInstanceAtoms(instanceId)
    return () => {
      disposeGeointInstanceAtoms(instanceId)
    }
  }, [instanceId])

  // Layout change handler with animation
  const handleLayoutChange = useCallback((mode: LayoutMode) => {
    if (containerRef.current) {
      animate(containerRef.current, {
        opacity: [1, 0.8, 1],
        duration: TIMING.normal,
        ease: EASING.anime.inOut,
      })
    }
    setLayoutMode(mode)
    send({ type: 'SET_LAYOUT', layout: mode })
  }, [send])

  // Keyboard shortcuts
  useEffect(() => {
    if (!enableShortcuts) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Mod+1/2/3 for layouts
      if ((e.metaKey || e.ctrlKey) && ['1', '2', '3'].includes(e.key)) {
        e.preventDefault()
        const modes: LayoutMode[] = ['command', 'focus', 'grid']
        handleLayoutChange(modes[parseInt(e.key) - 1])
        return
      }

      // Mod+B toggle search
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault()
        setSearchOpen(p => !p)
        return
      }

      // Mod+E toggle entity
      if ((e.metaKey || e.ctrlKey) && e.key === 'e') {
        e.preventDefault()
        setEntityOpen(p => !p)
        return
      }

      // Mod+L toggle layers
      if ((e.metaKey || e.ctrlKey) && e.key === 'l') {
        e.preventDefault()
        setLayersOpen(p => !p)
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enableShortcuts, handleLayoutChange])

  // Ctrl+Click handler for radial dial
  const getEntityAtPosition = useCallback((_x: number, _y: number) => {
    // This would use deck.gl picking in real implementation
    if (selectedResult) {
      return searchResultToEntity(selectedResult)
    }
    return null
  }, [selectedResult])

  useCtrlClickDial(dial, getEntityAtPosition)

  // Search handler
  const handleSearch = useCallback((_bounds: BBox, _sources: IntelSource[]) => {
    // Viewport bounds and sources are managed via atoms, machine just triggers search
    send({ type: 'SEARCH' })
  }, [send])

  // Result selection
  const handleResultSelect = useCallback((result: SearchResultItem) => {
    send({ type: 'SELECT', entityId: result.id })
  }, [send])

  // Context value
  const contextValue: DashboardContextValue = {
    layoutMode,
    setLayoutMode: handleLayoutChange,
    searchPanelOpen: searchOpen,
    toggleSearchPanel: () => setSearchOpen(p => !p),
    entityPanelOpen: entityOpen,
    toggleEntityPanel: () => setEntityOpen(p => !p),
    layerPaletteOpen: layersOpen,
    toggleLayerPalette: () => setLayersOpen(p => !p),
    isCompact,
    toggleCompact: () => setIsCompact(p => !p),
  }

  // Panels
  const mapPanel = (
    <GeointMap
      instanceId={instanceId}
      {...mapProps}
    />
  )

  const searchPanelContent = (
    <SearchPanel
      instanceId={instanceId}
      onSearch={handleSearch}
      onResultSelect={handleResultSelect}
      {...searchProps}
    />
  )

  const entityPanelContent = (
    <EntityPanelContent panelId={`entity-${instanceId}`} />
  )

  const resultsPanelContent = (
    <VirtualizedSearchResults
      results={results}
      selectedId={selectedResult?.id}
      onSelect={handleResultSelect}
      onActivate={(r) => openEntityPanel([searchResultToEntity(r)])}
      animateEnter
      staggerDelay={30}
    />
  )

  return (
    <DashboardContext.Provider value={contextValue}>
      <div
        ref={containerRef}
        className={cn(
          'flex flex-col h-full bg-surface-0 overflow-hidden',
          className
        )}
      >
        {/* Header */}
        <DashboardHeader
          layoutMode={layoutMode}
          onLayoutChange={handleLayoutChange}
          onToggleSearch={() => setSearchOpen(p => !p)}
          onToggleEntity={() => setEntityOpen(p => !p)}
          onToggleLayers={() => setLayersOpen(p => !p)}
          searchOpen={searchOpen}
          entityOpen={entityOpen}
          layersOpen={layersOpen}
          headerSlot={headerSlot}
        />

        {/* Main Content */}
        {layoutMode === 'command' && (
          <CommandLayout
            searchPanel={searchPanelContent}
            mapPanel={mapPanel}
            entityPanel={entityPanelContent}
            searchOpen={searchOpen}
            entityOpen={entityOpen}
          />
        )}

        {layoutMode === 'focus' && (
          <FocusLayout
            mapPanel={mapPanel}
            searchPanel={searchPanelContent}
            searchOpen={searchOpen}
            entityPanel={entityPanelContent}
            entityOpen={entityOpen}
          />
        )}

        {layoutMode === 'grid' && (
          <GridLayout
            mapPanel={mapPanel}
            searchPanel={searchPanelContent}
            resultsPanel={resultsPanelContent}
            statsWidget={<StatsWidget />}
            timelineWidget={<TimelineWidget />}
          />
        )}

        {/* Layer Palette (floating) */}
        {layersOpen && (
          <div className="absolute bottom-4 left-4 z-30 bg-surface-1 border border-border-subtle rounded-lg p-2 shadow-lg">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-medium text-text-secondary">Layers</span>
              <button
                onClick={() => setLayersOpen(false)}
                className="text-text-tertiary hover:text-text-secondary"
              >
                ×
              </button>
            </div>
            {/* LayerPalette will be connected to atom state */}
            <div className="text-xs text-text-tertiary">Layer controls</div>
          </div>
        )}

        {/* Radial Command Dial */}
        <RadialCommandDial
          entity={dial.entity}
          position={dial.position}
          isOpen={dial.isOpen}
          onClose={dial.close}
        />
      </div>
    </DashboardContext.Provider>
  )
})

// =============================================================================
// COMPOUND EXPORTS
// =============================================================================

export const Dashboard = Object.assign(GeointDashboard, {
  Header: DashboardHeader,
  CommandLayout,
  FocusLayout,
  GridLayout,
  StatsWidget,
  TimelineWidget,
  LayoutButton,
})

export default GeointDashboard
