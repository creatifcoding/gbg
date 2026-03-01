# Genifer Runtime Metaprogramming Layer

## The Insight

Genifer doesn't just generate UI. It generates **behavior**. The full stack:

```
prompt → UI tree + ActionGroup wiring + custom events + dynamic RPCs + tool registrations + renderers
```

This makes genifer a **runtime metaprogramming layer** — it synthesizes new capabilities on the fly. The LLM generates a surface that *extends the system's own capabilities*.

## Five Capabilities

### 1. Interactive Questionnaire Pattern

The existing pi questionnaire system (`questionnaire` tool) uses:
- spec → branching flow → results

Genifer should be able to generate questionnaire-grade interactive flows as surfaces. Not calling the `questionnaire` tool — generating the *equivalent* inline:

```
ActionGroup "intake-form" {
  state: { step: 1, answers: {}, complete: false }
  actions: {
    next:  setState → step + 1 (with conditional branching)
    back:  setState → step - 1
    submit: callRpc → "genifer/saveQuestionnaireResult"
    branch: setState → conditionally set step based on answer
  }
}
├── Form
│   ├── [step=1] FormField "What area?" → Select (frontend/backend/infra)
│   ├── [step=2, if=frontend] FormField "Which framework?" → Select
│   ├── [step=2, if=backend] FormField "Which language?" → Select
│   ├── [step=3] FormField "Details" → Textarea
│   └── [step=4] InfoCard (review answers)
├── HStack
│   ├── Button "Back" (action: @action:back, disabled: step === 1)
│   ├── Progress (value: step/totalSteps * 100)
│   └── Button "Next" / "Submit" (action: @action:next or @action:submit)
```

**Conditional visibility**: Elements have a `visibleWhen` prop — expression evaluated against ActionGroup state. The renderer shows/hides based on current state.

```typescript
// New UIElement prop
visibleWhen?: string  // "@state:step === 2 && @state:answers.area === 'frontend'"
```

### 2. Dynamic RPC Registration

The LLM generates an ActionGroup that references RPCs that don't exist yet. The system creates them at runtime.

#### DynamicRpcService

```typescript
import { Context, Effect, Layer, Schema } from 'effect'
import { Rpc, RpcGroup } from '@effect/rpc'

/**
 * Dynamic RPC registration at runtime.
 *
 * When the LLM generates:
 *   { type: "callRpc", target: "dynamic/SearchFlights", payload: { query: "..." } }
 *
 * And "dynamic/SearchFlights" doesn't exist yet, the system:
 *   1. Creates an Rpc definition from the payload/success schemas
 *   2. Registers a handler (which bridges to an external API, Effect service, or LLM)
 *   3. Makes it available for future ActionGroup references
 *
 * Think: Rpc.make() at runtime, Schema from JSON Schema at runtime.
 */
export interface DynamicRpcOps {
  /** Define a new RPC at runtime */
  readonly define: (spec: DynamicRpcSpec) => Effect.Effect<void>
  
  /** Call a dynamic RPC */
  readonly call: (tag: string, payload: unknown) => Effect.Effect<unknown>
  
  /** List all registered dynamic RPCs */
  readonly list: () => Effect.Effect<ReadonlyArray<DynamicRpcSpec>>
  
  /** Check if a dynamic RPC exists */
  readonly has: (tag: string) => Effect.Effect<boolean>
}

export class DynamicRpcService extends Context.Tag('genifer/DynamicRpcService')<
  DynamicRpcService,
  DynamicRpcOps
>() {}

/**
 * What a dynamic RPC looks like:
 */
export interface DynamicRpcSpec {
  /** Tag — e.g., "opensky/SearchFlights" */
  readonly tag: string
  /** Human description (for LLM context) */
  readonly description: string
  /** JSON Schema for payload */
  readonly payloadSchema: Record<string, unknown>
  /** JSON Schema for success response */
  readonly successSchema: Record<string, unknown>
  /** Handler type */
  readonly handler: DynamicRpcHandler
}

export type DynamicRpcHandler =
  /** Bridge to an external HTTP API */
  | { readonly _tag: 'http'; readonly url: string; readonly method: string; readonly headers?: Record<string, string> }
  /** Bridge to an existing Effect service method */
  | { readonly _tag: 'service'; readonly serviceTag: string; readonly method: string }
  /** Ask the LLM to handle it (agentic) */
  | { readonly _tag: 'llm'; readonly systemPrompt: string }
  /** Run a script/command */
  | { readonly _tag: 'script'; readonly command: string }
  /** Custom function (from code mode SDK) */
  | { readonly _tag: 'custom'; readonly fn: (payload: unknown) => Effect.Effect<unknown> }
```

#### How It Flows

```
User: "Give me a search bar against OpenSky"

LLM generates tree with ActionGroup referencing @action:search → callRpc "opensky/SearchFlights"

System sees "opensky/SearchFlights" doesn't exist.
System checks DynamicRpcService.
System auto-defines from context:

DynamicRpcSpec {
  tag: "opensky/SearchFlights",
  payloadSchema: { query: "string" },
  successSchema: { flights: [{ callsign, origin, altitude }] },
  handler: { _tag: "http", url: "https://opensky-network.org/api/states/all", method: "GET" }
}

Subsequent calls → DynamicRpcService.call("opensky/SearchFlights", { query: "..." })
```

### 3. Custom Events + Deltas

The LLM can define new event types that flow through the existing event bus alongside GeniferEvents and HarnessEvents.

#### DynamicEventService

```typescript
export interface DynamicEventOps {
  /** Define a new event schema */
  readonly defineEvent: (spec: DynamicEventSpec) => Effect.Effect<void>
  
  /** Emit an instance of a dynamic event */
  readonly emit: (tag: string, payload: unknown) => Effect.Effect<void>
  
  /** Subscribe to a dynamic event type */
  readonly subscribe: (tag: string) => Stream.Stream<unknown>
  
  /** List all registered dynamic event types */
  readonly list: () => Effect.Effect<ReadonlyArray<DynamicEventSpec>>
}

export class DynamicEventService extends Context.Tag('genifer/DynamicEventService')<
  DynamicEventService,
  DynamicEventOps
>() {}

export interface DynamicEventSpec {
  /** Event tag — e.g., "FlightSearched", "PortfolioUpdated" */
  readonly tag: string
  /** JSON Schema for payload validation */
  readonly payloadSchema: Record<string, unknown>
  /** Source: which surface/action emits this */
  readonly source: string
  /** Whether to persist events (for replay/audit) */
  readonly persistent: boolean
}
```

#### Integration with Existing Event Bus

Dynamic events flow alongside typed events:

```
HarnessEvent bus:
  ├── existing typed events (ToolCall, Message, etc.)
  ├── GeniferEvents (GenerateStart, StreamDelta, etc.)
  └── DynamicEvents (runtime-defined, validated against registered schema)
```

The pi SDK event stream sees them as `{ _tag: "DynamicEvent", eventTag: "FlightSearched", payload: {...} }`.

Elements can emit them:

```json
{
  "type": "Button",
  "props": { "label": "Search" },
  "actions": [{
    "type": "emitEvent",
    "trigger": "onClick",
    "target": "FlightSearched",
    "payload": { "query": "{{@state:query}}" }
  }]
}
```

### 4. Custom Tool Registration — genifer Generates Tools

The most powerful pattern. The LLM doesn't just USE tools — it can DEFINE new tools that become available in subsequent turns.

#### genifer_define_tool

A new meta-tool that the LLM calls to register new tool definitions:

```typescript
export const GeniferDefineToolParams = Type.Object({
  name: Type.String({ description: 'Tool name (e.g., "search_opensky")' }),
  label: Type.String({ description: 'Human-readable label' }),
  description: Type.String({ description: 'What this tool does (LLM sees this)' }),
  parameters: Type.Record(Type.String(), Type.Unknown(), {
    description: 'TypeBox-compatible parameter schema as JSON'
  }),
  handler: Type.Union([
    Type.Object({
      type: Type.Literal('http'),
      url: Type.String(),
      method: Type.Optional(Type.String()),
      headers: Type.Optional(Type.Record(Type.String(), Type.String())),
    }),
    Type.Object({
      type: Type.Literal('rpc'),
      target: Type.String(),
    }),
    Type.Object({
      type: Type.Literal('genifer_generate'),
      prompt: Type.String(),
    }),
    Type.Object({
      type: Type.Literal('script'),
      command: Type.String(),
    }),
  ], { description: 'How this tool executes' }),
  renderer: Type.Optional(Type.Object({
    style: Type.Optional(Type.Literal('card', 'inline', 'table', 'terminal')),
    icon: Type.Optional(Type.String()),
    color: Type.Optional(Type.String()),
  })),
})
```

#### How It Flows

Turn 1 — LLM sees user ask about flights:
```
LLM calls genifer_define_tool({
  name: "search_opensky",
  label: "Search OpenSky",
  description: "Search real-time flight data from OpenSky Network",
  parameters: {
    query: { type: "string", description: "Flight callsign or area" },
    bbox: { type: "object", properties: { ... }, description: "Geographic bounds" }
  },
  handler: { type: "http", url: "https://opensky-network.org/api/states/all" }
})
```

→ System registers `search_opensky` as a ToolDefinition + renderer.

Turn 2 — LLM can now call `search_opensky({ query: "DLH123" })` like any built-in tool.

Turn 3 — LLM calls `genifer_generate({ prompt: "Dashboard for OpenSky results", domains: ["cards", "data"] })` with ActionGroup wiring to `search_opensky`.

#### Custom Renderers

When `genifer_define_tool` includes a `renderer` spec, the system registers a matching ToolCallView component:

```typescript
// Runtime renderer registration
registerToolRenderer('search_opensky', DynamicToolRenderer, DynamicToolHeaderMeta)

// DynamicToolRenderer reads the renderer spec:
function DynamicToolRenderer({ input, output, state }: ToolRendererProps) {
  const spec = getDynamicToolSpec('search_opensky')
  // Renders based on spec.renderer.style:
  //   'card'     → bordered card with icon + data
  //   'inline'   → compact inline display
  //   'table'    → auto-table from output shape
  //   'terminal' → monospace output block
}
```

### 5. Code Mode SDK — Write Custom Logic in the Chat

The crown. User or LLM writes Effect code that genifer compiles and executes.

#### genifer_code Tool

```typescript
export const GeniferCodeParams = Type.Object({
  code: Type.String({
    description: 'Effect-TS code to execute. Has access to genifer services, atoms, and RPCs.'
  }),
  mode: Type.Union([
    Type.Literal('define'),  // Define a new service/handler/renderer
    Type.Literal('execute'), // Run code and return result
    Type.Literal('pipe'),    // Create a pipeline (stream transform)
  ]),
  expose: Type.Optional(Type.Object({
    asRpc: Type.Optional(Type.String()),    // Register result as callable RPC
    asTool: Type.Optional(Type.String()),   // Register result as tool
    asAtom: Type.Optional(Type.String()),   // Register result as subscribable atom
    asEvent: Type.Optional(Type.String()),  // Register result as event emitter
  })),
})
```

#### Example: Define a Custom RPC via Code Mode

```typescript
// LLM generates this in genifer_code:
const SearchFlights = Rpc.make("SearchFlights", {
  payload: Schema.Struct({
    query: Schema.String,
    bbox: Schema.optional(Schema.Struct({
      minLat: Schema.Number,
      maxLat: Schema.Number,
      minLon: Schema.Number,
      maxLon: Schema.Number,
    })),
  }),
  success: Schema.Array(Schema.Struct({
    callsign: Schema.String,
    origin: Schema.String,
    latitude: Schema.Number,
    longitude: Schema.Number,
    altitude: Schema.Number,
    velocity: Schema.Number,
  })),
  error: Schema.TaggedError("SearchFlightsError", {
    message: Schema.String,
  }),
})

// Handler bridges to OpenSky HTTP API
const handler = RpcServer.handler(SearchFlights, (payload) =>
  Effect.gen(function*() {
    const response = yield* HttpClient.get(
      `https://opensky-network.org/api/states/all`,
      { query: payload.query ? { callsign: payload.query } : {} }
    )
    return yield* response.json
  })
)
```

With `expose: { asRpc: "opensky/SearchFlights", asTool: "search_flights" }`:
- Registers as RPC: `DynamicRpcService.define(...)` 
- Registers as Tool: `ToolRegistryService.register(...)` 
- Available to ActionGroup references: `@action:search → callRpc "opensky/SearchFlights"`
- LLM can call `search_flights(...)` in future turns

#### SDK Surface

```typescript
// The Code Mode SDK exposes:
interface GeniferCodeSDK {
  // --- Services ---
  readonly genifer: GeniferHarnessService
  readonly catalog: CatalogComponents
  readonly rpc: DynamicRpcService
  readonly events: DynamicEventService

  // --- Atoms (read/write) ---
  readonly atoms: {
    readonly get: <T>(atom: Atom<T>) => T
    readonly set: <T>(atom: Atom<T>, value: T) => void
    readonly subscribe: <T>(atom: Atom<T>, fn: (value: T) => void) => () => void
  }

  // --- Registration ---
  readonly register: {
    readonly tool: (spec: ToolDefinition) => void
    readonly renderer: (toolName: string, component: ComponentType) => void
    readonly rpc: (spec: DynamicRpcSpec) => void
    readonly event: (spec: DynamicEventSpec) => void
    readonly component: (name: string, renderer: ComponentType, schema: Schema.Schema<any>) => void
  }

  // --- Effect Runtime ---
  readonly effect: {
    readonly run: <A>(effect: Effect.Effect<A>) => Promise<A>
    readonly runStream: <A>(stream: Stream.Stream<A>) => AsyncIterable<A>
    readonly provide: <A>(effect: Effect.Effect<A>, layer: Layer.Layer<any>) => Effect.Effect<A>
  }

  // --- HTTP Client ---
  readonly http: {
    readonly get: (url: string, options?: HttpOptions) => Effect.Effect<Response>
    readonly post: (url: string, body: unknown, options?: HttpOptions) => Effect.Effect<Response>
  }

  // --- Surface Manipulation ---
  readonly surface: {
    readonly create: (tree: UITree) => Effect.Effect<GeniferSurface>
    readonly update: (surfaceId: string, updater: (tree: UITree) => UITree) => Effect.Effect<void>
    readonly bind: (surfaceId: string, elementKey: string, binding: DataSourceBinding) => Effect.Effect<void>
    readonly addAction: (surfaceId: string, elementKey: string, action: ActionBinding) => Effect.Effect<void>
  }
}
```

---

## Extension Exposure — Genifer Surfaces as Pi Extensions

A genifer surface that defines custom tools, events, RPCs, and renderers is essentially a **pi extension**. The bridge:

```
Pi Extension = {
  name, description, version,
  tools: ToolDefinition[],
  hooks: HarnessHook[],
  tui: TUIComponent[]
}

Genifer Surface Extension = {
  surface: GeniferSurface,            // The UI tree
  tools: DynamicToolSpec[],           // Registered via genifer_define_tool
  rpcs: DynamicRpcSpec[],             // Registered via DynamicRpcService
  events: DynamicEventSpec[],         // Custom event types
  renderers: DynamicRendererSpec[],   // Custom ToolCallView components
}
```

### genifer_export_extension

A tool that bundles a surface + its dynamic registrations into a reusable extension:

```typescript
export const GeniferExportExtensionParams = Type.Object({
  surfaceId: Type.String({ description: 'Surface to export' }),
  name: Type.String({ description: 'Extension name' }),
  description: Type.Optional(Type.String()),
  includeTools: Type.Optional(Type.Boolean({ default: true })),
  includeRpcs: Type.Optional(Type.Boolean({ default: true })),
  includeEvents: Type.Optional(Type.Boolean({ default: true })),
})
```

This creates a self-contained artifact: UI tree + behavior definitions + wiring. Shareable, persistable, versionable.

---

## New Tool Inventory

| Tool | Purpose | When LLM Uses It |
|------|---------|-------------------|
| `genifer_generate` | Generate UI tree | Existing |
| `genifer_refine` | Modify existing surface | Existing |
| `genifer_query` | Read/search persisted trees | Existing |
| `genifer_define_tool` | Register a new callable tool | When it needs a capability that doesn't exist |
| `genifer_define_rpc` | Register a dynamic RPC | When ActionGroup references unknown RPC |
| `genifer_define_event` | Register a custom event type | When surface needs domain-specific events |
| `genifer_code` | Write + execute Effect code | For complex custom logic |
| `genifer_export_extension` | Bundle surface as extension | To create reusable packages |

---

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                        LLM (Sonnet / GPT)                        │
│                                                                    │
│  genifer_generate    genifer_define_tool    genifer_code           │
│  genifer_refine      genifer_define_rpc     genifer_export_ext    │
│  genifer_query       genifer_define_event                         │
└──────────┬──────────────┬──────────────┬──────────────────────────┘
           │              │              │
           ▼              ▼              ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────────┐
│   Genifer    │  │   Dynamic    │  │    Code Mode     │
│   Harness    │  │   Registry   │  │    Executor      │
│   Service    │  │   Service    │  │                  │
│              │  │              │  │  Effect runtime  │
│  generate()  │  │  tools: Map  │  │  sandboxed eval  │
│  refine()    │  │  rpcs: Map   │  │  SDK injection   │
│  query()     │  │  events: Map │  │                  │
└──────┬───────┘  └──────┬───────┘  └────────┬─────────┘
       │                 │                   │
       ▼                 ▼                   ▼
┌──────────────────────────────────────────────────────────────────┐
│                    Unified Runtime Registry                       │
│                                                                    │
│  ToolDefinition[]    DynamicRpcSpec[]    DynamicEventSpec[]       │
│  ToolRenderer[]      ActionBinding[]     DataSourceBinding[]     │
│                                                                    │
│  Static (compile-time)     +     Dynamic (runtime-defined)       │
└──────────────────────────────────────────────────────────────────┘
           │              │              │
           ▼              ▼              ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────────┐
│  Pi Harness  │  │  Event Bus   │  │  Surface         │
│  Pipeline    │  │  (typed +    │  │  Renderer        │
│              │  │   dynamic)   │  │                  │
│  tool calls  │  │              │  │  ActionGroup     │
│  streaming   │  │  subscribe() │  │  @action:refs    │
│  onUpdate    │  │  emit()      │  │  @state:refs     │
└──────────────┘  └──────────────┘  └──────────────────┘
```

---

## The "OpenSky" Full Flow

```
User: "Give me a search bar against OpenSky"

Turn 1 — LLM reasons:
  - Need to search OpenSky API
  - No existing tool for that
  - Define one, then generate UI

Turn 1, Call 1 — genifer_define_rpc:
  tag: "opensky/SearchFlights"
  handler: { type: "http", url: "https://opensky-network.org/api/states/all" }
  payloadSchema: { query: string, bbox?: { minLat, maxLat, minLon, maxLon } }
  successSchema: { states: [callsign, origin, lat, lon, alt, velocity][] }

Turn 1, Call 2 — genifer_generate:
  prompt: "Flight search dashboard"
  domains: ["forms", "data", "cards"]
  → ActionGroup "flight-search" {
      state: { query: "", results: [], loading: false }
      actions: {
        search: { type: "callRpc", target: "opensky/SearchFlights" }
        clear:  { type: "setState", target: "query", payload: "" }
      }
    }
    ├── SearchBar (bind:value=@state:query, onSearch=@action:search)
    ├── DataTable (bind:data=@state:results, columns=[...], searchable, sortable)
    └── Badge (bind:text=@state:results.length + " flights")

Turn 1 — Result: Live, interactive flight search rendered inline in chat.
User types "DLH" → SearchBar fires @action:search → callRpc "opensky/SearchFlights"
→ HTTP GET opensky API → results flow into @state:results → DataTable updates.

Turn 2 — User: "Add a map view"
LLM calls genifer_refine → adds geoint/MapView bound to same @state:results.
```

---

## Security Model

Dynamic code execution requires guardrails:

| Layer | Mechanism |
|-------|-----------|
| **Sandbox** | Code mode executes in isolated Effect runtime — no access to process, fs, or parent scope |
| **Schema validation** | All dynamic RPC payloads/responses validated against registered schemas |
| **URL allowlist** | HTTP handler can only reach approved domains (configurable) |
| **Rate limiting** | Dynamic tool calls rate-limited per session |
| **Audit log** | Every dynamic registration + invocation logged to DynamicEventService |
| **Confirmation gates** | Destructive actions (delete, write, external POST) require user confirmation |
| **TTL** | Dynamic registrations expire with the session unless explicitly persisted |

---

## Decision Log

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | ActionGroup with `@action:`/`@state:`/`bind:` refs | Entity.make analogy — named group + protocol, children consume by tag |
| D2 | DynamicRpcService bridging to existing Rpc patterns | Same service shape as static RPCs, validated by Schema at runtime |
| D3 | genifer_define_tool as a meta-tool | LLM self-extends its own capabilities during a conversation |
| D4 | Code Mode SDK with sandboxed Effect runtime | Full power when needed, but isolated from system internals |
| D5 | genifer_export_extension bundles surface + behavior | A surface with its registrations IS an extension |
| D6 | visibleWhen on UIElement for conditional rendering | Enables questionnaire branching without separate component |
| D7 | DynamicEvents flow alongside typed events | Existing bus infrastructure, just with runtime-validated payloads |
| D8 | HTTP handler URL allowlist | Security: can't reach arbitrary internal endpoints |
| D9 | Session-scoped by default, persist on export | Dynamic registrations are ephemeral unless explicitly saved |
| D10 | Custom renderers from define_tool renderer spec | 4 styles (card/inline/table/terminal) cover 90% of cases |
