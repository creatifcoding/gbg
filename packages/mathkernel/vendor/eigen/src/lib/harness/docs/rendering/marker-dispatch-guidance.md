# Marker Dispatch Guidance (`switch` vs `Match`)

## Context

Custom rendering pipelines need two things at once:

1. speed in hot dispatch loops
2. correctness/exhaustiveness as marker sets evolve

These goals are related but not identical.

---

## 1) What Effect Match gives you

Using `Match.discriminatorsExhaustive` / `Match.tagsExhaustive` (Effect docs) provides:

- compile-time exhaustive mapping of discriminated unions
- cleaner declarative handler maps
- easier refactors when tags change
- stronger safety in non-hot orchestration code

This is excellent for governance and maintainability.

---

## 2) What our benchmark shows

Reference benchmark report:

- `../benchmarks/provider-marker-match-benchmark-report.md`

Harness benchmark script:

- `scripts/spikes/provider-marker-match-bench.ts`

Standard run summary (50k and 500k event sets):

- Baseline `switch/switch` is fastest.
- `Match` variants were generally **55%–88% slower** in this micro-dispatch benchmark.
- Checksum parity passed across variants (correctness equivalent).

Interpretation:
- Match is ergonomic, but in this specific hot loop, `switch` wins materially.

---

## 3) Recommended split of responsibilities

### Hot path (per-event decode)
Use `switch`.

Why:
- maximal throughput
- minimal dispatch overhead
- easier to keep p95 within tight per-delta budgets

### Cold path (partitioning/reporting/debug)
Use `Match.tagsExhaustive` or `Match.discriminatorsExhaustive`.

Why:
- compile-time exhaustiveness where latency pressure is lower
- readable decision maps for analytics or post-processing

---

## 4) Decision gate for future reevaluation

We can reconsider Match in hot path if all pass in updated end-to-end benchmark:

- throughput regression <= 10%
- no p95 frame regressions under burst loads
- no meaningful heap/GC degradation
- clear maintainability gains over switch map

Until then, use the hybrid model above.

---

## 5) Practical coding pattern

### Hot adapter (switch)

```ts
switch (raw.type) {
  case 'text_delta':
    // fast decode
    break
  // ...
}
```

### Cold partitioner (Match)

```ts
const route = pipe(
  Match.type<Marker>(),
  Match.tagsExhaustive({
    'provider:marker/text_delta': () => 'text',
    'provider:marker/toolcall_delta': () => 'tool',
    // ...exhaustive
  }),
)
```

You get speed where it matters and exhaustiveness where it helps.

---

## 6) Team rule of thumb

- If it runs per token/delta in active stream: **prefer switch**.
- If it runs per batch/frame/summary: **prefer Match for exhaustiveness**.

That is the clean boundary between performance-critical and maintenance-critical code.
