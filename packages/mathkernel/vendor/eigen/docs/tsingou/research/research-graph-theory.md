# Research: Graph Theory & Link Analysis for SIGINT Visualization

```
Document:     research-graph-theory.md
Purpose:      Raw research compilation for RFC section TSG.28
Author:       graph-theory-specialist (Val)
Created:      2026-02-18
Target RFC:   TMNL-RFC-002, Section TSG.28
```

---

## 1. Graph Fundamentals

### 1.1 Core Definitions

A graph G = (V, E) consists of a set V of vertices (nodes) and a set E of edges (links). In intelligence analysis, vertices represent entities (persons, organizations, devices, IP addresses, locations) and edges represent relationships (communications, financial transactions, co-location, organizational membership).

**Directed graph (digraph)**: G = (V, A) where A is a set of ordered pairs (arcs). Communication networks are inherently directed: a call from A to B is distinct from B to A. STIX 2.1 relationship objects (SROs) are directed: `source_ref` -> `relationship_type` -> `target_ref`.

**Weighted graph**: G = (V, E, w) where w: E -> R assigns weights to edges. In COMINT, edge weights may represent call frequency, duration, or data volume. In OSINT, weights may represent confidence scores or temporal recency.

**Multigraph**: Allows multiple edges between the same vertex pair. Essential for intelligence: two entities may share multiple relationship types simultaneously (financial + communication + organizational). STIX explicitly supports this via distinct SRO instances.

**Hypergraph**: H = (V, E) where E is a set of non-empty subsets of V (hyperedges can connect more than two vertices). Models group activities: a meeting involves N participants simultaneously, not N*(N-1)/2 pairwise interactions.

**Bipartite graph**: G = (U, V, E) where vertices partition into two disjoint sets with edges only between sets. Models entity-event relationships: persons (U) attend events (V). Enables projection to single-mode networks for analysis.

### 1.2 Matrix Representations

**Adjacency matrix**: A[i][j] = weight of edge (i,j), or 1/0 for unweighted. For undirected graphs, A is symmetric. For directed graphs, A[i][j] != A[j][i] in general.

- Storage: O(|V|^2) dense, O(|E|) sparse (CSR/CSC)
- Eigenvalues of A determine spectral properties
- A^k[i][j] counts walks of length k from i to j

**Incidence matrix**: B[i][e] = 1 if vertex i is incident to edge e. For directed graphs, B[i][e] = +1 (tail) or -1 (head).

**Laplacian matrix**: L = D - A, where D is the diagonal degree matrix. L is positive semi-definite. Number of zero eigenvalues equals number of connected components. The Fiedler vector (eigenvector of second-smallest eigenvalue) encodes community structure.

**Normalized Laplacian**: L_norm = D^(-1/2) L D^(-1/2). Eigenvalues in [0, 2]. Better for spectral clustering on graphs with heterogeneous degree distributions (common in intelligence networks where hub entities have far more connections than peripheral ones).

### 1.3 Intelligence-Specific Graph Properties

**Scale-free networks**: Many real intelligence networks follow power-law degree distributions. A few hub entities (kingpins, coordinators, C2 servers) connect to many peripheral entities. This property makes centrality measures particularly informative.

**Small-world property**: High clustering coefficient combined with short average path length. Terror networks and criminal organizations often exhibit this: tight local cells with a few long-range links between cells.

**Assortative vs. disassortative mixing**: Social networks tend to be assortative (high-degree nodes connect to high-degree nodes). Technological networks tend to be disassortative. Intelligence networks show mixed patterns depending on organizational structure.

---

## 2. Centrality Measures

Centrality quantifies the "importance" of a vertex. Different centrality measures capture different notions of importance. For intelligence analysis, the choice of centrality measure depends on the operational question.

### 2.1 Degree Centrality

The simplest measure. For vertex v:
- C_D(v) = deg(v) / (|V| - 1)

For directed graphs:
- C_D_in(v) = deg_in(v) / (|V| - 1)  — popularity, receiving communications
- C_D_out(v) = deg_out(v) / (|V| - 1) — activity, initiating communications

**Intelligence application**: High out-degree suggests a coordinator/commander issuing directives. High in-degree suggests a popular target or information sink. The ratio in/out-degree can distinguish roles in a network.

**Complexity**: O(|V| + |E|) to compute all degree centralities.

### 2.2 Betweenness Centrality

Measures how often a vertex lies on shortest paths between other vertices:

C_B(v) = sum_{s != v != t} (sigma_st(v) / sigma_st)

where sigma_st is the number of shortest paths from s to t, and sigma_st(v) is the number passing through v.

**Brandes algorithm** (2001): Computes betweenness for all vertices in O(|V||E|) for unweighted graphs and O(|V||E| + |V|^2 log|V|) for weighted graphs. Space: O(|V| + |E|).

Key insight: Instead of computing all-pairs shortest paths, Brandes uses a single-source BFS/Dijkstra accumulation technique that avoids storing the full path structure.

**Intelligence application**: High betweenness identifies **brokers** and **gatekeepers** — entities that control information flow between otherwise disconnected groups. In terrorist networks, these are the most valuable targets for disruption because their removal fragments the network. In COMINT, high-betweenness communication nodes may indicate relay/cutout points.

**Edge betweenness**: Same concept applied to edges. Used in the Girvan-Newman community detection algorithm. High edge betweenness identifies bridges between communities.

### 2.3 Closeness Centrality

Measures how close a vertex is to all other vertices:

C_C(v) = (|V| - 1) / sum_{u != v} d(v, u)

where d(v, u) is the shortest path distance.

**Problem**: Undefined for disconnected graphs (infinite distances).

**Harmonic centrality** (Boldi & Vigna, 2014) solves this:

C_H(v) = (1 / (|V| - 1)) * sum_{u != v} (1 / d(v, u))

where 1/infinity = 0.

**Intelligence application**: High closeness centrality identifies entities that can rapidly disseminate information or respond quickly to events. In a threat actor network, the entity with highest closeness can most efficiently coordinate a distributed attack.

**Complexity**: O(|V||E|) using BFS from each vertex for unweighted; O(|V|(|E| + |V|log|V|)) for weighted (Dijkstra from each vertex).

### 2.4 Eigenvector Centrality

A vertex's importance is proportional to the importance of its neighbors:

x_i = (1/lambda) * sum_{j in N(i)} x_j

Equivalently: A*x = lambda*x, where x is the eigenvector corresponding to the largest eigenvalue lambda of the adjacency matrix A.

Computed via **power iteration**:
1. Initialize x^(0) = uniform
2. x^(k+1) = A * x^(k) / ||A * x^(k)||
3. Repeat until convergence

**Convergence**: Guaranteed by the Perron-Frobenius theorem for connected graphs with non-negative adjacency matrices. Rate of convergence depends on the ratio lambda_2/lambda_1 (eigenvalue gap).

**Intelligence application**: Identifies entities that are connected to other well-connected entities. An operative who personally has few connections but whose contacts are all hub entities has high eigenvector centrality — a potential hidden coordinator.

### 2.5 PageRank

Google's variant of eigenvector centrality with a damping factor:

PR(v) = (1 - d)/|V| + d * sum_{u in B(v)} PR(u)/L(u)

where d is the damping factor (typically 0.85), B(v) is the set of vertices linking to v, and L(u) is the out-degree of u.

The damping factor models a "random surfer" who follows links with probability d and jumps to a random vertex with probability (1-d). This ensures convergence even for graphs with dangling nodes or disconnected components.

**Matrix formulation**: PR = (1-d)/|V| * 1 + d * M^T * PR, where M is the column-normalized adjacency matrix.

**Convergence**: Typically 50-100 iterations for web-scale graphs. The power iteration converges geometrically at rate d.

**Intelligence application**: In communication networks, PageRank identifies entities that receive communications from other important communicators. Unlike eigenvector centrality, PageRank handles directed graphs naturally and doesn't break on dangling nodes (entities that communicate but receive no communications).

### 2.6 HITS (Hyperlink-Induced Topic Search)

Kleinberg's algorithm (1999) assigns two scores to each vertex:

- **Authority score** a(v): High if pointed to by good hubs
- **Hub score** h(v): High if pointing to good authorities

Iterative computation:
1. a(v) = sum_{u -> v} h(u)    (authority update)
2. h(v) = sum_{v -> u} a(u)    (hub update)
3. Normalize both vectors

Converges to the principal eigenvector of A^T*A (authorities) and A*A^T (hubs).

**Intelligence application**: In STIX relationship graphs, HITS naturally identifies:
- **Authorities**: Threat actors referenced by many indicators (well-characterized threats)
- **Hubs**: Intelligence reports that reference many threat actors (comprehensive assessments)

In communication networks:
- **Authorities**: Entities receiving calls from many coordinators
- **Hubs**: Entities making calls to many operational targets

### 2.7 Katz Centrality

Counts all paths (not just shortest) with exponential attenuation:

C_Katz(i) = sum_{k=1}^{infinity} sum_{j=1}^{|V|} alpha^k * (A^k)_{ji}

where alpha is the attenuation factor, 0 < alpha < 1/lambda_max(A).

**Matrix formulation**: C_Katz = ((I - alpha*A^T)^(-1) - I) * 1

**Intelligence application**: Katz centrality captures influence that propagates along ALL paths, not just shortest. In threat actor networks, an entity may be important not because it's on the shortest path but because it's reachable through many redundant paths — indicating resilient connectivity that's harder to disrupt.

**Complexity**: O(|V|^3) via matrix inversion, or iterative with O(|V|^2) per iteration.

---

## 3. Community Detection

Communities (clusters, modules) are groups of vertices more densely connected internally than externally. In intelligence analysis, communities correspond to organizational cells, social groups, topic clusters, or coordinated activity patterns.

### 3.1 Modularity

Newman-Girvan modularity (2004):

Q = (1/2m) * sum_{ij} [A_{ij} - (k_i * k_j)/(2m)] * delta(c_i, c_j)

where m = |E|, k_i = degree of vertex i, c_i = community of vertex i, and delta is the Kronecker delta.

Q ranges from -0.5 to 1. Values > 0.3 typically indicate significant community structure. The null model is the configuration model (random graph preserving degree sequence).

**Resolution limit**: Fortunato & Barthelemy (2007) proved that modularity optimization cannot detect communities smaller than sqrt(2m). This is critical for intelligence: small terror cells may fall below the resolution limit in large networks.

### 3.2 Louvain Algorithm

Blondel et al. (2008). "Fast unfolding of communities in large networks."

Two phases, repeated iteratively:
1. **Local optimization**: Each vertex is moved to the neighboring community that maximizes modularity gain. Repeated until no move improves Q.
2. **Aggregation**: Build a new graph where communities become super-nodes. Edge weights = sum of inter-community edges.

**Modularity gain for moving vertex i to community C**:
delta_Q = [sum_in + 2*k_{i,in}] / 2m - [(sum_tot + k_i) / 2m]^2
        - [sum_in / 2m - (sum_tot / 2m)^2 - (k_i / 2m)^2]

**Complexity**: O(|V| + |E|) per pass, typically converges in a few passes. Near-linear in practice.

**Known defect**: Can produce arbitrarily badly connected communities. Up to 25% of communities may be badly connected; up to 16% may be disconnected.

### 3.3 Leiden Algorithm

Traag, Waltman & van Eck (2019). "From Louvain to Leiden: guaranteeing well-connected communities."

Three phases per iteration:
1. **Local moving**: Same as Louvain phase 1
2. **Refinement**: Communities from phase 1 are refined by considering whether they should be split. Nodes within each community are allowed to form sub-communities.
3. **Aggregation**: Build super-graph based on refined communities

**Key improvement**: The refinement phase guarantees that all communities are well-connected (internally connected subgraphs). Louvain lacks this guarantee.

**Performance**: Faster than Louvain (20x on large networks like UK Web 2005 with 39M nodes, 783M edges), and produces higher-quality partitions.

**Convergence guarantee**: When applied iteratively, the Leiden algorithm converges to a partition in which all subsets of all communities are locally optimally assigned.

### 3.4 Girvan-Newman Algorithm

Newman & Girvan (2004). "Finding and evaluating community structure in networks."

Algorithm:
1. Compute edge betweenness for all edges
2. Remove the edge with highest betweenness
3. Recalculate edge betweenness (critical — skipping this causes severe errors)
4. Repeat until no edges remain

The dendrogram of successive community splits is produced. Cut the dendrogram at the level maximizing modularity Q.

**Complexity**: O(|V| * |E|^2) — too expensive for large networks. The recalculation step dominates.

**Intelligence application**: Produces a hierarchical decomposition. Useful when the analyst needs to see community structure at multiple granularities (e.g., cells within organizations within alliances).

### 3.5 Label Propagation

Raghavan, Albert & Kumara (2007). "Near linear time algorithm to detect community structures in large-scale networks."

Algorithm:
1. Assign unique label to each vertex
2. In random order, each vertex adopts the label most frequent among its neighbors (ties broken randomly)
3. Repeat until no vertex changes label

**Complexity**: Nearly O(|E|) per iteration, converges in ~5 iterations.

**Advantages**: No optimization function, no parameters (except tie-breaking). Very fast.

**Disadvantages**: Non-deterministic (random tie-breaking), can produce unstable results, no quality guarantee.

### 3.6 Spectral Clustering

Uses eigenvectors of the graph Laplacian:

1. Compute Laplacian L = D - A (or normalized variant)
2. Find k smallest eigenvectors of L
3. Form matrix U with these eigenvectors as columns
4. Apply k-means to rows of U

**Fiedler vector**: The eigenvector corresponding to the second-smallest eigenvalue of L. The sign of Fiedler vector entries naturally bisects the graph. Vertices with positive values in one partition, negative in the other.

**Theoretical grounding**: The normalized cut (Ncut) objective has a relaxation that is exactly the normalized Laplacian eigenproblem (Shi & Malik, 2000).

**Intelligence application**: Spectral methods work well on networks with clear spectral gaps (well-separated communities). The number of near-zero eigenvalues indicates the number of well-separated components.

**Complexity**: O(|V|^3) for dense eigendecomposition, but Lanczos/ARPACK can compute k eigenvectors in O(k * |E|) for sparse graphs.

---

## 4. Subgraph Analysis

### 4.1 k-Core Decomposition

A k-core is the maximal subgraph where every vertex has degree >= k within the subgraph.

Algorithm (Batagelj & Zaversnik, 2003):
1. Find vertex with minimum degree
2. If deg(v) < k, remove v and update neighbors' degrees
3. Repeat until all remaining vertices have degree >= k

The **coreness** of a vertex is the maximum k for which it belongs to a k-core.

**Complexity**: O(|V| + |E|) — linear!

**Intelligence application**: Higher coreness indicates membership in more tightly connected subgroups. The innermost core often contains the most critical actors. k-core decomposition provides a "peeling" view of network density layers.

### 4.2 Clique Detection

A clique is a complete subgraph (every pair of vertices is adjacent).

**Bron-Kerbosch algorithm** (1973): Finds all maximal cliques.

Bron-Kerbosch(R, P, X):
  if P and X are both empty:
    report R as a maximal clique
  choose a pivot vertex u from P union X
  for each vertex v in P \ N(u):
    Bron-Kerbosch(R union {v}, P intersect N(v), X intersect N(v))
    P = P \ {v}
    X = X union {v}

**Complexity**: O(3^(n/3)) worst case, matching the Moon-Moser bound on maximum number of maximal cliques. For sparse graphs: O(d * n * 3^(d/3)) where d is degeneracy.

**Intelligence application**: Cliques represent fully connected subgroups where every member communicates with every other member. In criminal networks, cliques may indicate operational cells with full internal coordination.

### 4.3 Network Motifs

Motifs are recurring subgraph patterns that appear significantly more often than in random graphs. Defined relative to a null model (typically configuration model or Erdos-Renyi).

Common 3-node directed motifs:
- Feed-forward loop (A->B, A->C, B->C): Command chain with bypass
- Feedback loop (A->B, B->C, C->A): Circular reporting
- Fan-out (A->B, A->C): Broadcast/command distribution
- Fan-in (B->A, C->A): Information aggregation

**Motif detection**: For k-node motifs, enumerate all k-subgraphs and classify by isomorphism type. Compare counts to null model.

**Complexity**: Exponential in k. Practical for k = 3, 4. Approximate methods (sampling) for k = 5, 6.

**Intelligence application**: Motif analysis reveals organizational patterns:
- Feed-forward loops suggest hierarchical command structures
- Fan-out patterns identify broadcast/coordination nodes
- Unusual motif frequencies (compared to null model) indicate deliberate organizational design

---

## 5. Path Analysis

### 5.1 Shortest Paths

**Dijkstra's algorithm**: Single-source shortest path for non-negative weights. O(|E| + |V|log|V|) with Fibonacci heap.

**Bellman-Ford**: Handles negative weights. O(|V| * |E|). Detects negative cycles.

**Floyd-Warshall**: All-pairs shortest paths. O(|V|^3). Space O(|V|^2). Simple to implement but cubic scaling limits it to moderate-size graphs (< 10K nodes).

**BFS**: Unweighted single-source shortest paths. O(|V| + |E|).

**Intelligence application**: Shortest paths reveal the minimum number of intermediaries between two entities. In communication networks, short paths suggest potential for rapid information propagation. In supply chains, short paths indicate vulnerability to cascade effects.

### 5.2 All-Pairs Shortest Paths

Floyd-Warshall: O(|V|^3). Complete distance matrix enables global analyses.

Johnson's algorithm: O(|V|^2 * log|V| + |V| * |E|). Better for sparse graphs. Uses Bellman-Ford to reweight edges, then Dijkstra from each source.

**Intelligence application**: The complete distance matrix enables diameter computation, eccentricity analysis, and center/periphery identification. The diameter reveals the maximum possible "degrees of separation" in the network.

### 5.3 Network Flow

**Max-flow/min-cut theorem** (Ford & Fulkerson, 1956): The maximum flow from source s to sink t equals the minimum capacity of any s-t cut.

**Ford-Fulkerson algorithm**: Iteratively find augmenting paths in the residual graph. O(|E| * F) where F is max flow value.

**Edmonds-Karp**: BFS-based augmenting path selection. O(|V| * |E|^2).

**Push-relabel**: O(|V|^2 * |E|) or O(|V|^3) with FIFO selection.

**Intelligence application**:
- **Maximum flow** between two entities measures the communication capacity or information bandwidth of the path network.
- **Minimum cut** identifies the smallest set of edges (relationships) whose removal disconnects two entities — optimal disruption strategy.
- **Vertex connectivity**: Minimum number of vertices whose removal disconnects the graph — measures network resilience.

---

## 6. Temporal Graphs

### 6.1 Formalization

A temporal graph G_T = (V, E, tau) where tau: E -> 2^T assigns time labels to edges. An edge (u, v, t) exists at time t.

Alternative formulation: Sequence of graph snapshots G_1, G_2, ..., G_T where G_t = (V, E_t) is the graph at time t.

### 6.2 Temporal Paths and Reachability

A **temporal path** from u to v is a sequence of edges (v_0, v_1, t_1), (v_1, v_2, t_2), ..., (v_{k-1}, v_k, t_k) where t_1 <= t_2 <= ... <= t_k (time-respecting).

**Key insight**: Most node pairs reachable in the static aggregated graph are NOT connected by time-respecting paths. The arrow of time dramatically restricts reachability.

**Temporal reachability graph**: Directed graph R where (u, v) in R iff there exists a temporal path from u to v.

**Restless temporal paths**: Paths with maximum waiting time constraints at intermediate nodes. NP-hard in general (contrast with polynomial-time static shortest paths).

### 6.3 Temporal Centrality

Static centrality measures can be meaningfully different from their temporal counterparts:

- **Temporal betweenness**: Count only time-respecting shortest paths. A vertex may have high static betweenness but low temporal betweenness if the relevant paths don't respect temporal ordering.
- **Temporal closeness**: Replace static distances with temporal distances (earliest arrival time).
- **Temporal PageRank**: Edge weights decay with age; recent connections contribute more.

### 6.4 Temporal Motifs

Recurring subgraph patterns with temporal ordering. A temporal 3-motif specifies both the topology (who connects to whom) and the temporal ordering (which edge appears first).

Example: "A calls B, then B calls C, then C calls A" (temporal feedback loop) is a different temporal motif from "A calls B, then C calls A, then B calls C" even though the static graph is the same.

Temporal motifs capture communication protocols and behavioral patterns invisible in static analysis.

**Intelligence application**: Temporal motifs reveal:
- Command-and-control communication patterns (directive followed by acknowledgment)
- Dead-drop timing patterns (A writes, then B reads, never simultaneously)
- Coordination patterns preceding events (spike in specific temporal motifs before operations)

---

## 7. Intelligence-Specific Applications

### 7.1 Social Network Analysis for OSINT

Open-source intelligence often produces social network data:
- Social media follower/following graphs
- Co-occurrence in documents, forums, events
- Organizational membership networks
- Citation/reference networks

SNA techniques applied to OSINT:
1. **Entity identification**: Named entity recognition -> graph vertices
2. **Relationship extraction**: Co-occurrence, mentions -> graph edges
3. **Community detection**: Identify affiliated groups
4. **Centrality analysis**: Identify key influencers
5. **Temporal analysis**: Track network evolution
6. **Anomaly detection**: Identify unusual structural patterns

### 7.2 Communication Pattern Analysis for COMINT

COMINT intercepts produce call detail records (CDRs):
- Caller/callee identifiers
- Timestamp, duration
- Communication type (voice, text, data)
- Metadata (cell tower, protocol)

Graph analysis on CDR data:
1. **Contact chaining**: Expand from seed entity through N hops (NSA uses up to 3 hops)
2. **Community detection**: Identify communication groups
3. **Temporal patterns**: Daily/weekly communication rhythms
4. **Anomaly detection**: Unusual communication patterns (burst activity, new contacts, changed patterns)
5. **Role classification**: Centrality-based role identification (coordinator, operative, facilitator)

### 7.3 Link Analysis (i2 Analyst's Notebook Methodology)

i2 Analyst's Notebook is the industry standard for intelligence link analysis. Core methodologies:

**Association charts**: Visual representation of entity relationships. Entities typed by category (person, organization, vehicle, communication, location, event). Relationships typed and directed.

**Timeline analysis**: Events placed on temporal axis with entity grouping. Enables pattern-of-life analysis and event sequencing.

**Social network analysis**: Built-in SNA metrics (degree, betweenness, closeness). Group detection and influence analysis.

**Data fusion**: Integration of multiple data sources into unified graph. Entity resolution across sources.

**Tsingou analogy**: i2's association charts map to Tsingou's R3F force-directed graph. i2's timeline maps to visx timeline layer. i2's SNA metrics map to Tsingou's d2ts graph operators.

### 7.4 Entity Resolution and Deduplication

The same real-world entity may appear under multiple identifiers across data sources:
- Different names (aliases, transliterations)
- Different identifiers (phone numbers, email addresses, IP addresses)
- Partial information overlap

Graph-based entity resolution:
1. **Blocking**: Generate candidate pairs using graph structure (shared neighbors)
2. **Matching**: Score similarity between candidate entity pairs
3. **Clustering**: Group matched entities using connected components or correlation clustering
4. **Merging**: Create unified entity with combined attributes

**Intelligence application**: Critical for multi-source intelligence fusion. STIX 2.1 addresses this with `identity` SDOs that can carry multiple attributes and external references.

### 7.5 Dark Network Analysis

Dark networks (covert, illegal) differ from open networks:
- **Incomplete data**: Only observed interactions, large gaps
- **Deception**: Deliberate misinformation about structure
- **Security-efficiency tradeoff**: Dark networks sacrifice communication efficiency for operational security
- **Cell structure**: Compartmentalized with minimal cross-cell links

Analysis techniques for dark networks:
1. **Missing link prediction**: Infer unobserved connections from structural patterns
2. **Key player identification**: Centrality measures adapted for incomplete data
3. **Destabilization analysis**: Identify optimal target set for network disruption (NP-hard in general, heuristic approaches)
4. **Resilience analysis**: How many removals does the network tolerate before fragmentation?
5. **Evolution tracking**: Monitor network restructuring after disruptions

---

## 8. Force-Directed Layout Algorithms

### 8.1 Spring-Electrical Model

Vertices repel each other (Coulomb's law), edges act as springs (Hooke's law):
- F_repulsive(u, v) = -k^2 / d(u, v)
- F_attractive(u, v) = d(u, v)^2 / k

where k = C * sqrt(area / |V|) is the optimal distance.

### 8.2 Fruchterman-Reingold Algorithm (1991)

1. Initialize positions randomly
2. For each iteration:
   a. Compute repulsive forces between all vertex pairs: O(|V|^2)
   b. Compute attractive forces along edges: O(|E|)
   c. Update positions capped by temperature
   d. Reduce temperature (simulated annealing)
3. Repeat until convergence or iteration limit

**Complexity**: O(|V|^2 + |E|) per iteration, typically ~100 iterations. Total: O(|V|^2 * iterations).

### 8.3 Barnes-Hut Optimization

Approximates N-body repulsive forces using spatial tree (quadtree in 2D, octree in 3D):
1. Build spatial tree of vertex positions
2. For distant vertex groups, approximate as single point mass
3. Theta parameter controls accuracy/speed tradeoff

**Complexity**: O(|V| * log|V|) per iteration — from quadratic to linearithmic.

**Critical for Tsingou**: Intelligence networks with thousands of entities require Barnes-Hut or similar approximation for interactive frame rates in the R3F 3D layer.

### 8.4 3D Extension

Extend to 3D by using 3D force vectors and octree (instead of quadtree) for Barnes-Hut. The additional dimension provides more space for untangling complex graphs.

**Tsingou R3F integration**: three-forcegraph library implements WebGL-based 3D force-directed layout. Vertices rendered as Three.js meshes, edges as line geometries. Force simulation runs in a web worker for non-blocking animation.

### 8.5 ForceAtlas2

Gephi's default layout algorithm (Jacomy et al., 2014):
- Degree-dependent repulsive force: hub vertices repel more strongly
- Barnes-Hut approximation for scalability
- Local and global adaptive temperatures (no manual tuning)
- LinLog mode for emphasizing community structure

---

## 9. STIX 2.1 Graph Model

### 9.1 SDOs as Vertices

STIX Domain Objects (SDOs) represent entities:

| SDO Type | Graph Role | Intelligence Use |
|----------|-----------|-----------------|
| `threat-actor` | Node | Attributed adversary |
| `identity` | Node | Person, organization, system |
| `indicator` | Node | Detection signature |
| `malware` | Node | Malicious tool |
| `attack-pattern` | Node | TTP from ATT&CK |
| `infrastructure` | Node | C2 servers, hosting |
| `location` | Node | Geographic position |
| `campaign` | Node | Named operation |
| `intrusion-set` | Node | Related activity group |
| `observed-data` | Node | Raw observation |

### 9.2 SROs as Edges

STIX Relationship Objects (SROs) define directed edges:

```
{
  "type": "relationship",
  "relationship_type": "uses",
  "source_ref": "threat-actor--...",
  "target_ref": "malware--..."
}
```

Common relationship types: `uses`, `targets`, `attributed-to`, `indicates`, `mitigates`, `located-at`, `based-on`, `communicates-with`, `controls`.

**Sighting SRO**: Special relationship recording when/where an indicator was observed.

### 9.3 Graph Properties of STIX Networks

- **Directed**: SROs have source and target
- **Typed vertices**: SDO type determines vertex category
- **Typed edges**: relationship_type determines edge semantics
- **Multigraph**: Multiple SROs between same SDO pair (e.g., "uses" AND "controls")
- **Heterogeneous**: Different vertex and edge types in same graph
- **Temporal**: SROs carry `created` and `modified` timestamps; sightings carry `first_seen` and `last_seen`

---

## 10. Tsingou-Specific Integration Points

### 10.1 d2ts Operators for Graph Computation

d2ts (differential dataflow) operators enable incremental graph computation:

| d2ts Operator | Graph Computation | Use Case |
|---------------|-------------------|----------|
| `join` | Edge traversal | Expand from entity to neighbors |
| `distinct` | Deduplication | Entity resolution |
| `reduce` | Aggregation | Degree computation, centrality accumulation |
| `iterate` | Fixed-point | PageRank, eigenvector centrality convergence |
| `window` | Temporal slicing | Temporal graph snapshots |
| `count` | Degree counting | Degree centrality |
| `filter` | Subgraph extraction | k-core, community filtering |

### 10.2 R3F 3D Rendering Pipeline

The force-directed graph visualization in the R3F layer:

1. **Data ingestion**: STIX SDOs/SROs arrive via NATS -> d2ts ingest
2. **Graph construction**: d2ts `join` operators build adjacency structure
3. **Layout computation**: Force-directed simulation (web worker)
4. **Rendering**: Three.js meshes (nodes) + line geometries (edges)
5. **Interaction**: Raycasting for selection, hover, drag

### 10.3 Palantir Knowledge Graph Bridge

Palantir Gotham uses an ontology-based knowledge graph. The bridge:
1. Map STIX SDO types to Palantir object types
2. Map STIX SRO types to Palantir link types
3. Synchronize via Palantir's REST API or SDK
4. Maintain bidirectional consistency

### 10.4 Analysis Pipeline

```
STIX feed -> NATS -> d2ts ingest -> Graph construction
                                        |
                                        v
                                  Centrality computation (d2ts iterate)
                                        |
                                        v
                                  Community detection (d2ts reduce + iterate)
                                        |
                                        v
                                  R3F visualization (force-directed layout)
                                        |
                                        v
                                  DOM overlay (metrics, entity cards)
```

---

## 11. References

- [BRANDES-2001] Brandes, U. "A Faster Algorithm for Betweenness Centrality." Journal of Mathematical Sociology, 25(2):163-177, 2001.
- [BLONDEL-2008] Blondel, V.D., Guillaume, J.-L., Lambiotte, R., Lefebvre, E. "Fast unfolding of communities in large networks." Journal of Statistical Mechanics, P10008, 2008.
- [TRAAG-2019] Traag, V.A., Waltman, L., van Eck, N.J. "From Louvain to Leiden: guaranteeing well-connected communities." Scientific Reports, 9:5233, 2019.
- [NEWMAN-GIRVAN-2004] Newman, M.E.J., Girvan, M. "Finding and evaluating community structure in networks." Physical Review E, 69:026113, 2004.
- [KLEINBERG-1999] Kleinberg, J. "Authoritative sources in a hyperlinked environment." Journal of the ACM, 46(5):604-632, 1999.
- [PAGE-1999] Page, L., Brin, S., Motwani, R., Winograd, T. "The PageRank Citation Ranking: Bringing Order to the Web." Stanford Technical Report, 1999.
- [BRON-KERBOSCH-1973] Bron, C., Kerbosch, J. "Algorithm 457: Finding All Cliques of an Undirected Graph." Communications of the ACM, 16(9):575-577, 1973.
- [FRUCHTERMAN-REINGOLD-1991] Fruchterman, T.M.J., Reingold, E.M. "Graph Drawing by Force-Directed Placement." Software: Practice and Experience, 21(11):1129-1164, 1991.
- [FORD-FULKERSON-1956] Ford, L.R., Fulkerson, D.R. "Maximal Flow through a Network." Canadian Journal of Mathematics, 8:399-404, 1956.
- [FORTUNATO-2007] Fortunato, S., Barthelemy, M. "Resolution limit in community detection." Proceedings of the National Academy of Sciences, 104(1):36-41, 2007.
- [FIEDLER-1973] Fiedler, M. "Algebraic connectivity of graphs." Czechoslovak Mathematical Journal, 23(98):298-305, 1973.
- [SHI-MALIK-2000] Shi, J., Malik, J. "Normalized Cuts and Image Segmentation." IEEE Transactions on Pattern Analysis and Machine Intelligence, 22(8):888-905, 2000.
- [VON-LUXBURG-2007] von Luxburg, U. "A Tutorial on Spectral Clustering." Statistics and Computing, 17(4):395-416, 2007.
- [HOLME-SARAMAKI-2012] Holme, P., Saramaki, J. "Temporal networks." Physics Reports, 519(3):97-125, 2012.
- [RAGHAVAN-2007] Raghavan, U.N., Albert, R., Kumara, S. "Near linear time algorithm to detect community structures in large-scale networks." Physical Review E, 76:036106, 2007.
- [JACOMY-2014] Jacomy, M., Venturini, T., Heymann, S., Bastian, M. "ForceAtlas2, a Continuous Graph Layout Algorithm for Handy Network Visualization Designed for the Gephi Software." PLoS ONE, 9(6):e98679, 2014.
- [KATZ-1953] Katz, L. "A new status index derived from sociometric analysis." Psychometrika, 18(1):39-43, 1953.
- [BOLDI-VIGNA-2014] Boldi, P., Vigna, S. "Axioms for Centrality." Internet Mathematics, 10(3-4):222-262, 2014.
- [BATAGELJ-ZAVERSNIK-2003] Batagelj, V., Zaversnik, M. "An O(m) Algorithm for Cores Decomposition of Networks." arXiv:cs/0310049, 2003.
- [STIX-2.1] OASIS. "STIX Version 2.1." Committee Specification 01, 2021.
- [WASSERMAN-FAUST-1994] Wasserman, S., Faust, K. "Social Network Analysis: Methods and Applications." Cambridge University Press, 1994.
- [KREBS-2002] Krebs, V.E. "Mapping Networks of Terrorist Cells." Connections, 24(3):43-52, 2002.
- [DARK-NETWORKS] Milward, H.B., Raab, J. "Dark Networks as Organizational Problems: Elements of a Theory." International Public Management Journal, 9(3):333-360, 2006.
