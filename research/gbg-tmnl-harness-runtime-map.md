# GBG TMNL harness runtime map

Status: manual recovery after the revived runtime scout failed because it resumed with unsupported `gpt-5.3-codex`. Scope is the GBG repo only: `/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg`.

This report maps the actual missed runtime/session/transport/event-loop surfaces under `packages/tmnl/src/lib/harness`. It is research-only and uses file evidence; no ignored/token-bearing files or credential actions were inspected.

## Executive finding

The TMNL harness is not just a frontend chat wrapper. It is a **headless-capable Pi-facing agent runtime** with:

- an Effect `HarnessRuntime` port for open/resume/send/snapshot/abort/list/update/delete/fork/model catalog/events;
- a server-side `PiAiHarnessEngine` that wraps `@mariozechner/pi-ai` streaming and `@mariozechner/pi-coding-agent` auth/model/tool infrastructure;
- an event-sourced session model with JSONL persistence and in-memory fallback;
- a remote WebSocket protocol so browsers are consumers, not owners, of runtime state;
- tool manifests and tool loop hooks that connect into `PiAiToolRuntime` and extension/builtin tools;
- model registry / OAuth-aware provider selection, per-message model override, context compaction, prompt registry rebuilds, and fork/replay semantics.

This materially changes the owned-agent-SDK synthesis: `packages/tmnl/src/lib/harness` is a first-class SDK/harness core, not an incidental UI adapter.

## Primary files

| File | Observed role |
|---|---|
| `packages/tmnl/src/lib/harness/HarnessRuntime.ts` | Browser-safe service interface for the runtime port: sessions, send, snapshots, abort, extension UI response, metadata, fork, model catalog, event stream. |
| `packages/tmnl/src/lib/harness/HarnessRuntimeLive.ts` | Server-only live adapter from `HarnessRuntime` to `PiAiHarnessEngine`; wires JSONL store, built-in/extension tool runtime, stream client, event adapter, policy, interactive shell, and panel bus. |
| `packages/tmnl/src/lib/harness/PiAiHarnessEngine.ts` | Core event-loop/session engine over `@mariozechner/pi-ai`; owns session records, event sequencing, streaming rounds, tool loop, model override, compaction, persistence, fork/delete/list/update. |
| `packages/tmnl/src/lib/harness/PiAiStreamClient.ts` | Thin Effect service around `streamSimple(model, context, options)` from `@mariozechner/pi-ai`. |
| `packages/tmnl/src/lib/harness/PiAiPolicy.ts` | Config, model resolution, OAuth/API-key resolution through `AuthStorage`/`ModelRegistry`, and stream options. |
| `packages/tmnl/src/lib/harness/PiAiEventAdapter.ts` | Converts raw pi-ai stream events into harness provider markers and normalized adapter events. |
| `packages/tmnl/src/lib/harness/PiAiToolRuntime.ts` | Tool runtime port: manifest, max tool rounds, concurrent-friendly set, `execute(toolCall, onStreamChunk, signal)`. |
| `packages/tmnl/src/lib/harness/PiAiToolRuntimeBuiltins.ts` | Full builtin/extension/domain tool bridge; covered more deeply in `research/gbg-tmnl-harness-tools-map.md`. |
| `packages/tmnl/src/lib/harness/schemas.ts` | Local harness domain events: provider markers, session events, tool events, manifest, metrics, snapshots, envelopes, replay cursor, extension UI responses. |
| `packages/tmnl/src/lib/harness/HarnessSessionStore.ts` | Base session persistence contract and replay helpers. |
| `packages/tmnl/src/lib/harness/session/SessionStore.ts` | Extended store with list/update metadata. |
| `packages/tmnl/src/lib/harness/session/SessionStoreJSONL.ts` | Durable JSONL session/event/cursor store under `~/.tmnl/harness-sessions/` plus `.session-index.json`. |
| `packages/tmnl/src/lib/harness/HarnessSessionStoreMemory.ts` | In-memory store implementation for tests/default engine. |
| `packages/tmnl/src/lib/harness/HarnessRuntimeBrowser.ts` | Browser implementation of the same runtime port over remote WebSocket commands. |
| `packages/tmnl/src/lib/harness/HarnessBrowserTransport.ts` | Browser WebSocket transport with request/response correlation and event stream. |
| `packages/tmnl/src/lib/harness/HarnessBrowserRemoteSchemas.ts` | Current remote command/event protocol used by browser and server: `remote:*` commands plus chat/shell/panel events. |
| `packages/tmnl/src/lib/harness/server/HarnessRemoteWsServer.ts` | Effect/Bun WebSocket server that routes remote commands to `HarnessRuntime` and relays runtime/shell/panel events. |
| `packages/tmnl/src/lib/harness/prompt/*` | Self-adapting system prompt registry/factory/sections; rebuilt per turn and available through `prompt_context`. |
| `packages/tmnl/src/lib/harness/compaction/*` | Context compaction logic used by the engine when nearing model context limits or on context-overflow retry. |
| `packages/tmnl/src/lib/harness/docs/SESSION_FAILURE_MATRIX.md` and `SESSION_RESTART_REPLAY_DRILLS.md` | Failure/restart/replay posture documentation for sessions. |

## Runtime port: what clients can do

`HarnessRuntime.ts` defines a host-agnostic Effect service with `backend: 'pi-ai'` and these operations:

- `openSession(nodeId, role, { forceNew? })`
- `resumeSession(sessionId, fromSeq)`
- `send(sessionId, clientMessageId, text, thinkingLevel, modelOverride?)`
- `getAvailableModels()`
- `getSnapshot(sessionId, fromSeq)`
- `abortSession(sessionId)`
- `respondExtensionUI(sessionId, response)`
- `listSessions()`
- `updateSessionMeta(sessionId, patch)`
- `deleteSession(sessionId)`
- `forkSession(sessionId, atSeq?)`
- `events: Stream<HarnessEvent>`

Observed evidence:

- Interface in `HarnessRuntime.ts`.
- Server implementation delegates each operation to `PiAiHarnessEngine` in `HarnessRuntimeLive.ts` lines ~35-112.
- Browser implementation sends remote commands in `HarnessRuntimeBrowser.ts` lines ~203-380.

This is a real SDK seam: frontend, server, tests, or other adapters can consume the same runtime contract.

## Server live layer

`HarnessRuntimeLive.ts` wires the stack:

```text
HarnessRuntime
  → PiAiHarnessEngineCoreLive
      → HarnessSessionStoreJSONLLive
      → PiAiToolRuntimeWithBuiltins
      → AgentHarnessConfigDefault
      → PiAiStreamClientLive
      → PiAiEventAdapterLive
      → PiAiPolicyLive
  + InteractiveShellServiceLive
  + PanelEventBusLive
```

Observed evidence:

- `HarnessRuntimeLive.ts` starts with the server-only warning that it depends on Node-only modules through `PiAiHarnessEngine` / `PiAiPolicy` / `@mariozechner/pi-coding-agent`.
- It provides `HarnessSessionStoreJSONLLive`, `BunFileSystem.layer`, `PiAiToolRuntimeWithBuiltins`, `AgentHarnessConfigDefault`, `PiAiStreamClientLive`, `PiAiEventAdapterLive`, and `PiAiPolicyLive`.
- It `provideMerge`s `InteractiveShellServiceLive` and `PanelEventBusLive` as shared singletons.

This confirms frontend decoupling: the live runtime can exist server/headless; UI is only an optional remote consumer.

## Engine state model

`PiAiHarnessEngine.ts` keeps a live `SessionRecord` in memory with:

- `sessionId`, `nodeId`, `role`, `agentId`
- mutable `headSeq`
- `createdAt`
- cumulative usage/cost fields
- `compactionCount`
- `events` array
- `clientMessageIds` for idempotent sends
- `activeAssistantMessageId`
- `activeAbortController`
- selected `model`
- `context` with system prompt/messages/tools
- `promptRegistry`
- optional `panelQueryService`

Observed evidence:

- `SessionRecord` type near `PiAiHarnessEngine.ts` lines ~56-79.
- `sessionsRef`, `nodeToSessionRef`, `activeRunsRef`, `streamSemaphore`, and `eventsPubSub` initialized near lines ~247-252.

## Event sequencing and persistence

The engine has two event paths:

1. `appendEvent`: increments the session sequence, pushes event into the session record, publishes to PubSub, writes `HarnessEventEnvelope` to the store, and persists session metadata.
2. `emitDelta`: fast path for assistant text/thinking deltas; mutates `headSeq` and publishes to PubSub without JSONL persistence for hot-path performance.

Observed evidence:

- `appendEvent` near `PiAiHarnessEngine.ts` lines ~272-307.
- `emitDelta` near lines ~310-336; comments explicitly say no HashMap modify/store write/persistSession for deltas.
- Event schemas in `schemas.ts`: `HarnessEventBase` has `sessionId`, `seq`, and `at`; events include session open, tool manifest, send accepted, assistant start/delta/final, usage, context, metrics, tool events, provider markers, errors, heartbeats, and Genifer events.
- `HarnessSnapshot` contains `sessionId`, `headSeq`, and `events`.

Implication: consumers can replay structural events and subscribe to live deltas. The runtime has a performance-conscious event model instead of a naive append-every-token ledger.

## Session open

`openSession` does more than allocate an ID:

- reuses an existing node→session mapping unless `forceNew` is set;
- creates `sessionId` using policy prefix + `nanoid`;
- creates a session-scoped prompt registry through `makeDefaultRegistry({ cwd, tools, promptContextDocs })` and forks it;
- builds the initial system prompt from the registry;
- creates session context with registered tools plus `prompt_context` and optional `panel_eval`;
- stores the live session and node mapping;
- emits `chat:v2/session_opened`;
- emits `chat:v2/tool_manifest` so the client knows available tools.

Observed evidence:

- `openSession` near `PiAiHarnessEngine.ts` lines ~1639-1764.
- `HarnessToolManifestEvent` schema in `schemas.ts` lines ~279-292.
- Prompt registry factory in `prompt/factory.ts` includes identity, tool manifest, guidelines, inline UI, project context, and runtime stamp sections.

## Send / active run lifecycle

`send`:

- deduplicates by `clientMessageId`;
- supports per-message `modelOverride` using `ModelRegistry.find(provider, modelId)`;
- emits `send_accepted`, `ackLatencyMs`, and retry-count metric events;
- interrupts any existing active run for the session;
- forks a daemon fiber running `runSessionPrompt` under a stream semaphore;
- records daemon defects as harness error events.

Observed evidence:

- `send` near `PiAiHarnessEngine.ts` lines ~1767-1890.
- Model override branch near lines ~1775-1792.
- `activeRunsRef` handling and daemon fiber setup near lines ~1840-1886.
- Runtime/browser `send` carries `modelOverride` in `HarnessRuntime.ts`, `HarnessRuntimeLive.ts`, `HarnessRuntimeBrowser.ts`, and `HarnessBrowserRemoteSchemas.ts`.

## Assistant streaming loop

Inside `runSessionPrompt` / `runAssistantRound`:

- enforces `toolRuntime.maxToolRounds`;
- emits assistant start;
- resolves stream options through `PiAiPolicy.makeStreamOptions`, passing session model provider and reasoning support;
- rebuilds prompt from `session.promptRegistry` each turn;
- calls `PiAiStreamClient.stream(model, context, options)`;
- consumes the async iterable stream;
- fast-paths `text_delta` and `thinking_delta` into live deltas;
- adapts structural events into provider markers and tool events;
- records usage/context/metrics;
- invokes compaction when context pressure crosses threshold.

Observed evidence:

- `runAssistantRound` begins near `PiAiHarnessEngine.ts` line ~526.
- Stream option resolution and prompt rebuild near lines ~573-620.
- `PiAiStreamClient.stream` uses `streamSimple` from `@mariozechner/pi-ai` in `PiAiStreamClient.ts`.
- Fast-path text/thinking deltas near `PiAiHarnessEngine.ts` lines ~650-735.
- Provider marker adaptation through `PiAiEventAdapter.toProviderMarker` and `adapt`; see `PiAiEventAdapter.ts`.
- Compaction threshold and `executeCompaction` calls near `PiAiHarnessEngine.ts` lines ~1036-1118 and context-overflow retry near lines ~1431-1465.

## Tool loop hooks

The engine does not merely pass tools through. It controls the tool loop:

- tool round limit through `toolRuntime.maxToolRounds`;
- normal runtime dispatch through `toolRuntime.execute(toolCall, onStreamChunk, abortSignal)`;
- per-tool timeout policy from `PiAiPolicyConfig.toolTimeoutMs` with exempt `unboundedToolPatterns`;
- `prompt_context` interception for self-modifying prompt registry code;
- `panel_eval` interception for panel query/eval;
- tool output streaming through `HarnessToolEvent phase:'stream'`;
- progressive detail updates through `phase:'update'` when stream chunks carry `details`;
- final tool result through `phase:'end'`;
- `toolRoundTripMs` metric emission;
- parallel execution only for opt-in `concurrentFriendlyTools`, with results merged back into original order.

Observed evidence:

- Tool loop block near `PiAiHarnessEngine.ts` lines ~1157-1390.
- `PiAiToolRuntime.ts` defines `tools`, `maxToolRounds`, `concurrentFriendlyTools`, and `execute`.
- `PiAiToolRuntimeBuiltins.ts` wires SDK built-ins, extension tools, Genifer, GEOINT, spawn_panel, and interactive_shell (deep details in `research/gbg-tmnl-harness-tools-map.md`).

Implication: the harness can expose sophisticated tool capability directly to Pi-style model loops while remaining decoupled from UI rendering.

## Snapshots, resume, list/update/delete/fork

Snapshot/resume:

- `getSnapshot(sessionId, fromSeq)` loads persisted events after `fromSeq` and falls back to in-memory events if store load fails.
- `resumeSession` in `HarnessRuntimeLive.ts` is just `engine.getSnapshot`; browser runtime sends `remote:chat_v2_resume_session`.

Abort:

- `abortSession` aborts the active `AbortController`, interrupts active fiber, clears active state, and records `abortRequestedAtMs`.

List/update/delete:

- `listSessions` and `updateSessionMeta` are store-backed.
- `deleteSession` interrupts active run, aborts active controller, deletes from store, removes live session and node mapping.

Fork:

- loads source session and events from store;
- optionally truncates by `atSeq`;
- creates a new session ID;
- clones events with the new session ID;
- persists the new session and events;
- creates a live `SessionRecord` with source model/context/prompt registry when available.

Observed evidence:

- `getSnapshot` near `PiAiHarnessEngine.ts` lines ~1898-1919.
- `abortSession` near lines ~1921-1949.
- `listSessions`, `updateSessionMeta`, `deleteSession` near lines ~1952-1994.
- `forkSession` near lines ~1996-2130.
- `getAvailableModels` near lines ~2135-2165.

## Model catalog and auth path

`PiAiPolicy.ts` and `PiAiHarnessEngine.ts` together provide model/auth behavior:

- default config comes from `PI_HARNESS_PIAI_*` env keys;
- default provider/model: `openai-codex` / `gpt-5.5`;
- `resolveModel` uses `getModel(provider, model)` from `@mariozechner/pi-ai`;
- API key resolution uses `AuthStorage` and `ModelRegistry` from `@mariozechner/pi-coding-agent`;
- OAuth providers are refreshed via `authStorage.refreshOAuthTokenWithLock(provider)`;
- fallback checks `ModelRegistry.getApiKey` and a deprecated local `oauthAuthFile` path;
- `getAvailableModels` refreshes model registry and returns all models with an `available` boolean.

Observed evidence:

- `PiAiPolicyConfigSource` in `PiAiPolicy.ts`.
- `AuthStorage.create()` and `new ModelRegistry(authStorage)` in `PiAiPolicy.ts` and `PiAiHarnessEngine.ts`.
- `makeStreamOptions` in `PiAiPolicy.ts`.
- `getAvailableModels` in `PiAiHarnessEngine.ts`.

Security note: this report did not inspect auth files. It only reads source describing how auth would be resolved.

## Persistence / replay store

Base contract (`HarnessSessionStore.ts`):

- `upsertSession`
- `appendEvent`
- `loadSession`
- `loadEventsAfter`
- `saveCursor`
- `loadCursor`
- `deleteSession`
- helpers `deriveHeadSeq` and `toReplayEvents`

Extended contract (`session/SessionStore.ts`):

- `listSessions`
- `updateMeta`

JSONL live store (`session/SessionStoreJSONL.ts`):

- store directory: `~/.tmnl/harness-sessions/`;
- session file extension: `.jsonl`;
- index: `.session-index.json`;
- line types: `session_meta`, `event`, `cursor`;
- scans session files and writes/reads index;
- updates metadata fields such as name, autoTitle, tags, status/starred, messageCount, token usage, provider/model, preview, node, role, agentId.

In-memory store (`HarnessSessionStoreMemory.ts`):

- keeps sessions, event arrays, cursors, and metadata in Refs/HashMaps;
- implements list/update/delete for tests and default no-tool engine.

Observed evidence:

- `HarnessSessionStore.ts`.
- `session/SessionStoreJSONL.ts` constants and implementation.
- `HarnessSessionStoreMemory.ts`.

## Remote/browser seam

The browser does not own the runtime. It owns a transport adapter to the runtime.

Browser side:

- `HarnessRuntimeBrowser.ts` implements `HarnessRuntime` by sending remote commands and decoding typed payloads.
- `HarnessBrowserTransport.ts` opens a WebSocket to `/api/harness/ws` by default, tracks pending requests by `requestId`, and exposes an event stream from `remote:ws_event` envelopes.
- `HarnessBrowserRemoteSchemas.ts` defines commands such as:
  - `remote:chat_v2_open_session`
  - `remote:chat_v2_resume_session`
  - `remote:chat_v2_send`
  - `remote:chat_v2_get_snapshot`
  - `remote:chat_v2_abort`
  - `remote:get_available_models`
  - `remote:list_sessions`
  - `remote:update_session_meta`
  - `remote:delete_session`
  - `remote:fork_session`
  - plus interactive-shell control commands.
- Remote events are a union of `remote:chat_v2_event`, `remote:shell_event`, and `remote:panel_event`.

Server side:

- `server/HarnessRemoteWsServer.ts` accepts WebSocket connections at `/api/harness/ws` on port `8787`.
- It relays `runtime.events`, shell events, and panel events to clients.
- It routes incoming remote commands to `HarnessRuntime` methods.
- It uses an outbound queue and scoped fibers for writer/event loops.

Observed evidence:

- `HarnessBrowserRemoteSchemas.ts` command/event schema definitions.
- `HarnessBrowserTransport.ts` default URL and request/response event loop.
- `HarnessRemoteWsServer.ts` command relay and runtime/shell/panel event loops.

Implication: a server/headless runtime can execute tools and stream session events without any frontend. If a frontend exists, it is a projection/event consumer.

## Prompt registry and self-adapting context

`prompt/factory.ts` builds the default prompt registry with:

1. identity section;
2. tool manifest section;
3. guidelines;
4. inline UI section;
5. project context from AGENTS.md walk;
6. runtime stamp.

`PiAiHarnessEngine.ts` forks this registry per session, rebuilds it on each turn, and injects `prompt_context` as a callable tool when the registry exists.

Implication: tools and runtime state can alter prompt context in a governed way. This is directly relevant to an owned SDK because the system prompt is not a static string; it is an effectful, session-scoped registry.

## Compaction and failure posture

Observed surfaces:

- `compaction/compact.ts`, `cut-point.ts`, `summarize.ts` and tests.
- `PiAiHarnessEngine.ts` calls `executeCompaction` when context pressure exceeds `contextWindow - compactionReserveTokens`, emits context events for compacting/completed, injects a `compaction-summary` prompt entry, updates messages, increments `compactionCount`, and emits `compactionTokensSaved`.
- A context-overflow `stopReason === 'error'` retry path also attempts compaction.
- Docs under `docs/SESSION_FAILURE_MATRIX.md` and `docs/SESSION_RESTART_REPLAY_DRILLS.md` show this subsystem is designed with restart/replay failure modes in mind.

## What this means for the owned agent SDK synthesis

The earlier synthesis understated the sophistication of the GBG repo. Corrected framing:

```text
Pi / pi-ai provider stream
  ↓
TMNL Harness Runtime (sessions, events, replay, forks, model override, tool loop)
  ↓
PiAiToolRuntime (builtins, extension allowlist, domain tools, interactive shell)
  ↓
Prompt Registry + Compaction + Session Store
  ↓
Optional browser/server WS projection (frontend decoupled)
```

Key correction: `packages/tmnl/src/lib/harness` is the primary Pi-interfacing runtime, and `packages/tmnl/src/lib/agents` is a separate but related agent-calling/auth/provider/durability subsystem. `@tmnl/codemode`, OpenProse/Reactor, PCT/LNK/MSH/STX, and LimitlessRP should now be shown around this harness core, not instead of it.

## Visual explainer lanes to add

1. **Harness runtime port** — `HarnessRuntime.ts` operation surface.
2. **Live server layer** — `HarnessRuntimeLive.ts` composition of engine/store/tool/policy/stream/event services.
3. **Pi stream adapter** — `PiAiStreamClient.ts` + `PiAiPolicy.ts` + `@mariozechner/pi-ai`.
4. **Event-sourced session engine** — `PiAiHarnessEngine.ts`, `schemas.ts`, `appendEvent`, `emitDelta`.
5. **Tool loop** — max rounds, tool events, prompt_context, panel_eval, timeouts, concurrent-friendly tools.
6. **Persistence/replay** — JSONL session store and in-memory store.
7. **Fork/resume/delete/list metadata** — store-backed operational session management.
8. **Browser as projection** — `HarnessRuntimeBrowser.ts`, `HarnessBrowserTransport.ts`, `HarnessRemoteWsServer.ts`.
9. **Prompt registry / compaction** — adaptive context as a runtime capability.
10. **SDK implication** — frontend-decoupled headless agent harness that can directly interface with Pi and load tools/extensions.

## Open questions for follow-up

- Which parts of `packages/tmnl/src/lib/harness` should be extracted into a package boundary distinct from the TMNL app tree?
- Should `HarnessRemoteSchemas.ts` transitional `harness:*` protocol be retired in favor of the newer `remote:*` browser protocol?
- Should delta persistence remain PubSub-only, or should there be configurable token-level replay for selected sessions?
- What are the exact API boundaries between `@tmnl/codemode` and this harness runtime?
- Should extension allowlist/tool loading become a policy module shared with codemode/pi-prose?
