# pi-ai Effect Systemization — Strike Plan v1

Owner: Val  
Date: 2026-02-11  
Feature Anchor: `#F221 EDIN / Implement — Effect-Wrapped pi-ai Runtime Systemization`  
Parent: `#F216 Conductor Harness Migration: AgentSession → pi-ai`

---

## 0) Operating Rule

- This file is the **single execution reference** for the Effect-wrapped pi-ai lane.
- Every task/PR/update must cite:
  - `thoughts/shared/plans/piai-effect-systemization-strike-plan-v1.md`
- Runtime principle: **hard-cut pi-ai remains** (no AgentSession rollback lane).
- Rewrite principle: `src/lib/harness` is a **total rewrite lane** and must not depend on `src/lib/pi-orchestrator/*` modules.
- Package/tooling discipline: **bun only**.

---

## 1) Source-of-Truth Inputs Used

### pi-ai source (read directly)
- `@mariozechner/pi-ai/README.md`
- `@mariozechner/pi-ai/dist/types.d.ts`
- `@mariozechner/pi-ai/dist/stream.d.ts`
- canonical upstream code grounding:
  - `https://github.com/badlogic/pi-mono/tree/main/packages/ai`
  - `packages/ai/src/stream.ts`
  - `packages/ai/src/types.ts`
  - `packages/ai/src/utils/event-stream.ts`

Key capabilities to expose through Effect wrappers:
- `streamSimple` / `completeSimple`
- `SimpleStreamOptions`: `reasoning`, `cacheRetention`, `sessionId`, `maxRetryDelayMs`, `headers`, `signal`
- event model: `text_*`, `thinking_*`, `toolcall_*`, `done`, `error`
- stop reasons include `aborted` + `error`

### TMNL harness + client source
- `src/lib/harness/PiAiHarnessEngine.ts`
- `src/lib/pi-orchestrator/services/HarnessRuntime.ts`
- `src/lib/pi-orchestrator/client/PiRemoteChatV2Client.ts`
- `src/lib/ai-core/providers/pi/PiProvider.ts`

Observed gap:
- Harness is wired, but stream execution still bridges with imperative async iteration + `Effect.runPromise` in hot path.
- `PiProvider` still centers on legacy handle semantics instead of fully consuming chat-v2/harness runtime contract.

### Effect + submodule patterns
- Effect docs (`Writing Effect Guide`): service-first, `Effect.fn`, `Effect.acquireRelease`, span/log discipline.
- `../../submodules/effect/packages/effect/test/Stream/constructors.test.ts` (`Stream.fromAsyncIterable` pattern).
- `../../submodules/effect/packages/platform-node-shared/test/Sink.test.ts` (`Stream.async` emitter pattern).
- `../../submodules/effect-atom/packages/atom/test/Atom.test.ts` (`Registry.make`, `get.stream`, stream failure semantics).

---

## 2) Strategic Objective

Turn pi-ai from “integrated library call” into a **first-class Effect runtime subsystem**:

1. deterministic stream lifecycle
2. policy-governed execution
3. schema-validated event normalization
4. provider-level adoption beyond conductor-only path
5. measurable reliability telemetry

---

## 3) Critical Path (Strict Order)

1. `#811` Design PiAiPolicy service + schema config surface
2. `#812` Refactor PiAiHarnessEngine stream execution to Effect Stream + scoped resources
3. `#813` Implement schema-validated pi-ai event adapter layer
4. `#814` Rewire PiProvider to chat-v2 runtime contract
5. `#815` Add runtime observability metrics for pi-ai effect wrapper
6. `#816` Add test matrix for wrapper reliability
7. `#817` Publish implementation debrief and operator guide

---

## 4) Task-by-Task Plan

## #811 — PiAiPolicy service (contract first)

### Deliverables
- New module(s), e.g.:
  - `src/lib/harness/policy/PiAiPolicy.ts`
  - `src/lib/harness/schemas/policy.ts`
- Schema-backed policy including:
  - timeout budget
  - retry schedule policy
  - concurrency cap
  - default reasoning/cache/session options
  - provider/model override policy

### Acceptance
- Engine send/open paths consume policy service (not ad-hoc defaults).
- Policy values are visible in spans/log annotations.

---

## #812 — Effect-native stream runtime

### Deliverables
- Replace imperative `for await` + `Effect.runPromise` bridge in `PiAiHarnessEngine` with:
  - `Stream.fromAsyncIterable(...)` for pi-ai event stream
  - scoped cancellation (`Effect.acquireRelease` around `AbortController`)
  - stream interpretation pipeline (`Stream.mapEffect` / `runForEach` as needed)

### Requirements
- Abort semantics: session abort must deterministically stop stream and emit proper terminal event.
- Finalization semantics: no dangling controller/fiber after completion/failure/abort.

---

## #813 — Schema-validated pi-ai event adapter

### Deliverables
- Adapter layer (separate module) that decodes pi-ai stream events into internal tagged schema events before chat-v2 projection.
- Diagnostic envelope for unresolved/invalid fields (tool name/id resolution, malformed partials).

### Requirements
- No silent drops; invalid events produce explicit diagnostic/error events.
- Tool lifecycle remains phase-complete (`start` → `update` → `end`) when source allows.

---

## #814 — PiProvider rewire to chat-v2 runtime

### Deliverables
- Move `src/lib/ai-core/providers/pi/PiProvider.ts` to consume chat-v2 runtime client contract instead of legacy handle event loop.
- Preserve `ChatDataProvider` interface and extension UI capabilities.

### Requirements
- Provider send/abort/clear/stateChanges work via chat-v2/harness path.
- Legacy handle dependencies removed from active provider path.

---

## #815 — Observability & reliability metrics

### Deliverables
- Add/annotate spans across wrapper + provider path.
- Emit structured metrics:
  - `ackLatencyMs`
  - `firstDeltaLagMs`
  - `toolRoundTripMs`
  - `abortToStopMs`
  - `retryCount`

### Requirements
- Metrics available in test/reliability evidence and JSONL logs.

---

## #816 — Reliability test matrix

### Deliverables
- Dedicated tests for:
  - abort mid-stream
  - replay/resume from sequence
  - tool lifecycle fidelity under partials
  - schema adapter failure path
  - provider integration path (chat-v2 runtime)

### Suggested test loci
- `src/lib/harness/__tests__/...`
- `src/lib/pi-orchestrator/__tests__/...`
- `src/lib/ai-core/providers/pi/__tests__/...`

---

## #817 — Debrief + operator guide

### Deliverables
- Implementation debrief with architectural deltas.
- Operator guide for policy knobs and failure diagnostics.
- Follow-on backlog with explicit risk ownership.

---

## 5) Proposed Module Topology (from-scratch wrapper lane)

- `src/lib/harness/policy/`
  - `PiAiPolicy.ts`
  - `policy-schema.ts`
- `src/lib/harness/runtime/`
  - `PiAiStreamRuntime.ts` (stream orchestration)
  - `PiAiEventAdapter.ts` (schema normalization)
  - `PiAiSessionRuntime.ts` (session state transitions + idempotency)
- `src/lib/harness/PiAiHarnessEngine.ts`
  - becomes thin composition root over policy/runtime/adapter modules

This keeps architecture clean and avoids turning engine into a monolith.

---

## 6) Execution Evidence Commands

Per milestone:

```bash
bunx tsc --noEmit -p tsconfig.json
bunx vitest run src/lib/harness/__tests__/*.test.ts src/lib/pi-orchestrator/__tests__/remote-command-router.test.ts src/lib/pi-orchestrator/__tests__/chat-v2-client.test.ts src/lib/ai-core/providers/pi/__tests__/PiProvider.test.ts
```

For runtime sanity:

```bash
bun run pi-orchestrator:remote-ws
bun run dev
```

---

## 7) Definition of Done

This lane is done only when:

1. wrapper runtime is Effect-native (no imperative async bridge in hot path),
2. policy service governs pi-ai execution behavior,
3. PiProvider uses chat-v2 runtime contract as active path,
4. reliability metrics are emitted and test-verified,
5. debrief/operator docs published with this strike-list reference.
