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

## Implementation Order

1. **Schemas** — `GeniferEvent` types with `Schema.TaggedClass` + methods
2. **Atoms** — All 7 atoms (activeGeneration, currentTree, streamDeltas, etc.)
3. **GeniferHarnessService** — Effect.Service wiring atoms + GeniferService + pipeline
4. **ToolDefinitions** — TypeBox params + execute bridge
5. **Harness modifications** — Inject tools, emit events, extend event union
6. **Rendering** — Tree preview component for chat thread (TUI + frontend)
