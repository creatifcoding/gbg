//! pragma-core: Chaos tests — edge inputs, zero vectors, dimension mismatches, boundaries.

use pragma_core::bertscore;
use pragma_core::catalog::{CatalogEmbeddings, CatalogEntry};
use pragma_core::drift;
use pragma_core::encoder::Embedding;

fn emb(values: Vec<f32>) -> Embedding {
    let dim = values.len();
    Embedding {
        values,
        dim,
        inference_ms: 0.0,
    }
}

fn entry(name: &str, v: Vec<f32>) -> CatalogEntry {
    CatalogEntry {
        name: name.into(),
        description: format!("{name} desc"),
        embedding: emb(v),
    }
}

// ─── BERTScore chaos ────────────────────────────────────────────────

#[test]
fn bertscore_empty_ref() {
    assert_eq!(
        bertscore::compute_from_embeddings(&[], &[vec![1.0]]).f1,
        0.0
    );
}

#[test]
fn bertscore_empty_hyp() {
    assert_eq!(
        bertscore::compute_from_embeddings(&[vec![1.0]], &[]).f1,
        0.0
    );
}

#[test]
fn bertscore_both_empty() {
    assert_eq!(bertscore::compute_from_embeddings(&[], &[]).f1, 0.0);
}

#[test]
fn bertscore_single_identical() {
    let r = bertscore::compute_from_embeddings(&[vec![1.0, 0.0]], &[vec![1.0, 0.0]]);
    assert!((r.f1 - 1.0).abs() < 1e-5);
}

#[test]
fn bertscore_zero_vector_ref() {
    let r = bertscore::compute_from_embeddings(&[vec![0.0, 0.0]], &[vec![1.0, 0.0]]);
    assert!(r.f1.is_finite());
}

#[test]
fn bertscore_large_dim() {
    let r = bertscore::compute_from_embeddings(&[vec![0.01f32; 1024]], &[vec![0.01f32; 1024]]);
    assert!(r.f1.is_finite() && r.f1 >= 0.0);
}

#[test]
fn bertscore_100_pairs() {
    let refs: Vec<Vec<f32>> = (0..100)
        .map(|i| {
            let mut v = vec![0.0f32; 16];
            v[i % 16] = 1.0;
            v
        })
        .collect();
    let r = bertscore::compute_from_embeddings(&refs, &refs);
    assert!((r.f1 - 1.0).abs() < 1e-5);
}

// ─── Drift chaos ────────────────────────────────────────────────────

#[test]
fn drift_mismatched_lengths() {
    let b = vec![emb(vec![1.0, 0.0]); 10];
    let c = vec![emb(vec![1.0, 0.0]); 3];
    assert_eq!(
        drift::detect(&b, &c, &drift::DriftConfig::default()).sample_count,
        3
    );
}

#[test]
fn drift_single_pair() {
    let r = drift::detect(
        &[emb(vec![1.0, 0.0])],
        &[emb(vec![1.0, 0.0])],
        &drift::DriftConfig::default(),
    );
    assert_eq!(r.sample_count, 1);
    assert!(!r.drift_detected);
}

#[test]
fn drift_impossible_threshold() {
    let cfg = drift::DriftConfig {
        alert_threshold: 1.1,
        window_size: 50,
    };
    let embs = vec![emb(vec![1.0, 0.0])];
    assert!(drift::detect(&embs, &embs, &cfg).drift_detected);
}

// ─── Catalog chaos ──────────────────────────────────────────────────

#[test]
fn catalog_empty_rank() {
    assert!(CatalogEmbeddings::new()
        .rank(&emb(vec![1.0, 0.0]))
        .is_empty());
}

#[test]
fn catalog_top_k_gt_entries() {
    let c = CatalogEmbeddings::from_entries(vec![entry("A", vec![1.0, 0.0])]);
    assert_eq!(c.top_k(&emb(vec![1.0, 0.0]), 10).len(), 1);
}

#[test]
fn catalog_top_0() {
    let c = CatalogEmbeddings::from_entries(vec![entry("A", vec![1.0, 0.0])]);
    assert!(c.top_k(&emb(vec![1.0, 0.0]), 0).is_empty());
}

// ─── Embedding chaos ────────────────────────────────────────────────

#[test]
fn embedding_cosine_zero_both() {
    let a = emb(vec![0.0, 0.0]);
    assert!(a.cosine_similarity(&a).is_finite());
}

#[test]
fn embedding_l2_large_values() {
    let a = emb(vec![1e30, 1e30]);
    let b = emb(vec![-1e30, -1e30]);
    assert!(!a.l2_distance(&b).is_nan());
}
