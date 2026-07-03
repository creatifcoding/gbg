# Comprehensive Bibliography — Delta Coalescing, Batching, and Tail-Latency Control

Date: 2026-02-11  
Owner: Val

This bibliography supports the harness custom-rendering research and rigorous modeling docs:

- `delta-coalescing-research.md`
- `delta-coalescing-rigorous-model.md`
- `custom-rendering-time-budget.md`
- `custom-rendering-pipeline-architecture.md`
- `custom-rendering-observability.md`
- `marker-dispatch-guidance.md`

---

## A) Foundations: small-unit overhead, coalescing, and congestion

### [B01] Nagle, J. (1984). *RFC 896: Congestion Control in IP/TCP Internetworks*.
- URL: https://www.rfc-editor.org/rfc/rfc896.html
- Why it matters: canonical small-packet/coalescing tradeoff; throughput-vs-latency framing.

### [B02] Nagle’s algorithm summary (background)
- URL: https://en.wikipedia.org/wiki/Nagle%27s_algorithm
- Why it matters: operational interpretation of RFC 896 behavior.

---

## B) Adaptive coalescing in systems

### [B03] Ahmad, I., Gulati, A., Mashtizadeh, A. (2011). *vIC: Interrupt Coalescing for Virtual Machine Storage Device IO* (USENIX ATC).
- URL: https://www.usenix.org/legacy/event/atc11/tech/final_files/Ahmad.pdf
- Why it matters: adaptive coalescing based on in-flight work and completion rates.

### [B04] Interrupt coalescing overview (background)
- URL: https://en.wikipedia.org/wiki/Interrupt_coalescing
- Why it matters: concise summary of latency/throughput tension.

---

## C) Batching theory and queueing models (N/T policies, waiting time)

### [B05] Horváth, A., Paolieri, M., Picano, B., Vicario, E. (2025). *Analytical Characterization and Efficient Simulation of Batched Arrivals in the Kafka Broker* (MASCOTS).
- URL: https://qed.usc.edu/paolieri/papers/2025_mascots_arrivals_batching_simulation.pdf
- Why it matters: exact truncated Erlang/Poisson characterization for dual-trigger `N/T` batching.

### [B06] Feng, Y. et al. (2020). *BATCH: ML Inference Serving on Serverless Platforms with Adaptive Batching* (SC20).
- URL: https://www2.cs.uh.edu/~fyan/Paper/Feng-SC20-BATCH.pdf
- Why it matters: adaptive tuning of batch size + timeout under SLO and cost constraints.

### [B07] Medhi, J. (1975). *Waiting Time Distribution in a Poisson Queue with a General Bulk Service Rule*.
- URL: https://pubsonline.informs.org/doi/10.1287/mnsc.21.7.777
- Why it matters: foundational waiting-time analysis for bulk service queues.

### [B08] Holman, D.F., Chaudhry, M.L., Ghosal, A. (1981). *Some Results for the General Bulk Service Queueing System*.
- URL: https://www.cambridge.org/core/services/aop-cambridge-core/content/view/3167652B591F6B8B4D9E8DDF88D7C476/S0004972700007012a.pdf/some_results_for_the_general_bulk_service_queueing_system.pdf
- Why it matters: threshold/quorum and bulk-service behavior relevant to bucket dispatch policies.

### [B09] Powell, W.B., Humblet, P. (1985). *The Bulk Service Queue with a General Control Strategy*.
- URL: https://dspace.mit.edu/bitstream/handle/1721.1/2894/P-1481-15607269.pdf;sequence=1
- Why it matters: generalized control formulations for bulk-service systems.

---

## D) Fairness and scheduling for mixed classes

### [B10] Shreedhar, M., Varghese, G. (1995). *Efficient Fair Queuing using Deficit Round Robin* (SIGCOMM).
- URL: https://courses.cs.duke.edu/fall24/compsci514/readings/drr.pdf
- Why it matters: O(1) fair scheduling model for bucket-level arbitration.

### [B11] PriorityMeister (SoCC 2014): Zhu, T. et al. *Tail Latency QoS for Shared Networked Storage*.
- URL: https://www.pdl.cmu.edu/PDL-FTP/CloudComputing/pmeister-SoCC14.pdf
- Why it matters: combines priority + rate limits to satisfy high-percentile latency SLOs under burstiness.

### [B12] Token bucket / HTB background
- URL: https://en.wikipedia.org/wiki/Token_bucket
- Why it matters: practical shaping primitive for burst control and fairness constraints.

---

## E) Browser/UI frame-aligned coalescing

### [B13] Lawson, N. (2019). *High-performance input handling on the web*.
- URL: https://nolanlawson.com/2019/08/11/high-performance-input-handling-on-the-web/
- Why it matters: rAF-aligned coalescing, write/read phase separation, anti-thrashing guidance.

### [B14] MDN: `window.requestAnimationFrame`
- URL: https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame
- Why it matters: browser scheduling semantics for frame-coalesced flush design.

### [B15] W3C Animation Timing
- URL: https://www.w3.org/TR/animation-timing/
- Why it matters: specification-level timing model backing rAF behavior.

### [B16] `requestPostAnimationFrame` proposal (WICG)
- URL: https://github.com/WICG/requestPostAnimationFrame
- Why it matters: post-layout read phase for reducing layout thrash during high-frequency updates.

---

## F) Effect-specific APIs and semantics used in proposed pipeline

### [B17] Effect docs: `Stream.fromQueue`
- URL: https://effect.website/docs/api/effect/Stream#fromqueue
- Why it matters: progressive queue-backed stream construction in hot ingest path.

### [B18] Effect docs: `Stream.groupedWithin`
- URL: https://effect.website/docs/api/effect/Stream#groupedwithin
- Why it matters: hybrid size/time micro-batching primitive.

### [B19] Effect docs: `Match.tagsExhaustive`
- URL: https://effect.website/docs/api/effect/Match#tagsexhaustive
- Why it matters: exhaustive tagged-dispatch in non-hot paths.

### [B20] Effect docs: `Match.discriminatorsExhaustive`
- URL: https://effect.website/docs/api/effect/Match#discriminatorsexhaustive
- Why it matters: compile-time completeness for discriminator-based routing.

---

## G) Internal codebase evidence (TMNL)

### [B21] `src/lib/json-render/core/streaming.ts`
- Why it matters: queue-driven progressive streaming + debounce/grouping patterns already proven in-project.

### [B22] `src/lib/json-render/react/hooks.ts`
- Why it matters: end-to-end stream integration and cancellation/yield behavior in reactive consumer path.

### [B23] `src/lib/json-render/react/observable-tree.ts`
- Why it matters: batch mutation/coalesced update semantics and fine-grained state propagation.

### [B24] `docs/implementation/provider-marker-match-benchmark-report.md`
- Why it matters: local benchmark evidence for switch-vs-Match dispatch cost in this codebase.

### [B25] `docs/implementation/harness-provider-markers-spec.md`
- Why it matters: exhaustive marker taxonomy and event projection contract.

### [B26] `src/lib/harness/schemas.ts`
- Why it matters: canonical marker/event schema definitions consumed by the rendering pipeline.

---

## Notes on usage

1. Use [B05]/[B06]/[B07] when formalizing `N/T` waiting-time behavior and tuning heuristics.
2. Use [B13]-[B16] when making frame-coalesced UI scheduling decisions.
3. Use [B10]-[B12] when adding bucket fairness/priority controls.
4. Use [B21]-[B26] for implementation-grounded justification in TMNL-specific design docs and reviews.
