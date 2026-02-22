# Genifer LLM Sequence Diagram

How an LLM generates interactive UI end-to-end.

---

## Overview

There are **two entry points** — the LLM calling a tool during a conversation, or application code calling `generate()` directly. Both converge at the same pipeline.

```
User prompt → Pi Harness → genifer_generate tool → PromptCompiler → LLM → streaming JSON
                                                                              ↓
                                                                     Tokenizer → Pipeline
                                                                              ↓
                                                                     Normalize → Repair → Score
                                                                              ↓
                                                                     UITree + BehaviorBlocks
                                                                              ↓
                                                                     BehaviorBridge (React)
                                                                              ↓
                                                                     Interpreter → Atoms → DOM
                                                                              ↓
                                                                     User clicks → dispatch → atom mutation → re-render
                                                                              ↓
                                                                     callRpc / emitEvent → DynamicRpcService / DynamicEventService
```

---

## Sequence Diagram (Mermaid)

```mermaid
sequenceDiagram
    actor User
    participant Harness as Pi Harness<br/>(PiAiToolRuntime)
    participant LLM as Language Model<br/>(@effect/ai)
    participant Compiler as PromptCompiler<br/>(Effect.Service)
    participant Stream as Streaming Pipeline<br/>(tokenizer → normalize → repair)
    participant Bridge as BehaviorBridge<br/>(React)
    participant Interp as Interpreter<br/>(interpretBehaviorBlock)
    participant Atoms as Atom Store<br/>(effect-atom Registry)
    participant RPC as DynamicRpcService
    participant Events as DynamicEventService

    Note over User,Events: ═══ PHASE 1: PROMPT COMPILATION ═══

    User->>Harness: "Build me a flight search UI"
    Harness->>Harness: genifer_generate tool invoked
    Harness->>Compiler: compile(userPrompt, catalogContext)
    
    Note right of Compiler: Assembles system prompt:<br/>① Identity ("You are Claude Code")<br/>② JSON-only output rule<br/>③ Component catalog (types + props)<br/>④ Golden examples (dashboard, form)<br/>⑤ BEHAVIOR_DSL_PROMPT (Tier 1/2/3)<br/>⑥ Available @rpc tags<br/>⑦ Available @component refs<br/>⑧ Available ActionGroups

    Compiler-->>Harness: compiledPrompt (string)

    Note over User,Events: ═══ PHASE 2: LLM STREAMING ═══

    Harness->>LLM: LanguageModel.streamText({ system, prompt })
    
    loop Each text-delta chunk
        LLM-->>Stream: "{ \"root\": \"search..."
        Stream->>Stream: tokenizer.feedChunk(delta)
        Stream->>Stream: incrementalNormalize(token)
        Note right of Stream: Validates type against catalog<br/>Resolves children refs<br/>Quarantines invalid elements
    end

    LLM-->>Stream: [stream complete]
    Stream->>Stream: pipeline.finalize()
    
    Note right of Stream: ① Build UITree from token graph<br/>② Run repair pass (fix broken refs)<br/>③ Score quality (0–100)<br/>④ Classify failure if score < threshold

    Stream-->>Harness: { tree: UITree, score, rawJson, ... }

    alt Score < threshold (retry)
        Harness->>Compiler: recompile with error context
        Harness->>LLM: retry (up to 3 attempts)
    end

    Harness-->>User: Surface rendered in chat thread

    Note over User,Events: ═══ PHASE 3: HYDRATION ═══

    Harness->>Bridge: <SurfaceRenderer tree={tree} />
    
    Bridge->>Bridge: Walk UITree elements

    alt Element has "behavior" block (Tier 2)
        Bridge->>Interp: interpretBehaviorBlock(block)
        Note right of Interp: Creates per-block Registry<br/>① Atom.make() for each state field<br/>② Build ActionGroupAtoms ops<br/>③ Build dispatch(tag, payload)<br/>④ Wire event subscriptions
        Interp-->>Bridge: ActionGroupInstance { atoms, dispatch, registry }
        Bridge->>Atoms: Register atoms for React subscription
    end

    alt Element has "ref" (Tier 1)
        Bridge->>Interp: interpretComponentRef(ref)
        Note right of Interp: Catalog lookup by name<br/>→ hydrateActionGroup(name)<br/>→ Return pre-built instance
        Interp-->>Bridge: ActionGroupInstance (from @actionGroup decorator)
    end

    Bridge->>Bridge: Resolve sigil props for each element
    Note right of Bridge: @state:query → atom read<br/>@action:search → dispatch wrapper<br/>bind:field → two-way binding<br/>{{@state:count}} → string interpolation

    Bridge-->>User: Interactive DOM rendered

    Note over User,Events: ═══ PHASE 4: USER INTERACTION ═══

    User->>Bridge: clicks "Search" button
    Bridge->>Bridge: onClick={@action:search} resolved
    Bridge->>Interp: dispatch("search", { event payload })

    Note right of Interp: Walks ActionDef tree:<br/>search = sequence([<br/>  setState({ loading: true }),<br/>  callRpc("flights/search", { query }),<br/>  setState({ loading: false })<br/>])

    Interp->>Atoms: set(loadingAtom, true)
    Atoms-->>Bridge: React re-render (loading spinner)

    Interp->>RPC: callDynamicRpc("flights/search", payload)
    
    alt Handler type: custom
        RPC->>RPC: _customHandlers.get(handlerId)(payload)
        RPC-->>Interp: { flights: [...] }
    end
    alt Handler type: http
        RPC->>RPC: fetch(url, { body: payload })
        RPC-->>Interp: response.json()
    end

    Interp->>Atoms: set(resultsAtom, flights)
    Interp->>Atoms: set(loadingAtom, false)
    Atoms-->>Bridge: React re-render (results list)

    Interp->>Events: emitDynamicEvent("search.completed", { count })
    Events->>Events: Notify tag subscribers
    Events->>Events: Notify wildcard subscribers
    Events->>Events: Append to dynamicEventLogAtom

    Note over User,Events: ═══ PHASE 5: REFINEMENT (optional) ═══

    User->>Harness: "Add a date filter to that search"
    Harness->>Harness: genifer_refine tool invoked
    Harness->>Compiler: compile(refinement + serialized current tree)
    Harness->>LLM: streamText (with conversation thread context)
    LLM-->>Stream: updated JSON tree
    Stream-->>Harness: { tree: UITree v2 }
    Harness->>Bridge: Re-render with new tree
    Note right of Bridge: BehaviorBridge merges:<br/>Existing atom state preserved<br/>New elements hydrated<br/>Removed elements cleaned up
    Bridge-->>User: Updated interactive surface
```

---

## The Three Tiers — What the LLM Actually Outputs

### Tier 1: Component Reference (catalog lookup)

The LLM names a pre-built `@component` decorated class. Zero JSON DSL needed.

```json
{
  "root": "search",
  "elements": {
    "search": {
      "type": "FlightSearchBar",
      "ref": { "component": "FlightSearchBar", "props": { "placeholder": "Where to?" } }
    }
  }
}
```

**Code path:** `interpretComponentRef()` → catalog lookup → `hydrateActionGroup()` → full interactive instance with pre-defined atoms, actions, RPC bindings.

### Tier 2: Behavior Block (JSON DSL)

The LLM defines state + actions + events inline. Most common tier.

```json
{
  "root": "container",
  "elements": {
    "container": {
      "type": "VStack",
      "behavior": {
        "name": "flight-search",
        "state": [
          { "field": "query", "initial": "" },
          { "field": "results", "initial": [] },
          { "field": "loading", "initial": false }
        ],
        "actions": {
          "search": {
            "_tag": "sequence",
            "actions": [
              { "_tag": "setState", "values": { "loading": true } },
              { "_tag": "callRpc", "rpc": "flights/search",
                "payload": { "query": "{{@state:query}}" },
                "resultField": "results", "loadingField": "loading" }
            ]
          },
          "clear": { "_tag": "setState", "values": { "query": "", "results": [] } }
        },
        "subscriptions": [],
        "emits": ["search.completed"]
      },
      "children": ["input", "btn", "results-list"]
    },
    "input": {
      "type": "TextInput",
      "props": { "value": "@state:query", "onChange": "@action:setQuery" }
    },
    "btn": {
      "type": "Button",
      "props": { "onClick": "@action:search", "disabled": "@state:loading", "label": "Search" }
    },
    "results-list": {
      "type": "Text",
      "props": { "content": "{{@state:results.length}} results" }
    }
  }
}
```

**Code path:** `interpretBehaviorBlock()` → creates Registry + Atoms + dispatch → `executeAction()` walks the ActionDef tree → `callDynamicRpc()` / `emitDynamicEvent()` for side effects.

### Tier 3: Code Block (sandboxed Effect — not yet implemented)

For when the DSL can't express the logic. The LLM writes an Effect program.

```json
{
  "codeBlocks": [{
    "_tag": "CodeBlock",
    "code": "Effect.gen(function*() { ... })",
    "expose": { "asRpc": ["complexSearch"], "asAtom": ["derivedMetrics"] }
  }]
}
```

**Code path:** (planned) Sandboxed Effect runtime → register exposed RPCs/atoms → same atom/dispatch flow.

---

## Key Invariants

| Principle | Implementation |
|-----------|---------------|
| **Compiler builds prompts, never calls model** | `PromptCompiler.compile()` returns a string |
| **Streaming pipeline is model-agnostic** | `feedChunk(delta)` accepts any string source |
| **BehaviorBridge resolves at render time** | Sigils → atom reads, action wrappers, bindings |
| **Atoms are the single source of truth** | `Effect.runSync` for mutations, React subscribes |
| **Services are pluggable** | `setRpcExecutor()`, `registerCustomRpcHandler()` |
| **Never `Effect.runPromise` for atom mutations** | Causes microtask scheduling that clobbers reads |
| **Interpreter output is identical to decorator path** | JSON BehaviorBlock → same ActionGroupInstance shape |

---

## File Map

```
PROMPT COMPILATION
  src/lib/genifer/compiler/PromptCompiler.ts    — builds system prompt from catalog + DSL
  src/lib/genifer/compiler/ai-adapter.ts        — generate() + refine() with retry loop
  src/lib/genifer/decorators/generation-schema.ts — BEHAVIOR_DSL_PROMPT teaching fragment

STREAMING PIPELINE
  src/lib/genifer/streaming/tokenizer.ts        — character-level JSON token extraction
  src/lib/genifer/streaming/pipeline.ts         — orchestrates tokenize → normalize → repair → score
  src/lib/genifer/core/incremental-normalize.ts — per-element validation against catalog
  src/lib/genifer/core/repair.ts                — fix broken refs, orphaned children

HYDRATION + RENDERING
  src/lib/genifer/react/BehaviorBridge.tsx       — walks tree, resolves behaviors + sigils
  src/lib/genifer/react/SurfaceRenderer.tsx      — renders a complete surface
  src/lib/genifer/react/SurfaceProvider.tsx       — context for surface state

INTERPRETER
  src/lib/genifer/decorators/interpreter.ts      — interpretBehaviorBlock(), interpretComponentRef()
  src/lib/genifer/decorators/bootstrap.ts        — wires decorators → services at startup

DYNAMIC SERVICES
  src/lib/genifer/services/DynamicRpcService.ts  — runtime RPC dispatch (custom, http, service, llm, script)
  src/lib/genifer/services/DynamicEventService.ts — pub/sub event bus + log

HARNESS INTEGRATION
  src/lib/genifer/harness/tools.ts               — genifer_generate + genifer_refine ToolDefinitions
  src/lib/genifer/harness/GeniferHarnessService.ts — surface lifecycle, state management
  src/lib/genifer/harness/surface.ts             — Surface type (hydrated interactive render tree)
```
