//! BERT encoder for sentence embeddings via Candle.
//!
//! Loads safetensors weights, runs forward pass through candle-transformers BertModel,
//! and mean-pools token embeddings to produce fixed-size sentence vectors.
//!
//! Two encoder variants:
//! - MiniLM (384-dim, 6 layers, ~22MB) — hot path
//! - bert-base (768-dim, 12 layers, ~110MB) — deep path

use std::path::Path;
use std::time::Instant;

use candle_core::{DType, Device, Tensor};
use candle_nn::VarBuilder;
use candle_transformers::models::bert::{BertModel, Config as BertConfig};

use crate::models::ModelId;
use crate::tokenizer::{Encoded, PragmaTokenizer};

/// Errors from the encoder.
#[derive(Debug, thiserror::Error)]
pub enum EncoderError {
    #[error("Failed to load model config from {path}: {detail}")]
    ConfigLoadFailed { path: String, detail: String },

    #[error("Failed to load model weights from {path}: {detail}")]
    WeightsLoadFailed { path: String, detail: String },

    #[error("Forward pass failed: {0}")]
    ForwardFailed(String),

    #[error("Mean pooling failed: {0}")]
    PoolingFailed(String),

    #[error("Tokenizer error: {0}")]
    Tokenizer(#[from] crate::tokenizer::TokenizerError),
}

/// A sentence embedding vector.
#[derive(Debug, Clone)]
pub struct Embedding {
    /// The embedding values (384-dim for MiniLM, 768-dim for bert-base).
    pub values: Vec<f32>,
    /// Dimensionality of the embedding.
    pub dim: usize,
    /// Inference latency in milliseconds.
    pub inference_ms: f64,
}

impl Embedding {
    /// Cosine similarity between two embeddings.
    ///
    /// Returns value in [-1.0, 1.0]. Panics if dimensions differ.
    pub fn cosine_similarity(&self, other: &Embedding) -> f32 {
        assert_eq!(self.dim, other.dim, "Embedding dimensions must match");

        let dot: f32 = self
            .values
            .iter()
            .zip(&other.values)
            .map(|(a, b)| a * b)
            .sum();
        let norm_a: f32 = self.values.iter().map(|x| x * x).sum::<f32>().sqrt();
        let norm_b: f32 = other.values.iter().map(|x| x * x).sum::<f32>().sqrt();

        if norm_a == 0.0 || norm_b == 0.0 {
            return 0.0;
        }
        dot / (norm_a * norm_b)
    }

    /// L2 (Euclidean) distance between two embeddings.
    pub fn l2_distance(&self, other: &Embedding) -> f32 {
        assert_eq!(self.dim, other.dim);
        self.values
            .iter()
            .zip(&other.values)
            .map(|(a, b)| (a - b).powi(2))
            .sum::<f32>()
            .sqrt()
    }
}

/// BERT sentence encoder using Candle.
pub struct BertEncoder {
    model: BertModel,
    tokenizer: PragmaTokenizer,
    device: Device,
    embedding_dim: usize,
    model_id: ModelId,
}

impl BertEncoder {
    /// Load a BERT encoder from a model directory.
    ///
    /// Expects: config.json, model.safetensors (or pytorch_model.bin), tokenizer.json
    pub fn load(model_id: ModelId) -> Result<Self, EncoderError> {
        let model_dir = crate::models::model_dir(model_id);
        Self::load_from_dir(model_id, &model_dir)
    }

    /// Load from an explicit directory path.
    pub fn load_from_dir(model_id: ModelId, dir: &Path) -> Result<Self, EncoderError> {
        let device = Device::Cpu;

        // Load config
        let config_path = dir.join("config.json");
        let config_str =
            std::fs::read_to_string(&config_path).map_err(|e| EncoderError::ConfigLoadFailed {
                path: config_path.display().to_string(),
                detail: e.to_string(),
            })?;
        let config: BertConfig =
            serde_json::from_str(&config_str).map_err(|e| EncoderError::ConfigLoadFailed {
                path: config_path.display().to_string(),
                detail: e.to_string(),
            })?;

        let embedding_dim = config.hidden_size;

        // Load weights — try safetensors first, then pytorch_model.bin
        let safetensors_path = dir.join("model.safetensors");
        let vb = if safetensors_path.exists() {
            unsafe {
                VarBuilder::from_mmaped_safetensors(
                    &[safetensors_path.clone()],
                    DType::F32,
                    &device,
                )
            }
            .map_err(|e| EncoderError::WeightsLoadFailed {
                path: safetensors_path.display().to_string(),
                detail: e.to_string(),
            })?
        } else {
            return Err(EncoderError::WeightsLoadFailed {
                path: safetensors_path.display().to_string(),
                detail: "model.safetensors not found".to_string(),
            });
        };

        let model = BertModel::load(vb, &config).map_err(|e| EncoderError::WeightsLoadFailed {
            path: dir.display().to_string(),
            detail: format!("BertModel::load failed: {e}"),
        })?;

        // Load tokenizer
        let max_length = model_id
            .embedding_dim()
            .map(|d| if d == 384 { 128 } else { 512 })
            .unwrap_or(512);

        let tokenizer_path = dir.join("tokenizer.json");
        let tokenizer = PragmaTokenizer::from_file_with_max_length(&tokenizer_path, max_length)?;

        log::info!(
            "BertEncoder loaded: {:?} (dim={}, device={:?})",
            model_id,
            embedding_dim,
            device
        );

        Ok(Self {
            model,
            tokenizer,
            device,
            embedding_dim,
            model_id,
        })
    }

    /// Encode a single text into a sentence embedding.
    pub fn encode(&self, text: &str) -> Result<Embedding, EncoderError> {
        let start = Instant::now();
        let encoded = self.tokenizer.encode(text)?;
        let embedding = self.forward_and_pool(&encoded)?;
        let inference_ms = start.elapsed().as_secs_f64() * 1000.0;

        Ok(Embedding {
            values: embedding,
            dim: self.embedding_dim,
            inference_ms,
        })
    }

    /// Encode multiple texts into embeddings (sequential, not batched).
    pub fn encode_batch(&self, texts: &[&str]) -> Result<Vec<Embedding>, EncoderError> {
        texts.iter().map(|t| self.encode(t)).collect()
    }

    /// Get the embedding dimensionality.
    pub fn embedding_dim(&self) -> usize {
        self.embedding_dim
    }

    /// Get the model ID.
    pub fn model_id(&self) -> ModelId {
        self.model_id
    }

    /// Run forward pass and mean-pool to sentence embedding.
    fn forward_and_pool(&self, encoded: &Encoded) -> Result<Vec<f32>, EncoderError> {
        // Create tensors — [1, seq_len]
        let input_ids = Tensor::new(&encoded.input_ids[..], &self.device)
            .map_err(|e| EncoderError::ForwardFailed(e.to_string()))?
            .unsqueeze(0)
            .map_err(|e| EncoderError::ForwardFailed(e.to_string()))?;

        let token_type_ids = Tensor::new(&encoded.token_type_ids[..], &self.device)
            .map_err(|e| EncoderError::ForwardFailed(e.to_string()))?
            .unsqueeze(0)
            .map_err(|e| EncoderError::ForwardFailed(e.to_string()))?;

        let attention_mask_u32 = &encoded.attention_mask;
        let attention_mask_f32: Vec<f32> = attention_mask_u32.iter().map(|&v| v as f32).collect();
        let attention_mask = Tensor::new(&attention_mask_f32[..], &self.device)
            .map_err(|e| EncoderError::ForwardFailed(e.to_string()))?
            .unsqueeze(0)
            .map_err(|e| EncoderError::ForwardFailed(e.to_string()))?;

        // Forward pass → [1, seq_len, hidden_size]
        let output = self
            .model
            .forward(&input_ids, &token_type_ids, Some(&attention_mask))
            .map_err(|e| EncoderError::ForwardFailed(e.to_string()))?;

        // Mean pooling: sum(token_embeddings * attention_mask) / sum(attention_mask)
        let pooled = mean_pool(&output, &attention_mask)
            .map_err(|e| EncoderError::PoolingFailed(e.to_string()))?;

        // Extract values — squeeze to [hidden_size]
        let pooled = pooled
            .squeeze(0)
            .map_err(|e| EncoderError::PoolingFailed(e.to_string()))?;

        let values: Vec<f32> = pooled
            .to_vec1()
            .map_err(|e| EncoderError::PoolingFailed(e.to_string()))?;

        Ok(values)
    }
}

/// Mean pooling: sum(token_embeddings * attention_mask) / clamp(sum(attention_mask), min=1e-9)
///
/// Input:  output [batch, seq_len, hidden_size], mask [batch, seq_len]
/// Output: [batch, hidden_size]
fn mean_pool(output: &Tensor, attention_mask: &Tensor) -> Result<Tensor, candle_core::Error> {
    // Expand mask to [batch, seq_len, 1] for broadcasting
    let mask_expanded = attention_mask.unsqueeze(2)?;

    // Multiply: [batch, seq_len, hidden_size] * [batch, seq_len, 1]
    let masked = output.broadcast_mul(&mask_expanded)?;

    // Sum over seq_len → [batch, hidden_size]
    let summed = masked.sum(1)?;

    // Count of non-padded tokens → [batch, 1]
    let counts = mask_expanded.sum(1)?;

    // Clamp to avoid division by zero
    let counts = counts.clamp(1e-9, f64::MAX)?;

    // Divide
    summed.broadcast_div(&counts)
}

// ─── Tests ──────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cosine_similarity_identical() {
        let a = Embedding {
            values: vec![1.0, 2.0, 3.0],
            dim: 3,
            inference_ms: 0.0,
        };
        let sim = a.cosine_similarity(&a);
        assert!(
            (sim - 1.0).abs() < 1e-6,
            "Self-similarity should be ~1.0, got {sim}"
        );
    }

    #[test]
    fn cosine_similarity_orthogonal() {
        let a = Embedding {
            values: vec![1.0, 0.0, 0.0],
            dim: 3,
            inference_ms: 0.0,
        };
        let b = Embedding {
            values: vec![0.0, 1.0, 0.0],
            dim: 3,
            inference_ms: 0.0,
        };
        let sim = a.cosine_similarity(&b);
        assert!(
            sim.abs() < 1e-6,
            "Orthogonal vectors should have similarity ~0, got {sim}"
        );
    }

    #[test]
    fn cosine_similarity_opposite() {
        let a = Embedding {
            values: vec![1.0, 0.0],
            dim: 2,
            inference_ms: 0.0,
        };
        let b = Embedding {
            values: vec![-1.0, 0.0],
            dim: 2,
            inference_ms: 0.0,
        };
        let sim = a.cosine_similarity(&b);
        assert!(
            (sim + 1.0).abs() < 1e-6,
            "Opposite vectors should have similarity ~-1, got {sim}"
        );
    }

    #[test]
    fn cosine_similarity_zero_vector() {
        let a = Embedding {
            values: vec![0.0, 0.0],
            dim: 2,
            inference_ms: 0.0,
        };
        let b = Embedding {
            values: vec![1.0, 1.0],
            dim: 2,
            inference_ms: 0.0,
        };
        assert_eq!(a.cosine_similarity(&b), 0.0);
    }

    #[test]
    fn l2_distance_identical() {
        let a = Embedding {
            values: vec![1.0, 2.0, 3.0],
            dim: 3,
            inference_ms: 0.0,
        };
        assert!((a.l2_distance(&a)) < 1e-6);
    }

    #[test]
    fn l2_distance_known() {
        let a = Embedding {
            values: vec![0.0, 0.0],
            dim: 2,
            inference_ms: 0.0,
        };
        let b = Embedding {
            values: vec![3.0, 4.0],
            dim: 2,
            inference_ms: 0.0,
        };
        assert!((a.l2_distance(&b) - 5.0).abs() < 1e-6);
    }

    #[test]
    #[should_panic(expected = "dimensions must match")]
    fn cosine_similarity_dimension_mismatch_panics() {
        let a = Embedding {
            values: vec![1.0],
            dim: 1,
            inference_ms: 0.0,
        };
        let b = Embedding {
            values: vec![1.0, 2.0],
            dim: 2,
            inference_ms: 0.0,
        };
        a.cosine_similarity(&b);
    }

    // Integration tests — require provisioned models
    #[test]
    fn encoder_loads_if_provisioned() {
        if !crate::models::is_model_provisioned(ModelId::MiniLmL6V2Int8) {
            return; // skip
        }
        let encoder = BertEncoder::load(ModelId::MiniLmL6V2Int8).unwrap();
        assert_eq!(encoder.embedding_dim(), 384);
    }

    #[test]
    fn encoder_produces_correct_dim() {
        if !crate::models::is_model_provisioned(ModelId::MiniLmL6V2Int8) {
            return;
        }
        let encoder = BertEncoder::load(ModelId::MiniLmL6V2Int8).unwrap();
        let emb = encoder.encode("show me a dashboard").unwrap();
        assert_eq!(emb.dim, 384);
        assert_eq!(emb.values.len(), 384);
        assert!(emb.inference_ms > 0.0);
    }

    #[test]
    fn similar_texts_have_high_similarity() {
        if !crate::models::is_model_provisioned(ModelId::MiniLmL6V2Int8) {
            return;
        }
        let encoder = BertEncoder::load(ModelId::MiniLmL6V2Int8).unwrap();
        let a = encoder.encode("show me a dashboard with metrics").unwrap();
        let b = encoder.encode("display a metrics dashboard").unwrap();
        let sim = a.cosine_similarity(&b);
        assert!(
            sim > 0.7,
            "Similar texts should have high similarity, got {sim}"
        );
    }

    #[test]
    fn different_texts_have_lower_similarity() {
        if !crate::models::is_model_provisioned(ModelId::MiniLmL6V2Int8) {
            return;
        }
        let encoder = BertEncoder::load(ModelId::MiniLmL6V2Int8).unwrap();
        let a = encoder.encode("show me a dashboard with metrics").unwrap();
        let b = encoder.encode("what is the weather in paris").unwrap();
        let sim = a.cosine_similarity(&b);
        assert!(
            sim < 0.5,
            "Different texts should have lower similarity, got {sim}"
        );
    }
}
