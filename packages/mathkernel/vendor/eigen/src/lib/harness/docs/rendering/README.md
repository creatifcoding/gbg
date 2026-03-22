# Harness Custom Rendering Docs

This directory defines the performance and architecture guidance for custom rendering pipelines that consume `chat:v2/provider_marker` and `chat:v2/*_delta` events.

## Documents

1. [`custom-rendering-time-budget.md`](./custom-rendering-time-budget.md)
   - Frame budget math
   - Per-delta budget formula
   - Worked examples and budget tables

2. [`custom-rendering-pipeline-architecture.md`](./custom-rendering-pipeline-architecture.md)
   - Recommended two-stage pipeline (hot ingest + frame flush)
   - Delta coalescing patterns
   - Defer-heavy-work strategy

3. [`marker-dispatch-guidance.md`](./marker-dispatch-guidance.md)
   - When to use `switch` vs `Match`
   - Benchmark evidence and practical decision gates

4. [`custom-rendering-observability.md`](./custom-rendering-observability.md)
   - SLOs for transform and render stages
   - Metrics proposal and instrumentation points
   - Alert thresholds and triage flow

5. [`delta-coalescing-research.md`](./delta-coalescing-research.md)
   - Formal definition of delta coalescing
   - Strategy taxonomy including bucketed coalescing
   - Literature synthesis from networking, stream systems, and UI rendering

6. [`delta-coalescing-rigorous-model.md`](./delta-coalescing-rigorous-model.md)
   - Mathematical model and constraints
   - Waiting-time approximations for `N/T` policies
   - Bucketed optimization objective and adaptive control guidance

7. [`bibliography.md`](./bibliography.md)
   - Comprehensive external + internal references
   - Foundational papers, system-design anchors, and Effect API docs
   - Traceability support for design review and implementation decisions

8. [`overlay-reducer-pipeline-architecture.md`](./overlay-reducer-pipeline-architecture.md)
   - Fork/join reducer-overlay architecture
   - TipTap + Streamdown transfer patterns
   - Integration and rollout path for TMNL harness consumers

9. [`../benchmarks/provider-marker-match-benchmark-report.md`](../benchmarks/provider-marker-match-benchmark-report.md)
   - Dispatch performance evidence for `switch` vs `Match`

10. [`../benchmarks/overlay-reducer-pipeline-benchmark-report.md`](../benchmarks/overlay-reducer-pipeline-benchmark-report.md)
   - Throughput, latency, backlog benchmarks for overlay reducer pipeline

11. [`../specs/harness-provider-markers-spec.md`](../specs/harness-provider-markers-spec.md)
   - Canonical provider-marker contract specification

## Why this exists

Provider markers are now emitted exhaustively (`chat:v2/provider_marker`) and can drive highly custom renderers. That flexibility is only useful if we can control frame-time cost under bursty stream conditions.

This doc set provides a concrete budgeting and measurement framework so we can answer:

- "Can we keep 60 FPS while streaming?"
- "Where is latency actually spent?"
- "Which transformations belong in hot path vs deferred path?"

## Scope

These docs are focused on runtime behavior in `src/lib/harness` and consumers that subscribe to harness events. They intentionally avoid UI styling concerns and focus on throughput, latency, and correctness under load.
