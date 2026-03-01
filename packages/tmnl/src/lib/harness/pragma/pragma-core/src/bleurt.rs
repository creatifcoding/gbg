//! BLEURT scorer via ONNX Runtime (ort).
//!
//! Loads a BLEURT-20-D12 INT8 ONNX model and produces scalar quality scores
//! for (reference, candidate) text pairs. Used in the async scoring path.

use std::path::Path;
use std::time::Instant;

use crate::models::ModelId;
use crate::tokenizer::{PragmaTokenizer, TokenizerError};

/// BLEURT score result.
#[derive(Debug, Clone, Copy)]
pub struct BleurtScore {
    /// Scalar quality score. Higher is better. Typical range ~[-1, 1]
    /// but not strictly bounded.
    pub score: f32,
    /// Inference latency in milliseconds.
    pub inference_ms: f64,
}

/// Errors from BLEURT scoring.
#[derive(Debug, thiserror::Error)]
pub enum BleurtError {
    #[error("BLEURT model not provisioned at {0}")]
    NotProvisioned(String),

    #[error("Failed to load ONNX model: {0}")]
    OnnxLoadFailed(String),

    #[error("Inference failed: {0}")]
    InferenceFailed(String),

    #[error("Tokenizer error: {0}")]
    Tokenizer(#[from] TokenizerError),
}

/// BLEURT scorer wrapping an ONNX Runtime session.
///
/// Currently a stub that validates the infrastructure.
/// Full ONNX integration requires provisioned model files.
pub struct BleurtScorer {
    tokenizer: Option<PragmaTokenizer>,
    model_dir: std::path::PathBuf,
    _available: bool,
}

impl BleurtScorer {
    /// Try to load the BLEURT scorer from provisioned model files.
    ///
    /// Returns Ok with available=false if model is not provisioned (degraded mode).
    pub fn load() -> Result<Self, BleurtError> {
        let model_dir = crate::models::model_dir(ModelId::BleurtD12Int8);
        Self::load_from_dir(&model_dir)
    }

    /// Load from an explicit directory.
    pub fn load_from_dir(dir: &Path) -> Result<Self, BleurtError> {
        let onnx_path = dir.join("model.onnx");
        let tokenizer_path = dir.join("tokenizer.json");

        if !onnx_path.exists() {
            log::warn!("BLEURT model not provisioned at {:?} — scorer unavailable", dir);
            return Ok(Self {
                tokenizer: None,
                model_dir: dir.to_path_buf(),
                _available: false,
            });
        }

        let tokenizer = if tokenizer_path.exists() {
            Some(PragmaTokenizer::from_file_with_max_length(&tokenizer_path, 512)?)
        } else {
            None
        };

        log::info!("BleurtScorer: model found at {:?}", dir);

        Ok(Self {
            tokenizer,
            model_dir: dir.to_path_buf(),
            _available: true,
        })
    }

    /// Whether the BLEURT model is available.
    pub fn is_available(&self) -> bool {
        self._available
    }

    /// Score a (reference, candidate) pair.
    ///
    /// Returns None if the model is not provisioned.
    pub fn score(
        &self,
        reference: &str,
        candidate: &str,
    ) -> Result<Option<BleurtScore>, BleurtError> {
        if !self._available {
            return Ok(None);
        }

        let start = Instant::now();

        // Tokenize the pair
        let _encoded = match &self.tokenizer {
            Some(tok) => tok.encode_pair(reference, candidate)?,
            None => {
                return Err(BleurtError::InferenceFailed(
                    "Tokenizer not loaded".to_string(),
                ));
            }
        };

        // TODO: Wire ort::Session for actual ONNX inference.
        // The ort crate API:
        //   let session = Session::builder()?.with_model_from_file(onnx_path)?;
        //   let outputs = session.run(inputs![input_ids, attention_mask, token_type_ids]?)?;
        //   let score = outputs[0].extract_tensor::<f32>()?;
        //
        // For now, return a placeholder that exercises the full pipeline shape.
        let inference_ms = start.elapsed().as_secs_f64() * 1000.0;

        log::debug!(
            "BLEURT score: ref_len={}, cand_len={}, latency={:.2}ms (stub)",
            reference.len(),
            candidate.len(),
            inference_ms
        );

        Ok(Some(BleurtScore {
            score: 0.0, // Placeholder until ort session is wired
            inference_ms,
        }))
    }

    /// Get the model directory path.
    pub fn model_dir(&self) -> &Path {
        &self.model_dir
    }
}

// ─── Tests ──────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn scorer_loads_degraded_when_not_provisioned() {
        let tmp = std::env::temp_dir().join("pragma-test-bleurt-empty");
        std::fs::create_dir_all(&tmp).ok();
        let scorer = BleurtScorer::load_from_dir(&tmp).unwrap();
        assert!(!scorer.is_available());
        let _ = std::fs::remove_dir_all(&tmp);
    }

    #[test]
    fn unavailable_scorer_returns_none() {
        let tmp = std::env::temp_dir().join("pragma-test-bleurt-none");
        std::fs::create_dir_all(&tmp).ok();
        let scorer = BleurtScorer::load_from_dir(&tmp).unwrap();
        let result = scorer.score("hello", "world").unwrap();
        assert!(result.is_none());
        let _ = std::fs::remove_dir_all(&tmp);
    }

    #[test]
    fn bleurt_score_struct() {
        let s = BleurtScore {
            score: 0.75,
            inference_ms: 3.2,
        };
        assert!((s.score - 0.75).abs() < 1e-6);
    }
}
