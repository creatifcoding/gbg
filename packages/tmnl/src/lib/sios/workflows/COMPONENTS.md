# SIOS Component Architecture

Three layers: **Primitives → Compounds → Workflows.** Each layer composes the one below it. Nothing is bespoke — every pixel on screen traces back to a primitive.

---

## Layer 0 — Primitives

Atoms. No business logic. No entity awareness. Pure visual building blocks.

### Typography

| Primitive | Props | Purpose |
|---|---|---|
| `<Label>` | `children, size?, muted?, mono?` | 10-12px uppercase mono labels. "STATUS", "CPI", "ZONE" |
| `<Value>` | `children, size?, color?, mono?` | Emphasized data display. "1.11", "$250,000", "72%" |
| `<Heading>` | `children, level: 1\|2\|3` | Section/card/panel headings |
| `<Caption>` | `children` | 11-12px explanatory text below a value or widget |
| `<Mono>` | `children` | Inline monospace span |

### Layout

| Primitive | Props | Purpose |
|---|---|---|
| `<Stack>` | `gap?, align?, children` | Vertical flex container |
| `<Row>` | `gap?, align?, justify?, wrap?, children` | Horizontal flex container |
| `<Grid>` | `cols, gap?, children` | CSS grid with column count |
| `<Panel>` | `children, border?, padding?` | Bordered surface card (the rounded rect) |
| `<Section>` | `title?, children` | Panel with optional Label heading |
| `<Divider>` | `vertical?` | Thin rule line |
| `<Spacer>` | `size?` | Fixed-height/width gap |

### Feedback

| Primitive | Props | Purpose |
|---|---|---|
| `<Dot>` | `color, pulse?, size?` | 8px colored circle. Active=cyan pulse, blocked=red static |
| `<Badge>` | `children, color, variant?: 'solid'\|'outline'\|'ghost'` | Inline pill label. "CRITICAL", "PASSED", "P1" |
| `<Toast>` | `message, severity, onDismiss` | Slide-in notification for errors/success |
| `<Tooltip>` | `content, children` | Hover-reveal text on any element |
| `<EmptyState>` | `icon?, message` | "No tasks in this column" placeholder |

### Data Display

| Primitive | Props | Purpose |
|---|---|---|
| `<Counter>` | `value, prefix?, suffix?, animate?` | Animated number. "$250,000" rolling up |
| `<BarFill>` | `value, max, color, height?` | Single horizontal progress bar |
| `<RadialGauge>` | `value, max, size, color, label?` | SVG circle gauge with center text |
| `<NeedleGauge>` | `value, min, max, thresholds[]` | Arc gauge with sweeping needle. CPI: green/amber/red |
| `<Countdown>` | `deadline, onExpire?` | Live HH:MM:SS timer, color shifts as deadline approaches |
| `<Timestamp>` | `date, relative?` | "10:42:07" or "3 minutes ago" |
| `<DiffValue>` | `planned, actual, unit?` | "180h / 200h" with amber highlight when actual > planned |

### Inputs

| Primitive | Props | Purpose |
|---|---|---|
| `<TextInput>` | `label, value, onChange, required?` | Standard text field with label |
| `<NumberInput>` | `label, value, onChange, min?, max?, step?, unit?` | Number with optional unit suffix |
| `<TextArea>` | `label, value, onChange, rows?` | Multi-line text |
| `<Select>` | `label, options[], value, onChange` | Dropdown |
| `<RadioGroup>` | `label, options[], value, onChange` | Radio buttons (pass/fail) |
| `<FileUpload>` | `label, accept?, onUpload` | Camera icon + drag target |

### Interactive

| Primitive | Props | Purpose |
|---|---|---|
| `<Button>` | `children, onClick, variant, color, disabled?, loading?` | Action trigger |
| `<IconButton>` | `icon, onClick, tooltip?, color?` | Compact icon-only button |
| `<ButtonGroup>` | `children` | Row of buttons with shared border radius |
| `<ToggleGroup>` | `options[], active, onChange` | Segmented control (filter bar buttons) |

---

## Layer 1 — Compounds

Composed of primitives. Business-aware but entity-agnostic. Reusable across workflows.

### 1.1 `<StatePipeline>` — Horizontal State Tracker

A line of dots connected by segments. Current state highlighted. Terminal states styled differently.

**Decomposition:**
```
<StatePipeline states={['bidding','awarded','mobilising',...]} current="mobilising" terminal={['complete','cancelled']}>
  ┌─────────────────────────────────────────────────────────────┐
  │  <Row gap={0}>                                              │
  │    <Dot color="green" />─── <Dot color="green" />─── ...   │  ← PipelineSegment per pair
  │    <Dot color="cyan" pulse />─── <Dot color="muted" />     │
  │  </Row>                                                     │
  │  <Row>                                                      │
  │    <Label muted>BID</Label>  <Label muted>AWD</Label> ...  │  ← Labels under dots
  │  </Row>                                                     │
  └─────────────────────────────────────────────────────────────┘
```

**Internal primitives:** `Dot`, `Label`, `Row`, + `PipelineSegment` (a styled connecting line)

---

### 1.2 `<TransitionButton>` — Graph-Aware Action Button

A single button that knows whether its transition is valid. Wraps `Button` + `Tooltip`.

```
<TransitionButton
  action="activate"
  from={currentState}
  validator={canActivate}        ← from graph validators
  onClick={() => send(action)}
  blockedReason="Must mobilise first"
>
  ┌───────────────────────┐
  │  if valid:            │
  │    <Button color="green"> ✓ Activate </Button>
  │                       │
  │  if invalid:          │
  │    <Tooltip content="Must mobilise first">
  │      <Button disabled color="red"> ✗ Activate </Button>
  │    </Tooltip>
  └───────────────────────┘
```

**Internal primitives:** `Button`, `Tooltip`

---

### 1.3 `<TransitionButtonBar>` — All Available Transitions

Renders a `TransitionButton` for every outgoing edge from the current state.

```
<TransitionButtonBar
  graph={projectGraph}
  currentState="bidding"
  validators={{ award: canAward, cancel: canCancel, activate: canActivate }}
  onTransition={(action) => ...}
>
  ┌───────────────────────────────────────────────────┐
  │  <Row gap={8}>                                    │
  │    <TransitionButton action="award" valid />      │
  │    <TransitionButton action="cancel" valid />     │
  │    <TransitionButton action="activate" invalid /> │
  │  </Row>                                           │
  └───────────────────────────────────────────────────┘
```

**Second-order compound** of `TransitionButton` instances.

**Internal:** `Row` + N × `TransitionButton`

---

### 1.4 `<TransitionLog>` — Event History

Append-only list of state changes with timestamps and success/failure indication.

```
<TransitionLog entries={logEntries}>
  ┌─────────────────────────────────────────────────────┐
  │  <Stack gap={4}>                                    │
  │    <Row>                                            │
  │      <Timestamp date={...} />                       │
  │      <Badge color="green">✓</Badge>                │
  │      <Caption>Awarded (bidding → awarded)</Caption>│
  │    </Row>                                           │
  │    <Row>                                            │
  │      <Timestamp date={...} />                       │
  │      <Badge color="red">✗</Badge>                  │
  │      <Caption>Activate BLOCKED (...)</Caption>     │
  │    </Row>                                           │
  │  </Stack>                                           │
  └─────────────────────────────────────────────────────┘
```

**Internal:** `Stack` + N × (`Row` + `Timestamp` + `Badge` + `Caption`)

---

### 1.5 `<EntityRow>` — Universal List Item

A single row in any entity list. Slots for status, title, meta, and trailing content.

```
<EntityRow
  status={<Dot color="green" />}
  title={<Heading level={3}>I/O Checkout — Panel CB-01</Heading>}
  meta={<Caption>Category: io_checkout · Inspector: R. Nguyen</Caption>}
  trailing={<Badge color="green">PASSED</Badge>}
  expandable
  detail={<CheckpointDetail ... />}
/>
  ┌───────────────────────────────────────────────────────────┐
  │  <Panel>                                                  │
  │    <Row align="center">                                   │
  │      {status}  <Stack>{title}{meta}</Stack>  {trailing}  │
  │    </Row>                                                 │
  │    {expanded && <Divider />}                              │
  │    {expanded && detail}                                   │
  │  </Panel>                                                 │
  └───────────────────────────────────────────────────────────┘
```

**Internal:** `Panel`, `Row`, `Stack`, `Divider` + slotted content

---

### 1.6 `<EntityList>` — Filterable List of EntityRows

```
<EntityList
  items={workers}
  renderRow={(worker) => <EntityRow ... />}
  filters={<ToggleGroup options={[...]} />}
  header={<Row><Heading>Crew Alpha</Heading><Value>6/8 deployable</Value></Row>}
  emptyState={<EmptyState message="No workers match filter" />}
/>
```

**Internal:** `Stack` + optional `ToggleGroup` + N × `EntityRow` + optional `EmptyState`

---

### 1.7 `<MetricCard>` — Single KPI Display

A small card showing one metric with label. Used in EVM gauges, discipline cards, KPI headers.

```
<MetricCard label="CPI" color="green">
  ┌────────────┐
  │    1.05     │  ← <Value size="xl" color="green" mono>
  │    CPI      │  ← <Label muted>
  └────────────┘
```

**Internal:** `Panel` + `Value` + `Label`

---

### 1.8 `<MetricRow>` — Horizontal KPI Strip

Multiple MetricCards in a row. The "4 gauges" pattern from WF-A.

```
<MetricRow>
  <MetricCard label="% Complete" value={40} suffix="%" />
  <MetricCard label="Earned Value" value={100000} prefix="$" />
  <MetricCard label="CPI" value={1.11} />
  <MetricCard label="Budget" badge={<Badge color="green">✓ OK</Badge>} />
</MetricRow>
```

**Internal:** `Grid cols={N}` + N × `MetricCard`

---

### 1.9 `<FormModal>` — Action Form Overlay

Modal shell with title, description, form fields, submit/cancel.

```
<FormModal title="Complete Task" onSubmit={...} onCancel={...}>
  <NumberInput label="Actual Qty" ... />
  <NumberInput label="Actual Hours" ... />
  <TextArea label="Notes" ... />
  <EvidenceField show={requiresEvidence} ... />
</FormModal>
```

**Internal:** Modal overlay + `Stack` + `Heading` + `Caption` + N × input primitives + `Button` × 2

---

### 1.10 `<EvidenceField>` — Evidence Attachment Zone

A compound within `FormModal`. Shows upload area + description + attached items.

```
<EvidenceField required evidence={[]} onAttach={...}>
  ┌─────────────────────────────────────┐
  │  <FileUpload accept="image/*" />    │
  │  <TextInput label="Description" />  │
  │  <TextInput label="Reference #" />  │
  │  <Stack>                            │
  │    {attached.map(e => <Row>         │
  │      <Mono>{e.ref}</Mono>           │
  │      <Caption>{e.desc}</Caption>    │
  │    </Row>)}                         │
  │  </Stack>                           │
  └─────────────────────────────────────┘
```

**Internal:** `FileUpload` + `TextInput` × 2 + `Stack` of attached items

---

### 1.11 `<CostVarianceBar>` — Centered Horizontal Divergence

Bar centered at zero. Green extends left (under budget), red extends right (over budget).

```
<CostVarianceBar earned={100000} actual={90000}>
  ┌──────────────────────────────────────────┐
  │  ████████████████░░░░░░░░░               │
  │  AC: $90K    EV: $100K    CV: +$10K ✓    │
  └──────────────────────────────────────────┘
```

**Internal:** `BarFill` (custom centered variant) + `Row` of `Value` + `Label` pairs

---

## Layer 2 — Workflow

### What IS a Workflow Component?

A workflow is a **stateful orchestrator**. It:

1. **Boots machines** — calls `Machine.boot()` for the entities it needs
2. **Seeds initial state** — creates entities via `actor.send(InternalCreate*)` on mount
3. **Provides actor context** — exposes `send` functions to child compounds
4. **Declares layout** — composes compounds into a page-level arrangement
5. **Manages modal state** — tracks which FormModal is open, with what context

A workflow is NOT:
- A route (the route renders the workflow, but the workflow doesn't know about routing)
- A dump of entity data (it orchestrates interactions, not displays)
- A bespoke UI (it composes shared compounds, with entity-specific configuration)

### Workflow Contract

```tsx
interface WorkflowProps {
  /** Pre-seeded entities, or seed on mount */
  seed?: SeedData
  /** Optional: pre-booted actors (for testing) */
  actors?: ActorMap
}

function EVMWarRoom({ seed }: WorkflowProps) {
  // 1. Boot machines
  const wpActor = useStateMachine(makeWorkPackageMachine)
  const taskActor = useStateMachine(makeTaskMachine)

  // 2. Seed on mount
  useEffect(() => {
    wpActor.send(new InternalCreateWP({ params: seed.wp }))
    seed.tasks.forEach(t => taskActor.send(new InternalCreateTask({ params: t })))
  }, [])

  // 3. Reactive state
  const wp = useAtomValue(wpAtom)           // WorkPackage instance
  const tasks = useAtomValue(tasksAtom)      // Task[]

  // 4. Modal state
  const [modal, setModal] = useState<ModalState>(null)

  // 5. Layout — pure composition of compounds
  return (
    <Stack gap={24}>
      <Section title="Belt Conveyor Installation — Zone A">
        <MetricRow>
          <MetricCard label="% Complete" value={wp.percentComplete()} suffix="%" />
          <MetricCard label="Earned Value" value={wp.earnedValue()} prefix="$" />
          <MetricCard label="CPI" value={wp.cpi()} />
          <MetricCard label="Budget" badge={
            <Badge color={wp.isOverBudget() ? 'red' : 'green'}>
              {wp.isOverBudget() ? '⚠ Over' : '✓ OK'}
            </Badge>
          } />
        </MetricRow>
      </Section>

      <Section title="Tasks">
        <EntityList
          items={tasks}
          renderRow={(task) => (
            <EntityRow
              status={<Dot color={taskStatusColor(task.status)} />}
              title={<Heading level={3}>{task.title}</Heading>}
              meta={<DiffValue planned={task.plannedHours} actual={task.actualHours} unit="h" />}
              trailing={<Badge color={taskStatusColor(task.status)}>{task.status}</Badge>}
            >
              <Button
                color="cyan"
                onClick={() => setModal({ type: 'completeTask', taskId: task.id })}
                disabled={task.status !== 'active'}
              >
                Complete Task ▶
              </Button>
            </EntityRow>
          )}
        />
      </Section>

      {modal?.type === 'completeTask' && (
        <FormModal title="Complete Task" onSubmit={handleComplete} onCancel={() => setModal(null)}>
          <NumberInput label="Actual Qty" ... />
          <NumberInput label="Actual Hours" ... />
          <NumberInput label="Cost" ... />
        </FormModal>
      )}
    </Stack>
  )
}
```

### What Each Workflow Declares (and nothing more)

| Concern | Who Owns It |
|---|---|
| Which machines to boot | Workflow |
| What seed data to load | Workflow |
| Page layout (which sections, what order) | Workflow |
| Which compounds to compose | Workflow |
| Entity-specific prop mapping (task → EntityRow slots) | Workflow |
| Modal triggers and handlers | Workflow |
| Everything else (rendering, animation, state, styling) | Compounds + Primitives |

---

## Second-Order Compound Map

Some compounds contain other compounds:

```
TransitionButtonBar
  └── N × TransitionButton
        └── Button + Tooltip

MetricRow
  └── Grid
        └── N × MetricCard
              └── Panel + Value + Label

EntityList
  └── Stack
        ├── ToggleGroup (FilterBar)
        │     └── N × Button (toggle variant)
        ├── N × EntityRow
        │     └── Panel + Row + Dot + Heading + Caption + Badge
        │           └── optional Detail (compound slot)
        └── EmptyState

FormModal
  └── Modal overlay
        ├── Heading + Caption
        ├── Stack of input primitives
        │     └── NumberInput, TextInput, TextArea, Select, RadioGroup
        ├── optional EvidenceField
        │     └── FileUpload + TextInput × 2 + Stack
        └── Row of Button × 2 (Submit + Cancel)

StatePipeline
  └── Row
        └── N × PipelineNode
              └── Dot + Label + PipelineSegment (line)
```

---

## Full Primitive Count

| Category | Count | Primitives |
|---|---|---|
| Typography | 5 | Label, Value, Heading, Caption, Mono |
| Layout | 6 | Stack, Row, Grid, Panel, Section, Divider |
| Feedback | 5 | Dot, Badge, Toast, Tooltip, EmptyState |
| Data Display | 7 | Counter, BarFill, RadialGauge, NeedleGauge, Countdown, Timestamp, DiffValue |
| Inputs | 6 | TextInput, NumberInput, TextArea, Select, RadioGroup, FileUpload |
| Interactive | 4 | Button, IconButton, ButtonGroup, ToggleGroup |
| **Total** | **33** | |

## Full Compound Count

| Compound | Contains | Used In |
|---|---|---|
| StatePipeline | Dot, Label, Row, PipelineSegment | B, D, E |
| TransitionButton | Button, Tooltip | B, C, D, E, F, G |
| TransitionButtonBar | TransitionButton[] | B, C, D, F |
| TransitionLog | Timestamp, Badge, Caption, Stack | B |
| EntityRow | Panel, Row, Dot, Heading, Caption, Badge, Divider | C, D, E, F, G, H |
| EntityList | Stack, ToggleGroup, EntityRow[], EmptyState | C, D, E, F, G, H |
| MetricCard | Panel, Value, Label | A, H |
| MetricRow | Grid, MetricCard[] | A, H |
| FormModal | Heading, Caption, inputs, Button[] | All |
| EvidenceField | FileUpload, TextInput[], Stack | C, D, G |
| CostVarianceBar | BarFill, Value, Label | A |
| **Total** | **11** | |
