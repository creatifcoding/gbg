# RVN Component Library

Brutalist design system for tactical/industrial interfaces. 60+ components with sharp aesthetics, high contrast, and no-nonsense functionality.

## Installation

```tsx
import { RvnProvider, RvnButton, RvnPanel } from '@/lib/rvn'

function App() {
  return (
    <RvnProvider>
      <YourApp />
    </RvnProvider>
  )
}
```

## Design Principles

- **3px solid black borders** on all major elements
- **4px 4px box-shadow** with press-state removal
- **High-contrast black/white** color palette
- **Monospace + Helvetica Neue** typography
- **NO border-radius** — brutalist sharp edges
- **12px minimum font size** — always readable

## Component Categories

### Primitives
Basic interactive elements.

```tsx
import { RvnButton, RvnInput, RvnCheckbox, RvnDropdown } from '@/lib/rvn'

<RvnButton variant="primary">DEPLOY</RvnButton>
<RvnButton variant="ghost">CANCEL</RvnButton>
<RvnInput placeholder="UNIT ID" />
<RvnCheckbox label="ACTIVE ONLY" checked={active} onChange={setActive} />
```

### Display
Status indicators and data visualization.

```tsx
import { RvnBadge, RvnStatusDot, RvnTelemetryBar, RvnThreatMeter } from '@/lib/rvn'

<RvnBadge>NOMINAL</RvnBadge>
<RvnStatusDot status="active" />
<RvnTelemetryBar percentage={75} showLabel />
<RvnThreatMeter level="moderate" />
```

### Layout
Compound container components.

```tsx
import { RvnPanel, RvnCard, RvnModal } from '@/lib/rvn'

<RvnPanel.Root>
  <RvnPanel.Header>
    <RvnPanel.Title>System Status</RvnPanel.Title>
  </RvnPanel.Header>
  <RvnPanel.Content>All systems operational.</RvnPanel.Content>
  <RvnPanel.Footer>LAT 34.0522 N</RvnPanel.Footer>
</RvnPanel.Root>
```

### Navigation
Headers, tabs, breadcrumbs.

```tsx
import { RvnHeader, RvnTabBar, RvnTabButton, RvnBreadcrumb } from '@/lib/rvn'

<RvnTabBar>
  <RvnTabButton active>All Units</RvnTabButton>
  <RvnTabButton>Critical</RvnTabButton>
  <RvnTabButton>Offline</RvnTabButton>
</RvnTabBar>
```

### Data
Tables and grids.

```tsx
import { RvnTable } from '@/lib/rvn'

<RvnTable>
  <RvnTable.Header>
    <RvnTable.HeaderCell>Op ID</RvnTable.HeaderCell>
    <RvnTable.HeaderCell>Status</RvnTable.HeaderCell>
  </RvnTable.Header>
  <RvnTable.Body>
    <RvnTable.Row>
      <RvnTable.Cell>OP_GHOST</RvnTable.Cell>
      <RvnTable.Cell>COMPLETE</RvnTable.Cell>
    </RvnTable.Row>
  </RvnTable.Body>
</RvnTable>
```

### Cards
Specialized card components.

```tsx
import { RvnEquipmentCard, RvnUnitCard, RvnLogEntry } from '@/lib/rvn'

<RvnEquipmentCard category="PRIMARY WEAPON" model="Rail Cannon MK-IV" status="NOMINAL" />
<RvnUnitCard code="TX-99" status="NOMINAL" powerLevel={85} />
<RvnLogEntry timestamp="14:32:00" message="Connection established" />
```

### Visualization
Tactical map and overlays.

```tsx
import { RvnTacticalMap, RvnMapMarker, RvnDeploymentZone } from '@/lib/rvn'

<RvnTacticalMap.Frame>
  <RvnTacticalMap.Canvas />
  <RvnTacticalMap.Overlay>
    <RvnTacticalMap.CrosshairCorners />
  </RvnTacticalMap.Overlay>
</RvnTacticalMap.Frame>
```

### Templates
Page-level layouts.

```tsx
import { RvnDashboardLayout, RvnBriefingLayout } from '@/lib/rvn'

<RvnDashboardLayout>
  <RvnDashboardLayout.Sidebar>...</RvnDashboardLayout.Sidebar>
  <RvnDashboardLayout.Main>...</RvnDashboardLayout.Main>
  <RvnDashboardLayout.ActionRail>...</RvnDashboardLayout.ActionRail>
</RvnDashboardLayout>
```

## Design Tokens

CSS custom properties injected by `RvnProvider`:

```css
/* Colors */
--rvn-bg: #e6e6e6;
--rvn-surface: #ffffff;
--rvn-border: #000000;
--rvn-text-main: #000000;
--rvn-text-muted: #666666;
--rvn-text-inv: #ffffff;

/* Typography */
--rvn-font-sans: 'Helvetica Neue', sans-serif;
--rvn-font-mono: 'Courier New', monospace;

/* Spacing */
--rvn-space-xs: 4px;
--rvn-space-s: 10px;
--rvn-space-m: 20px;
--rvn-space-l: 30px;
--rvn-space-xl: 60px;

/* Borders */
--rvn-border-w: 3px;
--rvn-shadow: 4px 4px 0px rgba(0,0,0,1);
```

## Press State Pattern

All interactive elements follow the brutalist press pattern:

```tsx
// Normal state
boxShadow: '4px 4px 0px rgba(0,0,0,1)'

// Pressed state
boxShadow: 'none'
transform: 'translate(4px, 4px)'
```

## Critical State Pattern

Warning/critical states use diagonal stripes:

```tsx
background: 'repeating-linear-gradient(45deg, #000, #000 5px, #fff 5px, #fff 10px)'
```

## Testbed

View all components at `/testbed/rvn`
