# RVN Component Library Plan

## Design System Foundation (COMPLETED)

Tokens are in `src/lib/rvn/tokens/`:
- `colors.ts` - RVN_COLORS, RVN_COLOR_VARS
- `typography.ts` - RVN_FONTS, RVN_FONT_SIZES, RVN_TEXT_PRESETS
- `spacing.ts` - RVN_SPACING, RVN_SPACING_VARS
- `borders.ts` - RVN_BORDERS, RVN_SHADOWS, RVN_PATTERNS, RVN_PRESS_TRANSFORM

Provider in `src/lib/rvn/context/RvnProvider.tsx`
Hooks in `src/lib/rvn/hooks/useRvnTokens.ts`

## Core Design Tokens

```css
--rvn-bg: #e6e6e6;
--rvn-surface: #ffffff;
--rvn-border: #000000;
--rvn-border-width: 3px;
--rvn-shadow: 4px 4px 0px rgba(0,0,0,1);
--rvn-font-sans: 'Helvetica Neue', Helvetica, Arial, sans-serif;
--rvn-font-mono: 'Courier New', Courier, monospace;
```

## Critical Patterns

### Press State
```tsx
const pressStyle = {
  boxShadow: 'none',
  transform: 'translate(4px, 4px)',
}
```

### Critical State (Diagonal Stripes)
```tsx
background: 'repeating-linear-gradient(45deg, #000, #000 5px, #fff 5px, #fff 10px)'
```

### Context Interface Pattern (ALL compound components use this)
```typescript
interface RvnContextValue<TState, TActions, TMeta = {}> {
  state: TState
  actions: TActions
  meta: TMeta
}
```

## Component Style Rules

- **Borders**: 3px solid #000000 (primary), 2px for cards, 1px for tables
- **Shadows**: 4px 4px 0px black, removed on press
- **Corners**: NO border-radius — sharp edges only
- **Typography**: ALL CAPS for labels, monospace for data
- **Min font**: 12px (THE FLOOR)

---

## Agent 2: Button & Interactive Primitives

**Scope**: `src/lib/rvn/primitives/`

| Component | Props | Pattern |
|-----------|-------|---------|
| `RvnButton` | `children, onClick, variant, pressed, disabled` | Press state with shadow toggle |
| `RvnButton.Icon` | `children` | Compound slot |
| `RvnButton.Label` | `children` | Compound slot |
| `RvnIconButton` | `icon, onClick, title` | 44x44px square |
| `RvnInput` | `value, onChange, placeholder` | 3px border, monospace |
| `RvnTextarea` | `value, onChange, rows` | Technician notes pattern |
| `RvnCheckbox` | `checked, onChange, label` | Filter checkbox |
| `RvnDropdown` | `value, options, onChange` | 120px select |

**Files to create**:
- `RvnButton.tsx`
- `RvnIconButton.tsx`
- `RvnInput.tsx`
- `RvnTextarea.tsx`
- `RvnCheckbox.tsx`
- `RvnDropdown.tsx`
- `index.ts`

---

## Agent 3: Display Primitives

**Scope**: `src/lib/rvn/display/`

| Component | Props | Pattern |
|-----------|-------|---------|
| `RvnBadge` | `children, variant` | Black bg + white text, uppercase |
| `RvnStatusDot` | `status: 'active'\|'alert'\|'offline'` | 8px circle |
| `RvnTelemetryBar` | `label, value, critical` | 24px bar with stripes |
| `RvnThreatMeter` | `value, label` | 40px height, stripe fill |
| `RvnIndicator` | `label, active` | Bullet point (●) |
| `RvnParameterTag` | `children` | 1px border inline |

**Files to create**:
- `RvnBadge.tsx`
- `RvnStatusDot.tsx`
- `RvnTelemetryBar.tsx`
- `RvnThreatMeter.tsx`
- `RvnIndicator.tsx`
- `RvnParameterTag.tsx`
- `index.ts`

---

## Agent 4: Panel System (Compound Components)

**Scope**: `src/lib/rvn/layout/`

**RvnPanel API**:
```tsx
<RvnPanel>
  <RvnPanel.Header>
    <RvnPanel.Title>System Status</RvnPanel.Title>
    <RvnPanel.Subtitle>TRACKING: ON</RvnPanel.Subtitle>
  </RvnPanel.Header>
  <RvnPanel.Content>...</RvnPanel.Content>
  <RvnPanel.Footer>Coordinates</RvnPanel.Footer>
</RvnPanel>
```

| Subcomponent | Style |
|--------------|-------|
| `RvnPanel` | 3px border, flex column |
| `RvnPanel.Header` | Black bg, white text |
| `RvnPanel.Title` | 14px bold uppercase |
| `RvnPanel.Subtitle` | 10px mono, #ccc |
| `RvnPanel.Content` | 20px padding |
| `RvnPanel.Footer` | #f4f4f4 bg, 10px mono |

**Also create**:
- `RvnCard` — Equipment card with shadow
- `RvnModal` — Fixed overlay with 70% black bg

**Files to create**:
- `RvnPanel.tsx`
- `RvnCard.tsx`
- `RvnModal.tsx`
- `index.ts`

---

## Agent 5: Navigation Components

**Scope**: `src/lib/rvn/navigation/`

| Component | Props | Behavior |
|-----------|-------|----------|
| `RvnHeader` | `brand, children` | Logo + nav row |
| `RvnNavItem` | `children, active, onClick` | Inverted active state |
| `RvnTabButton` | `children, active, onClick` | Right border, numbered |
| `RvnTabBar` | `children` | Flex container |
| `RvnBreadcrumb` | `segments` | Mono 10px with slashes |
| `RvnFooter` | `left, right` | Mono 10px, border-top |
| `RvnSidebar` | `children, width` | 260-380px fixed |
| `RvnActionRail` | `children` | 80px vertical button rail |

**Files to create**:
- `RvnHeader.tsx`
- `RvnNavItem.tsx`
- `RvnTabButton.tsx`
- `RvnTabBar.tsx`
- `RvnBreadcrumb.tsx`
- `RvnFooter.tsx`
- `RvnSidebar.tsx`
- `RvnActionRail.tsx`
- `index.ts`

---

## Agent 6: Table & Data Components

**Scope**: `src/lib/rvn/data/`

### RvnTable (Simple Compound)
```tsx
<RvnTable>
  <RvnTable.Header>
    <RvnTable.HeaderCell>Op ID</RvnTable.HeaderCell>
  </RvnTable.Header>
  <RvnTable.Body>
    <RvnTable.Row>
      <RvnTable.Cell>OP_GHOST</RvnTable.Cell>
    </RvnTable.Row>
  </RvnTable.Body>
</RvnTable>
```

**Style**: Black header row, 1px borders, hover #f0f0f0, monospace data

**Files to create**:
- `RvnTable.tsx`
- `index.ts`

---

## Agent 7: Card Components

**Scope**: `src/lib/rvn/cards/`

| Component | Props | Pattern |
|-----------|-------|---------|
| `RvnEquipmentCard` | `category, name, status` | 2px border, 6px shadow |
| `RvnUnitCard` | `code, className, status, selected, disabled` | Selectable with invert |
| `RvnObjectiveItem` | `id, text, completed` | 4px left border accent |
| `RvnThreatStat` | `label, value` | Flex between, mono |
| `RvnLogEntry` | `time, message, alert` | Timestamp + message |

**Files to create**:
- `RvnEquipmentCard.tsx`
- `RvnUnitCard.tsx`
- `RvnObjectiveItem.tsx`
- `RvnThreatStat.tsx`
- `RvnLogEntry.tsx`
- `index.ts`

---

## Agent 8: Visualization Components

**Scope**: `src/lib/rvn/visualization/`

**RvnTacticalMap** — Mapbox GL JS with brutalist overlay

```tsx
<RvnTacticalMap.Provider state={mapState} actions={mapActions} meta={mapMeta}>
  <RvnTacticalMap.Frame>
    <RvnTacticalMap.Canvas />
    <RvnTacticalMap.Overlay>
      <RvnTacticalMap.CrosshairCorners />
      <RvnTacticalMap.Markers />
    </RvnTacticalMap.Overlay>
    <RvnTacticalMap.Header>Active Field Map</RvnTacticalMap.Header>
    <RvnTacticalMap.Coordinates />
  </RvnTacticalMap.Frame>
</RvnTacticalMap.Provider>
```

**Mapbox Config**:
- Style: `mapbox://styles/mapbox/standard`
- Theme: `monochrome`
- Disable native labels, render custom RVN labels

**Files to create**:
- `RvnTacticalMap.tsx`
- `rvn-mapbox-config.ts`
- `RvnMapMarker.tsx`
- `RvnDeploymentZone.tsx`
- `RvnThreatMarker.tsx`
- `RvnPathTrace.tsx`
- `RvnCrosshairCorners.tsx`
- `RvnMapCoordinates.tsx`
- `index.ts`

---

## Agent 9: Layout Templates

**Scope**: `src/lib/rvn/templates/`

| Template | Structure |
|----------|-----------|
| `RvnDashboardLayout` | Sidebar (260px) + Main (flex) + ActionRail (80px) |
| `RvnBriefingLayout` | Header + 2-column (Main + Sidebar 400px) |
| `RvnTabbedLayout` | Header + TabBar + TabContent |
| `RvnSplitLayout` | 3-column grid |

**Files to create**:
- `RvnDashboardLayout.tsx`
- `RvnBriefingLayout.tsx`
- `RvnTabbedLayout.tsx`
- `RvnSplitLayout.tsx`
- `index.ts`
