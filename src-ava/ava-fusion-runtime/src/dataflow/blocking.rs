//! Key extraction functions for fusion join blocking strategies.
//!
//! Blocking reduces the candidate space by partitioning observations
//! into coarse groups before evaluating predicates. Each function maps
//! an observation's metadata to one or more block keys.
//!
//! | Strategy  | Function              | Cardinality |
//! |-----------|-----------------------|-------------|
//! | Identity  | extract_identity_key  | 1:1         |
//! | Spatial   | extract_spatial_keys  | 1:N (H3)    |
//! | Temporal  | extract_temporal_key  | 1:1         |
//! | Spectral  | extract_spectral_key  | 1:1         |
//! | Composite | extract_composite_key | 1:N (cross) |

use h3o::{CellIndex, LatLng, Resolution};

use crate::dataflow::Observation;

// ---------------------------------------------------------------------------
// H3 geospatial utilities
// ---------------------------------------------------------------------------

/// Convert latitude/longitude to an H3 CellIndex at the given resolution.
///
/// Returns `None` if the coordinates are out of range.
pub fn lat_lon_to_cell(lat_deg: f64, lon_deg: f64, resolution: u8) -> Option<CellIndex> {
    let coord = LatLng::new(lat_deg, lon_deg).ok()?;
    let res = Resolution::try_from(resolution).ok()?;
    Some(coord.to_cell(res))
}

/// Get the k-ring (grid disk) of a cell, including the cell itself.
///
/// Returns all cells within `k` steps of the origin.
/// For k=1, returns the origin + up to 6 neighbors (7 cells).
pub fn h3_grid_disk(cell: CellIndex, k: u32) -> Vec<CellIndex> {
    cell.grid_disk::<Vec<_>>(k)
}

/// Convert latitude/longitude to H3 cell string keys with k-ring expansion.
///
/// This is the primary geo-aware spatial blocking function. Returns the
/// hex string representation of each cell in the grid disk.
///
/// # Arguments
/// - `lat_deg`, `lon_deg`: WGS84 coordinates in decimal degrees.
/// - `resolution`: H3 resolution (0-15). Resolution 8 ≈ 4.6 km² cells.
/// - `k_ring`: Number of expansion rings (0 = base cell only).
///
/// Returns empty Vec if coordinates are invalid.
pub fn spatial_keys_from_coords(
    lat_deg: f64,
    lon_deg: f64,
    resolution: u8,
    k_ring: u32,
) -> Vec<String> {
    let cell = match lat_lon_to_cell(lat_deg, lon_deg, resolution) {
        Some(c) => c,
        None => return Vec::new(),
    };
    h3_grid_disk(cell, k_ring)
        .into_iter()
        .map(|c| c.to_string())
        .collect()
}

// ---------------------------------------------------------------------------
// Real spectral key extraction
// ---------------------------------------------------------------------------

/// Extract spectral (frequency band) block key from a frequency in MHz.
///
/// Partitions the RF spectrum into bands of `band_width_mhz` width.
/// The band index directly identifies coarse spectral proximity.
pub fn spectral_key_from_freq(freq_mhz: f64, band_width_mhz: f64) -> String {
    let band = (freq_mhz / band_width_mhz).floor() as i64;
    format!("f_{}", band)
}

// ---------------------------------------------------------------------------
// Identity key extraction
// ---------------------------------------------------------------------------

/// Extract the identity key from an observation.
///
/// For Tier 1 joins, the observation's `key` field IS the identity
/// (ICAO hex, MMSI, IP address, etc.). Direct passthrough.
pub fn extract_identity_key(obs: &Observation) -> String {
    obs.key.clone()
}

// ---------------------------------------------------------------------------
// Spatial key extraction (H3 cells)
// ---------------------------------------------------------------------------

/// Configuration for spatial blocking.
#[derive(Clone)]
pub struct SpatialKeyConfig {
    /// H3 resolution level (0-15).
    pub h3_resolution: u8,
    /// Number of k-ring expansions around the base cell.
    pub k_ring: u8,
}

/// Extract spatial block keys from an observation.
///
/// When the observation carries real WGS84 coordinates (lat/lon micro-degrees),
/// computes the H3 cell index at the configured resolution and expands to
/// k_ring neighbors using the `h3o` crate. This produces geographically
/// meaningful block keys that ensure nearby entities land in overlapping blocks.
///
/// Falls back to deterministic hash-based bucketing when coordinates are absent
/// (backward compatible with observations that lack spatial metadata).
///
/// Returns the base cell key plus k_ring "neighbor" keys.
pub fn extract_spatial_keys(obs: &Observation, config: &SpatialKeyConfig) -> Vec<String> {
    // Use real H3 when coordinates are available.
    if let (Some(lat_ud), Some(lon_ud)) = (obs.lat_microdeg, obs.lon_microdeg) {
        let lat = lat_ud as f64 / 1_000_000.0;
        let lon = lon_ud as f64 / 1_000_000.0;
        let keys = spatial_keys_from_coords(lat, lon, config.h3_resolution, config.k_ring as u32);
        if !keys.is_empty() {
            return keys;
        }
        // Invalid coords (NaN, out of H3 range) — fall through to hash.
    }

    // Fallback: deterministic hash-based bucketing for observations
    // without spatial metadata.
    let base_bucket = hash_to_bucket(&obs.key, config.h3_resolution as u64);
    let base_key = format!("h3_{}", base_bucket);

    let mut keys = Vec::with_capacity(1 + config.k_ring as usize * 6);
    keys.push(base_key);

    for ring in 1..=config.k_ring {
        for offset in 0..6 {
            let neighbor = base_bucket.wrapping_add(ring as u64 * 7 + offset as u64);
            keys.push(format!("h3_{}", neighbor));
        }
    }

    keys
}

// ---------------------------------------------------------------------------
// Temporal key extraction
// ---------------------------------------------------------------------------

/// Configuration for temporal blocking.
#[derive(Clone)]
pub struct TemporalKeyConfig {
    /// Width of each temporal block in seconds.
    pub window_seconds: u64,
}

/// Extract the temporal block key from an observation.
///
/// Buckets the observation's timestamp into fixed-width time windows.
/// The payload_hash is used as a proxy for timestamp when actual
/// timestamps aren't embedded in the Observation struct.
pub fn extract_temporal_key(obs: &Observation, config: &TemporalKeyConfig) -> String {
    // Use payload_hash as a proxy timestamp (in real usage, the
    // GenServer passes timestamp_ms which gets encoded into payload_hash
    // or carried alongside).
    let time_ms = obs.payload_hash;
    let bucket = time_ms / (config.window_seconds * 1000);
    format!("t_{}", bucket)
}

// ---------------------------------------------------------------------------
// Spectral key extraction
// ---------------------------------------------------------------------------

/// Configuration for spectral blocking.
#[derive(Clone)]
pub struct SpectralKeyConfig {
    /// Width of the frequency band in MHz.
    pub band_width_mhz: f64,
}

/// Extract the spectral (frequency band) block key from an observation.
///
/// For RF signal pairs, buckets by frequency band. Uses a hash-based
/// approximation when actual frequency data isn't directly available.
pub fn extract_spectral_key(obs: &Observation, config: &SpectralKeyConfig) -> String {
    // Hash-based frequency approximation.
    let freq_proxy = (obs.payload_hash % 30000) as f64; // 0-30GHz range proxy
    let band = (freq_proxy / (config.band_width_mhz * 1.0)) as u64;
    format!("f_{}", band)
}

// ---------------------------------------------------------------------------
// Composite key extraction
// ---------------------------------------------------------------------------

/// Configuration for composite blocking (cross-product of dimensions).
#[derive(Clone)]
pub struct CompositeKeyConfig {
    pub spatial: Option<SpatialKeyConfig>,
    pub temporal: Option<TemporalKeyConfig>,
    pub spectral: Option<SpectralKeyConfig>,
}

/// Extract composite block keys (cross-product of active dimensions).
///
/// For Tier 2 joins with multiple blocking dimensions enabled,
/// produces the cross-product of all dimension keys. This is the
/// canonical blocking strategy for soft-key fusion.
///
/// Returns: Vec of composite keys like "h3_42:t_17:f_3".
pub fn extract_composite_key(obs: &Observation, config: &CompositeKeyConfig) -> Vec<String> {
    let spatial_keys = match &config.spatial {
        Some(sc) => extract_spatial_keys(obs, sc),
        None => vec!["_".to_string()],
    };

    let temporal_key = match &config.temporal {
        Some(tc) => extract_temporal_key(obs, tc),
        None => "_".to_string(),
    };

    let spectral_key = match &config.spectral {
        Some(sc) => extract_spectral_key(obs, sc),
        None => "_".to_string(),
    };

    // Cross-product: spatial (N) x temporal (1) x spectral (1).
    spatial_keys
        .into_iter()
        .map(|sk| format!("{}:{}:{}", sk, temporal_key, spectral_key))
        .collect()
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/// Simple deterministic hash-to-bucket mapping.
fn hash_to_bucket(key: &str, resolution: u64) -> u64 {
    let mut hash: u64 = 5381;
    for byte in key.bytes() {
        hash = hash.wrapping_mul(33).wrapping_add(byte as u64);
    }
    // Resolution determines granularity: higher res = more buckets.
    let num_buckets = 1u64 << resolution.min(20);
    hash % num_buckets
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    fn test_obs(key: &str) -> Observation {
        Observation {
            key: key.into(),
            source_id: "test".into(),
            payload_hash: 123456789,
            lat_microdeg: None,
            lon_microdeg: None,
        }
    }

    fn test_obs_with_coords(key: &str, lat: f64, lon: f64) -> Observation {
        Observation {
            key: key.into(),
            source_id: "test".into(),
            payload_hash: 123456789,
            lat_microdeg: Some((lat * 1_000_000.0) as i64),
            lon_microdeg: Some((lon * 1_000_000.0) as i64),
        }
    }

    #[test]
    fn identity_key_passthrough() {
        let obs = test_obs("ICAO-ABC123");
        assert_eq!(extract_identity_key(&obs), "ICAO-ABC123");
    }

    #[test]
    fn spatial_keys_include_base_and_neighbors() {
        let obs = test_obs("vessel-1");
        let config = SpatialKeyConfig {
            h3_resolution: 8,
            k_ring: 1,
        };
        let keys = extract_spatial_keys(&obs, &config);
        // 1 base + 6 * 1 neighbors = 7.
        assert_eq!(keys.len(), 7);
        assert!(keys[0].starts_with("h3_"));
    }

    #[test]
    fn spatial_keys_no_ring() {
        let obs = test_obs("vessel-1");
        let config = SpatialKeyConfig {
            h3_resolution: 8,
            k_ring: 0,
        };
        let keys = extract_spatial_keys(&obs, &config);
        assert_eq!(keys.len(), 1);
    }

    #[test]
    fn temporal_key_format() {
        let obs = test_obs("test");
        let config = TemporalKeyConfig {
            window_seconds: 60,
        };
        let key = extract_temporal_key(&obs, &config);
        assert!(key.starts_with("t_"));
    }

    #[test]
    fn spectral_key_format() {
        let obs = test_obs("test");
        let config = SpectralKeyConfig {
            band_width_mhz: 2.0,
        };
        let key = extract_spectral_key(&obs, &config);
        assert!(key.starts_with("f_"));
    }

    #[test]
    fn composite_key_cross_product() {
        let obs = test_obs("test");
        let config = CompositeKeyConfig {
            spatial: Some(SpatialKeyConfig {
                h3_resolution: 8,
                k_ring: 1,
            }),
            temporal: Some(TemporalKeyConfig {
                window_seconds: 60,
            }),
            spectral: None,
        };
        let keys = extract_composite_key(&obs, &config);
        // 7 spatial keys x 1 temporal x 1 spectral (default _).
        assert_eq!(keys.len(), 7);
        for key in &keys {
            assert!(key.contains(":t_"));
            assert!(key.contains(":_"));
        }
    }

    #[test]
    fn composite_key_all_none() {
        let obs = test_obs("test");
        let config = CompositeKeyConfig {
            spatial: None,
            temporal: None,
            spectral: None,
        };
        let keys = extract_composite_key(&obs, &config);
        assert_eq!(keys.len(), 1);
        assert_eq!(keys[0], "_:_:_");
    }

    #[test]
    fn deterministic_hashing() {
        let a = hash_to_bucket("test-key", 8);
        let b = hash_to_bucket("test-key", 8);
        assert_eq!(a, b, "Same input must produce same bucket");
    }

    // -- H3-wired extract_spatial_keys (real coordinates) --

    #[test]
    fn spatial_keys_with_real_coords_use_h3() {
        // San Francisco coords → should produce real H3 hex keys, not "h3_<bucket>".
        let obs = test_obs_with_coords("vessel-1", 37.7749, -122.4194);
        let config = SpatialKeyConfig {
            h3_resolution: 8,
            k_ring: 1,
        };
        let keys = extract_spatial_keys(&obs, &config);
        assert_eq!(keys.len(), 7, "k_ring=1 → 7 H3 cells");
        // Real H3 keys are 15+ char hex strings, not "h3_<number>".
        for key in &keys {
            assert!(
                key.len() > 10,
                "Real H3 key should be long hex, got '{}'",
                key
            );
            assert!(
                !key.starts_with("h3_"),
                "Should use real H3 hex, not hash fallback, got '{}'",
                key
            );
        }
    }

    #[test]
    fn spatial_keys_without_coords_use_hash_fallback() {
        // No coords → hash-based fallback (backward compat).
        let obs = test_obs("vessel-1");
        let config = SpatialKeyConfig {
            h3_resolution: 8,
            k_ring: 1,
        };
        let keys = extract_spatial_keys(&obs, &config);
        assert_eq!(keys.len(), 7);
        assert!(keys[0].starts_with("h3_"), "No coords → hash fallback prefix");
    }

    #[test]
    fn spatial_keys_nearby_coords_share_h3_cells() {
        // Two observations ~100m apart should share cells through extract_spatial_keys.
        let obs_a = test_obs_with_coords("vessel-a", 51.5074, -0.1278);
        let obs_b = test_obs_with_coords("vessel-b", 51.5075, -0.1279);
        let config = SpatialKeyConfig {
            h3_resolution: 8,
            k_ring: 1,
        };
        let keys_a = extract_spatial_keys(&obs_a, &config);
        let keys_b = extract_spatial_keys(&obs_b, &config);
        let shared = keys_a.iter().filter(|k| keys_b.contains(k)).count();
        assert!(
            shared > 0,
            "Nearby vessels should share H3 block keys (shared={})",
            shared
        );
    }

    #[test]
    fn spatial_keys_distant_coords_no_h3_overlap() {
        // London vs Tokyo — no overlap at res 8 k=1.
        let obs_london = test_obs_with_coords("vessel-london", 51.5074, -0.1278);
        let obs_tokyo = test_obs_with_coords("vessel-tokyo", 35.6762, 139.6503);
        let config = SpatialKeyConfig {
            h3_resolution: 8,
            k_ring: 1,
        };
        let keys_london = extract_spatial_keys(&obs_london, &config);
        let keys_tokyo = extract_spatial_keys(&obs_tokyo, &config);
        let shared = keys_london.iter().filter(|k| keys_tokyo.contains(k)).count();
        assert_eq!(shared, 0, "London and Tokyo should not share H3 cells");
    }

    // -- H3 geospatial blocking --

    #[test]
    fn h3_cell_from_san_francisco() {
        // San Francisco: 37.7749° N, 122.4194° W
        let cell = lat_lon_to_cell(37.7749, -122.4194, 8);
        assert!(cell.is_some(), "Valid coordinates should produce a cell");
        let cell = cell.unwrap();
        let s = cell.to_string();
        assert!(!s.is_empty());
    }

    #[test]
    fn h3_cell_invalid_coords() {
        // NaN coordinates are invalid.
        let cell = lat_lon_to_cell(f64::NAN, 0.0, 8);
        assert!(cell.is_none(), "NaN latitude should return None");
    }

    #[test]
    fn h3_cell_invalid_resolution() {
        let cell = lat_lon_to_cell(37.0, -122.0, 20);
        assert!(cell.is_none(), "Resolution > 15 should return None");
    }

    #[test]
    fn h3_grid_disk_k0_is_single_cell() {
        let cell = lat_lon_to_cell(37.7749, -122.4194, 8).unwrap();
        let disk = h3_grid_disk(cell, 0);
        assert_eq!(disk.len(), 1, "k=0 should return just the base cell");
        assert_eq!(disk[0], cell);
    }

    #[test]
    fn h3_grid_disk_k1_returns_7_cells() {
        let cell = lat_lon_to_cell(37.7749, -122.4194, 8).unwrap();
        let disk = h3_grid_disk(cell, 1);
        // Non-pentagon cell at res 8: should have exactly 7 cells.
        assert_eq!(disk.len(), 7, "k=1 should return 7 cells, got {}", disk.len());
        assert!(disk.contains(&cell), "Grid disk should contain the origin");
    }

    #[test]
    fn h3_grid_disk_k2_returns_19_cells() {
        let cell = lat_lon_to_cell(37.7749, -122.4194, 8).unwrap();
        let disk = h3_grid_disk(cell, 2);
        // 1 + 6 + 12 = 19 for non-pentagon cells.
        assert_eq!(disk.len(), 19, "k=2 should return 19 cells, got {}", disk.len());
    }

    #[test]
    fn spatial_keys_from_coords_basic() {
        let keys = spatial_keys_from_coords(37.7749, -122.4194, 8, 1);
        assert_eq!(keys.len(), 7, "Should have 7 hex string keys");
        // Each key should be a valid hex string (H3 index).
        for key in &keys {
            assert!(key.len() > 10, "H3 hex should be >10 chars, got {}", key);
        }
    }

    #[test]
    fn spatial_keys_from_coords_invalid() {
        let keys = spatial_keys_from_coords(f64::NAN, 0.0, 8, 1);
        assert!(keys.is_empty(), "NaN coords should return empty vec");
    }

    #[test]
    fn spatial_keys_deterministic() {
        let a = spatial_keys_from_coords(51.5074, -0.1278, 7, 1);
        let b = spatial_keys_from_coords(51.5074, -0.1278, 7, 1);
        assert_eq!(a, b, "Same coordinates should produce same keys");
    }

    #[test]
    fn spatial_keys_nearby_coords_share_cells() {
        // Two points ~100m apart in London should share at least one cell at res 8.
        let a = spatial_keys_from_coords(51.5074, -0.1278, 8, 1);
        let b = spatial_keys_from_coords(51.5075, -0.1279, 8, 1);
        let shared = a.iter().filter(|k| b.contains(k)).count();
        assert!(shared > 0, "Nearby points should share H3 cells");
    }

    #[test]
    fn spatial_keys_distant_coords_no_overlap() {
        // London vs Tokyo at res 8 k=1 should not overlap.
        let london = spatial_keys_from_coords(51.5074, -0.1278, 8, 1);
        let tokyo = spatial_keys_from_coords(35.6762, 139.6503, 8, 1);
        let shared = london.iter().filter(|k| tokyo.contains(k)).count();
        assert_eq!(shared, 0, "Distant points should not share H3 cells");
    }

    // -- Real spectral key --

    #[test]
    fn spectral_key_from_freq_basic() {
        // 1090 MHz ADS-B in 10 MHz bands → band 109.
        let key = spectral_key_from_freq(1090.0, 10.0);
        assert_eq!(key, "f_109");
    }

    #[test]
    fn spectral_key_from_freq_narrow_band() {
        // 162.025 MHz VHF in 2 MHz bands → band 81.
        let key = spectral_key_from_freq(162.025, 2.0);
        assert_eq!(key, "f_81");
    }

    #[test]
    fn spectral_key_same_band() {
        // Two frequencies in the same band should get the same key.
        let a = spectral_key_from_freq(161.975, 2.0);
        let b = spectral_key_from_freq(161.5, 2.0);
        assert_eq!(a, b, "Frequencies in the same band should have the same key");
    }

    #[test]
    fn spectral_key_different_bands() {
        let a = spectral_key_from_freq(161.0, 2.0);
        let b = spectral_key_from_freq(163.0, 2.0);
        assert_ne!(a, b, "Frequencies in different bands should differ");
    }
}
