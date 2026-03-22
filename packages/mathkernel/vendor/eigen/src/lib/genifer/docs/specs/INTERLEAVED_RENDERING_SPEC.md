# INTERLEAVED_RENDERING_SPEC

**Status:** Design Contract (implementation-facing)  
**Scope:** TMNL MorphChat + Genifer inline rendering path  
**Audience:** Next implementation worker (adapter + renderer + harness integration)

---

## 1) Purpose

Define the target architecture for **inline interleaved rendering** so text, tool lifecycle, and Genifer patch updates render in a single ordered stream without cross-branch churn or refine crashes.

This spec is a **contract**, not a concept note.

---

## 2) Gate-First Criteria (Locked)

The following acceptance criteria are locked from the user questionnaire summary provided in-task:

1. `no-refine-crash`
2. `first patch visible <=200ms`
3. `branch-local rerender`
4. `malformed patch quarantine`
5. `one-command smoke`

Implementation is not complete until all five pass.

---

## 3) Architectural Boundaries

### B1 — Harness Event Ingest Boundary

Input contract: `HarnessEvent` stream (`chat:v2/*` + genifer events), keyed by `(sessionId, seq, at)`.

Responsibilities:
- decode event shape (already schema-backed)
- route by event tag
- preserve ordering per session

### B2 — Interleave Reducer Boundary (MorphChat adapter path)

Canonical ownership:
- **Atom-as-state** only
- per-message atom path preferred over whole-array writes for hot streaming updates

Responsibilities:
- reduce deltas into ordered parts
- enforce tool lifecycle monotonicity
- keep `content` summary consistent with parts

### B3 — Patch Branch Boundary (Genifer incremental tree path)

Input contract:
- `treeSnapshot?: unknown`
- `treePatch?: unknown`
- `patchSeq?: number`

Responsibilities:
- apply snapshot when checkpoint/final snapshot changes
- apply patch incrementally
- dedupe stale or duplicate patch by `patchSeq`
- isolate patch failures to local branch (no global teardown)

### B4 — Surface Machine Boundary (stx)

Responsibilities:
- streaming state progression (`idle -> active -> finalizing`)
- scope updates by surface/branch identity
- avoid global rerender side effects

---

## 4) Stream Part Model (Target)

### 4.1 Canonical Part Union

Use a unified interleaved model (schema-first) for rendering order:

```ts
import { Schema } from 'effect'

const PartText = Schema.TaggedStruct('part:text', {
  branchId: Schema.String,
  contentIndex: Schema.Number,
  messageId: Schema.String,
  text: Schema.String,
  isStreaming: Schema.Boolean,
})

const PartThinking = Schema.TaggedStruct('part:thinking', {
  branchId: Schema.String,
  contentIndex: Schema.Number,
  messageId: Schema.String,
  text: Schema.String,
  isStreaming: Schema.Boolean,
  durationMs: Schema.optional(Schema.Number),
})

const ToolState = Schema.Literal('pending', 'running', 'approval-required', 'approved', 'completed', 'error', 'denied')

const PartTool = Schema.TaggedStruct('part:tool', {
  branchId: Schema.String,
  contentIndex: Schema.Number,
  messageId: Schema.String,
  toolCallId: Schema.String,
  toolName: Schema.String,
  state: ToolState,
  input: Schema.optional(Schema.Unknown),
  inputDelta: Schema.optional(Schema.String),
  output: Schema.optional(Schema.Unknown),
  errorText: Schema.optional(Schema.String),
})

const JsonPatchOp = Schema.Literal('set', 'add', 'replace', 'remove', 'move', 'copy', 'test')

const JsonPatchFrame = Schema.TaggedStruct('part:patch', {
  branchId: Schema.String,
  contentIndex: Schema.Number,
  messageId: Schema.String,
  toolCallId: Schema.String,
  patchSeq: Schema.Number,
  patch: Schema.Struct({
    op: JsonPatchOp,
    path: Schema.String,
    from: Schema.optional(Schema.String),
    value: Schema.optional(Schema.Unknown),
  }),
})

export const InterleavedPart = Schema.Union(PartText, PartThinking, PartTool, JsonPatchFrame)
```

### 4.2 Invariants

- `contentIndex` is **strictly increasing** within a branch.
- Tool part identity is `toolCallId` (upsert/update, not append duplicates).
- Patch frame identity is `(toolCallId, patchSeq)`.
- Branch key must be stable through a stream:
  - recommended: `branchId = ${surfaceId}:${messageId}`.

---

## 5) Tool/Text Interleave Contract

### 5.1 Ordering Rules

1. `assistant_start` opens a streaming assistant message branch.
2. `assistant_delta` appends text via rAF-coalesced flush.
3. `tool_event:start|update|end` upserts the tool part in-place by `toolCallId`.
4. `assistant_final` must flush pending text deltas before finalizing parts.
5. `phase:'stream'` remains a side channel and must not break main part ordering.

### 5.2 Tool Lifecycle Safety

- Terminal states: `completed`, `error`, `denied`.
- Terminal -> non-terminal transitions are forbidden.
- Late update events after terminal state are ignored or telemetry-only.

### 5.3 Render Isolation Rule

- Streaming content mutations should write to **target message atom only**.
- Topology atom (`messageIds`) changes only on add/remove/reorder.
- Non-target branches must not rerender due to token-level updates.

---

## 6) Patch-Canonical Protocol

### 6.1 Wire Contract

- Transport format: NDJSON (one patch object per line).
- Patch object fields: `op`, `path`, optional `from`, optional `value`.

### 6.2 Validity Contract

Patch stream is considered canonical when:

1. `/root` resolves to a non-empty key.
2. `/elements/<root>` exists.
3. Child references point to existing element keys by completion.
4. `patchSeq` is monotonic in each `(surfaceId, toolCallId)` stream.

### 6.3 Consumer Contract

- Parse/decode failures do not crash render path.
- Patch dedupe: skip `patchSeq <= lastPatchSeq`.
- `applyPatch` failure is branch-local no-op.
- Snapshot updates can reset local baseline; subsequent patches apply on that baseline.

### 6.4 Patch-First Progress Rule

While streaming:
- progress updates should carry `treePatch` + `patchSeq`
- snapshot checkpoints are optional but not required in-flight
- final/complete payload must include canonical `treeSnapshot`

---

## 7) Required Refine Base-Seed Contract

Refine is executable only if all preconditions are true:

1. Surface exists.
2. Model layer is configured.
3. `surface.treeSnapshot` decodes/normalizes into a valid UITree seed.
4. Refine adapter receives `currentTree` seed.

If any precondition fails:
- return typed refine precondition failure
- emit status row / error signal
- **do not throw uncaught runtime exception**
- **do not mutate live surface state partially**

This is the functional definition of `no-refine-crash`.

---

## 8) Failure + Quarantine Semantics

### 8.1 Malformed Patch Quarantine

A malformed patch line (parse/decode failure) must:
- increment `quarantineCount`
- record quarantine metadata (`line`, `lineIndex`, `reason`, `streamId`, `context`)
- continue processing subsequent lines when safe

### 8.2 Quality Failure Classification

At attempt boundary, classify failures into:
- `empty_response`
- `parse_error`
- `wrong_format`
- `partial_tree`
- `unknown`

Retry remains bounded by configured max attempts.

### 8.3 Branch Safety

Any malformed patch or apply failure must be **branch-local**:
- no crash in sibling branches
- no global message list reset
- no surface-machine reset unless explicitly escalated

---

## 9) Acceptance Criteria (Executable)

| Criterion | Pass Condition | Measurement |
|---|---|---|
| `no-refine-crash` | 100% refine failures are typed fast-fail (no uncaught exception) | Contract test around missing/invalid `treeSnapshot` |
| `first patch visible <=200ms` | P95 <= 200ms from refine/generate start to first visible patch commit | Timing probe (`startTs -> firstPatchCommittedTs`) |
| `branch-local rerender` | Target branch rerenders only; non-target branches unchanged for patch/token updates | Render-tracking test harness on per-message atoms |
| `malformed patch quarantine` | Malformed patch lines are quarantined, not fatal; stream continues when possible | Patch parser test with mixed valid/invalid lines |
| `one-command smoke` | Single command runs the interleaved pipeline smoke checks and exits non-zero on failure | `bun run interleaved:smoke` (script to be added) |

---

## 10) One-Command Smoke Definition

Required script contract:

```bash
bun run interleaved:smoke
```

Minimum smoke scope:
1. stream text + tool + patch interleave sequence
2. verify first patch timing assertion path
3. verify malformed patch quarantine behavior
4. verify refine precondition fast-fail behavior
5. verify branch-local rerender instrumentation assertion

If project chooses NX target wrapper, mirror with:

```bash
nx run tmnl:interleaved:smoke
```

---

## 11) Implementation Slices (Commit-Friendly)

### Slice A — Schema + Identity
- Introduce shared `InterleavedPart` schema.
- Define `branchId` contract and helper.

### Slice B — Reducer Unification
- Unify text/tool interleave updates in reducer path.
- Keep terminal tool-state guard centralized.

### Slice C — Patch Canonicalization
- Enforce dedupe + monotonic `patchSeq` checks.
- Add quarantine ledger writes for malformed lines.

### Slice D — Refine Preflight
- Add explicit seed validation helper.
- Return typed refine precondition failure (no crash path).

### Slice E — Gates + Smoke
- Add gate tests and timing assertions.
- Add `interleaved:smoke` script + optional NX target.

---

## 12) Non-Negotiable Invariants

1. Atom-as-state is canonical for hot-path stream state.
2. stx boundary controls lifecycle state; reducer controls content state.
3. No dual-write race between array topology and per-message content.
4. Patch failures are quarantine/no-op, not fatal process errors.
5. Refine without a valid base seed must fail fast, typed, and visible.

---

## 13) Out of Scope

- UI styling changes.
- New model/provider integrations.
- Reworking unrelated chat presets or skin system.

