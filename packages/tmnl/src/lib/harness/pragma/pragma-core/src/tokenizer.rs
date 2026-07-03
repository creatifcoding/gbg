//! BERT tokenizer wrapper for PRAGMA.
//!
//! Wraps the HuggingFace `tokenizers` crate to provide:
//! - Loading from model-specific tokenizer.json
//! - Single sequence encoding with [CLS] ... [SEP] framing
//! - Pair sequence encoding for scoring (ref [SEP] hyp)
//! - Configurable max length with truncation
//! - Token count for telemetry

use std::path::Path;

use tokenizers::Tokenizer;

/// Errors from the tokenizer module.
#[derive(Debug, thiserror::Error)]
pub enum TokenizerError {
    #[error("Failed to load tokenizer from {path}: {source}")]
    LoadFailed {
        path: String,
        source: Box<dyn std::error::Error + Send + Sync>,
    },

    #[error("Encoding failed: {0}")]
    EncodingFailed(String),
}

/// Encoded output ready for model inference.
#[derive(Debug, Clone)]
pub struct Encoded {
    /// Token IDs (including [CLS] and [SEP]).
    pub input_ids: Vec<u32>,
    /// Attention mask (1 for real tokens, 0 for padding).
    pub attention_mask: Vec<u32>,
    /// Token type IDs (0 for first segment, 1 for second in pairs).
    pub token_type_ids: Vec<u32>,
    /// Number of actual tokens (pre-padding).
    pub token_count: usize,
}

/// BERT tokenizer wrapper with configured max length.
#[allow(missing_debug_implementations)]
pub struct PragmaTokenizer {
    inner: Tokenizer,
    max_length: usize,
}

impl PragmaTokenizer {
    /// Load a tokenizer from a tokenizer.json file.
    pub fn from_file(path: impl AsRef<Path>) -> Result<Self, TokenizerError> {
        Self::from_file_with_max_length(path, 512)
    }

    /// Load a tokenizer with a custom max length.
    pub fn from_file_with_max_length(
        path: impl AsRef<Path>,
        max_length: usize,
    ) -> Result<Self, TokenizerError> {
        let path_str = path.as_ref().to_string_lossy().to_string();
        let mut tokenizer =
            Tokenizer::from_file(path.as_ref()).map_err(|e| TokenizerError::LoadFailed {
                path: path_str,
                source: e.into(),
            })?;

        // Configure truncation
        let _ = tokenizer.with_truncation(Some(tokenizers::TruncationParams {
            max_length,
            strategy: tokenizers::TruncationStrategy::LongestFirst,
            ..Default::default()
        }));

        // Configure padding to max_length for batched inference
        let _ = tokenizer.with_padding(Some(tokenizers::PaddingParams {
            strategy: tokenizers::PaddingStrategy::Fixed(max_length),
            pad_id: 0,
            pad_token: "[PAD]".to_string(),
            ..Default::default()
        }));

        Ok(Self {
            inner: tokenizer,
            max_length,
        })
    }

    /// Encode a single text sequence.
    ///
    /// Returns [CLS] tokens... [SEP] with padding to max_length.
    pub fn encode(&self, text: &str) -> Result<Encoded, TokenizerError> {
        let encoding = self
            .inner
            .encode(text, true)
            .map_err(|e| TokenizerError::EncodingFailed(e.to_string()))?;

        let token_count = encoding
            .get_attention_mask()
            .iter()
            .filter(|&&m| m == 1)
            .count();

        Ok(Encoded {
            input_ids: encoding.get_ids().to_vec(),
            attention_mask: encoding.get_attention_mask().to_vec(),
            token_type_ids: encoding.get_type_ids().to_vec(),
            token_count,
        })
    }

    /// Encode a pair of sequences (for scoring: reference [SEP] hypothesis).
    ///
    /// Returns [CLS] ref_tokens [SEP] hyp_tokens [SEP] with padding.
    pub fn encode_pair(&self, text_a: &str, text_b: &str) -> Result<Encoded, TokenizerError> {
        let encoding = self
            .inner
            .encode((text_a, text_b), true)
            .map_err(|e| TokenizerError::EncodingFailed(e.to_string()))?;

        let token_count = encoding
            .get_attention_mask()
            .iter()
            .filter(|&&m| m == 1)
            .count();

        Ok(Encoded {
            input_ids: encoding.get_ids().to_vec(),
            attention_mask: encoding.get_attention_mask().to_vec(),
            token_type_ids: encoding.get_type_ids().to_vec(),
            token_count,
        })
    }

    /// Get the configured max length.
    pub fn max_length(&self) -> usize {
        self.max_length
    }

    /// Get the vocabulary size.
    pub fn vocab_size(&self) -> usize {
        self.inner.get_vocab_size(true)
    }
}

// ─── Tests ──────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    // These tests require a real tokenizer.json file.
    // They run only when PRAGMA_MODELS_DIR is set and MiniLM is provisioned.
    // In CI, these are integration tests (T2 tier).

    fn get_test_tokenizer() -> Option<PragmaTokenizer> {
        let path = crate::models::tokenizer_path(crate::models::ModelId::MiniLmL6V2Int8);
        if path.exists() {
            Some(PragmaTokenizer::from_file_with_max_length(&path, 128).unwrap())
        } else {
            None
        }
    }

    #[test]
    fn tokenizer_loads_if_available() {
        if let Some(tok) = get_test_tokenizer() {
            assert!(tok.vocab_size() > 0);
            assert_eq!(tok.max_length(), 128);
        }
        // Silently skip if no model provisioned
    }

    #[test]
    fn encode_single_produces_correct_shape() {
        if let Some(tok) = get_test_tokenizer() {
            let encoded = tok.encode("show me a dashboard").unwrap();
            assert_eq!(encoded.input_ids.len(), 128); // padded to max_length
            assert_eq!(encoded.attention_mask.len(), 128);
            assert_eq!(encoded.token_type_ids.len(), 128);
            assert!(encoded.token_count > 2); // at least [CLS] + 1 token + [SEP]
            assert!(encoded.token_count <= 128);

            // First token should be [CLS] = 101 in BERT vocab
            assert_eq!(encoded.input_ids[0], 101);

            // All token_type_ids should be 0 for single sequence
            assert!(encoded.token_type_ids.iter().all(|&t| t == 0));
        }
    }

    #[test]
    fn encode_pair_has_two_segments() {
        if let Some(tok) = get_test_tokenizer() {
            let encoded = tok
                .encode_pair("reference text", "hypothesis text")
                .unwrap();
            assert_eq!(encoded.input_ids.len(), 128);

            // Should have both segment 0 and segment 1 in token_type_ids
            let has_seg0 = encoded.token_type_ids.iter().any(|&t| t == 0);
            let has_seg1 = encoded.token_type_ids.iter().any(|&t| t == 1);
            assert!(has_seg0, "Missing segment 0");
            assert!(has_seg1, "Missing segment 1");
        }
    }

    #[test]
    fn encode_empty_string() {
        if let Some(tok) = get_test_tokenizer() {
            let encoded = tok.encode("").unwrap();
            // Should still have [CLS] and [SEP]
            assert!(encoded.token_count >= 2);
        }
    }

    #[test]
    fn encode_long_text_truncates() {
        if let Some(tok) = get_test_tokenizer() {
            let long_text = "word ".repeat(500);
            let encoded = tok.encode(&long_text).unwrap();
            assert_eq!(encoded.input_ids.len(), 128);
            assert!(encoded.token_count <= 128);
        }
    }

    // Pure unit tests (no model needed)

    #[test]
    fn load_nonexistent_file_returns_error() {
        let result = PragmaTokenizer::from_file("/nonexistent/path/tokenizer.json");
        assert!(result.is_err());
        match result {
            Err(TokenizerError::LoadFailed { path, .. }) => {
                assert!(path.contains("nonexistent"));
            }
            _ => panic!("Expected LoadFailed error"),
        }
    }

    #[test]
    fn encoded_fields_consistent() {
        // Verify the Encoded struct has the expected public API
        let encoded = Encoded {
            input_ids: vec![101, 2054, 102, 0],
            attention_mask: vec![1, 1, 1, 0],
            token_type_ids: vec![0, 0, 0, 0],
            token_count: 3,
        };
        assert_eq!(encoded.input_ids.len(), 4);
        assert_eq!(encoded.token_count, 3);
    }
}
