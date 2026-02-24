//! CUSUM (Cumulative Sum) change-point detection for risk trend monitoring.
//!
//! Implements tabular CUSUM (Page 1954) for detecting upward and downward
//! shifts in risk score time series. Used in differential-dataflow `reduce`
//! closures to maintain per-entity trend state.
//!
//! ARL performance (k=0.5sigma, h=5sigma):
//! - ARL0 (false alarm interval) ~= 465 samples
//! - ARL1 (detect 1-sigma shift) ~= 13 samples

// ---------------------------------------------------------------------------
// Trend direction
// ---------------------------------------------------------------------------

/// Direction of a detected risk trend change.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum TrendDirection {
    /// Risk score increasing above baseline.
    Rising,
    /// Risk score decreasing below baseline.
    Falling,
}

// ---------------------------------------------------------------------------
// CUSUM state
// ---------------------------------------------------------------------------

/// Tabular CUSUM state for one entity's risk score series.
///
/// Maintains separate upward and downward cumulative sums. When either
/// sum exceeds the decision threshold `h`, a change point is signaled
/// and the counter resets.
///
/// # Parameters
///
/// - `mu_0`: baseline mean (from Welford or sliding window).
/// - `sigma`: baseline standard deviation.
/// - `k_factor`: allowance factor (default 0.5 → k = 0.5 * sigma).
/// - `h_factor`: decision threshold factor (default 5.0 → h = 5.0 * sigma).
#[derive(Debug, Clone)]
pub struct CusumState {
    /// Upward cumulative sum (detects rising shift).
    pub s_plus: f64,
    /// Downward cumulative sum (detects falling shift).
    pub s_minus: f64,
    /// Baseline mean.
    pub mu_0: f64,
    /// Baseline standard deviation.
    pub sigma: f64,
    /// Allowance factor: k = k_factor * sigma.
    pub k_factor: f64,
    /// Decision threshold factor: h = h_factor * sigma.
    pub h_factor: f64,
    /// Number of samples processed.
    pub count: u64,
}

impl CusumState {
    /// Create a new CUSUM state with the given baseline parameters.
    pub fn new(mu_0: f64, sigma: f64) -> Self {
        Self {
            s_plus: 0.0,
            s_minus: 0.0,
            mu_0,
            sigma,
            k_factor: 0.5,
            h_factor: 5.0,
            count: 0,
        }
    }

    /// Create with custom allowance and threshold factors.
    pub fn with_factors(mu_0: f64, sigma: f64, k_factor: f64, h_factor: f64) -> Self {
        Self {
            s_plus: 0.0,
            s_minus: 0.0,
            mu_0,
            sigma,
            k_factor,
            h_factor,
            count: 0,
        }
    }

    /// The allowance parameter: k = k_factor * sigma.
    pub fn k(&self) -> f64 {
        self.k_factor * self.sigma
    }

    /// The decision threshold: h = h_factor * sigma.
    pub fn h(&self) -> f64 {
        self.h_factor * self.sigma
    }

    /// Process a new observation and check for a change point.
    ///
    /// Returns `Some(TrendDirection)` if a change point is detected,
    /// `None` otherwise. The CUSUM counter is reset after detection.
    pub fn update(&mut self, x: f64) -> Option<TrendDirection> {
        self.count += 1;
        let k = self.k();
        let h = self.h();

        // Guard: if sigma is zero, we can't detect anything.
        if self.sigma <= f64::EPSILON {
            return None;
        }

        self.s_plus = (self.s_plus + (x - self.mu_0 - k)).max(0.0);
        self.s_minus = (self.s_minus + (self.mu_0 - k - x)).max(0.0);

        if self.s_plus > h {
            self.s_plus = 0.0; // Reset after alarm.
            Some(TrendDirection::Rising)
        } else if self.s_minus > h {
            self.s_minus = 0.0; // Reset after alarm.
            Some(TrendDirection::Falling)
        } else {
            None
        }
    }

    /// Reset both cumulative sums without changing baseline parameters.
    pub fn reset(&mut self) {
        self.s_plus = 0.0;
        self.s_minus = 0.0;
        self.count = 0;
    }

    /// Update baseline parameters (e.g., from a Welford state update).
    pub fn update_baseline(&mut self, mu_0: f64, sigma: f64) {
        self.mu_0 = mu_0;
        self.sigma = sigma;
    }
}

// ---------------------------------------------------------------------------
// Welford online statistics (companion for CUSUM baseline)
// ---------------------------------------------------------------------------

/// Welford's online algorithm for computing running mean and variance.
///
/// Used to establish the baseline `mu_0` and `sigma` for CUSUM.
/// Numerically stable single-pass algorithm (Welford 1962).
#[derive(Debug, Clone)]
pub struct WelfordState {
    /// Number of observations.
    pub count: u64,
    /// Running mean.
    pub mean: f64,
    /// Sum of squared deviations from the current mean (M2).
    pub m2: f64,
}

impl WelfordState {
    /// Create a new empty state.
    pub fn new() -> Self {
        Self {
            count: 0,
            mean: 0.0,
            m2: 0.0,
        }
    }

    /// Update with a new observation.
    pub fn update(&mut self, x: f64) {
        self.count += 1;
        let delta = x - self.mean;
        self.mean += delta / self.count as f64;
        let delta2 = x - self.mean;
        self.m2 += delta * delta2;
    }

    /// Sample variance (Bessel-corrected: N-1 denominator).
    pub fn variance(&self) -> f64 {
        if self.count < 2 {
            return 0.0;
        }
        self.m2 / (self.count - 1) as f64
    }

    /// Standard deviation.
    pub fn std_dev(&self) -> f64 {
        self.variance().sqrt()
    }

    /// Create a CUSUM state initialized from this Welford state.
    pub fn to_cusum(&self) -> CusumState {
        CusumState::new(self.mean, self.std_dev())
    }
}

impl Default for WelfordState {
    fn default() -> Self {
        Self::new()
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    // -- WelfordState --

    #[test]
    fn welford_empty() {
        let w = WelfordState::new();
        assert_eq!(w.count, 0);
        assert!((w.mean - 0.0).abs() < 1e-15);
        assert!((w.variance() - 0.0).abs() < 1e-15);
    }

    #[test]
    fn welford_single_value() {
        let mut w = WelfordState::new();
        w.update(5.0);
        assert_eq!(w.count, 1);
        assert!((w.mean - 5.0).abs() < 1e-10);
        assert!((w.variance() - 0.0).abs() < 1e-10); // N<2 → 0
    }

    #[test]
    fn welford_known_sequence() {
        let mut w = WelfordState::new();
        let values = [2.0, 4.0, 4.0, 4.0, 5.0, 5.0, 7.0, 9.0];
        for &v in &values {
            w.update(v);
        }
        assert_eq!(w.count, 8);
        assert!((w.mean - 5.0).abs() < 1e-10);
        // Population variance = 4.0, sample variance = 4.571...
        assert!((w.variance() - 32.0 / 7.0).abs() < 1e-10);
    }

    #[test]
    fn welford_std_dev() {
        let mut w = WelfordState::new();
        for &v in &[10.0, 12.0, 23.0, 23.0, 16.0, 23.0, 21.0, 16.0] {
            w.update(v);
        }
        let expected_var = w.m2 / 7.0;
        assert!((w.std_dev() - expected_var.sqrt()).abs() < 1e-10);
    }

    // -- CusumState --

    #[test]
    fn cusum_new_defaults() {
        let c = CusumState::new(0.5, 0.1);
        assert!((c.mu_0 - 0.5).abs() < 1e-15);
        assert!((c.sigma - 0.1).abs() < 1e-15);
        assert!((c.k_factor - 0.5).abs() < 1e-15);
        assert!((c.h_factor - 5.0).abs() < 1e-15);
        assert!((c.k() - 0.05).abs() < 1e-15);
        assert!((c.h() - 0.5).abs() < 1e-15);
    }

    #[test]
    fn cusum_no_shift_no_alarm() {
        // Feed baseline-consistent values: mu_0 = 0.5, sigma = 0.1.
        let mut c = CusumState::new(0.5, 0.1);
        for _ in 0..100 {
            assert!(c.update(0.5).is_none(), "No shift should not trigger alarm");
        }
    }

    #[test]
    fn cusum_detects_upward_shift() {
        // Baseline: mu_0 = 0.5, sigma = 0.1.
        // k = 0.05, h = 0.5.
        // Feed consistently high values: 0.7 (shift of +0.2 = 2 sigma).
        let mut c = CusumState::new(0.5, 0.1);
        let mut detected = false;
        for i in 0..50 {
            if let Some(dir) = c.update(0.7) {
                assert_eq!(dir, TrendDirection::Rising);
                detected = true;
                // Should detect within ~4 samples: each step adds 0.7-0.5-0.05=0.15,
                // accumulates to 0.5+ after ~4 steps.
                assert!(i < 10, "Should detect 2-sigma shift quickly, took {i} samples");
                break;
            }
        }
        assert!(detected, "Should have detected upward shift");
    }

    #[test]
    fn cusum_detects_downward_shift() {
        let mut c = CusumState::new(0.5, 0.1);
        let mut detected = false;
        for i in 0..50 {
            if let Some(dir) = c.update(0.3) {
                assert_eq!(dir, TrendDirection::Falling);
                detected = true;
                assert!(i < 10, "Should detect 2-sigma drop quickly, took {i} samples");
                break;
            }
        }
        assert!(detected, "Should have detected downward shift");
    }

    #[test]
    fn cusum_resets_after_detection() {
        let mut c = CusumState::new(0.5, 0.1);
        // Trigger an alarm.
        for _ in 0..20 {
            if c.update(0.7).is_some() {
                break;
            }
        }
        // After reset, s_plus should be 0.
        assert!((c.s_plus - 0.0).abs() < 1e-10, "s_plus should reset after alarm");
    }

    #[test]
    fn cusum_custom_factors() {
        // More sensitive: k_factor=0.25, h_factor=3.0.
        let mut c = CusumState::with_factors(0.5, 0.1, 0.25, 3.0);
        assert!((c.k() - 0.025).abs() < 1e-15);
        assert!((c.h() - 0.3).abs() < 1e-15);
        // Should detect a 1-sigma shift faster than default.
        let mut detected = false;
        for i in 0..30 {
            if let Some(dir) = c.update(0.6) { // 1-sigma shift
                assert_eq!(dir, TrendDirection::Rising);
                detected = true;
                assert!(i < 10);
                break;
            }
        }
        assert!(detected, "Sensitive CUSUM should detect 1-sigma shift");
    }

    #[test]
    fn cusum_zero_sigma_no_panic() {
        let mut c = CusumState::new(0.5, 0.0);
        // Should not panic or produce NaN.
        let result = c.update(0.7);
        assert!(result.is_none(), "Zero sigma should not trigger alarm");
    }

    #[test]
    fn cusum_update_baseline() {
        let mut c = CusumState::new(0.5, 0.1);
        c.update_baseline(0.7, 0.15);
        assert!((c.mu_0 - 0.7).abs() < 1e-15);
        assert!((c.sigma - 0.15).abs() < 1e-15);
    }

    #[test]
    fn cusum_reset() {
        let mut c = CusumState::new(0.5, 0.1);
        c.update(0.7);
        c.update(0.7);
        assert!(c.s_plus > 0.0);
        c.reset();
        assert!((c.s_plus - 0.0).abs() < 1e-15);
        assert!((c.s_minus - 0.0).abs() < 1e-15);
        assert_eq!(c.count, 0);
    }

    // -- Welford → CUSUM integration --

    #[test]
    fn welford_to_cusum() {
        let mut w = WelfordState::new();
        // Build a baseline from 100 samples of N(0.5, 0.1^2).
        // Using deterministic values around 0.5.
        for i in 0..100 {
            let x = 0.5 + 0.1 * ((i as f64 * 0.1).sin());
            w.update(x);
        }
        let c = w.to_cusum();
        // Mean should be approximately 0.5.
        assert!((c.mu_0 - 0.5).abs() < 0.1, "Baseline mean should be ~0.5, got {}", c.mu_0);
        assert!(c.sigma > 0.0, "Sigma should be positive");
    }
}
