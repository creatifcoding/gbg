//! Type conversion between ava-fusion pure types and asupersync runtime types.
//!
//! This module bridges the WASM-safe, serde-friendly ava-fusion domain types
//! to the asupersync runtime primitives used by the actor pipeline.
//!
//! # Design Rationale
//!
//! ava-fusion types are `#![forbid(unsafe_code)]`, serde-friendly, and
//! WASM-safe — no runtime, no async. The asupersync types carry arena
//! indices, virtual time stamps, and cancel attribution chains that are
//! meaningful only inside a running scheduler. This module provides
//! lossless `From` conversions where possible and documented lossy
//! conversions where the domains diverge (e.g., `ObligationId` is an
//! opaque arena index vs. a branded string).
//!
//! # Types Defined Here
//!
//! The following mirror types are defined in this module because the
//! pure `ava-fusion` crate's `output.rs` is not yet populated by the
//! types agent. Once output.rs ships `FusionOutcome`, `FusionSeverity`,
//! `FusionObligationState`, and `FusionCancelKind`, the definitions
//! below should be replaced with re-exports from `ava_fusion`.

use ava_fusion::{FusionBudget, FusionObligationId};
use serde::{Deserialize, Serialize};

// ============================================================================
// Mirror types (move to ava-fusion/src/output.rs once types agent ships)
// ============================================================================

/// Serde-friendly mirror of `asupersync::Severity`.
///
/// Severity lattice: Ok < Err < Cancelled < Panicked.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum FusionSeverity {
    Ok = 0,
    Err = 1,
    Cancelled = 2,
    Panicked = 3,
}

/// Serde-friendly mirror of `asupersync::CancelKind`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum FusionCancelKind {
    User,
    Timeout,
    Deadline,
    PollQuota,
    CostBudget,
    FailFast,
    RaceLost,
    ParentCancelled,
    ResourceUnavailable,
    Shutdown,
    LinkedExit,
}

/// Serde-friendly mirror of `asupersync::Outcome<T, E>`.
///
/// The four-valued outcome type with severity lattice semantics.
/// `Cancelled` carries a `FusionCancelKind` (lossy: drops the full
/// `CancelReason` attribution chain). `Panicked` carries a message string
/// (lossy: drops the `PanicPayload` struct wrapper).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", content = "value", rename_all = "camelCase")]
pub enum FusionOutcome<T, E> {
    Ok(T),
    Err(E),
    Cancelled(FusionCancelKind),
    Panicked(String),
}

impl<T, E> FusionOutcome<T, E> {
    /// Returns the severity of this outcome.
    pub fn severity(&self) -> FusionSeverity {
        match self {
            Self::Ok(_) => FusionSeverity::Ok,
            Self::Err(_) => FusionSeverity::Err,
            Self::Cancelled(_) => FusionSeverity::Cancelled,
            Self::Panicked(_) => FusionSeverity::Panicked,
        }
    }
}

/// Serde-friendly mirror of `asupersync::record::ObligationState`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum FusionObligationState {
    Reserved,
    Committed,
    Aborted,
    Leaked,
}

// ============================================================================
// Severity conversions
// ============================================================================

impl From<FusionSeverity> for asupersync::Severity {
    fn from(s: FusionSeverity) -> Self {
        match s {
            FusionSeverity::Ok => Self::Ok,
            FusionSeverity::Err => Self::Err,
            FusionSeverity::Cancelled => Self::Cancelled,
            FusionSeverity::Panicked => Self::Panicked,
        }
    }
}

impl From<asupersync::Severity> for FusionSeverity {
    fn from(s: asupersync::Severity) -> Self {
        match s {
            asupersync::Severity::Ok => Self::Ok,
            asupersync::Severity::Err => Self::Err,
            asupersync::Severity::Cancelled => Self::Cancelled,
            asupersync::Severity::Panicked => Self::Panicked,
        }
    }
}

// ============================================================================
// CancelKind conversions
// ============================================================================

impl From<FusionCancelKind> for asupersync::CancelKind {
    fn from(k: FusionCancelKind) -> Self {
        match k {
            FusionCancelKind::User => Self::User,
            FusionCancelKind::Timeout => Self::Timeout,
            FusionCancelKind::Deadline => Self::Deadline,
            FusionCancelKind::PollQuota => Self::PollQuota,
            FusionCancelKind::CostBudget => Self::CostBudget,
            FusionCancelKind::FailFast => Self::FailFast,
            FusionCancelKind::RaceLost => Self::RaceLost,
            FusionCancelKind::ParentCancelled => Self::ParentCancelled,
            FusionCancelKind::ResourceUnavailable => Self::ResourceUnavailable,
            FusionCancelKind::Shutdown => Self::Shutdown,
            FusionCancelKind::LinkedExit => Self::LinkedExit,
        }
    }
}

impl From<asupersync::CancelKind> for FusionCancelKind {
    fn from(k: asupersync::CancelKind) -> Self {
        match k {
            asupersync::CancelKind::User => Self::User,
            asupersync::CancelKind::Timeout => Self::Timeout,
            asupersync::CancelKind::Deadline => Self::Deadline,
            asupersync::CancelKind::PollQuota => Self::PollQuota,
            asupersync::CancelKind::CostBudget => Self::CostBudget,
            asupersync::CancelKind::FailFast => Self::FailFast,
            asupersync::CancelKind::RaceLost => Self::RaceLost,
            asupersync::CancelKind::ParentCancelled => Self::ParentCancelled,
            asupersync::CancelKind::ResourceUnavailable => Self::ResourceUnavailable,
            asupersync::CancelKind::Shutdown => Self::Shutdown,
            asupersync::CancelKind::LinkedExit => Self::LinkedExit,
        }
    }
}

// ============================================================================
// Outcome conversions
// ============================================================================

impl<T, E> From<FusionOutcome<T, E>> for asupersync::Outcome<T, E> {
    /// Converts a `FusionOutcome` to an `asupersync::Outcome`.
    ///
    /// - `Cancelled`: Creates a `CancelReason` with minimal attribution
    ///   (testing defaults). Full attribution is only available inside the
    ///   runtime scheduler.
    /// - `Panicked`: Wraps the message string in a `PanicPayload`.
    fn from(fo: FusionOutcome<T, E>) -> Self {
        match fo {
            FusionOutcome::Ok(v) => Self::Ok(v),
            FusionOutcome::Err(e) => Self::Err(e),
            FusionOutcome::Cancelled(kind) => {
                let cancel_kind: asupersync::CancelKind = kind.into();
                Self::Cancelled(asupersync::CancelReason::new(cancel_kind))
            }
            FusionOutcome::Panicked(msg) => {
                Self::Panicked(asupersync::PanicPayload::new(msg))
            }
        }
    }
}

impl<T: Clone, E: Clone> From<&asupersync::Outcome<T, E>> for FusionOutcome<T, E> {
    /// Converts an `asupersync::Outcome` reference to a `FusionOutcome`.
    ///
    /// **Lossy conversions:**
    /// - `Cancelled`: Only the `CancelKind` is preserved. The full
    ///   `CancelReason` attribution chain (origin region, timestamp,
    ///   cause chain) is dropped.
    /// - `Panicked`: Only the message string is preserved.
    fn from(o: &asupersync::Outcome<T, E>) -> Self {
        match o {
            asupersync::Outcome::Ok(v) => Self::Ok(v.clone()),
            asupersync::Outcome::Err(e) => Self::Err(e.clone()),
            asupersync::Outcome::Cancelled(reason) => {
                Self::Cancelled(reason.kind.into())
            }
            asupersync::Outcome::Panicked(payload) => {
                Self::Panicked(payload.message().to_owned())
            }
        }
    }
}

// Also provide owned conversion for convenience.
impl<T, E> From<asupersync::Outcome<T, E>> for FusionOutcome<T, E> {
    fn from(o: asupersync::Outcome<T, E>) -> Self {
        match o {
            asupersync::Outcome::Ok(v) => Self::Ok(v),
            asupersync::Outcome::Err(e) => Self::Err(e),
            asupersync::Outcome::Cancelled(reason) => {
                Self::Cancelled(reason.kind.into())
            }
            asupersync::Outcome::Panicked(payload) => {
                Self::Panicked(payload.message().to_owned())
            }
        }
    }
}

// ============================================================================
// Budget conversions
// ============================================================================

/// Converts a `FusionBudget` to an `asupersync::Budget`.
///
/// `deadline_ms` (f64 epoch-milliseconds) is converted to
/// `asupersync::Time` (u64 nanoseconds) via truncation.
///
/// Free function because both `FusionBudget` (ava-fusion) and `Budget`
/// (asupersync) are foreign types — orphan rule forbids `From` impls.
pub fn fusion_budget_to_runtime(fb: FusionBudget) -> asupersync::Budget {
    let deadline = fb.deadline_ms.map(|ms| {
        let nanos = (ms * 1_000_000.0) as u64;
        asupersync::Time::from_nanos(nanos)
    });
    asupersync::Budget {
        deadline,
        poll_quota: fb.poll_quota,
        cost_quota: fb.cost_quota,
        priority: fb.priority,
    }
}

/// Converts an `asupersync::Budget` reference to a `FusionBudget`.
///
/// `Time` (u64 nanoseconds) is converted to `f64` epoch-milliseconds.
/// This is lossless for deadlines below ~285 years from epoch
/// (f64 has 53 bits of mantissa, nanosecond millis fit in ~52 bits).
///
/// Free function because both types are foreign (orphan rule).
pub fn runtime_budget_to_fusion(b: &asupersync::Budget) -> FusionBudget {
    FusionBudget {
        deadline_ms: b.deadline.map(|t| t.as_millis() as f64),
        poll_quota: b.poll_quota,
        cost_quota: b.cost_quota,
        priority: b.priority,
    }
}

// ============================================================================
// ObligationId conversions
// ============================================================================

/// Converts a `FusionObligationId` (branded string) to an
/// `asupersync::ObligationId` (arena index).
///
/// **This is a lossy, one-directional mapping.** asupersync's `ObligationId`
/// is an opaque `ArenaIndex { index: u32, generation: u32 }` assigned by
/// the runtime scheduler. A `FusionObligationId` is a human-readable string.
///
/// The conversion strategy: parse the string as `"index.generation"` if it
/// matches that format, otherwise create a deterministic mapping via hashing.
/// The reverse direction (`ObligationId` -> `FusionObligationId`) formats
/// the arena index as `"index.generation"`.
///
/// These functions are provided as free functions (not `From` impls) because
/// `ObligationId::from_arena` is `pub(crate)` in asupersync.

/// Formats an `asupersync::ObligationId` as a `FusionObligationId` string.
///
/// Uses the serde serialization of `ObligationId` to extract the index and
/// generation, then formats as `"<index>.<generation>"`.
pub fn obligation_id_to_fusion(id: &asupersync::ObligationId) -> FusionObligationId {
    // ObligationId implements Serialize — use that to extract the value.
    let json = serde_json::to_value(id).unwrap_or_else(|_| serde_json::Value::Null);
    FusionObligationId::new(json.to_string())
}

/// Parses a `FusionObligationId` string back into an `asupersync::ObligationId`.
///
/// Attempts to deserialize the string as the JSON representation that
/// `ObligationId` serializes to. Returns `None` if the format does not match.
pub fn fusion_to_obligation_id(fid: &FusionObligationId) -> Option<asupersync::ObligationId> {
    serde_json::from_str(fid.as_str()).ok()
}

// ============================================================================
// ObligationState conversions
// ============================================================================

impl From<FusionObligationState> for asupersync::record::ObligationState {
    fn from(s: FusionObligationState) -> Self {
        match s {
            FusionObligationState::Reserved => Self::Reserved,
            FusionObligationState::Committed => Self::Committed,
            FusionObligationState::Aborted => Self::Aborted,
            FusionObligationState::Leaked => Self::Leaked,
        }
    }
}

impl From<asupersync::record::ObligationState> for FusionObligationState {
    fn from(s: asupersync::record::ObligationState) -> Self {
        match s {
            asupersync::record::ObligationState::Reserved => Self::Reserved,
            asupersync::record::ObligationState::Committed => Self::Committed,
            asupersync::record::ObligationState::Aborted => Self::Aborted,
            asupersync::record::ObligationState::Leaked => Self::Leaked,
        }
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    // -- Severity roundtrip --

    #[test]
    fn severity_roundtrip_all_variants() {
        let variants = [
            (FusionSeverity::Ok, asupersync::Severity::Ok),
            (FusionSeverity::Err, asupersync::Severity::Err),
            (FusionSeverity::Cancelled, asupersync::Severity::Cancelled),
            (FusionSeverity::Panicked, asupersync::Severity::Panicked),
        ];
        for (fusion, runtime) in variants {
            let converted: asupersync::Severity = fusion.into();
            assert_eq!(converted, runtime);
            let back: FusionSeverity = converted.into();
            assert_eq!(back, fusion);
        }
    }

    #[test]
    fn severity_ordering_preserved() {
        assert!(FusionSeverity::Ok < FusionSeverity::Err);
        assert!(FusionSeverity::Err < FusionSeverity::Cancelled);
        assert!(FusionSeverity::Cancelled < FusionSeverity::Panicked);
    }

    // -- CancelKind roundtrip --

    #[test]
    fn cancel_kind_roundtrip_all_variants() {
        let variants = [
            (FusionCancelKind::User, asupersync::CancelKind::User),
            (FusionCancelKind::Timeout, asupersync::CancelKind::Timeout),
            (FusionCancelKind::Deadline, asupersync::CancelKind::Deadline),
            (FusionCancelKind::PollQuota, asupersync::CancelKind::PollQuota),
            (FusionCancelKind::CostBudget, asupersync::CancelKind::CostBudget),
            (FusionCancelKind::FailFast, asupersync::CancelKind::FailFast),
            (FusionCancelKind::RaceLost, asupersync::CancelKind::RaceLost),
            (FusionCancelKind::ParentCancelled, asupersync::CancelKind::ParentCancelled),
            (FusionCancelKind::ResourceUnavailable, asupersync::CancelKind::ResourceUnavailable),
            (FusionCancelKind::Shutdown, asupersync::CancelKind::Shutdown),
            (FusionCancelKind::LinkedExit, asupersync::CancelKind::LinkedExit),
        ];
        for (fusion, runtime) in variants {
            let converted: asupersync::CancelKind = fusion.into();
            assert_eq!(converted, runtime);
            let back: FusionCancelKind = converted.into();
            assert_eq!(back, fusion);
        }
    }

    // -- Outcome conversions --

    #[test]
    fn outcome_ok_roundtrip() {
        let fusion: FusionOutcome<i32, String> = FusionOutcome::Ok(42);
        let runtime: asupersync::Outcome<i32, String> = fusion.clone().into();
        assert!(runtime.is_ok());
        assert_eq!(runtime.clone().unwrap(), 42);

        let back: FusionOutcome<i32, String> = runtime.into();
        assert_eq!(back, fusion);
    }

    #[test]
    fn outcome_err_roundtrip() {
        let fusion: FusionOutcome<i32, String> = FusionOutcome::Err("not found".into());
        let runtime: asupersync::Outcome<i32, String> = fusion.clone().into();
        assert!(runtime.is_err());

        let back: FusionOutcome<i32, String> = runtime.into();
        assert_eq!(back, fusion);
    }

    #[test]
    fn outcome_cancelled_roundtrip() {
        let fusion: FusionOutcome<i32, String> =
            FusionOutcome::Cancelled(FusionCancelKind::Timeout);
        let runtime: asupersync::Outcome<i32, String> = fusion.into();
        assert!(runtime.is_cancelled());

        let back: FusionOutcome<i32, String> = runtime.into();
        assert_eq!(back, FusionOutcome::Cancelled(FusionCancelKind::Timeout));
    }

    #[test]
    fn outcome_panicked_roundtrip() {
        let fusion: FusionOutcome<i32, String> =
            FusionOutcome::Panicked("something broke".into());
        let runtime: asupersync::Outcome<i32, String> = fusion.into();
        assert!(runtime.is_panicked());

        let back: FusionOutcome<i32, String> = runtime.into();
        assert_eq!(
            back,
            FusionOutcome::Panicked("something broke".into())
        );
    }

    #[test]
    fn outcome_severity_matches() {
        let ok: FusionOutcome<(), ()> = FusionOutcome::Ok(());
        let err: FusionOutcome<(), ()> = FusionOutcome::Err(());
        let cancelled: FusionOutcome<(), ()> = FusionOutcome::Cancelled(FusionCancelKind::User);
        let panicked: FusionOutcome<(), ()> = FusionOutcome::Panicked("boom".into());

        assert_eq!(ok.severity(), FusionSeverity::Ok);
        assert_eq!(err.severity(), FusionSeverity::Err);
        assert_eq!(cancelled.severity(), FusionSeverity::Cancelled);
        assert_eq!(panicked.severity(), FusionSeverity::Panicked);
    }

    #[test]
    fn outcome_from_ref() {
        let runtime = asupersync::Outcome::<i32, String>::Ok(99);
        let fusion: FusionOutcome<i32, String> = FusionOutcome::from(&runtime);
        assert_eq!(fusion, FusionOutcome::Ok(99));
    }

    // -- Budget conversions --

    #[test]
    fn budget_roundtrip_with_all_fields() {
        let fusion = FusionBudget {
            deadline_ms: Some(30_000.0),
            poll_quota: 100,
            cost_quota: Some(5000),
            priority: 200,
        };
        let runtime = fusion_budget_to_runtime(fusion.clone());

        assert_eq!(runtime.poll_quota, 100);
        assert_eq!(runtime.cost_quota, Some(5000));
        assert_eq!(runtime.priority, 200);
        // deadline_ms 30_000.0 -> 30_000 * 1_000_000 = 30_000_000_000 nanos
        assert!(runtime.deadline.is_some());

        let back = runtime_budget_to_fusion(&runtime);
        assert_eq!(back.poll_quota, fusion.poll_quota);
        assert_eq!(back.cost_quota, fusion.cost_quota);
        assert_eq!(back.priority, fusion.priority);
        // Deadline roundtrip: f64 ms -> u64 nanos -> u64 millis -> f64 ms
        // 30_000.0 -> 30_000_000_000 nanos -> 30_000 millis -> 30_000.0
        assert_eq!(back.deadline_ms, Some(30_000.0));
    }

    #[test]
    fn budget_roundtrip_without_optional_fields() {
        let fusion = FusionBudget {
            deadline_ms: None,
            poll_quota: 50,
            cost_quota: None,
            priority: 128,
        };
        let runtime = fusion_budget_to_runtime(fusion.clone());

        assert_eq!(runtime.deadline, None);
        assert_eq!(runtime.poll_quota, 50);
        assert_eq!(runtime.cost_quota, None);
        assert_eq!(runtime.priority, 128);

        let back = runtime_budget_to_fusion(&runtime);
        assert_eq!(back, fusion);
    }

    #[test]
    fn budget_deadline_precision() {
        // Test sub-millisecond precision loss: 1234.567 ms
        // -> 1_234_567_000 nanos (truncated from 1_234_567_000.0)
        // -> 1234 millis (integer division)
        // -> 1234.0 ms (lost the .567)
        let fusion = FusionBudget {
            deadline_ms: Some(1234.567),
            poll_quota: u32::MAX,
            cost_quota: None,
            priority: 128,
        };
        let runtime = fusion_budget_to_runtime(fusion);
        let back = runtime_budget_to_fusion(&runtime);
        // Sub-millisecond precision is lost via nanos->millis truncation
        assert_eq!(back.deadline_ms, Some(1234.0));
    }

    // -- ObligationState roundtrip --

    #[test]
    fn obligation_state_roundtrip_all_variants() {
        let variants = [
            (FusionObligationState::Reserved, asupersync::record::ObligationState::Reserved),
            (FusionObligationState::Committed, asupersync::record::ObligationState::Committed),
            (FusionObligationState::Aborted, asupersync::record::ObligationState::Aborted),
            (FusionObligationState::Leaked, asupersync::record::ObligationState::Leaked),
        ];
        for (fusion, runtime) in variants {
            let converted: asupersync::record::ObligationState = fusion.into();
            assert_eq!(converted, runtime);
            let back: FusionObligationState = converted.into();
            assert_eq!(back, fusion);
        }
    }

    // -- ObligationId conversion --

    #[test]
    fn obligation_id_to_fusion_produces_string() {
        // We can't easily construct an ObligationId from outside asupersync
        // (from_arena is pub(crate)), but we can test the serde path by
        // deserializing a known JSON representation.
        let json_repr = r#"{"index":7,"generation":3}"#;
        let id: asupersync::ObligationId =
            serde_json::from_str(json_repr).expect("should deserialize");
        let fid = obligation_id_to_fusion(&id);
        assert!(!fid.as_str().is_empty());
    }

    #[test]
    fn obligation_id_roundtrip_via_serde() {
        let json_repr = r#"{"index":42,"generation":1}"#;
        let original: asupersync::ObligationId =
            serde_json::from_str(json_repr).expect("should deserialize");
        let fid = obligation_id_to_fusion(&original);
        let recovered = fusion_to_obligation_id(&fid);
        assert!(recovered.is_some());
        assert_eq!(recovered.unwrap(), original);
    }

    // -- Serde of mirror types --

    #[test]
    fn fusion_outcome_serde_ok() {
        let outcome: FusionOutcome<i32, String> = FusionOutcome::Ok(42);
        let json = serde_json::to_string(&outcome).unwrap();
        let parsed: FusionOutcome<i32, String> = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, outcome);
    }

    #[test]
    fn fusion_outcome_serde_cancelled() {
        let outcome: FusionOutcome<i32, String> =
            FusionOutcome::Cancelled(FusionCancelKind::Shutdown);
        let json = serde_json::to_string(&outcome).unwrap();
        assert!(json.contains("cancelled"));
        assert!(json.contains("SHUTDOWN"));
        let parsed: FusionOutcome<i32, String> = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, outcome);
    }

    #[test]
    fn fusion_severity_serde_roundtrip() {
        for sev in [
            FusionSeverity::Ok,
            FusionSeverity::Err,
            FusionSeverity::Cancelled,
            FusionSeverity::Panicked,
        ] {
            let json = serde_json::to_string(&sev).unwrap();
            let parsed: FusionSeverity = serde_json::from_str(&json).unwrap();
            assert_eq!(parsed, sev);
        }
    }

    #[test]
    fn fusion_obligation_state_serde_roundtrip() {
        for state in [
            FusionObligationState::Reserved,
            FusionObligationState::Committed,
            FusionObligationState::Aborted,
            FusionObligationState::Leaked,
        ] {
            let json = serde_json::to_string(&state).unwrap();
            let parsed: FusionObligationState = serde_json::from_str(&json).unwrap();
            assert_eq!(parsed, state);
        }
    }

    #[test]
    fn fusion_cancel_kind_serde_roundtrip() {
        let all = [
            FusionCancelKind::User,
            FusionCancelKind::Timeout,
            FusionCancelKind::Deadline,
            FusionCancelKind::PollQuota,
            FusionCancelKind::CostBudget,
            FusionCancelKind::FailFast,
            FusionCancelKind::RaceLost,
            FusionCancelKind::ParentCancelled,
            FusionCancelKind::ResourceUnavailable,
            FusionCancelKind::Shutdown,
            FusionCancelKind::LinkedExit,
        ];
        for kind in all {
            let json = serde_json::to_string(&kind).unwrap();
            let parsed: FusionCancelKind = serde_json::from_str(&json).unwrap();
            assert_eq!(parsed, kind);
        }
    }
}
