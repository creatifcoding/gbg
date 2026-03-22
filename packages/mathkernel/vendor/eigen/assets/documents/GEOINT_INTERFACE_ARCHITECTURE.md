# GEOINT Interface Architecture

> Systematic design of the Geointelligence dashboard interface leveraging XState, effect-atom, Radix UI, anime.js, and compound component architecture.

---

## Component Inventory

### Layer 1: Foundation (Atoms & Services)
```
geoint/
├── atoms/
│   ├── index.ts              # Registry, search atoms, selection state
│   └── layoutAtoms.ts        # Layout mode, panel states, animation phases
├── services/
│   ├── GeointService.ts      # Core geoint orchestration
│   └── SearchService.ts      # Multi-source search coordination
├── schemas/
│   ├── core.ts               # Base entity schemas
│   ├── tracks.ts             # Track/vessel schemas
│   ├── features.ts           # GeoJSON feature schemas
│   ├── search.ts             # Search query/result schemas
│   └── analysis.ts           # Analysis result schemas
└── tokens.ts                 # Design tokens (colors, timing, spacing)
```

### Layer 2: State Machines (XState v5)
```
machines/
├── dashboardMachine.ts       # Top-level dashboard orchestration
├── layoutMachine.ts          # Layout variant transitions (command/focus/analytics)
├── searchMachine.ts          # Multi-source search workflow
├── searchFormMachine.ts      # Form UI with suggestions
├── filterBarMachine.ts       # Filter preset orchestration
├── entityDetailMachine.ts    # Tab navigation with animations
├── timelineMachine.ts        # Temporal playback
├── radialDialMachine.ts      # Gesture-based radial menu
├── immersiveHudMachine.ts    # Overlay orchestration
├── swimlaneMachine.ts        # Temporal swimlane
├── networkGraphMachine.ts    # Entity relationship graph
├── splitCompareMachine.ts    # Temporal comparison
├── missionPlannerMachine.ts  # Mission workflow
├── fusionViewMachine.ts      # Multi-source fusion
└── heatmapMachine.ts         # Temporal heatmap analysis
```

### Layer 3: Components (Compound Architecture)
```
components/
├── Shell & Layout
│   ├── GeointShell.tsx           # Root layout orchestrator
│   ├── GeointDashboard.tsx       # Dashboard integration
│   └── GeointKeyboardProvider.tsx # Hotkey bindings
│
├── Search & Results
│   ├── SearchPanelCompound.tsx   # Search form + sources + filters
│   ├── VirtualizedResultsList.tsx # @tanstack/react-virtual list
│   ├── FilterBar.tsx             # Filter preset chips
│   └── CommandPalette.tsx        # ⌘K quick search
│
├── Map & Visualization
│   ├── GeointMap.tsx             # Maplibre integration
│   ├── Minimap.tsx               # Overview inset
│   ├── LayerPaletteCompound.tsx  # Layer toggles
│   └── MeasurementTools.tsx      # Distance/area tools
│
├── Entity Details
│   ├── EntityDetailCard.tsx      # Tabbed detail view
│   ├── EntityPanel.tsx           # Entity sidebar
│   ├── CorrelationView.tsx       # Related entities
│   └── IntelSummaryPanel.tsx     # Intelligence summary
│
├── Timeline & Temporal
│   ├── TimelinePanel.tsx         # Primary timeline
│   ├── SwimlaneTimeline.tsx      # Multi-lane temporal
│   ├── TrackHistoryPlayer.tsx    # Track playback
│   └── TemporalHeatmap.tsx       # Activity density
│
├── Novel Interfaces
│   ├── RadialCommandDial.tsx     # Gesture radial menu
│   ├── ImmersiveHUD.tsx          # Glassmorphism overlays
│   ├── NetworkGraph.tsx          # @xyflow/react relationships
│   ├── SplitCompareView.tsx      # Temporal comparison
│   ├── MissionPlanner.tsx        # Objectives tracking
│   └── FusionView.tsx            # Multi-source fusion
│
├── Collections & Export
│   ├── CollectionManager.tsx     # Saved collections
│   ├── BookmarksPanel.tsx        # Location bookmarks
│   └── ExportPanel.tsx           # Data export
│
├── Status & Alerts
│   ├── LiveFeedIndicator.tsx     # Streaming status
│   ├── AlertPanel.tsx            # Active alerts
│   └── StatsWidget.tsx           # Dashboard statistics
│
└── Utilities
    ├── SpatialQueryPanel.tsx     # Spatial filters
    ├── MultiSelectActionBar.tsx  # Bulk actions
    └── KeyboardShortcutsOverlay.tsx # Shortcut help
```

---

## Interface Variants

### Variant A: Command Center (Primary)

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ ┌─ HEADER ───────────────────────────────────────────────────────────────────────────┐
│ │ [☰] GEOINT │ ⌘K Search...                          │ ◉ LIVE │ ⚠ 3 │ ⚙ │ 👤        │
│ └────────────────────────────────────────────────────────────────────────────────────┘
│ ┌── SEARCH ───────┐┌─────────────────── MAP ─────────────────────────┐┌─ INTEL ─────┐
│ │                 ││                                                 ││             │
│ │  ╭───────────╮  ││     ○ ○       ○                                 ││ ╭─────────╮ │
│ │  │ Query Box │  ││        ○   ○     ○ ○                            ││ │ Entity  │ │
│ │  ╰───────────╯  ││              ●───────────────────────────────────┼┼─│ Detail  │ │
│ │                 ││           ┌───────────────┐     │                ││ │         │ │
│ │  [Sources]      ││           │   Selected    │◄────┘                ││ │ [Tabs]  │ │
│ │  ☑ Tracks       ││           │    Entity     │                      ││ │ Info    │ │
│ │  ☑ OSM          ││           └───────────────┘     ○                ││ │ History │ │
│ │  ☑ OpenSky      ││                                                  ││ │ Links   │ │
│ │  ☑ AIS          ││        ○    ○                                    ││ ╰─────────╯ │
│ │                 ││                      ○     ○                     ││             │
│ │  [Filters]      ││              ○                                   ││ ╭─────────╮ │
│ │  ○ All          ││   ○                                              ││ │ Results │ │
│ │  ○ Vessels      ││                                                  ││ │ ─────── │ │
│ │  ○ Aircraft     ││         ┌─────────────────────────────────┐      ││ │ ▸ 247   │ │
│ │  ○ Vehicles     ││         │         MINIMAP                 │      ││ │         │ │
│ │                 ││         └─────────────────────────────────┘      ││ ╰─────────╯ │
│ │  [Stats]        ││                                                  ││             │
│ │  247 results    ││                                                  ││ [Actions] │ │
│ │  12 live        ││                                                  ││ Export │ ⋯ │
│ └─────────────────┘└─────────────────────────────────────────────────┘└─────────────┘
│ ┌─ TIMELINE ─────────────────────────────────────────────────────────────────────────┐
│ │ [◀] [▶▶] ═══════════════●════════════════════════════════  2h    12h    24h    7d │
│ └────────────────────────────────────────────────────────────────────────────────────┘
└──────────────────────────────────────────────────────────────────────────────────────┘

CSS Grid Layout:
├─ Header:    1fr auto (sticky, h-12)
├─ Main:      grid-cols-[320px_1fr_380px] gap-4
│  ├─ Search: overflow-y-auto, collapsible → 48px icon strip
│  ├─ Map:    flex-1, position relative, rounded-lg
│  └─ Intel:  overflow-y-auto, collapsible → 48px icon strip
└─ Timeline:  h-16, collapsible → 0
```

### Variant B: Focus Mode (Immersive)

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                      │
│                            ┌────────────────────────┐                                │
│                            │    ⌘K Quick Search     │                                │
│                            └────────────────────────┘                                │
│                                                                                      │
│   ╭───────────╮                                                  ╭──────────────╮    │
│   │  Layers   │                                                  │   Entity     │    │
│   │  ○ Track  │                                                  │   Detail     │    │
│   │  ○ OSM    │                     MAP                          │   ────────   │    │
│   │  ○ Sky    │                (Full Bleed)                      │   Floating   │    │
│   │  ○ AIS    │                                                  │   Draggable  │    │
│   ╰───────────╯                ○     ○                           │   Resizable  │    │
│                                   ●───► Selected                 ╰──────────────╯    │
│                             ○  ○     ○                                               │
│   ╭───────────╮                                                                      │
│   │  Stats    │                                                                      │
│   │  247      │                                                                      │
│   │  ◉ 12     │                                                                      │
│   ╰───────────╯                                                                      │
│                                                                                      │
│   ╭─────────────────────────────────────────────────────────────────────────────╮    │
│   │  [◀] [▶] ════●════════════════════════════════════════════  Timeline       │    │
│   ╰─────────────────────────────────────────────────────────────────────────────╯    │
│                                                                                      │
│                       [ESC panels]   [⌘1 Command]   [⌘2 Focus]   [⌘3 Grid]          │
└──────────────────────────────────────────────────────────────────────────────────────┘

Layout: Relative positioning
├─ Map:         absolute inset-0, z-0
├─ QuickSearch: fixed top-8 left-1/2 -translate-x-1/2, z-50
├─ Layers:      floating, draggable (default: top-left)
├─ Stats:       floating, draggable (default: bottom-left)
├─ Entity:      floating, draggable, resizable (default: top-right)
├─ Timeline:    floating, bottom center, glassmorphism
└─ Hints:       fixed bottom-4 center, z-40
```

### Variant C: Analytics Dashboard

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ ┌─ HEADER ───────────────────────────────────────────────────────────────────────────┐
│ │ [☰] GEOINT Analytics    │ Dashboard │ Command │ Focus │ ◉ Live │ ⌘K │            │
│ └────────────────────────────────────────────────────────────────────────────────────┘
│ ┌─────────────────── MAP (60%) ─────────────────────┐┌───── STATS GRID (40%) ───────┐
│ │                                                   ││ ┌─────────────┐ ┌───────────┐│
│ │                                                   ││ │   TRACKS    │ │  SOURCES  ││
│ │            ○    ○                                 ││ │    247      │ │ ████░░░░  ││
│ │               ○     ○  ○                          ││ │   ▲ 12%     │ │ 6 active  ││
│ │                                                   ││ └─────────────┘ └───────────┘│
│ │         ○         ○                               ││ ┌─────────────┐ ┌───────────┐│
│ │                       ○                           ││ │   ALERTS    │ │ COVERAGE  ││
│ │      ○                                            ││ │     3       │ │   87%     ││
│ │                                                   ││ │   ⚠ High    │ │ ████████░ ││
│ │                                                   ││ └─────────────┘ └───────────┘│
│ └───────────────────────────────────────────────────┘└──────────────────────────────┘
│ ┌─────────────────── RESULTS TABLE ─────────────────┐┌───── SOURCE BREAKDOWN ───────┐
│ │ ┌────┬────────────┬────────┬──────┬────────────┐  ││                              │
│ │ │ ID │ Name       │ Source │ Conf │ Time       │  ││    Track   ████████░░░  65%  │
│ │ ├────┼────────────┼────────┼──────┼────────────┤  ││    OSM     ████░░░░░░░  23%  │
│ │ │ 01 │ Target A   │ Track  │ 0.95 │ 2m ago     │  ││    OpenSky ██░░░░░░░░░   8%  │
│ │ │ 02 │ POI B      │ OSM    │ 0.88 │ 5m ago     │  ││    AIS     █░░░░░░░░░░   4%  │
│ │ │ .. │ ...        │ ...    │ ...  │ ...        │  ││                              │
│ │ └────┴────────────┴────────┴──────┴────────────┘  ││    [Detailed Breakdown →]    │
│ └───────────────────────────────────────────────────┘└──────────────────────────────┘
└──────────────────────────────────────────────────────────────────────────────────────┘

CSS Grid Layout:
├─ Header:      1fr auto
├─ Top Row:     grid-cols-[60%_40%] gap-4
│  ├─ Map:      rounded-lg, overflow-hidden
│  └─ Stats:    grid grid-cols-2 gap-4
└─ Bottom Row:  grid-cols-[60%_40%] gap-4
   ├─ Table:    AG-Grid virtualized, sortable
   └─ Charts:   Source breakdown, sparklines
```

### Variant D: Immersive HUD (Tactical)

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                      │
│  ╭─ COMPASS ──────────────╮                          ╭─ ALTITUDE ─────────────────╮  │
│  │        N               │                          │  FL350 ──────●──── FL450   │  │
│  │    NW     NE           │                          │  Climbing 2400 ft/min      │  │
│  │  W    ●    E           │                          ╰────────────────────────────╯  │
│  │    SW     SE           │                                                          │
│  │        S               │                          ╭─ SPEED ────────────────────╮  │
│  ╰────────────────────────╯                          │  GS: 485 kts  TAS: 512 kts │  │
│                                                      │  M: 0.82                   │  │
│                                                      ╰────────────────────────────╯  │
│                                                                                      │
│                            ┌─ SELECTED ─────────────┐                                │
│                            │ ═══════════════════════│                                │
│                            │  TRACK-4721            │                                │
│                            │  VESSEL: MV PACIFIC    │                                │
│                            │  ────────────────────  │                                │
│                            │  LAT: 34.0522° N       │                                │
│                            │  LON: 118.2437° W      │                                │
│                            │  HDG: 275° | SPD: 12kt │                                │
│                            └────────────────────────┘                                │
│                                                                                      │
│  ╭─ ALERTS ───────────────╮                          ╭─ MINIMAP ─────────────────╮   │
│  │ ⚠ Proximity Warning    │                          │  ┌─────────────────────┐  │   │
│  │ ⚠ Pattern Anomaly      │                          │  │    ●      ○         │  │   │
│  │ ○ All Clear (12)       │                          │  │  ○    ◉      ○     │  │   │
│  ╰────────────────────────╯                          │  └─────────────────────┘  │   │
│                                                      ╰───────────────────────────╯   │
│                                                                                      │
│ ┌─ SWIMLANE TIMELINE ────────────────────────────────────────────────────────────────┐
│ │  Track   ══●══════════════════════════════════════════════════════════════════    │
│ │  AIS     ════════●══════════════════════════════════════════════════════════      │
│ │  Sky     ══════════════════════●════════════════════════════════════════════      │
│ │  SIGINT  ══════════════════════════════●════════════════════════════════════      │
│ └────────────────────────────────────────────────────────────────────────────────────┘
└──────────────────────────────────────────────────────────────────────────────────────┘

Layout: Full-bleed map + floating glassmorphism panels
├─ Map:        absolute inset-0
├─ Compass:    fixed top-left, glassmorphism, animated rotation
├─ Altitude:   fixed top-right, glassmorphism, gauge visualization
├─ Speed:      fixed right, glassmorphism
├─ Selected:   fixed center, glassmorphism, animated entry
├─ Alerts:     fixed bottom-left, glassmorphism, stacked notifications
├─ Minimap:    fixed bottom-right, glassmorphism, radar sweep animation
└─ Swimlane:   fixed bottom, glassmorphism, temporal multi-lane
```

### Variant E: Radial Command Interface

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                      │
│                                                                                      │
│                                       ○                                              │
│                             ○              ○                                         │
│                                   ○  ○                                               │
│                         ○              ○     ○                                       │
│                                                                                      │
│                                   ┌──────────────────┐                               │
│                              ╭────│    RADIAL DIAL   │────╮                          │
│                           ╱      └──────────────────┘      ╲                         │
│                         ╱   [Search]              [Layers]   ╲                       │
│                        ╱                                      ╲                      │
│                       │ [Timeline]        ●        [Export]   │                      │
│                        ╲                                      ╱                      │
│                         ╲  [Filter]               [Measure]  ╱                       │
│                           ╲      ┌──────────────┐          ╱                         │
│                              ╰───│   Drag to    │───╯                                │
│                                  │   Select     │                                    │
│                                  └──────────────┘                                    │
│                                                                                      │
│                                                                                      │
│                      ○       ○                                                       │
│                                        ○                                             │
│                              ○                   ○                                   │
│                                                                                      │
│                                                                                      │
└──────────────────────────────────────────────────────────────────────────────────────┘

Interaction Model:
├─ Trigger:      Long-press (500ms) or Right-click
├─ Sections:     6 sections at 60° intervals
├─ Selection:    Drag toward section, release to activate
├─ Animation:    anime.js radial expand from trigger point
├─ Haptics:      navigator.vibrate() on section hover (mobile)
└─ Escape:       Drag back to center or tap outside
```

### Variant F: Network Graph Mode

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ ┌─ HEADER ───────────────────────────────────────────────────────────────────────────┐
│ │ [☰] GEOINT Network    │ Force │ Hierarchical │ Radial │ ⌘K │ Layout Mode         │
│ └────────────────────────────────────────────────────────────────────────────────────┘
│ ┌── FILTERS ──┐┌────────────────── GRAPH ──────────────────────────┐┌── DETAIL ────┐
│ │             ││                                                   ││              │
│ │ Edge Types: ││           ○──────────○                            ││ ╭──────────╮ │
│ │ ☑ Spatial   ││          ╱            ╲                           ││ │ Node     │ │
│ │ ☑ Temporal  ││         ╱              ╲                          ││ │ ──────── │ │
│ │ ☑ Ownership ││        ○                ○                         ││ │ Type:    │ │
│ │ ☑ Comm      ││       ╱ ╲              ╱ ╲                        ││ │ Vessel   │ │
│ │             ││      ╱   ╲            ╱   ╲                       ││ │          │ │
│ │ Strength:   ││     ○─────●──────────○─────○                      ││ │ Edges:   │ │
│ │ ●────────   ││           │                                       ││ │ 4        │ │
│ │ min    max  ││           │                                       ││ │          │ │
│ │             ││           ○                                       ││ │ Cluster: │ │
│ │ Clusters:   ││          ╱ ╲                                      ││ │ Alpha    │ │
│ │ ☑ Alpha     ││         ╱   ╲                                     ││ ╰──────────╯ │
│ │ ☑ Beta      ││        ○─────○                                    ││              │
│ │ ☐ Gamma     ││                                                   ││ ╭──────────╮ │
│ │             ││                                                   ││ │ Actions  │ │
│ │ [Reset]     ││     [Zoom: ●────────] [Fit] [Center]             ││ │ ──────── │ │
│ │             ││                                                   ││ │ Expand   │ │
│ │             ││                                                   ││ │ Collapse │ │
│ └─────────────┘└───────────────────────────────────────────────────┘└──────────────┘
└──────────────────────────────────────────────────────────────────────────────────────┘

Technology: @xyflow/react
├─ Layouts:    dagre (hierarchical), d3-force (physics), radial
├─ Nodes:      Custom React components per entity type
├─ Edges:      Animated, weighted, colored by relationship type
├─ Clusters:   Visual grouping with hull polygons
└─ Controls:   Pan/zoom, minimap, fit view, center selection
```

### Variant G: Split Compare View

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ ┌─ HEADER ───────────────────────────────────────────────────────────────────────────┐
│ │ [☰] GEOINT Compare    │ Side-by-Side │ Swipe │ Flicker │ Overlay │ Diff           │
│ └────────────────────────────────────────────────────────────────────────────────────┘
│ ┌───────────────── PANE A ────────────────┐┌───────────────── PANE B ────────────────┐
│ │                                         ││                                         │
│ │  ╭────────────────────────╮             ││             ╭────────────────────────╮  │
│ │  │ TIME: 2024-01-08 09:00 │             ││             │ TIME: 2024-01-08 15:00 │  │
│ │  ╰────────────────────────╯             ││             ╰────────────────────────╯  │
│ │                                         ││                                         │
│ │           ○    ○                        ││                ○                        │
│ │              ○     ○  ○                 ││           ○    ○    ○                   │
│ │                                         ││              ○     ○  ○                 │
│ │         ○         ○                     ││                                         │
│ │                       ○                 ││         ○         ○                     │
│ │      ○                                  ││              △ △ △       ◁──── CHANGES  │
│ │                                         ││      ○        △                         │
│ │                                         ││                                         │
│ │  ──────────────────────────────────     ││  ──────────────────────────────────     │
│ │  [◀]          ●───────────────    [▶]   ││  [◀]    ───────────────●           [▶]  │
│ │                                         ││                                         │
│ └─────────────────────────────────────────┘└─────────────────────────────────────────┘
│ ┌─ COMPARISON STATS ─────────────────────────────────────────────────────────────────┐
│ │  Entities: 247 → 312 (+65)   │   New: 82   │   Removed: 17   │   Moved: 156       │
│ └────────────────────────────────────────────────────────────────────────────────────┘
└──────────────────────────────────────────────────────────────────────────────────────┘

Comparison Modes:
├─ Side-by-Side:  Two synchronized viewports
├─ Swipe:         Draggable divider reveals comparison
├─ Flicker:       Animated toggle between states (configurable speed)
├─ Overlay:       Alpha-blended overlay with difference highlighting
└─ Diff:          Only show changes (additions/removals/movements)
```

---

## State Machine Architecture

### Machine Hierarchy

```
┌─ dashboardMachine ─────────────────────────────────────────────────────────────────┐
│                                                                                    │
│  ┌─ layoutMachine ────────────┐  ┌─ searchMachine ───────────────────────────────┐ │
│  │  States:                   │  │  States:                                     │ │
│  │  ├─ command                │  │  ├─ idle                                     │ │
│  │  ├─ focus                  │  │  ├─ searching                                │ │
│  │  └─ analytics              │  │  │   ├─ querying (parallel sources)          │ │
│  │                            │  │  │   └─ streaming (live updates)             │ │
│  │  Transitions:              │  │  ├─ filtering                                │ │
│  │  ├─ SET_LAYOUT             │  │  └─ complete                                 │ │
│  │  ├─ TOGGLE_SIDEBAR         │  │                                              │ │
│  │  ├─ TOGGLE_INTEL           │  │  Events:                                     │ │
│  │  └─ TOGGLE_TIMELINE        │  │  ├─ SEARCH { query, bounds, sources }        │ │
│  └────────────────────────────┘  │  ├─ FILTER { filters }                       │ │
│                                  │  ├─ SELECT_RESULT { id }                     │ │
│  ┌─ entityDetailMachine ──────┐  │  └─ CLEAR                                    │ │
│  │  States:                   │  └───────────────────────────────────────────────┘ │
│  │  ├─ loading                │                                                    │
│  │  ├─ tabs                   │  ┌─ timelineMachine ─────────────────────────────┐ │
│  │  │   ├─ info               │  │  States:                                     │ │
│  │  │   ├─ history            │  │  ├─ idle                                     │ │
│  │  │   ├─ relations          │  │  ├─ playing                                  │ │
│  │  │   └─ actions            │  │  ├─ paused                                   │ │
│  │  └─ closed                 │  │  └─ scrubbing                                │ │
│  │                            │  │                                              │ │
│  │  Events:                   │  │  Events:                                     │ │
│  │  ├─ SELECT_ENTITY          │  │  ├─ PLAY / PAUSE / STOP                      │ │
│  │  ├─ CHANGE_TAB             │  │  ├─ SEEK { time }                            │ │
│  │  └─ CLOSE                  │  │  ├─ SET_SPEED { multiplier }                 │ │
│  └────────────────────────────┘  │  └─ SET_RANGE { start, end }                 │ │
│                                  └───────────────────────────────────────────────┘ │
│                                                                                    │
│  ┌─ filterBarMachine ─────────┐  ┌─ radialDialMachine ───────────────────────────┐ │
│  │  States:                   │  │  States:                                     │ │
│  │  ├─ collapsed              │  │  ├─ hidden                                   │ │
│  │  ├─ expanded               │  │  ├─ appearing                                │ │
│  │  └─ editing                │  │  ├─ visible                                  │ │
│  │                            │  │  │   ├─ idle                                 │ │
│  │  Events:                   │  │  │   ├─ hovering { section }                 │ │
│  │  ├─ TOGGLE                 │  │  │   └─ selecting                            │ │
│  │  ├─ SET_PRESET             │  │  └─ disappearing                             │ │
│  │  ├─ ADD_FILTER             │  │                                              │ │
│  │  └─ REMOVE_FILTER          │  │  Events:                                     │ │
│  └────────────────────────────┘  │  ├─ TRIGGER { position }                     │ │
│                                  │  ├─ MOVE { angle, distance }                 │ │
│                                  │  ├─ SELECT { section }                       │ │
│                                  │  └─ CANCEL                                   │ │
│                                  └───────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────────────┘
```

### Effect-Atom Integration

```typescript
// Registry pattern for GEOINT state
export const geointRegistry = Registry.make()

// Core atoms
export const layoutModeAtom = Atom.make<LayoutMode>('command')
export const searchQueryAtom = Atom.make<string>('')
export const searchResultsAtom = Atom.make<SearchResultItem[]>([])
export const selectedEntityAtom = Atom.make<SearchResultItem | null>(null)
export const timelineRangeAtom = Atom.make<[number, number]>([0, Date.now()])

// Derived atoms
export const filteredResultsAtom = Atom.computed((get) => {
  const results = get(searchResultsAtom)
  const filters = get(activeFiltersAtom)
  return applyFilters(results, filters)
})

export const resultsBySourceAtom = Atom.computed((get) => {
  const results = get(filteredResultsAtom)
  return groupBy(results, r => r.source)
})

export const sourceCountsAtom = Atom.computed((get) => {
  const bySource = get(resultsBySourceAtom)
  return Object.entries(bySource).map(([source, items]) => ({
    source,
    count: items.length
  }))
})
```

---

## Animation Choreography

### Layout Transition: Command → Focus

```typescript
const commandToFocus = anime.timeline({
  easing: 'easeOutQuint',
  duration: 400
})

// Phase 1: Collapse panels (parallel)
.add({
  targets: '.sidebar',
  width: [320, 0],
  opacity: [1, 0],
  translateX: [0, -20],
}, 0)
.add({
  targets: '.intel-panel',
  width: [380, 0],
  opacity: [1, 0],
  translateX: [0, 20],
}, 0)

// Phase 2: Expand map
.add({
  targets: '.map-container',
  scale: [1, 1.02],
  duration: 200,
}, 200)

// Phase 3: Float in panels (staggered)
.add({
  targets: '.floating-panel',
  translateY: [30, 0],
  opacity: [0, 1],
  scale: [0.95, 1],
  delay: anime.stagger(80),
  duration: 300,
}, 400)
```

### Result List Stagger

```typescript
const resultsEnter = anime({
  targets: '.result-item',
  translateX: [-20, 0],
  opacity: [0, 1],
  delay: anime.stagger(30, { start: 100 }),
  duration: 250,
  easing: 'easeOutCubic'
})
```

### Entity Selection

```typescript
const entitySelect = anime.timeline()
  // Ring pulse on map
  .add({
    targets: '.selection-ring',
    scale: [0.8, 1.1, 1],
    opacity: [0, 1],
    borderWidth: [0, 3, 2],
    duration: 400,
    easing: 'easeOutElastic(1, 0.5)'
  })
  // Detail card slide
  .add({
    targets: '.entity-detail-card',
    translateX: [40, 0],
    opacity: [0, 1],
    duration: 300,
    easing: 'easeOutQuint'
  }, '-=200')
```

### Radial Dial Expand

```typescript
const radialExpand = anime({
  targets: '.radial-section',
  scale: [0, 1],
  rotate: (el, i) => [0, i * 60],
  opacity: [0, 1],
  delay: anime.stagger(50),
  duration: 300,
  easing: 'easeOutBack'
})
```

---

## Design Tokens

```typescript
// tokens.ts
export const GEOINT_TOKENS = {
  // Timing
  timing: {
    instant: 100,
    fast: 200,
    normal: 300,
    slow: 500,
    stagger: 30,
  },

  // Easing (anime.js compatible)
  easing: {
    out: 'easeOutQuint',
    in: 'easeInQuint',
    bounce: 'easeOutElastic(1, 0.5)',
    back: 'easeOutBack',
  },

  // Source colors
  sourceColors: {
    track: '#3B82F6',     // Blue
    osm: '#10B981',       // Emerald
    opensky: '#F59E0B',   // Amber
    ais: '#8B5CF6',       // Violet
    sigint: '#EF4444',    // Red
    humint: '#EC4899',    // Pink
    imagery: '#6366F1',   // Indigo
  },

  // Priority colors
  priorityColors: {
    critical: '#EF4444',
    high: '#F59E0B',
    medium: '#3B82F6',
    low: '#6B7280',
  },

  // Panel sizes
  panels: {
    sidebar: { collapsed: 48, expanded: 320 },
    intel: { collapsed: 48, expanded: 380 },
    timeline: { collapsed: 0, expanded: 64 },
  },

  // Glassmorphism
  glass: {
    background: 'rgba(15, 15, 20, 0.85)',
    border: 'rgba(255, 255, 255, 0.1)',
    blur: '12px',
  }
}
```

---

## Current Implementation Status

### Completed Components (✓)

| Component | XState | Atoms | Animations | Tests |
|-----------|--------|-------|------------|-------|
| GeointShell | ✓ layoutMachine | ✓ layoutAtoms | ✓ layoutTransitions | ○ |
| SearchPanelCompound | ✓ searchFormMachine | ✓ searchAtoms | ○ | ○ |
| VirtualizedResultsList | ○ | ✓ resultsAtom | ○ | ○ |
| EntityDetailCard | ✓ entityDetailMachine | ✓ selectedEntityAtom | ✓ tab transitions | ○ |
| FilterBar | ✓ filterBarMachine | ✓ filterAtoms | ○ | ○ |
| TimelinePanel | ✓ timelineMachine | ✓ timelineAtoms | ✓ playback | ○ |
| RadialCommandDial | ✓ radialDialMachine | ○ | ✓ expand/collapse | ○ |
| ImmersiveHUD | ✓ immersiveHudMachine | ✓ overlayAtoms | ✓ glassmorphism | ○ |
| SwimlaneTimeline | ✓ swimlaneMachine | ✓ laneAtoms | ✓ playback | ○ |
| NetworkGraph | ✓ networkGraphMachine | ✓ graphAtoms | ✓ d3-force | ○ |
| SplitCompareView | ✓ splitCompareMachine | ✓ compareAtoms | ✓ swipe/flicker | ○ |
| MissionPlanner | ✓ missionPlannerMachine | ✓ objectiveAtoms | ○ | ○ |
| FusionView | ✓ fusionViewMachine | ✓ correlationAtoms | ○ | ○ |
| TemporalHeatmap | ✓ heatmapMachine | ✓ heatmapAtoms | ✓ playback | ○ |

Legend: ✓ = Implemented, ○ = Not implemented / Pending

---

## Integration Gaps & Prioritized Next Steps

### Priority 1: Core UX Polish (Week 1)

| Task | Files | Impact |
|------|-------|--------|
| Add stagger animations to VirtualizedResultsList | VirtualizedResultsList.tsx | High - improves perceived performance |
| Wire FilterBar to searchMachine filters | FilterBar.tsx, searchMachine.ts | High - enables advanced filtering |
| Implement entity selection map highlight | GeointMap.tsx, atoms/index.ts | High - visual feedback |
| Add timeline ↔ map temporal sync | TimelinePanel.tsx, GeointMap.tsx | Medium - temporal exploration |

**Implementation Pattern:**
```typescript
// VirtualizedResultsList stagger animation
const resultsEnter = () => animate({
  targets: '.result-item',
  translateX: [-20, 0],
  opacity: [0, 1],
  delay: stagger(30, { start: 100 }),
  duration: 250,
  easing: EASING.out
})
```

### Priority 2: Novel Interface Integration (Week 2)

| Task | Files | Impact |
|------|-------|--------|
| Integrate RadialCommandDial with entity context | RadialCommandDial.tsx, EntityDetailCard.tsx | High - power user workflow |
| Add ImmersiveHUD mode toggle to layout | GeointShell.tsx, ImmersiveHUD.tsx | Medium - tactical workflow |
| Wire NetworkGraph to entity relationships | NetworkGraph.tsx, CorrelationView.tsx | Medium - analysis workflow |
| Enable SplitCompareView temporal sync | SplitCompareView.tsx, timelineMachine.ts | Medium - comparison workflow |

**Integration Pattern:**
```typescript
// RadialCommandDial + EntityDetailCard integration
const handleEntityAction = useCallback((entity: ComposedEntity) => {
  // Show radial dial on Ctrl+Click
  if (event.ctrlKey) {
    setDialOpen(true)
    setDialPosition({ x: event.clientX, y: event.clientY })
    setDialEntity(entity)
  }
}, [])
```

### Priority 3: Animation Choreography (Week 3)

| Task | Files | Impact |
|------|-------|--------|
| Complete layout transition timelines | layoutTransitions.ts | High - polish |
| Add panel collapse/expand spring physics | GeointShell.tsx, tokens.ts | Medium - feel |
| Implement entity selection orchestration | EntityDetailCard.tsx, GeointMap.tsx | Medium - feedback |
| Add microinteractions to buttons/toggles | Various | Low - delight |

**Timing Tokens:**
```typescript
export const ANIMATION_TOKENS = {
  // Durations
  instant: 100,
  fast: 200,
  normal: 300,
  slow: 500,

  // Stagger
  staggerItem: 30,
  staggerPanel: 80,

  // Spring configs (for motion.dev)
  springDefault: { stiffness: 300, damping: 30 },
  springBouncy: { stiffness: 400, damping: 20 },
  springStiff: { stiffness: 500, damping: 35 },
}
```

### Priority 4: Testing & Verification (Week 4)

| Task | Tool | Coverage |
|------|------|----------|
| Layout variant visual tests | Playwriter | All 3 layouts |
| Keyboard navigation tests | Playwriter | All shortcuts |
| Animation performance profiling | Chrome DevTools | 60fps target |
| A11y audit (ARIA, focus management) | Playwriter + axe | WCAG 2.1 AA |
| Mobile/touch interaction tests | Playwriter (mobile emulation) | Radial dial, panels |

**Playwriter Test Script:**
```typescript
// Layout transition test
await page.goto('http://localhost:5173/testbed/geoint')

// Command → Focus transition
await page.keyboard.press('Meta+1')
await screenshotWithAccessibilityLabels({ page })

await page.keyboard.press('Meta+2')
await page.waitForTimeout(500) // Wait for animation
await screenshotWithAccessibilityLabels({ page })

// Verify floating panels
const floatingPanels = await page.locator('[data-floating-panel]').count()
expect(floatingPanels).toBeGreaterThan(0)

// Test radial dial
await page.locator('.result-item').first().click({ modifiers: ['Control'] })
await page.waitForSelector('.radial-dial')
await screenshotWithAccessibilityLabels({ page })
```

---

## Component Interaction Map

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              GEOINT INTERACTION FLOW                                │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐       │
│  │   Search    │────▶│   Filter    │────▶│   Results   │────▶│   Entity    │       │
│  │   Input     │     │    Bar      │     │    List     │     │   Detail    │       │
│  └──────┬──────┘     └──────┬──────┘     └──────┬──────┘     └──────┬──────┘       │
│         │                   │                   │                   │              │
│         │                   │                   │                   │              │
│         ▼                   ▼                   ▼                   ▼              │
│  ┌──────────────────────────────────────────────────────────────────────────┐      │
│  │                        searchMachine (XState)                            │      │
│  │  ┌──────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────┐       │      │
│  │  │ idle │──▶│searching │──▶│streaming │──▶│ complete │──▶│ idle │       │      │
│  │  └──────┘   └──────────┘   └──────────┘   └──────────┘   └──────┘       │      │
│  └──────────────────────────────────────────────────────────────────────────┘      │
│                                      │                                              │
│                                      ▼                                              │
│  ┌──────────────────────────────────────────────────────────────────────────┐      │
│  │                         geointRegistry (Atoms)                           │      │
│  │  searchResultsAtom ◄── selectedEntityAtom ◄── filteredResultsAtom       │      │
│  │         │                      │                      │                  │      │
│  │         ▼                      ▼                      ▼                  │      │
│  │  ┌──────────┐          ┌──────────┐          ┌──────────┐               │      │
│  │  │ Map Layer│          │Entity Card│         │ Stats    │               │      │
│  │  │ Markers  │          │  Content  │         │ Widget   │               │      │
│  │  └──────────┘          └──────────┘          └──────────┘               │      │
│  └──────────────────────────────────────────────────────────────────────────┘      │
│                                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                        NOVEL INTERFACES                                      │   │
│  │                                                                              │   │
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐  ┌──────────────┐  │   │
│  │  │ Radial Dial   │  │ Immersive HUD │  │ Network Graph │  │ Split Compare│  │   │
│  │  │ (Ctrl+Click)  │  │ (⌘4 toggle)   │  │ (relations)   │  │ (temporal)   │  │   │
│  │  └───────────────┘  └───────────────┘  └───────────────┘  └──────────────┘  │   │
│  │                                                                              │   │
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐                    │   │
│  │  │ Mission Plan  │  │ Fusion View   │  │ Heatmap       │                    │   │
│  │  │ (workflow)    │  │ (correlation) │  │ (temporal)    │                    │   │
│  │  └───────────────┘  └───────────────┘  └───────────────┘                    │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Testing Strategy (Playwriter)

```typescript
// Test layout transitions
await page.goto('http://localhost:5173/testbed/geoint')

// Command layout
await page.keyboard.press('Meta+1')
await screenshotWithAccessibilityLabels({ page })

// Focus layout
await page.keyboard.press('Meta+2')
await page.waitForTimeout(500) // Animation
await screenshotWithAccessibilityLabels({ page })

// Analytics layout
await page.keyboard.press('Meta+3')
await page.waitForTimeout(500)
await screenshotWithAccessibilityLabels({ page })

// Test search flow
await page.locator('aria-ref=searchInput').fill('vessel')
await page.keyboard.press('Enter')
await page.waitForSelector('.result-item')
await screenshotWithAccessibilityLabels({ page })

// Test entity selection
await page.locator('.result-item').first().click()
await page.waitForSelector('.entity-detail-card')
await screenshotWithAccessibilityLabels({ page })
```
