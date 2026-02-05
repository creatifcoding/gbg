# CLAUDE.rvn.md — Agent Reference

## Overview

RVN is the brutalist component library for TMNL. 60+ components following the shadcn/ui composition pattern with tactical/industrial aesthetics.

## File Structure

```
src/lib/rvn/
├── tokens/          # Design tokens (colors, typography, spacing, borders)
├── context/         # RvnProvider
├── hooks/           # useRvnTokens, useRvnAnimate, useRvnLayout, useMapFeatures
├── primitives/      # Button, IconButton, Input, Textarea, Checkbox, Dropdown
├── display/         # Badge, StatusDot, TelemetryBar, ThreatMeter, Indicator, ParameterTag
├── layout/          # Panel, Card, Modal, Drawer
├── navigation/      # Header, NavItem, TabBar, TabButton, Breadcrumb, Footer, Sidebar, ActionRail
├── data/            # Table, DataGrid
├── cards/           # EquipmentCard, UnitCard, ObjectiveItem, ThreatStat, LogEntry, IntelCard, ThreatCard
├── visualization/   # TacticalMap, MapMarker, MapLabel, DeploymentZone, PathTrace, etc.
├── templates/       # DashboardLayout, BriefingLayout, TabbedLayout, SplitLayout
├── animation/       # presets, modes, layout, orchestration
├── entity/          # RvnRenderer, EntityRegistry
├── feedback/        # Toast, Alert, Tooltip, Popover, ProgressBar
├── forms/           # Select, Radio, Switch, Slider
└── index.ts         # Barrel exports
```

## Key Patterns

### Compound Components

All complex components use the compound pattern with Context:

```tsx
// Pattern: RvnPanel
<RvnPanel.Root>
  <RvnPanel.Header>
    <RvnPanel.Title>Title</RvnPanel.Title>
  </RvnPanel.Header>
  <RvnPanel.Content>...</RvnPanel.Content>
  <RvnPanel.Footer>...</RvnPanel.Footer>
</RvnPanel.Root>
```

### TypeScript Compound Export

For TypeScript compatibility, use explicit interface casting:

```tsx
interface RvnPanelComponent {
  (props: PanelProps): React.ReactElement
  displayName: string
  Header: typeof Header
  Title: typeof Title
  Content: typeof Content
  Footer: typeof Footer
}

const PanelWithSlots = RvnPanel as RvnPanelComponent
PanelWithSlots.Header = Header
// ...
export { PanelWithSlots as RvnPanel }
```

### Press State

All buttons/interactive elements:

```tsx
const [isPressed, setIsPressed] = useState(false)
const style = {
  boxShadow: isPressed ? 'none' : '4px 4px 0px rgba(0,0,0,1)',
  transform: isPressed ? 'translate(4px, 4px)' : 'none',
}
```

### Critical Stripes

Warning/error states:

```tsx
const criticalBg = 'repeating-linear-gradient(45deg, #000, #000 5px, #fff 5px, #fff 10px)'
```

## Design Tokens

Always use CSS variables, never hardcode:

| Token | Value | Use |
|-------|-------|-----|
| `--rvn-border` | #000000 | Border color |
| `--rvn-border-w` | 3px | Border width |
| `--rvn-surface` | #ffffff | Background |
| `--rvn-text-main` | #000000 | Primary text |
| `--rvn-text-muted` | #666666 | Secondary text |
| `--rvn-font-mono` | 'Courier New' | Data, labels |
| `--rvn-font-sans` | 'Helvetica Neue' | Headings |
| `--rvn-space-s` | 10px | Small spacing |
| `--rvn-space-m` | 20px | Medium spacing |
| `--rvn-shadow` | 4px 4px 0 #000 | Brutalist shadow |

## Typography Floor

**MINIMUM 12px** — Nothing below. Use `--rvn-text-xs: 12px` for smallest text.

## Animation System

Uses raw anime.js (NOT TMNL's animatable()):

```tsx
import { useRvnAnimate } from '@/lib/rvn'

const { ref, play } = useRvnAnimate('press')
// Presets: press, hoverInvert, criticalPulse, emergencyGlitch, tacticalFadeIn
```

## Entity Rendering

Schema-driven auto-rendering based on `_tag`:

```tsx
import { RvnRenderer } from '@/lib/rvn'

RvnRenderer.register('Equipment', RvnEquipmentCard)
<RvnRenderer.Auto entity={entity} />
```

## Common Tasks

### Adding a new component

1. Create in appropriate directory (primitives/, display/, etc.)
2. Follow compound pattern if complex
3. Use CSS variables for all styles
4. Export from directory's index.ts
5. Re-export from main index.ts
6. Add to RvnTestbed.tsx

### Using with effect-atom

RVN components are stateless — wire atoms at consumer level:

```tsx
const statusAtom = Atom.make<'active' | 'offline'>('active')

function MyComponent() {
  const status = useAtomValue(statusAtom)
  return <RvnStatusDot status={status} />
}
```

## Anti-Patterns

- ❌ Using `px` values directly (use CSS vars)
- ❌ Border-radius (brutalist = sharp edges)
- ❌ Text below 12px
- ❌ Tailwind arbitrary values like `text-[8px]`
- ❌ useState inside RVN components (keep stateless)
- ❌ Importing from component files directly (use barrel exports)

## Related

- Testbed: `/testbed/rvn`
- Plan: `~/.claude/plans/binary-jumping-hartmanis.md`
- Source: `integrate/rvn/` (35 original files)
