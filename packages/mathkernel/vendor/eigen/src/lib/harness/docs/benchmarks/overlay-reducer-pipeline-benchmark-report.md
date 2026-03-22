# Overlay Reducer Pipeline Benchmark Report

Date: 2026-02-11  
Owner: Val

## Scope

Benchmark fork/join overlay reducer pipeline behavior for:

- ingest throughput (events/sec)
- emission latency (p50/p95/p99 ms)
- backlog pressure (peak + p95)
- effective coalescing (avg batch size)

This report is for the new scaffold:

- `src/lib/harness/rendering/OverlayReducerPipeline.ts`
- `src/lib/harness/rendering/schemas.ts`

## Benchmark harness

Script:

- `scripts/spikes/overlay-reducer-pipeline-bench.ts`

Fixture generator:

- `src/lib/harness/__bench__/fixtures/overlay-reducer-fixtures.ts`

Run command used:

```bash
bun run spike:overlay-reducer:pipeline --quick
```

Quick mode parameters:

- rounds: 2
- events: 2,000
- workloads: `text-burst`, `mixed-control`, `multi-session`
- producer concurrency: `1`, `8`
- variants:
  - `A-probe` (baseline)
  - `B-fork-join-light` (probe + 3 overlays)
  - `C-fork-join-heavy` (probe + 3 overlays + yield pressure)

## Results snapshot

### Throughput trend (median events/sec)

- With `maxBatchSize=32` / `maxWaitMs=8` defaults now active, throughput profile is workload-sensitive.
- In `text-burst`, fork/join light/heavy can outperform probe baseline at low producer concurrency due to better batch amortization.
- In `mixed-control` and `multi-session`, additional overlays still impose expected overhead, but degradation is materially smaller than earlier immediate-flush baseline.

Representative rows:

| Workload | Concurrency | A-probe | B-light | C-heavy |
|---|---:|---:|---:|---:|
| text-burst | 1 | 19,576 ev/s | 34,852 ev/s | 33,392 ev/s |
| text-burst | 8 | 42,944 ev/s | 38,515 ev/s | 38,743 ev/s |
| mixed-control | 8 | 19,280 ev/s | 13,303 ev/s | 15,131 ev/s |
| multi-session | 8 | 24,427 ev/s | 22,132 ev/s | 19,709 ev/s |

### Latency trend (ms)

Across quick runs:

- p50: `0–1ms`
- p95: typically `3–9ms`
- p99: up to `~11ms` in heavy fork/join cases

This is consistent with timeout-window coalescing and concurrent overlay execution overhead.

### Backlog behavior

Observed peak backlog is now materially higher than immediate-flush baseline, reflecting intentional buffering:

- `text-burst`: peak backlog ~`41` (c=1), ~`63–73` (c=8)
- `mixed-control`: peak backlog ~`33` (c=1), ~`41` (c=8)
- `multi-session`: peak backlog ~`95` (c=1), ~`103–104` (c=8)

Interpretation:

- backlog remains bounded, but buffer pressure is now visible and should be tracked as a first-class SLO indicator.

### Coalescing signal

- avg batch size is now > 1 across workloads:
  - `text-burst`: ~`5.8–6.2`
  - `mixed-control`: ~`1.32`
  - `multi-session`: ~`1.94`

Interpretation:

- coalescing is active and effective, especially in dense text workloads.
- mixed control-heavy streams naturally coalesce less due to immediate bypass classes and lane heterogeneity.

## Gate-level conclusions

1. **Deterministic collector ordering**: validated by integration/property tests.
2. **Concurrent overlay overhead**: measurable and workload-dependent; acceptable for current lane.
3. **Backlog runaway**: not observed in quick spike; backlog is bounded but now meaningful.
4. **Coalescing effectiveness**: active (avg batch > 1), with strongest gains in text-dense workloads.

## Recommended next benchmark slice

Run stress mode and persist trend tables:

```bash
bun run spike:overlay-reducer:pipeline --stress --rounds=3
```

Then tune policy against explicit SLO targets:

- tune `maxBatchSize`/`maxWaitMs` per lane bucket
- cap p95 backlog under mixed and multi-session loads
- maintain p95 latency envelope while preserving throughput gains

## Related artifacts

- Architecture: `src/lib/harness/docs/rendering/overlay-reducer-pipeline-architecture.md`
- Coalescing research: `src/lib/harness/docs/rendering/delta-coalescing-research.md`
- Rigorous model: `src/lib/harness/docs/rendering/delta-coalescing-rigorous-model.md`
