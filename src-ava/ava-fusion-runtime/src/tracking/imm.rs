//! Interacting Multiple Model (IMM) filter.
//!
//! Wraps three EKF instances (CV, CT, CTRV) and combines their estimates
//! using model probability mixing. The four-step IMM cycle:
//!
//! 1. Compute mixing probabilities from transition matrix
//! 2. Compute mixed initial conditions for each model
//! 3. Run model-conditioned EKF predict + update
//! 4. Update model probabilities from measurement likelihoods
//!
//! Memory: ~93 f64 values per track (744 bytes) for 3 models padded to dim 5.

use super::ekf::{CovMatrix, EkfState, MotionModel, StateVec};
use nalgebra::SMatrix;

/// Number of models in the IMM filter.
pub const NUM_MODELS: usize = 3;

/// Transition probability matrix type.
pub type TransitionMatrix = SMatrix<f64, NUM_MODELS, NUM_MODELS>;

// ---------------------------------------------------------------------------
// IMM state
// ---------------------------------------------------------------------------

/// Interacting Multiple Model filter state.
#[derive(Debug, Clone)]
pub struct ImmState {
    /// Individual EKF states for each model.
    pub filters: [EkfState; NUM_MODELS],
    /// Model probabilities (sum to 1.0).
    pub mu: [f64; NUM_MODELS],
    /// Markov transition matrix: pi[i][j] = P(model j | model i).
    pub pi: TransitionMatrix,
}

impl ImmState {
    /// Create a new IMM state with all models at the same initial position.
    ///
    /// Default transition matrix: high self-transition (0.95), equal switching.
    pub fn new(x0: f64, y0: f64, sigma_a: f64, sigma_z: f64) -> Self {
        let filters = [
            EkfState::new(MotionModel::Cv, x0, y0, sigma_a, sigma_z),
            EkfState::new(MotionModel::Ct, x0, y0, sigma_a, sigma_z),
            EkfState::new(MotionModel::Ctrv, x0, y0, sigma_a, sigma_z),
        ];

        // Default: high self-transition probability.
        #[rustfmt::skip]
        let pi = TransitionMatrix::new(
            0.95,  0.025, 0.025,
            0.025, 0.95,  0.025,
            0.025, 0.025, 0.95,
        );

        Self {
            filters,
            mu: [1.0 / 3.0; NUM_MODELS],
            pi,
        }
    }

    /// Create with custom transition matrix and initial model probabilities.
    pub fn with_params(
        filters: [EkfState; NUM_MODELS],
        mu: [f64; NUM_MODELS],
        pi: TransitionMatrix,
    ) -> Self {
        Self { filters, mu, pi }
    }

    /// Run one complete IMM cycle: predict + update with measurement.
    pub fn step(&mut self, dt: f64, z_x: f64, z_y: f64) {
        // Step 1: Compute mixing probabilities.
        let mu_mix = self.compute_mixing_probabilities();

        // Step 2: Compute mixed initial conditions.
        self.mix_initial_conditions(&mu_mix);

        // Step 3: Model-conditioned filtering.
        for f in &mut self.filters {
            f.predict(dt);
            f.update(z_x, z_y);
        }

        // Step 4: Update model probabilities from likelihoods.
        self.update_model_probabilities(z_x, z_y);
    }

    /// Predict-only step (no measurement available — coast).
    pub fn predict(&mut self, dt: f64) {
        let mu_mix = self.compute_mixing_probabilities();
        self.mix_initial_conditions(&mu_mix);
        for f in &mut self.filters {
            f.predict(dt);
        }
    }

    /// Combined state estimate (weighted by model probabilities).
    pub fn combined_state(&self) -> StateVec {
        let mut x = StateVec::zeros();
        for (i, f) in self.filters.iter().enumerate() {
            x += self.mu[i] * f.x;
        }
        x
    }

    /// Combined covariance (weighted, with cross-term).
    pub fn combined_covariance(&self) -> CovMatrix {
        let x_combined = self.combined_state();
        let mut p = CovMatrix::zeros();
        for (i, f) in self.filters.iter().enumerate() {
            let dx = f.x - x_combined;
            p += self.mu[i] * (f.p + dx * dx.transpose());
        }
        p
    }

    /// Index of the most likely model.
    pub fn dominant_model(&self) -> usize {
        self.mu
            .iter()
            .enumerate()
            .max_by(|(_, a), (_, b)| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal))
            .map(|(i, _)| i)
            .unwrap_or(0)
    }

    /// Model probability for a specific model index.
    pub fn model_probability(&self, idx: usize) -> f64 {
        self.mu.get(idx).copied().unwrap_or(0.0)
    }

    // -----------------------------------------------------------------------
    // Step 1: Mixing probabilities
    // -----------------------------------------------------------------------

    fn compute_mixing_probabilities(&self) -> [[f64; NUM_MODELS]; NUM_MODELS] {
        let mut mu_mix = [[0.0; NUM_MODELS]; NUM_MODELS];
        let mut c = [0.0; NUM_MODELS];

        // c_j = sum_i pi[i][j] * mu[i]
        for j in 0..NUM_MODELS {
            for i in 0..NUM_MODELS {
                c[j] += self.pi[(i, j)] * self.mu[i];
            }
        }

        // mu_{i|j} = pi[i][j] * mu[i] / c_j
        for j in 0..NUM_MODELS {
            if c[j] > 1e-15 {
                for i in 0..NUM_MODELS {
                    mu_mix[i][j] = self.pi[(i, j)] * self.mu[i] / c[j];
                }
            } else {
                // Fallback: equal mixing if normalizer is zero.
                for i in 0..NUM_MODELS {
                    mu_mix[i][j] = 1.0 / NUM_MODELS as f64;
                }
            }
        }

        mu_mix
    }

    // -----------------------------------------------------------------------
    // Step 2: Mixed initial conditions
    // -----------------------------------------------------------------------

    fn mix_initial_conditions(&mut self, mu_mix: &[[f64; NUM_MODELS]; NUM_MODELS]) {
        // Compute mixed states and covariances.
        let mut mixed_x = [StateVec::zeros(); NUM_MODELS];
        let mut mixed_p = [CovMatrix::zeros(); NUM_MODELS];

        for j in 0..NUM_MODELS {
            // Mixed state: x0_j = sum_i mu_{i|j} * x_i
            for i in 0..NUM_MODELS {
                mixed_x[j] += mu_mix[i][j] * self.filters[i].x;
            }
            // Mixed covariance: P0_j = sum_i mu_{i|j} * [P_i + (x_i - x0_j)(x_i - x0_j)^T]
            for i in 0..NUM_MODELS {
                let dx = self.filters[i].x - mixed_x[j];
                mixed_p[j] += mu_mix[i][j] * (self.filters[i].p + dx * dx.transpose());
            }
        }

        // Apply mixed initial conditions.
        for j in 0..NUM_MODELS {
            self.filters[j].x = mixed_x[j];
            self.filters[j].p = mixed_p[j];
        }
    }

    // -----------------------------------------------------------------------
    // Step 4: Model probability update
    // -----------------------------------------------------------------------

    fn update_model_probabilities(&mut self, z_x: f64, z_y: f64) {
        // Compute c_j (predicted model probabilities).
        let mut c = [0.0; NUM_MODELS];
        for j in 0..NUM_MODELS {
            for i in 0..NUM_MODELS {
                c[j] += self.pi[(i, j)] * self.mu[i];
            }
        }

        // Compute Gaussian likelihood for each model.
        let mut likelihoods = [0.0; NUM_MODELS];
        for (j, f) in self.filters.iter().enumerate() {
            let (y, s) = f.innovation(z_x, z_y);
            if let Some(s_inv) = s.try_inverse() {
                let det = s.determinant();
                if det > 1e-30 {
                    let nis = (y.transpose() * s_inv * y)[(0, 0)];
                    // N(y; 0, S) = (2π)^(-d/2) * |S|^(-1/2) * exp(-0.5 * y^T S^-1 y)
                    likelihoods[j] = (-0.5 * nis).exp() / (2.0 * std::f64::consts::PI * det.sqrt());
                }
            }
        }

        // Update: mu_j(k) = L_j * c_j / sum(L_i * c_i)
        let mut numerators = [0.0; NUM_MODELS];
        let mut total = 0.0;
        for j in 0..NUM_MODELS {
            numerators[j] = likelihoods[j] * c[j];
            total += numerators[j];
        }

        if total > 1e-30 {
            for j in 0..NUM_MODELS {
                self.mu[j] = numerators[j] / total;
            }
        }
        // If total is zero, keep previous probabilities.
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn imm_creation_equal_probabilities() {
        let imm = ImmState::new(0.0, 0.0, 1.0, 10.0);
        for &mu in &imm.mu {
            assert!((mu - 1.0 / 3.0).abs() < 1e-10);
        }
    }

    #[test]
    fn imm_model_probabilities_sum_to_one() {
        let mut imm = ImmState::new(0.0, 0.0, 1.0, 10.0);
        // Set some initial velocity.
        for f in &mut imm.filters {
            f.x[2] = 10.0;
        }
        // Run a few steps.
        for i in 0..10 {
            imm.step(1.0, 10.0 * (i as f64 + 1.0), 0.0);
            let sum: f64 = imm.mu.iter().sum();
            assert!(
                (sum - 1.0).abs() < 1e-6,
                "Model probabilities should sum to 1.0, got {sum} at step {i}"
            );
        }
    }

    #[test]
    fn imm_straight_line_favors_cv() {
        let mut imm = ImmState::new(0.0, 0.0, 1.0, 10.0);
        for f in &mut imm.filters {
            f.x[2] = 10.0; // vx = 10
        }
        // Feed pure straight-line measurements.
        for i in 0..30 {
            let x = 10.0 * (i as f64 + 1.0);
            imm.step(1.0, x, 0.0);
        }
        // CV model should have highest probability.
        assert!(
            imm.mu[0] > imm.mu[1] && imm.mu[0] > imm.mu[2],
            "CV should be dominant for straight line: mu={:?}",
            imm.mu
        );
    }

    #[test]
    fn imm_combined_state_is_weighted() {
        let imm = ImmState::new(0.0, 0.0, 1.0, 10.0);
        let combined = imm.combined_state();
        // With equal probabilities and same initial state, combined = initial.
        assert!((combined[0] - 0.0).abs() < 1e-10);
        assert!((combined[1] - 0.0).abs() < 1e-10);
    }

    #[test]
    fn imm_combined_covariance_positive_diagonal() {
        let mut imm = ImmState::new(100.0, 200.0, 1.0, 10.0);
        imm.step(1.0, 105.0, 202.0);
        let p = imm.combined_covariance();
        for d in 0..crate::tracking::ekf::MAX_DIM {
            assert!(p[(d, d)] >= 0.0, "P[{d},{d}] = {} should be non-negative", p[(d, d)]);
        }
    }

    #[test]
    fn imm_dominant_model() {
        let mut imm = ImmState::new(0.0, 0.0, 1.0, 10.0);
        imm.mu = [0.1, 0.7, 0.2];
        assert_eq!(imm.dominant_model(), 1);
    }

    #[test]
    fn imm_predict_only_coast() {
        let mut imm = ImmState::new(0.0, 0.0, 1.0, 10.0);
        for f in &mut imm.filters {
            f.x[2] = 10.0;
        }
        imm.predict(1.0);
        // Position should advance.
        let combined = imm.combined_state();
        assert!(combined[0] > 5.0, "Should have moved after prediction");
    }

    #[test]
    fn imm_transition_matrix_rows_sum_to_one() {
        let imm = ImmState::new(0.0, 0.0, 1.0, 10.0);
        for i in 0..NUM_MODELS {
            let sum: f64 = (0..NUM_MODELS).map(|j| imm.pi[(i, j)]).sum();
            assert!(
                (sum - 1.0).abs() < 1e-10,
                "Row {i} should sum to 1.0, got {sum}"
            );
        }
    }
}
