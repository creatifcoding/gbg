# Primitives Changelog

All notable changes to the TMNL Primitives module.

---

## [1.0.0] - 2024-12-08

### Added

#### Metrics (`metrics/`)

- **MetricBadge** - Unified metric display component
  - Two layout variants: `inline` (horizontal) and `cell` (vertical)
  - Five accent colors: `cyan`, `amber`, `green`, `rose`, `neutral`
  - Three format modes: `locale`, `fixed`, `none`
  - Configurable decimal places
  - Replaces duplicate `MetricBadge` in ThroughputPanel and LatencyPanel
  - Replaces `MetricCell` in MetricsPanel

#### Panel (`panel/`)

- **PanelWrapper** - Unified panel container
  - Header with title and trailing content slot
  - Footer slot
  - Configurable background opacity (`30`, `50`, `80`)
  - Configurable padding (`sm`, `md`, `lg`)
- **PanelHeader** - Standalone header component
- **PanelFooter** - Standalone footer component with optional border

#### Slider (`slider/`)

- **LogSlider** - Logarithmic scale slider
  - For exponential ranges (1→10k, 20Hz→20kHz)
  - Built-in presets: `throughput`, `frequency`, `duration`, `multiplier`
  - Customizable value formatter
  - Optional value display
  - Extracted from `ScenarioConfigPanel`

#### FSM (`fsm/`)

- **StateNode** - FSM state visualization
  - Five semantic types: `success`, `error`, `warning`, `info`, `neutral`
  - Active/inactive visual states
  - Pulsing indicator for active state
  - Three sizes: `sm`, `md`, `lg`
- **TransitionArrow** - FSM transition connector
  - Eight directions: `right`, `left`, `up`, `down`, `diag-*`
  - Optional label
- **TransitionRule** - FSM transition rule display
  - Shows source → target with condition
  - Active/inactive highlighting
- **getStateColors** - Helper to access state color palette
- All extracted from `CircuitBreakerPanel`

### Changed

- Updated `ThroughputPanel` to use `MetricBadge` from primitives
- Updated `LatencyPanel` to use `MetricBadge` from primitives
- Updated `MetricsPanel` to use `MetricBadge` with `variant="cell"`
- Updated `CircuitBreakerPanel` to use FSM primitives
- Updated `ScenarioConfigPanel` to use `LogSlider` from primitives

### Removed

- Local `MetricBadge` component from `ThroughputPanel`
- Local `MetricBadge` component from `LatencyPanel`
- Local `MetricCell` component from `MetricsPanel`
- Local `StateNode`, `TransitionArrow`, `TransitionRule` from `CircuitBreakerPanel`
- Local `LogSlider` component from `ScenarioConfigPanel`

---

## Design Decisions

### MetricBadge Unification

The original codebase had three similar components:

1. `MetricBadge` in ThroughputPanel - used `toLocaleString()`
2. `MetricBadge` in LatencyPanel - used `toFixed(1)`
3. `MetricCell` in MetricsPanel - vertical layout with border

The unified `MetricBadge` handles all three cases through:

- `variant` prop for layout (`inline` vs `cell`)
- `format` prop for value formatting (`locale` vs `fixed`)
- `decimals` prop for precision control

### FSM State Types

Circuit breaker states (`closed`, `open`, `half-open`) were mapped to semantic FSM types:

| Circuit State | FSM Type  | Color  |
| ------------- | --------- | ------ |
| `closed`      | `success` | green  |
| `open`        | `error`   | red    |
| `half-open`   | `warning` | amber  |

This allows the FSM primitives to be reused for any state machine visualization.

### LogSlider Independence

The `LogSlider` primitive is independent of the DAW-grade slider system (`@/lib/slider`). It's a lightweight, plug-and-play component that doesn't require Effect.Service behaviors.

For advanced use cases (precision modifiers, debug overlays, behavior switching), use `@/lib/slider`.

---

## Migration Notes

### For MetricBadge consumers

```tsx
// Before
<MetricBadge label="Value" value={v.toFixed(1)} accent="cyan" />

// After
<MetricBadge label="Value" value={v} accent="cyan" format="fixed" decimals={1} />
```

### For vertical metrics (was MetricCell)

```tsx
// Before
<MetricCell label="Total" value={count} accent="neutral" />

// After
<MetricBadge variant="cell" label="Total" value={count} accent="neutral" />
```

### For FSM components

```tsx
// Before - state-specific
<StateNode state="closed" isActive={...} />

// After - semantic types
<StateNode type="success" label="Closed" isActive={...} />
```
