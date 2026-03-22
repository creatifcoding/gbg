# INTERLEAVED_GAP_ANALYSIS_SPEC

**Status:** Implement-phase gap audit (code-level)  
**Target:** TMNL interleaved rendering contract  
**Inputs:**
- `docs/genifer/specs/INTERLEAVED_RENDERING_SPEC.md`
- `.agents/comm/interleaved-design-handoff.md`

---

## 1) Gate-First Status Snapshot

| Locked Gate | Current Status | Notes |
|---|---|---|
| `no-refine-crash` | **PARTIAL / FAIL** | Typed failures exist, but refine/generate mutate active state before preflight and can leave stale streaming state on early failure. |
| `first patch visible <=200ms` | **FAIL** | No first-patch-visible timing probe is implemented. |
| `branch-local rerender` | **FAIL** | Mixed write paths (`messages$` array + per-message atoms) can propagate non-target updates. |
| `malformed patch quarantine` | **PARTIAL / FAIL** | Quarantine count exists, but no metadata ledger (`line`, `lineIndex`, `reason`, `streamId`, `context`). |
| `one-command smoke` | **FAIL** | `bun run interleaved:smoke` script/target absent. |

---

## 2) Gap Register (File/Function, Severity, Refactor Requirement)

## G-01 — Canonical interleaved part schema is not implemented
**Severity:** **CRITICAL**  
**Contract(s):** Stream Part Model, Invariants, branch identity, patch frame part

**Evidence**
- `src/lib/ai-core/atoms/index.tsx:68-76` (`StreamContentPart` is `type/index/text/toolCallId` only).
- `src/lib/ai-core/atoms/index.tsx:263-286` (tool parts only as `'tool_call'`; no patch part).
- `src/lib/morphchat/schemas/message-types.tsx:66-195` (`ChatMessagePart` union lacks `part:patch` and branch/content indices).
- `src/lib/morphchat/components/thread-view.tsx:183-243` (renderer switch has no patch part branch).

**Refactor requirement**
1. Introduce shared `InterleavedPart` schema union with `branchId`, `contentIndex`, `messageId` and `part:patch`.
2. Replace ad-hoc part types in reducer paths with schema-backed decode/encode.
3. Extend render switch to support `part:patch` and stable content ordering.

---

## G-02 — Tool/text/patch are not reduced in one ordered stream
**Severity:** **CRITICAL**  
**Contract(s):** Tool/Text Interleave Contract, single ordered stream

**Evidence**
- `src/lib/morphchat/adapters/harness-event-processor.ts:624` (`phase:'stream'` is dropped from main reducer path).
- `src/lib/morphchat/hooks/useHarnessAdapter.ts:623-629` (`phase:'stream'` routed to side sink).
- `src/lib/harness/PiAiHarnessEngine.ts:1153-1164` (patch-like details emitted in tool update payload, not dedicated part frames).
- `src/lib/morphchat/adapters/harness-event-processor.ts:664-730` (update path merges payload into tool output/details; no `part:patch`).

**Refactor requirement**
1. Route `start/update/end/stream` through a single interleaved reducer with deterministic `contentIndex` assignment.
2. Emit patch updates as first-class `part:patch` entries keyed by `(toolCallId, patchSeq)`.
3. Keep side sink optional for display-only chunks, not canonical ordering.

---

## G-03 — Refine/generate preflight order violates no-partial-mutation rule
**Severity:** **CRITICAL**  
**Contract(s):** Required refine base-seed contract, no-refine-crash

**Evidence**
- `src/lib/genifer/harness/GeniferHarnessService.ts:594-617` (`refine` sets active generation + emits start before model/snapshot validation).
- `src/lib/genifer/harness/GeniferHarnessService.ts:622-645` (`refine` preflight failures return error after mutation).
- `src/lib/genifer/harness/GeniferHarnessService.ts:773` (clear active generation only on success path).
- `src/lib/genifer/harness/GeniferHarnessService.ts:360-387` (`generate` has same early mutation before model-layer check).
- `src/lib/genifer/harness/GeniferHarnessService.ts:550` (generate clears only on success path).

**Refactor requirement**
1. Add `validateRefineSeed(surface, modelLayer)` preflight helper returning typed failure variants.
2. Run preflight **before** `setActiveGeneration` and before start events.
3. Wrap generation lifecycle with `Effect.acquireRelease`/`Effect.ensuring` so active state always clears.
4. Emit status/error rows for typed precondition failures.

---

## G-04 — Branch-local rerender contract is broken by mixed state write paths
**Severity:** **HIGH**  
**Contract(s):** Render Isolation Rule, atom-as-state hot path

**Evidence**
- `src/lib/morphchat/adapters/harness-event-processor.ts:102-115` (`updateMessageParts` rewrites entire `messages$` array).
- `src/lib/morphchat/adapters/harness-event-processor.ts:350-366` (`assistant_delta` uses per-message atom path when available).
- `src/lib/morphchat/hooks/useHarnessAdapter.ts:1348-1383` (`syncMessageAtoms` subscribes to `messages$` and mirrors messages to per-message atoms).

**Refactor requirement**
1. Make per-message atoms canonical for all streaming content mutations (text/thinking/tool/patch).
2. Restrict `messages$` to topology add/remove/reorder and immutable metadata.
3. Remove/limit sync bridge content writes that can fan-out updates to unrelated branches.

---

## G-05 — Tool lifecycle monotonicity is incomplete (late mutation path remains)
**Severity:** **MEDIUM**  
**Contract(s):** Tool lifecycle safety

**Evidence**
- `src/lib/morphchat/adapters/harness-event-processor.ts:262-277` (guard blocks terminal → non-terminal only).
- `src/lib/morphchat/adapters/harness-event-processor.ts:685-709` (update path computes state and calls upsert).
- `src/lib/morphchat/adapters/harness-event-processor.ts:725-726` (inputDelta append still mutates part after guarded upsert).
- `src/lib/morphchat/adapters/harness-event-processor.ts:732-760` (terminal payloads can still merge on repeated terminal events).

**Refactor requirement**
1. Centralize transition table (`pending/running/.../terminal`) and reject any event for terminal parts unless telemetry-only.
2. Block all field mutation (including `inputDelta`) after terminal.
3. Add idempotency guard for duplicate `end` payloads.

---

## G-06 — Sequence handling is dedupe-only, not monotonic order enforcement
**Severity:** **MEDIUM**  
**Contract(s):** Preserve ordering per session

**Evidence**
- `src/lib/morphchat/hooks/useHarnessAdapter.ts:610-615` (`shouldProcess` only checks `seenSeqs`, no floor check for out-of-order unseen seq).

**Refactor requirement**
1. Track `lastAppliedSeq` per session and reject `seq <= lastAppliedSeq` (or quarantine late arrivals).
2. Keep duplicate-set as optional short window for replay safety, not primary order guard.

---

## G-07 — Patch-canonical contract is weakened by non-patch fallback
**Severity:** **HIGH**  
**Contract(s):** Patch-canonical protocol, patch-first progress rule

**Evidence**
- `src/lib/genifer/compiler/ai-adapter.ts:381-389` (when no patches applied, fallback to full normalization of raw output).
- `src/lib/genifer/compiler/ai-adapter.ts:392-404` (pass/fail quality checks root + size, but no full child-reference closure validation).

**Refactor requirement**
1. In interleaved mode, disable fallback normalization when zero valid patch lines are applied.
2. Add canonical tree validator (`root exists`, `root element exists`, `all child keys resolve`, `parent/child consistency`).
3. Fail with typed `wrong_format`/`partial_tree` and preserve quarantine evidence.

---

## G-08 — Malformed patch quarantine is count-only (missing evidence ledger)
**Severity:** **HIGH**  
**Contract(s):** Failure + quarantine semantics

**Evidence**
- `src/lib/genifer/compiler/ai-adapter.ts:315-316` (parse/decode failure increments `parseIssues` only).
- `src/lib/genifer/compiler/ai-adapter.ts:421` (`quarantineCount` surfaced, metadata not surfaced).
- `src/lib/genifer/core/streaming.ts:55-57` and `425-457` (`parsePatchLine` supports structured decode errors, but adapter does not wire callback).

**Refactor requirement**
1. Wire `onDecodeError` in adapter stream processing.
2. Persist quarantine metadata in a bounded stream-local ledger (`line`, `lineIndex`, `reason`, `streamId`, `context`).
3. Expose ledger summary in progress/details/status rows.

---

## G-09 — `patchSeq` dedupe is not stream-scoped in incremental consumer
**Severity:** **MEDIUM**  
**Contract(s):** Patch dedupe by stream `(surfaceId, toolCallId)`

**Evidence**
- `src/lib/genifer/react/incremental-tree.ts:237-240` (`IncrementalTreeDetails` carries snapshot/patch/patchSeq only).
- `src/lib/genifer/react/incremental-tree.ts:277-286` dedupe uses single `lastPatchSeq` state slot, no stream identity.

**Refactor requirement**
1. Extend details with stream identity (`surfaceId`, `toolCallId` or derived stream key).
2. Maintain dedupe baselines per stream key and reset on stream-key change/snapshot reset.

---

## G-10 — First-patch-visible gate has no instrumentation path
**Severity:** **HIGH**  
**Contract(s):** `first patch visible <=200ms`

**Evidence**
- `src/lib/genifer/harness/GeniferHarnessService.ts:354-454,589-694,974-1087` (tracks total `durationMs`, no first-patch markers).
- `src/lib/harness/perf/StreamingLatencyProbe.ts:17-39` (instrumentation is token/delta pipeline stages, no patch-visible stage).
- `src/lib/morphchat/adapters/harness-event-processor.ts:492,376` (probe stamps only assistant delta flow).

**Refactor requirement**
1. Add `startTs`, `firstPatchReceivedTs`, `firstPatchCommittedTs` in generate/refine flows.
2. Emit metric for patch-visible latency and annotate spans.
3. Gate in tests on P95 <= 200ms with deterministic harness fixtures.

---

## G-11 — Required one-command smoke command/target missing
**Severity:** **CRITICAL**  
**Contract(s):** one-command smoke

**Evidence**
- `package.json:63` (has `harness:piai:smoke`, no `interleaved:smoke`).
- `project.json:321-324` (has harness smoke target, no `interleaved:smoke` target).
- Command check: `bun run interleaved:smoke` → `Script not found`.

**Refactor requirement**
1. Add `interleaved:smoke` script (vitest gate suite for 5 locked criteria).
2. Add `tmnl:interleaved:smoke` NX mirror target.
3. Ensure non-zero exit on any gate failure.

---

## 3) Existing Strengths (Do Not Regress)

1. `assistant_final` flushes pending text delta coalescing before finalization (`src/lib/morphchat/adapters/harness-event-processor.ts:525`).
2. Patch-first progress wiring exists in harness service (`src/lib/genifer/harness/GeniferHarnessService.ts:403-408`, `659-664`, `1020-1026`).
3. Incremental patch dedupe/no-op safety exists (local) in `useIncrementalTree` (`src/lib/genifer/react/incremental-tree.ts:277-286`).

---

## 4) Refactor Slice Plan (Implementation-ready)

1. **Slice A — Shared schema + identity**
   - Add `InterleavedPart` and branch/stream key helpers.
2. **Slice B — Unified reducer path**
   - Move all tool/text/patch flow into one ordered reducer.
3. **Slice C — Patch canonical + quarantine**
   - Disable non-patch fallback in interleaved mode, add decode-error ledger.
4. **Slice D — Refine preflight hardening**
   - Validate preconditions before mutations; guaranteed cleanup.
5. **Slice E — Gate instrumentation + smoke**
   - Add first-patch timing probes, branch-local rerender tests, malformed quarantine tests, `interleaved:smoke`.

---

## 5) Validation Evidence Run (Current Baseline)

- `bunx vitest run src/lib/genifer/__tests__/patch-harness-stream.e2e.test.ts src/lib/genifer/__tests__/harness-e2e.test.ts` → PASS (baseline behavior stable, but locked interleaved gates are not fully covered).
- `bun run interleaved:smoke` → FAIL (`Script not found "interleaved:smoke"`).
