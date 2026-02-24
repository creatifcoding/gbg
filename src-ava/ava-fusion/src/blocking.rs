//! Blocking strategy types for scalable fusion joins.
//!
//! Three-dimensional blocking partitions the candidate space:
//! spatial (H3 cells), temporal (time buckets), and spectral
//! (frequency bands). Reduces Event x Event cartesian products
//! by 1000-7000x in typical deployments.
//!
//! Source: TSGC-001-v2 Section 6 (R6 blocking strategy).

use serde::{Deserialize, Serialize};
use typeshare::typeshare;

// ---------------------------------------------------------------------------
// H3Resolution — validated hexagonal resolution level
// ---------------------------------------------------------------------------

/// Uber H3 hexagonal indexing resolution level (0-15).
///
/// Resolution 0 is ~1107 km edge length; resolution 15 is ~0.5 m.
/// Wraps a `u8` that must be in the valid range 0-15.
#[typeshare]
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct H3Resolution(pub u8);

impl H3Resolution {
    /// Create a new H3Resolution, clamping to the valid range 0-15.
    pub fn new(resolution: u8) -> Self {
        Self(resolution.min(15))
    }

    /// Returns the raw resolution value.
    pub fn value(self) -> u8 {
        self.0
    }

    /// Returns `true` if the resolution is within the valid H3 range.
    pub fn is_valid(self) -> bool {
        self.0 <= 15
    }
}

// ---------------------------------------------------------------------------
// SpatialBlockConfig — H3 cell-based spatial blocking
// ---------------------------------------------------------------------------

/// Spatial blocking configuration using H3 hexagonal cells.
///
/// - `h3_resolution`: H3 resolution level for block key generation.
/// - `k_ring`: Number of k-ring expansions around each cell for
///   boundary-crossing entity coverage.
#[typeshare]
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpatialBlockConfig {
    pub h3_resolution: u8,
    pub k_ring: u8,
}

impl Default for SpatialBlockConfig {
    fn default() -> Self {
        Self {
            h3_resolution: 8,
            k_ring: 1,
        }
    }
}

// ---------------------------------------------------------------------------
// TemporalBlockConfig — time-bucket blocking
// ---------------------------------------------------------------------------

/// Temporal blocking configuration using fixed-width time buckets.
///
/// - `window_seconds`: Width of each temporal block.
#[typeshare]
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TemporalBlockConfig {
    pub window_seconds: u64,
}

impl Default for TemporalBlockConfig {
    fn default() -> Self {
        Self {
            window_seconds: 60,
        }
    }
}

// ---------------------------------------------------------------------------
// SpectralBlockConfig — frequency-band blocking
// ---------------------------------------------------------------------------

/// Spectral blocking configuration for RF signal pairs.
///
/// - `band_width_mhz`: Width of the frequency band for block key.
/// - `center_tolerance_mhz`: Tolerance around the center frequency.
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpectralBlockConfig {
    pub band_width_mhz: f64,
    pub center_tolerance_mhz: f64,
}

// ---------------------------------------------------------------------------
// BlockingDefaults — system-wide default blocking parameters
// ---------------------------------------------------------------------------

/// System-wide default blocking parameters for spatial and temporal
/// dimensions. Per-join-path configs override these.
#[typeshare]
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BlockingDefaults {
    pub spatial: SpatialBlockConfig,
    pub temporal: TemporalBlockConfig,
}

impl Default for BlockingDefaults {
    fn default() -> Self {
        Self {
            spatial: SpatialBlockConfig::default(),
            temporal: TemporalBlockConfig::default(),
        }
    }
}

// ---------------------------------------------------------------------------
// UnifiedBlockJoinConfig — per-join-path blocking config
// ---------------------------------------------------------------------------

/// Per-join-path blocking configuration combining all three dimensions.
///
/// Each dimension is optional: spatial blocking is not meaningful for
/// non-geospatial joins; spectral blocking only applies to RF pairs.
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UnifiedBlockJoinConfig {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub spatial: Option<SpatialBlockConfig>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temporal: Option<TemporalBlockConfig>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub spectral: Option<SpectralBlockConfig>,
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    // -- H3Resolution --

    #[test]
    fn h3_resolution_new_clamps() {
        assert_eq!(H3Resolution::new(0).value(), 0);
        assert_eq!(H3Resolution::new(15).value(), 15);
        assert_eq!(H3Resolution::new(20).value(), 15);
        assert_eq!(H3Resolution::new(255).value(), 15);
    }

    #[test]
    fn h3_resolution_is_valid() {
        assert!(H3Resolution(0).is_valid());
        assert!(H3Resolution(15).is_valid());
        assert!(!H3Resolution(16).is_valid());
    }

    #[test]
    fn h3_resolution_serde_roundtrip() {
        let res = H3Resolution(9);
        let json = serde_json::to_string(&res).unwrap();
        assert_eq!(json, "9");
        let parsed: H3Resolution = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, res);
    }

    #[test]
    fn h3_resolution_ordering() {
        assert!(H3Resolution(5) < H3Resolution(10));
    }

    // -- SpatialBlockConfig --

    #[test]
    fn spatial_block_config_serde_roundtrip() {
        let cfg = SpatialBlockConfig {
            h3_resolution: 7,
            k_ring: 2,
        };
        let json = serde_json::to_string(&cfg).unwrap();
        let parsed: SpatialBlockConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, cfg);
    }

    #[test]
    fn spatial_block_config_json_camel_case() {
        let cfg = SpatialBlockConfig::default();
        let json = serde_json::to_string(&cfg).unwrap();
        assert!(json.contains("\"h3Resolution\""));
        assert!(json.contains("\"kRing\""));
    }

    #[test]
    fn spatial_block_config_default() {
        let cfg = SpatialBlockConfig::default();
        assert_eq!(cfg.h3_resolution, 8);
        assert_eq!(cfg.k_ring, 1);
    }

    // -- TemporalBlockConfig --

    #[test]
    fn temporal_block_config_serde_roundtrip() {
        let cfg = TemporalBlockConfig {
            window_seconds: 300,
        };
        let json = serde_json::to_string(&cfg).unwrap();
        let parsed: TemporalBlockConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, cfg);
    }

    #[test]
    fn temporal_block_config_default() {
        let cfg = TemporalBlockConfig::default();
        assert_eq!(cfg.window_seconds, 60);
    }

    // -- SpectralBlockConfig --

    #[test]
    fn spectral_block_config_serde_roundtrip() {
        let cfg = SpectralBlockConfig {
            band_width_mhz: 2.0,
            center_tolerance_mhz: 1.0,
        };
        let json = serde_json::to_string(&cfg).unwrap();
        let parsed: SpectralBlockConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, cfg);
    }

    #[test]
    fn spectral_block_config_json_camel_case() {
        let cfg = SpectralBlockConfig {
            band_width_mhz: 18.0,
            center_tolerance_mhz: 0.5,
        };
        let json = serde_json::to_string(&cfg).unwrap();
        assert!(json.contains("\"bandWidthMhz\""));
        assert!(json.contains("\"centerToleranceMhz\""));
    }

    // -- BlockingDefaults --

    #[test]
    fn blocking_defaults_serde_roundtrip() {
        let defaults = BlockingDefaults::default();
        let json = serde_json::to_string(&defaults).unwrap();
        let parsed: BlockingDefaults = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, defaults);
    }

    // -- UnifiedBlockJoinConfig --

    #[test]
    fn unified_block_join_config_full_serde_roundtrip() {
        let cfg = UnifiedBlockJoinConfig {
            spatial: Some(SpatialBlockConfig {
                h3_resolution: 9,
                k_ring: 0,
            }),
            temporal: Some(TemporalBlockConfig {
                window_seconds: 30,
            }),
            spectral: Some(SpectralBlockConfig {
                band_width_mhz: 2.0,
                center_tolerance_mhz: 1.0,
            }),
        };
        let json = serde_json::to_string(&cfg).unwrap();
        let parsed: UnifiedBlockJoinConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, cfg);
    }

    #[test]
    fn unified_block_join_config_sparse_serde_roundtrip() {
        let cfg = UnifiedBlockJoinConfig {
            spatial: None,
            temporal: Some(TemporalBlockConfig {
                window_seconds: 300,
            }),
            spectral: None,
        };
        let json = serde_json::to_string(&cfg).unwrap();
        assert!(!json.contains("spatial"));
        assert!(!json.contains("spectral"));
        assert!(json.contains("\"temporal\""));
        let parsed: UnifiedBlockJoinConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, cfg);
    }

    #[test]
    fn unified_block_join_config_all_none() {
        let cfg = UnifiedBlockJoinConfig {
            spatial: None,
            temporal: None,
            spectral: None,
        };
        let json = serde_json::to_string(&cfg).unwrap();
        assert_eq!(json, "{}");
    }
}
