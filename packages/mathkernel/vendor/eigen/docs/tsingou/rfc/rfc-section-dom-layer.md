# TSG.24 DOM Control Layer

```
Section:     TSG.24
Title:       DOM Control Layer
Status:      DRAFT
Author:      stix-specialist
RFC:         TMNL-RFC-002
Depends:     TSG.20 (4-Layer Rendering Surface), TSG.10 (State Management / Atom-as-State)
```

---

## TSG.24.1 Introduction

This section specifies the DOM Control Layer — the topmost layer (z:3) in Tsingou's 4-layer composited rendering surface (TSG.20). The DOM layer serves as the primary interaction surface for human operators, providing controls, panels, inspectors, alerts, and configuration interfaces that drive the signal intelligence pipeline.

While the lower three layers (R3F z:0, visx z:1, p5 z:2) are responsible for rendering signal data, the DOM layer is responsible for **commanding** it — configuring adapters, inspecting signals, setting analysis thresholds, reviewing STIX exports, and responding to alerts.

### TSG.24.1.1 Normative References

| Key | Reference |
|-----|-----------|
| [RFC2119] | IETF, "Key words for use in RFCs to Indicate Requirement Levels", March 1997 |
| [RFC8174] | IETF, "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words", May 2017 |
| [WCAG21] | W3C, "Web Content Accessibility Guidelines (WCAG) 2.1", June 2018 |
| [ARIA12] | W3C, "WAI-ARIA 1.2", December 2023 |
| [ADR005] | Tsingou ADR-005, "Atom-as-State Doctrine" |

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in BCP 14 [RFC2119] [RFC8174].

### TSG.24.1.2 Scope

This section covers:

1. DOM layer architecture within the 4-layer compositing model
2. Compound component patterns for all control surfaces
3. Panel and drawer system (signal inspector, adapter config, analysis controls)
4. Form controls for pipeline configuration
5. Signal inspector with STIX preview
6. Adapter management interface
7. Alert and notification system
8. Keyboard shortcuts and command palette
9. Accessibility (ARIA landmarks, focus management, screen reader support)
10. Responsive layout strategy
11. Theme system and CSS variable architecture
12. Performance optimization (virtualization, memo boundaries, lazy loading)
13. Integration with atom state (controls ↔ atoms ↔ rendering layers)

This section does NOT cover:
- R3F 3D scene rendering (TSG.21)
- visx data visualization charts (TSG.22)
- p5 generative canvas (TSG.23)
- Atom-as-State implementation details (TSG.10)

---

## TSG.24.2 Layer Architecture

### TSG.24.2.1 Position in Compositing Stack

The DOM layer occupies z-index 3 — the topmost position in the 4-layer stack:

```
┌───────────────────────────────────────────────────────────┐
│  z:3  DOM Control Layer (this section)                     │
│       React + framer-motion / DOM elements                │
│       Captures pointer events, keyboard input             │
├───────────────────────────────────────────────────────────┤
│  z:2  p5 Generative Layer (TSG.23)                        │
│       Canvas 2D — spectrum waterfall, noise fields         │
│       pointer-events: none (transparent overlay)          │
├───────────────────────────────────────────────────────────┤
│  z:1  visx Data Visualization Layer (TSG.22)              │
│       SVG — timelines, heatmaps, distributions            │
│       pointer-events: none (transparent overlay)          │
├───────────────────────────────────────────────────────────┤
│  z:0  R3F 3D Scene Layer (TSG.21)                         │
│       WebGL — network graphs, geospatial, topology        │
│       Opaque or semi-transparent background               │
└───────────────────────────────────────────────────────────┘
```

### TSG.24.2.2 Event Routing

The DOM layer is the primary event capture surface. Events are routed according to the following rules:

| Event Type | DOM Layer Behavior | Pass-through |
|-----------|-------------------|-------------|
| Click on control (button, input, panel) | CAPTURED — handled by React | NO |
| Click on transparent area | IGNORED — falls through to z:2/1/0 | YES |
| Keyboard (when input focused) | CAPTURED — handled by focused element | NO |
| Keyboard (global shortcuts) | CAPTURED — handled by command palette | NO |
| Keyboard (no focus, no shortcut match) | IGNORED — falls through | YES |
| Scroll (on panel/drawer) | CAPTURED — panel scrolls | NO |
| Scroll (on viewport) | IGNORED — falls through to R3F orbit | YES |
| Drag (on slider/resize handle) | CAPTURED — handler processes | NO |
| Drag (on transparent area) | IGNORED — falls through to R3F | YES |

Implementations MUST use CSS `pointer-events: none` on the DOM layer's root container, with `pointer-events: auto` on interactive child elements. This ensures transparent areas pass events to lower layers.

```css
.tsingou-layer--dom {
  position: absolute;
  inset: 0;
  z-index: 3;
  pointer-events: none;  /* Transparent by default */
}

.tsingou-layer--dom [data-interactive],
.tsingou-layer--dom button,
.tsingou-layer--dom input,
.tsingou-layer--dom select,
.tsingou-layer--dom textarea,
.tsingou-layer--dom [role="dialog"],
.tsingou-layer--dom [role="complementary"] {
  pointer-events: auto;  /* Interactive elements capture events */
}
```

### TSG.24.2.3 Layer Independence

Per TSG.20, the DOM layer MUST NOT import from R3F, visx, or p5 modules directly. Communication between the DOM layer and rendering layers occurs exclusively through atoms:

```
DOM Layer                    Atom Store                   Rendering Layers
────────────                ───────────                  ─────────────────

[Adapter Config Panel]
  ├─ onChange ──► Atom.set(adapterConfigAtom, newConfig)
  │                         │
  │              adapterConfigAtom
  │                         │
  │              ◄──────────┘
  │                         ├────────► [visx: update chart config]
  │                         ├────────► [R3F: update 3D view config]
  │                         └────────► [p5: update waterfall config]
  │
[Signal Inspector]
  ├─ useAtomValue(selectedSignalAtom)
  │                         ▲
  │              selectedSignalAtom
  │                         │
  │              ◄──────────┘
  │                         ├────────► [R3F: highlight selected node]
  │                         └────────► [visx: highlight data point]
```

---

## TSG.24.3 Compound Component Architecture

### TSG.24.3.1 Design Philosophy

All DOM layer control surfaces MUST be implemented as compound components following the Provider → Consumer → Slots pattern. This pattern enables:

1. **Inversion of control**: Parent provides behavior, children provide markup
2. **Composability**: Slots can be rearranged, omitted, or extended
3. **Testability**: Context can be mocked for isolated component tests
4. **Theming**: Slot-level style overrides without prop drilling

### TSG.24.3.2 Compound Component Anatomy

```typescript
// 1. Context (internal state + actions)
interface PanelContextValue {
  readonly isOpen: boolean
  readonly title: string
  readonly toggle: () => void
  readonly close: () => void
}

const PanelContext = createContext<PanelContextValue | null>(null)

function usePanelContext(): PanelContextValue {
  const ctx = useContext(PanelContext)
  if (!ctx) throw new Error("Panel.* must be used within <Panel.Root>")
  return ctx
}

// 2. Root (provider)
function PanelRoot({ children, defaultOpen, title }: PanelRootProps) {
  const [isOpen, setOpen] = useState(defaultOpen ?? false)
  const toggle = useCallback(() => setOpen((o) => !o), [])
  const close = useCallback(() => setOpen(false), [])

  const value = useMemo(
    () => ({ isOpen, title, toggle, close }),
    [isOpen, title, toggle, close]
  )

  return (
    <PanelContext.Provider value={value}>
      {children}
    </PanelContext.Provider>
  )
}

// 3. Slots (consumers)
function PanelTrigger({ children }: { children: ReactNode }) {
  const { toggle } = usePanelContext()
  return <button onClick={toggle} data-interactive>{children}</button>
}

function PanelContent({ children }: { children: ReactNode }) {
  const { isOpen } = usePanelContext()
  if (!isOpen) return null
  return <div role="complementary" data-interactive>{children}</div>
}

function PanelHeader({ children }: { children?: ReactNode }) {
  const { title, close } = usePanelContext()
  return (
    <header>
      <span>{title}</span>
      {children}
      <button onClick={close} aria-label="Close panel">×</button>
    </header>
  )
}

// 4. Namespace export
const Panel = {
  Root: PanelRoot,
  Trigger: PanelTrigger,
  Content: PanelContent,
  Header: PanelHeader,
}
```

### TSG.24.3.3 Compound Component Inventory

All DOM layer control surfaces MUST be implemented as compound components:

| Component | Slots | Purpose |
|-----------|-------|---------|
| Panel | Root, Trigger, Content, Header, Footer | Generic side/bottom panel |
| Drawer | Root, Trigger, Content, Header, Backdrop | Overlay drawer (left/right/bottom) |
| Dialog | Root, Trigger, Content, Title, Description, Actions | Modal dialog |
| Inspector | Root, Header, Section, Property, RawView, StixPreview | Signal detail inspector |
| AdapterCard | Root, Header, Status, Config, Controls, Metrics | Source adapter control |
| AlertBanner | Root, Icon, Message, Actions, Dismiss | Alarm/notification display |
| CommandPalette | Root, Input, Results, ResultItem, Shortcut | Command palette / keyboard UI |
| Toolbar | Root, Group, Button, Separator, Spacer | Horizontal toolbar strip |
| TabPanel | Root, TabList, Tab, Panel | Tabbed content container |
| Accordion | Root, Item, Trigger, Content | Collapsible sections |
| DataTable | Root, Header, Body, Row, Cell, Footer, Pagination | Virtualized data table |

### TSG.24.3.4 Slot Composition Rules

1. Slot components MUST only be rendered as children of their Root
2. Root components MUST use React.createContext for state propagation
3. Slot components MUST call their context hook and throw if context is null
4. Slots MUST accept className and style props for override
5. Slots SHOULD accept an `asChild` prop for render delegation via Radix Slot pattern
6. Root components MUST NOT render any DOM elements — they are pure providers

---

## TSG.24.4 Panel and Drawer System

### TSG.24.4.1 Panel Taxonomy

The DOM layer provides four panel zones positioned at the viewport edges:

```
┌──────────────────────────────────────────────────────────────────┐
│  ┌──────────────────── Toolbar ────────────────────────────────┐ │
│  │  [Adapters] [Analysis] [Signals] [Alerts]  ...  [⌘K] [⚙]  │ │
│  └─────────────────────────────────────────────────────────────┘ │
│ ┌───────────┐ ┌────────────────────────────────┐ ┌────────────┐ │
│ │           │ │                                │ │            │ │
│ │  Left     │ │                                │ │  Right     │ │
│ │  Panel    │ │     Viewport                   │ │  Panel     │ │
│ │           │ │     (z:0-2 layers)             │ │            │ │
│ │  Adapter  │ │                                │ │  Signal    │ │
│ │  Browser  │ │                                │ │  Inspector │ │
│ │           │ │                                │ │            │ │
│ │           │ │                                │ │            │ │
│ └───────────┘ └────────────────────────────────┘ └────────────┘ │
│  ┌─────────────────── Bottom Panel ────────────────────────────┐ │
│  │  Signal log / Console / Alert history                       │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

**Panel zone properties:**

| Zone | Position | Default Width/Height | Resizable | Collapsible | Content |
|------|----------|---------------------|-----------|-------------|---------|
| Toolbar | Top | 44px height | NO | NO | Primary navigation, global actions |
| Left | Left edge | 280px width | YES (120-480px) | YES | Adapter browser, source config |
| Right | Right edge | 360px width | YES (200-600px) | YES | Signal inspector, STIX preview |
| Bottom | Bottom edge | 200px height | YES (100-400px) | YES | Signal log, console, alerts |

### TSG.24.4.2 Panel State Atoms

Panel visibility and dimensions are stored as atoms per [ADR005]:

```typescript
// Panel state atoms (module-level)
const leftPanelAtom = Atom.make<PanelState>({
  isOpen: true,
  width: 280,
  activeTab: "adapters",
})

const rightPanelAtom = Atom.make<PanelState>({
  isOpen: false,
  width: 360,
  activeTab: "inspector",
})

const bottomPanelAtom = Atom.make<PanelState>({
  isOpen: true,
  height: 200,
  activeTab: "log",
})

interface PanelState {
  readonly isOpen: boolean
  readonly width?: number    // left/right panels
  readonly height?: number   // bottom panel
  readonly activeTab: string
}
```

### TSG.24.4.3 Drawer Overlay System

Drawers are full-height overlays for focused workflows that temporarily cover the viewport:

| Drawer | Trigger | Content | Width |
|--------|---------|---------|-------|
| Adapter Wizard | "Add Source" button in left panel | Step-by-step adapter configuration | 480px |
| Analysis Config | Analysis toolbar button | d2ts pipeline parameter editor | 520px |
| STIX Export | Export action in signal inspector | STIX bundle preview + TAXII publish | 600px |
| Settings | Gear icon in toolbar | Platform configuration | 480px |
| Alert Detail | Click on alert banner | Full alert context + response actions | 520px |

**Drawer behavior:**

1. Drawers MUST render with a semi-transparent backdrop (rgba(0,0,0,0.5))
2. Drawers MUST animate from their edge using framer-motion (300ms ease-out)
3. Backdrop click MUST close the drawer
4. Escape key MUST close the drawer
5. Drawers MUST trap focus within the drawer content
6. Only one drawer MAY be open at a time (opening a second closes the first)
7. Drawers MUST be rendered via React portal to the document body

### TSG.24.4.4 Panel Resize Interaction

Panel edges MUST support drag-to-resize:

```typescript
// Resize handle component
function ResizeHandle({ panel, direction }: ResizeHandleProps) {
  const registry = useRegistry()

  const handleDrag = useCallback((event: PointerEvent) => {
    const panelAtom = panelAtomMap[panel]
    const current = registry.get(panelAtom)

    if (direction === "horizontal") {
      const newWidth = clamp(
        event.clientX - panelRect.left,
        PANEL_MIN_WIDTH,
        PANEL_MAX_WIDTH
      )
      registry.set(panelAtom, { ...current, width: newWidth })
    } else {
      const newHeight = clamp(
        window.innerHeight - event.clientY,
        PANEL_MIN_HEIGHT,
        PANEL_MAX_HEIGHT
      )
      registry.set(panelAtom, { ...current, height: newHeight })
    }
  }, [panel, direction, registry])

  return (
    <div
      data-interactive
      role="separator"
      aria-orientation={direction}
      aria-label={`Resize ${panel} panel`}
      onPointerDown={startDrag(handleDrag)}
      style={{ cursor: direction === "horizontal" ? "col-resize" : "row-resize" }}
    />
  )
}
```

---

## TSG.24.5 Signal Inspector

### TSG.24.5.1 Purpose

The Signal Inspector is the primary detail view for examining individual signals. It displays metadata, raw payload, typed payload properties, and a STIX 2.1 preview of the exported representation.

### TSG.24.5.2 Inspector Layout

```
┌──────────────────────── Signal Inspector ──────────────────────┐
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Signal ID: sig_abc123def456                             │   │
│  │  Kind: nats         Source: nats-adapter-01             │   │
│  │  Time: 2026-02-18T10:30:00.000Z                        │   │
│  │  Version: [42, 1]                                       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                │
│  ┌─ Tabs ──────────────────────────────────────────────────┐   │
│  │  [Properties]  [Raw Payload]  [STIX Preview]  [Metadata]│   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │                                                         │   │
│  │  === Properties Tab ===                                 │   │
│  │  subject: tsingou.signals.temperature.sensor-01         │   │
│  │  data:                                                  │   │
│  │    temperature: 72.5                                    │   │
│  │    unit: "fahrenheit"                                   │   │
│  │    sensor_id: "temp-001"                                │   │
│  │  sequence: 42                                           │   │
│  │  stream: "SIGNALS"                                      │   │
│  │  consumer: "tsingou-processor"                          │   │
│  │                                                         │   │
│  │  === STIX Preview Tab ===                               │   │
│  │  {                                                      │   │
│  │    "type": "observed-data",                             │   │
│  │    "id": "observed-data--7f3a...",                      │   │
│  │    "first_observed": "2026-02-18T10:30:00Z",           │   │
│  │    "object_refs": [                                     │   │
│  │      "x-tsingou-nats-message--a1b2..."                  │   │
│  │    ]                                                    │   │
│  │  }                                                      │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                │
│  ┌─ Actions ───────────────────────────────────────────────┐   │
│  │  [Copy JSON]  [Export STIX]  [Publish to TAXII]  [Pin]  │   │
│  └─────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────┘
```

### TSG.24.5.3 Inspector Compound Component

```typescript
const Inspector = {
  Root: InspectorRoot,          // Provider: selected signal atom subscription
  Header: InspectorHeader,      // Signal ID, kind badge, source, timestamp
  Tabs: InspectorTabs,          // Tab navigation
  PropertiesTab: PropertiesTab, // Typed payload property tree
  RawTab: RawTab,               // JSON raw payload with syntax highlighting
  StixTab: StixPreviewTab,      // STIX 2.1 export preview (TSG.12/13)
  MetadataTab: MetadataTab,     // Signal metadata key-value pairs
  Actions: InspectorActions,    // Copy, export, publish, pin actions
}
```

### TSG.24.5.4 STIX Preview Tab

The STIX Preview tab integrates the StixCodec (TSG.13) to show what the selected signal would look like as a STIX 2.1 bundle:

```typescript
function StixPreviewTab() {
  const { signal } = useInspectorContext()
  const stixPreview = useAtomValue(stixPreviewAtom)

  // stixPreviewAtom is a derived atom that encodes the selected signal
  // via StixCodec.encodeSignal() whenever selectedSignalAtom changes

  if (!stixPreview) {
    return <EmptyState message="Select a signal to preview STIX export" />
  }

  return (
    <Inspector.Section title="STIX 2.1 Bundle Preview">
      <CodeBlock
        language="json"
        value={JSON.stringify(stixPreview, null, 2)}
        maxHeight="var(--tmnl-size-inspector-code-height, 400px)"
      />
      <Inspector.Actions>
        <Button onClick={() => copyToClipboard(stixPreview)}>
          Copy Bundle
        </Button>
        <Button onClick={() => publishToTaxii(stixPreview)}>
          Publish to TAXII
        </Button>
      </Inspector.Actions>
    </Inspector.Section>
  )
}
```

### TSG.24.5.5 Property Tree Rendering

The Properties tab renders typed payload fields as a navigable tree:

| Field Type | Renderer | Interaction |
|-----------|----------|-------------|
| string | Inline text with copy button | Click to copy |
| number | Formatted number with unit inference | Hover for raw value |
| boolean | Checkbox icon (read-only) | None |
| Date/timestamp | Relative + absolute time | Hover toggles format |
| Array | Collapsible list with count badge | Click to expand |
| Object | Collapsible tree with key count | Click to expand |
| Uint8Array | Hex dump with ASCII sidebar | Scrollable |
| null/undefined | Dimmed "null" text | None |

**Property tree atoms:**

```typescript
const expandedPathsAtom = Atom.make<Set<string>>(new Set())

// Derived atom: flattened property rows for virtualized rendering
const propertyRowsAtom = Atom.derive((get) => {
  const signal = get(selectedSignalAtom)
  const expanded = get(expandedPathsAtom)
  if (!signal) return []
  return flattenPayload(signal.payload, expanded)
})
```

### TSG.24.5.6 Signal Kind Badges

Each signal kind MUST be displayed with a color-coded badge:

| Kind | Color | Icon | Label |
|------|-------|------|-------|
| nats | Blue (#3B82F6) | Message bubble | NATS |
| http | Green (#22C55E) | Globe | HTTP |
| websocket | Emerald (#10B981) | Plug | WS |
| midi | Purple (#A855F7) | Music note | MIDI |
| osc | Pink (#EC4899) | Wave | OSC |
| serial | Orange (#F97316) | USB | Serial |
| rss | Amber (#F59E0B) | RSS icon | RSS |
| file-watch | Slate (#64748B) | File | File |

---

## TSG.24.6 Adapter Management Interface

### TSG.24.6.1 Adapter Browser (Left Panel)

The left panel displays all configured signal source adapters with real-time status:

```
┌──────────── Adapter Browser ────────────┐
│  ┌─ Search ─────────────────────────┐   │
│  │  🔍 Filter adapters...           │   │
│  └──────────────────────────────────┘   │
│                                         │
│  ┌─ Active (4) ─────────────────────┐   │
│  │  ● NATS Main          Running    │   │
│  │    tsingou.signals.>   12.4k/min │   │
│  │                                  │   │
│  │  ● HTTP Webhook        Running   │   │
│  │    :8080/webhook        340/min  │   │
│  │                                  │   │
│  │  ● Serial Sensor       Running   │   │
│  │    /dev/ttyUSB0         60/min   │   │
│  │                                  │   │
│  │  ◐ RSS Monitor         Polling   │   │
│  │    feeds.example.com    12/hr    │   │
│  └──────────────────────────────────┘   │
│                                         │
│  ┌─ Stopped (1) ────────────────────┐   │
│  │  ○ MIDI Controller     Stopped   │   │
│  │    No device connected           │   │
│  └──────────────────────────────────┘   │
│                                         │
│  [+ Add Source]                         │
└─────────────────────────────────────────┘
```

### TSG.24.6.2 Adapter Card Compound Component

```typescript
const AdapterCard = {
  Root: AdapterCardRoot,
  Header: AdapterCardHeader,          // Kind badge, name, status indicator
  Status: AdapterCardStatus,          // Running/Stopped/Error/Polling dot
  Metrics: AdapterCardMetrics,        // Signal rate, uptime, error count
  Config: AdapterCardConfig,          // Inline config display
  Controls: AdapterCardControls,      // Start/Stop/Restart/Configure buttons
  HealthBar: AdapterCardHealthBar,    // Health indicator (green/yellow/red)
}
```

### TSG.24.6.3 Adapter Status Indicators

| Status | Indicator | Color | Description |
|--------|-----------|-------|-------------|
| Running | Filled circle (●) | Green (#22C55E) | Actively receiving signals |
| Polling | Half circle (◐) | Blue (#3B82F6) | Waiting for next poll interval |
| Starting | Pulsing circle | Yellow (#EAB308) | Initializing connection |
| Stopped | Empty circle (○) | Gray (#94A3B8) | Manually stopped |
| Error | Filled circle with exclamation (●!) | Red (#EF4444) | Connection failed, retrying |
| Degraded | Filled circle with warning (●⚠) | Orange (#F97316) | Running with errors |

### TSG.24.6.4 Adapter Configuration Wizard

The "Add Source" button opens a drawer wizard with the following steps:

| Step | Title | Content |
|------|-------|---------|
| 1 | Select Kind | Grid of 8 signal kind cards with descriptions |
| 2 | Connection | Kind-specific connection parameters (subject, URL, port, etc.) |
| 3 | Options | Sampling rate, buffer size, filters, transforms |
| 4 | Test | Connection test with sample signal display |
| 5 | Confirm | Summary and "Create Adapter" button |

**Per-kind configuration forms:**

| Kind | Required Fields | Optional Fields |
|------|----------------|-----------------|
| nats | Subject pattern, server URL | Credentials, consumer name, deliver policy |
| http | URL, method | Headers, polling interval, SSE toggle |
| websocket | URL | Subprotocol, reconnect interval |
| midi | Device ID or "any" | Channel filter, message type filter |
| osc | Port | Address filter, remote host filter |
| serial | Port path, baud rate | Parser type, delimiter, data bits, stop bits |
| rss | Feed URL | Poll interval, max items, title filter |
| file-watch | Directory path, glob pattern | Recursive, event types, debounce ms |

### TSG.24.6.5 Adapter State Atoms

```typescript
// Registry of all configured adapters
const adapterRegistryAtom = Atom.make<Map<AdapterId, AdapterConfig>>(new Map())

// Per-adapter runtime state (derived from AdapterManager service)
const adapterStatusAtom = Atom.family<AdapterId, AdapterRuntimeStatus>(
  (id) => ({ status: "stopped", signalsPerMinute: 0, errorCount: 0, uptime: 0 })
)

// Currently selected adapter (for inspector integration)
const selectedAdapterAtom = Atom.make<AdapterId | null>(null)

// Adapter search/filter query
const adapterFilterAtom = Atom.make<string>("")

// Derived: filtered adapter list
const filteredAdaptersAtom = Atom.derive((get) => {
  const registry = get(adapterRegistryAtom)
  const filter = get(adapterFilterAtom).toLowerCase()
  if (!filter) return Array.from(registry.values())
  return Array.from(registry.values()).filter(
    (a) => a.name.toLowerCase().includes(filter) || a.kind.includes(filter)
  )
})
```

---

## TSG.24.7 Pipeline Configuration Controls

### TSG.24.7.1 Analysis Parameter Editor

The analysis configuration drawer provides form controls for d2ts pipeline parameters:

| Section | Controls | Atom |
|---------|----------|------|
| Anomaly Detection | Z-score threshold (slider 1.0-5.0), EWMA alpha (slider 0.01-0.5), window size (number 10-10000) | anomalyConfigAtom |
| Correlation | Max lag (number), min correlation (slider 0.0-1.0), auto-correlate toggle | correlationConfigAtom |
| Filtering | Signal kind checkboxes, source filter, time range picker | filterConfigAtom |
| Aggregation | Bucket size (select: 1s/5s/30s/1m/5m), aggregation function (sum/avg/min/max/count) | aggregationConfigAtom |
| Export | STIX auto-export toggle, batch size, flush interval, TLP level select | exportConfigAtom |

### TSG.24.7.2 Form Control Components

All form controls MUST use atoms for state, not useState:

```typescript
// Slider with atom binding
function AtomSlider<T>({ atom, path, min, max, step, label }: AtomSliderProps<T>) {
  const registry = useRegistry()
  const value = useAtomValue(atom)
  const fieldValue = getPath(value, path) as number

  const handleChange = useCallback((newValue: number) => {
    registry.set(atom, setPath(value, path, newValue))
  }, [registry, atom, value, path])

  return (
    <div role="group" aria-label={label}>
      <label style={{ fontSize: "var(--tmnl-text-sm)" }}>{label}</label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={fieldValue}
        onChange={(e) => handleChange(parseFloat(e.target.value))}
        aria-valuenow={fieldValue}
        aria-valuemin={min}
        aria-valuemax={max}
      />
      <span style={{ fontSize: "var(--tmnl-text-xs)" }}>
        {fieldValue.toFixed(step < 1 ? 2 : 0)}
      </span>
    </div>
  )
}
```

### TSG.24.7.3 Filter Builder

The signal filter UI allows operators to build complex filter expressions:

```
┌─────────────────── Signal Filters ──────────────────┐
│                                                     │
│  ┌─ Rule 1 ──────────────────────────────────────┐  │
│  │  [kind] [equals ▾] [nats ▾]         [×]      │  │
│  └───────────────────────────────────────────────┘  │
│  AND                                                │
│  ┌─ Rule 2 ──────────────────────────────────────┐  │
│  │  [payload.subject] [matches ▾] [temp.*] [×]   │  │
│  └───────────────────────────────────────────────┘  │
│  AND                                                │
│  ┌─ Rule 3 ──────────────────────────────────────┐  │
│  │  [timestamp] [after ▾] [2026-02-18] [×]       │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  [+ Add Rule]           [Clear All]                 │
└─────────────────────────────────────────────────────┘
```

**Filter operators per field type:**

| Field Type | Available Operators |
|-----------|-------------------|
| string | equals, not-equals, contains, starts-with, matches (regex) |
| number | equals, not-equals, greater-than, less-than, between |
| enum (kind, status) | equals, not-equals, in |
| timestamp | before, after, between, last-N-minutes |
| boolean | is-true, is-false |

---

## TSG.24.8 Alert and Notification System

### TSG.24.8.1 Alert Severity Levels

| Level | Color | Icon | Sound | Persistence |
|-------|-------|------|-------|-------------|
| Critical | Red (#EF4444) | Filled exclamation | Alarm tone | Until acknowledged |
| High | Orange (#F97316) | Triangle exclamation | Chime | Until acknowledged |
| Medium | Yellow (#EAB308) | Info circle | None | Auto-dismiss 30s |
| Low | Blue (#3B82F6) | Info circle | None | Auto-dismiss 10s |
| Info | Gray (#94A3B8) | Info circle | None | Auto-dismiss 5s |

### TSG.24.8.2 Alert Banner Placement

```
┌──────────────────────────────────────────────────────────┐
│  Toolbar                                                  │
├──────────────────────────────────────────────────────────┤
│  ┌──────────────────── Alert Stack ─────────────────────┐│
│  │ ⚠ CRITICAL: Anomalous NATS throughput on sensor-01   ││
│  │   Detected at 10:30:00 | 3.2x baseline | [View] [×] ││
│  ├──────────────────────────────────────────────────────┤│
│  │ ℹ HIGH: Serial adapter /dev/ttyUSB0 reconnecting     ││
│  │   Attempt 2/3 | Last signal 10:29:45 | [View] [×]   ││
│  └──────────────────────────────────────────────────────┘│
│                                                          │
│  Viewport (z:0-2 layers)                                 │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### TSG.24.8.3 Alert Compound Component

```typescript
const AlertBanner = {
  Root: AlertBannerRoot,          // Provider: severity, message, timestamp
  Icon: AlertBannerIcon,          // Severity-colored icon
  Message: AlertBannerMessage,    // Alert title + description
  Timestamp: AlertBannerTimestamp, // Relative time since alert
  Actions: AlertBannerActions,    // View detail, acknowledge, dismiss
  Dismiss: AlertBannerDismiss,    // Close button
}
```

### TSG.24.8.4 Alert State

```typescript
interface Alert {
  readonly id: string
  readonly severity: "critical" | "high" | "medium" | "low" | "info"
  readonly title: string
  readonly description: string
  readonly timestamp: Date
  readonly source: string           // adapter or analysis engine
  readonly acknowledged: boolean
  readonly signalRef?: string       // optional BaseSignal ID
  readonly stixIndicatorRef?: string // optional STIX indicator ID
}

const alertStackAtom = Atom.make<ReadonlyArray<Alert>>([])
const acknowledgedAlertsAtom = Atom.make<Set<string>>(new Set())

// Derived: unacknowledged critical/high count (for toolbar badge)
const urgentAlertCountAtom = Atom.derive((get) => {
  const alerts = get(alertStackAtom)
  const acked = get(acknowledgedAlertsAtom)
  return alerts.filter(
    (a) => (a.severity === "critical" || a.severity === "high") && !acked.has(a.id)
  ).length
})
```

### TSG.24.8.5 Alert-to-STIX Integration

When an alert originates from d2ts anomaly detection, the Alert Detail drawer shows:

1. The original BaseSignal that triggered the anomaly
2. The STIX indicator generated by the codec (TSG.13)
3. The STIX pattern expression
4. Matching historical signals (sightings)
5. Option to publish the indicator to TAXII collections (TSG.14)
6. Option to push to TheHive as an alert (TSG.15)

---

## TSG.24.9 Keyboard Shortcuts and Command Palette

### TSG.24.9.1 Global Keyboard Shortcuts

Implementations MUST register the following keyboard shortcuts:

| Shortcut | Action | Context |
|----------|--------|---------|
| `Cmd/Ctrl + K` | Open command palette | Global |
| `Cmd/Ctrl + ,` | Open settings | Global |
| `Cmd/Ctrl + B` | Toggle left panel | Global |
| `Cmd/Ctrl + J` | Toggle bottom panel | Global |
| `Cmd/Ctrl + Shift + I` | Toggle signal inspector (right panel) | Global |
| `Cmd/Ctrl + +` | Scale up (ScaleProvider) | Global |
| `Cmd/Ctrl + -` | Scale down (ScaleProvider) | Global |
| `Cmd/Ctrl + 0` | Reset scale | Global |
| `Escape` | Close topmost drawer/dialog/palette | Global |
| `Cmd/Ctrl + Shift + A` | Focus adapter browser | Global |
| `Cmd/Ctrl + Shift + L` | Focus signal log | Global |
| `F5` | Start/restart selected adapter | Adapter focused |
| `F6` | Stop selected adapter | Adapter focused |
| `Cmd/Ctrl + C` | Copy selected signal as JSON | Signal focused |
| `Cmd/Ctrl + Shift + C` | Copy selected signal as STIX | Signal focused |
| `Cmd/Ctrl + E` | Export selected signal to TAXII | Signal focused |
| `Up/Down` | Navigate signal list | Signal log focused |
| `Enter` | Open selected signal in inspector | Signal log focused |
| `Tab` | Next panel zone | Global (no input focused) |
| `Shift + Tab` | Previous panel zone | Global (no input focused) |

### TSG.24.9.2 Command Palette

The command palette provides a searchable list of all available actions:

```
┌──────────────────── Command Palette ──────────────────────┐
│  ┌──────────────────────────────────────────────────────┐  │
│  │  🔍 Type a command...                                │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                           │
│  Recent                                                   │
│  ├─ Toggle Signal Inspector           ⌘⇧I                │
│  ├─ Export Selected Signal as STIX    ⌘⇧C                │
│  └─ Open Adapter Wizard              —                    │
│                                                           │
│  Adapters                                                 │
│  ├─ Add New Source Adapter            —                    │
│  ├─ Start All Adapters               —                    │
│  ├─ Stop All Adapters                 —                    │
│  └─ Restart NATS Main Adapter         —                   │
│                                                           │
│  Analysis                                                 │
│  ├─ Configure Anomaly Detection       —                   │
│  ├─ Configure Correlation Engine      —                   │
│  └─ Reset All Analysis Parameters     —                   │
│                                                           │
│  Export                                                   │
│  ├─ Export All Signals as STIX Bundle  —                  │
│  ├─ Publish to TAXII Collection        —                  │
│  └─ Push Alert to TheHive              —                  │
│                                                           │
│  View                                                     │
│  ├─ Toggle Left Panel                 ⌘B                 │
│  ├─ Toggle Bottom Panel               ⌘J                 │
│  ├─ Toggle Signal Inspector           ⌘⇧I                │
│  ├─ Scale Up                          ⌘+                 │
│  └─ Scale Down                        ⌘-                 │
└───────────────────────────────────────────────────────────┘
```

### TSG.24.9.3 Command Registry

```typescript
interface Command {
  readonly id: string
  readonly label: string
  readonly shortcut?: string
  readonly category: "adapters" | "analysis" | "export" | "view" | "navigation"
  readonly action: () => void
  readonly when?: () => boolean  // Condition for availability
  readonly icon?: ReactNode
}

const commandRegistryAtom = Atom.make<Map<string, Command>>(new Map())
const commandPaletteOpenAtom = Atom.make<boolean>(false)
const commandSearchQueryAtom = Atom.make<string>("")

// Derived: filtered and ranked commands
const filteredCommandsAtom = Atom.derive((get) => {
  const registry = get(commandRegistryAtom)
  const query = get(commandSearchQueryAtom).toLowerCase()
  const all = Array.from(registry.values()).filter((c) => !c.when || c.when())
  if (!query) return all
  return all
    .filter((c) => c.label.toLowerCase().includes(query) || c.id.includes(query))
    .sort((a, b) => {
      // Exact prefix match first
      const aPrefix = a.label.toLowerCase().startsWith(query) ? 0 : 1
      const bPrefix = b.label.toLowerCase().startsWith(query) ? 0 : 1
      return aPrefix - bPrefix
    })
})
```

---

## TSG.24.10 Accessibility

### TSG.24.10.1 ARIA Landmark Structure

The DOM layer MUST define semantic landmark regions per [ARIA12]:

```html
<div class="tsingou-layer--dom" role="application" aria-label="Tsingou Signal Intelligence Platform">

  <!-- Toolbar -->
  <nav role="navigation" aria-label="Main toolbar">
    ...
  </nav>

  <!-- Left Panel -->
  <aside role="complementary" aria-label="Adapter browser">
    ...
  </aside>

  <!-- Main viewport label (for rendering layers) -->
  <main role="main" aria-label="Signal visualization viewport">
    <!-- Rendering layers z:0-2 render here -->
  </main>

  <!-- Right Panel (Inspector) -->
  <aside role="complementary" aria-label="Signal inspector">
    ...
  </aside>

  <!-- Bottom Panel -->
  <section role="log" aria-label="Signal log" aria-live="polite">
    ...
  </section>

  <!-- Alert stack -->
  <div role="alert" aria-live="assertive" aria-atomic="true">
    <!-- Critical alerts announced immediately -->
  </div>

  <!-- Drawers (portaled) -->
  <div role="dialog" aria-modal="true" aria-label="...">
    ...
  </div>
</div>
```

### TSG.24.10.2 Focus Management

| Scenario | Focus Behavior |
|----------|---------------|
| Drawer opens | Focus moves to first focusable element in drawer |
| Drawer closes | Focus returns to the element that triggered the drawer |
| Dialog opens | Focus trapped within dialog |
| Dialog closes | Focus returns to trigger element |
| Panel expands | Focus remains on trigger, content receives `aria-expanded="true"` |
| Panel collapses | Content hidden, trigger receives `aria-expanded="false"` |
| Alert appears (Critical) | Alert announced via `aria-live="assertive"`, no focus steal |
| Command palette opens | Focus moves to search input |
| Command palette closes (Escape) | Focus returns to previous element |
| Tab navigation between panels | Focus cycles: Toolbar → Left → Main → Right → Bottom |

### TSG.24.10.3 Screen Reader Announcements

| Event | Announcement | aria-live |
|-------|-------------|-----------|
| New critical alert | "Critical alert: {title}" | assertive |
| New high/medium alert | "Alert: {title}" | polite |
| Adapter status change | "{name} adapter is now {status}" | polite |
| Signal selected | "Selected {kind} signal from {source}" | polite |
| Export complete | "STIX bundle exported to {collection}" | polite |
| Filter applied | "Showing {count} signals matching filter" | polite |

### TSG.24.10.4 Color Contrast Requirements

All text and interactive elements MUST meet WCAG 2.1 AA contrast requirements [WCAG21]:

| Element | Minimum Contrast Ratio | Verification |
|---------|----------------------|-------------|
| Normal text (< 18pt) | 4.5:1 | Against panel background |
| Large text (>= 18pt or >= 14pt bold) | 3:1 | Against panel background |
| Interactive controls | 3:1 | Border/icon against background |
| Focus indicator | 3:1 | Against adjacent colors |
| Status indicators | 3:1 | Against panel background |
| Alert banners | 4.5:1 | Text against alert background |

### TSG.24.10.5 Keyboard Navigation Requirements

1. All interactive elements MUST be reachable via Tab key
2. Custom controls MUST implement appropriate ARIA roles (slider, switch, combobox, etc.)
3. Focus MUST be visible with a 2px outline (color: `var(--tmnl-color-focus, #60A5FA)`)
4. Skip links SHOULD be provided for jumping between landmark regions
5. Arrow keys MUST navigate within composite widgets (tab lists, menus, trees)

---

## TSG.24.11 Responsive Layout

### TSG.24.11.1 Breakpoint System

| Breakpoint | Name | Width | Layout Adaptation |
|-----------|------|-------|-------------------|
| xs | Mobile | < 640px | Single column, bottom sheet drawers |
| sm | Small tablet | 640-768px | Left panel collapsed, bottom panel tabs |
| md | Tablet | 768-1024px | Left panel collapsible, right panel overlay |
| lg | Desktop | 1024-1440px | Full three-column layout |
| xl | Wide | > 1440px | Extended panel widths, split inspector |

### TSG.24.11.2 Responsive Behavior

| Component | xs-sm | md | lg-xl |
|-----------|-------|-----|-------|
| Left panel | Bottom sheet (swipe up) | Collapsible sidebar (240px) | Fixed sidebar (280px) |
| Right panel | Full-screen overlay | Overlay drawer (360px) | Fixed sidebar (360px) |
| Bottom panel | Hidden (tab in bottom sheet) | Collapsible (200px) | Collapsible (200px) |
| Toolbar | Hamburger menu | Condensed icons | Full labels + icons |
| Command palette | Full-screen | Centered dialog (480px) | Centered dialog (560px) |
| Alert stack | Toast stack (bottom) | Banner stack (top) | Banner stack (top) |
| Signal inspector | Full-screen when open | Drawer overlay | Inline panel |

### TSG.24.11.3 CSS Implementation

```css
/* Responsive panel layout */
.tsingou-layout {
  display: grid;
  grid-template-columns: auto 1fr auto;
  grid-template-rows: var(--tmnl-size-toolbar) 1fr auto;
  grid-template-areas:
    "toolbar toolbar toolbar"
    "left    main    right"
    "bottom  bottom  bottom";
  height: 100vh;
}

@media (max-width: 768px) {
  .tsingou-layout {
    grid-template-columns: 1fr;
    grid-template-rows: var(--tmnl-size-toolbar) 1fr;
    grid-template-areas:
      "toolbar"
      "main";
  }
}

@media (min-width: 769px) and (max-width: 1024px) {
  .tsingou-layout {
    grid-template-columns: auto 1fr;
    grid-template-rows: var(--tmnl-size-toolbar) 1fr auto;
    grid-template-areas:
      "toolbar toolbar"
      "left    main"
      "bottom  bottom";
  }
}
```

---

## TSG.24.12 Theme System

### TSG.24.12.1 CSS Custom Property Architecture

The DOM layer theme is driven entirely by CSS custom properties injected by ScaleProvider:

**Typography tokens (THE 12px FLOOR):**

| Token | Base Size | Scaled (1.0x) | Scaled (1.25x) | Usage |
|-------|-----------|--------------|----------------|-------|
| `--tmnl-text-xs` | 12px | 12px | 15px | Labels, badges, captions — THE FLOOR |
| `--tmnl-text-sm` | 14px | 14px | 18px | Secondary text, panel labels |
| `--tmnl-text-base` | 16px | 16px | 20px | Body text, inputs, default |
| `--tmnl-text-lg` | 18px | 18px | 23px | Subheadings, panel titles |
| `--tmnl-text-xl` | 22px | 22px | 28px | Section headings |
| `--tmnl-text-2xl` | 28px | 28px | 35px | Display text |
| `--tmnl-text-3xl` | 36px | 36px | 45px | Large display |

**CRITICAL**: No text element in the DOM layer SHALL render at a size smaller than `--tmnl-text-xs` (12px at base scale). Implementations MUST NOT use Tailwind arbitrary values below this floor (e.g., `text-[8px]`, `text-[10px]` are FORBIDDEN).

**Spacing tokens:**

| Token | Base Size | Usage |
|-------|-----------|-------|
| `--tmnl-space-0` | 0px | None |
| `--tmnl-space-0_5` | 2px | Hairline gaps |
| `--tmnl-space-1` | 4px | Tight spacing |
| `--tmnl-space-2` | 8px | Default inner padding |
| `--tmnl-space-3` | 12px | Panel padding |
| `--tmnl-space-4` | 16px | Section gaps |
| `--tmnl-space-5` | 20px | Large gaps |
| `--tmnl-space-6` | 24px | Panel margins |

**Component size tokens:**

| Token | Base Size | Usage |
|-------|-----------|-------|
| `--tmnl-size-button-xs` | 24px | Compact action buttons |
| `--tmnl-size-button-sm` | 28px | Small buttons |
| `--tmnl-size-button-md` | 32px | Standard buttons |
| `--tmnl-size-button-lg` | 40px | Primary action buttons |
| `--tmnl-size-header` | 48px | Toolbar height |
| `--tmnl-size-footer` | 36px | Footer bar height |
| `--tmnl-size-input` | 36px | Input field height |
| `--tmnl-size-toolbar` | 44px | Toolbar height |

### TSG.24.12.2 Color Tokens

```css
:root {
  /* Surface colors (dark theme default) */
  --tmnl-color-bg-primary: #0F172A;       /* Main background */
  --tmnl-color-bg-secondary: #1E293B;     /* Panel backgrounds */
  --tmnl-color-bg-tertiary: #334155;      /* Card backgrounds */
  --tmnl-color-bg-hover: #475569;         /* Hover state */
  --tmnl-color-bg-active: #64748B;        /* Active/pressed state */

  /* Border colors */
  --tmnl-color-border-default: #334155;   /* Default borders */
  --tmnl-color-border-subtle: #1E293B;    /* Subtle separators */
  --tmnl-color-border-focus: #60A5FA;     /* Focus rings */

  /* Text colors */
  --tmnl-color-text-primary: #F8FAFC;     /* Primary text */
  --tmnl-color-text-secondary: #94A3B8;   /* Secondary/dimmed text */
  --tmnl-color-text-tertiary: #64748B;    /* Disabled/hint text */
  --tmnl-color-text-inverse: #0F172A;     /* Text on light backgrounds */

  /* Semantic colors */
  --tmnl-color-success: #22C55E;
  --tmnl-color-warning: #EAB308;
  --tmnl-color-error: #EF4444;
  --tmnl-color-info: #3B82F6;

  /* Signal kind colors (match TSG.24.5.6) */
  --tmnl-color-kind-nats: #3B82F6;
  --tmnl-color-kind-http: #22C55E;
  --tmnl-color-kind-websocket: #10B981;
  --tmnl-color-kind-midi: #A855F7;
  --tmnl-color-kind-osc: #EC4899;
  --tmnl-color-kind-serial: #F97316;
  --tmnl-color-kind-rss: #F59E0B;
  --tmnl-color-kind-file-watch: #64748B;

  /* Focus ring */
  --tmnl-color-focus: #60A5FA;
  --tmnl-focus-ring: 0 0 0 2px var(--tmnl-color-focus);
}
```

### TSG.24.12.3 Light Theme Override

```css
[data-theme="light"] {
  --tmnl-color-bg-primary: #FFFFFF;
  --tmnl-color-bg-secondary: #F8FAFC;
  --tmnl-color-bg-tertiary: #F1F5F9;
  --tmnl-color-bg-hover: #E2E8F0;
  --tmnl-color-bg-active: #CBD5E1;
  --tmnl-color-border-default: #E2E8F0;
  --tmnl-color-border-subtle: #F1F5F9;
  --tmnl-color-text-primary: #0F172A;
  --tmnl-color-text-secondary: #475569;
  --tmnl-color-text-tertiary: #94A3B8;
  --tmnl-color-text-inverse: #F8FAFC;
}
```

### TSG.24.12.4 Scale Integration

The ScaleProvider (already implemented at `src/lib/scale/ScaleProvider.tsx`) injects all `--tmnl-*` tokens at `:root` level. The DOM layer MUST consume these tokens exclusively — no hard-coded pixel values for typography, spacing, or component sizes.

```typescript
// ScaleProvider generates CSS custom properties:
// --tmnl-scale: 1.0
// --tmnl-text-xs: 12px  (at scale 1.0)
// --tmnl-text-sm: 14px
// --tmnl-text-base: 16px
// ...
// --tmnl-space-1: 4px
// --tmnl-space-2: 8px
// ...
// --tmnl-size-button-md: 32px
// --tmnl-size-toolbar: 44px
// ...
```

Keyboard shortcuts for scaling are already registered via `useScaleKeyboardShortcuts()`:
- `Cmd/Ctrl + =` → Scale up
- `Cmd/Ctrl + -` → Scale down
- `Cmd/Ctrl + 0` → Reset to 1.0x

---

## TSG.24.13 Performance Optimization

### TSG.24.13.1 Virtualized Lists

The signal log and adapter browser MUST use virtualized rendering for lists exceeding 100 items:

```typescript
import { useVirtualizer } from "@tanstack/react-virtual"

function SignalLog() {
  const signals = useAtomValue(signalLogAtom)
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: signals.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48, // Estimated row height in px
    overscan: 20,           // Extra rows rendered above/below
  })

  return (
    <div ref={parentRef} style={{ height: "100%", overflow: "auto" }}>
      <div style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <SignalLogRow
            key={virtualRow.key}
            signal={signals[virtualRow.index]}
            style={{
              position: "absolute",
              top: virtualRow.start,
              height: virtualRow.size,
              width: "100%",
            }}
          />
        ))}
      </div>
    </div>
  )
}
```

### TSG.24.13.2 React.memo Boundaries

Implementations MUST define memo boundaries at the following component levels:

| Component | Memo Strategy | Re-render Trigger |
|-----------|--------------|-------------------|
| AdapterCard | React.memo with id comparison | Adapter status change for THIS adapter |
| SignalLogRow | React.memo with signal.id comparison | Never (rows are immutable) |
| AlertBanner | React.memo with alert.id comparison | Acknowledgment state change |
| InspectorHeader | React.memo | Selected signal changes |
| PropertyTreeNode | React.memo with path comparison | Expand/collapse of THIS node |
| CommandPaletteItem | React.memo | Search query changes (filtered externally) |
| ToolbarButton | React.memo | Badge count changes |

### TSG.24.13.3 Lazy Loading

Non-critical components MUST be lazy-loaded to reduce initial bundle size:

```typescript
// Lazy-loaded drawer contents
const AdapterWizard = lazy(() => import("./drawers/AdapterWizard"))
const AnalysisConfig = lazy(() => import("./drawers/AnalysisConfig"))
const StixExportDrawer = lazy(() => import("./drawers/StixExportDrawer"))
const SettingsDrawer = lazy(() => import("./drawers/SettingsDrawer"))

// Lazy-loaded inspector tabs
const StixPreviewTab = lazy(() => import("./inspector/StixPreviewTab"))
const RawPayloadTab = lazy(() => import("./inspector/RawPayloadTab"))
```

### TSG.24.13.4 Atom Subscription Granularity

To prevent unnecessary re-renders, implementations MUST use fine-grained atom subscriptions:

```typescript
// BAD: subscribes to entire adapter registry (re-renders on ANY adapter change)
const allAdapters = useAtomValue(adapterRegistryAtom)

// GOOD: subscribes to single adapter status (re-renders only for THIS adapter)
const status = useAtomValue(adapterStatusAtom(adapterId))

// BAD: subscribes to full signal list (re-renders on every signal)
const signals = useAtomValue(signalLogAtom)

// GOOD: subscribes to signal count (re-renders only when count changes)
const signalCount = useAtomValue(signalCountAtom)
```

### TSG.24.13.5 Debounced State Updates

Form controls that produce high-frequency updates MUST debounce atom writes:

| Control | Update Frequency | Debounce | Atom Write |
|---------|-----------------|----------|------------|
| Text input (search) | Per keystroke | 200ms | Debounced |
| Slider (threshold) | Per pointer move | 50ms | Debounced |
| Checkbox (filter) | Per click | 0ms | Immediate |
| Select (dropdown) | Per selection | 0ms | Immediate |
| Resize handle | Per pointer move | 16ms (rAF) | requestAnimationFrame |

---

## TSG.24.14 Signal Log (Bottom Panel)

### TSG.24.14.1 Log Display

The bottom panel displays a real-time scrolling log of ingested signals:

```
┌─────────────────────────── Signal Log ─────────────────────────────────────┐
│  [Tabs: All | NATS | HTTP | MIDI | OSC | Serial | RSS | WS | Files]       │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ TIME          KIND    SOURCE            SUBJECT / URL         SIZE    │ │
│  │ 10:30:00.123  NATS    nats-main         tsingou.signals.temp  128B   │ │
│  │ 10:30:00.456  HTTP    http-webhook      POST /api/data        2.1K   │ │
│  │ 10:30:01.001  MIDI    midi-controller   note-on ch:0 C4       3B     │ │
│  │ 10:30:01.234  NATS    nats-main         tsingou.signals.pres  96B    │ │
│  │ 10:30:01.567  Serial  serial-sensor     /dev/ttyUSB0          64B    │ │
│  │ ...                                                                   │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│  Showing 4,231 signals | 12,400/min | [⏸ Pause] [🗑 Clear] [📥 Export]    │
└────────────────────────────────────────────────────────────────────────────┘
```

### TSG.24.14.2 Log Columns

| Column | Width | Content | Sort |
|--------|-------|---------|------|
| Time | 120px | Timestamp (HH:mm:ss.SSS) | Default descending |
| Kind | 80px | Color-coded badge (TSG.24.5.6) | Alphabetical |
| Source | 140px | Adapter name | Alphabetical |
| Summary | flex | Subject (NATS), URL (HTTP), address (OSC), etc. | N/A |
| Size | 60px | Payload size (human-readable) | Numeric |

### TSG.24.14.3 Log State Atoms

```typescript
// Signal log buffer (ring buffer, max 100,000 entries)
const signalLogAtom = Atom.make<ReadonlyArray<SignalLogEntry>>([])
const signalLogPausedAtom = Atom.make<boolean>(false)
const signalLogFilterAtom = Atom.make<KnownSignalKind | "all">("all")
const signalLogScrollAnchorAtom = Atom.make<"bottom" | "manual">("bottom")

// Derived: filtered log entries
const filteredLogAtom = Atom.derive((get) => {
  const log = get(signalLogAtom)
  const filter = get(signalLogFilterAtom)
  if (filter === "all") return log
  return log.filter((entry) => entry.kind === filter)
})

// Derived: signal rate (signals per minute, computed from last 60s)
const signalRateAtom = Atom.derive((get) => {
  const log = get(signalLogAtom)
  const now = Date.now()
  const oneMinuteAgo = now - 60_000
  return log.filter((entry) => entry.timestamp.getTime() > oneMinuteAgo).length
})
```

### TSG.24.14.4 Auto-Scroll Behavior

The signal log MUST auto-scroll to the bottom as new signals arrive, unless the operator has manually scrolled up:

1. If `signalLogScrollAnchorAtom` is `"bottom"`, auto-scroll to latest entry
2. If operator scrolls up manually, set anchor to `"manual"` (pause auto-scroll)
3. If operator scrolls back to bottom, restore anchor to `"bottom"`
4. The "Pause" button sets `signalLogPausedAtom` to `true`, stopping new entries from being appended
5. While paused, a badge shows the count of buffered entries

---

## TSG.24.15 Integration with Rendering Layers

### TSG.24.15.1 Atom Bridge Pattern

The DOM layer communicates with rendering layers (R3F, visx, p5) exclusively through shared atoms. No direct imports between layers are permitted.

**Cross-layer atoms:**

| Atom | Writer | Readers | Purpose |
|------|--------|---------|---------|
| selectedSignalAtom | DOM (inspector click), R3F (node click) | DOM (inspector), R3F (highlight), visx (highlight) | Signal selection |
| adapterConfigAtom | DOM (config panel) | All layers (update visualizations) | Adapter parameters |
| filterConfigAtom | DOM (filter builder) | visx (chart filter), p5 (waterfall filter) | Active filters |
| anomalyConfigAtom | DOM (analysis config) | d2ts pipeline | Analysis thresholds |
| viewportBoundsAtom | DOM (resize observer) | R3F (camera), visx (chart size), p5 (canvas size) | Viewport dimensions |
| timeRangeAtom | DOM (time picker) | visx (x-axis range), p5 (waterfall range) | Visible time window |
| signalHighlightAtom | DOM (hover), R3F (hover) | visx (data point highlight), p5 (waterfall cursor) | Hover highlight |
| themeAtom | DOM (theme toggle) | All layers (color schemes) | Active theme |
| scaleAtom | DOM (ScaleProvider) | DOM only (CSS variables) | UI scale factor |

### TSG.24.15.2 Selection Synchronization

When a signal is selected in any layer, all layers update:

```
User clicks signal in R3F (3D network graph)
  │
  ├─► R3F: registry.set(selectedSignalAtom, signal)
  │
  ├─► DOM: useAtomValue(selectedSignalAtom) triggers:
  │     - Inspector opens (right panel)
  │     - Signal log scrolls to entry
  │     - STIX preview updates
  │
  ├─► visx: useAtomValue(selectedSignalAtom) triggers:
  │     - Data point highlighted on timeline
  │     - Heatmap cell highlighted
  │
  └─► p5: useAtomValue(selectedSignalAtom) triggers:
        - Waterfall cursor moves to timestamp
```

---

## TSG.24.16 Normative Requirements Summary

### TSG.24.16.1 MUST Requirements

1. All control surfaces MUST be implemented as compound components (Provider → Consumer → Slots)
2. Panel state MUST be stored in atoms, not useState
3. The DOM layer root MUST use `pointer-events: none` with `pointer-events: auto` on interactive children
4. No text element SHALL render below `--tmnl-text-xs` (12px at base scale)
5. All CSS sizing MUST use `--tmnl-*` custom property tokens
6. Lists exceeding 100 items MUST use virtualized rendering
7. All interactive elements MUST be keyboard accessible
8. ARIA landmarks MUST be defined for all panel zones
9. Critical alerts MUST use `aria-live="assertive"` for screen reader announcements
10. Color contrast MUST meet WCAG 2.1 AA requirements (4.5:1 for normal text)
11. Focus indicators MUST be visible with minimum 2px outline
12. Cross-layer communication MUST use atoms exclusively (no direct imports)
13. Form controls MUST debounce high-frequency atom writes
14. Drawers MUST trap focus and close on Escape

### TSG.24.16.2 SHOULD Requirements

1. Drawers SHOULD animate with framer-motion (300ms ease-out)
2. The command palette SHOULD support fuzzy search
3. Signal log SHOULD maintain a ring buffer of 100,000 entries maximum
4. Adapter status indicators SHOULD update in real-time (< 1s latency)
5. The STIX preview tab SHOULD display the full bundle including extension-definitions
6. Theme preference SHOULD persist to localStorage
7. Panel dimensions SHOULD persist to localStorage

### TSG.24.16.3 MAY Requirements

1. The DOM layer MAY support touch gestures for mobile viewports
2. Sound notifications MAY be configurable per alert severity
3. Custom keyboard shortcuts MAY be user-configurable
4. The signal log MAY support column reordering and resizing
5. The command palette MAY learn from usage frequency for result ranking

---

## TSG.24.17 Security Considerations

### TSG.24.17.1 Input Sanitization

All user input in the DOM layer (search queries, filter expressions, adapter URLs) MUST be sanitized before:

1. Rendering in innerHTML (use textContent or React's JSX escaping)
2. Constructing NATS subjects (prevent subject injection)
3. Building STIX patterns (prevent pattern injection — TSG.13.12)
4. Displaying in code blocks (prevent XSS via payload content)

### TSG.24.17.2 Credential Handling

Adapter configuration forms that accept credentials (NATS credentials, API keys, mTLS certs) MUST:

1. Render password fields with `type="password"`
2. Never display credentials in plaintext after initial entry
3. Store credentials via the platform's secure credential store (not localStorage)
4. Clear credential values from memory after form submission

---

## References

| Key | Citation |
|-----|----------|
| [RFC2119] | IETF, "Key words for use in RFCs to Indicate Requirement Levels", March 1997 |
| [RFC8174] | IETF, "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words", May 2017 |
| [WCAG21] | W3C, "Web Content Accessibility Guidelines (WCAG) 2.1", June 2018 |
| [ARIA12] | W3C, "WAI-ARIA 1.2", December 2023 |
| [ADR005] | Tsingou ADR-005, "Atom-as-State Doctrine" |
| [TANSTACK] | TanStack, "TanStack Virtual — Headless UI Virtualizer" |
| [FRAMER] | Framer, "Framer Motion — Production-Ready Motion Library for React" |
| [RADIX] | Radix UI, "Radix Primitives — Unstyled Accessible Components" |

---

*End of Section TSG.24*
