---
name: pi-sdk-ref
description: "Decision-theoretic SDK reference for @mariozechner/pi-coding-agent, pi-ai, and pi-agent-core. Use when deciding which SDK primitive to use for harness features, auth, streaming, model selection, session persistence, tools, or extensions. Routes requirement → optimal SDK action with constraint checking."
version: 5.1-hybrid
---

# Option: Pi SDK Primitive Selection

## Initiation (I)

Activate this skill when the agent needs to:
- Build a harness feature and must choose: pi-coding-agent, pi-ai, pi-agent-core, or custom
- Resolve auth/credentials for any LLM provider
- Wire model discovery, selection, or per-message override
- Implement streaming (direct or proxy)
- Persist sessions, branch, or compact context
- Register tools, subscribe to events, or handle UI interactions
- Wrap imperative SDK in Effect.Service / effect-atom patterns

**Reference documents** (read on demand, not preloaded):
- `PI-CODING-AGENT-REF.md` — AgentSession, AuthStorage, ModelRegistry, SessionManager, Extensions, Tools (3800+ lines)
- `PI-AI-REF.md` — Model, streamSimple, Context, events, providers, OAuth (1700+ lines)
- `PI-AGENT-CORE-REF.md` — Agent, AgentState, AgentEvent, AgentMessage, AgentTool (1200+ lines)

## Observation Space (Y)

This is a **POMDP** — the agent cannot observe:
- Full API surface (6800+ lines of type signatures)
- Whether a pattern already exists in the codebase
- Runtime behavior / performance of SDK primitives
- Version-specific compatibility constraints

**To reduce uncertainty:**
1. Read the relevant REF.md section before selecting
2. `grep -rn "PrimitiveName" src/` to check existing usage
3. Check `package.json` for version constraints

## Action Space (U)

### Package: `@mariozechner/pi-coding-agent`

| ID | Primitive | Use When |
|----|-----------|----------|
| a1.1 | `createAgentSession()` | Full harness with all defaults (model, auth, session, extensions, tools) |
| a1.2 | `AgentSession` class | Session with custom config — **wrap in Effect, never use imperatively** |
| a1.3 | `AuthStorage` | Credential persistence, OAuth refresh with file locking, env fallbacks |
| a1.4 | `ModelRegistry` | Model discovery (`.getAvailable()`), find (`.find(provider, id)`), custom providers |
| a1.5 | `SessionManager` | Session JSONL persistence, tree/branching, custom entries |
| a1.6 | `SettingsManager` | User/project settings (compaction, retry, terminal, images) |
| a1.7 | `DefaultResourceLoader` | Extension/skill/prompt/theme file discovery |
| a1.8 | `ExtensionRunner` | Event emission — tool_call, tool_result, context, session lifecycle |
| a1.9 | `pi.registerTool()` | Custom tool registration with TypeBox params |
| a1.10 | `executeBash()` | Command execution with timeout, cwd, signal |
| a1.11 | Built-in tools | `readTool`, `bashTool`, `editTool`, `writeTool`, `grepTool`, `findTool`, `lsTool` |
| a1.12 | `DefaultPackageManager` | Extension/skill installation and resolution |

### Package: `@mariozechner/pi-ai`

| ID | Primitive | Use When |
|----|-----------|----------|
| a2.1 | `streamSimple()` | Default streaming — handles reasoning, apiKey, budgets, retries |
| a2.2 | `stream()` | Full provider options (custom headers, baseUrl) |
| a2.3 | `completeSimple()` / `complete()` | Non-streaming single response |
| a2.4 | `getModel()` | Get specific model by provider + id |
| a2.5 | `getModels()` | List all models for a provider |
| a2.6 | `registerApiProvider()` | Custom API provider (streaming fn, auth, models) |
| a2.7 | `Type` (TypeBox) | Tool parameter schemas — **required for tool params, not raw TS types** |
| a2.8 | `AssistantMessageEventStream` | Custom stream handling (`.result()`, iteration) |
| a2.9 | `isContextOverflow()` | Detect token overflow → trigger compaction |
| a2.10 | OAuth utilities | `loginAnthropic()`, `loginGeminiCli()`, etc. — **server-only, never in browser** |
| a2.11 | `validateToolCall()` | Runtime tool argument validation against TypeBox schema |

### Package: `@mariozechner/pi-agent-core`

| ID | Primitive | Use When |
|----|-----------|----------|
| a3.1 | `Agent` class | Full agent with message queues, events, tool dispatch |
| a3.2 | `AgentTool` interface | Tool definition shape (name, description, parameters, execute) |
| a3.3 | `agentLoop()` | Minimal loop — no session/extension integration |
| a3.4 | `agentLoopContinue()` | Continue without new prompt (retry, tool followup) |
| a3.5 | `streamProxy()` | Bandwidth-optimized proxy routing |
| a3.6 | `agent.subscribe()` | Fine-grained events (agent_start, turn_end, message_update) |
| a3.7 | `agent.steer()` / `agent.followUp()` | Mid-run message queuing (steer interrupts, followUp waits) |

### Custom Build

| ID | Pattern | Use When |
|----|---------|----------|
| a4.1 | `Effect.Service` wrapper | SDK primitive needs Effect DI integration |
| a4.2 | `Atom.make()` state | SDK data needs reactive React binding |
| a4.3 | Custom `StreamFn` | Non-standard streaming behavior |
| a4.4 | Custom `convertToLlm` | Non-standard message types |

## Policy (π)

### Quick Decision Table

```
┌────────────────────────┬─────────────────────────────────┬──────────┬───────┐
│ REQUIREMENT            │ OPTIMAL PRIMITIVE               │ PACKAGE  │ Q-VAL │
├────────────────────────┼─────────────────────────────────┼──────────┼───────┤
│ Store credentials      │ AuthStorage.set()               │ coding   │ 0.95  │
│ OAuth login            │ loginAnthropic/Gemini/Copilot   │ ai       │ 0.90  │
│ Get API key (dynamic)  │ AuthStorage.getApiKey()         │ coding   │ 0.95  │
│ Refresh OAuth token    │ AuthStorage.refreshOAuthToken() │ coding   │ 0.95  │
│ List available models  │ ModelRegistry.getAvailable()    │ coding   │ 0.90  │
│ Find specific model    │ ModelRegistry.find(prov, id)    │ coding   │ 0.90  │
│ Register custom prov.  │ ModelRegistry.registerProvider()│ coding   │ 0.85  │
│ Stream with reasoning  │ streamSimple({reasoning})       │ ai       │ 0.90  │
│ Stream via proxy       │ streamProxy()                   │ core     │ 0.60  │
│ Detect context overflow│ isContextOverflow()             │ ai       │ 0.65  │
│ Persist session        │ SessionManager.create/append()  │ coding   │ 0.85  │
│ Branch session         │ SessionManager.branch()         │ coding   │ 0.85  │
│ Compact context        │ AgentSession.compact()          │ coding   │ 0.85  │
│ Register tool          │ pi.registerTool()               │ coding   │ 0.95  │
│ Subscribe to events    │ ExtensionRunner.on()            │ coding   │ 0.70  │
│ UI prompts             │ ctx.ui.select/notify            │ coding   │ 0.85  │
│ Steer mid-run          │ agent.steer()                   │ core     │ 0.95  │
│ Follow-up message      │ agent.followUp()                │ core     │ 0.95  │
│ Full harness setup     │ createAgentSession()            │ coding   │ 0.85  │
│ Bare agent loop        │ agentLoop()                     │ core     │ 0.65  │
│ Validate tool args     │ validateToolCall()              │ ai       │ 0.85  │
│ Custom message type    │ CustomAgentMessages (declare)   │ core     │ 0.40  │
└────────────────────────┴─────────────────────────────────┴──────────┴───────┘
```

### Decision Algorithm

```
FUNCTION selectSDKPrimitive(requirement):
  1. CLASSIFY requirement into state category (auth, model, stream, session, tool, lifecycle)
  2. LOOKUP optimal action from policy table above
  3. IF confidence < 0.85:
       READ relevant REF.md section for alternatives
       grep codebase for existing patterns
  4. CHECK constraints (see below) — if violated, try next candidate
  5. IF no unblocked action: requirement is CUSTOM BUILD territory
  6. WRAP in Effect.Service / Atom.make per project patterns
  7. RETURN selected primitive
```

## Termination (β)

| Condition | State | Action |
|-----------|-------|--------|
| SDK primitive identified, confidence ≥ 0.85, constraints pass | **RESOLVED** | Implement with Effect wrapper |
| SDK primitive found but constraint violated | **BLOCKED** | Re-evaluate, try alternative |
| No SDK primitive matches, custom build justified | **CUSTOM** | Design Effect.Service |
| Requirement ambiguous | **UNCERTAIN** | Ask user for clarification |

## Q-Heuristics

### High-Value (reuse aggressively)
- **AuthStorage** (0.95) — every harness needs auth
- **ModelRegistry** (0.90) — central to all model operations  
- **streamSimple()** (0.90) — default streaming with reasoning + budgets
- **SessionManager** (0.85) — persistence + branching
- **TypeBox Type** (0.85) — required for tool params

### Medium-Value (useful in context)
- **Agent class** (0.75) — full lifecycle, but imperative; wrap in Effect
- **ExtensionRunner** (0.70) — events, but requires bindCore() setup
- **agentLoop()** (0.65) — minimal, loses session/extension integration

### Low-Value / Anti-Patterns (avoid)
- **Agent.replaceMessages()** (0.40) — direct mutation; prefer immutable
- **Raw OAuth login*()** (0.30) — prefer AuthStorage which persists tokens
- **KeybindingsManager** (0.25) — CLI-only, not for Effect services
- **FooterDataProvider** (0.20) — UI-specific, not for headless harness
- **Direct auth.json reads** (0.00) — FORBIDDEN; use AuthStorage (file locking)
- **Node APIs in browser** (0.00) — FORBIDDEN; split barrel exports

## Constraints

### Temporal (must do X before Y)
- **T1**: `registerBuiltInApiProviders()` → `stream()` (provider registry empty otherwise)
- **T2**: `AuthStorage.reload()` → `getApiKey()` (stale cache → 401)
- **T4**: `ModelRegistry.refresh()` → `getAvailable()` (custom providers missing)
- **T6**: `SessionManager.create()` → `appendMessage()` (no header → corrupt file)
- **T8**: `pi.registerTool()` → tool invocation (unregistered → "tool not found")

### Epistemic (must know X)
- **E1**: Know provider's API type before streaming (wrong API → protocol mismatch)
- **E2**: Know if OAuth or static key (wrong auth path → 401)
- **E3**: Know if model supports reasoning (useless thinkingLevel otherwise)
- **E4**: Know contextWindow for compaction trigger

### Deontic (must / must not)
- **D1**: `O(AuthStorage for all credential access)` — file locking, refresh, env fallbacks
- **D2**: `F(import server-only modules in browser)` — OAuth login uses http.createServer
- **D3**: `O(TypeBox for tool parameters)` — streaming JSON parser needs schema
- **D4**: `O(AbortSignal propagation)` — abort() must cancel in-flight ops
- **D5**: `F(mutate AgentState directly)` — use setModel(), setTools(), replaceMessages()
- **D6**: `O(Effect Schema for domain types)` — per project AGENTS.md
- **D7**: `F(blocking calls in event handlers)` — halts agent loop
- **D13**: `F(imperative AgentSession methods inside Effect.gen)` — wrap in Effect.promise/sync

### Dynamic (action → effect)
- **A1**: `registerProvider()` → models appear in registry
- **A2**: OAuth refresh → auth.json updated with new tokens
- **A3**: `appendMessage()` → leafId advances
- **A9**: `emit("tool_call")` → handlers can block execution

## Verification

### Safety ✓
- Never import server-only SDK in browser (D2 + barrel split)
- Never use stale OAuth without refresh (T2 + AuthStorage auto-refresh)
- Never mix imperative AgentSession with Effect.gen (D13)
- Never bypass AuthStorage for credentials (D1)

### Liveness ✓
- Every decision terminates (finite decision tree, 4 terminal states)
- Every auth requirement resolves or explicitly errors
- Every model selection resolves to streamable model with valid auth

## Effect Integration Patterns

### Wrap SDK in Effect.Service
```typescript
// AuthStorage as Effect service
const getApiKey = (provider: string) =>
  Effect.promise(() => authStorage.getApiKey(provider))

// ModelRegistry in Layer
const modelRegistryLayer = Layer.succeed(ModelRegistryTag, {
  getAvailable: () => Effect.sync(() => registry.getAvailable()),
  find: (p, id) => Effect.sync(() => registry.find(p, id)),
})
```

### SDK + Atom State
```typescript
const availableModels$ = Atom.make<Model[]>([])
// In fn-atom: update after fetch
morphChatRegistry.set(availableModels$, registry.getAvailable())
```

### Stream Events → Effect Stream
```typescript
const events = Stream.async<AgentEvent>((emit) => {
  agent.subscribe((event) => emit.single(event))
  return Effect.sync(() => agent.unsubscribe())
})
```
