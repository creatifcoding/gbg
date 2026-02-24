//! Geographic point type for the fusion domain.
//!
//! [`GeoPoint`] represents a WGS-84 coordinate with optional altitude,
//! used throughout the ontology for spatial predicates and blocking.

use serde::{Deserialize, Serialize};

/// A WGS-84 geographic coordinate with optional altitude.
///
/// Used for spatial proximity predicates (haversine), H3 cell indexing,
/// and projected position under absence (R2 dead reckoning).
#[typeshare::typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GeoPoint {
    /// Latitude in decimal degrees (WGS-84). Range: -90.0 to 90.0.
    pub lat: f64,
    /// Longitude in decimal degrees (WGS-84). Range: -180.0 to 180.0.
    pub lon: f64,
    /// Altitude in metres above mean sea level. `None` for surface/unknown.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub alt_m: Option<f64>,
}

impl GeoPoint {
    /// Create a surface-level point (no altitude).
    pub fn new(lat: f64, lon: f64) -> Self {
        Self {
            lat,
            lon,
            alt_m: None,
        }
    }

    /// Create a point with altitude.
    pub fn with_altitude(lat: f64, lon: f64, alt_m: f64) -> Self {
        Self {
            lat,
            lon,
            alt_m: Some(alt_m),
        }
    }
}

impl std::fmt::Display for GeoPoint {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self.alt_m {
            Some(alt) => write!(f, "({:.6}, {:.6}, {:.1}m)", self.lat, self.lon, alt),
            None => write!(f, "({:.6}, {:.6})", self.lat, self.lon),
        }
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn geo_point_serde_roundtrip_no_alt() {
        let pt = GeoPoint::new(33.748, -84.388);
        let json = serde_json::to_string(&pt).unwrap();
        assert!(json.contains("\"lat\":"));
        assert!(json.contains("\"lon\":"));
        // altM should be omitted when None
        assert!(!json.contains("altM"));
        let parsed: GeoPoint = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.lat, pt.lat);
        assert_eq!(parsed.lon, pt.lon);
        assert_eq!(parsed.alt_m, None);
    }

    #[test]
    fn geo_point_serde_roundtrip_with_alt() {
        let pt = GeoPoint::with_altitude(51.5074, -0.1278, 30.0);
        let json = serde_json::to_string(&pt).unwrap();
        assert!(json.contains("\"altM\":"));
        let parsed: GeoPoint = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.lat, pt.lat);
        assert_eq!(parsed.lon, pt.lon);
        assert_eq!(parsed.alt_m, Some(30.0));
    }

    #[test]
    fn geo_point_camel_case_keys() {
        let pt = GeoPoint::with_altitude(0.0, 0.0, 100.0);
        let json = serde_json::to_string(&pt).unwrap();
        // Verify camelCase: altM not alt_m
        assert!(json.contains("\"altM\""));
        assert!(!json.contains("\"alt_m\""));
    }

    #[test]
    fn geo_point_display_no_alt() {
        let pt = GeoPoint::new(33.748, -84.388);
        let s = pt.to_string();
        assert!(s.contains("33.748"));
        assert!(s.contains("-84.388"));
        assert!(!s.contains('m'));
    }

    #[test]
    fn geo_point_display_with_alt() {
        let pt = GeoPoint::with_altitude(33.748, -84.388, 150.0);
        let s = pt.to_string();
        assert!(s.contains("150.0m"));
    }

    #[test]
    fn geo_point_deserialize_without_alt_field() {
        let json = r#"{"lat":10.0,"lon":20.0}"#;
        let pt: GeoPoint = serde_json::from_str(json).unwrap();
        assert_eq!(pt.lat, 10.0);
        assert_eq!(pt.lon, 20.0);
        assert_eq!(pt.alt_m, None);
    }
}
