//! pragma-core: Snapshot regression for BERTScore, drift, catalog outputs.

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

#[test]
fn bertscore_known_vectors_snapshot() {
    let ref_embs = vec![
        vec![1.0, 0.0, 0.0, 0.0],
        vec![0.0, 1.0, 0.0, 0.0],
        vec![0.0, 0.0, 1.0, 0.0],
    ];
    let hyp_embs = vec![
        vec![0.9, 0.1, 0.0, 0.0],
        vec![0.1, 0.9, 0.0, 0.0],
        vec![0.0, 0.0, 0.8, 0.2],
    ];
    let result = bertscore::compute_from_embeddings(&ref_embs, &hyp_embs);
    insta::assert_json_snapshot!(
        "bertscore_3x3_known",
        serde_json::json!({
            "precision": (result.precision * 10000.0).round() / 10000.0,
            "recall": (result.recall * 10000.0).round() / 10000.0,
            "f1": (result.f1 * 10000.0).round() / 10000.0,
        })
    );
}

#[test]
fn drift_report_no_drift_snapshot() {
    let embs: Vec<Embedding> = (0..5)
        .map(|i| {
            let mut v = vec![0.0f32; 8];
            v[i % 8] = 1.0;
            emb(v)
        })
        .collect();
    let report = drift::detect(&embs, &embs, &drift::DriftConfig::default());
    insta::assert_json_snapshot!(
        "drift_no_drift",
        serde_json::json!({
            "mean_similarity": (report.mean_similarity * 10000.0).round() / 10000.0,
            "min_similarity": (report.min_similarity * 10000.0).round() / 10000.0,
            "drift_detected": report.drift_detected,
            "severity": format!("{:?}", report.severity),
            "sample_count": report.sample_count,
        })
    );
}

#[test]
fn drift_report_severe_snapshot() {
    let baseline: Vec<Embedding> = (0..5)
        .map(|i| {
            let mut v = vec![0.0f32; 8];
            v[i % 8] = 1.0;
            emb(v)
        })
        .collect();
    let current: Vec<Embedding> = (0..5)
        .map(|i| {
            let mut v = vec![0.0f32; 8];
            v[(i + 4) % 8] = 1.0;
            emb(v)
        })
        .collect();
    let report = drift::detect(&baseline, &current, &drift::DriftConfig::default());
    insta::assert_json_snapshot!(
        "drift_severe",
        serde_json::json!({
            "mean_similarity": (report.mean_similarity * 10000.0).round() / 10000.0,
            "min_similarity": (report.min_similarity * 10000.0).round() / 10000.0,
            "drift_detected": report.drift_detected,
            "severity": format!("{:?}", report.severity),
            "sample_count": report.sample_count,
        })
    );
}

#[test]
fn catalog_ranking_snapshot() {
    let catalog = CatalogEmbeddings::from_entries(vec![
        CatalogEntry {
            name: "BarChart".into(),
            description: "bar chart".into(),
            embedding: emb(vec![0.9, 0.1, 0.0, 0.0]),
        },
        CatalogEntry {
            name: "LoginForm".into(),
            description: "login form".into(),
            embedding: emb(vec![0.0, 0.0, 1.0, 0.0]),
        },
        CatalogEntry {
            name: "Dashboard".into(),
            description: "dashboard".into(),
            embedding: emb(vec![0.7, 0.3, 0.0, 0.0]),
        },
    ]);
    let ranked = catalog.rank(&emb(vec![1.0, 0.0, 0.0, 0.0]));
    let snapshot: Vec<serde_json::Value> = ranked.iter()
        .map(|r| serde_json::json!({ "name": r.name, "similarity": (r.similarity * 10000.0).round() / 10000.0 }))
        .collect();
    insta::assert_json_snapshot!("catalog_ranking_3_components", snapshot);
}
