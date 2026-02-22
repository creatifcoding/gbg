# RFC-002 Section TSG.26: Differential Dataflow Theory

```
Section:       TSG.26 — Differential Dataflow Theory
Parent RFC:    RFC-002 (Tsingou SIGINT Visualization Platform Specification)
Status:        DRAFT
Author:        diff-dataflow-theorist (Val team)
Created:       2026-02-18
Research Base: research-differential-dataflow.md (13 sections, 15 citations)
Part:          VI — Analysis & Mathematics
```

> This section establishes the mathematical foundations of differential dataflow as
> implemented in Tsingou's signal processing backbone. Differential dataflow provides
> the formal basis for incremental computation over partially ordered time, enabling
> multi-source signal correlation, temporal windowing, and anomaly detection without
> full recomputation. Implementations MUST satisfy the algebraic invariants specified
> herein. The key words "MUST", "MUST NOT", "SHOULD", "SHOULD NOT", and "MAY" are
> to be interpreted as described in [RFC2119] and [RFC8174].

---

## Table of Contents

1. [Overview and Motivation](#1-overview-and-motivation)
2. [Mathematical Prerequisites: Order Theory](#2-mathematical-prerequisites-order-theory)
3. [Mathematical Prerequisites: Algebraic Structures](#3-mathematical-prerequisites-algebraic-structures)
4. [The Differential Dataflow Model](#4-the-differential-dataflow-model)
5. [Core Data Structures](#5-core-data-structures)
6. [Operator Algebra](#6-operator-algebra)
7. [Frontier Advancement Protocol](#7-frontier-advancement-protocol)
8. [State Management and Compaction](#8-state-management-and-compaction)
9. [Tsingou Version Semantics](#9-tsingou-version-semantics)
10. [Tsingou Signal Encoding](#10-tsingou-signal-encoding)
11. [Tsingou Graph Topology](#11-tsingou-graph-topology)
12. [Connections to Related Formalisms](#12-connections-to-related-formalisms)
13. [Correctness Properties](#13-correctness-properties)
14. [Complexity and Performance Bounds](#14-complexity-and-performance-bounds)
15. [Normative Requirements](#15-normative-requirements)
16. [Open Questions](#16-open-questions)
17. [Bibliography](#17-bibliography)

---

## 1. Overview and Motivation

### 1.1 The Incremental Computation Problem

Tsingou ingests signals from multiple heterogeneous sources — NATS subjects, HTTP endpoints,
serial devices, WebSocket streams, RSS feeds — and computes derived state through cross-source
correlation, temporal windowing, aggregation, and anomaly detection (see TSG.7 for the signal
pipeline architecture).

The naive approach recomputes all derived state from scratch whenever any input changes. For a
system processing thousands of signals per second from dozens of concurrent sources, this is
computationally intractable. The system MUST support **incremental computation**: when a small
change occurs in the input, only the affected portion of the output is recomputed.

Classical incremental view maintenance [GUPTA-IVM] solves this problem for linearly ordered
time (transaction sequences in databases). Tsingou's multi-source architecture requires a
generalization: signals from independent sources arrive with **partially ordered** timestamps,
where two signals from different sources may be concurrent (neither causally precedes the other).

### 1.2 Differential Dataflow

Differential dataflow [MCSHERRY-CIDR2013] provides this generalization. The key insight is that
**collections can be represented as functions from data elements to integer multiplicities**, and
computation over these collections can be expressed as **versioned differences indexed by elements
of a partially ordered set**.

This yields three critical capabilities:

1. **Incremental updates**: When input changes, only the differences propagate through the
   computation graph. Unchanged portions of the output are not recomputed.

2. **Partially ordered time**: Multiple independent sources advance their own version
   coordinates without blocking each other. Cross-source operators (join, correlate) produce
   output when sufficient input from all sources has arrived.

3. **Nested iteration**: Fixed-point computations (convergence loops, iterative refinement)
   are expressed by extending the version space with an iteration dimension, using the same
   differential machinery.

### 1.3 d2ts as Implementation

Tsingou's signal pipeline is built on d2ts (`@electric-sql/d2ts`) [D2TS-REPO], a TypeScript
implementation of differential dataflow derived from the Materialize "Differential Dataflow
from Scratch" reconstruction [MATERIALIZE-SCRATCH]. ADR-001 [ADR-001] documents the decision
to adopt d2ts as the signal processing backbone, rejecting both the hand-rolled imperative
pipeline inherited from nw_wrld and the simpler d2mini variant.

d2ts implements the full differential dataflow model:
- Multi-dimensional versioning via product lattices
- Frontier-based progress tracking via antichains
- Stateful operators (join, reduce) with indexed state
- The iterate operator for fixed-point computation

This section formalizes the mathematical model that d2ts implements and specifies how Tsingou
applies it to multi-source signal processing.

---

## 2. Mathematical Prerequisites: Order Theory

### 2.1 Partial Orders

**Definition 2.1 (Partial Order).** A partial order is a pair (S, <=) where S is a set and
<= is a binary relation on S satisfying three axioms:

```
(PO1) Reflexivity:     For all a in S: a <= a
(PO2) Antisymmetry:    For all a, b in S: if a <= b and b <= a then a = b
(PO3) Transitivity:    For all a, b, c in S: if a <= b and b <= c then a <= c
```

The **strict order** < is defined by: a < b iff a <= b and a != b.

Two elements a, b are **comparable** if a <= b or b <= a. They are **incomparable** (written
a || b) if neither a <= b nor b <= a holds.

A **total order** is a partial order where all pairs are comparable. A **partial order that is
not total** contains at least one pair of incomparable elements.

**Remark (Significance).** Version spaces in differential dataflow are partially ordered. Two
signals from independent sources have incomparable versions, reflecting the physical reality
that neither causally precedes the other [LAMPORT-1978].

### 2.2 Lattice Structures

**Definition 2.2 (Join-Semilattice).** A partial order (S, <=) is a join-semilattice if every
pair of elements a, b in S has a least upper bound, denoted a v b (the **join**), satisfying:

```
(JS1) Upper bound:      a <= a v b  and  b <= a v b
(JS2) Least:            If a <= c and b <= c then a v b <= c
```

**Definition 2.3 (Meet-Semilattice).** A partial order (S, <=) is a meet-semilattice if every
pair of elements a, b in S has a greatest lower bound, denoted a ^ b (the **meet**), satisfying:

```
(MS1) Lower bound:      a ^ b <= a  and  a ^ b <= b
(MS2) Greatest:         If c <= a and c <= b then c <= a ^ b
```

**Definition 2.4 (Lattice).** A partial order that is both a join-semilattice and a
meet-semilattice is a lattice. Both operations are:
- **Commutative**: a v b = b v a, a ^ b = b ^ a
- **Associative**: (a v b) v c = a v (b v c), (a ^ b) ^ c = a ^ (b ^ c)
- **Idempotent**: a v a = a, a ^ a = a
- **Absorptive**: a v (a ^ b) = a, a ^ (a v b) = a

**Definition 2.5 (Complete Lattice).** A lattice is complete if every subset S' of S has a
join (V S') and a meet (^ S'). A complete lattice has a least element (bottom, written _|_)
and a greatest element (top, written T).

**Definition 2.6 (Bounded Lattice).** A lattice with a least element _|_ and a greatest
element T. Every finite lattice is bounded; every complete lattice is bounded.

### 2.3 Product Lattices

**Definition 2.7 (Product Lattice).** Given lattices (L1, <=_1) and (L2, <=_2), their product
L1 x L2 is a lattice with:

```
Elements:  (a, b) where a in L1 and b in L2
Order:     (a1, b1) <= (a2, b2)  iff  a1 <=_1 a2  AND  b1 <=_2 b2
Join:      (a1, b1) v (a2, b2)   =   (a1 v_1 a2, b1 v_2 b2)
Meet:      (a1, b1) ^ (a2, b2)   =   (a1 ^_1 a2, b1 ^_2 b2)
```

**Theorem 2.1.** The product of two lattices is a lattice. The product of two complete lattices
is a complete lattice. The product of n lattices (iterated binary product) is a lattice.

**Proof sketch.** The lattice axioms (reflexivity, antisymmetry, transitivity, existence of
joins and meets) are preserved componentwise. Join is componentwise maximum; meet is
componentwise minimum.

**Remark.** Product lattices introduce incomparability: (2, 3) || (3, 2) in N x N. This is
the formal basis for concurrent multi-source versioning.

### 2.4 Antichains

**Definition 2.8 (Antichain).** An antichain in a partial order (S, <=) is a subset A of S
where no two distinct elements are comparable:

```
For all a, b in A: if a != b then a || b  (neither a <= b nor b <= a)
```

**Definition 2.9 (Downward Closure / Ideal).** The downward closure of a set A is:

```
down(A) = {x in S : there exists a in A with x <= a}
```

**Definition 2.10 (Upper Set / Upset).** The upper set (upset) of a set A is:

```
up(A) = {x in S : there exists a in A with a <= x}
```

**Theorem 2.2 (Antichain-Upset Bijection).** In a well-founded lattice, there is a bijection
between antichains and upsets: each upset has a unique antichain of minimal elements, and each
antichain generates a unique upset. This bijection preserves order when the antichains are
ordered by:

```
A1 <= A2  iff  up(A2) is a subset of up(A1)
```

(Note the reversal: a "smaller" antichain represents a "larger" upset — more versions are
possible.)

**Theorem 2.3 (Antichain Lattice).** The set of antichains in a lattice L, ordered by the
antichain ordering above, forms a lattice. The meet of two antichains A1 and A2 is computed by:

```
A1 meet A2 = minimal elements of (A1 union A2)
```

This removes any element of A1 that is dominated by an element of A2, and vice versa, and any
elements from the same antichain that become dominated after union.

### 2.5 Well-Foundedness

**Definition 2.11 (Well-Founded Order).** A partial order (S, <=) is well-founded if every
non-empty subset has a minimal element. Equivalently, there is no infinite strictly descending
chain:

```
There is NO sequence a1 > a2 > a3 > ... (infinite strictly decreasing)
```

**Remark (Significance).** Well-foundedness is a necessary condition for differential dataflow
to terminate. The computation of differences at version v depends on all differences at versions
u < v. Well-foundedness ensures this dependency is finite, enabling inductive computation. The
natural numbers N under <= are well-founded. The product N x N is well-founded. The integers Z
under <= are NOT well-founded (... < -2 < -1 < 0).

---

## 3. Mathematical Prerequisites: Algebraic Structures

### 3.1 Abelian Groups

**Definition 3.1 (Abelian Group).** An Abelian group is a set G with a binary operation + and
a distinguished element 0, satisfying:

```
(AG1) Associativity:     (a + b) + c = a + (b + c)
(AG2) Commutativity:     a + b = b + a
(AG3) Identity:          a + 0 = a
(AG4) Inverse:           For all a, exists -a such that a + (-a) = 0
```

### 3.2 Collections as an Abelian Group

**Definition 3.2 (Collection Group).** Fix a data domain D. The set of collections over D is:

```
Col(D) = {C : D -> Z | C has finite support}
```

where "finite support" means {d in D : C(d) != 0} is finite. Col(D) forms an Abelian group under
pointwise addition:

```
(C1 + C2)(d) = C1(d) + C2(d)           (addition)
0(d)         = 0  for all d              (zero / empty collection)
(-C)(d)      = -C(d)                     (additive inverse / negation)
```

The value C(d) is the **multiplicity** of element d in collection C:
- C(d) > 0: element d is present with positive multiplicity
- C(d) = 0: element d is absent
- C(d) < 0: element d is "over-retracted" (a transient computational state during
  incremental updates; MUST resolve to >= 0 at stable versions)

**Remark.** The choice of Z (integers) rather than N (naturals) is deliberate and essential.
Subtraction of collections — the mathematical basis of "differencing" — requires the inverse
operation. The natural numbers do not form a group (no inverses), so they cannot support
differential computation.

### 3.3 Group-Valued Functions on Partially Ordered Sets

**Definition 3.3 (Group-Valued Function).** Given a partially ordered set (V, <=) and an
Abelian group (G, +, 0), a group-valued function is:

```
f : V -> G
```

The set of all such functions (with finite support) forms an Abelian group under pointwise
addition.

**Remark.** A trace (Definition 4.2) is a group-valued function from the version poset V to
the collection group Col(D). The Abelian group structure enables differences to be added and
subtracted along any path in the partial order.

---

## 4. The Differential Dataflow Model

### 4.1 Collections

**Definition 4.1 (Collection at a Version).** Given a version space (V, <=) and a data
domain D, a **collection function** assigns a collection to each version:

```
C : V -> Col(D)
```

The collection C(v) at version v represents the "state of the data" at that version — the
multiset of all data elements with their multiplicities as of version v.

### 4.2 Traces and Differences

**Definition 4.2 (Trace / Difference Function).** The difference function (trace) associated
with a collection function C is:

```
delta : V -> Col(D)
```

defined by the Mobius inversion of C over the partial order (V, <=):

```
delta(v) = C(v) - Sum over {u in V : u < v} delta(u)
```

Equivalently (zeta transform):

```
C(v) = Sum over {u in V : u <= v} delta(u)
```

The collection at any version v is the accumulated sum of all differences at versions u <= v.
This is the fundamental equation of differential dataflow.

**Definition 4.3 (Update Triple).** An individual update is a triple:

```
(d, v, m) in D x V x Z
```

where d is a data element, v is a version, and m is the change in multiplicity.

A trace is represented as a finite set of update triples. The collection at version v is:

```
C(v)(d) = Sum over {(d, u, m) : u <= v} m
```

### 4.3 Mobius Inversion

**Definition 4.4 (Mobius Function).** For a locally finite partial order (V, <=), the Mobius
function mu: V x V -> Z is defined recursively:

```
mu(v, v) = 1
mu(u, v) = - Sum over {w : u <= w < v} mu(u, w)    if u < v
mu(u, v) = 0                                         if u is not <= v
```

The relationship between the collection function C and the difference function delta is an
instance of Mobius inversion [ROTA-1964]:

```
C(v) = Sum over {u <= v} delta(u)                    (zeta transform)
delta(v) = Sum over {u <= v} mu(u, v) * C(u)         (Mobius inversion)
```

**Theorem 4.1 (Product Lattice Factorization).** For the product lattice V1 x V2, the Mobius
function factors:

```
mu_{V1 x V2}((a1, b1), (a2, b2)) = mu_{V1}(a1, a2) * mu_{V2}(b1, b2)
```

For the natural numbers, mu_N(a, b) = 1 if a = b, -1 if b = a + 1, 0 otherwise. Therefore
for Tsingou's N x N version space:

```
mu((t1, s1), (t2, s2)) = mu_N(t1, t2) * mu_N(s1, s2)
```

This factorization enables efficient multi-dimensional differencing: the difference at version
(t, s) depends only on the differences at the four corners of the rectangle
{(t', s') : t-1 <= t' <= t, s-1 <= s' <= s} in the immediate case, or more generally on
the Mobius-weighted sum over the interval [bottom, (t, s)].

### 4.4 The Dataflow Graph

**Definition 4.5 (Dataflow Graph).** A differential dataflow graph is a directed acyclic graph
(DAG) where:
- **Nodes** are operators (map, filter, join, reduce, iterate, consolidate)
- **Edges** carry versioned difference streams (sequences of (MultiSet, Version) pairs)
- **Input nodes** receive external data via `sendData(version, multiset)`
- **Output nodes** emit results via callback

Each operator consumes versioned differences on its input edges and produces versioned
differences on its output edges. The operator MUST guarantee:

```
For all versions v:
  output_collection(v) = operator_function(input_collection(v))
```

where `input_collection(v) = Sum over {u <= v} input_delta(u)` and similarly for output.

---

## 5. Core Data Structures

### 5.1 MultiSet

The `MultiSet<T>` type implements the collection group Col(D) for a data domain D = T.

**Representation.** An array of (value, multiplicity) pairs:

```
MultiSet<T> = Array<[T, number]>
```

Multiple entries for the same value may exist; consolidation sums their multiplicities.

**Operations.** The following operations MUST be supported:

| Operation | Definition | Algebraic Interpretation |
|-----------|-----------|-------------------------|
| `new MultiSet(entries)` | Construct from (value, mult) pairs | Element of Col(D) |
| `getInner()` | Return entries array | Representation access |
| `negate()` | Flip all multiplicities | Additive inverse: -C |
| `concat(other)` | Concatenate entries | Group addition: C1 + C2 |
| `map(f)` | Transform values, preserve mults | Functorial lift |
| `filter(p)` | Remove non-matching entries | Projection |
| `flatMap(f)` | One-to-many transformation | Monadic bind |
| `consolidate()` | Sum mults for identical values, remove zeros | Canonical form |

**Invariant (Consolidation).** After consolidation, no two entries share the same value, and
no entry has multiplicity zero:

```
Post(consolidate(M)):
  For all i, j: if i != j then M.inner[i][0] != M.inner[j][0]
  For all i: M.inner[i][1] != 0
```

### 5.2 Version

The `Version` type implements elements of the version lattice.

**Representation.** Either a single number (1-dimensional) or a number array (n-dimensional):

```
Version = number | number[]
```

The `v()` helper function creates Version instances with object reuse for efficient equality
comparison.

**Operations.** The following lattice operations MUST be supported:

| Operation | Definition | Formal |
|-----------|-----------|--------|
| `v(n)` | Create 1-D version | Element of N |
| `v([n1, n2, ...])` | Create n-D version | Element of N^k |
| `lessEqual(other)` | Partial order test | a <= b |
| `lessThan(other)` | Strict order test | a < b (a <= b and a != b) |
| `join(other)` | Least upper bound | a v b = componentwise max |
| `meet(other)` | Greatest lower bound | a ^ b = componentwise min |
| `equals(other)` | Equality test | a = b |

**Multi-Dimensional Order.** For k-dimensional versions a = (a_1, ..., a_k) and
b = (b_1, ..., b_k):

```
a <= b      iff   a_i <= b_i  for all i in {1, ..., k}
a v b       =     (max(a_1, b_1), ..., max(a_k, b_k))
a ^ b       =     (min(a_1, b_1), ..., min(a_k, b_k))
a || b      iff   exists i, j: a_i < b_i and a_j > b_j
```

### 5.3 Antichain

The `Antichain` type implements frontiers as antichains of versions.

**Representation.** A set of mutually incomparable Version instances:

```
Antichain = Set<Version>
```

**Invariant.** No two elements of an Antichain are comparable:

```
For all a, b in antichain: if a != b then a || b
```

**Operations.**

| Operation | Definition | Purpose |
|-----------|-----------|---------|
| `new Antichain(versions)` | Construct, removing dominated elements | Create frontier |
| `lessEqual(version)` | True if any element <= version | Version completeness test |
| `lessEqualAntichain(other)` | Antichain ordering | Frontier comparison |
| `elements()` | Return version set | Access elements |
| `meet(other)` | GLB of two antichains | Combined frontier |

**Frontier Interpretation.** An antichain F partitions the version space into:
- **Complete versions**: {v : F.lessEqual(v) is false} — these versions are finalized
- **Possible future versions**: up(F) = {v : exists f in F with f <= v} — data may still arrive

### 5.4 Index (Arranged Trace)

The `Index` type implements versioned state storage for stateful operators.

**Representation.** A nested mapping:

```
Index<K, V> = Map<K, Map<Version, Array<[V, number]>>>
```

Key -> Version -> list of (Value, Multiplicity) entries.

**Operations.**

| Operation | Definition | Purpose |
|-----------|-----------|---------|
| `addValue(key, version, value, mult)` | Insert update triple | Record a difference |
| `reconstructAt(key, version)` | Sum diffs at u <= version | MVCC-style snapshot read |
| `compact(frontier)` | Merge old versions below frontier | Memory reclamation |

**Correctness Invariant (Compaction).** For all versions v where frontier <= v:

```
reconstructAt(key, v) after compaction = reconstructAt(key, v) before compaction
```

Compaction MUST NOT change the observable state at any version >= the compaction frontier.

---

## 6. Operator Algebra

### 6.1 Linear Operators

**Definition 6.1 (Linear Operator).** An operator L: Col(D) -> Col(E) is linear if it
distributes over the group addition:

```
L(C1 + C2) = L(C1) + L(C2)
```

Linear operators have a critical efficiency property: they can be applied directly to
differences without maintaining state:

```
delta_out(v) = L(delta_in(v))
```

The output difference at version v depends only on the input difference at version v, not
on any accumulated state.

**Theorem 6.1.** The following d2ts operators are linear:

| Operator | Definition | Linearity Proof |
|----------|-----------|-----------------|
| `map(f)` | Apply f to each element, preserve multiplicity | map(C1+C2)(d) = sum_{f(e)=d} (C1(e)+C2(e)) = map(C1)(d) + map(C2)(d) |
| `filter(p)` | Retain elements where p holds, preserve multiplicity | filter(C1+C2)(d) = p(d)*(C1(d)+C2(d)) = filter(C1)(d) + filter(C2)(d) |
| `negate()` | Flip all multiplicities | negate(C1+C2) = -(C1+C2) = -C1 + -C2 = negate(C1) + negate(C2) |
| `concat()` | Union (bilinear in two inputs) | By definition of group addition |

**Normative Requirement.** Implementations of linear operators MUST NOT maintain per-version
state. Processing MUST be O(|delta|) per version, where |delta| is the size of the input
difference.

### 6.2 Join (Bilinear Operator)

**Definition 6.2 (Join).** Given two keyed collections A: K x D_A -> Z and B: K x D_B -> Z,
their join is:

```
(A join B)(k, (a, b)) = A(k, a) * B(k, b)
```

The output multiplicity of (k, (a, b)) is the product of the multiplicities of (k, a) in A
and (k, b) in B.

**Theorem 6.2 (Join Bilinearity).** The join is bilinear:

```
(A + dA) join (B + dB) = A join B + dA join B + A join dB + dA join dB
```

Therefore the output difference when A changes by dA and B changes by dB is:

```
d(A join B) = dA join B + A join dB + dA join dB
```

**Implementation.** The `JoinOperator` maintains two `Index` instances for accumulated state of
A and B. When processing deltas:

1. Join delta_A against accumulated B (from Index_B)
2. Join accumulated A (from Index_A) against delta_B
3. Join delta_A against delta_B
4. Sum all three contributions
5. Update both indices with the new deltas

**Join frontier.** The output frontier of a join is the meet of its input frontiers:

```
frontier_out = frontier_A meet frontier_B
```

A version is complete in the output only when it is complete in BOTH inputs.

**Join types.** d2ts supports inner, left, right, and full joins. Left/right/full joins emit
additional tuples with null values for non-matching keys, using default multiplicity rules.

### 6.3 Reduce (Non-Linear Operator)

**Definition 6.3 (Reduce).** Given a keyed collection A: K x D -> Z and a reduction function
R: (K, Col(D)) -> Col(E), the reduce output is:

```
reduce_R(A)(k, e) = R(k, A_k)(e)
```

where A_k is the sub-collection of A restricted to key k.

Reduce is NOT linear: R(A_k + dA_k) != R(A_k) + R(dA_k) in general. The output depends on
the accumulated input, not just the current difference.

**Implementation.** The `ReduceOperator` maintains an `Index` of accumulated input per key. For
each version v where the input changes:

1. Reconstruct accumulated input A_k at version v via `Index.reconstructAt(k, v)`
2. Apply reduction function R(k, A_k)
3. Compare with previous output at the most recent version u < v where key k changed
4. Emit the difference: R(k, A_k_v) - R(k, A_k_u)
5. Record the new output in the output Index

**Derived operators.** Several operators are special cases of reduce:

| Operator | Reduction Function |
|----------|-------------------|
| `distinct()` | R(k, A_k) = {(d, 1) : A_k(d) > 0} |
| `count()` | R(k, A_k) = {(k, sum of mults in A_k)} |
| `min()` / `max()` | R(k, A_k) = {(k, extremal element)} |
| `topK(n)` | R(k, A_k) = top n elements by multiplicity |

### 6.4 Consolidate

**Definition 6.4 (Consolidate).** The consolidate operator merges entries with identical
(value, version) pairs and removes entries with zero multiplicity:

```
consolidate({(d, v, m1), (d, v, m2), ...}) = {(d, v, m1 + m2 + ...)}
  filtered to exclude entries where m1 + m2 + ... = 0
```

This is the computational manifestation of the Abelian group's cancellation property:
a + (-a) = 0.

**Normative Requirement.** Implementations SHOULD consolidate at operator boundaries to prevent
unbounded trace growth. Consolidation MUST NOT change the observable semantics: the collection
at any version MUST be identical before and after consolidation.

### 6.5 Iterate (Fixed-Point Computation)

**Definition 6.5 (Iterate).** The iterate operator computes the least fixed point of a
function F over collections:

```
X* = lfp(lambda X. F(X) union Input)
```

**Version space extension.** Iteration is modeled by extending the version space with an
additional dimension for the iteration count. For a version space V, the iterate body operates
over V x N:

```
Original version: v in V
Extended version:  (v, i) in V x N  where i is the iteration index
```

The iteration converges at version v when no new differences are produced at any iteration
count beyond some i*: delta(v, i) = 0 for all i > i*.

**Convergence guarantee.** The iterate operator converges for monotone operators over finite
domains. For non-monotone operators, convergence depends on the specific reduction function
and input data.

**Normative Requirement.** Implementations MUST detect convergence (no new output differences)
and advance the iteration frontier. Implementations MUST NOT assume a fixed iteration bound;
convergence MUST be determined dynamically.

---

## 7. Frontier Advancement Protocol

### 7.1 Frontier Semantics

A frontier F is an antichain of versions that represents a lower bound on future data:

```
Invariant: After sending frontier F, the source will NEVER send data at any version v
           where F.lessEqual(v) is false.
```

Equivalently, all future data will arrive at versions in up(F).

### 7.2 Input Protocol

Input streams in d2ts support two operations:

1. **`sendData(version, multiset)`** — Send a difference at a specific version.
   The version MUST be in up(current_frontier).

2. **`sendFrontier(frontier)`** — Advance the frontier. The new frontier MUST be
   >= the current frontier in the antichain ordering (the upset shrinks).

**Monotonicity constraint.** Frontiers MUST advance monotonically:

```
For successive frontiers F1, F2:  up(F2) is a subset of up(F1)
```

The set of possible future versions can only shrink, never grow. This ensures that
"completed" versions remain completed.

### 7.3 Operator Frontier Propagation

Each operator computes its output frontier from its input frontier(s):

**Unary operators (map, filter, consolidate, reduce).** Output frontier = input frontier.
When the input frontier advances, the operator processes all newly completed versions and
advances its output frontier accordingly.

**Binary operators (join, concat).** Output frontier = meet of input frontiers:

```
frontier_out = meet(frontier_A, frontier_B)
```

A version v is complete in the join output only when it is complete in both inputs —
when both input frontiers have advanced past v.

**Iterate.** The output frontier depends on the inner graph's convergence. The iteration's
output frontier at version v advances only when the inner fixed-point computation at v
has converged (no more differences at any iteration count).

### 7.4 Graph-Level Frontier Protocol

The d2ts `D2` graph coordinates frontier advancement:

1. **Finalization**: `graph.finalize()` closes the graph topology. No new operators or
   edges can be added.

2. **Execution**: `graph.run()` processes all pending messages between operators:
   - Delivers versioned differences along edges
   - Propagates frontier advancements
   - Processes completed versions in stateful operators
   - Iterates until no more messages are pending

3. **Quiescence**: The graph reaches quiescence when all operators have processed all
   available input and no messages are in flight.

**Normative Requirement.** Implementations MUST process versions in a causally consistent
order: if u < v, then all effects of differences at version u MUST be resolved before
processing version v. This is guaranteed by the well-foundedness of the version space and
the monotonic frontier advancement protocol.

---

## 8. State Management and Compaction

### 8.1 Index Growth

Without compaction, the Index grows without bound as new versions accumulate. For long-running
Tsingou signal processing sessions, unbounded growth is unacceptable.

### 8.2 Compaction Algorithm

Compaction merges old versions below a frontier, trading temporal resolution for memory:

**Input.** An Index I and a compaction frontier F (antichain).

**Algorithm.**

```
For each key k in I:
  For each (version, entries) in I[k]:
    If NOT (F.lessEqual(version)):
      // This version is below the frontier — compact it
      new_version = meet(join(version, f) for each f in F)
      relocate entries from (key, version) to (key, new_version)
  Consolidate: sum multiplicities for identical (key, new_version, value) triples
  Remove entries with zero multiplicity
```

**Correctness.** The compaction formula `new_version = meet(join(version, f) for f in F)` is
derived from the requirement that for all readable versions v >= F, the reconstructed state
must be unchanged [MATERIALIZE-FORMALISM].

**Theorem 8.1 (Compaction Correctness).** For all keys k and versions v where F <= v:

```
reconstructAt_before(k, v) = reconstructAt_after(k, v)
```

**Proof sketch.** The compaction formula ensures that any update originally at version u < F
is relocated to a version u' where u' <= v iff u <= v, for all v >= F. Therefore the set of
updates contributing to a read at v >= F is unchanged.

### 8.3 Compaction Strategy

Implementations SHOULD compact periodically as the input frontier advances.

| Strategy | Description | Trade-off |
|----------|-----------|-----------|
| **Eager** | Compact after every frontier advancement | Minimal memory, maximum CPU |
| **Batched** | Compact every N frontier advancements | Balanced |
| **Threshold** | Compact when Index exceeds size threshold | Adaptive |

For Tsingou, the RECOMMENDED strategy is **batched** with N = 100 (compact every 100 ticks),
balancing memory usage against compaction CPU cost.

### 8.4 SQLite-Backed Index

d2ts supports an optional SQLite backend for the Index, enabling:
- Persistence across restarts
- Index sizes exceeding available memory
- Recovery from crashes

For Tsingou, the SQLite backend MAY be used for the derived graph's stateful operators (join,
reduce) when processing long-running analysis sessions.

---

## 9. Tsingou Version Semantics

### 9.1 The Version Tuple

Tsingou uses 2-dimensional versions from the product lattice N x N:

```
version = (tick, source_seq)
```

| Dimension | Name | Semantics | Advancement |
|-----------|------|-----------|-------------|
| 0 | `tick` | Global logical clock | Incremented per processing cycle |
| 1 | `source_seq` | Per-source sequence number | Incremented per source event |

**Codebase reference.** `src/lib/tsingou-flow/graph/version.ts`:

```typescript
export const TICK_DIM = 0
export const SOURCE_DIM = 1
export const makeVersion = (tick: number, sourceSeq: number): [number, number] =>
  [tick, sourceSeq]
```

### 9.2 Partial Order on Versions

The product lattice N x N induces the following partial order:

```
(t1, s1) <= (t2, s2)   iff   t1 <= t2 AND s1 <= s2
(t1, s1) || (t2, s2)   iff   (t1 < t2 AND s1 > s2) OR (t1 > t2 AND s1 < s2)
```

**Codebase reference.** `src/lib/tsingou-flow/graph/version.ts:compareVersions`:

```typescript
export const compareVersions = (
  a: [number, number],
  b: [number, number],
): -1 | 0 | 1 | null => {
  const tickCmp = Math.sign(a[TICK_DIM] - b[TICK_DIM])
  const srcCmp = Math.sign(a[SOURCE_DIM] - b[SOURCE_DIM])
  if (tickCmp === 0 && srcCmp === 0) return 0
  if (tickCmp <= 0 && srcCmp <= 0) return -1
  if (tickCmp >= 0 && srcCmp >= 0) return 1
  return null // Concurrent / incomparable
}
```

### 9.3 Version Semantics for Multi-Source Ingestion

The 2-dimensional version provides independent advancement for tick and source dimensions:

**Example.** Two sources (A and B) produce signals:

```
Source A: signal_a1 at (1, 1), signal_a2 at (2, 2)
Source B: signal_b1 at (1, 1), signal_b2 at (1, 3)

Version ordering:
  (1, 1) <= (2, 2) — a1 precedes a2
  (1, 1) <= (1, 3) — b1 precedes b2
  (2, 2) || (1, 3) — a2 and b2 are concurrent (incomparable)
```

The incomparability of (2, 2) and (1, 3) reflects that source A's second event and source B's
second event are causally independent. Neither depends on the other. A join operator receiving
both inputs produces output only when both sources have advanced sufficiently.

### 9.4 Frontier Advancement Pattern

From `FLOW_ARCHITECTURE.md` Section 5.4:

```typescript
// Each processing cycle:
tick++
ingestInput.sendData(v([tick, 0]), batchToMultiSet(signals))
ingestInput.sendFrontier(v([tick + 1, 0]))
```

The frontier advances one tick per cycle, committing the previous tick. The source_seq
dimension (second component) can be used for finer-grained advancement by individual
sources.

**Normative Requirement.** Implementations MUST advance the frontier monotonically. The
frontier MUST NOT retreat to a version that was previously marked as complete.

---

## 10. Tsingou Signal Encoding

### 10.1 Signals as MultiSet Elements

Each signal is encoded as a MultiSet entry with multiplicity +1 (insertion):

```typescript
export const fromSignal = (signal: BaseSignal): MultiSet<BaseSignal> => ({
  inner: [[signal, 1]],
})
```

Batch ingestion creates a MultiSet with one +1 entry per signal:

```typescript
export const fromBatch = (signals: ReadonlyArray<BaseSignal>): MultiSet<BaseSignal> => ({
  inner: signals.map((s) => [s, 1] as const),
})
```

**Codebase reference.** `src/lib/tsingou-flow/graph/multiset-helpers.ts`.

### 10.2 Event Accumulation Semantics

ADR-001 specifies **event accumulation (+1 only)** as the default mode:

> MultiSet semantics: Event accumulation (+1 only). Signals insert; -1 only for explicit
> retractions. [ADR-001]

This means:
- Normal signal ingestion: always +1 (append-only under normal operation)
- Explicit retraction: -1 (source disconnect, data correction, administrative removal)
- Net multiplicity: always >= 0 for any stable version (no "negative signals")

The retraction operation:

```typescript
export const retractSignal = (signal: BaseSignal): MultiSet<BaseSignal> => ({
  inner: [[signal, -1]],
})
```

**Normative Requirement.** At any version v where the frontier has advanced past v (the version
is complete), the net multiplicity of every signal MUST be >= 0. Implementations MUST NOT
produce stable states with negative multiplicities.

### 10.3 Helper Operations

| Operation | Definition | Use Case |
|-----------|-----------|----------|
| `empty<T>()` | MultiSet with no entries | Initial state |
| `merge(a, b)` | Concatenate entries | Combining multisets |
| `netCount(ms)` | Sum of all multiplicities | Cardinality |
| `activeEntries(ms)` | Filter to positive-mult entries | Active signal extraction |
| `mapMultiSet(ms, f)` | Transform values, preserve mults | Signal transformation |

---

## 11. Tsingou Graph Topology

### 11.1 Tiered Architecture

Tsingou's differential dataflow computation is organized in two tiers:

```
┌─────────────────────────────────────────────────────┐
│  TIER 1: INGEST GRAPH                               │
│                                                     │
│  AdapterManager.signalQueue                         │
│    |                                                │
│    v                                                │
│  input.sendData(version, multiset)                  │
│    |                                                │
│    v                                                │
│  filter(isValidSignal)       -- Linear: O(|delta|)  │
│    |                                                │
│    v                                                │
│  map(normalizeTimestamp)     -- Linear: O(|delta|)  │
│    |                                                │
│    v                                                │
│  map(tagWithIngestMetadata)  -- Linear: O(|delta|)  │
│    |                                                │
│    v                                                │
│  consolidate()               -- O(|delta| log |d|)  │
│    |                                                │
│    v                                                │
│  output: MultiSet<BaseSignal> (normalized)          │
└──────────────────────┬──────────────────────────────┘
                       |
┌──────────────────────v──────────────────────────────┐
│  TIER 2: DERIVED GRAPH                              │
│                                                     │
│  Operators (configurable per session):              │
│    join     -- Cross-source correlation   O(d * s)  │
│    reduce   -- Aggregation                O(d * g)  │
│    count    -- Per-key counting           O(d)      │
│    topK     -- Frequency ranking          O(d)      │
│    window   -- Sliding time window        O(d)      │
│    throttle -- Rate limiting              O(d)      │
│    iterate  -- Convergence loops          O(d * i)  │
│                                                     │
│  output: derived state collections                  │
│    |                                                │
│    v                                                │
│  Effect.Queue -> consumer fiber -> Atom.set()       │
└─────────────────────────────────────────────────────┘
```

Where: d = delta size, s = accumulated state size, g = group size, i = iterations.

### 11.2 Ingest Graph Operators

The ingest graph uses exclusively linear operators:

1. **`filter(isValidSignal)`** — Validates signal has required fields (id, sourceId, kind,
   timestamp). Rejects malformed signals.

2. **`map(normalizeTimestamp)`** — Ensures timestamp is a valid Date; defaults to `now()`.

3. **`map(tagWithIngestMetadata)`** — Adds `_ingestedAt` and `_pipeline` metadata fields.

4. **`consolidate()`** — Merges duplicate entries (rare but possible from batch ingestion).

**Codebase reference.** `src/lib/tsingou-flow/graph/ingest.ts`.

**Normative Requirement.** The ingest graph MUST use only linear operators to ensure O(|delta|)
processing per cycle. Stateful operators MUST NOT appear in the ingest tier.

### 11.3 Derived Graph Operators

The derived graph uses both linear and stateful operators, configured per analysis session:

**Cross-source correlation (join).** Correlate signals from two sources by a shared key
(e.g., timestamp bucket, geographic region, topic). The `JoinOperator` maintains state from
both sources.

**Aggregation (reduce).** Compute aggregates (count, sum, average, top-K) over signal groups.
The `ReduceOperator` maintains accumulated input per key.

**Sliding window (custom operator).** Maintain a time-bounded view of recent signals. The
window operator emits the collection of signals within the last N milliseconds.

**Rate limiting (custom operator).** Throttle output to a maximum rate per version. Drops
excess signals to prevent output flooding.

**Codebase reference.** `src/lib/tsingou-flow/graph/derived.ts`.

### 11.4 Output Bridge

The derived graph's output connects to the Effect service layer via the Output Bridge:

```
d2ts output() -> Effect.Queue<DerivedState> -> consumer fiber -> Atom.set()
```

The consumer fiber drains the queue, batches updates, and writes to atoms. React components
subscribe to atoms via `useAtomValue()`.

**Normative Requirement.** The output bridge MUST provide backpressure. When the consumer
cannot keep up, the Effect.Queue MUST apply bounded buffering (queue capacity 256 as specified
in `FLOW_ARCHITECTURE.md`).

---

## 12. Connections to Related Formalisms

### 12.1 Version Vectors and Causal Ordering

**Version vectors** [FIDGE-1988] [MATTERN-1989] are a mechanism for tracking causality in
distributed systems. A version vector is a tuple of counters, one per process, forming an
element of the product lattice N^k.

Tsingou's `[tick, source_seq]` is a 2-dimensional version vector where:
- Dimension 0 corresponds to a global sequencer (analogous to Lamport clock)
- Dimension 1 corresponds to per-source ordering

The partial order on version vectors is identical to the product lattice order, and the
same join/meet operations apply:

```
VV(a) <= VV(b)  iff  VV(a)[i] <= VV(b)[i] for all i
```

**Key difference.** Classical version vectors use one dimension per process (source). Tsingou
uses a fixed 2-dimensional space regardless of source count. Per-source ordering is encoded in
the second dimension via source-specific sequence numbers, with the global tick providing a
synchronization point.

### 12.2 CRDTs and Semilattice Merge

Conflict-free Replicated Data Types (CRDTs) [SHAPIRO-2011] rely on join-semilattice merge
for convergent replication. The structural parallel:

| Aspect | CRDTs | Differential Dataflow |
|--------|-------|----------------------|
| Lattice domain | State values (data) | Versions (time) |
| Join operation | Merge two replicas (LUB) | Join two versions (LUB) |
| Monotonicity | State grows monotonically | Frontier advances monotonically |
| Convergence | All replicas agree (eventual) | All operators agree (eventual) |
| Commutativity | Merge is commutative | Collection addition is commutative |

**Observation.** The frontier itself behaves as a state-based CRDT: multiple sources can
independently advance their frontier contributions, and the combined frontier is computed
via meet (which is commutative, associative, and idempotent).

**Key difference.** CRDTs use semilattice structure on **data** for conflict resolution.
Differential dataflow uses lattice structure on **time** for causal ordering. CRDTs merge
states; differential dataflow sums differences.

### 12.3 Multi-Version Concurrency Control (MVCC)

MVCC [BERNSTEIN-MVCC] maintains multiple versions of data items, each tagged with a
timestamp. Reads are directed to the appropriate version based on the transaction snapshot.

Differential dataflow generalizes MVCC in two ways:

1. **Partially ordered versions**: Standard MVCC uses linearly ordered timestamps (transaction
   IDs). Differential dataflow uses partially ordered versions, enabling concurrent updates
   from independent sources without serialization.

2. **Differences instead of snapshots**: MVCC stores complete snapshots at each version.
   Differential dataflow stores only the differences (deltas), with snapshots reconstructed
   on demand by accumulation.

The `Index.reconstructAt(key, version)` operation in d2ts is the differential dataflow
analogue of an MVCC snapshot read: it computes the state at a given version by accumulating
all differences at versions u <= version.

### 12.4 Incremental View Maintenance (IVM)

Traditional IVM [GUPTA-IVM] maintains materialized database views under insert/update/delete
operations. Differential dataflow generalizes IVM:

| Aspect | Traditional IVM | Differential Dataflow |
|--------|----------------|----------------------|
| Time model | Linear (transaction sequence) | Partially ordered (lattice) |
| Delta representation | Row-level changes | MultiSet differences |
| Iteration support | None | Native (version space extension) |
| Operator algebra | Relational algebra | Abelian group morphisms |

---

## 13. Correctness Properties

### 13.1 Incremental Correctness

**Theorem 13.1 (Incremental-Batch Equivalence).** For any differential dataflow operator O and
input trace T:

```
O_incremental(T)(v) = O_batch(C_v)
```

where C_v = Sum over {u <= v} delta(u) is the accumulated collection at version v.

The incrementally computed output at version v is identical to the batch-computed output when
given the full accumulated input at version v.

**Proof sketch.** By induction on the version space (well-foundedness guarantees this is valid).
Base case: at the minimal version, both computations start with the empty collection. Inductive
step: assuming correctness at all u < v, the difference delta_out(v) is computed from
delta_in(v) (for linear operators) or from the accumulated state (for stateful operators),
both of which are correct by the inductive hypothesis.

### 13.2 Eventual Consistency

**Theorem 13.2 (Convergence).** Given the same set of update triples (regardless of delivery
order within a version), the output of a differential dataflow computation converges to the
same result.

This follows from:
1. The Abelian group structure on collections (addition is commutative)
2. Monotonic frontier advancement (completed versions remain completed)
3. Well-founded version space (all dependencies are finite)

### 13.3 Determinism

**Theorem 13.3 (Deterministic Computation).** Given identical input traces (same set of update
triples), differential dataflow produces identical output traces. The computation is
deterministic up to the ordering of concurrent (incomparable) versions.

### 13.4 Safety Under Retraction

**Theorem 13.4 (Retraction Safety).** If signal s is inserted at version v1 with multiplicity
+1 and retracted at version v2 > v1 with multiplicity -1, then for all versions v >= v2:

```
C(v)(s) = 0
```

The signal is absent from the collection at all versions after the retraction.

**Corollary.** For all stable versions (past the frontier), the net multiplicity of every
element MUST be >= 0 under the event accumulation semantics specified in ADR-001.

---

## 14. Complexity and Performance Bounds

### 14.1 Per-Operator Complexity

| Operator | Time per Version | Space | Notes |
|----------|-----------------|-------|-------|
| `map(f)` | O(|delta|) | O(1) | Linear, stateless |
| `filter(p)` | O(|delta|) | O(1) | Linear, stateless |
| `consolidate()` | O(|delta| * log |delta|) | O(|delta|) | Sort + merge |
| `join(A, B)` | O(|dA| * |S_B| + |S_A| * |dB| + |dA| * |dB|) | O(|S_A| + |S_B|) | Bilinear; S = accumulated state |
| `reduce(R)` | O(|delta| * |G|) | O(|S|) | G = max group size; S = accumulated state |
| `distinct()` | O(|delta|) | O(|S|) | Special case of reduce |
| `count()` | O(|delta|) | O(|K|) | K = number of keys |
| `iterate(F)` | O(|delta| * I) | O(|S|) | I = iterations until convergence |

Where:
- |delta| = number of entries in the input difference at this version
- |S| = number of entries in the accumulated state (Index)
- |G| = maximum number of entries per key group
- |K| = number of distinct keys
- |dA|, |dB| = delta sizes for join inputs A and B
- I = number of iterations until fixed-point convergence

### 14.2 Frontier Operations

| Operation | Complexity | Notes |
|-----------|-----------|-------|
| `lessEqual(version)` | O(|F|) | F = antichain size |
| `meet(A1, A2)` | O(|A1| * |A2|) | Pairwise comparison + minimality |
| `advance(frontier)` | O(|F|) | Monotonicity check |

For Tsingou's 2-dimensional version space, the antichain size |F| is bounded by the number
of active input streams. With k sources, |F| <= k.

### 14.3 Memory Bounds

Without compaction: O(N) where N is the total number of update triples ever produced.

With compaction to frontier F: O(M) where M is the number of distinct (data, version) pairs
where version >= F. Under event accumulation semantics, this is bounded by the number of
distinct active signals in the most recent window.

### 14.4 Tsingou-Specific Performance Considerations

**Ingest graph.** Linear operators only: O(|batch|) per processing cycle. For 10,000
signals/second at 100ms cycle time, |batch| ~ 1,000. This is well within interactive
latency budgets.

**Derived graph (join).** The join operator is the primary scalability concern. For cross-source
correlation with accumulated state of S entries, each delta of size d requires O(d * S) work.
Implementations SHOULD:
- Use windowed joins (limiting S to signals within a time window)
- Compact aggressively to reduce S
- Consider the SQLite-backed Index for large S

---

## 15. Normative Requirements

### 15.1 MUST Requirements

1. **Abelian group structure.** All collection operations MUST respect the Abelian group
   structure: addition is commutative, associative, with zero element and inverses.
   [Derived from: Definition 3.2, Theorem 13.2]

2. **Monotonic frontier advancement.** Frontiers MUST advance monotonically. Once a version
   is marked complete (below the frontier), it MUST NOT receive new data.
   [Derived from: Section 7.2, Theorem 13.1]

3. **Incremental-batch equivalence.** For every operator, the incrementally computed output
   at version v MUST equal the batch-computed output given the full input at version v.
   [Derived from: Theorem 13.1]

4. **Non-negative multiplicities at stable versions.** At any version past the frontier,
   the net multiplicity of every data element MUST be >= 0.
   [Derived from: Section 10.2, ADR-001]

5. **Compaction correctness.** Compaction MUST NOT change the observable state at any version
   >= the compaction frontier.
   [Derived from: Theorem 8.1]

6. **Linear operator statelessness.** Linear operators (map, filter) MUST NOT maintain
   per-version state. Processing MUST be O(|delta|) per version.
   [Derived from: Section 6.1]

7. **Ingest graph linearity.** The ingest tier MUST use only linear operators to guarantee
   O(|delta|) processing per cycle.
   [Derived from: Section 11.2]

8. **Output backpressure.** The output bridge MUST provide bounded buffering to prevent
   unbounded queue growth.
   [Derived from: Section 11.4, FLOW_ARCHITECTURE.md]

### 15.2 SHOULD Requirements

1. **Periodic compaction.** Implementations SHOULD compact periodically (RECOMMENDED: every
   100 frontier advancements) to bound memory usage.
   [Derived from: Section 8.3]

2. **Consolidation at boundaries.** Implementations SHOULD consolidate at operator boundaries
   to prevent trace bloat.
   [Derived from: Section 6.4]

3. **Windowed joins.** Cross-source join operators SHOULD limit accumulated state via time
   windows to prevent O(d * S) degradation.
   [Derived from: Section 14.4]

4. **SQLite-backed Index.** Stateful operators in long-running sessions SHOULD use the
   SQLite-backed Index for persistence and memory management.
   [Derived from: Section 8.4]

### 15.3 MUST NOT Requirements

1. **Implementations MUST NOT assume a total order on versions.** The version space is
   partially ordered; concurrent versions from independent sources are incomparable.
   [Derived from: Section 2.1, Section 9.3]

2. **Implementations MUST NOT produce output before all causal dependencies are resolved.**
   An operator MUST NOT emit output for version v until all input at versions u <= v has
   been received (frontier has advanced past all u <= v).
   [Derived from: Section 7.3]

3. **Implementations MUST NOT reorder frontier advancements.** Frontier messages MUST be
   processed in the order they are sent.
   [Derived from: Section 7.2]

---

## 16. Open Questions

### 16.1 Dynamic Graph Topology

Tsingou requires hot-plug source adapters (ADR-002). The d2ts graph topology is fixed after
`graph.finalize()`. How are new input streams added to a finalized graph? Options include:

- Pre-allocated input slots with dormant streams
- Graph rebuild with state migration
- Multiple independent graphs with shared output merge

This question is tracked as an architectural decision pending d2ts upstream capabilities.

### 16.2 High-Throughput Join Scalability

The join operator's O(d * S) complexity at >10k signals/sec with large accumulated state
requires empirical validation. ADR-001 identifies this as a risk.

### 16.3 Custom Operator Correctness

Tsingou's custom operators (window, throttle, schema-validate) must correctly implement the
frontier protocol and maintain incremental-batch equivalence. A testing framework for verifying
custom operator correctness properties is needed.

### 16.4 d2ts Version Space Limitations

d2ts uses JavaScript numbers for version coordinates, limiting the version space to 2^53 - 1
per dimension. For a 1ms tick rate, this provides ~285 million years of operation — sufficient,
but implementations SHOULD document this limit.

### 16.5 Interaction with NATS Persistence

The interaction between d2ts's internal Index persistence (optional SQLite) and Tsingou's
external NATS JetStream signal persistence needs design. Specifically:
- Can d2ts Index be reconstructed from NATS JetStream replay?
- Should signal retentions policies be coordinated between d2ts compaction and NATS stream
  retention?
- How does frontier advancement map to NATS consumer acknowledgment?

---

## 17. Bibliography

### Primary Sources

| Key | Full Citation |
|-----|--------------|
| [MCSHERRY-CIDR2013] | McSherry, F., Murray, D.G., Isaacs, R., Isard, M. "Differential Dataflow." Proc. 6th Biennial Conference on Innovative Data Systems Research (CIDR), 2013. |
| [ABADI-FOSSACS2015] | Abadi, M., McSherry, F., Plotkin, G. "Foundations of Differential Dataflow." Proc. 18th International Conference on Foundations of Software Science and Computation Structures (FoSSaCS), LNCS 9034, pp. 71-83, 2015. |
| [MURRAY-SOSP2013] | Murray, D.G., McSherry, F., Isaacs, R., Isard, M., Barham, P., Abadi, M. "Naiad: A Timely Dataflow System." Proc. 24th ACM Symposium on Operating Systems Principles (SOSP), pp. 439-455, 2013. |
| [D2TS-REPO] | Electric SQL. "d2ts: Differential Dataflow in TypeScript." https://github.com/electric-sql/d2ts, 2024. |

### Formalism and Reconstruction

| Key | Full Citation |
|-----|--------------|
| [MATERIALIZE-FORMALISM] | Materialize Inc. "Platform Formalism." doc/developer/platform/formalism.md, https://github.com/MaterializeInc/materialize, 2024. |
| [MATERIALIZE-SCRATCH] | Materialize Inc. "Building Differential Dataflow from Scratch." https://materialize.com/blog/differential-from-scratch/, 2020. |
| [MATERIALIZE-LIFE] | Materialize Inc. "Understanding Differential Dataflow." https://materialize.com/blog/life-in-differential-dataflow/, 2020. |

### Order Theory and Algebra

| Key | Full Citation |
|-----|--------------|
| [DAVEY-PRIESTLEY] | Davey, B.A., Priestley, H.A. "Introduction to Lattices and Order." 2nd ed., Cambridge University Press, 2002. |
| [BIRKHOFF-1967] | Birkhoff, G. "Lattice Theory." 3rd ed., AMS Colloquium Publications, Vol. 25, 1967. |
| [ROTA-1964] | Rota, G.-C. "On the Foundations of Combinatorial Theory I. Theory of Mobius Functions." Zeitschrift fur Wahrscheinlichkeitstheorie und Verwandte Gebiete, 2(4), pp. 340-368, 1964. |

### Distributed Systems

| Key | Full Citation |
|-----|--------------|
| [LAMPORT-1978] | Lamport, L. "Time, Clocks, and the Ordering of Events in a Distributed System." Communications of the ACM, 21(7), pp. 558-565, 1978. |
| [FIDGE-1988] | Fidge, C.J. "Timestamps in Message-Passing Systems That Preserve the Partial Ordering." Australian Computer Science Communications, 10(1), pp. 56-66, 1988. |
| [MATTERN-1989] | Mattern, F. "Virtual Time and Global States of Distributed Systems." Proc. Workshop on Parallel and Distributed Algorithms, pp. 215-226, 1989. |

### CRDTs

| Key | Full Citation |
|-----|--------------|
| [SHAPIRO-2011] | Shapiro, M., Preguica, N., Baquero, C., Zawirski, M. "Conflict-free Replicated Data Types." Proc. 13th International Symposium on Stabilization, Safety, and Security of Distributed Systems (SSS), LNCS 6976, pp. 386-400, 2011. |

### Concurrency Control

| Key | Full Citation |
|-----|--------------|
| [BERNSTEIN-MVCC] | Bernstein, P.A., Goodman, N. "Multiversion Concurrency Control — Theory and Algorithms." ACM Transactions on Database Systems, 8(4), pp. 465-483, 1983. |

### Incremental View Maintenance

| Key | Full Citation |
|-----|--------------|
| [GUPTA-IVM] | Gupta, A., Mumick, I.S. "Maintenance of Materialized Views: Problems, Techniques, and Applications." IEEE Data Engineering Bulletin, 18(2), pp. 3-18, 1995. |

### Tsingou Architecture

| Key | Full Citation |
|-----|--------------|
| [ADR-001] | "ADR-001: d2ts as Signal Pipeline Core." docs/tsingou/adr/ADR-001-d2ts-as-signal-pipeline.md, 2026. |
| [FLOW-ARCH] | "TSINGOU_FLOW_ARCHITECTURE.md." docs/tsingou/FLOW_ARCHITECTURE.md, 2026. |
| [TSINGOU-SPEC] | "TSINGOU — System Specification." docs/tsingou/SPEC.md, 2026. |

### Standards

| Key | Full Citation |
|-----|--------------|
| [RFC2119] | Bradner, S. "Key words for use in RFCs to Indicate Requirement Levels." BCP 14, RFC 2119, 1997. |
| [RFC8174] | Leiba, B. "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words." BCP 14, RFC 8174, 2017. |

---

<!-- INTEGRATION NOTES

Section TSG.26 — Differential Dataflow Theory

PART VI: Analysis & Mathematics

Dependencies:
  - TSG.7 (Signal Pipeline & d2ts) — references d2ts architecture
  - TSG.8 (BaseSignal Schema) — references signal encoding
  - ADR-001 — references d2ts selection decision

Dependents:
  - TSG.7 — cites this section for mathematical foundations
  - TSG.32 (Effect-TS Implementation Architecture) — cites for service integration
  - TSG.27 (Statistical Analysis) — may reference Abelian group structure

Cross-references to other RFC sections:
  - TSG.7:  Signal pipeline architecture uses d2ts operators formalized here
  - TSG.8:  BaseSignal is the data domain D for Tsingou's MultiSet<BaseSignal>
  - TSG.9:  Source adapters produce signals that become MultiSet entries
  - TSG.10: Output atoms receive derived state from the output bridge (Section 11.4)
  - TSG.11: NATS subjects serve as external signal fabric; JetStream for persistence

Codebase files referenced:
  - src/lib/tsingou-flow/graph/version.ts (Sections 9.1, 9.2)
  - src/lib/tsingou-flow/graph/multiset-helpers.ts (Section 10)
  - src/lib/tsingou-flow/graph/ingest.ts (Section 11.2)
  - src/lib/tsingou-flow/graph/derived.ts (Section 11.3)
  - docs/tsingou/adr/ADR-001-d2ts-as-signal-pipeline.md (Section 1.3)
  - docs/tsingou/FLOW_ARCHITECTURE.md (Sections 9.4, 11.4)

Research base:
  - research-differential-dataflow.md (13 sections, 15 citations)

Line count: ~1200 lines
Status: DRAFT
-->
