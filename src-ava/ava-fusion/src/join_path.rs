//! Join path types for the fusion ontology.
//!
//! Defines [`JoinType`], [`FusionTier`], [`OutputType`], [`JoinPathEntry`]
//! (v1), and [`JoinPathEntryV2`] (with R1-R8 extension fields).
//!
//! Source: TSGC-001 Section 6 + TSGC-001-v2 Section 11.

use serde::{Deserialize, Serialize};
use typeshare::typeshare;

use crate::{DataType, SignalKind};

// ---------------------------------------------------------------------------
// JoinType — fusion predicate dimension
// ---------------------------------------------------------------------------

/// The predicate dimension used for a join path.
///
/// Each variant corresponds to a distinct correlation mechanism between
/// two signal collections.
#[typeshare]
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum JoinType {
    /// Shared identifier (ICAO hex, MMSI, IP, domain, STIX ID).
    Identity,
    /// Geographic proximity (haversine distance).
    Spatial,
    /// Temporal proximity (time window overlap).
    Temporal,
    /// RF spectral proximity (frequency band matching).
    Spectral,
    /// Named entity / IOC overlap (Jaccard coefficient).
    Semantic,
    /// Velocity/maneuver pattern similarity (DTW, cosine).
    Behavioral,
    /// Tier 3 statistical correlation (R8).
    Statistical,
}

// ---------------------------------------------------------------------------
// FusionTier — confidence tier classification
// ---------------------------------------------------------------------------

/// Fusion tier classification by confidence semantics and computational cost.
///
/// - Tier 1: Hard keys (deterministic identity), C ~ 0.99.
/// - Tier 2: Soft keys (probabilistic correlation), C = 0.0-0.99.
/// - Tier 3: Derived keys (emergent statistical correlation), C = variable.
#[typeshare]
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum FusionTier {
    /// Hard keys — shared identifier, C ~ 0.99.
    Tier1Kinematic,
    /// Soft keys — proximity predicates, C < 0.99.
    Tier2Attribute,
    /// Derived keys — statistical patterns, C = variable.
    Tier3Behavioral,
}

// ---------------------------------------------------------------------------
// OutputType — fusion result classification
// ---------------------------------------------------------------------------

/// Classification of a fusion result by its semantic meaning.
///
/// Determines how the downstream visualisation layer renders the output:
/// merged entities share a node; correlated entities share an edge.
#[typeshare]
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum OutputType {
    /// Two signals describe the same entity (identity merge).
    FusedTrack,
    /// Two signals are related but describe distinct entities.
    CorrelatedPair,
    /// Expected signal missing — negative-space detection (R2).
    AbsenceEvent,
    /// Ordered temporal pattern matched (R9).
    SequenceMatch,
    /// One signal enriches another with context.
    Enrichment,
    /// Identifier discrepancy flagged.
    Flag,
}

// ---------------------------------------------------------------------------
// JoinSide — which side of the join a signal belongs to
// ---------------------------------------------------------------------------

/// Identifies the left or right side of a join path.
#[typeshare]
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum JoinSide {
    Left,
    Right,
}

// ---------------------------------------------------------------------------
// JoinMode — windowed vs event-table (R1/R6 reconciliation)
// ---------------------------------------------------------------------------

/// Temporal join mode for dual-purpose join paths.
///
/// Some paths (e.g. OSINT x OSINT) support both windowed co-temporal
/// correlation and event-table enrichment. Operators select per scenario.
#[typeshare]
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum JoinMode {
    /// Both sides are event streams; time-bucketed windowed join.
    Windowed,
    /// Fast side probes slow side's latest snapshot.
    EventTable,
}

// ---------------------------------------------------------------------------
// EnabledState — declarative on/off
// ---------------------------------------------------------------------------

/// Whether a join path is enabled or disabled.
#[typeshare]
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum EnabledState {
    Enabled,
    Disabled,
}

// ---------------------------------------------------------------------------
// PairBlocking — per-dimension blocking flags
// ---------------------------------------------------------------------------

/// Per-dimension blocking flags for a join path.
///
/// When a dimension is `true`, the blocking strategy partitions candidates
/// along that axis before evaluating predicates.
#[typeshare]
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PairBlocking {
    pub spatial: bool,
    pub temporal: bool,
    pub spectral: bool,
}

// ---------------------------------------------------------------------------
// JoinPathSide — one side of a join path
// ---------------------------------------------------------------------------

/// Configuration for one side of a join path (left or right).
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JoinPathSide {
    /// Signal kind for this side (e.g. ADS-B, AIS).
    pub signal_kind: SignalKind,
    /// JSONPath-like key expression for the join key.
    pub key_path: String,
    /// Whether this side is an event stream or reference table (R5).
    pub data_type: DataType,
}

// ---------------------------------------------------------------------------
// JoinPathEntry — v1 (TSGC-001 §6.2)
// ---------------------------------------------------------------------------

/// A declarative join path entry in the fusion ontology (v1).
///
/// Each entry tells d2ts which collection pair is valid and what
/// predicates govern the join. Disabling a path removes the operator
/// from the dataflow graph; d2ts recomputes incrementally.
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JoinPathEntry {
    /// Unique join path identifier.
    pub id: String,
    /// Left side of the join.
    pub left: JoinPathSide,
    /// Right side of the join.
    pub right: JoinPathSide,
    /// Primary predicate dimension for this join.
    pub join_type: JoinType,
    /// Fusion tier (1, 2, or 3).
    pub tier: FusionTier,
    /// Output classification for fusion results.
    pub output: OutputType,
    /// Whether this join path is currently active.
    pub enabled: EnabledState,
    /// Optional identity resolver name.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub resolver: Option<String>,
}

// ---------------------------------------------------------------------------
// JoinPathEntryV2 — v2 with R1-R8 extension fields
// ---------------------------------------------------------------------------

/// Extended join path entry (v2) with temporal, blocking, Tier 3,
/// and join-mode configuration fields (R1-R8).
///
/// Source: TSGC-001-v2 §11.1.
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JoinPathEntryV2 {
    /// Unique join path identifier.
    pub id: String,
    /// Left side of the join.
    pub left: JoinPathSide,
    /// Right side of the join.
    pub right: JoinPathSide,
    /// Primary predicate dimension for this join.
    pub join_type: JoinType,
    /// Fusion tier (1, 2, or 3).
    pub tier: FusionTier,
    /// Output classification for fusion results.
    pub output: OutputType,
    /// Whether this join path is currently active.
    pub enabled: EnabledState,
    /// Optional identity resolver name.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub resolver: Option<String>,
    /// Per-dimension blocking configuration (R6).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub blocking: Option<PairBlocking>,
    /// Temporal join window size in milliseconds (R1).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temporal_window_ms: Option<u64>,
    /// Late arrival policy (R1).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub late_arrival_policy: Option<String>,
    /// Confidence model override (R4.3); defaults to ontology-level model.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub confidence_model: Option<String>,
    /// Tier 3 statistical method (R8); only set when tier = Tier3Behavioral.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tier3_method: Option<String>,
    /// Join mode for dual-purpose paths (R1/R6 reconciliation).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub join_mode: Option<JoinMode>,
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    fn make_test_side(kind: SignalKind) -> JoinPathSide {
        JoinPathSide {
            signal_kind: kind,
            key_path: "payload.icao".into(),
            data_type: DataType::Event,
        }
    }

    // -- JoinType --

    #[test]
    fn join_type_all_variants_roundtrip() {
        let variants = [
            JoinType::Identity,
            JoinType::Spatial,
            JoinType::Temporal,
            JoinType::Spectral,
            JoinType::Semantic,
            JoinType::Behavioral,
            JoinType::Statistical,
        ];
        for jt in variants {
            let json = serde_json::to_string(&jt).unwrap();
            let parsed: JoinType = serde_json::from_str(&json).unwrap();
            assert_eq!(parsed, jt);
        }
    }

    #[test]
    fn join_type_json_shape() {
        let json = serde_json::to_string(&JoinType::Statistical).unwrap();
        assert_eq!(json, "\"statistical\"");
    }

    // -- FusionTier --

    #[test]
    fn fusion_tier_all_variants_roundtrip() {
        let variants = [
            FusionTier::Tier1Kinematic,
            FusionTier::Tier2Attribute,
            FusionTier::Tier3Behavioral,
        ];
        for tier in variants {
            let json = serde_json::to_string(&tier).unwrap();
            let parsed: FusionTier = serde_json::from_str(&json).unwrap();
            assert_eq!(parsed, tier);
        }
    }

    // -- OutputType --

    #[test]
    fn output_type_all_variants_roundtrip() {
        let variants = [
            OutputType::FusedTrack,
            OutputType::CorrelatedPair,
            OutputType::AbsenceEvent,
            OutputType::SequenceMatch,
            OutputType::Enrichment,
            OutputType::Flag,
        ];
        for ot in variants {
            let json = serde_json::to_string(&ot).unwrap();
            let parsed: OutputType = serde_json::from_str(&json).unwrap();
            assert_eq!(parsed, ot);
        }
    }

    // -- EnabledState --

    #[test]
    fn enabled_state_roundtrip() {
        for es in [EnabledState::Enabled, EnabledState::Disabled] {
            let json = serde_json::to_string(&es).unwrap();
            let parsed: EnabledState = serde_json::from_str(&json).unwrap();
            assert_eq!(parsed, es);
        }
    }

    // -- JoinMode --

    #[test]
    fn join_mode_roundtrip() {
        for jm in [JoinMode::Windowed, JoinMode::EventTable] {
            let json = serde_json::to_string(&jm).unwrap();
            let parsed: JoinMode = serde_json::from_str(&json).unwrap();
            assert_eq!(parsed, jm);
        }
    }

    #[test]
    fn join_mode_json_shape() {
        let json = serde_json::to_string(&JoinMode::EventTable).unwrap();
        assert_eq!(json, "\"eventTable\"");
    }

    // -- PairBlocking --

    #[test]
    fn pair_blocking_serde_roundtrip() {
        let pb = PairBlocking {
            spatial: true,
            temporal: true,
            spectral: false,
        };
        let json = serde_json::to_string(&pb).unwrap();
        let parsed: PairBlocking = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, pb);
    }

    // -- JoinPathSide --

    #[test]
    fn join_path_side_serde_roundtrip() {
        let side = make_test_side(SignalKind::AdsB);
        let json = serde_json::to_string(&side).unwrap();
        assert!(json.contains("\"signalKind\""));
        assert!(json.contains("\"keyPath\""));
        assert!(json.contains("\"dataType\""));
        let parsed: JoinPathSide = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, side);
    }

    // -- JoinPathEntry (v1) --

    #[test]
    fn join_path_entry_v1_serde_roundtrip() {
        let entry = JoinPathEntry {
            id: "adsb-x-adsb-dedup".into(),
            left: make_test_side(SignalKind::AdsB),
            right: make_test_side(SignalKind::AdsB),
            join_type: JoinType::Identity,
            tier: FusionTier::Tier1Kinematic,
            output: OutputType::FusedTrack,
            enabled: EnabledState::Enabled,
            resolver: None,
        };
        let json = serde_json::to_string(&entry).unwrap();
        assert!(json.contains("\"joinType\""));
        assert!(!json.contains("\"resolver\"")); // None -> omitted
        let parsed: JoinPathEntry = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.id, entry.id);
        assert_eq!(parsed.join_type, JoinType::Identity);
        assert_eq!(parsed.resolver, None);
    }

    #[test]
    fn join_path_entry_v1_with_resolver() {
        let entry = JoinPathEntry {
            id: "adsb-x-faa".into(),
            left: make_test_side(SignalKind::AdsB),
            right: JoinPathSide {
                signal_kind: SignalKind::Custom,
                key_path: "icao_hex".into(),
                data_type: DataType::Reference,
            },
            join_type: JoinType::Identity,
            tier: FusionTier::Tier1Kinematic,
            output: OutputType::Enrichment,
            enabled: EnabledState::Enabled,
            resolver: Some("faa-registry-lookup".into()),
        };
        let json = serde_json::to_string(&entry).unwrap();
        assert!(json.contains("\"resolver\""));
        assert!(json.contains("faa-registry-lookup"));
        let parsed: JoinPathEntry = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.resolver, Some("faa-registry-lookup".into()));
    }

    // -- JoinPathEntryV2 --

    #[test]
    fn join_path_entry_v2_serde_roundtrip() {
        let entry = JoinPathEntryV2 {
            id: "adsb-x-ais".into(),
            left: make_test_side(SignalKind::AdsB),
            right: JoinPathSide {
                signal_kind: SignalKind::Ais,
                key_path: "metadata.geo".into(),
                data_type: DataType::Event,
            },
            join_type: JoinType::Spatial,
            tier: FusionTier::Tier2Attribute,
            output: OutputType::CorrelatedPair,
            enabled: EnabledState::Enabled,
            resolver: None,
            blocking: Some(PairBlocking {
                spatial: true,
                temporal: true,
                spectral: false,
            }),
            temporal_window_ms: Some(10_000),
            late_arrival_policy: Some("drop".into()),
            confidence_model: None,
            tier3_method: None,
            join_mode: Some(JoinMode::Windowed),
        };
        let json = serde_json::to_string(&entry).unwrap();
        assert!(json.contains("\"temporalWindowMs\""));
        assert!(json.contains("\"joinMode\""));
        let parsed: JoinPathEntryV2 = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.id, entry.id);
        assert_eq!(parsed.temporal_window_ms, Some(10_000));
        assert_eq!(parsed.join_mode, Some(JoinMode::Windowed));
    }

    #[test]
    fn join_path_entry_v2_optional_fields_omitted() {
        let entry = JoinPathEntryV2 {
            id: "minimal".into(),
            left: make_test_side(SignalKind::Http),
            right: make_test_side(SignalKind::Dns),
            join_type: JoinType::Identity,
            tier: FusionTier::Tier1Kinematic,
            output: OutputType::FusedTrack,
            enabled: EnabledState::Enabled,
            resolver: None,
            blocking: None,
            temporal_window_ms: None,
            late_arrival_policy: None,
            confidence_model: None,
            tier3_method: None,
            join_mode: None,
        };
        let json = serde_json::to_string(&entry).unwrap();
        assert!(!json.contains("\"resolver\""));
        assert!(!json.contains("\"blocking\""));
        assert!(!json.contains("\"temporalWindowMs\""));
        assert!(!json.contains("\"tier3Method\""));
        assert!(!json.contains("\"joinMode\""));
    }
}
