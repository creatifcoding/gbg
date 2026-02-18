# ADR-003: Hydration Strategy = Newest-First Anchor with ±500 Window + 5m TTL Cache

Status: Accepted (v1)  
Date: 2026-02-17

---

## Decision

Hydration requests are planned using newest-first anchor semantics with a default `±500` window and a 5-minute in-memory cache TTL.

Read order is:

1. hydration cache
2. local archive chunks
3. NATS fallback for gaps

---

## Why

1. preserves tail-biased operator workflow
2. controls fetch fan-out with deterministic windowing
3. reduces repeated IO via short-lived cache
4. avoids idle-task memory hoarding while keeping scroll experience responsive

---

## Consequences

### Positive

- predictable hydration behavior
- bounded cache memory
- reduced redundant archive/fallback fetches

### Negative

- cache staleness window up to TTL
- potential additional fallback traffic when cache misses under heavy navigation

---

## Implementation Implications

1. introduce `LogHydrationService.planWindow` and `hydrate`
2. add in-flight request coalescing keyed by task/window
3. enforce deterministic merge + dedupe (`id+timestamp`)
4. preserve existing tail/inspect controller semantics

---

## Rejected Alternatives

1. oldest-first anchor
   - rejected: conflicts with primary tail-oriented interaction mode

2. unbounded hydration window
   - rejected: memory and latency unpredictability

3. no cache
   - rejected: repeated fetch cost and avoidable UI latency

4. very long cache TTL (>=30m)
   - rejected: high stale-memory risk for multi-task sessions

---

## Validation

Must satisfy acceptance rows:

- C-04, C-05, C-06
- F-01..F-05
- I-02, I-03, I-04

---

## References

- `../persisted-log-archive-hydration-spec.md`
- `../persisted-log-archive-hydration-implementation-details.md`
- `../../../persisted-logs-research.md` (Q4/Q5)

---

End ADR-003.
