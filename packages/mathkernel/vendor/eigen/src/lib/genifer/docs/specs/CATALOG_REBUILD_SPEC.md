# Genifer Catalog Rebuild Spec

> **Status**: RATIFIED (Rounds 1–3)  
> **Date**: 2026-02-28  
> **Supersedes**: `core-domain-catalog.tsx` (84 renderers), local `H` token object  

---

## 1. Ratified Decisions Summary

| Decision | Choice | Round |
|---|---|---|
| Token authority | `VANTA_*` from `@/components/portal/tokens` — direct import, kill local H | R1 |
| Renderer architecture | Style objects via VANTA presets, zero Tailwind in renderers | R1 |
| className filtering | Per-component policy, catalog-driven | R1 |
| Layout primitives | Grid + Box (kill VStack/HStack) | R2 |
| Spacing props | Named scale: xs/sm/md/lg/xl → 4/8/12/16/24px | R2 |
| Card surface | Bordered — hairline border, inset glow, gradient surface | R2 |
| Alert style | Left border accent stripe | R2 |
| Typography | Pill badges + Geo text — grotesk headings, mono labels, geo body | R2 |
| Button style | Outlined + fill-on-hover animation, all variants | R3 |
| Input style | Box input — bordered, near-black fill, cyan focus ring | R3 |
| Composed benchmark | System Status Dashboard — the hydrogen atom quality bar | R3 |

---

## 2. Token Authority

### Canonical Source

```typescript
import {
  VANTA_COLORS,
  VANTA_TYPOGRAPHY,
  VANTA_SPACING,
  VANTA_BORDERS,
  VANTA_CARD_VARIANTS,
  VANTA_ANIMATION,
} from '@/components/portal/tokens'
```

**File**: `src/components/portal/tokens.ts`

### What Gets Killed

- `H = { ... }` local token object in `core-domain-catalog.tsx`
- Any hardcoded hex values in renderers (e.g. `'#0a0a0a'`, `'rgba(34,211,238,...)'`)
- Per-renderer inline color definitions

### What Gets Created

Nothing new. Components import VANTA tokens directly. No adapter layer.

### Token Reference (from portal/tokens.ts)

**Surfaces** (darkest → lightest):
| Token | Value | Use |
|---|---|---|
| `surface.void` | `#000000` | Page background |
| `surface.base` | `#030303` | Card gradient end |
| `surface.elevated` | `#0a0a0a` | Card body |
| `surface.raised` | `#111111` | Hover zones |
| `surface.border` | `#1a1a1a` | Default borders |
| `surface.hover` | `#1f1f1f` | Interactive hover |

**Text Hierarchy**:
| Token | Value | Use |
|---|---|---|
| `text.primary` | `#e5e5e5` | Primary content |
| `text.secondary` | `#a3a3a3` | Secondary content |
| `text.tertiary` | `#737373` | Labels, captions |
| `text.muted` | `#525252` | Disabled, ghost text |

**Accent Families** (each has base/Muted/Glow):
| Family | Base | Use |
|---|---|---|
| `accent.cyan` | `#22d3ee` | Primary accent, focus, data |
| `accent.emerald` | `#34d399` | Success, healthy |
| `accent.amber` | `#fbbf24` | Warning, pending |
| `accent.rose` | `#fb7185` | Error, danger |
| `accent.violet` | `#a78bfa` | Canvas, 3D blocks |

**Typography Presets** (from `VANTA_TYPOGRAPHY.preset`):
| Preset | Family | Size | Weight | Tracking | Transform |
|---|---|---|---|---|---|
| `cardTitle` | `--font-heading` (Space Grotesk) | xs (12px) | 500 | 0.1em | uppercase |
| `cardSubtitle` | `--font-body` (Geo) | xs (12px) | 400 | 0.02em | — |
| `cardBody` | `--font-body` (Geo) | sm (14px) | 400 | 0.02em | — |
| `label` | `--font-label` (Share Tech Mono) | xs (12px) | 500 | 0.15em | uppercase |
| `value` | `--font-stats` (Geo) | sm (14px) | 600 | 0.025em | — |
| `micro` | `--font-label` (Share Tech Mono) | xs (12px) | 400 | 0.05em | — |

---

## 3. Renderer Architecture

### Pattern

Every component renderer is a pure function: `(element, children) → JSX`.

Renderers consume VANTA tokens via `style={}` objects. **Zero Tailwind classes in renderer implementations** — Tailwind is only allowed through the filtered `className` prop.

```typescript
type ComponentRenderer = React.FC<{
  element: UIElement
  children?: React.ReactNode
}>
```

### Style Application Order

1. **Base style** — VANTA preset/variant (via `style={}`)
2. **Variant overrides** — intent/size props modify base style
3. **Filtered className** — layout positioning only (via per-component policy)

```tsx
const CardRenderer: ComponentRenderer = ({ element, children }) => {
  const variant = (element.props.variant as string) ?? 'default'
  const base = VANTA_CARD_VARIANTS[variant] ?? VANTA_CARD_VARIANTS.default
  const filtered = filterClassName(element.className, CARD_POLICY)

  return (
    <div style={base} className={filtered}>
      {children}
    </div>
  )
}
```

---

## 4. className Filtering — Per-Component Policy

### Policy Groups

```typescript
export const POLICY_GROUPS = {
  layout: [
    'p-','px-','py-','pt-','pb-','pl-','pr-',
    'm-','mx-','my-','mt-','mb-','ml-','mr-',
    'gap-','space-x-','space-y-',
    'flex','grid','items-','justify-','self-','place-',
    'order-','grow','shrink','basis-',
    'relative','absolute','hidden','block','inline',
    'col-span-','row-span-',
  ],
  sizing: [
    'w-','h-','min-w-','min-h-','max-w-','max-h-',
  ],
  opacity: [
    'opacity-',
  ],
  'border-width': [
    'border','border-t','border-b','border-l','border-r',
  ],
  overflow: [
    'overflow-','truncate',
  ],
  cursor: [
    'cursor-pointer','cursor-not-allowed',
    'pointer-events-none','pointer-events-auto',
  ],
  selection: [
    'select-none','select-text',
  ],
} as const

export type PolicyGroup = keyof typeof POLICY_GROUPS
```

### Policy Interface

```typescript
export interface ClassNamePolicy {
  readonly allow: readonly PolicyGroup[]
}
```

### Filter Function

```typescript
export function filterClassName(
  raw: string | undefined,
  policy: ClassNamePolicy
): string {
  if (!raw) return ''
  const allowed = policy.allow.flatMap(g => POLICY_GROUPS[g] ?? [])
  return raw
    .split(/\s+/)
    .filter(cls => {
      if (cls.includes('[')) return false  // block ALL arbitrary values
      return allowed.some(p => cls.startsWith(p))
    })
    .join(' ')
}
```

### Default Policies by Category

| Category | Allowed Groups |
|---|---|
| **Layout** (Grid, Box) | layout, sizing, overflow |
| **Content** (Text, Heading, Code) | layout |
| **Surface** (Card, Alert) | layout, sizing, opacity, border-width |
| **Interactive** (Button, Input) | layout, sizing, cursor |
| **Data** (List, ListItem, Badge) | layout |
| **Container** (Accordion, Tabs) | layout, sizing, overflow |

---

## 5. Component Taxonomy — 44 Components, 3 Tiers

### Tier 1 — Core (always in prompt, 16 components)

| Category | Components |
|---|---|
| **Layout** | `Grid`, `Box`, `Separator` |
| **Content** | `Text`, `Heading`, `Code`, `Image` |
| **Surface** | `Card`, `Alert`, `Badge` |
| **Interactive** | `Button`, `Input`, `Link` |
| **Data** | `List`, `ListItem`, `Progress` |

### Tier 2 — Standard (injected for forms/data, 14 components)

| Category | Components |
|---|---|
| **Form** | `Select`, `Checkbox`, `RadioGroup`, `Textarea`, `Slider`, `Toggle` |
| **Container** | `Accordion`, `Tabs`, `Collapsible` |
| **Data** | `Table`, `KeyValue`, `Skeleton`, `Spinner` |
| **Rich** | `Blockquote` |

### Tier 3 — Domain (injected per-context, 14 components)

| Category | Components |
|---|---|
| **Dashboard** | `MetricCard`, `InfoCard`, `StatusDot` |
| **Rich** | `Avatar`, `ScrollArea`, `Timeline` |
| **Composed** | `ButtonGroup`, `ToggleGroup`, `RadioItem` |
| **Specialized** | `DataTable`, `FileInput` |
| **Layout+** | `Divider`, `Spacer`, `AspectRatio` |

---

## 6. Layout Primitives

### Grid

The primary layout component. Replaces VStack, HStack, and the old Grid.

```typescript
interface GridProps {
  /** Column definition: number → repeat(n,1fr), string → raw template */
  columns?: number | string
  /** Row definition: number → repeat(n,1fr), string → raw template */
  rows?: number | string
  /** Gap between children */
  gap?: SpacingToken
  /** Auto-flow direction */
  flow?: 'row' | 'column' | 'dense'
  /** Named grid areas */
  areas?: string
  /** Cross-axis alignment */
  align?: 'start' | 'center' | 'end' | 'stretch'
  /** Main-axis distribution */
  justify?: 'start' | 'center' | 'end' | 'between'
  /** Filtered className */
  className?: string
}
```

**Mental model for the LLM**:
- "Stack vertically" → `Grid` with `columns={1}`
- "Stack horizontally" → `Grid` with `columns={n}` or `flow="column"`
- "2×2 dashboard" → `Grid` with `columns={2}`
- "Sidebar + main" → `Grid` with `columns="250px 1fr"`

**Renderer**:

```tsx
const GridRenderer: ComponentRenderer = ({ element, children }) => {
  const { columns, rows, gap, flow, areas, align, justify } = element.props
  const filtered = filterClassName(element.className, GRID_POLICY)

  const style: React.CSSProperties = {
    display: 'grid',
    gap: GAP_SCALE[(gap as SpacingToken) ?? 'md'],
  }

  if (typeof columns === 'number') {
    style.gridTemplateColumns = `repeat(${columns}, 1fr)`
  } else if (typeof columns === 'string') {
    style.gridTemplateColumns = columns
  }

  if (typeof rows === 'number') {
    style.gridTemplateRows = `repeat(${rows}, 1fr)`
  } else if (typeof rows === 'string') {
    style.gridTemplateRows = rows
  }

  if (flow) style.gridAutoFlow = flow
  if (areas) style.gridTemplateAreas = areas
  if (align) style.alignItems = align
  if (justify) {
    style.justifyContent = justify === 'between' ? 'space-between' : justify
  }

  return <div style={style} className={filtered}>{children}</div>
}
```

### Box

Single-child wrapper for padding, overflow, and positioning.

```typescript
interface BoxProps {
  /** Internal padding */
  padding?: SpacingToken
  /** Overflow behavior */
  overflow?: 'hidden' | 'auto' | 'scroll'
  /** Positioning */
  position?: 'relative' | 'absolute'
  /** Filtered className */
  className?: string
}
```

### Spacing Scale

```typescript
export type SpacingToken = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

export const GAP_SCALE: Record<SpacingToken, string> = {
  xs: VANTA_SPACING['1'],   // 4px
  sm: VANTA_SPACING['2'],   // 8px
  md: VANTA_SPACING['3'],   // 12px
  lg: VANTA_SPACING['4'],   // 16px
  xl: VANTA_SPACING['6'],   // 24px
}
```

---

## 7. Component Specs

### 7.1 Card

**Surface**: Bordered — gradient surface, hairline border, inset glow.

```typescript
interface CardProps {
  /** Card variant */
  variant?: 'default' | 'elevated' | 'compact' | 'ghost'
  /** Title text (rendered in cardTitle preset) */
  title?: string
  /** Subtitle/description (rendered in cardSubtitle preset) */
  description?: string
  /** Internal padding override */
  padding?: SpacingToken
}
```

**Style**:
```typescript
const CARD_STYLE: React.CSSProperties = {
  background: VANTA_COLORS.gradient.surface,
  border: VANTA_BORDERS.style.hairline,    // 1px solid rgba(255,255,255,0.12)
  borderRadius: VANTA_BORDERS.radius.md,   // 4px
  boxShadow: `${VANTA_BORDERS.shadow.inner}, ${VANTA_BORDERS.shadow.card}`,
  padding: VANTA_SPACING.card.padding,     // 16px
}
```

### 7.2 Alert

**Surface**: Left border accent stripe. Intent drives color.

```typescript
interface AlertProps {
  /** Accent intent */
  intent?: 'info' | 'success' | 'warning' | 'danger'
  /** Alert title (rendered in label preset) */
  title?: string
}
```

**Intent → Color Mapping**:
```typescript
const INTENT_ACCENT = {
  info:    VANTA_COLORS.accent.cyan,
  success: VANTA_COLORS.accent.emerald,
  warning: VANTA_COLORS.accent.amber,
  danger:  VANTA_COLORS.accent.rose,
} as const
```

**Style** (info variant):
```typescript
{
  background: `rgba(34, 211, 238, 0.04)`,
  borderLeft: `2px solid rgba(34, 211, 238, 0.6)`,
  padding: '10px 14px',
  borderRadius: '0 2px 2px 0',
}
```

### 7.3 Badge

**Surface**: Pill with accent border + muted background.

```typescript
interface BadgeProps {
  /** Accent intent */
  intent?: 'info' | 'success' | 'warning' | 'danger' | 'neutral'
  /** Size */
  size?: 'sm' | 'md'
}
```

**Style** (info variant):
```typescript
{
  display: 'inline-flex',
  alignItems: 'center',
  padding: '2px 8px',
  ...VANTA_TYPOGRAPHY.preset.micro,
  background: VANTA_COLORS.accent.cyanGlow,        // rgba(34,211,238,0.15)
  color: VANTA_COLORS.accent.cyan,                  // #22d3ee
  border: `1px solid rgba(34, 211, 238, 0.25)`,
  borderRadius: '9999px',
}
```

### 7.4 Button

**Surface**: Outlined at rest, fill-on-hover with glow. All variants animated.

```typescript
interface ButtonProps {
  /** Button variant */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  /** Size */
  size?: 'sm' | 'md' | 'lg'
  /** Disabled state */
  disabled?: boolean
  /** Click action ID (for interactable binding) */
  onAction?: string
}
```

**Size Scale**:
```typescript
const BUTTON_SIZES = {
  sm: { padding: '4px 10px', fontSize: '11px' },
  md: { padding: '6px 16px', fontSize: '12px' },
  lg: { padding: '8px 24px', fontSize: '14px' },
} as const
```

**Variant Styles (resting)**:
```typescript
const BUTTON_VARIANTS = {
  primary: {
    background: 'rgba(34, 211, 238, 0.06)',
    color: 'rgba(34, 211, 238, 0.9)',
    border: '1px solid rgba(34, 211, 238, 0.45)',
  },
  secondary: {
    background: 'transparent',
    color: VANTA_COLORS.text.secondary,
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
  ghost: {
    background: 'transparent',
    color: VANTA_COLORS.text.tertiary,
    border: '1px solid transparent',
  },
  danger: {
    background: 'rgba(251, 113, 133, 0.06)',
    color: 'rgba(251, 113, 133, 0.9)',
    border: '1px solid rgba(251, 113, 133, 0.3)',
  },
} as const
```

**Hover Animation** (CSS transitions: `all 200ms ease-out`):
```typescript
const BUTTON_HOVER = {
  primary: {
    background: 'rgba(34, 211, 238, 0.85)',
    color: '#000',
    fontWeight: '600',
    border: '1px solid rgba(34, 211, 238, 0.8)',
    transform: 'scale(1.02)',
    boxShadow: '0 0 14px rgba(34, 211, 238, 0.2)',
  },
  secondary: {
    background: 'rgba(255, 255, 255, 0.06)',
    color: VANTA_COLORS.text.primary,
    border: '1px solid rgba(255, 255, 255, 0.25)',
    transform: 'scale(1.02)',
    boxShadow: '0 0 10px rgba(255, 255, 255, 0.05)',
  },
  ghost: {
    background: 'rgba(255, 255, 255, 0.04)',
    color: VANTA_COLORS.text.secondary,
    border: '1px solid rgba(255, 255, 255, 0.08)',
    transform: 'scale(1.02)',
  },
  danger: {
    background: 'rgba(251, 113, 133, 0.75)',
    color: '#000',
    fontWeight: '600',
    border: '1px solid rgba(251, 113, 133, 0.7)',
    transform: 'scale(1.02)',
    boxShadow: '0 0 14px rgba(251, 113, 133, 0.2)',
  },
} as const
```

**Common Base**:
```typescript
const BUTTON_BASE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: VANTA_TYPOGRAPHY.family.mono,
  letterSpacing: '0.05em',
  borderRadius: VANTA_BORDERS.radius.sm,  // 2px
  cursor: 'pointer',
  transition: 'all 200ms cubic-bezier(0, 0, 0.2, 1)',
  userSelect: 'none',
}
```

### 7.5 Input

**Surface**: Box input — bordered, near-black fill, cyan focus ring.

```typescript
interface InputProps {
  /** Label text (rendered in label preset) */
  label?: string
  /** Placeholder text */
  placeholder?: string
  /** Error message (shows rose border + error text) */
  error?: string
  /** Input type */
  type?: 'text' | 'number' | 'password' | 'email'
  /** Default value */
  defaultValue?: string
  /** Size */
  size?: 'sm' | 'md'
  /** Disabled state */
  disabled?: boolean
}
```

**Style**:
```typescript
const INPUT_STYLE: React.CSSProperties = {
  padding: '8px 12px',
  fontFamily: VANTA_TYPOGRAPHY.family.mono,
  fontSize: VANTA_TYPOGRAPHY.size.base,  // 13px
  color: VANTA_COLORS.text.primary,
  background: 'rgba(10, 10, 10, 0.8)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  borderRadius: VANTA_BORDERS.radius.md,  // 4px
  outline: 'none',
  transition: VANTA_ANIMATION.transition.all,
}

const INPUT_FOCUS: React.CSSProperties = {
  border: '1px solid rgba(34, 211, 238, 0.4)',
  boxShadow: '0 0 0 1px rgba(34, 211, 238, 0.1)',
}

const INPUT_ERROR: React.CSSProperties = {
  border: '1px solid rgba(251, 113, 133, 0.35)',
}
```

### 7.6 Heading

**Surface**: Grotesk font at 3 levels.

```typescript
interface HeadingProps {
  /** Heading level */
  level?: 1 | 2 | 3
}
```

**Level Styles**:
```typescript
const HEADING_LEVELS = {
  1: {
    fontFamily: VANTA_TYPOGRAPHY.family.grotesk,
    fontSize: VANTA_TYPOGRAPHY.size.xl,    // 18px
    fontWeight: VANTA_TYPOGRAPHY.weight.semibold,
    letterSpacing: VANTA_TYPOGRAPHY.tracking.tight,
    color: VANTA_COLORS.text.primary,
    lineHeight: VANTA_TYPOGRAPHY.leading.tight,
  },
  2: {
    fontFamily: VANTA_TYPOGRAPHY.family.grotesk,
    fontSize: VANTA_TYPOGRAPHY.size.md,    // 14px
    fontWeight: VANTA_TYPOGRAPHY.weight.medium,
    letterSpacing: VANTA_TYPOGRAPHY.tracking.normal,
    color: VANTA_COLORS.text.primary,
    lineHeight: VANTA_TYPOGRAPHY.leading.snug,
  },
  3: {
    ...VANTA_TYPOGRAPHY.preset.label,      // Share Tech Mono, 12px, uppercase, 0.1em
    color: VANTA_COLORS.text.tertiary,
  },
} as const
```

### 7.7 List / ListItem

```typescript
interface ListProps {
  /** List style */
  variant?: 'plain' | 'bordered' | 'status'
  /** Gap between items */
  gap?: SpacingToken
}

interface ListItemProps {
  /** Leading element (icon, status dot, badge) */
  leading?: string
  /** Trailing text (timestamp, metadata) */
  trailing?: string
}
```

### 7.8 Separator

```typescript
interface SeparatorProps {
  /** Orientation */
  orientation?: 'horizontal' | 'vertical'
}
```

**Style**: `1px solid rgba(255, 255, 255, 0.04)` — barely visible hairline.

### 7.9 Progress

```typescript
interface ProgressProps {
  /** Current value (0-100) */
  value: number
  /** Intent color for the bar */
  intent?: 'info' | 'success' | 'warning' | 'danger'
  /** Size */
  size?: 'sm' | 'md'
}
```

**Style**: 3px height track (`rgba(255,255,255,0.05)`), accent-colored fill bar, 2px radius.

### 7.10 Code

```typescript
interface CodeProps {
  /** Programming language */
  language?: string
  /** Inline vs block */
  inline?: boolean
}
```

**Style**: Mono font, `surface.elevated` background, `border.subtle` border. Inline variant gets tighter padding.

---

## 8. Text Component — Typographic Hierarchy Composition

The `Text` component is the most important content primitive. It must support arbitrary typographic hierarchy so the model can compose rich text without reaching for `className`.

### Props

```typescript
interface TextProps {
  /** Visual role — maps to VANTA_TYPOGRAPHY presets */
  preset?: 'body' | 'label' | 'caption' | 'value' | 'micro' | 'title' | 'subtitle'
  /** Text color from VANTA hierarchy */
  color?: 'primary' | 'secondary' | 'tertiary' | 'muted'
  /** Accent color override (for data values) */
  accent?: 'cyan' | 'emerald' | 'amber' | 'rose' | 'violet'
  /** Font weight override */
  weight?: 'normal' | 'medium' | 'semibold' | 'bold'
  /** Font size override (named scale) */
  size?: '2xs' | 'xs' | 'sm' | 'base' | 'md' | 'lg' | 'xl' | '2xl' | '3xl'
  /** Font family override */
  family?: 'mono' | 'grotesk' | 'sans' | 'data'
  /** Letter spacing */
  tracking?: 'tight' | 'normal' | 'wide' | 'wider' | 'widest'
  /** Line height */
  leading?: 'none' | 'tight' | 'snug' | 'normal' | 'relaxed'
  /** Text transform */
  transform?: 'uppercase' | 'lowercase' | 'capitalize' | 'none'
  /** Text alignment */
  align?: 'left' | 'center' | 'right'
  /** Truncate with ellipsis */
  truncate?: boolean
  /** Max lines before truncation */
  maxLines?: number
  /** Render as HTML element */
  as?: 'p' | 'span' | 'div' | 'strong' | 'em' | 'small' | 'code'
}
```

### Preset Mapping

```typescript
const TEXT_PRESETS: Record<string, React.CSSProperties> = {
  body: {
    ...VANTA_TYPOGRAPHY.preset.cardBody,
    color: VANTA_COLORS.text.primary,
  },
  label: {
    ...VANTA_TYPOGRAPHY.preset.label,
    color: VANTA_COLORS.text.tertiary,
  },
  caption: {
    ...VANTA_TYPOGRAPHY.preset.micro,
    color: VANTA_COLORS.text.muted,
  },
  value: {
    ...VANTA_TYPOGRAPHY.preset.value,
    color: VANTA_COLORS.text.primary,
  },
  micro: {
    ...VANTA_TYPOGRAPHY.preset.micro,
    color: VANTA_COLORS.text.muted,
  },
  title: {
    ...VANTA_TYPOGRAPHY.preset.cardTitle,
    color: VANTA_COLORS.text.primary,
  },
  subtitle: {
    ...VANTA_TYPOGRAPHY.preset.cardSubtitle,
    color: VANTA_COLORS.text.secondary,
  },
}
```

### Override Resolution

Props override presets. Resolution order:

1. Start with preset style (default: `body`)
2. Apply `color` → `VANTA_COLORS.text[color]`
3. Apply `accent` → `VANTA_COLORS.accent[accent]` (overrides color)
4. Apply `weight` → `VANTA_TYPOGRAPHY.weight[weight]`
5. Apply `size` → `VANTA_TYPOGRAPHY.size[size]`
6. Apply `family` → `VANTA_TYPOGRAPHY.family[family]`
7. Apply `tracking` → `VANTA_TYPOGRAPHY.tracking[tracking]`
8. Apply `leading` → `VANTA_TYPOGRAPHY.leading[leading]`
9. Apply `transform` → CSS `textTransform`
10. Apply `align` → CSS `textAlign`
11. Apply `truncate` / `maxLines`

### Renderer

```tsx
const TextRenderer: ComponentRenderer = ({ element, children }) => {
  const preset = (element.props.preset as string) ?? 'body'
  const base = TEXT_PRESETS[preset] ?? TEXT_PRESETS.body
  const filtered = filterClassName(element.className, TEXT_POLICY)

  const style: React.CSSProperties = { ...base }

  // Color hierarchy
  const color = element.props.color as string | undefined
  if (color && color in VANTA_COLORS.text) {
    style.color = VANTA_COLORS.text[color as keyof typeof VANTA_COLORS.text]
  }

  // Accent override
  const accent = element.props.accent as string | undefined
  if (accent && accent in VANTA_COLORS.accent) {
    const a = VANTA_COLORS.accent[accent as keyof typeof VANTA_COLORS.accent]
    style.color = typeof a === 'string' ? a : a
  }

  // Weight override
  const weight = element.props.weight as string | undefined
  if (weight && weight in VANTA_TYPOGRAPHY.weight) {
    style.fontWeight = VANTA_TYPOGRAPHY.weight[weight as keyof typeof VANTA_TYPOGRAPHY.weight]
  }

  // Size override
  const size = element.props.size as string | undefined
  if (size && size in VANTA_TYPOGRAPHY.size) {
    style.fontSize = VANTA_TYPOGRAPHY.size[size as keyof typeof VANTA_TYPOGRAPHY.size]
  }

  // Family override
  const family = element.props.family as string | undefined
  if (family && family in VANTA_TYPOGRAPHY.family) {
    style.fontFamily = VANTA_TYPOGRAPHY.family[family as keyof typeof VANTA_TYPOGRAPHY.family]
  }

  // Tracking override
  const tracking = element.props.tracking as string | undefined
  if (tracking && tracking in VANTA_TYPOGRAPHY.tracking) {
    style.letterSpacing = VANTA_TYPOGRAPHY.tracking[tracking as keyof typeof VANTA_TYPOGRAPHY.tracking]
  }

  // Leading override
  const leading = element.props.leading as string | undefined
  if (leading && leading in VANTA_TYPOGRAPHY.leading) {
    style.lineHeight = VANTA_TYPOGRAPHY.leading[leading as keyof typeof VANTA_TYPOGRAPHY.leading]
  }

  // Transform
  const transform = element.props.transform as string | undefined
  if (transform) style.textTransform = transform as React.CSSProperties['textTransform']

  // Align
  const align = element.props.align as string | undefined
  if (align) style.textAlign = align as React.CSSProperties['textAlign']

  // Truncation
  if (element.props.truncate) {
    style.overflow = 'hidden'
    style.textOverflow = 'ellipsis'
    style.whiteSpace = 'nowrap'
  }

  const maxLines = element.props.maxLines as number | undefined
  if (maxLines) {
    style.display = '-webkit-box'
    style.WebkitLineClamp = maxLines
    style.WebkitBoxOrient = 'vertical'
    style.overflow = 'hidden'
  }

  const Tag = (element.props.as as keyof JSX.IntrinsicElements) ?? 'div'

  return <Tag style={style} className={filtered}>{element.content ?? children}</Tag>
}
```

### NDJSON Usage Examples

**Simple body text**:
```json
{"key":"t1","type":"Text","content":"Hello world"}
```

**Label with uppercase tracking**:
```json
{"key":"t2","type":"Text","props":{"preset":"label"},"content":"System Status"}
```

**Accented data value**:
```json
{"key":"t3","type":"Text","props":{"preset":"value","accent":"cyan"},"content":"99.97%"}
```

**Custom composition — large grotesk heading**:
```json
{"key":"t4","type":"Text","props":{"family":"grotesk","size":"2xl","weight":"semibold","tracking":"tight"},"content":"Dashboard"}
```

**Mixed hierarchy in a card**:
```json
{"root":"card1"}
{"key":"card1","type":"Card","props":{"title":"Service Health"},"children":["label1","val1","caption1"]}
{"key":"label1","type":"Text","props":{"preset":"label"},"content":"Uptime"}
{"key":"val1","type":"Text","props":{"preset":"value","accent":"emerald","size":"2xl"},"content":"99.97%"}
{"key":"caption1","type":"Text","props":{"preset":"micro"},"content":"Last 30 days"}
```

---

## 9. Catalog Entry Schema

Each component is registered with full metadata:

```typescript
interface CatalogEntry {
  /** Component type identifier (used in NDJSON `type` field) */
  type: string
  /** Tier: core | standard | domain */
  tier: 'core' | 'standard' | 'domain'
  /** Category for prompt grouping */
  category: 'layout' | 'content' | 'surface' | 'interactive' | 'data'
             | 'form' | 'container' | 'rich' | 'composed' | 'specialized'
  /** Whether component accepts children */
  container: boolean
  /** className filtering policy */
  classNamePolicy: ClassNamePolicy
  /** Props schema (for prompt injection + validation) */
  propsSchema: Record<string, PropSpec>
  /** React renderer */
  renderer: ComponentRenderer
}

interface PropSpec {
  type: 'string' | 'number' | 'boolean' | 'enum'
  values?: readonly string[]    // for enum type
  default?: unknown
  description?: string
}
```

### Registration Example

```typescript
export const CORE_CATALOG: CatalogEntry[] = [
  {
    type: 'Grid',
    tier: 'core',
    category: 'layout',
    container: true,
    classNamePolicy: { allow: ['layout', 'sizing', 'overflow'] },
    propsSchema: {
      columns: { type: 'number', description: 'Column count or template' },
      rows: { type: 'number', description: 'Row count or template' },
      gap: { type: 'enum', values: ['xs','sm','md','lg','xl'], default: 'md' },
      flow: { type: 'enum', values: ['row','column','dense'] },
      align: { type: 'enum', values: ['start','center','end','stretch'] },
      justify: { type: 'enum', values: ['start','center','end','between'] },
    },
    renderer: GridRenderer,
  },
  {
    type: 'Text',
    tier: 'core',
    category: 'content',
    container: false,
    classNamePolicy: { allow: ['layout'] },
    propsSchema: {
      preset: { type: 'enum', values: ['body','label','caption','value','micro','title','subtitle'], default: 'body' },
      color: { type: 'enum', values: ['primary','secondary','tertiary','muted'] },
      accent: { type: 'enum', values: ['cyan','emerald','amber','rose','violet'] },
      weight: { type: 'enum', values: ['normal','medium','semibold','bold'] },
      size: { type: 'enum', values: ['2xs','xs','sm','base','md','lg','xl','2xl','3xl'] },
      family: { type: 'enum', values: ['mono','grotesk','sans','data'] },
      tracking: { type: 'enum', values: ['tight','normal','wide','wider','widest'] },
      leading: { type: 'enum', values: ['none','tight','snug','normal','relaxed'] },
      transform: { type: 'enum', values: ['uppercase','lowercase','capitalize','none'] },
      align: { type: 'enum', values: ['left','center','right'] },
      truncate: { type: 'boolean' },
      maxLines: { type: 'number' },
      as: { type: 'enum', values: ['p','span','div','strong','em','small','code'] },
    },
    renderer: TextRenderer,
  },
  // ... remaining core components
]
```

---

## 10. Implementation Plan

### Phase 1: Foundation (current)
1. Create `src/lib/genifer/catalog/tokens.ts` — re-exports from VANTA (if any genifer-specific additions needed)
2. Create `src/lib/genifer/catalog/className.ts` — policy groups, filter function
3. Create `src/lib/genifer/catalog/types.ts` — CatalogEntry, PropSpec, ClassNamePolicy interfaces

### Phase 2: Core Renderers (Tier 1)
4. Implement 16 core component renderers following the spec
5. Register in `src/lib/genifer/catalog/core.ts`
6. Wire into `getCatalogRenderers()` (replaces current `coreDomainCatalog`)

### Phase 3: Standard Renderers (Tier 2)
7. Implement 14 standard component renderers
8. Register in `src/lib/genifer/catalog/standard.ts`

### Phase 4: Domain Renderers (Tier 3)
9. Implement 14 domain component renderers
10. Register in `src/lib/genifer/catalog/domain.ts`

### Phase 5: Integration
11. Update `InlineUITreeCard` to use new catalog
12. Update prompt section to generate component knowledge from `propsSchema`
13. Delete old `core-domain-catalog.tsx`, `ui-domain-catalog.tsx`, `geoint-domain-catalog.tsx`, `rvn-domain-catalog.tsx`

---

## 11. Quality Gates

- [ ] **Visual parity**: Composed benchmark (System Status Dashboard) renders identically to the ratified preview
- [ ] **className filter**: No color/text/shadow classes pass through any component
- [ ] **Token compliance**: Zero hardcoded hex values in any renderer — all from VANTA_*
- [ ] **12px floor**: No text below 12px (except data-grid exemption)
- [ ] **Hover animation**: Button fill-on-hover visually matches ratified preview
- [ ] **NDJSON round-trip**: All 16 core components parse from NDJSON and render correctly
- [ ] **Contract tests**: Each component has a contract test verifying props → visual output
- [ ] **TypeScript clean**: `bunx tsc --noEmit` passes
