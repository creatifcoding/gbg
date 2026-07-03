//! LimitlessRP core normalization utilities.
//!
//! This crate intentionally starts small: durable, dependency-free helpers for
//! commodity intake and analysis code shared with TypeScript/Python fixtures.

/// Number of grams in one troy ounce.
pub const GRAMS_PER_TROY_OUNCE: f64 = 31.103_476_8;

/// Supported mass units for iridium transaction normalization.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MassUnit {
    Gram,
    Kilogram,
    TroyOunce,
}

/// Convert a quantity in the supplied mass unit into troy ounces.
///
/// # Panics
///
/// This function does not panic. Non-finite values return `None`.
#[must_use]
pub fn to_troy_ounces(quantity: f64, unit: MassUnit) -> Option<f64> {
    if !quantity.is_finite() || quantity < 0.0 {
        return None;
    }
    Some(match unit {
        MassUnit::Gram => quantity / GRAMS_PER_TROY_OUNCE,
        MassUnit::Kilogram => (quantity * 1_000.0) / GRAMS_PER_TROY_OUNCE,
        MassUnit::TroyOunce => quantity,
    })
}

/// Compute payable troy ounces from gross quantity and purity percentage.
#[must_use]
pub fn payable_troy_ounces(quantity: f64, unit: MassUnit, purity_percent: f64) -> Option<f64> {
    if !purity_percent.is_finite() || !(0.0..=100.0).contains(&purity_percent) {
        return None;
    }
    to_troy_ounces(quantity, unit).map(|oz| oz * purity_percent / 100.0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn converts_grams_to_troy_ounces() {
        let oz = to_troy_ounces(GRAMS_PER_TROY_OUNCE, MassUnit::Gram).unwrap();
        assert!((oz - 1.0).abs() < 1e-12);
    }

    #[test]
    fn computes_payable_metal() {
        let payable = payable_troy_ounces(1.0, MassUnit::Kilogram, 99.9).unwrap();
        assert!(payable > 32.0);
        assert!(payable < 32.2);
    }

    #[test]
    fn rejects_invalid_inputs() {
        assert_eq!(to_troy_ounces(-1.0, MassUnit::Gram), None);
        assert_eq!(payable_troy_ounces(1.0, MassUnit::Gram, 101.0), None);
    }
}
