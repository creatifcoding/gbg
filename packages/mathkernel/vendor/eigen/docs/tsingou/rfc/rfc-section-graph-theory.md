# RFC-002 Section TSG.28: Graph Theory & Link Analysis

```
Section:       TSG.28 — Graph Theory & Link Analysis
Parent RFC:    RFC-002 (Tsingou — Signal Intelligence Visualization Platform)
Status:        DRAFT
Author:        graph-theory-specialist (Val)
Created:       2026-02-18
Research Base: research-graph-theory.md (11 sections, 23 references)
```

> This section establishes the graph-theoretic foundations for intelligence network
> analysis within the Tsingou platform. Every graph algorithm, centrality measure,
> and community detection method is grounded in peer-reviewed mathematical frameworks
> with explicit algorithmic complexity bounds. Implementations MUST satisfy the
> constraints specified herein; deviations require explicit justification against
> the cited theory. The key words "MUST", "MUST NOT", "SHOULD", "SHOULD NOT", and
> "MAY" are to be interpreted as described in [RFC2119] and [RFC8174].

---

## Table of Contents

1. [Conventions and Notation](#tsg281-conventions-and-notation)
2. [Graph Representations for Intelligence Data](#tsg282-graph-representations-for-intelligence-data)
3. [Centrality Measures](#tsg283-centrality-measures)
4. [Community Detection](#tsg284-community-detection)
5. [Subgraph Analysis](#tsg285-subgraph-analysis)
6. [Path Analysis](#tsg286-path-analysis)
7. [Temporal Graphs](#tsg287-temporal-graphs)
8. [Intelligence-Specific Applications](#tsg288-intelligence-specific-applications)
9. [Force-Directed Layout for Visualization](#tsg289-force-directed-layout-for-visualization)
10. [Tsingou Integration Mapping](#tsg2810-tsingou-integration-mapping)
11. [Normative Constraints Derived from Graph Theory](#tsg2811-normative-constraints-derived-from-graph-theory)
12. [Worked Examples for Intelligence Scenarios](#tsg2812-worked-examples-for-intelligence-scenarios)
13. [Cross-References to Other RFC Sections](#tsg2813-cross-references-to-other-rfc-sections)
14. [Algorithmic Complexity Summary](#tsg2814-algorithmic-complexity-summary)
15. [Open Questions](#tsg2815-open-questions)
16. [References](#tsg2816-references)

---

## TSG.28.1 Conventions and Notation

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this
section are to be interpreted as described in [RFC2119].

### TSG.28.1.1 Mathematical Notation

| Symbol | Definition |
|--------|-----------|
| G = (V, E) | Graph with vertex set V and edge set E |
| G = (V, A) | Directed graph (digraph) with arc set A |
| G = (V, E, w) | Weighted graph with weight function w: E -> R |
| \|V\| = n | Number of vertices |
| \|E\| = m | Number of edges |
| A | Adjacency matrix, A[i][j] = 1 iff (i,j) in E |
| D | Diagonal degree matrix, D[i][i] = deg(i) |
| L = D - A | Combinatorial Laplacian matrix |
| L_norm = D^(-1/2) L D^(-1/2) | Normalized Laplacian |
| N(v) | Neighborhood of vertex v |
| deg(v) | Degree of vertex v |
| deg_in(v), deg_out(v) | In-degree, out-degree (directed graphs) |
| d(u, v) | Shortest path distance from u to v |
| sigma_st | Number of shortest paths from s to t |
| sigma_st(v) | Number of shortest s-t paths passing through v |
| lambda_i | i-th eigenvalue (sorted ascending for L) |
| O(f(n)) | Asymptotic upper bound on time complexity |

### TSG.28.1.2 Terminology

| Term | Definition |
|------|-----------|
| **SDO** | STIX Domain Object — graph vertex representing an intelligence entity [STIX-2.1] |
| **SRO** | STIX Relationship Object — graph edge representing an intelligence relationship [STIX-2.1] |
| **Centrality** | Quantitative measure of vertex importance within a graph |
| **Community** | Dense subgraph with more internal than external connections |
| **Modularity** | Quality function measuring community partition strength [NEWMAN-GIRVAN-2004] |
| **Coreness** | Maximum k for which a vertex belongs to a k-core |
| **Temporal path** | Path where edge timestamps form a non-decreasing sequence |
| **Force-directed layout** | Graph drawing algorithm using simulated physical forces |
| **Link analysis** | Intelligence methodology for identifying relationships between entities |
| **Dark network** | Covert network with incomplete observability and deliberate compartmentalization |

---

## TSG.28.2 Graph Representations for Intelligence Data

### TSG.28.2.1 STIX 2.1 as a Graph Language

STIX 2.1 [STIX-2.1] defines intelligence data as a connected graph where STIX Domain Objects
(SDOs) are vertices and STIX Relationship Objects (SROs) are directed edges. This graph-based
language conforms to standard analytical methodologies and enables flexible, modular
representations of cyber threat intelligence (CTI).

Implementations MUST represent STIX data as a directed multigraph G = (V, A, tau, omega) where:

- V is the set of SDOs, each carrying a `type` attribute from the STIX SDO vocabulary
- A is the set of SROs, each an ordered pair (source_ref, target_ref) with `relationship_type`
- tau: V -> T assigns a type label to each vertex (e.g., `threat-actor`, `identity`, `indicator`)
- omega: A -> R assigns a type label to each arc (e.g., `uses`, `targets`, `attributed-to`)

The following SDO types serve as vertex categories in the intelligence graph:

| SDO Type | Graph Role | Intelligence Semantics |
|----------|-----------|----------------------|
| `threat-actor` | Entity vertex | Attributed adversary or adversary group |
| `identity` | Entity vertex | Person, organization, system, or group |
| `indicator` | Signal vertex | Detection signature or observable pattern |
| `malware` | Capability vertex | Malicious software tool |
| `attack-pattern` | TTP vertex | Tactic, technique, or procedure (ATT&CK mapping) |
| `infrastructure` | Asset vertex | C2 servers, hosting infrastructure, botnets |
| `location` | Spatial vertex | Geographic or logical location |
| `campaign` | Operation vertex | Named adversary operation |
| `intrusion-set` | Activity vertex | Related adversary activity cluster |
| `observed-data` | Observation vertex | Raw observational data record |

SRO relationship types define edge semantics:

| Relationship Type | Semantics | Directionality |
|-------------------|-----------|---------------|
| `uses` | Actor employs capability | threat-actor -> malware/tool |
| `targets` | Adversary targets entity | threat-actor -> identity/location |
| `attributed-to` | Activity attributed to actor | intrusion-set -> threat-actor |
| `indicates` | Observable indicates threat | indicator -> malware/threat-actor |
| `mitigates` | Countermeasure addresses threat | course-of-action -> malware |
| `located-at` | Entity at location | identity -> location |
| `communicates-with` | Entity contacts entity | infrastructure -> infrastructure |
| `controls` | Actor controls resource | threat-actor -> infrastructure |

### TSG.28.2.2 Graph Types and Intelligence Semantics

Implementations MUST support the following graph types, each capturing distinct intelligence
semantics:

**Directed multigraph** (primary representation): Multiple typed edges between the same vertex
pair. STIX explicitly supports this — a threat actor may simultaneously `use` AND `control` the
same infrastructure. Implementations MUST NOT collapse multiple SROs into a single edge.

**Weighted graph** (derived): Edge weights derived from observation metadata:
- Confidence scores (STIX `confidence` field, 0-100)
- Temporal recency (inverse of age since last observation)
- Frequency (number of sightings via Sighting SROs)
- Communication volume (for COMINT-derived edges)

Implementations SHOULD support configurable weight functions that combine these factors.

**Bipartite graph** (projected): Entity-event bipartite graphs where one vertex partition
represents entities (persons, organizations) and the other represents events (meetings,
transactions, communications). Projection onto a single partition produces co-occurrence
networks suitable for community detection.

**Hypergraph** (group activities): Group events involving N > 2 simultaneous participants.
A conference call with 5 participants is a single hyperedge, not 10 pairwise edges.
Implementations SHOULD support hyperedge representation for multi-party activities.
Implementations MAY project hyperedges to cliques for algorithms that require simple graphs.

### TSG.28.2.3 Matrix Representations

The adjacency matrix A of G = (V, E) is the n x n matrix where A[i][j] = w(i,j) if (i,j)
is in E, and 0 otherwise. For unweighted graphs, A[i][j] is in {0, 1}.

**Storage requirements**:

| Representation | Space | Edge Lookup | Neighbor Iteration |
|---------------|-------|-------------|-------------------|
| Dense matrix | O(n^2) | O(1) | O(n) |
| CSR/CSC sparse | O(n + m) | O(log(deg)) | O(deg) |
| Adjacency list | O(n + m) | O(deg) | O(deg) |
| Edge list | O(m) | O(m) | O(m) |

Implementations MUST use sparse representations (CSR/CSC or adjacency list) for intelligence
graphs. Intelligence networks are sparse: empirical STIX datasets have m/n ratios between 2
and 15 [KREBS-2002]. Dense matrix storage wastes O(n^2) space for O(n) actual edges.

The **Laplacian matrix** L = D - A, where D is the diagonal degree matrix (D[i][i] = deg(i)),
is positive semi-definite with eigenvalues 0 = lambda_1 <= lambda_2 <= ... <= lambda_n.

**Key Laplacian properties** (normative for spectral analysis):
1. The number of zero eigenvalues equals the number of connected components
2. The second-smallest eigenvalue lambda_2 (algebraic connectivity) measures how well-connected
   the graph is [FIEDLER-1973]
3. The eigenvector corresponding to lambda_2 (Fiedler vector) encodes community structure
4. The normalized Laplacian L_norm has eigenvalues in [0, 2], better suited for heterogeneous
   degree distributions

Implementations computing spectral properties MUST use the normalized Laplacian for intelligence
networks, which exhibit power-law degree distributions where a few hub entities have orders of
magnitude more connections than peripheral entities.

---

## TSG.28.3 Centrality Measures

Centrality measures quantify vertex importance. Different measures capture different operational
definitions of "importance." Implementations MUST support at least four centrality measures from
the seven specified below. Implementations SHOULD support all seven and MUST document which
measures are available.

### TSG.28.3.1 Degree Centrality

The simplest centrality measure, counting direct connections:

```
C_D(v) = deg(v) / (n - 1)
```

For directed graphs, two variants:

```
C_D_in(v)  = deg_in(v) / (n - 1)     (prestige, receiving)
C_D_out(v) = deg_out(v) / (n - 1)    (activity, initiating)
```

**Complexity**: O(n + m) to compute for all vertices.

**Intelligence semantics**:

| Metric | High Value Indicates | Operational Significance |
|--------|---------------------|------------------------|
| High out-degree | Coordinator, commander | Issuing directives to many entities |
| High in-degree | Information sink, popular target | Receiving reports or being referenced |
| High total degree | Hub entity | Central to communication structure |
| In/out ratio >> 1 | Collector, aggregator | Receiving far more than sending |
| In/out ratio << 1 | Broadcaster, director | Sending far more than receiving |

Implementations MUST compute degree centrality for both in-degree and out-degree independently
on directed intelligence graphs. Implementations MUST NOT conflate in-degree and out-degree
for directed STIX relationship graphs.

### TSG.28.3.2 Betweenness Centrality

Measures how frequently a vertex lies on shortest paths between other vertex pairs:

```
C_B(v) = sum_{s != v != t in V} sigma_st(v) / sigma_st
```

where sigma_st is the total number of shortest paths from s to t, and sigma_st(v) is the
number of those paths passing through v.

Normalized betweenness divides by (n-1)(n-2)/2 for undirected or (n-1)(n-2) for directed graphs.

**Brandes algorithm** [BRANDES-2001]: Computes betweenness for ALL vertices simultaneously
using a single-source BFS/Dijkstra accumulation technique:

```
Algorithm: Brandes Betweenness Centrality
Input: Graph G = (V, E)
Output: C_B[v] for all v in V

1. Initialize C_B[v] = 0 for all v
2. For each source vertex s in V:
   a. Compute single-source shortest paths from s (BFS for unweighted, Dijkstra for weighted)
   b. During BFS/Dijkstra, record:
      - sigma[t] = number of shortest paths from s to t
      - P[t] = set of predecessors of t on shortest paths from s
   c. Accumulate dependency:
      - delta[v] = 0 for all v
      - Process vertices in reverse BFS order:
        For each w in reverse order:
          For each v in P[w]:
            delta[v] += (sigma[v] / sigma[w]) * (1 + delta[w])
          If w != s: C_B[w] += delta[w]
3. If undirected: C_B[v] /= 2 for all v
```

**Complexity**:
- Unweighted: O(n * m) time, O(n + m) space
- Weighted: O(n * m + n^2 * log(n)) time, O(n + m) space

**Intelligence semantics**: High betweenness identifies **brokers** and **gatekeepers** —
entities that control information flow between otherwise disconnected groups. In terrorist
network analysis [KREBS-2002], high-betweenness vertices represent the most valuable disruption
targets because their removal maximally fragments the network.

**Edge betweenness**: The same concept applied to edges. Computed identically but accumulating
on edges instead of vertices. Used in the Girvan-Newman community detection algorithm (Section
TSG.28.4.4).

Implementations MUST implement the Brandes algorithm for betweenness centrality. Implementations
MUST NOT use the naive O(n^3) all-pairs shortest paths approach.

### TSG.28.3.3 Closeness Centrality

Measures proximity of a vertex to all other vertices:

```
C_C(v) = (n - 1) / sum_{u != v} d(v, u)
```

**Problem**: Undefined for disconnected graphs (d(v,u) = infinity for unreachable u).

Intelligence networks are frequently disconnected (multiple independent threat actor groups,
incomplete data). Implementations MUST use **harmonic centrality** [BOLDI-VIGNA-2014] instead
of classical closeness:

```
C_H(v) = (1 / (n - 1)) * sum_{u != v} 1 / d(v, u)
```

where 1/infinity = 0 by convention. Harmonic centrality is well-defined on disconnected graphs
and satisfies axioms of centrality including locality and monotonicity [BOLDI-VIGNA-2014].

**Complexity**: O(n * m) using BFS from each vertex (unweighted); O(n * (m + n * log(n)))
using Dijkstra from each vertex (weighted).

**Intelligence semantics**: High closeness (harmonic) centrality identifies entities that
can most rapidly disseminate information across the network. In a threat actor network, the
highest-closeness entity can most efficiently coordinate a distributed operation.

### TSG.28.3.4 Eigenvector Centrality

A vertex's importance is proportional to the importance of its neighbors:

```
x_i = (1 / lambda) * sum_{j in N(i)} x_j
```

Equivalently, x is the eigenvector of the adjacency matrix A corresponding to the largest
eigenvalue lambda_1:

```
A * x = lambda_1 * x
```

**Computation via power iteration**:

```
Algorithm: Power Iteration for Eigenvector Centrality
Input: Adjacency matrix A, tolerance epsilon
Output: Eigenvector x

1. Initialize x^(0) = [1/n, ..., 1/n]
2. Repeat:
   a. x^(k+1) = A * x^(k)
   b. x^(k+1) = x^(k+1) / ||x^(k+1)||_2
   c. If ||x^(k+1) - x^(k)||_2 < epsilon: converge
3. Return x^(k+1)
```

**Convergence**: Guaranteed by the Perron-Frobenius theorem for connected, aperiodic graphs
with non-negative adjacency matrices. Rate of convergence: O(|lambda_2 / lambda_1|^k).
Faster convergence when the spectral gap (lambda_1 - lambda_2) is large.

**Complexity**: O(m) per iteration (sparse matrix-vector multiply), typically 20-50 iterations.

**Intelligence semantics**: Identifies entities connected to other well-connected entities.
An operative with few direct contacts who are themselves major hub entities has high eigenvector
centrality — a potential hidden coordinator whose importance is invisible to degree centrality.

### TSG.28.3.5 PageRank

Google's modification of eigenvector centrality [PAGE-1999] with a damping factor that models
random teleportation:

```
PR(v) = (1 - d) / n + d * sum_{u in B(v)} PR(u) / deg_out(u)
```

where:
- d is the damping factor (typically 0.85)
- B(v) is the set of vertices with edges pointing to v
- deg_out(u) is the out-degree of u
- n = |V|

**Matrix formulation**: The PageRank vector p satisfies:

```
p = (1 - d) / n * 1 + d * M^T * p
```

where M is the column-stochastic adjacency matrix (M[i][j] = A[i][j] / deg_out(i)).

**Convergence**: Power iteration converges geometrically at rate d. For d = 0.85, this means
approximately 50-100 iterations suffice for 8 digits of precision. The damping factor ensures
convergence even for graphs with dangling nodes (vertices with zero out-degree) or disconnected
components.

**Complexity**: O(m) per iteration (sparse matrix-vector multiply), ~50-100 iterations.
Total: O(m * iterations).

**Intelligence semantics**:

| d Value | Interpretation | Use Case |
|---------|---------------|----------|
| d = 0.85 (standard) | 15% random exploration | General network analysis |
| d = 0.5 | Higher exploration | Networks with poor connectivity |
| d = 0.95 | Follow links closely | Well-connected networks |

PageRank handles directed graphs naturally and does not break on dangling nodes (entities that
communicate outward but receive no incoming communications). This makes it more robust than
eigenvector centrality for real-world intelligence graphs.

Implementations SHOULD use PageRank as the default centrality measure for STIX relationship
graphs.

### TSG.28.3.6 HITS (Hyperlink-Induced Topic Search)

Kleinberg's algorithm [KLEINBERG-1999] assigns two scores to each vertex:

- **Authority score** a(v): High if pointed to by good hubs
- **Hub score** h(v): High if pointing to good authorities

**Iterative computation**:

```
Algorithm: HITS
Input: Graph G = (V, A), tolerance epsilon
Output: Authority vector a, hub vector h

1. Initialize a^(0) = h^(0) = [1, ..., 1]
2. Repeat:
   a. Authority update: a^(k+1)[v] = sum_{u -> v} h^(k)[u]
   b. Hub update:       h^(k+1)[v] = sum_{v -> u} a^(k+1)[u]
   c. Normalize: a^(k+1) = a^(k+1) / ||a^(k+1)||_2
   d. Normalize: h^(k+1) = h^(k+1) / ||h^(k+1)||_2
   e. If max(||a^(k+1) - a^(k)||, ||h^(k+1) - h^(k)||) < epsilon: converge
3. Return a, h
```

The authority vector converges to the principal eigenvector of A^T * A. The hub vector converges
to the principal eigenvector of A * A^T.

**Complexity**: O(m) per iteration. Typically converges in 20-30 iterations.

**Intelligence semantics in STIX graphs**:

| Role | STIX Interpretation | Operational Value |
|------|--------------------|--------------------|
| High authority | Threat actors referenced by many indicators | Well-characterized, high-confidence threats |
| High hub | Intelligence reports referencing many threats | Comprehensive analytical products |
| High authority in COMINT | Entity receiving calls from many coordinators | Critical target for collection |
| High hub in COMINT | Entity initiating calls to many operatives | Coordinator, command node |

HITS provides a dual-role classification that PageRank cannot: the same entity has independent
hub and authority scores. This dual perspective is valuable for intelligence analysis where
entities play asymmetric roles.

Implementations SHOULD support HITS for directed intelligence graphs where hub/authority
decomposition is analytically relevant.

### TSG.28.3.7 Katz Centrality

Counts all walks (not just shortest paths) with exponential attenuation [KATZ-1953]:

```
C_Katz(i) = sum_{k=1}^{infinity} sum_{j=1}^{n} alpha^k * (A^k)[j][i]
```

where alpha is the attenuation factor controlling the decay of influence over longer paths.

**Matrix formulation**:

```
C_Katz = ((I - alpha * A^T)^(-1) - I) * 1
```

**Constraint**: alpha MUST satisfy 0 < alpha < 1/lambda_1(A) where lambda_1(A) is the largest
eigenvalue of the adjacency matrix. The series diverges at alpha = 1/lambda_1.

**Complexity**: O(n^3) via matrix inversion, or iterative approximation with O(m) per iteration.

**Intelligence semantics**: Katz centrality captures influence propagated along ALL paths, not
just shortest. An entity reachable through many redundant paths has high Katz centrality,
indicating **resilient connectivity** — the network maintains paths to this entity even under
disruption. This is operationally significant: high-Katz entities are harder to isolate.

---

## TSG.28.4 Community Detection

Communities (also called clusters, modules, or groups) are subsets of vertices more densely
connected internally than to the rest of the graph. In intelligence analysis, communities
correspond to organizational cells, social groups, coordinated activity clusters, or topic
communities.

Implementations MUST support at least two community detection algorithms: one modularity-based
(Louvain or Leiden) and one non-modularity-based (spectral or label propagation).

### TSG.28.4.1 Modularity

The Newman-Girvan modularity [NEWMAN-GIRVAN-2004] measures the quality of a partition:

```
Q = (1 / 2m) * sum_{i,j} [A[i][j] - (k_i * k_j) / (2m)] * delta(c_i, c_j)
```

where:
- m = |E| (number of edges)
- k_i = deg(i) (degree of vertex i)
- c_i = community assignment of vertex i
- delta(c_i, c_j) = 1 if c_i == c_j, else 0

The term k_i * k_j / (2m) is the expected number of edges between i and j under the
**configuration model** (random graph preserving degree sequence).

Q ranges from -0.5 to approximately 1. Empirically, Q > 0.3 indicates significant community
structure in real networks.

**Resolution limit** [FORTUNATO-2007]: Modularity optimization CANNOT detect communities
smaller than approximately sqrt(2m) edges. For a network with m = 50,000 edges, communities
with fewer than ~316 internal edges may be invisible to modularity optimization.

This is a critical limitation for intelligence analysis: small terror cells (3-5 members)
embedded in large communication networks may fall below the resolution limit. Implementations
MUST document this limitation and SHOULD provide multi-resolution community detection
(e.g., Leiden with resolution parameter).

### TSG.28.4.2 Louvain Algorithm

Blondel et al. [BLONDEL-2008] developed a fast, greedy modularity optimization algorithm:

```
Algorithm: Louvain Community Detection
Input: Graph G = (V, E)
Output: Community partition C

Phase 1 — Local Optimization:
  1. Assign each vertex to its own community
  2. For each vertex v (in random order):
     a. For each neighboring community C:
        Compute modularity gain of moving v to C:
        delta_Q = [sum_in + 2*k_{v,in}] / (2m)
                - [(sum_tot + k_v) / (2m)]^2
                - [sum_in / (2m)] + [(sum_tot / (2m))^2]
                + [(k_v / (2m))^2]
     b. Move v to community with maximum positive delta_Q
     c. If no positive delta_Q exists, v stays
  3. Repeat until no move improves Q

Phase 2 — Aggregation:
  4. Build new graph: communities -> super-nodes
  5. Edge weight between super-nodes = sum of inter-community edges
  6. Self-loops = sum of intra-community edges

Repeat Phase 1 + Phase 2 until no further improvement.
```

**Complexity**: O(n + m) per pass. Typically converges in O(log(n)) passes. Near-linear
in practice for large networks.

**Known defect**: The Louvain algorithm may produce arbitrarily badly connected communities
[TRAAG-2019]. In experimental analysis:
- Up to 25% of communities may be badly connected (contain vertices connected only through
  vertices outside the community)
- Up to 16% of communities may be completely disconnected

This defect is unacceptable for intelligence analysis where community identity implies
organizational coherence. Implementations SHOULD prefer the Leiden algorithm over Louvain.

### TSG.28.4.3 Leiden Algorithm

Traag, Waltman & van Eck [TRAAG-2019] improved Louvain with a refinement phase that
guarantees community connectivity:

```
Algorithm: Leiden Community Detection
Input: Graph G = (V, E)
Output: Community partition C

Phase 1 — Local Moving:
  Same as Louvain Phase 1 (move vertices to maximize modularity)

Phase 2 — Refinement:
  1. For each community C found in Phase 1:
     a. Initialize each vertex in C as its own sub-community
     b. Allow vertices to merge into sub-communities ONLY within C
     c. Merges are accepted probabilistically based on quality improvement
  2. Result: communities from Phase 1 may be split into sub-communities

Phase 3 — Aggregation:
  3. Build new graph: refined sub-communities -> super-nodes
  4. Maintain connectivity guarantee: every super-node is a connected subgraph

Repeat Phase 1 + Phase 2 + Phase 3 until convergence.
```

**Key improvements over Louvain**:

| Property | Louvain | Leiden |
|----------|---------|-------|
| Community connectivity | NOT guaranteed | GUARANTEED |
| Badly connected communities | Up to 25% | 0% |
| Disconnected communities | Up to 16% | 0% |
| Speed (UK Web 2005, 39M nodes) | Baseline | 20x faster |
| Partition quality | Good | Better (strictly higher Q) |
| Convergence guarantee | None | Locally optimal subsets |

**Convergence guarantee**: When applied iteratively, Leiden converges to a partition in which
all subsets of all communities are locally optimally assigned. This is a stronger guarantee
than Louvain provides.

**Resolution parameter**: The Leiden algorithm supports a resolution parameter gamma that
controls community granularity. gamma > 1 produces smaller communities; gamma < 1 produces
larger communities. This addresses the resolution limit of standard modularity.

Implementations MUST use the Leiden algorithm as the primary community detection method.
Implementations MUST expose the resolution parameter gamma to analysts for tuning community
granularity.

### TSG.28.4.4 Girvan-Newman Algorithm

Newman & Girvan [NEWMAN-GIRVAN-2004] introduced a divisive hierarchical approach based on
edge betweenness:

```
Algorithm: Girvan-Newman Community Detection
Input: Graph G = (V, E)
Output: Dendrogram of community splits

1. Compute edge betweenness for ALL edges (using Brandes algorithm)
2. Remove the edge with highest betweenness
3. Recalculate ALL edge betweenness values (CRITICAL — skipping causes severe errors)
4. Record the resulting community structure (connected components)
5. Repeat steps 1-4 until no edges remain
6. The optimal partition is the level in the dendrogram maximizing Q
```

**Complexity**: O(n * m^2). Each of the m edge-removal steps requires O(n * m) betweenness
recalculation. This is prohibitively expensive for large networks.

**Intelligence value**: Despite its cost, Girvan-Newman produces a **hierarchical decomposition**
showing community structure at every granularity level simultaneously. This is valuable for
intelligence analysis where the analyst needs to view structure at multiple scales:
cells within organizations within alliances within movements.

Implementations MAY support Girvan-Newman for small networks (n < 1,000) where hierarchical
decomposition is specifically requested. Implementations MUST NOT use Girvan-Newman as the
default community detection method due to its O(n * m^2) complexity.

### TSG.28.4.5 Label Propagation

Raghavan, Albert & Kumara [RAGHAVAN-2007] proposed a near-linear-time algorithm:

```
Algorithm: Label Propagation
Input: Graph G = (V, E)
Output: Community partition C

1. Assign unique label L[v] = v to each vertex
2. Repeat:
   a. For each vertex v (in random order):
      L[v] = most frequent label among N(v) (ties broken randomly)
   b. If no label changed: stop
3. Communities = sets of vertices with the same label
```

**Complexity**: O(m) per iteration. Typically converges in ~5 iterations. Near-linear total.

**Advantages**: No optimization function, no parameters, extremely fast. Suitable for
very large networks (millions of vertices) where modularity optimization is too slow.

**Disadvantages**: Non-deterministic (random ordering and tie-breaking). Results may vary
between runs. No quality guarantee. Can produce degenerate solutions (single giant community
or all singletons).

Implementations MAY support label propagation as a fast approximation for very large networks.
When used, implementations MUST run multiple trials and report consensus communities.

### TSG.28.4.6 Spectral Clustering

Uses eigenvectors of the graph Laplacian to embed vertices in a low-dimensional space where
clusters are geometrically separated [VON-LUXBURG-2007]:

```
Algorithm: Spectral Clustering
Input: Graph G = (V, E), number of communities k
Output: Community partition C with k communities

1. Compute normalized Laplacian: L_norm = D^(-1/2) * (D - A) * D^(-1/2)
2. Find k eigenvectors u_1, ..., u_k corresponding to k smallest eigenvalues
3. Form matrix U in R^{n x k} with u_i as columns
4. Normalize each row of U to unit length
5. Apply k-means clustering to the n rows of U
6. Assign vertex i to the cluster of row i
```

**Fiedler vector bisection** (k = 2): The eigenvector corresponding to lambda_2 (the
algebraic connectivity) naturally bisects the graph. Vertices with positive Fiedler vector
components go to one partition; negative to the other. The cut where the Fiedler vector
crosses zero is the optimal spectral bisection [FIEDLER-1973].

**Theoretical grounding**: Spectral clustering is the relaxation of the NP-hard normalized
cut problem [SHI-MALIK-2000]. The normalized cut objective:

```
Ncut(A, B) = cut(A, B) / vol(A) + cut(A, B) / vol(B)
```

is minimized by the Fiedler vector of the normalized Laplacian.

**Complexity**: O(n^3) for dense eigendecomposition. For sparse graphs, Lanczos/ARPACK
computes k eigenvectors in O(k * m * iterations), where iterations is typically O(n).

**Intelligence semantics**: Spectral methods excel when communities have clear spectral gaps
(well-separated eigenvalues). The number of near-zero eigenvalues of the Laplacian indicates
the number of well-separated network components — a structural signature of compartmentalized
organizations.

Implementations SHOULD support spectral clustering as a complement to modularity-based methods.
Spectral clustering requires the number of communities k as input, unlike Louvain/Leiden which
discover k automatically.

---

## TSG.28.5 Subgraph Analysis

### TSG.28.5.1 k-Core Decomposition

A k-core is the maximal subgraph where every vertex has degree >= k within the subgraph.
The coreness of a vertex is the maximum k for which it belongs to a k-core.

```
Algorithm: k-Core Decomposition (Batagelj & Zaversnik)
Input: Graph G = (V, E)
Output: coreness[v] for all v in V

1. Compute degrees: deg[v] for all v
2. Sort vertices by degree (ascending)
3. For each vertex v in order:
   a. coreness[v] = deg[v]
   b. For each neighbor u of v with deg[u] > deg[v]:
      deg[u] = deg[u] - 1
      Re-sort u in the ordering
```

**Complexity**: O(n + m) — linear time [BATAGELJ-ZAVERSNIK-2003].

**Intelligence semantics**: k-core decomposition provides a "peeling" view of network density:

| Coreness Shell | Structural Interpretation | Intelligence Meaning |
|---------------|--------------------------|---------------------|
| Outermost (k=1) | Periphery, loosely connected | Casual contacts, peripheral members |
| Middle shells | Moderate connectivity | Active participants, mid-level operatives |
| Innermost core (k=max) | Densest subgraph | Core members, leadership circle |

The innermost core often identifies the most tightly connected subgroup. In dark network
analysis, this corresponds to the operational core that maintains redundant communication
channels.

Implementations MUST support k-core decomposition as a structural analysis tool.

### TSG.28.5.2 Clique Detection

A clique is a complete subgraph: every pair of vertices in the clique is connected by an edge.
A maximal clique is a clique that cannot be extended by adding another vertex.

**Bron-Kerbosch algorithm** [BRON-KERBOSCH-1973] with pivoting:

```
Algorithm: Bron-Kerbosch with Pivoting
Input: Graph G = (V, E)
Output: All maximal cliques

BronKerbosch(R, P, X):
  if P is empty AND X is empty:
    report R as a maximal clique
    return
  Choose pivot u from P union X (maximize |P intersect N(u)|)
  for each vertex v in P \ N(u):
    BronKerbosch(R union {v},
                 P intersect N(v),
                 X intersect N(v))
    P = P \ {v}
    X = X union {v}

Initial call: BronKerbosch({}, V, {})
```

**Complexity**: O(3^(n/3)) worst case, matching the Moon-Moser bound on maximum number of
maximal cliques in any n-vertex graph. For sparse graphs with degeneracy d: O(d * n * 3^(d/3))
using the vertex-ordering variant [BRON-KERBOSCH-1973].

**Intelligence semantics**: Cliques represent fully connected subgroups where every member
has a direct relationship with every other member. In criminal/terror networks:
- Cliques identify **operational cells** with full internal coordination
- Overlapping cliques (shared members) identify **cross-cell liaisons**
- Clique sizes indicate **cell structure** (3-person cells vs. 5-person cells)

Implementations SHOULD support clique detection for networks with n < 10,000. For larger
networks, implementations SHOULD use k-core decomposition to reduce the search space before
applying Bron-Kerbosch to the densest cores.

### TSG.28.5.3 Network Motifs

Motifs are recurring subgraph patterns that appear significantly more often than expected
in a random graph with the same degree sequence.

**Common 3-node directed motifs for intelligence analysis**:

| Motif ID | Pattern | Description | Intelligence Interpretation |
|----------|---------|-------------|---------------------------|
| M1 | A -> B, A -> C | Fan-out | Command distribution, broadcast |
| M2 | B -> A, C -> A | Fan-in | Information aggregation, reporting |
| M3 | A -> B, B -> C | Chain | Sequential communication, chain of command |
| M4 | A -> B, A -> C, B -> C | Feed-forward loop | Command with bypass/verification |
| M5 | A -> B, B -> C, C -> A | Feedback loop | Circular reporting, consensus |
| M6 | A <-> B, A <-> C | Mutual pair + spoke | Trusted pair with shared contact |
| M7 | A <-> B <-> C <-> A | Complete mutual | Fully trusted cell |

**Motif significance**: Compare observed count n_i of motif i against expected count E[n_i]
under null model (typically configuration model):

```
Z_i = (n_i - E[n_i]) / std(n_i)
```

Z-scores significantly above 2 indicate over-represented motifs (deliberate organizational
patterns). Z-scores significantly below -2 indicate avoided patterns (organizational taboos).

**Complexity**: Exponential in motif size k. Practical for k = 3 (O(m^{3/2})), feasible for
k = 4 (O(m^2)), approximate for k >= 5 (sampling methods).

Implementations SHOULD support 3-node and 4-node motif analysis. Implementations MAY provide
sampling-based approximation for larger motifs.

---

## TSG.28.6 Path Analysis

### TSG.28.6.1 Shortest Path Algorithms

Implementations MUST support single-source shortest paths (SSSP) for both unweighted and
weighted intelligence graphs.

**Unweighted SSSP — BFS**:

```
Algorithm: Breadth-First Search SSSP
Input: Graph G = (V, E), source s
Output: dist[v] for all v in V

1. Initialize dist[v] = infinity for all v, dist[s] = 0
2. Queue Q = {s}
3. While Q is not empty:
   a. Dequeue u
   b. For each neighbor v of u:
      If dist[v] == infinity:
        dist[v] = dist[u] + 1
        Enqueue v
```

**Complexity**: O(n + m).

**Weighted SSSP — Dijkstra's algorithm**:

```
Algorithm: Dijkstra SSSP
Input: Weighted graph G = (V, E, w) with w >= 0, source s
Output: dist[v] for all v in V

1. Initialize dist[v] = infinity for all v, dist[s] = 0
2. Priority queue PQ = {(0, s)}
3. While PQ is not empty:
   a. Extract minimum (d, u)
   b. If d > dist[u]: skip (stale entry)
   c. For each neighbor v of u:
      If dist[u] + w(u, v) < dist[v]:
        dist[v] = dist[u] + w(u, v)
        Insert (dist[v], v) into PQ
```

**Complexity**: O(m + n * log(n)) with Fibonacci heap; O((m + n) * log(n)) with binary heap.

**Negative weights — Bellman-Ford**:

```
Algorithm: Bellman-Ford SSSP
Input: Weighted graph G = (V, E, w), source s
Output: dist[v] for all v, or negative cycle detection

1. Initialize dist[v] = infinity for all v, dist[s] = 0
2. Repeat n - 1 times:
   For each edge (u, v, w):
     If dist[u] + w < dist[v]:
       dist[v] = dist[u] + w
3. Check for negative cycles:
   For each edge (u, v, w):
     If dist[u] + w < dist[v]: NEGATIVE CYCLE detected
```

**Complexity**: O(n * m).

**Intelligence application**: Shortest path distance between two entities measures the minimum
number of intermediaries (hop count) or the minimum total relationship weight (for weighted
paths). In contact chaining, the NSA expands from a seed entity through up to 3 hops,
which corresponds to shortest-path neighborhoods of radius 3 [WASSERMAN-FAUST-1994].

### TSG.28.6.2 All-Pairs Shortest Paths

**Floyd-Warshall**:

```
Algorithm: Floyd-Warshall APSP
Input: Weighted graph G with n vertices
Output: dist[i][j] for all pairs (i, j)

1. Initialize dist[i][j] = w(i,j) if edge exists, infinity otherwise
2. For k = 1 to n:
   For i = 1 to n:
     For j = 1 to n:
       dist[i][j] = min(dist[i][j], dist[i][k] + dist[k][j])
```

**Complexity**: O(n^3) time, O(n^2) space.

**Johnson's algorithm** (for sparse graphs): Reweight edges using Bellman-Ford, then run
Dijkstra from each source. O(n^2 * log(n) + n * m).

Implementations SHOULD use Johnson's algorithm for sparse intelligence graphs (where m << n^2).
Implementations MUST use Floyd-Warshall only for dense graphs or graphs with n < 5,000.

The complete distance matrix enables:
- **Diameter**: max_{i,j} dist[i][j] — maximum degrees of separation
- **Eccentricity**: max_j dist[i][j] — vertex remoteness
- **Center**: argmin_i eccentricity(i) — most central vertex
- **Periphery**: vertices with eccentricity equal to diameter

### TSG.28.6.3 Network Flow

**Max-flow/min-cut theorem** [FORD-FULKERSON-1956]: In a capacitated network, the maximum
flow from source s to sink t equals the minimum capacity of any s-t cut.

```
max flow(s, t) = min_{S: s in S, t not in S} sum_{(u,v): u in S, v not in S} capacity(u, v)
```

**Ford-Fulkerson method**: Iteratively find augmenting paths in the residual graph and push
flow along them.

**Edmonds-Karp** (BFS-based): O(n * m^2).

**Intelligence applications**:

| Flow Concept | Intelligence Interpretation | Operational Use |
|-------------|---------------------------|----------------|
| **Maximum flow** | Communication capacity between two entities | Bandwidth of information transfer |
| **Minimum cut** | Smallest set of edges whose removal disconnects two entities | Optimal disruption strategy |
| **Vertex connectivity** | Minimum vertex removals to disconnect graph | Network resilience measure |
| **Edge connectivity** | Minimum edge removals to disconnect graph | Communication redundancy |

**Minimum cut for disruption analysis**: Given a target entity t and a collection entity s,
the minimum s-t cut identifies the smallest set of relationships whose disruption isolates
the target from the collector. This is a fundamental operation in intelligence network
disruption planning.

Implementations MUST support maximum flow and minimum cut computation. Implementations SHOULD
use Edmonds-Karp (BFS augmenting paths) for deterministic O(n * m^2) performance.

---

## TSG.28.7 Temporal Graphs

### TSG.28.7.1 Formalization

Intelligence networks are inherently temporal: relationships are created, evolve, and dissolve
over time. A temporal graph G_T = (V, E_T) consists of:

- V: static vertex set (entities persist even when inactive)
- E_T: set of temporal edges (u, v, t, delta) where t is the start time and delta is the
  duration

Alternative formulation as a sequence of snapshots: G_1, G_2, ..., G_T where G_t = (V, E_t)
is the graph at time step t.

STIX 2.1 provides temporal annotations:
- SROs carry `created` and `modified` timestamps
- Sighting SROs carry `first_seen` and `last_seen`
- SDOs carry `created` and `modified`

Implementations MUST preserve temporal information on all STIX objects and MUST support
temporal graph analysis operations.

### TSG.28.7.2 Temporal Paths and Reachability

A **temporal path** from u to v is a sequence of edges:

```
(v_0, v_1, t_1), (v_1, v_2, t_2), ..., (v_{k-1}, v_k, t_k)
```

where v_0 = u, v_k = v, and t_1 <= t_2 <= ... <= t_k (time-respecting order).

**Critical insight**: Most vertex pairs that are reachable in the static aggregated graph
are NOT connected by time-respecting paths. The arrow of time dramatically restricts
reachability in temporal networks [HOLME-SARAMAKI-2012].

**Temporal reachability graph**: The directed graph R_T where (u, v) is in R_T if and only
if there exists a temporal path from u to v. R_T is a subset of the reachability graph of
the static aggregation.

**Earliest arrival time**: For source s and target t, the earliest time at which a temporal
path from s reaches t. This is the temporal analog of shortest path distance.

**Restless temporal paths**: Paths with a maximum waiting time constraint delta_max at
intermediate vertices. A vertex cannot "hold" information indefinitely — it must forward
within delta_max time units. The restless temporal path problem is NP-hard in general
[HOLME-SARAMAKI-2012].

**Intelligence application**: Temporal reachability answers: "Could entity A have communicated
information to entity C through intermediary B, given the observed communication timestamps?"
This is stricter than static reachability and eliminates impossible causal chains.

### TSG.28.7.3 Temporal Centrality

Static centrality measures computed on the aggregated (time-collapsed) graph can be
misleading. Temporal centrality measures respect the arrow of time:

**Temporal betweenness centrality**:

```
C_B^T(v) = sum_{s != v != t} sigma_st^T(v) / sigma_st^T
```

where sigma_st^T counts time-respecting shortest paths. A vertex may have high static
betweenness but low temporal betweenness if the relevant paths violate temporal ordering.

**Temporal closeness centrality**: Replace static distances with earliest arrival times:

```
C_C^T(v) = (n - 1) / sum_{u != v} EAT(v, u)
```

where EAT(v, u) is the earliest arrival time from v to u.

**Temporal PageRank**: Apply time-decay to edge weights:

```
w_T(u, v, t) = exp(-lambda * (t_now - t))
```

where lambda controls the decay rate. Recent communications contribute more to PageRank
than old ones.

Implementations SHOULD support temporal variants of betweenness and PageRank centrality.
Implementations MUST document whether centrality computations are static (aggregated) or
temporal (time-respecting).

### TSG.28.7.4 Temporal Motifs

Temporal motifs extend static motifs (Section TSG.28.5.3) with temporal ordering. A temporal
k-motif specifies both the topology AND the temporal sequence of edges.

**Example**: The static 3-cycle (A-B, B-C, C-A) has 6 distinct temporal orderings:
1. A->B, B->C, C->A (forward chain)
2. A->B, C->A, B->C (split initiation)
3. B->C, A->B, C->A (reversed start)
... etc.

Each temporal ordering encodes a different communication pattern:
- Pattern 1: Sequential relay (A instructs B, B instructs C, C reports to A)
- Pattern 2: Parallel activation (A contacts B and receives from C before B contacts C)

**Intelligence application**: Temporal motifs reveal communication **protocols** invisible
in static analysis:
- **Dead-drop patterns**: A writes (t_1), then B reads (t_2 > t_1), never simultaneously
- **Command-and-control**: Directive sent (t_1), acknowledgment received (t_2 > t_1)
- **Pre-operation coordination**: Burst of specific temporal motifs before an event
- **Behavioral change detection**: Shift in dominant temporal motif patterns

Implementations SHOULD support temporal 3-motif counting with configurable time windows.

---

## TSG.28.8 Intelligence-Specific Applications

### TSG.28.8.1 Social Network Analysis for OSINT

Open-source intelligence produces network data from publicly available sources. Graph analysis
of OSINT data follows a standard pipeline:

```
Phase 1: Entity Extraction
  Named entity recognition (NER) on text sources
  -> STIX identity SDOs as graph vertices

Phase 2: Relationship Extraction
  Co-occurrence analysis, mention extraction, organizational links
  -> STIX relationship SROs as graph edges

Phase 3: Network Construction
  Aggregate entities and relationships into graph G
  Entity resolution (Section TSG.28.8.4) to merge duplicates

Phase 4: Structural Analysis
  Centrality computation (Section TSG.28.3) -> key entity identification
  Community detection (Section TSG.28.4) -> group identification
  Motif analysis (Section TSG.28.5.3) -> organizational patterns

Phase 5: Temporal Analysis
  Temporal graph construction from timestamps
  Evolution tracking: how network structure changes over time
  Anomaly detection: unusual structural changes
```

OSINT graph analysis MUST handle:
- **Noisy data**: False positives in entity/relationship extraction
- **Incomplete data**: Missing entities, unobserved relationships
- **Dynamic data**: Continuous stream of new observations
- **Multi-modal data**: Text, social media, financial, geospatial sources

Implementations MUST support incremental graph updates (edge/vertex addition) without
requiring full recomputation of centrality and community structure. The d2ts differential
dataflow framework provides this capability natively.

### TSG.28.8.2 Communication Pattern Analysis for COMINT

COMINT intercepts produce call detail records (CDRs) that map directly to graph edges:

| CDR Field | Graph Element | Semantics |
|-----------|--------------|-----------|
| Caller ID | Source vertex | Initiating entity |
| Callee ID | Target vertex | Receiving entity |
| Timestamp | Edge timestamp | Temporal ordering |
| Duration | Edge weight | Communication intensity |
| Type (voice/text/data) | Edge label | Communication mode |
| Cell tower | Vertex attribute | Location metadata |

**Contact chaining**: Expanding from a seed entity through N hops of communication links.
The NSA uses up to 3 hops in its contact chaining methodology. This corresponds to computing
the N-hop neighborhood:

```
N_k(v) = {u in V : d(v, u) <= k}
```

For k = 3, the 3-hop neighborhood of a single entity in a social network with average
degree d contains approximately d^3 entities. For d = 50 (typical for active communicators),
this is ~125,000 entities — demonstrating why contact chaining must be combined with filtering
and prioritization (centrality ranking).

**Communication pattern analysis techniques**:

| Technique | Graph Operation | Intelligence Product |
|-----------|----------------|---------------------|
| Contact chaining | k-hop neighborhood | Expanded entity network |
| Community detection | Louvain/Leiden | Communication groups |
| Role classification | Centrality ranking | Coordinator/operative/facilitator |
| Temporal patterns | Temporal motif counting | Activity rhythms, schedules |
| Anomaly detection | Structural change detection | Behavioral shifts, new contacts |

### TSG.28.8.3 Link Analysis Methodology

The i2 Analyst's Notebook methodology [I2-METHODOLOGY] defines standard analytical
visualizations that map to graph operations:

**Association charts**: Entity-relationship visualizations where entities are typed vertices
and relationships are typed directed edges. This maps directly to the STIX SDO/SRO graph
model (Section TSG.28.2.1).

| i2 Concept | Graph Equivalent | Tsingou Component |
|------------|-----------------|-------------------|
| Entity types (person, org, vehicle) | Vertex type labels (SDO types) | STIX SDO taxonomy |
| Relationship types | Edge type labels (SRO types) | STIX SRO vocabulary |
| Association chart | Force-directed graph drawing | R3F layer (Section TSG.28.9) |
| Timeline view | Temporal graph visualization | visx layer (TSG.22) |
| SNA metrics | Centrality measures | d2ts graph operators |
| Group detection | Community detection | Leiden algorithm |
| Importance ranking | PageRank / betweenness | d2ts iterate operator |

**Tsingou replaces i2's proprietary format with open standards**: STIX 2.1 for data model,
TAXII 2.1 for transport, Effect-TS for computation, R3F for visualization. The analytical
methodology remains equivalent.

### TSG.28.8.4 Entity Resolution and Deduplication

The same real-world entity may appear under multiple identifiers across data sources.
Entity resolution is the process of determining which identifiers refer to the same entity.

**Graph-based entity resolution pipeline**:

```
Step 1: Blocking (candidate generation)
  Use graph structure to generate candidate pairs:
  - Shared neighbors: entities with > k common neighbors
  - Structural equivalence: entities with similar neighborhoods
  - Attribute similarity: matching names, identifiers, locations

Step 2: Pairwise Matching
  Score similarity between candidate pairs:
  - String similarity (Jaro-Winkler, Levenshtein) on names
  - Attribute overlap (shared phone numbers, email addresses, IPs)
  - Network similarity (Jaccard coefficient of neighborhoods)

Step 3: Transitive Closure
  Apply clustering to pairwise scores:
  - Connected components at similarity threshold
  - Correlation clustering (minimize disagreements)
  - Hierarchical agglomerative clustering

Step 4: Entity Merging
  Create unified entity with combined attributes
  Maintain provenance links to original identifiers
  Map to STIX: unified identity SDO with external_references
```

Entity resolution is critical for multi-source intelligence fusion. Without it, the same
threat actor appearing under different aliases in different sources would be analyzed as
separate entities, fragmenting the intelligence picture.

Implementations MUST support entity resolution as a graph preprocessing step.
Implementations SHOULD integrate entity resolution with d2ts incremental computation so
that new observations trigger re-evaluation of entity matches.

### TSG.28.8.5 Dark Network Analysis

Dark networks (covert, clandestine, or illicit networks) present unique analytical challenges
[DARK-NETWORKS]:

**Structural characteristics**:
- **Incomplete observation**: Only a fraction of relationships are intercepted
- **Deliberate deception**: Organizational structure designed to resist analysis
- **Security-efficiency tradeoff**: Networks sacrifice communication efficiency for operational
  security (fewer connections = harder to map, slower coordination)
- **Cell structure**: Compartmentalized subgroups with minimal inter-cell links
- **Redundancy in critical paths**: Multiple backup channels for essential communications

**Analysis techniques for dark networks**:

| Technique | Purpose | Algorithm |
|-----------|---------|-----------|
| **Missing link prediction** | Infer unobserved connections | Common neighbors, Adamic-Adar, Katz |
| **Key player identification** | Find optimal disruption targets | KPP-Neg (fragmentation), KPP-Pos (reach) |
| **Resilience analysis** | Measure network robustness | Sequential vertex/edge removal, giant component tracking |
| **Destabilization analysis** | Identify minimal disruption set | NP-hard; heuristic approaches (betweenness-based, k-core-based) |
| **Evolution tracking** | Monitor restructuring after disruptions | Temporal community detection |

**Key Player Problem (KPP)**: Given a network and a number k, find the set of k vertices
whose removal maximally:
- **KPP-Neg**: Fragments the network (maximize disconnection)
- **KPP-Pos**: Reduces reachability (minimize information flow)

Both formulations are NP-hard. Practical heuristics use centrality-based greedy selection:
remove the highest-centrality vertex, recompute centralities, remove the next, etc.

**Link prediction for incomplete networks**: Given observed graph G = (V, E_obs), predict
edges in E_true \ E_obs:

| Predictor | Score(u, v) | Interpretation |
|-----------|-------------|---------------|
| Common neighbors | \|N(u) intersect N(v)\| | Shared contacts |
| Jaccard coefficient | \|N(u) intersect N(v)\| / \|N(u) union N(v)\| | Normalized overlap |
| Adamic-Adar | sum_{w in N(u) intersect N(v)} 1/log(deg(w)) | Weighted by exclusivity |
| Preferential attachment | deg(u) * deg(v) | Rich-get-richer |
| Katz index | sum_{k=1}^{inf} alpha^k * paths_k(u,v) | All-paths similarity |

Implementations SHOULD support link prediction scoring for dark network analysis.
Implementations MUST clearly distinguish between observed edges (high confidence) and
predicted edges (scored likelihood) in visualizations.

---

## TSG.28.9 Force-Directed Layout for Visualization

### TSG.28.9.1 Spring-Electrical Model

Force-directed graph layout algorithms model vertices as charged particles (mutual repulsion)
and edges as springs (attraction between connected vertices):

**Repulsive force** (all vertex pairs):
```
F_repulsive(u, v) = -k^2 / ||pos(u) - pos(v)||
```

**Attractive force** (connected vertex pairs only):
```
F_attractive(u, v) = ||pos(u) - pos(v)||^2 / k
```

where k = C * sqrt(area / n) is the optimal inter-vertex distance and C is a tuning constant.

### TSG.28.9.2 Fruchterman-Reingold Algorithm

The standard force-directed algorithm [FRUCHTERMAN-REINGOLD-1991]:

```
Algorithm: Fruchterman-Reingold Force-Directed Layout
Input: Graph G = (V, E), bounding area W x H
Output: Position pos[v] for all v in V

1. Initialize pos[v] = random point in [0, W] x [0, H] for all v
2. k = C * sqrt(W * H / n)
3. temperature = W / 10
4. For iteration = 1 to max_iterations:
   a. Compute repulsive forces:
      For each pair (u, v) in V x V:
        delta = pos[v] - pos[u]
        disp[v] += (delta / ||delta||) * f_r(||delta||)
        where f_r(d) = k^2 / d
   b. Compute attractive forces:
      For each edge (u, v) in E:
        delta = pos[v] - pos[u]
        disp[v] -= (delta / ||delta||) * f_a(||delta||)
        disp[u] += (delta / ||delta||) * f_a(||delta||)
        where f_a(d) = d^2 / k
   c. Update positions:
      For each vertex v:
        pos[v] += (disp[v] / ||disp[v]||) * min(||disp[v]||, temperature)
        Clamp pos[v] to bounding area
   d. Cool temperature:
      temperature *= cooling_factor (e.g., 0.95)
```

**Complexity**: O(n^2 + m) per iteration due to all-pairs repulsive force computation.
Typically 50-200 iterations. Total: O((n^2 + m) * iterations).

### TSG.28.9.3 Barnes-Hut Approximation

The O(n^2) repulsive force computation is the bottleneck. The Barnes-Hut algorithm [JACOMY-2014]
reduces this to O(n * log(n)) using spatial tree decomposition:

```
Algorithm: Barnes-Hut N-Body Approximation
Input: Vertex positions, accuracy parameter theta

1. Build spatial tree (quadtree in 2D, octree in 3D):
   - Recursively subdivide space into cells
   - Each cell stores center of mass and total mass (vertex count)
2. For each vertex v, compute repulsive forces:
   - Walk the spatial tree from root
   - If cell width / distance < theta: treat entire cell as single point
   - Otherwise: recurse into children
3. Apply computed forces to vertex positions
```

**theta parameter**: Controls accuracy/speed tradeoff.
- theta = 0: Exact (no approximation, O(n^2))
- theta = 0.5: Standard approximation
- theta = 1.0: Aggressive approximation (faster, less accurate)

**Complexity**: O(n * log(n)) per iteration with Barnes-Hut.

### TSG.28.9.4 3D Extension for R3F Layer

Tsingou renders intelligence graphs in 3D using React Three Fiber (R3F). The 3D extension
of force-directed layout:

1. **Force vectors**: Extend to 3D (x, y, z components)
2. **Spatial tree**: Octree instead of quadtree for Barnes-Hut
3. **Rendering**: Three.js meshes for vertices, line geometries for edges
4. **Interaction**: Raycasting for click/hover/drag selection

**Web worker isolation**: Force simulation MUST run in a web worker to prevent blocking
the main thread. The R3F render loop reads vertex positions from shared memory (SharedArrayBuffer)
or receives position updates via postMessage.

**Performance targets** for interactive intelligence graph visualization:

| Graph Size | Layout FPS | Interaction Latency | Barnes-Hut theta |
|-----------|-----------|--------------------|--------------------|
| n < 500 | 60 fps | < 16ms | 0.0 (exact) |
| 500 < n < 5,000 | 30 fps | < 33ms | 0.5 |
| 5,000 < n < 50,000 | 10 fps | < 100ms | 0.8 |
| n > 50,000 | 1 fps (layout only) | N/A | 1.0 + level-of-detail |

Implementations MUST use Barnes-Hut approximation for graphs with n > 500 vertices.
Implementations SHOULD support level-of-detail rendering for graphs with n > 5,000:
collapse distant communities to single super-nodes, expand on zoom.

### TSG.28.9.5 ForceAtlas2

Gephi's default layout algorithm [JACOMY-2014] with intelligence-relevant improvements:

- **Degree-dependent repulsive force**: Hub vertices (high degree) repel more strongly,
  preventing visual overlap at hubs
- **Barnes-Hut acceleration**: O(n * log(n)) per iteration
- **Adaptive temperature**: Local and global cooling without manual tuning
- **LinLog mode**: Edges pull with logarithmic force, emphasizing community structure

Implementations SHOULD offer ForceAtlas2 as an alternative layout mode for intelligence
graphs where community structure visualization is the primary objective.

---

## TSG.28.10 Tsingou Integration Mapping

### TSG.28.10.1 d2ts Operators for Graph Computation

The d2ts differential dataflow framework provides incremental graph computation. When new
STIX objects arrive (new SDOs or SROs), only affected computations update — full
recomputation is NOT required.

| d2ts Operator | Graph Computation | Incremental Behavior |
|---------------|-------------------|---------------------|
| `join` | Edge traversal, neighbor lookup | New edge triggers join recomputation for affected vertices |
| `distinct` | Entity deduplication | New duplicate triggers merge |
| `reduce` | Degree counting, aggregation | New edge updates affected vertex counts |
| `iterate` | PageRank, eigenvector convergence | New edge triggers convergence re-evaluation |
| `window` | Temporal graph slicing | Window advance adds/removes edges |
| `count` | Degree centrality | Maintained incrementally per vertex |
| `filter` | Subgraph extraction, k-core | Filter predicate re-evaluated on change |
| `map` | Vertex/edge attribute transformation | Applied to new/changed elements |
| `concat` | Multi-source graph merging | Union of graph streams |

**Incremental PageRank**: When a new edge (u, v) is added to the graph, the PageRank vector
does not need full recomputation. The d2ts `iterate` operator maintains the convergence state
and only recomputes affected vertices (those reachable from u and v within the damping
factor's effective radius).

**Incremental community detection**: The Leiden algorithm can be warm-started from a previous
partition when the graph changes. New vertices are assigned to their best-matching community;
the refinement phase checks only affected communities.

Implementations MUST leverage d2ts incremental computation for all graph analytics.
Full recomputation on every graph change is NOT acceptable for interactive intelligence
analysis.

### TSG.28.10.2 Rendering Pipeline

The complete rendering pipeline from STIX data to 3D visualization:

```
                          STIX Feed
                              |
                              v
                    NATS Subject (iiot.stix.*)
                              |
                              v
                    d2ts Ingest Operator
                              |
                  +-----------+-----------+
                  |           |           |
                  v           v           v
             Graph Ops    Centrality   Community
             (join,       (PageRank,   (Leiden,
              filter)     betweenness) spectral)
                  |           |           |
                  +-----------+-----------+
                              |
                              v
                    Atom State (effect-atom)
                              |
                  +-----------+-----------+
                  |           |           |
                  v           v           v
              R3F Layer   visx Layer   DOM Layer
              (3D graph)  (metrics,   (entity cards,
                          timeline)   alert panels)
```

**State management**: Graph analysis results MUST be stored in effect-atom atoms:
- `graphAtom`: Current graph structure (adjacency list)
- `centralityAtom`: Current centrality scores per vertex
- `communitiesAtom`: Current community assignments
- `layoutAtom`: Current vertex positions (3D coordinates)
- `selectionAtom`: Currently selected/highlighted vertices

React components subscribe to these atoms via `useAtomValue()`. The R3F layer reads
positions from `layoutAtom`; the visx layer reads metrics from `centralityAtom`; the DOM
layer reads entity details from `graphAtom`.

### TSG.28.10.3 Palantir Knowledge Graph Bridge

Palantir Gotham uses an ontology-based knowledge graph. The Tsingou-Palantir bridge maps:

| Tsingou Concept | Palantir Concept | Bridge Operation |
|-----------------|-----------------|-----------------|
| STIX SDO type | Palantir object type | Type mapping table |
| STIX SRO type | Palantir link type | Relationship mapping |
| STIX properties | Palantir properties | Attribute mapping |
| Centrality scores | Palantir annotations | Score export |
| Community labels | Palantir tags | Tag synchronization |

The bridge operates bidirectionally:
1. **Import**: Palantir knowledge graph -> STIX translation -> NATS -> d2ts
2. **Export**: d2ts analysis results -> STIX translation -> Palantir API

Implementations SHOULD support Palantir integration as an optional module. The bridge
MUST NOT create a hard dependency on Palantir — Tsingou operates independently.

### TSG.28.10.4 STIX Graph Model Constraints

When constructing graphs from STIX data, implementations MUST enforce:

1. **Vertex identity**: SDO `id` field is the vertex identifier. Duplicate IDs MUST be
   resolved via entity resolution (Section TSG.28.8.4), not silently dropped.

2. **Edge directionality**: SRO `source_ref` -> `target_ref` defines edge direction.
   Implementations MUST NOT treat STIX relationships as undirected unless explicitly
   computing an undirected projection.

3. **Temporal ordering**: STIX `created` timestamps define temporal ordering.
   Implementations performing temporal analysis MUST use these timestamps, not insertion
   order.

4. **Confidence propagation**: STIX `confidence` scores (0-100) on SROs SHOULD be used
   as edge weights for weighted graph algorithms. Low-confidence relationships SHOULD
   be distinguished visually (e.g., dashed edges in R3F layer).

5. **Revocation handling**: STIX `revoked` flag on SDOs/SROs indicates invalidated
   intelligence. Implementations MUST support soft-deletion (marking revoked objects
   differently, not removing them) to maintain analytical provenance.

---

## TSG.28.11 Normative Constraints Derived from Graph Theory

This section distills the mathematical results of Sections TSG.28.2-TSG.28.9 into
implementable constraints. Each constraint traces to a specific theoretical result.

### TSG.28.11.1 Centrality Computation Constraints

**NC-1: Brandes-only betweenness.** Implementations computing betweenness centrality
MUST use the Brandes algorithm [BRANDES-2001] or a mathematically equivalent method.
The naive O(n^3) all-pairs shortest path approach is forbidden. Rationale: For a STIX
graph with n = 10,000 entities and m = 50,000 relationships, Brandes requires ~5 * 10^8
operations (feasible in < 1 second). The naive approach requires ~10^12 operations
(infeasible for interactive analysis).

**NC-2: Harmonic over classical closeness.** Implementations MUST compute harmonic
centrality [BOLDI-VIGNA-2014] rather than classical closeness centrality on intelligence
graphs. Rationale: Intelligence networks are frequently disconnected (multiple independent
threat actor groups, partial observation). Classical closeness is undefined on disconnected
graphs. Harmonic centrality satisfies the locality axiom: adding edges far from a vertex
does not decrease its centrality.

**NC-3: Damping factor bounds.** PageRank implementations MUST use a damping factor
d in the range [0.5, 0.95]. The default SHOULD be d = 0.85. Rationale: d < 0.5 produces
near-uniform distributions (information loss). d > 0.95 slows convergence and amplifies
structural noise. The standard d = 0.85 balances between following link structure and
random exploration [PAGE-1999].

**NC-4: Convergence tolerance.** Iterative centrality algorithms (eigenvector, PageRank,
HITS, Katz) MUST converge to tolerance epsilon < 10^-6 before reporting results.
Implementations MUST impose a maximum iteration count (RECOMMENDED: 500) and MUST report
when convergence is not achieved within the iteration budget.

**NC-5: Centrality normalization.** All centrality values MUST be normalized to [0, 1]
before display and comparison. Raw centrality values are scale-dependent and misleading
when comparing across graphs of different sizes.

### TSG.28.11.2 Community Detection Constraints

**NC-6: Leiden over Louvain.** The Leiden algorithm [TRAAG-2019] MUST be preferred
over the Louvain algorithm [BLONDEL-2008] for all production use. Louvain MAY be used
as a fast approximation during exploratory analysis, but results MUST be labeled as
"approximate (Louvain)" to distinguish from Leiden's guaranteed-connected communities.

**NC-7: Resolution limit disclosure.** When modularity-based community detection is
applied, implementations MUST disclose the resolution limit: communities with fewer than
sqrt(2m) internal edges may be undetectable [FORTUNATO-2007]. For a network with
m = 100,000 edges, the resolution limit is ~447 internal edges. Implementations SHOULD
provide the resolution parameter gamma (Leiden) to enable multi-resolution analysis.

**NC-8: Multi-run label propagation.** When label propagation is used, implementations
MUST run at least 10 independent trials and report consensus communities (communities
stable across >= 80% of runs). Single-run label propagation is non-deterministic and
unreliable.

**NC-9: Spectral cluster count selection.** When spectral clustering is used,
implementations MUST provide guidance on selecting k (number of clusters). The eigengap
heuristic SHOULD be used: plot eigenvalues of the Laplacian and identify the largest
gap between consecutive eigenvalues. The value of k is the index of this gap.

### TSG.28.11.3 Temporal Analysis Constraints

**NC-10: Temporal vs. static disambiguation.** All graph analytics results MUST be
labeled as either "static" (computed on the time-collapsed aggregated graph) or "temporal"
(computed respecting edge timestamps). Implementations MUST NOT present static results
as temporal or vice versa, as they can differ dramatically [HOLME-SARAMAKI-2012].

**NC-11: Temporal window specification.** Temporal graph analyses MUST specify the time
window [t_start, t_end] over which the analysis is computed. Results without temporal
bounds are meaningless for intelligence: a network's structure in 2024 may bear no
resemblance to its structure in 2025.

**NC-12: Temporal path validation.** Temporal reachability claims ("A could have
communicated information to C via B") MUST be validated against time-respecting paths.
A static path from A to C via B does NOT establish temporal reachability if the B->C
edge predates the A->B edge.

### TSG.28.11.4 Visualization Constraints

**NC-13: Barnes-Hut threshold.** Force-directed layouts for graphs with n > 500
vertices MUST use Barnes-Hut approximation (or equivalent O(n log n) method). The
O(n^2) exact computation is acceptable only for n <= 500.

**NC-14: Level-of-detail rendering.** Graphs with n > 5,000 vertices MUST support
hierarchical aggregation: communities collapsed to representative super-nodes with
drill-down on selection. Rendering all 5,000+ vertices simultaneously at full detail
produces visual noise that degrades analytical performance.

**NC-15: Predicted vs. observed edge distinction.** Link prediction results (Section
TSG.28.8.5) MUST be visually distinct from observed edges. RECOMMENDED: observed edges
rendered as solid lines, predicted edges as dashed lines with opacity proportional to
prediction confidence. Implementations MUST NOT render predicted edges identically to
observed edges, as this conflates inference with observation.

### TSG.28.11.5 Data Integrity Constraints

**NC-16: Entity resolution before analysis.** Entity resolution (Section TSG.28.8.4)
MUST be applied before graph analytics. Computing centrality on a graph with duplicate
entities produces inflated scores for the duplicated entity and deflated scores for
its neighbors.

**NC-17: Revocation propagation.** When a STIX SDO or SRO is revoked, graph analytics
MUST be recomputed excluding the revoked object. Cached centrality scores and community
assignments from before the revocation MUST be invalidated.

**NC-18: Confidence-weighted analysis.** When STIX `confidence` scores are available
on SROs, implementations SHOULD offer confidence-weighted variants of all graph
algorithms. A low-confidence edge (confidence < 30) SHOULD NOT carry the same weight
as a high-confidence edge (confidence > 80) in centrality and path computations.

### TSG.28.11.6 Constraint Summary Table

| ID | Constraint | Normative Level | Section Reference |
|----|-----------|----------------|-------------------|
| NC-1 | Brandes-only betweenness | MUST | TSG.28.3.2 |
| NC-2 | Harmonic over classical closeness | MUST | TSG.28.3.3 |
| NC-3 | Damping factor d in [0.5, 0.95] | MUST | TSG.28.3.5 |
| NC-4 | Convergence epsilon < 10^-6 | MUST | TSG.28.3.4-3.7 |
| NC-5 | Normalize centrality to [0, 1] | MUST | TSG.28.3 |
| NC-6 | Leiden preferred over Louvain | MUST | TSG.28.4.3 |
| NC-7 | Resolution limit disclosure | MUST | TSG.28.4.1 |
| NC-8 | Multi-run label propagation (>=10) | MUST | TSG.28.4.5 |
| NC-9 | Eigengap heuristic for k selection | SHOULD | TSG.28.4.6 |
| NC-10 | Static vs. temporal labeling | MUST | TSG.28.7 |
| NC-11 | Temporal window specification | MUST | TSG.28.7.2 |
| NC-12 | Time-respecting path validation | MUST | TSG.28.7.2 |
| NC-13 | Barnes-Hut for n > 500 | MUST | TSG.28.9.3 |
| NC-14 | Level-of-detail for n > 5,000 | MUST | TSG.28.9.4 |
| NC-15 | Predicted vs. observed edge distinction | MUST | TSG.28.8.5 |
| NC-16 | Entity resolution before analytics | MUST | TSG.28.8.4 |
| NC-17 | Revocation propagation | MUST | TSG.28.10.4 |
| NC-18 | Confidence-weighted analysis | SHOULD | TSG.28.10.4 |

---

## TSG.28.12 Worked Examples for Intelligence Scenarios

### TSG.28.12.1 Example: Identifying the Broker in a Terror Cell Network

**Scenario**: An analyst has a STIX graph of 47 entities (persons, organizations,
infrastructure) and 112 relationships derived from COMINT intercepts and OSINT
social media analysis. The analyst needs to identify the most critical disruption target.

**Step 1**: Compute betweenness centrality (Brandes algorithm):
- Vertex T-14 (person) has betweenness C_B = 0.342 (highest)
- Vertex T-14 appears on 34.2% of all shortest paths
- T-14 connects three otherwise-separated clusters

**Step 2**: Validate with community detection (Leiden, gamma = 1.0):
- Three communities detected: C_1 (18 entities), C_2 (16 entities), C_3 (13 entities)
- T-14 is the ONLY vertex with edges into all three communities
- Removing T-14 increases network diameter from 4 to 9

**Step 3**: Temporal validation:
- Temporal betweenness of T-14 over [2025-01-01, 2025-06-30]: C_B^T = 0.287
- Still highest, confirming T-14's role is not an artifact of time aggregation
- Temporal motif analysis: T-14 participates in 23 feed-forward loops (M4),
  consistent with command-relay-verification pattern

**Conclusion**: T-14 is the network broker. Disruption (arrest, surveillance,
or influence operation) of T-14 would maximally fragment the network into three
isolated components.

### TSG.28.12.2 Example: Tracking Network Evolution After Disruption

**Scenario**: Following disruption of vertex T-14 (Example TSG.28.12.1), the analyst
monitors the residual network over 90 days.

**Day 0**: Three disconnected components (C_1, C_2, C_3). No cross-community edges.

**Day 15**: Temporal graph shows new edge between T-7 (C_1) and T-31 (C_2).
- Link prediction score (Adamic-Adar) for this pair was 0.72 pre-disruption —
  the prediction system had flagged this as a likely fallback link.

**Day 30**: Leiden detects that C_1 and C_2 have merged.
- New community C_{1,2} has 34 entities
- T-7 now has highest betweenness (C_B = 0.28) — the new broker

**Day 60**: Additional edges appear between C_{1,2} and C_3.
- Network approaching pre-disruption connectivity
- T-7 and T-31 jointly serve as brokers (neither alone has high betweenness)

**Intelligence product**: The network reconstituted within 60 days using predicted
fallback links. T-7 and T-31 are now the critical nodes. The reconstitution pattern
(predicted by link prediction scoring) suggests the network has pre-planned
contingency communication channels.

### TSG.28.12.3 Example: OSINT Social Media Network Analysis

**Scenario**: An analyst constructs a graph from Twitter/X follower relationships
among 3,200 accounts discussing a specific geopolitical topic.

**Step 1**: Construct bipartite graph (accounts x hashtags), project to account
co-occurrence network (accounts sharing >= 3 hashtags get an edge).

**Step 2**: Community detection (Leiden, gamma = 1.2 for finer granularity):
- 7 communities detected
- Community C_4 (142 accounts) shows anomalous structure: star topology centered
  on 3 hub accounts with very high out-degree

**Step 3**: Temporal motif analysis on retweet timestamps:
- C_4 shows 87% fan-out motifs (M1) — consistent with coordinated amplification
- Other communities show 40-50% fan-out (organic conversation mix)

**Step 4**: HITS analysis:
- C_4 hub accounts have high hub scores (h > 0.8) but low authority scores (a < 0.1)
- This hub/authority asymmetry is a signature of amplification networks:
  they broadcast but are not cited as authoritative sources

**Intelligence product**: C_4 is likely a coordinated inauthentic behavior (CIB)
cluster. The 3 hub accounts are bot controllers. The fan-out motif dominance and
hub/authority asymmetry confirm artificial amplification rather than organic engagement.

---

## TSG.28.13 Cross-References to Other RFC Sections

| This Section | References | Relationship |
|-------------|-----------|-------------|
| TSG.28.2 (STIX as graph) | TSG.12 (STIX 2.1 Data Model) | STIX SDO/SRO definitions |
| TSG.28.2 (STIX as graph) | TSG.13 (BaseSignal-STIX Codec) | Signal-to-STIX translation |
| TSG.28.3 (Centrality) | TSG.26 (Differential Dataflow) | d2ts iterate for PageRank convergence |
| TSG.28.4 (Community detection) | TSG.27 (Statistical Analysis) | Z-score anomaly detection on community metrics |
| TSG.28.7 (Temporal graphs) | TSG.25 (DSP Foundations) | Windowing functions for temporal slicing |
| TSG.28.8.1 (OSINT SNA) | TSG.2 (SIGINT Domain) | OSINT collection disciplines |
| TSG.28.8.2 (COMINT patterns) | TSG.2 (SIGINT Domain) | COMINT collection disciplines |
| TSG.28.8.3 (Link analysis) | TSG.31 (Analysis Techniques) | Technique catalog mapping |
| TSG.28.9 (Force-directed) | TSG.21 (R3F Layer) | 3D rendering integration |
| TSG.28.9 (Force-directed) | TSG.20 (4-Layer Surface) | Layer composition model |
| TSG.28.10 (Tsingou integration) | TSG.10 (State Management) | Atom-as-State for graph results |
| TSG.28.10 (Tsingou integration) | TSG.11 (NATS Fabric) | STIX event transport |
| TSG.28.10 (Palantir bridge) | TSG.33 (Palantir Integration) | Knowledge graph bridge spec |
| TSG.28.10 (d2ts operators) | TSG.7 (Signal Pipeline) | d2ts operator semantics |
| TSG.28.12 (Worked examples) | TSG.4 (Data Fusion) | Multi-source fusion feeding graph construction |

---

## TSG.28.14 Algorithmic Complexity Summary (Table 28-1)

| Algorithm | Time Complexity | Space | Incremental? |
|-----------|----------------|-------|-------------|
| **Centrality** | | | |
| Degree centrality | O(n + m) | O(n) | Yes (O(1) per edge) |
| Betweenness (Brandes) | O(n * m) unweighted; O(n * m + n^2 log n) weighted | O(n + m) | No (full recompute) |
| Closeness (harmonic) | O(n * m) | O(n) | No (full recompute) |
| Eigenvector (power iter.) | O(m * iters) | O(n) | Warm-start |
| PageRank | O(m * iters), iters ~50-100 | O(n) | Warm-start via d2ts iterate |
| HITS | O(m * iters), iters ~20-30 | O(n) | Warm-start |
| Katz centrality | O(n^3) exact; O(m * iters) iterative | O(n^2) exact; O(n) iterative | Warm-start |
| **Community Detection** | | | |
| Louvain | O(n + m) per pass, ~O(log n) passes | O(n + m) | No (full recompute) |
| Leiden | O(n + m) per pass | O(n + m) | Warm-start |
| Girvan-Newman | O(n * m^2) | O(n + m) | No |
| Label propagation | O(m) per iter, ~5 iters | O(n) | No (but fast enough to rerun) |
| Spectral clustering | O(k * m * iters) sparse; O(n^3) dense | O(n * k) | No |
| **Subgraph Analysis** | | | |
| k-core decomposition | O(n + m) | O(n) | Yes (local updates) |
| Bron-Kerbosch cliques | O(3^(n/3)) worst; O(d * n * 3^(d/3)) sparse | O(n) | No |
| 3-motif counting | O(m^{3/2}) | O(n + m) | Partial (edge sampling) |
| **Path Analysis** | | | |
| BFS (unweighted SSSP) | O(n + m) | O(n) | No |
| Dijkstra (weighted SSSP) | O(m + n log n) | O(n) | No |
| Floyd-Warshall (APSP) | O(n^3) | O(n^2) | No |
| Johnson (sparse APSP) | O(n^2 log n + n * m) | O(n^2) | No |
| Edmonds-Karp (max flow) | O(n * m^2) | O(n + m) | No |
| **Layout** | | | |
| Fruchterman-Reingold | O((n^2 + m) * iters) | O(n) | Warm-start |
| Barnes-Hut FR | O((n log n + m) * iters) | O(n) | Warm-start |
| ForceAtlas2 | O((n log n + m) * iters) | O(n) | Warm-start |

**Recommendation for interactive analysis**: Algorithms marked "Warm-start" are suitable for
incremental updates via d2ts. Algorithms marked "No" require full recomputation; implementations
SHOULD debounce these recomputations (e.g., recompute betweenness at most once per second,
not on every graph change).

---

## TSG.28.15 Open Questions

1. **Streaming community detection**: Can Leiden be made fully streaming (not just warm-started)
   for d2ts integration? The refinement phase requires global knowledge that may conflict with
   purely local incremental updates.

2. **Hypergraph centrality**: Standard centrality measures assume pairwise edges. How should
   centrality be defined and computed on hypergraph representations of multi-party activities?

3. **Uncertainty propagation**: When edge weights represent confidence scores, how should
   uncertainty propagate through multi-hop path computations? Bayesian approaches exist but
   are computationally expensive.

4. **Privacy-preserving graph analysis**: For multi-organization intelligence sharing (Palantir
   bridge), can graph analytics be computed on encrypted or federated data? Secure multi-party
   computation approaches exist but may be impractical at scale.

5. **GPU acceleration**: Force-directed layout and centrality computations are parallelizable.
   WebGPU (emerging standard) could enable GPU-accelerated graph analytics in the browser.
   What is the performance gain for intelligence-scale graphs (10K-100K vertices)?

6. **Visual scalability**: Force-directed layouts become unreadable above ~5,000 vertices.
   What hierarchical aggregation strategies (community-level views with drill-down) best
   serve intelligence analysts? How should level-of-detail transitions be animated?

---

## TSG.28.16 References

### Primary Sources

- [BRANDES-2001] Brandes, U. "A Faster Algorithm for Betweenness Centrality." Journal of
  Mathematical Sociology, 25(2):163-177, 2001.
  https://snap.stanford.edu/class/cs224w-readings/brandes01centrality.pdf

- [BLONDEL-2008] Blondel, V.D., Guillaume, J.-L., Lambiotte, R., Lefebvre, E. "Fast
  unfolding of communities in large networks." Journal of Statistical Mechanics: Theory
  and Experiment, P10008, 2008. https://arxiv.org/abs/0803.0476

- [TRAAG-2019] Traag, V.A., Waltman, L., van Eck, N.J. "From Louvain to Leiden:
  guaranteeing well-connected communities." Scientific Reports, 9:5233, 2019.
  https://www.nature.com/articles/s41598-019-41695-z

- [NEWMAN-GIRVAN-2004] Newman, M.E.J., Girvan, M. "Finding and evaluating community
  structure in networks." Physical Review E, 69:026113, 2004.
  https://arxiv.org/abs/cond-mat/0308217

- [KLEINBERG-1999] Kleinberg, J. "Authoritative sources in a hyperlinked environment."
  Journal of the ACM, 46(5):604-632, 1999.
  https://pi.math.cornell.edu/~mec/Winter2009/RalucaRemus/Lecture4/lecture4.html

- [PAGE-1999] Page, L., Brin, S., Motwani, R., Winograd, T. "The PageRank Citation
  Ranking: Bringing Order to the Web." Stanford Technical Report, 1999.
  https://en.wikipedia.org/wiki/PageRank

- [BRON-KERBOSCH-1973] Bron, C., Kerbosch, J. "Algorithm 457: Finding All Cliques of
  an Undirected Graph." Communications of the ACM, 16(9):575-577, 1973.
  https://en.wikipedia.org/wiki/Bron%E2%80%93Kerbosch_algorithm

- [FRUCHTERMAN-REINGOLD-1991] Fruchterman, T.M.J., Reingold, E.M. "Graph Drawing by
  Force-Directed Placement." Software: Practice and Experience, 21(11):1129-1164, 1991.
  https://dcc.fceia.unr.edu.ar/sites/default/files/uploads/materias/fruchterman.pdf

- [FORD-FULKERSON-1956] Ford, L.R., Fulkerson, D.R. "Maximal Flow through a Network."
  Canadian Journal of Mathematics, 8:399-404, 1956.
  https://en.wikipedia.org/wiki/Ford%E2%80%93Fulkerson_algorithm

- [FORTUNATO-2007] Fortunato, S., Barthelemy, M. "Resolution limit in community detection."
  Proceedings of the National Academy of Sciences, 104(1):36-41, 2007.

### Spectral and Algebraic Methods

- [FIEDLER-1973] Fiedler, M. "Algebraic connectivity of graphs." Czechoslovak Mathematical
  Journal, 23(98):298-305, 1973.

- [SHI-MALIK-2000] Shi, J., Malik, J. "Normalized Cuts and Image Segmentation." IEEE
  Transactions on Pattern Analysis and Machine Intelligence, 22(8):888-905, 2000.

- [VON-LUXBURG-2007] von Luxburg, U. "A Tutorial on Spectral Clustering." Statistics and
  Computing, 17(4):395-416, 2007.
  https://people.csail.mit.edu/dsontag/courses/ml14/notes/Luxburg07_tutorial_spectral_clustering.pdf

### Temporal Networks

- [HOLME-SARAMAKI-2012] Holme, P., Saramaki, J. "Temporal networks." Physics Reports,
  519(3):97-125, 2012.

### Intelligence and Social Network Analysis

- [STIX-2.1] OASIS. "STIX Version 2.1." Committee Specification 01, 2021.
  https://docs.oasis-open.org/cti/stix/v2.1/stix-v2.1.html

- [WASSERMAN-FAUST-1994] Wasserman, S., Faust, K. "Social Network Analysis: Methods and
  Applications." Cambridge University Press, 1994.

- [KREBS-2002] Krebs, V.E. "Mapping Networks of Terrorist Cells." Connections,
  24(3):43-52, 2002.

- [DARK-NETWORKS] Milward, H.B., Raab, J. "Dark Networks as Organizational Problems:
  Elements of a Theory." International Public Management Journal, 9(3):333-360, 2006.

- [I2-METHODOLOGY] i2 Group. "i2 Analyst's Notebook — Discover and deliver actionable
  intelligence." https://i2group.com/i2-analysts-notebook

### Layout and Visualization

- [JACOMY-2014] Jacomy, M., Venturini, T., Heymann, S., Bastian, M. "ForceAtlas2, a
  Continuous Graph Layout Algorithm for Handy Network Visualization Designed for the Gephi
  Software." PLoS ONE, 9(6):e98679, 2014.

- [BOLDI-VIGNA-2014] Boldi, P., Vigna, S. "Axioms for Centrality." Internet Mathematics,
  10(3-4):222-262, 2014.

### Additional Sources

- [KATZ-1953] Katz, L. "A new status index derived from sociometric analysis."
  Psychometrika, 18(1):39-43, 1953.

- [BATAGELJ-ZAVERSNIK-2003] Batagelj, V., Zaversnik, M. "An O(m) Algorithm for Cores
  Decomposition of Networks." arXiv:cs/0310049, 2003.

- [RAGHAVAN-2007] Raghavan, U.N., Albert, R., Kumara, S. "Near linear time algorithm to
  detect community structures in large-scale networks." Physical Review E, 76:036106, 2007.

### Normative References

- [RFC2119] Bradner, S. "Key words for use in RFCs to Indicate Requirement Levels."
  BCP 14, RFC 2119, March 1997.

- [RFC8174] Leiba, B. "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words."
  BCP 14, RFC 8174, May 2017.
