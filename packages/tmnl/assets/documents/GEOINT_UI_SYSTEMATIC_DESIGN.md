# GEOINT UI Systematic Design Document

## Executive Summary

This document captures the systematic design of the GEOINT (All-Source Intelligence Common Operating Picture) interface, built with:
- **XState v5** - Complex state machines for search workflows
- **effect-atom** - Reactive state management
- **Radix UI/shadcn** - Compound component architecture
- **anime.js v4** - Animation system
- **@tanstack/react-virtual** - Virtualized lists
- **CSS Grid/Flexbox** - Layout system
- **Design tokens** - Tokenized styling

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            GEOINT DASHBOARD                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         HEADER TOOLBAR                               │    │
│  │  [Logo] [Layout: Command|Focus|Grid] [Search] [Entity] [Layers]     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌───────────┬─────────────────────────────────────────┬───────────────┐    │
│  │  SEARCH   │              MAP VIEWPORT               │   ENTITY      │    │
│  │  PANEL    │                                         │   PANEL       │    │
│  │           │   ┌─────────────────────────────┐       │               │    │
│  │ [Input]   │   │       deck.gl Layers        │       │ [Detail]      │    │
│  │ [Sources] │   │  • ScatterplotLayer         │       │ [History]     │    │
│  │ [Filters] │   │  • IconLayer                │       │ [Relations]   │    │
│  │ [Results] │   │  • PathLayer                │       │ [Actions]     │    │
│  │           │   │  • ScenegraphLayer          │       │               │    │
│  │           │   └─────────────────────────────┘       │               │    │
│  │           │                                         │               │    │
│  │           │   [Minimap]  [Timeline]  [Stats]        │               │    │
│  └───────────┴─────────────────────────────────────────┴───────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                        TIMELINE / FOOTER                             │    │
│  │  [◀] [▶] [▶▶] ─────────────○────────────────── [1h] [24h] [7d]      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Layout Variants

### 1. Command Center Layout (Default)
```
┌──────────────────────────────────────────────────────────────────┐
│ Header: Layout Toggles | Quick Search | Panel Controls           │
├───────────┬──────────────────────────────────┬──────────────────┤
│  Search   │                                  │    Entity        │
│  Panel    │         MAP (flex-1)             │    Panel         │
│  280px    │                                  │    320px         │
│           │                                  │                  │
│  • Query  │  ┌────────────────────────────┐  │  • Header        │
│  • Source │  │   ScatterplotLayer         │  │  • TabNav        │
│  • Time   │  │   IconLayer                │  │  • Overview      │
│  • Filter │  │   PathLayer                │  │  • History       │
│           │  │   ScenegraphLayer          │  │  • Relations     │
│  Results  │  │   HeatmapLayer             │  │  • RawData       │
│  (Virtual)│  └────────────────────────────┘  │  • ActionBar     │
│           │                                  │                  │
│           │  [Minimap] [LayerPalette]        │                  │
└───────────┴──────────────────────────────────┴──────────────────┘
             grid-template-columns: 280px 1fr 320px
```

### 2. Focus Mode Layout
```
┌──────────────────────────────────────────────────────────────────┐
│ Header (minimal)                                                  │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│   ┌──────────────┐                                               │
│   │ Floating     │       FULL-SCREEN MAP                         │
│   │ Search       │                                               │
│   │ Panel        │         (position: absolute)                  │
│   │              │                                               │
│   │ 320px wide   │                                               │
│   │ max-h: 60%   │                                               │
│   └──────────────┘                                               │
│                                                                   │
│   ┌──────────────────────────────────────────────────────────┐   │
│   │           Floating Entity Drawer (bottom)                 │   │
│   │           height: 40%, rounded-t-xl                       │   │
│   │           backdrop-blur, drag handle                      │   │
│   └──────────────────────────────────────────────────────────┘   │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### 3. Dashboard Grid Layout
```
┌──────────────────────────────────────────────────────────────────┐
│ Header                                                            │
├────────────────────────────────────────┬─────────────────────────┤
│                                        │    Search + Results      │
│           PRIMARY MAP                  │    (1fr column)          │
│           (2fr column)                 │                          │
│                                        │  ┌───────────────────┐   │
│    ┌────────────────────────────┐      │  │  SearchPanel      │   │
│    │    deck.gl viewport        │      │  │  (compact)        │   │
│    │                            │      │  ├───────────────────┤   │
│    │                            │      │  │  VirtualizedList  │   │
│    │                            │      │  │  (flex-1)         │   │
│    └────────────────────────────┘      │  │                   │   │
│                                        │  └───────────────────┘   │
├────────────────────┬───────────────────┤                          │
│   Stats Widget     │  Timeline Widget  │                          │
│   (1fr)            │  (1fr)            │                          │
└────────────────────┴───────────────────┴─────────────────────────┘
         grid-template-columns: 2fr 1fr
         grid-template-rows: 1fr auto
```

---

## Component Inventory

### Core Components (28 total)

| Component | Status | Compound | XState | effect-atom | Notes |
|-----------|--------|----------|--------|-------------|-------|
| GeointDashboard | ✅ | ✅ | ✅ | ✅ | Main orchestrator |
| GeointMap | ✅ | ❌ | ❌ | ✅ | deck.gl integration |
| SearchPanel | ✅ | ❌ | ❌ | ✅ | Basic search |
| SearchPanelCompound | ✅ | ✅ | ❌ | ✅ | Composable search |
| EntityPanel | ✅ | ❌ | ❌ | ✅ | Entity details |
| EntityDetailCard | ✅ | ✅ | ❌ | ❌ | Tabbed detail view |
| VirtualizedResultsList | ✅ | ✅ | ❌ | ✅ | @tanstack/react-virtual |
| VirtualizedSearchResults | ✅ | ❌ | ❌ | ✅ | Legacy virtualized list |
| ResultsPanel | ✅ | ❌ | ❌ | ✅ | View mode switching |
| FilterBar | ✅ | ✅ | ❌ | ✅ | Advanced filtering |
| TimelinePanel | ✅ | ✅ | ❌ | ✅ | Temporal filtering |
| StatsWidget | ✅ | ✅ | ❌ | ✅ | Dashboard statistics |
| LayerPalette | ✅ | ❌ | ❌ | ✅ | Basic layer controls |
| LayerPaletteCompound | ✅ | ✅ | ❌ | ✅ | Enhanced layers |
| Minimap | ✅ | ❌ | ❌ | ✅ | Navigation overview |
| RadialCommandDial | ✅ | ❌ | ❌ | ✅ | Ctrl+Click actions |
| MultiSelectActionBar | ✅ | ✅ | ❌ | ✅ | Batch operations |
| SpatialQueryPanel | ✅ | ✅ | ❌ | ✅ | Polygon/radius search |
| AlertPanel | ✅ | ✅ | ❌ | ✅ | Real-time alerts |
| CorrelationView | ✅ | ✅ | ❌ | ✅ | Relationship graph |
| KeyboardShortcutsOverlay | ✅ | ✅ | ❌ | ❌ | Which-key display |
| MeasurementTools | ✅ | ✅ | ❌ | ❌ | Distance/area/bearing |
| CollectionManager | ✅ | ✅ | ❌ | ✅ | Watchlists/groups |
| TrackHistoryPlayer | ✅ | ✅ | ❌ | ✅ | Track playback |
| LiveFeedIndicator | ✅ | ✅ | ❌ | ✅ | Stream status |
| BookmarksPanel | ✅ | ✅ | ❌ | ✅ | Saved views |
| ExportPanel | ✅ | ✅ | ❌ | ✅ | Data export |
| IntelSummaryPanel | ✅ | ❌ | ❌ | ✅ | Intel overview |

### State Machines

| Machine | Status | Purpose |
|---------|--------|---------|
| dashboardMachine | ✅ | Layout/panel state |
| searchMachine | ✅ | Multi-source search workflow |
| spatialQueryMachine | ❌ | Draw mode state (TODO) |
| timelineMachine | ❌ | Playback state (TODO) |
| exportMachine | ❌ | Export workflow (TODO) |

---

## Gap Analysis

### High Priority Gaps

1. **Command Palette (M-x style)**
   - Missing: Global command search with fuzzy matching
   - Pattern: XState + effect-atom + Radix Dialog
   - Inspiration: VSCode, Raycast, Emacs M-x

2. **Unified Keyboard System**
   - Have: KeyboardShortcutsOverlay (display only)
   - Missing: Hotkey registration, scope management
   - Pattern: BindingSourceRegistry + HotkeyService

3. **Animation Orchestration**
   - Have: ANIMATIONS presets in tokens
   - Missing: Coordinated enter/exit, layout transitions
   - Pattern: anime.js Timeline API, stagger utilities

4. **Real-time Data Integration**
   - Have: LiveFeedIndicator (UI only)
   - Missing: WebSocket/SSE connection, backpressure
   - Pattern: Effect.Stream + effect-atom subscription

### Medium Priority Gaps

5. **Drag-and-Drop Reordering**
   - Missing: Result list reordering, panel rearrangement
   - Pattern: @dnd-kit + effect-atom

6. **Theming System**
   - Have: Color tokens
   - Missing: Dark/light mode toggle, custom themes
   - Pattern: CSS variables + context

7. **Undo/Redo Stack**
   - Missing: Operation history for map actions
   - Pattern: Immer patches + XState

8. **Tour/Onboarding**
   - Missing: Interactive walkthrough
   - Pattern: Driver.js or Shepherd.js integration

---

## Data Flow Architecture

```
                              ┌─────────────────┐
                              │   User Input    │
                              └────────┬────────┘
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────────┐
│                        XState Machines                            │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────────────────┐ │
│  │ dashboard   │   │ search      │   │ spatialQuery/timeline   │ │
│  │ Machine     │   │ Machine     │   │ Machines (planned)      │ │
│  └──────┬──────┘   └──────┬──────┘   └──────────┬──────────────┘ │
└─────────┼─────────────────┼─────────────────────┼────────────────┘
          │                 │                     │
          ▼                 ▼                     ▼
┌──────────────────────────────────────────────────────────────────┐
│                        effect-atom Registry                       │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ layoutAtom   │  │ resultsAtom  │  │ selectedEntityAtom   │   │
│  │ panelAtoms   │  │ filtersAtom  │  │ layerVisibilityAtom  │   │
│  │ compactAtom  │  │ sourceAtoms  │  │ viewportBoundsAtom   │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
│                                                                   │
│  registry.set(atom, value)  ─────►  useAtomValue(atom)           │
│  (sync mutations)                   (React subscriptions)         │
└──────────────────────────────────────────────────────────────────┘
          │
          ▼
┌──────────────────────────────────────────────────────────────────┐
│                        React Components                           │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  GeointDashboard (provider)                                  │ │
│  │    └── DashboardContext                                      │ │
│  │         ├── SearchPanel (subscribes to searchResultsAtom)    │ │
│  │         ├── GeointMap (subscribes to layerVisibilityAtom)    │ │
│  │         └── EntityPanel (subscribes to selectedEntityAtom)   │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

---

## Animation System Design

### Token-Based Animations

```typescript
// tokens.ts already defines:
export const ANIMATIONS = {
  fadeIn: { opacity: [0, 1], duration: 250, ease: 'easeOutCubic' },
  slideInUp: { translateY: [20, 0], opacity: [0, 1], duration: 250 },
  popIn: { scale: [0, 1], opacity: [0, 1], ease: 'easeOutBack' },
  // ... etc
}

// Usage Pattern:
import { animate } from 'animejs'
import { ANIMATIONS } from '../tokens'

animate(element, ANIMATIONS.slideInUp)
```

### Coordinated Animations (To Implement)

```typescript
// Panel transition orchestration
const layoutTransition = (from: LayoutMode, to: LayoutMode) => {
  const timeline = createTimeline()

  // Exit current layout
  timeline.add(containerRef, { opacity: [1, 0.8] }, 0)

  // Animate panels
  if (from === 'command' && to === 'focus') {
    timeline.add(searchPanelRef, ANIMATIONS.slideOutLeft, 50)
    timeline.add(entityPanelRef, ANIMATIONS.slideOutRight, 50)
  }

  // Enter new layout
  timeline.add(containerRef, { opacity: [0.8, 1] }, 150)

  return timeline.play()
}
```

### Stagger Patterns

```typescript
// List item stagger (already implemented in VirtualizedResultsList)
const staggerEnter = (items: HTMLElement[]) => {
  animate(items, {
    ...ANIMATIONS.slideInUp,
    delay: (_, i) => i * TIMING.stagger, // 50ms base
  })
}

// Grid stagger (diagonal wave)
const gridStagger = (items: HTMLElement[], cols: number) => {
  animate(items, {
    ...ANIMATIONS.fadeIn,
    delay: (_, i) => {
      const row = Math.floor(i / cols)
      const col = i % cols
      return (row + col) * TIMING.stagger
    },
  })
}
```

---

## Compound Component Patterns

### Standard Pattern (Used Across GEOINT)

```typescript
// Root with context
const SearchPanelRoot: FC<RootProps> = ({ children, ...props }) => {
  const contextValue = useMemo(() => createContext(props), [props])
  return (
    <SearchPanelContext.Provider value={contextValue}>
      <div className={cn('...', props.className)}>
        {children}
      </div>
    </SearchPanelContext.Provider>
  )
}

// Sub-components access context
const SearchPanelInput: FC<InputProps> = (props) => {
  const { query, setQuery } = useSearchPanel()
  return <Input value={query} onChange={e => setQuery(e.target.value)} {...props} />
}

// Compound export
export const SearchPanel = Object.assign(SearchPanelRoot, {
  Input: SearchPanelInput,
  Sources: SearchPanelSources,
  Results: SearchPanelResults,
  // ...
})
```

### Usage

```tsx
<SearchPanel.Root onSearch={handleSearch}>
  <SearchPanel.Input placeholder="Search..." />
  <SearchPanel.Sources showCounts />
  <SearchPanel.Results virtualized />
</SearchPanel.Root>
```

---

## Next Implementation Phases

### Phase 1: Command Palette (Priority)
- [ ] Create `CommandPalette` compound component
- [ ] XState machine for palette state (open/closed, filter, selection)
- [ ] Fuzzy search with fuse.js
- [ ] Command registration system
- [ ] Keyboard navigation (arrows, enter, escape)

### Phase 2: Animation Orchestration
- [ ] Create `AnimationOrchestrator` service
- [ ] Layout transition system
- [ ] Coordinated panel enter/exit
- [ ] Scroll-linked animations

### Phase 3: Real-time Data Layer
- [ ] WebSocket service with Effect.Stream
- [ ] Backpressure handling
- [ ] Auto-reconnect logic
- [ ] Optimistic updates

### Phase 4: Polish & Testing
- [ ] Playwriter E2E tests
- [ ] Accessibility audit
- [ ] Performance profiling
- [ ] Documentation

---

## Design Tokens Reference

```typescript
// Colors by source
SOURCE_COLORS.track.primary     // #22c55e (green)
SOURCE_COLORS.osm.primary       // #3b82f6 (blue)
SOURCE_COLORS.opensky.primary   // #eab308 (yellow)
SOURCE_COLORS.feature.primary   // #a855f7 (purple)

// Timing
TIMING.fast    // 150ms - micro-interactions
TIMING.normal  // 250ms - standard transitions
TIMING.slow    // 400ms - deliberate animations
TIMING.stagger // 50ms  - list item delay

// Easing
EASING.out     // 'cubic-bezier(0.33, 1, 0.68, 1)'
EASING.bounce  // 'cubic-bezier(0.68, -0.55, 0.265, 1.55)'
EASING.anime.spring // 'spring(1, 80, 10, 0)'

// Panel dimensions
PANEL_DIMENSIONS.sidebar.default  // 320px
PANEL_DIMENSIONS.intelPanel.default // 380px
PANEL_DIMENSIONS.drawer.peek // 200px

// Virtualization
VIRTUALIZATION.resultItemHeight // 72px
VIRTUALIZATION.overscan // 5 items
```

---

## File Structure

```
src/lib/geoint/
├── atoms/               # effect-atom state
│   ├── index.ts
│   ├── search.ts
│   ├── entities.ts
│   └── viewport.ts
├── components/          # React components (28)
│   ├── index.ts         # barrel exports
│   ├── GeointDashboard.tsx
│   ├── GeointMap.tsx
│   ├── SearchPanel.tsx
│   ├── SearchPanelCompound.tsx
│   ├── VirtualizedResultsList.tsx
│   └── ... (23 more)
├── machines/            # XState machines
│   ├── index.ts
│   ├── dashboardMachine.ts
│   ├── searchMachine.ts
│   ├── DashboardProvider.tsx
│   └── SearchProvider.tsx
├── schemas/             # Effect Schema types
│   └── index.ts
├── tokens.ts            # Design tokens
├── cards/               # Entity card registry
│   └── registry.ts
├── layers/              # deck.gl layer configs
│   └── tracks.ts
├── positioning/         # Entity positioning system
│   ├── hooks.tsx
│   └── SceneGraphBridge.ts
└── index.ts             # Main barrel
```

---

*Document generated for GEOINT Dashboard Epic (tmnl-7zha7)*
