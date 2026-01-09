/**
 * GEOINT Dashboard Testbed
 *
 * Demonstrates the three-variant layout system:
 * - Command Center (three-column)
 * - Focus Mode (floating panels)
 * - Dashboard Grid (multi-pane)
 *
 * Features:
 * - XState machine integration
 * - effect-atom reactive state
 * - anime.js animations
 * - Compound component architecture
 * - Keyboard shortcuts (Cmd+1/2/3, Cmd+B/E/L)
 *
 * @module testbed/GeointDashboardTestbed
 */

import { FC, useState, useCallback, useRef } from 'react'
import { Effect } from 'effect'
import {
  GeointDashboard,
  SearchPanelCompound,
  VirtualizedResultsList,
  CommandPalette,
  createGeointCommands,
  GeointKeyboardProvider,
  GEOINT_BINDINGS,
  GEOINT_CATEGORIES,
} from '@/lib/geoint/components'
import {
  AnimationOrchestratorTag,
  AnimationOrchestratorLive,
  flyToConfig,
  listStaggerConfig,
  panelExpandConfig,
  panelCollapseConfig,
} from '@/lib/geoint/animation'
import {
  SearchProvider,
  useSearch,
  useSearchProviderResults as useSearchResults,
  useSearchState,
  useResultSelection,
  useResultHover,
  useSelectedResultIds,
  useHoveredResultId,
  searchRegistry,
  searchResultsAtom,
} from '@/lib/geoint/machines'
import type { BBox, IntelSource, SearchResultItem } from '@/lib/geoint/schemas'
import { SOURCE_COLORS } from '@/lib/geoint/tokens'

// =============================================================================
// TESTBED COMPONENT
// =============================================================================

export const GeointDashboardTestbed: FC = () => {
  const [log, setLog] = useState<string[]>([])

  const addLog = useCallback((msg: string) => {
    setLog(prev => [...prev.slice(-19), `[${new Date().toLocaleTimeString()}] ${msg}`])
  }, [])

  const handleSearch = useCallback((bounds: BBox, sources: IntelSource[]) => {
    addLog(`Search: bounds=${JSON.stringify(bounds.map(n => n.toFixed(2)))}, sources=${sources.join(',')}`)
  }, [addLog])

  const handleResultSelect = useCallback((result: SearchResultItem) => {
    addLog(`Selected: ${result._tag} - ${result.id}`)
  }, [addLog])

  return (
    <div className="h-screen flex flex-col bg-surface-0">
      {/* Dashboard */}
      <div className="flex-1 min-h-0">
        <GeointDashboard
          initialLayout="command"
          instanceId="testbed"
          searchProps={{
            onSearch: handleSearch,
            onResultSelect: handleResultSelect,
          }}
          headerSlot={
            <div className="text-xs text-text-tertiary">
              Testbed Mode · Shortcuts: ⌘1/2/3 layouts, ⌘B/E/L panels
            </div>
          }
        />
      </div>

      {/* Debug Log */}
      <div className="h-32 border-t border-border-subtle bg-surface-1 overflow-auto p-2 font-mono text-xs">
        <div className="text-text-tertiary mb-1">Event Log:</div>
        {log.length === 0 ? (
          <div className="text-text-quaternary">No events yet. Try searching or selecting results.</div>
        ) : (
          log.map((entry, i) => (
            <div key={i} className="text-text-secondary">{entry}</div>
          ))
        )}
      </div>
    </div>
  )
}

// =============================================================================
// COMPOUND SEARCH DEMO
// =============================================================================

export const CompoundSearchDemo: FC = () => {
  const [viewportBounds] = useState<BBox>([-122.5, 37.7, -122.3, 37.9])

  const handleSearch = useCallback((bounds: BBox, sources: IntelSource[]) => {
    console.log('Search:', { bounds, sources })
  }, [])

  return (
    <div className="p-4 max-w-md mx-auto">
      <h2 className="text-lg font-semibold mb-4 text-text-primary">Compound SearchPanel Demo</h2>

      <SearchPanelCompound.Root
        viewportBounds={viewportBounds}
        onSearch={handleSearch}
        className="shadow-lg"
      >
        {/* Header with input and actions */}
        <div className="flex items-center gap-2 p-3 border-b border-border-subtle">
          <SearchPanelCompound.Input placeholder="Search ALLINT..." autoFocus />
          <SearchPanelCompound.Actions showFilterToggle showTimeToggle />
        </div>

        {/* Collapsible source filters */}
        <SearchPanelCompound.CollapsibleSection title="Source Filters" defaultOpen>
          <SearchPanelCompound.SourceToggles showCounts />
        </SearchPanelCompound.CollapsibleSection>

        {/* Collapsible time range */}
        <SearchPanelCompound.CollapsibleSection title="Time Range">
          <SearchPanelCompound.TimeRange />
        </SearchPanelCompound.CollapsibleSection>

        {/* Results */}
        <SearchPanelCompound.Results maxHeight={300} />

        {/* Status */}
        <SearchPanelCompound.StatusBar showViewport />
      </SearchPanelCompound.Root>
    </div>
  )
}

// =============================================================================
// LAYOUT VARIANTS SHOWCASE
// =============================================================================

export const LayoutShowcase: FC = () => {
  return (
    <div className="p-8 space-y-8 bg-surface-0 min-h-screen">
      <h1 className="text-2xl font-bold text-text-primary">GEOINT Dashboard Layouts</h1>

      {/* ASCII Diagrams */}
      <div className="grid grid-cols-3 gap-4">
        {/* Command Center */}
        <div className="p-4 bg-surface-1 rounded-lg border border-border-subtle">
          <h3 className="font-semibold text-text-primary mb-2">Command Center</h3>
          <pre className="text-[10px] font-mono text-text-tertiary whitespace-pre">
{`┌────────┬──────────┬────────┐
│ Search │   Map    │ Entity │
│ Panel  │ Viewport │ Panel  │
│ 280px  │  flex-1  │ 320px  │
└────────┴──────────┴────────┘`}
          </pre>
          <p className="text-xs text-text-tertiary mt-2">Three-column operator workflow</p>
        </div>

        {/* Focus Mode */}
        <div className="p-4 bg-surface-1 rounded-lg border border-border-subtle">
          <h3 className="font-semibold text-text-primary mb-2">Focus Mode</h3>
          <pre className="text-[10px] font-mono text-text-tertiary whitespace-pre">
{`┌────────────────────────────┐
│ ┌────────┐                 │
│ │ Float  │    Full-Width   │
│ │ Search │       Map       │
│ └────────┘                 │
│ ┌────────────────────────┐ │
│ │   Entity Drawer (40%)  │ │
│ └────────────────────────┘ │
└────────────────────────────┘`}
          </pre>
          <p className="text-xs text-text-tertiary mt-2">Map-centric with floating panels</p>
        </div>

        {/* Dashboard Grid */}
        <div className="p-4 bg-surface-1 rounded-lg border border-border-subtle">
          <h3 className="font-semibold text-text-primary mb-2">Dashboard Grid</h3>
          <pre className="text-[10px] font-mono text-text-tertiary whitespace-pre">
{`┌──────────────────┬─────────┐
│                  │ Search  │
│   Primary Map    │ Results │
│      (2/3)       │  (1/3)  │
├─────────┬────────┤         │
│  Stats  │Timeline│         │
└─────────┴────────┴─────────┘`}
          </pre>
          <p className="text-xs text-text-tertiary mt-2">Multi-pane analytics view</p>
        </div>
      </div>

      {/* Keyboard Shortcuts */}
      <div className="p-4 bg-surface-1 rounded-lg border border-border-subtle">
        <h3 className="font-semibold text-text-primary mb-2">Keyboard Shortcuts</h3>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex justify-between">
            <span className="text-text-tertiary">Command layout</span>
            <kbd className="px-2 py-0.5 bg-surface-2 rounded text-text-secondary">⌘1</kbd>
          </div>
          <div className="flex justify-between">
            <span className="text-text-tertiary">Focus layout</span>
            <kbd className="px-2 py-0.5 bg-surface-2 rounded text-text-secondary">⌘2</kbd>
          </div>
          <div className="flex justify-between">
            <span className="text-text-tertiary">Grid layout</span>
            <kbd className="px-2 py-0.5 bg-surface-2 rounded text-text-secondary">⌘3</kbd>
          </div>
          <div className="flex justify-between">
            <span className="text-text-tertiary">Toggle search</span>
            <kbd className="px-2 py-0.5 bg-surface-2 rounded text-text-secondary">⌘B</kbd>
          </div>
          <div className="flex justify-between">
            <span className="text-text-tertiary">Toggle entity</span>
            <kbd className="px-2 py-0.5 bg-surface-2 rounded text-text-secondary">⌘E</kbd>
          </div>
          <div className="flex justify-between">
            <span className="text-text-tertiary">Toggle layers</span>
            <kbd className="px-2 py-0.5 bg-surface-2 rounded text-text-secondary">⌘L</kbd>
          </div>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// MOCK DATA GENERATOR
// =============================================================================

const MOCK_NAMES = [
  'Alpha-1', 'Bravo-7', 'Charlie-3', 'Delta-9', 'Echo-2', 'Foxtrot-5',
  'Golf-8', 'Hotel-4', 'India-6', 'Juliet-1', 'Kilo-3', 'Lima-7',
  'Mike-2', 'November-9', 'Oscar-4', 'Papa-6', 'Quebec-8', 'Romeo-1',
  'Sierra-3', 'Tango-5', 'Uniform-7', 'Victor-2', 'Whiskey-9', 'X-ray-4',
]
const MOCK_TYPES = ['vessel', 'aircraft', 'vehicle', 'person'] as const
const MOCK_CATEGORIES = ['amenity', 'building', 'shop', 'tourism'] as const

/**
 * Generate mock search results for testing.
 * Uses type assertions since branded types require proper encoding.
 */
function generateMockResults(count: number): SearchResultItem[] {
  const results: unknown[] = []
  const baseTime = Date.now()

  for (let i = 0; i < count; i++) {
    const sourceIdx = i % 4
    const name = MOCK_NAMES[i % MOCK_NAMES.length]
    const lat = 37.7 + (Math.random() - 0.5) * 0.4
    const lon = -122.4 + (Math.random() - 0.5) * 0.4
    const position = [lon, lat] as const

    switch (sourceIdx) {
      case 0: // track
        results.push({
          _tag: 'SearchResultTrack',
          trackId: `track-${i}`,
          id: `track-${i}`,
          label: `${name} Track`,
          source: 'track',
          score: Math.max(0, 0.9 - (i * 0.005)),
          retrievedAt: new Date(baseTime - i * 60000),
          position: [lon, lat, 0] as const,
          objectType: MOCK_TYPES[i % MOCK_TYPES.length],
          classification: 'unknown',
          speed: Math.floor(Math.random() * 50),
          heading: Math.floor(Math.random() * 360),
        })
        break
      case 1: // osm
        results.push({
          _tag: 'SearchResultPoi',
          poiId: `poi-${i}`,
          id: `poi-${i}`,
          name: `${name} Location`,
          source: 'osm',
          score: Math.max(0, 0.85 - (i * 0.005)),
          retrievedAt: new Date(baseTime - i * 120000),
          position,
          category: MOCK_CATEGORIES[i % MOCK_CATEGORIES.length],
          tags: { name: `${name} Location` },
        })
        break
      case 2: // opensky
        results.push({
          _tag: 'SearchResultFlight',
          icao24: (0xa00000 + i).toString(16).padStart(6, '0'),
          id: `flight-${i}`,
          callsign: `${name.substring(0, 3).toUpperCase()}${100 + i}`,
          source: 'opensky',
          score: Math.max(0, 0.88 - (i * 0.005)),
          retrievedAt: new Date(baseTime - i * 30000),
          position: [lon, lat, 10000 + Math.random() * 30000] as const,
          velocity: 200 + Math.random() * 300,
          heading: Math.floor(Math.random() * 360),
          verticalRate: (Math.random() - 0.5) * 20,
          onGround: false,
          category: 'medium',
        })
        break
      case 3: // feature
        results.push({
          _tag: 'SearchResultFeature',
          featureId: `feature-${i}`,
          id: `feature-${i}`,
          name: `${name} Feature`,
          source: 'feature',
          score: Math.max(0, 0.82 - (i * 0.005)),
          retrievedAt: new Date(baseTime - i * 180000),
          position,
          geometry: { type: 'Point', coordinates: position },
          properties: { type: 'boundary' },
        })
        break
    }
  }

  return results as SearchResultItem[]
}

// =============================================================================
// VIRTUALIZED RESULTS DEMO
// =============================================================================

/**
 * Get display name from a search result item.
 */
function getResultName(result: SearchResultItem): string {
  switch (result._tag) {
    case 'SearchResultTrack':
      return result.label || `Track ${result.trackId}`
    case 'SearchResultPoi':
      return result.name
    case 'SearchResultFlight':
      return result.callsign || result.icao24
    case 'SearchResultFeature':
      return result.label || `Feature ${result.featureId}`
    case 'SearchResultWeather':
      return result.locationName || `Weather ${result.id}`
    case 'SearchResultImagery':
      return `Imagery ${result.itemId}`
  }
}

/**
 * Inner component using SearchProvider context
 */
const VirtualizedResultsInner: FC<{
  onLog: (msg: string) => void
}> = ({ onLog }) => {
  const results = useSearchResults()
  const selectedIds = useSelectedResultIds()
  const hoveredId = useHoveredResultId()
  const _searchState = useSearchState()
  const { toggle, clearSelection, selectAll } = useResultSelection()
  const setHovered = useResultHover()
  const { clear } = useSearch()

  // Populate mock data on mount
  const [initialized, setInitialized] = useState(false)
  if (!initialized) {
    const mockData = generateMockResults(100)
    searchRegistry.set(searchResultsAtom, mockData)
    setInitialized(true)
  }

  const handleSelectionChange = useCallback((ids: ReadonlySet<string>) => {
    onLog(`Selection changed: ${ids.size} items`)
  }, [onLog])

  const handleResultClick = useCallback((result: SearchResultItem) => {
    onLog(`Clicked: ${getResultName(result)}`)
    toggle(result.id)
  }, [onLog, toggle])

  const handleResultDoubleClick = useCallback((result: SearchResultItem) => {
    onLog(`Double-clicked: ${getResultName(result)} - Flying to...`)
  }, [onLog])

  const handleHoverChange = useCallback((id: string | null) => {
    setHovered(id)
  }, [setHovered])

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-3 border-b border-border-subtle bg-surface-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text-primary">
            Results ({results.length})
          </span>
          {selectedIds.length > 0 && (
            <span className="text-xs text-accent-primary">
              {selectedIds.length} selected
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => selectAll()}
            className="px-2 py-1 text-xs bg-surface-2 hover:bg-surface-3 rounded transition-colors text-text-secondary"
          >
            Select All
          </button>
          <button
            onClick={() => clearSelection()}
            className="px-2 py-1 text-xs bg-surface-2 hover:bg-surface-3 rounded transition-colors text-text-secondary"
          >
            Clear
          </button>
          <button
            onClick={() => {
              clear()
              searchRegistry.set(searchResultsAtom, [])
              onLog('Cleared all results')
            }}
            className="px-2 py-1 text-xs bg-status-error/20 hover:bg-status-error/30 rounded transition-colors text-status-error"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Virtualized List */}
      <div className="flex-1 min-h-0">
        <VirtualizedResultsList
          results={results}
          selectedIds={new Set(selectedIds)}
          height={500}
          onSelectionChange={handleSelectionChange}
          onResultClick={handleResultClick}
          onResultDoubleClick={handleResultDoubleClick}
          onHoverChange={handleHoverChange}
        >
          <VirtualizedResultsList.Header />
        </VirtualizedResultsList>
      </div>

      {/* Keyboard hints */}
      <div className="p-2 border-t border-border-subtle bg-surface-1">
        <div className="flex items-center justify-center gap-4 text-[10px] text-text-quaternary">
          <span><kbd className="px-1 bg-surface-2 rounded">j/k</kbd> Navigate</span>
          <span><kbd className="px-1 bg-surface-2 rounded">Enter</kbd> Select</span>
          <span><kbd className="px-1 bg-surface-2 rounded">Shift</kbd> Multi-select</span>
          <span><kbd className="px-1 bg-surface-2 rounded">Esc</kbd> Clear</span>
        </div>
      </div>
    </div>
  )
}

export const VirtualizedResultsDemo: FC = () => {
  const [log, setLog] = useState<string[]>([])

  const addLog = useCallback((msg: string) => {
    setLog(prev => [...prev.slice(-9), `[${new Date().toLocaleTimeString()}] ${msg}`])
  }, [])

  return (
    <div className="flex h-[700px] gap-4 p-4 bg-surface-0">
      {/* Results Panel */}
      <div className="w-[400px] flex flex-col bg-surface-1 border border-border-subtle rounded-lg overflow-hidden">
        <SearchProvider>
          <VirtualizedResultsInner onLog={addLog} />
        </SearchProvider>
      </div>

      {/* Info Panel */}
      <div className="flex-1 flex flex-col gap-4">
        {/* Architecture Diagram */}
        <div className="p-4 bg-surface-1 border border-border-subtle rounded-lg">
          <h3 className="text-sm font-semibold text-text-primary mb-3">Architecture</h3>
          <pre className="text-[10px] font-mono text-text-tertiary whitespace-pre leading-relaxed">
{`┌─────────────────────────────────────────────────────────┐
│                    SearchProvider                        │
│  ┌─────────────────────────────────────────────────────┐ │
│  │            XState searchMachine                     │ │
│  │  idle → debouncing → searching → results/error      │ │
│  └─────────────────────────────────────────────────────┘ │
│                          │                               │
│                          ▼                               │
│  ┌─────────────────────────────────────────────────────┐ │
│  │            effect-atom Registry                      │ │
│  │  searchResultsAtom ← streaming results               │ │
│  │  selectedIdsAtom   ← user selections                 │ │
│  │  sourceStatusAtom  ← per-source progress             │ │
│  └─────────────────────────────────────────────────────┘ │
│                          │                               │
│                          ▼                               │
│  ┌─────────────────────────────────────────────────────┐ │
│  │          VirtualizedResultsList                      │ │
│  │  @tanstack/react-virtual + anime.js                  │ │
│  │  • Windowed rendering (overscan: 5)                  │ │
│  │  • Stagger animations on mount/update                │ │
│  │  • Keyboard navigation (j/k/Enter/Esc)               │ │
│  │  • Multi-select with Shift+Click                     │ │
│  └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘`}
          </pre>
        </div>

        {/* Event Log */}
        <div className="flex-1 p-4 bg-surface-1 border border-border-subtle rounded-lg">
          <h3 className="text-sm font-semibold text-text-primary mb-2">Event Log</h3>
          <div className="font-mono text-xs space-y-1">
            {log.length === 0 ? (
              <div className="text-text-quaternary">Interact with the results to see events...</div>
            ) : (
              log.map((entry, i) => (
                <div key={i} className="text-text-secondary">{entry}</div>
              ))
            )}
          </div>
        </div>

        {/* Source Colors Legend */}
        <div className="p-4 bg-surface-1 border border-border-subtle rounded-lg">
          <h3 className="text-sm font-semibold text-text-primary mb-2">Source Colors</h3>
          <div className="grid grid-cols-4 gap-2">
            {Object.entries(SOURCE_COLORS).slice(0, 8).map(([source, colors]) => (
              <div key={source} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: colors.primary }}
                />
                <span className="text-xs text-text-secondary">{source}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// COMMAND PALETTE DEMO
// =============================================================================

/**
 * Demo showing the CommandPalette with GEOINT-specific commands.
 * Press Cmd+K (or Ctrl+K) to open.
 */
export const CommandPaletteDemo: FC = () => {
  const [log, setLog] = useState<string[]>([])
  const [layout, setLayout] = useState<'command' | 'focus' | 'grid'>('command')

  const addLog = useCallback((msg: string) => {
    setLog(prev => [...prev.slice(-9), `[${new Date().toLocaleTimeString()}] ${msg}`])
  }, [])

  // Create GEOINT commands with handlers
  const commands = createGeointCommands({
    onSearch: () => addLog('Executing search across all sources...'),
    onFlyTo: (location) => addLog(`Flying to: ${location}`),
    onToggleLayer: (layer) => addLog(`Toggling layer: ${layer}`),
    onExport: (format) => addLog(`Exporting as ${format}...`),
    onSetLayout: (newLayout) => {
      addLog(`Layout changed to: ${newLayout}`)
      setLayout(newLayout)
    },
  })

  return (
    <CommandPalette.Provider initialCommands={commands}>
      <div className="h-[600px] flex flex-col bg-surface-0 p-4 gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Command Palette Demo</h2>
            <p className="text-sm text-text-tertiary">Press ⌘K to open the command palette</p>
          </div>
          <CommandPalette.Trigger />
        </div>

        {/* Content */}
        <div className="flex-1 flex gap-4">
          {/* Layout Visualization */}
          <div className="flex-1 p-4 bg-surface-1 border border-border-subtle rounded-lg">
            <h3 className="text-sm font-semibold text-text-primary mb-3">
              Current Layout: <span className="text-accent-primary">{layout}</span>
            </h3>

            {/* ASCII Layout Preview */}
            <div className="p-4 bg-surface-2 rounded font-mono text-[10px] text-text-tertiary">
              {layout === 'command' && (
                <pre>{`┌────────┬──────────┬────────┐
│ Search │   Map    │ Entity │
│ Panel  │ Viewport │ Panel  │
│ 280px  │  flex-1  │ 320px  │
└────────┴──────────┴────────┘`}</pre>
              )}
              {layout === 'focus' && (
                <pre>{`┌────────────────────────────┐
│ ┌────────┐                 │
│ │ Float  │    Full-Width   │
│ │ Search │       Map       │
│ └────────┘                 │
│ ┌────────────────────────┐ │
│ │   Entity Drawer (40%)  │ │
│ └────────────────────────┘ │
└────────────────────────────┘`}</pre>
              )}
              {layout === 'grid' && (
                <pre>{`┌──────────────────┬─────────┐
│                  │ Search  │
│   Primary Map    │ Results │
│      (2/3)       │  (1/3)  │
├─────────┬────────┤         │
│  Stats  │Timeline│         │
└─────────┴────────┴─────────┘`}</pre>
              )}
            </div>

            {/* Architecture Diagram */}
            <div className="mt-4 p-4 bg-surface-2 rounded">
              <h4 className="text-xs font-semibold text-text-secondary mb-2">Architecture</h4>
              <pre className="text-[10px] font-mono text-text-quaternary leading-relaxed">{`┌─────────────────────────────────────────┐
│         CommandPalette.Provider          │
│  ┌─────────────────────────────────────┐ │
│  │      XState commandPaletteMachine   │ │
│  │      closed ⟷ open (query/select)   │ │
│  └─────────────────────────────────────┘ │
│                    │                     │
│                    ▼                     │
│  ┌─────────────────────────────────────┐ │
│  │      effect-atom Registry            │ │
│  │  paletteOpenAtom, paletteQueryAtom   │ │
│  │  registeredCommandsAtom              │ │
│  └─────────────────────────────────────┘ │
│                    │                     │
│                    ▼                     │
│  ┌─────────────────────────────────────┐ │
│  │      CommandPalette (Dialog)         │ │
│  │  • Fuzzy search filtering            │ │
│  │  • Keyboard navigation (↑↓↵⎋)       │ │
│  │  • Category grouping                 │ │
│  │  • Recent commands tracking          │ │
│  │  • anime.js enter/exit animations    │ │
│  └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘`}</pre>
            </div>
          </div>

          {/* Event Log */}
          <div className="w-[300px] p-4 bg-surface-1 border border-border-subtle rounded-lg">
            <h3 className="text-sm font-semibold text-text-primary mb-3">Event Log</h3>
            <div className="space-y-1 font-mono text-xs">
              {log.length === 0 ? (
                <div className="text-text-quaternary">
                  Open the command palette (⌘K) and try some commands...
                </div>
              ) : (
                log.map((entry, i) => (
                  <div key={i} className="text-text-secondary">{entry}</div>
                ))
              )}
            </div>

            {/* Keyboard Shortcuts */}
            <div className="mt-6 pt-4 border-t border-border-subtle">
              <h4 className="text-xs font-semibold text-text-secondary mb-2">Shortcuts</h4>
              <div className="space-y-1.5">
                {[
                  { key: '⌘K', action: 'Open palette' },
                  { key: '↑/↓', action: 'Navigate' },
                  { key: '↵', action: 'Execute' },
                  { key: '⎋', action: 'Close' },
                ].map(({ key, action }) => (
                  <div key={key} className="flex justify-between text-xs">
                    <span className="text-text-tertiary">{action}</span>
                    <kbd className="px-1.5 py-0.5 bg-surface-2 rounded text-text-secondary">{key}</kbd>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Command Palette Portal */}
        <CommandPalette />
      </div>
    </CommandPalette.Provider>
  )
}

// =============================================================================
// KEYBOARD PROVIDER DEMO
// =============================================================================

/**
 * Demo showing the GeointKeyboardProvider with unified keyboard system.
 * Demonstrates:
 * - Scope-based keybinding registration
 * - Command registration with the hotkey system
 * - Integration with the existing hotkeys infrastructure
 */
export const KeyboardProviderDemo: FC = () => {
  const [log, setLog] = useState<string[]>([])

  const addLog = useCallback((msg: string) => {
    setLog(prev => [...prev.slice(-14), `[${new Date().toLocaleTimeString()}] ${msg}`])
  }, [])

  // Categories for display
  const categories = Object.values(GEOINT_CATEGORIES) as string[]

  return (
    <GeointKeyboardProvider
      activateScope={true}
      actions={{
        zoomIn: () => addLog('Map: Zoom In (+)'),
        zoomOut: () => addLog('Map: Zoom Out (-)'),
        resetView: () => addLog('Map: Reset View'),
        toggleFullscreen: () => addLog('View: Toggle Fullscreen'),
        focusSearch: () => addLog('Search: Focus Input'),
        clearSearch: () => addLog('Search: Clear'),
        executeSearch: () => addLog('Search: Execute'),
        toggleSearchPanel: () => addLog('Panel: Toggle Search'),
        toggleLayerPanel: () => addLog('Panel: Toggle Layers'),
        toggleLayer: (id: string) => addLog(`Layer: Toggle ${id}`),
        showAllLayers: () => addLog('Layers: Show All'),
        hideAllLayers: () => addLog('Layers: Hide All'),
        cycleMapStyle: () => addLog('Map: Cycle Style'),
        selectAll: () => addLog('Selection: Select All'),
        clearSelection: () => addLog('Selection: Clear'),
        invertSelection: () => addLog('Selection: Invert'),
        deleteSelected: () => addLog('Selection: Delete'),
        fitToSelection: () => addLog('View: Fit to Selection'),
        fitToAll: () => addLog('View: Fit to All'),
      }}
    >
      <div className="h-[700px] flex flex-col bg-surface-0 p-4 gap-4">
        {/* Header */}
        <div>
          <h2 className="text-lg font-semibold text-text-primary">Keyboard Provider Demo</h2>
          <p className="text-sm text-text-tertiary">
            Unified keyboard system for GEOINT with scope-based bindings
          </p>
        </div>

        <div className="flex-1 flex gap-4">
          {/* Bindings Reference */}
          <div className="w-[350px] flex flex-col gap-4 overflow-auto">
            {categories.map((category) => (
              <div key={category} className="p-3 bg-surface-1 border border-border-subtle rounded-lg">
                <h3 className="text-sm font-semibold text-text-primary mb-2">{category}</h3>
                <div className="space-y-1">
                  {GEOINT_BINDINGS
                    .filter((b) => b.commandId.includes(category.toLowerCase()))
                    .map((binding) => (
                      <div key={binding.commandId} className="flex justify-between items-center text-xs">
                        <span className="text-text-secondary">
                          {binding.description || binding.commandId.split('.').pop()}
                        </span>
                        <kbd className="px-1.5 py-0.5 bg-surface-2 rounded text-text-tertiary font-mono">
                          {binding.keys}
                        </kbd>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col gap-4">
            {/* Architecture Diagram */}
            <div className="p-4 bg-surface-1 border border-border-subtle rounded-lg">
              <h3 className="text-sm font-semibold text-text-primary mb-3">Architecture</h3>
              <pre className="text-[10px] font-mono text-text-tertiary whitespace-pre leading-relaxed">
{`┌───────────────────────────────────────────────────────────┐
│              GeointKeyboardProvider                        │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  On Mount:                                            │ │
│  │   1. Register commands → hotkeyActions.registerCmd()  │ │
│  │   2. Parse key strings → KeyParser.parse()            │ │
│  │   3. Add bindings → hotkeyActions.addBinding()        │ │
│  │   4. Push scope → hotkeyActions.pushScope('geoint')   │ │
│  └───────────────────────────────────────────────────────┘ │
│                           │                                │
│                           ▼                                │
│  ┌───────────────────────────────────────────────────────┐ │
│  │            Hotkey System (effect-atom)                 │ │
│  │  bindingsSourceAtom ← [{ keys, commandId, scope }]     │ │
│  │  commandsSourceAtom ← Map<id, { handler, name, ... }>  │ │
│  │  scopeStackSourceAtom ← ['global', 'geoint']           │ │
│  └───────────────────────────────────────────────────────┘ │
│                           │                                │
│                           ▼                                │
│  ┌───────────────────────────────────────────────────────┐ │
│  │            useGlobalHotkeys (listener)                 │ │
│  │  processKeyboardEvent() → match binding → execute      │ │
│  │  which-key popup on partial sequence (e.g., 'g')       │ │
│  └───────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────┘`}
              </pre>
            </div>

            {/* Event Log */}
            <div className="flex-1 p-4 bg-surface-1 border border-border-subtle rounded-lg overflow-auto">
              <h3 className="text-sm font-semibold text-text-primary mb-2">Event Log</h3>
              <p className="text-xs text-text-quaternary mb-3">
                Press the keys shown to trigger commands. Focus this area first.
              </p>
              <div className="font-mono text-xs space-y-1">
                {log.length === 0 ? (
                  <div className="text-text-quaternary">
                    Try pressing: = (zoom in), - (zoom out), g l (layers), / (search)
                  </div>
                ) : (
                  log.map((entry, i) => (
                    <div key={i} className="text-text-secondary">{entry}</div>
                  ))
                )}
              </div>
            </div>

            {/* Scope Info */}
            <div className="p-3 bg-surface-1 border border-border-subtle rounded-lg">
              <div className="flex items-center gap-4 text-xs">
                <div>
                  <span className="text-text-tertiary">Active Scope:</span>{' '}
                  <span className="text-accent-primary font-semibold">geoint</span>
                </div>
                <div>
                  <span className="text-text-tertiary">Scope Chain:</span>{' '}
                  <span className="text-text-secondary">geoint → global</span>
                </div>
                <div>
                  <span className="text-text-tertiary">Bindings:</span>{' '}
                  <span className="text-text-secondary">{GEOINT_BINDINGS.length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </GeointKeyboardProvider>
  )
}

// =============================================================================
// ANIMATION ORCHESTRATOR DEMO
// =============================================================================

/**
 * Demonstrates the AnimationOrchestrator Effect service:
 * - Viewport transitions (fly-to)
 * - Entity lifecycle animations
 * - Panel expand/collapse
 * - Stagger animations for lists/grids
 */
export const AnimationOrchestratorDemo: FC = () => {
  const [log, setLog] = useState<string[]>([])
  const panelRef = useRef<HTMLDivElement>(null)
  const entitiesRef = useRef<HTMLDivElement>(null)
  const [panelExpanded, setPanelExpanded] = useState(false)
  const [showEntities, setShowEntities] = useState(false)

  const addLog = useCallback((msg: string) => {
    setLog(prev => [...prev.slice(-14), `[${new Date().toLocaleTimeString()}] ${msg}`])
  }, [])

  // Run animation using the Effect service
  const runAnimation = useCallback((description: string, effect: Effect.Effect<unknown, unknown, never>) => {
    addLog(`Starting: ${description}`)
    Effect.runPromise(effect).then(
      () => addLog(`Completed: ${description}`),
      (err) => addLog(`Error: ${String(err)}`)
    )
  }, [addLog])

  // Viewport fly-to animation
  const handleFlyTo = useCallback(() => {
    const program = Effect.gen(function* () {
      const animator = yield* AnimationOrchestratorTag
      yield* animator.animateViewport(
        flyToConfig(-122.42, 37.78, 14, { duration: 800 }),
        (state) => addLog(`Viewport: ${JSON.stringify(state)}`)
      )
    }).pipe(Effect.provide(AnimationOrchestratorLive))

    runAnimation('Fly-to San Francisco', program)
  }, [addLog, runAnimation])

  // Panel expand/collapse animation
  const handleTogglePanel = useCallback(() => {
    if (!panelRef.current) return

    const program = Effect.gen(function* () {
      const animator = yield* AnimationOrchestratorTag
      const config = panelExpanded
        ? panelCollapseConfig('demo-panel', panelRef.current!)
        : panelExpandConfig('demo-panel', panelRef.current!)
      yield* animator.animatePanel(config)
    }).pipe(Effect.provide(AnimationOrchestratorLive))

    runAnimation(panelExpanded ? 'Panel collapse' : 'Panel expand', program)
    setPanelExpanded(!panelExpanded)
  }, [panelExpanded, runAnimation])

  // Entity appear animation
  const handleShowEntities = useCallback(() => {
    if (!entitiesRef.current) return

    const children = Array.from(entitiesRef.current.children) as HTMLElement[]
    if (children.length === 0) return

    const program = Effect.gen(function* () {
      const animator = yield* AnimationOrchestratorTag
      yield* animator.animateStagger(
        listStaggerConfig(children, 'slideInUp')
      )
    }).pipe(Effect.provide(AnimationOrchestratorLive))

    runAnimation('Entity stagger appear', program)
    setShowEntities(true)
  }, [runAnimation])

  // Hide entities
  const handleHideEntities = useCallback(() => {
    setShowEntities(false)
    addLog('Entities hidden (instant)')
  }, [addLog])

  return (
    <div className="flex h-[700px] gap-4 p-4 bg-surface-0">
      {/* Demo Controls */}
      <div className="w-[400px] flex flex-col gap-4">
        {/* Buttons */}
        <div className="p-4 bg-surface-1 border border-border-subtle rounded-lg space-y-3">
          <h3 className="text-sm font-semibold text-text-primary mb-3">Animation Controls</h3>

          <button
            onClick={handleFlyTo}
            className="w-full px-4 py-2 bg-accent-primary text-white rounded-lg hover:bg-accent-primary/90 transition-colors text-sm"
          >
            Fly to San Francisco
          </button>

          <button
            onClick={handleTogglePanel}
            className="w-full px-4 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg transition-colors text-sm text-text-primary"
          >
            {panelExpanded ? 'Collapse Panel' : 'Expand Panel'}
          </button>

          <button
            onClick={showEntities ? handleHideEntities : handleShowEntities}
            className="w-full px-4 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg transition-colors text-sm text-text-primary"
          >
            {showEntities ? 'Hide Entities' : 'Show Entities (Stagger)'}
          </button>
        </div>

        {/* Animated Panel */}
        <div
          ref={panelRef}
          className="bg-surface-1 border border-border-subtle rounded-lg overflow-hidden transition-all"
          style={{ width: panelExpanded ? '320px' : '48px' }}
        >
          <div className="p-3 h-24 flex items-center justify-center">
            {panelExpanded ? (
              <span className="text-sm text-text-secondary">Panel Content</span>
            ) : (
              <span className="text-lg">📊</span>
            )}
          </div>
        </div>

        {/* Entity Grid */}
        <div className="p-4 bg-surface-1 border border-border-subtle rounded-lg">
          <h4 className="text-xs font-medium text-text-tertiary mb-2">Entities</h4>
          <div ref={entitiesRef} className="grid grid-cols-4 gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="w-10 h-10 bg-accent-primary/20 border border-accent-primary/30 rounded-lg flex items-center justify-center text-xs text-accent-primary"
                style={{ opacity: showEntities ? 1 : 0 }}
              >
                {i + 1}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Info Panel */}
      <div className="flex-1 flex flex-col gap-4">
        {/* Architecture Diagram */}
        <div className="p-4 bg-surface-1 border border-border-subtle rounded-lg">
          <h3 className="text-sm font-semibold text-text-primary mb-3">Architecture</h3>
          <pre className="text-[10px] font-mono text-text-tertiary whitespace-pre leading-relaxed">
{`┌──────────────────────────────────────────────────────────┐
│             AnimationOrchestrator (Effect Service)        │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  Effect.gen(function* () {                           │ │
│  │    const animator = yield* AnimationOrchestratorTag  │ │
│  │    yield* animator.animateViewport(...)              │ │
│  │    yield* animator.animatePanel(...)                 │ │
│  │    yield* animator.animateStagger(...)               │ │
│  │  }).pipe(Effect.provide(AnimationOrchestratorLive))  │ │
│  └──────────────────────────────────────────────────────┘ │
│                           │                               │
│                           ▼                               │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  Internal State (Effect.Ref)                         │ │
│  │  activeAnimations: Map<id, AnimationHandle>          │ │
│  │  animationQueue: QueuedAnimation[]                   │ │
│  │  nextId: number                                      │ │
│  └──────────────────────────────────────────────────────┘ │
│                           │                               │
│                           ▼                               │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  Animation Drivers                                   │ │
│  │  • GSAP → Viewport interpolation (sub-ms precision)  │ │
│  │  • anime.js → Entity/panel animations                │ │
│  │  • GEOINT Tokens → TIMING, EASING, ANIMATIONS        │ │
│  └──────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘`}
          </pre>
        </div>

        {/* Event Log */}
        <div className="flex-1 p-4 bg-surface-1 border border-border-subtle rounded-lg overflow-auto">
          <h3 className="text-sm font-semibold text-text-primary mb-2">Event Log</h3>
          <div className="font-mono text-xs space-y-1">
            {log.length === 0 ? (
              <div className="text-text-quaternary">
                Click the buttons to trigger animations...
              </div>
            ) : (
              log.map((entry, i) => (
                <div key={i} className="text-text-secondary">{entry}</div>
              ))
            )}
          </div>
        </div>

        {/* Service Info */}
        <div className="p-3 bg-surface-1 border border-border-subtle rounded-lg">
          <div className="grid grid-cols-3 gap-4 text-xs">
            <div>
              <span className="text-text-tertiary">Service:</span>{' '}
              <span className="text-accent-primary font-mono">AnimationOrchestrator</span>
            </div>
            <div>
              <span className="text-text-tertiary">Drivers:</span>{' '}
              <span className="text-text-secondary">GSAP, anime.js</span>
            </div>
            <div>
              <span className="text-text-tertiary">Pattern:</span>{' '}
              <span className="text-text-secondary">Effect.async + handles</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default GeointDashboardTestbed
