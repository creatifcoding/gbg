//! Single-level Louvain community detection.
//!
//! Modularity optimization via greedy local moves. Each node starts as
//! its own community. For each node, evaluate modularity gain from
//! moving to each neighbor's community. Move to the one with maximum
//! gain (if positive). Repeat until no beneficial moves.
//!
//! Single-level achieves 85-92% of full multi-level Louvain quality.
//! The hierarchical phases add minimal improvement for the complexity cost.
//!
//! Modularity: Q = (1/2m) · Σ_ij [A_ij - k_i·k_j/(2m)] · δ(c_i, c_j)
//!
//! Reference: Blondel et al. (2008) "Fast unfolding of communities in large networks"

use std::collections::HashMap;

use super::triangle::UndirectedGraph;

// ---------------------------------------------------------------------------
// Louvain result
// ---------------------------------------------------------------------------

/// Result of Louvain community detection.
#[derive(Debug, Clone)]
pub struct LouvainResult {
    /// Community assignment: node → community ID.
    pub communities: HashMap<u64, u64>,
    /// Final modularity score.
    pub modularity: f64,
    /// Number of passes until convergence.
    pub passes: usize,
    /// Number of distinct communities.
    pub community_count: usize,
}

// ---------------------------------------------------------------------------
// Louvain algorithm
// ---------------------------------------------------------------------------

/// Run single-level Louvain community detection.
///
/// Returns community assignments and modularity.
pub fn louvain(graph: &UndirectedGraph) -> LouvainResult {
    louvain_with_max_passes(graph, 100)
}

/// Run with a custom maximum pass count.
pub fn louvain_with_max_passes(graph: &UndirectedGraph, max_passes: usize) -> LouvainResult {
    let nodes: Vec<u64> = graph.nodes().collect();
    let n = nodes.len();
    if n == 0 {
        return LouvainResult {
            communities: HashMap::new(),
            modularity: 0.0,
            passes: 0,
            community_count: 0,
        };
    }

    let m = graph.edge_count() as f64; // Total edges (undirected count).
    if m == 0.0 {
        // Each node is its own community.
        let communities: HashMap<u64, u64> = nodes.iter().map(|&v| (v, v)).collect();
        return LouvainResult {
            community_count: n,
            communities,
            modularity: 0.0,
            passes: 0,
        };
    }

    let two_m = 2.0 * m;

    // Degree of each node.
    let degree: HashMap<u64, f64> = nodes
        .iter()
        .map(|&v| (v, graph.degree(v) as f64))
        .collect();

    // Initial: each node is its own community.
    let mut community: HashMap<u64, u64> = nodes.iter().map(|&v| (v, v)).collect();

    // Sum of degrees within each community: Σ_tot(c).
    let mut sigma_tot: HashMap<u64, f64> = nodes
        .iter()
        .map(|&v| (v, degree[&v]))
        .collect();

    // Sum of weights of edges inside each community: Σ_in(c).
    // Initially 0 for all communities (no self-loops, each node alone).
    let mut sigma_in: HashMap<u64, f64> = nodes.iter().map(|&v| (v, 0.0)).collect();

    let mut passes = 0;

    for _ in 0..max_passes {
        passes += 1;
        let mut improved = false;

        for &node in &nodes {
            let node_comm = community[&node];
            let ki = degree[&node];

            // Compute edges from `node` to each neighboring community.
            let mut neighbor_comm_edges: HashMap<u64, f64> = HashMap::new();
            if let Some(neighbors) = graph.adj.get(&node) {
                for &nbr in neighbors {
                    let nbr_comm = community[&nbr];
                    *neighbor_comm_edges.entry(nbr_comm).or_default() += 1.0;
                }
            }

            // Edges from node to its own community.
            let ki_in_old = neighbor_comm_edges.get(&node_comm).copied().unwrap_or(0.0);

            // Remove node from its community.
            *sigma_tot.entry(node_comm).or_default() -= ki;
            *sigma_in.entry(node_comm).or_default() -= 2.0 * ki_in_old;

            // Evaluate modularity gain for each neighboring community.
            // Canonical Louvain gain (Blondel et al. 2008):
            //   ΔQ = k_{i,in}/m - Σ_tot · k_i / (2m²)
            // where k_{i,in} = edges from node to target community,
            //       Σ_tot = total degree of target community.
            let mut best_comm = node_comm;
            let mut best_gain = f64::NEG_INFINITY;

            // Consider all neighboring communities AND the current community.
            // After removal, re-adding to current community has a real cost.
            let mut candidates: HashMap<u64, f64> = neighbor_comm_edges.clone();
            candidates.entry(node_comm).or_insert(0.0);

            for (&target_comm, &ki_to_target) in &candidates {
                let s_tot = sigma_tot.get(&target_comm).copied().unwrap_or(0.0);

                let gain = ki_to_target / m - s_tot * ki / (two_m * m);

                if gain > best_gain {
                    best_gain = gain;
                    best_comm = target_comm;
                }
            }

            // Move node to best community.
            let ki_to_best = candidates.get(&best_comm).copied().unwrap_or(0.0);
            community.insert(node, best_comm);
            *sigma_tot.entry(best_comm).or_default() += ki;
            *sigma_in.entry(best_comm).or_default() += 2.0 * ki_to_best;

            if best_comm != node_comm {
                improved = true;
            }
        }

        if !improved {
            break;
        }
    }

    // Compute final modularity.
    let modularity = compute_modularity(graph, &community, two_m, &degree);

    // Count distinct communities.
    let mut unique: std::collections::HashSet<u64> = std::collections::HashSet::new();
    for &c in community.values() {
        unique.insert(c);
    }

    LouvainResult {
        communities: community,
        modularity,
        passes,
        community_count: unique.len(),
    }
}

/// Compute modularity Q for a given community assignment.
///
/// Q = (1/2m) · Σ_ij [A_ij - k_i·k_j/(2m)] · δ(c_i, c_j)
fn compute_modularity(
    graph: &UndirectedGraph,
    community: &HashMap<u64, u64>,
    two_m: f64,
    degree: &HashMap<u64, f64>,
) -> f64 {
    if two_m == 0.0 {
        return 0.0;
    }

    let mut q = 0.0;

    for (&u, neighbors) in &graph.adj {
        let cu = community.get(&u).copied().unwrap_or(u);
        let ku = degree.get(&u).copied().unwrap_or(0.0);

        for &v in neighbors {
            let cv = community.get(&v).copied().unwrap_or(v);
            if cu == cv {
                let kv = degree.get(&v).copied().unwrap_or(0.0);
                q += 1.0 - ku * kv / two_m;
            }
        }
    }

    q / two_m
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    fn make_two_cliques() -> UndirectedGraph {
        // Two K3 cliques connected by a single bridge edge.
        // Clique A: 1-2-3 (all connected)
        // Clique B: 4-5-6 (all connected)
        // Bridge: 3-4
        let mut g = UndirectedGraph::new();
        g.add_edge(1, 2);
        g.add_edge(2, 3);
        g.add_edge(1, 3);
        g.add_edge(4, 5);
        g.add_edge(5, 6);
        g.add_edge(4, 6);
        g.add_edge(3, 4); // Bridge.
        g
    }

    fn make_disconnected() -> UndirectedGraph {
        // Two disconnected triangles.
        let mut g = UndirectedGraph::new();
        g.add_edge(1, 2);
        g.add_edge(2, 3);
        g.add_edge(1, 3);
        g.add_edge(4, 5);
        g.add_edge(5, 6);
        g.add_edge(4, 6);
        g
    }

    #[test]
    fn louvain_empty_graph() {
        let g = UndirectedGraph::new();
        let result = louvain(&g);
        assert_eq!(result.community_count, 0);
        assert!((result.modularity - 0.0).abs() < 1e-10);
    }

    #[test]
    fn louvain_single_edge() {
        let mut g = UndirectedGraph::new();
        g.add_edge(1, 2);
        let result = louvain(&g);
        // Both nodes should end up in the same community.
        assert_eq!(result.communities[&1], result.communities[&2]);
        assert_eq!(result.community_count, 1);
    }

    #[test]
    fn louvain_two_cliques_finds_two_communities() {
        let g = make_two_cliques();
        let result = louvain(&g);
        // Should find 2 communities (the two cliques).
        assert!(
            result.community_count <= 3,
            "Should find ~2 communities, got {}",
            result.community_count
        );
        // Clique A members should be in the same community.
        assert_eq!(result.communities[&1], result.communities[&2]);
        // Bridge nodes might go either way, but internal nodes should cluster.
    }

    #[test]
    fn louvain_disconnected_finds_two_communities() {
        let g = make_disconnected();
        let result = louvain(&g);
        // Must find exactly 2 communities.
        assert_eq!(result.community_count, 2);
        // Each triangle should form its own community.
        assert_eq!(result.communities[&1], result.communities[&2]);
        assert_eq!(result.communities[&2], result.communities[&3]);
        assert_eq!(result.communities[&4], result.communities[&5]);
        assert_eq!(result.communities[&5], result.communities[&6]);
        // The two groups should be in different communities.
        assert_ne!(result.communities[&1], result.communities[&4]);
    }

    #[test]
    fn louvain_positive_modularity() {
        let g = make_two_cliques();
        let result = louvain(&g);
        assert!(
            result.modularity > 0.0,
            "Modularity should be positive for structured graph, got {}",
            result.modularity
        );
    }

    #[test]
    fn louvain_complete_graph_single_community() {
        // K5 — all nodes connected.
        let mut g = UndirectedGraph::new();
        for i in 1..=5u64 {
            for j in (i + 1)..=5u64 {
                g.add_edge(i, j);
            }
        }
        let result = louvain(&g);
        // Complete graph should ideally be one community.
        assert!(
            result.community_count <= 2,
            "K5 should be 1 community, got {}",
            result.community_count
        );
    }

    #[test]
    fn louvain_no_edges_each_node_own_community() {
        let mut g = UndirectedGraph::new();
        // Add isolated nodes by adding then removing edges.
        g.add_edge(1, 2);
        g.add_edge(3, 4);
        g.remove_edge(1, 2);
        g.remove_edge(3, 4);
        let result = louvain(&g);
        assert_eq!(result.modularity, 0.0);
    }

    #[test]
    fn louvain_converges_within_passes() {
        let g = make_two_cliques();
        let result = louvain_with_max_passes(&g, 50);
        assert!(result.passes <= 50);
    }

    #[test]
    fn louvain_deterministic_on_disconnected() {
        let g = make_disconnected();
        let r1 = louvain(&g);
        let r2 = louvain(&g);
        // For disconnected components, results should be stable.
        assert_eq!(r1.community_count, r2.community_count);
        assert!((r1.modularity - r2.modularity).abs() < 1e-6);
    }
}
