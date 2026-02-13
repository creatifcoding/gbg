# Provider Marker Match Benchmark Report

Date: 2026-02-11  
Owner: Val

## Objective

Evaluate dispatch performance trade-offs for harness provider marker routing:

- **A**: `switch(raw.type)` + `switch(marker._tag)`
- **B**: `Match.discriminatorsExhaustive('type')` + `switch(marker._tag)`
- **C**: `switch(raw.type)` + `Match.tagsExhaustive`
- **D**: `Match.discriminatorsExhaustive('type')` + `Match.tagsExhaustive`

## Benchmark Harness

- Script: `scripts/spikes/provider-marker-match-bench.ts`
- Fixtures: `src/lib/harness/__bench__/fixtures/provider-marker-fixtures.ts`
- Command:

```bash
bun run spike:provider-marker:match --quick
bun run spike:provider-marker:match
bun run spike:provider-marker:match --stress --rounds=3
```

## Environment

- Bun: `1.3.2`
- Node ABI: `v24.3.0`
- CPU: `Intel(R) Core(TM) Ultra 9 285H`
- Cores: `16`
- OS: Linux (workspace host)

## Correctness Gate

- ✅ Checksum parity across all variants in all executed workloads/sizes.

---

## Standard Run (5 rounds, 50k + 500k)

### 50,000 events

| Workload | Variant | Ops/sec (median) | Ns/op (median) | P95 ns/op | Heap Δ | Vs Baseline |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| text-heavy | A-switch-switch | 279,248,486.47 | 3.6 | 3.8 | 0 KiB | +0% |
| text-heavy | B-match-switch | 32,247,994.82 | 31.0 | 32.0 | 10,665.3 KiB | -88.45% |
| text-heavy | C-switch-match | 52,306,398.33 | 19.1 | 33.8 | 0 KiB | -81.27% |
| text-heavy | D-match-match | 33,136,612.31 | 30.2 | 59.8 | 11.4 KiB | -88.13% |
| tool-heavy | A-switch-switch | 128,224,526.27 | 7.8 | 9.3 | 0 KiB | +0% |
| tool-heavy | B-match-switch | 57,693,949.75 | 17.3 | 18.6 | 2,437.8 KiB | -55.01% |
| tool-heavy | C-switch-match | 51,886,435.12 | 19.3 | 22.8 | 0 KiB | -59.53% |
| tool-heavy | D-match-match | 29,973,269.84 | 33.4 | 62.2 | 4.6 KiB | -76.62% |
| mixed-reasoning | A-switch-switch | 238,284,731.19 | 4.2 | 4.3 | 0 KiB | +0% |
| mixed-reasoning | B-match-switch | 59,227,390.54 | 16.9 | 20.8 | 2,421.5 KiB | -75.14% |
| mixed-reasoning | C-switch-match | 62,312,750.19 | 16.0 | 17.2 | 0 KiB | -73.85% |
| mixed-reasoning | D-match-match | 32,578,702.00 | 30.7 | 61.6 | 2.7 KiB | -86.33% |

### 500,000 events

| Workload | Variant | Ops/sec (median) | Ns/op (median) | P95 ns/op | Heap Δ | Vs Baseline |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| text-heavy | A-switch-switch | 229,471,902.54 | 4.4 | 4.8 | 0 KiB | +0% |
| text-heavy | B-match-switch | 56,943,042.38 | 17.6 | 34.7 | -12,057.9 KiB | -75.19% |
| text-heavy | C-switch-match | 50,276,738.25 | 19.9 | 36.7 | 22.4 KiB | -78.09% |
| text-heavy | D-match-match | 33,741,117.23 | 29.6 | 33.7 | 49.9 KiB | -85.30% |
| tool-heavy | A-switch-switch | 218,295,617.67 | 4.6 | 5.0 | 0 KiB | +0% |
| tool-heavy | B-match-switch | 60,184,028.31 | 16.6 | 35.3 | -71,333.6 KiB | -72.43% |
| tool-heavy | C-switch-match | 56,010,190.27 | 17.9 | 21.0 | 28.1 KiB | -74.34% |
| tool-heavy | D-match-match | 32,954,249.62 | 30.3 | 33.9 | 52.1 KiB | -84.90% |
| mixed-reasoning | A-switch-switch | 173,114,908.48 | 5.8 | 6.3 | 0 KiB | +0% |
| mixed-reasoning | B-match-switch | 60,127,988.44 | 16.6 | 19.4 | -74,186.9 KiB | -65.27% |
| mixed-reasoning | C-switch-match | 54,052,552.27 | 18.5 | 20.4 | 44.0 KiB | -68.78% |
| mixed-reasoning | D-match-match | 33,782,873.02 | 29.6 | 34.2 | 40.3 KiB | -80.49% |

---

## Stress Run Snapshot (3 rounds, up to 2,000,000)

Stress mode stayed directionally consistent (Match variants slower), with additional variance under long runs (thermal/GC effects and occasional large outliers).

### 2,000,000 events (selected)

| Workload | Variant | Ops/sec (median) | Ns/op (median) | Vs Baseline |
| --- | --- | ---: | ---: | ---: |
| text-heavy | A-switch-switch | 176,054,261.33 | 5.7 | +0% |
| text-heavy | B-match-switch | 14,230,435.75 | 70.3 | -91.92% |
| text-heavy | C-switch-match | 67,754.10 | 14,759.3 | -99.96% |
| text-heavy | D-match-match | 21,363,512.97 | 46.8 | -87.87% |
| tool-heavy | A-switch-switch | 149,756,791.23 | 6.7 | +0% |
| tool-heavy | B-match-switch | 18,365,002.74 | 54.5 | -87.74% |
| tool-heavy | C-switch-match | 39,499,753.79 | 25.3 | -73.62% |
| tool-heavy | D-match-match | 14,032,932.36 | 71.3 | -90.63% |
| mixed-reasoning | A-switch-switch | 134,831,327.36 | 7.4 | +0% |
| mixed-reasoning | B-match-switch | 39,700,566.42 | 25.2 | -70.56% |
| mixed-reasoning | C-switch-match | 36,782,914.78 | 27.2 | -72.72% |
| mixed-reasoning | D-match-match | 23,619,359.57 | 42.3 | -82.48% |

---

## Findings

1. **Baseline switch is decisively faster** in this microbenchmark.
2. Both Match variants are generally slower; in standard runs, typical regression bands were:
   - **B (raw Match + tag switch):** ~55% to ~88% slower
   - **C (raw switch + tag Match):** ~59% to ~81% slower
   - **D (full Match):** ~76% to ~88% slower
3. **Correctness is intact** across variants (checksum parity).
4. Heap delta is noisy across long runs; no consistent evidence that Match improves memory behavior in this setup.

## Decision Gate Outcome

Adopt Match in hot path only if:

- Throughput regression ≤ 10% ❌
- Allocation increase ≤ 5% ❌ (inconclusive/noisy, with some large deltas)
- No correctness diffs ✅
- Readability gain ✅ (qualitative)

**Gate result: FAIL for hot-path adoption.**

---

## Recommendation

### Final recommendation: **Hybrid architecture, but inverted from original optimism**

- Keep **raw adapter dispatch** as `switch` in `PiAiEventAdapter.toProviderMarker` (hot path).
- If we want Match ergonomics, use it in **colder consumer lanes** (analytics/reporting/debug partitioning), not per-event stream decode where throughput matters.

### Optional follow-up

- Add a second benchmark focused on **real engine path** (including appendEvent/store overhead) to quantify whether dispatch delta still matters end-to-end.
- If desired, test a precomputed table-dispatch function map as middle ground (`const handlers: Record<string, fn>`), which may preserve readability with less matcher overhead.
