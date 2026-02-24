//! Track-to-track fusion via Covariance Intersection (CI).
//!
//! CI fuses state estimates from different trackers when cross-correlations
//! are unknown. It is guaranteed consistent (never overconfident).
//!
//! Formula:
//!   P_CI^(-1) = omega * P_A^(-1) + (1-omega) * P_B^(-1)
//!   x_CI = P_CI * (omega * P_A^(-1) * x_A + (1-omega) * P_B^(-1) * x_B)
//!
//! Fast omega via trace minimization:
//!   omega = tr(P_B) / (tr(P_A) + tr(P_B))

use super::ekf::{CovMatrix, StateVec};

/// Result of Covariance Intersection fusion.
#[derive(Debug, Clone)]
pub struct CiFusionResult {
    /// Fused state estimate.
    pub x: StateVec,
    /// Fused covariance.
    pub p: CovMatrix,
    /// Mixing weight omega (how much weight on track A).
    pub omega: f64,
}

/// Fuse two track estimates using Covariance Intersection.
///
/// Uses trace-minimization for fast omega computation (no optimization loop).
///
/// Returns `None` if either covariance is singular (not invertible).
pub fn covariance_intersection(
    x_a: &StateVec,
    p_a: &CovMatrix,
    x_b: &StateVec,
    p_b: &CovMatrix,
) -> Option<CiFusionResult> {
    // Compute omega via trace minimization.
    let tr_a = p_a.trace();
    let tr_b = p_b.trace();
    let tr_sum = tr_a + tr_b;

    if tr_sum < 1e-30 {
        return None;
    }

    let omega = tr_b / tr_sum;
    covariance_intersection_with_omega(x_a, p_a, x_b, p_b, omega)
}

/// Fuse two track estimates using CI with a specified omega.
///
/// omega in [0, 1]: 0 = trust B entirely, 1 = trust A entirely.
pub fn covariance_intersection_with_omega(
    x_a: &StateVec,
    p_a: &CovMatrix,
    x_b: &StateVec,
    p_b: &CovMatrix,
    omega: f64,
) -> Option<CiFusionResult> {
    let omega = omega.clamp(0.01, 0.99); // Avoid singularity at extremes.

    let p_a_inv = p_a.try_inverse()?;
    let p_b_inv = p_b.try_inverse()?;

    // P_CI^(-1) = omega * P_A^(-1) + (1-omega) * P_B^(-1)
    let p_ci_inv = omega * p_a_inv + (1.0 - omega) * p_b_inv;
    let p_ci = p_ci_inv.try_inverse()?;

    // x_CI = P_CI * (omega * P_A^(-1) * x_A + (1-omega) * P_B^(-1) * x_B)
    let x_ci = p_ci * (omega * p_a_inv * x_a + (1.0 - omega) * p_b_inv * x_b);

    Some(CiFusionResult {
        x: x_ci,
        p: p_ci,
        omega,
    })
}

/// Fuse N track estimates using sequential Covariance Intersection.
///
/// Fuses estimates pairwise: (A, B) → AB, (AB, C) → ABC, etc.
/// Order-dependent but consistent (never overconfident).
pub fn covariance_intersection_n(
    estimates: &[(StateVec, CovMatrix)],
) -> Option<CiFusionResult> {
    if estimates.is_empty() {
        return None;
    }
    if estimates.len() == 1 {
        return Some(CiFusionResult {
            x: estimates[0].0,
            p: estimates[0].1,
            omega: 1.0,
        });
    }

    let mut result = CiFusionResult {
        x: estimates[0].0,
        p: estimates[0].1,
        omega: 1.0,
    };

    for est in &estimates[1..] {
        result = covariance_intersection(&result.x, &result.p, &est.0, &est.1)?;
    }

    Some(result)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    fn make_state(x: f64, y: f64) -> StateVec {
        let mut s = StateVec::zeros();
        s[0] = x;
        s[1] = y;
        s
    }

    fn make_cov(pos_var: f64, vel_var: f64) -> CovMatrix {
        let mut p = CovMatrix::zeros();
        p[(0, 0)] = pos_var;
        p[(1, 1)] = pos_var;
        p[(2, 2)] = vel_var;
        p[(3, 3)] = vel_var;
        p[(4, 4)] = 1.0;
        p
    }

    #[test]
    fn ci_identical_tracks() {
        let x = make_state(100.0, 200.0);
        let p = make_cov(25.0, 4.0);
        let result = covariance_intersection(&x, &p, &x, &p).unwrap();
        // Fusing identical tracks should give the same position.
        assert!((result.x[0] - 100.0).abs() < 1e-6);
        assert!((result.x[1] - 200.0).abs() < 1e-6);
        // Covariance should be no larger than original (can be smaller).
        assert!(result.p[(0, 0)] <= p[(0, 0)] + 1e-6);
    }

    #[test]
    fn ci_fused_state_between_inputs() {
        let x_a = make_state(100.0, 200.0);
        let p_a = make_cov(25.0, 4.0);
        let x_b = make_state(110.0, 190.0);
        let p_b = make_cov(36.0, 9.0);

        let result = covariance_intersection(&x_a, &p_a, &x_b, &p_b).unwrap();

        // Fused position should be between the two inputs.
        let fused_x = result.x[0];
        let fused_y = result.x[1];
        assert!(
            fused_x >= 99.0 && fused_x <= 111.0,
            "Fused x={fused_x} should be between inputs (100, 110)"
        );
        assert!(
            fused_y >= 189.0 && fused_y <= 201.0,
            "Fused y={fused_y} should be between inputs (200, 190)"
        );
        // Omega should be reasonable (not extreme).
        assert!(result.omega > 0.1 && result.omega < 0.9,
            "Omega={} should be moderate", result.omega);
    }

    #[test]
    fn ci_weighted_toward_more_precise() {
        let x_a = make_state(100.0, 200.0);
        let p_a = make_cov(1.0, 1.0); // Very precise.
        let x_b = make_state(200.0, 300.0);
        let p_b = make_cov(1000.0, 1000.0); // Very imprecise.

        let result = covariance_intersection(&x_a, &p_a, &x_b, &p_b).unwrap();

        // Should be much closer to track A (the precise one).
        assert!(
            (result.x[0] - 100.0).abs() < 10.0,
            "Fused x should be near track A (100), got {}",
            result.x[0]
        );
    }

    #[test]
    fn ci_omega_trace_minimization() {
        let x_a = make_state(0.0, 0.0);
        let p_a = make_cov(10.0, 1.0);
        let x_b = make_state(0.0, 0.0);
        let p_b = make_cov(40.0, 4.0);

        let result = covariance_intersection(&x_a, &p_a, &x_b, &p_b).unwrap();

        // omega = tr(P_B) / (tr(P_A) + tr(P_B))
        // tr(P_A) = 10+10+1+1+1 = 23, tr(P_B) = 40+40+4+4+1 = 89
        // omega = 89 / (23 + 89) = 89/112 ≈ 0.795
        // But clamped to [0.01, 0.99], so omega ≈ 0.795.
        assert!(
            result.omega > 0.7,
            "Omega should favor more precise track A, got {}",
            result.omega
        );
    }

    #[test]
    fn ci_n_single_track() {
        let x = make_state(50.0, 60.0);
        let p = make_cov(10.0, 2.0);
        let result = covariance_intersection_n(&[(x, p)]).unwrap();
        assert!((result.x[0] - 50.0).abs() < 1e-10);
    }

    #[test]
    fn ci_n_three_tracks() {
        let tracks = vec![
            (make_state(100.0, 200.0), make_cov(25.0, 4.0)),
            (make_state(102.0, 198.0), make_cov(30.0, 5.0)),
            (make_state(101.0, 201.0), make_cov(20.0, 3.0)),
        ];
        let result = covariance_intersection_n(&tracks).unwrap();
        // Fused position should be in the vicinity of all three.
        assert!((result.x[0] - 101.0).abs() < 5.0);
        assert!((result.x[1] - 200.0).abs() < 5.0);
        // Fused covariance should be tighter.
        assert!(result.p[(0, 0)] < 25.0);
    }

    #[test]
    fn ci_n_empty() {
        let result = covariance_intersection_n(&[]);
        assert!(result.is_none());
    }

    #[test]
    fn ci_covariance_stays_positive_definite() {
        let x_a = make_state(0.0, 0.0);
        let p_a = make_cov(100.0, 50.0);
        let x_b = make_state(10.0, 10.0);
        let p_b = make_cov(200.0, 100.0);

        let result = covariance_intersection(&x_a, &p_a, &x_b, &p_b).unwrap();
        for d in 0..crate::tracking::ekf::MAX_DIM {
            assert!(
                result.p[(d, d)] >= 0.0,
                "P_CI[{d},{d}] = {} should be non-negative",
                result.p[(d, d)]
            );
        }
    }
}
