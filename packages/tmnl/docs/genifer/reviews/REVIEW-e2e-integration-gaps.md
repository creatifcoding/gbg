---
title: Genifer E2E Integration Gap Analysis
date: 2026-02-20
author: Adversarial Reviewer - Validation Agent
status: COMPLETE
---

# Genifer Streaming Pipeline — Adversarial E2E Integration Review

## Executive Summary

You have solid **stage-local** tests. You do **not** have true end-to-end confidence.

The current test suite in `src/lib/genifer/__tests__/streaming/` covers:
- tokenizer behavior (`tokenizer.test.ts`)
- graph identification behavior (`graph.test.ts`)
- BFTA rules in isolation (`bfta.test.ts`)
- service atom updates (`service.test.ts`)

What it does **not** cover is the actual full runtime chain:

`raw chunk stream -> tokenizer -> graph -> BFTA -> service -> hook -> renderer`

Because that chain is not even fully wired.

### Brutal answers to your checks

1. **Is BFTA wired into streaming graph/service?** **No.** Standalone only.
   - `graph.ts` imports tokenizer only (`src/lib/genifer/streaming/graph.ts:17-18`)
   - graph callbacks expose only `onComponentIdentified` + `onToken` (`graph.ts:30-34`)
   - service wires only those callbacks (`service.ts:154-171`)
   - BFTA is merely exported (`index.ts:72-85`) and unit-tested (`bfta.test.ts`), never integrated.

2. **Can full pipeline handle realistic multi-component JSON?** **Not proven.**
   - Coverage exists for small arrays (`graph.test.ts:48-64`, `service.test.ts:90-99`), but no realistic nested tree + rendering + validation run.

3. **Malformed mid-stream / incomplete streams?** **Resilience coverage is missing, and runtime behavior is permissive/silent.**
   - tokenizer drops invalid literals silently (`tokenizer.ts:129-158`)
   - flush emits partial strings (`tokenizer.ts:314-329`)
   - graph treats all String tokens equally (no `partial` guard) (`graph.ts:104-123`)
   - service sets `isParsing=false` on flush regardless of structural completeness (`service.ts:190-200`)

4. **Is StreamingRenderer tested with streaming data?** **No tests at all.**
   - `StreamingRenderer.tsx` has no matching test file in `__tests__/streaming/`

5. **Does service reset state without d2ts version leakage?** **State resets, version does not.**
   - graph explicitly keeps monotonic version across reset (`graph.ts:187-196`)
   - service reset clears atoms, not version (`service.ts:202-214`)
   - tests assert atom reset (`service.test.ts:125-146`) and version monotonic increment (`graph.test.ts:134-144`), but not long-run reset/version isolation behavior.

---

## Pipeline Coverage Matrix

| Stage | Implementation | What is Tested | Missing E2E Evidence | Status |
|---|---|---|---|---|
| 1. Raw JSON -> Token stream | `streaming/tokenizer.ts` | basic object/array/chunking/flush/reset (`tokenizer.test.ts`) | malformed JSON, invalid literals, structural mismatch, recovery semantics | ⚠️ Isolated only |
| 2. Token stream -> ComponentIdentification | `streaming/graph.ts` | discriminator identification, chunking, arrays, reset (`graph.test.ts`) | integration with validator and renderer, partial-token semantics | ⚠️ Isolated only |
| 3. ComponentIdentification -> BFTA ValidationResult | `streaming/bfta.ts` | grammar + push/pop validation in isolation (`bfta.test.ts`) | no runtime wiring from graph/service | ❌ Not integrated |
| 4. Service Atom-as-State wrapper | `streaming/service.ts` | atom updates, chunk count, reset, simple SSE sim (`service.test.ts`) | validator propagation, malformed/error behavior, long-session version/reset behavior | ⚠️ Partial |
| 5. React hook consumption | `streaming/useStreamingJson.ts` | none | no subscription lifecycle tests, no multi-consumer behavior | ❌ Uncovered |
| 6. Streaming rendering | `streaming/StreamingRenderer.tsx` | none | no progressive render assertions, no prop isolation assertions | ❌ Uncovered |

---

## Critical Gaps (with file:line evidence)

### 1) BFTA is architecturally disconnected

- Graph has no BFTA import/invocation (`graph.ts:17-18`, `graph.ts:30-34`, `graph.ts:53-203`)
- Service wires only graph callbacks (`service.ts:154-171`) and never emits validation results
- BFTA exists as export surface only (`index.ts:72-85`)
- BFTA tests are pure standalone push/pop flows (`bfta.test.ts:250-323`)

**Impact:** no grammar enforcement in live stream path.

---

### 2) "E2E" test is service-level only, not pipeline E2E

- Claimed SSE simulation runs service + atoms only (`service.test.ts:181-201`)
- No hook invocation (`useStreamingJson.ts` never tested)
- No renderer invocation (`StreamingRenderer.tsx` never tested)
- No BFTA assertion path

**Impact:** current suite proves internal plumbing, not user-visible behavior.

---

### 3) Partial-string discriminator bug surface is untested

- tokenizer flush emits partial string token (`tokenizer.ts:322-329`)
- graph discriminator logic accepts String token value without checking `partial` (`graph.ts:104-123`)

**Impact:** incomplete `_tag/type` can be promoted as identified component on flush.

---

### 4) Malformed JSON is mostly silent, not surfaced

- invalid literals are dropped by `flushLiteral()` returning `null` (`tokenizer.ts:129-158`)
- closing braces decrement depth without underflow guard (`tokenizer.ts:252-289`)
- service error atom only updates on thrown exceptions (`service.ts:180-187`, `service.ts:191-198`), but tokenizer/graph paths are largely non-throwing for malformed content

**Impact:** corrupted input can produce partial/incorrect state without explicit error.

---

### 5) Renderer prop attribution is not component-scoped

- `StreamingElement` merges **all** `partialFields` entries into one props object (`StreamingRenderer.tsx:93-103`)
- no depth correlation in `ComponentIdentification` (`graph.ts:24-28`)

**Impact:** cross-component prop bleed is possible under concurrent/nested streams; not tested.

---

### 6) Reset semantics leave version continuity unverified for long-lived sessions

- graph reset intentionally preserves version (`graph.ts:187-196`)
- service exposes same version (`service.ts:213-214`)
- tests verify monotonic increment (`graph.test.ts:134-144`) and atom reset (`service.test.ts:125-146`), but do not validate repeated reset cycles/version growth behavior

**Impact:** potential lifecycle ambiguity for consumers expecting session-local versioning.

---

## Missing Test Scenarios

### A. True end-to-end integration

1. **Full chain test:** `feedChunk -> flush -> useStreamingJson -> StreamingRenderer` with actual render assertions.
2. **Nested realistic payload:** multi-component tree with siblings + nested children + mixed ordering of `key` and `type`.
3. **BFTA-wired stream:** assert invalid parent/child structures are flagged in same stream session.

### B. Streaming correctness invariants

4. **Chunk-boundary invariance:** same payload chopped N ways yields identical identifications/render output.
5. **Out-of-order key/type fields:** ensure `elementKey` eventually binds even when `type` appears first (currently it can remain undefined).
6. **Multi-object overlap:** ensure per-component partial props do not bleed.

### C. Resilience and recovery

7. malformed literal mid-stream (`truX`, broken numbers, bad escapes)
8. unmatched brackets / negative-depth cases
9. stream ends mid-string, then flush + reset + new stream
10. error path assertions for `streamingErrorAtom`
11. high-volume stream > token cap behavior verification (`MAX_TOKEN_HISTORY` path in `service.ts:160-165`)

### D. Hook/renderer behavior

12. `useStreamingJson` subscription lifecycle and callback stability
13. `StreamingRenderer` loading skeleton + fallback renderer + progressive rerender
14. render correctness under rapid chunk cadence

---

## BFTA Integration Status

## Verdict: **Standalone subsystem, not part of runtime pipeline**

Evidence chain:
- BFTA constructor exists (`bfta.ts:307+`), but graph callback contract has no validation channel (`graph.ts:30-34`)
- Service callback wiring has no validator stage (`service.ts:154-171`)
- Runtime exports BFTA API (`index.ts:72-85`) without a consumer path
- Tests validate BFTA in synthetic push/pop mode only (`bfta.test.ts`)

So yes, it works. No, it is not wired where it matters.

---

## Resilience Gaps

1. **No strict JSON failure mode** in tokenizer: invalid literals silently disappear (`tokenizer.ts:129-158`).
2. **No structural underflow guard** for stray closers (`tokenizer.ts:252-289`).
3. **Partial tokens can be misinterpreted as complete discriminator values** (`tokenizer.ts:322-329` + `graph.ts:104-123`).
4. **Flush finalizes parsing state unconditionally** (`service.ts:190-200`) even when parse session is semantically incomplete.
5. **No tests that deliberately exercise error atom population** despite explicit error path (`service.ts:180-187`, `service.ts:191-198`).

---

## Recommended E2E Test Suite

Create these files:

### 1) `src/lib/genifer/__tests__/streaming/pipeline.e2e.test.ts`

Core cases:
- `single-component nested props` full chain verification
- `multi-component nested tree` (realistic payload)
- `chunk-boundary invariance` property-style table tests
- `reset cycle stability` over many sessions with version assertions
- `malformed/incomplete stream` with explicit error semantics

### 2) `src/lib/genifer/__tests__/streaming/pipeline-bfta.e2e.test.ts`

Core cases:
- graph/service wired validation results
- valid tree accepted, invalid tree rejected in-stream
- unknown types policy asserted (warn vs pass/fail)

### 3) `src/lib/genifer/__tests__/streaming/useStreamingJson.integration.test.tsx`

Core cases:
- subscription updates from registry
- stable command callbacks (`feedChunk`, `flush`, `reset`)
- multi-hook consumer consistency

### 4) `src/lib/genifer/__tests__/streaming/StreamingRenderer.integration.test.tsx`

Core cases:
- progressive rendering as chunks arrive
- fallback behavior for unknown component types
- prop isolation by component (no cross-merge)
- rendering while `isParsing` toggles

---

## Final Assessment

The system is **well-unit-tested** and **under-integrated**.

You don’t currently have evidence that a realistic stream survives the full journey from chunk ingestion to validated/rendered UI under bad network conditions and malformed payloads.

Prime, the architecture has teeth. The tests currently check the incisors one by one and never confirm the jaw closes.
