# STORYBOARD 3: Breakout - Tool Result Spawns Standalone Panel

> Val's architecture note · COP Chat Panel · Breakout Mechanics
> Questionnaire source: `chat-panel-features` → "i want all of those different options - rich, and break out"
> This is the DEFINE feature: chat tool results can escape the chat and become first-class panels.

## Visual

```
╔══════════════════════════════════════════════════════════════════════════════════════╗
║  STORYBOARD 3: Breakout - Tool result spawns standalone FoldablePanel               ║
╠══════════════════════════════════════════════════════════════════════════════════════╣
║                                                                                      ║
║  ┌─ CHAT ─────────────── ▾ ──────────┐   ┌─ WO-4821 DETAIL ──────── ▾ ──────────┐  ║
║  │ ◆ COP ASSISTANT    planner ▼  │ │   │ ◆ WORK ORDER                          │  ║
║  ├────────────────────────────────────┤   ├──────────────────────────────────────────┤  ║
║  │                                    │   │                                          │  ║
║  │  ┌─ YOU ───────────────────────┐   │   │  ┌─ IDENTITY ────────────────────────┐  │  ║
║  │  │ Show me overdue WOs         │   │   │  │ ID:        WO-4821               │  │  ║
║  │  └─────────────────────────────┘   │   │  │ Status:    ■ STARTED             │  │  ║
║  │                                    │   │  │ Priority:  ■ EMERGENCY           │  │  ║
║  │  ┌─ ASSISTANT ─── complete ──┐     │   │  │ Type:      corrective_maint      │  │  ║
║  │  │ Found 12 overdue.         │     │   │  │ Assigned:  J.Martinez            │  │  ║
║  │  │                           │     │   │  │ Location:  Plant Alpha · Line 3  │  │  ║
║  │  │  ╔═══════════════════╗    │     │   │  │ Asset:     PUMP-042-A            │  │  ║
║  │  │  ║ OVERDUE · 12      ║    │     │   │  │ Created:   2026-01-25 08:41      │  │  ║
║  │  │  ║ ■ WO-4821  ←─────║────║─────║───║──│ Due:       2026-01-26 08:00      │  │  ║
║  │  │  ║ ■ WO-4819        ║    │     │   │  │ Overdue:   14 days               │  │  ║
║  │  │  ║ ■ WO-4815        ║    │     │   │  └───────────────────────────────────┘  │  ║
║  │  │  ║     [▶ Panel] ←──║────║──┐  │   │                                          │  ║
║  │  │  ╚═══════════════════╝    │  │  │   │  ┌─ FDA AUDIT TRAIL ─────────────────┐  │  ║
║  │  │                           │  │  │   │  │                                    │  │  ║
║  │  │ Three are emergency.      │  │  │   │  │  08:41  ● created                 │  │  ║
║  │  └───────────────────────────┘  │  │   │  │         │                          │  │  ║
║  │                                 │  │   │  │  08:41  ● submitted               │  │  ║
║  │  clicked [▶ Panel] ────────────┘  │   │  │         │                          │  │  ║
║  │  OR clicked WO-4821 row ──────────┘   │  │  08:42  ● approved                │  │  ║
║  │                                        │   │  │         │                          │  │  ║
║  │                                        │   │  │  08:45  ● started   ← current     │  │  ║
║  │                                        │   │  │                                    │  │  ║
║  │  ┌─ AGENT: analyst ─── idle ─┐        │   │  └────────────────────────────────────┘  │  ║
║  │  │ > Correlations complete.   │        │   │                                          │  ║
║  │  │ > 2 anomalies detected.   │        │   │  ┌─ CORRELATED SENSORS ───────────────┐  │  ║
║  │  └────────────────────────────┘        │   │  │                                    │  │  ║
║  │                                        │   │  │  TMP-041  127°C   ▰▰▰▰▰▰▰▱ ■ CRIT│  │  ║
║  │ ┌──────────────────────────────────┐   │   │  │  VIB-019   4.2g   ▰▰▰▰▱▱▱▱ ■ WARN│  │  ║
║  │ │ @WO-4821 escalate ...     ⏎     │   │   │  │  PRS-008   82bar  ▰▰▰▰▰▰▱▱ ■ OK  │  │  ║
║  │ └──────────────────────────────────┘   │   │  │  FLW-012   1.2L/s ▰▰▱▱▱▱▱▱ ■ LOW │  │  ║
║  │ [Terminal] [●AI] ◈med  /  @  📎  🎤  │   │  │                                    │  │  ║
║  └────────────────────────────────────────┘   │  └────────────────────────────────────┘  │  ║
║                                                │                                          │  ║
║                                                │  ┌─ ACTIONS ────────────────────────────┐  │  ║
║                                                │  │  [Escalate]  [Reassign]  [Close]     │  │  ║
║                                                │  └──────────────────────────────────────┘  │  ║
║                                                └──────────────────────────────────────────────┘  ║
║                                                                                      ║
║  ← Chat panel (left)                    Breakout panel (right, spawned) →            ║
╚══════════════════════════════════════════════════════════════════════════════════════╝
```

## Breakout Mechanics

### Trigger Points

There are **three** ways to break out from chat to standalone panel:

1. **[▶ Panel] button** on any tool result card → spawns full detail panel
2. **Click entity ID** (e.g., click "WO-4821" in the list) → spawns entity detail panel
3. **Right-click → "Open in Panel"** context menu on any block → spawns panel with block content

### Breakout Flow

```
User clicks [▶ Panel] on WorkOrderListCard tool result
│
├── 1. Read tool result data
│   └── toolCall.result: { items: WorkOrderModel[], count: 12 }
│   └── clicked item: WO-4821 (or null if [▶ Panel] on list card)
│
├── 2. Determine breakout type
│   ├── Single entity → WorkOrderDetailPanel
│   ├── Entity list → WorkOrderListPanel (full, not truncated)
│   └── Chart data → SensorChartPanel (interactive ECharts)
│
├── 3. Spawn FoldablePanel
│   └── panelId: `breakout-${entityType}-${entityId}-${Date.now()}`
│   └── badge: { tag: 'custom', label: 'WORK ORDER', icon: Wrench, color: 'var(--rvn-emergency)' }
│   └── customName: "WO-4821 DETAIL"
│   └── initialFoldState: 'expanded'
│   └── expandedHeight: 600 (or dynamic)
│
├── 4. Register in layout
│   └── GeointConductorView receives new panel via breakoutPanelsAtom [NEW]
│   └── Positioned: right of chat panel, or next available grid slot
│   └── Snap-to-grid if canvas mode (#449)
│
└── 5. Wire reactive data
    └── Panel subscribes to Fermion atom: workOrderAtom(entityId)
    └── Live data - if WO status changes, panel updates
    └── Correlated sensors: sensorFermion queries live
```

### Component Tree: Breakout Panel

```
FoldablePanel (panelId="breakout-wo-4821-17384...")
├── Header: "WO-4821 DETAIL" + badge(WORK ORDER, EMERGENCY color)
├── Content (scrollable)
│   ├── Section: IDENTITY
│   │   └── KeyValueGrid (RvnCard)
│   │       ├── ID: WO-4821
│   │       ├── Status: ■ STARTED (RvnBadge, color by status)
│   │       ├── Priority: ■ EMERGENCY (RvnBadge, red)
│   │       ├── Type: corrective_maint
│   │       ├── Assigned: J.Martinez
│   │       ├── Location: Plant Alpha · Line 3
│   │       ├── Asset: PUMP-042-A
│   │       ├── Created: 2026-01-25 08:41
│   │       ├── Due: 2026-01-26 08:00
│   │       └── Overdue: 14 days (red text)
│   │
│   ├── Section: FDA AUDIT TRAIL
│   │   └── VerticalTimeline (RVN primitive)
│   │       ├── ● created (08:41)
│   │       ├── ● submitted (08:41)
│   │       ├── ● approved (08:42)
│   │       └── ● started (08:45) ← current
│   │
│   ├── Section: CORRELATED SENSORS
│   │   └── SensorReadingsGrid
│   │       ├── TMP-041: 127°C [████████░░] ■ CRITICAL
│   │       ├── VIB-019: 4.2g  [████░░░░░░] ■ WARNING
│   │       ├── PRS-008: 82bar [██████░░░░] ■ OK
│   │       └── FLW-012: 1.2L/s[██░░░░░░░░] ■ LOW
│   │
│   └── Section: ACTIONS
│       ├── [Escalate] → slash command /escalate WO-4821
│       ├── [Reassign] → opens assignment dialog
│       └── [Close] → slash command /close WO-4821
│
└── Settings (gear)
    ├── tab: "Refresh" - polling interval for live data
    └── tab: "Correlations" - which sensors to show
```

## Atom Topology: Breakout Panels

```
┌──────────────────────────────────────────────────────────────────────────┐
│  BREAKOUT PANEL STATE                                                     │
│                                                                            │
│  breakoutPanelsAtom [NEW]                                                 │
│  └── Map<panelId, BreakoutPanelConfig>                                   │
│      └── { entityType, entityId, panelType, position, size }             │
│                                                                            │
│  WorkOrderDetailPanel subscribes:                                         │
│  ├── workOrderAtom(entityId)  ← Fermion family (hydrated via IIoT HttpApi)│
│  │   └── WorkOrderModel with all fields + audit trail                    │
│  ├── correlatedSensorsAtom(assetId) [NEW derived atom]                   │
│  │   └── queries sensorFermion via IIoT query endpoints                  │
│  └── breakoutPanelsAtom → own position/size                              │
│                                                                            │
│  Chat panel retains:                                                       │
│  └── Original tool result card (with [▶ Panel] button now showing "Open")│
│  └── Visual link: dotted line or highlight connecting card to panel       │
│                                                                            │
└──────────────────────────────────────────────────────────────────────────┘
```

## Data Flow: Live Updates

```
Breakout Panel                         IIoT Unified HttpApi
──────────────                         ─────────────────────
  workOrderFermion fetch/list            GET /api/queries/workorders
  │                                      POST /api/workorders/work-order-get/:entityId
  │                                      POST /api/workorders/work-order-<transition>/:entityId
  └──► workOrderAtom('WO-4821')          │
       └── Atom.set(newData)             └──► Proxy/Query handlers → Entity/Service flow
           └── React re-render
               └── Status badge: ■ STARTED → ■ COMPLETED
               └── Audit trail: + ● completed (09:15)
               └── Chat block also updates (same atom)
```

## Schema: BreakoutPanelConfig

```typescript
// src/components/cop/schemas/breakout.ts

import { Schema } from 'effect'

const BreakoutEntityType = Schema.Literal(
  'work-order', 'alarm', 'sensor', 'asset', 'event-timeline'
)

const BreakoutPanelConfig = Schema.Struct({
  panelId: Schema.String,
  entityType: BreakoutEntityType,
  entityId: Schema.String,
  /** Which chat block spawned this */
  sourceBlockId: Schema.String,
  /** Grid position (snap-to-grid) */
  position: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
  }),
  /** Panel dimensions */
  size: Schema.Struct({
    width: Schema.Number,
    height: Schema.Number,
  }),
  /** When it was spawned */
  createdAt: Schema.DateFromSelf,
})
```

## Cross-Reference: Existing Infrastructure

| Need | Existing System | How It's Used |
|------|----------------|---------------|
| Panel container | `src/lib/foldable-panel/FoldablePanel.tsx` | Direct usage with dynamic panelId |
| Entity data | `src/lib/iiot/fermion/workOrderFermion.ts` | `workOrderAtom(id)` Fermion family hydrated via unified IIoT HttpApi |
| Sensor data | `src/lib/iiot/fermion/sensorFermion.ts` | `sensorReadingsAtom(sensorId)` hydrated via IIoT query endpoints |
| Audit trail | `src/lib/iiot/http/api.ts` + `src/lib/iiot/entity/WorkOrderEntity.ts` | Accessed via unified workorder HttpApi routes (query + entity RPC), not direct browser repo access |
| Status badges | `src/lib/rvn/` → RvnBadge | Priority/status color coding |
| Telemetry bars | `src/lib/rvn/` → RvnProgress | Sensor reading visualization |
| Snap-to-grid | Task #449 in F122 | Canvas positioning for spawned panels |
| Action buttons | `src/lib/rvn/` → RvnButton | [Escalate] [Reassign] [Close] |

## Interaction: Actions from Breakout Panel

When user clicks [Escalate] in the breakout panel:

```
1. Button click → dispatches to chatDispatchAtom
   └── Creates slash command: /escalate WO-4821 supervisor=Martinez

2. Chat receives the command
   └── Creates SlashCommandBlockV3 in chatBlocksAtom
   └── Slash command registry executes:
       └── IIoTService.escalateWorkOrder(id, { supervisor, reason })
       └── Unified IIoT HttpApi command route (EntityProxy flow)
       └── Returns result

3. Chat shows result:
   └── SlashCommandBlock: "✓ WO-4821 escalated to Martinez. Notification sent."

4. Breakout panel updates reactively:
   └── workOrderAtom('WO-4821') refreshes
   └── Status may change, audit trail updated
```

## Breakout Panel Lifecycle

```
Created by: [▶ Panel] click / entity click / context menu
    │
    ├── Panel appears in GeointConductorView layout
    │   └── positioned relative to chat panel
    │   └── respects layout mode (Command Center, Focus, Analytics)
    │
    ├── Lives independently of chat
    │   └── Chat can be folded/minimized - breakout panel persists
    │   └── Multiple breakout panels can exist simultaneously
    │   └── Each has unique panelId, own FoldablePanel state
    │
    ├── Can be dismissed via:
    │   ├── FoldablePanel close button (X)
    │   ├── FoldablePanel.onDelete callback → removes from breakoutPanelsAtom
    │   └── Layout reset (all breakouts cleared)
    │
    └── On dismiss:
        └── Remove from breakoutPanelsAtom
        └── Chat tool result card: [▶ Panel] button re-enabled (was "Open")
        └── Panel state cleaned up
```

## Design Token Compliance

| Element | Token | Value |
|---------|-------|-------|
| Section headers (IDENTITY, AUDIT TRAIL) | `--tmnl-text-sm` | 14px, font-mono, uppercase |
| Key labels (ID:, Status:) | `--tmnl-text-xs` | 12px, muted color |
| Value text | `--tmnl-text-sm` | 14px, font-mono |
| Overdue indicator | `--tmnl-text-sm` | 14px, red foreground |
| Sensor reading values | `--tmnl-text-sm` | 14px, font-mono, tabular-nums |
| Action buttons | `--tmnl-text-sm` | 14px |
| Timeline timestamps | `--tmnl-text-xs` | 12px, muted |
| border-radius | none | 0 - RVN brutalist |
