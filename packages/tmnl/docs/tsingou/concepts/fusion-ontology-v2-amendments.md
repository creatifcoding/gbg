# TSGC-001 v2: Unified Amendment Specification

```
Document:   TSGC-001-v2 — Fusion Ontology Amendments (Unified)
Status:     DRAFT
Created:    2026-02-19
Supersedes: Individual amendment files (R1-R9)
Amends:     TSGC-001 — Fusion Ontology Design
Evidence:   TSGC-GT-001 (Grounded Theory: Data Fusion)
Authors:    grounded-theory-analyst (synthesis + R4/R8/R9)
            tracking-researcher (R1/R7)
            adversarial-researcher (R2/R3)
            geospatial-researcher (R5/R6)
```

> **Purpose**: This document synthesizes the nine gap-fix amendments (R1-R9)
> produced by four specialist agents into a single, cross-referenced
> specification. It resolves inter-amendment conflicts, ensures schema
> consistency, and produces a coherent upgrade path from TSGC-001 to v2.
>
> **How to read this document**: Each section corresponds to a proposed
> change in TSGC-001. Sections are ordered by their target location in the
> amended ontology, not by amendment number. A traceability matrix at the
> end maps each change to its source amendment and evidence.

---

## Table of Contents

1. [Erratum: Three Corrections to TSGC-001](#1-erratum-three-corrections-to-tsgc-001)
2. [Section 3.1 Amendment: Hard Key Confidence](#2-section-31-amendment-hard-key-confidence)
3. [Section 3.2.2 Amendment: Confidence Combination](#3-section-322-amendment-confidence-combination)
4. [Section 3.3 Amendment: Tier 3 Decomposition](#4-section-33-amendment-tier-3-decomposition)
5. [New Section 3.4: Data Duality — Event Streams vs Reference Tables](#5-new-section-34-data-duality)
6. [New Section 3.5: Blocking Strategy for Scalable Joins](#6-new-section-35-blocking-strategy)
7. [New Section 3.6: Temporal Join Semantics](#7-new-section-36-temporal-join-semantics)
8. [New Section 5.4: Track Lifecycle Management](#8-new-section-54-track-lifecycle-management)
9. [New Section 5.5: Negative-Space Detection](#9-new-section-55-negative-space-detection)
10. [New Section 5.6: Risk Accumulation](#10-new-section-56-risk-accumulation)
11. [Section 6 Amendment: Join Path Registry](#11-section-6-amendment-join-path-registry)
12. [Section 7 Amendment: d2ts Compilation](#12-section-7-amendment-d2ts-compilation)
13. [Section 8 Amendment: Operator Interface](#13-section-8-amendment-operator-interface)
14. [Section 9 Amendment: Confidence Semantics](#14-section-9-amendment-confidence-semantics)
15. [New Section 9.1: Confidence Calibration Framework](#15-new-section-91-confidence-calibration)
16. [New Section 9.2: Sequence Patterns](#16-new-section-92-sequence-patterns)
17. [Section 10 Amendment: Research Initiatives](#17-section-10-amendment-research-initiatives)
18. [Unified Schema Specification](#18-unified-schema-specification)
19. [Reconciliation Log](#19-reconciliation-log)
20. [Traceability Matrix](#20-traceability-matrix)
21. [References](#21-references)

---

## 1. Erratum: Three Corrections to TSGC-001

The grounded theory analysis (TSGC-GT-001 Section 3.4) identified three
items in TSGC-001 that are factually WRONG, not merely incomplete. These
corrections are mandatory and do not require operator action.

### E1: Hard Key Confidence Is Not 1.0

**Location**: Section 3.1, Properties.

**Current**: `Confidence: 1.0 (no ambiguity)`

**Corrected**: `Confidence: 0.99 (assumes authentic identifier)`

**Rationale**: AIS MMSI spoofing is documented in maritime domain awareness
operations. ADS-B ICAO hex spoofing is technically trivial (unencrypted
broadcast). IP addresses are spoofable. Even "authoritative" registries
contain stale entries. Claiming 1.0 confidence for any identifier-based
match ignores real-world adversarial conditions.
[Source: R4.1, TSGC-GT-001 Section 1.6.2]

### E2: Predicate Independence Assumption Is Invalid

**Location**: Section 3.2.2, Confidence Combination.

**Current**: Simple weighted average `C = SUM(w_i * score_i) / SUM(w_i)`
without any independence correction.

**Corrected**: Weighted average with evidence correlation discount.

**Rationale**: Spatial and temporal proximity are strongly correlated
(entities near each other geographically tend to be near each other
temporally). Treating them as independent double-counts evidence. Bar-Shalom
explicitly warns that correlated inputs produce overconfident estimates.
[Source: R4.2, TSGC-GT-001 Section 1.7.2]

### E3: Tier 3 Wildcard Is a Placeholder, Not a Design

**Location**: Section 3.3, PAIR 8.

**Current**: `PAIR 8: * x * (DISABLED by default -- Tier 3 statistical)`

**Corrected**: Four specific Tier 3 methods (3A-3D) with individual
configurations, each independently toggleable.

**Rationale**: Every surveyed production system using statistical correlation
employs specific, well-defined methods. No system uses a "correlate
everything with everything" operator. The wildcard approach is both
computationally intractable and operationally useless.
[Source: R8.1, TSGC-GT-001 Section 3.3]

---

## 2. Section 3.1 Amendment: Hard Key Confidence

**Source amendment**: R4.1 (grounded-theory-analyst)

Replace Section 3.1 properties:

```
CURRENT (TSGC-001):
  Properties:
  - Confidence: 1.0 (no ambiguity)
  - Latency: <1ms per join
  - False positive rate: 0 (barring spoofing)

AMENDED (v2):
  Properties:
  - Confidence: 0.99 (assumes authentic identifier — see spoofing discount)
  - Latency: <1ms per hash lookup (d2ts propagation latency additional)
  - False positive rate: ~0 (non-zero due to spoofing, typos, stale data)
  - Spoofing discount: When RI-7 spoofing heuristics flag an identifier,
    confidence degrades to f(spoofing_indicators):

    SPOOFING DISCOUNT TABLE:
      No flags:           C = 0.99
      Format anomaly:     C = 0.90
      Behavioral anomaly: C = 0.75
      Known spoofing:     C = 0.50
```

The spoofing discount table is consumed by:
- **R2 Absence Detection** (Section 5.5): Absence confidence is multiplied
  by the trust level from this table to prevent spoofed entities from
  generating high-confidence absence events.
- **R3 Risk Accumulation** (Section 5.6): Spoofing indicators produce
  risk indicators in the SIG and ID categories.

---

## 3. Section 3.2.2 Amendment: Confidence Combination

**Source amendments**: R4.2, R4.3, R4.4, R4.6 (grounded-theory-analyst)

### 3.1 Evidence Correlation Discount (R4.2)

Replace the confidence combination formula:

```
CURRENT (TSGC-001):
  C = SUM(w_i * score_i) / SUM(w_i)

AMENDED (v2):

  Step 1: Compute raw weighted score
    C_raw = SUM(w_i * score_i) / SUM(w_i)

  Step 2: Apply correlation discount
    Identify correlated predicate pairs from the correlation matrix:

    CORRELATION MATRIX (default, operator-configurable):
    +------------+----------+----------+----------+------------+----------+
    |            | spatial  | temporal | spectral | behavioral | semantic |
    +------------+----------+----------+----------+------------+----------+
    | spatial    |   1.0    |   0.6    |   0.1    |    0.4     |   0.05   |
    | temporal   |   0.6    |   1.0    |   0.1    |    0.3     |   0.1    |
    | spectral   |   0.1    |   0.1    |   1.0    |    0.05    |   0.0    |
    | behavioral |   0.4    |   0.3    |   0.05   |    1.0     |   0.1    |
    | semantic   |   0.05   |   0.1    |   0.0    |    0.1     |   1.0    |
    +------------+----------+----------+----------+------------+----------+

    For each pair (i, j) where i < j:
      redundancy_ij = correlation_ij * min(score_i, score_j)
      total_redundancy = SUM(w_i * w_j * redundancy_ij) / SUM(w_i)^2

  Step 3: Discounted confidence
    C = C_raw * (1.0 - total_redundancy * discount_factor)
    discount_factor: 0.3 (default)

  Step 4: Clamp
    C = clamp(C, 0.0, 0.99)
```

**Worked example** (ADS-B + AIS co-location):

```
  spatial_score = 0.85 (380m apart, max 500m)
  temporal_score = 0.90 (12s apart, max 60s)
  behavioral_score = 0.70 (both stationary)

  C_raw = (0.35*0.85 + 0.25*0.90 + 0.15*0.70) / (0.35+0.25+0.15)
        = 0.837

  Correlated pairs:
    spatial-temporal:   r=0.6, redundancy = 0.6 * min(0.85,0.90) = 0.51
    spatial-behavioral: r=0.4, redundancy = 0.4 * min(0.85,0.70) = 0.28
    temporal-behavioral: r=0.3, redundancy = 0.3 * min(0.90,0.70) = 0.21

  total_redundancy = (0.35*0.25*0.51 + 0.35*0.15*0.28 + 0.25*0.15*0.21)
                   / (0.75)^2
                   = 0.1195

  C = 0.837 * (1.0 - 0.1195 * 0.3) = 0.837 * 0.964 = 0.807
```

The discount reduces C from 0.837 to 0.807 — a modest correction that
prevents double-counting of correlated evidence.

### 3.2 Confidence Model Selection (R4.3)

The FusionOntology gains a `confidenceModel` field selecting between three
combination strategies:

| Model | When to Use | Properties |
|-------|-------------|------------|
| **weighted_average** (DEFAULT) | Always for production use | Simple, interpretable, calibratable |
| **log_odds** | Extreme value sensitivity needed | Better math properties, less intuitive |
| **dempster_shafer** | Expert mode, ignorance representation | Requires operator training |

**Weighted average** is the production default. The correlation discount
(Section 3.1 above) applies in all modes.

**Log-odds mode** (R4.4):

```
  Step 1: lo_i = log(score_i / (1 - score_i))
  Step 2: lo_combined = SUM(w_i * lo_i) / SUM(w_i)
  Step 3: C = 1 / (1 + exp(-lo_combined))
  Step 4: Apply correlation discount
  Step 5: Clamp to [0.01, 0.99]
```

**Dempster-Shafer mode** (R4.3, optional expert module):

```
  Representation: mass functions m(H) over {match, no_match, unknown}
  Combination: Dempster's rule, m_combined = m_1 + m_2 + ... + m_N
  Conflict detection: K > 0.7 warns operator; K > 0.9 refuses combination
  Output: interval [belief, plausibility], midpoint for threshold comparison
```

Use D-S ONLY when representing explicit ignorance matters AND sources are
independent AND operators are trained on belief/plausibility semantics.
NEVER use when sources are known to be highly conflicting (Zadeh's paradox)
or correlated.

### 3.3 Bayesian Confidence Refinement (R4.6)

Confidence is no longer computed once at join time. Each new corroborating
signal incrementally updates confidence:

```
  On new signal matching existing fusion:
    prior_odds = C_current / (1 - C_current)
    likelihood_ratio = new_score / (1 - new_score)      // corroborating
                     = (1 - new_score) / new_score       // contradicting
    posterior_odds = prior_odds * likelihood_ratio
    C_updated = posterior_odds / (1 + posterior_odds)

  Temporal decay (absence of corroboration):
    If time since last signal > expected_interval * 2:
      C_updated = C_updated * exp(-lambda * dt)
      lambda = 1.0 / expected_interval

  Clamp and emit: C_updated in [0.01, 0.99]
```

**Cross-reference**: The temporal decay here is the "soft" form. The "hard"
form — when an entity goes completely silent — is handled by R2 Absence
Detection (Section 5.5), which produces a first-class AbsenceEvent with
its own confidence model.

---

## 4. Section 3.3 Amendment: Tier 3 Decomposition

**Source amendments**: R8.2-R8.5 (grounded-theory-analyst)

Replace Section 3.3 (single wildcard PAIR 8) with four specific methods:

### 4.1 Tier 3A: Periodicity Correlation

**Detects**: Signals with matching periodic cadence (C2 beaconing, scheduled
reporting, systematic behavior).

```
  Step 1: Extract inter-arrival times per signal stream
  Step 2: FFT on IATs -> dominant frequency, PSD
  Step 3: Cross-spectral comparison between stream pairs
    freq_ratio in {1.0, 0.5, 2.0, 0.333, 3.0} +/- tolerance -> harmonic
  Step 4: Generate correlation if coherence > threshold

  Configuration:
    min_observations:     20
    frequency_tolerance:  0.05 (5%)
    coherence_threshold:  0.7
    harmonic_orders:      [1, 2, 3]
    window_size:          3600s
```

### 4.2 Tier 3B: Co-Occurrence Mining

**Detects**: Entities that reliably appear together across independent
sources (infrastructure relationships, convoy detection).

```
  Step 1: Extract entity sets per signal
  Step 2: Build co-occurrence matrix
  Step 3: Compute association rules: support, confidence, lift
  Step 4: Filter by thresholds

  Configuration:
    min_support:      0.001 (appear together in 0.1% of signals)
    min_confidence:   0.3
    min_lift:         2.0 (at least 2x more than random chance)
    min_observations: 5
    entity_types:     ["ip", "domain", "hash", "name", "geo_cell"]
    time_window:      86400s (24h)
    update_interval:  3600s
```

### 4.3 Tier 3C: Graph Community Detection

**Detects**: Clusters of entities more densely connected to each other than
to the rest of the graph (campaigns, organizations, fleet groups).

```
  Step 1: Build entity relationship graph from Tier 1 + Tier 2 outputs
  Step 2: Louvain or Leiden algorithm
  Step 3: Filter by modularity and community size

  Configuration:
    algorithm:            "louvain" | "leiden"
    resolution:           1.0
    min_community_size:   3
    max_community_size:   100
    modularity_threshold: 0.3
    update_interval:      3600s (hourly batch)
    edge_weight_minimum:  0.5
```

**Computational cost**: O(n log n) for Louvain. Runs periodically, NOT
on every signal.

### 4.4 Tier 3D: Anomaly Coincidence

**Detects**: Independent signals flagging anomalies in overlapping time
windows (coordinated events, jamming, multi-domain incidents).

```
  Step 1: Per-source anomaly detection (rate, value, pattern, absence)
  Step 2: Temporal windowing of anomalies
  Step 3: Coincidence scoring
    coincidence_score = |anomalous_sources| / |monitored_sources|
    Independence check: sources in the same group are NOT independent
  Step 4: Generate alert if threshold exceeded

  Configuration:
    coincidence_window:      60s
    min_anomalous_sources:   2
    coincidence_threshold:   0.3
    baseline_training:       86400s
    z_score_threshold:       3.0
    independence_groups:     { "adsb": [...], "ais": [...] }
```

All four methods are DISABLED by default. Operators enable them individually
per scenario. Accepted Tier 3 findings can be promoted to Tier 2 with
method attribution.

### 4.5 Tier 3 Spatial Blocking and Data Pair Types

Tier 3 methods operate at coarser spatial scales than Tier 2 and use
different data pair semantics. Per R6 (geospatial-researcher), each Tier 3
method declares its own H3 resolution without affecting Tier 2 blocking:

| Tier 3 Method | H3 Resolution | Cell Diameter | Data Pair Type | Rationale |
|---------------|--------------|---------------|----------------|-----------|
| 3A: Periodicity | res 5 | ~20 km | Event x Event | Wide area for cadence matching across dispersed signals |
| 3B: Co-Occurrence | res 4 | ~26 km | Reference x Reference | City-scale; operates on entity-level aggregates, not raw events |
| 3C: Community | N/A | N/A | Reference x Reference | Graph-based, non-spatial; operates on materialized entity graph |
| 3D: Anomaly Coincidence | res 6 | ~3.7 km | Event x Event | Tighter co-location for anomaly temporal coincidence |

**Key insight**: Tier 3 methods that operate on entity-level aggregates
(3B co-occurrence, 3C community detection) should use **Reference x
Reference** join semantics from R5 (Section 3.4). Both sides are
materialized d2ts arrangements, incrementally maintained. This avoids
the cartesian explosion of Event x Event joins for statistical batch
operations.

The R6 blocking framework's per-join-path resolution override mechanism
enables this: Tier 3 join paths declare `spatialBlock.h3Resolution` at
res 4-6 independently of Tier 2 paths at res 7-10.

**Cascade note** (from R6 cross-references): R6 blocking affects which
Tier 2 fusions are computed, which in turn affects the input graph for
Tier 3C community detection. Coarser Tier 2 blocking produces more
candidate pairs, more edges in the entity graph, denser communities.
Operators tuning Tier 2 blocking parameters should be aware that this
indirectly changes Tier 3C results. This is documented but not mitigated
— it is an inherent property of the layered architecture.

---

## 5. New Section 3.4: Data Duality

**Source amendment**: R5 (geospatial-researcher)

### 5.1 Event Data vs Reference Data

| Property | Event Data (Signals) | Reference Data (Registries) |
|----------|---------------------|----------------------------|
| Nature | Volatile, append-only, timestamped | Stable, slowly-changing, lookup-keyed |
| Examples | ADS-B, AIS, HTTP, RF, OSINT | FAA registry, ITU registry, ASN, WHOIS, STIX feeds |
| Update rate | Milliseconds to seconds | Hours to days |
| d2ts model | Differential stream | Materialized arrangement |
| Kafka analogy | KStream | KTable / GlobalKTable |
| Join behavior | Both sides trigger | Only event side triggers |

This distinction determines which d2ts operator is correct for each join.

### 5.2 Join Semantics by Data Pair Type

**Event x Event**: Both volatile. Requires windowing. Cartesian within
window. O(n x m) without blocking (see Section 3.5). Used for Tier 2
spatial/temporal correlation.

**Event x Reference**: One volatile, one stable. Only events trigger lookups.
O(n) in event stream. Used for Tier 1 enrichment. Reference side is a d2ts
arrangement providing O(1) lookups per event.

**Reference x Reference**: Both stable. Maintains incrementally updated
materialized view. Used for pre-computed enrichment tables (e.g., "which
vessels are on watchlists?").

### 5.3 Classification of Existing Join Paths

| Join Path | Left | Right | Pair Type | Scalability |
|-----------|------|-------|-----------|-------------|
| PAIR 1: ADS-B x ADS-B | Event | Event | Event x Event | Windowed + blocked |
| PAIR 2: ADS-B x FAA | Event | Reference | Event x Ref | O(n) lookup |
| PAIR 3: ADS-B x AIS | Event | Event | Event x Event | Windowed + blocked |
| PAIR 4: ADS-B x RF | Event | Event | Event x Event | Windowed + blocked |
| PAIR 5: AIS x RF | Event | Event | Event x Event | Windowed + blocked |
| PAIR 6: HTTP x DNS | Event | Event | Event x Event | Windowed + blocked |
| PAIR 7: HTTP x OSINT | Event | Event | Event x Event | Windowed + blocked |
| PAIR 9: Absence x Satellite | Event | Event | Event x Event | Windowed + blocked |
| PAIR 10: Absence x RF | Event | Event | Event x Event | Windowed + blocked |

Six of eight original join paths are Event x Event — the expensive pattern.
Blocking (Section 3.5) is essential.

### 5.4 Reference Data Management

Reference data sources are registered in the FusionOntology:

```typescript
const ReferenceSource = Schema.Struct({
  id:           Schema.String,               // "faa-registry"
  signalKind:   Schema.String,               // "faa-db"
  entityClass:  Schema.String,               // "Aircraft"
  keyField:     Schema.String,               // "icao_hex"
  updateRate:   Schema.Literal("static", "daily", "hourly", "minutes"),
  natsSubject:  Schema.String,               // "tsingou.ref.faa.*"
  ttlSeconds:   Schema.Number,
})
```

NATS subject convention: `tsingou.ref.<source>.*` for reference data,
`tsingou.signal.<kind>.*` for event data.

**Cross-reference**: The Expected Signal Registry (ESR) from R2 Absence
Detection (Section 5.5) is a reference data structure. It fits this
classification exactly: keyed by (entity_class, signal_kind), changes
slowly, used for lookup.

---

## 6. New Section 3.5: Blocking Strategy

**Source amendment**: R6 (geospatial-researcher)

### 6.1 Three-Dimensional Blocking

Event x event joins are cartesian within their window. Without blocking,
10,000 ADS-B x 500 AIS = 5,000,000 candidate pairs. Blocking partitions
the candidate space across three dimensions:

1. **Spatial** — H3 cell + k-ring expansion
2. **Temporal** — time bucket + overlap
3. **Spectral** — frequency band (RF joins only)

Combined block key: `(h3_cell, time_bucket, freq_band?)`

### 6.2 Unified Blocking + Join Configuration Table

This table reconciles R1 (temporal join windows) with R6 (blocking windows).
The invariant is: **blocking >= join** in all dimensions.

| Signal Pair | Block H3 | Join H3 | Block Window | Join Window | Composite Key | Late Policy |
|-------------|----------|---------|--------------|-------------|---------------|-------------|
| ADS-B x ADS-B (dedup) | res 9 | res 9 | 5s | 2s | `h3r9:5s` | reprocess |
| ADS-B x AIS | res 8 | res 9 | 60s | 10s | `h3r8:30s` | drop |
| ADS-B x Radar | res 8 | res 9 | 10s | 5s | `h3r8:5s` | drop |
| ADS-B x RF bearing | res 7 | res 7 | 15s | 5s | `h3r7:10s` | drop |
| AIS x RF bearing | res 7 | res 7 | 30s | 15s | `h3r7:15s` | drop |
| HTTP x DNS | N/A | N/A | 300s | 30s | `fqdn:150s` | drop |
| OSINT x OSINT (windowed) | res 5 | res 5 | 3600s | 3600s | `h3r5:1800s` | side_channel |
| OSINT x Entity (event-table) | N/A | N/A | N/A | N/A | entity_key | reprocess |
| WiFi x Bluetooth | res 10 | res 10 | 5s | 5s | `h3r10:5s` | drop |

**Reconciliation notes**:

1. **DNS x HTTP**: R1 updated join window from 2s to 30s (DNS prefetching,
   caching, log shipping lag). R6 blocking at 300s remains safe.

2. **OSINT x OSINT**: R1 classifies as event-table (latest OSINT enriches
   entity). R6 classifies as windowed (co-temporal correlation). **Both are
   valid.** The ontology supports BOTH modes via a `joinMode` field on the
   JoinPathEntry. Blocking at 3600s applies only to `joinMode = "windowed"`.

3. **Two-stage resolution**: The composite key uses the **blocking** H3 res
   (coarser) and **blocking** bucket width. The join then further refines
   within each block using the finer R1 window and exact predicates.

### 6.3 Blocking Effectiveness

```
BLOCKED vs UNBLOCKED (ADS-B x AIS, 500km x 500km area):

  Unblocked: 10,000 * 500 = 5,000,000 candidate pairs/sec
  Blocked:   10,000 * 0.07 = 700 candidate pairs/sec

  Reduction factor: 7,143x
  Compute: 700 * 200ns = 140 microseconds (0.014% of one core)
```

Caveat: clustered areas (airports, harbors) have higher block occupancy.
Reduction factor in hot spots: 100-1000x instead of 7000x. Still vastly
better than unblocked.

### 6.4 Bearing Cone Blocking

RF bearing signals cover spatial extents, not points. A bearing cone at
res 7 may cover 5-400 H3 cells. Each cell becomes a separate block entry.

| Scenario | Max Cells | Rationale |
|----------|-----------|-----------|
| Tactical DF (10km, narrow) | < 50 | Low overhead |
| Surveillance DF (50km, wide) | < 500 | Acceptable for moderate rates |
| Long-range DF (100km, wide) | < 2000 | Use coarser resolution |

If cell count exceeds budget, coarsen H3 resolution by 1 level (~7x
reduction).

### 6.5 Monitoring Metrics

Published to NATS `tsingou.metrics.blocking.*`:

| Metric | Alert Threshold |
|--------|----------------|
| `block_occupancy_p99` | > 100 signals/block |
| `candidates_per_signal` | > 50 |
| `blocking_reduction_factor` | < 10 |
| `cell_crossings_per_second` | > 10,000 |
| `cone_cells_p99` | > 2,000 |

---

## 7. New Section 3.6: Temporal Join Semantics

**Source amendment**: R1 (tracking-researcher)

### 7.1 The Rate Mismatch Problem

Signal sources update at radically different rates:

| Signal Kind | Rate | Category |
|-------------|------|----------|
| ADS-B | 1 Hz | High-rate stream |
| AIS Class A | 0.3 Hz (variable) | Variable-rate stream |
| AIS Class B | 0.03 Hz | Low-rate stream |
| Radar | 0.1-1 Hz | Medium-rate stream |
| RF bearing | 0.1-10 Hz | Variable-rate stream |
| DNS/HTTP | Bursty (0-10,000/sec) | Bursty stream |
| OSINT/RSS | 0.001 Hz | Trickle / event table |
| STIX CTI | ~0 Hz (batch) | Event table |
| FAA/ITU | ~0 Hz (weekly) | Reference table |

### 7.2 Three Temporal Join Modes

Selected automatically based on rate ratio:

```
Rate ratio R = max(rate_L, rate_R) / min(rate_L, rate_R)

If R < 10:        WINDOWED JOIN      (both sides are streams)
If R >= 10:       EVENT-TABLE JOIN   (fast side = stream, slow side = table)
If R = infinity:  REFERENCE JOIN     (one side is static reference data)
```

**Windowed join**: Both sides produce at comparable rates. Signals match
within a time window. d2ts key: `(spatial_block_key, time_bucket)`.

**Event-table join**: Fast side probes slow side's LATEST snapshot. Memory:
O(|slow entities|) instead of O(|fast signals| * window). The slow side's
temporal gap penalizes confidence:

```
temporal_penalty = min(1.0, gap_seconds / max_gap_seconds)
adjusted_confidence = base_confidence * (1.0 - temporal_penalty * decay_weight)
```

**Reference join**: Special case of event-table where the slow side is
static reference data. No temporal proximity required. Confidence: 0.99
(from Section 2, spoofing-aware).

### 7.3 Event-Time Processing

Tsingou uses **event-time** semantics throughout:

```
event_time      = when physical observation occurred (sensor clock)
ingestion_time  = when signal entered NATS bus
processing_time = when d2ts processes the signal

INVARIANT: event_time <= ingestion_time <= processing_time
EXCEPTION: Clock skew (handled by bounds checking)
```

### 7.4 Watermarks

A watermark W(t) is a monotonically advancing assertion: "all signals with
event-time <= W(t) have been received."

In d2ts: the watermark maps to the **frontier** — the minimum version that
may still receive new data.

```
W(source, t) = max_event_time_seen(source) - allowed_lateness(source)

Allowed lateness by signal kind:
  ADS-B:     5 sec
  AIS:       30 sec (satellite AIS has propagation delay)
  Radar:     2 sec
  RF:        10 sec
  OSINT:     300 sec
  HTTP/DNS:  10 sec
  STIX CTI:  3600 sec

Global watermark for a join:
  W(join) = min(W(left_source), W(right_source))
```

Slow sources (OSINT, STIX) can hold back fast sources. Mitigation:
event-table join mode avoids this by treating slow sources as tables with
no watermark dependency.

**Cross-reference**: The watermark system is the foundation for R9 event
ordering (Section 9.2). Sequence patterns rely on watermarks to determine
when step N has been matched and no earlier event will arrive.

### 7.5 Late Arrival Handling

| Strategy | Used For | Behavior |
|----------|----------|----------|
| **Drop** (default) | Windowed joins | Discard, log, emit LateDrop event |
| **Reprocess** | Event-table joins | Accept update, retract+re-emit affected outputs |
| **Side-channel** | Audit | Route to late_arrival_sidestream for offline review |

**Cross-reference**: R9's sequence patterns (Section 9.2) have a
`maxDuration` constraint. Once the watermark passes
`step_1.time + maxDuration`, in-progress sequences can be evicted.

### 7.6 Clock Skew

1. **Future timestamps** (event_time > processing_time):
   Clamp to max(event_time, processing_time + 5s). Flag as clock_skew.

2. **Ancient timestamps** (event_time << processing_time):
   If older than max_historical_age (1h streaming, 30d batch), route to
   side-channel.

3. **Monotonicity violations** (event_time(n+1) < event_time(n)):
   Accept if within allowed_lateness. Otherwise treat as late arrival.

### 7.7 Watermark Interaction with Fusion Tiers

| Tier | Watermark Role | Late Strategy |
|------|---------------|---------------|
| Tier 1 (Hard Key) | Minimal — identity is atemporal | Reprocess |
| Tier 2 (Soft Key) | Critical — temporal is a predicate | Drop or side-channel |
| Tier 3 (Derived) | Batch-oriented — defines analysis epochs | Reprocess (batch re-analysis) |

---

## 8. New Section 5.4: Track Lifecycle Management

**Source amendment**: R7 (tracking-researcher)

### 8.1 Lifecycle States

```
                  +-----------+
 measurement ---> | TENTATIVE |
                  +-----+-----+
                        |
                   confirmation
                   criteria met
                        |
                  +-----v-----+          +----------+
                  | CONFIRMED +--------->+ COASTING |
                  +-----+-----+ missed   +-----+----+
                        |       N scans       |
                   continuous             recovery
                   updates                    |
                        |               +-----v----+
                  +-----v-----+         | COASTING |
                  | CONFIRMED +<--------+          |
                  +-----+-----+         +-----+----+
                        |                     |
                   merges or             max coast
                   operator              exceeded
                        |                     |
                  +-----v-----+         +-----v----+
                  | MERGED    |         | DROPPED  |
                  +-----------+         +----------+
```

| State | Visible | Joins | Confidence Modifier |
|-------|---------|-------|---------------------|
| TENTATIVE | Dimmed/dashed | Yes (reduced) | x 0.5 |
| CONFIRMED | Full | Yes (full) | x 1.0 |
| COASTING | Amber warning | Yes (decaying) | x (1.0 - coast_penalty) |
| DROPPED | Removed/ghost | No | 0.0 |
| MERGED | Redirected | Redirect to target | Inherited |

### 8.2 Transition Rules

**TENTATIVE -> CONFIRMED**: M-of-N or SPRT score-based (per entity class).

| Entity Class | Method | M | N | Coast Entry | Max Coast |
|-------------|--------|---|---|-------------|-----------|
| Aircraft (ADS-B) | m_of_n | 2 | 3 | 3 scans | 10 scans |
| Aircraft (radar) | score | - | - | 5 scans | 20 scans |
| Vessel (AIS) | m_of_n | 2 | 3 | 10 scans | 60 scans |
| Vessel (radar) | score | - | - | 5 scans | 30 scans |
| RF Emitter | score | - | - | 5 scans | 30 scans |
| Network Host | m_of_n | 2 | 2 | 30s | 300s |
| OSINT Entity | m_of_n | 2 | 3 | - | 86400s |

**CONFIRMED -> COASTING**: Triggered when `consecutive_misses > coast_entry_threshold`.
During coasting, kinematic state is Kalman-predicted only. Covariance grows:
`sigma_pos ~ sigma_0 + sigma_v * N * dt + 0.5 * sigma_a * (N * dt)^2`.

**COASTING -> CONFIRMED**: Measurement re-acquired. Reset miss counter,
apply Kalman update, no re-tentative phase.

**COASTING -> DROPPED**: Terminal. `consecutive_misses > max_coast_scans` or
score below delete_threshold. Track archived. Re-appearance creates a NEW
tentative track (operator may manually link via alias/merge).

**any -> MERGED**: Tier 1 hard key match, Tier 2 confidence > 0.90, or
operator command. Surviving track absorbs measurements. All downstream
join outputs retracted and re-emitted with surviving ID.

### 8.3 Lifecycle Interaction with Fusion Tiers

| State | Tier 1 | Tier 2 | Tier 3 |
|-------|--------|--------|--------|
| TENTATIVE | Joins normally | C x 0.5 | Excluded |
| CONFIRMED | Joins normally | Full C | Included |
| COASTING | Joins normally | C decays | Excluded |
| DROPPED | No joins | No joins | Excluded |
| MERGED | Redirected | Redirected | Redirected |

### 8.4 Lifecycle as NATS Signals

```
Subject: tsingou.track.lifecycle.<entity_class>.<track_id>
Payload: LifecycleTransition schema
```

**Cross-reference**: COASTING state is the direct upstream for R2 Absence
Detection (Section 5.5). When a track transitions CONFIRMED -> COASTING,
the absence detector begins its timer. When COASTING -> DROPPED, the
absence detector continues independently with dead reckoning (R7's Kalman
prediction ceases, R2's own uncertainty model takes over).

---

## 9. New Section 5.5: Negative-Space Detection

**Source amendment**: R2 (adversarial-researcher)

### 9.1 The Absence Output Type

TSGC-001 defines four output types: Merge, Correlate, Enrich, Flag. All
respond to signal *presence*. This amendment adds **Absence** — the
detection of an expected signal that fails to arrive.

Theoretical foundation: Koch (2007) — a failed detection attempt in a
sensor's field of view is itself useful sensor output. If P_d is high and
no detection occurs, entity presence is strongly reduced.

### 9.2 Expected Signal Registry (ESR)

A reference data structure (per Section 3.4) defining what signals SHOULD
be observed per entity class:

| Entity Class | Signal Kind | Nominal Rate | Warning | Critical | Dark |
|-------------|-------------|-------------|---------|----------|------|
| Vessel (Class A) | AIS | 2-10s underway | 5 min | 30 min | 2h |
| Vessel (Class B) | AIS | 30s underway | 10 min | 60 min | 4h |
| Vessel (anchor) | AIS | 3 min | 15 min | 2h | 12h |
| Aircraft | ADS-B | 1/sec | 30 sec | 5 min | 30 min |
| Aircraft | Radar | 4-12/min | 2 min | 10 min | 30 min |
| Network Host | HTTP beacon | configurable | 2x period | 5x period | 10x period |
| RF Emitter | SDR | continuous | 30 sec | 5 min | 30 min |

Expected rates are condition-adjusted: entity state, sensor coverage,
weather, known exceptions (in-port, maintenance).

### 9.3 Absence Confidence Model

```
P_miss_by_chance = (1 - P_d)^N
  where N = floor(elapsed * expected_rate)

C_absence = 1.0 - P_miss_by_chance

Examples (P_d = 0.95, rate = 1/10s):
  60s elapsed -> N=6  -> C = 0.99999998 (certain)
  30s elapsed -> N=3  -> C = 0.999875   (very high)
  10s elapsed -> N=1  -> C = 0.95        (high)
```

**Spoofing adjustment** (from Section 2):
`C_absence_adjusted = C_absence * trust_level[entity.identity]`

### 9.4 Absence Classification

Decision tree:

```
Q1: Entity in sensor coverage?
  NO  -> coverage_gap (annotate, do not alert)
  YES -> Q2

Q2: Other signals still received?
  YES -> equipment_failure or deliberate_dark (disambiguate via Q3/Q4)
  NO  -> all signals missing
    Sudden -> environmental / electronic_warfare / deliberate_dark
    Gradual -> coverage_gap / equipment_failure / deliberate_dark
```

Behavioral indicators for "deliberate_dark": approaching sensitive area
(+0.3), course change before dark (+0.2), history of dark periods (+0.2).

### 9.5 Projected Position Under Absence

Dead reckoning with growing uncertainty:

```
P_projected = P_last + V_last * dt
R_95(dt) = 2 * (sigma_initial + sigma_velocity*dt + sigma_maneuver*dt^2)

Examples for vessel at 10kn:
  5 min:   R_95 = ~150m   (useful for search)
  30 min:  R_95 = ~2km    (still constraining)
  2 hours: R_95 = ~15km   (broad area)
  12 hours:R_95 = ~200km  (barely useful)
```

**Cross-reference**: While the track is in COASTING state (Section 5.4),
the projected position SHOULD use R7's Kalman predicted state. After R7
drops the track, R2's own dead reckoning model takes over.

### 9.6 Absence as Fusion Input

Absence events feed the ontology at three points:

1. **New output type** in confidence semantics (Section 9).
2. **Absence-triggered correlation**: dark vessel + satellite imagery,
   dark vessel + RF detection, dark vessel + other vessel at last position.
3. **New join path entries**: PAIR 9 (Absence x Satellite), PAIR 10
   (Absence x RF Detection).

### 9.7 COASTING -> Absence Bridge

The R7 COASTING state is the precursor to absence detection:

| R7 Phase | R2 Severity | Action |
|----------|-------------|--------|
| Coast entry | Warning | Start absence timer |
| Mid-coast | Critical | Uncertainty growing |
| Max coast exceeded | Dark | R7 drops track, R2 continues |
| Recovery (COASTING -> CONFIRMED) | Closed | Log gap for pattern analysis |

---

## 10. New Section 5.6: Risk Accumulation

**Source amendment**: R3 (adversarial-researcher)

### 10.1 The Weak Signal Problem

No single indicator may cross the fusion threshold, but multiple weak
indicators converging on the same entity should compound into actionable
risk.

```
Example — 6 indicators, NONE above 0.65:
  AIS position drift:        0.3
  Speed inconsistency:       0.4
  Route deviation:           0.35
  Sanctioned vessel proximity: 0.25
  Previous dark period:      0.2
  Flag/MMSI mismatch:        0.15

No single indicator is actionable.
All six together paint a picture worth investigating.
```

### 10.2 Risk Categories

| Category | Code | Weight | Default TTL |
|----------|------|--------|-------------|
| Identity | ID | 0.20 | 24h |
| Kinematic | KIN | 0.20 | 2h |
| Behavioral | BEH | 0.20 | 8h |
| Association | ASSOC | 0.15 | 4h |
| Signal Integrity | SIG | 0.15 | 12h |
| Intelligence | INTEL | 0.10 | 72h |

### 10.3 Temporal Decay

Indicators decay exponentially: `s(t) = s_0 * exp(-(t - t_0) / tau)`.

After 1 half-life: 0.50x. After 3 half-lives: 0.125x. After 5: ~0 (evict).

### 10.4 Composite Risk: Noisy-OR

Per-category aggregation uses noisy-OR:
`category_score = 1.0 - PRODUCT(1.0 - s_i for all indicators in category)`

Weighted composite across categories, with convergence bonus when 3+
different categories contribute:

```
composite = weighted_category_average
IF active_categories >= 3:
  convergence_bonus = 0.1 * (active_categories - 2)
  composite = min(1.0, composite + convergence_bonus)
```

Properties of noisy-OR:
- Each additional indicator increases score
- Diminishing returns (no oversaturation)
- Bounded [0, 1]
- Order-independent, commutative
- Any indicator at 1.0 -> composite = 1.0

### 10.5 Risk Thresholds

| Composite | Classification | Priority | Action |
|-----------|----------------|----------|--------|
| 0.0 - 0.2 | Low | None | Normal monitoring |
| 0.2 - 0.4 | Elevated | P4 | Log, periodic report |
| 0.4 - 0.6 | Moderate | P3 | Flag in display |
| 0.6 - 0.8 | High | P2 | Active alert |
| 0.8 - 1.0 | Critical | P1 | Immediate attention |

### 10.6 R2 -> R3 Flow

Absence events are a primary feeder into risk accumulation:

```
1. Warning absence  -> SIG indicator, score 0.3
2. Critical absence -> SIG indicator, score 0.6
3. Deliberate dark  -> BEH indicator, score 0.7
4. Satellite confirms dark entity -> ASSOC indicator, score 0.5
5. OSINT sanctions match -> INTEL indicator, score 0.9
   -> 4+ categories -> convergence bonus
   -> Composite likely > 0.8 -> P1 CRITICAL
```

**Evidence correlation**: When absence events feed into risk alongside
temporal proximity scores, the R4.2 correlation matrix should include:
`correlation["absence_duration"]["temporal_proximity"] = 0.7`
to prevent double-counting the "haven't seen this entity recently" evidence.

---

## 11. Section 6 Amendment: Join Path Registry

**Source amendments**: R5, R6, R1, R8, R2 (all agents)

### 11.1 JoinPathEntry V2 Schema

The JoinPathEntry gains five new field groups:

```typescript
const JoinPathEntryV2 = Schema.Struct({
  // --- Existing fields ---
  id:          Schema.String,
  left:        Schema.Struct({
    signalKind:  Schema.String,
    keyPath:     Schema.String,
    dataType:    Schema.Literal("event", "reference"),     // R5
  }),
  right:       Schema.Struct({
    signalKind:  Schema.String,
    keyPath:     Schema.String,
    dataType:    Schema.Literal("event", "reference"),     // R5
  }),
  joinType:    Schema.Literal(
    "identity", "spatial", "temporal",
    "spectral", "semantic", "behavioral",
    "statistical"                                          // R8
  ),
  resolver:    Schema.optional(Schema.String),
  predicates:  Schema.Array(PredicateConfig),
  outputType:  Schema.Literal("merge", "correlate", "enrich", "flag",
                              "absence"),                  // R2
  enabled:     Schema.Boolean,
  tier:        Schema.Literal(1, 2, 3),

  // --- New: Temporal (R1) ---
  temporal:    Schema.optional(TemporalJoinConfig),

  // --- New: Blocking (R6) ---
  spatialBlock:  Schema.optional(SpatialBlockConfig),
  temporalBlock: Schema.optional(TemporalBlockConfig),
  spectralBlock: Schema.optional(SpectralBlockConfig),

  // --- New: Tier 3 method (R8) ---
  tier3Method: Schema.optional(Schema.Literal(
    "periodicity", "co_occurrence", "community", "anomaly_coincidence"
  )),
  tier3Config: Schema.optional(Tier3ConfigUnion),

  // --- New: Join mode for dual-purpose paths (R1/R6 reconciliation) ---
  joinMode:    Schema.optional(Schema.Literal("windowed", "event_table")),
})
```

### 11.2 Updated Join Path Registry

Complete registry with all amendments applied:

```
PAIR 1: ADS-B x ADS-B (dedup)
  Left:     { signalKind: "adsb", keyPath: "payload.icao", dataType: "event" }
  Right:    { signalKind: "adsb", keyPath: "payload.icao", dataType: "event" }
  joinType: "identity"
  tier: 1
  temporal: { mode: "windowed", windowSizeMs: 2000,
              lateArrivalPolicy: "reprocess" }
  spatialBlock: { h3Resolution: 9, kRingExpansion: 0, expandSide: "left" }

PAIR 2: ADS-B x FAA Registry (enrichment)
  Left:     { signalKind: "adsb", keyPath: "payload.icao", dataType: "event" }
  Right:    { signalKind: "faa-db", keyPath: "icao_hex", dataType: "reference" }
  joinType: "identity"
  tier: 1
  temporal: { mode: "reference", lateArrivalPolicy: "reprocess",
              temporalGapDecay: null }

PAIR 3: ADS-B x AIS (cross-class spatial)
  Left:     { signalKind: "adsb", keyPath: "metadata.geo", dataType: "event" }
  Right:    { signalKind: "ais", keyPath: "metadata.geo", dataType: "event" }
  joinType: "spatial"
  tier: 2
  temporal: { mode: "windowed", windowSizeMs: 10000,
              lateArrivalPolicy: "drop",
              allowedLatenessMs: { left: 5000, right: 30000 } }
  spatialBlock: { h3Resolution: 8, kRingExpansion: 1, expandSide: "left" }
  temporalBlock: { windowSeconds: 60, bucketWidthSeconds: 30,
                   overlapBuckets: 1 }

PAIR 4: ADS-B x RF Bearing (spatial+spectral)
  Left:     { signalKind: "adsb", keyPath: "metadata.geo", dataType: "event" }
  Right:    { signalKind: "rf-bearing", keyPath: "bearing_cone", dataType: "event" }
  joinType: "spatial"
  tier: 2
  temporal: { mode: "windowed", windowSizeMs: 5000,
              lateArrivalPolicy: "drop",
              allowedLatenessMs: { left: 5000, right: 10000 } }
  spatialBlock: { h3Resolution: 7, kRingExpansion: 1, expandSide: "left" }
  spectralBlock: { bandId: "adsb-1090", centerFreqMHz: 1090, bandwidthMHz: 2 }

PAIR 5: AIS x RF Bearing (spatial+spectral)
  Left:     { signalKind: "ais", keyPath: "metadata.geo", dataType: "event" }
  Right:    { signalKind: "rf-bearing", keyPath: "bearing_cone", dataType: "event" }
  joinType: "spatial"
  tier: 2
  temporal: { mode: "windowed", windowSizeMs: 15000,
              lateArrivalPolicy: "drop",
              allowedLatenessMs: { left: 30000, right: 10000 } }
  spatialBlock: { h3Resolution: 7, kRingExpansion: 1, expandSide: "left" }
  spectralBlock: { bandId: "vhf-marine", centerFreqMHz: 162, bandwidthMHz: 18 }

PAIR 6: HTTP x DNS (identity)
  Left:     { signalKind: "http", keyPath: "payload.host", dataType: "event" }
  Right:    { signalKind: "dns", keyPath: "payload.query_name", dataType: "event" }
  joinType: "identity"
  tier: 1
  temporal: { mode: "windowed", windowSizeMs: 30000,
              lateArrivalPolicy: "drop",
              allowedLatenessMs: { left: 10000, right: 10000 } }
  temporalBlock: { windowSeconds: 300, bucketWidthSeconds: 150,
                   overlapBuckets: 1 }

PAIR 7: HTTP x OSINT/RSS (semantic)
  Left:     { signalKind: "http", keyPath: "payload.indicators[]", dataType: "event" }
  Right:    { signalKind: "osint", keyPath: "payload.indicators[]", dataType: "event" }
  joinType: "semantic"
  tier: 2
  temporal: { mode: "event_table",
              lateArrivalPolicy: "reprocess",
              allowedLatenessMs: { left: 10000, right: 300000 },
              temporalGapDecay: { maxGapSeconds: 86400, decayWeight: 0.3 } }

PAIR 8A: Periodicity Correlation (Tier 3A)
  joinType: "statistical", tier: 3, tier3Method: "periodicity"
  enabled: false
  spatialBlock: { h3Resolution: 5, kRingExpansion: 1, expandSide: "both" }
  left/right dataType: "event" / "event"
  tier3Config: { _tag: "PeriodicityConfig", ... }

PAIR 8B: Co-Occurrence Mining (Tier 3B)
  joinType: "statistical", tier: 3, tier3Method: "co_occurrence"
  enabled: false
  spatialBlock: { h3Resolution: 4, kRingExpansion: 1, expandSide: "both" }
  left/right dataType: "reference" / "reference"  (entity aggregates)
  tier3Config: { _tag: "CoOccurrenceConfig", ... }

PAIR 8C: Graph Community Detection (Tier 3C)
  joinType: "statistical", tier: 3, tier3Method: "community"
  enabled: false
  spatialBlock: null  (non-spatial, graph-based)
  left/right dataType: "reference" / "reference"  (entity graph)
  tier3Config: { _tag: "CommunityConfig", ... }

PAIR 8D: Anomaly Coincidence (Tier 3D)
  joinType: "statistical", tier: 3, tier3Method: "anomaly_coincidence"
  enabled: false
  spatialBlock: { h3Resolution: 6, kRingExpansion: 1, expandSide: "both" }
  left/right dataType: "event" / "event"
  tier3Config: { _tag: "AnomalyCoincidenceConfig", ... }

PAIR 9: Absence x Satellite Imagery (R2)
  Left:     { signalKind: "absence", keyPath: "projectedPosition", dataType: "event" }
  Right:    { signalKind: "satellite", keyPath: "position", dataType: "event" }
  joinType: "spatial"
  tier: 2
  predicates:
    - haversine(projected, detected) < R_95(absence.elapsed)
    - satellite_pass_time within absence_duration
  outputType: "correlate"

PAIR 10: Absence x RF Detection (R2)
  Left:     { signalKind: "absence", keyPath: "projectedPosition", dataType: "event" }
  Right:    { signalKind: "rf-bearing", keyPath: "bearing_cone", dataType: "event" }
  joinType: "spatial"
  tier: 2
  predicates:
    - point_in_cone(projected, rf_bearing) = true
    - rf_frequency NOT in [AIS_band, ADS-B_band]
  outputType: "correlate"
```

---

## 12. Section 7 Amendment: d2ts Compilation

**Source amendments**: R1, R2, R3, R5, R6 (all agents)

### 12.1 Updated Pipeline Diagram

```
                    +---------------------+
                    |   Signal Ingest     |
                    +----------+----------+
                               |
                    +----------v----------+
                    |  TIMESTAMP VALIDATE  |  <-- R1 (clock skew)
                    +----------+----------+
                               |
                    +----------v----------+
                    |  CLASSIFY + BLOCK    |  <-- R5 (event/ref), R6 (block keys)
                    +----------+----------+
                               |
         +--------+--------+---+---+--------+--------+
         v        v        v       v        v        v
    TIER 1    TIER 2    TIER 3   ABSENCE   RISK   SEQUENCE
    Hard      Soft      Derived  Detector  Accum   Patterns
    Join      Join      Methods  (R2)      (R3)    (R9)
         |        |        |       |        |        |
         +--------+--------+-------+--------+--------+
                            v
                   +--------+--------+
                   |  FUSED + ASSESSED|
                   |  DATUM           |
                   |                  |
                   |  + lifecycle     |  <-- R7
                   |  + absence       |  <-- R2
                   |  + risk profile  |  <-- R3
                   +-----------------+
```

### 12.2 Blocking Pre-Join Transform

```typescript
// R6: assignBlockKeys runs BEFORE join
signal_stream
  .flatMap(assignBlockKeys)       // -> [(block_key, signal), ...]
  .join(other_stream_blocked,     //    H3 cell + k-ring
        on: block_key_equality)   //    time bucket + overlap
  .filter(evaluatePredicates)     //    spectral band (RF)
  .map(computeConfidence)
```

### 12.3 d2ts Operator Selection by Data Pair Type

| Left | Right | d2ts Strategy |
|------|-------|---------------|
| event | event | Windowed join with blocking |
| event | reference | Arrangement lookup (O(1) per event) |
| reference | event | Reverse arrangement lookup |
| reference | reference | Delta join on arrangements |

### 12.4 Absence Detection Operator

Implemented as a temporal anti-join with heartbeat:

```typescript
const heartbeat = tickStream.flatMap(tick =>
  trackedEntities.map(e => ({ entityId: e.id, tick: tick.time }))
)

const absences = heartbeat
  .join(observations, (hb, obs) => hb.entityId === obs.entityId,
        windowSize = MAX_ABSENCE_THRESHOLD)
  .filter(([hb, obs]) => obs === null || isStale(obs, hb.tick))
  .map(([hb, _]) => generateAbsenceEvent(hb.entityId, hb.tick))
```

### 12.5 Risk Accumulation Operator

```typescript
const indicatorStream = merge(
  spoofingDetectors.map(toRiskIndicator),
  absenceDetector.map(toRiskIndicator),
  fusionPipeline.map(toRiskIndicator),
  externalIntel.map(toRiskIndicator),
  behavioralAnalysis.map(toRiskIndicator),
)

const riskProfiles = indicatorStream
  .groupBy(i => i.entityId)
  .reduce((profile, indicator) => updateProfile(profile, indicator, now()),
          emptyProfile)

const riskAlerts = riskProfiles
  .diff()
  .filter(([prev, curr]) => crossesThreshold(prev, curr))
  .map(([prev, curr]) => generateRiskAlert(prev, curr))
```

### 12.6 Sequence Pattern Compilation (R9)

Each SequencePattern compiles to a d2ts stateful operator chain:

```
  Step 1 Filter -> State: Pending -> Step 2 Filter -> State: Step1_matched
    -> Step 3 Filter -> State: Step1+2_matched -> SEQUENCE MATCHED -> Emit

  State management:
    - Per-pattern state accumulator in d2ts
    - Timeout: maxDuration exceeded -> drop in-progress state
    - Memory bound: max_concurrent_sequences per pattern
    - Contiguity: STRICT resets on non-match; RELAXED ignores; NON_DETERMINISTIC accepts any
```

---

## 13. Section 8 Amendment: Operator Interface

**Source amendments**: R2, R3, R4, R7, R8, R9 (all agents)

Add to the z:3 DOM control layer:

### 13.1 Absence Monitoring Panel (R2)

- Tracked entity count, dark count, warning count
- Dark entity list: entity, last position, projected position, assessment,
  confidence, R_95 uncertainty radius
- Threshold adjustment: warning, critical, dark durations
- Coverage gap overlay toggle
- Auto-suppress in-port toggle

### 13.2 Risk Profile Panel (R3)

- Per-entity composite risk score with category breakdown
- Risk trend indicator (rising/stable/falling)
- 24-hour risk history sparkline
- Active indicator count with decay status
- Actions: investigate, acknowledge, suppress, export STIX

### 13.3 Confidence Model Toggle (R4.3)

- Mode selection: weighted_average (default), log_odds, dempster_shafer
- Correlation discount factor slider
- Calibration status display (per signal pair)

### 13.4 Track Lifecycle Display (R7)

- Track state indicators: tentative (dashed), confirmed (solid),
  coasting (amber), merged (redirected)
- Lifecycle event log per entity
- Coast duration counter with confidence decay visualization

### 13.5 Tier 3 Method Control (R8)

- Individual enable/disable per method (3A-3D)
- Per-method threshold adjustment:
  - 3A: coherence threshold, min observations
  - 3B: support/confidence/lift thresholds
  - 3C: algorithm selection, resolution parameter
  - 3D: coincidence window, z-score threshold
- Tier 3 results review panel with accept/reject per finding
- Promoted findings display with method attribution

### 13.6 Sequence Pattern Editor (R9)

- Visual step-by-step sequence construction
- Per-step filter conditions with field autocompletion
- Cross-step predicate definition
- Duration constraint visualization (timeline view)
- Test against historical data before enabling
- Sequence match viewer with timeline display

---

## 14. Section 9 Amendment: Confidence Semantics

**Source amendments**: R2, R4.1, R4.7 (grounded-theory-analyst, adversarial-researcher)

Replace Section 9 table:

| Output Type | Meaning | Confidence Semantics | Calibration |
|-------------|---------|----------------------|-------------|
| **Merge** | Same entity, different source | C = 0.99 (hard key) or C > 0.90 (soft) | Ordinal until calibrated |
| **Correlate** | Related entities, not identity | C = 0.65-0.89 (proximity-based) | Ordinal until calibrated |
| **Enrich** | Context added to existing entity | C = 0.99 (registry) or variable | Source reliability rating |
| **Absence** | Expected signal missing | C = 1-(1-P_d)^N; grows with time | Ordinal, domain-specific |
| **Flag** | Identifier discrepancy | C = severity * (1 - P_spoofing) | Requires RI-7 model |

Key changes from v1:
- Merge confidence 1.0 -> 0.99 (erratum E1)
- Absence is a new output type (R2)
- Flag now incorporates spoofing probability (R4.1)
- Calibration column added (R4.5)

---

## 15. New Section 9.1: Confidence Calibration

**Source amendment**: R4.5 (grounded-theory-analyst)

Four-phase calibration framework:

**Phase 1: Ordinal Mode** (initial deployment)
- Scores are ordinal: higher is better, no probabilistic claim
- Operator validates fusions: accept / reject / uncertain
- System logs: (fusion_id, confidence, verdict, timestamp)

**Phase 2: Data Collection**
- After 500+ verdicts per signal pair type
- Bin into deciles, compute actual accuracy per bin
- Produce calibration curve: predicted -> actual

**Phase 3: Recalibration**
- Monotonic curve: apply isotonic regression
- Non-monotonic curve: investigate broken predicate/weight
- Recalibrated scores replace raw scores in display

**Phase 4: Continuous Monitoring**
- Sliding window of last 1000 verdicts
- Alert on calibration drift
- Log snapshots: `tsingou.meta.calibration.{pair}.{timestamp}`

---

## 16. New Section 9.2: Sequence Patterns

**Source amendment**: R9 (grounded-theory-analyst)

### 16.1 Sequence Predicate

A FOLLOWED_BY predicate defines an ordered temporal pattern:

```
SEQUENCE step_1 FOLLOWED_BY step_2 [FOLLOWED_BY step_3 ...]
  WITHIN max_duration
  [WHERE cross_step_predicate]

Each step:
  - Matches signal kind / entity class
  - Has local filters
  - Contiguity: STRICT | RELAXED (default) | NON_DETERMINISTIC
```

Score: `completeness * timeliness * specificity`

### 16.2 Canonical Sequences

**AIS Dark Period Detection**:
```
STEP 1: AIS position report for MMSI=X
FOLLOWED_BY (RELAXED)
STEP 2: Absence of AIS for MMSI=X (elapsed > expected * 3)
FOLLOWED_BY (RELAXED)
STEP 3: AIS resumes for MMSI=X
WITHIN 21600s (6h)
WHERE: haversine(step_1.geo, step_3.geo) < 50km, step_2.duration > 300s
```

**C2 Beacon Chain**:
```
STEP 1: DNS query for domain D
FOLLOWED_BY (RELAXED, within 30s)
STEP 2: HTTP connection to resolved IP
FOLLOWED_BY (RELAXED, within 60s)
STEP 3: DNS query for domain D again
WITHIN 600s
WHERE: step_1.source_ip == step_2.source_ip == step_3.source_ip
```

**Maritime Transshipment**:
```
STEP 1: Vessel A decelerates (delta_speed < -3kn)
FOLLOWED_BY (RELAXED, within 1800s)
STEP 2: Vessel A stationary in open water (speed < 1kn, NOT in_port)
FOLLOWED_BY (RELAXED, within 7200s)
STEP 3: New AIS contact B appears near Vessel A
WITHIN 14400s (4h)
WHERE: haversine(step_2.geo, step_3.geo) < 1km
```

### 16.3 Signal Kinds for Sequence Steps

Sequence steps can match against any signal kind, including two special
kinds introduced by R7 and R2:

- **`"lifecycle_transition"`** — matches R7 LifecycleTransition events
  published to `tsingou.track.lifecycle.*`. Allows sequences to directly
  consume track state changes (e.g., `filter: toState == "coasting"`)
  without routing through R2 absence detection.
- **`"absence_event"`** — matches R2 AbsenceEvent events. Provides richer
  context (elapsed time, severity, assessment) than raw lifecycle events.

For the AIS dark period sequence, Step 2 can use either:
- `signalKind: "lifecycle_transition"` + `filter: toState == "coasting"`
  (fast, direct, lower latency)
- `signalKind: "absence_event"` + `filter: elapsed > threshold`
  (richer, includes absence classification and projected position)

This dual-path approach was confirmed compatible with R1 watermark semantics
by tracking-researcher: both signal kinds participate in the d2ts frontier
system, and the sequence state accumulator's watermark is the minimum across
all input sources.

### 16.4 Watermark Interaction

Sequence patterns rely on R1 watermarks (Section 3.6):
- Watermark advancement determines when step N is safely matched
- Late arrivals can retroactively invalidate sequence state machines.
  For RELAXED contiguity (default), a late signal can advance a stalled
  sequence if it arrives within `allowed_lateness` of its source. Once the
  frontier passes `event_time + allowed_lateness`, the signal is handled
  per the join's `lateArrivalPolicy` (drop for windowed, reprocess for
  event-table). d2ts retraction semantics handle rollback natively.
- `maxDuration` constraint: when watermark passes `step_1.time + maxDuration`,
  in-progress sequences are evicted. The eviction condition in d2ts terms:
  `frontier > step_1.eventTime + maxDuration`
- Track lifecycle (Section 5.4) feeds sequences: COASTING entry is step 1
  of an AIS dark period sequence

---

## 17. Section 10 Amendment: Research Initiatives

Mark the following as ADDRESSED:

| Initiative | Status | Addressed By |
|-----------|--------|-------------|
| RI-1: Multi-Target Tracking | Partially addressed | R7 track lifecycle |
| RI-2: Fuzzy Identity Resolution | Open | (no amendment) |
| RI-3: Ontology Compilation | Partially addressed | R5/R6 d2ts patterns |
| RI-4: Confidence Calibration | ADDRESSED | R4.5 calibration framework |
| RI-5: Geospatial Indexing | ADDRESSED | R6 H3 blocking strategy |
| RI-6: STIX Generation | Open | (no amendment) |
| RI-7: Spoofing Detection | Partially addressed | R4.1 spoofing discount |
| RI-8: Operator Cognitive Load | Partially addressed | R8 method decomposition |

New research initiatives from this amendment cycle:

**RI-9: Absence Detection Validation**
Real-world validation of the ESR and absence classification tree against
historical dark vessel data. Are the default thresholds correct?

**RI-10: Risk Accumulation Calibration**
Calibration of noisy-OR parameters, category weights, and convergence
bonus. Requires operational data from multiple scenarios.

**RI-11: Sequence Pattern Performance**
Performance characterization of d2ts sequence state machines at scale.
How many concurrent in-progress sequences can the system maintain?

---

## 18. Unified Schema Specification

All schema additions consolidated:

```typescript
import { Schema } from 'effect'

// ===================================================================
// R1: Temporal Join Configuration
// ===================================================================

const TemporalJoinConfig = Schema.Struct({
  mode: Schema.Literal('windowed', 'event_table', 'reference'),
  windowSizeMs: Schema.optionalWith(Schema.Int, { default: () => 5000 }),
  rateRatioThreshold: Schema.optionalWith(Schema.Number, { default: () => 10.0 }),
  lateArrivalPolicy: Schema.Literal('drop', 'reprocess', 'side_channel'),
  allowedLatenessMs: Schema.optional(Schema.Struct({
    left: Schema.Int,
    right: Schema.Int,
  })),
  temporalGapDecay: Schema.optional(Schema.Struct({
    maxGapSeconds: Schema.Int,
    decayWeight: Schema.Number,
  })),
})

const TimestampValidation = Schema.TaggedStruct('TimestampValidation', {
  signalId: Schema.String,
  eventTime: Schema.Number,
  processingTime: Schema.Number,
  sourceId: Schema.String,
  validation: Schema.Literal(
    'valid', 'clamped_future', 'flagged_ancient',
    'flagged_monotonicity_violation'
  ),
  originalEventTime: Schema.optional(Schema.Number),
  clampedTo: Schema.optional(Schema.Number),
})

// ===================================================================
// R2: Absence Detection
// ===================================================================

const ExpectedSignalEntry = Schema.Struct({
  id: Schema.String,
  entityClass: Schema.String,
  signalKind: Schema.String,
  expectedRate: Schema.Struct({
    nominal: Schema.Number,
    min: Schema.Number,
    conditions: Schema.optional(Schema.Array(Schema.Unknown)),
  }),
  detectionProbability: Schema.Struct({
    clear: Schema.Number,
    degraded: Schema.Number,
    factors: Schema.Array(Schema.String),
  }),
  absenceThreshold: Schema.Struct({
    warning: Schema.Number,
    critical: Schema.Number,
    classification: Schema.Number,
  }),
  exceptions: Schema.Array(Schema.Struct({
    condition: Schema.String,
    action: Schema.Literal("suppress", "extend_threshold", "annotate"),
    factor: Schema.optional(Schema.Number),
  })),
})

const AbsenceEvent = Schema.TaggedStruct("AbsenceEvent", {
  id: Schema.String,
  entityId: Schema.String,
  entityClass: Schema.String,
  missingSignalKind: Schema.String,
  lastObservation: Schema.Struct({
    timestamp: Schema.DateTimeUtc,
    position: Schema.optional(Schema.Unknown),  // GeoPoint
    source: Schema.String,
  }),
  absenceDuration: Schema.Number,
  expectedRate: Schema.Number,
  missedCount: Schema.Number,
  severity: Schema.Literal("warning", "critical", "dark"),
  confidence: Schema.Number,
  assessment: Schema.Literal(
    "coverage_gap", "equipment_failure", "deliberate_dark",
    "environmental", "electronic_warfare", "ambiguous"
  ),
  contributingEvidence: Schema.Array(Schema.Struct({
    evidenceType: Schema.String,
    description: Schema.String,
    weight: Schema.Number,
  })),
  lastKnownState: Schema.Struct({
    position: Schema.optional(Schema.Unknown),
    velocity: Schema.optional(Schema.Number),
    heading: Schema.optional(Schema.Number),
    projectedPosition: Schema.optional(Schema.Unknown),
    projectionUncertainty: Schema.optional(Schema.Number),
  }),
  // Cross-references
  trackState: Schema.optional(TrackLifecycleState),     // R7
  coastDuration: Schema.optional(Schema.Number),         // R7
  spoofingDiscount: Schema.optional(Schema.Number),      // R4.1
})

// ===================================================================
// R3: Risk Accumulation
// ===================================================================

const RiskIndicator = Schema.TaggedStruct("RiskIndicator", {
  id: Schema.String,
  entityId: Schema.String,
  category: Schema.Literal("ID", "KIN", "BEH", "ASSOC", "SIG", "INTEL"),
  source: Schema.String,
  score: Schema.Number,
  timestamp: Schema.DateTimeUtc,
  ttl: Schema.Number,
  description: Schema.String,
  evidence: Schema.optional(Schema.Unknown),
})

const EntityRiskProfile = Schema.TaggedStruct("EntityRiskProfile", {
  entityId: Schema.String,
  entityClass: Schema.String,
  compositeRisk: Schema.Number,
  categoryScores: Schema.Record({
    key: Schema.Literal("ID", "KIN", "BEH", "ASSOC", "SIG", "INTEL"),
    value: Schema.Number,
  }),
  activeIndicators: Schema.Array(RiskIndicator),
  riskTrend: Schema.Literal("rising", "stable", "falling"),
  lastUpdate: Schema.DateTimeUtc,
  peakRisk: Schema.Number,
  peakTimestamp: Schema.DateTimeUtc,
})

// ===================================================================
// R4: Confidence Model
// ===================================================================

const CalibrationVerdict = Schema.Struct({
  fusionId: Schema.String,
  confidence: Schema.Number,
  tier: Schema.Literal(1, 2, 3),
  signalPair: Schema.String,
  verdict: Schema.Literal("accept", "reject", "uncertain"),
  operatorId: Schema.String,
  timestamp: Schema.DateTimeUtc,
})

const CalibrationSnapshot = Schema.Struct({
  signalPair: Schema.String,
  sampleSize: Schema.Int,
  bins: Schema.Array(Schema.Struct({
    lower: Schema.Number,
    upper: Schema.Number,
    count: Schema.Int,
    accepted: Schema.Int,
    rejected: Schema.Int,
    accuracy: Schema.Number,
  })),
  isMonotonic: Schema.Boolean,
  timestamp: Schema.DateTimeUtc,
})

// ===================================================================
// R5: Reference Data
// ===================================================================

const ReferenceSource = Schema.Struct({
  id: Schema.String,
  signalKind: Schema.String,
  entityClass: Schema.String,
  keyField: Schema.String,
  updateRate: Schema.Literal("static", "daily", "hourly", "minutes"),
  natsSubject: Schema.String,
  ttlSeconds: Schema.Number,
})

// ===================================================================
// R6: Blocking Configuration
// ===================================================================

const SpatialBlockConfig = Schema.Struct({
  h3Resolution: Schema.Number.pipe(Schema.int(), Schema.between(0, 15)),
  kRingExpansion: Schema.Number.pipe(Schema.int(), Schema.between(0, 3)),
  expandSide: Schema.Literal("left", "right", "both"),
})

const TemporalBlockConfig = Schema.Struct({
  windowSeconds: Schema.Number.pipe(Schema.positive()),
  bucketWidthSeconds: Schema.Number.pipe(Schema.positive()),
  overlapBuckets: Schema.Number.pipe(Schema.int(), Schema.between(0, 2)),
})

const SpectralBlockConfig = Schema.Struct({
  bandId: Schema.String,
  centerFreqMHz: Schema.Number,
  bandwidthMHz: Schema.Number,
})

// ===================================================================
// R7: Track Lifecycle
// ===================================================================

const TrackLifecycleState = Schema.Literal(
  'tentative', 'confirmed', 'coasting', 'dropped', 'merged'
)

const LifecycleTransition = Schema.TaggedStruct('LifecycleTransition', {
  trackId: Schema.String,
  fromState: TrackLifecycleState,
  toState: TrackLifecycleState,
  reason: Schema.Literal(
    'initiated', 'm_of_n_confirmed', 'score_confirmed',
    'detection_missed', 'detection_recovered',
    'max_coast_exceeded', 'score_below_threshold',
    'merged_into', 'operator_action'
  ),
  timestamp: Schema.Number,
  metadata: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
})

const TrackLifecycleConfig = Schema.TaggedStruct('TrackLifecycleConfig', {
  entityClass: Schema.String,
  confirmationMethod: Schema.Literal('m_of_n', 'score_based'),
  m: Schema.optionalWith(Schema.Int, { default: () => 3 }),
  n: Schema.optionalWith(Schema.Int, { default: () => 5 }),
  confirmThreshold: Schema.optionalWith(Schema.Number, { default: () => 20 }),
  deleteThreshold: Schema.optionalWith(Schema.Number, { default: () => -10 }),
  detectionProbability: Schema.optionalWith(Schema.Number, { default: () => 0.9 }),
  clutterDensity: Schema.optionalWith(Schema.Number, { default: () => 1e-6 }),
  coastEntryMisses: Schema.Int,
  maxCoastScans: Schema.Int,
  tentativeConfidenceMultiplier: Schema.optionalWith(Schema.Number, { default: () => 0.5 }),
  coastConfidenceDecayPerScan: Schema.optionalWith(Schema.Number, { default: () => 0.05 }),
})

// ===================================================================
// R8: Tier 3 Methods
// ===================================================================

const PeriodicityConfig = Schema.TaggedStruct("PeriodicityConfig", {
  minObservations: Schema.Int.pipe(Schema.greaterThan(0)),
  frequencyTolerance: Schema.Number,
  coherenceThreshold: Schema.Number,
  harmonicOrders: Schema.Array(Schema.Int),
  windowSize: Schema.Duration,
})

const CoOccurrenceConfig = Schema.TaggedStruct("CoOccurrenceConfig", {
  minSupport: Schema.Number,
  minConfidence: Schema.Number,
  minLift: Schema.Number,
  minObservations: Schema.Int.pipe(Schema.greaterThan(0)),
  entityTypes: Schema.Array(Schema.String),
  timeWindow: Schema.Duration,
  updateInterval: Schema.Duration,
})

const CommunityConfig = Schema.TaggedStruct("CommunityConfig", {
  algorithm: Schema.Literal("louvain", "leiden"),
  resolution: Schema.Number,
  minCommunitySize: Schema.Int.pipe(Schema.greaterThan(0)),
  maxCommunitySize: Schema.Int.pipe(Schema.greaterThan(0)),
  modularityThreshold: Schema.Number,
  updateInterval: Schema.Duration,
  edgeWeightMinimum: Schema.Number,
})

const AnomalyCoincidenceConfig = Schema.TaggedStruct("AnomalyCoincidenceConfig", {
  coincidenceWindow: Schema.Duration,
  minAnomalousSources: Schema.Int.pipe(Schema.greaterThan(1)),
  coincidenceThreshold: Schema.Number,
  baselineTrainingWindow: Schema.Duration,
  zScoreThreshold: Schema.Number,
  independenceGroups: Schema.Record(Schema.String, Schema.Array(Schema.String)),
})

const Tier3ConfigUnion = Schema.Union(
  PeriodicityConfig,
  CoOccurrenceConfig,
  CommunityConfig,
  AnomalyCoincidenceConfig,
)

// ===================================================================
// R9: Sequence Patterns
// ===================================================================

const SequenceStep = Schema.Struct({
  id: Schema.String,
  signalKind: Schema.String,  // Accepts any signal kind including:
    // - Standard signals: "adsb", "ais", "http", "dns", "rf-bearing", etc.
    // - R7 lifecycle:     "lifecycle_transition" (matches LifecycleTransition events)
    // - R2 absence:       "absence_event" (matches AbsenceEvent events)
    // This allows sequences to consume R7 lifecycle events directly
    // (e.g., filter: toState == "coasting") without routing through R2.
  entityClass: Schema.optional(Schema.String),
  filters: Schema.Array(Schema.Struct({
    field: Schema.String,
    operator: Schema.Literal(
      "eq", "neq", "gt", "lt", "gte", "lte", "in", "not_in", "between"
    ),
    value: Schema.Unknown,
  })),
  contiguity: Schema.Literal("strict", "relaxed", "non_deterministic"),
  maxGap: Schema.optional(Schema.Duration),
})

const SequencePattern = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  description: Schema.String,
  steps: Schema.Array(SequenceStep).pipe(Schema.minItems(2)),
  maxDuration: Schema.Duration,
  crossPredicates: Schema.Array(Schema.Struct({
    type: Schema.Literal("same_entity", "spatial_continuity", "temporal_gap"),
    leftStep: Schema.String,
    rightStep: Schema.String,
    parameters: Schema.Record(Schema.String, Schema.Unknown),
  })),
  outputPattern: Schema.String,
  enabled: Schema.Boolean,
  tier: Schema.Literal(2, 3),
})

// ===================================================================
// FusionOntology V2 (unified)
// ===================================================================

const FusionOntologyV2 = Schema.Struct({
  version: Schema.String,                           // "2.0"
  scenario: Schema.String,
  entityClasses: Schema.Array(EntityClassDef),
  joinPaths: Schema.Array(JoinPathEntryV2),
  resolvers: Schema.Array(IdentityResolverDef),
  sequencePatterns: Schema.Array(SequencePattern),   // R9
  referenceSources: Schema.Array(ReferenceSource),   // R5
  expectedSignals: Schema.Array(ExpectedSignalEntry), // R2
  trackLifecycleConfigs: Schema.Array(TrackLifecycleConfig), // R7
  thresholds: Schema.Struct({
    fusionConfidence: Schema.Number,                 // default 0.65
    spatialWeightDefault: Schema.Number,
    temporalWeightDefault: Schema.Number,
    spectralWeightDefault: Schema.Number,
    behavioralWeightDefault: Schema.Number,
    semanticWeightDefault: Schema.Number,
  }),
  confidenceModel: Schema.Literal(                   // R4.3
    "weighted_average", "log_odds", "dempster_shafer"
  ),
  correlationMatrix: Schema.optional(                // R4.2
    Schema.Record(Schema.String, Schema.Record(Schema.String, Schema.Number))
  ),
  correlationDiscountFactor: Schema.optionalWith(    // R4.2
    Schema.Number, { default: () => 0.3 }
  ),
  blockingDefaults: Schema.Struct({                  // R6
    spatialResolution: Schema.Number,
    temporalBucketSeconds: Schema.Number,
    maxConeCells: Schema.Number,
  }),
  riskThresholds: Schema.Struct({                    // R3
    elevated: Schema.Number,                         // 0.2
    moderate: Schema.Number,                         // 0.4
    high: Schema.Number,                             // 0.6
    critical: Schema.Number,                         // 0.8
  }),
  absenceThresholds: Schema.Struct({                 // R2
    warningDefault: Schema.Number,
    criticalDefault: Schema.Number,
    darkDefault: Schema.Number,
  }),
})
```

---

## 19. Reconciliation Log

This section documents conflicts discovered between amendments and their
resolution.

### 19.1 H3 Resolution Discrepancy (R1 vs R6)

**Conflict**: R1 specifies ADS-B x AIS at H3 res 9. R6 specifies res 8.

**Resolution**: Both are correct for different purposes. R6 res 8 is the
**blocking** resolution (coarser, creates candidate set). R1 res 9 is the
**join** resolution (finer, evaluates predicates). Blocking must be >=
join resolution. Res 8 >= res 9 (coarser cell contains finer cells).
No conflict.

### 19.2 OSINT Join Mode Disagreement (R1 vs R6)

**Conflict**: R1 classifies OSINT x OSINT as event-table (enrich entity
with latest OSINT). R6 classifies as windowed (co-temporal correlation of
two OSINT reports).

**Resolution**: Both modes are valid for different use cases. The
JoinPathEntry gains a `joinMode` field. Operators select per scenario.
Blocking (3600s) applies only to `joinMode = "windowed"`.

### 19.3 DNS Join Window (R1 original vs R1 revised)

**Conflict**: R1 originally specified DNS x HTTP window as 2s. R6 blocking
specified 300s. The 150x ratio was suspicious.

**Resolution**: R1 revised to 30s, citing DNS prefetching, caching, and
log shipping lag. R6 blocking at 300s remains as generous pre-filter.
No conflict after revision.

### 19.4 Section Numbering Conflict (R5 and R1)

**Conflict**: Both R5 and R1 proposed insertion as "Section 3.4".

**Resolution**: R5 (Data Duality) is Section 3.4. R6 (Blocking) is
Section 3.5. R1 (Temporal Joins) is Section 3.6. This order follows the
logical dependency: data classification -> blocking -> temporal semantics.

### 19.5 Confidence Clamping Range

**Conflict**: R4.2 clamps to [0.0, 0.99]. R4.4 (log-odds) clamps to
[0.01, 0.99]. R4.6 (Bayesian) clamps to [0.01, 0.99].

**Resolution**: Unified to [0.01, 0.99] for all modes. The lower bound
prevents division by zero in log-odds conversion. The upper bound
prevents false certainty (erratum E1).

### 19.6 TrackLifecycleState Definition Location

**Conflict**: R7 defines TrackLifecycleState. R2 AbsenceEvent references
it. Both define it independently.

**Resolution**: Single definition in the R7 section. R2 AbsenceEvent
imports the type via `trackState: Schema.optional(TrackLifecycleState)`.

---

## 20. Traceability Matrix

| v2 Section | Amendment | Author | Priority | TSGC-001 Location |
|------------|-----------|--------|----------|-------------------|
| Erratum E1 | R4.1 | grounded-theory-analyst | MEDIUM | 3.1 |
| Erratum E2 | R4.2 | grounded-theory-analyst | MEDIUM | 3.2.2 |
| Erratum E3 | R8.1 | grounded-theory-analyst | LOW | 3.3 |
| Sec 2 (Hard Key) | R4.1 | grounded-theory-analyst | MEDIUM | 3.1 |
| Sec 3 (Confidence) | R4.2-R4.6 | grounded-theory-analyst | MEDIUM | 3.2.2, new |
| Sec 4 (Tier 3) | R8.2-R8.5 | grounded-theory-analyst | LOW | 3.3, 6.1, 6.2 |
| Sec 5 (Data Duality) | R5 | geospatial-researcher | MEDIUM | new 3.4 |
| Sec 6 (Blocking) | R6 | geospatial-researcher | MEDIUM | new 3.5 |
| Sec 7 (Temporal) | R1 | tracking-researcher | HIGH | new 3.6 |
| Sec 8 (Lifecycle) | R7 | tracking-researcher | LOW | new 5.4 |
| Sec 9 (Absence) | R2 | adversarial-researcher | MEDIUM | new 5.5 |
| Sec 10 (Risk) | R3 | adversarial-researcher | MEDIUM | new 5.6 |
| Sec 11 (Registry) | R1-R9 | all | - | 6 |
| Sec 12 (d2ts) | R1-R9 | all | - | 7 |
| Sec 13 (Operator) | R2-R9 | all | - | 8 |
| Sec 14 (Semantics) | R2, R4 | grounded-theory, adversarial | MEDIUM | 9 |
| Sec 15 (Calibration) | R4.5 | grounded-theory-analyst | MEDIUM | new 9.1 |
| Sec 16 (Sequences) | R9 | grounded-theory-analyst | LOW | new 9.2 |
| Sec 17 (Research) | R1-R9 | all | - | 10 |

---

## 21. References

### Amendment Source Documents

- R1+R7: `docs/tsingou/concepts/amendments/r1-temporal-joins.md` (tracking-researcher)
- R2+R3: `docs/tsingou/concepts/amendments/r2-negative-space.md` (adversarial-researcher)
- R4+R8+R9: `docs/tsingou/concepts/amendments/r4-confidence-tier3.md` (grounded-theory-analyst)
- R5+R6: `docs/tsingou/concepts/amendments/r5-data-model-blocking.md` (geospatial-researcher)

### Evidence Documents

- [TSGC-001] `docs/tsingou/concepts/fusion-ontology.md` — original ontology
- [TSGC-GT-001] `docs/tsingou/concepts/grounded-theory-data-fusion.md` — grounded theory analysis

### External References

- Akidau, T. et al. "The Dataflow Model." VLDB 2015. (watermarks)
- Apache Flink. "FlinkCEP." (sequence patterns)
- Apache Flink. "Temporal Tables and Joins in Streaming SQL." 2019.
- Bar-Shalom, Y. "Tracking and Data Association." Academic Press, 1988. (correlated evidence)
- Blondel et al. "Fast unfolding of communities in large networks." 2008. (Louvain)
- Koch, W. "On exploiting 'negative' sensor evidence." Info. Fusion 8(1), 2007. (absence)
- McSherry, F. "Progress Tracking in Timely Dataflow." 2019. (d2ts frontier)
- OASIS. "STIX Version 2.1." 2021.
- Reid, D. "An Algorithm for Tracking Multiple Targets." IEEE TAC, 1979. (MHT)
- RisingWave Labs. "RFC-0049: Temporal Join." 2023.
- Shafer, G. "A Mathematical Theory of Evidence." Princeton, 1976. (D-S)
- Splunk. "The Splunk Guide to Risk-Based Alerting." (noisy-OR, RBA)
- Uber Technologies. "H3: Hexagonal Hierarchical Geospatial Indexing." 2018.
- Wald, A. "Sequential Tests of Statistical Hypotheses." 1945. (SPRT)
- @electric-sql/d2ts. "Differential Dataflow in TypeScript." 2024.

---

*End of TSGC-001-v2 Unified Amendment Specification*
