//! Extended Kalman Filter with three motion models.
//!
//! Motion models:
//! - **CV** (Constant Velocity): Linear 4-state `[x, y, vx, vy]`
//! - **CT** (Coordinated Turn): Nonlinear 5-state `[x, y, vx, vy, omega]`
//! - **CTRV** (Constant Turn Rate & Velocity): Nonlinear 5-state `[x, y, v, theta, omega]`
//!
//! Uses Joseph-form covariance update for numerical stability.
//! All matrices use nalgebra compile-time dimensions.

use nalgebra::{SMatrix, SVector};

/// Maximum state dimension across all models.
pub const MAX_DIM: usize = 5;

/// State vector type (5-dimensional to accommodate all models).
pub type StateVec = SVector<f64, MAX_DIM>;
/// Covariance matrix type (5x5).
pub type CovMatrix = SMatrix<f64, MAX_DIM, MAX_DIM>;

// ---------------------------------------------------------------------------
// Motion model enum
// ---------------------------------------------------------------------------

/// Motion model for the EKF.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum MotionModel {
    /// Constant Velocity: 4 active states `[x, y, vx, vy, 0]`.
    Cv,
    /// Coordinated Turn: 5 states `[x, y, vx, vy, omega]`.
    Ct,
    /// Constant Turn Rate & Velocity: 5 states `[x, y, v, theta, omega]`.
    Ctrv,
}

impl MotionModel {
    /// Number of active state dimensions for this model.
    pub fn dim(&self) -> usize {
        match self {
            MotionModel::Cv => 4,
            MotionModel::Ct | MotionModel::Ctrv => 5,
        }
    }
}

// ---------------------------------------------------------------------------
// EKF state
// ---------------------------------------------------------------------------

/// Extended Kalman Filter state for one tracked entity.
#[derive(Debug, Clone)]
pub struct EkfState {
    /// State estimate.
    pub x: StateVec,
    /// Error covariance.
    pub p: CovMatrix,
    /// Motion model.
    pub model: MotionModel,
    /// Process noise acceleration standard deviation (m/s^2).
    pub sigma_a: f64,
    /// Measurement noise standard deviation for position (m).
    pub sigma_z: f64,
}

impl EkfState {
    /// Create a new EKF state with initial position and default covariance.
    pub fn new(model: MotionModel, x0: f64, y0: f64, sigma_a: f64, sigma_z: f64) -> Self {
        let mut x = StateVec::zeros();
        x[0] = x0;
        x[1] = y0;

        // Initial covariance: large uncertainty in velocity/turn rate.
        let mut p = CovMatrix::zeros();
        p[(0, 0)] = sigma_z * sigma_z;     // position x
        p[(1, 1)] = sigma_z * sigma_z;     // position y
        p[(2, 2)] = 100.0;                 // velocity (large initial uncertainty)
        p[(3, 3)] = 100.0;                 // velocity/theta
        if model.dim() == 5 {
            p[(4, 4)] = 1.0;               // omega (moderate uncertainty)
        }

        Self { x, p, model, sigma_a, sigma_z }
    }

    /// Create with a full initial state vector.
    pub fn with_state(
        model: MotionModel,
        x: StateVec,
        p: CovMatrix,
        sigma_a: f64,
        sigma_z: f64,
    ) -> Self {
        Self { x, p, model, sigma_a, sigma_z }
    }

    /// Predict the state forward by `dt` seconds.
    pub fn predict(&mut self, dt: f64) {
        if dt <= 0.0 {
            return;
        }
        match self.model {
            MotionModel::Cv => self.predict_cv(dt),
            MotionModel::Ct => self.predict_ct(dt),
            MotionModel::Ctrv => self.predict_ctrv(dt),
        }
    }

    /// Update the state with a position measurement `[z_x, z_y]`.
    ///
    /// Uses Joseph-form covariance update for numerical stability:
    /// `P = (I - K*H) * P * (I - K*H)^T + K * R * K^T`
    pub fn update(&mut self, z_x: f64, z_y: f64) {
        // Measurement model: H extracts position [x, y].
        let mut h = SMatrix::<f64, 2, MAX_DIM>::zeros();
        h[(0, 0)] = 1.0;
        h[(1, 1)] = 1.0;

        // Innovation.
        let z = SVector::<f64, 2>::new(z_x, z_y);
        let z_pred = h * self.x;
        let y = z - z_pred;

        // Measurement noise.
        let r = SMatrix::<f64, 2, 2>::new(
            self.sigma_z * self.sigma_z, 0.0,
            0.0, self.sigma_z * self.sigma_z,
        );

        // Innovation covariance: S = H * P * H^T + R.
        let s = h * self.p * h.transpose() + r;

        // Kalman gain: K = P * H^T * S^(-1).
        let s_inv = match s.try_inverse() {
            Some(inv) => inv,
            None => return, // Singular S — skip update.
        };
        let k = self.p * h.transpose() * s_inv;

        // State update.
        self.x += k * y;

        // Joseph-form covariance update (numerically stable).
        let i = CovMatrix::identity();
        let i_kh = i - k * h;
        self.p = i_kh * self.p * i_kh.transpose() + k * r * k.transpose();
    }

    /// Innovation (measurement residual) for a position measurement.
    ///
    /// Returns `(innovation_vector, innovation_covariance)`.
    pub fn innovation(&self, z_x: f64, z_y: f64) -> (SVector<f64, 2>, SMatrix<f64, 2, 2>) {
        let mut h = SMatrix::<f64, 2, MAX_DIM>::zeros();
        h[(0, 0)] = 1.0;
        h[(1, 1)] = 1.0;

        let z = SVector::<f64, 2>::new(z_x, z_y);
        let z_pred = h * self.x;
        let y = z - z_pred;

        let r = SMatrix::<f64, 2, 2>::new(
            self.sigma_z * self.sigma_z, 0.0,
            0.0, self.sigma_z * self.sigma_z,
        );
        let s = h * self.p * h.transpose() + r;

        (y, s)
    }

    /// Normalized innovation squared (NIS) for gating.
    ///
    /// `NIS = y^T * S^(-1) * y`
    /// Under H0, NIS ~ Chi-squared(2).
    pub fn nis(&self, z_x: f64, z_y: f64) -> f64 {
        let (y, s) = self.innovation(z_x, z_y);
        match s.try_inverse() {
            Some(s_inv) => (y.transpose() * s_inv * y)[(0, 0)],
            None => f64::INFINITY,
        }
    }

    /// Position uncertainty (sqrt of trace of position covariance block).
    pub fn position_uncertainty(&self) -> f64 {
        (self.p[(0, 0)] + self.p[(1, 1)]).sqrt()
    }

    // -----------------------------------------------------------------------
    // CV prediction
    // -----------------------------------------------------------------------

    fn predict_cv(&mut self, dt: f64) {
        // F = | 1  0  dt  0  0 |
        //     | 0  1  0   dt 0 |
        //     | 0  0  1   0  0 |
        //     | 0  0  0   1  0 |
        //     | 0  0  0   0  0 |  (unused 5th dim)
        let mut f = CovMatrix::identity();
        f[(0, 2)] = dt;
        f[(1, 3)] = dt;
        // Zero out unused 5th row/col for CV.
        f[(4, 4)] = 0.0;

        // Process noise (piecewise white noise acceleration).
        let sa = self.sigma_a;
        let dt2 = dt * dt;
        let dt3 = dt2 * dt;
        let dt4 = dt3 * dt;
        let mut q = CovMatrix::zeros();
        q[(0, 0)] = dt4 / 4.0;
        q[(0, 2)] = dt3 / 2.0;
        q[(1, 1)] = dt4 / 4.0;
        q[(1, 3)] = dt3 / 2.0;
        q[(2, 0)] = dt3 / 2.0;
        q[(2, 2)] = dt2;
        q[(3, 1)] = dt3 / 2.0;
        q[(3, 3)] = dt2;
        q *= sa * sa;

        self.x = f * self.x;
        self.p = f * self.p * f.transpose() + q;
    }

    // -----------------------------------------------------------------------
    // CT prediction (Coordinated Turn)
    // -----------------------------------------------------------------------

    fn predict_ct(&mut self, dt: f64) {
        let (x, y, vx, vy, omega) = (self.x[0], self.x[1], self.x[2], self.x[3], self.x[4]);

        // State prediction.
        if omega.abs() < 1e-6 {
            // Straight-line fallback.
            self.x[0] = x + vx * dt;
            self.x[1] = y + vy * dt;
            // vx, vy, omega unchanged.
        } else {
            let sin_wdt = (omega * dt).sin();
            let cos_wdt = (omega * dt).cos();
            let w = omega;
            self.x[0] = x + (vx * sin_wdt - vy * (1.0 - cos_wdt)) / w;
            self.x[1] = y + (vx * (1.0 - cos_wdt) + vy * sin_wdt) / w;
            self.x[2] = vx * cos_wdt - vy * sin_wdt;
            self.x[3] = vx * sin_wdt + vy * cos_wdt;
            // omega unchanged.
        }

        // Jacobian of process model.
        let jac = self.ct_jacobian(dt, vx, vy, omega);

        // Process noise.
        let sa = self.sigma_a;
        let dt2 = dt * dt;
        let mut q = CovMatrix::zeros();
        q[(0, 0)] = dt2 * dt2 / 4.0;
        q[(1, 1)] = dt2 * dt2 / 4.0;
        q[(2, 2)] = dt2;
        q[(3, 3)] = dt2;
        q[(4, 4)] = 0.01 * dt2; // Small process noise on omega.
        q *= sa * sa;

        self.p = jac * self.p * jac.transpose() + q;
    }

    fn ct_jacobian(&self, dt: f64, vx: f64, vy: f64, omega: f64) -> CovMatrix {
        let mut j = CovMatrix::identity();
        if omega.abs() < 1e-6 {
            j[(0, 2)] = dt;
            j[(1, 3)] = dt;
        } else {
            let w = omega;
            let sw = (w * dt).sin();
            let cw = (w * dt).cos();
            j[(0, 2)] = sw / w;
            j[(0, 3)] = -(1.0 - cw) / w;
            j[(0, 4)] = (vx * (w * dt * cw - sw) + vy * (w * dt * sw - 1.0 + cw)) / (w * w);
            j[(1, 2)] = (1.0 - cw) / w;
            j[(1, 3)] = sw / w;
            j[(1, 4)] = (vx * (w * dt * sw + cw - 1.0) + vy * (-w * dt * cw + sw)) / (w * w);
            j[(2, 2)] = cw;
            j[(2, 3)] = -sw;
            j[(2, 4)] = -vx * sw * dt - vy * cw * dt;
            j[(3, 2)] = sw;
            j[(3, 3)] = cw;
            j[(3, 4)] = vx * cw * dt - vy * sw * dt;
        }
        j
    }

    // -----------------------------------------------------------------------
    // CTRV prediction (Constant Turn Rate & Velocity)
    // -----------------------------------------------------------------------

    fn predict_ctrv(&mut self, dt: f64) {
        let (x, y, v, theta, omega) = (self.x[0], self.x[1], self.x[2], self.x[3], self.x[4]);

        // State prediction with singularity guard.
        if omega.abs() < 1e-6 {
            // Straight-line fallback.
            self.x[0] = x + v * theta.cos() * dt;
            self.x[1] = y + v * theta.sin() * dt;
            // v, theta, omega unchanged.
        } else {
            let v_w = v / omega;
            self.x[0] = x + v_w * ((theta + omega * dt).sin() - theta.sin());
            self.x[1] = y + v_w * (theta.cos() - (theta + omega * dt).cos());
            // v unchanged.
            self.x[3] = theta + omega * dt;
            // omega unchanged.
        }

        // CTRV Jacobian.
        let jac = self.ctrv_jacobian(dt, v, theta, omega);

        // Process noise.
        let sa = self.sigma_a;
        let dt2 = dt * dt;
        let mut q = CovMatrix::zeros();
        q[(0, 0)] = dt2 * dt2 / 4.0;
        q[(1, 1)] = dt2 * dt2 / 4.0;
        q[(2, 2)] = dt2;
        q[(3, 3)] = 0.01 * dt2; // Small noise on heading.
        q[(4, 4)] = 0.01 * dt2; // Small noise on omega.
        q *= sa * sa;

        self.p = jac * self.p * jac.transpose() + q;
    }

    fn ctrv_jacobian(&self, dt: f64, v: f64, theta: f64, omega: f64) -> CovMatrix {
        let mut j = CovMatrix::identity();
        if omega.abs() < 1e-6 {
            let ct = theta.cos();
            let st = theta.sin();
            j[(0, 2)] = ct * dt;
            j[(0, 3)] = -v * st * dt;
            j[(1, 2)] = st * dt;
            j[(1, 3)] = v * ct * dt;
        } else {
            let w = omega;
            let s0 = theta.sin();
            let c0 = theta.cos();
            let s1 = (theta + w * dt).sin();
            let c1 = (theta + w * dt).cos();

            // dx/dv
            j[(0, 2)] = (s1 - s0) / w;
            // dx/dtheta
            j[(0, 3)] = v * (c1 - c0) / w;
            // dx/domega
            j[(0, 4)] = v * (c1 * dt * w - s1 + s0) / (w * w);

            // dy/dv
            j[(1, 2)] = (c0 - c1) / w;
            // dy/dtheta
            j[(1, 3)] = v * (s1 - s0) / w;
            // dy/domega
            j[(1, 4)] = v * (s1 * dt * w + c1 - c0) / (w * w);

            // dtheta/domega
            j[(3, 4)] = dt;
        }
        j
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    fn approx_eq(a: f64, b: f64, tol: f64) -> bool {
        (a - b).abs() < tol
    }

    // -- CV Model --

    #[test]
    fn cv_predict_straight_line() {
        let mut ekf = EkfState::new(MotionModel::Cv, 0.0, 0.0, 1.0, 10.0);
        ekf.x[2] = 10.0; // vx = 10 m/s
        ekf.x[3] = 5.0;  // vy = 5 m/s
        ekf.predict(1.0);
        assert!(approx_eq(ekf.x[0], 10.0, 1e-10), "x should be 10, got {}", ekf.x[0]);
        assert!(approx_eq(ekf.x[1], 5.0, 1e-10), "y should be 5, got {}", ekf.x[1]);
        assert!(approx_eq(ekf.x[2], 10.0, 1e-10), "vx unchanged");
        assert!(approx_eq(ekf.x[3], 5.0, 1e-10), "vy unchanged");
    }

    #[test]
    fn cv_predict_covariance_grows() {
        let mut ekf = EkfState::new(MotionModel::Cv, 0.0, 0.0, 1.0, 10.0);
        let p_before = ekf.p[(0, 0)];
        ekf.predict(1.0);
        assert!(ekf.p[(0, 0)] > p_before, "Position covariance should grow");
    }

    #[test]
    fn cv_update_reduces_uncertainty() {
        let mut ekf = EkfState::new(MotionModel::Cv, 0.0, 0.0, 1.0, 10.0);
        ekf.predict(1.0);
        let p_before = ekf.p[(0, 0)];
        ekf.update(10.0, 5.0);
        assert!(ekf.p[(0, 0)] < p_before, "Update should reduce position uncertainty");
    }

    #[test]
    fn cv_update_converges_to_measurement() {
        let mut ekf = EkfState::new(MotionModel::Cv, 0.0, 0.0, 1.0, 10.0);
        // Feed consistent measurements at (100, 50).
        for _ in 0..20 {
            ekf.predict(1.0);
            ekf.update(100.0, 50.0);
        }
        // Should converge close to the measurement position.
        assert!(approx_eq(ekf.x[0], 100.0, 5.0), "x should converge near 100, got {}", ekf.x[0]);
        assert!(approx_eq(ekf.x[1], 50.0, 5.0), "y should converge near 50, got {}", ekf.x[1]);
    }

    // -- CT Model --

    #[test]
    fn ct_predict_straight_line_fallback() {
        let mut ekf = EkfState::new(MotionModel::Ct, 0.0, 0.0, 1.0, 10.0);
        ekf.x[2] = 10.0; // vx
        ekf.x[3] = 0.0;  // vy
        ekf.x[4] = 0.0;  // omega = 0 → straight line
        ekf.predict(1.0);
        assert!(approx_eq(ekf.x[0], 10.0, 1e-6), "Straight line: x=10, got {}", ekf.x[0]);
        assert!(approx_eq(ekf.x[1], 0.0, 1e-6), "Straight line: y=0, got {}", ekf.x[1]);
    }

    #[test]
    fn ct_predict_with_turn() {
        let mut ekf = EkfState::new(MotionModel::Ct, 0.0, 0.0, 1.0, 10.0);
        ekf.x[2] = 10.0;       // vx = 10 m/s
        ekf.x[3] = 0.0;        // vy = 0
        ekf.x[4] = std::f64::consts::PI / 10.0; // omega = 18 deg/s
        ekf.predict(1.0);
        // With turn: position should shift from straight-line.
        // Speed should be preserved (approximately).
        let speed = (ekf.x[2] * ekf.x[2] + ekf.x[3] * ekf.x[3]).sqrt();
        assert!(approx_eq(speed, 10.0, 0.5), "Speed should be ~10, got {speed}");
    }

    #[test]
    fn ct_update_works() {
        let mut ekf = EkfState::new(MotionModel::Ct, 0.0, 0.0, 1.0, 10.0);
        ekf.predict(1.0);
        let p_before = ekf.p[(0, 0)];
        ekf.update(5.0, 3.0);
        assert!(ekf.p[(0, 0)] < p_before, "CT update should reduce uncertainty");
    }

    // -- CTRV Model --

    #[test]
    fn ctrv_predict_straight_line_fallback() {
        let mut ekf = EkfState::new(MotionModel::Ctrv, 0.0, 0.0, 1.0, 10.0);
        ekf.x[2] = 10.0;  // v = 10 m/s
        ekf.x[3] = 0.0;   // theta = 0 (heading east)
        ekf.x[4] = 0.0;   // omega = 0 → straight line
        ekf.predict(1.0);
        assert!(approx_eq(ekf.x[0], 10.0, 1e-6), "Straight east: x=10, got {}", ekf.x[0]);
        assert!(approx_eq(ekf.x[1], 0.0, 1e-6), "Straight east: y=0, got {}", ekf.x[1]);
    }

    #[test]
    fn ctrv_predict_with_turn() {
        let mut ekf = EkfState::new(MotionModel::Ctrv, 0.0, 0.0, 1.0, 10.0);
        ekf.x[2] = 10.0;  // v = 10 m/s
        ekf.x[3] = 0.0;   // theta = 0
        ekf.x[4] = std::f64::consts::PI / 10.0; // omega = 18 deg/s
        let x0 = ekf.x[0];
        let y0 = ekf.x[1];
        ekf.predict(1.0);
        // Should have moved from origin.
        let dist = ((ekf.x[0] - x0).powi(2) + (ekf.x[1] - y0).powi(2)).sqrt();
        assert!(dist > 5.0, "Should have moved significantly, dist={dist}");
        // Heading should have changed.
        let omega = std::f64::consts::PI / 10.0;
        assert!(approx_eq(ekf.x[3], omega, 1e-6), "Heading should be omega*dt");
    }

    #[test]
    fn ctrv_singularity_guard() {
        // omega very close to zero should not NaN or panic.
        let mut ekf = EkfState::new(MotionModel::Ctrv, 100.0, 200.0, 1.0, 10.0);
        ekf.x[2] = 15.0;
        ekf.x[3] = 0.5;
        ekf.x[4] = 1e-8; // Nearly zero omega.
        ekf.predict(1.0);
        assert!(!ekf.x[0].is_nan(), "No NaN from singularity guard");
        assert!(!ekf.x[1].is_nan(), "No NaN from singularity guard");
    }

    // -- NIS / Innovation --

    #[test]
    fn nis_at_predicted_position_is_small() {
        let mut ekf = EkfState::new(MotionModel::Cv, 0.0, 0.0, 1.0, 10.0);
        ekf.x[2] = 10.0;
        ekf.predict(1.0);
        // Measurement at predicted position → NIS should be small.
        let nis = ekf.nis(10.0, 0.0);
        assert!(nis < 1.0, "NIS at predicted position should be small, got {nis}");
    }

    #[test]
    fn nis_far_measurement_is_large() {
        let ekf = EkfState::new(MotionModel::Cv, 0.0, 0.0, 1.0, 10.0);
        // Measurement very far from state.
        let nis = ekf.nis(10000.0, 10000.0);
        assert!(nis > 100.0, "NIS for far measurement should be large, got {nis}");
    }

    // -- Position uncertainty --

    #[test]
    fn position_uncertainty_grows_with_coast() {
        let mut ekf = EkfState::new(MotionModel::Cv, 0.0, 0.0, 1.0, 10.0);
        let pu0 = ekf.position_uncertainty();
        ekf.predict(5.0);
        let pu1 = ekf.position_uncertainty();
        ekf.predict(5.0);
        let pu2 = ekf.position_uncertainty();
        assert!(pu1 > pu0, "Uncertainty should grow with prediction");
        assert!(pu2 > pu1, "Uncertainty should keep growing");
    }

    // -- Zero dt prediction --

    #[test]
    fn predict_zero_dt_is_noop() {
        let ekf_orig = EkfState::new(MotionModel::Cv, 5.0, 10.0, 1.0, 10.0);
        let mut ekf = ekf_orig.clone();
        ekf.predict(0.0);
        assert!(approx_eq(ekf.x[0], 5.0, 1e-15));
        assert!(approx_eq(ekf.x[1], 10.0, 1e-15));
    }

    // -- Joseph form stability --

    #[test]
    fn joseph_form_covariance_stays_positive() {
        // Run many predict-update cycles and verify P diagonal stays positive.
        let mut ekf = EkfState::new(MotionModel::Cv, 0.0, 0.0, 1.0, 10.0);
        ekf.x[2] = 5.0;
        ekf.x[3] = 3.0;
        for i in 0..100 {
            ekf.predict(0.5);
            ekf.update(2.5 * (i as f64 + 1.0), 1.5 * (i as f64 + 1.0));
            for d in 0..4 {
                assert!(
                    ekf.p[(d, d)] >= 0.0,
                    "P[{d},{d}] = {} < 0 at step {i}",
                    ekf.p[(d, d)]
                );
            }
        }
    }
}
