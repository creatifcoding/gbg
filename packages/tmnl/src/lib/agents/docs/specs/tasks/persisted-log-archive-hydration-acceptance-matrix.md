# Persisted Log Archive + Hydration — Acceptance Matrix (Strict)

Status: Draft v1  
Parent spec: `./persisted-log-archive-hydration-spec.md`  
Parent plan: `./persisted-log-archive-hydration-task-plan.md`

---

## 1) How to Use This Matrix

This matrix is the gate ledger for closure.

Each row must be mapped to:

1. at least one test or observable validation action,
2. evidence artifact (log/test output/doc),
3. explicit status (`pass` / `fail` / `blocked`).

No implicit acceptance.

---

## 2) Status Legend

- `pending` — not executed
- `pass` — executed and satisfied
- `fail` — executed and violated
- `blocked` — cannot execute due to upstream dependency

Evidence reference format suggestion:

- unit/integration: file path + test name
- runtime proof: log path + timestamp range
- docs: markdown path + row mapping

---

## 3) Gate A — Correctness

| Row ID | Assertion | Verification Method | Evidence Ref | Status |
|---|---|---|---|---|
| A-01 | Hot+hydrated merge emits no duplicate rows | deterministic merge test with overlaps | _pending_ | pending |
| A-02 | Dedupe identity is `id+timestamp` only | unit test on key function | _pending_ | pending |
| A-03 | Merge ordering deterministic for equal timestamps | stable tie-break test | _pending_ | pending |
| A-04 | Hydrated insertion does not corrupt existing list order | integration render assertion | _pending_ | pending |
| A-05 | Filtered view remains consistent after hydration merge | controller/filter integration test | _pending_ | pending |
| A-06 | QueryDSL filtering still applies post-hydration | querydsl + hydration combined test | _pending_ | pending |

---

## 4) Gate B — Durability Semantics

| Row ID | Assertion | Verification Method | Evidence Ref | Status |
|---|---|---|---|---|
| B-01 | Entry marked durable only after JetStream ack | durability service unit test | _pending_ | pending |
| B-02 | Archive spill never occurs pre-ack | ack-gated spill integration test | _pending_ | pending |
| B-03 | Ack timeout transitions entry to retry/degraded path | failure-path unit/integration test | _pending_ | pending |
| B-04 | Retry success yields receipt and unblocks spill | retry-path test | _pending_ | pending |
| B-05 | Retry exhaustion does not crash hot lane | runtime failure simulation | _pending_ | pending |
| B-06 | Durability receipt contains required fields | schema decode/encode test | _pending_ | pending |

---

## 5) Gate C — Resource Bounds

| Row ID | Assertion | Verification Method | Evidence Ref | Status |
|---|---|---|---|---|
| C-01 | Per-task hot cap remains 1000 | atom retention unit test | _pending_ | pending |
| C-02 | Task buffer cap remains 64 | LRU eviction unit test | _pending_ | pending |
| C-03 | Idle TTL remains 15m | simulated clock test | _pending_ | pending |
| C-04 | Hydration cache TTL is 5m | ttl eviction unit test | _pending_ | pending |
| C-05 | Hydration cache bounded per task | cache cap test | _pending_ | pending |
| C-06 | Hydration in-flight coalescing avoids request storms | controller integration test | _pending_ | pending |

---

## 6) Gate D — Failure Semantics

| Row ID | Assertion | Verification Method | Evidence Ref | Status |
|---|---|---|---|---|
| D-01 | localStorage quota error triggers oldest-chunk eviction | archive store test | _pending_ | pending |
| D-02 | Eviction retry path succeeds when space recovered | archive store test | _pending_ | pending |
| D-03 | Eviction unrecoverable enters archive degraded mode | integration test | _pending_ | pending |
| D-04 | Archive degraded mode does not disable live ingestion | runtime test | _pending_ | pending |
| D-05 | Hydration failure shows non-blocking loader error | view/controller test | _pending_ | pending |
| D-06 | JetStream outage preserves UI interactivity | integration smoke | _pending_ | pending |
| D-07 | Corrupted archive chunk is skipped safely | decode-failure test | _pending_ | pending |

---

## 7) Gate E — Schema and Type Discipline

| Row ID | Assertion | Verification Method | Evidence Ref | Status |
|---|---|---|---|---|
| E-01 | Manifest uses Effect Schema contract | schema compile/runtime decode test | _pending_ | pending |
| E-02 | Chunk uses Effect Schema contract | schema compile/runtime decode test | _pending_ | pending |
| E-03 | Durability receipt uses Effect Schema contract | schema compile/runtime decode test | _pending_ | pending |
| E-04 | Hydration window uses Effect Schema contract | schema compile/runtime decode test | _pending_ | pending |
| E-05 | No raw TS persistence payload interfaces introduced | code review assertion | _pending_ | pending |
| E-06 | `bunx tsc --noEmit --pretty false` clean | command output | _pending_ | pending |

---

## 8) Gate F — UI Semantics Preservation

| Row ID | Assertion | Verification Method | Evidence Ref | Status |
|---|---|---|---|---|
| F-01 | `tail` mode still autoscrolls to latest | existing + new tail tests | _pending_ | pending |
| F-02 | `inspect` mode still accumulates unread counts | existing + new tail tests | _pending_ | pending |
| F-03 | near-bottom threshold returns to `tail` mode | threshold test | _pending_ | pending |
| F-04 | jump-to-latest clears unread and restores `tail` | existing test extension | _pending_ | pending |
| F-05 | hydration trigger does not force unwanted tail mode | controller test | _pending_ | pending |
| F-06 | loader row styling does not clobber shared classes | css snapshot/manual review | _pending_ | pending |

---

## 9) Gate G — Redaction and Security

| Row ID | Assertion | Verification Method | Evidence Ref | Status |
|---|---|---|---|---|
| G-01 | Sensitive keys redacted in local archive writes | redaction unit tests | _pending_ | pending |
| G-02 | Nested metadata/payload redaction works recursively | redaction unit tests | _pending_ | pending |
| G-03 | Non-sensitive keys remain unchanged | golden fixture test | _pending_ | pending |
| G-04 | Hot lane retains canonical payload (no forced redaction) | integration assertion | _pending_ | pending |
| G-05 | Redaction profile persisted in manifest | schema/integration test | _pending_ | pending |

---

## 10) Gate H — Observability

| Row ID | Assertion | Verification Method | Evidence Ref | Status |
|---|---|---|---|---|
| H-01 | `AgentTask.LogDurability.publish` span emitted | tracing assertion | _pending_ | pending |
| H-02 | `AgentTask.LogDurability.ack` span emitted | tracing assertion | _pending_ | pending |
| H-03 | `AgentTask.LogArchive.spill` span emitted | tracing assertion | _pending_ | pending |
| H-04 | `AgentTask.LogArchive.evict` span emitted on quota path | tracing assertion | _pending_ | pending |
| H-05 | `AgentTask.LogHydration.plan` span emitted | tracing assertion | _pending_ | pending |
| H-06 | `AgentTask.LogHydration.fetch` span emitted | tracing assertion | _pending_ | pending |
| H-07 | cache hit/miss counters increment correctly | metric assertions | _pending_ | pending |
| H-08 | durability ack latency histogram receives samples | metric assertions | _pending_ | pending |

---

## 11) Gate I — Performance

| Row ID | Assertion | Verification Method | Evidence Ref | Status |
|---|---|---|---|---|
| I-01 | Hot append median overhead remains below budget | micro-bench | _pending_ | pending |
| I-02 | Cache-hit hydration below target latency | integration timing | _pending_ | pending |
| I-03 | Local-archive hydration below target latency | integration timing | _pending_ | pending |
| I-04 | Fallback hydration below target latency | integration timing | _pending_ | pending |
| I-05 | Hydration path does not introduce visible scroll jank | manual + automated perf run | _pending_ | pending |

---

## 12) Closure Criteria

Feature closes only if:

1. no `fail` rows in Gates A–H,
2. Gate I has no critical regressions,
3. all pending rows either pass or are explicitly deferred with approved follow-up issue.

---

## 13) Suggested Evidence Mapping File

When execution begins, create a row-evidence index doc (example naming):

- `docs/specifications/AH1-row-evidence-index.md`

Recommended columns:

- row id
- commit hash
- test/log reference
- reviewer initials
- status

---

End of acceptance matrix.
