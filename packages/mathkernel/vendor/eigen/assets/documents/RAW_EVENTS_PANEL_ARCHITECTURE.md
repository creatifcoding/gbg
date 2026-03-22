# RawEventsPanel Architecture

> AG-Grid integration for real-time event stream visualization with dynamic schema-derived columns.

## High-Level Data Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          EmissionEngine                                  │
│                                                                          │
│  rAF Loop → TypedArray batches → Atom.set(rawEventsAtom)                │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         rawEventsAtom                                    │
│                                                                          │
│   Atom.make<RawEvent[]>([])  ← Atom-as-State pattern                    │
│   Max 1000 events (circular buffer)                                      │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      RawEventsPanel (React)                              │
│                                                                          │
│   const rawEvents = useAtomValue(rawEventsAtom)                         │
│                         │                                                │
│                         ▼                                                │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                    TmnlDataGrid (AG-Grid)                        │   │
│   │                                                                   │   │
│   │   variant={tmnlDenseDark}  ← Theme tokens                        │   │
│   │   rowData={[...rawEvents]}                                       │   │
│   │   columnDefs={dynamicColumns}  ← Schema-derived                  │   │
│   │   onCellClicked={handleCellClicked}                              │   │
│   └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Column Definition Architecture

The grid columns are **dynamically generated** based on the payload profile:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     Column Definition Pipeline                           │
└─────────────────────────────────────────────────────────────────────────┘

                   scenarioConfig.payloadProfile
                             │
                             ▼
           ┌─────────────────┴─────────────────┐
           │        payloadProfile             │
           │                                   │
           │  'senml' │ 'opcua' │ 'prometheus' │
           └────┬─────────┬──────────┬─────────┘
                │         │          │
                ▼         ▼          ▼
┌───────────────────┐ ┌─────────────────┐ ┌──────────────────┐
│ generateSenML     │ │ generateOpcUa   │ │ generatePrometheus│
│ Columns()         │ │ Columns()       │ │ Columns()        │
│                   │ │                 │ │                  │
│ ┌───────────────┐ │ │ ┌─────────────┐ │ │ ┌──────────────┐ │
│ │ Temp (Group)  │ │ │ │ Publisher   │ │ │ │ Metric       │ │
│ │  ├─ Value     │ │ │ │  ├─ ID      │ │ │ │  ├─ Name     │ │
│ │  └─ Unit      │ │ │ │  └─ Writer  │ │ │ │  ├─ Value    │ │
│ │ Humidity...   │ │ │ │ DataSet...  │ │ │ │  └─ Type     │ │
│ │ Pressure...   │ │ │ └─────────────┘ │ │ │ Labels       │ │
│ │ Voltage...    │ │ │                 │ │ │  ├─ method   │ │
│ └───────────────┘ │ │                 │ │ │  ├─ status   │ │
└───────────────────┘ └─────────────────┘ │ │  └─ job      │ │
                                          │ └──────────────┘ │
                                          └──────────────────┘
                             │
                             ▼
                    columnDefs = useMemo(() => [
                      ...baseColumnsLeft,   // ID, Time, Type, Latency, Size
                      ...schemaColumns,      // Profile-specific
                      ...baseColumnsRight,   // Payload, CB, Details
                    ], [payloadProfile])
```

---

## Cell Renderer Pattern

AG-Grid cell renderers are **React components** that receive row data via `params`:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       Cell Renderer Pattern                              │
└─────────────────────────────────────────────────────────────────────────┘

ColDef                          ICellRendererParams
  │                                     │
  ├─ field: 'latencyMs'                 ├─ value: number (latencyMs)
  ├─ cellRenderer: LatencyRenderer      ├─ data: RawEvent (full row)
  │                                     ├─ colDef: ColDef
  │                                     └─ api: GridApi
  │                                           │
  │                                           ▼
  │                       ┌────────────────────────────────────┐
  │                       │  function LatencyRenderer(params)  │
  │                       │                                    │
  │                       │  const latencyMs = params.data?.latencyMs
  │                       │  const latencyMicro = latencyMs * 1000
  │                       │                                    │
  │                       │  // Color by threshold             │
  │                       │  const color = latencyMicro >= 100 │
  │                       │    ? variant.colors.signal.negative│
  │                       │    : latencyMicro >= 50            │
  │                       │      ? '#f59e0b'                   │
  │                       │      : variant.colors.signal.positive
  │                       │                                    │
  │                       │  return <span style={{color}}>    │
  │                       │    {latencyMicro.toFixed(0)}μs    │
  │                       │  </span>                           │
  │                       └────────────────────────────────────┘
```

---

## Renderer Hierarchy

```
                          PayloadRenderer (Universal)
                                   │
                                   │ detectPayloadProfile(payload)
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                    │
              ▼                    ▼                    ▼
       SenMLRenderer        OpcUaRenderer      PrometheusRenderer
              │                    │                    │
              │                    │                    │
   ┌──────────┴──────────┐   ┌────┴────┐      ┌───────┴───────┐
   │ payload[0]: {       │   │ PublisherId   │      │ metrics[0]:   │
   │   n: 'temperature'  │   │ Messages[0]:  │      │   name, value │
   │   v: 23.5           │   │   Payload:    │      │   type, labels│
   │   u: 'Cel'          │   │     {fields}  │      └───────────────┘
   │ }                   │   └──────────────┘
   └─────────────────────┘
```

---

## Theme Token Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          tmnlDenseDark                                   │
│                                                                          │
│   const variant = tmnlDenseDark  ← Imported from @/lib/data-grid        │
│                                                                          │
│   {                                                                      │
│     colors: {                                                            │
│       text: { primary, secondary, muted },                              │
│       signal: { accent, positive, negative, warning },                  │
│       background: { primary, secondary, hover, selected }               │
│     },                                                                   │
│     density: {                                                           │
│       rowHeight: 28,                                                     │
│       headerHeight: 32,                                                  │
│       fontSize: '12px',                                                  │
│       fontSizeXs: '10px'                                                │
│     }                                                                    │
│   }                                                                      │
└─────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
                    Used in every cell renderer:

                    style={{
                      color: variant.colors.text.muted,
                      fontSize: variant.density.fontSizeXs,
                      fontFamily: 'monospace',
                      fontVariantNumeric: 'tabular-nums'
                    }}
```

---

## Modal Integration (BaseModal Visitor Pattern)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    BaseModal Visitor Pattern                             │
└─────────────────────────────────────────────────────────────────────────┘

                      payloadInspectorVisitor
                              │
     createVisitor<PayloadInspectorData>({
       id: 'payload-inspector',
       size: 'lg',
       header: (data) => <ProfileBadge ... />,
       render: (data, { close }) => <JsonSyntaxHighlight ... />,
       footer: (data) => <SourcePath ... />
     })
                              │
                              ▼
     <Modal.Root open={modalOpen}>
       <Modal.Portal>
         <Modal.Overlay />
         <Modal.Content
           visitor={payloadInspectorVisitor}  ← Type-safe visitor
           data={modalData}                    ← PayloadInspectorData
         />
       </Modal.Portal>
     </Modal.Root>

     Click payload cell → setSelectedEvent(event) → setModalOpen(true)
```

---

## Key Files

| File | Purpose |
|------|---------|
| `RawEventsPanel.tsx:162-324` | 6 cell renderers (Timestamp, Type, Latency, CircuitState, Details, PayloadSize) |
| `RawEventsPanel.tsx:396-522` | 4 payload renderers (Universal, SenML, OpcUA, Prometheus) |
| `RawEventsPanel.tsx:565-872` | Dynamic column generators per profile |
| `RawEventsPanel.tsx:879-944` | Base columns (left + right) |
| `RawEventsPanel.tsx:82-154` | Payload inspector visitor |
| `@/lib/data-grid` | `TmnlDataGrid` wrapper + `tmnlDenseDark` variant |

---

## Cell Renderers Reference

### Core Renderers

| Renderer | Column | Purpose |
|----------|--------|---------|
| `TimestampRenderer` | Time | HH:MM:SS.mmm format with muted milliseconds |
| `TypeRenderer` | Type | Colored badge (EMIT/CB/BP/DROP) with glow dot |
| `LatencyRenderer` | Latency | Microseconds with threshold coloring (green/amber/red) |
| `CircuitStateRenderer` | CB | Circuit breaker state (closed/open/half-open) |
| `DetailsRenderer` | Details | Contextual info (failures, strategy, buffer fill) |
| `PayloadSizeRenderer` | Size | Bytes with threshold coloring |

### Payload Renderers

| Renderer | Profile | Extracts |
|----------|---------|----------|
| `SenMLRenderer` | senml | First sensor name, value, unit + count |
| `OpcUaRenderer` | opcua | Publisher ID, first field value, field count |
| `PrometheusRenderer` | prometheus | Metric name, value, type, label count |
| `PayloadRenderer` | * | Universal dispatcher based on `detectPayloadProfile()` |

---

## Payload Profile Detection

```typescript
function detectPayloadProfile(payload: unknown): PayloadProfile | null {
  // SenML: array with records containing n, v, u fields
  if (Array.isArray(payload) && payload[0]?.n !== undefined) {
    return 'senml'
  }

  // OPC-UA: object with MessageType, Messages
  if (payload?.MessageType && payload?.Messages) {
    return 'opcua'
  }

  // Prometheus: object with metrics array
  if (Array.isArray(payload?.metrics)) {
    return 'prometheus'
  }

  return null
}
```

---

## Schema-Derived Columns

Each profile generates **column groups** with semantic structure:

### SenML Columns
```
┌─────────────┬─────────────┬─────────────┬─────────────┐
│    Temp     │  Humidity   │  Pressure   │   Voltage   │
├──────┬──────┼──────┬──────┼──────┬──────┼──────┬──────┤
│Value │ Unit │Value │ Unit │Value │ Unit │Value │ Unit │
└──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┘
```

### OPC-UA Columns
```
┌─────────────────────┬─────────────────────────────────┐
│     Publisher       │        DataSet Fields           │
├──────────┬──────────┼──────────┬──────────┬───────────┤
│    ID    │  Writer  │ Temp PV  │ Pressure │  Fields   │
└──────────┴──────────┴──────────┴──────────┴───────────┘
```

### Prometheus Columns
```
┌─────────────────────────────────┬─────────────────────────────┐
│            Metric               │           Labels            │
├───────────┬──────────┬──────────┼────────┬────────┬───────────┤
│   Name    │  Value   │   Type   │ method │ status │    job    │
└───────────┴──────────┴──────────┴────────┴────────┴───────────┘
```

---

## Performance Considerations

1. **Circular Buffer**: `rawEventsAtom` caps at 1000 events to bound memory
2. **Memoized Columns**: `columnDefs` only recalculate when `payloadProfile` changes
3. **Row ID Function**: `getRowId={(params) => params.data.id}` enables efficient DOM reconciliation
4. **No Sorting**: `sortable: false` prevents expensive re-sorts on streaming data
5. **Immutable Copy**: `[...rawEvents]` creates mutable array for AG-Grid

---

## Related Documents

- `AG_GRID_THEMING_ARCHITECTURE.md` - Theme system deep dive
- `RAF_STREAM_ARCHITECTURE.md` - EmissionEngine internals
- `EFFECT_SERVICE_PATTERNS.md` - Atom-as-State pattern reference
