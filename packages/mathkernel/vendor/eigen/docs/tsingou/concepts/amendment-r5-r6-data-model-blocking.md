# TSGC-001 Amendment: R5 + R6

```
Amendment:  R5 (Reference vs Event Data Model) + R6 (Blocking Strategy for Scale)
Target:     TSGC-001 — Fusion Ontology Design, v2
Author:     geospatial-researcher
Status:     DRAFT
Created:    2026-02-19
Evidence:   grounded-theory-data-fusion.md (Sections 1.5.2, 1.3.3, 2.6, 3.4, 3.5)
            research-geospatial-stix.md (Part I: Sections 1-10)
Priority:   MEDIUM (both)
```

> These two amendments address gaps #7 and #8 from the TSGC-001 gap analysis:
>
> - **Gap #7**: "No distinction between reference data (registries) and event data
>   (signals)." Evidence: Recorded Future dual-graph, Kafka KTable vs KStream.
> - **Gap #8**: "No discussion of how to avoid O(n^2) comparisons at scale."
>   Evidence: H3 cells partially address this but need explicit strategy.

---

## Amendment R5: Reference vs Event Data Model

### Proposed Location in TSGC-001 v2

Insert as **Section 3.4** (after Tier 3, before Section 4), renumbering subsequent
sections. Title: "Data Duality: Event Streams vs Reference Tables".

---

### Section Draft: 3.4 Data Duality — Event Streams vs Reference Tables

#### 3.4.1 The Two Kinds of Data

The fusion ontology operates over two fundamentally different kinds of data.
Failing to distinguish them leads to incorrect join semantics, wasted
computation, and combinatorial explosion.

| Property | Event Data (Signals) | Reference Data (Registries) |
|----------|---------------------|----------------------------|
| **Nature** | Volatile, append-only, timestamped | Stable, slowly-changing, lookup-keyed |
| **Examples** | ADS-B position reports, AIS updates, HTTP logs, RF bearing sweeps, OSINT articles | FAA aircraft registry, ITU vessel registry, ASN database, WHOIS records, STIX indicator feeds |
| **Update rate** | Milliseconds to seconds | Hours to days |
| **Cardinality** | Unbounded (grows continuously) | Bounded (finite entity set) |
| **Identity** | Each record is a unique event | Each record is a versioned entity state |
| **d2ts model** | Differential stream (additions/retractions over time) | Materialized arrangement (indexed, current-state view) |
| **Kafka analogy** | KStream | KTable / GlobalKTable |
| **Join behavior** | Both sides trigger (event x event) | Only the event side triggers (event x table) |

This distinction is not merely organizational — it determines which d2ts
operator is correct for each join path.

#### 3.4.2 Join Semantics by Data Pair Type

Three join patterns exist, each with different semantics:

**Event x Event (Signal x Signal)**

Both sides are volatile event streams. Requires explicit windowing to bound
the comparison space. Produces a result for every matching pair within the
window. This is the semantics for Tier 2 spatial/temporal correlation.

```
Example: ADS-B positions x AIS positions
  Both are event streams.
  Window: 60 seconds.
  Result: All co-located (ADS-B, AIS) pairs within the window.

d2ts: collection_A.join(collection_B, predicate)
      // Both sides are differential streams
      // Window enforced via temporal predicate + arrangement GC
```

**Danger**: Event x event joins are **cartesian within the window**. If collection
A has N events and collection B has M events in the window, the join evaluates
N x M candidate pairs. Without blocking (Section 3.5), this is the primary
scalability bottleneck.

Evidence: Kafka Streams documentation explicitly warns about KStream-KStream
cartesian behavior. [Source: Confluent, "Crossing the Streams"]

**Event x Reference (Signal x Registry)**

One side is a volatile event stream; the other is a stable reference table.
Only new events trigger lookups against the current table state. Table updates
do NOT trigger reprocessing of historical events.

```
Example: ADS-B position (event) x FAA aircraft registry (reference)
  ADS-B signal arrives with ICAO = A4F2B7.
  Lookup FAA registry: A4F2B7 -> N12345, Delta Air Lines, Boeing 737-800.
  Result: Enriched signal with tail number, operator, aircraft type.

d2ts: collection_event.join(arrangement_reference, key_match)
      // Event side is differential stream
      // Reference side is materialized arrangement (indexed)
      // Arrangement provides O(1) lookup per event
```

This is the semantics for Tier 1 enrichment joins (PAIR 2 in the ontology).
The reference table is an **arrangement** in d2ts — a persistent, indexed
materialization that supports efficient point lookups.

**Crucially**: Event x reference joins are O(n) in the event stream size, not
O(n x m). Each event triggers one lookup. This is inherently scalable.

Evidence: Recorded Future dual-graph (ontology graph = reference, event graph =
signals); Kafka KStream-KTable; DCGS-A DIB model (reference discovery then
event correlation).

**Reference x Reference (Registry x Registry)**

Both sides are stable reference tables. The join maintains an ever-updating
materialized view of the cross-product of matched entries. Updates to either
side incrementally propagate.

```
Example: FAA registry (reference) x sanctions list (reference)
  Result: All aircraft whose operators appear on the sanctions list.
  Updates when: FAA registry changes (new registration) OR sanctions list
  changes (new designation).

d2ts: arrangement_A.join(arrangement_B, key_match)
      // Both sides are materialized arrangements
      // Incremental maintenance via d2ts delta join
```

This is uncommon in real-time fusion but useful for pre-computed enrichment
tables (e.g., "which vessels are on watchlists?").

#### 3.4.3 Classification of Existing Join Paths

Every JoinPathEntry in the ontology (Section 6) must be classified:

| Join Path | Left | Right | Data Pair Type | Join Semantics |
|-----------|------|-------|---------------|----------------|
| PAIR 1: ADS-B x ADS-B (dedup) | Event | Event | Event x Event | Windowed, cartesian within window |
| PAIR 2: ADS-B x FAA Registry | Event | Reference | Event x Reference | Lookup, O(n) in events |
| PAIR 3: ADS-B x AIS | Event | Event | Event x Event | Windowed, cartesian within window |
| PAIR 4: ADS-B x RF Bearing | Event | Event | Event x Event | Windowed, cartesian within window |
| PAIR 5: AIS x RF Bearing | Event | Event | Event x Event | Windowed, cartesian within window |
| PAIR 6: HTTP x DNS | Event | Event | Event x Event | Windowed, cartesian within window |
| PAIR 7: HTTP x OSINT/RSS | Event | Event | Event x Event | Windowed, cartesian within window |
| PAIR 8: * x * (Tier 3) | Event | Event | Event x Event | Statistical batch |

**Observation**: Six of eight join paths are Event x Event. Only PAIR 2
(enrichment) is Event x Reference. This means the ontology is heavily weighted
toward the more expensive join pattern. This is expected — enrichment is easy
(lookup); correlation is hard (comparison).

#### 3.4.4 Schema Extension

The JoinPathEntry schema (Section 6.2) must be extended to declare data pair type:

```typescript
const JoinPathEntry = Schema.Struct({
  id:          Schema.String,
  left:        Schema.Struct({
    signalKind:  Schema.String,
    keyPath:     Schema.String,
    dataType:    Schema.Literal("event", "reference"),  // NEW
  }),
  right:       Schema.Struct({
    signalKind:  Schema.String,
    keyPath:     Schema.String,
    dataType:    Schema.Literal("event", "reference"),  // NEW
  }),
  joinType:    Schema.Literal(
    "identity", "spatial", "temporal",
    "spectral", "semantic", "behavioral"
  ),
  // ... existing fields ...
})
```

The d2ts compiler (Section 7) uses `dataType` to select the correct operator:

| Left dataType | Right dataType | d2ts Strategy |
|---------------|----------------|---------------|
| event | event | Windowed join with blocking (Section 3.5) |
| event | reference | Arrangement lookup (O(1) per event) |
| reference | event | Reverse arrangement lookup |
| reference | reference | Delta join on arrangements |

#### 3.4.5 Reference Data Management

Reference data sources must be explicitly registered in the FusionOntology schema:

```typescript
const ReferenceSource = Schema.Struct({
  id:           Schema.String,               // "faa-registry"
  signalKind:   Schema.String,               // "faa-db"
  entityClass:  Schema.String,               // "Aircraft"
  keyField:     Schema.String,               // "icao_hex"
  updateRate:   Schema.Literal(              // Expected update frequency
    "static", "daily", "hourly", "minutes"
  ),
  natsSubject:  Schema.String,               // "tsingou.ref.faa.*"
  ttlSeconds:   Schema.Number,               // Cache TTL before refresh
})

const FusionOntology = Schema.Struct({
  // ... existing fields ...
  referenceSources: Schema.Array(ReferenceSource),  // NEW
})
```

Reference sources are materialized as d2ts arrangements on startup and maintained
incrementally. Their NATS subjects follow the convention `tsingou.ref.<source>.*`
to distinguish from event subjects (`tsingou.signal.<kind>.*`).

---

## Amendment R6: Blocking Strategy for Scale

### Proposed Location in TSGC-001 v2

Insert as **Section 3.5** (immediately after the new Section 3.4). Title:
"Blocking Strategy for Scalable Joins".

---

### Section Draft: 3.5 Blocking Strategy for Scalable Joins

#### 3.5.1 The Combinatorial Problem

Event x event joins (Section 3.4.2) are cartesian within their comparison
window. Without a strategy to reduce the candidate space, computational cost
is O(n x m) where n and m are the event counts within the window.

```
UNBLOCKED JOIN:

Collection A: 10,000 ADS-B signals (1 Hz, 10s window)
Collection B: 500 AIS signals (0.005 Hz, 180s window)

Candidate pairs = 10,000 x 500 = 5,000,000 per evaluation cycle
Each pair: haversine(A.geo, B.geo) + |A.t - B.t| = ~200 ns
Total: 5,000,000 x 200 ns = 1 second of computation

This consumes AN ENTIRE CORE just for one join path.
```

**Blocking** partitions the candidate space so that only signals likely to match
are compared. The term comes from entity resolution literature: a "block" is a
group of records that share some coarse attribute (location, time, first letter
of name) and only records within the same block are compared.

#### 3.5.2 Three-Dimensional Blocking

Tsingou implements a combined blocking strategy across three dimensions:

```
THREE-DIMENSIONAL BLOCKING:

Dimension 1: SPATIAL (H3 cell)
  Signals must share an H3 cell (or k-ring neighbor) to be compared.
  Resolution selected per signal pair type.

Dimension 2: TEMPORAL (time window)
  Signals must fall within the same time window to be compared.
  Window size selected per signal pair type.

Dimension 3: SPECTRAL (frequency band) — optional
  For RF-bearing joins, signals must be in compatible frequency bands.
  Eliminates cross-band false candidates.

Combined block key:
  block_id = (h3_cell, time_bucket, freq_band?)

Only signals sharing the same block_id are compared.
```

#### 3.5.3 Spatial Blocking via H3

Each event x event join path with a spatial component is assigned an H3
resolution. The resolution determines the block size:

| Signal Pair | Fusion Radius | H3 Resolution | Cell Diameter | K-ring | Block Size |
|-------------|--------------|---------------|---------------|--------|------------|
| ADS-B x ADS-B (dedup) | 100 m | 9 | 400 m | k=0 | 1 cell |
| ADS-B x AIS | 500 m | 8 | 1,062 m | k=1 | 7 cells |
| ADS-B x RF bearing | 2 km | 7 | 2,820 m | k=1 | 7 cells |
| AIS x RF bearing | 2 km | 7 | 2,820 m | k=1 | 7 cells |
| ADS-B x Radar | 1 km | 8 | 1,062 m | k=1 | 7 cells |
| WiFi x Bluetooth | 50 m | 10 | 152 m | k=1 | 7 cells |
| OSINT x OSINT | 10 km | 5 | 19,700 m | k=1 | 7 cells |
| RF DF x RF DF | 5 km | 6 | 7,440 m | k=1 | 7 cells |

**Selection rule**: Choose the resolution where cell diameter approximately
equals the fusion radius. Then expand by k=1 ring on the higher-frequency
stream side to ensure complete coverage.

Schema extension to JoinPathEntry:

```typescript
const SpatialBlockConfig = Schema.Struct({
  h3Resolution:   Schema.Number.pipe(Schema.int(), Schema.between(0, 15)),
  kRingExpansion: Schema.Number.pipe(Schema.int(), Schema.between(0, 3)),
  expandSide:     Schema.Literal("left", "right", "both"),
})

const JoinPathEntry = Schema.Struct({
  // ... existing fields ...
  spatialBlock: Schema.optional(SpatialBlockConfig),  // NEW
  temporalBlock: Schema.optional(TemporalBlockConfig), // NEW
  spectralBlock: Schema.optional(SpectralBlockConfig), // NEW
})
```

#### 3.5.4 Temporal Blocking

Time is divided into fixed-width buckets. Only signals in the same or adjacent
buckets are compared:

| Signal Pair | Temporal Window | Bucket Width | Overlap |
|-------------|----------------|-------------|---------|
| ADS-B x ADS-B (dedup) | 5 s | 5 s | 1 bucket |
| ADS-B x AIS | 60 s | 30 s | 2 buckets |
| ADS-B x RF bearing | 10 s | 10 s | 1 bucket |
| AIS x RF bearing | 30 s | 15 s | 2 buckets |
| HTTP x DNS | 300 s | 150 s | 2 buckets |
| OSINT x OSINT | 3,600 s | 1,800 s | 2 buckets |

**Overlap handling**: To avoid missing matches at bucket boundaries, each signal
is placed in its primary bucket AND the adjacent bucket. This is analogous to
k-ring expansion in the spatial dimension.

```typescript
const TemporalBlockConfig = Schema.Struct({
  windowSeconds:     Schema.Number.pipe(Schema.positive()),
  bucketWidthSeconds: Schema.Number.pipe(Schema.positive()),
  overlapBuckets:    Schema.Number.pipe(Schema.int(), Schema.between(0, 2)),
})
```

Bucket assignment:

```
function temporalBucket(timestamp: number, bucketWidth: number): number {
  return Math.floor(timestamp / bucketWidth)
}

function temporalBuckets(
  timestamp: number,
  config: TemporalBlockConfig
): number[] {
  const primary = temporalBucket(timestamp, config.bucketWidthSeconds)
  if (config.overlapBuckets === 0) return [primary]
  if (config.overlapBuckets === 1) return [primary, primary + 1]
  return [primary - 1, primary, primary + 1]
}
```

#### 3.5.5 Spectral Blocking (RF Joins Only)

For join paths involving RF signals, frequency band provides an additional
blocking dimension:

| Band | Frequency Range | Signal Kinds |
|------|----------------|-------------|
| ADS-B | 1090 MHz +/- 1 MHz | ADS-B, RF bearing (1090 band) |
| AIS/VHF | 156-174 MHz | AIS, RF bearing (VHF marine) |
| HF | 3-30 MHz | HF SIGINT, RF bearing (HF) |
| WiFi 2.4 | 2.4-2.5 GHz | WiFi, Bluetooth |
| WiFi 5 | 5.15-5.85 GHz | WiFi 5 GHz |

Spectral blocking prevents comparing a 1090 MHz ADS-B signal against a 156 MHz
AIS RF bearing — they cannot be the same emitter.

```typescript
const SpectralBlockConfig = Schema.Struct({
  bandId:        Schema.String,
  centerFreqMHz: Schema.Number,
  bandwidthMHz:  Schema.Number,
})
```

#### 3.5.6 Combined Block Key

The composite block key is the tuple of all active blocking dimensions:

```
block_key = (h3_cell, time_bucket, freq_band?)

Examples:
  ADS-B x AIS:       (871fb4e65ffffff, 1708340430, null)
  ADS-B x RF:        (871fb4e65ffffff, 1708340430, "adsb-1090")
  OSINT x OSINT:     (851fb4e6fffffff, 1708339200, null)
```

Only signals sharing the same block_key are compared. The d2ts join operator
uses the block_key as its equi-join key, followed by predicate evaluation on
the matching candidates.

#### 3.5.7 Blocking Effectiveness

```
BLOCKED JOIN (same scenario as 3.5.1):

Collection A: 10,000 ADS-B signals, 500 km x 500 km area, 10s window
Collection B: 500 AIS signals, 500 km x 500 km area, 180s window

H3 resolution 8: ~48,000 cells in the area
  ADS-B per cell: 10,000 / 48,000 ~= 0.2
  AIS per cell: 500 / 48,000 ~= 0.01

With k=1 expansion on ADS-B:
  ADS-B cells checked per join: 7
  AIS signals per cell: 0.01
  Candidate pairs per ADS-B signal: 7 * 0.01 = 0.07

Total candidates per second:
  10,000 ADS-B/sec * 0.07 candidates/signal = 700 candidate pairs/sec
  vs. 5,000,000 unblocked

REDUCTION FACTOR: 7,143x

Computation: 700 * 200 ns = 140 microseconds/sec = 0.014% of one core
```

**Caveat**: These numbers assume uniform signal distribution. In practice,
signals cluster (airports, harbors, cities), increasing block occupancy in
hot spots. The reduction factor in clustered areas may be 100-1000x instead
of 7000x. Still dramatically better than unblocked.

#### 3.5.8 Bearing Cone Blocking

RF bearing signals (DF sweeps) are spatial extents, not points. A bearing cone
at resolution 7 may cover 5-400 H3 cells (depending on range and beamwidth).
Each cell becomes a separate block entry for the bearing signal.

```
BEARING BLOCKING:

RF DF sweep: azimuth=045, beamwidth=30, range=50km, res 7
  polyfill -> ~400 H3 cells

For each cell in the cone:
  Insert (cell, time_bucket, "vhf-marine") into the blocking index

AIS signal at position P:
  cell = latLngToCell(P, 7) = 871fb4e65ffffff
  If 871fb4e65ffffff is in the cone cell set -> CANDIDATE
  Else -> NOT CANDIDATE (skip expensive point-in-cone test)
```

This converts the expensive point-in-cone geometric test into an O(1) hash
lookup, at the cost of maintaining the cone cell set (~400 entries at res 7).

Guidance for cone cell count budgets:

| Scenario | Max Cells | Rationale |
|----------|-----------|-----------|
| Tactical DF (10 km, narrow beam) | < 50 | Low overhead |
| Surveillance DF (50 km, wide beam) | < 500 | Acceptable for moderate rates |
| Long-range DF (100 km, wide beam) | < 2,000 | Use coarser resolution |

If the cell count exceeds the budget, the system SHOULD coarsen the H3
resolution by 1 level (reducing cell count by ~7x).

#### 3.5.9 d2ts Integration

The blocking strategy integrates with d2ts as a pre-join transformation:

```
d2ts PIPELINE WITH BLOCKING:

  signal_stream
    |
    v
  .flatMap(assignBlockKeys)     // (signal) -> [(block_key, signal), ...]
    |                            //   spatial: H3 cell + k-ring
    v                            //   temporal: bucket + overlap
  .join(other_stream_blocked,    //   spectral: band ID (if RF)
        on: block_key equality)
    |
    v
  .filter(evaluatePredicates)   // Exact spatial/temporal/spectral check
    |
    v
  .map(computeConfidence)       // Weighted predicate score
```

The `assignBlockKeys` function produces multiple (block_key, signal) pairs per
signal (one per k-ring cell x temporal overlap bucket). This fan-out is the
cost of blocking — typically 7-14x amplification. The join operator then
performs an equi-join on block_key, which d2ts handles efficiently via
differential arrangements.

#### 3.5.10 Blocking Configuration in the Ontology

The FusionOntology schema is extended:

```typescript
const FusionOntology = Schema.Struct({
  // ... existing fields ...
  blockingDefaults: Schema.Struct({                   // NEW
    spatialResolution:     Schema.Number,             // default H3 res
    temporalBucketSeconds: Schema.Number,             // default bucket width
    maxConeCells:          Schema.Number,             // bearing cone budget
  }),
})
```

Each JoinPathEntry can override the defaults:

```
PAIR 3: ADS-B x AIS (cross-class, spatial join)
  ...existing fields...
  spatialBlock:
    h3Resolution: 8
    kRingExpansion: 1
    expandSide: "left"        # ADS-B (higher rate) gets expanded
  temporalBlock:
    windowSeconds: 60
    bucketWidthSeconds: 30
    overlapBuckets: 1
  spectralBlock: null          # Not an RF join
```

#### 3.5.11 Monitoring and Adaptive Blocking

The system SHOULD monitor blocking effectiveness and alert when:

1. **Block occupancy exceeds threshold** — A single block contains more than
   100 signals, indicating a hot spot that may cause performance degradation.
   Response: Refine to finer H3 resolution in that area.

2. **False negative rate increases** — Signals that should match are being
   placed in different blocks due to boundary effects. Response: Increase
   k-ring expansion from k=1 to k=2.

3. **Cell change rate exceeds budget** — Fast-moving objects cross cell
   boundaries too frequently, generating excessive blocking index updates.
   Response: Coarsen H3 resolution.

Monitoring metrics (published to NATS `tsingou.metrics.blocking.*`):

| Metric | Description | Alert Threshold |
|--------|------------|----------------|
| `block_occupancy_p99` | 99th percentile signals per block | > 100 |
| `candidates_per_signal` | Average candidate pairs per input signal | > 50 |
| `blocking_reduction_factor` | Unblocked / blocked candidate ratio | < 10 |
| `cell_crossings_per_second` | H3 cell boundary crossing rate | > 10,000 |
| `cone_cells_p99` | 99th percentile cells per bearing cone | > 2,000 |

---

## Cross-References

### R5 Cross-References

- Section 3.1 (Tier 1): Hard key joins between events and references are Event x
  Reference joins — O(n) arrangement lookups, not windowed cartesian products.
- Section 6 (Join Path Registry): Each JoinPathEntry now declares `dataType` on
  both left and right sides.
- Section 7 (d2ts Compilation): The compiler uses `dataType` to select between
  differential stream joins and arrangement lookups.
- TSGC-002 Section 20 (Effect Schema): STIX generation must handle both event-
  sourced and reference-sourced observed-data objects.

### R6 Cross-References

- Section 3.2.1 (Predicate Stack): Spatial and temporal predicates define the
  blocking dimensions. The blocking resolution must be coarser than or equal to
  the predicate thresholds.
- Section 6.1 (Join Path Registry): Each enabled spatial join path now includes
  blocking configuration (h3Resolution, temporalBucket, spectralBand).
- TSGC-002 Section 3 (H3 Resolution Selection): The blocking resolution table
  is derived from the RI-5 research on H3 resolution per signal pair type.
- TSGC-002 Section 4 (Bearing Cone to H3 Polyfill): Bearing cone blocking
  uses the polyfill algorithm from RI-5.
- TSGC-002 Section 9 (H3 Performance): Blocking overhead estimates are grounded
  in the RI-5 H3 performance benchmarks.

---

## Summary of Schema Changes

### New Fields on JoinPathEntry

```typescript
// Left/Right data type declaration
left.dataType:  "event" | "reference"   // R5
right.dataType: "event" | "reference"   // R5

// Blocking configuration
spatialBlock?: {                         // R6
  h3Resolution: number,
  kRingExpansion: number,
  expandSide: "left" | "right" | "both"
}
temporalBlock?: {                        // R6
  windowSeconds: number,
  bucketWidthSeconds: number,
  overlapBuckets: number
}
spectralBlock?: {                        // R6
  bandId: string,
  centerFreqMHz: number,
  bandwidthMHz: number
}
```

### New Top-Level Fields on FusionOntology

```typescript
// Reference data source registry
referenceSources: Array<{               // R5
  id: string,
  signalKind: string,
  entityClass: string,
  keyField: string,
  updateRate: "static" | "daily" | "hourly" | "minutes",
  natsSubject: string,
  ttlSeconds: number
}>

// Blocking defaults
blockingDefaults: {                     // R6
  spatialResolution: number,
  temporalBucketSeconds: number,
  maxConeCells: number
}
```

---

*End of R5 + R6 Amendment*
