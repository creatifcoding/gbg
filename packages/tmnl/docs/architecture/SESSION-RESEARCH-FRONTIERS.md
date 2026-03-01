# Session Management — Research Frontiers

> **Status**: Research synthesis — input to SessionCapable API design  
> **Date**: 2026-02-28  
> **Author**: Val  
> **Depends on**: `SESSION-ARCHITECTURE-AUDIT.md`

---

## Table of Contents

1. [pi Internals — Deep Cut](#1-pi-internals--deep-cut)
2. [Effect Ecosystem Patterns](#2-effect-ecosystem-patterns)
3. [Multi-Agent Session Orchestration](#3-multi-agent-session-orchestration)
4. [Event Sourcing & CQRS](#4-event-sourcing--cqrs)
5. [DAW Session Architecture](#5-daw-session-architecture)
6. [Browser Persistence Patterns](#6-browser-persistence-patterns)
7. [Synthesis — Design Primitives](#7-synthesis--design-primitives)

---

## 1. pi Internals — Deep Cut

### 1.1 SessionManager — The Tree

pi's `SessionManager` (in `pi-coding-agent/src/core/session-manager.ts`) is an **append-only tree** stored as JSONL.

**Core data structure:**
- Every entry has `{ id, parentId, timestamp }` — forming a tree, not a flat log
- `leafId` — a mutable pointer to the current tip of the active branch
- `byId: Map<string, SessionEntry>` — O(1) lookup by ID
- `labelsById: Map<string, LabelEntry>` — bookmarks on any node
- `fileEntries: SessionEntry[]` — the full file contents in memory

**Tree navigation — `getBranch(fromId?)`:**
1. Start at `fromId` (or `leafId`)
2. Walk `parentId` chain to root via `byId` map
3. Collect entries using `unshift()` → root-first chronological order
4. Return path array

**Branching — `branch(branchFromId)`:**
- Simply sets `leafId = branchFromId`
- Old branch entries remain in file (append-only, never deleted)
- Next `appendXXX()` call creates a child of new leafId → new branch grows
- `branchWithSummary()` also appends a `BranchSummaryEntry` summarizing the abandoned path

**Context building — `buildSessionContext()`:**
1. Walk leaf→root path via `getBranch(leafId)`
2. Find most recent `thinking_level_change`, `model_change`, `compaction` in path
3. If `CompactionEntry` found:
   - Emit `CompactionSummaryMessage` (summary + tokensBefore)
   - Emit messages from `firstKeptEntryId` → compaction entry
   - Emit messages after compaction entry
4. If no compaction: emit all `message`, `custom_message`, `branch_summary` entries
5. `custom`, `label`, `session_info`, `thinking_level_change`, `model_change` → no LLM messages

### 1.2 Session Entry Types — Complete Union

```typescript
// Base for all tree entries
interface SessionEntryBase {
  type: string;
  id: string;
  parentId: string | null;
  timestamp: string;
}

// First line of file — NOT in tree
interface SessionHeader {
  type: "session";
  version?: number;       // Currently v3, auto-migrates from older
  id: string;
  timestamp: string;
  cwd: string;
  parentSession?: string; // For forked sessions
}

// Conversation messages
interface SessionMessageEntry extends SessionEntryBase {
  type: "message";
  message: AgentMessage;  // user | assistant | toolResult | custom roles
}

// Thinking level changes
interface ThinkingLevelChangeEntry extends SessionEntryBase {
  type: "thinking_level_change";
  thinkingLevel: string;  // "none" | "low" | "medium" | "high"
}

// Model switches
interface ModelChangeEntry extends SessionEntryBase {
  type: "model_change";
  provider: string;
  modelId: string;
}

// Context compaction
interface CompactionEntry<T = unknown> extends SessionEntryBase {
  type: "compaction";
  summary: string;           // LLM-generated summary of old messages
  firstKeptEntryId: string;  // Messages from here onward are still "live"
  tokensBefore: number;      // Token count before compaction
  details?: T;               // Extension data (e.g., ArtifactIndex)
  fromHook?: boolean;        // True if extension-generated
}

// Branch summaries (when switching branches)
interface BranchSummaryEntry<T = unknown> extends SessionEntryBase {
  type: "branch_summary";
  fromId: string;            // The entry we branched from
  summary: string;           // LLM summary of abandoned branch
  details?: T;
  fromHook?: boolean;
}

// Extension state (NOT sent to LLM)
interface CustomEntry<T = unknown> extends SessionEntryBase {
  type: "custom";
  customType: string;
  data?: T;
}

// Extension messages (IS sent to LLM as user message)
interface CustomMessageEntry<T = unknown> extends SessionEntryBase {
  type: "custom_message";
  customType: string;
  content: string | (TextContent | ImageContent)[];
  details?: T;
  display: boolean;          // Show in TUI?
}

// Bookmarks
interface LabelEntry extends SessionEntryBase {
  type: "label";
  targetId: string;          // Which entry is labeled
  label: string | undefined; // null clears the label
}

// Session metadata (display name)
interface SessionInfoEntry extends SessionEntryBase {
  type: "session_info";
  name?: string;
}
```

**Serialization**: `JSON.stringify(entry) + "\n"` per line. Read via `content.split("\n").map(JSON.parse)`.

### 1.3 AgentSession — The Lifecycle

`AgentSession` is the **orchestrator** that wires `Agent` (LLM loop) + `SessionManager` (persistence) + extensions.

**Lifecycle:**
1. `createAgentSession(options)` → creates Agent, SessionManager, wires subscriptions
2. `session.prompt(userMessage)` → `Agent.sendMessage()` → LLM streaming
3. Agent emits events: `message_start`, `message_update`, `message_end`, `agent_end`
4. `AgentSession._handleAgentEvent()` → persists messages, dispatches to extensions
5. After `agent_end` → `_checkCompaction()` evaluates token thresholds

**Auto-compaction triggers:**
- **Overflow**: LLM returns context overflow error → remove error, compact, retry
- **Threshold**: `contextTokens > contextWindow - reserveTokens` (reserveTokens = 16384)

**Compaction process:**
1. Walk backward from newest, estimating tokens until `keepRecentTokens` limit
2. Cut point must be: user message, assistant message, BashExecution, or custom message
3. Collect messages from last compaction (or start) to cut point
4. Send to LLM for structured summary
5. Append `CompactionEntry` with summary + `firstKeptEntryId`
6. Reload session — Agent sees summary + kept messages

**Forking:**
- `session.fork(entryId)` → `SessionManager.createBranchedSession(entryId)`
- Extracts root→entryId path into a new `.jsonl` file
- New session is independent — original untouched

### 1.4 pi-ai — streamSimple and sessionId

```typescript
interface StreamOptions {
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;        // Cancellation
  apiKey?: string;             // Runtime override
  cacheRetention?: string;
  sessionId?: string;          // → Provider cache keying
  headers?: Record<string, string>;
  onPayload?: (payload: unknown) => void;
  maxRetryDelayMs?: number;
  metadata?: Record<string, unknown>;
}

interface SimpleStreamOptions extends StreamOptions {
  reasoning?: ThinkingLevel;
  thinkingBudgets?: ThinkingBudgets;
}
```

**Provider mapping:**
- OpenAI Codex: `sessionId` → `prompt_cache_key` body field + `conversation_id`/`session_id` headers
- Other providers: sessionId may be ignored or used differently
- We pass our `chat-v2-piai-{nanoid}` straight through — providers see it

**Pipeline:**
1. `streamSimple(model, context, options)` → `resolveApiProvider(model.api)`
2. Provider-specific `streamSimple` translates reasoning level
3. Returns `AssistantMessageEventStream` (async iterable)
4. Events: `start`, `text_delta`, `thinking_delta`, `toolcall_delta`, `done`

### 1.5 pi-web-ui — Browser Session Store

pi's own web UI uses **IndexedDB** via `AppStorage`:

```
AppStorage (singleton)
├── SessionsStore
│   ├── "sessions" object store → SessionData (full messages)
│   └── "sessions-metadata" object store → SessionMetadata (lightweight)
├── SettingsStore
├── ProviderKeysStore
└── CustomProvidersStore
     ↓
IndexedDBStorageBackend
     ↓
Browser IndexedDB
```

**SessionData:**
```typescript
interface SessionData {
  id: string;
  title: string;
  model: string;
  thinkingLevel: string;
  messages: AgentMessage[];
  createdAt: number;
  lastModified: number;
}
```

**SessionMetadata (lightweight for listing):**
```typescript
interface SessionMetadata {
  id: string;
  title: string;
  createdAt: number;
  lastModified: number;
  messageCount: number;
  usage: { tokens: number; cost: number };
  thinkingLevel: string;
  preview: string;
}
```

**Session operations:**
- **Create**: Clear session ID from URL, reload. On first user message, generate new `currentSessionId`, save.
- **Resume**: `loadSession(id)` → fetch `SessionData` from IndexedDB → init new `Agent` with messages.
- **Delete**: Remove both `SessionData` and `SessionMetadata` from IndexedDB.
- **Offline**: IndexedDB is local — sessions survive offline. URL-based session routing on reconnect.

---

## 2. Effect Ecosystem Patterns

### 2.1 Effect.Service + Ref + KeyValueStore + PubSub + Scope

The canonical pattern for a stateful service with lifecycle:

```typescript
class SessionManager extends Effect.Service<SessionManager>()("SessionManager", {
  // ... service shape
}) {
  static Live = Layer.scoped(SessionManager, Effect.gen(function* () {
    // Mutable state via Ref
    const sessionsRef = yield* Ref.make(new Map<string, SessionState>());
    
    // Persistence via KeyValueStore
    const store = yield* BackingPersistence;
    const kvs = yield* store.make("sessions");
    
    // Event broadcast via PubSub
    const events = yield* PubSub.unbounded<SessionEvent>();
    
    // Lifecycle via Scope
    yield* Scope.addFinalizer(Effect.gen(function* () {
      // Cleanup on dispose
    }));
    
    return SessionManager.of({ /* methods */ });
  }));
}

// Layer composition
const Live = SessionManager.Live.pipe(
  Layer.provide(Persistence.layerKeyValueStore),
  Layer.provide(KeyValueStore.layerLocalStorage)  // or layerMemory for tests
);
```

**Key insight**: `Ref` for hot state, `KeyValueStore` for warm/cold persistence, `PubSub` for reactive events, `Scope` for lifecycle finalization. Layer composition swaps implementations (memory, localStorage, SQLite) without changing service code.

### 2.2 @effect/experimental — EventLog + Machine

**EventLog** — event sourcing with Schema-backed payloads:

```typescript
// Define events with Schema
class SessionCreated extends Event.Tagged("SessionCreated", {
  payload: Schema.Struct({
    sessionId: Schema.String,
    config: SessionConfig
  }),
  success: Schema.Void,
  error: Schema.Never
}) {}

// Group events
const SessionEvents = EventGroup.make("Session", { SessionCreated, SessionEnded })

// Create schema and handlers
const schema = EventLog.schema(SessionEvents);
const handlers = EventLog.group(SessionEvents, (h) =>
  h.add(SessionCreated, ({ payload }) => 
    Effect.log(`Session ${payload.sessionId} created`)
  )
);

// Layer
const EventLogLive = EventLog.layer(schema).pipe(Layer.provide(handlers));
```

**Machine** — effectful state machines:

```typescript
const sessionMachine = Machine.makeWith<SessionState, SessionConfig>()(
  (config, previous) =>
    Machine.procedures.make(previous ?? initialState(config), {
      identifier: `Session(${config.id})`
    }).pipe(
      Machine.procedures.add<Connect>()("Connect", ({ state }) =>
        Effect.sync(() => {
          const next = { ...state, status: "connected" };
          return [next, next];  // [newState, returnValue]
        })
      ),
      Machine.procedures.add<Disconnect>()("Disconnect", ({ state }) =>
        Effect.sync(() => {
          const next = { ...state, status: "disconnected" };
          return [next, next];
        })
      )
    )
);

// Boot and interact
const actor = yield* Machine.boot(sessionMachine, config);
const state = yield* actor.send(new Connect());
```

**Composability**: EventLog persists events, Machine validates transitions. Together they form event-sourced state machines with Schema validation at every boundary.

### 2.3 @effect/ai — Chat.Persisted

The closest existing pattern to what we need:

```typescript
// Create persisted chat service
const ChatPersistenceLive = Chat.layerPersisted.pipe(
  Layer.provide(Persistence.layerKeyValueStore),
  Layer.provide(KeyValueStore.layerLocalStorage)
);

// Usage
const persistence = yield* Chat.Persistence;
const chat = yield* persistence.getOrCreate("session-123");

// Chat maintains history in Ref, auto-persists after each generation
yield* chat.generateText({ prompt: Prompt.user("Hello") });
yield* chat.save;  // Explicit save (also auto-saves after generate)

// Export/restore
const json = yield* chat.exportJson;
const restored = yield* Chat.fromJson(json);
```

**Architecture:**
- `Chat.Service` wraps `Ref<Prompt.Prompt>` for message history
- `Chat.Persisted` extends with `id` + `save` + auto-persistence
- Persistence via `BackingPersistence` (KeyValueStore abstraction)
- After each `generateText`/`streamText`, `saveChat()` serializes history to KVS
- `messageId` tracking for incremental persistence

**What this gives us**: A proven pattern for "stateful conversation with persistence" in the Effect ecosystem. But it's flat (no tree), no branching, no compaction, no multi-instance.

### 2.4 effect-atom — React Integration Layer

**Atom.runtime** — bridges Effect services to React:

```typescript
const runtimeAtom = Atom.runtime(SessionManager.Live);

// Derived atom — reads from service
const sessionsAtom = runtimeAtom.atom(
  Effect.gen(function* () {
    const sm = yield* SessionManager;
    return yield* sm.listSessions();
  })
);

// Mutation atom — writes to service
const createSessionAtom = runtimeAtom.fn(
  Effect.fnUntraced(function* (config: SessionConfig) {
    const sm = yield* SessionManager;
    return yield* sm.createSession(config);
  })
);

// React subscription
function SessionList() {
  const sessions = useAtomValue(sessionsAtom, Result.getOrElse(() => []));
  const createSession = useAtomSet(createSessionAtom);
  // ...
}
```

**Atom.family** — keyed state:

```typescript
const sessionAtom = Atom.family((id: string) =>
  runtimeAtom.atom(Effect.gen(function* () {
    const sm = yield* SessionManager;
    return yield* sm.getSession(id);
  }))
);
```

**Atom.kvs** — persistent atoms:

```typescript
const settingsAtom = Atom.kvs({
  runtime: Atom.runtime(BrowserKeyValueStore.layerLocalStorage),
  key: "session-settings",
  schema: SessionSettings,
  defaultValue: () => defaultSettings
});
```

**Key insight**: `Atom.runtime` is our bridge. Service state lives in the service (via Ref or Atom.make). React subscribes via derived atoms. Mutations flow through `runtimeAtom.fn`. `Atom.kvs` handles the warm tier (localStorage). This is our existing pattern — the architecture doc mandates "Atom-as-State" (Atom.make primary, not Ref inside services).

---

## 3. Multi-Agent Session Orchestration

### 3.1 Patterns from LangGraph / CrewAI / AutoGen

| Pattern | Session Model | State Flow |
|---------|---------------|------------|
| **Sequential Pipeline** | Shared session state passes outputs sequentially | Each agent writes to `session.state`, next reads |
| **Coordinator/Dispatcher** | Central agent maintains global session context | Coordinator routes tasks, collects results |
| **Parallel Fan-Out/Gather** | Independent session branches → synthesizer merges | Fork at dispatch, join at synthesis |
| **Hierarchical Decomposition** | Layered state propagation, parent→child sessions | Parent decomposes, children report up |
| **Generator-Critic** | Iterative state updates with feedback loops | Generator writes, critic reads+validates, loop |
| **Orchestrator-Worker (Event-Driven)** | Event streams as shared blackboard | PubSub topics per session, workers subscribe |

**Key insight for our design**: Multi-agent workflows need **session trees** (fork/join), **session isolation** (agent doesn't see other agent's context unless explicitly shared), and **session composition** (results from child sessions flow back to parent). This maps directly to pi's tree model — branches ARE agent threads, compaction IS summarization for parent context.

### 3.2 Implications

- `forkSession(atEntry)` = spawn agent on alternative branch
- `compactBranch(branchId)` = summarize agent's work for parent consumption
- `mergeBranch(source, target)` = bring results back to main branch
- Session metadata needs: `owner` (which agent), `parentSessionId` (coordinator), `role` (worker/critic/etc.)

---

## 4. Event Sourcing & CQRS

### 4.1 Append-Only Tree Patterns

**Event sourcing core**: State = f(events). Never mutate — replay to reconstruct.

**Tree branching in event sourcing:**
- Linear streams per aggregate (our current flat log)
- Tree via `parentId` references (pi's model)
- "What-if" replays: replay prefix → branch with hypothetical events
- Multiple projections from same event tree (different read models)

**CQRS split:**
- Write side: Append events, validate commands
- Read side: Build projections (views) from events, async, eventually consistent

**Snapshots** = compaction:
- Periodically snapshot current state
- Replay only events after snapshot
- Exactly what pi's `CompactionEntry` does with `firstKeptEntryId`

### 4.2 Mapping to Session Management

| Event Sourcing | Session Management |
|---------------|-------------------|
| Event Store | Session JSONL file |
| Aggregate | Session (conversation) |
| Event | Session entry (message, model change, etc.) |
| Snapshot | CompactionEntry |
| Projection | buildSessionContext() (LLM view), UI message list (React view) |
| Command | send(), branch(), compact(), fork() |
| Event Stream | PubSub / Stream for real-time updates |

**Key insight**: Our session IS an event-sourced aggregate. We should formalize it as such rather than treating JSONL as a dumb log.

---

## 5. DAW Session Architecture

### 5.1 Undo Tree Pattern

DAWs maintain a **tree of edits** where each node represents a state:
- Linear undo = walk back along current branch
- Branch = make a different edit from a past state → new branch grows
- Tree preserves ALL branches — nothing is lost
- Visitor pattern separates concerns: serialization, display, editing

### 5.2 Session Concepts from DAWs

| DAW Concept | Session Equivalent |
|-------------|-------------------|
| **Project file** | Session JSONL |
| **Track** | Session branch (or sub-session for multi-agent) |
| **Take folder** (Logic Pro) | Branch alternatives (try different prompts) |
| **Clip/Region** | Message entry |
| **Mixer state** | Session metadata (model, thinking level) |
| **Undo tree** | Session tree with parentId |
| **Collect All and Save** | Session fork (extract branch to new file) |
| **Automation lane** | Session metadata entries (model changes, thinking level changes) |

**Key insight**: DAWs solve the same problem we have — non-linear creative exploration with full history preservation. Their solution is always a tree.

---

## 6. Browser Persistence Patterns

### 6.1 Multi-Tier Architecture

```
HOT    → Atoms (Atom.make / Atom.family)     — in-memory, reactive, instant
WARM   → localStorage / Atom.kvs              — survives refresh, 5-10MB limit
COLD   → IndexedDB / JSONL / SQLite           — structured, queryable, 100MB+
FROZEN → Server-side JSONL / SQLite           — permanent, cross-device
```

**Tier transitions:**
- Hot→Warm: Debounced write-through (our Phase C pattern — `schedulePersist` 500ms)
- Warm→Cold: On explicit save, or when warm tier exceeds budget
- Cold→Frozen: Sync to server on reconnect, or explicit push
- Frozen→Hot: `hydrateContent()` on mount (our Phase C)

### 6.2 pi-web-ui's Two-Store Pattern

pi uses two IndexedDB stores:
- `sessions` → full `SessionData` (messages, model, etc.)
- `sessions-metadata` → lightweight `SessionMetadata` (title, preview, messageCount, usage)

**Why two stores**: Listing sessions needs metadata only (fast scan). Opening a session needs full data (lazy load). This is a **read-model optimization** — exactly CQRS in miniature.

### 6.3 Offline-First Considerations

- IndexedDB is fully offline — sessions survive network loss
- URL-based session routing: `?session=abc123` → load from IndexedDB on reconnect
- `navigator.storage.persist()` prevents browser eviction
- Conflict resolution on reconnect: server wins vs merge (depends on authority model)

---

## 7. Synthesis — Design Primitives

From all frontiers, these are the **irreducible primitives** a SessionCapable API needs:

### 7.1 Core Primitives

| Primitive | From | Description |
|-----------|------|-------------|
| **Session Tree** | pi, DAW, Event Sourcing | Append-only tree with `parentId` — branching is first-class |
| **Leaf Pointer** | pi | Mutable cursor to current tip — `branch()` moves it |
| **Entry Type Union** | pi | Extensible discriminated union of entry types (Schema.TaggedStruct) |
| **Context Projection** | pi, CQRS | `buildContext(leafId)` → walk tree, apply compaction, emit messages |
| **Compaction** | pi, Event Sourcing | Summarize old entries, record `firstKeptEntryId`, preserve full history |
| **Session Identity** | pi-ai, Split Authority | `TmnlSessionId` wrapping `PiSessionId` — separate but mapped |
| **Session Metadata** | pi-web-ui, Our current | Lightweight listing view separate from full session data |

### 7.2 Lifecycle Primitives

| Primitive | From | Description |
|-----------|------|-------------|
| **Create** | pi, Effect.Service | New session with config, initial leaf, persisted |
| **Resume** | pi, pi-web-ui | Load from persistence, rebuild in-memory index, set leafId |
| **Branch** | pi, DAW, Multi-Agent | Move leafId to earlier entry, new entries grow new branch |
| **Fork** | pi, Multi-Agent | Extract branch to new session file — independent copy |
| **Compact** | pi, Event Sourcing | Summarize old context, keep recent, append CompactionEntry |
| **Dispose** | Effect.Scope | Release resources, finalize subscriptions, close scope |

### 7.3 Integration Primitives

| Primitive | From | Description |
|-----------|------|-------------|
| **Atom.runtime** | effect-atom | Bridge service to React — derived atoms + mutation fns |
| **Atom.family** | effect-atom | Per-session atoms keyed by sessionId |
| **Atom.kvs** | effect-atom | Warm-tier persistence (localStorage) |
| **PubSub** | Effect | Event broadcast for real-time updates |
| **Machine** | @effect/experimental | State machine for session lifecycle transitions |
| **EventLog** | @effect/experimental | Event-sourced persistence with Schema validation |

### 7.4 Multi-Tier Persistence

| Tier | Technology | Access Pattern | TTL |
|------|-----------|----------------|-----|
| **Hot** | `Atom.make` / `Atom.family` | Reactive subscriptions, instant | Volatile |
| **Warm** | `Atom.kvs` (localStorage) | Survives refresh, fast read | 24h (configurable) |
| **Cold** | IndexedDB via Effect KVS | Structured queries, large data | Session lifetime |
| **Frozen** | Server JSONL (pi tree format) | Cross-device, permanent | Permanent |

### 7.5 Authority Model (Per User's Choice: Split)

| Domain | Authority | Rationale |
|--------|-----------|-----------|
| Execution state (streaming, tool results, model output) | **Server** | Only server runs pi-ai, has LLM context |
| Presentation state (active session, UI metadata, starred) | **Client** | Browser knows which session user is viewing |
| Persistence (content, messages) | **Both** | Server is canonical, client has warm cache for fast hydration |
| Session identity mapping | **Explicit table** | `TmnlSessionId ↔ PiSessionId` — separate ID spaces |

### 7.6 Design Constraints (From User's Questionnaire Answers)

1. **Split authority** — server owns execution, client owns presentation
2. **Single active per panel, many stored** — panels/tabs for plurality
3. **Separate IDs with explicit mapping** — our ID space, mapped to pi's
4. **Multi-tier persistence** — adopt pi's tree semantics (compaction, branching)
5. **ALL consumers** — kanban, agents, multi-agent, panels, replay

---

## Source Index

### pi Upstream (via DeepWiki badlogic/pi-mono)
- `pi-coding-agent/src/core/session-manager.ts` — SessionManager (tree, branching, compaction, buildSessionContext)
- `pi-coding-agent/src/core/agent-session.ts` — AgentSession (auto-compaction, forking, lifecycle)
- `pi-coding-agent/src/core/sdk.ts` — createAgentSession factory
- `pi-coding-agent/src/core/messages.ts` — convertToLlm, message transformation
- `pi-ai/src/streaming.ts` — streamSimple, StreamOptions, SimpleStreamOptions
- `pi-ai/src/api-registry.ts` — Provider resolution
- `pi-web-ui/src/storage/` — AppStorage, SessionsStore, IndexedDBStorageBackend

### Effect Ecosystem (via DeepWiki Effect-TS/effect)
- `packages/experimental/src/Persistence.ts` — BackingPersistence, ResultPersistence, layerKeyValueStore
- `packages/experimental/src/EventLog.ts` — EventLog, EventGroup, Event.Tagged
- `packages/experimental/src/Machine.ts` — Machine.make, Machine.boot, procedures
- `packages/ai/ai/src/Chat.ts` — Chat.Service, Chat.Persisted, Chat.Persistence
- `packages/platform/src/KeyValueStore.ts` — KeyValueStore interface

### effect-atom (via DeepWiki tim-smart/effect-atom)
- `packages/atom/src/Atom.ts` — Atom.runtime, Atom.family, Atom.kvs, Atom.fn
- `packages/atom-react/src/` — useAtomValue, useAtomSet

### External Research
- Multi-agent: LangGraph (graph-based), CrewAI (crew orchestration), AutoGen (conversational)
- Event sourcing: Append-only logs, snapshots as compaction, projections as read models
- DAW: Undo trees, take folders as branches, track stacks
- Browser: IndexedDB multi-store (data + metadata), offline-first, navigator.storage.persist()
