# GBG owned agent SDK + TMNL harness synthesis

Status: corrected synthesis after the missed `packages/tmnl/src/lib/harness` and `packages/tmnl/src/lib/agents` discovery. This supersedes earlier codemode/OpenProse-centered synthesis for Pi-interfacing SDK conclusions.

## Correction

The earlier synthesis over-centered `@tmnl/codemode`, OpenProse/Reactor, and a conceptual `graph-memory-session` phrase. Those are still relevant, but the real GBG Pi-interfacing SDK core already exists in two TMNL trees:

- `packages/tmnl/src/lib/harness/` — the runtime substrate: sessions, event loop, tool loop, model override, snapshots, JSONL replay, browser/server WebSocket seam, prompt registry, compaction.
- `packages/tmnl/src/lib/agents/` — the agent-calling and durability substrate: Pi OAuth bridge, provider middleware, `@effect/ai` layers, provider registry, agent task log durability/control plane.

The frontend is decoupled by design. The harness can run headlessly; UI attaches as a projection over `HarnessRuntime` events/snapshots.

## Corrected architecture spine

```text
Pi / @mariozechner/pi-ai stream + @mariozechner/pi-coding-agent auth/tools
  ↓
TMNL agents plane
  - PiAuthBridge
  - OpenAI Codex / Anthropic / env provider layers
  - provider registry
  - AgentHarnessConfig
  - agent-task NATS/JetStream durability plane
  ↓
TMNL harness runtime plane
  - HarnessRuntime service port
  - PiAiHarnessEngine event loop
  - PiAiPolicy model/auth/stream options
  - PiAiEventAdapter provider marker translation
  - PiAiToolRuntime tool port
  - JSONL session store / replay / fork / metadata
  ↓
Tool capability plane
  - SDK builtins
  - allowlisted Pi extension tools
  - prompt_context / panel_eval
  - interactive_shell
  - Genifer / spawn_panel
  - GEOINT
  ↓
Optional projection plane
  - HarnessRemoteWsServer
  - HarnessRuntimeBrowser
  - HarnessBrowserTransport
  - PiProvider / morphchat harness adapter
  - OverlayReducerPipeline
  ↓
Adjacent higher-order capabilities
  - @tmnl/codemode
  - OpenProse/Reactor
  - LimitlessRP
  - DMN / PCT / LNK / MSH / STX
```

## What the SDK actually consists of

### 1. Auth / identity plane

Evidence:

- `packages/tmnl/src/lib/agents/auth/PiAuthBridge.ts`
- `packages/tmnl/src/lib/agents/providers/openai.ts`
- `packages/tmnl/src/lib/agents/providers/anthropic.ts`
- `packages/tmnl/src/lib/agents/docs/ARCHITECTURE.md`

Observed role:

- Pi OAuth is lifted into Effect services.
- OpenAI/Codex and Anthropic OAuth are provider-specific middleware layers, not generic API key wrappers.
- Codex path rewrites request/response dialect and is stream-only.
- Anthropic path swaps `x-api-key` for bearer auth and requires Claude Code identity headers/system prompt.

### 2. Provider / policy plane

Evidence:

- `packages/tmnl/src/lib/agents/providers/index.ts`
- `packages/tmnl/src/lib/agents/AgentHarnessConfig.ts`
- `packages/tmnl/src/lib/harness/PiAiPolicy.ts`

Observed role:

- Provider registry exposes layer factories and model/provider entries.
- Harness policy resolves provider/model, API keys/OAuth, reasoning, retry/timeouts, cache retention, stream options, compaction settings, and unbounded tool patterns.
- `getAvailableModels()` surfaces all registry models with an `available` flag.

### 3. Runtime/session plane

Evidence:

- `packages/tmnl/src/lib/harness/HarnessRuntime.ts`
- `packages/tmnl/src/lib/harness/HarnessRuntimeLive.ts`
- `packages/tmnl/src/lib/harness/PiAiHarnessEngine.ts`
- `packages/tmnl/src/lib/harness/schemas.ts`

Observed role:

- `HarnessRuntime` is the stable consumer-facing contract: open/resume/send/snapshot/abort/respond/list/update/delete/fork/models/events.
- `HarnessRuntimeLive` wires server-only engine dependencies: JSONL store, built-in/extension tool runtime, policy, stream client, event adapter, interactive shell, panel bus.
- `PiAiHarnessEngine` owns session records, sequence numbers, active runs, abort controllers, model override, prompt registry, compaction, tool loops, event publication, and persistence.

### 4. Event/replay plane

Evidence:

- `packages/tmnl/src/lib/harness/schemas.ts`
- `packages/tmnl/src/lib/harness/HarnessSessionStore.ts`
- `packages/tmnl/src/lib/harness/session/SessionStoreJSONL.ts`
- `packages/tmnl/src/lib/harness/HarnessSessionStoreMemory.ts`

Observed role:

- Harness events are schema-first `chat:v2/*` events with `sessionId`, `seq`, and `at`.
- Structural events are appended/persisted; text/thinking deltas use a live fast path.
- JSONL sessions live under `~/.tmnl/harness-sessions/` with metadata, events, cursors, and `.session-index.json`.
- Fork loads source session/events, optionally truncates by sequence, clones event session IDs, persists the fork, and constructs a live record.

### 5. Tool capability plane

Evidence:

- `packages/tmnl/src/lib/harness/PiAiToolRuntime.ts`
- `packages/tmnl/src/lib/harness/PiAiToolRuntimeBuiltins.ts`
- `packages/tmnl/src/lib/harness/tools/registry.ts`
- `packages/tmnl/src/lib/harness/interactive-shell/*`
- `packages/tmnl/src/lib/genifer/harness/*`
- `packages/tmnl/src/lib/geoint/harness/*`

Observed role:

- `PiAiToolRuntime` defines manifest, max rounds, concurrent-friendly set, and tool execution.
- `PiAiToolRuntimeWithBuiltins` assembles builtins, allowlisted Pi extension tools, Genifer, `spawn_panel`, GEOINT, and interactive shell.
- Extension tools are loaded through Pi extension discovery with a minimal headless `ExtensionContext` and allowlist envs.
- The engine emits `chat:v2/tool_manifest` immediately after session open.
- Tool output streams through `chat:v2/tool_event` phases: `start`, `stream`, `update`, `end`.
- `prompt_context` and `panel_eval` are intercepted inside the engine before normal runtime dispatch.
- Only explicitly safe tools, currently `spawn_panel`, are concurrent-friendly; everything else is sequential by default.

### 6. Prompt/context plane

Evidence:

- `packages/tmnl/src/lib/harness/prompt/factory.ts`
- `packages/tmnl/src/lib/harness/prompt/PromptRegistry.ts`
- `packages/tmnl/src/lib/harness/prompt/tools/prompt-context-tool.ts`
- `packages/tmnl/src/lib/harness/compaction/*`

Observed role:

- Prompt registry builds identity, tool manifest, guidelines, inline UI, project context, and runtime stamp sections.
- Registry is forked per session and rebuilt per turn.
- `prompt_context` gives model-controlled but budget/reserved-key constrained access to prompt registry changes.
- Compaction inserts a `compaction-summary` entry and emits context/metric events.

### 7. Remote/browser projection plane

Evidence:

- `packages/tmnl/src/lib/harness/HarnessRuntimeBrowser.ts`
- `packages/tmnl/src/lib/harness/HarnessBrowserTransport.ts`
- `packages/tmnl/src/lib/harness/HarnessBrowserRemoteSchemas.ts`
- `packages/tmnl/src/lib/harness/server/HarnessRemoteWsServer.ts`
- `packages/tmnl/src/lib/ai-core/providers/pi/PiProvider.ts`
- `packages/tmnl/src/lib/morphchat/adapters/harness-adapter.ts`
- `packages/tmnl/src/lib/harness/rendering/OverlayReducerPipeline.ts`

Observed role:

- Browser runtime speaks typed remote WebSocket commands, not engine internals.
- Server WS bridge relays runtime events plus shell/panel events.
- `HarnessRuntimeBrowser.events` currently forwards chat-v2 events; shell/panel need separate projection seams.
- Frontend providers consume snapshots/events and render through reducer pipelines.
- Runtime can run without frontend; frontend is a projection.

### 8. Agent-task durability plane

Evidence:

- `packages/tmnl/src/lib/agents/tasks/services/*`
- `packages/tmnl/src/lib/agents/tasks/atoms/surface.ts`
- `packages/tmnl/src/lib/agents/docs/two-phase-commit-sketch.md`

Observed role:

- Agent task logs publish over NATS/JetStream with idempotent message IDs.
- Local outbox/WAL handles unacked replay but JetStream is final durability authority.
- Archive/hydration can redact sensitive keys and hydrate from cache/archive/NATS fallback.
- Task views consume atom surfaces instead of owning transport/durability.

## Why this changes the PRD

The correct product is not “add memory/graph to codemode.” It is:

> Expose a schema-first, headless-capable Pi harness runtime with manifest-driven tool surfacing, session replay/fork, provider/OAuth bridge, and browser/server adapter split.

PRD requirements should include:

1. `HarnessRuntime` as the only consumer-facing runtime contract.
2. Server-only `PiAiHarnessEngine` and browser-only `HarnessRuntimeBrowser` entrypoints.
3. Tool manifest emitted on session open.
4. Tool composition order: builtins → allowlisted extensions → optional domain services → prompt/panel tools.
5. Sequence-based events and snapshots for resume/replay.
6. JSONL session persistence with explicit metadata/cursor handling.
7. Per-message model override through model registry validation.
8. Prompt registry rebuild per turn and `prompt_context` guardrails.
9. Frontend as optional projection, not authority.
10. Clear boundaries with codemode/OpenProse/DMN/PCT/LNK/MSH/STX as adjacent or higher-order systems.

## ADR recommendation

Draft an ADR with this thesis:

> `PiAiHarnessEngine` remains server-only and owns Pi-facing session/tool execution. `HarnessRuntime` is the runtime contract. `HarnessRuntimeBrowser` is the browser bridge. `PiAuthBridge` is the sanctioned Pi OAuth source. Tool composition is manifest-driven, allowlisted, and sequential-by-default. UI consumes events and snapshots; it does not own engine state.

ADR decision points:

- Keep engine state and tool execution off the frontend.
- Keep `agents` provider/OAuth logic separate from `harness` event-loop/session logic.
- Do not collapse codemode/OpenProse into harness; define adapter points.
- Preserve model registry validation for overrides.
- Treat shell/panel events as separate relays unless explicitly projected into `HarnessRuntimeBrowser.events`.

## Visual explainer lanes

1. **Pi/Auth lane** — Pi OAuth, `AuthStorage`, `ModelRegistry`, `PiAuthBridge`.
2. **Provider lane** — Codex stream-only middleware, Anthropic bearer/Claude Code identity, env-key fallback.
3. **Runtime contract lane** — `HarnessRuntime` operations.
4. **Engine lane** — `PiAiHarnessEngine` sessions, active runs, stream loop, model override.
5. **Event lane** — provider markers, chat-v2 events, metrics, snapshots.
6. **Tool lane** — builtins, extensions, Genifer, GEOINT, interactive shell, prompt_context, panel_eval.
7. **Persistence lane** — JSONL store, in-memory store, replay cursor, fork.
8. **Prompt/compaction lane** — prompt registry sections, runtime stamp, compaction summary.
9. **Remote projection lane** — WS server, browser transport, browser runtime.
10. **Frontend/render lane** — PiProvider, morphchat adapter, overlay reducer.
11. **Agent task durability lane** — NATS/JetStream logs, outbox, archive/hydration.
12. **Adjacent SDK lane** — codemode, OpenProse/Reactor, LimitlessRP, DMN/PCT/LNK/MSH/STX.

## Gap / risk register

- `HarnessRuntimeBrowser.events` only forwards chat-v2 events today; shell/panel relays are separate.
- JSONL deltas are not persisted for every text/thinking token by design; decide whether selected sessions need token-level replay.
- `HarnessRemoteSchemas.ts` older `harness:*` protocol coexists with newer `remote:*` browser schemas; decide whether to retire/bridge it.
- Extension allowlist policy should be made explicit if extracted into a standalone SDK package.
- `prompt_context` is powerful; preserve reserved-key and budget enforcement if moved.
- Default model strings in harness config must stay aligned with actual Pi/Codex account support.

## Evidence outputs

- `research/gbg-tmnl-harness-runtime-map.md`
- `research/gbg-tmnl-harness-tools-map.md`
- `research/gbg-tmnl-agents-map.md`
- `research/gbg-tmnl-harness-ui-decoupling-map.md`
- `research/gbg-agent-sdk-repo-map.md`
- `research/gbg-openprose-reactor-map.md`
- `research/gbg-limitlessrp-map.md`
- `research/gbg-agent-sdk-external-patterns-refresh.md`
