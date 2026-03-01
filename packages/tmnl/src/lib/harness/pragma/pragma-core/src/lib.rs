//! # pragma-core
//!
//! Core inference and scoring engine for PRAGMA.
//!
//! - BERT encoder (MiniLM-L6-v2 + bert-base-uncased) via Candle
//! - BERTScore computation
//! - BLEURT scoring via ONNX Runtime (ort)
//! - Catalog embedding cache + cosine similarity ranking
//! - Embedding drift detection (CSDD)

// Modules will be populated in P2/P3 implementation phases
// pub mod tokenizer;
// pub mod bert;
// pub mod bertscore;
// pub mod bleurt;
// pub mod cosine;
// pub mod drift;
// pub mod catalog;
