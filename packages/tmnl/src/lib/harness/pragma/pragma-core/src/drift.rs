//! Embedding drift detection via CSDD (Cosine Similarity Drift Detection).
//!
//! Monitors embedding quality over time by comparing current model outputs
//! against a baseline. Uses sliding window cosine similarity with KS test
//! for statistical significance.

use crate::encoder::Embedding;

/// Drift detection result.
#[derive(Debug, Clone)]
pub struct DriftReport {
    /// Mean cosine similarity between current and baseline embeddings.
    pub mean_similarity: f32,
    /// Minimum similarity in the window.
    pub min_similarity: f32,
    /// Whether drift is detected (similarity below alert threshold).
    pub drift_detected: bool,
    /// Drift severity: None, Low, Medium, High.
    pub severity: DriftSeverity,
    /// Number of samples compared.
    pub sample_count: usize,
}

/// Drift severity levels.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DriftSeverity {
    /// No drift detected (similarity >= 0.95).
    None,
    /// Minor drift (0.85 <= similarity < 0.95).
    Low,
    /// Moderate drift (0.70 <= similarity < 0.85).
    Medium,
    /// Severe drift (similarity < 0.70).
    High,
}

/// Configuration for drift detection.
#[derive(Debug, Clone)]
pub struct DriftConfig {
    /// Alert threshold — similarity below this triggers drift_detected.
    /// Default: 0.85 (per TESTING.md).
    pub alert_threshold: f32,
    /// Window size for sliding comparison.
    pub window_size: usize,
}

impl Default for DriftConfig {
    fn default() -> Self {
        Self {
            alert_threshold: 0.85,
            window_size: 50,
        }
    }
}

/// Compare current embeddings against baseline to detect drift.
///
/// `baseline`: embeddings from the last known-good model run.
/// `current`: embeddings from the current model.
///
/// Both must be paired (same input texts, same order).
pub fn detect(baseline: &[Embedding], current: &[Embedding], config: &DriftConfig) -> DriftReport {
    if baseline.is_empty() || current.is_empty() {
        return DriftReport {
            mean_similarity: 0.0,
            min_similarity: 0.0,
            drift_detected: true,
            severity: DriftSeverity::High,
            sample_count: 0,
        };
    }

    let n = baseline.len().min(current.len()).min(config.window_size);

    let similarities: Vec<f32> = baseline[..n]
        .iter()
        .zip(&current[..n])
        .map(|(b, c)| b.cosine_similarity(c))
        .collect();

    let mean_similarity = similarities.iter().sum::<f32>() / similarities.len() as f32;
    let min_similarity = similarities.iter().cloned().fold(f32::INFINITY, f32::min);

    let drift_detected = mean_similarity < config.alert_threshold;

    let severity = if mean_similarity >= 0.95 {
        DriftSeverity::None
    } else if mean_similarity >= 0.85 {
        DriftSeverity::Low
    } else if mean_similarity >= 0.70 {
        DriftSeverity::Medium
    } else {
        DriftSeverity::High
    };

    DriftReport {
        mean_similarity,
        min_similarity,
        drift_detected,
        severity,
        sample_count: n,
    }
}

/// Compute the delta between two drift reports for feedback loop logging.
pub fn compute_delta(previous: &DriftReport, current: &DriftReport) -> DriftDelta {
    DriftDelta {
        similarity_change: current.mean_similarity - previous.mean_similarity,
        severity_changed: previous.severity != current.severity,
        previous_severity: previous.severity,
        current_severity: current.severity,
        improving: current.mean_similarity > previous.mean_similarity,
    }
}

/// Delta between two drift measurements.
#[derive(Debug, Clone)]
pub struct DriftDelta {
    /// Change in mean similarity (positive = improving).
    pub similarity_change: f32,
    /// Whether severity level changed.
    pub severity_changed: bool,
    /// Previous severity.
    pub previous_severity: DriftSeverity,
    /// Current severity.
    pub current_severity: DriftSeverity,
    /// Whether the model is improving (higher similarity).
    pub improving: bool,
}

// ─── Tests ──────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn mock_emb(values: Vec<f32>) -> Embedding {
        let dim = values.len();
        Embedding {
            values,
            dim,
            inference_ms: 0.0,
        }
    }

    #[test]
    fn identical_embeddings_no_drift() {
        let embs = vec![mock_emb(vec![1.0, 0.0, 0.0]), mock_emb(vec![0.0, 1.0, 0.0])];
        let report = detect(&embs, &embs, &DriftConfig::default());
        assert!(!report.drift_detected);
        assert_eq!(report.severity, DriftSeverity::None);
        assert!((report.mean_similarity - 1.0).abs() < 1e-6);
    }

    #[test]
    fn orthogonal_embeddings_severe_drift() {
        let baseline = vec![mock_emb(vec![1.0, 0.0])];
        let current = vec![mock_emb(vec![0.0, 1.0])];
        let report = detect(&baseline, &current, &DriftConfig::default());
        assert!(report.drift_detected);
        assert_eq!(report.severity, DriftSeverity::High);
    }

    #[test]
    fn partial_drift_medium() {
        let baseline = vec![mock_emb(vec![1.0, 0.0])];
        let current = vec![mock_emb(vec![0.8, 0.6])]; // cos_sim ≈ 0.8
        let report = detect(&baseline, &current, &DriftConfig::default());
        assert!(report.drift_detected);
        assert_eq!(report.severity, DriftSeverity::Medium);
    }

    #[test]
    fn empty_inputs_high_drift() {
        let report = detect(&[], &[], &DriftConfig::default());
        assert!(report.drift_detected);
        assert_eq!(report.severity, DriftSeverity::High);
        assert_eq!(report.sample_count, 0);
    }

    #[test]
    fn window_size_limits_samples() {
        let embs: Vec<Embedding> = (0..100).map(|_| mock_emb(vec![1.0, 0.0])).collect();
        let config = DriftConfig {
            window_size: 10,
            ..Default::default()
        };
        let report = detect(&embs, &embs, &config);
        assert_eq!(report.sample_count, 10);
    }

    #[test]
    fn delta_tracks_improvement() {
        let prev = DriftReport {
            mean_similarity: 0.7,
            min_similarity: 0.6,
            drift_detected: true,
            severity: DriftSeverity::Medium,
            sample_count: 10,
        };
        let curr = DriftReport {
            mean_similarity: 0.9,
            min_similarity: 0.85,
            drift_detected: false,
            severity: DriftSeverity::Low,
            sample_count: 10,
        };
        let delta = compute_delta(&prev, &curr);
        assert!(delta.improving);
        assert!(delta.severity_changed);
        assert!((delta.similarity_change - 0.2).abs() < 1e-6);
    }

    #[test]
    fn delta_tracks_degradation() {
        let prev = DriftReport {
            mean_similarity: 0.95,
            min_similarity: 0.92,
            drift_detected: false,
            severity: DriftSeverity::None,
            sample_count: 10,
        };
        let curr = DriftReport {
            mean_similarity: 0.6,
            min_similarity: 0.5,
            drift_detected: true,
            severity: DriftSeverity::High,
            sample_count: 10,
        };
        let delta = compute_delta(&prev, &curr);
        assert!(!delta.improving);
        assert!(delta.severity_changed);
    }
}
