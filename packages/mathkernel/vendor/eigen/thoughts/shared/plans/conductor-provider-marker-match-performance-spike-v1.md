# Conductor Harness — Provider Marker Match Performance Spike (v1)

Owner: Val  
Date: 2026-02-11  
Scope: `src/lib/harness/PiAiEventAdapter.ts` marker dispatch + downstream marker consumers

---

## 0) Why this spike exists

Prime, we can absolutely use `Match` for marker routing. The right question is whether we pay a hot-path tax versus `switch` when processing high-frequency `text_delta` streams.

This spike is a decision probe, not a refactor commitment.

---

## 1) Decision to make

Should we replace current `switch`-style provider-marker dispatch with Effect `Match` APIs (`Match.discriminatorsExhaustive` / `Match.tagsExhaustive`) in the harness hot path?

We choose based on measured throughput + allocation behavior under realistic stream load.

---

## 2) Hypotheses

### H1 — Tagged consumer dispatch
`Match.tagsExhaustive` on already-decoded tagged markers (`marker._tag`) is within **±10%** throughput of `switch` and improves exhaustiveness/readability.

### H2 — Raw event adapter dispatch
`Match.discriminatorsExhaustive("type")` on raw provider events may be slightly slower than `switch` due to matcher scaffolding, but should remain within **±15%** for realistic event mixes.

### H3 — Allocation pressure
`Match` variants should not increase allocation/GC pause by more than **5%** versus baseline `switch`.

---

## 3) Benchmark variants

### Variant A — Baseline (current)
- Raw dispatch in adapter via `switch (rawType)`
- Consumer dispatch via `if/switch` on `_tag`

### Variant B — Match on raw provider events
- Adapter path uses `Match.discriminatorsExhaustive("type")({ ... })`

### Variant C — Hybrid (recommended candidate)
- Keep raw adapter as `switch`
- Use `Match.tagsExhaustive` for downstream marker consumers (`chat:v2/provider_marker` rendering/partition)

### Variant D — Full Match
- Raw adapter + consumer both use Match

---

## 4) Workloads (event distributions)

Use deterministic fixtures with 3 loads:

1. **Text-heavy (default chat)**
   - 1 `start`
   - 1 `text_start`
   - 40 `text_delta`
   - 1 `text_end`
   - 1 `done`

2. **Tool-heavy**
   - toolcall start/delta/end cycles + sparse text

3. **Mixed reasoning**
   - interleaved `thinking_*`, `text_*`, `toolcall_*`, with occasional `error`

Target corpus size per run:
- 50k events (quick)
- 500k events (steady-state)
- 2M events (stress)

---

## 5) Metrics to collect

Primary:
- ops/sec
- ns/op
- p50/p95 per-event dispatch latency

Secondary:
- heap delta (`process.memoryUsage().heapUsed`)
- GC events / pause time (if available via Bun runtime hooks)
- CPU profile samples (single representative run)

Correctness guard:
- All variants must produce identical marker tags/counts for same fixture.

---

## 6) Harness for the spike

### Proposed files
- `scripts/spikes/provider-marker-match-bench.ts`
- `src/lib/harness/__bench__/fixtures/provider-marker-fixtures.ts`
- `src/lib/harness/docs/benchmarks/provider-marker-match-benchmark-report.md` (results)

### Execution command
```bash
bun run scripts/spikes/provider-marker-match-bench.ts
```

Optional CI-safe quick mode:
```bash
bun run scripts/spikes/provider-marker-match-bench.ts --quick
```

---

## 7) Methodology

1. Warm-up each benchmark case (JIT/runtime stabilization).
2. Run each case for fixed duration (e.g. 5s) × 5 repetitions.
3. Randomize variant order to reduce thermal/boost bias.
4. Report median + confidence interval where possible.
5. Record machine metadata (CPU model, Bun version, OS).

---

## 8) Effect/Match notes (source-grounded)

Effect `Match` internals (`effect/dist/esm/internal/matcher.js`) indicate:
- `tagsExhaustive` delegates to discriminator routing on `_tag`
- matcher execution still performs runtime checks and function dispatch

Interpretation:
- It is likely competitive for clarity/exhaustiveness.
- We should verify hot-loop overhead empirically before replacing baseline adapter switch.

---

## 9) Acceptance gates

Adopt `Match` in hot path only if all pass:

1. Throughput regression ≤ 10% (text-heavy and mixed workloads)
2. Allocation increase ≤ 5%
3. No correctness diffs
4. Code readability improves via exhaustive compile-time mapping

If not met:
- Keep `switch` for adapter hot path
- Use `Match.tagsExhaustive` in non-hot consumer partitioning where ergonomics wins

---

## 10) Deliverables

- Benchmark script + fixtures
- Result report with tables/charts
- Recommendation memo: **switch**, **match**, or **hybrid**
- Follow-up implementation task only after decision gate approval

---

## 11) Suggested recommendation bias (pre-data)

Start with **Hybrid (Variant C)** as likely best architecture:
- raw marker decode stays `switch` (fast path)
- downstream marker handling gets `Match.tagsExhaustive` (type-safe and elegant)

But we let the numbers vote.
