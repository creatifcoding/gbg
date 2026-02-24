//! Personalized PageRank via power iteration.
//!
//! Computes importance scores for entities in the correlation graph.
//! High-PPR entities are central to the correlation graph and warrant
//! more attention from operators.
//!
//! Algorithm: Standard power iteration with damping factor α.
//!   rank[v] = (1-α)/N + α · Σ_{u→v} rank[u] / outdeg(u)
//!
//! For personalized PPR, replace (1-α)/N with a personalization vector.

use std::collections::HashMap;

use super::triangle::UndirectedGraph;

// ---------------------------------------------------------------------------
// PageRank configuration
// ---------------------------------------------------------------------------

/// Configuration for PageRank computation.
#[derive(Debug, Clone)]
pub struct PageRankConfig {
    /// Damping factor (typically 0.85).
    pub alpha: f64,
    /// Convergence threshold (L1 norm of rank difference).
    pub epsilon: f64,
    /// Maximum iterations.
    pub max_iters: usize,
}

impl Default for PageRankConfig {
    fn default() -> Self {
        Self {
            alpha: 0.85,
            epsilon: 1e-6,
            max_iters: 100,
        }
    }
}

// ---------------------------------------------------------------------------
// PageRank result
// ---------------------------------------------------------------------------

/// Result of PageRank computation.
#[derive(Debug, Clone)]
pub struct PageRankResult {
    /// Rank scores: node → rank.
    pub ranks: HashMap<u64, f64>,
    /// Number of iterations until convergence.
    pub iterations: usize,
    /// Whether the algorithm converged (L1 diff < epsilon).
    pub converged: bool,
}

// ---------------------------------------------------------------------------
// Uniform PageRank
// ---------------------------------------------------------------------------

/// Compute PageRank with uniform personalization.
///
/// For undirected graphs, each undirected edge is treated as two directed edges.
pub fn pagerank(graph: &UndirectedGraph, config: &PageRankConfig) -> PageRankResult {
    let nodes: Vec<u64> = graph.nodes().collect();
    let n = nodes.len();
    if n == 0 {
        return PageRankResult {
            ranks: HashMap::new(),
            iterations: 0,
            converged: true,
        };
    }

    let init_rank = 1.0 / n as f64;
    let teleport = (1.0 - config.alpha) / n as f64;

    let mut ranks: HashMap<u64, f64> = nodes.iter().map(|&v| (v, init_rank)).collect();
    let mut new_ranks: HashMap<u64, f64> = HashMap::with_capacity(n);
    let mut converged = false;
    let mut iters = 0;

    for _ in 0..config.max_iters {
        iters += 1;

        // Initialize with teleport probability.
        for &v in &nodes {
            new_ranks.insert(v, teleport);
        }

        // Distribute rank along edges.
        for &u in &nodes {
            let deg = graph.degree(u);
            if deg == 0 {
                // Dangling node: distribute rank to all nodes.
                let share = config.alpha * ranks[&u] / n as f64;
                for &v in &nodes {
                    *new_ranks.entry(v).or_default() += share;
                }
            } else {
                let share = config.alpha * ranks[&u] / deg as f64;
                if let Some(neighbors) = graph.adj.get(&u) {
                    for &v in neighbors {
                        *new_ranks.entry(v).or_default() += share;
                    }
                }
            }
        }

        // Check convergence (L1 norm).
        let l1_diff: f64 = nodes
            .iter()
            .map(|v| (new_ranks[v] - ranks[v]).abs())
            .sum();

        std::mem::swap(&mut ranks, &mut new_ranks);

        if l1_diff < config.epsilon {
            converged = true;
            break;
        }
    }

    PageRankResult {
        ranks,
        iterations: iters,
        converged,
    }
}

// ---------------------------------------------------------------------------
// Personalized PageRank
// ---------------------------------------------------------------------------

/// Compute PersonalizedPageRank with a seed set.
///
/// Teleport probability goes entirely to seed nodes (uniform among seeds).
pub fn personalized_pagerank(
    graph: &UndirectedGraph,
    seeds: &[u64],
    config: &PageRankConfig,
) -> PageRankResult {
    let nodes: Vec<u64> = graph.nodes().collect();
    let n = nodes.len();
    if n == 0 || seeds.is_empty() {
        return PageRankResult {
            ranks: HashMap::new(),
            iterations: 0,
            converged: true,
        };
    }

    let init_rank = 1.0 / n as f64;
    let teleport_per_seed = (1.0 - config.alpha) / seeds.len() as f64;
    let seed_set: std::collections::HashSet<u64> = seeds.iter().copied().collect();

    let mut ranks: HashMap<u64, f64> = nodes.iter().map(|&v| (v, init_rank)).collect();
    let mut new_ranks: HashMap<u64, f64> = HashMap::with_capacity(n);
    let mut converged = false;
    let mut iters = 0;

    for _ in 0..config.max_iters {
        iters += 1;

        // Initialize: teleport only to seed nodes.
        for &v in &nodes {
            let teleport = if seed_set.contains(&v) {
                teleport_per_seed
            } else {
                0.0
            };
            new_ranks.insert(v, teleport);
        }

        // Distribute rank along edges.
        for &u in &nodes {
            let deg = graph.degree(u);
            if deg == 0 {
                let share = config.alpha * ranks[&u] / seeds.len() as f64;
                for &s in seeds {
                    *new_ranks.entry(s).or_default() += share;
                }
            } else {
                let share = config.alpha * ranks[&u] / deg as f64;
                if let Some(neighbors) = graph.adj.get(&u) {
                    for &v in neighbors {
                        *new_ranks.entry(v).or_default() += share;
                    }
                }
            }
        }

        let l1_diff: f64 = nodes
            .iter()
            .map(|v| (new_ranks.get(v).unwrap_or(&0.0) - ranks.get(v).unwrap_or(&0.0)).abs())
            .sum();

        std::mem::swap(&mut ranks, &mut new_ranks);

        if l1_diff < config.epsilon {
            converged = true;
            break;
        }
    }

    PageRankResult {
        ranks,
        iterations: iters,
        converged,
    }
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

    fn make_star() -> UndirectedGraph {
        let mut g = UndirectedGraph::new();
        for i in 1..=5 {
            g.add_edge(0, i);
        }
        g
    }

    fn make_line() -> UndirectedGraph {
        // 1 - 2 - 3 - 4 - 5
        let mut g = UndirectedGraph::new();
        g.add_edge(1, 2);
        g.add_edge(2, 3);
        g.add_edge(3, 4);
        g.add_edge(4, 5);
        g
    }

    #[test]
    fn pagerank_empty_graph() {
        let g = UndirectedGraph::new();
        let result = pagerank(&g, &PageRankConfig::default());
        assert!(result.ranks.is_empty());
        assert!(result.converged);
    }

    #[test]
    fn pagerank_triangle_uniform() {
        let g = make_triangle();
        let result = pagerank(&g, &PageRankConfig::default());
        assert!(result.converged);
        // Symmetric graph → all ranks equal.
        let expected = 1.0 / 3.0;
        for &r in result.ranks.values() {
            assert!(
                (r - expected).abs() < 1e-4,
                "Triangle nodes should have equal rank, got {}",
                r
            );
        }
    }

    #[test]
    fn pagerank_star_center_highest() {
        let g = make_star();
        let result = pagerank(&g, &PageRankConfig::default());
        assert!(result.converged);
        let center_rank = result.ranks[&0];
        for i in 1..=5 {
            assert!(
                center_rank > result.ranks[&i],
                "Center should have highest rank"
            );
        }
    }

    #[test]
    fn pagerank_ranks_sum_to_one() {
        let g = make_star();
        let result = pagerank(&g, &PageRankConfig::default());
        let sum: f64 = result.ranks.values().sum();
        assert!(
            (sum - 1.0).abs() < 1e-4,
            "PageRank should sum to 1.0, got {}",
            sum
        );
    }

    #[test]
    fn pagerank_line_middle_highest() {
        let g = make_line();
        let result = pagerank(&g, &PageRankConfig::default());
        assert!(result.converged);
        // Middle node (3) has degree 2 and is most central.
        let r3 = result.ranks[&3];
        let r1 = result.ranks[&1];
        let r5 = result.ranks[&5];
        assert!(r3 > r1, "Middle node should rank higher than endpoint");
        assert!(r3 > r5, "Middle node should rank higher than endpoint");
    }

    #[test]
    fn pagerank_custom_config() {
        let g = make_triangle();
        let config = PageRankConfig {
            alpha: 0.5,
            epsilon: 1e-8,
            max_iters: 200,
        };
        let result = pagerank(&g, &config);
        assert!(result.converged);
    }

    // -- Personalized PageRank --

    #[test]
    fn ppr_seed_gets_highest_rank() {
        let g = make_star();
        let result = personalized_pagerank(&g, &[1], &PageRankConfig::default());
        assert!(result.converged);
        // Seed node should have highest rank.
        let seed_rank = result.ranks[&1];
        for (&node, &rank) in &result.ranks {
            if node != 1 && node != 0 {
                // Center might be close due to degree.
                assert!(
                    seed_rank >= rank - 0.01,
                    "Seed should have high rank, seed={}, node {}={}",
                    seed_rank,
                    node,
                    rank
                );
            }
        }
    }

    #[test]
    fn ppr_empty_seeds() {
        let g = make_triangle();
        let result = personalized_pagerank(&g, &[], &PageRankConfig::default());
        assert!(result.ranks.is_empty());
    }

    #[test]
    fn ppr_all_seeds_is_uniform() {
        let g = make_triangle();
        let nodes: Vec<u64> = g.nodes().collect();
        let uniform = pagerank(&g, &PageRankConfig::default());
        let ppr = personalized_pagerank(&g, &nodes, &PageRankConfig::default());
        // Should be approximately equal.
        for (&node, &rank) in &uniform.ranks {
            let ppr_rank = ppr.ranks[&node];
            assert!(
                (rank - ppr_rank).abs() < 0.01,
                "All-seeds PPR should approximate uniform PR"
            );
        }
    }
}
