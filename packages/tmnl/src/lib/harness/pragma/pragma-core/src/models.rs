//! Model provisioning and path resolution for PRAGMA inference models.
//!
//! Models are stored in a platform-specific data directory:
//! - Linux: `$XDG_DATA_HOME/pragma/models/` (default: `~/.local/share/pragma/models/`)
//! - macOS: `~/Library/Application Support/pragma/models/`
//! - Override: `$PRAGMA_MODELS_DIR`
//!
//! Model manifest:
//! - `minilm-l6-v2-int8/` — MiniLM-L6-v2 INT8 (hot path, 384-dim, ~22MB)
//!   - `model.onnx`
//!   - `tokenizer.json`
//!   - `config.json`
//! - `bert-base-uncased-int8/` — bert-base INT8 (deep path, 768-dim, ~110MB)
//!   - `model.onnx`
//!   - `tokenizer.json`
//!   - `config.json`
//! - `bleurt-d12-int8/` — BLEURT-20-D12 INT8 (scoring, ~65MB)
//!   - `model.onnx`
//!   - `tokenizer.json`
//!   - `config.json`

use std::path::PathBuf;

use pragma_ipc::types::ModelTier;

/// Model identifiers corresponding to downloadable model packages.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum ModelId {
    /// all-MiniLM-L6-v2 quantized to INT8.
    MiniLmL6V2Int8,
    /// bert-base-uncased quantized to INT8.
    BertBaseUncasedInt8,
    /// BLEURT-20-D12 quantized to INT8.
    BleurtD12Int8,
}

impl ModelId {
    /// Directory name under the models root.
    pub fn dir_name(&self) -> &'static str {
        match self {
            Self::MiniLmL6V2Int8 => "minilm-l6-v2-int8",
            Self::BertBaseUncasedInt8 => "bert-base-uncased-int8",
            Self::BleurtD12Int8 => "bleurt-d12-int8",
        }
    }

    /// HuggingFace Hub repo ID for downloading.
    pub fn hf_repo(&self) -> &'static str {
        match self {
            Self::MiniLmL6V2Int8 => "sentence-transformers/all-MiniLM-L6-v2",
            Self::BertBaseUncasedInt8 => "google-bert/bert-base-uncased",
            Self::BleurtD12Int8 => "lucadiliello/BLEURT-20-D12",
        }
    }

    /// Expected embedding dimension (None for non-encoder models like BLEURT).
    pub fn embedding_dim(&self) -> Option<usize> {
        match self {
            Self::MiniLmL6V2Int8 => Some(384),
            Self::BertBaseUncasedInt8 => Some(768),
            Self::BleurtD12Int8 => None,
        }
    }

    /// Corresponding model tier.
    pub fn tier(&self) -> ModelTier {
        match self {
            Self::MiniLmL6V2Int8 => ModelTier::Minilm,
            Self::BertBaseUncasedInt8 => ModelTier::BertBase,
            Self::BleurtD12Int8 => ModelTier::Minilm, // BLEURT uses its own tokenizer
        }
    }

    /// All model IDs in provisioning order.
    pub fn all() -> &'static [ModelId] {
        &[
            Self::MiniLmL6V2Int8,
            Self::BertBaseUncasedInt8,
            Self::BleurtD12Int8,
        ]
    }

    /// Required file names within the model directory.
    pub fn required_files(&self) -> &'static [&'static str] {
        match self {
            Self::MiniLmL6V2Int8 | Self::BertBaseUncasedInt8 => {
                &["model.onnx", "tokenizer.json", "config.json"]
            }
            Self::BleurtD12Int8 => &["model.onnx", "tokenizer.json"],
        }
    }
}

/// Resolve the models root directory.
///
/// Priority:
/// 1. `$PRAGMA_MODELS_DIR` environment variable
/// 2. `$XDG_DATA_HOME/pragma/models/` (Linux)
/// 3. `~/.local/share/pragma/models/` (Linux fallback)
/// 4. `~/Library/Application Support/pragma/models/` (macOS)
pub fn models_dir() -> PathBuf {
    // Check override first
    if let Ok(dir) = std::env::var("PRAGMA_MODELS_DIR") {
        return PathBuf::from(dir);
    }

    // XDG on Linux
    if let Ok(xdg) = std::env::var("XDG_DATA_HOME") {
        return PathBuf::from(xdg).join("pragma").join("models");
    }

    // Platform default
    if let Some(home) = home_dir() {
        #[cfg(target_os = "macos")]
        {
            return home
                .join("Library")
                .join("Application Support")
                .join("pragma")
                .join("models");
        }
        #[cfg(not(target_os = "macos"))]
        {
            return home
                .join(".local")
                .join("share")
                .join("pragma")
                .join("models");
        }
    }

    // Last resort
    PathBuf::from("/tmp/pragma/models")
}

/// Resolve the full path to a specific model's directory.
pub fn model_dir(id: ModelId) -> PathBuf {
    models_dir().join(id.dir_name())
}

/// Check if a model is fully provisioned (all required files exist).
pub fn is_model_provisioned(id: ModelId) -> bool {
    let dir = model_dir(id);
    if !dir.exists() {
        return false;
    }
    id.required_files().iter().all(|f| dir.join(f).exists())
}

/// Get the path to the ONNX model file for a model ID.
pub fn model_onnx_path(id: ModelId) -> PathBuf {
    model_dir(id).join("model.onnx")
}

/// Get the path to the tokenizer.json for a model ID.
pub fn tokenizer_path(id: ModelId) -> PathBuf {
    model_dir(id).join("tokenizer.json")
}

/// Check all models and return a list of missing ones.
pub fn missing_models() -> Vec<ModelId> {
    ModelId::all()
        .iter()
        .filter(|id| !is_model_provisioned(**id))
        .copied()
        .collect()
}

/// Provision status for all models.
pub fn provision_status() -> Vec<(ModelId, bool)> {
    ModelId::all()
        .iter()
        .map(|id| (*id, is_model_provisioned(*id)))
        .collect()
}

/// Path to the catalog embeddings cache.
pub fn catalog_embeddings_path() -> PathBuf {
    models_dir().join("catalog-embeddings.bin")
}

/// Path to the embedding drift baseline.
pub fn drift_baseline_path() -> PathBuf {
    models_dir().join("drift-baseline.json")
}

// ─── Helpers ────────────────────────────────────────────────────────

fn home_dir() -> Option<PathBuf> {
    std::env::var("HOME")
        .ok()
        .map(PathBuf::from)
}

// ─── Tests ──────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn model_id_all_returns_three() {
        assert_eq!(ModelId::all().len(), 3);
    }

    #[test]
    fn model_id_dir_names_unique() {
        let names: Vec<&str> = ModelId::all().iter().map(|id| id.dir_name()).collect();
        let mut deduped = names.clone();
        deduped.sort();
        deduped.dedup();
        assert_eq!(names.len(), deduped.len());
    }

    #[test]
    fn model_id_hf_repos_unique() {
        let repos: Vec<&str> = ModelId::all().iter().map(|id| id.hf_repo()).collect();
        let mut deduped = repos.clone();
        deduped.sort();
        deduped.dedup();
        assert_eq!(repos.len(), deduped.len());
    }

    #[test]
    fn model_embedding_dims() {
        assert_eq!(ModelId::MiniLmL6V2Int8.embedding_dim(), Some(384));
        assert_eq!(ModelId::BertBaseUncasedInt8.embedding_dim(), Some(768));
        assert_eq!(ModelId::BleurtD12Int8.embedding_dim(), None);
    }

    #[test]
    fn required_files_all_have_onnx() {
        for id in ModelId::all() {
            assert!(
                id.required_files().contains(&"model.onnx"),
                "{:?} missing model.onnx", id
            );
        }
    }

    #[test]
    fn models_dir_override() {
        std::env::set_var("PRAGMA_MODELS_DIR", "/custom/path");
        assert_eq!(models_dir(), PathBuf::from("/custom/path"));
        std::env::remove_var("PRAGMA_MODELS_DIR");
    }

    #[test]
    fn model_dir_structure() {
        std::env::set_var("PRAGMA_MODELS_DIR", "/test");
        assert_eq!(
            model_dir(ModelId::MiniLmL6V2Int8),
            PathBuf::from("/test/minilm-l6-v2-int8")
        );
        assert_eq!(
            model_onnx_path(ModelId::BertBaseUncasedInt8),
            PathBuf::from("/test/bert-base-uncased-int8/model.onnx")
        );
        assert_eq!(
            tokenizer_path(ModelId::BleurtD12Int8),
            PathBuf::from("/test/bleurt-d12-int8/tokenizer.json")
        );
        std::env::remove_var("PRAGMA_MODELS_DIR");
    }

    #[test]
    fn missing_models_returns_all_when_no_dir() {
        std::env::set_var("PRAGMA_MODELS_DIR", "/nonexistent/path/for/testing");
        let missing = missing_models();
        assert_eq!(missing.len(), 3);
        std::env::remove_var("PRAGMA_MODELS_DIR");
    }

    #[test]
    fn catalog_and_drift_paths() {
        std::env::set_var("PRAGMA_MODELS_DIR", "/test");
        assert_eq!(
            catalog_embeddings_path(),
            PathBuf::from("/test/catalog-embeddings.bin")
        );
        assert_eq!(
            drift_baseline_path(),
            PathBuf::from("/test/drift-baseline.json")
        );
        std::env::remove_var("PRAGMA_MODELS_DIR");
    }
}
