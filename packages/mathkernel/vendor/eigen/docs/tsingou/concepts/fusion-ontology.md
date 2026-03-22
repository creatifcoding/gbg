# Fusion Ontology: Determining What to Fuse

```
Document:   TSGC-001 — Fusion Ontology Design
Status:     DRAFT
Created:    2026-02-19
Context:    Tsingou SIGINT Visualization Platform
Depends:    RFC-002 (TSG.4 Data Fusion Mathematics, TSG.8 BaseSignal Schema)
```

> **Core question**: Given N input signal collections with M distinct identifier
> namespaces, which (collection_i, collection_j) pairs are fusion candidates,
> and through what join path?

---

## 1. The Collection Pairing Problem

Before any d2ts `.join()` operator fires, the system must answer a prior question:
**which streams are even about the same kind of thing?**

An ICAO hex code (ADS-B aircraft transponder) and an MMSI number (AIS maritime
vessel) share zero identifier overlap. They're not even the same entity class.
There is no foreign key. So who decides "these two collections should be joined,"
and on what basis?

This document defines the **Fusion Ontology** — the declarative layer between
"raw signals arrive" and "d2ts joins fire." It encodes domain knowledge about
what observes what, what can be correlated with what, and at what confidence.

---

## 2. Entity Classes

Entity classes define the kinds of things that exist in the operational world.
Each class has a primary identifier namespace and a set of signal kinds that
can observe it.

| Entity Class   | Identifier Namespace | Observable By                        |
|----------------|----------------------|--------------------------------------|
| Aircraft       | ICAO hex             | ADS-B, RF bearing, radar, OSINT      |
| Vessel         | MMSI                 | AIS, RF bearing, radar, OSINT        |
| Ground Vehicle | License plate        | ANPR, RF bearing, OSINT              |
| RF Emitter     | freq + location      | SDR, DF array                        |
| Network Host   | IP address           | HTTP, DNS, NetFlow, NATS telemetry   |
| Domain         | FQDN                 | DNS, HTTP, TLS cert, WHOIS           |
| Person         | Name / handle        | OSINT, HUMINT                        |
| Organization   | Name / LEI           | OSINT, STIX identity, corporate DB   |
| Campaign       | STIX ID              | CTI feeds, OSINT                     |
| Facility       | Geo + name           | Imagery, OSINT, SIGINT               |

**The "Observable By" column is critical.** It determines which signal kinds can
produce observations of which entity class, and therefore which collection pairs
are structurally valid for fusion.

### 2.1 Cross-Class Observation

Some signal kinds observe multiple entity classes:

- **RF bearing** observes Aircraft, Vessel, Ground Vehicle, and RF Emitter — because
  direction finding detects emissions without knowing what's transmitting
- **OSINT** can mention any entity class — text extraction determines which
- **Radar** observes physical objects without discriminating type until classification

This means RF bearing collections are valid join candidates with MANY other
collections, while ADS-B is only valid against other Aircraft-class observations.

---

## 3. Fusion Tiers

Not all fusion is created equal. Three tiers exist, distinguished by confidence
semantics and computational cost.

### 3.1 Tier 1: Hard Keys (Deterministic Identity)

Two signals share an identifier from the same namespace. Confidence is 1.0.

```
Signal A (ADS-B):  ICAO = A4F2B7
Signal B (FAA DB): ICAO = A4F2B7  ->  tail number N12345, operator: Delta

d2ts: Collection.join(adsb, faaRegistry, (a, b) => a.icao === b.icao)
```

Hard keys exist when:
- **Shared identifier** — ICAO hex, MMSI, IP address, domain name, STIX ID, MAC address
- **Lookup table resolution** — ICAO -> tail number, MMSI -> vessel name, IP -> ASN
- **Protocol-level binding** — WebSocket connection ID ties multiple messages together

Properties:
- Confidence: **1.0** (no ambiguity)
- Latency: **<1ms** per join
- False positive rate: **0** (barring spoofing)

### 3.2 Tier 2: Soft Keys (Probabilistic Correlation)

No shared identifier exists, but observable properties suggest correlation.
Confidence is computed from a weighted predicate stack.

```
Signal A (ADS-B):  pos = (33.748, -84.388), alt = 0ft, time = T1
Signal B (AIS):    pos = (33.751, -84.391), sog = 0kn, time = T2

No identity path. But:
  - Both at ground/sea level
  - 380m apart (within harbor/airfield co-location radius)
  - Temporally concurrent

This is SPATIAL COINCIDENCE, not identity.
```

Properties:
- Confidence: **0.0-0.99** (never 1.0 — always probabilistic)
- Latency: **<10ms** per join
- False positive rate: **domain-dependent** (tunable via thresholds)

#### 3.2.1 Predicate Stack

Each predicate contributes a score. Combined confidence determines fusion:

**Spatial Proximity**

```
haversine(A.geo, B.geo) < radius

Radius varies by signal pair:
  ADS-B + AIS:     500m    (GPS accuracy bounds)
  RF bearing + any: 2km    (DF angular uncertainty)
  OSINT + OSINT:   10km    (geo-tag imprecision)
  WiFi + Bluetooth: 50m    (short-range RF)

Score: 1.0 - (distance / max_radius)
```

**Temporal Proximity**

```
|A.timestamp - B.timestamp| < window

Window varies by update rate:
  ADS-B:       30s     (updates ~1/sec)
  AIS:         180s    (updates ~1/3min)
  RF bearing:  10s     (sweep rate)
  RSS/OSINT:   3600s   (publication lag)

Score: 1.0 - (|dt| / max_window)
```

**Spectral Proximity**

```
|A.frequency - B.frequency| < band_tolerance
A.modulation in compatible_set(B.modulation)

Score: exact_match ? 1.0 : band_overlap_ratio
```

**Behavioral Similarity**

```
Velocity vector correlation:
  cos_sim(A.velocity, B.velocity) > 0.8

Maneuver pattern matching:
  DTW(A.track_history, B.track_history) < threshold

Score: weighted cosine + DTW similarity
```

**Semantic Overlap** (OSINT signals)

```
Named entity extraction -> entity set per signal
Jaccard(A.entities, B.entities) > threshold

"Both mention 192.168.1.105 and APT-29"

Score: Jaccard coefficient
```

#### 3.2.2 Confidence Combination

```
C = SUM(w_i * score_i) / SUM(w_i)

Default weights:
  w_spatial    = 0.35
  w_temporal   = 0.25
  w_spectral   = 0.20
  w_behavioral = 0.15
  w_semantic   = 0.05

FUSE when C > fusion_threshold (default: 0.65)
```

Weights are operator-configurable per scenario. A maritime domain may weight
spatial higher; a cyber domain may weight semantic higher.

### 3.3 Tier 3: Derived Keys (Emergent Correlation)

No proximity, no shared IDs. Statistical patterns reveal hidden correlation.

```
Signal A: HTTP beacon every 300s to 185.220.101.x
Signal B: DNS query spike every 300s from internal host
Signal C: RSS threat intel post mentions 185.220.101.x as C2

None share a location. None share a timestamp within seconds.
But the PERIODICITY matches, the IP overlaps between A and C,
and B's timing correlates with A's.
```

Derived keys emerge from:
- **Periodicity detection** — matching cadence via spectral analysis on inter-arrival times
- **Co-occurrence mining** — entities that reliably appear together across independent sources
- **Graph community detection** — Louvain clustering on STIX relationship graph
- **Anomaly coincidence** — independent sensors flag anomalies in overlapping time windows

Properties:
- Confidence: **variable** (requires human validation)
- Latency: **seconds to minutes** (batch statistical analysis)
- False positive rate: **high** (operator must validate)

---

## 4. Identity Resolution: Bridging Namespaces

When two signals use different identifier systems, three resolution patterns apply:

### 4.1 Direct Bridge (Lookup Table Exists)

```
ICAO hex --> FAA Registry --> tail number --> operator
MMSI     --> ITU Registry --> vessel name --> operator

These converge at "operator" but that's a WEAK join key.
Delta operates 900 aircraft. Useful for enrichment, not entity fusion.
```

### 4.2 Indirect Bridge (Observable Properties Only)

```
ADS-B:  ICAO A4F2B7,  pos = (33.748, -84.388), alt = 0ft
AIS:    MMSI 21190xxx, pos = (33.751, -84.391), sog = 0kn

No identity path. Spatial coincidence only.
The system claims "co-located and temporally correlated."
The OPERATOR decides what that means.
```

### 4.3 No Bridge (Incompatible Worlds)

```
ADS-B:  ICAO A4F2B7, pos = Atlanta
HTTP:   src_ip = 185.220.101.34, payload = malware config

Entity classes (Aircraft, Network Host) have no meaningful
fusion path. The ontology says: DO NOT JOIN.
```

---

## 5. The Identifier Mismatch Problem

Three distinct scenarios when identifiers don't match cleanly:

### 5.1 Different Entity Classes (Expected Mismatch)

Aircraft (ICAO) near vessel (MMSI). Different things. Spatial co-location
is interesting but not identity fusion.

```
Output: CorrelatedPair {
  aircraft: ...,
  vessel: ...,
  relationship: "co-located",
  confidence: 0.72
}

NOT: FusedEntity { ... }
```

The ontology distinguishes CORRELATION from MERGE. A correlation links two
entities without claiming they are the same. A merge asserts identity.

### 5.2 Same Entity Class, Different ID Systems

Two radar systems, each assigning their own track number to the same aircraft.
Track #447 on radar A = track #1203 on radar B. No shared ID.

This requires **track association** — classic multi-target tracking:
- Global nearest neighbor (GNN) — assign to closest match
- Joint probabilistic data association (JPDA) — weighted across all candidates
- Multiple hypothesis tracking (MHT) — maintain parallel hypotheses

d2ts handles this as a windowed spatial join with a state accumulator that
maintains track continuity across update cycles.

### 5.3 Identifiers SHOULD Match But Don't (Dirty Data)

AIS says MMSI 211900000. Intelligence database says this vessel's MMSI
is 211900001. Typo? Spoofing? Equipment swap?

The identity resolver needs:
- **Fuzzy matching** — Levenshtein on string IDs, +/-1 on numeric IDs
- **Known alias tables** — vessel changed MMSI after reflagging
- **Spoofing detection** — claimed MMSI doesn't match signal characteristics

```
Output: {
  match_type: "fuzzy_identity",
  confidence: 0.92,
  discrepancy: {
    field: "mmsi",
    expected: 211900001,
    observed: 211900000
  },
  assessment: "probable_typo" | "possible_spoofing" | "known_alias"
}
```

The system MUST flag discrepancies, not silently resolve them.

---

## 6. The Join Path Registry

A declarative configuration that tells d2ts which collection pairs are valid
and what predicates govern each join.

### 6.1 Example: Airfield/Harbor Monitoring Scenario

```
PAIR 1: ADS-B x ADS-B (same-class, identity join)
  Left key:   payload.icao
  Right key:  payload.icao
  Join type:  identity
  Purpose:    Dedup/merge multiple ADS-B receivers
  Confidence: 1.0

PAIR 2: ADS-B x FAA Registry (enrichment join)
  Left key:   payload.icao
  Right key:  icao_hex
  Join type:  identity
  Resolver:   faa-registry-lookup
  Purpose:    Enrich with tail number, operator, aircraft type
  Confidence: 1.0

PAIR 3: ADS-B x AIS (cross-class, spatial join)
  Left key:   metadata.geo
  Right key:  metadata.geo
  Join type:  spatial + temporal
  Resolver:   NONE (no identity bridge)
  Predicates:
    - haversine < 500m
    - |dt| < 60s
    - left.alt < 100ft (must be near surface)
  Purpose:    Detect air-maritime co-location
  Confidence: f(distance, dt) -- NEVER 1.0
  Note:       "co-located" != "same entity"

PAIR 4: ADS-B x RF Bearing (cross-class, spatial+spectral)
  Left key:   metadata.geo
  Right key:  bearing_cone(origin, azimuth, beamwidth)
  Join type:  spatial + spectral
  Predicates:
    - point_in_cone(left.geo, right.bearing) = true
    - |right.freq - 1090MHz| < 1MHz (ADS-B band)
  Purpose:    Correlate decoded ADS-B with raw RF observation
  Confidence: f(angular_error, freq_match)

PAIR 5: AIS x RF Bearing (cross-class, spatial+spectral)
  Left key:   metadata.geo
  Right key:  bearing_cone(origin, azimuth, beamwidth)
  Join type:  spatial + spectral
  Predicates:
    - point_in_cone(left.geo, right.bearing) = true
    - |right.freq - 162MHz| < 1MHz (AIS band)
  Confidence: f(angular_error, freq_match)

PAIR 6: HTTP x DNS (same-class, identity join)
  Left key:   payload.host
  Right key:  payload.query_name
  Join type:  identity (FQDN match)
  Purpose:    Correlate HTTP connections with DNS resolutions
  Confidence: 1.0

PAIR 7: HTTP x OSINT/RSS (cross-class, semantic join)
  Left key:   payload.indicators[] (extracted IOCs)
  Right key:  payload.indicators[] (extracted IOCs)
  Join type:  semantic
  Predicates:
    - Jaccard(left.indicators, right.indicators) > 0.3
  Purpose:    Match observed network activity to threat intel
  Confidence: f(jaccard, source_reliability)

PAIR 8: * x * (DISABLED by default -- Tier 3 statistical)
  Join type:  behavioral (periodicity correlation)
  Purpose:    Discover hidden correlations
  Warning:    Expensive. High false positive rate. Operator-activated.
```

### 6.2 Schema Representation

```typescript
const JoinPathEntry = Schema.Struct({
  id:          Schema.String,
  left:        Schema.Struct({
    signalKind:  Schema.String,
    keyPath:     Schema.String,
  }),
  right:       Schema.Struct({
    signalKind:  Schema.String,
    keyPath:     Schema.String,
  }),
  joinType:    Schema.Literal(
    "identity", "spatial", "temporal",
    "spectral", "semantic", "behavioral"
  ),
  resolver:    Schema.optional(Schema.String),
  predicates:  Schema.Array(PredicateConfig),
  outputType:  Schema.Literal("merge", "correlate", "enrich"),
  enabled:     Schema.Boolean,
  tier:        Schema.Literal(1, 2, 3),
})

const FusionOntology = Schema.Struct({
  version:       Schema.String,
  scenario:      Schema.String,
  entityClasses: Schema.Array(EntityClassDef),
  joinPaths:     Schema.Array(JoinPathEntry),
  resolvers:     Schema.Array(IdentityResolverDef),
  thresholds:    Schema.Struct({
    fusionConfidence: Schema.Number,  // default 0.65
    spatialWeightDefault: Schema.Number,
    temporalWeightDefault: Schema.Number,
    spectralWeightDefault: Schema.Number,
    behavioralWeightDefault: Schema.Number,
    semanticWeightDefault: Schema.Number,
  }),
})
```

---

## 7. d2ts Compilation

The fusion ontology compiles to a d2ts dataflow graph:

```
                    +---------------------+
                    |   Signal Ingest     |
                    |   (all adapters)    |
                    +----------+----------+
                               |
                    +----------v----------+
                    |    CLASSIFY          |
                    |                      |
                    |  Route by kind:      |
                    |  sdr -> RF pipeline  |
                    |  http -> net pipeline|
                    |  rss -> osint pipe   |
                    +----------+----------+
                               |
              +----------------+----------------+
              v                v                v
     +--------+---+   +-------+----+   +-------+--------+
     | TIER 1     |   | TIER 2     |   | TIER 3         |
     | Hard Join  |   | Soft Join  |   | Derived        |
     |            |   |            |   |                 |
     | .join() on |   | .join() on |   | .reduce() ->   |
     | identity   |   | H3 cell +  |   | statistics ->  |
     | key        |   | time window|   | .join() on     |
     |            |   | + predicate|   | discovered     |
     | C = 1.0    |   | C = f(wt)  |   | correlation    |
     | <1ms       |   | <10ms      |   | secs-mins      |
     +-----+------+   +-----+------+   +-------+--------+
           |                |                   |
           +----------------+-------------------+
                            v
                   +--------+--------+
                   |  FUSED DATUM    |
                   |                 |
                   |  contributing:  |
                   |    [A, B, C]    |
                   |  confidence:    |
                   |    0.85         |
                   |  tier: "soft"   |
                   |  predicates:    |
                   |    [spatial,    |
                   |     temporal,   |
                   |     spectral]   |
                   +-----------------+
```

Each enabled JoinPathEntry in the ontology becomes a d2ts operator in the graph.
Disabling a path removes the operator; d2ts recomputes incrementally.

---

## 8. Operator Interface

The fusion ontology is not code — it's configuration. The operator interacts
with it through the DOM control layer (z:3):

- **Predicate toggles** — enable/disable specific join paths
- **Threshold sliders** — tune spatial radius, time window, confidence floor
- **Weight adjustment** — redistribute predicate weights per scenario
- **Tier 3 activation** — explicitly enable statistical correlation mining
- **Discrepancy review** — inspect flagged identifier mismatches
- **Rule versioning** — save/load/share ontology configurations

The ontology itself is a NATS signal:
`tsingou.config.fusion.ontology` — versioned, auditable, diffable.

---

## 9. Confidence Semantics

The system MUST distinguish between:

| Output Type | Meaning | Confidence Semantics |
|-------------|---------|----------------------|
| **Merge** | Two signals describe the same entity | C = 1.0 (identity) or C > 0.9 (high-confidence soft) |
| **Correlate** | Two signals are related but distinct | C = 0.65-0.89 (spatial/temporal/semantic proximity) |
| **Enrich** | One signal adds context to another | C = 1.0 (lookup) or variable (external source reliability) |
| **Flag** | Identifier mismatch detected | C = discrepancy severity score |

A correlation is NOT a merge. Displaying a co-located aircraft and vessel as
"the same thing" is an intelligence failure. The visualization must reflect
the distinction: merged entities share a node; correlated entities share an edge.

---

## 10. Research Initiatives

The following areas require deeper investigation to fully realize the fusion
ontology:

### RI-1: Multi-Target Tracking Algorithms for d2ts

How do classic tracking algorithms (GNN, JPDA, MHT) map to d2ts differential
dataflow operators? Can track association be expressed as a join with state
accumulation, or does it require a custom operator?

### RI-2: Fuzzy Identity Resolution at Scale

What are the performance characteristics of Levenshtein matching, phonetic
encoding (Soundex/Metaphone), and embedding-based similarity when applied to
streaming signals at 10k+ signals/second? How does this integrate with d2ts
incremental computation?

### RI-3: Ontology Compilation to d2ts Graph

Formal specification of how a declarative FusionOntology schema compiles to a
d2ts dataflow graph. What optimizations are possible (predicate pushdown,
join reordering, common subexpression elimination)?

### RI-4: Confidence Calibration and Bayesian Updating

How should confidence scores be calibrated? When a Tier 2 soft join produces
C = 0.72, what does that MEAN operationally? Can we use Bayesian updating to
refine confidence as more signals arrive?

### RI-5: Geospatial Indexing for Spatial Joins

H3 hexagonal indexing for spatial join key generation. What resolution
provides optimal precision/recall for different signal pair types? How do
bearing cones map to H3 cell sets?

### RI-6: STIX Relationship Generation from Fusion Events

When the fusion engine produces a correlation or merge, how does that map to
STIX 2.1 SROs? Automatic `relationship` object generation with provenance
chain linking back to contributing signals.

### RI-7: Spoofing and Deception Detection

Identifier mismatches can indicate adversarial behavior (AIS spoofing, GPS
jamming, beacon cloning). What heuristics distinguish equipment error from
deliberate deception? How does this feed back into confidence scoring?

### RI-8: Operator Cognitive Load

How many simultaneous join paths can an operator meaningfully monitor and tune?
What visualization patterns reduce cognitive load for multi-tier fusion
dashboards?

---

## 11. References

- [JDL] Joint Directors of Laboratories. "Data Fusion Lexicon." 1991.
- [DASARATHY] Dasarathy, B.V. "Decision Fusion." IEEE Computer Society, 1994.
- [DS] Shafer, G. "A Mathematical Theory of Evidence." Princeton, 1976.
- [MHT] Reid, D. "An Algorithm for Tracking Multiple Targets." IEEE TAC, 1979.
- [JPDA] Bar-Shalom, Y. "Tracking and Data Association." Academic Press, 1988.
- [H3] Uber Technologies. "H3: Hexagonal Hierarchical Geospatial Indexing." 2018.
- [D2TS] @electric-sql/d2ts. "Differential Dataflow in TypeScript." 2024.
- [STIX] OASIS. "STIX Version 2.1." 2021.
- [RFC-002] Tsingou RFC-002, Sections TSG.4, TSG.8, TSG.26, TSG.28.

---

*End of TSGC-001*
