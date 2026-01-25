# GEOINT Dashboard - Systematic UI Design

## Overview

This document defines the systematic architecture for the GEOINT (Geospatial Intelligence) Dashboard interface. The design employs:

- **XState** for complex state machines (search flows, selection modes, panel interactions)
- **effect-atom** for reactive state management
- **Radix UI / shadcn** for compound component architecture
- **CSS Grid + Flexbox** for layout
- **anime.js** for micro-interactions and transitions
- **Virtualized lists** for large result sets

---

## 1. Layout Architecture

### Variant A: Command Center (Three-Column)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ╔═══════════════════════════════════════════════════════════════════════╗   │
│ ║                          HEADER BAR                                    ║   │
│ ║  [≡]  GEOINT COP          🔍 Quick Search...         [👤] [⚙️] [🔔]   ║   │
│ ╚═══════════════════════════════════════════════════════════════════════╝   │
├─────────────────┬───────────────────────────────────┬───────────────────────┤
│                 │                                   │                       │
│  SEARCH PANEL   │        MAP VIEWPORT               │   ENTITY PANEL        │
│  ┌───────────┐  │  ┌─────────────────────────────┐  │  ┌─────────────────┐  │
│  │ 🔍 Query  │  │  │                             │  │  │ Selected Entity │  │
│  ├───────────┤  │  │        deck.gl / mapbox     │  │  │ ═══════════════ │  │
│  │ Sources   │  │  │                             │  │  │                 │  │
│  │ [x] Track │  │  │     ✈️   🚗                 │  │  │ Classification  │  │
│  │ [x] OSM   │  │  │            •                │  │  │ ────────────────│  │
│  │ [x] Flt   │  │  │      🏥         📍          │  │  │ Track History   │  │
│  │ [ ] Sat   │  │  │                             │  │  │ ────────────────│  │
│  ├───────────┤  │  │                             │  │  │ Actions         │  │
│  │ Time      │  │  │                             │  │  │ [📍] [🔗] [📤]  │  │
│  │ [Live 🔴] │  │  └─────────────────────────────┘  │  └─────────────────┘  │
│  ├───────────┤  │  ┌─────────────────────────────┐  │  ┌─────────────────┐  │
│  │ Results   │  │  │ LAYER CONTROLS (collapsed)  │  │  │ Related Items   │  │
│  │ ═════════ │  │  │ [👁 Tracks] [👁 POI] [+]    │  │  │ • Track 42      │  │
│  │ • Item 1  │  │  └─────────────────────────────┘  │  │ • POI-Hosp-7    │  │
│  │ • Item 2  │  │                                   │  │ • Flight UA123  │  │
│  │ • Item 3  │  │                                   │  └─────────────────┘  │
│  └───────────┘  │                                   │                       │
│     ≈280px      │           flex-1                  │        ≈320px         │
└─────────────────┴───────────────────────────────────┴───────────────────────┘
```

### Variant B: Focus Mode (Two-Column + Floating)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ╔═══════════════════════════════════════════════════════════════════════╗   │
│ ║  [≡]  GEOINT COP   │  🔍...  │  [Tracks: 42] [POIs: 128]  [👤] [⚙️]  ║   │
│ ╚═══════════════════════════════════════════════════════════════════════╝   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                                                                     │    │
│  │                       FULL-WIDTH MAP                                │    │
│  │                                                                     │    │
│  │    ┌──────────────────┐                                            │    │
│  │    │ FLOATING SEARCH  │                      ✈️                    │    │
│  │    │ ════════════════ │            🚗                              │    │
│  │    │ [Query...]       │                  •                          │    │
│  │    │ Sources: [|||]   │        🏥                                  │    │
│  │    │ Results: 47      │                        📍                  │    │
│  │    │ ─────────────────│                                            │    │
│  │    │ • UA123 ✈️       │                                            │    │
│  │    │ • POI-Hosp ⌘     │                                            │    │
│  │    │ • Track-42 🚗    │                                 ┌─────────┐│    │
│  │    └──────────────────┘                                 │ MINIMAP ││    │
│  │     ↕ draggable                                         │ [□]     ││    │
│  │                                                         └─────────┘│    │
│  │  ┌────────────────────────────────────────────┐                    │    │
│  │  │ ENTITY DETAIL DRAWER (slide-up, 40% height)│                    │    │
│  │  │ ╔════════════════════════════════════════╗ │                    │    │
│  │  │ ║ Flight UA123 - Boeing 737              ║ │                    │    │
│  │  │ ╚════════════════════════════════════════╝ │                    │    │
│  │  │ [Overview] [Track] [Intel] [Actions]       │                    │    │
│  │  │                                            │                    │    │
│  │  └────────────────────────────────────────────┘                    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Variant C: Dashboard Grid (Multi-Pane)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ HEADER                                                                      │
├─────────────────────────────────────────┬───────────────────────────────────┤
│                                         │                                   │
│         PRIMARY MAP (2/3 width)         │    RESULTS PANEL (1/3 width)      │
│  ┌───────────────────────────────────┐  │  ┌─────────────────────────────┐  │
│  │                                   │  │  │ SEARCH                      │  │
│  │        Interactive Map            │  │  │ ┌─────────────────────────┐ │  │
│  │        with entity markers        │  │  │ │ 🔍 Search ALLINT...     │ │  │
│  │                                   │  │  │ └─────────────────────────┘ │  │
│  │         ✈️     🚗     📍          │  │  ├─────────────────────────────┤  │
│  │                                   │  │  │ [All] [Tracks] [POI] [Flt] │  │
│  │              🏥                   │  │  ├─────────────────────────────┤  │
│  │                                   │  │  │ VIRTUALIZED LIST            │  │
│  └───────────────────────────────────┘  │  │ ╔═════════════════════════╗ │  │
│  ┌──────────────────┬────────────────┐  │  │ ║ ✈️ Flight UA123        ║ │  │
│  │ STATS WIDGET     │ TIMELINE       │  │  │ ║    LAX → SFO · 35000ft ║ │  │
│  │ ┌──────────────┐ │ ┌────────────┐ │  │  │ ╠═════════════════════════╣ │  │
│  │ │ Tracks: 42   │ │ │▂▃▅▇▅▃▂▁▂▃▅│ │  │  │ ║ 🏥 SF General Hospital ║ │  │
│  │ │ POIs: 128    │ │ │   24h view │ │  │  │ ║    Emergency · 24hr    ║ │  │
│  │ │ Flights: 15  │ │ └────────────┘ │  │  │ ╠═════════════════════════╣ │  │
│  │ └──────────────┘ │                │  │  │ ║ 🚗 Track-42            ║ │  │
│  └──────────────────┴────────────────┘  │  │ ║    Moving · 45 mph     ║ │  │
│                                         │  │ ╚═════════════════════════╝ │  │
│                                         │  └─────────────────────────────┘  │
└─────────────────────────────────────────┴───────────────────────────────────┘
```

---

## 2. Component Hierarchy

```
GeointDashboard
├── DashboardProvider (XState machine context)
│   ├── dashboardMachine
│   │   ├── states: idle | searching | selecting | editing
│   │   └── context: viewport, selection, filters, layout
│   └── geointRegistry (effect-atom)
│       ├── searchFiltersAtom
│       ├── searchResultsAtom
│       ├── selectedEntityAtom
│       └── layerVisibilityAtom
│
├── Header
│   ├── BrandMark
│   ├── QuickSearch (cmdk integration)
│   ├── StatusIndicators
│   └── UserMenu
│
├── SearchPanel (compound component)
│   ├── SearchPanel.Root
│   ├── SearchPanel.Input
│   ├── SearchPanel.SourceToggles
│   ├── SearchPanel.TimeRange
│   ├── SearchPanel.ResultsList (virtualized)
│   │   └── ResultItem (many)
│   └── SearchPanel.Actions
│
├── MapViewport
│   ├── DeckGLContainer
│   │   ├── ScatterplotLayer (tracks)
│   │   ├── IconLayer (POIs)
│   │   ├── ArcLayer (flights)
│   │   └── SelectionLayer
│   ├── MapboxBase
│   ├── LayerPalette
│   └── RadialCommandDial (contextual)
│
├── EntityPanel (trait-based rendering)
│   ├── EntityPanel.Header
│   ├── EntityPanel.CardStack (DI from traits)
│   │   ├── PositionCard
│   │   ├── ClassificationCard
│   │   ├── TrackHistoryCard
│   │   └── IntelSummaryCard
│   ├── EntityPanel.Actions
│   └── EntityPanel.Relations
│
└── FloatingPanels
    ├── IntelSummaryPanel
    ├── TimelinePanel
    └── ComparisonPanel
```

---

## 3. State Machines (XState)

### Dashboard Machine

```typescript
// dashboardMachine.ts
import { setup, assign } from 'xstate'

interface DashboardContext {
  viewport: ViewportState
  selection: string[]
  filters: FilterState
  layoutMode: 'command' | 'focus' | 'grid'
  searchStatus: 'idle' | 'loading' | 'success' | 'error'
}

type DashboardEvent =
  | { type: 'SEARCH'; query: string }
  | { type: 'SELECT'; entityId: string }
  | { type: 'MULTI_SELECT'; entityIds: string[] }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'TOGGLE_LAYOUT'; mode: 'command' | 'focus' | 'grid' }
  | { type: 'VIEWPORT_CHANGE'; viewport: ViewportState }
  | { type: 'FILTER_CHANGE'; filters: Partial<FilterState> }

export const dashboardMachine = setup({
  types: {
    context: {} as DashboardContext,
    events: {} as DashboardEvent,
  },
  actions: {
    setSelection: assign(({ context, event }) => {
      if (event.type !== 'SELECT') return context
      return { ...context, selection: [event.entityId] }
    }),
    addToSelection: assign(({ context, event }) => {
      if (event.type !== 'MULTI_SELECT') return context
      return { ...context, selection: [...context.selection, ...event.entityIds] }
    }),
    clearSelection: assign({ selection: [] }),
  },
}).createMachine({
  id: 'dashboard',
  initial: 'idle',
  context: {
    viewport: DEFAULT_VIEWPORT,
    selection: [],
    filters: DEFAULT_FILTERS,
    layoutMode: 'command',
    searchStatus: 'idle',
  },
  states: {
    idle: {
      on: {
        SEARCH: { target: 'searching' },
        SELECT: { actions: 'setSelection', target: 'selecting' },
        TOGGLE_LAYOUT: { actions: assign(({ event }) => ({ layoutMode: event.mode })) },
      },
    },
    searching: {
      entry: assign({ searchStatus: 'loading' }),
      invoke: {
        src: 'executeSearch',
        onDone: {
          target: 'idle',
          actions: assign({ searchStatus: 'success' }),
        },
        onError: {
          target: 'idle',
          actions: assign({ searchStatus: 'error' }),
        },
      },
    },
    selecting: {
      on: {
        SELECT: { actions: 'setSelection' },
        MULTI_SELECT: { actions: 'addToSelection' },
        CLEAR_SELECTION: { actions: 'clearSelection', target: 'idle' },
        SEARCH: { target: 'searching' },
      },
    },
  },
})
```

### Search Panel Machine

```
┌───────────────────────────────────────────────────────────────┐
│                    SEARCH PANEL STATES                         │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│   ┌─────────┐      FOCUS        ┌───────────┐                │
│   │  IDLE   │ ─────────────────→ │ FOCUSED   │                │
│   └────┬────┘                   └─────┬─────┘                │
│        │                              │                       │
│        │ BLUR                         │ TYPE                  │
│        │                              ▼                       │
│        │                        ┌───────────┐                │
│        │                        │ SUGGESTING│                │
│        │                        │ (debounced)│                │
│        │                        └─────┬─────┘                │
│        │                              │                       │
│        │                              │ SUBMIT                │
│        │                              ▼                       │
│        │                        ┌───────────┐                │
│        │                        │ SEARCHING │                │
│        │                        └─────┬─────┘                │
│        │                              │                       │
│        │         SUCCESS              │ ERROR                 │
│        │     ┌────────────────────────┼───────────┐          │
│        │     ▼                        ▼           │          │
│        │ ┌───────────┐          ┌───────────┐    │          │
│        └─│ RESULTS   │          │  ERROR    │────┘          │
│          │ DISPLAYED │          │  STATE    │               │
│          └───────────┘          └───────────┘               │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

---

## 4. Effect-Atom Integration

### Core Atoms

```typescript
// atoms/index.ts
import { Atom } from 'effect-atom'
import { Effect, Stream } from 'effect'
import type { SearchResultItem, FilterState, IntelSource } from '../schemas'

// =============================================================================
// Search State Atoms
// =============================================================================

/** Current search query */
export const queryAtom = Atom.make('')

/** Active source filters */
export const sourceFiltersAtom = Atom.make<IntelSource[]>([
  'track', 'osm', 'opensky', 'feature'
])

/** Complete filter state */
export const filtersAtom = Atom.make<FilterState>({
  sources: ['track', 'osm', 'opensky', 'feature'],
  timeRange: { live: true },
  geoFilter: { _type: 'viewport' },
  query: '',
  classifications: [],
  minScore: 0,
})

/** Search results */
export const resultsAtom = Atom.make<SearchResultItem[]>([])

/** Search status */
export const searchStatusAtom = Atom.make<'idle' | 'loading' | 'success' | 'error'>('idle')

/** Search error message */
export const searchErrorAtom = Atom.make<string | null>(null)

// =============================================================================
// Selection State
// =============================================================================

/** Currently selected entity IDs */
export const selectionAtom = Atom.make<string[]>([])

/** Primary selected entity (first in selection) */
export const primarySelectionAtom = Atom.derive((get) => {
  const selection = get(selectionAtom)
  return selection.length > 0 ? selection[0] : null
})

/** Selected entity data */
export const selectedEntityAtom = Atom.derive((get) => {
  const primaryId = get(primarySelectionAtom)
  if (!primaryId) return null
  const results = get(resultsAtom)
  return results.find((r) => r.id === primaryId) ?? null
})

// =============================================================================
// Derived Atoms
// =============================================================================

/** Results grouped by source */
export const resultsBySourceAtom = Atom.derive((get) => {
  const results = get(resultsAtom)
  const grouped = new Map<IntelSource, SearchResultItem[]>()
  for (const result of results) {
    const existing = grouped.get(result.source) ?? []
    grouped.set(result.source, [...existing, result])
  }
  return grouped
})

/** Source counts for UI badges */
export const sourceCountsAtom = Atom.derive((get) => {
  const bySource = get(resultsBySourceAtom)
  const counts: Record<IntelSource, number> = {
    track: 0, osm: 0, opensky: 0, feature: 0,
    adsb_lol: 0, planet: 0, sentinel: 0, weather: 0, custom: 0,
  }
  for (const [source, items] of bySource) {
    counts[source] = items.length
  }
  return counts
})

// =============================================================================
// Runtime Operations
// =============================================================================

export const searchRuntimeAtom = Atom.runtime(SearchService.Default)

export const searchOps = {
  /** Execute search with current filters */
  search: searchRuntimeAtom.fn<{ bounds: BBox }>()(({ bounds }, ctx) =>
    Effect.gen(function* () {
      ctx.set(searchStatusAtom, 'loading')
      ctx.set(searchErrorAtom, null)

      const filters = ctx.get(filtersAtom)
      const service = yield* SearchService

      const results = yield* service.search({
        bounds,
        sources: filters.sources,
        query: filters.query,
        limit: 100,
      }).pipe(
        Effect.catchAll((error) => {
          ctx.set(searchErrorAtom, String(error))
          ctx.set(searchStatusAtom, 'error')
          return Effect.succeed([])
        })
      )

      ctx.set(resultsAtom, results)
      ctx.set(searchStatusAtom, 'success')
      return results
    })
  ),

  /** Clear all search state */
  reset: searchRuntimeAtom.fn<void>()((_, ctx) =>
    Effect.sync(() => {
      ctx.set(queryAtom, '')
      ctx.set(resultsAtom, [])
      ctx.set(selectionAtom, [])
      ctx.set(searchStatusAtom, 'idle')
      ctx.set(searchErrorAtom, null)
    })
  ),

  /** Toggle source filter */
  toggleSource: searchRuntimeAtom.fn<IntelSource>()((source, ctx) =>
    Effect.sync(() => {
      const current = ctx.get(sourceFiltersAtom)
      const next = current.includes(source)
        ? current.filter((s) => s !== source)
        : [...current, source]
      ctx.set(sourceFiltersAtom, next)
      ctx.set(filtersAtom, { ...ctx.get(filtersAtom), sources: next })
    })
  ),
}
```

---

## 5. Compound Component Pattern (SearchPanel)

```typescript
// SearchPanel.tsx - Compound Component Architecture

import { createContext, useContext, memo, forwardRef } from 'react'
import { useAtomValue, useAtom } from 'effect-atom/react'
import { Command } from 'cmdk'
import { cn } from '@/lib/utils'
import {
  queryAtom,
  filtersAtom,
  resultsAtom,
  searchStatusAtom,
  sourceFiltersAtom,
  searchOps,
} from './atoms'
import { geointRegistry } from './registry'

// =============================================================================
// Context
// =============================================================================

interface SearchPanelContextValue {
  expanded: boolean
  setExpanded: (expanded: boolean) => void
  variant: 'sidebar' | 'floating' | 'fullscreen'
}

const SearchPanelContext = createContext<SearchPanelContextValue | null>(null)

function useSearchPanel() {
  const ctx = useContext(SearchPanelContext)
  if (!ctx) throw new Error('useSearchPanel must be used within SearchPanel.Root')
  return ctx
}

// =============================================================================
// Root Component
// =============================================================================

interface RootProps {
  children: React.ReactNode
  variant?: 'sidebar' | 'floating' | 'fullscreen'
  defaultExpanded?: boolean
  className?: string
}

const Root = forwardRef<HTMLDivElement, RootProps>(({
  children,
  variant = 'sidebar',
  defaultExpanded = true,
  className,
}, ref) => {
  const [expanded, setExpanded] = useState(defaultExpanded)

  return (
    <SearchPanelContext.Provider value={{ expanded, setExpanded, variant }}>
      <div
        ref={ref}
        className={cn(
          'search-panel',
          `search-panel--${variant}`,
          expanded && 'search-panel--expanded',
          className
        )}
        data-variant={variant}
        data-expanded={expanded}
      >
        {children}
      </div>
    </SearchPanelContext.Provider>
  )
})

// =============================================================================
// Input Component
// =============================================================================

interface InputProps {
  placeholder?: string
  onSubmit?: (query: string) => void
  className?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(({
  placeholder = 'Search ALLINT...',
  onSubmit,
  className,
}, ref) => {
  const [query, setQuery] = useAtom(queryAtom, geointRegistry)
  const status = useAtomValue(searchStatusAtom, geointRegistry)

  return (
    <div className={cn('search-panel__input-container', className)}>
      <Command.Input
        ref={ref}
        value={query}
        onValueChange={setQuery}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && onSubmit) {
            onSubmit(query)
          }
        }}
        placeholder={placeholder}
        className="search-panel__input"
      />
      {status === 'loading' && (
        <div className="search-panel__loading-indicator">
          <Spinner size="sm" />
        </div>
      )}
    </div>
  )
})

// =============================================================================
// Source Toggles Component
// =============================================================================

const SOURCES: Array<{ id: IntelSource; label: string; icon: typeof MapPin }> = [
  { id: 'track', label: 'Tracks', icon: MapPin },
  { id: 'osm', label: 'POIs', icon: Building },
  { id: 'opensky', label: 'Flights', icon: Plane },
  { id: 'feature', label: 'Features', icon: Layers },
]

interface SourceTogglesProps {
  className?: string
}

const SourceToggles = memo(function SourceToggles({ className }: SourceTogglesProps) {
  const enabledSources = useAtomValue(sourceFiltersAtom, geointRegistry)

  const handleToggle = (source: IntelSource) => {
    geointRegistry.get(searchOps.toggleSource(source))
  }

  return (
    <div className={cn('search-panel__sources', className)}>
      {SOURCES.map(({ id, label, icon: Icon }) => {
        const enabled = enabledSources.includes(id)
        return (
          <button
            key={id}
            onClick={() => handleToggle(id)}
            className={cn(
              'search-panel__source-toggle',
              enabled && 'search-panel__source-toggle--active'
            )}
            aria-pressed={enabled}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{label}</span>
          </button>
        )
      })}
    </div>
  )
})

// =============================================================================
// Results List Component (Virtualized)
// =============================================================================

interface ResultsListProps {
  maxHeight?: number
  onSelect?: (item: SearchResultItem) => void
  onActivate?: (item: SearchResultItem) => void
  className?: string
}

const ResultsList = memo(function ResultsList({
  maxHeight = 400,
  onSelect,
  onActivate,
  className,
}: ResultsListProps) {
  const results = useAtomValue(resultsAtom, geointRegistry)
  const status = useAtomValue(searchStatusAtom, geointRegistry)

  if (status === 'loading') {
    return <ResultsListSkeleton />
  }

  if (results.length === 0) {
    return <ResultsListEmpty />
  }

  return (
    <Command.List
      className={cn('search-panel__results', className)}
      style={{ maxHeight }}
    >
      {results.map((item) => (
        <ResultItem
          key={item.id}
          item={item}
          onSelect={onSelect}
          onActivate={onActivate}
        />
      ))}
    </Command.List>
  )
})

// =============================================================================
// Export Compound Component
// =============================================================================

export const SearchPanel = Object.assign(Root, {
  Input,
  SourceToggles,
  ResultsList,
  TimeRange,
  Actions,
})

// Usage:
// <SearchPanel variant="sidebar">
//   <SearchPanel.Input placeholder="Search..." />
//   <SearchPanel.SourceToggles />
//   <SearchPanel.TimeRange />
//   <SearchPanel.ResultsList onSelect={handleSelect} />
// </SearchPanel>
```

---

## 6. Virtualized List Implementation

### CSS-Based Virtualization (content-visibility)

```css
/* results-list.css */

.results-list {
  /* Container setup */
  max-height: 100%;
  overflow-y: auto;
  overflow-x: hidden;

  /* Smooth scrolling */
  scroll-behavior: smooth;
  overscroll-behavior: contain;

  /* GPU acceleration */
  will-change: scroll-position;
  transform: translateZ(0);
}

.results-list__item {
  /* Native virtualization */
  content-visibility: auto;
  contain-intrinsic-size: 0 64px; /* Expected height */

  /* Prevent layout thrashing */
  contain: layout style paint;
}

/* Visible items get full rendering */
.results-list__item--visible {
  content-visibility: visible;
}

/* Selection states */
.results-list__item--selected {
  background: var(--color-accent-primary-muted);
  border-left: 2px solid var(--color-accent-primary);
}

.results-list__item--focused {
  outline: 2px solid var(--color-focus-ring);
  outline-offset: -2px;
}
```

### React-Window Alternative (for very large lists)

```typescript
// VirtualizedResultsList.tsx
import { FixedSizeList as List } from 'react-window'
import { useAtomValue } from 'effect-atom/react'
import { resultsAtom } from './atoms'
import { geointRegistry } from './registry'

interface VirtualizedResultsListProps {
  height: number
  itemHeight?: number
  onSelect?: (item: SearchResultItem) => void
}

export function VirtualizedResultsList({
  height,
  itemHeight = 64,
  onSelect,
}: VirtualizedResultsListProps) {
  const results = useAtomValue(resultsAtom, geointRegistry)

  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const item = results[index]
    return (
      <div style={style} className="results-list__item">
        <ResultItem item={item} onSelect={onSelect} />
      </div>
    )
  }

  return (
    <List
      height={height}
      itemCount={results.length}
      itemSize={itemHeight}
      width="100%"
      className="results-list"
    >
      {Row}
    </List>
  )
}
```

---

## 7. Animation System (anime.js)

### Animation Tokens

```typescript
// tokens/animations.ts
import anime from 'animejs'

export const ANIMATIONS = {
  // =============================================================================
  // Enter Animations
  // =============================================================================

  panelEnter: (el: HTMLElement) => anime({
    targets: el,
    translateX: [-20, 0],
    opacity: [0, 1],
    duration: 300,
    easing: 'easeOutCubic',
  }),

  resultItemEnter: (el: HTMLElement, index: number) => anime({
    targets: el,
    translateY: [10, 0],
    opacity: [0, 1],
    delay: index * 30, // Stagger
    duration: 200,
    easing: 'easeOutQuad',
  }),

  floatingPanelEnter: (el: HTMLElement) => anime({
    targets: el,
    scale: [0.95, 1],
    opacity: [0, 1],
    duration: 200,
    easing: 'easeOutBack',
  }),

  // =============================================================================
  // Exit Animations
  // =============================================================================

  panelExit: (el: HTMLElement) => anime({
    targets: el,
    translateX: [0, -20],
    opacity: [1, 0],
    duration: 200,
    easing: 'easeInCubic',
  }),

  resultItemExit: (el: HTMLElement) => anime({
    targets: el,
    translateX: [0, -100],
    opacity: [1, 0],
    duration: 150,
    easing: 'easeInQuad',
  }),

  // =============================================================================
  // Feedback Animations
  // =============================================================================

  selectionPulse: (el: HTMLElement) => anime({
    targets: el,
    scale: [1, 1.02, 1],
    duration: 200,
    easing: 'easeInOutQuad',
  }),

  errorShake: (el: HTMLElement) => anime({
    targets: el,
    translateX: [0, -4, 4, -4, 0],
    duration: 300,
    easing: 'easeInOutQuad',
  }),

  // =============================================================================
  // Map Entity Animations
  // =============================================================================

  entityAppear: (el: HTMLElement) => anime({
    targets: el,
    scale: [0, 1],
    opacity: [0, 1],
    duration: 400,
    easing: 'easeOutBack',
  }),

  selectionRing: (el: HTMLElement) => anime({
    targets: el,
    scale: [1, 1.5],
    opacity: [1, 0],
    duration: 600,
    loop: true,
    easing: 'easeOutQuad',
  }),

  // =============================================================================
  // Stagger Utilities
  // =============================================================================

  staggeredList: (els: HTMLElement[]) => anime({
    targets: els,
    translateY: [20, 0],
    opacity: [0, 1],
    delay: anime.stagger(50, { start: 0 }),
    duration: 300,
    easing: 'easeOutQuad',
  }),

  staggeredGrid: (els: HTMLElement[], cols: number, rows: number) => anime({
    targets: els,
    scale: [0, 1],
    opacity: [0, 1],
    delay: anime.stagger(30, {
      grid: [cols, rows],
      from: 'center',
    }),
    duration: 400,
    easing: 'easeOutBack',
  }),
}
```

### React Hook for Animations

```typescript
// hooks/useAnimate.ts
import { useRef, useEffect, useCallback } from 'react'
import anime from 'animejs'
import type { AnimeAnimParams } from 'animejs'

type AnimationName = keyof typeof ANIMATIONS

export function useAnimate<T extends HTMLElement = HTMLElement>() {
  const ref = useRef<T>(null)
  const animationRef = useRef<anime.AnimeInstance | null>(null)

  const animate = useCallback((
    params: AnimeAnimParams | AnimationName
  ) => {
    if (!ref.current) return

    // Cancel previous animation
    if (animationRef.current) {
      animationRef.current.pause()
    }

    // Handle preset names
    if (typeof params === 'string') {
      const preset = ANIMATIONS[params]
      if (typeof preset === 'function') {
        animationRef.current = preset(ref.current)
        return
      }
    }

    // Handle custom params
    animationRef.current = anime({
      targets: ref.current,
      ...(params as AnimeAnimParams),
    })
  }, [])

  const stop = useCallback(() => {
    animationRef.current?.pause()
  }, [])

  useEffect(() => {
    return () => {
      animationRef.current?.pause()
    }
  }, [])

  return { ref, animate, stop }
}

// Usage:
// const { ref, animate } = useAnimate<HTMLDivElement>()
// <div ref={ref} onClick={() => animate('selectionPulse')}>...</div>
```

---

## 8. CSS Grid Layout System

```css
/* dashboard-layout.css */

/* =============================================================================
   Dashboard Grid (Variant A - Command Center)
   ============================================================================= */

.dashboard--command {
  display: grid;
  grid-template-columns: var(--panel-width-search) 1fr var(--panel-width-entity);
  grid-template-rows: var(--header-height) 1fr;
  grid-template-areas:
    "header header header"
    "search map    entity";
  height: 100vh;
  background: var(--color-surface-0);
}

.dashboard--command .header { grid-area: header; }
.dashboard--command .search-panel { grid-area: search; }
.dashboard--command .map-viewport { grid-area: map; }
.dashboard--command .entity-panel { grid-area: entity; }

/* =============================================================================
   Dashboard Grid (Variant B - Focus Mode)
   ============================================================================= */

.dashboard--focus {
  display: grid;
  grid-template-columns: 1fr;
  grid-template-rows: var(--header-height) 1fr;
  grid-template-areas:
    "header"
    "map";
  height: 100vh;
  position: relative;
}

.dashboard--focus .floating-search {
  position: absolute;
  top: calc(var(--header-height) + var(--spacing-4));
  left: var(--spacing-4);
  width: 320px;
  z-index: var(--z-floating);
}

.dashboard--focus .entity-drawer {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 40%;
  transform: translateY(100%);
  transition: transform var(--duration-normal) var(--ease-out);
}

.dashboard--focus .entity-drawer--open {
  transform: translateY(0);
}

/* =============================================================================
   Dashboard Grid (Variant C - Multi-Pane)
   ============================================================================= */

.dashboard--grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  grid-template-rows: var(--header-height) 1fr auto;
  grid-template-areas:
    "header  header"
    "map     results"
    "widgets results";
  height: 100vh;
  gap: var(--spacing-px);
  background: var(--color-border-subtle);
}

.dashboard--grid > * {
  background: var(--color-surface-0);
}

.dashboard--grid .widgets {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-px);
}

/* =============================================================================
   Responsive Breakpoints
   ============================================================================= */

@media (max-width: 1200px) {
  .dashboard--command {
    grid-template-columns: var(--panel-width-search) 1fr;
    grid-template-areas:
      "header header"
      "search map";
  }

  .dashboard--command .entity-panel {
    position: fixed;
    right: 0;
    top: var(--header-height);
    bottom: 0;
    transform: translateX(100%);
    transition: transform var(--duration-normal) var(--ease-out);
    z-index: var(--z-drawer);
  }

  .dashboard--command .entity-panel--open {
    transform: translateX(0);
  }
}

@media (max-width: 768px) {
  .dashboard--command {
    grid-template-columns: 1fr;
    grid-template-rows: var(--header-height) auto 1fr;
    grid-template-areas:
      "header"
      "search"
      "map";
  }

  .dashboard--command .search-panel {
    max-height: 200px;
    overflow-y: auto;
  }
}
```

---

## 9. Radial Command Dial

```
                    ┌─────────┐
                    │  TRACK  │
                    │   📍    │
               ╱    └────┬────┘    ╲
              ╱          │          ╲
         ┌───────┐       │       ┌───────┐
         │ SHARE │       │       │ INTEL │
         │  📤   │───────┼───────│  🔍   │
         └───────┘       │       └───────┘
              ╲          │          ╱
               ╲    ┌────┴────┐    ╱
                    │ SELECTED│
                    │   ⬤     │
               ╱    └────┬────┘    ╲
              ╱          │          ╲
         ┌───────┐       │       ┌───────┐
         │DELETE │       │       │ LINK  │
         │  🗑️   │───────┼───────│  🔗   │
         └───────┘       │       └───────┘
              ╲          │          ╱
               ╲    ┌────┴────┐    ╱
                    │ HISTORY │
                    │   📊    │
                    └─────────┘

Keyboard Navigation:
- Tab/Shift+Tab: Cycle through actions
- 1-6: Direct action selection
- Enter: Execute action
- Escape: Close dial
```

---

## 10. Entity Panel - Trait-to-Card DI

```
┌─────────────────────────────────────────┐
│ ENTITY PANEL                       [×]  │
├─────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ │
│ │ ✈️ Flight UA123                     │ │
│ │ Boeing 737-800 · N12345             │ │
│ │ LAX → SFO                           │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│                                         │
│ ┌─ POSITION CARD ─────────────────────┐ │
│ │ 📍 37.7749° N, 122.4194° W          │ │
│ │ Alt: 35,000 ft · Hdg: 045°          │ │
│ │ Speed: 450 kts                      │ │
│ │ [View on Map]                       │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ┌─ CLASSIFICATION CARD ───────────────┐ │
│ │ 🔷 CIVILIAN · COMMERCIAL            │ │
│ │ Confidence: 98%                     │ │
│ │ Source: ADS-B                       │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ┌─ TRACK HISTORY CARD ────────────────┐ │
│ │ 📊 24h Track History                │ │
│ │ ┌─────────────────────────────────┐ │ │
│ │ │  ↗ ↗ → ↘ ↘ → → → ↗ ↗ ↗         │ │ │
│ │ │  (mini trajectory viz)          │ │ │
│ │ └─────────────────────────────────┘ │ │
│ │ Points: 847 · Duration: 5h 23m      │ │
│ │ [Expand Timeline]                   │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ┌─ INTEL SUMMARY CARD ────────────────┐ │
│ │ 🔍 Intelligence Summary             │ │
│ │ • 3 related tracks in vicinity      │ │
│ │ • Flight path intersects AOI-7      │ │
│ │ • No threat indicators              │ │
│ │ [View Full Intel Report]            │ │
│ └─────────────────────────────────────┘ │
│                                         │
├─────────────────────────────────────────┤
│ ACTIONS                                 │
│ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐│
│ │📍 Pin │ │🔗 Link│ │📤Share│ │🗑️ Del ││
│ └───────┘ └───────┘ └───────┘ └───────┘│
└─────────────────────────────────────────┘

Trait → Card Mapping:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Trait               │ Card Rendered
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Position            │ PositionCard
Track               │ TrackHistoryCard
Classification      │ ClassificationCard
IntelSummary        │ IntelSummaryCard
Imagery             │ ImageryPreviewCard
Weather             │ WeatherConditionsCard
Vessel              │ VesselDetailsCard
Aircraft            │ AircraftDetailsCard
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 11. Implementation Phases

### Phase 1: Core Layout + Atoms (Week 1)
- [ ] DashboardProvider with XState machine
- [ ] Core atoms (search, selection, filters)
- [ ] CSS Grid layout (Variant A)
- [ ] Basic SearchPanel compound component

### Phase 2: Virtualized Lists + Results (Week 2)
- [ ] VirtualizedResultsList with content-visibility
- [ ] ResultItem with source-specific rendering
- [ ] Keyboard navigation (↑/↓/Enter/Esc)
- [ ] Multi-select with Shift+Click

### Phase 3: Entity Panel + Cards (Week 3)
- [ ] Trait-to-card registry
- [ ] Card components (Position, Track, Classification)
- [ ] EntityPanel with card stack
- [ ] RadialCommandDial

### Phase 4: Animations + Polish (Week 4)
- [ ] anime.js integration
- [ ] Enter/exit animations
- [ ] Selection feedback
- [ ] Stagger effects
- [ ] Keyboard shortcuts

### Phase 5: Testing + Validation (Week 5)
- [ ] Playwriter UI tests
- [ ] Accessibility audit
- [ ] Performance profiling
- [ ] Mobile responsiveness

---

## Appendix: Design Tokens Reference

```typescript
// Reference to src/lib/geoint/tokens.ts for complete token definitions
// See: TIMING, EASING, SURFACE_COLORS, ACCENT_COLORS, SOURCE_COLORS, ANIMATIONS
```
