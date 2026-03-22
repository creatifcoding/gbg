# TMNL Primitives

Reusable, generalized UI components extracted from domain-specific panels. These primitives follow the **base → specialized variant** pattern and can be composed across the codebase.

## Categories

| Category   | Components                                      | Purpose                            |
| ---------- | ----------------------------------------------- | ---------------------------------- |
| `metrics`  | `MetricBadge`                                   | Value display with accent colors   |
| `panel`    | `PanelWrapper`, `PanelHeader`, `PanelFooter`    | Container components               |
| `slider`   | `LogSlider`                                     | Specialized slider variants        |
| `fsm`      | `StateNode`, `TransitionArrow`, `TransitionRule`| FSM visualization components       |

## Quick Start

```tsx
import {
  MetricBadge,
  PanelWrapper,
  LogSlider,
  StateNode,
  TransitionArrow,
} from '@/components/primitives'
```

---

## MetricBadge

Unified metric display with two layout variants.

### Props

| Prop         | Type                                        | Default    | Description                    |
| ------------ | ------------------------------------------- | ---------- | ------------------------------ |
| `label`      | `string`                                    | required   | Display label                  |
| `value`      | `number \| string`                          | required   | Value to display               |
| `unit`       | `string`                                    | -          | Unit suffix (e.g., "/s", "ms") |
| `accent`     | `'cyan' \| 'amber' \| 'green' \| 'rose' \| 'neutral'` | `'neutral'` | Color accent |
| `variant`    | `'inline' \| 'cell'`                        | `'inline'` | Layout variant                 |
| `format`     | `'locale' \| 'fixed' \| 'none'`             | `'locale'` | Value formatting               |
| `decimals`   | `number`                                    | `1`        | Decimal places for fixed       |

### Examples

```tsx
// Inline variant (horizontal)
<MetricBadge label="Current" value={1234} unit="/s" accent="cyan" />

// Cell variant (vertical with separator)
<MetricBadge variant="cell" label="Total" value={50000} />

// Fixed decimal formatting
<MetricBadge label="Latency" value={2.5678} unit="ms" format="fixed" decimals={2} />
```

---

## PanelWrapper

Unified panel container with header/footer slots.

### Props

| Prop            | Type                   | Default | Description                |
| --------------- | ---------------------- | ------- | -------------------------- |
| `title`         | `string`               | -       | Panel title                |
| `headerTrailing`| `ReactNode`            | -       | Right-side header content  |
| `children`      | `ReactNode`            | required| Main content               |
| `footer`        | `ReactNode`            | -       | Footer content             |
| `bgOpacity`     | `'30' \| '50' \| '80'` | `'30'`  | Background opacity         |
| `padding`       | `'sm' \| 'md' \| 'lg'` | `'md'`  | Padding size               |

### Examples

```tsx
<PanelWrapper
  title="Throughput"
  headerTrailing={<MetricBadge label="Peak" value={5000} accent="amber" />}
  footer={<span>Total: 1,234,567 events</span>}
>
  <LineChart data={data} />
</PanelWrapper>
```

---

## LogSlider

Logarithmic scale slider for exponential ranges.

### Props

| Prop            | Type                       | Default              | Description                |
| --------------- | -------------------------- | -------------------- | -------------------------- |
| `value`         | `number`                   | required             | Current value              |
| `min`           | `number`                   | required             | Minimum (must be > 0)      |
| `max`           | `number`                   | required             | Maximum                    |
| `onChange`      | `(value: number) => void`  | required             | Change handler             |
| `disabled`      | `boolean`                  | `false`              | Disabled state             |
| `showValue`     | `boolean`                  | `true`               | Show value display         |
| `formatValue`   | `(v: number) => string`    | `toLocaleString()`   | Custom value formatter     |

### Presets

```tsx
import { LogSliderPresets } from '@/components/primitives'

// Throughput (1 - 10k)
<LogSlider {...LogSliderPresets.throughput} value={v} onChange={setV} />

// Frequency (20Hz - 20kHz)
<LogSlider {...LogSliderPresets.frequency} value={v} onChange={setV} />

// Duration (1ms - 10s)
<LogSlider {...LogSliderPresets.duration} value={v} onChange={setV} />
```

---

## FSM Components

Components for finite state machine visualization.

### StateNode

```tsx
<StateNode
  label="Closed"
  type="success"  // 'success' | 'error' | 'warning' | 'info' | 'neutral'
  isActive={currentState === 'closed'}
  size="md"       // 'sm' | 'md' | 'lg'
/>
```

### TransitionArrow

```tsx
<TransitionArrow
  direction="right"  // 'right' | 'left' | 'up' | 'down' | 'diag-*'
  label="on success"
/>
```

### TransitionRule

```tsx
<TransitionRule
  from="closed"
  to="open"
  fromType="success"
  toType="error"
  condition="5 failures"
  isActive={currentState === 'closed'}
/>
```

### Complete FSM Example

```tsx
<div className="flex items-center gap-2">
  <StateNode type="success" label="Closed" isActive={state === 'closed'} />
  <TransitionArrow direction="right" />
  <StateNode type="error" label="Open" isActive={state === 'open'} />
  <TransitionArrow direction="right" />
  <StateNode type="warning" label="Half-Open" isActive={state === 'half-open'} />
</div>

<div className="grid grid-cols-3 gap-2">
  <TransitionRule from="closed" to="open" fromType="success" toType="error" condition="failures" />
  <TransitionRule from="open" to="half-open" fromType="error" toType="warning" condition="timeout" />
  <TransitionRule from="half-open" to="closed" fromType="warning" toType="success" condition="success" />
</div>
```

---

## Design Principles

1. **Base → Specialized Variant**: Primitives are generalized. Domain-specific needs are achieved through composition and configuration.

2. **Typography Floor**: All text uses CSS custom properties with 12px minimum (`--tmnl-text-xs`).

3. **Tailwind + CSS Variables**: Styling uses Tailwind classes with CSS variable fallbacks for design system integration.

4. **Zero Domain Dependencies**: Primitives have no knowledge of streams, atoms, or domain logic.

---

## File Structure

```
src/components/primitives/
├── index.ts              # Main exports
├── README.md             # This file
├── CHANGELOG.md          # Version history
├── metrics/
│   ├── index.ts
│   └── MetricBadge.tsx
├── panel/
│   ├── index.ts
│   └── PanelWrapper.tsx
├── slider/
│   ├── index.ts
│   └── LogSlider.tsx
└── fsm/
    ├── index.ts
    ├── StateNode.tsx
    ├── TransitionArrow.tsx
    └── TransitionRule.tsx
```

---

## Migration Guide

### From local MetricBadge/MetricCell

```diff
- function MetricBadge({ label, value, unit, accent }) { ... }
+ import { MetricBadge } from '@/components/primitives'

- <MetricBadge label="Value" value={v.toFixed(1)} />
+ <MetricBadge label="Value" value={v} format="fixed" decimals={1} />

// For vertical layout (was MetricCell):
+ <MetricBadge variant="cell" label="Value" value={v} />
```

### From local LogSlider

```diff
- function LogSlider({ value, min, max, onChange }) { ... }
+ import { LogSlider } from '@/components/primitives'

// Usage unchanged
<LogSlider value={v} min={1} max={10000} onChange={setV} />
```

### From local StateNode/TransitionArrow

```diff
- const STATE_COLORS = { closed: {...}, open: {...} }
- function StateNode({ state, isActive }) { ... }
+ import { StateNode, getStateColors } from '@/components/primitives'

- <StateNode state="closed" isActive={...} />
+ <StateNode type="success" label="Closed" isActive={...} />
```
