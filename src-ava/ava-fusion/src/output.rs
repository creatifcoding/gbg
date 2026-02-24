//! Fusion output types and asupersync mirror types.
//!
//! Defines [`FusedDatum`] and [`CorrelatedPair`] from TSGC-001 §5, plus
//! asupersync mirror types: [`FusionOutcome`], [`FusionSeverity`],
//! [`FusionObligationKind`], and [`FusionObligationState`].
//!
//! The mirror types are serde-friendly projections of asupersync's
//! `Outcome<T,E>`, `ObligationKind`, and `ObligationState` for
//! TypeScript/WASM consumers. They preserve the four-valued severity
//! lattice semantics without depending on the asupersync runtime crate.
//!
//! Source: TSGC-001 §5, asupersync::Outcome, asupersync::GradedObligation.

use serde::{Deserialize, Serialize};
use typeshare::typeshare;

use crate::{GeoPoint, JoinType};

// ===========================================================================
// Domain output types (TSGC-001 §5)
// ===========================================================================

// ---------------------------------------------------------------------------
// FusedDatum — a fused track output
// ---------------------------------------------------------------------------

/// A fused track datum — the primary output of Tier 1/2 fusion.
///
/// Represents a single entity observation aggregated from multiple
/// signal sources with a combined confidence score.
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FusedDatum {
    /// Fused track identifier.
    pub track_id: String,
    /// Fused geographic position (weighted by per-source confidence).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub position: Option<GeoPoint>,
    /// Observation timestamp (epoch milliseconds).
    pub timestamp_ms: u64,
    /// Combined confidence score (0.01-0.99).
    pub confidence: f64,
    /// Signal source IDs that contributed to this datum.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub contributing_sources: Vec<String>,
}

// ---------------------------------------------------------------------------
// CorrelatedPair — a correlation output (not identity merge)
// ---------------------------------------------------------------------------

/// A correlated pair output — two entities that are related but
/// NOT the same (TSGC-001 §5.1).
///
/// Correlations are rendered as edges in the visualisation layer,
/// distinct from merged entities which share a single node.
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CorrelatedPair {
    /// Signal source ID for the left side of the correlation.
    pub left_source: String,
    /// Signal source ID for the right side of the correlation.
    pub right_source: String,
    /// Correlation score (0.0-1.0).
    pub correlation_score: f64,
    /// Join type that produced this correlation.
    pub join_type: JoinType,
}

// ===========================================================================
// asupersync mirror types
// ===========================================================================

// ---------------------------------------------------------------------------
// FusionOutcome<T, E> — four-valued severity lattice
// ---------------------------------------------------------------------------

/// Serde-friendly mirror of `asupersync::Outcome<T, E>`.
///
/// Four-valued severity lattice: `Ok < Err < Cancelled < Panicked`.
/// The worst outcome takes precedence in monotone aggregation.
///
/// Serialises as internally tagged JSON:
/// ```json
/// { "status": "ok", "content": <T> }
/// { "status": "err", "content": <E> }
/// { "status": "cancelled", "content": { "reason": "..." } }
/// { "status": "panicked", "content": { "message": "..." } }
/// ```
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", tag = "status", content = "content")]
pub enum FusionOutcome<T, E> {
    /// Successful completion.
    Ok(T),
    /// Application-level error.
    Err(E),
    /// Operation was externally cancelled.
    Cancelled {
        /// Cancellation reason (e.g. timeout, fail-fast, parent cancelled).
        reason: String,
    },
    /// Unrecoverable panic.
    Panicked {
        /// Panic payload message.
        message: String,
    },
}

impl<T, E> FusionOutcome<T, E> {
    /// Returns the severity level of this outcome.
    pub fn severity(&self) -> FusionSeverity {
        match self {
            FusionOutcome::Ok(_) => FusionSeverity::Ok,
            FusionOutcome::Err(_) => FusionSeverity::Err,
            FusionOutcome::Cancelled { .. } => FusionSeverity::Cancelled,
            FusionOutcome::Panicked { .. } => FusionSeverity::Panicked,
        }
    }

    /// Returns `true` if this outcome is `Ok`.
    pub fn is_ok(&self) -> bool {
        matches!(self, FusionOutcome::Ok(_))
    }
}

// ---------------------------------------------------------------------------
// FusionSeverity — explicit severity ordering
// ---------------------------------------------------------------------------

/// Severity level for a `FusionOutcome`, defining the monotone ordering.
///
/// `Ok(0) < Err(1) < Cancelled(2) < Panicked(3)`.
/// The worst severity takes precedence when aggregating outcomes.
#[typeshare]
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum FusionSeverity {
    Ok = 0,
    Err = 1,
    Cancelled = 2,
    Panicked = 3,
}

// ---------------------------------------------------------------------------
// FusionObligationKind — obligation type taxonomy
// ---------------------------------------------------------------------------

/// Mirror of `asupersync::ObligationKind`.
///
/// Classifies the type of resource obligation that must be resolved
/// before its owning region can close.
#[typeshare]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum FusionObligationKind {
    /// A send permit for a channel.
    SendPermit,
    /// An acknowledgement for a received message.
    Ack,
    /// A lease for a remote resource.
    Lease,
    /// A pending I/O operation.
    IoOp,
}

impl FusionObligationKind {
    /// All variants in declaration order.
    pub const ALL: [FusionObligationKind; 4] = [
        FusionObligationKind::SendPermit,
        FusionObligationKind::Ack,
        FusionObligationKind::Lease,
        FusionObligationKind::IoOp,
    ];
}

// ---------------------------------------------------------------------------
// FusionObligationState — obligation lifecycle
// ---------------------------------------------------------------------------

/// Mirror of `asupersync::ObligationState`.
///
/// Lifecycle: `Reserved -> Committed | Aborted | Leaked`.
/// Terminal states: `Committed`, `Aborted`, `Leaked`.
/// `Leaked` indicates an error — the obligation holder completed
/// without resolving the obligation.
#[typeshare]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum FusionObligationState {
    /// Obligation is reserved but not yet resolved.
    Reserved,
    /// Obligation was committed (successful resolution).
    Committed,
    /// Obligation was aborted (clean cancellation).
    Aborted,
    /// ERROR: Obligation was leaked (holder completed without resolving).
    Leaked,
}

// ===========================================================================
// Tests
// ===========================================================================

#[cfg(test)]
mod tests {
    use super::*;

    // -----------------------------------------------------------------------
    // FusedDatum
    // -----------------------------------------------------------------------

    #[test]
    fn fused_datum_serde_roundtrip() {
        let datum = FusedDatum {
            track_id: "track-001".into(),
            position: Some(GeoPoint::new(33.748, -84.388)),
            timestamp_ms: 1_700_000_000_000,
            confidence: 0.85,
            contributing_sources: vec!["adsb-rx-1".into(), "radar-2".into()],
        };
        let json = serde_json::to_string(&datum).unwrap();
        assert!(json.contains("\"trackId\""));
        assert!(json.contains("\"contributingSources\""));
        let parsed: FusedDatum = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, datum);
    }

    #[test]
    fn fused_datum_optional_fields_omitted() {
        let datum = FusedDatum {
            track_id: "track-002".into(),
            position: None,
            timestamp_ms: 0,
            confidence: 0.5,
            contributing_sources: vec![],
        };
        let json = serde_json::to_string(&datum).unwrap();
        assert!(!json.contains("\"position\""));
        assert!(!json.contains("\"contributingSources\""));
    }

    // -----------------------------------------------------------------------
    // CorrelatedPair
    // -----------------------------------------------------------------------

    #[test]
    fn correlated_pair_serde_roundtrip() {
        let pair = CorrelatedPair {
            left_source: "adsb-rx-1".into(),
            right_source: "ais-rx-1".into(),
            correlation_score: 0.72,
            join_type: JoinType::Spatial,
        };
        let json = serde_json::to_string(&pair).unwrap();
        assert!(json.contains("\"leftSource\""));
        assert!(json.contains("\"rightSource\""));
        assert!(json.contains("\"correlationScore\""));
        assert!(json.contains("\"joinType\""));
        let parsed: CorrelatedPair = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, pair);
    }

    // -----------------------------------------------------------------------
    // FusionOutcome
    // -----------------------------------------------------------------------

    #[test]
    fn fusion_outcome_ok_serde_roundtrip() {
        let outcome: FusionOutcome<String, String> =
            FusionOutcome::Ok("success".into());
        let json = serde_json::to_string(&outcome).unwrap();
        assert!(json.contains("\"status\":\"ok\""));
        assert!(json.contains("\"content\":\"success\""));
        let parsed: FusionOutcome<String, String> =
            serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, outcome);
    }

    #[test]
    fn fusion_outcome_err_serde_roundtrip() {
        let outcome: FusionOutcome<String, String> =
            FusionOutcome::Err("timeout".into());
        let json = serde_json::to_string(&outcome).unwrap();
        assert!(json.contains("\"status\":\"err\""));
        let parsed: FusionOutcome<String, String> =
            serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, outcome);
    }

    #[test]
    fn fusion_outcome_cancelled_serde_roundtrip() {
        let outcome: FusionOutcome<String, String> = FusionOutcome::Cancelled {
            reason: "parent cancelled".into(),
        };
        let json = serde_json::to_string(&outcome).unwrap();
        assert!(json.contains("\"status\":\"cancelled\""));
        assert!(json.contains("\"reason\":\"parent cancelled\""));
        let parsed: FusionOutcome<String, String> =
            serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, outcome);
    }

    #[test]
    fn fusion_outcome_panicked_serde_roundtrip() {
        let outcome: FusionOutcome<String, String> = FusionOutcome::Panicked {
            message: "stack overflow".into(),
        };
        let json = serde_json::to_string(&outcome).unwrap();
        assert!(json.contains("\"status\":\"panicked\""));
        assert!(json.contains("\"message\":\"stack overflow\""));
        let parsed: FusionOutcome<String, String> =
            serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, outcome);
    }

    #[test]
    fn fusion_outcome_severity() {
        let ok: FusionOutcome<(), ()> = FusionOutcome::Ok(());
        let err: FusionOutcome<(), ()> = FusionOutcome::Err(());
        let cancelled: FusionOutcome<(), ()> = FusionOutcome::Cancelled {
            reason: "test".into(),
        };
        let panicked: FusionOutcome<(), ()> = FusionOutcome::Panicked {
            message: "test".into(),
        };
        assert_eq!(ok.severity(), FusionSeverity::Ok);
        assert_eq!(err.severity(), FusionSeverity::Err);
        assert_eq!(cancelled.severity(), FusionSeverity::Cancelled);
        assert_eq!(panicked.severity(), FusionSeverity::Panicked);
    }

    #[test]
    fn fusion_outcome_is_ok() {
        let ok: FusionOutcome<i32, String> = FusionOutcome::Ok(42);
        let err: FusionOutcome<i32, String> = FusionOutcome::Err("fail".into());
        assert!(ok.is_ok());
        assert!(!err.is_ok());
    }

    // -----------------------------------------------------------------------
    // FusionSeverity
    // -----------------------------------------------------------------------

    #[test]
    fn fusion_severity_ordering() {
        assert!(FusionSeverity::Ok < FusionSeverity::Err);
        assert!(FusionSeverity::Err < FusionSeverity::Cancelled);
        assert!(FusionSeverity::Cancelled < FusionSeverity::Panicked);
    }

    #[test]
    fn fusion_severity_serde_roundtrip() {
        let variants = [
            FusionSeverity::Ok,
            FusionSeverity::Err,
            FusionSeverity::Cancelled,
            FusionSeverity::Panicked,
        ];
        for sev in variants {
            let json = serde_json::to_string(&sev).unwrap();
            let parsed: FusionSeverity = serde_json::from_str(&json).unwrap();
            assert_eq!(parsed, sev);
        }
    }

    #[test]
    fn fusion_severity_json_shape() {
        let json = serde_json::to_string(&FusionSeverity::Panicked).unwrap();
        assert_eq!(json, "\"panicked\"");
    }

    // -----------------------------------------------------------------------
    // FusionObligationKind
    // -----------------------------------------------------------------------

    #[test]
    fn fusion_obligation_kind_all_variants_roundtrip() {
        for kind in FusionObligationKind::ALL {
            let json = serde_json::to_string(&kind).unwrap();
            let parsed: FusionObligationKind = serde_json::from_str(&json).unwrap();
            assert_eq!(parsed, kind);
        }
    }

    #[test]
    fn fusion_obligation_kind_screaming_snake() {
        let json = serde_json::to_string(&FusionObligationKind::SendPermit).unwrap();
        assert_eq!(json, "\"SEND_PERMIT\"");
        let json = serde_json::to_string(&FusionObligationKind::IoOp).unwrap();
        assert_eq!(json, "\"IO_OP\"");
    }

    // -----------------------------------------------------------------------
    // FusionObligationState
    // -----------------------------------------------------------------------

    #[test]
    fn fusion_obligation_state_all_variants_roundtrip() {
        let variants = [
            FusionObligationState::Reserved,
            FusionObligationState::Committed,
            FusionObligationState::Aborted,
            FusionObligationState::Leaked,
        ];
        for state in variants {
            let json = serde_json::to_string(&state).unwrap();
            let parsed: FusionObligationState = serde_json::from_str(&json).unwrap();
            assert_eq!(parsed, state);
        }
    }

    #[test]
    fn fusion_obligation_state_json_shape() {
        let json = serde_json::to_string(&FusionObligationState::Reserved).unwrap();
        assert_eq!(json, "\"reserved\"");
        let json = serde_json::to_string(&FusionObligationState::Leaked).unwrap();
        assert_eq!(json, "\"leaked\"");
    }
}
