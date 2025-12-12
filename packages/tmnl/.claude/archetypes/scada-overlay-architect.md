# SCADA-OVERLAY-ARCHITECT ARCHETYPE

## Core Insight

**Overlays invert the SCADA screen paradigm.**

Traditional: Screens contain controls, graphics, alarms.
Inverted: Overlays are **composable capabilities** that respond to data streams.

Data dispatches TO overlays. Overlays don't fetch—they react.

## Execution Model

| Type | Trigger | Examples |
|------|---------|----------|
| **Interactive** | User gesture (click, drag, key) | Navigation, Faceplate, Command |
| **Reactive** | Port message (data stream) | TagBinding, Alarm, Trend, Chart, DataGrid |

All overlays share LIFO dispatch. Handler results: `handled` (stop), `delegate` (next), `broadcast` (all).

## SCADA Overlay Taxonomy

These are **views**—visual capabilities that bind to data streams:

| Overlay | Domain | Port Pattern | Responsibility |
|---------|--------|--------------|----------------|
| **TagBinding** | `tag` | `tag:{tagId}:pv` | Live value rendering, quality indication |
| **Alarm** | `alarm` | `alarm:{tagId}:active` | Annunciation, acknowledgment, shelving |
| **Navigation** | `nav` | `nav:screen:current` | Screen transitions, breadcrumb, history |
| **Faceplate** | `faceplate` | `faceplate:{tagId}:open` | Popover control panels, setpoint entry |
| **Chart** | `chart` | `chart:{chartId}:data` | Time-series visualization, multiple traces |
| **DataGrid** | `grid` | `grid:{gridId}:rows` | Tabular data, AG-Grid integration |
| **Command** | `cmd` | `cmd:{target}:execute` | Operator actions, confirmation flows |

Extensible: Add overlays by implementing `Overlay<Config, State>` interface.

## Port Naming Convention

```
{domain}:{entity}:{property}
```

Examples:
- `tag:FIC-101:pv` — Process value for flow controller
- `alarm:FIC-101:active` — Alarm state
- `chart:trends-1:data` — Chart data stream
- `grid:alarms:rows` — Alarm summary grid rows

Matches OPC-UA/ISA-95 hierarchical addressing.

## Fix Procedure (TRACE → VERIFY → ITERATE → EXTEND → IMPLEMENT)

### 1. TRACE

Add logging at critical junctures:

```typescript
// In EventDispatcher.dispatch()
yield* Effect.log(`[DISPATCH] event=${event.type} handlers=${handlers.length}`)

// In PortHub.publish()
yield* Effect.log(`[PORT:PUB] ${containerId}:${portId} payload=${JSON.stringify(payload)}`)

// In usePort subscription
console.log(`[PORT:SUB] ${containerId}:${portId} value=`, payload)
```

### 2. VERIFY

Confirm pub/sub uses shared runtime:

```typescript
// In OverlayTestbed
const runtimeResult = useAtomValue(overlayRuntimeAtom)
console.log('[RUNTIME] shared?', Result.isSuccess(runtimeResult))
```

### 3. ITERATE

For each hypothesis, modify testbed:
- Add explicit publish button
- Add subscription status indicator
- Validate with Effect.withSpan for DevTools visibility

### 4. EXTEND

Build ViewOverlay base:

```typescript
interface ViewOverlayConfig<T> {
  readonly portPattern: string  // e.g., "tag:{tagId}:pv"
  readonly render: (data: T) => ReactNode
  readonly errorBoundary?: ReactNode
}

const createViewOverlay = <T,>(config: ViewOverlayConfig<T>) =>
  createOverlay({
    id: config.portPattern,
    ports: [{ portId: config.portPattern as PortId, initialValue: undefined }],
    handlers: {},  // Reactive, not interactive
  })
```

### 5. IMPLEMENT

Build overlays in order:
1. TagBinding (simplest reactive overlay)
2. Alarm (adds state machine for ack/shelve)
3. DataGrid (integrates AG-Grid)
4. Chart (integrates ECharts)
5. Navigation (interactive, screen transitions)
6. Faceplate (interactive, popover lifecycle)

## Hypothesis Manifest (10 Hypotheses)

| ID | Claim | Test |
|----|-------|------|
| **OV-H1** | Container creation emits to containerIdsAtom | Create container, check atom value |
| **OV-H2** | Overlay registration adds to activeOverlaysAtom | Register overlay, verify in list |
| **OV-H3** | LIFO dispatch order correct | Enable A then B, dispatch, verify B called first |
| **OV-H4** | Handler "handled" stops propagation | Return "handled", verify A not called |
| **OV-H5** | Port publish reaches subscribers | Publish, verify usePort value updates |
| **OV-H6** | Port destroy clears subscriptions | Destroy port, verify cleanup |
| **OV-H7** | Overlay disable removes from dispatch | Disable overlay, dispatch, verify not called |
| **OV-H8** | Multiple containers isolated | Two containers, ports don't cross |
| **OV-H9** | EventLog replay restores state | Persist events, reload, verify state |
| **OV-H10** | Reactive overlay updates on port message | Bind TagBinding, publish value, verify render |

## Integration Points

| System | Integration |
|--------|-------------|
| **AG-Grid** | DataGrid overlay wraps grid with port-bound rowData |
| **ECharts** | Chart overlay wraps chart with port-bound series |
| **tldraw** | Overlays render inside canvas shapes via React portals |
| **Effect-Atom** | All state via atoms, operations via runtime.fn() |

## Anti-Patterns

| Pattern | Problem | Fix |
|---------|---------|-----|
| Separate runtime per hook | Different service instances | Use shared `overlayRuntimeAtom` |
| Polling for data | Defeats reactive model | Use port subscriptions |
| Screen-centric thinking | Monolithic, non-composable | Think overlays as capabilities |
| Hardcoded port names | Brittle, non-reusable | Use port pattern templates |

## Usage Example

```tsx
import { useOverlayContainer, useOverlay, usePort } from '@/lib/overlays'
import { TagBindingOverlay } from '@/lib/overlays/scada'

function MimicScreen() {
  const { containerId, ready } = useOverlayContainer({ id: 'mimic-1' })

  // Register SCADA overlays
  useOverlay({ containerId, overlay: TagBindingOverlay })

  // Bind specific tag
  const { value } = usePort<number>({
    containerId,
    portId: 'tag:FIC-101:pv' as PortId,
  })

  if (!ready) return <Loading />

  return (
    <div className="mimic-screen">
      <TagDisplay tagId="FIC-101" value={value} />
    </div>
  )
}
```

## Session Handoff

When resuming work on SCADA overlays:

1. Check overlay stack execution (TRACE logs present?)
2. Verify all 10 hypotheses pass in testbed
3. Implement overlays in order: TagBinding → Alarm → DataGrid → Chart → Navigation → Faceplate
4. Port naming follows `{domain}:{entity}:{property}` convention
5. All overlays are **views**—reactive to port data, not imperative fetchers
