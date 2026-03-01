//! Tiered encoder: MiniLM hot path → bert-base deep path fallback.
//!
//! Architecture per DECISIONS.md:
//! - MiniLM-L6-v2 INT8 (384-dim, 1-4ms): always used first
//! - bert-base-uncased INT8 (768-dim, 5-12ms): triggered when MiniLM confidence < threshold
//!
//! Confidence is estimated via max cosine similarity against the catalog.
//! If below `deep_threshold`, re-encode with bert-base for higher-resolution ranking.

use crate::encoder::{BertEncoder, Embedding, EncoderError};
use crate::models::ModelId;

/// Configuration for the tiered encoder.
#[derive(Debug, Clone)]
pub struct TieredEncoderConfig {
    /// Cosine similarity threshold below which the deep encoder fires.
    /// Default: 0.65 (per DECISIONS.md).
    pub deep_threshold: f32,
}

impl Default for TieredEncoderConfig {
    fn default() -> Self {
        Self {
            deep_threshold: 0.65,
        }
    }
}

/// Result of a tiered encoding operation.
#[derive(Debug, Clone)]
pub struct TieredEmbedding {
    /// The embedding used for final ranking.
    pub embedding: Embedding,
    /// Which tier produced the final embedding.
    pub tier: EncoderTier,
    /// MiniLM confidence (max similarity to catalog), if catalog was provided.
    pub minilm_confidence: Option<f32>,
    /// Total inference latency across both tiers (ms).
    pub total_inference_ms: f64,
}

/// Which encoder tier produced the result.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EncoderTier {
    /// MiniLM hot path (sufficient confidence).
    MiniLm,
    /// bert-base deep path (MiniLM confidence below threshold).
    BertBase,
    /// MiniLM only (bert-base not available, degraded mode).
    MiniLmDegraded,
}

/// Two-tier encoder: MiniLM (required) + bert-base (optional).
pub struct TieredEncoder {
    minilm: BertEncoder,
    bert_base: Option<BertEncoder>,
    config: TieredEncoderConfig,
}

impl TieredEncoder {
    /// Create a tiered encoder. MiniLM must be provisioned; bert-base is optional.
    pub fn new(config: TieredEncoderConfig) -> Result<Self, EncoderError> {
        let minilm = BertEncoder::load(ModelId::MiniLmL6V2Int8)?;

        let bert_base = match BertEncoder::load(ModelId::BertBaseUncasedInt8) {
            Ok(enc) => {
                log::info!("TieredEncoder: bert-base loaded (deep path available)");
                Some(enc)
            }
            Err(e) => {
                log::warn!("TieredEncoder: bert-base unavailable, degraded mode: {e}");
                None
            }
        };

        Ok(Self {
            minilm,
            bert_base,
            config,
        })
    }

    /// Encode text, escalating to bert-base if MiniLM confidence is low.
    ///
    /// `catalog_embeddings`: pre-computed catalog embeddings for confidence estimation.
    /// If empty or None, always uses MiniLM only.
    pub fn encode(
        &self,
        text: &str,
        catalog_embeddings: Option<&[Embedding]>,
    ) -> Result<TieredEmbedding, EncoderError> {
        // Step 1: MiniLM hot path
        let minilm_emb = self.minilm.encode(text)?;
        let mut total_ms = minilm_emb.inference_ms;

        // Step 2: Estimate confidence via max catalog similarity
        let confidence = catalog_embeddings
            .filter(|cat| !cat.is_empty())
            .map(|cat| max_similarity(&minilm_emb, cat));

        // Step 3: Decide tier
        let needs_deep = confidence
            .map(|c| c < self.config.deep_threshold)
            .unwrap_or(false);

        if needs_deep {
            if let Some(ref bert_base) = self.bert_base {
                let deep_emb = bert_base.encode(text)?;
                total_ms += deep_emb.inference_ms;
                return Ok(TieredEmbedding {
                    embedding: deep_emb,
                    tier: EncoderTier::BertBase,
                    minilm_confidence: confidence,
                    total_inference_ms: total_ms,
                });
            }
            // bert-base not available: degraded
            return Ok(TieredEmbedding {
                embedding: minilm_emb,
                tier: EncoderTier::MiniLmDegraded,
                minilm_confidence: confidence,
                total_inference_ms: total_ms,
            });
        }

        Ok(TieredEmbedding {
            embedding: minilm_emb,
            tier: EncoderTier::MiniLm,
            minilm_confidence: confidence,
            total_inference_ms: total_ms,
        })
    }

    /// Check if the deep path (bert-base) is available.
    pub fn has_deep_path(&self) -> bool {
        self.bert_base.is_some()
    }

    /// Get the MiniLM encoder (always available).
    pub fn minilm(&self) -> &BertEncoder {
        &self.minilm
    }

    /// Get the bert-base encoder (if available).
    pub fn bert_base(&self) -> Option<&BertEncoder> {
        self.bert_base.as_ref()
    }
}

/// Find the maximum cosine similarity between a query embedding and a catalog.
fn max_similarity(query: &Embedding, catalog: &[Embedding]) -> f32 {
    catalog
        .iter()
        .map(|c| query.cosine_similarity(c))
        .fold(f32::NEG_INFINITY, f32::max)
}

// ─── Tests ──────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn mock_embedding(values: Vec<f32>) -> Embedding {
        let dim = values.len();
        Embedding {
            values,
            dim,
            inference_ms: 1.0,
        }
    }

    #[test]
    fn max_similarity_finds_best_match() {
        let query = mock_embedding(vec![1.0, 0.0, 0.0]);
        let catalog = vec![
            mock_embedding(vec![0.0, 1.0, 0.0]), // orthogonal
            mock_embedding(vec![0.9, 0.1, 0.0]), // close
            mock_embedding(vec![0.0, 0.0, 1.0]), // orthogonal
        ];
        let sim = max_similarity(&query, &catalog);
        assert!(sim > 0.9, "Should find near-match, got {sim}");
    }

    #[test]
    fn max_similarity_empty_catalog_is_neg_inf() {
        let query = mock_embedding(vec![1.0, 0.0]);
        let sim = max_similarity(&query, &[]);
        assert!(sim == f32::NEG_INFINITY);
    }

    #[test]
    fn encoder_tier_equality() {
        assert_eq!(EncoderTier::MiniLm, EncoderTier::MiniLm);
        assert_ne!(EncoderTier::MiniLm, EncoderTier::BertBase);
    }

    #[test]
    fn default_config_threshold() {
        let cfg = TieredEncoderConfig::default();
        assert!((cfg.deep_threshold - 0.65).abs() < 1e-6);
    }

    // Integration: requires provisioned models
    #[test]
    fn tiered_encoder_loads_if_provisioned() {
        if !crate::models::is_model_provisioned(ModelId::MiniLmL6V2Int8) {
            return;
        }
        let enc = TieredEncoder::new(TieredEncoderConfig::default()).unwrap();
        assert_eq!(enc.minilm().embedding_dim(), 384);
    }

    #[test]
    fn tiered_encode_without_catalog_uses_minilm() {
        if !crate::models::is_model_provisioned(ModelId::MiniLmL6V2Int8) {
            return;
        }
        let enc = TieredEncoder::new(TieredEncoderConfig::default()).unwrap();
        let result = enc.encode("test prompt", None).unwrap();
        assert_eq!(result.tier, EncoderTier::MiniLm);
        assert!(result.minilm_confidence.is_none());
    }

    #[test]
    fn tiered_encode_high_confidence_stays_minilm() {
        if !crate::models::is_model_provisioned(ModelId::MiniLmL6V2Int8) {
            return;
        }
        let enc = TieredEncoder::new(TieredEncoderConfig::default()).unwrap();

        // Create a catalog that includes embeddings very similar to the query
        let query_emb = enc.minilm().encode("show me a dashboard").unwrap();
        let catalog = vec![query_emb.clone()]; // Exact match → confidence = 1.0

        let result = enc.encode("show me a dashboard", Some(&catalog)).unwrap();
        assert_eq!(result.tier, EncoderTier::MiniLm);
        assert!(result.minilm_confidence.unwrap() > 0.9);
    }
}
