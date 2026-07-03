//! pragma-core: Integration tests — multi-module interactions.
//! encoder → catalog → drift → bertscore pipeline.

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

// ─── Catalog ranking integration ────────────────────────────────────

#[test]
fn catalog_ranks_by_cosine_similarity() {
    let catalog = CatalogEmbeddings::from_entries(vec![
        entry("BarChart", vec![0.9, 0.1, 0.0, 0.0]),
        entry("LoginForm", vec![0.0, 0.0, 1.0, 0.0]),
        entry("LineGraph", vec![0.8, 0.2, 0.0, 0.0]),
    ]);
    let ranked = catalog.rank(&emb(vec![1.0, 0.0, 0.0, 0.0]));
    assert_eq!(ranked[0].name, "BarChart");
    assert_eq!(ranked[1].name, "LineGraph");
    assert_eq!(ranked[2].name, "LoginForm");
}

#[test]
fn catalog_top_k_limits_output() {
    let entries: Vec<CatalogEntry> = (0..20)
        .map(|i| {
            entry(
                &format!("Comp{i}"),
                vec![1.0 - i as f32 * 0.05, i as f32 * 0.05],
            )
        })
        .collect();
    let catalog = CatalogEmbeddings::from_entries(entries);
    let top3 = catalog.top_k(&emb(vec![1.0, 0.0]), 3);
    assert_eq!(top3.len(), 3);
    assert!(top3.last().unwrap().similarity > 0.0);
}

// ─── BERTScore → Drift pipeline ─────────────────────────────────────

#[test]
fn bertscore_feeds_into_drift_detection() {
    let baseline_vecs: Vec<Vec<f32>> = (0..10)
        .map(|i| {
            let mut v = vec![0.0f32; 32];
            v[i % 32] = 1.0;
            v
        })
        .collect();
    let current_vecs: Vec<Vec<f32>> = (0..10)
        .map(|i| {
            let mut v = vec![0.0f32; 32];
            v[i % 32] = 0.95;
            v[(i + 1) % 32] = 0.05;
            v
        })
        .collect();

    let score = bertscore::compute_from_embeddings(&baseline_vecs, &current_vecs);
    assert!(score.f1 > 0.0);

    let baseline: Vec<Embedding> = baseline_vecs.iter().map(|v| emb(v.clone())).collect();
    let current: Vec<Embedding> = current_vecs.iter().map(|v| emb(v.clone())).collect();
    let report = drift::detect(&baseline, &current, &drift::DriftConfig::default());
    assert!(report.mean_similarity > 0.5);
}

// ─── Catalog → BERTScore correlation ────────────────────────────────

#[test]
fn catalog_ranking_correlates_with_bertscore() {
    let close_score = bertscore::compute_from_embeddings(
        &[vec![1.0, 0.0, 0.0, 0.0]],
        &[vec![0.95, 0.05, 0.0, 0.0]],
    );
    let far_score = bertscore::compute_from_embeddings(
        &[vec![1.0, 0.0, 0.0, 0.0]],
        &[vec![0.0, 0.0, 0.0, 1.0]],
    );
    assert!(close_score.f1 > far_score.f1);
}

// ─── Full pipeline structural ───────────────────────────────────────

#[test]
fn full_pipeline_encode_rank_score_drift() {
    let catalog = CatalogEmbeddings::from_entries(vec![
        entry("Chart", vec![1.0, 0.0]),
        entry("Form", vec![0.0, 1.0]),
    ]);

    // Rank
    let query = emb(vec![0.8, 0.2]);
    let ranked = catalog.top_k(&query, 1);
    assert_eq!(ranked[0].name, "Chart");

    // Score
    let score = bertscore::compute_from_embeddings(&[vec![0.8, 0.2]], &[vec![0.9, 0.1]]);
    assert!(score.f1 > 0.5);

    // Drift
    let drift_report = drift::detect(
        &[emb(vec![1.0, 0.0])],
        &[emb(vec![0.9, 0.1])],
        &drift::DriftConfig::default(),
    );
    assert!(drift_report.mean_similarity > 0.8);
}
