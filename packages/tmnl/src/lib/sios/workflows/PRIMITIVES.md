# SIOS Primitives — Layer 0

True atoms. Zero business logic. Zero entity awareness. Each one does exactly one thing. If it composes other primitives, it's not a primitive — it's a compound.

---

## Design Tokens

Everything derives from tokens. No magic numbers. No inline hex.

### Color

Dark-first design system. JCK's site is light-only — we exceed by owning the dark mode that field crews need on warehouse floors and night shifts, while keeping their brand blue as an accent.

```typescript
const color = {
  // ─── Surfaces (dark-first) ──────────────────────────────────
  bg:          '#0a0e14',        // app background
  surface:     '#121820',        // card/panel background
  surfaceAlt:  '#181f2a',        // inset/nested surfaces
  surfaceHover:'#1e2736',        // interactive surface hover

  // ─── Borders ────────────────────────────────────────────────
  border:      'rgba(255,255,255,0.06)',
  borderBright:'rgba(255,255,255,0.12)',

  // ─── Text ───────────────────────────────────────────────────
  text:        '#d4dce8',        // primary text
  textDim:     '#7a8599',        // secondary text, captions
  textMuted:   '#3e4a5c',        // disabled, placeholder

  // ─── JCK Brand ─────────────────────────────────────────────
  // Sourced directly from jckltd.com CSS extraction
  jckBlue:     '#0d6efd',        // JCK primary brand blue (buttons, links, accents)
  jckNavy:     '#032359',        // JCK dark navy (hover states, deep backgrounds)
  jckIce:      '#ecfeff',        // JCK page background (light mode reference)

  // ─── Semantic ───────────────────────────────────────────────
  green:       '#4ade80',        // success, passed, complete, under budget
  cyan:        '#22d3ee',        // active, in progress, informational
  amber:       '#fbbf24',        // warning, on hold, expiring, suspended
  red:         '#f87171',        // error, failed, blocked, critical, overdue
  gold:        '#c5a44a',        // highlight, accent, editorial emphasis

  // ─── Semantic Dim (8-10% opacity backgrounds) ──────────────
  greenDim:    'rgba(74,222,128,0.08)',
  cyanDim:     'rgba(34,211,238,0.06)',
  amberDim:    'rgba(251,191,36,0.08)',
  redDim:      'rgba(248,113,113,0.06)',
  jckBlueDim:  'rgba(13,110,253,0.08)',  // JCK blue at low opacity for accent backgrounds
} as const

type SemanticColor = 'green' | 'cyan' | 'amber' | 'red' | 'gold' | 'jckBlue' | 'muted'
```

### JCK Brand Adoption Strategy

| JCK Element | Their Usage | Our Usage |
|---|---|---|
| `#0d6efd` Blue | Primary everything | Accent on key CTAs, active entity borders, links. Not THE primary — we're a product, not their site. |
| `#032359` Navy | Hover darkening | Deep surface variant for focused panels |
| `#ecfeff` Ice | Page background | Light mode reference (future). Currently dark-first. |
| Arrow CTAs `→` | Every CTA link | Adopt. "Complete Task →", "View Gates →", "Drill Down →" |
| Border-bottom accent | `border-b-8` on cards | Semantic thick borders: green=passed, red=failed, blue=active, amber=hold |
| Krona One headings | Hero/page titles | Display headings only. Matches their visual language — shows we know them. |

### Status → Color Mapping

One canonical mapping used everywhere. Entity-agnostic — maps semantic *meaning* to color.

```typescript
const statusIntent = {
  // Initial / waiting
  initial:   'muted',     // pending, defined, bidding, open
  // Active / progressing
  active:    'cyan',      // active, in_progress, commissioning
  // Warning / paused
  warning:   'amber',     // on_hold, expiring, suspended, needs_evidence
  // Error / blocked
  danger:    'red',       // failed, blocked, badge_expired, critical, overdue
  // Success / complete
  success:   'green',     // passed, done, complete, handed_over, active (worker)
  // Terminal / closed
  terminal:  'muted',     // cancelled, closed, wont_fix, offboarded
} as const

type StatusIntent = keyof typeof statusIntent
```

Each workflow provides a `resolveIntent(entityStatus) → StatusIntent` function. The primitives only know about intents, never about entity status strings.

### Spacing

```typescript
const space = {
  0:   '0px',
  1:   '4px',
  2:   '8px',
  3:   '12px',
  4:   '16px',
  5:   '20px',
  6:   '24px',
  8:   '32px',
  10:  '40px',
  12:  '48px',
} as const

type Space = keyof typeof space  // 0 | 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12
```

### Typography

Three-font system. JCK uses Krona One (headings) + Noto Sans (body). We match their heading font for brand affinity, then exceed with a purpose-built data font (JetBrains Mono) and a refined body font (Inter > Noto Sans).

```typescript
const font = {
  // Display: JCK's heading font. Geometric, wide, bold presence.
  // Used for page/section headings and hero text ONLY.
  // Shows the stakeholder: "we speak your visual language."
  display: "'Krona One', system-ui, sans-serif",

  // Body: Cleaner than JCK's Noto Sans. Better at small sizes.
  sans:    "'Inter', 'Noto Sans', system-ui, sans-serif",

  // Data: For numbers, metrics, code, timestamps, IDs.
  // JCK has no data font — this is where we exceed.
  mono:    "'JetBrains Mono', 'Fira Code', monospace",
} as const

const fontSize = {
  '2xs':  '10px',     // fine print, decorative labels
  xs:     '11px',     // badges, tags, meta timestamps
  sm:     '12px',     // labels, captions — THE FLOOR (AGENTS.md mandate)
  md:     '13px',     // body text, descriptions
  base:   '14px',     // default body, input fields
  lg:     '16px',     // emphasized body, subheadings
  xl:     '18px',     // section headings
  '2xl':  '20px',     // card headings
  '3xl':  '24px',     // page section titles
  '4xl':  '30px',     // major headings (matches JCK text-3xl)
  '5xl':  '36px',     // hero display (matches JCK text-4xl)
} as const

const fontWeight = {
  normal:   '400',    // body text
  medium:   '500',    // emphasized body, nav items
  semibold: '600',    // subheadings, button text, labels
  bold:     '700',    // headings, hero text
} as const

const lineHeight = {
  tight:   '1.1',    // display headings (Krona One)
  snug:    '1.3',    // card headings
  normal:  '1.5',    // body text
  relaxed: '1.7',    // long-form descriptions
} as const

const letterSpacing = {
  tight:   '-0.02em',  // display headings
  normal:  '0',        // body text
  wide:    '0.04em',   // labels, badges
  wider:   '0.08em',   // uppercase labels (JCK pattern)
} as const
```

### Three-Voice Typography System

| Voice | Font | Role | Size Range | Weight | Examples |
|---|---|---|---|---|---|
| **Display** | Krona One | Authority, branding, page structure | xl–5xl | bold | "DFW Terminal B", "EVM War Room", section titles |
| **Body** | Inter | Readability, descriptions, instructions | sm–lg | normal–medium | Task descriptions, card captions, modal text |
| **Data** | JetBrains Mono | Precision, metrics, machine state | 2xs–2xl | medium–bold | "CPI: 1.11", "$250,000", "10:42:07", status badges |

JCK only has two voices (Krona One + Noto Sans). We add the data voice — that's the differentiation. An EVM dashboard needs a font that makes numbers look authoritative.

### Radius

```typescript
const radius = {
  sm:   '4px',
  md:   '6px',
  lg:   '8px',
  xl:   '10px',
  full: '9999px',
} as const
```

### Animation

```typescript
const duration = {
  fast:    '100ms',
  normal:  '200ms',
  slow:    '400ms',
  counter: '600ms',  // number roll-up
  gauge:   '800ms',  // needle sweep
} as const

const easing = {
  default:  'cubic-bezier(0.4, 0, 0.2, 1)',
  spring:   'cubic-bezier(0.34, 1.56, 0.64, 1)',
  out:      'cubic-bezier(0, 0, 0.2, 1)',
} as const
```

---

## Primitive Definitions

### 1. `<Text>`

**One text component.** Everything else (label, caption, heading, value) is a variant, not a separate component.

```typescript
interface TextProps {
  children: ReactNode
  variant: 'heading' | 'label' | 'value' | 'body' | 'caption'
  size?: keyof typeof fontSize                // overrides variant default
  weight?: keyof typeof fontWeight            // overrides variant default
  color?: SemanticColor | 'text' | 'dim' | 'muted'
  mono?: boolean                              // forces mono font
  uppercase?: boolean                         // forces uppercase + letter-spacing
  truncate?: boolean                          // ellipsis overflow
  as?: 'span' | 'p' | 'h1' | 'h2' | 'h3' | 'div'
}
```

**Variant defaults:**

| Variant | Font | Size | Weight | Color | Casing | Letter-spacing | Line-height |
|---|---|---|---|---|---|---|---|
| `display` | display (Krona One) | 3xl | bold | text | normal | tight (-0.02em) | tight (1.1) |
| `heading` | sans (Inter) | xl | semibold | text | normal | normal | snug (1.3) |
| `label` | mono (JetBrains) | xs | semibold | muted | uppercase | wider (0.08em) | normal |
| `value` | mono (JetBrains) | 2xl | bold | text | normal | normal | tight (1.1) |
| `body` | sans (Inter) | base | normal | dim | normal | normal | normal (1.5) |
| `caption` | sans (Inter) | sm | normal | dim | normal | normal | normal |

Six variants, three font voices. Every text on screen is `<Text variant="...">`.

```tsx
// Display — Krona One. Hero headings, page titles. JCK brand affinity.
<Text variant="display" as="h1">EVM War Room</Text>
<Text variant="display" size="5xl">DFW Terminal B</Text>

// Heading — Inter. Section titles, card headings.
<Text variant="heading" as="h2">Belt Conveyor Installation</Text>

// Label — JetBrains Mono, uppercase. Token labels, section markers.
<Text variant="label">STATUS</Text>
<Text variant="label" color="cyan">ACTIVE</Text>

// Value — JetBrains Mono, large. Metrics, KPIs, counts.
<Text variant="value" color="green" size="3xl">1.11</Text>
<Text variant="value" color="cyan">$250,000</Text>

// Body — Inter. Descriptions, instructions.
<Text variant="body">Conveyor guard rail detached near Panel CB-04</Text>

// Caption — Inter, small. Meta info, timestamps, secondary detail.
<Text variant="caption">Category: io_checkout · Inspector: R. Nguyen</Text>
```

---

### 2. `<Flex>`

**One flex component.** Stack (vertical) and Row (horizontal) are just `direction` props.

```typescript
interface FlexProps {
  children: ReactNode
  direction?: 'row' | 'column'               // default: 'column'
  gap?: Space                                 // token key
  align?: 'start' | 'center' | 'end' | 'stretch' | 'baseline'
  justify?: 'start' | 'center' | 'end' | 'between' | 'around'
  wrap?: boolean
  inline?: boolean
  as?: keyof JSX.IntrinsicElements
}
```

```tsx
// Vertical stack
<Flex gap={4}>...</Flex>

// Horizontal row
<Flex direction="row" gap={2} align="center">...</Flex>

// Justified header row
<Flex direction="row" justify="between" align="center">...</Flex>
```

No separate Stack, Row. One component.

---

### 3. `<Grid>`

CSS grid with explicit column count.

```typescript
interface GridProps {
  children: ReactNode
  cols: number                                // grid-template-columns: repeat(N, 1fr)
  gap?: Space
  colGap?: Space                              // override gap for columns only
  rowGap?: Space                              // override gap for rows only
}
```

---

### 4. `<Surface>`

The rounded rectangle. A container with background, border, and padding. What I was calling "Panel."

```typescript
interface SurfaceProps {
  children: ReactNode
  variant?: 'default' | 'ghost' | 'inset' | 'elevated'
  padding?: Space | [Space, Space]            // [vertical, horizontal]
  accent?: SemanticColor                      // thick colored border accent (JCK pattern: border-b-8)
  accentSide?: 'top' | 'bottom' | 'left'     // default: 'bottom' (JCK uses bottom)
  accentWeight?: 'thin' | 'thick'            // thin: 2px, thick: 4px (JCK uses 8px but that's excessive for dark mode)
  interactive?: boolean                       // hover state (border brightens, surface lifts)
  as?: keyof JSX.IntrinsicElements
}
```

**Variant styles:**

| Variant | Background | Border | Use |
|---|---|---|---|
| `default` | surface | border | Standard card |
| `ghost` | transparent | none | Inline grouping |
| `inset` | surfaceAlt | border | Nested inside another Surface |
| `elevated` | surface | borderBright + subtle shadow | Highlighted / selected card |

**Accent border** — adapted from JCK's `border-b-8 border-color` pattern. Their site uses it decoratively; we use it semantically. Color maps to entity state:

```tsx
// Standard card
<Surface padding={4}>
  <Text variant="heading">Zone A</Text>
</Surface>

// Card with green bottom accent — "PASSED" (JCK thick-border motif)
<Surface padding={4} accent="green" accentSide="bottom">
  <Text variant="label">PASSED</Text>
</Surface>

// Red left accent — "FAILED" 
<Surface padding={4} accent="red" accentSide="left">
  <Text variant="caption">Failure reason: ...</Text>
</Surface>

// JCK Blue accent — "ACTIVE" (their brand color as entity state)
<Surface padding={4} accent="jckBlue" accentSide="bottom">
  <Text variant="heading">Belt Conveyor Installation</Text>
</Surface>

// Inset detail area
<Surface variant="inset" padding={3}>
  <Text variant="caption">Evidence: torque verification photo</Text>
</Surface>

// Interactive card with hover lift
<Surface padding={4} interactive accent="cyan">
  <Text variant="heading">Zone B — Sortation Level 1</Text>
</Surface>
```

---

### 5. `<Divider>`

Horizontal or vertical rule line. Supports JCK's "heading line" motif (80px wide, 2px tall, brand-colored).

```typescript
interface DividerProps {
  vertical?: boolean
  color?: 'border' | 'borderBright' | SemanticColor  // default: 'border'
  spacing?: Space                             // margin before/after
  accent?: boolean                            // JCK heading-line motif: short, thick, colored
  // accent mode: 80px wide, 2px tall, centered. Uses `color` for the accent color.
}
```

```tsx
// Standard rule
<Divider />

// JCK heading-line motif under a section title
<Text variant="display" as="h2">Services</Text>
<Divider accent color="jckBlue" />

// Vertical divider in a row
<Divider vertical />
```

---

### 6. `<Dot>`

Small colored circle. Status indicator.

```typescript
interface DotProps {
  color: SemanticColor
  size?: 'sm' | 'md' | 'lg'                  // 6px | 8px | 10px
  pulse?: boolean                             // CSS animation for active states
}
```

---

### 7. `<Badge>`

Inline pill label. Colored background + text.

```typescript
interface BadgeProps {
  children: ReactNode
  color: SemanticColor
  variant?: 'solid' | 'outline' | 'ghost'     // default: 'ghost'
  size?: 'sm' | 'md'                          // sm: 10px text, md: 11px text
}
```

**Variant styles:**

| Variant | Background | Border | Text |
|---|---|---|---|
| `solid` | color at 100% | none | white |
| `outline` | transparent | color at 40% | color |
| `ghost` | color at 8% | none | color |

```tsx
<Badge color="red" variant="ghost">CRITICAL</Badge>
<Badge color="green">PASSED</Badge>
<Badge color="amber" variant="outline">⚠ EXPIRING</Badge>
```

---

### 8. `<Indicator>`

Horizontal progress bar. Single fill. Pure visual — no labels, no numbers.

```typescript
interface IndicatorProps {
  value: number                               // 0-1 fraction
  color?: SemanticColor                       // default: 'cyan'
  height?: number                             // px, default 4
  rounded?: boolean                           // default true
  animate?: boolean                           // transition on value change
}
```

```tsx
<Indicator value={0.72} color="green" />
<Indicator value={0.41} color="amber" />
```

---

### 9. `<Ring>`

SVG radial progress gauge. Circle with arc fill and center content slot.

```typescript
interface RingProps {
  value: number                               // 0-1 fraction
  size?: number                               // diameter in px, default 80
  strokeWidth?: number                        // default 6
  color?: SemanticColor                       // default: 'cyan'
  trackColor?: string                         // unfilled portion, default: border
  children?: ReactNode                        // center content (e.g., "72%")
  animate?: boolean
}
```

```tsx
<Ring value={0.72} color="green" size={100}>
  <Text variant="value" size="xl">72%</Text>
</Ring>
```

---

### 10. `<Gauge>`

SVG arc gauge with a sweeping needle and threshold zones. For CPI/SPI.

```typescript
interface GaugeProps {
  value: number
  min?: number                                // default 0
  max?: number                                // default 2
  thresholds: Array<{
    at: number                                // threshold value
    color: SemanticColor                      // zone color above this threshold
  }>
  size?: number                               // default 120
  label?: string                              // below the needle, e.g. "CPI"
  animate?: boolean
}
```

```tsx
<Gauge
  value={1.11}
  min={0} max={2}
  thresholds={[
    { at: 0, color: 'red' },
    { at: 0.85, color: 'amber' },
    { at: 1.0, color: 'green' },
  ]}
  label="CPI"
/>
```

---

### 11. `<Counter>`

Animated number display. Rolls up/down when value changes.

```typescript
interface CounterProps {
  value: number
  prefix?: string                             // "$"
  suffix?: string                             // "%", "h"
  format?: 'integer' | 'decimal' | 'currency' // default 'integer'
  decimals?: number                           // for 'decimal' format
  duration?: number                           // animation ms, default 600
  color?: SemanticColor | 'text'
  size?: keyof typeof fontSize
  mono?: boolean                              // default true
}
```

```tsx
<Counter value={250000} prefix="$" format="currency" color="cyan" />
<Counter value={1.11} format="decimal" decimals={2} color="green" />
<Counter value={72} suffix="%" />
```

---

### 12. `<Countdown>`

Live clock that counts down to a deadline. Changes color as it approaches.

```typescript
interface CountdownProps {
  deadline: Date
  thresholds?: Array<{
    remainingMs: number                       // e.g. 3600000 = 1 hour
    color: SemanticColor
  }>
  onExpire?: () => void
  format?: 'hms' | 'dhms'                    // HH:MM:SS or Dd HH:MM:SS
  size?: keyof typeof fontSize
  expired?: { label: string; color: SemanticColor }  // "OVERDUE" in red
}
```

Default thresholds: `> 2h = green`, `1-2h = amber`, `< 1h = red`, `expired = red + "OVERDUE"`.

---

### 13. `<Timestamp>`

Formatted date/time display.

```typescript
interface TimestampProps {
  date: Date
  variant?: 'time' | 'date' | 'relative' | 'datetime'  // default 'time'
  mono?: boolean                              // default true
}
```

`time` → "10:42:07", `relative` → "3 min ago", `date` → "Mar 31", `datetime` → "Mar 31, 10:42"

---

### 14. `<Overlay>`

Modal backdrop + centered content container. The chrome around modal content.

```typescript
interface OverlayProps {
  children: ReactNode
  open: boolean
  onClose?: () => void                        // backdrop click / escape key
  width?: 'sm' | 'md' | 'lg'                 // 360 | 480 | 640
}
```

Pure container. No heading, no buttons — those come from the compound `FormModal` that wraps this.

---

### 15. `<Skeleton>`

Loading placeholder. Animated shimmer block.

```typescript
interface SkeletonProps {
  width?: string | number
  height?: string | number
  variant?: 'text' | 'rect' | 'circle'       // text = rounded inline, rect = card, circle = avatar/dot
  lines?: number                              // for variant='text', render N lines
}
```

---

### Input Primitives

All inputs share a common contract:

```typescript
interface InputBaseProps<T> {
  label: string
  value: T
  onChange: (value: T) => void
  required?: boolean
  disabled?: boolean
  error?: string                              // validation message
  hint?: string                               // helper text below input
}
```

### 16. `<TextInput>` extends InputBaseProps<string>

```typescript
interface TextInputProps extends InputBaseProps<string> {
  placeholder?: string
  maxLength?: number
  type?: 'text' | 'email' | 'password'
}
```

### 17. `<NumberInput>` extends InputBaseProps<number>

```typescript
interface NumberInputProps extends InputBaseProps<number> {
  min?: number
  max?: number
  step?: number
  unit?: string                               // suffix inside field: "h", "LM", "$"
}
```

### 18. `<TextArea>` extends InputBaseProps<string>

```typescript
interface TextAreaProps extends InputBaseProps<string> {
  rows?: number                               // default 3
  placeholder?: string
  maxLength?: number
}
```

### 19. `<Select>` extends InputBaseProps<string>

```typescript
interface SelectProps extends InputBaseProps<string> {
  options: Array<{ value: string; label: string }>
  placeholder?: string
}
```

### 20. `<RadioGroup>` extends InputBaseProps<string>

```typescript
interface RadioGroupProps extends InputBaseProps<string> {
  options: Array<{ value: string; label: string; description?: string }>
  direction?: 'row' | 'column'                // default 'column'
}
```

### 21. `<FileInput>`

```typescript
interface FileInputProps {
  label: string
  accept?: string                             // "image/*", ".pdf"
  onSelect: (file: File) => void
  preview?: string                            // URL of currently selected file
  placeholder?: string                        // "Drop image or click to upload"
}
```

---

### 22. `<Button>`

```typescript
interface ButtonProps {
  children: ReactNode
  onClick?: () => void
  variant?: 'solid' | 'outline' | 'ghost'    // default 'solid'
  color?: SemanticColor                       // default 'cyan'
  size?: 'sm' | 'md' | 'lg'                  // default 'md'
  disabled?: boolean
  loading?: boolean                           // shows spinner, disables
  icon?: ReactNode                            // leading icon
  iconOnly?: boolean                          // true = square button, icon only, with aria-label
  arrow?: boolean                             // appends → suffix (JCK CTA pattern)
  fullWidth?: boolean
  type?: 'button' | 'submit'
}
```

**JCK-inspired patterns:**

- `arrow` prop appends ` →` to button text. Every CTA uses this: "Complete Task →", "View Gates →", "Drill Down →". Matches jckltd.com's universal "READ MORE →" pattern.
- Hover transition: `ease 0.3s` (JCK default). Solid buttons darken on hover (their `#0d6efd → #032359` pattern adapted to our semantic colors).
- Font: `semibold`, size from `size` prop. Uppercase option via Text composition, not a Button concern.

```tsx
// Primary action — JCK Blue with arrow
<Button color="jckBlue" arrow>Award Project</Button>  // renders: "Award Project →"

// Semantic actions
<Button color="green" arrow>Complete Task</Button>     // "Complete Task →"
<Button color="red" variant="outline">✗ Block</Button>

// Disabled with tooltip (compound handles the tooltip wrapping)
<Button disabled>✗ Activate</Button>

// Icon-only
<Button iconOnly icon={<ChevronDown />} variant="ghost" />
```

No separate `IconButton`. It's `<Button iconOnly icon={<X />} />`.

No separate `ButtonGroup`. It's `<Flex direction="row" gap={0}>` with CSS `:first-child / :last-child` border-radius — a styling concern, not a component.

---

### 23. `<ToggleGroup>`

Segmented control for filter selection.

```typescript
interface ToggleGroupProps {
  options: Array<{
    key: string
    label: string
    color?: SemanticColor                     // default 'cyan'
    count?: number                            // optional badge count
  }>
  active: string | string[]                   // single or multi select
  onChange: (key: string) => void
  size?: 'sm' | 'md'
}
```

```tsx
<ToggleGroup
  options={[
    { key: 'all', label: 'Show All' },
    { key: 'deployable', label: 'Deployable', color: 'cyan' },
    { key: 'expiring', label: 'Expiring (30d)', color: 'amber', count: 1 },
  ]}
  active="all"
  onChange={setFilter}
/>
```

---

## What's NOT a Primitive

These were incorrectly classified as primitives in the previous draft. They compose multiple primitives → they're compounds.

| Component | Why It's a Compound | Composed Of |
|---|---|---|
| `EmptyState` | Icon + text + optional action | `Flex` + `Text` + optional `Button` |
| `DiffValue` | Two values with comparison logic | `Flex` + `Text` × 2 + conditional color logic |
| `Toast` | Portal + animation + auto-dismiss | `Surface` + `Flex` + `Text` + `Button` + portal behavior |
| `Tooltip` | Hover detection + positioned popup | Behavior wrapper + positioned `Surface` + `Text` |
| `CostVarianceBar` | Centered divergence bar + labels | `Indicator` (custom) + `Flex` + `Text` × 3 |
| `Section` | Surface + heading | `Surface` + `Text variant="label"` |
| `MetricCard` | Value + label in a card | `Surface` + `Text variant="value"` + `Text variant="label"` |

---

## Final Primitive Count

| Category | Count | Components |
|---|---|---|
| **Typography** | 1 | Text (6 variants: display, heading, label, value, body, caption) |
| **Layout** | 4 | Flex, Grid, Surface, Divider |
| **Feedback** | 3 | Dot, Badge, Skeleton |
| **Data Display** | 6 | Indicator, Ring, Gauge, Counter, Countdown, Timestamp |
| **Inputs** | 6 | TextInput, NumberInput, TextArea, Select, RadioGroup, FileInput |
| **Interactive** | 2 | Button, ToggleGroup |
| **Chrome** | 1 | Overlay |
| **Total** | **23** | |

Down from 33. Ten eliminated — merged or promoted to compound.

---

## Composition Proof

Every compound traces cleanly to primitives. No compound uses another primitive's internals — only the public primitive API.

```
StatePipeline   = Flex(direction=row) + N × [Dot + Divider + Text(variant=label)]
TransitionButton = Button(disabled?) + Tooltip(compound)
MetricCard      = Surface + Text(variant=value) + Text(variant=label)
MetricRow       = Grid(cols=N) + N × MetricCard
EntityRow       = Surface(interactive) + Flex(direction=row) + Dot + Text + Badge
FormModal       = Overlay + Surface + Flex + Text(heading) + inputs + Button × 2
EvidenceField   = Flex + FileInput + TextInput × 2
```

Every pixel traces back to one of the 23 primitives. No exceptions.
