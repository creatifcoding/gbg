# TMNL Testbed Catalog

> **Philosophy**: Testbeds are proving grounds, not production. They validate integration patterns before systemic synthesis.

---

## Overview

TMNL follows **testbed-driven development**. Each subsystem has dedicated testbeds that:

1. **Validate hypotheses** before production integration
2. **Exercise Effect patterns** (services, atoms, streams)
3. **Demonstrate UI/UX** in isolation
4. **Serve as living documentation**

---

## Testbed Index by Category

### Data (6 testbeds)

| Testbed | Route | Services Exercised | Status |
|---------|-------|-------------------|--------|
| **DataManager v1** | `/testbed/data-manager/v1` | DataManager, KernelRegistry, SearchKernel | Stable |
| **DataManager v2** | `/testbed/data-manager/v2` | DataManager v2, KernelRegistry v2 | Experimental |
| **Search Lab** | `/testbed/search` | SearchService, FlexSearch driver | Stable |
| **AG-Grid Surface** | `/testbed/data-grid` | TableService, GridDragService | Stable |
| **Indices Builder** | `/testbed/indices` | Stream composition, multi-source search | Experimental |
| **AVA Client** | `/testbed/ava` | Effect Platform HTTP/WS, TmnlDataGrid | Experimental |

### Animation (2 testbeds)

| Testbed | Route | Services Exercised | Status |
|---------|-------|-------------------|--------|
| **Animation v1** | `/testbed` | animatable(), GSAP driver | Stable |
| **Animation v2** | `/testbed/v2` | anime.js driver, Effect-ified sequences | Experimental |

### UI (6 testbeds)

| Testbed | Route | Services Exercised | Status |
|---------|-------|-------------------|--------|
| **Slider v1** | `/testbed/slider` | SliderBehavior (Linear, Log, Decibel) | Stable |
| **Slider v2** | `/testbed/slider-v2` | Trait-based slider | Experimental |
| **Base Modal** | `/testbed/base-modal` | OverlayRegistry, focus trap | Stable |
| **Vanta Design** | `/testbed/vanta` | VantaCard components | Stable |
| **Drawer** | `/testbed/drawer` | Visual overlay provider, DrawerRenderer | Stable |
| **Floating Panel** | `/testbed/floating-panel` | Panel positioning, drag | Experimental |

### State (4 testbeds)

| Testbed | Route | Services Exercised | Status |
|---------|-------|-------------------|--------|
| **Effect-Atom** | `/testbed/effect-atom` | Atom.runtime(), service-scoped atoms | Stable |
| **Traits** | `/testbed/traits` | Trait system, slots injection | Stable |
| **Capabilities** | `/testbed/capabilities` | Layer system, z-index management | Stable |
| **Selection** | `/testbed/selection` | Selection state, multi-select | Stable |

### Input (2 testbeds)

| Testbed | Route | Services Exercised | Status |
|---------|-------|-------------------|--------|
| **Hotkeys** | `/testbed/hotkeys` | CommandService, KeyParser | Stable |
| **Keybindings** | `/testbed/keybindings` | Binding overrides, conflict detection | Stable |

### Charting (1 testbed)

| Testbed | Route | Services Exercised | Status |
|---------|-------|-------------------|--------|
| **Charting** | `/testbed/charting` | ECharts, RingBuffer streaming | Stable |

### Overlay (2 testbeds)

| Testbed | Route | Services Exercised | Status |
|---------|-------|-------------------|--------|
| **Overlay** | `/testbed/overlay` | VisualOverlayProvider, renderers | Stable |
| **SCADA Overlay** | `/testbed/scada-overlay` | Industrial UI patterns | Experimental |

---

## Complete File Listing

```
src/components/testbed/
├── AnimationTestbed.tsx           # GSAP/anime.js animation primitives
├── AvaTestbed.tsx                 # AVA client with WebSocket + HTTP
├── BaseModalTestbed.tsx           # Accessible modal primitives
├── CapabilityTestbed.tsx          # Layer capabilities
├── ChartingTestbed.tsx            # ECharts with streaming
├── DataGridTestbed.tsx            # AG-Grid v34 integration
├── DataGridTestbedSwitch.tsx      # Grid variant switcher
├── DataGridTestbedV2.tsx          # Grid v2 experiments
├── DataGridVariantTestbed.tsx     # Variant builder
├── DataGridVariantTestbedSwitch.tsx
├── DataGridVariantTestbedV2.tsx
├── DataManagerTestbed.tsx         # Legacy data manager
├── DevDocOverlay.tsx              # Developer documentation overlay
├── DrawerTestbed.tsx              # Drawer system
├── EffectAtomTestbed.tsx          # effect-atom patterns
├── FloatingPanelTestbed.tsx       # Floating panel positioning
├── HalflifeTimeline.tsx           # Timeline visualization
├── HotkeyTestbed.tsx              # Hotkey system
├── IndicesTestbed.tsx             # Multi-source search
├── KeybindingTestbed.tsx          # Keybinding configuration
├── OverlayTestbed.tsx             # Visual overlay system
├── ScadaOverlayTestbed.tsx        # Industrial SCADA patterns
├── SearchTestbed.tsx              # Search framework
├── SelectionTestbed.tsx           # Selection state
├── SliderTestbed.tsx              # Slider v1 (DAW-grade)
├── SliderV2Testbed.tsx            # Slider v2 (trait-based)
├── TraitTestbed.tsx               # Trait system
├── VantaCardTestbed.tsx           # Vanta design system
├── ava/                           # AVA sub-components
│   ├── GraphVisualization.tsx     # Asset graph
│   ├── ReplConsole.tsx            # REPL interface
│   ├── ScenarioRunner.tsx         # Test scenarios
│   ├── SequenceDiagram.tsx        # Message sequences
│   └── StateInspector.tsx         # State debugging
├── data-manager/
│   ├── v1/index.tsx               # DataManager v1 testbed
│   └── v2/index.tsx               # DataManager v2 testbed
└── shared/
    ├── hypothesis.tsx             # Hypothesis tracking UI
    ├── keyboard.tsx               # Keyboard event display
    ├── primitives.tsx             # Shared UI primitives
    └── render-tracking.tsx        # Render count tracking
```

---

## Testbed Details

### DataManager v1 (`/testbed/data-manager/v1`)

**Purpose**: Validate Effect.Service pattern with kernel architecture.

**Hypotheses Tested**:
- H1: effect-atom state flows correctly to AG-Grid rowData
- H2: Progressive stream updates trigger grid re-renders without flicker
- H3: Service-scoped atoms provide cleaner DX than useState
- H4: Throughput atom provides real-time search metrics
- H5: Driver switching (flex/linear) is seamless

**Services Used**:
- `DataManager<T>` — Service-scoped data orchestration
- `KernelRegistry` — Kernel factory + lookup
- `SearchKernel` — FlexSearch and Linear drivers

**Key Patterns**:
```typescript
// Atom.runtime() for service integration
const runtimeAtom = Atom.runtime(DataManager.Default)

// Service-scoped atom reads
const results = useAtomValue(runtimeAtom.atom(
  Effect.gen(function* () {
    const dm = yield* DataManager
    return yield* dm.search(query)
  })
))
```

---

### Slider v1 (`/testbed/slider`)

**Purpose**: DAW-grade slider with runtime-swappable behaviors.

**Behaviors Demonstrated**:
- `LinearBehavior` — Uniform distribution
- `LogarithmicBehavior` — Frequency, gain
- `DecibelBehavior` — Audio gain with 0dB reference
- `ExponentialBehavior` — Time constants
- `SteppedBehavior` — Discrete values

**Precision Modifiers**:
| Modifier | Sensitivity | Use Case |
|----------|-------------|----------|
| None | 1.0x | Normal dragging |
| Shift | 0.1x | Fine adjustment |
| Ctrl | 0.01x | Ultra-fine (sub-dB) |
| Alt | Snap | Force stepping |

**Key Patterns**:
```typescript
// Runtime-swappable behavior via Effect.Service
const sliderRuntime = Atom.runtime(DecibelBehavior.Default)

// Behavior shape injection
const behavior = yield* SliderBehavior
const value = behavior.normalizedToValue(normalized, config)
```

---

### Effect-Atom (`/testbed/effect-atom`)

**Purpose**: Demonstrate Atom.runtime() for service-scoped reactive state.

**Patterns Demonstrated**:
- `Atom.make()` for basic state
- `Atom.runtime(Layer)` for Effect service integration
- `runtimeAtom.atom(Effect.gen(...))` for service-scoped reads
- `runtimeAtom.fn<T>()(Effect.gen(...))` for mutations
- `Atom.batch()` for coalesced updates

**Anti-Patterns Identified**:
- ❌ `useState` for cross-component state
- ❌ `Effect.Ref` for React-facing state
- ❌ `useEffect` for derived state

---

### Hotkeys (`/testbed/hotkeys`)

**Purpose**: Command system with keyboard shortcuts.

**Services Demonstrated**:
- `CommandService` — Command registration and execution
- `KeyParser` — Key chord parsing and normalization

**Features**:
- Scoped contexts (global, modal, panel)
- Conflict detection
- User-configurable overrides
- Command palette integration

---

### AVA Client (`/testbed/ava`)

**Purpose**: Asset View Agent client with Effect Platform.

**Components**:
- `ReplConsole` — Interactive REPL
- `StateInspector` — State debugging
- `SequenceDiagram` — Message sequence visualization
- `ScenarioRunner` — Test scenario execution
- `GraphVisualization` — Asset relationship graph

**Effect Platform Integration**:
- HTTP client for REST API
- WebSocket for real-time events
- Stream-based event processing
- Effect.retry for resilience

---

## Testbed Development Guidelines

### Creating a New Testbed

1. **Create component** in `src/components/testbed/`
2. **Add route** in `src/router.tsx`
3. **Register** in `src/lib/testbed/registry.ts`
4. **Document hypotheses** being tested
5. **Use shared primitives** from `testbed/shared/`

### Testbed Structure

```typescript
/**
 * [Name]Testbed.tsx
 *
 * Purpose: [What this testbed validates]
 *
 * Hypotheses:
 * - H1: [Hypothesis 1]
 * - H2: [Hypothesis 2]
 *
 * Services: [Services exercised]
 */

export function NameTestbed() {
  // Hypothesis tracking (optional)
  const [hypotheses, setHypotheses] = useState<HypothesisState>({...})

  // Service integration via Atom.runtime
  const runtime = useAtomValue(serviceRuntimeAtom)

  return (
    <TestbedLayout title="Name">
      <HypothesisPanel hypotheses={hypotheses} />
      <MainContent>
        {/* Testbed implementation */}
      </MainContent>
    </TestbedLayout>
  )
}
```

### Shared Utilities

**`testbed/shared/hypothesis.tsx`**:
```typescript
interface Hypothesis {
  id: string
  description: string
  status: "pending" | "validated" | "failed"
}

function HypothesisPanel({ hypotheses }: { hypotheses: Hypothesis[] })
```

**`testbed/shared/render-tracking.tsx`**:
```typescript
function RenderCounter(): JSX.Element  // Shows render count
function useRenderCount(): number       // Hook for tracking
```

**`testbed/shared/keyboard.tsx`**:
```typescript
function KeyboardEventDisplay()  // Shows live key events
function useKeyboardDebug()      // Hook for key debugging
```

---

## Testbed → Production Pathway

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    TESTBED      │────►│   INTEGRATION   │────►│   PRODUCTION    │
│                 │     │                 │     │                 │
│ - Hypotheses    │     │ - Wire to app   │     │ - AppShell      │
│ - Isolation     │     │ - Layer compose │     │ - Full routing  │
│ - Edge cases    │     │ - Error bounds  │     │ - Monitoring    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### Integration Checklist

- [ ] All hypotheses validated in testbed
- [ ] Service Layer exported from `src/lib/*/index.ts`
- [ ] Atoms exported for React consumption
- [ ] Error boundaries in place
- [ ] Performance profiled (no unnecessary re-renders)
- [ ] Accessibility verified (keyboard nav, screen readers)
- [ ] Documentation updated

---

## Version History

| Date | Testbeds Added | Notes |
|------|----------------|-------|
| 2024-11 | Animation, Slider v1 | Initial testbed system |
| 2024-11 | DataManager v1, Search | Data orchestration |
| 2024-11 | Effect-Atom, Traits | State patterns |
| 2024-12 | Hotkeys, Keybindings | Input system |
| 2024-12 | AVA, Indices | Advanced data |
| 2024-12 | Slider v2, DataManager v2 | Refined patterns |
