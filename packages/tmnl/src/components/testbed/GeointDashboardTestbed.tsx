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

import { FC, useState, useCallback } from 'react'
import { GeointDashboard, SearchPanelCompound } from '@/lib/geoint/components'
import type { BBox, IntelSource, SearchResultItem } from '@/lib/geoint/schemas'

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

export default GeointDashboardTestbed
