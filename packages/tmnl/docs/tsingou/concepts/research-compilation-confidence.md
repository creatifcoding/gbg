# Research: Ontology Compilation & Confidence Calibration

```
Document:   TSGC-003 — Compilation & Confidence Research
Status:     DRAFT
Created:    2026-02-19
Context:    Tsingou SIGINT Visualization Platform
Depends:    TSGC-001 (Fusion Ontology), RFC-002 (TSG.4 Data Fusion Mathematics)
Covers:     RI-3 (Ontology Compilation to d2ts Graph)
            RI-4 (Confidence Calibration and Bayesian Updating)
```

> **Thesis**: A declarative fusion ontology is only as useful as the compiler that
> translates it into executable dataflow operators AND the confidence engine that
> assigns meaning to the numbers those operators produce. This document formalizes
> both: the compilation algebra that maps ontology rules to d2ts graph topology,
> and the Bayesian/evidential framework that gives confidence scores operational
> semantics.

---

## Part I: Ontology Compilation to d2ts Graph (RI-3)

### 1. The Compilation Problem

The Fusion Ontology (TSGC-001) defines a declarative schema: entity classes, join
paths, predicates, thresholds, and output types. The compilation problem is the
translation of this static schema into a live d2ts differential dataflow graph
that processes streaming signal collections in real time.

This is not a novel problem. Every streaming SQL engine solves a variant of it:

| System | Input Language | Compilation Target | Key Technique |
|--------|---------------|-------------------|---------------|
| Apache Flink | SQL / Table API | JobGraph (DAG of operators) | Logical plan -> physical plan -> operator chaining |
| Materialize | SQL | Differential dataflow operators | HIR -> MIR -> LIR -> DD arrangement |
| Kafka Streams | Java DSL / ksqlDB | Topology (processor graph) | Topology builder pattern |
| RisingWave | SQL | Streaming actors | Plan fragmentation + exchange operators |
| **Tsingou** | FusionOntology schema | **d2ts graph** | **Ontology compiler** |

What distinguishes our compilation problem:

1. **The input is not SQL.** It is a typed Effect Schema object (FusionOntology)
   with domain-specific semantics (entity classes, fusion tiers, confidence
   functions).
2. **The graph is dynamically modifiable.** Operators can be enabled/disabled at
   runtime by the operator without full graph reconstruction.
3. **Confidence is a first-class output.** Every operator must propagate or compute
   confidence scores, not just data transformations.
4. **The output is heterogeneous.** Different join paths produce different output
   types (Merge, Correlate, Enrich, Flag).

---

### 2. Compilation Pipeline Architecture

The compiler proceeds through four intermediate representations (IRs), each
progressively lower-level, mirroring the Materialize compilation pipeline
(SQL -> HIR -> MIR -> LIR -> DD) but adapted for ontology semantics.

```
FusionOntology (Effect Schema)
        |
        v
  +------------------+
  | STAGE 1: PARSE   |
  | Validate schema  |
  | Resolve refs     |
  | Type-check joins |
  +--------+---------+
           |
           v
  +------------------+
  | STAGE 2: LOGICAL |
  | Logical Dataflow |
  | Plan (LDP)       |
  | Abstract ops     |
  +--------+---------+
           |
           v
  +------------------+
  | STAGE 3: OPTIMIZE|
  | Predicate pushdn |
  | Join reordering  |
  | CSE elimination  |
  | Operator fusion  |
  +--------+---------+
           |
           v
  +------------------+
  | STAGE 4: EMIT    |
  | Physical d2ts    |
  | graph code       |
  | Instantiate ops  |
  +------------------+
```

---

### 3. Stage 1: Parse and Validate

#### 3.1 Schema Validation

The ontology arrives as an Effect Schema-encoded JSON document. Stage 1 validates
structural integrity using `Schema.decodeSync`:

```typescript
import { Schema } from "effect"

const CompilationInput = Schema.Struct({
  ontology: FusionOntology,
  signalSources: Schema.Array(SignalSourceDef),
  runtimeConfig: Schema.optional(RuntimeConfig),
})

// Validation effect
const parseOntology = (raw: unknown) =>
  Effect.gen(function* () {
    const input = yield* Schema.decodeUnknown(CompilationInput)(raw)
    yield* validateJoinPathRefs(input.ontology)
    yield* validateEntityClassRefs(input.ontology)
    yield* validatePredicateCompat(input.ontology)
    return input
  })
```

#### 3.2 Reference Resolution

Join paths reference entity classes, signal kinds, and resolvers by name. The
parser resolves these references into direct pointers, catching dangling refs
early:

```
VALIDATION RULES:

1. ENTITY_CLASS_EXISTS:
   For every JoinPathEntry:
     left.signalKind MUST be "Observable By" for some EntityClass
     right.signalKind MUST be "Observable By" for some EntityClass

2. JOIN_KEY_TYPE_COMPAT:
   For identity joins: left.keyPath type MUST equal right.keyPath type
   For spatial joins: both keyPaths MUST resolve to GeoCoordinate
   For spectral joins: both keyPaths MUST resolve to FrequencyRange

3. PREDICATE_COMPAT:
   For spatial predicates: haversine requires two GeoCoordinate inputs
   For temporal predicates: |dt| requires two Timestamp inputs
   For spectral predicates: freq_match requires two Frequency inputs

4. RESOLVER_EXISTS:
   If join.resolver is specified, it MUST reference a defined resolver

5. CIRCULAR_DEPENDENCY:
   No join path may transitively depend on its own output
```

#### 3.3 Error Reporting

Compilation errors are structured as Effect Schema-validated diagnostics:

```typescript
const CompilationDiagnostic = Schema.TaggedStruct("CompilationDiagnostic", {
  severity: Schema.Literal("error", "warning", "info"),
  stage: Schema.Literal("parse", "logical", "optimize", "emit"),
  code: Schema.String,
  message: Schema.String,
  location: Schema.optional(Schema.Struct({
    joinPathId: Schema.optional(Schema.String),
    predicateIndex: Schema.optional(Schema.Number),
    entityClass: Schema.optional(Schema.String),
  })),
})

// Example errors:
// { severity: "error", code: "E001", message: "Join path 'adsb-ais-spatial'
//   references signal kind 'magnetic' not observable by any entity class" }
// { severity: "warning", code: "W003", message: "Join path 'http-dns-identity'
//   has no temporal predicate; joins will not be time-bounded" }
// { severity: "error", code: "E004", message: "Spatial predicate on join
//   'rf-ais' requires GeoCoordinate but right.keyPath resolves to String" }
```

---

### 4. Stage 2: Logical Dataflow Plan (LDP)

The validated ontology compiles into a Logical Dataflow Plan: a DAG of abstract
operators that captures the computation structure without committing to physical
implementation details.

#### 4.1 The Compilation Algebra

We define an algebra over ontology elements that maps declaratively to dataflow
operators. Let **O** be the set of ontology rules (join paths) and **G** be the
set of d2ts graph operators.

**Definition 4.1** (Signal Collection). A signal collection **S_k** is the
stream of BaseSignal records arriving from signal kind **k**. In d2ts terms,
this is an input stream `graph.newInput<[key, BaseSignal]>()`.

**Definition 4.2** (Classify Operator). The classify operator routes incoming
signals to per-kind streams based on the `signalKind` discriminant:

```
CLASSIFY: S_all -> { S_adsb, S_ais, S_rf, S_http, S_dns, S_rss, ... }

Implementation: S_all.pipe(filter(s => s.signalKind === k))  for each kind k
```

In practice, because d2ts is pull-based differential dataflow, we model this
as separate input streams per signal kind rather than a single stream with
a router. The classify stage is therefore a *logical* operation that determines
which input streams exist.

**Definition 4.3** (Key Extraction). For a join path **P** with left key path
**l** and right key path **r**, key extraction projects the join key:

```
KEY_LEFT(P):  S_left.pipe(map(s => [extractKey(s, P.left.keyPath), s]))
KEY_RIGHT(P): S_right.pipe(map(s => [extractKey(s, P.right.keyPath), s]))
```

This produces keyed MultiSets `[K, BaseSignal][]` suitable for d2ts join.

**Definition 4.4** (Join Operator). Each join path compiles to a d2ts join:

```
For Tier 1 (identity):
  JOIN_IDENTITY(P): KEY_LEFT(P).pipe(join(KEY_RIGHT(P), 'inner'))

For Tier 2 (soft):
  JOIN_SOFT(P): KEY_LEFT(P).pipe(
    join(KEY_RIGHT(P), 'inner'),
    filter(([k, [left, right]]) => evaluatePredicates(P.predicates, left, right)),
    map(([k, [left, right]]) => computeConfidence(P, left, right))
  )

For Tier 3 (derived):
  JOIN_DERIVED(P): S_left.pipe(
    reduce(statisticalAccumulator(P)),
    join(S_right.pipe(reduce(statisticalAccumulator(P))), 'inner'),
    filter(([k, [lstats, rstats]]) => correlationTest(lstats, rstats))
  )
```

**Definition 4.5** (Predicate Filter). For a soft join, predicates compose
conjunctively. Each predicate is a function `(left: BaseSignal, right: BaseSignal) -> boolean`:

```
PREDICATE_STACK(P): AND(
  pred_spatial(P.predicates[0]),
  pred_temporal(P.predicates[1]),
  ...
  pred_n(P.predicates[n])
)
```

The key insight: predicates are **pushed down** into the join operator rather
than applied as a post-join filter. This is the differential dataflow equivalent
of predicate pushdown in SQL optimization.

**Definition 4.6** (Confidence Annotation). Every join output carries a
confidence score computed by the confidence function for that tier:

```
ANNOTATE(P, left, right):
  Tier 1: { confidence: 1.0, tier: "hard" }
  Tier 2: { confidence: C(P.weights, scores(P.predicates, left, right)), tier: "soft" }
  Tier 3: { confidence: C_stat(correlation_strength), tier: "derived" }
```

**Definition 4.7** (Output Classification). The final operator classifies the
fused output by type:

```
OUTPUT(P, fused):
  if P.outputType === "merge":     emit FusedEntity(fused)
  if P.outputType === "correlate": emit CorrelatedPair(fused)
  if P.outputType === "enrich":    emit EnrichedSignal(fused)
```

#### 4.2 Logical Plan DAG

The full logical plan is a DAG composed from these primitives:

```
LDP = UNION(
  for each enabled JoinPath P in Ontology.joinPaths:
    OUTPUT(P,
      ANNOTATE(P,
        JOIN_{P.tier}(P,
          KEY_LEFT(P, CLASSIFY(S_all, P.left.signalKind)),
          KEY_RIGHT(P, CLASSIFY(S_all, P.right.signalKind))
        )
      )
    )
)
```

In set-builder notation:

```
G_logical = { OUTPUT_P(ANNOTATE_P(JOIN_P(KEY_L(S_l), KEY_R(S_r)))) | P in O, P.enabled = true }
```

#### 4.3 Formal Properties

**Theorem 4.1** (Monotonic Compilation). Adding a join path to the ontology
adds operators to the graph without modifying existing operators. Removing a
join path removes operators without side effects on remaining paths.

*Proof sketch*: Each join path compiles to an independent subgraph rooted at its
own KEY_LEFT and KEY_RIGHT operators. Subgraphs share input streams (the CLASSIFY
outputs) but do not share state. Therefore, addition and removal are monotonic
operations on the graph topology. QED.

**Theorem 4.2** (Incremental Correctness). If the d2ts runtime correctly
maintains differential state for each operator, then enabling/disabling a join
path at runtime produces results equivalent to recompiling from scratch with the
modified ontology.

*Proof sketch*: By the fundamental property of differential dataflow, removing an
operator is equivalent to negating all its outputs and propagating the deltas.
The system converges to the state that would result from never having included
the operator. QED.

---

### 5. Stage 3: Optimization

The logical plan undergoes four optimization passes, each producing a
semantically equivalent but more efficient plan.

#### 5.1 Predicate Pushdown

**Problem**: A naive compilation places all predicates after the join. For
spatial joins, this means computing the full cross-product of signals within a
time window, then filtering by distance.

**Optimization**: Push spatial predicates into the join key computation. Instead
of joining on raw coordinates, join on discretized spatial cells (H3 hexagons):

```
BEFORE:
  KEY_LEFT:  S_adsb.pipe(map(s => [s.id, s]))      // key is signal ID
  KEY_RIGHT: S_ais.pipe(map(s => [s.id, s]))        // key is signal ID
  JOIN:      cross-product within time window
  FILTER:    haversine(left.geo, right.geo) < 500m   // applied AFTER join

AFTER (predicate pushdown):
  KEY_LEFT:  S_adsb.pipe(map(s => [h3.latLngToCell(s.geo, 8), s]))  // key is H3 cell
  KEY_RIGHT: S_ais.pipe(map(s => [h3.latLngToCell(s.geo, 8), s]))   // key is H3 cell
  JOIN:      equijoin on H3 cell (orders of magnitude fewer comparisons)
  FILTER:    haversine(left.geo, right.geo) < 500m   // still needed for cell-edge cases
```

The H3 resolution is chosen to be larger than the spatial predicate radius,
ensuring no valid pairs are missed. This is analogous to SQL hash join with
a computed partition key.

**Savings**: For N left signals and M right signals, naive cross-product is
O(N*M). With H3 cell-based join, it becomes O(N * avg_signals_per_cell) where
avg_signals_per_cell << M.

#### 5.2 Join Reordering

**Problem**: When multiple join paths share input streams, the order of joins
affects intermediate result sizes and therefore memory consumption.

**Optimization**: Apply a cost model based on estimated cardinality:

```
COST MODEL:

For each JoinPath P:
  selectivity(P) = estimated_output_rows / (left_rows * right_rows)

Join Ordering Heuristic:
  1. Execute Tier 1 (identity) joins FIRST — selectivity ~= 1/N
  2. Use Tier 1 outputs to filter Tier 2 inputs
  3. Execute Tier 2 joins in order of INCREASING spatial radius
  4. Execute Tier 3 joins LAST (batch statistical analysis)

Rationale:
  - Identity joins are cheap and reduce cardinality
  - Narrower spatial joins produce fewer false positives
  - Statistical joins are expensive; minimize their input
```

**Example**: Consider a scenario with three join paths:

```
P1: ADS-B x FAA Registry  (identity, selectivity = 1/50000)
P2: ADS-B x AIS           (spatial 500m, selectivity = 1/10000)
P3: ADS-B x RF bearing    (spatial 2km, selectivity = 1/1000)

Optimal order: P1, then P2, then P3
  - P1 enriches ADS-B with tail numbers (fast, reduces ambiguity)
  - P2 spatial join at 500m (tight radius, few candidates)
  - P3 spatial join at 2km (wide radius, many candidates)
```

In d2ts, join reordering is achieved by controlling the order of `pipe(join(...))`
calls and by sharing intermediate results via stream references.

#### 5.3 Common Subexpression Elimination (CSE)

**Problem**: Multiple join paths may extract the same key from the same input
stream. For example, three different join paths may all need ADS-B signals keyed
by H3 cell at resolution 8.

**Optimization**: Identify duplicate key extraction operations and share a single
computed stream:

```
BEFORE:
  P_adsb_ais:  S_adsb.pipe(map(s => [h3Cell(s.geo, 8), s]))    // computed
  P_adsb_rf:   S_adsb.pipe(map(s => [h3Cell(s.geo, 8), s]))    // DUPLICATE
  P_adsb_faa:  S_adsb.pipe(map(s => [s.icao, s]))              // different key

AFTER (CSE):
  shared_adsb_h3 = S_adsb.pipe(map(s => [h3Cell(s.geo, 8), s]))  // computed ONCE
  P_adsb_ais:    shared_adsb_h3.pipe(join(...))
  P_adsb_rf:     shared_adsb_h3.pipe(join(...))
  P_adsb_faa:    S_adsb.pipe(map(s => [s.icao, s]), join(...))   // different key, no share
```

This mirrors Apache DataFusion's common subexpression elimination, which
"optimizes queries that refer to a complex expression multiple times by
calculating its result once and reusing that result when it is encountered again."

**Detection Algorithm**:

```
CSE_DETECT(logical_plan):
  key_extractions = {}
  for each JoinPath P in logical_plan:
    left_sig  = hash(P.left.signalKind, P.left.keyPath, spatial_resolution(P))
    right_sig = hash(P.right.signalKind, P.right.keyPath, spatial_resolution(P))
    key_extractions[left_sig].push(P)
    key_extractions[right_sig].push(P)

  for each sig in key_extractions where len(key_extractions[sig]) > 1:
    SHARE(key_extractions[sig])  // Create single extraction, reference from all paths
```

#### 5.4 Operator Fusion

**Problem**: Adjacent linear operators (map, filter, map) in a pipeline
produce intermediate MultiSets that consume memory and CPU.

**Optimization**: Fuse adjacent linear operators into a single compound operator.
As Materialize demonstrates, linear operators satisfy `OP(x + y) = OP(x) + OP(y)`,
meaning they can be applied record-by-record and combined without materializing
intermediate results.

```
BEFORE:
  stream.pipe(
    map(s => [h3Cell(s.geo, 8), s]),           // O1: key extraction
    filter(([k, s]) => s.altitude < 100),       // O2: altitude filter
    map(([k, s]) => [k, { ...s, tier: 2 }]),   // O3: tier annotation
  )

AFTER (fusion):
  stream.pipe(
    map(s => {                                   // SINGLE fused operator
      if (s.altitude >= 100) return null         // filter embedded
      const key = h3Cell(s.geo, 8)               // key extraction embedded
      return [key, { ...s, tier: 2 }]            // annotation embedded
    }),
    filter(x => x !== null),                     // null removal (cheap)
  )
```

**Fusion Rules**:

```
FUSIBLE(O1, O2):
  map -> map:      YES  (compose functions)
  map -> filter:   YES  (embed predicate in map)
  filter -> map:   YES  (embed predicate before map)
  filter -> filter: YES (conjoin predicates)
  * -> join:       NO   (join is not linear)
  * -> reduce:     NO   (reduce is not linear)
  join -> map:     YES  (post-join projection)
  join -> filter:  YES  (post-join predicate)
```

The fusion pass is implemented as a peephole optimization over the logical plan,
identifying maximal sequences of fusible operators and replacing them with a
single compound operator.

#### 5.5 Optimization Pass Summary

| Pass | Technique | Savings | Applicability |
|------|-----------|---------|---------------|
| Predicate Pushdown | H3 cell key from spatial pred | O(N*M) -> O(N*k) | Tier 2 spatial joins |
| Join Reordering | Cost-based ordering | Reduce intermediate sizes | Multiple joins on same input |
| CSE | Share duplicate key extractions | Eliminate redundant computation | Multiple joins on same key |
| Operator Fusion | Merge linear operators | Eliminate intermediate MultiSets | Adjacent map/filter chains |

---

### 6. Stage 4: Emit (Physical d2ts Graph)

The optimized plan compiles to concrete d2ts API calls. The emitter walks the
optimized DAG and generates a d2ts graph.

#### 6.1 d2ts Operator Mapping

| Logical Operator | d2ts Operator | Notes |
|-----------------|---------------|-------|
| CLASSIFY | `graph.newInput<T>()` | One input per signal kind |
| KEY_EXTRACT | `input.pipe(map(...))` | Project join key |
| JOIN_IDENTITY | `left.pipe(join(right, 'inner'))` | Exact key match |
| JOIN_SOFT | `left.pipe(join(right, 'inner'), filter(...), map(...))` | With predicate + confidence |
| JOIN_DERIVED | `reduce(...)` then `join(...)` | Statistical accumulation first |
| FILTER | `stream.pipe(filter(...))` | Predicate evaluation |
| ANNOTATE | `stream.pipe(map(...))` | Add confidence metadata |
| OUTPUT | `stream.pipe(output(...))` | Emit to output handler |
| UNION | `stream.pipe(concat(other))` | Merge output streams |
| DISTINCT | `stream.pipe(distinct())` | Dedup identity joins |
| COUNT | `stream.pipe(count())` | Cardinality tracking |
| NEGATE | `stream.pipe(negate())` | For path disablement |

#### 6.2 Graph Construction Code Generation

The emitter produces a d2ts graph construction function:

```typescript
function compileFusionGraph(
  ontology: FusionOntology,
  graph: D2,
): CompiledFusionGraph {
  // Stage 1: Create per-kind input streams
  const inputs = new Map<string, IStreamBuilder<[string, BaseSignal]>>()
  for (const ec of ontology.entityClasses) {
    for (const kind of ec.observableBy) {
      if (!inputs.has(kind)) {
        inputs.set(kind, graph.newInput<[string, BaseSignal]>())
      }
    }
  }

  // Stage 2-3: Compile each enabled join path (after optimization)
  const outputs: IStreamBuilder<FusedDatum>[] = []

  for (const jp of ontology.joinPaths.filter(jp => jp.enabled)) {
    const leftStream = inputs.get(jp.left.signalKind)!
    const rightStream = inputs.get(jp.right.signalKind)!

    const compiled = compileJoinPath(jp, leftStream, rightStream, ontology.thresholds)
    outputs.push(compiled)
  }

  // Stage 4: Merge all outputs
  let merged = outputs[0]
  for (let i = 1; i < outputs.length; i++) {
    merged = merged.pipe(concat(outputs[i]))
  }

  return {
    graph,
    inputs,
    output: merged,
    paths: ontology.joinPaths.filter(jp => jp.enabled).map(jp => jp.id),
  }
}
```

#### 6.3 Individual Join Path Compilation

```typescript
function compileJoinPath(
  jp: JoinPathEntry,
  leftStream: IStreamBuilder<[string, BaseSignal]>,
  rightStream: IStreamBuilder<[string, BaseSignal]>,
  thresholds: FusionThresholds,
): IStreamBuilder<FusedDatum> {
  switch (jp.tier) {
    case 1:
      return compileTier1(jp, leftStream, rightStream)
    case 2:
      return compileTier2(jp, leftStream, rightStream, thresholds)
    case 3:
      return compileTier3(jp, leftStream, rightStream, thresholds)
  }
}

function compileTier1(
  jp: JoinPathEntry,
  left: IStreamBuilder<[string, BaseSignal]>,
  right: IStreamBuilder<[string, BaseSignal]>,
): IStreamBuilder<FusedDatum> {
  // Identity join: re-key by join key, then equijoin
  const keyedLeft = left.pipe(
    map(([_, signal]) => [extractKey(signal, jp.left.keyPath), signal] as [string, BaseSignal])
  )
  const keyedRight = right.pipe(
    map(([_, signal]) => [extractKey(signal, jp.right.keyPath), signal] as [string, BaseSignal])
  )

  return keyedLeft.pipe(
    join(keyedRight, 'inner'),
    map(([key, [leftSig, rightSig]]) => ({
      _tag: "FusedDatum" as const,
      joinPathId: jp.id,
      contributing: [leftSig, rightSig],
      confidence: 1.0,
      tier: "hard" as const,
      outputType: jp.outputType,
      key,
      predicateScores: {},
      timestamp: Math.max(leftSig.timestamp, rightSig.timestamp),
    })),
    distinct(),
  )
}

function compileTier2(
  jp: JoinPathEntry,
  left: IStreamBuilder<[string, BaseSignal]>,
  right: IStreamBuilder<[string, BaseSignal]>,
  thresholds: FusionThresholds,
): IStreamBuilder<FusedDatum> {
  // Soft join: spatial key via H3, then predicate evaluation
  const resolution = selectH3Resolution(jp)

  const keyedLeft = left.pipe(
    map(([_, signal]) => {
      const cell = h3.latLngToCell(signal.geo.lat, signal.geo.lng, resolution)
      return [cell, signal] as [string, BaseSignal]
    })
  )
  const keyedRight = right.pipe(
    map(([_, signal]) => {
      const cell = h3.latLngToCell(signal.geo.lat, signal.geo.lng, resolution)
      return [cell, signal] as [string, BaseSignal]
    })
  )

  return keyedLeft.pipe(
    join(keyedRight, 'inner'),
    // Predicate evaluation (fused map+filter)
    map(([cell, [leftSig, rightSig]]) => {
      const scores = evaluatePredicateStack(jp.predicates, leftSig, rightSig)
      const confidence = computeWeightedConfidence(scores, thresholds)
      if (confidence < thresholds.fusionConfidence) return null
      return {
        _tag: "FusedDatum" as const,
        joinPathId: jp.id,
        contributing: [leftSig, rightSig],
        confidence,
        tier: "soft" as const,
        outputType: jp.outputType,
        key: cell,
        predicateScores: scores,
        timestamp: Math.max(leftSig.timestamp, rightSig.timestamp),
      }
    }),
    filter((x): x is FusedDatum => x !== null),
  )
}
```

---

### 7. Dynamic Graph Modification

A critical requirement: operators can be enabled/disabled at runtime without
reconstructing the entire graph. This leverages the fundamental property of
differential dataflow.

#### 7.1 The Delta Approach

When a join path is disabled, the system does NOT tear down the graph and rebuild
it. Instead, it leverages d2ts's differential semantics:

```
DISABLE(joinPath P):
  1. Stop sending new data to P's input streams
  2. Send NEGATE of all P's current output
     -> This propagates as negative multiplicities through d2ts
     -> Downstream consumers subtract P's contributions
  3. Mark P as disabled in the runtime registry

ENABLE(joinPath P):
  1. Compile P's subgraph (Stage 2-4)
  2. Attach P's inputs to existing signal streams
  3. Send current state of input collections to P
     -> P's join processes the current state
     -> Output propagates as positive multiplicities
  4. Mark P as enabled in the runtime registry
```

This is the key insight from Materialize: "differential dataflow can react
quickly because it only acts where changes in collections occur, and does no
work elsewhere."

#### 7.2 Runtime Operator Registry

```typescript
const OperatorStatus = Schema.Literal("active", "suspended", "compiling", "error")

const RuntimeOperator = Schema.TaggedStruct("RuntimeOperator", {
  joinPathId: Schema.String,
  status: OperatorStatus,
  activatedAt: Schema.optional(Schema.Number),
  suspendedAt: Schema.optional(Schema.Number),
  outputCount: Schema.Number,
  lastOutputAt: Schema.optional(Schema.Number),
  errorMessage: Schema.optional(Schema.String),
})

// The registry is itself an atom
const operatorRegistryAtom = Atom.make<Map<string, RuntimeOperator>>(new Map())
```

#### 7.3 Hot-Swap Protocol

When the operator adjusts thresholds or predicates for an active join path,
a hot-swap occurs:

```
HOT_SWAP(joinPath P, newConfig):
  1. SUSPEND(P)               // Stop processing, hold state
  2. newP = COMPILE(newConfig) // Compile new version
  3. MIGRATE(P -> newP)        // Transfer accumulated state
  4. RESUME(newP)              // Resume with new logic

  Total downtime for path P: ~ms (graph modification) + state migration
  Other paths: UNAFFECTED (monotonic property, Theorem 4.1)
```

---

### 8. Schema Validation at Compile Time

#### 8.1 Type System for Join Keys

The compiler enforces type compatibility for join keys at ontology parse time,
before any d2ts operators are created:

```typescript
const JoinKeyType = Schema.Literal(
  "string",          // Identifiers: ICAO, MMSI, IP, FQDN
  "geo_coordinate",  // Lat/lng pairs for spatial joins
  "frequency",       // Hz values for spectral joins
  "timestamp",       // Unix timestamps for temporal joins
  "embedding",       // Vector embeddings for semantic joins
  "h3_cell",         // Discretized spatial cell
)

const JoinCompatMatrix: Record<string, Set<string>> = {
  "identity":   new Set(["string"]),
  "spatial":    new Set(["geo_coordinate", "h3_cell"]),
  "temporal":   new Set(["timestamp"]),
  "spectral":   new Set(["frequency"]),
  "semantic":   new Set(["embedding", "string"]),
  "behavioral": new Set(["timestamp", "embedding"]),
}

function validateJoinKeyCompat(jp: JoinPathEntry): CompilationDiagnostic[] {
  const errors: CompilationDiagnostic[] = []
  const leftType = resolveKeyType(jp.left.keyPath)
  const rightType = resolveKeyType(jp.right.keyPath)
  const allowed = JoinCompatMatrix[jp.joinType]

  if (!allowed.has(leftType)) {
    errors.push({
      _tag: "CompilationDiagnostic",
      severity: "error",
      stage: "parse",
      code: "E010",
      message: `Left key type '${leftType}' incompatible with join type '${jp.joinType}'`,
      location: { joinPathId: jp.id },
    })
  }
  // ... symmetric check for right
  return errors
}
```

#### 8.2 Predicate Signature Verification

Each predicate type has a fixed input signature that the compiler verifies:

```
PREDICATE SIGNATURES:

  haversine(left: GeoCoordinate, right: GeoCoordinate) -> number
  temporal_proximity(left: Timestamp, right: Timestamp) -> number
  spectral_proximity(left: Frequency, right: Frequency) -> number
  velocity_cosine(left: VelocityVector, right: VelocityVector) -> number
  jaccard(left: Set<string>, right: Set<string>) -> number
  dtw(left: TrackHistory, right: TrackHistory) -> number

  Each predicate signature MUST match the BaseSignal fields at the
  specified key paths. A mismatch is a compile-time error.
```

---

### 9. Performance Analysis: Compilation

#### 9.1 Compilation Latency

| Stage | Typical Latency | Scaling Factor |
|-------|----------------|----------------|
| Parse + Validate | <5ms | O(P) where P = number of join paths |
| Logical Plan | <2ms | O(P) |
| Optimize | <10ms | O(P^2) for join reordering, O(P) for others |
| Emit | <20ms | O(P * avg_operators_per_path) |
| **Total** | **<40ms** | Dominated by emit stage |

For a typical ontology with 8-15 join paths, full compilation takes under 40ms.
Hot-swap of a single path takes under 10ms.

#### 9.2 Runtime Overhead per Operator

| Operator | Per-Record Cost | Memory | Notes |
|----------|----------------|--------|-------|
| map | O(1) | O(1) | Stateless |
| filter | O(1) | O(1) | Stateless |
| join (identity) | O(log N) | O(N) | Index lookup |
| join (H3 spatial) | O(log N) | O(N) | Cell-based partition |
| reduce | O(log N) | O(N) | State accumulation |
| distinct | O(log N) | O(N) | Dedup tracking |
| concat | O(1) | O(1) | Stream merge |

Where N is the number of records in the arrangement (the indexed state that d2ts
maintains for join processing).

---

### 10. FusionCompiler Effect Service

The compiler is modeled as an Effect service with clean dependency injection:

```typescript
class FusionCompiler extends Effect.Service<FusionCompiler>()("tsingou/FusionCompiler", {
  effect: Effect.gen(function* () {
    const diagnostics = yield* DiagnosticCollector
    const h3Config = yield* H3Configuration
    const predicateRegistry = yield* PredicateRegistry

    return {
      compile: (ontology: FusionOntology, graph: D2) =>
        Effect.gen(function* () {
          // Stage 1: Parse
          const validated = yield* parseAndValidate(ontology, diagnostics)

          // Stage 2: Logical plan
          const logical = yield* buildLogicalPlan(validated, predicateRegistry)

          // Stage 3: Optimize
          const optimized = yield* optimize(logical, {
            predicatePushdown: true,
            joinReordering: true,
            cse: true,
            operatorFusion: true,
          })

          // Stage 4: Emit
          const compiled = yield* emitD2tsGraph(optimized, graph, h3Config)

          return compiled
        }),

      hotSwap: (pathId: string, newConfig: JoinPathEntry) =>
        Effect.gen(function* () {
          yield* suspendPath(pathId)
          const subgraph = yield* compileJoinPath(newConfig)
          yield* migratePath(pathId, subgraph)
          yield* resumePath(pathId)
        }),

      disable: (pathId: string) =>
        Effect.gen(function* () {
          yield* negatePath(pathId)  // Send negative deltas
          yield* suspendPath(pathId)
        }),

      enable: (pathId: string) =>
        Effect.gen(function* () {
          yield* compilePath(pathId)
          yield* replayCurrentState(pathId)
          yield* resumePath(pathId)
        }),

      getDiagnostics: () => diagnostics.getAll(),
    }
  }),
  dependencies: [DiagnosticCollector.Default, H3Configuration.Default, PredicateRegistry.Default],
}) {}
```

---

## Part II: Confidence Calibration and Bayesian Updating (RI-4)

### 11. The Meaning of Confidence

When the fusion engine produces a Tier 2 soft join with `confidence: 0.72`,
what does that number MEAN? This is not a philosophical question. An operator
staring at a screen full of correlated signals needs to know:

- Is 0.72 "probably right" or "coin flip with a thumb on the scale"?
- If another signal arrives that corroborates, how does 0.72 update?
- If 30 minutes pass with no corroboration, does 0.72 decay?
- If the source is known to be unreliable, should 0.72 be discounted?

Three frameworks address these questions: classical Bayesian inference,
Dempster-Shafer theory of evidence, and Subjective Logic. Each has different
strengths for different fusion scenarios.

---

### 12. Bayesian Confidence Framework

#### 12.1 Classical Bayesian Updating

Bayes' theorem provides the foundation for sequential confidence updates:

```
P(H|E) = P(E|H) * P(H) / P(E)

Where:
  H = hypothesis ("these two signals describe the same entity")
  E = evidence (a new signal observation)
  P(H)   = prior probability (before this evidence)
  P(E|H) = likelihood (probability of seeing this evidence IF hypothesis is true)
  P(H|E) = posterior probability (updated confidence after evidence)
  P(E)   = marginal likelihood (normalizing constant)
```

#### 12.2 Sequential Updating for Streaming Signals

In a streaming context, signals arrive sequentially. Each new signal updates
the posterior, which becomes the prior for the next update:

```
SEQUENTIAL BAYESIAN UPDATE:

At time t=0:
  P_0(H) = prior                     (e.g., 0.5 — no information)

At time t=1, evidence E_1 arrives:
  P_1(H) = P(E_1|H) * P_0(H) / P(E_1)

At time t=2, evidence E_2 arrives:
  P_2(H) = P(E_2|H) * P_1(H) / P(E_2)

General recursion:
  P_t(H) = P(E_t|H) * P_{t-1}(H) / P(E_t)

This is RECURSIVE BAYES: the posterior at time t becomes the prior at time t+1.
```

#### 12.3 Worked Example: ADS-B / AIS Spatial Correlation

**Scenario**: An ADS-B aircraft and an AIS vessel are observed near an airfield.
We want to compute the confidence that they are co-located (not the same entity,
but physically proximate and operationally related).

```
HYPOTHESIS H: "Aircraft A4F2B7 and vessel MMSI-211900000 are co-located"

PRIOR:
  P_0(H) = 0.01  (1% base rate — most aircraft/vessel pairs are NOT co-located)

EVIDENCE E_1: Spatial proximity (380m apart)
  P(E_1|H) = 0.9    (if co-located, 90% chance of being within 500m)
  P(E_1|~H) = 0.001 (if NOT co-located, 0.1% chance of random proximity)

  P(E_1) = P(E_1|H)*P(H) + P(E_1|~H)*P(~H)
         = 0.9 * 0.01 + 0.001 * 0.99
         = 0.009 + 0.00099
         = 0.00999

  P_1(H) = 0.9 * 0.01 / 0.00999 = 0.009 / 0.00999 = 0.9009

  After spatial evidence: confidence jumps from 1% to 90.09%

EVIDENCE E_2: Temporal proximity (signals 15s apart)
  P(E_2|H) = 0.95   (if co-located, 95% chance of temporal overlap)
  P(E_2|~H) = 0.1   (if NOT co-located, 10% chance of random temporal overlap)

  P(E_2) = P(E_2|H)*P_1(H) + P(E_2|~H)*P_1(~H)
         = 0.95 * 0.9009 + 0.1 * 0.0991
         = 0.855855 + 0.00991
         = 0.865765

  P_2(H) = 0.95 * 0.9009 / 0.865765 = 0.855855 / 0.865765 = 0.9886

  After temporal evidence: confidence rises from 90.09% to 98.86%

EVIDENCE E_3: Altitude = 0ft (aircraft on ground)
  P(E_3|H) = 0.8    (if co-located at airfield, 80% on ground)
  P(E_3|~H) = 0.05  (if NOT co-located, 5% chance of random ground contact)

  P(E_3) = 0.8 * 0.9886 + 0.05 * 0.0114
         = 0.79088 + 0.00057
         = 0.79145

  P_3(H) = 0.8 * 0.9886 / 0.79145 = 0.79088 / 0.79145 = 0.99928

  After altitude evidence: confidence rises from 98.86% to 99.93%

RESULT: Three independent evidence sources combine to produce near-certainty.
```

#### 12.4 The Log-Odds Formulation

For computational efficiency in streaming systems, Bayesian updating is better
expressed in log-odds form:

```
LOG-ODDS FORMULATION:

Define: O(H) = P(H) / (1 - P(H))         (odds)
        L(H) = log(O(H))                   (log-odds)

Bayes update in log-odds:
  L_{t}(H) = L_{t-1}(H) + log(P(E_t|H) / P(E_t|~H))

The term log(P(E|H) / P(E|~H)) is the LOG-LIKELIHOOD RATIO.

Advantages:
  1. Multiplication becomes addition (numerically stable)
  2. Prior and evidence contributions are separable
  3. No normalization constant needed
  4. Trivially parallelizable for multiple evidence sources

Convert back: P(H) = sigmoid(L(H)) = 1 / (1 + exp(-L(H)))
```

**Worked example in log-odds**:

```
L_0(H)  = log(0.01 / 0.99) = -4.595

E_1 (spatial):  LLR = log(0.9 / 0.001) = 6.802
  L_1(H) = -4.595 + 6.802 = 2.207
  P_1(H) = sigmoid(2.207) = 0.9009

E_2 (temporal): LLR = log(0.95 / 0.1) = 2.251
  L_2(H) = 2.207 + 2.251 = 4.458
  P_2(H) = sigmoid(4.458) = 0.9886

E_3 (altitude): LLR = log(0.8 / 0.05) = 2.773
  L_3(H) = 4.458 + 2.773 = 7.231
  P_3(H) = sigmoid(7.231) = 0.99928

Same result, but computationally cheaper: just additions in log-space.
```

#### 12.5 Prior Selection

The prior `P_0(H)` significantly affects the initial updates. Strategies:

| Strategy | Prior | When to Use |
|----------|-------|-------------|
| Uninformative | 0.5 | No domain knowledge; maximum uncertainty |
| Base rate | 0.01 | Known frequency of co-location events |
| Scenario-adaptive | varies | Different priors for harbor vs. open ocean |
| Empirical Bayes | learned | Historical data calibrates the prior |

For Tsingou, the **scenario-adaptive** approach is preferred. The operator
selects a scenario (e.g., "harbor monitoring"), and the ontology defines
per-scenario priors:

```typescript
const ScenarioPrior = Schema.Struct({
  scenario: Schema.String,
  entityPair: Schema.Struct({
    leftClass: Schema.String,
    rightClass: Schema.String,
  }),
  prior: Schema.Number.pipe(Schema.between(0, 1)),
  rationale: Schema.String,
})

// Examples:
// { scenario: "harbor_monitoring", entityPair: { leftClass: "Aircraft", rightClass: "Vessel" },
//   prior: 0.05, rationale: "5% of aircraft in harbor zone are operationally related to vessels" }
// { scenario: "open_ocean", entityPair: { leftClass: "Aircraft", rightClass: "Vessel" },
//   prior: 0.001, rationale: "0.1% co-location rate in open ocean" }
```

---

### 13. Dempster-Shafer Theory of Evidence

Bayesian inference requires precise likelihood values — `P(E|H)` — which may
not be available for all evidence types. Dempster-Shafer theory provides an
alternative that explicitly represents ignorance.

#### 13.1 Fundamentals

**Frame of Discernment**: The set of mutually exclusive hypotheses. For fusion:

```
THETA = { same_entity, co_located, unrelated }

Power set 2^THETA = {
  {},                                              // empty set
  {same_entity},
  {co_located},
  {unrelated},
  {same_entity, co_located},                      // "related somehow"
  {same_entity, unrelated},                        // (contradictory, unusual)
  {co_located, unrelated},                         // "not same entity"
  {same_entity, co_located, unrelated}             // THETA (total ignorance)
}
```

**Basic Probability Assignment (BPA)**: A function `m: 2^THETA -> [0,1]` where:

```
m({}) = 0                     (no mass on empty set)
SUM(m(A) for A in 2^THETA) = 1  (total mass = 1)
```

Unlike Bayesian probabilities, mass can be assigned to SETS of hypotheses,
representing ignorance about which specific hypothesis is true.

**Belief and Plausibility**:

```
Bel(A) = SUM(m(B) for B subset_of A)     // minimum confidence in A
Pl(A)  = SUM(m(B) for B intersect A != {}) // maximum possible confidence in A

The interval [Bel(A), Pl(A)] brackets the true probability.

If Bel(A) = Pl(A), we have Bayesian certainty.
If Bel(A) << Pl(A), significant uncertainty remains.
```

#### 13.2 Dempster's Rule of Combination

Given two independent evidence sources with mass functions `m_1` and `m_2`,
the combined mass function is:

```
DEMPSTER'S RULE:

m_{1,2}(A) = (1/K) * SUM(m_1(B) * m_2(C))
              for all B,C where B intersect C = A

Where K is the normalization constant:
  K = 1 - SUM(m_1(B) * m_2(C))
           for all B,C where B intersect C = {}

K represents the total conflicting mass. When K is close to 0,
the sources are highly conflicting and the combination is unreliable.

CONFLICT MEASURE:
  conflict = 1 - K = SUM(m_1(B) * m_2(C) where B intersect C = {})
```

#### 13.3 Worked Example: Three-Source Fusion

**Scenario**: Three sensors observe a potential target. We want to combine their
evidence about whether it's a vessel, an aircraft, or unknown.

```
FRAME: THETA = { vessel, aircraft }
POWER SET: { {}, {vessel}, {aircraft}, {vessel, aircraft} }

SOURCE 1: AIS receiver (detects AIS transmissions)
  m_1({vessel}) = 0.8        "80% mass: it's a vessel"
  m_1({aircraft}) = 0.0      "no mass on aircraft"
  m_1(THETA) = 0.2           "20% mass: don't know"

SOURCE 2: Radar (detects physical object, no identification)
  m_2({vessel}) = 0.1        "10% mass: looks like vessel (radar cross section)"
  m_2({aircraft}) = 0.3      "30% mass: looks like aircraft (speed/altitude)"
  m_2(THETA) = 0.6           "60% mass: can't tell from radar alone"

SOURCE 3: RF direction finding (detects 1090 MHz emission)
  m_3({aircraft}) = 0.7      "70% mass: 1090 MHz is ADS-B (aircraft)"
  m_3({vessel}) = 0.05       "5% mass: could be spurious"
  m_3(THETA) = 0.25          "25% mass: uncertain"
```

**Step 1: Combine Source 1 and Source 2**

```
COMBINATION m_1 x m_2:

Compute all intersections:

  m_1({vessel})=0.8  x  m_2({vessel})=0.1   -> {vessel} intersect {vessel}   = {vessel}:    0.08
  m_1({vessel})=0.8  x  m_2({aircraft})=0.3 -> {vessel} intersect {aircraft} = {}:          0.24 (CONFLICT)
  m_1({vessel})=0.8  x  m_2(THETA)=0.6      -> {vessel} intersect THETA      = {vessel}:    0.48
  m_1(THETA)=0.2     x  m_2({vessel})=0.1   -> THETA intersect {vessel}      = {vessel}:    0.02
  m_1(THETA)=0.2     x  m_2({aircraft})=0.3 -> THETA intersect {aircraft}    = {aircraft}:  0.06
  m_1(THETA)=0.2     x  m_2(THETA)=0.6      -> THETA intersect THETA         = THETA:       0.12

  Total conflict = 0.24
  K = 1 - 0.24 = 0.76

  Unnormalized masses:
    {vessel}:  0.08 + 0.48 + 0.02 = 0.58
    {aircraft}: 0.06
    THETA:      0.12

  Normalized (divide by K=0.76):
    m_{12}({vessel})   = 0.58 / 0.76 = 0.7632
    m_{12}({aircraft}) = 0.06 / 0.76 = 0.0789
    m_{12}(THETA)      = 0.12 / 0.76 = 0.1579

  CHECK: 0.7632 + 0.0789 + 0.1579 = 1.0000
```

**Step 2: Combine m_12 with Source 3**

```
COMBINATION m_{12} x m_3:

  m_{12}({vessel})=0.7632   x  m_3({aircraft})=0.7   -> {} :           0.5342 (CONFLICT)
  m_{12}({vessel})=0.7632   x  m_3({vessel})=0.05    -> {vessel}:      0.0382
  m_{12}({vessel})=0.7632   x  m_3(THETA)=0.25       -> {vessel}:      0.1908
  m_{12}({aircraft})=0.0789 x  m_3({aircraft})=0.7   -> {aircraft}:    0.0552
  m_{12}({aircraft})=0.0789 x  m_3({vessel})=0.05    -> {} :           0.0039 (CONFLICT)
  m_{12}({aircraft})=0.0789 x  m_3(THETA)=0.25       -> {aircraft}:    0.0197
  m_{12}(THETA)=0.1579      x  m_3({aircraft})=0.7   -> {aircraft}:    0.1105
  m_{12}(THETA)=0.1579      x  m_3({vessel})=0.05    -> {vessel}:      0.0079
  m_{12}(THETA)=0.1579      x  m_3(THETA)=0.25       -> THETA:         0.0395

  Total conflict = 0.5342 + 0.0039 = 0.5382
  K = 1 - 0.5382 = 0.4618

  WARNING: K = 0.4618 indicates HIGH CONFLICT (>50% conflicting mass).
  This combination should be flagged to the operator.

  Unnormalized masses:
    {vessel}:   0.0382 + 0.1908 + 0.0079 = 0.2369
    {aircraft}: 0.0552 + 0.0197 + 0.1105 = 0.1855
    THETA:      0.0395

  Normalized (divide by K=0.4618):
    m_{123}({vessel})   = 0.2369 / 0.4618 = 0.5130
    m_{123}({aircraft}) = 0.1855 / 0.4618 = 0.4017
    m_{123}(THETA)      = 0.0395 / 0.4618 = 0.0855

  CHECK: 0.5130 + 0.4017 + 0.0855 = 1.0002 (rounding)

FINAL BELIEF AND PLAUSIBILITY:

  Bel({vessel})   = m({vessel})   = 0.5130
  Pl({vessel})    = m({vessel}) + m(THETA) = 0.5130 + 0.0855 = 0.5985
  Interval: [0.5130, 0.5985]

  Bel({aircraft}) = m({aircraft}) = 0.4017
  Pl({aircraft})  = m({aircraft}) + m(THETA) = 0.4017 + 0.0855 = 0.4872
  Interval: [0.4017, 0.4872]

INTERPRETATION:
  - Vessel is favored (Bel=0.51) but NOT by a wide margin
  - Aircraft is plausible (Pl=0.49)
  - High conflict (K=0.46) suggests CONTRADICTORY EVIDENCE
  - The AIS receiver (vessel) and RF DF (aircraft at 1090MHz) DISAGREE
  - Operator action required: investigate potential AIS spoofing or
    collocated aircraft+vessel scenario
```

#### 13.4 When to Use D-S vs. Bayesian

| Criterion | Bayesian | Dempster-Shafer |
|-----------|----------|-----------------|
| Likelihood model available | Required | Not required |
| Explicit ignorance | Cannot represent | First-class (mass on THETA) |
| Conflicting sources | Averages conflict | Exposes conflict (K factor) |
| Computational cost | O(1) per update | O(2^n) worst case |
| Interpretability | "72% likely" | "[Bel, Pl] interval" |
| Best for | Sequential signal updates | Multi-source evidence combination |

**Recommendation for Tsingou**:

- **Tier 1** (identity joins): Neither needed. Confidence is 1.0 by definition.
- **Tier 2** (soft joins): Use **Bayesian sequential updating** with log-odds.
  Likelihoods can be calibrated from spatial/temporal predicate models.
- **Tier 3** (derived joins): Use **Dempster-Shafer**. Statistical correlations
  from independent sources naturally map to mass functions, and the conflict
  measure (K) is operationally critical for flagging unreliable derivations.
- **Cross-tier combination**: Use **Dempster-Shafer** to combine Tier 2 Bayesian
  posteriors with Tier 3 derived evidence, converting Bayesian probabilities
  to mass functions for final combination.

---

### 14. Subjective Logic

Subjective Logic (Josang, 2016) extends Dempster-Shafer with an explicit
representation of source trust and a geometric interpretation via the
opinion triangle.

#### 14.1 Binomial Opinions

A binomial opinion about proposition H is a quadruple:

```
omega_H = (b, d, u, a)

Where:
  b = belief     (evidence supporting H)
  d = disbelief  (evidence against H)
  u = uncertainty (lack of evidence either way)
  a = base rate  (prior probability of H)

Constraints:
  b + d + u = 1
  b, d, u >= 0
  0 <= a <= 1
```

The **probability expectation** of an opinion is:

```
E(omega_H) = b + a * u

This maps the opinion to a single probability value for decision-making.
When u = 0 (no uncertainty), E = b, recovering classical probability.
When u = 1 (total uncertainty), E = a, recovering the prior.
```

#### 14.2 The Opinion Triangle

```
                          u = 1
                         /\
                        /  \
                       /    \
                      / TOTAL \
                     / IGNORANCE\
                    /            \
                   /   (0,0,1)    \
                  /    .           \
                 /    /  point     \
                /   /   omega      \
               /  /      .         \
              / /         \         \
             //            \         \
            /_______._______\________\
          d = 1    E(omega)       b = 1
       (DISBELIEF)    |       (BELIEF)
                      |
                  [projection onto
                   base = probability
                   expectation]
```

A point inside the triangle represents the opinion. The closer to a vertex,
the more extreme the opinion. The projection onto the base (the belief axis)
gives the expected probability, adjusted by the base rate through the
uncertainty component.

#### 14.3 Mapping to Fusion Tiers

| Fusion Output | Subjective Logic Mapping |
|---------------|--------------------------|
| Tier 1 hard join (C=1.0) | omega = (1, 0, 0, a) — full belief, no uncertainty |
| Tier 2 soft join (C=0.72) | omega = (0.72, 0.08, 0.20, 0.01) — belief with residual uncertainty |
| Tier 3 derived (C=0.45) | omega = (0.25, 0.15, 0.60, 0.05) — high uncertainty, moderate belief |
| Stale signal (no update) | omega = (b_decay, d_decay, u_grow, a) — uncertainty increases |

#### 14.4 Cumulative Fusion (Multiple Concordant Sources)

When multiple independent sources agree, subjective logic provides a
cumulative fusion operator that strengthens belief:

```
CUMULATIVE FUSION (omega_A, omega_B):

Given two independent opinions about the same proposition:
  omega_A = (b_A, d_A, u_A, a_A)
  omega_B = (b_B, d_B, u_B, a_B)

Combined opinion omega_{A,B}:
  b_{A,B} = (b_A * u_B + b_B * u_A) / (u_A + u_B - u_A * u_B)
  d_{A,B} = (d_A * u_B + d_B * u_A) / (u_A + u_B - u_A * u_B)
  u_{A,B} = (u_A * u_B) / (u_A + u_B - u_A * u_B)

Properties:
  - If both sources believe: combined belief INCREASES
  - If both sources disbelieve: combined disbelief INCREASES
  - Uncertainty ALWAYS DECREASES with more evidence
  - When u_A or u_B = 0 (one source is certain): combined u = 0
```

**Worked Example**:

```
Source A (AIS receiver): omega_A = (0.7, 0.0, 0.3, 0.1)
  "70% believe vessel, 30% uncertain"

Source B (radar): omega_B = (0.4, 0.2, 0.4, 0.1)
  "40% believe vessel, 20% disbelieve, 40% uncertain"

Denominator = 0.3 + 0.4 - 0.3*0.4 = 0.58

b_{AB} = (0.7*0.4 + 0.4*0.3) / 0.58 = (0.28 + 0.12) / 0.58 = 0.6897
d_{AB} = (0.0*0.4 + 0.2*0.3) / 0.58 = (0.0 + 0.06)  / 0.58 = 0.1034
u_{AB} = (0.3 * 0.4) / 0.58 = 0.12 / 0.58 = 0.2069

CHECK: 0.6897 + 0.1034 + 0.2069 = 1.0000

E(omega_{AB}) = 0.6897 + 0.1 * 0.2069 = 0.6897 + 0.0207 = 0.7104

Interpretation:
  - Combined belief in vessel: 69% (increased from either source alone)
  - Uncertainty: 21% (decreased from both sources)
  - Expected probability: 71%
```

#### 14.5 Beta Distribution Correspondence

A binomial opinion `(b, d, u, a)` corresponds to a Beta distribution:

```
omega = (b, d, u, a)  <-->  Beta(alpha, beta)

Where:
  alpha = W * b / u + a * W_0     (W = non-informative weight, default W = 2)
  beta  = W * d / u + (1-a) * W_0

Simplified (W_0 = 0):
  alpha = 2 * b / u
  beta  = 2 * d / u

This means:
  - An opinion with many observations (low u) -> high alpha+beta -> narrow Beta
  - An opinion with few observations (high u) -> low alpha+beta -> wide Beta
  - The Beta distribution IS the uncertainty model behind the opinion
```

This correspondence enables Bayesian reasoning within the subjective logic
framework: the opinion IS a compact representation of a Beta posterior.

---

### 15. Confidence Calibration

#### 15.1 The Calibration Problem

A confidence score is **well-calibrated** if, among all events assigned
confidence 0.72, approximately 72% turn out to be correct.

Formally: `P(H is true | confidence = c) = c` for all c in [0, 1].

In practice, confidence scores from predicate stacks are NOT automatically
calibrated. They may be:

- **Over-confident**: Model says 0.90, but truth rate is 0.60
- **Under-confident**: Model says 0.50, but truth rate is 0.85
- **Well-calibrated**: Model says 0.72, truth rate is ~0.72

#### 15.2 Platt Scaling

Platt scaling fits a logistic function to transform raw scores into calibrated
probabilities:

```
PLATT SCALING:

Given raw confidence score s, calibrated probability is:
  P_calibrated = 1 / (1 + exp(A*s + B))

Where A and B are parameters learned from labeled data:
  - Collect pairs (s_i, y_i) where s_i is raw score, y_i is true label (0/1)
  - Fit A, B by minimizing negative log-likelihood

Properties:
  - Effective when raw scores have sigmoidal distortion
  - Requires only 2 parameters (very few labeled examples needed)
  - Preserves ranking (monotonic transformation)
```

**Application to Tsingou**: After collecting ground-truth labels (e.g., analyst
confirms or rejects fusion events), fit Platt scaling parameters per join path:

```typescript
const PlattCalibration = Schema.Struct({
  joinPathId: Schema.String,
  paramA: Schema.Number,
  paramB: Schema.Number,
  fittedAt: Schema.Number,
  sampleCount: Schema.Number,
  binMetrics: Schema.Array(Schema.Struct({
    binCenter: Schema.Number,
    predictedMean: Schema.Number,
    observedFraction: Schema.Number,
    count: Schema.Number,
  })),
})

function calibrate(rawScore: number, params: PlattCalibration): number {
  return 1 / (1 + Math.exp(params.paramA * rawScore + params.paramB))
}
```

#### 15.3 Isotonic Regression

An alternative calibration method that does not assume a functional form:

```
ISOTONIC REGRESSION:

Given ordered pairs (s_i, y_i):
  1. Sort by raw score s_i
  2. Fit a non-decreasing step function that minimizes
     SUM((f(s_i) - y_i)^2)
  3. The step function IS the calibration map

Properties:
  - Non-parametric (no distributional assumption)
  - More flexible than Platt scaling
  - Requires more labeled data (1000+ examples for stable fit)
  - Can overfit with small samples
```

**When to use which**:

| Method | Data Available | Score Distribution | Recommendation |
|--------|---------------|-------------------|----------------|
| Platt scaling | <500 labeled | Sigmoidal | Use Platt |
| Isotonic regression | >1000 labeled | Arbitrary | Use isotonic |
| No calibration | <50 labeled | Unknown | Use raw + warn operator |

#### 15.4 Reliability Diagrams

A reliability diagram visualizes calibration quality:

```
RELIABILITY DIAGRAM:

Y-axis: Fraction of positive outcomes (truth rate)
X-axis: Mean predicted confidence (per bin)

Perfect calibration: points on the diagonal (y = x)

     1.0 |          o            /
         |        o           /
         |      o           /  <- diagonal = perfect
   Truth |    o           /
    Rate  |  o          /
         | o         /         o = actual calibration curve
     0.0 |________/_______________
         0.0                  1.0
              Predicted Confidence

Above diagonal: under-confident (truth rate > predicted)
Below diagonal: over-confident (truth rate < predicted)
```

The system generates reliability diagrams per join path, enabling operators
to assess which paths are well-calibrated and which need attention.

---

### 16. Confidence Decay

#### 16.1 The Staleness Problem

A fusion event computed from signals at time T has confidence C(T). At time
T + dt, if no new corroborating signals arrive, confidence should DECAY because:

1. **Mobility**: Entities move. Spatial co-location at T says nothing about T+5min.
2. **Signal validity**: ADS-B position is valid for ~30s; AIS for ~3min.
3. **Epistemic drift**: Our belief should weaken without reinforcement.

#### 16.2 Exponential Decay Model

```
CONFIDENCE DECAY:

C(t) = C(T) * exp(-lambda * (t - T))

Where:
  C(T)   = confidence at fusion time
  t      = current time
  lambda = decay rate (signal-pair specific)
  t - T  = time since last corroboration

Decay rates by signal pair:
  ADS-B x ADS-B:    lambda = 0.1/s    (half-life ~7s)
  ADS-B x AIS:      lambda = 0.005/s  (half-life ~139s)
  ADS-B x RF bearing: lambda = 0.05/s (half-life ~14s)
  AIS x AIS:        lambda = 0.003/s  (half-life ~231s)
  HTTP x DNS:       lambda = 0.001/s  (half-life ~693s)
  OSINT x OSINT:    lambda = 0.0001/s (half-life ~6931s / ~1.9h)
```

#### 16.3 Subjective Logic Decay

In subjective logic, decay transfers mass from belief to uncertainty:

```
OPINION DECAY:

At time T: omega(T) = (b, d, u, a)
At time t: omega(t) = (b * gamma, d * gamma, 1 - (b+d)*gamma, a)

Where gamma = exp(-lambda * (t - T))

As t -> infinity:
  b -> 0, d -> 0, u -> 1
  omega -> (0, 0, 1, a)   // total ignorance, revert to base rate

This is semantically correct: without evidence, uncertainty dominates,
and the expected probability reverts to the prior.
```

#### 16.4 Decay with Partial Corroboration

When a new signal arrives that partially corroborates (not all predicates
match), decay is reduced but not eliminated:

```
PARTIAL CORROBORATION:

  corroboration_score = fraction of predicates that re-match
  effective_lambda = lambda * (1 - corroboration_score)

Example:
  Original fusion: spatial + temporal + spectral match at T
  At T+60s: new signal arrives
    - Spatial: still within radius (match)
    - Temporal: within window (match)
    - Spectral: frequency shifted (no match)

  corroboration_score = 2/3 = 0.667
  effective_lambda = lambda * (1 - 0.667) = lambda * 0.333

  Confidence decays at 1/3 the normal rate because 2/3 of evidence
  is reinforced.
```

---

### 17. Source Reliability: NATO Admiralty Code Integration

#### 17.1 The Admiralty System

The NATO/Admiralty system (STANAG 2022) grades intelligence with a
two-character code: **source reliability** (A-F) and **information
credibility** (1-6).

#### 17.2 Source Reliability Scale

| Grade | Name | Description | Numeric Weight |
|-------|------|-------------|----------------|
| A | Completely reliable | No doubt. History of complete reliability. | 1.00 |
| B | Usually reliable | Minor doubts. History of mostly valid information. | 0.80 |
| C | Fairly reliable | Doubts exist. Has provided valid information in past. | 0.60 |
| D | Not usually reliable | Significant doubts. Has provided valid info occasionally. | 0.40 |
| E | Unreliable | History of invalid information. | 0.20 |
| F | Cannot be judged | No basis for evaluating reliability. | 0.50* |

\* F is mapped to 0.50 (maximum uncertainty), not 0.00, because an unknown source
is not necessarily wrong — it's simply unevaluated.

#### 17.3 Information Credibility Scale

| Grade | Name | Description | Numeric Weight |
|-------|------|-------------|----------------|
| 1 | Confirmed | Confirmed by independent sources. Logical and consistent. | 1.00 |
| 2 | Probably true | Not confirmed. Logical and consistent with known info. | 0.80 |
| 3 | Possibly true | Not confirmed. Reasonably consistent with known info. | 0.60 |
| 4 | Doubtfully true | Not confirmed. Possible but not logical. Not consistent. | 0.40 |
| 5 | Improbable | Not confirmed. Not logical. Contradicted by known info. | 0.20 |
| 6 | Cannot be judged | No basis for evaluating truth. | 0.50* |

#### 17.4 Composite Grading

The two-character code combines source and information assessment:

```
COMPOSITE GRADE: [Source][Information]

Examples:
  A1 — Reliable source, confirmed information     (highest confidence)
  B2 — Usually reliable source, probably true      (high confidence)
  C3 — Fairly reliable source, possibly true       (moderate confidence)
  D4 — Not usually reliable, doubtfully true       (low confidence)
  E5 — Unreliable source, improbable information   (very low confidence)
  F6 — Unknown source, unjudgeable information     (maximum uncertainty)
```

#### 17.5 Mapping to Confidence Scores

```
ADMIRALTY TO CONFIDENCE:

For a signal graded [S][I]:
  source_weight = numeric_weight(S)
  info_weight   = numeric_weight(I)

  confidence_modifier = source_weight * info_weight

  Final confidence = raw_confidence * confidence_modifier

Example:
  Raw fusion confidence from predicate stack: 0.85
  Signal source graded B2:
    source_weight = 0.80
    info_weight   = 0.80
    modifier = 0.80 * 0.80 = 0.64

  Final confidence = 0.85 * 0.64 = 0.544

  The B2 grading REDUCES confidence by 36% — the system trusts this
  source less than an A1 source would be trusted.
```

#### 17.6 Admiralty Grade to Subjective Logic Opinion

```
GRADE TO OPINION:

For grade [S][I]:
  Let s = numeric_weight(S), i = numeric_weight(I)

  b = s * i                    (belief proportional to both)
  d = (1-s) * (1-i)            (disbelief when both unreliable)
  u = 1 - b - d                (residual = uncertainty)
  a = scenario base rate

Example: Grade C3
  s = 0.60, i = 0.60
  b = 0.60 * 0.60 = 0.36
  d = 0.40 * 0.40 = 0.16
  u = 1 - 0.36 - 0.16 = 0.48
  omega = (0.36, 0.16, 0.48, a)

Example: Grade A1
  s = 1.00, i = 1.00
  b = 1.00, d = 0.00, u = 0.00
  omega = (1.0, 0.0, 0.0, a)   // full certainty

Example: Grade F6
  s = 0.50, i = 0.50
  b = 0.25, d = 0.25, u = 0.50
  omega = (0.25, 0.25, 0.50, a) // maximum uncertainty
```

#### 17.7 Admiralty Code Integration Table

The following table maps signal source types to default Admiralty grades:

| Signal Source | Default Grade | Rationale | Adjustable? |
|---------------|---------------|-----------|-------------|
| ADS-B (mode S) | B2 | Usually reliable, not independently confirmed | Yes |
| ADS-B (MLAT) | C3 | Multilateration adds positional error | Yes |
| AIS (class A) | B2 | Required on large vessels, generally reliable | Yes |
| AIS (class B) | C3 | Voluntary, less regulated | Yes |
| Radar (primary) | B3 | Reliable detection, uncertain classification | Yes |
| Radar (secondary) | B2 | Transponder-based, more reliable ID | Yes |
| RF DF (single bearing) | D4 | High angular uncertainty | Yes |
| RF DF (triangulated) | C3 | Better with multiple bearings | Yes |
| DNS (authoritative) | A2 | Authoritative servers, probably true | Yes |
| DNS (recursive) | B3 | Cache effects, possible poisoning | Yes |
| HTTP (direct) | B2 | Direct observation, usually reliable | Yes |
| RSS/OSINT | D3-F6 | Highly variable source quality | Yes, per feed |
| STIX CTI feed | C2-B1 | Depends on feed provider | Yes, per provider |
| HUMINT | D3-A2 | Depends on source history | Yes, per source |

Operators can override default grades per source instance based on operational
experience.

---

### 18. Particle Filters for Multi-Modal Distributions

#### 18.1 The Multi-Modality Problem

Standard Bayesian updating with Gaussian assumptions (e.g., Kalman filter)
fails when the posterior distribution is multi-modal. This occurs in fusion
when:

- A signal could correspond to MULTIPLE entities (track ambiguity)
- Two hypotheses are equally plausible (vessel vs. aircraft with similar radar cross section)
- Derived correlations (Tier 3) produce clusters of possible associations

#### 18.2 Particle Filter Approach

Particle filters represent the posterior distribution as a set of weighted
samples ("particles"), each representing a hypothesis about the world state:

```
PARTICLE FILTER FOR FUSION:

State: X_t = set of active entity-signal associations
Particles: {(x_t^i, w_t^i)}_{i=1}^N

At each timestep:
  1. PREDICT: Propagate each particle through dynamics model
     x_t^i ~ p(x_t | x_{t-1}^i)

  2. UPDATE: Weight each particle by likelihood of new evidence
     w_t^i = p(z_t | x_t^i)
     (z_t = new signal observation)

  3. NORMALIZE: w_t^i = w_t^i / SUM(w_t^j)

  4. RESAMPLE: Draw N particles with replacement, weighted by w_t^i
     (prevents particle degeneracy)

The weighted particle set approximates the posterior:
  p(x_t | z_{1:t}) ~= SUM(w_t^i * delta(x_t - x_t^i))
```

#### 18.3 Application to Entity Association

```
EXAMPLE: Ambiguous radar return

Three aircraft in the area. New radar detection at position P.
Which aircraft is it?

Particles (1000 total):
  450 particles: "detection = aircraft A"  (A is closest)
  350 particles: "detection = aircraft B"  (B is on similar heading)
  150 particles: "detection = aircraft C"  (C is possible but unlikely)
  50 particles:  "detection = new entity"  (unassociated)

After ADS-B update confirms A at position P':
  Weight update: particles for A get boosted, others suppressed
  After resample:
    820 particles: "detection = aircraft A"
    120 particles: "detection = aircraft B"
    40 particles:  "detection = aircraft C"
    20 particles:  "detection = new entity"

Confidence in A: 820/1000 = 0.82
Uncertainty: 180/1000 = 0.18 (distributed across alternatives)
```

#### 18.4 Computational Considerations

| Parameter | Typical Value | Scaling |
|-----------|--------------|---------|
| Particles per entity | 100-1000 | More = better approximation, higher cost |
| Entities tracked | 10-1000 | Cost scales linearly |
| Update rate | Per signal arrival | ~1-10ms per entity per update |
| Memory | O(N * state_size) | 1000 particles * 64 bytes = 64KB per entity |
| Resample threshold | N_eff < N/2 | Effective sample size metric |

For Tsingou, particle filters are recommended for **Tier 3 derived joins only**,
where multi-modal association ambiguity is common. Tier 1 and Tier 2 use
analytic Bayesian updating (computationally cheaper).

---

### 19. ConfidenceEngine Effect Service

The confidence engine is modeled as an Effect service that encapsulates all
confidence computation:

```typescript
class ConfidenceEngine extends Effect.Service<ConfidenceEngine>()("tsingou/ConfidenceEngine", {
  effect: Effect.gen(function* () {
    const calibrationStore = yield* CalibrationStore
    const admiraltyConfig = yield* AdmiraltyConfiguration
    const decayConfig = yield* DecayConfiguration

    return {
      // Bayesian sequential update (Tier 2)
      bayesianUpdate: (
        prior: number,
        evidence: EvidenceItem,
      ) => Effect.gen(function* () {
        const logOdds = Math.log(prior / (1 - prior))
        const llr = yield* computeLogLikelihoodRatio(evidence)
        const posteriorLogOdds = logOdds + llr
        const posterior = 1 / (1 + Math.exp(-posteriorLogOdds))
        return posterior
      }),

      // Dempster-Shafer combination (Tier 3 / cross-tier)
      dempsterCombine: (
        masses: MassFunction[],
      ) => Effect.gen(function* () {
        let combined = masses[0]
        for (let i = 1; i < masses.length; i++) {
          const { result, conflict } = dempsterRule(combined, masses[i])
          if (conflict > 0.5) {
            yield* Effect.logWarning(
              `High conflict (K=${conflict.toFixed(3)}) combining sources ${i-1} and ${i}`
            )
          }
          combined = result
        }
        return {
          mass: combined,
          belief: computeBelief(combined),
          plausibility: computePlausibility(combined),
        }
      }),

      // Subjective logic cumulative fusion
      subjectiveFusion: (
        opinions: SubjectiveOpinion[],
      ) => Effect.gen(function* () {
        let fused = opinions[0]
        for (let i = 1; i < opinions.length; i++) {
          fused = cumulativeFusion(fused, opinions[i])
        }
        return {
          opinion: fused,
          expectedProbability: fused.b + fused.a * fused.u,
        }
      }),

      // Confidence decay
      decay: (
        originalConfidence: number,
        fusionTime: number,
        currentTime: number,
        signalPair: string,
      ) => Effect.gen(function* () {
        const lambda = yield* decayConfig.getRate(signalPair)
        const dt = (currentTime - fusionTime) / 1000  // ms to seconds
        return originalConfidence * Math.exp(-lambda * dt)
      }),

      // Admiralty grade to confidence modifier
      applyAdmiraltyGrade: (
        rawConfidence: number,
        grade: AdmiraltyGrade,
      ) => Effect.gen(function* () {
        const sourceWeight = yield* admiraltyConfig.getSourceWeight(grade.source)
        const infoWeight = yield* admiraltyConfig.getInfoWeight(grade.info)
        return rawConfidence * sourceWeight * infoWeight
      }),

      // Calibrate raw score
      calibrate: (
        rawScore: number,
        joinPathId: string,
      ) => Effect.gen(function* () {
        const params = yield* calibrationStore.getCalibration(joinPathId)
        if (params._tag === "None") return rawScore  // no calibration data
        return plattScale(rawScore, params.value)
      }),

      // Full pipeline: raw -> calibrated -> admiralty-adjusted -> decayed
      computeConfidence: (
        rawScore: number,
        joinPathId: string,
        admiraltyGrade: AdmiraltyGrade,
        fusionTime: number,
        currentTime: number,
        signalPair: string,
      ) => Effect.gen(function* () {
        const calibrated = yield* calibrate(rawScore, joinPathId)
        const graded = yield* applyAdmiraltyGrade(calibrated, admiraltyGrade)
        const decayed = yield* decay(graded, fusionTime, currentTime, signalPair)
        return {
          raw: rawScore,
          calibrated,
          graded,
          final: decayed,
          components: {
            plattA: 0, plattB: 0,  // filled from calibration store
            sourceWeight: 0,
            infoWeight: 0,
            decayLambda: 0,
            dt: (currentTime - fusionTime) / 1000,
          },
        }
      }),
    }
  }),
  dependencies: [
    CalibrationStore.Default,
    AdmiraltyConfiguration.Default,
    DecayConfiguration.Default,
  ],
}) {}
```

---

### 20. Performance Analysis: Confidence Computation

#### 20.1 Per-Record Cost

| Operation | Time | Memory | When Used |
|-----------|------|--------|-----------|
| Bayesian update (log-odds) | <1us | O(1) | Every Tier 2 evidence arrival |
| Platt calibration | <1us | O(1) | Every confidence output |
| Admiralty grade lookup | <1us | O(1) | Every confidence output |
| Exponential decay | <1us | O(1) | Every confidence query |
| D-S combination (2 sources) | ~10us | O(2^n) | Tier 3, n = frame size |
| D-S combination (k sources) | ~5*k us | O(k * 2^n) | Multi-source Tier 3 |
| Subjective cumulative fusion | ~5us | O(1) | Per source pair |
| Particle filter update | ~100us | O(N_particles) | Tier 3 multi-modal |

#### 20.2 Scaling Analysis

For a system processing 10,000 signals/second with 15 active join paths:

```
THROUGHPUT ANALYSIS:

Tier 1 (5 identity paths):
  5 paths * 10,000 sigs/s * 1us/sig = 50ms/s CPU
  Well within single-core budget

Tier 2 (8 soft paths, avg 3 predicates each):
  Predicate evaluation: 8 * 10,000 * 5us = 400ms/s
  Bayesian update: 8 * 10,000 * 1us = 80ms/s
  Calibration + decay: 8 * 10,000 * 3us = 240ms/s
  Total: ~720ms/s CPU (72% of one core)

Tier 3 (2 derived paths, DS combination):
  Batch window: every 10s
  DS combination: 2 * 1000 pairs * 10us = 20ms per batch
  Negligible continuous cost

TOTAL: ~770ms/s, leaving 23% headroom on a single core.
Scales linearly across cores for independent paths.
```

#### 20.3 Memory Budget

```
MEMORY ANALYSIS:

Per active join path:
  d2ts arrangement state: O(N) where N = active records
  Bayesian state (log-odds per entity pair): 8 bytes * num_pairs
  Calibration params: 2 * 8 bytes (A, B) per path
  Admiralty config: 36 bytes (6*6 matrix)
  Decay config: 8 bytes (lambda) per signal pair

For 15 paths, 10,000 active entities, avg 100 pairs per path:
  Arrangement state: 15 * 10,000 * 256 bytes = ~38 MB
  Bayesian state: 15 * 100 * 8 bytes = ~12 KB
  Config state: ~1 KB

Total: ~38 MB dominated by d2ts arrangement state.
```

---

### 21. Frequentist vs. Bayesian Interpretation

A critical conceptual question: what does `confidence = 0.72` MEAN?

#### 21.1 Frequentist Interpretation

```
"If we repeated this type of fusion with the same predicate scores 100 times,
approximately 72 of the resulting pairs would be truly co-located."

This requires:
  - Calibrated confidence scores (Section 15)
  - Statistical repeatability assumption
  - Large sample for the frequency to be meaningful

Operational use: "72% of alerts at this confidence level are actionable."
```

#### 21.2 Bayesian Interpretation

```
"Given the evidence observed, there is a 0.72 degree of belief that these
signals describe co-located entities."

This requires:
  - Well-specified prior
  - Correct likelihood model
  - Evidence independence

Operational use: "I am 72% confident in this specific association."
```

#### 21.3 Tsingou's Hybrid Approach

The system uses **both** interpretations at different levels:

| Level | Interpretation | Used For |
|-------|---------------|----------|
| Individual fusion event | Bayesian (degree of belief) | "How confident am I in THIS link?" |
| System-wide calibration | Frequentist (empirical rate) | "Are my confidence scores trustworthy?" |
| Operator decision | Neither — Bayesian with caveats | Display interval [Bel, Pl] for D-S, or point estimate + uncertainty for SL |

The operator interface MUST communicate uncertainty, not just a point estimate:

```
DISPLAY FORMAT:

NOT:  "Confidence: 72%"
      (Implies precision that doesn't exist)

BUT:  "Confidence: 72% [Bel: 68%, Pl: 81%]"
      (Shows the uncertainty interval)

OR:   "Confidence: 72% +/- 9%"
      (Symmetric error bar from calibration uncertainty)

OR:   "Confidence: 72% | Source: B2 | Decay: -3%/min"
      (Shows provenance and temporal dynamics)
```

---

### 22. Integration: Compiler + Confidence Pipeline

The FusionCompiler and ConfidenceEngine compose into a unified pipeline:

```
FULL PIPELINE:

  Signal arrives
       |
       v
  FusionCompiler.compile(ontology)
       |
       v  (d2ts graph processes signal)
       |
  Join operator fires -> raw predicate scores
       |
       v
  ConfidenceEngine.computeConfidence()
    |-> calibrate(raw) via Platt scaling
    |-> applyAdmiraltyGrade(calibrated, sourceGrade)
    |-> bayesianUpdate(prior, evidence) [if sequential]
    |-> dempsterCombine(masses) [if multi-source]
       |
       v
  FusedDatum with full confidence metadata
       |
       v
  Output to visualization layer
    |-> Point estimate for display
    |-> [Bel, Pl] interval for detail panel
    |-> Reliability diagram for calibration view
    |-> Decay curve for temporal view
```

#### 22.1 Confidence Metadata Schema

```typescript
const ConfidenceMetadata = Schema.TaggedStruct("ConfidenceMetadata", {
  // Point estimates
  raw: Schema.Number,
  calibrated: Schema.Number,
  graded: Schema.Number,
  final: Schema.Number,

  // Uncertainty representation
  beliefInterval: Schema.optional(Schema.Struct({
    belief: Schema.Number,
    plausibility: Schema.Number,
  })),

  // Subjective logic opinion
  opinion: Schema.optional(Schema.Struct({
    belief: Schema.Number,
    disbelief: Schema.Number,
    uncertainty: Schema.Number,
    baseRate: Schema.Number,
  })),

  // Provenance
  admiraltyGrade: Schema.optional(Schema.Struct({
    source: Schema.Literal("A", "B", "C", "D", "E", "F"),
    info: Schema.Literal("1", "2", "3", "4", "5", "6"),
  })),

  // Temporal dynamics
  decay: Schema.optional(Schema.Struct({
    lambda: Schema.Number,
    fusionTime: Schema.Number,
    halfLife: Schema.Number,
  })),

  // Calibration quality
  calibrationQuality: Schema.optional(Schema.Struct({
    method: Schema.Literal("platt", "isotonic", "none"),
    sampleCount: Schema.Number,
    expectedCalibrationError: Schema.Number,
  })),

  // Conflict indicators (D-S)
  conflict: Schema.optional(Schema.Struct({
    kFactor: Schema.Number,
    conflictingSources: Schema.Array(Schema.String),
    recommendation: Schema.Literal(
      "accept", "review", "reject", "investigate"
    ),
  })),
})
```

---

### 23. Summary: Decision Framework

| Question | Framework | Section |
|----------|-----------|---------|
| "How do I turn an ontology into a running dataflow?" | Compilation Pipeline | 2-6 |
| "Can I change join paths without restarting?" | Dynamic Graph Modification | 7 |
| "Is this join type-safe?" | Schema Validation at Compile Time | 8 |
| "How fast is compilation?" | Performance Analysis | 9 |
| "What does 0.72 mean?" | Frequentist vs. Bayesian | 21 |
| "How do I update confidence with new evidence?" | Bayesian Sequential Updating | 12 |
| "What if I can't estimate likelihoods?" | Dempster-Shafer Theory | 13 |
| "How do I represent explicit uncertainty?" | Subjective Logic | 14 |
| "Are my confidence scores trustworthy?" | Calibration (Platt/Isotonic) | 15 |
| "What happens to confidence over time?" | Confidence Decay | 16 |
| "How do I weight unreliable sources?" | NATO Admiralty Code | 17 |
| "What if the posterior is multi-modal?" | Particle Filters | 18 |
| "What's the CPU/memory budget?" | Performance Analysis | 20 |

---

### 24. References

#### Compilation and Dataflow

- [McSHERRY-2013] McSherry, F., Murray, D.G., Isaacs, R. "Differential Dataflow."
  CIDR 2013.
- [McSHERRY-2015] McSherry, F. "Differential graph computation." Blog, 2015.
- [MATERIALIZE-LINEAR] Materialize. "Generalizing linear operators in differential
  dataflow." Blog, 2024.
- [MATERIALIZE-SCRATCH] Materialize. "Building Differential Dataflow from Scratch."
  Blog, 2024.
- [MATERIALIZE-ARCH] Materialize. "The Software Architecture of Materialize." Blog.
- [D2TS] Electric SQL. "@electric-sql/d2ts: Differential Dataflow in TypeScript."
  GitHub, 2024.
- [DATAFUSION] Apache DataFusion. "Optimizing SQL (and DataFrames) in DataFusion,
  Part 2: Optimizers." Blog, 2025.
- [FLINK-2.0] Apache Flink. "Apache Flink 2.0.0: A new Era of Real-Time Data
  Processing." 2025.
- [SPOOF] Elgamal et al. "SPOOF: Sum-Product Optimization and Operator Fusion."
  CIDR 2017.
- [DECLARATIVE-DD] Comnik. "declarative-dataflow: A reactive query engine built on
  differential dataflow." GitHub.

#### Bayesian Inference and Updating

- [BAYES-TUTORIAL] MITRE. "A Tutorial on Bayesian Estimation and Tracking." 2005.
- [RUBINSTEIN] Rubinstein, M. "Introduction to recursive Bayesian filtering." MIT.
- [PARTICLE-TUTORIAL] PMC. "Particle Filters: A Hands-On Tutorial." 2021.
- [PARTICLE-FILTER] Wikipedia. "Particle filter."
- [ARULAMPALAM-2002] Arulampalam et al. "A tutorial on particle filters for online
  nonlinear/non-Gaussian Bayesian tracking." IEEE TSP, 2002.

#### Dempster-Shafer Theory

- [SHAFER-1976] Shafer, G. "A Mathematical Theory of Evidence." Princeton, 1976.
- [DS-COMBINATION] UC Berkeley. "Combination of Evidence in Dempster-Shafer Theory."
  Statistics report.
- [DS-IOT] MDPI Sensors. "Multisensor Data Fusion in IoT Environments in D-S Theory
  Setting." 2023.
- [DS-IMPROVED] Nature Scientific Reports. "Research on improved evidence theory based
  on multi-sensor information fusion." 2021.
- [BUNDY-LIU] Bundy, A., Liu, W. "On Dempster's Combination Rule." Edinburgh DAI
  Research Paper 651.

#### Subjective Logic

- [JOSANG-2016] Josang, A. "Subjective Logic: A Formalism for Reasoning Under
  Uncertainty." Springer, 2016. ISBN 978-3-319-42337-1.
- [JOSANG-UAI] Josang, A. "Reasoning under uncertainty with subjective logic."
  UAI 2016 Tutorial.
- [SL-WIKI] Wikipedia. "Subjective logic."
- [JOSANG-OSLO] University of Oslo Department of Informatics. "Subjective Logic"
  research page.

#### Calibration

- [PLATT-1999] Platt, J. "Probabilistic Outputs for Support Vector Machines." 1999.
- [NICULESCU-2005] Niculescu-Mizil, A., Caruana, R. "Predicting Good Probabilities
  With Supervised Learning." ICML 2005.
- [CALIBRATION-2025] "Calibration Meets Reality: Making Machine Learning Predictions
  Trustworthy." arXiv 2509.23665, 2025.
- [SKLEARN-CALIB] scikit-learn. "Probability calibration." Documentation v1.8.0.
- [FASTML] FastML. "Classifier calibration with Platt's scaling and isotonic
  regression."

#### Intelligence Grading

- [STANAG-2022] NATO. "STANAG 2022: Intelligence Reports." Standardization Agreement.
- [ADMIRALTY-WIKI] Wikipedia. "Admiralty code."
- [ADMIRALTY-ANALYSIS] Wold, M. "Intelligence Grading: Why the Admiralty Code Matters."
- [BLOCKINT] Blockint. "The origin of information grading systems."
- [BLOCKINT-CRITICAL] Blockint. "Critical review of the Admiralty Code."
- [SOURCE-RELIABILITY] Wikipedia. "Intelligence source and information reliability."

---

*End of TSGC-003*
