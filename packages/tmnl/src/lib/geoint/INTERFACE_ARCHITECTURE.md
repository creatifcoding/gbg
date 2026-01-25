# GEOINT Interface Architecture

## Overview

This document defines the complete interface architecture for the GEOINT (Geospatial Intelligence) system,
including layout variants, component hierarchies, state management, and animation orchestration.

---

## 1. Layout Variants

### Variant A: Command Center (Default)

The primary operational layout with full panel visibility for comprehensive situational awareness.

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ ┌─────────────────────────────────────── HEADER ──────────────────────────────────┐ │
│ │  ☰  TMNL GEOINT    │    ⌘K Search anywhere...           │ ◉ LIVE │ ⚙ │ ? │ 👤   │ │
│ └────────────────────────────────────────────────────────────────────────────────────┘ │
│ ┌── SIDEBAR 320px ──┐┌─────────────────── MAP ─────────────────────┐┌─ INTEL 380px ─┐ │
│ │                   ││                                             ││               │ │
│ │  ╭─ Search ──────╮││                                             ││ ╭─ Entity ───╮│ │
│ │  │ 🔍 __________ │││            ┌─────────────┐                  ││ │            ││ │
│ │  │               │││            │  Selected   │                  ││ │ TRACK-0042 ││ │
│ │  │ Sources:      │││            │   Entity    │◄─────────────────┼┼─│ ─────────  ││ │
│ │  │ ○ Track  (42) │││            │     ●       │                  ││ │            ││ │
│ │  │ ● OSM   (128) │││            └─────────────┘                  ││ │ [Overview] ││ │
│ │  │ ● OpenSky(16) │││                                             ││ │ [History]  ││ │
│ │  │ ○ Feature (8) │││       ○ ○         ○                         ││ │ [Links]    ││ │
│ │  ╰────────────────╯││          ○    ○     ○ ○                    ││ │ [Raw]      ││ │
│ │                   ││                                             ││ ╰────────────╯│ │
│ │  ╭─ Layers ──────╮││                       ○                     ││               │ │
│ │  │ ☑ Tracks      │││                                             ││ ╭─ Results ──╮│ │
│ │  │ ☑ POI         │││           ○    ○                            ││ │            ││ │
│ │  │ ☐ Imagery     │││                                             ││ │ ▸ Track 01 ││ │
│ │  │ ☑ Weather     │││                                             ││ │ ▸ Track 02 ││ │
│ │  │ ☐ Terrain     │││                         ○                   ││ │ ▸ POI A    ││ │
│ │  ╰────────────────╯││                                             ││ │ ▸ POI B    ││ │
│ │                   ││                                             ││ │ ▸ Flight X ││ │
│ │  ╭─ Stats ───────╮││                                             ││ │   ...      ││ │
│ │  │ Entities: 247 │││                                             ││ ╰────────────╯│ │
│ │  │ ◉ Live: 12    │││                                             ││               │ │
│ │  │ ▲ +3 /5min    │││                                             ││ [⬇ Export]   │ │
│ │  ╰────────────────╯││                                             ││ [📋 Copy]    │ │
│ └───────────────────┘└─────────────────────────────────────────────┘└───────────────┘ │
│ ┌────────────────────────────── TIMELINE DRAWER (60px) ─────────────────────────────┐ │
│ │ [◀][▶▶] ═══════════●═══════════════════════════════ 2h │ 12h │ 24h │ 7d │ Custom │ │
│ └────────────────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────────────┘

CSS Grid:
  grid-template-columns: 320px 1fr 380px
  grid-template-rows: auto 1fr 60px
  grid-template-areas:
    "header  header  header"
    "sidebar map     intel"
    "timeline timeline timeline"
```

### Variant B: Focus Mode (Minimalist)

Clean map-focused view with floating panels for distraction-free operation.

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                      │
│                              ┌──────────────────────────┐                            │
│                              │     ⌘K Quick Search      │                            │
│                              └──────────────────────────┘                            │
│                                                                                      │
│   ╭───────────────╮                                          ╭────────────────────╮  │
│   │ ◐ Layers      │                                          │   Entity Detail    │  │
│   │───────────────│                                          │────────────────────│  │
│   │ ○ Tracks      │                                          │                    │  │
│   │ ● POI         │                      MAP                 │   TRACK-0042       │  │
│   │ ○ Flights     │                 (Full Screen)            │   ══════════       │  │
│   │               │                                          │                    │  │
│   │               │                                          │   Type: Maritime   │  │
│   │ [+ Add Layer] │                  ○     ○                 │   Lat: 34.0522     │  │
│   ╰───────────────╯                      ●───► Selected      │   Lon: -118.2437   │  │
│                                      ○  ○     ○              │                    │  │
│                                                              │   [View History]   │  │
│                                                              │   [Track on Map]   │  │
│                                                              ╰────────────────────╯  │
│                                                                                      │
│   ╭───────────────────────────────────────────────────────────────────────────────╮  │
│   │  [◀] [▶] ════●════════════════════════════════════════════  Timeline Panel   │  │
│   ╰───────────────────────────────────────────────────────────────────────────────╯  │
│                                                                                      │
│                       [ESC to show panels]   [⌘1 Command]   [⌘2 Focus]               │
└──────────────────────────────────────────────────────────────────────────────────────┘

Layout: Floating panels with absolute positioning
  - Map: position: absolute; inset: 0
  - Panels: position: fixed; draggable; resizable
  - Hotkey hints: position: fixed; bottom: 16px; center
```

### Variant C: Analytics Dashboard

Data-heavy layout optimized for analysis and reporting.

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ ┌─────────────────────────────────────── HEADER ──────────────────────────────────┐ │
│ │  ☰  TMNL Analytics    │ ⌘K │ Dashboard │ Command │ Focus │ ◉ LIVE │ Export ▼   │ │
│ └────────────────────────────────────────────────────────────────────────────────────┘ │
│ ┌────────────────── MAP (55%) ─────────────────┐┌──────── STATS GRID (45%) ─────────┐ │
│ │                                              ││ ┌─────────────┐ ┌─────────────┐   │ │
│ │                                              ││ │   TRACKS    │ │   SOURCES   │   │ │
│ │                                              ││ │    247      │ │  ████████░  │   │ │
│ │            ○    ○                            ││ │   ▲ 12%     │ │  6 active   │   │ │
│ │               ○     ○  ○                     ││ └─────────────┘ └─────────────┘   │ │
│ │                                              ││ ┌─────────────┐ ┌─────────────┐   │ │
│ │         ○         ○                          ││ │   ALERTS    │ │  COVERAGE   │   │ │
│ │                       ○                      ││ │     3       │ │    87%      │   │ │
│ │      ○                                       ││ │   ⚠ High    │ │  ████████░  │   │ │
│ │                                              ││ └─────────────┘ └─────────────┘   │ │
│ └──────────────────────────────────────────────┘└────────────────────────────────────┘ │
│ ┌──────────────── RESULTS TABLE ───────────────┐┌───────── SOURCE BREAKDOWN ────────┐ │
│ │ ┌────┬───────────┬────────┬──────┬─────────┐ ││                                   │ │
│ │ │ ID │ Name      │ Source │ Conf │ Updated │ ││   Track    ████████████░░  68%    │ │
│ │ ├────┼───────────┼────────┼──────┼─────────┤ ││   OSM      ████████░░░░░░  52%    │ │
│ │ │ 01 │ Target A  │ Track  │ 0.95 │ 2m ago  │ ││   OpenSky  █████░░░░░░░░░  21%    │ │
│ │ │ 02 │ POI B     │ OSM    │ 0.88 │ 5m ago  │ ││   Feature  ███░░░░░░░░░░░  12%    │ │
│ │ │ 03 │ Flight X  │ OpenSky│ 0.92 │ 1m ago  │ ││                                   │ │
│ │ │ .. │ ...       │ ...    │ ...  │ ...     │ ││   [Detailed Analysis →]           │ │
│ │ └────┴───────────┴────────┴──────┴─────────┘ ││                                   │ │
│ │ Showing 1-50 of 247              [< > >>]    ││   ╭─ Trend ───────────────────╮   │ │
│ └──────────────────────────────────────────────┘│   │    ╱╲    ╱╲  ╱            │   │ │
│ ┌──────────────── TEMPORAL CHART ──────────────┐│   │ ╱╲╱  ╲╱╲╱  ╲╱             │   │ │
│ │   ▁▂▃▄▅▆▇█▇▆▅▄▃▂▁▂▃▄▅▆▇▆▅▄▃▂▁▂▃▄▅▆▇█▇▆▅▄▃▂▁│   │   24h activity             │   │ │
│ │   00:00        06:00        12:00      18:00 │   ╰────────────────────────────╯   │ │
│ └──────────────────────────────────────────────┘└────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────────────┘

CSS Grid:
  grid-template-columns: 55% 45%
  grid-template-rows: auto 1fr 1fr 120px
  gap: 16px
```

---

## 2. Component Hierarchy

### Search System

```
SearchPanelCompound.Root
├── SearchPanelCompound.Input          # cmdk-powered input
│   ├── Icon (Search/Spinner)
│   ├── Input field
│   └── Clear button
├── SearchPanelCompound.SourceFilters   # Source toggle chips
│   └── SourceChip × N
│       ├── Icon
│       ├── Label
│       ├── Count badge
│       └── Toggle state
├── SearchPanelCompound.AdvancedFilters # Collapsible advanced options
│   ├── Classification filter
│   ├── Confidence slider
│   ├── Date range picker
│   └── Spatial bounds selector
├── SearchPanelCompound.Results         # Virtualized result list
│   └── VirtualizedResultsList.Root
│       ├── VirtualizedResultsList.Header
│       │   ├── ViewModeToggle
│       │   ├── SortDropdown
│       │   └── ResultCount
│       └── VirtualizedResultsList.List
│           └── ResultCard × N (virtualized)
└── SearchPanelCompound.Actions         # Bulk actions
    ├── SelectAll
    ├── ExportSelected
    └── ClearSelection
```

### Entity Detail System

```
EntityDetailCard.Root
├── EntityDetailCard.Header
│   ├── TypeIcon
│   ├── Title
│   ├── Subtitle (source + confidence)
│   ├── ExpandButton
│   └── CloseButton
├── EntityDetailCard.Tabs               # XState-managed tabs
│   ├── Tab: Overview
│   ├── Tab: History
│   ├── Tab: Relations
│   └── Tab: Raw
├── EntityDetailCard.Content            # Tab content (animated)
│   ├── EntityDetailCard.Overview
│   │   ├── PropertyGrid
│   │   ├── LocationDisplay
│   │   └── QuickActions
│   ├── EntityDetailCard.History
│   │   └── TimelineView
│   ├── EntityDetailCard.Relations
│   │   └── GraphView
│   └── EntityDetailCard.Raw
│       └── JSONViewer
└── EntityDetailCard.Actions
    ├── TrackOnMap
    ├── AddToCollection
    └── ShareEntity
```

### Layer Control System

```
LayerPaletteCompound.Root
├── LayerPaletteCompound.Header
│   ├── Title
│   └── AddLayerButton
├── LayerPaletteCompound.LayerGroup × N
│   ├── GroupHeader (collapsible)
│   └── LayerItem × N
│       ├── VisibilityToggle
│       ├── LayerIcon
│       ├── LayerName
│       ├── OpacitySlider
│       └── LayerMenu (⋮)
│           ├── Zoom to layer
│           ├── Layer settings
│           └── Remove layer
└── LayerPaletteCompound.Footer
    ├── BaseMapSelector
    └── LayerOpacityAll
```

### Timeline System

```
TimelinePanel.Root
├── TimelinePanel.Controls
│   ├── PlayPauseButton
│   ├── StepBackButton
│   ├── StepForwardButton
│   ├── SpeedControl
│   └── PresetSelector
├── TimelinePanel.Track
│   ├── RangeBackground
│   ├── DataVisualization (density heatmap)
│   ├── SelectionBrush
│   ├── PlayheadMarker
│   └── TimeLabels
└── TimelinePanel.RangeDisplay
    ├── StartTime
    ├── EndTime
    └── DurationBadge
```

---

## 3. State Management Architecture

### Atom Registry Structure

```
geointRegistry (Service-Scoped)
│
├── Layout State
│   ├── layoutModeAtom: 'command' | 'focus' | 'analytics'
│   ├── sidebarStateAtom: { collapsed, width, activeSection }
│   ├── intelPanelStateAtom: { collapsed, width, activeTab }
│   ├── timelineStateAtom: { collapsed, height, range }
│   └── animationPhaseAtom: 'idle' | 'enter' | 'exit' | 'transition'
│
├── Search State
│   ├── searchQueryAtom: string
│   ├── searchStatusAtom: 'idle' | 'searching' | 'complete' | 'error'
│   ├── searchBoundsAtom: BBox | null
│   ├── activeSourcesAtom: Set<IntelSource>
│   ├── resultsAtom: SearchResultItem[]
│   ├── filteredResultsAtom: SearchResultItem[] (derived)
│   ├── sourceCountsAtom: Record<IntelSource, number> (derived)
│   └── searchErrorAtom: Error | null
│
├── Selection State
│   ├── selectedEntityAtom: EntityId | null
│   ├── hoveredEntityAtom: EntityId | null
│   ├── multiSelectAtom: Set<EntityId>
│   └── selectionModeAtom: 'single' | 'multi' | 'area'
│
├── Filter State
│   ├── filtersAtom: FilterBarState
│   ├── activeFilterCountAtom: number (derived)
│   └── filterPresetsAtom: FilterPreset[]
│
├── Timeline State
│   ├── timelineRangeAtom: { start: Date, end: Date }
│   ├── playheadAtom: Date
│   ├── isPlayingAtom: boolean
│   └── playbackSpeedAtom: number
│
└── Floating Panels (Focus Mode)
    ├── floatingPanelsAtom: Map<PanelId, PanelState>
    └── activePanelAtom: PanelId | null
```

### XState Machine Hierarchy

```
dashboardMachine (Root Orchestrator)
├── layoutMachine (Layout Transitions)
│   ├── States: command | focus | analytics
│   ├── Events: SET_LAYOUT, TOGGLE_PANEL, KEYBOARD_SHORTCUT
│   └── Actions: animateTransition, persistLayout
│
├── searchMachine (Search Workflow)
│   ├── States: idle | debouncing | searching | complete | error
│   ├── Events: QUERY_CHANGE, EXECUTE_SEARCH, SOURCE_TOGGLE
│   └── Actors: fetchSuggestions, executeSearch
│
├── entityDetailMachine (Entity Panel)
│   ├── States: idle | animating | loading
│   ├── Events: TAB_CHANGE, KEYBOARD, CLOSE
│   └── Animation: exit → enter → complete
│
└── searchFormMachine (Form UI)
    ├── States: idle | debouncing | fetchingSuggestions | validating
    ├── Events: QUERY_CHANGE, SUGGESTION_SELECT, SUBMIT
    └── Actors: fetchSuggestions, validateForm
```

---

## 4. Animation Tokens

### Timing (ms)

```
TIMING = {
  instant:  0,
  fast:     100,
  normal:   200,
  slow:     400,
  panel:    300,     // Panel expand/collapse
  stagger:  50,      // Stagger between items
}
```

### Easing

```
EASING = {
  anime: {
    in:     'easeInQuad',
    out:    'easeOutQuad',
    inOut:  'easeInOutQuad',
    bounce: 'easeOutBack',
  },
  css: {
    in:     'cubic-bezier(0.4, 0, 1, 1)',
    out:    'cubic-bezier(0, 0, 0.2, 1)',
    inOut:  'cubic-bezier(0.4, 0, 0.2, 1)',
    bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  }
}
```

### Animation Presets

```
ANIMATIONS = {
  fadeIn:         { opacity: [0, 1], duration: TIMING.normal },
  fadeOut:        { opacity: [1, 0], duration: TIMING.fast },
  slideInRight:   { translateX: [20, 0], opacity: [0, 1], duration: TIMING.normal },
  slideOutLeft:   { translateX: [0, -20], opacity: [1, 0], duration: TIMING.fast },
  scaleIn:        { scale: [0.95, 1], opacity: [0, 1], duration: TIMING.normal },
  scaleOut:       { scale: [1, 0.95], opacity: [1, 0], duration: TIMING.fast },
  highlight:      { backgroundColor: ['transparent', 'rgba(255,255,255,0.1)', 'transparent'] },
  selectionRing:  { scale: [0.8, 1], opacity: [0, 1], borderWidth: [0, 2] },
}
```

---

## 5. Keyboard Shortcuts

### Global

| Key | Action |
|-----|--------|
| `⌘K` | Open command palette / quick search |
| `⌘1` | Switch to Command layout |
| `⌘2` | Switch to Focus layout |
| `⌘3` | Switch to Analytics layout |
| `⌘B` | Toggle sidebar |
| `⌘E` | Toggle entity panel |
| `⌘L` | Toggle layers panel |
| `⌘T` | Toggle timeline |
| `Escape` | Close modals / deselect |

### Search Panel

| Key | Action |
|-----|--------|
| `⌘F` | Focus search input |
| `↓/↑` | Navigate suggestions |
| `Enter` | Select suggestion / execute search |
| `⌘Enter` | Execute search (force) |

### Entity Detail

| Key | Action |
|-----|--------|
| `1-4` | Switch tabs (Overview/History/Relations/Raw) |
| `←/→` | Navigate tabs |
| `⌘C` | Copy entity data |
| `Escape` | Close detail panel |

### Results List

| Key | Action |
|-----|--------|
| `↓/↑` | Navigate results |
| `Enter` | Select result |
| `Space` | Toggle selection (multi-select mode) |
| `⌘A` | Select all |

---

## 6. Responsive Breakpoints

```
sm:  640px   // Mobile landscape
md:  768px   // Tablet portrait
lg:  1024px  // Tablet landscape / small desktop
xl:  1280px  // Desktop
2xl: 1536px  // Large desktop

Layout Adaptations:
- < md:  Stack layout, bottom sheet for panels
- md-lg: Sidebar collapses to icons, intel panel as drawer
- lg-xl: Full Command Center layout
- > xl:  Analytics layout with expanded stats
```

---

## 7. Component Variants Summary

### SearchPanel Variants

```
┌─ Variant: Expanded (Default) ────┐   ┌─ Variant: Collapsed ─┐
│ 🔍 Search entities...            │   │ 🔍 (icon only)       │
│ ─────────────────────────────────│   │ ● 247 results        │
│ Sources:                         │   └──────────────────────┘
│ ○ Track (42)  ● OSM (128)       │
│ ● OpenSky (16)  ○ Feature (8)   │   ┌─ Variant: Floating ───┐
│ ─────────────────────────────────│   │ 🔍 _________________ │
│ ▼ Advanced Filters               │   │ [Track] [OSM] [Sky]  │
│   Classification: [All ▼]        │   │ ● 247 matching       │
│   Confidence:     [0.5 ━━━━●]    │   └──────────────────────┘
│   Date range:     [Last 24h ▼]   │
└──────────────────────────────────┘
```

### StatsWidget Variants

```
┌─ Variant: Counter ─┐   ┌─ Variant: Breakdown ──┐   ┌─ Variant: Sparkline ─┐
│  TRACKS            │   │  BY SOURCE            │   │  ACTIVITY           │
│    247             │   │  Track  ████████░ 65% │   │  ▁▂▃▄▅▆▇█▇▆▅▄▃▂▁   │
│   ▲ +12%           │   │  OSM    ████░░░░░ 23% │   │  Last 24 hours      │
└────────────────────┘   │  OpenSky██░░░░░░░  8% │   └─────────────────────┘
                         └───────────────────────┘

┌─ Variant: Circular ──┐   ┌─ Variant: Live ─────────┐
│      ╭───╮           │   │  ◉ LIVE                 │
│     ╱     ╲          │   │  12 active feeds        │
│    │  87%  │         │   │  Updated: 2s ago        │
│     ╲     ╱          │   │  ▸▸▸▸▸▸▸▸▸▸▸▸▸▸▸▸▸▸▸▸ │
│      ╰───╯           │   └─────────────────────────┘
│   Coverage           │
└──────────────────────┘
```

### ResultCard Variants

```
┌─ Variant: Compact ──────────────────────────────────────────────────────┐
│ ● TRACK-0042    Maritime Vessel    Track    0.95    2m ago     [☐][⋮] │
└─────────────────────────────────────────────────────────────────────────┘

┌─ Variant: Expanded ─────────────────────────────────────────────────────┐
│ ●  TRACK-0042                                              [☐] [⋮]     │
│    Maritime Vessel - Container Ship                                     │
│    ─────────────────────────────────────────────────────────            │
│    Source: Track System        Confidence: 95%                          │
│    Position: 34.0522, -118.2437                                         │
│    Last Updated: 2 minutes ago                                          │
│    [View on Map]  [Add to Collection]  [Export]                         │
└─────────────────────────────────────────────────────────────────────────┘

┌─ Variant: Grid Card ────────────────┐
│  ┌──────────────────────────────┐  │
│  │         🚢                    │  │
│  │    Maritime Vessel           │  │
│  └──────────────────────────────┘  │
│  TRACK-0042                        │
│  Track • 95% • 2m ago              │
└─────────────────────────────────────┘
```

---

## 8. Implementation Checklist

### Phase 1: Core Infrastructure ✅
- [x] GeointShell compound component
- [x] layoutMachine XState machine
- [x] Layout atoms (geointRegistry)
- [x] anime.js v4 transition orchestrations

### Phase 2: Search Enhancement 🔄
- [x] SearchFormMachine (form orchestration)
- [ ] cmdk integration for autocomplete
- [ ] Advanced filters collapsible section
- [ ] Search history persistence

### Phase 3: Results & Selection 🔄
- [x] VirtualizedResultsList with view modes
- [x] EntityDetailCard with XState tabs
- [ ] Multi-select action bar
- [ ] Bulk operations (export, collect)

### Phase 4: Timeline & Playback
- [ ] TimelinePanel brush selection
- [ ] Playback controls with speed
- [ ] Temporal density visualization
- [ ] Time-based filtering integration

### Phase 5: Stats & Analytics
- [x] StatsWidget compound components
- [x] AnimatedDigitCounter
- [x] MultiSparkline
- [ ] Real-time data integration

### Phase 6: Polish & Testing
- [ ] Keyboard navigation complete
- [ ] Responsive adaptations
- [ ] Performance optimization
- [ ] Playwriter visual regression tests

---

## 9. File Structure

```
src/lib/geoint/
├── atoms/
│   ├── index.ts              # Main atom exports
│   ├── layoutAtoms.ts        # Layout state atoms
│   ├── searchAtoms.ts        # Search state atoms
│   └── selectionAtoms.ts     # Selection state atoms
├── machines/
│   ├── index.ts              # Machine exports
│   ├── dashboardMachine.ts   # Root orchestrator
│   ├── layoutMachine.ts      # Layout transitions
│   ├── searchMachine.ts      # Search workflow
│   ├── entityDetailMachine.ts# Entity panel tabs
│   └── searchFormMachine.ts  # Form UI orchestration
├── animation/
│   ├── index.ts              # Animation exports
│   └── layoutTransitions.ts  # anime.js v4 orchestrations
├── components/
│   ├── index.ts              # Component exports
│   ├── GeointShell.tsx       # Root layout
│   ├── SearchPanelCompound.tsx
│   ├── VirtualizedResultsList.tsx
│   ├── EntityDetailCard.tsx
│   ├── LayerPaletteCompound.tsx
│   ├── TimelinePanel.tsx
│   ├── FilterBar.tsx
│   ├── StatsWidget.tsx
│   └── ...
├── schemas/
│   └── index.ts              # Effect Schema definitions
├── tokens.ts                 # Design tokens
└── index.ts                  # Public API
```
