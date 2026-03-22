# Skill Upgrade: pi-sdk-ref
Started: 2026-02-19T13:48:00Z

## Input Skill
.pi/skills/pi-sdk-ref/SKILL.md

## Reference Documents
- .pi/skills/pi-sdk-ref/PI-CODING-AGENT-REF.md (3816 lines — AgentSession, AuthStorage, ModelRegistry, SessionManager, Extensions, Tools, etc.)
- .pi/skills/pi-sdk-ref/PI-AI-REF.md (1731 lines — Model, streamSimple, Context, events, providers, OAuth)
- .pi/skills/pi-sdk-ref/PI-AGENT-CORE-REF.md (1226 lines — Agent, AgentState, AgentEvent, AgentMessage, AgentTool, ThinkingLevel)

## Target Format
Decision Theory v5 Hybrid

## Context
This skill helps agents decide WHICH pi SDK primitive to use when building harness features.
The decision space is: "given a harness requirement, should I use pi-coding-agent, pi-ai, pi-agent-core, or build custom?"

## Agent Findings
(Agents append below)

---

## Agent 3: Constraints (Blackburn Modal Analysis)

### TEMPORAL Constraints (◇P → □Q: P must happen before Q)

| ID | Constraint | Plain English | Why It Matters |
|----|-----------|---------------|----------------|
| T1 | `◇registerBuiltInApiProviders() → □stream()` | **Must register API providers before streaming** — `registerBuiltInApiProviders()` must be called before any `stream()` or `streamSimple()` call. | Without provider registration, the API registry is empty and streaming will fail with "unknown API type". |
| T2 | `◇AuthStorage.reload() → □getApiKey()` | **Must reload AuthStorage before resolving keys** — `reload()` must be called to ensure credentials are fresh from `auth.json`. | OAuth tokens expire; stale cache means 401 errors mid-session. |
| T3 | `◇createAgentSession() → □session.prompt()` | **Must create session before prompting** — `createAgentSession()` must complete before calling `session.prompt()`. | Session initializes model, tools, extensions — prompting without this yields undefined behavior. |
| T4 | `◇ModelRegistry.refresh() → □getAvailable()` | **Must refresh registry before getting available models** — `refresh()` reads `models.json` and loads custom providers. | Custom providers from config file won't appear in `getAvailable()` until refresh. |
| T5 | `◇ExtensionRunner.bindCore() → □emit()` | **Must bind core actions before emitting events** — Extension runtime has throwing stubs until `bindCore()` wires real implementations. | Extension handlers that call `ctx.abort()` or `ctx.compact()` will throw if core not bound. |
| T6 | `◇SessionManager.create() → □appendMessage()` | **Must create/open session before appending** — Session file header must exist before entries can be appended. | Writing entries without header corrupts session file format. |
| T7 | `◇Agent.setModel() → □Agent.prompt()` | **Must set model before prompting** — Agent requires a model to be configured before it can stream. | Prompting with undefined model throws or produces error events. |
| T8 | `◇pi.registerTool() → □tool invocation` | **Must register tools before agent can invoke them** — Tool must be in extension's tool map before LLM can call it. | Unregistered tool calls fail with "tool not found" error. |
| T9 | `◇convertToLlm() → □LLM API call` | **Must convert AgentMessages to LLM Messages before API call** — Custom message types must be transformed to standard Message format. | LLM providers reject non-standard message roles/formats. |
| T10 | `◇OAuth login() → □refreshToken()` | **Must complete OAuth login before refresh is possible** — Initial credentials (access + refresh tokens) come from login flow. | No refresh token without initial auth — cannot auto-refresh. |

### EPISTEMIC Constraints (K_agent(φ): Agent must know φ)

| ID | Constraint | Plain English | Why It Matters |
|----|-----------|---------------|----------------|
| E1 | `K_harness(provider.api)` | **Must know provider's API type to choose stream function** — Each provider (anthropic, openai, google, bedrock) has a distinct streaming protocol. | Wrong API type → protocol mismatch → parse errors or silent failures. |
| E2 | `K_harness(credential.type)` | **Must know if OAuth or API key** — `AuthCredential` is a union: `{ type: "api_key" }` vs `{ type: "oauth" }`. | OAuth requires refresh flow; static keys don't. Wrong path = auth failures. |
| E3 | `K_harness(model.reasoning)` | **Must know if model supports reasoning** — `Model.reasoning` boolean determines if `thinkingLevel` is effective. | Setting `thinkingLevel: "high"` on non-reasoning model is wasteful/ignored. |
| E4 | `K_harness(model.contextWindow)` | **Must know context window size for compaction** — Compaction triggers when usage approaches `contextWindow`. | Without this, overflow detection (`isContextOverflow()`) is unreliable. |
| E5 | `K_harness(message.role)` | **Must know message role for conversion** — `convertToLlm()` must handle all AgentMessage variants including custom roles. | Unknown roles cause type errors or dropped messages. |
| E6 | `K_harness(supportsXhigh(model))` | **Must know if model supports xhigh thinking** — Only specific models (GPT-5.2+, Opus 4.6+) support `xhigh`. | Requesting unsupported level may error or silently clamp. |
| E7 | `K_harness(tool.parameters)` | **Must know tool parameter schema for validation** — `validateToolCall()` requires TypeBox schema to parse arguments. | Unvalidated tool args can cause runtime crashes in execute(). |
| E8 | `K_harness(session.leafId)` | **Must know current leaf ID for branching** — `branch()` and `navigateTree()` require entry ID context. | Branching from wrong position corrupts session tree. |
| E9 | `K_harness(model.compat)` | **Must know model compatibility settings** — OpenAI-compat providers have varied support for `store`, `reasoning_effort`, etc. | Wrong assumptions → rejected requests or missing features. |
| E10 | `K_harness(provider.oauth)` | **Must know if provider uses OAuth** — OAuth providers require login flow vs simple API key config. | Cannot authenticate without knowing auth mechanism. |

### DEONTIC Constraints (O(φ): Obligated; F(φ): Forbidden)

| ID | Constraint | Plain English | Why It Matters |
|----|-----------|---------------|----------------|
| D1 | `O(AuthStorage for OAuth refresh)` | **Must use AuthStorage for OAuth token management** — Never raw file reads for `auth.json`. | AuthStorage implements file locking for concurrent refresh; raw reads cause race conditions. |
| D2 | `F(import server-only in browser)` | **Must not import server-only modules in browser context** — OAuth login uses `http.createServer()`, Node crypto. | These APIs don't exist in browser — import fails at bundle time. |
| D3 | `O(TypeBox schemas for tool params)` | **Must use TypeBox (Type.Object, etc.) for tool parameters** — Not raw TypeScript types. | Streaming JSON parsing (`parseStreamingJson`) relies on schema structure; raw types break validation. |
| D4 | `O(AbortSignal propagation)` | **Must propagate AbortSignal through tool execution chain** — From `agentLoop` → `execute()` → operations. | Without signal propagation, abort() cannot cancel in-flight operations. |
| D5 | `F(mutate AgentState directly)` | **Must not mutate AgentState outside designated methods** — Use `setModel()`, `setTools()`, `replaceMessages()`. | Direct mutation bypasses event emission — UI won't update. |
| D6 | `O(Effect Schema for domain types)` | **Must use Effect Schema (per project guidelines)** — Not raw interfaces for shared domain types. | Effect Schema enables runtime validation, EventLog integration, JSON Schema generation. |
| D7 | `F(blocking calls in event handlers)` | **Must not block in extension event handlers** — Handlers should be async or return immediately. | Blocking halts the entire agent loop — streaming stops. |
| D8 | `O(toolCallId uniqueness)` | **Must preserve toolCallId uniqueness across transforms** — `transformMessages()` normalizes IDs for cross-provider compat. | Duplicate IDs confuse tool result matching. |
| D9 | `F(expose apiKey in logs/events)` | **Must not log or emit API keys** — Keys are sensitive credentials. | Security violation — leaked keys enable unauthorized access. |
| D10 | `O(close EventStream properly)` | **Must call `stream.end()` or emit done/error event** — EventStream consumers await `.result()`. | Unclosed streams hang forever — resource leak, stuck promises. |
| D11 | `O(handle isError in ToolResultMessage)` | **Must check `isError` flag on tool results** — Determines if tool failed vs succeeded. | Treating errors as success confuses the LLM's reasoning. |
| D12 | `F(assume sessionId across restarts)` | **Must not hardcode session IDs** — Session IDs are generated fresh each time. | Hardcoded IDs won't match persisted sessions — restoration fails. |

### DYNAMIC Constraints ([α]φ: After action α, property φ holds)

| ID | Constraint | Plain English | Why It Matters |
|----|-----------|---------------|----------------|
| A1 | `[registerProvider(name, config)]models ∈ registry` | **Registering a provider adds its models to the registry** — `ModelRegistry.registerProvider()` merges models. | Provider's models become available for selection immediately. |
| A2 | `[OAuth refresh]auth.json updated` | **Refreshing OAuth token writes new credentials to auth.json** — AuthStorage persists updated tokens. | Next session loads fresh tokens without re-login. |
| A3 | `[session.appendMessage(m)]leafId = m.id` | **Appending message advances the leaf pointer** — SessionManager tracks current position. | Subsequent appends chain from new leaf — tree structure maintained. |
| A4 | `[agent.steer(m)]queue updated ∧ interrupt scheduled` | **Steering queues message and schedules interruption** — Agent checks queue after each tool execution. | Mid-run user input gets processed at next safe point. |
| A5 | `[compact()]tokensBefore captured ∧ summary generated` | **Compaction captures pre-compaction token count and generates summary** — Creates CompactionEntry. | Audit trail preserved; summary replaces compacted history in context. |
| A6 | `[pi.sendMessage({triggerTurn: true})]agent continues` | **Sending message with triggerTurn continues the agent loop** — Message delivered and agent prompted. | Extension can inject context and trigger response in one call. |
| A7 | `[setActiveTools(names)]tools filtered for next turn` | **Setting active tools updates which tools LLM sees** — Only active tools appear in system prompt. | Restricting tools focuses the agent's capabilities. |
| A8 | `[branch(entryId)]leafId = entryId ∧ new branch created` | **Branching resets leaf to entry and starts new path** — Session tree forks from specified point. | Enables exploring alternative conversation paths. |
| A9 | `[emit("tool_call")]handlers can block` | **Emitting tool_call event allows extension handlers to block** — Return `{ block: true, reason }`. | Extensions can intercept dangerous operations (e.g., rm -rf). |
| A10 | `[emit("context")]handlers can transform messages` | **Context event allows message transformation** — Return `{ messages: transformedArray }`. | Extensions can inject context, prune messages, redact content. |
| A11 | `[setThinkingLevel(level)]reasoning budget updated` | **Setting thinking level adjusts reasoning token budget** — Affects `adjustMaxTokensForThinking()`. | Higher levels allocate more tokens for extended thinking. |
| A12 | `[loadExtensions()]handlers registered ∧ tools available` | **Loading extensions populates handler maps and tool registry** — Extensions become active. | Agent can invoke extension tools and emit extension events. |

### Critical Constraint Clusters

**Authentication Lifecycle** (T2 + T10 + E2 + D1 + A2):
The auth system requires knowing credential type (E2), using AuthStorage (D1), completing login before refresh (T10), reloading before resolution (T2), with refresh updating storage (A2).

**Session Tree Integrity** (T6 + E8 + D5 + A3 + A8):
Session management requires creating before appending (T6), knowing leaf position (E8), not mutating directly (D5), with appends advancing leaf (A3) and branches forking correctly (A8).

**Provider Registration Chain** (T1 + T4 + E1 + A1):
Streaming requires registering builtins (T1), refreshing registry (T4), knowing API type (E1), with registration adding models (A1).

**Extension Safety** (T5 + T8 + D7 + A9 + A10):
Extension execution requires binding core (T5), registering tools early (T8), non-blocking handlers (D7), with events enabling interception (A9) and transformation (A10).

---

## Agent 1: States, Actions & Transitions

### MDP Formalization (LaValle Planning Algorithms Ch. 2)

This skill encodes a **decision process** for selecting SDK primitives. The agent must navigate from a *requirement state* to an *action* (SDK primitive selection) that satisfies the requirement.

---

### 1. STATE SPACE (S)

States represent **what the agent needs** when building harness features. I've identified 6 macro-states with sub-states:

#### S₁: Authentication & Credentials
| State ID | Description | Observable Signals |
|----------|-------------|-------------------|
| `s1.1` | Need API key storage | "store API key", "persist credentials" |
| `s1.2` | Need OAuth flow | "login with", "OAuth", "subscription" |
| `s1.3` | Need dynamic key resolution | "expiring token", "refresh token" |
| `s1.4` | Need runtime key override | "--api-key flag", "CLI override" |

#### S₂: Model & Provider Management
| State ID | Description | Observable Signals |
|----------|-------------|-------------------|
| `s2.1` | Need model discovery | "available models", "list models" |
| `s2.2` | Need model selection | "pick model", "model cycling" |
| `s2.3` | Need custom provider | "self-hosted", "custom API" |
| `s2.4` | Need thinking level control | "reasoning", "extended thinking" |

#### S₃: Streaming & LLM Interaction
| State ID | Description | Observable Signals |
|----------|-------------|-------------------|
| `s3.1` | Need basic streaming | "stream response", "delta" |
| `s3.2` | Need tool-aware streaming | "tool calls", "function calling" |
| `s3.3` | Need context management | "token limit", "overflow" |
| `s3.4` | Need proxy routing | "through server", "proxy" |

#### S₄: Session & Persistence
| State ID | Description | Observable Signals |
|----------|-------------|-------------------|
| `s4.1` | Need session persistence | "save session", "continue session" |
| `s4.2` | Need session tree/branching | "fork", "branch", "navigate tree" |
| `s4.3` | Need compaction | "compact context", "summarize history" |
| `s4.4` | Need custom entries | "custom message type", "persist metadata" |

#### S₅: Tool & Extension System
| State ID | Description | Observable Signals |
|----------|-------------|-------------------|
| `s5.1` | Need tool registration | "register tool", "custom tool" |
| `s5.2` | Need tool execution | "execute tool", "run command" |
| `s5.3` | Need event subscription | "on tool_result", "subscribe to events" |
| `s5.4` | Need UI interactions | "prompt user", "select", "notify" |

#### S₆: Agent Lifecycle
| State ID | Description | Observable Signals |
|----------|-------------|-------------------|
| `s6.1` | Need message queuing | "steering", "follow-up", "interrupt" |
| `s6.2` | Need agent events | "agent_start", "turn_end", "subscribe" |
| `s6.3` | Need full session harness | "createAgentSession", "complete setup" |
| `s6.4` | Need bare agent loop | "minimal", "no persistence" |

---

### 2. ACTION SPACE (A)

Actions map to **concrete SDK primitives**. Organized by package:

#### A₁: `@mariozechner/pi-coding-agent` Actions
| Action ID | SDK Primitive | Use When |
|-----------|--------------|----------|
| `a1.1` | `createAgentSession()` | Full harness with all defaults |
| `a1.2` | `AgentSession` class | Session with custom config |
| `a1.3` | `AuthStorage` | Credential persistence |
| `a1.4` | `ModelRegistry` | Model discovery + auth |
| `a1.5` | `SessionManager` | Session persistence + tree |
| `a1.6` | `SettingsManager` | User/project settings |
| `a1.7` | `DefaultResourceLoader` | Extension/skill/prompt discovery |
| `a1.8` | `ExtensionRunner` | Event emission |
| `a1.9` | `registerTool()` | Custom tool registration |
| `a1.10` | `executeBash()` | Command execution |
| `a1.11` | `KeybindingsManager` | Keyboard shortcuts |
| `a1.12` | Built-in tools (`readTool`, `bashTool`, etc.) | Standard file ops |

#### A₂: `@mariozechner/pi-ai` Actions
| Action ID | SDK Primitive | Use When |
|-----------|--------------|----------|
| `a2.1` | `streamSimple()` | Basic streaming with reasoning |
| `a2.2` | `stream()` | Full provider options |
| `a2.3` | `completeSimple()` / `complete()` | Non-streaming |
| `a2.4` | `getModel()` | Get specific model |
| `a2.5` | `getModels()` | List provider's models |
| `a2.6` | `registerApiProvider()` | Custom API provider |
| `a2.7` | `Type` (TypeBox) | Tool parameter schemas |
| `a2.8` | `AssistantMessageEventStream` | Custom stream handling |
| `a2.9` | `isContextOverflow()` | Overflow detection |
| `a2.10` | OAuth utilities (`loginAnthropic`, etc.) | OAuth flows |

#### A₃: `@mariozechner/pi-agent-core` Actions
| Action ID | SDK Primitive | Use When |
|-----------|--------------|----------|
| `a3.1` | `Agent` class | Full agent with queues/events |
| `a3.2` | `AgentTool` interface | Tool definition |
| `a3.3` | `agentLoop()` | Low-level loop start |
| `a3.4` | `agentLoopContinue()` | Continue without new prompt |
| `a3.5` | `streamProxy()` | Proxy routing |
| `a3.6` | `agent.subscribe()` | Event subscription |
| `a3.7` | `agent.steer()` / `agent.followUp()` | Message queuing |

#### A₄: Build Custom
| Action ID | Description | Use When |
|-----------|-------------|----------|
| `a4.1` | Effect.Service pattern | New service abstraction |
| `a4.2` | Declaration merging for `CustomAgentMessages` | Custom message types |
| `a4.3` | Custom `StreamFn` | Special streaming behavior |
| `a4.4` | Custom `convertToLlm` | Non-standard messages |

---

### 3. TRANSITION FUNCTION (T)

The transition function `T(s, a) → s'` follows a **decision tree**:

```
REQUIREMENT_STATE
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│ Q1: Does pi-coding-agent have a direct primitive?       │
│     (Check PI-CODING-AGENT-REF.md)                      │
└─────────────────────────────────────────────────────────┘
    │                           │
    ▼ YES                       ▼ NO
┌───────────┐           ┌─────────────────────────────────┐
│ Use a1.*  │           │ Q2: Does pi-ai have primitive?  │
│ (coding)  │           │     (Check PI-AI-REF.md)        │
└───────────┘           └─────────────────────────────────┘
                            │                   │
                            ▼ YES               ▼ NO
                        ┌───────────┐   ┌─────────────────────────────────┐
                        │ Use a2.*  │   │ Q3: Does pi-agent-core have it? │
                        │ (ai)      │   │     (Check PI-AGENT-CORE-REF.md)│
                        └───────────┘   └─────────────────────────────────┘
                                            │                   │
                                            ▼ YES               ▼ NO
                                        ┌───────────┐       ┌───────────┐
                                        │ Use a3.*  │       │ Use a4.*  │
                                        │ (core)    │       │ (custom)  │
                                        └───────────┘       └───────────┘
```

#### Concrete Transition Examples

| From State | Observation | Action | To State |
|------------|-------------|--------|----------|
| `s1.1` (need API storage) | "persist API key" | `a1.3` (AuthStorage) | RESOLVED |
| `s1.2` (need OAuth) | "login with Anthropic" | `a2.10` (loginAnthropic) | RESOLVED |
| `s3.1` (need streaming) | "stream with tool calls" | `a2.1` (streamSimple) | RESOLVED |
| `s3.4` (need proxy) | "route through server" | `a3.5` (streamProxy) | RESOLVED |
| `s4.1` (need persistence) | "save session" | `a1.5` (SessionManager) | RESOLVED |
| `s5.1` (need tool reg) | "register custom tool" | `a1.9` (registerTool) | RESOLVED |
| `s6.1` (need steering) | "interrupt agent" | `a3.7` (agent.steer) | RESOLVED |
| `s6.3` (need full harness) | "complete setup" | `a1.1` (createAgentSession) | RESOLVED |
| `s6.4` (need minimal loop) | "no persistence" | `a3.3` (agentLoop) | RESOLVED |

---

### 4. OBSERVABILITY ANALYSIS

**Verdict: POMDP (Partially Observable MDP)**

The agent operates under **partial observability** for these reasons:

#### 4.1 Hidden State Components

| Hidden Information | Why Hidden | Impact |
|-------------------|------------|--------|
| **Full API surface** | Reference docs are 6000+ lines; agent may not have read all | May miss better primitive |
| **Version differences** | APIs evolve; docs may be stale | May use deprecated pattern |
| **Codebase patterns** | Project may have custom abstractions over SDK | May duplicate existing work |
| **Compatibility constraints** | Some primitives don't compose well | May create integration bugs |

#### 4.2 Observation Function O(s) → o

The agent observes:
- User's requirement description (natural language)
- Skill's reference doc summaries
- Current file context (if reading code)
- Error messages from failed attempts

But CANNOT directly observe:
- Whether a pattern exists elsewhere in the codebase
- Runtime behavior of SDK primitives
- Performance characteristics
- Full dependency graph

#### 4.3 Belief State Maintenance

To reduce uncertainty, the agent should:
1. **Read reference docs** before selecting (reduces hidden API surface)
2. **Search codebase** for existing usages (`grep -r "AuthStorage"`)
3. **Check version** (`package.json` dependencies)
4. **Validate selection** with small test

---

### 5. REWARD STRUCTURE (R)

Implicit rewards in this decision process:

| Outcome | Reward | Description |
|---------|--------|-------------|
| Correct SDK match | +10 | Requirement satisfied with minimal code |
| Partial match | +5 | Works but suboptimal (e.g., used pi-ai when pi-coding-agent had wrapper) |
| Build custom unnecessarily | -5 | SDK had primitive but agent didn't find it |
| Build custom correctly | +7 | SDK genuinely lacks capability |
| Integration error | -10 | Selected incompatible primitives |

---

### 6. POLICY RECOMMENDATION

The optimal policy π*(s) for this MDP:

```
π*(s) = {
  IF s ∈ {full harness needs} → a1.1 (createAgentSession)
  IF s ∈ {auth/credential} → a1.3 (AuthStorage) ∪ a2.10 (OAuth)
  IF s ∈ {model ops} → a1.4 (ModelRegistry)
  IF s ∈ {streaming only} → a2.1 (streamSimple)
  IF s ∈ {agent lifecycle} → a3.1 (Agent) ∪ a3.3 (agentLoop)
  IF s ∈ {session persist} → a1.5 (SessionManager)
  IF s ∈ {tool reg} → a1.9 (registerTool)
  IF s ∉ any_known_state → a4.* (build custom)
}
```

---

### 7. DECISION TREE SUMMARY (for Skill v5 Format)

```
                    ┌──────────────────────┐
                    │ REQUIREMENT RECEIVED │
                    └──────────┬───────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
        ┌───────────┐    ┌───────────┐    ┌───────────┐
        │ HARNESS   │    │ STREAMING │    │ CUSTOM    │
        │ FEATURE   │    │ ONLY      │    │ MESSAGE   │
        └─────┬─────┘    └─────┬─────┘    └─────┬─────┘
              │                │                │
              ▼                ▼                ▼
        pi-coding-agent   pi-ai           pi-agent-core
        (a1.*)            (a2.*)          (a3.*)
              │                │                │
              │                │                │
              └────────────────┴────────────────┘
                               │
                               ▼
                        ┌────────────────┐
                        │ SDK LOOKUP     │
                        │ (ref docs)     │
                        └───────┬────────┘
                                │
                        ┌───────┴───────┐
                        │               │
                        ▼               ▼
                   ┌─────────┐    ┌─────────┐
                   │ FOUND   │    │ NOT     │
                   │ MATCH   │    │ FOUND   │
                   └────┬────┘    └────┬────┘
                        │              │
                        ▼              ▼
                   USE SDK        BUILD CUSTOM
                   PRIMITIVE      (a4.*)
```

---

**Agent 1 (LaValle Planner) — Complete**

---

## Agent 2: Policy & Values (Sutton & Barto Optimization)

### 1. POLICY π(s) — Optimal Action for Each State

The policy maps requirement states to SDK primitives. I've organized this as a decision table with confidence scores.

#### Authentication & Credentials (S₁)

| State | Requirement | Optimal Action | Confidence | Rationale |
|-------|-------------|----------------|------------|-----------|
| `s1.1` | Store API key | `a1.3` AuthStorage.set(provider, {type:"api_key", key}) | 0.95 | AuthStorage handles persistence + env fallbacks |
| `s1.2` | OAuth flow | `a2.10` loginAnthropic/loginGeminiCli/etc | 0.90 | pi-ai OAuth utilities handle PKCE, device code, callbacks |
| `s1.3` | Dynamic key refresh | `a1.3` AuthStorage.getApiKey(provider) | 0.95 | Auto-refreshes OAuth tokens with file locking (D1 satisfied) |
| `s1.4` | Runtime override | `a1.3` AuthStorage.setRuntimeApiKey() | 0.90 | CLI --api-key flows through this |

**Policy Rule**: π(s1.*) = AuthStorage for persistence, pi-ai OAuth for login flows.

#### Model & Provider Management (S₂)

| State | Requirement | Optimal Action | Confidence | Rationale |
|-------|-------------|----------------|------------|-----------|
| `s2.1` | Model discovery | `a1.4` ModelRegistry.getAvailable() | 0.95 | Filters to authed models only |
| `s2.2` | Model selection | `a1.4` ModelRegistry.find(provider, id) | 0.90 | Returns Model\<Api\> with full config |
| `s2.3` | Custom provider | `a1.4` ModelRegistry.registerProvider() | 0.85 | Handles baseUrl, headers, oauth, models |
| `s2.4` | Thinking level | `a2.1` streamSimple({reasoning: level}) | 0.95 | Auto-adjusts maxTokens via adjustMaxTokensForThinking |

**Policy Rule**: π(s2.*) = ModelRegistry for discovery/registration, streamSimple for reasoning config.

#### Streaming & LLM Interaction (S₃)

| State | Requirement | Optimal Action | Confidence | Rationale |
|-------|-------------|----------------|------------|-----------|
| `s3.1` | Basic streaming | `a2.1` streamSimple() | 0.95 | Handles reasoning, apiKey, budgets |
| `s3.2` | Tool-aware stream | `a2.1` streamSimple() with context.tools | 0.95 | Tool schemas via TypeBox validated by validateToolCall |
| `s3.3` | Context overflow | `a2.9` isContextOverflow(message, contextWindow) | 0.90 | Detects error + silent overflow |
| `s3.4` | Proxy routing | `a3.5` streamProxy() | 0.95 | Bandwidth-optimized events, reconstructs partials |

**Policy Rule**: π(s3.*) = streamSimple for direct, streamProxy for server-routed, isContextOverflow for detection.

#### Session & Persistence (S₄)

| State | Requirement | Optimal Action | Confidence | Rationale |
|-------|-------------|----------------|------------|-----------|
| `s4.1` | Session persistence | `a1.5` SessionManager.create/open/continueRecent | 0.95 | JSONL file format, entry tree |
| `s4.2` | Session tree/branch | `a1.5` SessionManager.branch/navigateTree | 0.90 | Maintains parentId chain, creates BranchSummaryEntry |
| `s4.3` | Compaction | `a1.2` AgentSession.compact() | 0.85 | Creates CompactionEntry, uses hooks for custom logic |
| `s4.4` | Custom entries | `a1.5` SessionManager.appendCustomEntry() | 0.90 | Extension-friendly, typed via CustomEntry\<T\> |

**Policy Rule**: π(s4.*) = SessionManager for raw ops, AgentSession for lifecycle-aware ops (compaction).

#### Tool & Extension System (S₅)

| State | Requirement | Optimal Action | Confidence | Rationale |
|-------|-------------|----------------|------------|-----------|
| `s5.1` | Tool registration | `a1.9` pi.registerTool() | 0.95 | TypeBox params, execute with signal+onUpdate |
| `s5.2` | Tool execution | Built-in tool + `a3.1` Agent tool dispatch | 0.85 | AgentTool.execute gets toolCallId, signal, onUpdate |
| `s5.3` | Event subscription | `a1.8` ExtensionRunner.on(eventType, handler) | 0.90 | Full event types: tool_call, tool_result, context, etc |
| `s5.4` | UI interactions | ExtensionUIContext (ctx.ui.select, notify) | 0.85 | Only in interactive mode, needs uiContext binding |

**Policy Rule**: π(s5.*) = pi.registerTool for tools, ExtensionRunner for events, ctx.ui for interactions.

#### Agent Lifecycle (S₆)

| State | Requirement | Optimal Action | Confidence | Rationale |
|-------|-------------|----------------|------------|-----------|
| `s6.1` | Message queuing | `a3.7` agent.steer() / agent.followUp() | 0.95 | steer interrupts, followUp waits for idle |
| `s6.2` | Agent events | `a3.6` agent.subscribe(fn) | 0.95 | Fine-grained: agent_start, turn_end, message_update |
| `s6.3` | Full harness | `a1.1` createAgentSession() | 0.95 | Wires auth, model, session, extensions, tools |
| `s6.4` | Bare loop | `a3.3` agentLoop() | 0.90 | Minimal, returns EventStream\<AgentEvent, AgentMessage[]\> |

**Policy Rule**: π(s6.*) = createAgentSession for full harness, Agent class for lifecycle, agentLoop for minimal.

---

### 2. TERMINATION β(s,a) — Decision Completion Conditions

A decision is **COMPLETE** when one of these conditions holds:

| Condition | Description | State |
|-----------|-------------|-------|
| β₁ | SDK primitive identified with >0.85 confidence | **RESOLVED** |
| β₂ | SDK primitive identified but constraint violation detected | **BLOCKED** (re-evaluate) |
| β₃ | No SDK primitive matches, custom build justified | **CUSTOM** |
| β₄ | Requirement ambiguous, need clarification | **UNCERTAIN** |

#### Termination Decision Tree

```
ANALYZE REQUIREMENT
    │
    ├─► Match found in decision table?
    │       │
    │       ├─► YES: confidence ≥ 0.85?
    │       │       │
    │       │       ├─► YES: Check constraints (Agent 3)
    │       │       │       │
    │       │       │       ├─► Constraints satisfied → β₁ RESOLVED
    │       │       │       └─► Constraint violated → β₂ BLOCKED
    │       │       │
    │       │       └─► NO: Search wider, consider alternatives
    │       │
    │       └─► NO: Requirement in SDK scope?
    │               │
    │               ├─► YES: β₄ UNCERTAIN (need clarification)
    │               └─► NO: β₃ CUSTOM (build it)
    │
    └─► Edge case: Multiple matches with similar confidence
            → Select by Q-value ordering (Section 4)
```

#### Constraint Satisfaction Checklist

Before marking RESOLVED, verify:

- [ ] **T constraints**: Temporal ordering satisfied (e.g., T1: registerBuiltInApiProviders before stream)
- [ ] **E constraints**: Required knowledge available (e.g., E2: know if OAuth or API key)
- [ ] **D constraints**: Deontic rules followed (e.g., D3: TypeBox for tool params)
- [ ] **A constraints**: Action effects compatible with system state

---

### 3. REWARD STRUCTURE R(s,a,s')

#### Positive Rewards (Good Choices)

| Reward | Value | Condition |
|--------|-------|-----------|
| R₊₁ | +10 | **SDK Reuse**: Used existing primitive instead of building custom |
| R₊₂ | +8 | **Type Safety**: Schema-backed (Effect Schema / TypeBox) |
| R₊₃ | +7 | **OAuth Handled**: AuthStorage manages refresh, not raw file reads |
| R₊₄ | +5 | **Event-Driven**: Uses subscription over polling |
| R₊₅ | +4 | **Signal Propagation**: AbortSignal flows through chain (D4) |
| R₊₆ | +3 | **Idiomatic**: Matches project patterns (Effect services, Atom state) |

#### Negative Rewards (Penalties)

| Reward | Value | Condition |
|--------|-------|-----------|
| R₋₁ | -15 | **Node API in Browser**: Used http.createServer, crypto in browser context (D2 violated) |
| R₋₂ | -10 | **Imperative in Effect**: Used raw mutations in Effect codebase (D5 violated) |
| R₋₃ | -8 | **Duplicate Abstraction**: Built what SDK already provides |
| R₋₄ | -6 | **Raw Type**: Used TypeScript interface when Schema required (D6 violated) |
| R₋₅ | -5 | **Missing AbortSignal**: Cancellation not propagated (D4 violated) |
| R₋₆ | -4 | **Blocking Handler**: Sync operation in async event handler (D7 violated) |

#### Reward Function

```
R(s, a, s') = Σ(applicable positive rewards) + Σ(applicable negative penalties)
```

**Example Calculation**:

| Scenario | Actions | Calculation | Net |
|----------|---------|-------------|-----|
| Use AuthStorage for OAuth | SDK reuse, OAuth handled, type safe | +10 +7 +8 = +25 | +25 |
| Raw file read for tokens | Missing SDK, no refresh, race conditions | -8 -10 = -18 | -18 |
| Custom streaming wrapper | May duplicate streamSimple | -3 (if SDK had it) | -3 |

---

### 4. Q-HEURISTICS — Module Value Rankings

Q-values estimate long-term reward for choosing each SDK module. Based on frequency of use, composability, and safety guarantees.

#### High-Value Modules (Q ≥ 0.8)

| Module | Q-Value | Justification |
|--------|---------|---------------|
| `AuthStorage` | 0.95 | Every harness needs auth; handles OAuth, env, runtime overrides, file locking |
| `ModelRegistry` | 0.90 | Central to model discovery; used in every prompt operation |
| `streamSimple()` | 0.90 | Default streaming path; handles reasoning, budgets, retries |
| `SessionManager` | 0.85 | Persistence critical for continuity; tree structure enables branching |
| `createAgentSession()` | 0.85 | One-liner setup; wires 8+ dependencies correctly |
| `Type` (TypeBox) | 0.85 | Required for tool params; validates streaming JSON |

#### Medium-Value Modules (0.5 ≤ Q < 0.8)

| Module | Q-Value | Justification |
|--------|---------|---------------|
| `Agent` class | 0.75 | Full lifecycle but may be too imperative for Effect codebases |
| `ExtensionRunner` | 0.70 | Event emission useful but requires bindCore() setup |
| `agentLoop()` | 0.65 | Minimal control but loses session/extension integration |
| `isContextOverflow()` | 0.65 | Useful but only needed at compaction decision points |
| `streamProxy()` | 0.60 | Only for server-routed architectures |

#### Low-Value Modules (Q < 0.5)

| Module | Q-Value | Justification |
|--------|---------|---------------|
| `Agent.replaceMessages()` | 0.40 | Direct mutation; prefer immutable state in Effect |
| `agentLoopContinue()` | 0.35 | Niche use case (retry without new prompt) |
| `OAuth login*()` raw | 0.30 | Prefer AuthStorage.login() which persists credentials |
| `KeybindingsManager` | 0.25 | Only for interactive CLI; not relevant to Effect services |
| `FooterDataProvider` | 0.20 | UI-specific; not applicable to headless harnesses |

#### Anti-Patterns (Q = 0, Avoid)

| Module/Pattern | Q-Value | Justification |
|----------------|---------|---------------|
| Raw `http.createServer` for OAuth | 0 | Violates D2 (server-only in browser) |
| Direct `auth.json` file reads | 0 | Violates D1 (must use AuthStorage) |
| `useState` for service state | 0 | Project prefers effect-atom (per AGENTS.md) |
| Raw TypeScript types for tools | 0 | Violates D3 (must use TypeBox) |

---

### 5. DECISION MATRIX — Quick Reference

For rapid policy lookup, use this matrix:

```
┌────────────────────────┬─────────────────────────────────┬──────────┐
│ REQUIREMENT            │ OPTIMAL SDK PRIMITIVE           │ PACKAGE  │
├────────────────────────┼─────────────────────────────────┼──────────┤
│ Store credentials      │ AuthStorage.set()               │ coding   │
│ OAuth login            │ loginAnthropic/Gemini/Copilot   │ ai       │
│ Get API key (dynamic)  │ AuthStorage.getApiKey()         │ coding   │
│ List available models  │ ModelRegistry.getAvailable()    │ coding   │
│ Register custom prov.  │ ModelRegistry.registerProvider()│ coding   │
│ Stream with reasoning  │ streamSimple({reasoning})       │ ai       │
│ Stream via proxy       │ streamProxy()                   │ core     │
│ Detect context overflow│ isContextOverflow()             │ ai       │
│ Persist session        │ SessionManager.create/append*() │ coding   │
│ Branch session         │ SessionManager.branch()         │ coding   │
│ Compact context        │ AgentSession.compact()          │ coding   │
│ Register tool          │ pi.registerTool()               │ coding   │
│ Subscribe to events    │ ExtensionRunner.on()            │ coding   │
│ UI prompts             │ ctx.ui.select/notify            │ coding   │
│ Steer mid-run          │ agent.steer()                   │ core     │
│ Follow-up message      │ agent.followUp()                │ core     │
│ Full harness setup     │ createAgentSession()            │ coding   │
│ Bare agent loop        │ agentLoop()                     │ core     │
│ Custom message types   │ CustomAgentMessages (declare)   │ core     │
└────────────────────────┴─────────────────────────────────┴──────────┘
```

---

### 6. EFFECT-TS INTEGRATION GUIDELINES

Per AGENTS.md, this project uses Effect-TS patterns. Adapt SDK usage accordingly:

#### Pattern: Wrap Imperative SDK in Effect

```typescript
// DON'T: Direct SDK call
const models = await modelRegistry.getAvailable();

// DO: Wrap in Effect
const getAvailableModels = Effect.sync(() => modelRegistry.getAvailable());
```

#### Pattern: SDK + Atom State

```typescript
// Atom for reactive model list
export const modelsAtom = Atom.make<Model<Api>[]>([]);

// Effect that updates atom
const refreshModels = Effect.gen(function* () {
  const registry = yield* ModelRegistryService;
  const models = registry.getAvailable();
  Atom.set(modelsAtom, models);
});
```

#### Pattern: AuthStorage as Effect Service

```typescript
class AuthService extends Effect.Service<AuthService>()("app/AuthService", {
  effect: Effect.gen(function* () {
    const storage = new AuthStorage();
    return {
      getApiKey: (provider: string) => 
        Effect.promise(() => storage.getApiKey(provider)),
      refresh: () => Effect.sync(() => storage.reload()),
    };
  }),
}) {}
```

---

### 7. DECISION ALGORITHM

Given a requirement R, execute this algorithm:

```
FUNCTION selectSDKPrimitive(R):
  1. CLASSIFY R into state category S₁..S₆
  2. LOOKUP optimal action from policy table
  3. IF confidence < 0.85:
       SEARCH related states for alternatives
  4. FOR each candidate action a:
       CHECK Agent 3 constraints
       IF constraint violated:
         MARK a as blocked, try next
  5. IF no unblocked action found:
       IF R is in SDK scope:
         RETURN β₄ (need clarification)
       ELSE:
         RETURN β₃ (build custom)
  6. SELECT highest Q-value unblocked action
  7. RETURN β₁ (RESOLVED) with action
```

---

**Agent 2 (Sutton & Barto Optimizer) — Complete**

---

## Agent 4: Verification (Huth & Ryan Analysis)

### SAFETY PROPERTIES (Bad things that must never happen)

| ID | Property | Status | Evidence | Gap |
|----|----------|--------|----------|-----|
| S1 | Never import server-only SDK in browser bundle | ✓ | D2 explicitly forbids: `F(import server-only in browser)`. OAuth utilities (loginAnthropic, loginGeminiCli) documented as "CLI only" with http.createServer(). | — |
| S2 | Never use stale OAuth tokens without refresh | ◐ | T2 covers reload before getApiKey(). A2 covers refresh updating auth.json. BUT: No explicit constraint that AuthStorage.getApiKey() auto-refresh is REQUIRED vs optional. Ref shows priority chain handles it, but constraint is implicit. | Add: `O(auto-refresh in getApiKey)` |
| S3 | Never mix imperative AgentSession with Effect services | ✗ | **NOT COVERED.** AGENTS.md mandates Effect.Service pattern + effect-atom. SDK has imperative AgentSession class. No constraint prevents mixing paradigms. | Critical gap: Add deontic constraint |
| S4 | Never bypass AuthStorage for credential access | ◐ | D1 covers OAuth refresh specifically. BUT: General credential access (API keys from env, fallback resolver) not constrained. | Strengthen D1 to cover all credential paths |

**Safety Verdict: 1 ✓, 2 ◐, 1 ✗**

---

### LIVENESS PROPERTIES (Good things that must eventually happen)

| ID | Property | Status | Evidence | Gap |
|----|----------|--------|----------|-----|
| L1 | Every SDK usage decision must terminate with concrete choice | ✓ | Agent 1's MDP has terminal RESOLVED states. Decision tree has finite depth. Policy π*(s) covers all macro-states. | — |
| L2 | Every auth requirement must resolve to valid API key | ◐ | AuthStorage.getApiKey() has 5-step priority chain (ref docs). T2 ensures reload. BUT: No constraint handles case where ALL sources fail. No error propagation path defined. | Add: `□(auth_failure → explicit_error)` |
| L3 | Every model selection must resolve to streamable model | ◐ | T1 + T4 cover registration/refresh ordering. E1 covers API knowledge. BUT: No constraint ensures getAvailable() returns non-empty set, or that selected model has valid auth. | Add: `□(model_selected → auth_valid(model))` |

**Liveness Verdict: 1 ✓, 2 ◐**

---

### CONSISTENCY CHECK (Contradictions between agents)

| Check | Status | Finding |
|-------|--------|---------|
| Agent 1 ↔ Agent 3: OAuth path | ✓ | s1.2 → a2.10 (OAuth utilities) consistent with D2 (server-only constraint) |
| Agent 1 ↔ Agent 3: Session lifecycle | ✓ | s6.3 → a1.1 consistent with T3 (createAgentSession before prompt) |
| Agent 1 ↔ Agent 3: Tool registration | ✓ | s5.1 → a1.9 consistent with T8 (register before invoke) |
| Agent 1 ↔ Agent 3: Streaming prerequisites | ✓ | Transition tree respects T1 (registerBuiltInApiProviders → stream) |
| **STRUCTURAL ANOMALY** | ⚠️ | **Agent 2 (Russell-Norvig) is MISSING from blackboard.** Blackboard shows Agent 1 and Agent 3 only. Either Agent 2 failed to write, or ordering is Agent 1 → Agent 3 → Agent 2. |

**Consistency Verdict: All checked pairs consistent. Structural gap: Missing Agent 2.**

---

### COMPLETENESS CHECK (Gaps in coverage)

#### SDK Capabilities NOT Covered

| Capability | Location | Impact |
|------------|----------|--------|
| `executeBash()` direct | bash-executor.ts | Agent 1 maps to bashTool but not direct BashExecutor usage |
| `KeybindingsManager` | keybindings.ts | Listed as a1.11 but no transition examples |
| `FooterDataProvider` | footer-data-provider.ts | UI state provider completely unmapped |
| `DefaultPackageManager` | package-manager.ts | Extension/skill installation not covered |
| `exportToHtml()` | export-html/ | Session export capability not mapped |
| `PromptTemplate` expansion | prompt-templates.ts | substituteArgs(), expandPromptTemplate() not covered |
| `migrateSessionEntries()` | session-manager.ts | Version migration not covered |

#### Agent 1 Action Space Gaps

| Missing Action | SDK Primitive | State It Would Serve |
|----------------|---------------|---------------------|
| a1.13 | `DefaultPackageManager.install()` | "install extension" |
| a1.14 | `session.fork()` / `session.navigateTree()` | s4.2 tree operations (partially E8) |
| a1.15 | `session.exportToHtml()` | "export session" |
| a2.11 | `validateToolCall()` / `validateToolArguments()` | Tool validation at runtime |
| a2.12 | `isContextOverflow()` | Overflow detection → compaction trigger |

#### Constraint Gaps (Agent 3)

| Missing Constraint | Type | Importance |
|--------------------|------|------------|
| Effect.Service ↔ AgentSession isolation | Deontic | CRITICAL: Project uses Effect, SDK is imperative |
| `O(validateToolArguments before execute)` | Deontic | Tool args can cause runtime crashes (per E7) |
| `□(stream_error → graceful_close)` | Dynamic | D10 covers obligation but not guarantee |
| `K_harness(model.maxTokens)` | Epistemic | Required for thinking budget calculation |
| `[abort()]pending_tools_cancelled` | Dynamic | Abort behavior not fully specified |

#### Harness Integration Gaps

| Integration Point | Status | Notes |
|-------------------|--------|-------|
| Effect.Service pattern | ✗ | AGENTS.md requires it; no SDK mapping |
| effect-atom state | ✗ | Project pattern; no SDK→atom guidance |
| EDIN workflow | ✗ | AGENTS.md defines it; no SDK phase mapping |
| Schema discipline | ◐ | D6 mentions it; no SDK type coverage |

---

### CRITICAL FINDINGS SUMMARY

#### 🔴 CRITICAL (Must Fix)

1. **S3 Violation Risk**: No constraint prevents mixing AgentSession (imperative) with Effect.Service (functional). Project AGENTS.md mandates Effect patterns. Add:
   ```
   D13: F(AgentSession methods in Effect.Service implementations)
   ```

2. **Agent 2 Missing**: Russell-Norvig Utility Analysis not present. Blackboard is incomplete.

#### 🟡 WARNING (Should Fix)

3. **S2/L2 Partial**: OAuth auto-refresh is implicit, not explicit constraint. Error path undefined.

4. **Action Space Incomplete**: 7+ SDK primitives unmapped (PackageManager, export, validation utils).

5. **Effect Integration Absent**: Project's core pattern (Effect.Service + Atom.make) has zero SDK mapping.

#### 🟢 NOTES

6. OAuth server-only constraint (S1) correctly specified with ref doc evidence.

7. Temporal ordering constraints (T1-T10) align with SDK initialization requirements.

8. Agent 1 ↔ Agent 3 findings are mutually consistent.

---

### OVERALL VERDICT

```
╔══════════════════════════════════════════════════════════════╗
║                       NEEDS_WORK                              ║
╠══════════════════════════════════════════════════════════════╣
║  Safety:      1 ✓  2 ◐  1 ✗                                  ║
║  Liveness:    1 ✓  2 ◐                                       ║
║  Consistency: PASS (checked pairs) / STRUCTURAL GAP (Agent 2)║
║  Completeness: 7+ SDK primitives unmapped, Effect gap        ║
╠══════════════════════════════════════════════════════════════╣
║  BLOCKING: Agent 2 analysis missing from blackboard          ║
║  BLOCKING: S3 (Effect/imperative isolation) unspecified      ║
╚══════════════════════════════════════════════════════════════╝
```

---

### RECOMMENDED ACTIONS

1. **Locate Agent 2 output** — Either re-run or retrieve from alternate location
2. **Add D13** — `F(AgentSession.* in Effect.gen blocks)` 
3. **Add E11** — `K_harness(model.maxTokens)` for thinking budget
4. **Expand A1 action space** — Add a1.13–a1.15, a2.11–a2.12
5. **Create Effect Integration Appendix** — Map SDK primitives to Effect.Service wrappers

---

**Agent 4 (Huth & Ryan Verifier) — Complete**
