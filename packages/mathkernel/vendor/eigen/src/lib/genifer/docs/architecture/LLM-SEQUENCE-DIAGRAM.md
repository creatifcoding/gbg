# Genifer LLM Sequence Diagram

How an LLM works with genifer end-to-end.

---

## The Core Insight

Genifer gives the LLM **eight tools**. Not one. The LLM doesn't just generate UI — it
programs the system. It defines new RPCs, registers new tools, writes Effect code, generates
interactive surfaces, and bundles the result as a reusable extension. Each tool call
extends the system's capabilities for subsequent turns.

This is the Cloudflare CodeAct pattern applied to Effect-TS: LLMs are better at writing
code that calls APIs than at making individual tool calls one at a time.

### The Tool Inventory

| Tool | What it does | When the LLM calls it |
|------|-------------|----------------------|
| `genifer_generate` | Create interactive UI from natural language | "Build me a search bar" |
| `genifer_refine` | Modify an existing surface | "Add a date filter to that" |
| `genifer_query` | Read/search persisted trees | "Show me the dashboard I built yesterday" |
| `genifer_define_rpc` | Register a runtime RPC with handler | Needs an API that doesn't exist yet |
| `genifer_define_tool` | Register a new callable tool | Needs a capability that doesn't exist yet |
| `genifer_define_event` | Register a custom event type | Surface needs domain-specific events |
| `genifer_code` | Write + execute Effect code in sandbox | Complex logic the JSON DSL can't express |
| `genifer_export_extension` | Bundle surface + registrations as extension | Package for reuse |

The LLM **chains these across turns**. Turn 1 defines an RPC. Turn 2 generates UI that
calls that RPC. Turn 3 writes Effect code that enriches the results. Turn 4 exports it all.

---

## Sequence Diagram

```mermaid
sequenceDiagram
    actor User
    participant Harness as Pi Harness<br/>(tool runtime)
    participant LLM as Language Model<br/>(@effect/ai)
    participant Compiler as PromptCompiler
    participant Stream as Streaming Pipeline<br/>(tokenize → normalize → repair)
    participant Bridge as BehaviorBridge<br/>(React)
    participant Interp as Interpreter
    participant Atoms as Atom Store<br/>(effect-atom)
    participant RPC as DynamicRpcService
    participant Events as DynamicEventService
    participant Sandbox as CodeModeSandbox<br/>(isolated Effect runtime)
    participant Registry as Tool/RPC/Event Registry

    Note over User,Registry: ═══ TURN 1: DEFINE CAPABILITIES ═══

    User->>Harness: "Build me a flight search against OpenSky"

    Harness->>LLM: system prompt + tools list
    
    Note right of LLM: LLM reasons:<br/>① Need OpenSky API access<br/>② No tool for that exists<br/>③ Define one first, then build UI

    LLM->>Harness: genifer_define_rpc({<br/>  tag: "opensky/SearchFlights",<br/>  handler: { _tag: "http", url: "..." },<br/>  payloadSchema: { query: string, bbox?: {...} }<br/>})

    Harness->>RPC: registerDynamicRpc("opensky/SearchFlights", def)
    RPC->>Registry: Available for ActionGroup callRpc references
    Harness-->>LLM: ✓ RPC registered

    Note over User,Registry: ═══ TURN 1 (continued): GENERATE UI ═══

    LLM->>Harness: genifer_generate({<br/>  prompt: "Flight search dashboard",<br/>  interactive: true<br/>})

    Harness->>Compiler: compile(prompt, catalog, registeredRpcs)
    
    Note right of Compiler: System prompt includes:<br/>① Component catalog (types + props)<br/>② Behavior DSL syntax (Tier 1/2)<br/>③ Registered RPCs (including the one just defined)<br/>④ Registered ActionGroups (@component refs)<br/>⑤ Golden examples

    Compiler-->>Harness: compiledPrompt

    Harness->>LLM: LanguageModel.streamText({ system, prompt })
    
    loop Each text-delta chunk
        LLM-->>Stream: streaming JSON
        Stream->>Stream: tokenize → incrementalNormalize → validate
    end

    Stream->>Stream: finalize() → UITree + score
    
    alt Score below threshold
        Stream-->>Harness: retry with error context (up to 3x)
    end

    Stream-->>Harness: { tree, score, rawJson }

    Note over User,Registry: ═══ HYDRATION ═══

    Harness->>Bridge: <SurfaceRenderer tree={tree} />
    
    Bridge->>Bridge: Walk elements, find behavior blocks

    Bridge->>Interp: interpretBehaviorBlock({<br/>  name: "flight-search",<br/>  state: [{ field: "query", initial: "" }, ...],<br/>  actions: {<br/>    search: { _tag: "callRpc", rpc: "opensky/SearchFlights", ... },<br/>    clear: { _tag: "setState", values: { query: "" } }<br/>  }<br/>})

    Interp->>Atoms: Atom.make("query", ""), Atom.make("results", []), ...
    Interp-->>Bridge: ActionGroupInstance { atoms, dispatch }

    Bridge->>Bridge: Resolve sigils:<br/>@state:query → atom read<br/>@action:search → dispatch("search")<br/>bind:query → two-way binding

    Bridge-->>User: Live interactive surface in chat

    Note over User,Registry: ═══ USER INTERACTION ═══

    User->>Bridge: types "DLH" in search bar, clicks Search
    Bridge->>Interp: dispatch("search", { query: "DLH" })
    Interp->>RPC: callDynamicRpc("opensky/SearchFlights", { query: "DLH" })
    RPC->>RPC: HTTP GET opensky-network.org/api/states/all?callsign=DLH
    RPC-->>Interp: { flights: [...] }
    Interp->>Atoms: set(resultsAtom, flights)
    Atoms-->>Bridge: React re-render → DataTable shows results

    Note over User,Registry: ═══ TURN 2: CODE MODE — EXTEND WITH EFFECT ═══

    User->>Harness: "Enrich those flights with altitude categories and ETA estimates"
    Harness->>LLM: system prompt + tools (now includes opensky/SearchFlights)

    Note right of LLM: LLM reasons:<br/>① Need custom data transform<br/>② Can't express altitude math in JSON DSL<br/>③ Use genifer_code to write Effect program

    LLM->>Harness: genifer_code({<br/>  mode: "define",<br/>  code: "Effect.gen(function*() {\n  const sdk = yield* GeniferCodeSDK\n  ...\n})",<br/>  expose: { asRpc: "flights/enrich", asTool: "enrich_flights" }<br/>})

    Harness->>Sandbox: Create isolated Effect runtime
    
    Note right of Sandbox: Sandbox has:<br/>① GeniferCodeSDK injected<br/>② Access to DynamicRpcService<br/>③ Access to DynamicEventService<br/>④ Access to CatalogService<br/>⑤ Atom read/write for current surface<br/>⑥ HTTP client (allowlisted domains)<br/><br/>Sandbox does NOT have:<br/>① process/fs/net access<br/>② Parent scope variables<br/>③ Unlimited execution time

    Sandbox->>Sandbox: Parse + compile Effect code
    Sandbox->>Sandbox: Execute in isolated runtime
    
    Sandbox->>RPC: registerDynamicRpc("flights/enrich", handler)
    Sandbox->>Registry: Register tool "enrich_flights"
    
    Note right of Registry: "enrich_flights" is now:<br/>① A callable RPC for ActionGroups<br/>② A tool the LLM can call in Turn 3+<br/>③ Schema-validated payload/response

    Sandbox-->>Harness: { success: true, registered: ["flights/enrich", "enrich_flights"] }
    Harness-->>LLM: ✓ Code executed, RPC + tool registered

    Note over User,Registry: ═══ TURN 2 (continued): REFINE THE SURFACE ═══

    LLM->>Harness: genifer_refine({<br/>  surfaceId: "sfc_abc123",<br/>  instruction: "Add enrichment step after search, show altitude categories"<br/>})

    Harness->>Compiler: compile(refinement + serialized current tree)
    Harness->>LLM: streamText (with thread context)
    LLM-->>Stream: updated JSON tree
    Stream-->>Harness: UITree v2

    Note right of Bridge: Updated tree's search action now:<br/>sequence([<br/>  callRpc("opensky/SearchFlights"),<br/>  callRpc("flights/enrich"),  ← the one Code Mode just defined<br/>  setState({ results: enriched })<br/>])

    Harness->>Bridge: Re-render with new tree
    Bridge-->>User: Search now enriches results with altitude categories

    Note over User,Registry: ═══ TURN 3: LLM CALLS ITS OWN TOOL ═══

    User->>Harness: "What's the altitude distribution of flights over Europe right now?"

    LLM->>Harness: enrich_flights({<br/>  bbox: { minLat: 36, maxLat: 71, minLon: -10, maxLon: 40 }<br/>})

    Note right of Harness: This tool was defined by the LLM<br/>in Turn 2 via genifer_code.<br/>The LLM is calling its own creation.

    Harness->>RPC: callDynamicRpc("flights/enrich", payload)
    RPC-->>Harness: enriched flight data
    Harness-->>LLM: { enriched: [...], categories: { cruising: 847, climbing: 213, ground: 56 } }

    LLM-->>User: "There are 1,116 flights over Europe. 76% cruising above 10,000ft..."

    Note over User,Registry: ═══ TURN 4: EXPORT AS EXTENSION ═══

    User->>Harness: "Package this as a reusable extension"
    
    LLM->>Harness: genifer_export_extension({<br/>  surfaceId: "sfc_abc123",<br/>  name: "opensky-dashboard",<br/>  includeTools: true,<br/>  includeRpcs: true<br/>})

    Harness->>Registry: Bundle surface + tools + RPCs + events
    
    Note right of Registry: Extension artifact contains:<br/>① UITree (the dashboard)<br/>② BehaviorBlock (search actions)<br/>③ DynamicRpc "opensky/SearchFlights" (HTTP handler)<br/>④ DynamicRpc "flights/enrich" (code-mode handler)<br/>⑤ Tool "enrich_flights"<br/>⑥ Event subscriptions<br/><br/>Installable. Shareable. Versionable.

    Registry-->>Harness: { extensionId: "ext_xyz", name: "opensky-dashboard" }
    Harness-->>User: Extension exported ✓
```

---

## Code Mode Is Not Inline Code Blocks

**Wrong mental model:** Code Mode = embedding `codeBlocks[]` inside behavior blocks.

**Correct mental model:** Code Mode = the LLM has a full programming API (`genifer_code` tool)
that it calls as a separate tool invocation to write Effect programs. The outputs get
registered back into the system as first-class citizens — RPCs, tools, atoms, events —
that persist for the session and can be called by subsequent tool invocations or
ActionGroup references.

The pattern is identical to Cloudflare's CodeAct:

| Cloudflare Code Mode | Genifer Code Mode |
|---|---|
| LLM writes TypeScript | LLM writes Effect-TS |
| Executes in Worker sandbox | Executes in isolated Effect runtime |
| Calls MCP tools via generated TypeScript API | Calls DynamicRpcService/EventService via GeniferCodeSDK |
| Results return to LLM context | Results register as RPCs/tools/atoms/events |
| Single `execute_code` tool | `genifer_code` tool with `define`/`execute`/`pipe` modes |

The key difference: Cloudflare's Code Mode returns results to context. Genifer's Code Mode
**registers capabilities** — the output persists as callable infrastructure, not just data.

---

## The Three Generation Tiers

### Tier 1: Component Reference

LLM names a pre-built `@component`. Zero DSL needed.

```
LLM: genifer_generate → tree references "FlightSearchBar"
System: interpretComponentRef() → catalog lookup → hydrate pre-built ActionGroup
```

### Tier 2: Behavior Block (JSON DSL)

LLM defines state + actions inline. The interpreter creates atoms and dispatch.

```
LLM: genifer_generate → tree includes behavior { state, actions, subscriptions }
System: interpretBehaviorBlock() → Atom.make() per field, dispatch(), event wiring
```

### Tier 3: Code Mode (Effect programs via `genifer_code` tool)

LLM calls `genifer_code` to write Effect programs that extend the system.

```
LLM: genifer_code({ code: "Effect.gen(...)", expose: { asRpc: "tag" } })
System: sandbox → execute → registerDynamicRpc() → available in future turns
```

**The tiers compose across turns.** The LLM might:
1. Call `genifer_code` to define a custom RPC with complex logic (Tier 3)
2. Call `genifer_generate` to build UI that references that RPC via callRpc action (Tier 2)
3. The generated UI includes a `ref` to a pre-built `@component` for the map view (Tier 1)

They're not mutually exclusive layers inside one JSON tree — they're **separate tool calls
across turns** that build on each other.

---

## genifer_code: The Full API

### Three Modes

| Mode | Purpose | Example |
|------|---------|---------|
| `define` | Create new service/handler/renderer | Define a custom RPC handler |
| `execute` | Run code and return result | Compute statistics, transform data |
| `pipe` | Create a stream transform | Real-time data enrichment pipeline |

### The SDK Surface

Code running inside the sandbox gets `GeniferCodeSDK` injected:

```typescript
interface GeniferCodeSDK {
  // --- Services (read + write) ---
  readonly rpc:     DynamicRpcService      // register + call RPCs
  readonly events:  DynamicEventService    // define + emit events  
  readonly catalog: CatalogService         // lookup components

  // --- Atoms (current surface's state) ---
  readonly atoms: {
    get:       <T>(atom: Atom<T>) => T
    set:       <T>(atom: Atom<T>, value: T) => void
    subscribe: <T>(atom: Atom<T>, fn: (v: T) => void) => () => void
  }
  readonly resolve: (field: string) => Atom.Writable<any, any>

  // --- Registration (expose outputs) ---
  readonly register: {
    tool:      (spec: ToolDefinition) => void        // LLM can call this next turn
    rpc:       (tag: string, handler: Function) => void
    event:     (tag: string, desc?: string) => void
    renderer:  (name: string, component: ComponentType) => void
    component: (name: string, renderer: ComponentType, schema: Schema.Schema<any>) => void
  }

  // --- HTTP (allowlisted domains) ---
  readonly http: {
    get:  (url: string, opts?) => Effect.Effect<Response>
    post: (url: string, body: unknown, opts?) => Effect.Effect<Response>
  }

  // --- Surface manipulation ---
  readonly surface: {
    create: (tree: UITree) => Effect.Effect<GeniferSurface>
    update: (id: string, fn: (tree: UITree) => UITree) => Effect.Effect<void>
    bind:   (id: string, key: string, binding: DataSourceBinding) => Effect.Effect<void>
  }

  // --- Effect runtime ---
  readonly effect: {
    run:       <A>(effect: Effect.Effect<A>) => Promise<A>
    runStream: <A>(stream: Stream.Stream<A>) => AsyncIterable<A>
  }
}
```

### Security Model

| Layer | Mechanism |
|-------|-----------|
| Sandbox isolation | Separate Effect runtime — no process/fs/parent scope |
| Schema validation | All RPC payloads validated against registered schemas |
| URL allowlist | HTTP only to approved domains |
| Rate limiting | Per-session execution budget |
| Audit log | Every execution logged to DynamicEventService |
| Confirmation gates | Destructive ops require user approval |
| TTL | Session-scoped by default; explicit persist to survive |

---

## The Full Flow: "OpenSky Dashboard" in 4 Turns

```
Turn 1:
  User: "Build me a flight search against OpenSky"
  
  LLM calls: genifer_define_rpc({
    tag: "opensky/SearchFlights",
    handler: { _tag: "http", url: "https://opensky-network.org/api/states/all" }
  })
  → RPC registered ✓

  LLM calls: genifer_generate({ prompt: "flight search", interactive: true })
  → Surface rendered with search bar + results table
  → ActionGroup "flight-search" with callRpc("opensky/SearchFlights")

Turn 2:
  User: "Enrich with altitude categories"

  LLM calls: genifer_code({
    mode: "define",
    code: `Effect.gen(function*() {
      const sdk = yield* GeniferCodeSDK
      sdk.register.rpc("flights/enrich", (flights) => {
        return flights.map(f => ({
          ...f,
          category: f.altitude > 10000 ? 'cruising' : f.altitude > 1000 ? 'climbing' : 'ground',
          speedKnots: Math.round(f.velocity * 1.944)
        }))
      })
    })`,
    expose: { asRpc: "flights/enrich", asTool: "enrich_flights" }
  })
  → RPC + tool registered ✓

  LLM calls: genifer_refine({ surfaceId: "sfc_abc", instruction: "chain enrich after search" })
  → Surface updated: search → enrich → display

Turn 3:
  User: "What's the altitude distribution over Europe?"

  LLM calls: enrich_flights({ bbox: { minLat: 36, maxLat: 71, minLon: -10, maxLon: 40 } })
  → The LLM is calling the tool IT DEFINED in Turn 2
  → Returns enriched data with categories
  
  LLM: "1,116 flights. 76% cruising, 19% climbing, 5% ground..."

Turn 4:
  User: "Package this"

  LLM calls: genifer_export_extension({
    surfaceId: "sfc_abc", name: "opensky-dashboard"
  })
  → Bundles: UI tree + behavior + 2 RPCs + 1 tool + event subscriptions
  → Extension artifact: installable, shareable, versionable
```

---

## File Map

```
PROMPT + GENERATION
  src/lib/genifer/compiler/PromptCompiler.ts     — builds system prompt
  src/lib/genifer/compiler/ai-adapter.ts         — generate() + refine() with retry
  src/lib/genifer/decorators/generation-schema.ts — DSL teaching fragment

STREAMING PIPELINE
  src/lib/genifer/streaming/pipeline.ts          — tokenize → normalize → repair → score

HYDRATION + RENDERING
  src/lib/genifer/react/BehaviorBridge.tsx        — resolves behaviors + sigils
  src/lib/genifer/react/SurfaceRenderer.tsx       — renders a surface

INTERPRETER
  src/lib/genifer/decorators/interpreter.ts       — interpretBehaviorBlock(), interpretComponentRef()
  src/lib/genifer/decorators/bootstrap.ts         — wires decorators → services

DYNAMIC SERVICES (built)
  src/lib/genifer/services/DynamicRpcService.ts   — runtime RPC dispatch
  src/lib/genifer/services/DynamicEventService.ts — pub/sub event bus

CODE MODE SDK (planned — #F622)
  (not yet built) CodeModeSandbox     — isolated Effect runtime
  (not yet built) CodeModeExecutor    — parse, compile, run
  (not yet built) GeniferCodeSDK      — injected API surface
  (not yet built) genifer_code tool   — ToolDefinition for harness
  (not yet built) expose() wiring     — register outputs as RPCs/tools/atoms/events

HARNESS TOOLS
  src/lib/genifer/harness/tools.ts               — genifer_generate + genifer_refine
  src/lib/genifer/harness/GeniferHarnessService.ts — surface lifecycle
```
