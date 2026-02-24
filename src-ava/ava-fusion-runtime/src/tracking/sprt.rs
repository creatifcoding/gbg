//! Sequential Probability Ratio Test (SPRT) for track confirmation.
//!
//! Replaces M-of-N heuristics with a statistically rigorous track
//! confirmation method (Wald 1947).
//!
//! Consumes `SprtConfig` from `ava_fusion::track` for the error rate
//! parameters (alpha, beta).
//!
//! The log-likelihood ratio accumulates evidence for/against track validity:
//! - Associated measurement: positive evidence (Gaussian likelihood vs clutter)
//! - Missed detection: negative evidence (ln(1 - P_D))

use ava_fusion::track::SprtConfig;

// ---------------------------------------------------------------------------
// SPRT decision
// ---------------------------------------------------------------------------

/// Decision from the SPRT test.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum SprtDecision {
    /// Continue collecting evidence (no decision yet).
    Continue,
    /// Track confirmed (accept H1: real target).
    Confirm,
    /// Track rejected (accept H0: false alarm).
    Reject,
}

// ---------------------------------------------------------------------------
// SPRT tracker state
// ---------------------------------------------------------------------------

/// SPRT state for one tentative track.
///
/// Maintains a cumulative log-likelihood ratio and makes confirm/reject
/// decisions based on thresholds derived from `SprtConfig`.
#[derive(Debug, Clone)]
pub struct SprtTracker {
    /// Cumulative log-likelihood ratio.
    pub log_ratio: f64,
    /// Configuration (alpha, beta).
    pub config: SprtConfig,
    /// Confirmation threshold A = ln((1-beta)/alpha).
    pub threshold_confirm: f64,
    /// Rejection threshold B = ln(beta/(1-alpha)).
    pub threshold_reject: f64,
    /// Probability of detection (domain-specific, e.g., 0.8 for maritime radar).
    pub p_d: f64,
    /// Clutter density (false alarms per unit volume in measurement space).
    pub clutter_density: f64,
    /// Number of scans processed.
    pub scan_count: u64,
}

impl SprtTracker {
    /// Create a new SPRT tracker with the given configuration.
    ///
    /// - `config`: error rate parameters (alpha, beta).
    /// - `p_d`: probability of detection.
    /// - `clutter_density`: expected false alarm density.
    pub fn new(config: SprtConfig, p_d: f64, clutter_density: f64) -> Self {
        let threshold_confirm = config.confirm_threshold();
        let threshold_reject = config.reject_threshold();
        Self {
            log_ratio: 0.0,
            config,
            threshold_confirm,
            threshold_reject,
            p_d,
            clutter_density,
            scan_count: 0,
        }
    }

    /// Process a scan with an associated measurement.
    ///
    /// `measurement_likelihood`: the Gaussian likelihood of the measurement
    /// given the track's predicted state (N(z; z_pred, S)).
    pub fn update_with_measurement(&mut self, measurement_likelihood: f64) -> SprtDecision {
        self.scan_count += 1;

        // Log-likelihood ratio increment for an associated measurement:
        // log(P_D * L(z) / clutter_density)
        let clutter = self.clutter_density.max(1e-30);
        let ll = measurement_likelihood.max(1e-30);
        let increment = (self.p_d * ll / clutter).ln();
        self.log_ratio += increment;

        self.decide()
    }

    /// Process a scan with no associated measurement (missed detection).
    pub fn update_missed(&mut self) -> SprtDecision {
        self.scan_count += 1;

        // Log-likelihood ratio increment for missed detection:
        // log(1 - P_D) — always negative, pushes toward rejection.
        let increment = (1.0 - self.p_d).max(1e-30).ln();
        self.log_ratio += increment;

        self.decide()
    }

    /// Make a decision based on current log-likelihood ratio.
    fn decide(&self) -> SprtDecision {
        if self.log_ratio >= self.threshold_confirm {
            SprtDecision::Confirm
        } else if self.log_ratio <= self.threshold_reject {
            SprtDecision::Reject
        } else {
            SprtDecision::Continue
        }
    }

    /// Reset the tracker for a new tentative track.
    pub fn reset(&mut self) {
        self.log_ratio = 0.0;
        self.scan_count = 0;
    }

    /// Current decision without processing a new scan.
    pub fn current_decision(&self) -> SprtDecision {
        self.decide()
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    fn maritime_config() -> SprtConfig {
        SprtConfig {
            alpha: 0.01,
            beta: 0.05,
        }
    }

    fn aviation_config() -> SprtConfig {
        SprtConfig {
            alpha: 0.05,
            beta: 0.10,
        }
    }

    // -- SprtTracker creation --

    #[test]
    fn sprt_new_initial_state() {
        let tracker = SprtTracker::new(maritime_config(), 0.8, 1e-6);
        assert!((tracker.log_ratio - 0.0).abs() < 1e-15);
        assert_eq!(tracker.scan_count, 0);
        assert_eq!(tracker.current_decision(), SprtDecision::Continue);
    }

    #[test]
    fn sprt_thresholds_maritime() {
        let tracker = SprtTracker::new(maritime_config(), 0.8, 1e-6);
        // A = ln((1-0.05)/0.01) = ln(95) ≈ 4.554
        assert!((tracker.threshold_confirm - (95.0_f64).ln()).abs() < 1e-6);
        // B = ln(0.05/(1-0.01)) = ln(0.0505...) ≈ -2.986
        assert!((tracker.threshold_reject - (0.05 / 0.99_f64).ln()).abs() < 1e-6);
    }

    #[test]
    fn sprt_thresholds_aviation() {
        let tracker = SprtTracker::new(aviation_config(), 0.9, 1e-5);
        // A = ln((1-0.10)/0.05) = ln(18) ≈ 2.890
        assert!((tracker.threshold_confirm - (18.0_f64).ln()).abs() < 1e-6);
        // B = ln(0.10/(1-0.05)) = ln(0.10526...) ≈ -2.251
        assert!((tracker.threshold_reject - (0.10 / 0.95_f64).ln()).abs() < 1e-6);
    }

    // -- Measurement updates --

    #[test]
    fn sprt_strong_measurements_confirm() {
        let mut tracker = SprtTracker::new(maritime_config(), 0.8, 1e-6);
        // Strong measurements: likelihood >> clutter density.
        let mut confirmed = false;
        for i in 0..20 {
            let decision = tracker.update_with_measurement(1e-3); // Much larger than clutter 1e-6.
            if decision == SprtDecision::Confirm {
                confirmed = true;
                assert!(i < 5, "Strong measurements should confirm quickly, took {} scans", i + 1);
                break;
            }
        }
        assert!(confirmed, "Strong measurements should confirm the track");
    }

    #[test]
    fn sprt_missed_detections_reject() {
        let mut tracker = SprtTracker::new(maritime_config(), 0.8, 1e-6);
        // Only missed detections → should reject.
        let mut rejected = false;
        for i in 0..50 {
            let decision = tracker.update_missed();
            if decision == SprtDecision::Reject {
                rejected = true;
                // With P_D=0.8, each miss contributes ln(0.2)≈-1.609.
                // Reject threshold ≈ -2.986, so ~2 misses needed.
                assert!(i < 10, "Missed detections should reject quickly, took {} scans", i + 1);
                break;
            }
        }
        assert!(rejected, "All-miss sequence should reject the track");
    }

    #[test]
    fn sprt_mixed_evidence_continues() {
        let mut tracker = SprtTracker::new(maritime_config(), 0.8, 1e-6);
        // Mix of hits and misses — ratio should hover near 0.
        // Feed exactly balanced evidence.
        tracker.update_with_measurement(1e-4); // Moderate positive.
        tracker.update_missed();                // Negative.
        assert_eq!(
            tracker.current_decision(),
            SprtDecision::Continue,
            "Mixed evidence should not decide"
        );
    }

    // -- Reset --

    #[test]
    fn sprt_reset_clears_state() {
        let mut tracker = SprtTracker::new(maritime_config(), 0.8, 1e-6);
        tracker.update_with_measurement(1e-3);
        tracker.update_with_measurement(1e-3);
        assert!(tracker.log_ratio > 0.0);
        assert!(tracker.scan_count > 0);
        tracker.reset();
        assert!((tracker.log_ratio - 0.0).abs() < 1e-15);
        assert_eq!(tracker.scan_count, 0);
    }

    // -- Log-ratio direction --

    #[test]
    fn sprt_measurement_increases_ratio() {
        let mut tracker = SprtTracker::new(maritime_config(), 0.8, 1e-6);
        let before = tracker.log_ratio;
        tracker.update_with_measurement(1e-3); // likelihood > clutter.
        assert!(tracker.log_ratio > before, "Good measurement should increase log ratio");
    }

    #[test]
    fn sprt_miss_decreases_ratio() {
        let mut tracker = SprtTracker::new(maritime_config(), 0.8, 1e-6);
        let before = tracker.log_ratio;
        tracker.update_missed();
        assert!(tracker.log_ratio < before, "Missed detection should decrease log ratio");
    }

    // -- Edge cases --

    #[test]
    fn sprt_very_low_pd() {
        // P_D = 0.1: misses are almost expected, so each miss is weak evidence.
        let mut tracker = SprtTracker::new(maritime_config(), 0.1, 1e-6);
        tracker.update_missed();
        // ln(1-0.1) = ln(0.9) ≈ -0.105 — weak negative evidence.
        assert!(tracker.log_ratio > -0.2, "Low P_D miss should be weak, got {}", tracker.log_ratio);
    }

    #[test]
    fn sprt_scan_count_increments() {
        let mut tracker = SprtTracker::new(maritime_config(), 0.8, 1e-6);
        tracker.update_with_measurement(1e-4);
        tracker.update_missed();
        tracker.update_with_measurement(1e-4);
        assert_eq!(tracker.scan_count, 3);
    }
}
