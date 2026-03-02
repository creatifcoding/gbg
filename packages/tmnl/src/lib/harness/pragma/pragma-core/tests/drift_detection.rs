//! T8: Embedding drift detection suite.

use pragma_core::drift::{self, DriftConfig, DriftSeverity};
use pragma_core::encoder::Embedding;

fn make_emb(values: Vec<f32>) -> Embedding {
    let dim = values.len();
    Embedding { values, dim, inference_ms: 0.0 }
}

// ─── CSDD detector tests ────────────────────────────────────────────

#[test]
fn no_drift_when_identical() {
    let embs: Vec<Embedding> = (0..20)
        .map(|i| {
            let mut v = vec![0.0f32; 64];
            v[i % 64] = 1.0;
            make_emb(v)
        })
        .collect();

    let report = drift::detect(&embs, &embs, &DriftConfig::default());
    assert!(!report.drift_detected);
    assert_eq!(report.severity, DriftSeverity::None);
    assert!((report.mean_similarity - 1.0).abs() < 1e-6);
}

#[test]
fn severe_drift_on_random_perturbation() {
    let baseline: Vec<Embedding> = (0..20)
        .map(|i| {
            let mut v = vec![0.0f32; 64];
            v[i % 64] = 1.0;
            make_emb(v)
        })
        .collect();

    // Completely different embeddings
    let perturbed: Vec<Embedding> = (0..20)
        .map(|i| {
            let mut v = vec![0.0f32; 64];
            v[(i + 32) % 64] = 1.0; // Orthogonal to baseline
            make_emb(v)
        })
        .collect();

    let report = drift::detect(&baseline, &perturbed, &DriftConfig::default());
    assert!(report.drift_detected);
    assert_eq!(report.severity, DriftSeverity::High);
}

#[test]
fn mild_perturbation_low_severity() {
    let baseline: Vec<Embedding> = (0..20)
        .map(|_| make_emb(vec![1.0, 0.0, 0.0, 0.0]))
        .collect();

    // Slightly perturbed — still high similarity
    let perturbed: Vec<Embedding> = (0..20)
        .map(|_| make_emb(vec![0.98, 0.1, 0.05, 0.02]))
        .collect();

    let report = drift::detect(&baseline, &perturbed, &DriftConfig::default());
    assert!(!report.drift_detected);
    assert!(matches!(report.severity, DriftSeverity::None | DriftSeverity::Low));
}

// ─── Delta tracking ─────────────────────────────────────────────────

#[test]
fn delta_improvement_detected() {
    let bad = drift::DriftReport {
        mean_similarity: 0.6,
        min_similarity: 0.5,
        drift_detected: true,
        severity: DriftSeverity::High,
        sample_count: 20,
    };
    let good = drift::DriftReport {
        mean_similarity: 0.95,
        min_similarity: 0.9,
        drift_detected: false,
        severity: DriftSeverity::None,
        sample_count: 20,
    };

    let delta = drift::compute_delta(&bad, &good);
    assert!(delta.improving);
    assert!(delta.severity_changed);
    assert!(delta.similarity_change > 0.3);
}

#[test]
fn delta_degradation_detected() {
    let good = drift::DriftReport {
        mean_similarity: 0.95,
        min_similarity: 0.9,
        drift_detected: false,
        severity: DriftSeverity::None,
        sample_count: 20,
    };
    let bad = drift::DriftReport {
        mean_similarity: 0.6,
        min_similarity: 0.5,
        drift_detected: true,
        severity: DriftSeverity::High,
        sample_count: 20,
    };

    let delta = drift::compute_delta(&good, &bad);
    assert!(!delta.improving);
    assert!(delta.severity_changed);
    assert!(delta.similarity_change < -0.3);
}

// ─── CI gate simulation ─────────────────────────────────────────────

#[test]
fn ci_gate_passes_on_stable_model() {
    let baseline: Vec<Embedding> = (0..50)
        .map(|i| {
            let mut v = vec![0.0f32; 64];
            v[i % 64] = 1.0;
            make_emb(v)
        })
        .collect();

    // Same model → same embeddings
    let current = baseline.clone();

    let config = DriftConfig {
        alert_threshold: 0.85,
        window_size: 50,
    };

    let report = drift::detect(&baseline, &current, &config);

    // CI gate: similarity must be above threshold
    assert!(
        report.mean_similarity >= config.alert_threshold,
        "CI GATE FAILED: mean_similarity {:.4} < threshold {}",
        report.mean_similarity,
        config.alert_threshold
    );
}

#[test]
fn ci_gate_fails_on_degraded_model() {
    let baseline: Vec<Embedding> = (0..50)
        .map(|i| {
            let mut v = vec![0.0f32; 64];
            v[i % 64] = 1.0;
            make_emb(v)
        })
        .collect();

    // Degraded model: orthogonal embeddings
    let current: Vec<Embedding> = (0..50)
        .map(|i| {
            let mut v = vec![0.0f32; 64];
            v[(i + 32) % 64] = 1.0;
            make_emb(v)
        })
        .collect();

    let config = DriftConfig {
        alert_threshold: 0.85,
        window_size: 50,
    };

    let report = drift::detect(&baseline, &current, &config);
    assert!(report.drift_detected);
    assert!(report.mean_similarity < config.alert_threshold);
}

// ─── Configurable thresholds ────────────────────────────────────────

#[test]
fn custom_threshold_and_window() {
    let embs: Vec<Embedding> = (0..100)
        .map(|_| make_emb(vec![1.0, 0.0]))
        .collect();

    let config = DriftConfig {
        alert_threshold: 0.99,
        window_size: 10,
    };

    let report = drift::detect(&embs, &embs, &config);
    assert_eq!(report.sample_count, 10);
    assert!(!report.drift_detected);
}
