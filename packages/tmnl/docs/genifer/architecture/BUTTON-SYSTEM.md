# Genifer Button System — Architecture Specification

> **Status**: SPEC  
> **Epoch**: Catalog Overhaul (#F620)  
> **Author**: Val (Vigilant Architecture Layer)  
> **Date**: 2026-02-22

---

## 1. Problem Statement

The current button situation is a single `Button` component with 6 string variants. This is fine for human-authored UIs, but genifer's purpose is to let LLMs compose full microinteractions — loading states, confirmation flows, split actions, pulsing attention, cooldown timers. A single component with a `variant` prop cannot express any of that.

The user specifically requested:

- **Full taxonomy** (10-15+ named components), not a single polymorphic prop bag
- **All 11 visual variants** — solid, outline, ghost, link, subtle, gradient, glow, glass, destructive, success, warning
- **All 8 interactive states** — loading-spinner, loading-progress, disabled, pressed, pulse, confirm, cooldown, success-flash
- **All 9 composition patterns** — icon-left, icon-right, icon-only, badge-count, split, group, FAB, pill, block
- **Compound component architecture** following Vercel composition patterns
- **Decorator integration** — `@component`, `@actionGroup`, `@state`, `@action`

---

## 2. Architectural Principles

### 2.1 Compound Components (Vercel Pattern)

The button system follows the compound component pattern exactly:

```
                ┌─────────────────────────────┐
                │      ButtonContext           │
                │  ┌───────────────────────┐  │
                │  │ state: ButtonState     │  │
                │  │ actions: ButtonActions │  │
                │  │ meta: ButtonMeta       │  │
                │  └───────────────────────┘  │
                └──────────┬──────────────────┘
                           │
          ┌────────────────┼────────────────────┐
          │                │                    │
     Button.Root     Button.Icon          Button.Label
     Button.Badge    Button.Spinner       Button.Progress
```

**Key insight**: The LLM composes slots freely. Named assemblies (ActionButton, ConfirmButton) are pre-composed patterns that the LLM can use as shortcuts, but the primitive slots remain composable.

### 2.2 Explicit Variants, Not Boolean Props

Per the Vercel composition rules, we **never** do this:

```tsx
// WRONG — boolean prop proliferation
<Button isLoading isPill hasIcon isGlow isDestructive />
```

Instead, we create explicit named components:

```tsx
// RIGHT — named assembly
<ActionButton variant="destructive" shape="pill" glow>
  <Button.Icon>🗑</Button.Icon>
  <Button.Label>Delete</Button.Label>
</ActionButton>
```

### 2.3 LLM Generation Interface

The LLM sees a catalog of button components in its system prompt. Each component has a clear purpose, props schema, and usage description. The LLM outputs JSONL that references these types:

```jsonl
{"op":"add","path":"/elements/delBtn","value":{"key":"delBtn","type":"ActionButton","props":{"variant":"destructive","shape":"pill","loading":false},"children":["delIcon","delLabel"]}}
{"op":"add","path":"/elements/delIcon","value":{"key":"delIcon","type":"ButtonIcon","props":{"position":"leading","glyph":"🗑"}}}
{"op":"add","path":"/elements/delLabel","value":{"key":"delLabel","type":"ButtonLabel","props":{"text":"Delete"}}}
```

---

## 3. Component Taxonomy

### 3.1 Primitive Slots (The Building Blocks)

These are the atomic pieces that compose into buttons:

| Component | Purpose | Props |
|-----------|---------|-------|
| **ButtonRoot** | Container shell — provides context, handles events | `variant`, `size`, `shape`, `disabled`, `className`, `action` |
| **ButtonIcon** | Icon glyph slot | `glyph` (string/emoji), `position` (leading/trailing) |
| **ButtonLabel** | Text label | `text` |
| **ButtonBadge** | Count/notification overlay | `count` (number), `max` (number), `dot` (boolean) |
| **ButtonSpinner** | Loading spinner (replaces content when active) | `active` (boolean) |
| **ButtonProgress** | Progress bar fill overlay | `value` (0-100) |

### 3.2 Named Assemblies (Pre-composed Patterns)

These are ready-made button compositions. Each is a specific compound of the primitives above. The LLM can use these directly or compose from slots.

| Component | Composition | Interactive State | Use Case |
|-----------|-------------|-------------------|----------|
| **ActionButton** | Root + Icon? + Label + Spinner | loading → spinner replaces label, success → green flash | Primary actions: Submit, Save, Send |
| **ConfirmButton** | Root + Label (transforms) | idle → "Delete" → clicked → "Are you sure?" → confirmed | Destructive/irreversible actions |
| **CooldownButton** | Root + Label + timer | clicked → disabled with countdown → re-enabled | Rate-limited actions, resend codes |
| **PulseButton** | Root + Label + pulse animation | idle → attention pulse (CSS keyframe) | CTAs, onboarding nudges |
| **SplitButton** | Root(primary) + Separator + Root(dropdown) | primary click → action, dropdown click → menu | Actions with alternatives |
| **FloatingActionButton** | Root (fixed, circular) + Icon | fixed position, elevation shadow | Mobile-style primary action |
| **LinkButton** | Root (text-only) + Label | underline on hover, no background | Navigation, inline actions |
| **GhostButton** | Root (transparent) + Icon? + Label | background reveals on hover | Toolbar buttons, secondary actions |

### 3.3 Group Components

| Component | Purpose | Props |
|-----------|---------|-------|
| **ButtonGroup** | Horizontal/vertical strip of buttons | `orientation` (row/column), `attached` (boolean, merge borders) |
| **ButtonGroupSeparator** | Visual divider between grouped buttons | — |

---

## 4. Visual Variant System

### 4.1 Variant Tokens

Every button accepts a `variant` prop. Variants are **purely visual** — they control colors, backgrounds, and borders. They do NOT control behavior.

```
┌──────────────┬──────────────────────────────────────────────────────────────┐
│ Variant      │ Harness Treatment                                           │
├──────────────┼──────────────────────────────────────────────────────────────┤
│ solid        │ bg: cyan-500, text: black, hover: cyan-400                  │
│ outline      │ bg: transparent, border: neutral-700, text: neutral-300     │
│ ghost        │ bg: transparent, hover: white/5, text: neutral-400          │
│ link         │ bg: none, text: cyan, border-bottom: cyan/30, no padding   │
│ subtle       │ bg: cyan/8, text: cyan-300, border: cyan/15                │
│ gradient     │ bg: linear-gradient(cyan→violet), text: white              │
│ glow         │ bg: cyan/10, box-shadow: 0 0 12px cyan/40, text: cyan     │
│ glass        │ bg: white/5, backdrop-blur: 12px, border: white/10         │
│ destructive  │ bg: red-500/15, text: red-400, border: red-500/25          │
│ success      │ bg: green-500/15, text: green-400, border: green-500/25    │
│ warning      │ bg: amber-500/15, text: amber-400, border: amber-500/25    │
└──────────────┴──────────────────────────────────────────────────────────────┘
```

All variants follow the harness/vantablack aesthetic:
- Minimum `var(--tmnl-text-xs, 12px)` font size
- `font-mono` throughout
- `active:scale-[0.97]` on press
- `transition-all` on hover

### 4.2 Size Scale

| Size | Height | Padding | Font Size | Icon Size |
|------|--------|---------|-----------|-----------|
| `xs` | 24px | px-2 | `--tmnl-text-xs` (12px) | 12px |
| `sm` | 28px | px-2.5 | `--tmnl-text-xs` (12px) | 14px |
| `md` | 32px | px-3 | `--tmnl-text-sm` (14px) | 16px |
| `lg` | 38px | px-4 | `--tmnl-text-sm` (14px) | 18px |
| `xl` | 44px | px-5 | `--tmnl-text-base` (16px) | 20px |

### 4.3 Shape Modifiers

| Shape | Treatment |
|-------|-----------|
| `default` | `border-radius: 6px` |
| `pill` | `border-radius: 9999px` |
| `square` | `border-radius: 0` |
| `circle` | `border-radius: 50%; aspect-ratio: 1` (icon-only) |

---

## 5. Interactive States

### 5.1 State Machine

Every named assembly wraps a simple state machine. The states are expressed as props, not internal useState — the LLM controls them via ActionGroup state bindings.

```
                        ┌──────────┐
                        │   idle   │ ← default
                        └────┬─────┘
                             │ click
                ┌────────────┼────────────────┐
                │            │                │
           ┌────▼────┐ ┌────▼────┐   ┌───────▼───────┐
           │ loading  │ │ confirm │   │   cooldown    │
           │ (spinner │ │ (label  │   │ (timer,       │
           │  or bar) │ │  swap)  │   │  disabled)    │
           └────┬─────┘ └────┬────┘   └───────┬───────┘
                │            │                │
           ┌────▼────┐ ┌────▼────┐   ┌───────▼───────┐
           │ success  │ │ execute │   │    ready      │
           │ (flash,  │ │ (runs   │   │ (re-enabled)  │
           │  ✓ icon) │ │ action) │   └───────────────┘
           └────┬─────┘ └─────────┘
                │
           ┌────▼────┐
           │  idle   │ ← resets after 1.5s
           └─────────┘
```

### 5.2 State Props (LLM-controlled)

| State Prop | Type | Effect |
|------------|------|--------|
| `loading` | `boolean` | Shows spinner, dims label, disables pointer |
| `progress` | `number (0-100)` | Shows progress bar overlay |
| `disabled` | `boolean` | Dims to 30% opacity, `pointer-events: none` |
| `pressed` | `boolean` | Toggled active appearance (pressed bg tint) |
| `pulse` | `boolean` | CSS keyframe attention animation |
| `confirmPending` | `boolean` | Label swaps to confirm text |
| `cooldownMs` | `number` | Countdown timer after click |
| `successFlash` | `boolean` | Brief green check flash |

### 5.3 ActionGroup Integration

Buttons wire to the genifer decorator system via ActionGroup:

```typescript
@actionGroup({ name: 'deleteFlow' })
class DeleteFlow extends Schema.Class<DeleteFlow>('DeleteFlow')({
  confirmPending: Schema.Boolean,
  loading: Schema.Boolean,
  successFlash: Schema.Boolean,
}) {
  @state() confirmPending = false
  @state() loading = false  
  @state() successFlash = false

  @action({ label: 'Request delete' })
  requestDelete() {
    this.confirmPending = true
  }

  @action({ label: 'Confirm delete' })
  async confirmDelete() {
    this.confirmPending = false
    this.loading = true
    await deleteItem()          // side effect
    this.loading = false
    this.successFlash = true
    setTimeout(() => { this.successFlash = false }, 1500)
  }

  @action({ label: 'Cancel' })
  cancel() {
    this.confirmPending = false
  }
}
```

The LLM binds button props to this state:

```jsonl
{"op":"add","path":"/elements/delBtn","value":{"key":"delBtn","type":"ConfirmButton","props":{"variant":"destructive","bind:confirmPending":"@state:deleteFlow.confirmPending","bind:loading":"@state:deleteFlow.loading","bind:successFlash":"@state:deleteFlow.successFlash","@action:click":"@action:deleteFlow.requestDelete","@action:confirm":"@action:deleteFlow.confirmDelete","@action:cancel":"@action:deleteFlow.cancel"}}}
```

---

## 6. Composition Patterns (LLM Examples)

### 6.1 Icon + Label (Leading)

```jsonl
{"op":"add","path":"/elements/saveBtn","value":{"key":"saveBtn","type":"ActionButton","props":{"variant":"solid","size":"md"},"children":["saveIcon","saveLabel"]}}
{"op":"add","path":"/elements/saveIcon","value":{"key":"saveIcon","type":"ButtonIcon","props":{"glyph":"💾","position":"leading"}}}
{"op":"add","path":"/elements/saveLabel","value":{"key":"saveLabel","type":"ButtonLabel","props":{"text":"Save"}}}
```

### 6.2 Icon-Only with Badge

```jsonl
{"op":"add","path":"/elements/notifBtn","value":{"key":"notifBtn","type":"ButtonRoot","props":{"variant":"ghost","size":"md","shape":"circle","aria-label":"Notifications"},"children":["notifIcon","notifBadge"]}}
{"op":"add","path":"/elements/notifIcon","value":{"key":"notifIcon","type":"ButtonIcon","props":{"glyph":"🔔"}}}
{"op":"add","path":"/elements/notifBadge","value":{"key":"notifBadge","type":"ButtonBadge","props":{"count":3,"max":99}}}
```

### 6.3 Split Button

```jsonl
{"op":"add","path":"/elements/splitBtn","value":{"key":"splitBtn","type":"SplitButton","props":{"variant":"solid"},"children":["splitPrimary","splitDropdown"]}}
{"op":"add","path":"/elements/splitPrimary","value":{"key":"splitPrimary","type":"ButtonLabel","props":{"text":"Merge"}}}
{"op":"add","path":"/elements/splitDropdown","value":{"key":"splitDropdown","type":"ButtonIcon","props":{"glyph":"▾","position":"trailing"}}}
```

### 6.4 Button Group (Attached)

```jsonl
{"op":"add","path":"/elements/viewToggle","value":{"key":"viewToggle","type":"ButtonGroup","props":{"orientation":"row","attached":true},"children":["listBtn","gridBtn","kanbanBtn"]}}
{"op":"add","path":"/elements/listBtn","value":{"key":"listBtn","type":"GhostButton","props":{"pressed":true},"children":["listLabel"]}}
{"op":"add","path":"/elements/listLabel","value":{"key":"listLabel","type":"ButtonLabel","props":{"text":"List"}}}
...
```

### 6.5 Floating Action Button

```jsonl
{"op":"add","path":"/elements/fab","value":{"key":"fab","type":"FloatingActionButton","props":{"variant":"solid","position":"bottom-right"},"children":["fabIcon"]}}
{"op":"add","path":"/elements/fabIcon","value":{"key":"fabIcon","type":"ButtonIcon","props":{"glyph":"✚"}}}
```

### 6.6 Full Microinteraction: Delete with Confirm + Loading + Success Flash

```jsonl
{"op":"add","path":"/elements/delBtn","value":{"key":"delBtn","type":"ConfirmButton","props":{"variant":"destructive","shape":"pill","confirmText":"Are you sure?","bind:loading":"@state:deleteFlow.loading","bind:successFlash":"@state:deleteFlow.successFlash","@action:click":"@action:deleteFlow.requestDelete","@action:confirm":"@action:deleteFlow.confirmDelete"},"children":["delIcon","delLabel"]}}
{"op":"add","path":"/elements/delIcon","value":{"key":"delIcon","type":"ButtonIcon","props":{"glyph":"🗑","position":"leading"}}}
{"op":"add","path":"/elements/delLabel","value":{"key":"delLabel","type":"ButtonLabel","props":{"text":"Delete"}}}
```

---

## 7. Harness Renderer Specification

All button renderers follow the vantablack design language. Here is the shared token set:

```typescript
const B = {
  // Variant backgrounds (harness palette)
  variants: {
    solid:       { bg: 'rgb(34,211,238)',       text: 'rgb(0,0,0)',         border: 'transparent',          hover: 'rgb(22,189,216)' },
    outline:     { bg: 'transparent',           text: 'rgb(212,212,212)',   border: 'rgba(64,64,64,0.6)',   hover: 'rgba(255,255,255,0.05)' },
    ghost:       { bg: 'transparent',           text: 'rgb(163,163,163)',   border: 'transparent',          hover: 'rgba(255,255,255,0.05)' },
    link:        { bg: 'transparent',           text: 'rgb(34,211,238)',    border: 'transparent',          hover: 'transparent' },
    subtle:      { bg: 'rgba(34,211,238,0.08)', text: 'rgb(103,232,249)',   border: 'rgba(34,211,238,0.15)', hover: 'rgba(34,211,238,0.12)' },
    gradient:    { bg: 'linear-gradient(135deg, rgb(34,211,238), rgb(139,92,246))', text: 'white', border: 'transparent', hover: 'brightness(1.1)' },
    glow:        { bg: 'rgba(34,211,238,0.1)',  text: 'rgb(34,211,238)',    border: 'rgba(34,211,238,0.25)', hover: 'rgba(34,211,238,0.15)',
                   shadow: '0 0 12px rgba(34,211,238,0.35)' },
    glass:       { bg: 'rgba(255,255,255,0.05)', text: 'rgb(212,212,212)',  border: 'rgba(255,255,255,0.1)', hover: 'rgba(255,255,255,0.08)',
                   backdrop: 'blur(12px)' },
    destructive: { bg: 'rgba(239,68,68,0.12)',  text: 'rgb(248,113,113)',   border: 'rgba(239,68,68,0.25)', hover: 'rgba(239,68,68,0.18)' },
    success:     { bg: 'rgba(34,197,94,0.12)',  text: 'rgb(74,222,128)',    border: 'rgba(34,197,94,0.25)', hover: 'rgba(34,197,94,0.18)' },
    warning:     { bg: 'rgba(245,158,11,0.12)', text: 'rgb(251,191,36)',    border: 'rgba(245,158,11,0.25)', hover: 'rgba(245,158,11,0.18)' },
  },

  // Sizes
  sizes: {
    xs: { height: 24, px: 8,    fontSize: 'var(--tmnl-text-xs, 12px)', iconSize: 12 },
    sm: { height: 28, px: 10,   fontSize: 'var(--tmnl-text-xs, 12px)', iconSize: 14 },
    md: { height: 32, px: 12,   fontSize: 'var(--tmnl-text-sm, 14px)', iconSize: 16 },
    lg: { height: 38, px: 16,   fontSize: 'var(--tmnl-text-sm, 14px)', iconSize: 18 },
    xl: { height: 44, px: 20,   fontSize: 'var(--tmnl-text-base, 16px)', iconSize: 20 },
  },

  // Shapes
  shapes: {
    default: 6,
    pill: 9999,
    square: 0,
    circle: '50%',
  },

  // Universal
  transition: 'all 150ms ease',
  activeScale: 'scale(0.97)',
  disabledOpacity: 0.3,
  fontFamily: 'font-mono',
} as const
```

### 7.1 ButtonRoot Renderer

```tsx
function ButtonRootRenderer({ element, children }: ComponentRenderProps) {
  const v = B.variants[(element.props.variant as string) ?? 'outline']
  const s = B.sizes[(element.props.size as string) ?? 'md']
  const shape = B.shapes[(element.props.shape as string) ?? 'default']
  const disabled = element.props.disabled as boolean
  const loading = element.props.loading as boolean

  return (
    <button
      type="button"
      disabled={disabled || loading}
      aria-label={element.props['aria-label'] as string}
      className={`${element.props.className ?? ''} inline-flex items-center justify-center gap-1.5 font-mono whitespace-nowrap transition-all active:scale-[0.97]`.trim()}
      style={{
        height: s.height,
        paddingLeft: s.px, paddingRight: s.px,
        fontSize: s.fontSize,
        borderRadius: shape,
        background: v.bg,
        color: v.text,
        border: v.border !== 'transparent' ? `1px solid ${v.border}` : 'none',
        opacity: disabled ? B.disabledOpacity : 1,
        pointerEvents: disabled || loading ? 'none' : 'auto',
        cursor: disabled ? 'default' : 'pointer',
        boxShadow: (v as any).shadow,
        backdropFilter: (v as any).backdrop,
        transition: B.transition,
      }}
    >
      {children}
    </button>
  )
}
```

### 7.2 ButtonSpinner Renderer

```tsx
function ButtonSpinnerRenderer({ element }: ComponentRenderProps) {
  if (!(element.props.active as boolean)) return null
  const sz = element.props.size as number ?? 14
  return (
    <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" className="animate-spin">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
```

### 7.3 ButtonBadge Renderer

```tsx
function ButtonBadgeRenderer({ element }: ComponentRenderProps) {
  const count = element.props.count as number
  const max = element.props.max as number ?? 99
  const dot = element.props.dot as boolean
  const display = dot ? '' : (count > max ? `${max}+` : String(count))

  return (
    <span
      className="absolute font-mono font-medium"
      style={{
        top: -4, right: -4,
        minWidth: dot ? 8 : 16,
        height: dot ? 8 : 16,
        borderRadius: 9999,
        background: 'rgb(239, 68, 68)',
        color: 'white',
        fontSize: 'var(--tmnl-text-xs, 10px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: dot ? 0 : '0 4px',
        boxShadow: '0 0 6px rgba(239,68,68,0.4)',
      }}
    >
      {display}
    </span>
  )
}
```

---

## 8. Catalog Registration

### 8.1 File Structure

```
src/lib/genifer/catalog/
├── core-domain-catalog.tsx       # 69 core components (DONE)
├── button-domain-catalog.tsx     # NEW — full button taxonomy
├── ui-domain-catalog.tsx         # GUTTED — FoldablePanel, SemanticRegion, Switch, Progress only
├── geoint-domain-catalog.tsx     # Unchanged
├── rvn-domain-catalog.tsx        # Unchanged
├── index.ts                      # Barrel
```

### 8.2 Button Catalog Component Inventory

| # | Component | Tier | Domains | Compound |
|---|-----------|------|---------|----------|
| 1 | ButtonRoot | core | ui | parent: slots = [ButtonIcon, ButtonLabel, ButtonBadge, ButtonSpinner, ButtonProgress] |
| 2 | ButtonIcon | core | ui | — |
| 3 | ButtonLabel | core | ui | — |
| 4 | ButtonBadge | core | ui | — |
| 5 | ButtonSpinner | core | ui | — |
| 6 | ButtonProgress | core | ui | — |
| 7 | ActionButton | core | ui | assembly: ButtonRoot + ButtonIcon? + ButtonLabel + ButtonSpinner |
| 8 | ConfirmButton | domain | ui, forms | assembly: ButtonRoot + ButtonLabel (transforms) |
| 9 | CooldownButton | domain | ui, forms | assembly: ButtonRoot + ButtonLabel + timer |
| 10 | PulseButton | domain | ui | assembly: ButtonRoot + ButtonLabel + pulse keyframe |
| 11 | SplitButton | domain | ui | assembly: ButtonRoot + separator + ButtonRoot |
| 12 | FloatingActionButton | domain | ui | assembly: ButtonRoot (fixed, circle) + ButtonIcon |
| 13 | LinkButton | core | ui | assembly: ButtonRoot (text-only) + ButtonLabel |
| 14 | GhostButton | core | ui | assembly: ButtonRoot (ghost variant) + ButtonIcon? + ButtonLabel |
| 15 | ButtonGroup | core | ui, layout | parent: slots = [ButtonRoot, ActionButton, GhostButton, ...] |
| 16 | ButtonGroupSeparator | core | ui, layout | — |

**Total: 16 button components**

### 8.3 CompoundRelation Declarations

```typescript
// ButtonRoot is the fundamental compound parent
ButtonRoot.compound = {
  parent: 'ButtonRoot',
  slots: ['ButtonIcon', 'ButtonLabel', 'ButtonBadge', 'ButtonSpinner', 'ButtonProgress'],
  strict: false,  // allow other children too
}

// Named assemblies inherit the slot system
ActionButton.compound = {
  parent: 'ActionButton',
  slots: ['ButtonIcon', 'ButtonLabel', 'ButtonSpinner'],
  strict: false,
}

// SplitButton is a special compound
SplitButton.compound = {
  parent: 'SplitButton',
  slots: ['ButtonLabel', 'ButtonIcon'],  // primary section + dropdown trigger
  strict: false,
}

// ButtonGroup groups any button type
ButtonGroup.compound = {
  parent: 'ButtonGroup',
  slots: ['ButtonRoot', 'ActionButton', 'GhostButton', 'ConfirmButton',
          'CooldownButton', 'PulseButton', 'LinkButton', 'ButtonGroupSeparator'],
  strict: false,
}
```

---

## 9. UI Domain Catalog Cleanup

### 9.1 Components to REMOVE (duplicated in core-domain-catalog)

| Component | Core Equivalent | Notes |
|-----------|----------------|-------|
| Text | — | Body text is just `<p>`, not worth a component |
| Heading | — | Use standard HTML heading in Box |
| Button | → ButtonRoot + assemblies | Replaced by full system |
| Card | → InfoCard, MetricCard, Shell | Core has card patterns |
| CardHeader | → HeaderBar | Core has header bars |
| CardTitle | — | Just a styled heading |
| CardDescription | — | Just styled text |
| CardContent | — | Just a container div |
| CardFooter | — | Just a flex container |
| Input | → core forms (Textarea, etc.) | Core has full forms suite |
| Badge | → Indicator | Core has status indicators |
| Alert | → Callout, Banner | Core has feedback variants |
| Separator | — | Single `<hr>` doesn't need a component |

### 9.2 Components to KEEP (unique functionality)

| Component | Reason |
|-----------|--------|
| **Switch** | Toggle input not covered in core (distinct from ToggleButton) |
| **Progress** | Progress bar not in core |
| **FoldablePanel** | Domain-specific, not in core |
| **SemanticRegion** | Agent infrastructure, not in core |

### 9.3 Result

After cleanup, `ui-domain-catalog.tsx` will contain exactly **4 components** — Switch, Progress, FoldablePanel, SemanticRegion — all restyled to vantablack.

The new `button-domain-catalog.tsx` will contain **16 button components** as specified above.

---

## 10. LLM Prompt Fragment

This is what the LLM sees in its system prompt for the button system:

```
## Button Components

### Primitive Slots (compose freely)
- ButtonRoot: Container shell. Props: variant (solid|outline|ghost|link|subtle|gradient|glow|glass|destructive|success|warning), size (xs|sm|md|lg|xl), shape (default|pill|square|circle), disabled, loading, pressed, pulse, className, action, aria-label. Children: ButtonIcon, ButtonLabel, ButtonBadge, ButtonSpinner, ButtonProgress.
- ButtonIcon: Icon glyph. Props: glyph (string/emoji), position (leading|trailing).
- ButtonLabel: Text label. Props: text.
- ButtonBadge: Count overlay (absolute positioned). Props: count, max (default 99), dot (boolean).
- ButtonSpinner: Loading spinner. Props: active.
- ButtonProgress: Progress bar overlay. Props: value (0-100).

### Named Assemblies (pre-composed patterns — use these for common cases)
- ActionButton: Primary action button with loading→success flow. Props: variant, size, shape, loading, successFlash, className. Children: ButtonIcon?, ButtonLabel, ButtonSpinner.
- ConfirmButton: Two-step confirm. Click → "Are you sure?" → confirm/cancel. Props: variant, confirmText, bind:loading, bind:successFlash. Children: ButtonIcon?, ButtonLabel.
- CooldownButton: Timer after click. Props: variant, cooldownMs. Children: ButtonLabel.
- PulseButton: Attention-seeking pulse animation. Props: variant, pulse. Children: ButtonIcon?, ButtonLabel.
- SplitButton: Primary action + dropdown. Props: variant. Children: ButtonLabel, ButtonIcon(▾).
- FloatingActionButton: Fixed-position circular button. Props: variant, position (bottom-right|bottom-left|top-right|top-left). Children: ButtonIcon.
- LinkButton: Text-only button. Props: text, external (boolean).
- GhostButton: Transparent, reveals on hover. Props: size, pressed. Children: ButtonIcon?, ButtonLabel.

### Button Group
- ButtonGroup: Horizontal/vertical button strip. Props: orientation (row|column), attached (boolean). Children: any button type + ButtonGroupSeparator.
- ButtonGroupSeparator: Visual divider.

### Interaction Bindings
Wire button states to ActionGroup atoms:
  bind:loading → @state:groupName.loading
  bind:pressed → @state:groupName.pressed
  @action:click → @action:groupName.methodName
  @action:confirm → @action:groupName.confirmMethod
```

---

## 11. Animation Tokens

All button components use the same 4 entrance animations from core-domain-catalog:

| Animation | Components |
|-----------|-----------|
| `A.quick` (opacity+scale, out-quart, fast=100ms) | ButtonRoot, ActionButton, GhostButton, LinkButton, all primitive slots |
| `A.pop` (opacity+scale, out-back, normal=200ms) | FloatingActionButton, PulseButton |
| `A.slide` (opacity+translateY, out-cubic, normal=200ms) | SplitButton, ButtonGroup |
| `A.fade` (opacity, out-quad, fast=100ms) | ButtonGroupSeparator, ButtonProgress |

---

## 12. Testing Strategy

### 12.1 Schema Tests
- Every component has a valid Effect Schema
- All required props are present
- Variant/size/shape literals are exhaustive

### 12.2 Compound Relationship Tests
- ButtonRoot accepts all slot children
- Named assemblies compose correctly
- ButtonGroup accepts any button type
- SplitButton has exactly 2 visual sections

### 12.3 Tier & Domain Tests
- ButtonRoot, ButtonIcon, ButtonLabel, ActionButton, GhostButton, LinkButton, ButtonGroup = tier `core`
- ConfirmButton, CooldownButton, PulseButton, SplitButton, FloatingActionButton = tier `domain`
- All components have domain `ui`

### 12.4 Renderer Smoke Tests
- Every variant renders without error
- Every size renders with correct height
- Loading state shows spinner, hides label
- Disabled state has reduced opacity
- Badge renders with correct count formatting

---

## 13. Dependencies

- `@/components/ui/button` — shadcn Button (base guts for ButtonRoot)
- `@/components/ui/button-group` — shadcn ButtonGroup (base guts)
- `@/components/ui/separator` — for ButtonGroupSeparator
- No new external dependencies

---

## 14. Open Questions

1. **Should the gradient variant support custom color pairs?** Current spec hardcodes cyan→violet. Could expose `gradientFrom`/`gradientTo` props.
2. **CooldownButton timer display**: Show remaining seconds in the label, or as a circular progress ring?
3. **ConfirmButton second-click area**: Should the confirm state show two buttons (Confirm / Cancel) or just change the label?
4. **FloatingActionButton z-index**: Should it be layer-system aware, or just a high static z-index?

---

*Val out. This is the button system that lets an LLM compose "click → confirm → loading → success flash" in 4 lines of JSONL. Not a variant prop. A vocabulary.*
