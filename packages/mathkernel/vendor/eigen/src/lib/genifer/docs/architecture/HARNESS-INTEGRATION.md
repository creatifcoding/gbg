# Genifer ↔ Harness Integration Architecture

> Full architecture for making genifer a first-class tool in the pi harness.
> Streaming incremental preview inline in chat. Custom atoms. New event types.

## Decision Record

| # | Question | Decision |
|---|----------|----------|
| D1 | Entry point | Hybrid: `ToolDefinition` (SDK blessed path) + `GeniferHarnessService` (state/streaming) |
| D2 | LLM result shape | Summary text + full UITree in `TDetails` — LLM has tools to act on repos |
| D3 | Rendering | Streaming incremental preview, inline in chat thread, seamless |
| D4 | Event architecture | New event types alongside existing HarnessEvents |
| D5 | State management | Custom effect-atom atoms (Atom-as-State pattern) |
| D6 | Scope | Full architecture: tool + schemas + streaming + atoms + rendering |

---

## Architecture Overview

```
┌────────────────────────────────────────────────────────────────────┐
│                         LLM (Claude/GPT)                           │
│   "Generate a project status dashboard with search"                │
│                              │                                     │
│                    tool_call: genifer_generate                      │
└──────────────────────────────┼─────────────────────────────────────┘
                               │
                               ▼
┌────────────────────────────────────────────────────────────────────┐
│                    ToolDefinition Layer                             │
│                                                                    │
│  genifer_generate    genifer_refine    genifer_query                │
│  ┌──────────────┐   ┌─────────────┐   ┌─────────────────┐        │
│  │ TypeBox params│   │ TypeBox parms│   │ TypeBox params   │        │
│  │ prompt, style │   │ treeId,     │   │ operation, args  │        │
│  │ threadId      │   │ instruction │   │                  │        │
│  └──────┬───────┘   └──────┬──────┘   └────────┬────────┘        │
└─────────┼──────────────────┼───────────────────┼──────────────────┘
          │                  │                   │
          ▼                  ▼                   ▼
┌────────────────────────────────────────────────────────────────────┐
│                   GeniferHarnessService                            │
│                   (Effect.Service + Atoms)                         │
│                                                                    │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ Atoms (Atom-as-State)                                        │  │
│  │                                                               │  │
│  │  activeGenerationAtom   → { prompt, treeId, status, model }  │  │
│  │  currentTreeAtom        → UITree | null                      │  │
│  │  streamDeltasAtom       → GeniferStreamDelta[]               │  │
│  │  qualityMetricsAtom     → { score, elements, repairs, ms }   │  │
│  │  threadHistoryAtom      → TreeSummary[]                      │  │
│  │  catalogContextAtom     → { available, recent, top }         │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ Operations                                                    │  │
│  │                                                               │  │
│  │  generate(prompt, opts) → streams deltas → final UITree      │  │
│  │  refine(treeId, instruction) → streams deltas → updated tree │  │
│  │  query(op, args) → delegates to GeniferService repos         │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                               │                                    │
│                    ┌──────────┼──────────┐                        │
│                    ▼          ▼          ▼                         │
│              ai-adapter   pipeline   GeniferService                │
│              (LLM call)   (normalize  (persistence)               │
│                            + repair)                               │
└────────────────────────────────────────────────────────────────────┘
                               │
                    Event emission (new types)
                               │
                               ▼
┌────────────────────────────────────────────────────────────────────┐
│                   Harness Event Bus                                │
│                                                                    │
│  Existing:                    New (genifer):                       │
│  HarnessAssistantDeltaEvent   GeniferGenerateStartEvent            │
│  HarnessToolEvent             GeniferStreamDeltaEvent              │
│  HarnessUsageEvent            GeniferElementIdentifiedEvent        │
│  HarnessErrorEvent            GeniferNormalizeEvent                │
│                               GeniferRepairEvent                   │
│                               GeniferGenerateCompleteEvent         │
│                               GeniferRefineStartEvent              │
│                               GeniferRefineCompleteEvent           │
│                               GeniferQualityEvent                  │
└──────────────────────────────┼─────────────────────────────────────┘
                               │
                               ▼
┌────────────────────────────────────────────────────────────────────┐
│                Frontend (Chat Thread Rendering)                    │
│                                                                    │
│  ┌──────────────────────────────────────────┐                     │
│  │ User: "Generate a dashboard"              │                     │
│  ├──────────────────────────────────────────┤                     │
│  │ [genifer_generate] Generating...          │                     │
│  │ ┌──────────────────────────────────┐     │ ← streaming delta  │
│  │ │ VStack                           │     │    updates this     │
│  │ │ ├─ Heading: "Dashboard"          │     │    incrementally    │
│  │ │ ├─ SearchBar                     │     │                     │
│  │ │ ├─ Grid (2 cols)                 │     │                     │
│  │ │ │  ├─ Card: "Users"             │     │                     │
│  │ │ │  └─ Card: "Revenue"           │     │                     │
│  │ │ └─ ...streaming...              │     │                     │
│  │ └──────────────────────────────────┘     │                     │
│  │ Quality: 100% │ 31 elements │ 0 repairs  │                     │
│  │ Model: sonnet-4 │ 17s │ Thread: abc123   │                     │
│  ├──────────────────────────────────────────┤                     │
│  │ Assistant: "I've generated a dashboard    │                     │
│  │ with search, user count, and revenue..."  │                     │
│  └──────────────────────────────────────────┘                     │
└────────────────────────────────────────────────────────────────────┘
```

---

## Layer 1: Schema.Class Event Types

New event types that flow alongside existing `HarnessEvent` variants.
All use `Schema.TaggedClass` for discriminated unions with methods.

```typescript
// ── Generation Lifecycle ──

class GeniferGenerateStartEvent extends Schema.TaggedClass<...>()(
  'GeniferGenerateStartEvent', {
    seq: Schema.Number,
    sessionId: Schema.String,
    toolCallId: Schema.String,
    prompt: Schema.String,
    threadId: Schema.NullOr(Schema.String),
    model: Schema.String,
    timestamp: Schema.Number,
  }
) {}

class GeniferStreamDeltaEvent extends Schema.TaggedClass<...>()(
  'GeniferStreamDeltaEvent', {
    seq: Schema.Number,
    sessionId: Schema.String,
    toolCallId: Schema.String,
    // Incremental element identification
    elementKey: Schema.String,
    elementType: Schema.String,
    parentKey: Schema.NullOr(Schema.String),
    depth: Schema.Number,
    // Pipeline stage
    stage: Schema.Literal('identified', 'normalized', 'repaired'),
    timestamp: Schema.Number,
  }
) {
  get isRepaired() { return this.stage === 'repaired' }
}

class GeniferGenerateCompleteEvent extends Schema.TaggedClass<...>()(
  'GeniferGenerateCompleteEvent', {
    seq: Schema.Number,
    sessionId: Schema.String,
    toolCallId: Schema.String,
    treeId: Schema.NullOr(Schema.String),  // null if not persisted
    elementCount: Schema.Number,
    qualityScore: Schema.Number,
    repairCount: Schema.Number,
    durationMs: Schema.Number,
    model: Schema.String,
    threadId: Schema.NullOr(Schema.String),
    timestamp: Schema.Number,
  }
) {
  get isPerfect() { return this.qualityScore >= 1.0 && this.repairCount === 0 }
}

// ── Refinement Lifecycle ──

class GeniferRefineStartEvent extends Schema.TaggedClass<...>()(
  'GeniferRefineStartEvent', {
    seq: Schema.Number,
    sessionId: Schema.String,
    toolCallId: Schema.String,
    sourceTreeId: Schema.String,
    instruction: Schema.String,
    model: Schema.String,
    timestamp: Schema.Number,
  }
) {}

class GeniferRefineCompleteEvent extends Schema.TaggedClass<...>()(
  'GeniferRefineCompleteEvent', {
    seq: Schema.Number,
    sessionId: Schema.String,
    toolCallId: Schema.String,
    sourceTreeId: Schema.String,
    resultTreeId: Schema.NullOr(Schema.String),
    elementCount: Schema.Number,
    qualityScore: Schema.Number,
    durationMs: Schema.Number,
    timestamp: Schema.Number,
  }
) {}

// ── Quality Signal ──

class GeniferQualityEvent extends Schema.TaggedClass<...>()(
  'GeniferQualityEvent', {
    seq: Schema.Number,
    sessionId: Schema.String,
    treeId: Schema.String,
    pipelineScore: Schema.Number,
    humanRating: Schema.NullOr(Schema.Number),
    usageCount: Schema.Number,
    timestamp: Schema.Number,
  }
) {
  /** Composite score (40/30/30 formula) */
  get compositeScore() {
    const human = this.humanRating ?? this.pipelineScore
    return 0.4 * this.pipelineScore + 0.3 * (human / 5) + 0.3 * Math.min(this.usageCount / 10, 1)
  }
}
```

Union type for the bus:
```typescript
const GeniferEvent = Schema.Union(
  GeniferGenerateStartEvent,
  GeniferStreamDeltaEvent,
  GeniferGenerateCompleteEvent,
  GeniferRefineStartEvent,
  GeniferRefineCompleteEvent,
  GeniferQualityEvent,
)
type GeniferEvent = typeof GeniferEvent.Type
```

---

## Layer 2: ToolDefinitions (TypeBox)

Three tools exposed to the LLM:

### `genifer_generate` — Create UI from prompt
```typescript
const geniferGenerateParams = Type.Object({
  prompt: Type.String({ description: 'Natural language description of the UI to generate' }),
  threadId: Type.Optional(Type.String({ description: 'Conversation thread ID for context continuity' })),
  rootClassName: Type.Optional(Type.String({ description: 'Tailwind className for the root element' })),
  persist: Type.Optional(Type.Boolean({ description: 'Save to database (default: true)' })),
})
```

### `genifer_refine` — Modify existing tree
```typescript
const geniferRefineParams = Type.Object({
  treeId: Type.String({ description: 'ID of the tree to refine' }),
  instruction: Type.String({ description: 'What to change (e.g., "add a search bar")' }),
  persist: Type.Optional(Type.Boolean({ description: 'Save refined tree (default: true)' })),
})
```

### `genifer_query` — Read/search/rate persisted trees and composites
```typescript
const geniferQueryParams = Type.Object({
  operation: Type.Union([
    Type.Literal('list_recent'),
    Type.Literal('list_by_quality'),
    Type.Literal('list_by_thread'),
    Type.Literal('get_tree'),
    Type.Literal('rate_tree'),
    Type.Literal('list_composites'),
    Type.Literal('top_composites'),
    Type.Literal('rate_composite'),
    Type.Literal('get_signals'),
  ], { description: 'Query operation to perform' }),
  args: Type.Optional(Type.Record(Type.String(), Type.Unknown(), {
    description: 'Operation-specific arguments (treeId, rating, limit, etc.)',
  })),
})
```

---

## Layer 3: GeniferHarnessService (Effect.Service + Atoms)

### Atoms (Atom-as-State pattern)

```typescript
// Active generation state
const activeGenerationAtom = Atom.make<{
  toolCallId: string
  prompt: string
  status: 'generating' | 'normalizing' | 'complete' | 'error'
  model: string
  startedAt: number
} | null>(null)

// Current tree (latest generation/refinement result)
const currentTreeAtom = Atom.make<UITree | null>(null)

// Streaming deltas — incremental element discovery
const streamDeltasAtom = Atom.make<readonly GeniferStreamDeltaEvent[]>([])

// Quality metrics for current tree
const qualityMetricsAtom = Atom.make<{
  score: number
  elementCount: number
  repairCount: number
  durationMs: number
  model: string
} | null>(null)

// Thread history (previous generations in conversation)
const threadHistoryAtom = Atom.make<readonly TreeSummary[]>([])

// Catalog context (for LLM prompt enrichment)
const catalogContextAtom = Atom.make<{
  availableTypes: readonly string[]
  recentComposites: readonly string[]
  topComposites: readonly string[]
} | null>(null)

// Persisted tree IDs in this session (for query tool)
const sessionTreeIdsAtom = Atom.make<readonly string[]>([])
```

### Service Shape

```typescript
class GeniferHarnessService extends Effect.Service<GeniferHarnessService>()(
  'genifer/GeniferHarnessService',
  {
    effect: Effect.gen(function* () {
      const geniferService = yield* GeniferService
      const catalogService = yield* CatalogService

      return {
        // Generation: prompt → stream deltas → UITree → persist
        generate(prompt, opts): Effect<GenerateResult, GeniferHarnessError>

        // Refinement: treeId + instruction → stream deltas → updated UITree
        refine(treeId, instruction, opts): Effect<RefineResult, GeniferHarnessError>

        // Query: delegates to GeniferService
        query(operation, args): Effect<QueryResult, GeniferHarnessError>

        // Atom accessors
        atoms: {
          activeGeneration: typeof activeGenerationAtom
          currentTree: typeof currentTreeAtom
          streamDeltas: typeof streamDeltasAtom
          qualityMetrics: typeof qualityMetricsAtom
          threadHistory: typeof threadHistoryAtom
          catalogContext: typeof catalogContextAtom
          sessionTreeIds: typeof sessionTreeIdsAtom
        }
      }
    })
  }
)
```

---

## Layer 4: ToolDefinition ↔ Service Bridge

The `execute()` function in each `ToolDefinition` bridges to `GeniferHarnessService`:

```typescript
async execute(callId, params, signal, onUpdate, ctx) {
  // 1. Update activeGenerationAtom → { status: 'generating', ... }
  // 2. Emit GeniferGenerateStartEvent
  // 3. Call geniferHarnessService.generate(prompt, opts)
  //    - Pipeline streams → emit GeniferStreamDeltaEvent per element
  //    - onUpdate() pushes incremental tool result for TUI
  // 4. On complete:
  //    - Update currentTreeAtom
  //    - Update qualityMetricsAtom
  //    - Emit GeniferGenerateCompleteEvent
  //    - Optionally persist via GeniferService.saveTree
  //    - Update sessionTreeIdsAtom
  // 5. Return { content: summary, details: { tree, treeId, quality, ... } }
}
```

The `onUpdate` callback is KEY for streaming:

```typescript
// SDK's AgentToolUpdateCallback signature:
type AgentToolUpdateCallback<TDetails> = (partial: {
  content: Array<{ type: string; text: string }>
  details?: TDetails
}) => void

// We call onUpdate() with progressive text + tree snapshot in details:
onUpdate({
  content: [{ type: 'text', text: `Generating... ${elementCount} elements identified` }],
  details: {
    stage: 'streaming',
    elements: currentElements,  // partial tree snapshot
    elementCount,
  }
})
```

---

## Layer 5: Rendering (Chat Thread Integration)

The streaming preview renders inline in the chat thread.

**Text rendering** (via `renderResult`):
```
┌─ genifer_generate ─────────────────────────┐
│ VStack (p-8 bg-gray-900)                   │
│ ├─ Heading: "Dashboard"                    │
│ ├─ SearchBar                               │
│ ├─ Grid (2 cols, gap-4)                    │
│ │  ├─ Card: "Users"                        │
│ │  └─ Card: "Revenue"                      │
│ └─ StatusBar                               │
│                                             │
│ ✓ 31 elements │ 100% quality │ 0 repairs   │
│ sonnet-4 │ 17s │ tree: abc-123              │
└─────────────────────────────────────────────┘
```

**Streaming rendering** (via `onUpdate` progressive):
```
┌─ genifer_generate ─────────────────────────┐
│ ░░░ Generating... 12/~30 elements          │  ← updates live
│ VStack                                      │
│ ├─ Heading: "Dashboard"                    │
│ ├─ SearchBar ← just identified             │  ← new elements pulse
│ └─ ...streaming...                         │
└─────────────────────────────────────────────┘
```

---

## File Inventory

```
src/lib/genifer/harness/
├── index.ts                      # Barrel exports
├── schemas.ts                    # GeniferEvent union + all Schema.TaggedClass events
├── tools.ts                      # ToolDefinition factories (generate, refine, query)
├── GeniferHarnessService.ts      # Effect.Service with atoms + operations
├── atoms.ts                      # All genifer harness atoms (Atom-as-State)
└── bridge.ts                     # ToolDefinition.execute ↔ service bridge

src/lib/harness/
├── PiAiToolRuntimeBuiltins.ts    # MODIFIED: inject genifer tools alongside SDK builtins
├── schemas.ts                    # MODIFIED: add GeniferEvent to HarnessEvent union
└── PiAiHarnessEngine.ts          # MODIFIED: emit genifer events on event bus
```

---

## Dependency Graph

```
ToolDefinition (TypeBox)
    │
    ▼
GeniferHarnessService (Effect.Service)
    │
    ├── GeniferService (persistence — repos)
    ├── CatalogService (component catalog)
    ├── PromptCompiler (prompt enrichment)
    ├── Pipeline (normalize + repair)
    └── Atoms (effect-atom state)
         │
         ▼
    Harness Event Bus (PubSub)
         │
         ▼
    Frontend Chat Thread
```

---

---

## Layer 6: Multi-Surface Management

Each genifer output in the chat thread is a **Surface** — an independent, hydrated, interactive render tree. Multiple surfaces coexist in one conversation.

```
Chat Thread
┌──────────────────────────────────────────────────────┐
│ User: "Build me a dashboard"                          │
│                                                        │
│ ┌─ Surface #1 (tree: abc-123) ─────────────────────┐ │
│ │ Dashboard                                          │ │
│ │ ├─ SearchBar [value: ""]  ← bidirectional         │ │
│ │ ├─ Grid                                            │ │
│ │ │  ├─ MetricCard [dataSource: userCountAtom] ←live│ │
│ │ │  └─ MetricCard [dataSource: revenueAtom]   ←live│ │
│ │ └─ StatusBar                                       │ │
│ │ ✓ 31 elements │ 100% │ thread: xyz                │ │
│ └────────────────────────────────────────────────────┘ │
│                                                        │
│ User: "Now add a settings panel"                       │
│                                                        │
│ ┌─ Surface #2 (tree: def-456) ─────────────────────┐ │
│ │ SettingsPanel                                      │ │
│ │ ├─ Toggle [dataSource: darkModeAtom] ← bidir     │ │
│ │ ├─ Slider [dataSource: refreshRateAtom] ← bidir  │ │
│ │ └─ Button [onClick: saveSettingsAction] ← action  │ │
│ │ ✓ 8 elements │ 100% │ thread: xyz                 │ │
│ └────────────────────────────────────────────────────┘ │
│                                                        │
│ User: "Refine surface 1 — add a date filter"          │
│                                                        │
│ ┌─ Surface #1v2 (tree: abc-789, refined) ──────────┐ │
│ │ Dashboard                                          │ │
│ │ ├─ DateFilter [dataSource: dateRangeAtom] ← NEW  │ │
│ │ ├─ SearchBar [value: ""]                           │ │
│ │ ├─ Grid (filtered by dateRange) ← reactive        │ │
│ │ │  ├─ MetricCard [dataSource: userCountAtom]      │ │
│ │ │  └─ MetricCard [dataSource: revenueAtom]        │ │
│ │ └─ StatusBar                                       │ │
│ │ ✓ 35 elements │ 100% │ refined from abc-123       │ │
│ └────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

### Surface Registry

```typescript
class GeniferSurface extends Schema.TaggedClass<GeniferSurface>()('GeniferSurface', {
  /** Unique surface ID (maps to tree ID after persistence) */
  id: Schema.String,
  /** Tree ID in database (null until persisted) */
  treeId: Schema.NullOr(Schema.String),
  /** Thread this surface belongs to */
  threadId: Schema.String,
  /** The UITree */
  tree: UITree,               // ← live, mutable via interactable
  /** Version (increments on refine) */
  version: Schema.Number,
  /** Parent surface ID (if refined from another) */
  parentSurfaceId: Schema.NullOr(Schema.String),
  /** Active data source bindings */
  dataBindings: Schema.Record({ key: Schema.String, value: DataSourceBinding }),
  /** Quality metadata */
  quality: Schema.Struct({
    score: Schema.Number,
    elementCount: Schema.Number,
    repairCount: Schema.Number,
    model: Schema.String,
    durationMs: Schema.Number,
  }),
  /** Creation timestamp */
  createdAt: Schema.Number,
}) {
  get isRefinement() { return this.parentSurfaceId !== null }
  get isPersisted() { return this.treeId !== null }
}

// Atom: all active surfaces in the thread
const surfaceRegistryAtom = Atom.make<ReadonlyMap<string, GeniferSurface>>(new Map())
```

---

## Layer 7: DataSource Bindings (Hydration)

Progressive binding model: mock → live → persistent.

### DataSourceBinding Schema

```typescript
const DataSourceType = Schema.Literal(
  'static',    // Inline value from LLM (mock data)
  'atom',      // Live atom binding (real-time)
  'query',     // Effect query (async, cached)
  'rpc',       // RPC call (on-demand)
)

class DataSourceBinding extends Schema.TaggedClass<DataSourceBinding>()('DataSourceBinding', {
  /** Which type of data source */
  type: DataSourceType,
  /** For atom: atom key/path. For query: query name. For rpc: rpc tag. */
  key: Schema.String,
  /** For static: the inline value */
  staticValue: Schema.optional(Schema.Unknown),
  /** Transform: optional transform expression applied after fetch */
  transform: Schema.optional(Schema.String),
  /** Refresh interval for query/rpc sources (ms, 0 = once) */
  refreshMs: Schema.optional(Schema.Number),
}) {
  get isLive() { return this.type !== 'static' }
}
```

### Hydration Flow

```
LLM generates:
  Card { title: "Users", dataSource: { type: "static", key: "users", staticValue: 1234 } }
                         ↓
User promotes to live:
  Card { title: "Users", dataSource: { type: "atom", key: "iiot/userCountAtom" } }
                         ↓
Persisted tree stores binding:
  genifer.elements row: data_source = '{"type":"atom","key":"iiot/userCountAtom"}'
                         ↓
Rehydrated from DB:
  Card renders → resolves atom → shows real-time value
```

### DataSource Resolver

```typescript
class DataSourceResolver extends Effect.Service<DataSourceResolver>()(
  'genifer/DataSourceResolver', {
    effect: Effect.gen(function* () {
      return {
        resolve(binding: DataSourceBinding): Effect<unknown, DataSourceError> {
          switch (binding.type) {
            case 'static': return Effect.succeed(binding.staticValue)
            case 'atom':   return resolveAtomBinding(binding.key)
            case 'query':  return resolveQueryBinding(binding.key)
            case 'rpc':    return resolveRpcBinding(binding.key)
          }
        },

        subscribe(binding: DataSourceBinding): Stream<unknown, DataSourceError> {
          // For atom bindings: returns reactive stream of value changes
          // For query: polls at refreshMs interval
          // For rpc: on-demand, no subscription
          // For static: Stream.make(binding.staticValue)
        }
      }
    })
  }
)
```

---

## Layer 8: Bidirectional Interaction (via Interactable)

Already built: `InteractableElement` + `StateSyncService` + `StateChange` events.

The harness integration adds:

### Action Bindings

```typescript
class ActionBinding extends Schema.TaggedClass<ActionBinding>()('ActionBinding', {
  /** Action type */
  type: Schema.Literal('setState', 'emitEvent', 'callRpc', 'navigate'),
  /** Target: atom key, event name, rpc tag, or URL */
  target: Schema.String,
  /** Payload template ({{fieldName}} interpolation from element state) */
  payload: Schema.optional(Schema.Unknown),
}) {}
```

Example in generated tree:
```json
{
  "type": "Button",
  "key": "save-btn",
  "props": { "label": "Save Settings" },
  "actions": {
    "onClick": {
      "type": "callRpc",
      "target": "genifer/GeniferService.upsertComposite",
      "payload": { "name": "{{parentState.name}}", "template": "{{parentState.template}}" }
    }
  }
}
```

### State Change → Service Bridge

```
User drags slider
  → StateSyncService.setField('gain-slider', 'value', -12, 'user')
    → StateChange event logged
      → If dataSource binding exists:
          → DataSourceResolver writes back to atom/rpc
            → iiot service receives new value
              → Other surfaces with same binding update reactively
```

---

## Updated File Inventory

```
src/lib/genifer/harness/
├── index.ts                       # Barrel exports
├── schemas.ts                     # GeniferEvent union + Schema.TaggedClass events
├── surface.ts                     # GeniferSurface + SurfaceRegistry + DataSourceBinding
├── tools.ts                       # ToolDefinition factories (generate, refine, query)
├── GeniferHarnessService.ts       # Effect.Service: orchestrates everything
├── DataSourceResolver.ts          # Resolve/subscribe to data bindings
├── atoms.ts                       # All harness atoms (surfaces, generation, quality, etc.)
└── bridge.ts                      # ToolDefinition.execute ↔ service bridge

src/lib/genifer/core/
├── interactable.ts                # EXISTING: InteractableElement, StateChange, etc.
├── schemas.ts                     # MODIFIED: add DataSourceBinding, ActionBinding to UIElement

src/lib/genifer/react/
├── state-sync.ts                  # EXISTING: StateSyncService (bidirectional state)
├── SurfaceRenderer.tsx            # NEW: renders a single surface inline in thread
├── SurfaceProvider.tsx            # NEW: React context for surface-scoped state + data
└── useDataSource.ts               # NEW: hook to resolve DataSourceBinding in components

src/lib/harness/
├── PiAiToolRuntimeBuiltins.ts     # MODIFIED: inject genifer tools
├── schemas.ts                     # MODIFIED: add GeniferEvent to HarnessEvent union
└── PiAiHarnessEngine.ts           # MODIFIED: emit genifer events on bus
```

---

## Implementation Order

1. **Schemas** — GeniferEvent types, DataSourceBinding, ActionBinding, GeniferSurface
2. **Atoms** — Surface registry, active generation, stream deltas, quality, catalog context
3. **DataSourceResolver** — Static + atom + query + rpc resolution and subscription
4. **GeniferHarnessService** — Effect.Service orchestrating generate/refine/query with surfaces
5. **ToolDefinitions** — TypeBox params, execute bridge with streaming onUpdate
6. **Harness wiring** — Inject tools, extend event union, emit genifer events
7. **Surface rendering** — SurfaceRenderer, SurfaceProvider, useDataSource
8. **Bidirectional wiring** — StateChange → DataSourceResolver writeback, cross-surface reactivity
