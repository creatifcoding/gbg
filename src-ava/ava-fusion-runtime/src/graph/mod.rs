//! Graph algorithms for entity correlation analysis.
//!
//! - `triangle`: Triangle counting and clustering coefficients
//! - `pagerank`: PageRank and PersonalizedPageRank via power iteration
//! - `louvain`: Single-level Louvain community detection

pub mod louvain;
pub mod pagerank;
pub mod triangle;
