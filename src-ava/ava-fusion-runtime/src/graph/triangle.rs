//! Triangle counting and clustering coefficients.
//!
//! Triangles in the entity correlation graph indicate strong mutual association.
//! Three entities that are all pairwise correlated form a clique — much stronger
//! evidence of common identity than any single edge.
//!
//! Triangle count: O(|E|^{3/2}) via edge-iterator algorithm.
//! Clustering coefficient: CC(v) = 2T(v) / (deg(v) · (deg(v) - 1))

use std::collections::{HashMap, HashSet};

// ---------------------------------------------------------------------------
// Graph representation
// ---------------------------------------------------------------------------

/// Undirected graph stored as adjacency sets.
///
/// Node IDs are `u64`. Edges are stored bidirectionally.
/// Self-loops are ignored.
#[derive(Debug, Clone)]
pub struct UndirectedGraph {
    /// Adjacency sets: node → set of neighbors.
    pub adj: HashMap<u64, HashSet<u64>>,
    /// Total number of edges (undirected count).
    edge_count: usize,
}

impl UndirectedGraph {
    /// Create an empty graph.
    pub fn new() -> Self {
        Self {
            adj: HashMap::new(),
            edge_count: 0,
        }
    }

    /// Add an undirected edge. Returns `false` if already exists or self-loop.
    pub fn add_edge(&mut self, u: u64, v: u64) -> bool {
        if u == v {
            return false;
        }
        let inserted = self.adj.entry(u).or_default().insert(v);
        if inserted {
            self.adj.entry(v).or_default().insert(u);
            self.edge_count += 1;
        }
        inserted
    }

    /// Remove an undirected edge. Returns `true` if it existed.
    pub fn remove_edge(&mut self, u: u64, v: u64) -> bool {
        let removed = self
            .adj
            .get_mut(&u)
            .map(|s| s.remove(&v))
            .unwrap_or(false);
        if removed {
            if let Some(s) = self.adj.get_mut(&v) {
                s.remove(&u);
            }
            self.edge_count -= 1;
        }
        removed
    }

    /// Degree of a node.
    pub fn degree(&self, node: u64) -> usize {
        self.adj.get(&node).map(|s| s.len()).unwrap_or(0)
    }

    /// Number of nodes.
    pub fn node_count(&self) -> usize {
        self.adj.len()
    }

    /// Number of undirected edges.
    pub fn edge_count(&self) -> usize {
        self.edge_count
    }

    /// Iterate over all nodes.
    pub fn nodes(&self) -> impl Iterator<Item = u64> + '_ {
        self.adj.keys().copied()
    }

    /// Check if an edge exists.
    pub fn has_edge(&self, u: u64, v: u64) -> bool {
        self.adj.get(&u).map(|s| s.contains(&v)).unwrap_or(false)
    }
}

impl Default for UndirectedGraph {
    fn default() -> Self {
        Self::new()
    }
}

// ---------------------------------------------------------------------------
// Triangle counting
// ---------------------------------------------------------------------------

/// Count total triangles in the graph.
///
/// Uses the edge-iterator algorithm: for each edge (u, v) where deg(u) <= deg(v),
/// count common neighbors. O(|E| · sqrt(|E|)) = O(|E|^{3/2}).
///
/// Returns the total number of triangles (each counted once).
pub fn count_triangles(graph: &UndirectedGraph) -> usize {
    let mut total = 0;

    // For each edge (u, v), orient by degree to avoid double-counting.
    let mut visited = HashSet::new();
    for &u in graph.adj.keys() {
        if let Some(neighbors_u) = graph.adj.get(&u) {
            for &v in neighbors_u {
                // Process each edge once: (min_deg, max_deg) orientation.
                let key = if u < v { (u, v) } else { (v, u) };
                if !visited.insert(key) {
                    continue;
                }

                // Count common neighbors.
                if let Some(neighbors_v) = graph.adj.get(&v) {
                    // Intersect the smaller set with the larger.
                    let (smaller, larger) = if neighbors_u.len() <= neighbors_v.len() {
                        (neighbors_u, neighbors_v)
                    } else {
                        (neighbors_v, neighbors_u)
                    };

                    for &w in smaller {
                        if w != u && w != v && larger.contains(&w) {
                            // Triangle (u, v, w). Count once per oriented edge.
                            total += 1;
                        }
                    }
                }
            }
        }
    }

    // Each triangle counted 3 times (once per edge). But we orient edges
    // so each edge is visited once. A triangle has 3 edges, each counting
    // it once via common neighbors. So total / 3 is not needed because
    // we count common neighbors per edge, and each triangle is found
    // by exactly one of its three edges... Actually, let me reconsider.
    //
    // For triangle (a, b, c):
    //   Edge (a,b): w=c is a common neighbor → counted once
    //   Edge (a,c): w=b is a common neighbor → counted once
    //   Edge (b,c): w=a is a common neighbor → counted once
    // Total = 3 per triangle. Divide by 3.
    total / 3
}

/// Count triangles per node.
///
/// Returns a map: node → number of triangles containing that node.
pub fn triangles_per_node(graph: &UndirectedGraph) -> HashMap<u64, usize> {
    let mut counts: HashMap<u64, usize> = HashMap::new();

    let mut visited = HashSet::new();
    for &u in graph.adj.keys() {
        if let Some(neighbors_u) = graph.adj.get(&u) {
            for &v in neighbors_u {
                let key = if u < v { (u, v) } else { (v, u) };
                if !visited.insert(key) {
                    continue;
                }

                if let Some(neighbors_v) = graph.adj.get(&v) {
                    let (smaller, larger) = if neighbors_u.len() <= neighbors_v.len() {
                        (neighbors_u, neighbors_v)
                    } else {
                        (neighbors_v, neighbors_u)
                    };

                    for &w in smaller {
                        if w != u && w != v && larger.contains(&w) {
                            *counts.entry(u).or_default() += 1;
                            *counts.entry(v).or_default() += 1;
                            *counts.entry(w).or_default() += 1;
                        }
                    }
                }
            }
        }
    }

    // Each triangle counted 3 times per its edges. Each node gets +1 for
    // each edge of its triangle. So per triangle, each of its 3 nodes
    // gets +3 (once from each edge). Divide by 3 for actual count.
    for count in counts.values_mut() {
        *count /= 3;
    }

    counts
}

/// Clustering coefficient of a node.
///
/// CC(v) = 2T(v) / (deg(v) · (deg(v) - 1))
/// Returns 0.0 for nodes with degree < 2.
pub fn clustering_coefficient(graph: &UndirectedGraph, node: u64) -> f64 {
    let deg = graph.degree(node);
    if deg < 2 {
        return 0.0;
    }

    let neighbors = match graph.adj.get(&node) {
        Some(n) => n,
        None => return 0.0,
    };

    // Count edges between neighbors of `node`.
    let neighbor_vec: Vec<u64> = neighbors.iter().copied().collect();
    let mut triangles = 0usize;
    for i in 0..neighbor_vec.len() {
        for j in (i + 1)..neighbor_vec.len() {
            if graph.has_edge(neighbor_vec[i], neighbor_vec[j]) {
                triangles += 1;
            }
        }
    }

    let max_triangles = deg * (deg - 1) / 2;
    triangles as f64 / max_triangles as f64
}

/// Average clustering coefficient of the graph.
pub fn average_clustering_coefficient(graph: &UndirectedGraph) -> f64 {
    let nodes: Vec<u64> = graph.nodes().collect();
    if nodes.is_empty() {
        return 0.0;
    }
    let sum: f64 = nodes.iter().map(|&n| clustering_coefficient(graph, n)).sum();
    sum / nodes.len() as f64
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    fn make_triangle() -> UndirectedGraph {
        let mut g = UndirectedGraph::new();
        g.add_edge(1, 2);
        g.add_edge(2, 3);
        g.add_edge(1, 3);
        g
    }

    fn make_square() -> UndirectedGraph {
        // Square: 1-2, 2-3, 3-4, 4-1
        let mut g = UndirectedGraph::new();
        g.add_edge(1, 2);
        g.add_edge(2, 3);
        g.add_edge(3, 4);
        g.add_edge(4, 1);
        g
    }

    fn make_complete4() -> UndirectedGraph {
        // K4: 4 nodes, all connected
        let mut g = UndirectedGraph::new();
        for i in 1..=4u64 {
            for j in (i + 1)..=4u64 {
                g.add_edge(i, j);
            }
        }
        g
    }

    // -- Graph basics --

    #[test]
    fn graph_add_edge() {
        let g = make_triangle();
        assert_eq!(g.node_count(), 3);
        assert_eq!(g.edge_count(), 3);
        assert!(g.has_edge(1, 2));
        assert!(g.has_edge(2, 1)); // Bidirectional.
    }

    #[test]
    fn graph_self_loop_rejected() {
        let mut g = UndirectedGraph::new();
        assert!(!g.add_edge(1, 1));
        assert_eq!(g.edge_count(), 0);
    }

    #[test]
    fn graph_duplicate_edge_rejected() {
        let mut g = UndirectedGraph::new();
        assert!(g.add_edge(1, 2));
        assert!(!g.add_edge(1, 2)); // Duplicate.
        assert!(!g.add_edge(2, 1)); // Reverse duplicate.
        assert_eq!(g.edge_count(), 1);
    }

    #[test]
    fn graph_remove_edge() {
        let mut g = make_triangle();
        assert!(g.remove_edge(1, 2));
        assert!(!g.has_edge(1, 2));
        assert!(!g.has_edge(2, 1));
        assert_eq!(g.edge_count(), 2);
    }

    // -- Triangle counting --

    #[test]
    fn count_triangles_single() {
        let g = make_triangle();
        assert_eq!(count_triangles(&g), 1);
    }

    #[test]
    fn count_triangles_square_no_diagonal() {
        let g = make_square();
        assert_eq!(count_triangles(&g), 0);
    }

    #[test]
    fn count_triangles_k4() {
        // K4 has C(4,3) = 4 triangles.
        let g = make_complete4();
        assert_eq!(count_triangles(&g), 4);
    }

    #[test]
    fn count_triangles_empty() {
        let g = UndirectedGraph::new();
        assert_eq!(count_triangles(&g), 0);
    }

    #[test]
    fn count_triangles_two_connected() {
        // Two triangles sharing an edge: 1-2-3, 1-2-4
        let mut g = make_triangle();
        g.add_edge(1, 4);
        g.add_edge(2, 4);
        assert_eq!(count_triangles(&g), 2);
    }

    // -- Triangles per node --

    #[test]
    fn triangles_per_node_single() {
        let g = make_triangle();
        let tpn = triangles_per_node(&g);
        assert_eq!(tpn.get(&1), Some(&1));
        assert_eq!(tpn.get(&2), Some(&1));
        assert_eq!(tpn.get(&3), Some(&1));
    }

    #[test]
    fn triangles_per_node_k4() {
        let g = make_complete4();
        let tpn = triangles_per_node(&g);
        // Each node is in C(3,2)=3 triangles.
        for i in 1..=4 {
            assert_eq!(tpn.get(&i), Some(&3), "Node {i} should be in 3 triangles");
        }
    }

    // -- Clustering coefficient --

    #[test]
    fn clustering_coefficient_triangle() {
        let g = make_triangle();
        // All neighbors connected → CC = 1.0
        assert!((clustering_coefficient(&g, 1) - 1.0).abs() < 1e-10);
        assert!((clustering_coefficient(&g, 2) - 1.0).abs() < 1e-10);
        assert!((clustering_coefficient(&g, 3) - 1.0).abs() < 1e-10);
    }

    #[test]
    fn clustering_coefficient_square() {
        let g = make_square();
        // Each node has deg=2, neighbors not connected → CC = 0.0
        for i in 1..=4 {
            assert!(
                clustering_coefficient(&g, i).abs() < 1e-10,
                "CC({i}) should be 0"
            );
        }
    }

    #[test]
    fn clustering_coefficient_star() {
        // Star: center=0, leaves=1,2,3,4
        let mut g = UndirectedGraph::new();
        for i in 1..=4 {
            g.add_edge(0, i);
        }
        // Center: deg=4, no triangles → CC=0
        assert!(clustering_coefficient(&g, 0).abs() < 1e-10);
        // Leaves: deg=1, CC=0 (undefined, we return 0)
        assert!(clustering_coefficient(&g, 1).abs() < 1e-10);
    }

    #[test]
    fn clustering_coefficient_degree_less_than_2() {
        let mut g = UndirectedGraph::new();
        g.add_edge(1, 2);
        assert!(clustering_coefficient(&g, 1).abs() < 1e-10); // deg=1
    }

    #[test]
    fn average_clustering_coefficient_triangle() {
        let g = make_triangle();
        assert!((average_clustering_coefficient(&g) - 1.0).abs() < 1e-10);
    }

    #[test]
    fn average_clustering_coefficient_empty() {
        let g = UndirectedGraph::new();
        assert!(average_clustering_coefficient(&g).abs() < 1e-10);
    }
}
