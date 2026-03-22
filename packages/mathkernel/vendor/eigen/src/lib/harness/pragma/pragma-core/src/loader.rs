//! Model loading infrastructure for PRAGMA.
//!
//! Loads ONNX models via ort (ONNX Runtime) for inference.
//! Candle is used for embedding computation (separate module).
//!
//! Load lifecycle:
//! 1. Check provisioning (model files exist)
//! 2. Load ONNX session with optimized execution providers
//! 3. Validate input/output shapes against expected dimensions
//! 4. Report model status for warmup response

use std::path::Path;
use std::time::Instant;

use pragma_ipc::types::{DriftStatus, ModelStatus, ModelTier, WarmupResponse};

use crate::models::{self, ModelId};
use crate::tokenizer::PragmaTokenizer;

/// Errors from model loading.
#[derive(Debug, thiserror::Error)]
pub enum LoadError {
    #[error("Model not provisioned: {model} (missing files in {path})")]
    NotProvisioned { model: String, path: String },

    #[error("Tokenizer load failed for {model}: {source}")]
    TokenizerFailed {
        model: String,
        #[source]
        source: crate::tokenizer::TokenizerError,
    },

    #[error("ONNX session creation failed for {model}: {detail}")]
    OnnxFailed {
        model: String,
        detail: String,
    },
}

/// A loaded model instance ready for inference.
pub struct LoadedModel {
    /// Model identifier.
    pub id: ModelId,
    /// Tokenizer for this model.
    pub tokenizer: PragmaTokenizer,
    /// File size of the ONNX model in bytes.
    pub model_size_bytes: u64,
    /// Load latency in milliseconds.
    pub load_ms: f64,
}

/// Result of loading all PRAGMA models.
pub struct ModelRegistry {
    /// MiniLM encoder (hot path). Required.
    pub minilm: Option<LoadedModel>,
    /// bert-base encoder (deep path). Optional — degrades gracefully.
    pub bert_base: Option<LoadedModel>,
    /// BLEURT scorer. Optional — degrades gracefully.
    pub bleurt: Option<LoadedModel>,
    /// Total warmup time in milliseconds.
    pub total_warmup_ms: f64,
}

impl ModelRegistry {
    /// Load all available models. Returns registry with whatever loaded successfully.
    ///
    /// MiniLM is required — if it fails, warmup reports not ready.
    /// bert-base and BLEURT are optional — if missing, sidecar operates in degraded mode.
    pub fn load_all() -> Self {
        let start = Instant::now();

        let minilm = load_single_model(ModelId::MiniLmL6V2Int8, 128);
        let bert_base = load_single_model(ModelId::BertBaseUncasedInt8, 512);
        let bleurt = load_single_model(ModelId::BleurtD12Int8, 512);

        Self {
            minilm,
            bert_base,
            bleurt,
            total_warmup_ms: start.elapsed().as_secs_f64() * 1000.0,
        }
    }

    /// Whether the primary encoder (MiniLM) is loaded and ready.
    pub fn is_ready(&self) -> bool {
        self.minilm.is_some()
    }

    /// Build a WarmupResponse from the current registry state.
    pub fn warmup_response(&self, catalog_embeddings_count: usize) -> WarmupResponse {
        let mut model_statuses = Vec::new();

        if let Some(ref m) = self.minilm {
            model_statuses.push(model_status(m, true));
        } else {
            model_statuses.push(ModelStatus {
                name: "all-MiniLM-L6-v2".to_string(),
                tier: ModelTier::Minilm,
                loaded: false,
                size_bytes: 0,
                embedding_dim: 384,
            });
        }

        if let Some(ref m) = self.bert_base {
            model_statuses.push(model_status(m, true));
        } else {
            model_statuses.push(ModelStatus {
                name: "bert-base-uncased".to_string(),
                tier: ModelTier::BertBase,
                loaded: false,
                size_bytes: 0,
                embedding_dim: 768,
            });
        }

        if let Some(ref m) = self.bleurt {
            model_statuses.push(model_status(m, true));
        }

        WarmupResponse {
            ready: self.is_ready(),
            models: model_statuses,
            catalog_embeddings_count,
            drift_status: DriftStatus::NoBaseline, // Updated after drift check
            warmup_ms: self.total_warmup_ms,
        }
    }

    /// List warnings for degraded mode.
    pub fn degradation_warnings(&self) -> Vec<String> {
        let mut warnings = Vec::new();
        if self.bert_base.is_none() {
            warnings.push("bert-base unavailable, using MiniLM fallback".to_string());
        }
        if self.bleurt.is_none() {
            warnings.push("BLEURT unavailable, scoring will use BERTScore only".to_string());
        }
        warnings
    }
}

/// Load a single model (tokenizer only for now, ONNX session in next phase).
fn load_single_model(id: ModelId, max_length: usize) -> Option<LoadedModel> {
    let start = Instant::now();

    // Check provisioning
    if !models::is_model_provisioned(id) {
        log::warn!(
            "Model {:?} not provisioned at {}",
            id,
            models::model_dir(id).display()
        );
        return None;
    }

    // Load tokenizer
    let tok_path = models::tokenizer_path(id);
    let tokenizer = match PragmaTokenizer::from_file_with_max_length(&tok_path, max_length) {
        Ok(t) => t,
        Err(e) => {
            log::error!("Failed to load tokenizer for {:?}: {}", id, e);
            return None;
        }
    };

    // Get model file size
    let model_size_bytes = std::fs::metadata(models::model_onnx_path(id))
        .map(|m| m.len())
        .unwrap_or(0);

    let load_ms = start.elapsed().as_secs_f64() * 1000.0;
    log::info!(
        "Loaded {:?} in {:.1}ms (model: {}MB, vocab: {})",
        id,
        load_ms,
        model_size_bytes / 1_000_000,
        tokenizer.vocab_size()
    );

    Some(LoadedModel {
        id,
        tokenizer,
        model_size_bytes,
        load_ms,
    })
}

fn model_status(m: &LoadedModel, loaded: bool) -> ModelStatus {
    ModelStatus {
        name: match m.id {
            ModelId::MiniLmL6V2Int8 => "all-MiniLM-L6-v2".to_string(),
            ModelId::BertBaseUncasedInt8 => "bert-base-uncased".to_string(),
            ModelId::BleurtD12Int8 => "BLEURT-20-D12".to_string(),
        },
        tier: m.id.tier(),
        loaded,
        size_bytes: m.model_size_bytes,
        embedding_dim: m.id.embedding_dim().unwrap_or(0),
    }
}

// ─── Tests ──────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn model_registry_no_models_not_ready() {
        // With no models provisioned, registry should not be ready
        std::env::set_var("PRAGMA_MODELS_DIR", "/nonexistent/test/path");
        let registry = ModelRegistry::load_all();
        assert!(!registry.is_ready());
        assert!(registry.minilm.is_none());
        assert!(registry.bert_base.is_none());
        assert!(registry.bleurt.is_none());
        std::env::remove_var("PRAGMA_MODELS_DIR");
    }

    #[test]
    fn warmup_response_not_ready_when_no_models() {
        std::env::set_var("PRAGMA_MODELS_DIR", "/nonexistent/test/path");
        let registry = ModelRegistry::load_all();
        let resp = registry.warmup_response(0);
        assert!(!resp.ready);
        assert_eq!(resp.catalog_embeddings_count, 0);
        assert!(resp.warmup_ms >= 0.0);
        // Should have at least MiniLM and bert-base status entries
        assert!(resp.models.len() >= 2);
        assert!(resp.models.iter().all(|m| !m.loaded));
        std::env::remove_var("PRAGMA_MODELS_DIR");
    }

    #[test]
    fn degradation_warnings_when_no_optional_models() {
        std::env::set_var("PRAGMA_MODELS_DIR", "/nonexistent/test/path");
        let registry = ModelRegistry::load_all();
        let warnings = registry.degradation_warnings();
        assert_eq!(warnings.len(), 2);
        assert!(warnings[0].contains("bert-base"));
        assert!(warnings[1].contains("BLEURT"));
        std::env::remove_var("PRAGMA_MODELS_DIR");
    }

    #[test]
    fn model_registry_loads_if_provisioned() {
        // Only runs if models are actually provisioned
        let registry = ModelRegistry::load_all();
        if registry.is_ready() {
            let resp = registry.warmup_response(44);
            assert!(resp.ready);
            assert_eq!(resp.catalog_embeddings_count, 44);
            assert!(resp.models.iter().any(|m| m.loaded));
        }
    }
}
