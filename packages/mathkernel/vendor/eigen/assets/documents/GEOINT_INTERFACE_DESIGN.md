# GEOINT Interface Design Specification

> Novel interface design for the Geointelligence system using XState, effect-atom, Radix UI, anime.js, and compound component architecture.

---

## Entity Taxonomy

The GEOINT system handles **6 primary entity types**:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        GEOINT ENTITY TAXONOMY                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ✈ FLIGHT (SearchResultFlight)      │  🛤 TRACK (SearchResultTrack)             │
│  ───────────────────────────────     │  ───────────────────────────────         │
│  • icao24 (transponder hex)          │  • trackId                               │
│  • callsign (e.g., "UAL1234")        │  • classification (friend/foe/neutral)   │
│  • position [lon, lat, alt]          │  • objectType (aircraft/vehicle/vessel)  │
│  • velocity, heading                 │  • position3D, heading, speed            │
│  • verticalRate, onGround            │  • confidence score                      │
│  • category (light/heavy/rotorcraft) │  • label                                 │
│  • originCountry                     │                                          │
│  • source: opensky | adsb_lol        │  • source: track                         │
│                                                                                 │
│  📍 POI (SearchResultPoi)            │  🗺 FEATURE (SearchResultFeature)        │
│  ───────────────────────────────     │  ───────────────────────────────         │
│  • poiId (OSM node/way/relation)     │  • featureId                             │
│  • name (e.g., "UCSF Hospital")      │  • geometryType (Point/Line/Polygon)     │
│  • category (amenity/military/...)   │  • properties (key-value)                │
│  • tags (key-value from OSM)         │  • position, label                       │
│  • position [lon, lat]               │                                          │
│  • source: osm                       │  • source: feature                       │
│                                                                                 │
│  🌤 WEATHER (SearchResultWeather)    │  🛰 IMAGERY (SearchResultImagery)         │
│  ───────────────────────────────     │  ───────────────────────────────         │
│  • locationName                      │  • itemId                                │
│  • temperature, humidity             │  • provider (planet/sentinel)            │
│  • weatherCode → description         │  • collection (PSScene/Sentinel-2-L2A)   │
│  • windSpeed, windDirection          │  • acquired (datetime)                   │
│  • cloudCover, precipitation         │  • cloudCover, gsd (resolution)          │
│  • forecast (hourly/daily)           │  • thumbnailUrl, assetsUrl               │
│  • source: weather                   │  • source: planet | sentinel             │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## User Stories

### US-01: Multi-Source Search

```
AS A geospatial analyst
I WANT TO search across multiple intelligence sources simultaneously
SO THAT I can build a common operating picture from heterogeneous data

ACCEPTANCE CRITERIA:
□ Can enter free-text search query
□ Can select which sources to query (track, osm, opensky, adsb_lol, weather, imagery)
□ Results stream in progressively (partial results per source)
□ Can see per-source result counts
□ Can filter by confidence/relevance score
□ Search persists across viewport changes (unless geofenced)
```

**Interaction Flow:**

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         SEARCH INTERACTION FLOW                                 │
│                                                                                 │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐   │
│   │   IDLE      │────▶│  COMPOSING  │────▶│  STREAMING  │────▶│  COMPLETE   │   │
│   │             │     │             │     │             │     │             │   │
│   │ ⌘K to start │     │ Type query  │     │ Results     │     │ All sources │   │
│   │             │     │ Select srcs │     │ stream in   │     │ complete    │   │
│   └─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘   │
│         ▲                   │                   │                   │           │
│         │                   │                   │                   │           │
│         │                   ▼                   ▼                   ▼           │
│         │            ┌─────────────┐     ┌─────────────┐     ┌─────────────┐   │
│         │            │ GeoFilter   │     │ Per-source  │     │ Filter/     │   │
│         └────────────│ selection   │     │ progress    │     │ refine      │   │
│           ESC/Clear  │ (bounds/    │     │ indicators  │     │ results     │   │
│                      │  radius)    │     │ ████░░░░    │     │             │   │
│                      └─────────────┘     └─────────────┘     └─────────────┘   │
│                                                                                 │
│   EVENTS:                                                                       │
│   • SearchStarted → show spinner, disable input                                │
│   • SearchPartialResults → append to list, update map markers                  │
│   • SearchSourceComplete → update source badge (✓)                             │
│   • SearchSourceError → show error badge (⚠), allow retry                      │
│   • SearchCompleted → enable refinement, show stats                            │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

### US-02: Entity Selection & Detail View

```
AS A analyst
I WANT TO select an entity and see detailed information
SO THAT I can understand its properties, history, and relationships

ACCEPTANCE CRITERIA:
□ Click entity on map → highlight + open detail panel
□ Click entity in results list → same behavior
□ Detail panel shows entity-specific fields
□ Can see entity history/track tail (for moving objects)
□ Can see related entities (nearby, same flight route, etc.)
□ Can perform entity-specific actions (track, export, annotate)
```

**Entity Detail Card Variants:**

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        ENTITY DETAIL CARD VARIANTS                              │
│                                                                                 │
│  ┌─ FLIGHT DETAIL ──────────────────┐   ┌─ POI DETAIL ────────────────────────┐ │
│  │ ✈ UAL1234 (a12345)              │   │ 📍 UCSF Medical Center              │ │
│  │ ─────────────────────────────── │   │ ─────────────────────────────────── │ │
│  │ HEADER                          │   │ HEADER                              │ │
│  │ Boeing 737-800 • United         │   │ Hospital • Healthcare               │ │
│  │ San Francisco → Denver          │   │ 505 Parnassus Ave, San Francisco    │ │
│  │                                 │   │                                     │ │
│  │ POSITION                        │   │ LOCATION                            │ │
│  │ 37.7749°N, 122.4194°W           │   │ 37.7631°N, 122.4586°W               │ │
│  │ FL350 (35,000 ft) ▲ climbing    │   │ [Open in Maps]                      │ │
│  │                                 │   │                                     │ │
│  │ DYNAMICS                        │   │ TAGS                                │ │
│  │ 450 kts • 270° • +500 fpm       │   │ amenity=hospital                    │ │
│  │ ███████████░ 89% complete       │   │ emergency=yes                       │ │
│  │                                 │   │ beds=600                            │ │
│  │ ACTIONS                         │   │ wheelchair=yes                      │ │
│  │ [Track] [History] [Export]      │   │                                     │ │
│  └─────────────────────────────────┘   │ ACTIONS                             │ │
│                                        │ [Directions] [Details] [Share]      │ │
│                                        └─────────────────────────────────────┘ │
│                                                                                 │
│  ┌─ TRACK DETAIL ───────────────────┐   ┌─ WEATHER DETAIL ───────────────────┐ │
│  │ 🛤 Track-001                     │   │ 🌤 San Francisco, CA                │ │
│  │ ─────────────────────────────── │   │ ─────────────────────────────────── │ │
│  │ Classification: FRIENDLY ●      │   │ Currently: Partly Cloudy            │ │
│  │ Type: VEHICLE                   │   │                                     │ │
│  │ Confidence: 95%                 │   │ ┌─────────────────────────────────┐ │ │
│  │                                 │   │ │  15.5°C │ 65% │ 12 km/h W      │ │ │
│  │ Position                        │   │ │  Feels  │ Hum │ Wind           │ │ │
│  │ 37.78°N, 122.41°W, 0m           │   │ └─────────────────────────────────┘ │ │
│  │ Speed: 45 kts • Heading: 090°   │   │                                     │ │
│  │                                 │   │ HOURLY FORECAST                     │ │
│  │ Track Tail (24h)                │   │ 12:00  13:00  14:00  15:00          │ │
│  │ ─○──○──○──●                     │   │  15°    16°    17°    16°           │ │
│  │                                 │   │  ☀️     ⛅     ⛅     ☀️            │ │
│  │ [Set Alert] [Export GPX]        │   │                                     │ │
│  └─────────────────────────────────┘   │ [Full Forecast] [7-Day]             │ │
│                                        └─────────────────────────────────────┘ │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

### US-03: Geographic Filtering

```
AS A analyst
I WANT TO constrain search to a geographic area
SO THAT I only see relevant results for my area of interest

ACCEPTANCE CRITERIA:
□ Draw bounding box on map
□ Draw radius from point
□ Draw polygon (freeform area)
□ Visual feedback shows selected area
□ Results update automatically when area changes
□ Can save/recall filter presets
```

**Geo Filter Interaction:**

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         GEO FILTER TOOLS                                        │
│                                                                                 │
│   TOOL PALETTE                       MAP INTERACTION                            │
│   ┌───────────────┐                 ┌─────────────────────────────────────┐     │
│   │ [□] Bounds    │                 │                                     │     │
│   │ [◎] Radius    │ ──────────────▶ │   ┌─────────────┐  Selected        │     │
│   │ [⬡] Polygon   │                 │   │             │  Area            │     │
│   │ [⊗] Clear     │                 │   │   ░░░░░░░   │  ════════        │     │
│   └───────────────┘                 │   │   ░░░░░░░   │  42.3 km²        │     │
│                                     │   │   ░░░░░░░   │                   │     │
│   QUICK PRESETS                     │   └─────────────┘                   │     │
│   ┌───────────────┐                 │         ○ Center                    │     │
│   │ SF Bay Area   │                 │                                     │     │
│   │ Downtown SF   │                 │   Drag corners to resize            │     │
│   │ SFO Airport   │                 │   Drag center to move               │     │
│   │ + Save        │                 │                                     │     │
│   └───────────────┘                 └─────────────────────────────────────┘     │
│                                                                                 │
│   XState: geoFilterMachine                                                      │
│   States: idle → selecting → adjusting → active                                │
│   Events: START_DRAW, UPDATE_SHAPE, FINISH_DRAW, CLEAR                         │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

### US-04: Temporal Filtering

```
AS A analyst
I WANT TO filter results by time range
SO THAT I can focus on recent activity or historical patterns

ACCEPTANCE CRITERIA:
□ Absolute time range picker (start date → end date)
□ Relative time presets (last 30min, 1h, 24h, 7d)
□ Timeline scrubber for playback
□ Animate track movement over time
□ Show temporal density (heatmap of activity)
```

**Timeline Control:**

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          TIMELINE PANEL                                         │
│                                                                                 │
│  ┌─ CONTROLS ───────────────────────────────────────────────────────────────┐   │
│  │                                                                          │   │
│  │  [|◀] [◀] [▶/❚❚] [▶|] [1x ▼]     ═══════════●═══════════════════        │   │
│  │   ↑    ↑    ↑      ↑    ↑               ↑                                │   │
│  │  start prev play  next speed         scrubber                            │   │
│  │                                                                          │   │
│  │  TIME RANGE: 2024-01-15 10:00 → 2024-01-15 14:00 (4h window)            │   │
│  │                                                                          │   │
│  │  ┌──────────────────────────────────────────────────────────────────┐   │   │
│  │  │    10:00   11:00   12:00   13:00   14:00                         │   │   │
│  │  │      │       │       ●       │       │          ← current pos     │   │   │
│  │  │    ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬░░░░░░░░░░  ← track activity │   │   │
│  │  │    █████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  ← flight density │   │   │
│  │  │    ░░░░░░░░░░░░███████████░░░░░░░░░░░░░░░░░░░░  ← POI queries    │   │   │
│  │  └──────────────────────────────────────────────────────────────────┘   │   │
│  │                                                                          │   │
│  │  PRESETS: [30m] [1h] [6h] [24h] [7d] [Custom...]                        │   │
│  │                                                                          │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  COLLAPSED STATE:                                                               │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │ ▶ Timeline  │  12:00  │  30m window  │  [Expand ▲]                       │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

### US-05: Layer Management

```
AS A analyst
I WANT TO control which data layers are visible
SO THAT I can reduce clutter and focus on relevant information

ACCEPTANCE CRITERIA:
□ Toggle layer visibility (tracks, flights, POI, weather, imagery)
□ Adjust layer opacity
□ Reorder layer stack (z-index)
□ Configure layer-specific styling (colors, symbols)
□ Group related layers
□ Save/load layer configurations
```

**Layer Palette:**

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          LAYER PALETTE                                          │
│                                                                                 │
│  ┌─ LAYERS ─────────────────────────────────────────────────────────────────┐   │
│  │                                                                          │   │
│  │  ⬛ BASE MAPS                                          [▼]               │   │
│  │    ├── ● Satellite                      ████████████░░░░ 80%             │   │
│  │    ├── ○ Streets                                                         │   │
│  │    └── ○ Terrain                                                         │   │
│  │                                                                          │   │
│  │  ⬛ INTELLIGENCE                                       [▼]               │   │
│  │    ├── ● Tracks (247)         ████████████████████ 100% ⚙               │   │
│  │    │     [● Friendly ● Hostile ● Neutral ● Unknown]                     │   │
│  │    ├── ● Flights (183)        ████████████████████ 100%                 │   │
│  │    │     [OpenSky: 142] [ADSB.lol: 41]                                  │   │
│  │    └── ○ Features (12)        ░░░░░░░░░░░░░░░░░░░░   0%                 │   │
│  │                                                                          │   │
│  │  ⬛ POINTS OF INTEREST                                 [▼]               │   │
│  │    ├── ● Hospitals (23)       ████████████████████ 100%                 │   │
│  │    ├── ○ Airports (8)         ░░░░░░░░░░░░░░░░░░░░   0%                 │   │
│  │    ├── ○ Military (5)         ░░░░░░░░░░░░░░░░░░░░   0%                 │   │
│  │    └── + Add Layer...                                                    │   │
│  │                                                                          │   │
│  │  ⬛ OVERLAYS                                           [▼]               │   │
│  │    ├── ● Weather Radar        ████████░░░░░░░░░░░░  50%                 │   │
│  │    └── ○ Satellite Imagery    ░░░░░░░░░░░░░░░░░░░░   0%                 │   │
│  │                                                                          │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  LEGEND: ● enabled  ○ disabled  ⚙ settings  [▼] collapse                       │
│  ACTIONS: [Save Config] [Load Config] [Reset]                                   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

### US-06: Results List Interaction

```
AS A analyst
I WANT TO browse search results in a scrollable list
SO THAT I can quickly scan and select entities of interest

ACCEPTANCE CRITERIA:
□ Virtualized list (handle 500+ results)
□ Group by source or type
□ Sort by relevance, distance, recency
□ Hover → highlight on map
□ Click → select + open detail
□ Multi-select for batch operations
□ Keyboard navigation (↑↓ arrows, Enter to select)
```

**Results List:**

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        VIRTUALIZED RESULTS LIST                                 │
│                                                                                 │
│  ┌─ HEADER ─────────────────────────────────────────────────────────────────┐   │
│  │ 247 results │ Sort: [Relevance ▼] │ Group: [Source ▼] │ [≡ List] [⊞ Grid] │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  ┌─ FLIGHTS (183) ──────────────────────────────────────────────────────────┐   │
│  │                                                                          │   │
│  │  ┌────────────────────────────────────────────────────────────────────┐ │   │
│  │  │ ✈ UAL1234          │ 37.77°N 122.41°W │ FL350 │ 450kts │ ●● 0.95  │ │   │
│  │  │   United Airlines  │ 2m ago           │       │        │ opensky  │ │   │
│  │  └────────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                          │   │
│  │  ┌────────────────────────────────────────────────────────────────────┐ │   │
│  │  │ ✈ SWA567           │ 37.80°N 122.35°W │ FL280 │ 420kts │ ●● 0.92  │ │   │
│  │  │   Southwest        │ 30s ago          │  ▼    │        │ adsb_lol │ │   │
│  │  └────────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                          │   │
│  │  ... (virtualized - only renders visible rows)                          │   │
│  │                                                                          │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  ┌─ POI (42) ───────────────────────────────────────────────────────────────┐   │
│  │                                                                          │   │
│  │  ┌────────────────────────────────────────────────────────────────────┐ │   │
│  │  │ 📍 UCSF Medical    │ 37.76°N 122.45°W │ hospital    │ ●●● 0.88   │ │   │
│  │  │   Healthcare       │ 1.2 km away      │ emergency   │ osm        │ │   │
│  │  └────────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                          │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  ┌─ TRACKS (22) ────────────────────────────────────────────────────────────┐   │
│  │ ...                                                                      │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  INTERACTIONS:                                                                  │
│  • Hover row → map marker pulses                                               │
│  • Click row → select, open EntityDetailCard                                   │
│  • ⌘+Click → multi-select                                                      │
│  • ↑↓ → navigate                                                               │
│  • Enter → select focused row                                                  │
│  • ⌘+A → select all visible                                                    │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Layout Variants

### Layout 1: Command Center (Default)

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ HEADER [≡] TMNL GEOINT        │ ⌘K Search...              │ ◉ Live │ ⚙ │ 👤 │   │
├───────────────┬────────────────────────────────────────────┬──────────────────────┤
│               │                                            │                      │
│   SIDEBAR     │                                            │    INTEL PANEL       │
│   320px       │                                            │    380px             │
│               │                                            │                      │
│  ┌─────────┐  │                                            │  ┌────────────────┐  │
│  │ Search  │  │                                            │  │ Entity Detail  │  │
│  │ Panel   │  │               MAP                          │  │ Card           │  │
│  └─────────┘  │           (flex-1)                         │  │                │  │
│               │                                            │  │ ─────────────  │  │
│  ┌─────────┐  │         ○    ○                             │  │ Selected:      │  │
│  │ Layers  │  │           ●                                │  │ UAL1234        │  │
│  │ Palette │  │     ○       ○   ○                          │  └────────────────┘  │
│  └─────────┘  │                                            │                      │
│               │                                            │  ┌────────────────┐  │
│  ┌─────────┐  │              ○                             │  │ Results List   │  │
│  │ Stats   │  │                                            │  │ (Virtualized)  │  │
│  │ Widget  │  │    ○                                       │  │                │  │
│  │ ────    │  │                                            │  │ ▸ Flight 1     │  │
│  │ 247     │  │                                            │  │ ▸ Flight 2     │  │
│  │ results │  │                                            │  │ ▸ POI 1        │  │
│  └─────────┘  │                                            │  │ ...            │  │
│               │                                            │  └────────────────┘  │
├───────────────┴────────────────────────────────────────────┴──────────────────────┤
│ TIMELINE [◀] [▶▶] ══════════●════════════════════════  2h   12h   24h   7d       │
└──────────────────────────────────────────────────────────────────────────────────┘

CSS GRID:
grid-template-columns: 320px 1fr 380px
grid-template-rows: auto 1fr auto

KEYBOARD:
⌘B → toggle sidebar
⌘E → toggle intel panel
⌘T → toggle timeline
⌘1 → Command layout
```

---

### Layout 2: Focus Mode (Minimalist)

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                                                                                  │
│                      ┌────────────────────────────┐                              │
│                      │      ⌘K Quick Search       │                              │
│                      └────────────────────────────┘                              │
│                                                                                  │
│  ╭───────────╮                                            ╭────────────────╮     │
│  │ Layers    │                                            │ Entity Detail  │     │
│  │ ────────  │                                            │ ────────────── │     │
│  │ ● Tracks  │                                            │                │     │
│  │ ● Flights │              MAP (FULLSCREEN)              │  UAL1234       │     │
│  │ ○ POI     │                                            │  United        │     │
│  │ ○ Weather │           ○    ○                           │  FL350, 450kts │     │
│  ╰───────────╯             ●                              │                │     │
│                      ○       ○   ○                        │  [Track]       │     │
│   drag to move                                            │  [History]     │     │
│   resize corners              ○                           ╰────────────────╯     │
│                                                                                  │
│                    ○                                         drag to move        │
│                                                              resize corners      │
│                                                                                  │
│  ╭─────────────────────────────────────────────────────────────────────────╮     │
│  │ [◀] [▶] ════●════════════════════════════════════════  Timeline         │     │
│  ╰─────────────────────────────────────────────────────────────────────────╯     │
│                                                                                  │
│                 [ESC panels]   [⌘1 Command]   [⌘2 Focus]   [⌘3 Analytics]        │
└──────────────────────────────────────────────────────────────────────────────────┘

FLOATING PANELS:
• Draggable + resizable
• Minimize to icon
• Persist positions in localStorage
• Z-index management (click to front)

KEYBOARD:
⌘2 → Focus layout
ESC → show/hide floating panels
```

---

### Layout 3: Analytics Dashboard

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ HEADER  TMNL GEOINT Analytics  │ ⌘K │ [Command] [Focus] [●Analytics]  │ ◉ Live  │
├────────────────────────────────────────────┬─────────────────────────────────────┤
│                                            │  ┌───────────────┐ ┌─────────────┐  │
│                                            │  │   TRACKS      │ │   SOURCES   │  │
│              MAP (60%)                     │  │     247       │ │  ████████░░ │  │
│                                            │  │   ▲ 12%       │ │  6 active   │  │
│         ○    ○                             │  └───────────────┘ └─────────────┘  │
│           ●                                │  ┌───────────────┐ ┌─────────────┐  │
│     ○       ○   ○                          │  │   ALERTS      │ │  COVERAGE   │  │
│                                            │  │      3        │ │    87%      │  │
│              ○                             │  │   ⚠ High      │ │  █████████░ │  │
│                                            │  └───────────────┘ └─────────────┘  │
│    ○                                       │                                     │
│                                            │        STATS GRID (40%)             │
├────────────────────────────────────────────┼─────────────────────────────────────┤
│                                            │                                     │
│       RESULTS TABLE (AG-Grid)              │     SOURCE BREAKDOWN                │
│                                            │                                     │
│  ┌────┬──────────┬────────┬──────┬──────┐  │  Track    ████████████░░░  65%     │
│  │ ID │ Name     │ Source │ Conf │ Time │  │  OSM      ██████░░░░░░░░░  23%     │
│  ├────┼──────────┼────────┼──────┼──────┤  │  OpenSky  ████░░░░░░░░░░░   8%     │
│  │ 01 │ UAL1234  │ opensky│ 0.95 │ 2m   │  │  ADSB.lol ██░░░░░░░░░░░░░   4%     │
│  │ 02 │ UCSF     │ osm    │ 0.88 │ 5m   │  │                                     │
│  │ .. │ ...      │ ...    │ ...  │ ...  │  │  ────────────────────────────────   │
│  └────┴──────────┴────────┴──────┴──────┘  │                                     │
│                                            │  ACTIVITY SPARKLINE                 │
│  [Export CSV] [Export GeoJSON]             │  ▁▂▃▅▆█▇▅▃▂▁▂▃▅▆█▇▅▃▂              │
│                                            │  last 24 hours                      │
└────────────────────────────────────────────┴─────────────────────────────────────┘

CSS GRID:
grid-template-rows: auto 60% 40%
grid-template-columns: 60% 40%

FEATURES:
• StatsWidget with sparklines
• AG-Grid with virtualization, sorting, filtering
• Source breakdown pie/bar chart
• Activity timeline sparkline
```

---

## Component Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                      COMPONENT HIERARCHY                                        │
│                                                                                 │
│  GeointShell (Root)                                                             │
│  ├── GeointShell.Header                                                         │
│  │   ├── Logo                                                                   │
│  │   ├── GlobalSearch (⌘K trigger)                                              │
│  │   ├── LiveIndicator                                                          │
│  │   ├── LayoutSwitcher [Command | Focus | Analytics]                           │
│  │   └── UserMenu                                                               │
│  │                                                                              │
│  ├── GeointShell.Sidebar (collapsible)                                          │
│  │   ├── SearchPanelCompound                                                    │
│  │   │   ├── SearchInput                                                        │
│  │   │   ├── SourceSelector                                                     │
│  │   │   ├── GeoFilterTools                                                     │
│  │   │   └── TemporalFilterTools                                                │
│  │   ├── LayerPaletteCompound                                                   │
│  │   │   ├── LayerGroup                                                         │
│  │   │   ├── LayerToggle                                                        │
│  │   │   └── OpacitySlider                                                      │
│  │   └── StatsWidget                                                            │
│  │       ├── StatCard                                                           │
│  │       └── Sparkline                                                          │
│  │                                                                              │
│  ├── GeointShell.Map                                                            │
│  │   ├── MapboxMap                                                              │
│  │   ├── DeckGLOverlay                                                          │
│  │   ├── SelectionRing                                                          │
│  │   ├── GeoFilterOverlay                                                       │
│  │   └── MeasurementTool                                                        │
│  │                                                                              │
│  ├── GeointShell.Intel (collapsible)                                            │
│  │   ├── EntityDetailCard                                                       │
│  │   │   ├── EntityHeader                                                       │
│  │   │   ├── EntityProperties                                                   │
│  │   │   ├── EntityHistory (track tail)                                         │
│  │   │   └── EntityActions                                                      │
│  │   └── VirtualizedResultsList                                                 │
│  │       ├── ResultsHeader (sort, group, filter)                                │
│  │       ├── ResultGroup                                                        │
│  │       └── ResultRow                                                          │
│  │                                                                              │
│  ├── GeointShell.Timeline (collapsible)                                         │
│  │   ├── PlaybackControls                                                       │
│  │   ├── TimelineScrubber                                                       │
│  │   ├── TimeRangeSelector                                                      │
│  │   └── ActivityDensity                                                        │
│  │                                                                              │
│  └── OVERLAYS (portaled)                                                        │
│      ├── CommandPalette (⌘K)                                                    │
│      ├── RadialCommandDial (right-click context)                                │
│      └── FloatingPanelSystem (Focus mode)                                       │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## State Management (Atoms)

```
geointRegistry
│
├── LAYOUT
│   ├── layoutModeAtom: 'command' | 'focus' | 'analytics'
│   ├── sidebarStateAtom: { collapsed, width, activeSection }
│   ├── intelPanelStateAtom: { collapsed, width, activeTab }
│   ├── timelineStateAtom: { collapsed, height, range }
│   └── floatingPanelsAtom: Map<string, { position, size, minimized, zIndex }>
│
├── SEARCH
│   ├── searchQueryAtom: SearchQuery
│   ├── searchStatusAtom: 'idle' | 'streaming' | 'complete' | 'error'
│   ├── searchResultsAtom: SearchResultItem[]
│   ├── sourceProgressAtom: Map<IntelSource, { status, count, duration }>
│   └── searchHistoryAtom: SearchHistoryEntry[]
│
├── SELECTION
│   ├── selectedEntityAtom: SearchResultItem | null
│   ├── hoveredEntityAtom: SearchResultItem | null
│   ├── multiSelectAtom: Set<SearchResultId>
│   └── selectionModeAtom: 'single' | 'multi' | 'area'
│
├── FILTERS
│   ├── geoFilterAtom: GeoFilter | null
│   ├── temporalFilterAtom: TemporalFilter | null
│   ├── sourceFiltersAtom: SourceFilter[]
│   └── savedFiltersAtom: SavedSearch[]
│
├── LAYERS
│   ├── layerVisibilityAtom: Map<LayerId, boolean>
│   ├── layerOpacityAtom: Map<LayerId, number>
│   └── layerOrderAtom: LayerId[]
│
└── TIMELINE
    ├── playbackStateAtom: 'playing' | 'paused' | 'stopped'
    ├── currentTimeAtom: Date
    ├── playbackSpeedAtom: 1 | 2 | 4 | 8 | 16
    └── timeRangeAtom: { start: Date, end: Date }
```

---

## XState Machines Summary

| Machine | Purpose | States |
|---------|---------|--------|
| `layoutMachine` | Layout switching + panel toggles | command, focus, analytics, transitioning |
| `searchMachine` | Query composition → streaming | idle, composing, validating, streaming, complete, error |
| `geoFilterMachine` | Draw geo shapes | idle, drawing, adjusting, active |
| `timelineMachine` | Playback control | stopped, playing, paused, seeking |
| `entityDetailMachine` | Entity card tabs | overview, history, relations, actions |
| `commandPaletteMachine` | ⌘K modal | closed, open, searching, executing |

---

## Animation Choreography

| Trigger | Animation | Duration | Easing |
|---------|-----------|----------|--------|
| Layout switch | Panel slide + map resize | 400ms | easeOutQuint |
| Sidebar collapse | Width 320→48px + icon morph | 300ms | easeOutCubic |
| Result item enter | stagger translateX -20→0, opacity | 150ms × stagger 30ms | easeOut |
| Entity select | Ring scale 0.8→1, panel slide | 250ms | spring |
| Hover highlight | Marker scale 1→1.2, glow | 200ms | easeOut |
| Timeline scrub | Markers fade in/out based on time | 100ms | linear |

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘K` | Open command palette |
| `⌘1` | Switch to Command layout |
| `⌘2` | Switch to Focus layout |
| `⌘3` | Switch to Analytics layout |
| `⌘B` | Toggle sidebar |
| `⌘E` | Toggle entity/intel panel |
| `⌘T` | Toggle timeline |
| `⌘L` | Toggle layers palette |
| `ESC` | Close modals / deselect |
| `j/↓` | Navigate results down |
| `k/↑` | Navigate results up |
| `Enter` | Select focused result |
| `⌘+Click` | Multi-select |
| `?` | Show keyboard shortcuts |

---

## Existing Components Inventory

The GEOINT system already has **41 components** implemented:

### Core Layout
- `GeointShell` - Root layout orchestrator
- `GeointDashboard` - Main dashboard with layout modes
- `GeointMap` - Mapbox/DeckGL map

### Search & Results
- `SearchPanel` / `SearchPanelCompound` - Query input with XState
- `VirtualizedSearchResults` - Basic virtualized list
- `VirtualizedResultsList` - Full compound component with animations
- `ResultsPanel` - Results display wrapper
- `FilterBar` / `FilterBarWithMachine` - Advanced filtering

### Entity Management
- `EntityPanel` - Trait-based entity display
- `EntityDetailCard` - Tabbed detail view with XState
- `MultiSelectActionBar` - Batch operations

### Layers & Visualization
- `LayerPalette` / `LayerPaletteCompound` - Layer visibility control
- `Minimap` - Navigation overview
- `MapSelectionOverlay` - Selection ring animation

### Timeline & Temporal
- `TimelinePanel` - Playback controls + brush
- `TimelineMapBridge` - Bidirectional sync
- `SwimlaneTimeline` - Entity swimlanes
- `TrackHistoryPlayer` - Track playback
- `TemporalHeatmap` - Activity density

### Analytics & Stats
- `StatsWidget` - Counter, Sparkline, Breakdown
- `CorrelationView` - Entity relationships
- `NetworkGraph` - @xyflow/react graph
- `FusionView` - Multi-source fusion

### Overlays & Modals
- `CommandPalette` - M-x style commands
- `RadialCommandDial` - Ctrl+click context menu
- `KeyboardShortcutsOverlay` - Which-key display
- `AlertPanel` - Real-time notifications

### Tools
- `SpatialQueryPanel` - Polygon/radius drawing
- `MeasurementTools` - Distance, area, bearing
- `ExportPanel` - Data export
- `BookmarksPanel` - Saved views
- `CollectionManager` - Watchlists

### Integrations
- `LiveFeedIndicator` - Real-time status
- `SplitCompareView` - Temporal comparison
- `MissionPlanner` - Mission planning
- `ImmersiveHUD` - Full-screen mode
- `GeointKeyboardProvider` - Unified keyboard

---

## Implementation Status

> **Audit Date**: 2026-01-09 | **Status**: ✅ **PRODUCTION-READY**

### Phase 1: Core Infrastructure ✅ COMPLETE

| File | Lines | Status |
|------|-------|--------|
| `machines/layoutMachine.ts` | 623 | XState v5 machine with 3 states (command/focus/analytics), panel toggle events, floating panel management |
| `atoms/layoutAtoms.ts` | 400 | Complete atom hierarchy: layout mode, sidebar, intel panel, timeline, floating panels |
| `animation/layoutTransitions.ts` | 780 | All 6 transition pairs with anime.js timelines, stagger animations, panel expand/collapse |
| `components/GeointShell.tsx` | 836 | Compound component with CSS Grid layouts, keyboard shortcuts (⌘1/2/3, ⌘B/E/T) |

### Phase 2: Major Components ✅ COMPLETE

| Component | Lines | Features |
|-----------|-------|----------|
| `VirtualizedResultsList` | 1155 | @tanstack/react-virtual, anime.js stagger, keyboard nav (j/k), multi-select, view modes |
| `EntityDetailCard` | 1080 | XState tabs (overview/history/relations/raw), entity type renderers, anime.js tab transitions |
| `StatsWidget` | 1054 | Counter, AnimatedDigitCounter, Sparkline, MultiSparkline, SourceBreakdown, TrendBadge, CircularProgress |
| `TimelinePanel` | - | Playback controls, range selector, brush selection, anime.js expand/collapse |
| `SearchPanelCompound` | - | Input, Actions, SourceToggles, TimeRange, CollapsibleSection, Results, StatusBar |
| `CommandPalette` | - | XState commandPaletteMachine, fuzzy search, category grouping, keyboard nav |
| `LayerPaletteCompound` | - | Layer toggles, visibility controls, compact mode for floating panels |
| `FilterBar` | - | FilterChip composition, preset filters, clear all |
| `RadialCommandDial` | - | Ctrl+click context menu, anime.js dial animation |

### Phase 3: Additional Components ✅ COMPLETE

**46+ components** implemented in `src/lib/geoint/components/`:

- **Search**: SearchPanel, SearchFilterBridge, SpatialQueryPanel
- **Results**: ResultsPanel, VirtualizedSearchResults, IntelSummaryPanel
- **Entity**: EntityPanel, EntityDetailCard, MultiSelectActionBar
- **Layers**: LayerPalette, LayerPaletteCompound, MapSelectionOverlay
- **Timeline**: TimelinePanel, TimelineMapBridge, SwimlaneTimeline, TrackHistoryPlayer, TemporalHeatmap
- **Analytics**: StatsWidget, CorrelationView, NetworkGraph, FusionView
- **Overlays**: CommandPalette, RadialCommandDial, KeyboardShortcutsOverlay, AlertPanel
- **Tools**: MeasurementTools, ExportPanel, BookmarksPanel, CollectionManager
- **HUD**: ImmersiveHUD, Minimap, LiveFeedIndicator, SplitCompareView
- **Planning**: MissionPlanner, GeointDashboard, GeointMap

### Phase 4: Testbed ✅ COMPLETE

`GeointDashboardTestbed.tsx` (1509 lines) provides comprehensive demos:

1. **GeointDashboardTestbed** - Full dashboard with all integrations
2. **CompoundSearchDemo** - SearchPanelCompound usage
3. **LayoutShowcase** - ASCII diagrams of all 3 layouts
4. **VirtualizedResultsDemo** - 100-item virtualized list with mock data
5. **CommandPaletteDemo** - M-x style command palette
6. **KeyboardProviderDemo** - Unified keyboard system
7. **AnimationOrchestratorDemo** - Effect service for animations
8. **StreamingDemo** - Real-time data integration
9. **GeointShellDemo** - Layout switching with transitions

### XState Machines Inventory

| Machine | File | States |
|---------|------|--------|
| layoutMachine | `machines/layoutMachine.ts` | command ↔ focus ↔ analytics + transitioning |
| searchMachine | `machines/searchMachine.ts` | idle → debouncing → searching → complete/error |
| entityDetailMachine | `machines/entityDetailMachine.ts` | Tab navigation + loading states |
| timelineMachine | `machines/timelineMachine.ts` | Playback: idle ↔ playing + range selection |
| filterBarMachine | `machines/filterBarMachine.ts` | Filter state management |
| radialDialMachine | `machines/radialDialMachine.ts` | Dial open/closed + segment hover |
| networkGraphMachine | `machines/networkGraphMachine.ts` | Graph layout + selection |
| swimlaneMachine | `machines/swimlaneMachine.ts` | Swimlane expansion |
| fusionViewMachine | `machines/fusionViewMachine.ts` | Multi-source fusion |
| heatmapMachine | `machines/heatmapMachine.ts` | Heatmap rendering |
| missionPlannerMachine | `machines/missionPlannerMachine.ts` | Mission planning workflow |
| splitCompareMachine | `machines/splitCompareMachine.ts` | Temporal comparison |
| immersiveHudMachine | `machines/immersiveHudMachine.ts` | HUD mode transitions |

### 🔄 Enhancement Opportunities

- **Performance**: Profile animation FPS on complex layouts
- **Accessibility**: ARIA labels for all interactive elements
- **Testing**: Playwriter visual regression tests for each layout
- **Documentation**: JSDoc comments for all public APIs

### 📋 Future Considerations

- Heat map overlays (heatmapMachine exists, needs integration)
- Real-time collaboration features (StreamingDemo foundation exists)
- Voice command integration
- Mobile-responsive layouts

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| State Management | effect-atom, @tanstack/react-virtual |
| State Machines | XState v5 |
| Animations | anime.js v4 |
| UI Components | Radix UI, shadcn/ui |
| Styling | Tailwind CSS, CSS Grid |
| Maps | Mapbox GL, Deck.gl |
| Graphs | @xyflow/react |
| Tables | AG-Grid |

---

*Document generated for TMNL GEOINT Interface Design*
