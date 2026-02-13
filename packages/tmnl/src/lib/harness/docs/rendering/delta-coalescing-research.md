# Delta Coalescing Research (Definition → Literature → Strategy)

Date: 2026-02-11  
Owner: Val

## 1) What delta coalescing is

In harness custom rendering, **delta coalescing** is the policy that transforms a high-frequency stream of incremental events (deltas/markers) into fewer, semantically safe, render commits.

Formally:

- Input: ordered event stream `E = {e1, e2, ...}`
- Output: commit batches `B = {b1, b2, ...}` where each `bk` is a subset/aggregation of events
- Constraint: output preserves required semantics (ordering, causality, terminal correctness)
- Objective: optimize latency/throughput/frame stability under bounded compute

Coalescing is not dropping fidelity. It is **controlled aggregation with correctness constraints**.

---

## 2) Why coalescing exists in this lane

Without coalescing, token-rate updates can force:

- one transform per delta
- one state write per delta
- one render commit per delta

That pattern burns frame budget and triggers avoidable reconciliation/layout churn.

`json-render` already uses lower-level emittance patterns that prove this point in practice:

- queue-driven progressive streaming (`Stream.fromQueue`)
- debounced/throttled emission in processing (`Stream.debounce`, batch processing)
- worker/off-thread processing options for heavy stages

Relevant source:
- `src/lib/json-render/core/streaming.ts`
- `src/lib/json-render/react/hooks.ts`
- `src/lib/json-render/react/observable-tree.ts`

---

## 3) Core coalescing strategies

## S1 — Time-window coalescing

Batch all events arriving in a fixed window `Δ` (e.g., 8ms).

- Good for stable frame cadence
- Latency bound predictable (`<= Δ` waiting before flush trigger)
- Can underutilize batch potential at high rates if `Δ` too small

## S2 — Count-window coalescing

Dispatch once batch reaches `N` events.

- Good for reducing per-batch overhead under high arrival rates
- Weak latency guarantees at low rates

## S3 — Hybrid threshold coalescing (`N` or `T`)

Dispatch when either:
- batch size reaches `N`, or
- timeout `T` expires

This is the practical default in many systems because it balances throughput and latency.

Observed in literature and production messaging systems as a standard tradeoff pattern.

## S4 — rAF-coalesced UI flush

Accumulate deltas continuously, flush at most once per frame.

- Aligns commit work with browser paint cycle
- Prevents overcommitting layout/reconciliation within one frame
- Pairs well with read/write separation (`rAF` writes, post-layout reads)

## S5 — Bucketed coalescing (keyed lanes)

Partition stream into independent buckets (e.g. by session/message/lane/priority), and coalesce each bucket with its own policy.

Examples of bucket keys:
- `sessionId`
- `messageId`
- marker lane (`text`, `thinking`, `toolcall`, `control`)
- urgency class (`interactive`, `background`)

This is the strategy you explicitly asked about; it is often essential.

---

## 4) When bucketed coalescing is essential

Bucketed coalescing is not just optimization; it is often a correctness + QoS requirement.

## Essential scenario A — Heterogeneous urgency classes

`text_delta` flood + rare `error/done/toolcall_end` events.

If all events share one coalescing queue, low-frequency control events can be delayed behind large text batches. Bucketed lanes with priority dispatch prevent this.

## Essential scenario B — Multi-session multiplexing

Interleaved sessions/messages over one runtime stream.

A global coalescer can create fairness and head-of-line pathologies. Bucketing by `sessionId/messageId` isolates flows and bounds cross-talk.

## Essential scenario C — Lane-specific transform cost

`thinking` and `toolcall` rendering may be much cheaper than rich text transforms.

Bucketing allows fast lanes to stay responsive while expensive lanes are deferred/coalesced more aggressively.

## Essential scenario D — SLO differentiation

Some lanes target sub-frame responsiveness; others tolerate 50–200ms.

Bucket-level `N/T` policies allow policy fit per lane instead of one-size-fits-none.

---

## 5) Literature anchors and why they matter

## (a) TCP small-packet coalescing (Nagle)

- RFC 896 highlights throughput collapse risk from tiny packet floods and proposes coalescing based on ack state.
- Insight transfer: avoid pathological tiny-unit overhead by controlled aggregation.

Source: RFC 896 — https://www.rfc-editor.org/rfc/rfc896.html

## (b) Interrupt coalescing in virtualization/hardware

- vIC shows dynamic coalescing ratio tied to commands-in-flight + completion rate.
- Insight transfer: adaptive coalescing based on backlog/rate can improve CPU efficiency while bounding latency.

Source: vIC paper (USENIX ATC’11) — https://www.usenix.org/legacy/event/atc11/tech/final_files/Ahmad.pdf

## (c) Stream/message batching (`N` + `T`) analytical modeling

- Kafka batching analysis (MASCOTS 2025): dual-trigger batching yields truncated Erlang/Poisson structure.
- Insight transfer: `N/T` policy is mathematically tractable and tunable for runtime adaptation.

Source: MASCOTS 2025 — https://qed.usc.edu/paolieri/papers/2025_mascots_arrivals_batching_simulation.pdf

## (d) Serverless inference batching under SLO constraints

- SC20 BATCH: dynamic tuning of batch size + timeout + memory for latency/cost goals.
- Insight transfer: batching policy must be adaptive under bursty arrivals and SLO constraints.

Source: SC20 BATCH — https://www2.cs.uh.edu/~fyan/Paper/Feng-SC20-BATCH.pdf

## (e) Browser event/frame coalescing

- rAF-based last-event-per-frame and read/write separation reduce layout thrash.
- Insight transfer: frame-aligned coalescing is mandatory for UI smoothness.

Source: Nolan Lawson — https://nolanlawson.com/2019/08/11/high-performance-input-handling-on-the-web/

## (f) Fair queuing and bucket schedulers

- DRR/HTB/priority+rate-limit approaches provide fairness/latency controls across mixed classes.
- Insight transfer: bucketed coalescing should include fairness and priority controls, not just batching.

Sources:
- DRR paper — https://courses.cs.duke.edu/fall24/compsci514/readings/drr.pdf
- Priority + rate-limiting for tail SLO — https://www.pdl.cmu.edu/PDL-FTP/CloudComputing/pmeister-SoCC14.pdf

---

## 6) Practical strategy catalog for harness

## Strategy P0 — Immediate control lane

No coalescing for:
- `provider:marker/error`
- terminal markers (`done`, `assistant_final`)
- critical tool lifecycle transitions

## Strategy P1 — Frame-coalesced text/thinking lanes

- Buffer deltas
- Flush once per frame (or every 8ms if no frame clock available)

## Strategy P2 — Hybrid `N/T` for heavy text lanes

- Dispatch if `pendingCount >= N_text` OR `elapsed >= T_text`
- Start with `N_text = 64`, `T_text = 8ms`

## Strategy P3 — Bucket isolation

Bucket key:
- `(sessionId, messageId, lane)`

Each bucket has independent state + `N/T` policy + backlog metrics.

## Strategy P4 — Adaptive mode

Adjust `N/T` by observed rate and backlog:
- rising backlog: increase `N`, keep `T` bounded
- idle/low rate: decrease `N`, lower latency bias

---

## 7) Immediate recommendation

Adopt a **bucketed hybrid coalescer**:

1. Partition by `(sessionId, messageId, lane)`
2. Immediate dispatch for control lane
3. `N/T` for text/thinking/tool delta lanes
4. Frame-aligned flush with max one commit/frame per bucket group
5. Backpressure mode when backlog exceeds threshold

This captures the useful parts of json-render’s emittance semantics while fitting harness chat marker workloads.

---

## 8) Next implementation questions (for design gate)

1. What exact bucket key do we standardize? `(sessionId, messageId, lane)` vs `(sessionId, lane)`
2. Do we prioritize by strict order or weighted fairness across buckets?
3. Where do we place coalescer: provider layer (`PiProvider`) or STX/UI layer (`agent-chat-stx`), or both?
4. Which metrics are required for adaptive tuning in phase 1?

See `delta-coalescing-rigorous-model.md` for mathematical model and tuning equations.

---

## 9) Bibliography and citation traceability

For the complete, maintained bibliography (external literature + Effect API references + internal TMNL evidence), see:

- `./bibliography.md`

This document intentionally includes only high-signal anchors in-line; the bibliography document is the canonical citation ledger.
