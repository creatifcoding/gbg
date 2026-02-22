# Research: Differential Dataflow Mathematical Foundations

```
Topic:     Differential Dataflow, Lattice Theory, Incremental Computation
Purpose:   Raw research for RFC-002 Section TSG.26
Author:    diff-dataflow-theorist (Val team)
Date:      2026-02-18
Status:    COMPLETE
Sources:   [MCSHERRY-CIDR2013], [ABADI-FOSSACS2015], [MURRAY-SOSP2013],
           [MATERIALIZE-FORMALISM], [MATERIALIZE-SCRATCH], [SHAPIRO-2011],
           [D2TS-REPO], Tsingou codebase
```

---

## 1. Historical Context and Lineage

### 1.1 The Differential Dataflow Lineage

Differential dataflow emerges from three converging research threads:

1. **Incremental view maintenance** (database community, 1990s-2000s): Maintaining materialized views under updates without full recomputation. Limited to bag-relational algebra over linearly ordered time.

2. **Dataflow computation** (parallel/distributed computing, 2000s): Expressing computation as directed graphs of operators where data flows along edges. Systems like Dryad, MapReduce, and Spark implement this model.

3. **Iterative computation** (graph algorithms, machine learning, 2010s): Many computations require fixed-point iteration (PageRank, connected components, shortest paths). Traditional batch systems restart from scratch; streaming systems cannot handle iteration at all.

The key insight: **incremental computation generalizes naturally from linearly ordered time to partially ordered time**, and this generalization simultaneously supports iteration, streaming updates, and arbitrary nesting.

### 1.2 Key Publications

| Year | Publication | Contribution |
|------|------------|--------------|
| 2013 | McSherry, Murray, Isaacs. "Differential Dataflow." CIDR 2013 [MCSHERRY-CIDR2013] | Introduced differential dataflow: incremental computation over partially ordered timestamps |
| 2013 | Murray et al. "Naiad: A Timely Dataflow System." SOSP 2013 [MURRAY-SOSP2013] | Implemented timely dataflow (the execution substrate for differential dataflow) in Naiad |
| 2015 | Abadi, McSherry, Plotkin. "Foundations of Differential Dataflow." FoSSaCS 2015 [ABADI-FOSSACS2015] | Formal denotational semantics using Abelian groups and Mobius inversion |
| 2020 | McSherry. "Differential Dataflow from Scratch" (blog) [MATERIALIZE-SCRATCH] | Accessible reconstruction of the mathematical model |
| 2024 | Materialize Inc. "Platform Formalism" [MATERIALIZE-FORMALISM] | Production-grade formal specification of collections, traces, and compaction |
| 2024 | Electric SQL. "d2ts" [D2TS-REPO] | TypeScript port of differential dataflow, used by Tsingou |

### 1.3 Relationship to d2ts

d2ts (`@electric-sql/d2ts`) is explicitly described as a TypeScript implementation of the differential dataflow model, ported from the Materialize blog post "Differential Dataflow from Scratch" [D2TS-REPO]. It implements:

- `MultiSet<T>` — collections as multisets with integer multiplicities
- `Version` — partially ordered logical timestamps (supports multi-dimensional)
- `Antichain` — frontier representation as sets of incomparable versions
- `Index` — versioned state storage for stateful operators
- `D2` — the dataflow graph execution engine
- Operators: `map`, `filter`, `join`, `reduce`, `consolidate`, `iterate`, `distinct`, `count`

---

## 2. Mathematical Foundations: Lattice Theory

### 2.1 Partial Orders

**Definition (Partial Order).** A partial order is a pair (S, <=) where S is a set and <= is a binary relation on S that is:
- **Reflexive**: For all a in S, a <= a
- **Antisymmetric**: If a <= b and b <= a, then a = b
- **Transitive**: If a <= b and b <= c, then a <= c

Unlike a total order, two elements may be **incomparable**: neither a <= b nor b <= a holds. This is written a || b.

**Significance for differential dataflow**: Time/version spaces are partially ordered. Two events from different sources may be concurrent (incomparable), which is precisely the situation in Tsingou's multi-source signal ingestion.

### 2.2 Lattices

**Definition (Join-Semilattice).** A partial order (S, <=) is a join-semilattice if every pair of elements a, b in S has a least upper bound (join), written a v b, satisfying:
- a <= a v b and b <= a v b
- If a <= c and b <= c, then a v b <= c

**Definition (Meet-Semilattice).** A partial order (S, <=) is a meet-semilattice if every pair of elements a, b in S has a greatest lower bound (meet), written a ^ b, satisfying:
- a ^ b <= a and a ^ b <= b
- If c <= a and c <= b, then c <= a ^ b

**Definition (Lattice).** A partial order that is both a join-semilattice and a meet-semilattice is a lattice.

**Definition (Complete Lattice).** A lattice where EVERY subset (not just pairs) has a join and meet is a complete lattice. This includes a least element (bottom) and greatest element (top).

### 2.3 Product Lattices

**Definition (Product Lattice).** Given two lattices (L1, <=_1) and (L2, <=_2), the product lattice L1 x L2 is defined by:
- Elements: pairs (a, b) where a in L1, b in L2
- Order: (a1, b1) <= (a2, b2) iff a1 <=_1 a2 AND b1 <=_2 b2
- Join: (a1, b1) v (a2, b2) = (a1 v_1 a2, b1 v_2 b2)
- Meet: (a1, b1) ^ (a2, b2) = (a1 ^_1 a2, b1 ^_2 b2)

**Significance for Tsingou**: The version tuple `[tick, source_seq]` forms a product lattice N x N where N is the natural numbers under the standard order. This is the formal basis for the multi-dimensional versioning in `graph/version.ts`.

### 2.4 Antichains

**Definition (Antichain).** An antichain in a partial order (S, <=) is a subset A of S where no two distinct elements are comparable: for all a, b in A with a != b, neither a <= b nor b <= a.

**Significance**: Antichains represent frontiers — the "boundary" between versions that are complete and versions that may still receive data. The set of all antichains in a lattice forms a lattice itself, ordered by:
- A1 <= A2 iff for every a2 in A2, there exists a1 in A1 with a1 <= a2

The greatest lower bound of two antichains A1 and A2 is computed by taking the union A1 u A2 and removing any non-minimal elements.

### 2.5 Well-Founded Partial Orders

**Definition (Well-Founded).** A partial order (S, <=) is well-founded if every non-empty subset of S has a minimal element. Equivalently, there is no infinite strictly descending chain a1 > a2 > a3 > ...

**Significance**: Well-foundedness ensures that differential dataflow computations terminate. When processing differences at version t, all differences at versions s < t must have already been computed. Well-foundedness guarantees this induction is valid.

### 2.6 Upper Sets and Filters

**Definition (Upper Set / Upset).** A subset U of a partial order (S, <=) is an upper set if: for all x in U and y in S, if x <= y then y in U.

**Significance**: The set of versions that may still receive data is an upper set. A frontier (antichain) is the set of minimal elements of this upper set, and the upper set can be reconstructed from its frontier. This is why antichains suffice to represent frontiers.

---

## 3. The Differential Dataflow Model

### 3.1 Collections as Multisets

**Definition (Collection).** A collection C over a data domain D is a function:

```
C : D -> Z
```

where Z is the integers. C(d) is the **multiplicity** of element d:
- C(d) > 0: element d appears C(d) times
- C(d) = 0: element d is absent
- C(d) < 0: element d has been "over-retracted" (an intermediate computational state)

The set of all collections over D forms an **Abelian group** under pointwise addition:
- Addition: (C1 + C2)(d) = C1(d) + C2(d)
- Zero: the empty collection where 0(d) = 0 for all d
- Inverse: (-C)(d) = -C(d)

**This Abelian group structure is the mathematical core of differential dataflow.** It enables subtraction of collections (computing differences), and all operators must respect this group structure.

### 3.2 Versioned Collections (Traces)

**Definition (Trace).** A trace T over data domain D and version domain V is a function:

```
T : V -> (D -> Z)
```

assigning a collection to each version. The trace must be **compatible** with the partial order on V: the collection at version v is determined by accumulating all differences at versions u <= v:

```
Collection[v] = Sum over {u : u <= v} of Difference[u]
```

where each `Difference[u]` is a collection (D -> Z) representing the net change at version u.

**Definition (Difference).** The difference at version v is:

```
Difference[v] = Collection[v] - Sum over {u : u < v} of Difference[u]
```

This is the discrete derivative along the partial order, and the collection at any version can be reconstructed by integration (summation) of differences.

### 3.3 The Update Triple

In implementations, traces are stored as sets of **update triples**:

```
(data, version, diff)
```

where `diff` is the change in multiplicity of `data` at `version`. The collection at version v is:

```
C_v(d) = Sum over {(d, u, delta) : u <= v} of delta
```

### 3.4 Mobius Inversion

The Abadi-McSherry-Plotkin formalization [ABADI-FOSSACS2015] reveals that the relationship between collections and differences is an instance of **Mobius inversion** over the version lattice.

Given a function f: V -> G (where G is an Abelian group) and the **zeta function** zeta(u, v) = 1 if u <= v, 0 otherwise:

```
F(v) = Sum over {u : u <= v} of f(u)          (zeta transform / summation)
f(v) = Sum over {u : u <= v} of mu(u, v) * F(u)  (Mobius inversion)
```

where mu is the Mobius function of the partial order.

For the natural numbers (linear order), mu(n, m) = delta(n, m) - delta(n, m-1), recovering the standard finite difference. For product lattices, the Mobius function factors:

```
mu_{L1 x L2}((a1, b1), (a2, b2)) = mu_{L1}(a1, a2) * mu_{L2}(b1, b2)
```

This factorization is what makes multi-dimensional differencing efficient.

---

## 4. Core Data Structures in d2ts

### 4.1 MultiSet

d2ts implements `MultiSet<T>` as an array of `[value, multiplicity]` pairs:

```typescript
new MultiSet([[signal_a, 1], [signal_b, 1], [signal_a, -1]])
// After consolidation: [[signal_b, 1]]
```

Key operations:
- **Constructor**: `new MultiSet(entries: [T, number][])`
- **getInner()**: returns the array of (value, multiplicity) pairs
- **negate()**: flips all multiplicities (computes the additive inverse)
- **concat()**: unions two multisets (concatenates entries, may need consolidation)
- **map()**: transforms values while preserving multiplicities
- **filter()**: removes entries by predicate
- **flatMap()**: one-to-many value transformation

Consolidation sums multiplicities of identical values and removes zero-multiplicity entries.

### 4.2 Version

d2ts implements `Version` as a wrapper around either a single number or a number array:

```typescript
const v1 = v(42)         // 1-dimensional: simple integer timestamp
const v2 = v([3, 7])     // 2-dimensional: product lattice N x N
const v3 = v([1, 2, 5])  // 3-dimensional: N x N x N
```

The `v()` helper ensures object reuse for efficient comparisons.

Key operations:
- **lessEqual(other)**: partial order comparison (all dimensions <=)
- **lessThan(other)**: strict comparison (lessEqual and not equal)
- **join(other)**: least upper bound (componentwise max)
- **meet(other)**: greatest lower bound (componentwise min)
- **equals(other)**: equality

For multi-dimensional versions (a1, a2, ..., an) and (b1, b2, ..., bn):
- (a1, ..., an) <= (b1, ..., bn) iff a_i <= b_i for all i
- (a1, ..., an) v (b1, ..., bn) = (max(a1, b1), ..., max(an, bn))
- (a1, ..., an) ^ (b1, ..., bn) = (min(a1, b1), ..., min(an, bn))

### 4.3 Antichain

d2ts implements `Antichain` as a set of incomparable `Version` objects:

```typescript
const frontier = new Antichain([v([3, 0]), v([1, 5])])
// These are incomparable: (3,0) || (1,5)
// Neither (3,0) <= (1,5) nor (1,5) <= (3,0)
```

Key operations:
- **lessEqual(version)**: true if ANY element of the antichain is <= version
- **lessEqualAntichain(other)**: antichain ordering
- **elements()**: the set of incomparable versions
- **meet(other)**: greatest lower bound of two antichains

The frontier represents a commitment: "no data will arrive at any version v where frontier.lessEqual(v) is false." Equivalently, all future data will be at versions in the upper set of the frontier.

### 4.4 Index (Arranged State)

The `Index` stores versioned state for stateful operators:

```
Key -> Version -> [(Value, Multiplicity)]
```

Key operations:
- **addValue(key, version, value, multiplicity)**: insert an update
- **reconstructAt(key, version)**: compute the state at a given version by summing all differences at versions <= the given version
- **compact(frontier)**: merge differences at old versions, reducing memory usage while preserving correctness for all versions >= frontier

The Index corresponds to the "arrange" operation in McSherry's Rust differential-dataflow library. It enables efficient lookups for the join and reduce operators.

---

## 5. Operator Semantics

### 5.1 Linear Operators

**Definition (Linear Operator).** An operator L is linear if:

```
L(C1 + C2) = L(C1) + L(C2)
```

where + is the Abelian group operation on collections.

Linear operators can be applied directly to differences without maintaining state:

```
Difference_out[v] = L(Difference_in[v])
```

**Linear operators in d2ts**:
- `map(f)`: transforms each element, preserving multiplicity
- `filter(p)`: retains elements satisfying predicate, preserving multiplicity
- `negate()`: flips all multiplicities
- `concat()`: union of two collections (bilinear)

### 5.2 Non-Linear Operators

Non-linear operators (reduce, distinct, count, topK) require maintaining state because the output depends on the accumulated collection, not just the current difference.

**Reduce semantics**: Given input keyed by K:

```
Output[v] = Reduce(K, AccumulatedInput[v])
```

where `AccumulatedInput[v] = Sum over {u <= v} of Difference_in[u]`.

The output difference at version v is:

```
Difference_out[v] = Output[v] - Output[v']
```

where v' is the "previous" version (the latest version < v at which the input changed).

In practice, the operator maintains an `Index` of accumulated input and output, and for each version where the input changes, it:
1. Reconstructs the accumulated input at that version
2. Applies the reduce function
3. Computes the difference from the previous output
4. Emits the output difference

### 5.3 Join Operator (Bilinear)

**Definition (Join).** The join of two keyed collections A and B is:

```
(A join B)(k, (a, b)) = A(k, a) * B(k, b)
```

for each key k, the multiplicity of output pair (a, b) is the product of the multiplicities of a in A and b in B (both under key k).

The join is **bilinear**: given deltas dA and dB:

```
(A + dA) join (B + dB) = A join B + dA join B + A join dB + dA join dB
```

So the output delta is:

```
d(A join B) = dA join B + A join dB + dA join dB
```

The `JoinOperator` in d2ts maintains two `Index` instances (for A and B state) and when processing deltas:
1. Joins new delta_A against accumulated B state
2. Joins accumulated A state against new delta_B
3. Joins delta_A against delta_B
4. Sums all three contributions as the output delta

d2ts supports join types: `inner`, `left`, `right`, `full`.

### 5.4 Iterate Operator (Fixed-Point)

**Definition (Iterate).** The iterate operator takes a function F and computes the least fixed point:

```
X = F(X) union Input
```

In differential dataflow, iteration is modeled by extending the version space with an additional dimension for the iteration count. For a version space V, the iterate body operates over V x N, where N is the natural number iteration counter.

The iteration converges when no new differences are produced: the output stabilizes at a fixed point.

**d2ts iterate** creates a feedback loop where the output of the body function is fed back as input for the next iteration step. The frontier of the iteration scope advances as inner iterations stabilize.

### 5.5 Consolidate Operator

The consolidate operator merges all entries with the same `(data, version)` pair by summing their multiplicities, and removes entries with zero multiplicity:

```
Consolidate({(d, v, m1), (d, v, m2), ...}) = {(d, v, m1 + m2 + ...)}
  if m1 + m2 + ... != 0
```

This is essential for keeping the trace compact and is the computational manifestation of the Abelian group's cancellation property.

---

## 6. Frontier Advancement Protocol

### 6.1 Frontier Semantics

A frontier F is an antichain of versions representing a lower bound on future data:

```
"I will never send data at any version v where NOT (F <= v)"
```

Equivalently: all future versions will be in the upset of F.

### 6.2 Input Frontier Protocol

For d2ts input streams:
1. `sendData(version, multiset)` — sends data at a specific version
2. `sendFrontier(frontier)` — advances the frontier, promising no more data below

The frontier MUST advance monotonically (the set of "possible future versions" shrinks over time).

### 6.3 Operator Frontier Propagation

Each operator computes its output frontier from its input frontier(s):
- **Unary operators**: output frontier = input frontier
- **Binary operators (join)**: output frontier = meet of input frontiers
- **Iterate**: output frontier depends on inner graph convergence

When an operator's input frontier advances, versions below the new frontier are "complete" — they will never change. This allows:
1. **Processing**: compute output for completed versions
2. **Compaction**: merge old versions in the Index to reclaim memory

### 6.4 Compaction

Given a frontier F (the `since` frontier in Materialize terminology), the Index can compact all versions below F into F itself:

```
For each update (data, version, diff) where version < F:
  new_version = meet(join(version, f) for each f in F)
  relocate (data, version, diff) -> (data, new_version, diff)
Then consolidate: sum diffs for identical (data, new_version) pairs
```

This preserves correctness: for any readable version v >= F, the read result is unchanged.

---

## 7. Connection to CRDTs

### 7.1 Semilattice Merge

A Conflict-free Replicated Data Type (CRDT) [SHAPIRO-2011] relies on a join-semilattice merge function that is:
- **Commutative**: merge(a, b) = merge(b, a)
- **Associative**: merge(a, merge(b, c)) = merge(merge(a, b), c)
- **Idempotent**: merge(a, a) = a

State-based CRDTs (CvRDTs) converge because the merge operation computes the least upper bound in a join-semilattice.

### 7.2 Shared Lattice Structure

Both CRDTs and differential dataflow rely on lattice theory:

| Concept | CRDTs | Differential Dataflow |
|---------|-------|----------------------|
| **Lattice domain** | State values | Version timestamps |
| **Merge/Join** | Merge two replica states (LUB) | Join two versions (LUB) |
| **Monotonicity** | State only grows (in lattice order) | Frontiers only advance |
| **Convergence** | All replicas reach same state | All operators reach consistent output |

### 7.3 Differences

The connection is structural, not operational:
- CRDTs use semilattice on **data values** for conflict resolution
- Differential dataflow uses lattice on **versions/timestamps** for causal ordering
- CRDTs merge states; differential dataflow merges differences

### 7.4 Frontier as CRDT

The frontier (antichain) itself behaves like a CvRDT:
- The antichain lattice has a join (meet of antichains, which is the GLB of the upper sets)
- Frontier advancement is monotonic in the antichain lattice
- Multiple sources can independently advance their frontiers, and the combined frontier is the meet

---

## 8. Connection to MVCC

### 8.1 Multi-Version Concurrency Control

MVCC maintains multiple versions of data items, each tagged with a timestamp. Reads are directed to the appropriate version based on the transaction's snapshot.

### 8.2 Differential Dataflow as Generalized MVCC

Differential dataflow generalizes MVCC in two key ways:

1. **Partially ordered versions**: MVCC typically uses linearly ordered timestamps (transaction IDs). Differential dataflow uses partially ordered versions, enabling concurrent updates from independent sources.

2. **Differences instead of snapshots**: MVCC stores full snapshots at each version. Differential dataflow stores only the differences, enabling efficient incremental updates.

The `Index.reconstructAt(key, version)` operation in d2ts is analogous to an MVCC snapshot read: it computes the state at a given version by accumulating all relevant differences.

### 8.3 Tsingou's Version Tuple as MVCC

Tsingou's `[tick, source_seq]` version tuple provides MVCC-like semantics:
- **tick** = global logical clock (analogous to MVCC commit timestamp)
- **source_seq** = per-source sequence (analogous to per-writer version)
- A "read" at version (t, s) sees all updates at versions (t', s') where t' <= t AND s' <= s
- Concurrent sources (different source_seq dimensions) do not block each other

---

## 9. Tsingou-Specific Application

### 9.1 Version Tuple Semantics

From `graph/version.ts`:

```typescript
// Dimension 0: global logical tick (processing cycle counter)
// Dimension 1: per-source sequence number
export const makeVersion = (tick: number, sourceSeq: number): [number, number] =>
  [tick, sourceSeq]
```

The `compareVersions` function implements the product lattice partial order:
- (t1, s1) <= (t2, s2) iff t1 <= t2 AND s1 <= s2
- (t1, s1) || (t2, s2) if t1 < t2 AND s1 > s2 (or vice versa) — concurrent

### 9.2 MultiSet Signal Encoding

From `graph/multiset-helpers.ts`:

```typescript
// Insert: +1 multiplicity
export const fromSignal = (signal: BaseSignal): MultiSet<BaseSignal> => ({
  inner: [[signal, 1]],
})

// Retract: -1 multiplicity (source disconnect, explicit withdrawal)
export const retractSignal = (signal: BaseSignal): MultiSet<BaseSignal> => ({
  inner: [[signal, -1]],
})
```

ADR-001 specifies **event accumulation (+1 only)** as the default mode. Retractions (-1) are only for explicit withdrawals (source disconnect, data correction). This is an append-mostly pattern where the multiset grows monotonically under normal operation.

### 9.3 Tiered Graph Topology

Tsingou uses a two-tier graph:

**Tier 1: Ingest Graph** (`graph/ingest.ts`)
- Linear operators only: filter (validate), map (normalize, tag)
- No state maintenance needed
- Output: normalized `MultiSet<BaseSignal>`

**Tier 2: Derived Graph** (`graph/derived.ts`)
- Stateful operators: join (cross-source correlation), reduce (aggregation), count, topK, window
- Maintains Index for state
- Output: derived state collections

This separation is architecturally significant: the ingest tier can process at wire speed (linear operators are O(n) in the delta size), while the derived tier may be more expensive (join is O(delta * state)).

### 9.4 Frontier Advancement in Tsingou

From `FLOW_ARCHITECTURE.md` Section 5.2:

```typescript
// Each processing cycle:
tick++
ingestInput.sendData(v([tick, 0]), batchToMultiSet(signals))
ingestInput.sendFrontier(v([tick + 1, 0]))
```

The frontier advances one tick per processing cycle, committing the previous tick's data. Source sequences could advance independently via the second dimension, enabling concurrent source ingestion without serialization.

---

## 10. Formal Properties and Correctness Guarantees

### 10.1 Eventual Consistency

Differential dataflow provides **eventual consistency** of the output trace with respect to the input trace: given the same input differences (regardless of arrival order), the output differences converge to the same result.

This follows from:
1. The Abelian group structure on collections (commutativity of addition)
2. The monotonic frontier advancement protocol (no "going back in time")
3. The well-founded partial order on versions (all computations terminate)

### 10.2 Determinism

Given the same set of (data, version, diff) triples, the output is deterministic. The partial order ensures that the processing order of differences respects causality, and the Abelian group structure ensures that commutative reordering within a version produces identical results.

### 10.3 Incremental Correctness

For any operator O and input trace T:

```
O(T)[v] = O_batch(T[v])
```

The incremental output at version v is identical to the batch output when given the full accumulated input at version v. This is the fundamental correctness guarantee: incrementalism does not change the result.

### 10.4 Memory Bounds (with Compaction)

Without compaction, the Index grows without bound. With frontier-based compaction:
- Memory is proportional to the number of distinct (data, version) pairs where version >= frontier
- Old versions are merged, reducing the trace to a single "compacted" version per datum
- Compaction preserves correctness for all readable versions (>= frontier)

---

## 11. Complexity Analysis

### 11.1 Operator Complexity

| Operator | Time (per update) | Space | Notes |
|----------|-------------------|-------|-------|
| map | O(1) per element | O(1) | Linear — no state |
| filter | O(1) per element | O(1) | Linear — no state |
| consolidate | O(n log n) | O(n) | Sort + merge |
| join | O(delta * state) | O(state_A + state_B) | Two Index instances |
| reduce | O(delta * group_size) | O(state) | One Index per key |
| iterate | O(delta * iterations) | O(state) | Until convergence |
| distinct | O(delta) | O(state) | Special case of reduce |
| count | O(delta) | O(state) | Special case of reduce |

### 11.2 Frontier Management

Frontier operations on antichains:
- **Advance**: O(|antichain|) to check and update
- **Meet of two antichains**: O(|A1| * |A2|) for pairwise comparison + minimal element extraction
- **lessEqual check**: O(|antichain|) worst case

For Tsingou's 2-dimensional versions, |antichain| is bounded by the number of active sources.

---

## 12. Open Research Questions

### 12.1 Scale at High Signal Rates

d2ts performance at >10k signals/sec is untested (noted in ADR-001). The join operator's O(delta * state) complexity could become a bottleneck for cross-source correlation with large accumulated state.

### 12.2 Persistence and Recovery

d2ts supports optional SQLite-backed Index for persistence. Tsingou plans to use NATS JetStream for signal persistence. The interaction between d2ts's internal persistence and NATS's external persistence needs careful design.

### 12.3 Dynamic Graph Topology

Tsingou requires hot-plug source adapters (runtime add/remove). This maps to adding/removing input streams in the d2ts graph. The current d2ts `graph.finalize()` model may not support dynamic topology changes.

### 12.4 Custom Operator Development

Tsingou needs custom operators (window, throttle, schema-validate). These must correctly implement the frontier protocol and maintain the incremental correctness invariant.

---

## 13. Bibliography

| Key | Full Citation |
|-----|--------------|
| [MCSHERRY-CIDR2013] | McSherry, F., Murray, D.G., Isaacs, R., Isard, M. "Differential Dataflow." CIDR 2013. |
| [ABADI-FOSSACS2015] | Abadi, M., McSherry, F., Plotkin, G. "Foundations of Differential Dataflow." FoSSaCS 2015, LNCS 9034, pp. 71-83. |
| [MURRAY-SOSP2013] | Murray, D.G., McSherry, F., Isaacs, R., Isard, M., Barham, P., Abadi, M. "Naiad: A Timely Dataflow System." SOSP 2013, pp. 439-455. |
| [MATERIALIZE-FORMALISM] | Materialize Inc. "Platform Formalism." doc/developer/platform/formalism.md, 2024. |
| [MATERIALIZE-SCRATCH] | Materialize Inc. "Building Differential Dataflow from Scratch." Blog, 2020. |
| [SHAPIRO-2011] | Shapiro, M., Preguica, N., Baquero, C., Zawirski, M. "Conflict-free Replicated Data Types." SSS 2011, LNCS 6976, pp. 386-400. |
| [D2TS-REPO] | Electric SQL. "d2ts: Differential Dataflow in TypeScript." github.com/electric-sql/d2ts, 2024. |
| [DAVEY-PRIESTLEY] | Davey, B.A., Priestley, H.A. "Introduction to Lattices and Order." 2nd ed., Cambridge University Press, 2002. |
| [BIRKHOFF-1967] | Birkhoff, G. "Lattice Theory." 3rd ed., AMS Colloquium Publications, 1967. |
| [ROTA-1964] | Rota, G.-C. "On the Foundations of Combinatorial Theory I. Theory of Mobius Functions." Zeitschrift fur Wahrscheinlichkeitstheorie, 2(4), pp. 340-368, 1964. |
| [LAMPORT-1978] | Lamport, L. "Time, Clocks, and the Ordering of Events in a Distributed System." CACM, 21(7), pp. 558-565, 1978. |
| [FIDGE-1988] | Fidge, C.J. "Timestamps in Message-Passing Systems That Preserve the Partial Ordering." Australian Computer Science Communications, 10(1), pp. 56-66, 1988. |
| [MATTERN-1989] | Mattern, F. "Virtual Time and Global States of Distributed Systems." Proc. Workshop on Parallel and Distributed Algorithms, pp. 215-226, 1989. |
| [BERNSTEIN-MVCC] | Bernstein, P.A., Goodman, N. "Multiversion Concurrency Control — Theory and Algorithms." ACM TODS, 8(4), pp. 465-483, 1983. |
