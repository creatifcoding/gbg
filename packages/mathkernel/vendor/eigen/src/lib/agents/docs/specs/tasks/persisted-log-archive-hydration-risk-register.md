# Persisted Log Archive + Hydration — Risk Register

Status: Draft v1  
Scope: operational + implementation risk for AH1 feature bundle

---

## 1) Rating Model

- Probability: `1 (rare)` to `5 (frequent)`
- Impact: `1 (minor)` to `5 (critical)`
- Risk Score: `Probability * Impact`

Interpretation:

- `1–6` low
- `7–12` moderate
- `13–25` high

---

## 2) Primary Risk Ledger

| Risk ID | Category | Description | Prob | Impact | Score | Owner | Status |
|---|---|---|---:|---:|---:|---|---|
| R-01 | Durability | JetStream ack latency spikes causing delayed archive eligibility | 3 | 4 | 12 | runtime | open |
| R-02 | Durability | JetStream intermittent outages causing retry storms | 3 | 5 | 15 | runtime | open |
| R-03 | Archive | localStorage quota reached unexpectedly on long-running sessions | 4 | 3 | 12 | storage | open |
| R-04 | Archive | Eviction logic removes wrong chunk (index corruption) | 2 | 5 | 10 | storage | open |
| R-05 | Archive | Manifest/chunk version mismatch after deployment | 2 | 4 | 8 | storage | open |
| R-06 | Hydration | Window planner repeatedly fetching overlapping slices | 3 | 3 | 9 | hydration | open |
| R-07 | Hydration | In-flight request duplication causing bandwidth spikes | 3 | 3 | 9 | controller | open |
| R-08 | Merge | Non-deterministic ordering due to timestamp collisions | 3 | 4 | 12 | controller | open |
| R-09 | Merge | Dedupe key insufficient for replay overlap edge cases | 2 | 4 | 8 | controller | open |
| R-10 | UX | Scroll jump/jank on hydration insertions | 3 | 4 | 12 | ui | open |
| R-11 | UX | Tail/inspect semantics regressing under hydration pressure | 2 | 5 | 10 | ui | open |
| R-12 | Security | Redaction misses sensitive nested fields | 3 | 5 | 15 | security | open |
| R-13 | Security | Over-redaction removes necessary debug context | 2 | 3 | 6 | security | open |
| R-14 | Observability | Missing spans prevent debugging degraded modes | 3 | 3 | 9 | observability | open |
| R-15 | Testing | False confidence from incomplete failure-path tests | 3 | 4 | 12 | qa | open |

---

## 3) Detailed Mitigation Playbooks

## R-01 / R-02 — JetStream Durability Risks

### Trigger Signals

- ack latency p95 exceeds expected envelope
- retry count spikes over baseline
- sustained publish timeout errors

### Mitigations

1. bounded exponential retry with jitter
2. per-task retry lane and backpressure cap
3. degraded-mode flags surfaced to UI diagnostics
4. explicit ack timeout classification (not generic unknown error)

### Fallback Posture

- continue hot lane ingestion
- suspend archive spill for non-acked entries
- avoid blocking UI append path

### Verification

- durability chaos tests
- latency histogram review

---

## R-03 / R-04 / R-05 — Archive Storage Risks

### Trigger Signals

- quota write exceptions
- manifest/chunk decode failures
- monotonic offset violations

### Mitigations

1. oldest-chunk eviction then single retry
2. strict manifest/chunk schema decode guard
3. monotonicity assertions in chunk writer
4. archive-lane isolation (degrade without app failure)

### Fallback Posture

- enter `ArchiveDegraded`
- keep durability + hot lane intact
- disable only archive-dependent hydration paths when necessary

### Verification

- forced quota test
- corruption fixture decode tests
- continuity assertions for offsets/chunk counts

---

## R-06 / R-07 — Hydration Planner and Request Coalescing

### Trigger Signals

- repeated fetches for same window key
- high cache miss ratio with repeated offsets

### Mitigations

1. deterministic window keying
2. in-flight coalescing by task/window key
3. request debounce near threshold
4. cache-first short-circuit

### Verification

- controller integration tests counting fetch calls
- cache hit/miss ratio metrics

---

## R-08 / R-09 — Merge and Dedupe Integrity

### Trigger Signals

- flaky ordering tests
- duplicate rows reported after hydration

### Mitigations

1. stable deterministic sort with tie-break key
2. dedupe map keyed by `id+timestamp`
3. edge-case fixtures for equal timestamp and replay overlaps

### Verification

- dedicated deterministic merge suite
- randomized overlap fuzz test (bounded)

---

## R-10 / R-11 — UX Semantics Regressions

### Trigger Signals

- reports of auto-scroll breaking
- unread counts inconsistent
- jump-to-latest unreliable

### Mitigations

1. preserve existing controller contracts first
2. hydration trigger only in inspect + near-top
3. insertion policy minimizing visual shift
4. maintain existing tail tests as hard regressions

### Verification

- tail semantics tests (existing + expanded)
- manual smoothness check under stream load

---

## R-12 / R-13 — Redaction Risks

### Trigger Signals

- sensitive keys visible in local chunks
- debugging fields unexpectedly masked

### Mitigations

1. curated sensitive key matcher list
2. recursive traversal tests for nested payloads
3. policy mode support (redact vs allowlist)
4. explicit manifest redaction profile

### Verification

- golden-file redaction tests
- negative tests for non-sensitive keys

---

## R-14 / R-15 — Observability and Confidence Risks

### Trigger Signals

- inability to trace degraded path
- missing metrics during incidents

### Mitigations

1. required span names as acceptance rows
2. counter/histogram assertions in tests
3. evidence docs linking gates to logs/tests

### Verification

- trace assertions in integration tests
- acceptance matrix row completion review

---

## 4) Risk Prioritization Queue

Highest current score first:

1. `R-02` JetStream outages/retry storm (`15`)
2. `R-12` Redaction misses sensitive data (`15`)
3. `R-01`, `R-03`, `R-08`, `R-10`, `R-15` (all `12`)

Implementation should front-load mitigations for these rows.

---

## 5) Operational Triggers and Runbook Hooks

### Trigger Set A — Durability Distress

- `log_durability_ack_failures_total` uptrend
- `log_durability_ack_latency_ms` p95 spike

Action:

1. inspect `AgentTask.LogDurability.*` spans
2. verify retry lane pressure
3. decide degraded mode posture

### Trigger Set B — Archive Distress

- `log_archive_quota_evictions_total` surge
- repeated archive write failures after eviction

Action:

1. inspect `AgentTask.LogArchive.evict` spans
2. verify chunk continuity
3. confirm `ArchiveDegraded` behavior

### Trigger Set C — Hydration Distress

- `log_hydration_failures_total` spike
- miss ratio unexpectedly high

Action:

1. inspect window planner output
2. validate cache keying and TTL expiry
3. check fallback path health

---

## 6) Exit Conditions for Risk Closure

Risk can move to `mitigated` when:

1. mitigation implemented,
2. verification evidence recorded,
3. acceptance matrix rows linked and passing.

Risk can move to `accepted` (without full mitigation) only with explicit rationale and owner signoff.

---

## 7) Review Cadence

- pre-implementation: full review
- mid-implementation (after I4): focused review on durability + UX
- pre-closure: full review against acceptance matrix

---

End of risk register.
