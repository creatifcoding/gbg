//! Signal classification types for the fusion ontology.
//!
//! Defines [`SignalKind`] (20 signal source categories), [`DataType`]
//! (event vs reference), [`UpdateRate`], and [`ReferenceSource`] (R5).

use serde::{Deserialize, Serialize};

// ---------------------------------------------------------------------------
// SignalKind — 20 variants from TSGC-001 Section 2
// ---------------------------------------------------------------------------

/// Classification of a signal source by its collection method.
///
/// Each variant corresponds to a distinct data collection modality.
/// Signal kinds determine valid join paths in the fusion ontology —
/// the "Observable By" column in the Entity Class table (TSGC-001 §2).
#[typeshare::typeshare]
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SignalKind {
    /// ADS-B (Automatic Dependent Surveillance – Broadcast) — aircraft transponder.
    AdsB,
    /// AIS (Automatic Identification System) — maritime vessel transponder.
    Ais,
    /// Primary/secondary radar returns.
    Radar,
    /// RF direction-finding bearing measurement.
    RfBearing,
    /// Software-defined radio raw signal capture.
    Sdr,
    /// HTTP/HTTPS request/response metadata and payloads.
    Http,
    /// DNS query/response records.
    Dns,
    /// Satellite imagery or overhead sensor data.
    Satellite,
    /// Geospatial intelligence (imagery analysis products).
    Geoint,
    /// Human intelligence reports.
    Humint,
    /// Signals intelligence (general).
    Sigint,
    /// Electronic intelligence (radar/nav signal characterisation).
    Elint,
    /// Communications intelligence (intercepted comms metadata).
    Comint,
    /// Open-source intelligence (RSS, social media, news).
    Osint,
    /// Measurement and signature intelligence.
    Masint,
    /// Cyber threat indicators (STIX CTI, IOCs, malware analysis).
    Cyber,
    /// Social media–derived signals (handles, posts, network graphs).
    Social,
    /// Financial transaction and sanctions data.
    Financial,
    /// Travel records (passenger manifests, border crossings).
    Travel,
    /// Operator-defined custom signal kind.
    Custom,
}

impl SignalKind {
    /// All variants in declaration order.
    pub const ALL: [SignalKind; 20] = [
        SignalKind::AdsB,
        SignalKind::Ais,
        SignalKind::Radar,
        SignalKind::RfBearing,
        SignalKind::Sdr,
        SignalKind::Http,
        SignalKind::Dns,
        SignalKind::Satellite,
        SignalKind::Geoint,
        SignalKind::Humint,
        SignalKind::Sigint,
        SignalKind::Elint,
        SignalKind::Comint,
        SignalKind::Osint,
        SignalKind::Masint,
        SignalKind::Cyber,
        SignalKind::Social,
        SignalKind::Financial,
        SignalKind::Travel,
        SignalKind::Custom,
    ];
}

impl std::fmt::Display for SignalKind {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SignalKind::AdsB => f.write_str("ADS-B"),
            SignalKind::Ais => f.write_str("AIS"),
            SignalKind::Radar => f.write_str("Radar"),
            SignalKind::RfBearing => f.write_str("RF Bearing"),
            SignalKind::Sdr => f.write_str("SDR"),
            SignalKind::Http => f.write_str("HTTP"),
            SignalKind::Dns => f.write_str("DNS"),
            SignalKind::Satellite => f.write_str("Satellite"),
            SignalKind::Geoint => f.write_str("GEOINT"),
            SignalKind::Humint => f.write_str("HUMINT"),
            SignalKind::Sigint => f.write_str("SIGINT"),
            SignalKind::Elint => f.write_str("ELINT"),
            SignalKind::Comint => f.write_str("COMINT"),
            SignalKind::Osint => f.write_str("OSINT"),
            SignalKind::Masint => f.write_str("MASINT"),
            SignalKind::Cyber => f.write_str("Cyber"),
            SignalKind::Social => f.write_str("Social"),
            SignalKind::Financial => f.write_str("Financial"),
            SignalKind::Travel => f.write_str("Travel"),
            SignalKind::Custom => f.write_str("Custom"),
        }
    }
}

// ---------------------------------------------------------------------------
// DataType — R5 event/reference duality
// ---------------------------------------------------------------------------

/// Classifies a signal source as event-stream or reference-table data (R5).
///
/// This distinction determines the d2ts join strategy:
/// - `Event`: volatile, append-only, timestamped (differential stream)
/// - `Reference`: stable, slowly-changing, lookup-keyed (materialised arrangement)
#[typeshare::typeshare]
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum DataType {
    /// Volatile event stream (ADS-B, AIS, HTTP, RF, OSINT).
    Event,
    /// Stable reference/registry data (FAA, ITU, ASN, WHOIS, STIX feeds).
    Reference,
}

impl std::fmt::Display for DataType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            DataType::Event => f.write_str("event"),
            DataType::Reference => f.write_str("reference"),
        }
    }
}

// ---------------------------------------------------------------------------
// UpdateRate — reference data refresh cadence
// ---------------------------------------------------------------------------

/// Refresh cadence for reference data sources (R5 §5.4).
#[typeshare::typeshare]
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum UpdateRate {
    /// Never changes after initial load.
    Static,
    /// Refreshed approximately once per day.
    Daily,
    /// Refreshed approximately once per hour.
    Hourly,
    /// Refreshed every few minutes.
    Minutes,
    /// Refreshed every few seconds (high-rate reference stream).
    Seconds,
}

impl std::fmt::Display for UpdateRate {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            UpdateRate::Static => f.write_str("static"),
            UpdateRate::Daily => f.write_str("daily"),
            UpdateRate::Hourly => f.write_str("hourly"),
            UpdateRate::Minutes => f.write_str("minutes"),
            UpdateRate::Seconds => f.write_str("seconds"),
        }
    }
}

// ---------------------------------------------------------------------------
// ReferenceSource — R5 §5.4
// ---------------------------------------------------------------------------

/// Registration record for a reference data source in the fusion ontology.
///
/// Reference sources are materialised as d2ts arrangements providing
/// O(1) lookups per incoming event.
///
/// Schema mirrors TSGC-001-v2 §5.4 `ReferenceSource`.
#[typeshare::typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReferenceSource {
    /// Unique source identifier (e.g. "faa-registry").
    pub id: String,
    /// Signal kind produced by this source (e.g. "faa-db").
    pub signal_kind: String,
    /// Entity class this source describes (e.g. "Aircraft").
    pub entity_class: String,
    /// Primary key field path used for lookups (e.g. "icao_hex").
    pub key_field: String,
    /// Expected update cadence.
    pub update_rate: UpdateRate,
    /// NATS subject pattern (e.g. "tsingou.ref.faa.*").
    pub nats_subject: String,
    /// Time-to-live in seconds before entries are considered stale.
    pub ttl_seconds: f64,
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    // -----------------------------------------------------------------------
    // SignalKind
    // -----------------------------------------------------------------------

    #[test]
    fn signal_kind_all_variants_roundtrip() {
        for kind in SignalKind::ALL {
            let json = serde_json::to_string(&kind).unwrap();
            let parsed: SignalKind = serde_json::from_str(&json).unwrap();
            assert_eq!(parsed, kind, "roundtrip failed for {kind:?}");
        }
    }

    #[test]
    fn signal_kind_count() {
        assert_eq!(SignalKind::ALL.len(), 20);
    }

    #[test]
    fn signal_kind_camel_case_serde() {
        // AdsB -> "adsB"
        let json = serde_json::to_string(&SignalKind::AdsB).unwrap();
        assert_eq!(json, "\"adsB\"");

        let json = serde_json::to_string(&SignalKind::RfBearing).unwrap();
        assert_eq!(json, "\"rfBearing\"");
    }

    #[test]
    fn signal_kind_copy() {
        let a = SignalKind::Ais;
        let b = a;
        assert_eq!(a, b);
    }

    // -----------------------------------------------------------------------
    // DataType
    // -----------------------------------------------------------------------

    #[test]
    fn data_type_serde_roundtrip() {
        for dt in [DataType::Event, DataType::Reference] {
            let json = serde_json::to_string(&dt).unwrap();
            let parsed: DataType = serde_json::from_str(&json).unwrap();
            assert_eq!(parsed, dt);
        }
    }

    #[test]
    fn data_type_camel_case() {
        let json = serde_json::to_string(&DataType::Event).unwrap();
        assert_eq!(json, "\"event\"");
        let json = serde_json::to_string(&DataType::Reference).unwrap();
        assert_eq!(json, "\"reference\"");
    }

    // -----------------------------------------------------------------------
    // UpdateRate
    // -----------------------------------------------------------------------

    #[test]
    fn update_rate_serde_roundtrip() {
        let rates = [
            UpdateRate::Static,
            UpdateRate::Daily,
            UpdateRate::Hourly,
            UpdateRate::Minutes,
            UpdateRate::Seconds,
        ];
        for rate in rates {
            let json = serde_json::to_string(&rate).unwrap();
            let parsed: UpdateRate = serde_json::from_str(&json).unwrap();
            assert_eq!(parsed, rate);
        }
    }

    // -----------------------------------------------------------------------
    // ReferenceSource
    // -----------------------------------------------------------------------

    #[test]
    fn reference_source_serde_roundtrip() {
        let src = ReferenceSource {
            id: "faa-registry".into(),
            signal_kind: "faa-db".into(),
            entity_class: "Aircraft".into(),
            key_field: "icao_hex".into(),
            update_rate: UpdateRate::Daily,
            nats_subject: "tsingou.ref.faa.*".into(),
            ttl_seconds: 86400.0,
        };
        let json = serde_json::to_string(&src).unwrap();
        assert!(json.contains("\"signalKind\":"));
        assert!(json.contains("\"entityClass\":"));
        assert!(json.contains("\"keyField\":"));
        assert!(json.contains("\"updateRate\":"));
        assert!(json.contains("\"natsSubject\":"));
        assert!(json.contains("\"ttlSeconds\":"));
        let parsed: ReferenceSource = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.id, src.id);
        assert_eq!(parsed.signal_kind, src.signal_kind);
        assert_eq!(parsed.update_rate, UpdateRate::Daily);
    }

    #[test]
    fn reference_source_camel_case_keys() {
        let src = ReferenceSource {
            id: "test".into(),
            signal_kind: "test-signal".into(),
            entity_class: "Vessel".into(),
            key_field: "mmsi".into(),
            update_rate: UpdateRate::Hourly,
            nats_subject: "tsingou.ref.test.*".into(),
            ttl_seconds: 3600.0,
        };
        let json = serde_json::to_string(&src).unwrap();
        // Verify camelCase: signalKind not signal_kind
        assert!(json.contains("\"signalKind\""));
        assert!(!json.contains("\"signal_kind\""));
        assert!(json.contains("\"entityClass\""));
        assert!(!json.contains("\"entity_class\""));
    }
}
