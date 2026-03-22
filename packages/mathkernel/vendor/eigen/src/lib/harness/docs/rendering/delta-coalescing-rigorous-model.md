# Delta Coalescing Rigorous Model

Date: 2026-02-11  
Owner: Val

## Purpose

Provide a mathematical framework for choosing and tuning delta coalescing strategies in custom harness rendering pipelines.

This document is intentionally formal and implementation-oriented.

---

## 1) System model

Let incoming events be a marked point process:

\[
E = \{e_j\}_{j \ge 1}, \quad e_j = (t_j, k_j, \ell_j, x_j)
\]

Where:
- \(t_j\): arrival time
- \(k_j\): bucket key (e.g. session/message)
- \(\ell_j\): lane (text, thinking, tool, control)
- \(x_j\): payload

Define bucket set \(\mathcal{B}\), with one queue per bucket \(Q_b\).

A coalescing policy \(\pi_b\) for bucket \(b\) emits batch \(B_{b,m}\) at dispatch time \(d_{b,m}\).

---

## 2) Correctness constraints

## C1: Per-bucket ordering
For events in same bucket, order must be preserved:
\[
(t_i < t_j \wedge k_i = k_j) \Rightarrow apply(e_i) \prec apply(e_j)
\]

## C2: Terminal consistency
Before applying terminal event (`done`/`final`/`error`) for a bucket, flush all pending deltas for that bucket.

## C3: Max staleness bound
For any emitted batch \(B\):
\[
\max_{e \in B}(d(B) - t(e)) \le \Delta_{max}
\]

## C4: Bounded queue growth (stability)
For each bucket \(b\):
\[
\lambda_b < \mu_b^{eff}
\]
where \(\lambda_b\) is arrival rate and \(\mu_b^{eff}\) is effective processing rate under batching.

---

## 3) Cost model

Let per-batch processing cost be:
\[
C_{batch}(n) = c_0 + c_1 n + c_2 g(n)
\]

- \(c_0\): fixed per-batch overhead (state commit, scheduling)
- \(c_1\): per-event transform cost
- \(c_2 g(n)\): nonlinear cost (e.g., join/format/reconcile growth)

Per-event average cost for batch size \(n\):
\[
C_{event}(n) = c_1 + \frac{c_0}{n} + c_2\frac{g(n)}{n}
\]

Coalescing helps mainly by reducing \(c_0/n\).

---

## 4) Waiting-time approximations by policy

Assume Poisson arrivals with rate \(\lambda\) inside a bucket.

## P1: Fixed timeout \(T\)
- Dispatch every \(T\) (or first event starts timer)
- Mean waiting approximation:
\[
\mathbb{E}[W_T] \approx \frac{T}{2}
\]

## P2: Fixed count \(N\)
- Dispatch when N events accumulated
- Mean fill time (from first event):
\[
\mathbb{E}[\tau_N] = \frac{N-1}{\lambda}
\]
- Mean waiting approximation:
\[
\mathbb{E}[W_N] \approx \frac{N-1}{2\lambda}
\]

## P3: Hybrid count-or-time (\(N\) or \(T\))
- Dispatch at \(\min(\tau_N, T)\)
- Under Poisson arrivals, full-batch time is Erlang-like and timeout branch induces truncated Poisson batch-size behavior (Kafka analytical characterization).

Operationally useful approximation:
\[
\mathbb{E}[W_{N,T}] \lesssim \min\left(\frac{T}{2}, \frac{N-1}{2\lambda}\right)
\]
with exact values available from truncated Erlang/Poisson terms when needed.

---

## 5) Frame-budget constraint

Let:
- \(F\): frame rate target (Hz)
- \(B_f\): transform budget per frame (ms/frame)
- \(R\): incoming deltas per second

Per-delta budget:
\[
B_{\delta} = \frac{B_f \cdot F}{R} \quad \text{(ms/delta)}
\]

Feasibility condition:
\[
p95\left(C_{event}\right) \le B_{\delta}
\]

Example with \(F=60\), \(B_f=2\)ms:
- \(R=200\): \(B_{\delta}=0.6\)ms
- \(R=400\): \(B_{\delta}=0.3\)ms

---

## 6) Bucketed coalescing model

Partition events into \(M\) buckets with rates \(\lambda_1, \dots, \lambda_M\).

Each bucket has independent policy \((N_b, T_b)\), and optional priority weight \(w_b\).

Total expected waiting across traffic mix:
\[
\mathbb{E}[W_{mix}] = \sum_{b=1}^{M} p_b \; \mathbb{E}[W_b], \quad p_b = \frac{\lambda_b}{\sum_j \lambda_j}
\]

### Why buckets can be essential mathematically

With a global queue, heterogeneous classes share one policy and one service sequence; high-volume lane can inflate service latency for urgent low-volume class via queue occupancy and batch service time.

Bucketing isolates queues and allows per-class \((N_b, T_b)\), yielding class-specific latency bounds:
\[
\mathbb{E}[W_{control}] \ll \mathbb{E}[W_{text}]
\]
without requiring global over-conservative settings.

---

## 7) Optimization objective

Choose \(\{N_b, T_b, w_b\}\) to minimize weighted objective:
\[
J = \alpha \cdot \mathbb{E}[L] + \beta \cdot \mathbb{E}[CPU] + \gamma \cdot \mathbb{E}[Backlog] + \delta \cdot \mathbb{P}(SLO\ violation)
\]

Subject to:
- \(p95(L_b) \le SLO_b\) for critical buckets
- frame budget constraints
- stability \(\lambda_b < \mu_b^{eff}\)

---

## 8) Adaptive control law (practical)

For each bucket \(b\), maintain EWMA arrival rate \(\hat{\lambda}_b\), backlog \(q_b\), and p95 transform latency \(\hat{c}_b\).

Example controller:

- if \(q_b > q_{hi}\): increase \(N_b\) up to cap, keep \(T_b\) bounded
- if \(q_b < q_{lo}\) and SLO headroom exists: decrease \(N_b\) or \(T_b\)
- if \(\hat{c}_b > B_{\delta,b}\): move expensive transforms to terminal/idle stage

Priority override:
- control bucket preempts coalesced text bucket on terminal/error markers.

---

## 9) Candidate strategy set for harness

## Strategy A (baseline)
- Global \((N,T)\), no buckets
- Useful only for low-rate/simple surfaces

## Strategy B (recommended phase-1)
- Bucket key: `(sessionId, messageId, lane)`
- Control lane immediate (N=1, T≈0)
- Text/thinking/tool lanes hybrid \((N,T)\)
- Flush aligned to rAF with max one commit/frame per bucket group

## Strategy C (phase-2)
- Strategy B + adaptive \((N_b,T_b,w_b)\)
- Backpressure degradation mode under backlog surge

---

## 10) Evaluation protocol (for rigor)

1. Reproduce incoming rate envelopes (normal/burst/flood)
2. Measure per-bucket:
   - p50/p95/p99 transform time
   - batch size distribution
   - waiting-time distribution
   - backlog depth over time
3. Validate SLO compliance by class
4. Stress with mixed-lane floods and verify control-lane latency remains bounded
5. Compare Strategy A vs B vs C

Minimum acceptance for rollout:
- control-lane p95 latency bound preserved under text flood
- no unbounded backlog drift
- frame budget violations below agreed threshold

---

## 11) References used for this model

Primary anchors used directly in equations/constraints:

- RFC 896 (small-unit overhead and coalescing rationale)
- MASCOTS 2025 Kafka batching analysis (truncated Erlang/Poisson)
- SC20 BATCH (adaptive `N/T` parameterization under SLO)
- DRR (fair scheduling for bucketed arbitration)
- PriorityMeister (priority + rate-limit tail-SLO method)
- rAF frame-aligned scheduling guidance

For full citation details, including URLs and additional supporting references, see:

- `./bibliography.md`
