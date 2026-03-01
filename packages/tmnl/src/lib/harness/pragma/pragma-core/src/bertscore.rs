//! BERTScore computation — greedy bipartite cosine matching.
//!
//! Implements the BERTScore metric per Zhang et al. (2020):
//! - P = (1/|cand|) Σ_i max_j sim(cand_i, ref_j)
//! - R = (1/|ref|)  Σ_j max_i sim(cand_i, ref_j)
//! - F1 = 2·P·R / (P + R)
//!
//! Token embeddings come from the BertEncoder (layer output before pooling).
//! We use the final layer hidden states as token representations.

use crate::encoder::{BertEncoder, EncoderError};

/// BERTScore result: precision, recall, F1.
#[derive(Debug, Clone, Copy)]
pub struct BertScore {
    pub precision: f32,
    pub recall: f32,
    pub f1: f32,
}

impl BertScore {
    /// Check if all scores are in the valid [0, 1] range.
    pub fn is_valid(&self) -> bool {
        (0.0..=1.0).contains(&self.precision)
            && (0.0..=1.0).contains(&self.recall)
            && (0.0..=1.0).contains(&self.f1)
    }
}

/// Compute BERTScore between a reference and candidate text.
///
/// Uses sentence-level embeddings as a simplified proxy:
/// splits on whitespace, encodes each token independently,
/// then runs greedy matching on the per-token embeddings.
///
/// For production accuracy, this should use the BERT model's
/// token-level hidden states directly. This implementation
/// provides the correct algorithmic structure that will be
/// upgraded to real token embeddings when the Candle integration
/// supports extracting per-token outputs.
pub fn compute(
    encoder: &BertEncoder,
    reference: &str,
    candidate: &str,
) -> Result<BertScore, EncoderError> {
    // Encode each word as a "token" embedding
    // (simplified — production uses subword token embeddings from hidden states)
    let ref_words = tokenize_simple(reference);
    let cand_words = tokenize_simple(candidate);

    if ref_words.is_empty() || cand_words.is_empty() {
        return Ok(BertScore {
            precision: 0.0,
            recall: 0.0,
            f1: 0.0,
        });
    }

    let ref_embeddings = encode_tokens(encoder, &ref_words)?;
    let cand_embeddings = encode_tokens(encoder, &cand_words)?;

    // Build similarity matrix [cand_len x ref_len]
    let sim_matrix = build_similarity_matrix(&cand_embeddings, &ref_embeddings);

    // Precision: for each candidate token, max similarity to any reference token
    let precision = cand_greedy_max(&sim_matrix);

    // Recall: for each reference token, max similarity to any candidate token
    let recall = ref_greedy_max(&sim_matrix);

    // F1: harmonic mean
    let f1 = if precision + recall > 0.0 {
        2.0 * precision * recall / (precision + recall)
    } else {
        0.0
    };

    Ok(BertScore {
        precision,
        recall,
        f1,
    })
}

/// Compute BERTScore from pre-computed embedding vectors (for testing/caching).
pub fn compute_from_embeddings(
    ref_embeddings: &[Vec<f32>],
    cand_embeddings: &[Vec<f32>],
) -> BertScore {
    if ref_embeddings.is_empty() || cand_embeddings.is_empty() {
        return BertScore {
            precision: 0.0,
            recall: 0.0,
            f1: 0.0,
        };
    }

    let sim_matrix = build_similarity_matrix(cand_embeddings, ref_embeddings);
    let precision = cand_greedy_max(&sim_matrix);
    let recall = ref_greedy_max(&sim_matrix);
    let f1 = if precision + recall > 0.0 {
        2.0 * precision * recall / (precision + recall)
    } else {
        0.0
    };

    BertScore {
        precision,
        recall,
        f1,
    }
}

/// Simple whitespace tokenization (production should use subword).
fn tokenize_simple(text: &str) -> Vec<String> {
    text.split_whitespace()
        .map(|w| w.trim_matches(|c: char| !c.is_alphanumeric()).to_lowercase())
        .filter(|w| !w.is_empty())
        .collect()
}

/// Encode each token string into an embedding vector.
fn encode_tokens(
    encoder: &BertEncoder,
    tokens: &[String],
) -> Result<Vec<Vec<f32>>, EncoderError> {
    tokens
        .iter()
        .map(|t| encoder.encode(t).map(|e| e.values))
        .collect()
}

/// Build cosine similarity matrix [rows x cols].
fn build_similarity_matrix(rows: &[Vec<f32>], cols: &[Vec<f32>]) -> Vec<Vec<f32>> {
    rows.iter()
        .map(|row| {
            cols.iter()
                .map(|col| cosine_sim(row, col))
                .collect()
        })
        .collect()
}

/// Precision: avg of max similarity for each candidate token (row).
fn cand_greedy_max(sim_matrix: &[Vec<f32>]) -> f32 {
    if sim_matrix.is_empty() {
        return 0.0;
    }
    let sum: f32 = sim_matrix
        .iter()
        .map(|row| row.iter().cloned().fold(f32::NEG_INFINITY, f32::max))
        .sum();
    sum / sim_matrix.len() as f32
}

/// Recall: avg of max similarity for each reference token (column).
fn ref_greedy_max(sim_matrix: &[Vec<f32>]) -> f32 {
    if sim_matrix.is_empty() || sim_matrix[0].is_empty() {
        return 0.0;
    }
    let n_cols = sim_matrix[0].len();
    let sum: f32 = (0..n_cols)
        .map(|j| {
            sim_matrix
                .iter()
                .map(|row| row[j])
                .fold(f32::NEG_INFINITY, f32::max)
        })
        .sum();
    sum / n_cols as f32
}

/// Cosine similarity between two vectors.
fn cosine_sim(a: &[f32], b: &[f32]) -> f32 {
    let dot: f32 = a.iter().zip(b).map(|(x, y)| x * y).sum();
    let norm_a: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
    let norm_b: f32 = b.iter().map(|x| x * x).sum::<f32>().sqrt();
    if norm_a == 0.0 || norm_b == 0.0 {
        return 0.0;
    }
    dot / (norm_a * norm_b)
}

// ─── Tests ──────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn identical_embeddings_give_perfect_score() {
        let emb = vec![vec![1.0, 0.0, 0.0], vec![0.0, 1.0, 0.0]];
        let score = compute_from_embeddings(&emb, &emb);
        assert!((score.precision - 1.0).abs() < 1e-6);
        assert!((score.recall - 1.0).abs() < 1e-6);
        assert!((score.f1 - 1.0).abs() < 1e-6);
    }

    #[test]
    fn orthogonal_embeddings_give_zero() {
        let ref_emb = vec![vec![1.0, 0.0]];
        let cand_emb = vec![vec![0.0, 1.0]];
        let score = compute_from_embeddings(&ref_emb, &cand_emb);
        assert!(score.f1.abs() < 1e-6);
    }

    #[test]
    fn partial_overlap_intermediate_score() {
        let ref_emb = vec![vec![1.0, 0.0], vec![0.0, 1.0]];
        let cand_emb = vec![vec![1.0, 0.0], vec![0.5, 0.5]]; // one match, one partial
        let score = compute_from_embeddings(&ref_emb, &cand_emb);
        assert!(score.f1 > 0.5, "Partial overlap should give >0.5, got {}", score.f1);
        assert!(score.f1 < 1.0, "Partial overlap should give <1.0, got {}", score.f1);
    }

    #[test]
    fn empty_reference_gives_zero() {
        let score = compute_from_embeddings(&[], &[vec![1.0, 0.0]]);
        assert_eq!(score.f1, 0.0);
    }

    #[test]
    fn empty_candidate_gives_zero() {
        let score = compute_from_embeddings(&[vec![1.0, 0.0]], &[]);
        assert_eq!(score.f1, 0.0);
    }

    #[test]
    fn score_is_valid() {
        let emb = vec![vec![1.0, 0.5], vec![0.3, 0.8]];
        let score = compute_from_embeddings(&emb, &emb);
        assert!(score.is_valid(), "Score should be in [0,1]: {:?}", score);
    }

    #[test]
    fn precision_recall_asymmetry() {
        // More candidate tokens than reference → recall should be >= precision
        let ref_emb = vec![vec![1.0, 0.0]];
        let cand_emb = vec![vec![1.0, 0.0], vec![0.0, 1.0], vec![0.5, 0.5]];
        let score = compute_from_embeddings(&ref_emb, &cand_emb);
        // Recall: ref has 1 token, max sim to any cand = 1.0 → recall = 1.0
        assert!((score.recall - 1.0).abs() < 1e-6);
        // Precision: avg of max sim per cand token < 1.0
        assert!(score.precision < 1.0);
    }

    #[test]
    fn f1_is_harmonic_mean() {
        let ref_emb = vec![vec![1.0, 0.0], vec![0.0, 1.0]];
        let cand_emb = vec![vec![1.0, 0.0]]; // Only matches one ref token
        let score = compute_from_embeddings(&ref_emb, &cand_emb);
        let expected_f1 = 2.0 * score.precision * score.recall / (score.precision + score.recall);
        assert!(
            (score.f1 - expected_f1).abs() < 1e-6,
            "F1 should be harmonic mean: got {} expected {}",
            score.f1,
            expected_f1
        );
    }

    #[test]
    fn cosine_sim_unit_vectors() {
        assert!((cosine_sim(&[1.0, 0.0], &[1.0, 0.0]) - 1.0).abs() < 1e-6);
        assert!(cosine_sim(&[1.0, 0.0], &[0.0, 1.0]).abs() < 1e-6);
        assert!((cosine_sim(&[1.0, 0.0], &[-1.0, 0.0]) + 1.0).abs() < 1e-6);
    }

    #[test]
    fn tokenize_simple_handles_punctuation() {
        let tokens = tokenize_simple("Hello, world! This is a test.");
        assert_eq!(tokens, vec!["hello", "world", "this", "is", "a", "test"]);
    }
}
