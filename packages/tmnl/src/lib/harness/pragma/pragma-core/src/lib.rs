//! # pragma-core
//!
//! Inference and embedding engine for PRAGMA sidecar.
//!
//! Provides:
//! - Model provisioning and path resolution
//! - BERT tokenization (via `tokenizers`)
//! - Embedding via Candle (MiniLM, bert-base)
//! - BERTScore computation (greedy bipartite matching)
//! - BLEURT scoring via ort (ONNX Runtime)
//! - Catalog embedding cache
//! - Embedding drift detection

pub mod bertscore;
pub mod bleurt;
pub mod catalog;
pub mod drift;
pub mod encoder;
pub mod loader;
pub mod models;
pub mod tiered_encoder;
pub mod tokenizer;
