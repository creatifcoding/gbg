# GEOINT Dashboard - Novel Interface Architecture

## Executive Summary

A modern, high-performance interface for the All-Source Intelligence Common Operating Picture (ALLINT COP) system. Built with XState machines integrated into components, effect-atom for reactive state, TanStack Virtual for large result sets, and Anime.js for fluid animations.

---

## Architecture Overview

### Component Hierarchy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          GeointDashboard                                     │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                        DashboardShell                                   ││
│  │  ┌───────────┬────────────────────────────────────────┬───────────────┐││
│  │  │           │                                        │               │││
│  │  │  Command  │           MapViewport                  │    Intel      │││
│  │  │  Sidebar  │       ┌──────────────────┐             │    Panel      │││
│  │  │           │       │                  │             │               │││
│  │  │  ┌─────┐  │       │   DeckGL +       │             │  ┌─────────┐  │││
│  │  │  │Srch │  │       │   MapboxGL       │             │  │Results  │  │││
│  │  │  │Panel│  │       │                  │             │  │List     │  │││
│  │  │  └─────┘  │       │   ┌──────────┐   │             │  │(Virtual)│  │││
│  │  │           │       │   │Overlays  │   │             │  └─────────┘  │││
│  │  │  ┌─────┐  │       │   └──────────┘   │             │               │││
│  │  │  │Layer│  │       │                  │             │  ┌─────────┐  │││
│  │  │  │Ctrl │  │       └──────────────────┘             │  │Details  │  │││
│  │  │  └─────┘  │                                        │  │Panel    │  │││
│  │  │           │       ┌──────────────────┐             │  └─────────┘  │││
│  │  │  ┌─────┐  │       │   StatusBar      │             │               │││
│  │  │  │Time │  │       │   (Streaming)    │             │  ┌─────────┐  │││
│  │  │  │line │  │       └──────────────────┘             │  │Actions  │  │││
│  │  │  └─────┘  │                                        │  │Bar      │  │││
│  │  │           │                                        │  └─────────┘  │││
│  │  └───────────┴────────────────────────────────────────┴───────────────┘││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Layout Variants

### Variant A: Command Center (3-Column)

Best for: Large monitors, multi-source analysis

```
┌────────────────────────────────────────────────────────────────────────┐
│ ┌──────────┐ ┌────────────────────────────────┐ ┌────────────────────┐ │
│ │          │ │                                │ │                    │ │
│ │  Search  │ │                                │ │   Intel Feed       │ │
│ │  Panel   │ │         Map Viewport           │ │   ────────────     │ │
│ │          │ │                                │ │   ▪ Result 1       │ │
│ │  ──────  │ │                                │ │   ▪ Result 2       │ │
│ │          │ │                                │ │   ▪ Result 3       │ │
│ │  Layers  │ │                                │ │   ▪ Result 4       │ │
│ │  Control │ │                                │ │   (virtualized)    │ │
│ │          │ │                                │ │                    │ │
│ │  ──────  │ │                                │ │   ────────────     │ │
│ │          │ │                                │ │                    │ │
│ │  Time    │ │                                │ │   Details          │ │
│ │  Filter  │ │                                │ │   Panel            │ │
│ │          │ │                                │ │                    │ │
│ └──────────┘ └────────────────────────────────┘ └────────────────────┘ │
│                         320px            flex-1               380px     │
└────────────────────────────────────────────────────────────────────────┘
```

### Variant B: Analyst Focus (Map-Centric)

Best for: Spatial analysis, pattern recognition

```
┌────────────────────────────────────────────────────────────────────────┐
│ ┌────────────────────────────────────────────────────────────────────┐ │
│ │  Toolbar: [Search] [Layers] [Time] [Filters] [Export]    [Stats]  │ │
│ └────────────────────────────────────────────────────────────────────┘ │
│ ┌────────────────────────────────────────────────────────────────────┐ │
│ │                                                                    │ │
│ │                                                                    │ │
│ │                         Map Viewport                               │ │
│ │                                                                    │ │
│ │  ┌──────────────────────────────────────────────────────────────┐  │ │
│ │  │              Floating Results Drawer (Collapsible)           │  │ │
│ │  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐     │  │ │
│ │  │  │Track 1 │ │POI 2   │ │Flight 3│ │Track 4 │ │POI 5   │ ... │  │ │
│ │  │  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘     │  │ │
│ │  └──────────────────────────────────────────────────────────────┘  │ │
│ └────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```

### Variant C: Mobile/Tablet Adaptive

Best for: Field operations, touch interfaces

```
┌─────────────────────────┐
│ ┌─────────────────────┐ │
│ │  Search Bar         │ │
│ │  [🔍 Search area...] │ │
│ └─────────────────────┘ │
│ ┌─────────────────────┐ │
│ │                     │ │
│ │                     │ │
│ │    Map Viewport     │ │
│ │                     │ │
│ │                     │ │
│ └─────────────────────┘ │
│ ┌─────────────────────┐ │
│ │  Bottom Sheet       │ │
│ │  ─ ─ ─ ─ ─ ─ ─ ─ ─  │ │
│ │  │ Results (swipe) │ │ │
│ │  │ ▪ Item 1        │ │ │
│ │  │ ▪ Item 2        │ │ │
│ │  └─────────────────┘ │ │
│ └─────────────────────┘ │
│ ┌─────────────────────┐ │
│ │ [🗺️] [📍] [✈️] [⚙️] │ │
│ └─────────────────────┘ │
└─────────────────────────┘
```

---

## State Architecture

### Global State (effect-atom)

```typescript
// Registry for dashboard state
export const geointRegistry = Registry.make()

// Core state atoms
export const viewportAtom = Atom.make<ViewportState>({ ... })
export const searchQueryAtom = Atom.make<SearchQuery | null>(null)
export const searchStatusAtom = Atom.make<SearchStatus>('idle')
export const resultsAtom = Atom.make<SearchResultItem[]>([])
export const selectedResultAtom = Atom.make<SearchResultItem | null>(null)
export const layerVisibilityAtom = Atom.make<LayerVisibility>({ ... })

// Derived atoms
export const filteredResultsAtom = Atom.make((get) => {
  const results = get(resultsAtom)
  const filter = get(activeFilterAtom)
  return applyFilter(results, filter)
})

export const resultsBySourceAtom = Atom.make((get) => {
  const results = get(resultsAtom)
  return HashMap.groupBy(results, r => r.source)
})
```

### XState Integration Pattern

XState machines are integrated directly into components, not as separate design artifacts:

```
┌─────────────────────────────────────────────────────────────────┐
│                    Component + Machine Pattern                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │  SearchPanel.tsx                                        │   │
│   │                                                         │   │
│   │  const searchMachine = setup({                          │   │
│   │    types: {} as { context: SearchContext; ... },        │   │
│   │    guards: { isValidQuery: ... },                       │   │
│   │    actors: { executeSearch: fromPromise(...) },         │   │
│   │  }).createMachine({ ... })                              │   │
│   │                                                         │   │
│   │  function SearchPanel() {                               │   │
│   │    const [state, send] = useMachine(searchMachine)      │   │
│   │    const registry = useRegistry()                       │   │
│   │                                                         │   │
│   │    // Sync machine state → atoms                        │   │
│   │    useEffect(() => {                                    │   │
│   │      registry.set(searchStatusAtom, state.value)        │   │
│   │    }, [state.value])                                    │   │
│   │    ...                                                  │   │
│   │  }                                                      │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Specifications

### 1. SearchPanel (Compound Component)

```
┌─────────────────────────────────────────┐
│  SearchPanel                            │
│  ┌───────────────────────────────────┐  │
│  │  SearchPanel.QueryInput           │  │
│  │  ┌─────────────────────────────┐  │  │
│  │  │ 🔍 Search intelligence...   │  │  │
│  │  └─────────────────────────────┘  │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │  SearchPanel.SourceFilters        │  │
│  │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ │  │
│  │  │Track│ │ OSM │ │ADS-B│ │Satel│ │  │
│  │  │ ✓   │ │ ✓   │ │     │ │     │ │  │
│  │  └─────┘ └─────┘ └─────┘ └─────┘ │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │  SearchPanel.GeoFilter            │  │
│  │  ○ Viewport  ○ Radius  ○ Polygon  │  │
│  │  [Radius: 50km ▾]                 │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │  SearchPanel.TemporalFilter       │  │
│  │  ○ Live  ○ Last Hour  ○ Custom    │  │
│  │  [────────●──────────] Now        │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │  [🔍 Execute Search]              │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

**XState Machine (Inline)**:

```
                    ┌─────────────┐
                    │    idle     │
                    └──────┬──────┘
                           │ SUBMIT
                           ▼
                    ┌─────────────┐
        ┌───────────│  validating │
        │           └──────┬──────┘
        │ INVALID          │ VALID
        ▼                  ▼
┌─────────────┐     ┌─────────────┐
│   error     │     │  searching  │◄──────┐
└──────┬──────┘     └──────┬──────┘       │
       │                   │              │
       │ RETRY             │ SUCCESS      │ RETRY
       └───────────────────┤              │
                           ▼              │
                    ┌─────────────┐       │
                    │  completed  │───────┘
                    └─────────────┘ (auto-refresh)
```

### 2. ResultsPanel (Virtualized List)

```
┌─────────────────────────────────────────┐
│  ResultsPanel                           │
│  ┌───────────────────────────────────┐  │
│  │  Header                           │  │
│  │  Intelligence Feed     [127 items]│  │
│  │  [Sort ▾] [Group ▾] [Filter ▾]    │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │  VirtualizedList (TanStack)       │  │
│  │  ┌─────────────────────────────┐  │  │
│  │  │ ✈️ UAL1234 - 34,000ft       │  │  │
│  │  │    SFO → LAX • 12:34 UTC    │  │  │
│  │  └─────────────────────────────┘  │  │
│  │  ┌─────────────────────────────┐  │  │
│  │  │ 📍 POI: Golden Gate Bridge  │  │  │
│  │  │    37.8199° N, 122.4783° W  │  │  │
│  │  └─────────────────────────────┘  │  │
│  │  ┌─────────────────────────────┐  │  │
│  │  │ 🎯 Track: VEHICLE-042       │  │  │
│  │  │    Moving NW • 45 km/h      │  │  │
│  │  └─────────────────────────────┘  │  │
│  │           ⋮ (virtualized)         │  │
│  │           ⋮                       │  │
│  │  ┌─────────────────────────────┐  │  │
│  │  │ 🛰️ Sentinel: Scene 2024...  │  │  │
│  │  │    Captured: 2024-01-15     │  │  │
│  │  └─────────────────────────────┘  │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │  StreamingIndicator               │  │
│  │  ◉ Live • 3 new results pending   │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

**Virtualization Pattern**:

```typescript
const ResultsList = () => {
  const results = useAtomValue(filteredResultsAtom)
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: results.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72, // Estimated row height
    overscan: 5,
  })

  return (
    <div ref={parentRef} className="h-full overflow-auto">
      <div style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map(virtualRow => (
          <ResultItem
            key={virtualRow.key}
            result={results[virtualRow.index]}
            style={{ transform: `translateY(${virtualRow.start}px)` }}
          />
        ))}
      </div>
    </div>
  )
}
```

### 3. LayerPalette (Enhanced)

```
┌─────────────────────────────────────────┐
│  LayerPalette                           │
│  ┌───────────────────────────────────┐  │
│  │  Layer Control                    │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │  Base Layers                      │  │
│  │  ┌─────────────────────────────┐  │  │
│  │  │ ◉ Dark        ○ Satellite   │  │  │
│  │  │ ○ Light       ○ Terrain     │  │  │
│  │  └─────────────────────────────┘  │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │  Intel Layers                     │  │
│  │  ┌─────────────────────────────┐  │  │
│  │  │ [✓] Tracks         ●────────│  │  │
│  │  │ [✓] POIs           ───●─────│  │  │
│  │  │ [✓] Flights        ────────●│  │  │
│  │  │ [ ] Heatmap        ●────────│  │  │
│  │  │ [ ] Satellite      ────●────│  │  │
│  │  └─────────────────────────────┘  │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │  Layer Actions                    │  │
│  │  [Reset] [Save Preset] [Load ▾]  │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

### 4. DetailsPanel (Context-Sensitive)

```
┌─────────────────────────────────────────┐
│  DetailsPanel                           │
│  ┌───────────────────────────────────┐  │
│  │  ✈️ Flight: UAL1234              ✕│  │
│  └───────────────────────────────────┘  │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │  ┌─────────────────────────────┐  │  │
│  │  │     [Mini Map Preview]      │  │  │
│  │  │         ◆ ←                 │  │  │
│  │  └─────────────────────────────┘  │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │  Properties                       │  │
│  │  ─────────────────────────────────│  │
│  │  Callsign      UAL1234            │  │
│  │  ICAO24        a1b2c3             │  │
│  │  Altitude      34,000 ft          │  │
│  │  Ground Speed  450 kts            │  │
│  │  Heading       275°               │  │
│  │  Origin        SFO                │  │
│  │  Destination   LAX                │  │
│  │  Last Update   12:34:56 UTC       │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │  Actions                          │  │
│  │  [Track] [History] [Export] [📋] │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

---

## Design Tokens

### GEOINT-Specific Token Extensions

```typescript
// src/lib/geoint/tokens.ts

export const GEOINT_TOKENS = {
  // Source-specific colors
  source: {
    track: {
      primary: '#22c55e',      // Green
      secondary: '#4ade80',
      muted: 'rgba(34, 197, 94, 0.2)',
    },
    osm: {
      primary: '#3b82f6',      // Blue
      secondary: '#60a5fa',
      muted: 'rgba(59, 130, 246, 0.2)',
    },
    opensky: {
      primary: '#eab308',      // Yellow
      secondary: '#facc15',
      muted: 'rgba(234, 179, 8, 0.2)',
    },
    adsb_lol: {
      primary: '#f97316',      // Orange
      secondary: '#fb923c',
      muted: 'rgba(249, 115, 22, 0.2)',
    },
    planet: {
      primary: '#8b5cf6',      // Purple
      secondary: '#a78bfa',
      muted: 'rgba(139, 92, 246, 0.2)',
    },
    sentinel: {
      primary: '#06b6d4',      // Cyan
      secondary: '#22d3ee',
      muted: 'rgba(6, 182, 212, 0.2)',
    },
    weather: {
      primary: '#ec4899',      // Pink
      secondary: '#f472b6',
      muted: 'rgba(236, 72, 153, 0.2)',
    },
  },

  // Classification colors
  classification: {
    friendly: '#22c55e',
    hostile: '#ef4444',
    neutral: '#eab308',
    unknown: '#6b7280',
  },

  // Status indicators
  status: {
    streaming: '#22c55e',
    idle: '#6b7280',
    error: '#ef4444',
    pending: '#eab308',
  },

  // Spacing scale
  spacing: {
    panel: '16px',
    card: '12px',
    item: '8px',
    tight: '4px',
  },

  // Border radii
  radius: {
    panel: '12px',
    card: '8px',
    button: '6px',
    badge: '4px',
  },

  // Shadows
  shadow: {
    panel: '0 4px 24px rgba(0, 0, 0, 0.4)',
    card: '0 2px 8px rgba(0, 0, 0, 0.2)',
    floating: '0 8px 32px rgba(0, 0, 0, 0.5)',
  },
} as const
```

---

## Animation System

### Anime.js Integration

```typescript
// src/lib/geoint/animations.ts

import anime from 'animejs'

export const GEOINT_ANIMATIONS = {
  // Panel reveal animation
  panelReveal: (target: HTMLElement) => anime({
    targets: target,
    translateX: [-20, 0],
    opacity: [0, 1],
    duration: 300,
    easing: 'easeOutCubic',
  }),

  // Result item stagger
  resultsStagger: (targets: string | HTMLElement[]) => anime({
    targets,
    translateY: [20, 0],
    opacity: [0, 1],
    delay: anime.stagger(50, { start: 100 }),
    duration: 400,
    easing: 'easeOutQuart',
  }),

  // Source badge pulse (streaming indicator)
  streamingPulse: (target: HTMLElement) => anime({
    targets: target,
    scale: [1, 1.1, 1],
    opacity: [1, 0.7, 1],
    duration: 1500,
    loop: true,
    easing: 'easeInOutSine',
  }),

  // Map fly-to anticipation
  flyToAnticipate: (onComplete: () => void) => anime.timeline({
    easing: 'easeOutExpo',
  }).add({
    targets: '.map-viewport',
    scale: [1, 0.98],
    duration: 150,
  }).add({
    targets: '.map-viewport',
    scale: [0.98, 1],
    duration: 600,
    complete: onComplete,
  }),

  // Details panel transition
  detailsSlide: (target: HTMLElement, direction: 'in' | 'out') => anime({
    targets: target,
    translateX: direction === 'in' ? [100, 0] : [0, 100],
    opacity: direction === 'in' ? [0, 1] : [1, 0],
    duration: 250,
    easing: direction === 'in' ? 'easeOutCubic' : 'easeInCubic',
  }),

  // Layer toggle morph
  layerToggle: (target: HTMLElement, enabled: boolean) => anime({
    targets: target,
    backgroundColor: enabled
      ? ['rgba(255,255,255,0.1)', 'rgba(34,197,94,0.2)']
      : ['rgba(34,197,94,0.2)', 'rgba(255,255,255,0.1)'],
    scale: [1, 1.05, 1],
    duration: 200,
    easing: 'easeOutQuad',
  }),
}
```

### Animation Timeline for Search Flow

```
Search Execution Animation Timeline
────────────────────────────────────────────────────────────────────

0ms     100ms   200ms   300ms   400ms   500ms   600ms   700ms
│───────│───────│───────│───────│───────│───────│───────│───────│
│                                                               │
│ [Submit Button Pulse]                                         │
│ ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
│                                                               │
│        [Loading Indicator Fade In]                            │
│        ░░░░████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
│                                                               │
│                  [Map Anticipation Scale]                     │
│                  ░░░░░░░░████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
│                                                               │
│                            [Results Stagger In]               │
│                            ░░░░░░░░░░░░████████████████████████│
│                            │    │    │    │    │              │
│                            R1   R2   R3   R4   R5   ...       │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

---

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Data Flow Diagram                              │
└─────────────────────────────────────────────────────────────────────────┘

                    User Interaction
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    XState Machine (Component-Local)                      │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐              │
│  │  idle   │───▶│validating│───▶│searching│───▶│completed│              │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘              │
└─────────────────────────────────────────────────────────────────────────┘
                          │
                          │ Sync via registry.set()
                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      effect-atom Registry                                │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐         │
│  │ searchStatusAtom│  │   resultsAtom   │  │selectedResultAtom│         │
│  │    'searching'  │  │ SearchResult[]  │  │ SearchResult|null │        │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘         │
│           │                   │                    │                    │
│           └───────────────────┼────────────────────┘                    │
│                               ▼                                         │
│                    ┌─────────────────┐                                  │
│                    │filteredResultsAtom│ (derived)                      │
│                    └─────────────────┘                                  │
└─────────────────────────────────────────────────────────────────────────┘
                          │
                          │ useAtomValue()
                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      React Components                                    │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐               │
│  │  SearchPanel  │  │ ResultsPanel  │  │DetailsPanel  │               │
│  │               │  │               │  │               │               │
│  │ useMachine()  │  │useAtomValue() │  │useAtomValue() │               │
│  └───────────────┘  └───────────────┘  └───────────────┘               │
└─────────────────────────────────────────────────────────────────────────┘
                          │
                          │ Layer construction
                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      DeckGL Layers                                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │ScatterPlot  │  │  IconLayer  │  │  PathLayer  │  │  TextLayer  │    │
│  │  (Tracks)   │  │   (POIs)    │  │  (Routes)   │  │  (Labels)   │    │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Effect Integration

### Search API Integration Pattern

```typescript
// Effect-based search with progressive results
const searchAllEffect = (query: SearchQuery) =>
  Effect.gen(function* () {
    yield* Effect.log('Starting search', { query })

    const sources = query.sources.length > 0
      ? query.sources
      : ALL_SOURCES

    // Create stream for each source
    const streams = sources.map(source =>
      searchSourceEffect(source, query).pipe(
        Stream.map(results => ({ source, results })),
        Stream.catchAll(error =>
          Stream.succeed({ source, results: [], error })
        )
      )
    )

    // Merge all streams for progressive results
    const merged = Stream.mergeAll(streams, { concurrency: 'unbounded' })

    // Collect and update atoms progressively
    yield* Stream.runForEach(merged, ({ source, results }) =>
      Effect.sync(() => {
        registry.set(resultsAtom, prev => [...prev, ...results])
        registry.set(sourceCountsAtom, prev =>
          HashMap.set(prev, source, results.length)
        )
      })
    )
  })
```

---

## File Structure

```
src/lib/geoint/
├── components/
│   ├── dashboard/
│   │   ├── GeointDashboard.tsx       # Main dashboard shell
│   │   ├── DashboardShell.tsx        # Layout wrapper
│   │   └── index.ts
│   │
│   ├── search/
│   │   ├── SearchPanel.tsx           # Compound component + XState
│   │   ├── SearchPanel.QueryInput.tsx
│   │   ├── SearchPanel.SourceFilters.tsx
│   │   ├── SearchPanel.GeoFilter.tsx
│   │   ├── SearchPanel.TemporalFilter.tsx
│   │   ├── searchMachine.ts          # XState machine (co-located)
│   │   └── index.ts
│   │
│   ├── results/
│   │   ├── ResultsPanel.tsx          # Virtualized list container
│   │   ├── ResultItem.tsx            # Individual result card
│   │   ├── ResultItem.Track.tsx
│   │   ├── ResultItem.POI.tsx
│   │   ├── ResultItem.Flight.tsx
│   │   ├── ResultItem.Imagery.tsx
│   │   └── index.ts
│   │
│   ├── layers/
│   │   ├── LayerPalette.tsx          # Enhanced layer control
│   │   ├── LayerToggle.tsx           # Individual layer toggle
│   │   ├── LayerOpacitySlider.tsx
│   │   └── index.ts
│   │
│   ├── details/
│   │   ├── DetailsPanel.tsx          # Context-sensitive details
│   │   ├── DetailsPanel.Track.tsx
│   │   ├── DetailsPanel.Flight.tsx
│   │   ├── DetailsPanel.POI.tsx
│   │   └── index.ts
│   │
│   └── index.ts                      # Barrel export
│
├── atoms/
│   ├── viewport.ts
│   ├── search.ts
│   ├── results.ts
│   ├── layers.ts
│   └── index.ts
│
├── animations/
│   ├── index.ts                      # Anime.js animation library
│   ├── search.ts
│   ├── results.ts
│   └── panels.ts
│
├── tokens.ts                         # GEOINT-specific design tokens
│
└── index.ts                          # Main barrel export
```

---

## Implementation Phases

### Phase 1: Foundation
- [ ] Create `tokens.ts` with GEOINT-specific design tokens
- [ ] Set up `atoms/` directory with core state atoms
- [ ] Create `DashboardShell` layout component
- [ ] Implement basic 3-column layout (Variant A)

### Phase 2: Search System
- [ ] Build `SearchPanel` compound component with XState machine
- [ ] Implement `QueryInput` with debounced search
- [ ] Build `SourceFilters` toggle group
- [ ] Add `GeoFilter` with viewport/radius/polygon modes
- [ ] Add `TemporalFilter` with timeline slider

### Phase 3: Results System
- [ ] Implement `ResultsPanel` with TanStack Virtual
- [ ] Create polymorphic `ResultItem` components
- [ ] Wire up result selection → details panel
- [ ] Add streaming indicator for live results

### Phase 4: Layers & Details
- [ ] Enhance `LayerPalette` with opacity sliders
- [ ] Build context-sensitive `DetailsPanel`
- [ ] Add mini-map preview in details
- [ ] Implement result actions (track, history, export)

### Phase 5: Animations & Polish
- [ ] Integrate Anime.js animation library
- [ ] Add panel reveal/hide animations
- [ ] Implement result stagger animations
- [ ] Add loading state animations
- [ ] Polish transitions and micro-interactions

---

## Testing Strategy

### Playwriter UI Tests

```typescript
// Example test for search flow
test('search executes and displays results', async ({ page }) => {
  // Navigate to dashboard
  await page.goto('/testbed/geoint-dashboard')

  // Enter search query
  await page.locator('[data-testid="search-input"]').fill('hospital')

  // Select source filters
  await page.locator('[data-testid="source-osm"]').click()

  // Execute search
  await page.locator('[data-testid="search-submit"]').click()

  // Wait for results
  await expect(page.locator('[data-testid="results-count"]')).toContainText(/\d+ items/)

  // Click first result
  await page.locator('[data-testid="result-item"]').first().click()

  // Verify details panel shows
  await expect(page.locator('[data-testid="details-panel"]')).toBeVisible()
})
```

---

## Dependencies

### Required Packages

```json
{
  "@tanstack/react-virtual": "^3.0.0",
  "animejs": "^3.2.2",
  "@xstate/react": "^4.0.0",
  "xstate": "^5.0.0"
}
```

### Existing Dependencies (Already Installed)

- `effect`, `effect-atom` - State management
- `@deck.gl/*` - Map rendering
- `react-map-gl` - Mapbox integration
- `@radix-ui/*` - Primitive components
- `lucide-react` - Icons

---

## Notes

1. **XState Integration**: Machines are co-located with components, not designed separately. This follows the user's directive: "xstate machine design will be integrated into the creation of the component itself"

2. **effect-atom Pattern**: Use `registry.set()` for synchronous mutations in React callbacks, `Atom.set()` inside Effect.gen() functions

3. **Virtualization**: TanStack Virtual for lists with 100+ items. Estimate row height at 72px for result items.

4. **Animation Philosophy**: Anime.js for orchestrated sequences, CSS transitions for simple state changes. Never animate during rapid scrolling.

5. **12px Floor**: Typography minimum remains enforced per TMNL design system.
