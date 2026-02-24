//! Temporal join types for multi-source data fusion.
//!
//! Covers join mode selection, late arrival policies, watermark
//! configuration, timestamp validation, clock skew handling,
//! and the FusionBudget mirror type for asupersync compatibility.
//!
//! Source: TSGC-001-v2 Section 7 (R1 temporal join semantics).

use serde::{Deserialize, Serialize};
use typeshare::typeshare;

// ---------------------------------------------------------------------------
// TemporalJoinMode — join strategy selector
// ---------------------------------------------------------------------------

/// Temporal join strategy, selected automatically based on rate ratio.
///
/// - `Windowed`: Both sides are comparable-rate streams (ratio < 10).
/// - `EventTable`: Fast side probes slow side's latest snapshot (ratio >= 10).
/// - `Reference`: One side is static reference data (ratio = infinity).
#[typeshare]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum TemporalJoinMode {
    Windowed,
    EventTable,
    Reference,
}

// ---------------------------------------------------------------------------
// LateArrivalPolicy — handling of out-of-order events
// ---------------------------------------------------------------------------

/// Policy for handling signals that arrive after their watermark has passed.
///
/// - `Drop`: Discard the signal, log, emit LateDrop event.
/// - `Reprocess`: Accept update, retract and re-emit affected outputs.
/// - `SideChannel`: Route to a separate stream for offline review.
#[typeshare]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum LateArrivalPolicy {
    Drop,
    Reprocess,
    SideChannel,
}

// ---------------------------------------------------------------------------
// WatermarkConfig — out-of-order tolerance
// ---------------------------------------------------------------------------

/// Watermark configuration controlling out-of-order tolerance.
///
/// - `max_out_of_order_ms`: Maximum allowed lateness before a signal
///   is considered late.
/// - `idle_timeout_ms`: After this period of silence from a source,
///   advance the watermark to processing time.
#[typeshare]
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WatermarkConfig {
    pub max_out_of_order_ms: u64,
    pub idle_timeout_ms: u64,
}

// ---------------------------------------------------------------------------
// AllowedLateness — per-source late arrival tolerance
// ---------------------------------------------------------------------------

/// Per-source allowed lateness for asymmetric join pairs.
#[typeshare]
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AllowedLateness {
    pub duration_ms: u64,
}

// ---------------------------------------------------------------------------
// JoinWindow — asymmetric temporal window
// ---------------------------------------------------------------------------

/// Asymmetric temporal join window.
///
/// `before_ms` is how far before the probe event to search.
/// `after_ms` is how far after the probe event to search.
#[typeshare]
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JoinWindow {
    pub before_ms: u64,
    pub after_ms: u64,
}

// ---------------------------------------------------------------------------
// TimestampValidation — clock skew handling bounds
// ---------------------------------------------------------------------------

/// Bounds for timestamp validation and clock skew detection.
///
/// - `max_future_ms`: Maximum allowed event-time ahead of processing-time.
/// - `max_past_ms`: Maximum age before signal is routed to side-channel.
#[typeshare]
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TimestampValidation {
    pub max_future_ms: u64,
    pub max_past_ms: u64,
}

impl Default for TimestampValidation {
    fn default() -> Self {
        Self {
            max_future_ms: 5_000,
            max_past_ms: 3_600_000, // 1 hour
        }
    }
}

// ---------------------------------------------------------------------------
// ClockSkewPolicy — handling of detected clock skew
// ---------------------------------------------------------------------------

/// Policy for handling detected clock skew between event-time and
/// processing-time.
///
/// - `Reject`: Drop the signal entirely.
/// - `Correct`: Clamp to processing-time + tolerance.
/// - `Flag`: Accept as-is but flag for operator review.
#[typeshare]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ClockSkewPolicy {
    Reject,
    Correct,
    Flag,
}

impl Default for ClockSkewPolicy {
    fn default() -> Self {
        Self::Correct
    }
}

// ---------------------------------------------------------------------------
// TemporalJoinConfig — composite temporal join configuration
// ---------------------------------------------------------------------------

/// Composite temporal join configuration for a single join path.
///
/// Combines mode selection, late arrival policy, and watermark settings.
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TemporalJoinConfig {
    pub mode: TemporalJoinMode,
    pub late_arrival_policy: LateArrivalPolicy,
    pub watermark: WatermarkConfig,
}

// ---------------------------------------------------------------------------
// FusionBudget — asupersync Budget mirror for TypeScript/WASM
// ---------------------------------------------------------------------------

/// Serde-friendly mirror of asupersync's `Budget` struct.
///
/// - `deadline_ms`: Optional epoch-millisecond deadline (f64 for TS compat).
/// - `poll_quota`: Maximum number of poll operations.
/// - `cost_quota`: Optional cost limit in abstract units.
/// - `priority`: Priority level (0-255, higher = more important).
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FusionBudget {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub deadline_ms: Option<f64>,
    pub poll_quota: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cost_quota: Option<u64>,
    pub priority: u8,
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    // -- TemporalJoinMode --

    #[test]
    fn temporal_join_mode_serde_roundtrip() {
        let variants = [
            TemporalJoinMode::Windowed,
            TemporalJoinMode::EventTable,
            TemporalJoinMode::Reference,
        ];
        for mode in variants {
            let json = serde_json::to_string(&mode).unwrap();
            let parsed: TemporalJoinMode = serde_json::from_str(&json).unwrap();
            assert_eq!(parsed, mode);
        }
    }

    #[test]
    fn temporal_join_mode_json_shape() {
        let json = serde_json::to_string(&TemporalJoinMode::EventTable).unwrap();
        assert_eq!(json, "\"eventTable\"");
    }

    // -- LateArrivalPolicy --

    #[test]
    fn late_arrival_policy_serde_roundtrip() {
        let variants = [
            LateArrivalPolicy::Drop,
            LateArrivalPolicy::Reprocess,
            LateArrivalPolicy::SideChannel,
        ];
        for policy in variants {
            let json = serde_json::to_string(&policy).unwrap();
            let parsed: LateArrivalPolicy = serde_json::from_str(&json).unwrap();
            assert_eq!(parsed, policy);
        }
    }

    #[test]
    fn late_arrival_policy_json_shape() {
        let json = serde_json::to_string(&LateArrivalPolicy::SideChannel).unwrap();
        assert_eq!(json, "\"sideChannel\"");
    }

    // -- WatermarkConfig --

    #[test]
    fn watermark_config_serde_roundtrip() {
        let wm = WatermarkConfig {
            max_out_of_order_ms: 5000,
            idle_timeout_ms: 30_000,
        };
        let json = serde_json::to_string(&wm).unwrap();
        let parsed: WatermarkConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, wm);
    }

    #[test]
    fn watermark_config_json_camel_case() {
        let wm = WatermarkConfig {
            max_out_of_order_ms: 100,
            idle_timeout_ms: 200,
        };
        let json = serde_json::to_string(&wm).unwrap();
        assert!(json.contains("\"maxOutOfOrderMs\""));
        assert!(json.contains("\"idleTimeoutMs\""));
    }

    // -- AllowedLateness --

    #[test]
    fn allowed_lateness_serde_roundtrip() {
        let al = AllowedLateness {
            duration_ms: 30_000,
        };
        let json = serde_json::to_string(&al).unwrap();
        let parsed: AllowedLateness = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, al);
    }

    // -- JoinWindow --

    #[test]
    fn join_window_serde_roundtrip() {
        let jw = JoinWindow {
            before_ms: 5000,
            after_ms: 2000,
        };
        let json = serde_json::to_string(&jw).unwrap();
        let parsed: JoinWindow = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, jw);
    }

    #[test]
    fn join_window_json_camel_case() {
        let jw = JoinWindow {
            before_ms: 100,
            after_ms: 50,
        };
        let json = serde_json::to_string(&jw).unwrap();
        assert!(json.contains("\"beforeMs\""));
        assert!(json.contains("\"afterMs\""));
    }

    // -- TimestampValidation --

    #[test]
    fn timestamp_validation_serde_roundtrip() {
        let tv = TimestampValidation {
            max_future_ms: 10_000,
            max_past_ms: 7_200_000,
        };
        let json = serde_json::to_string(&tv).unwrap();
        let parsed: TimestampValidation = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, tv);
    }

    #[test]
    fn timestamp_validation_default() {
        let tv = TimestampValidation::default();
        assert_eq!(tv.max_future_ms, 5_000);
        assert_eq!(tv.max_past_ms, 3_600_000);
    }

    // -- ClockSkewPolicy --

    #[test]
    fn clock_skew_policy_serde_roundtrip() {
        let variants = [
            ClockSkewPolicy::Reject,
            ClockSkewPolicy::Correct,
            ClockSkewPolicy::Flag,
        ];
        for policy in variants {
            let json = serde_json::to_string(&policy).unwrap();
            let parsed: ClockSkewPolicy = serde_json::from_str(&json).unwrap();
            assert_eq!(parsed, policy);
        }
    }

    #[test]
    fn clock_skew_policy_default_is_correct() {
        assert_eq!(ClockSkewPolicy::default(), ClockSkewPolicy::Correct);
    }

    // -- TemporalJoinConfig --

    #[test]
    fn temporal_join_config_serde_roundtrip() {
        let cfg = TemporalJoinConfig {
            mode: TemporalJoinMode::Windowed,
            late_arrival_policy: LateArrivalPolicy::Drop,
            watermark: WatermarkConfig {
                max_out_of_order_ms: 5000,
                idle_timeout_ms: 30_000,
            },
        };
        let json = serde_json::to_string(&cfg).unwrap();
        let parsed: TemporalJoinConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, cfg);
    }

    #[test]
    fn temporal_join_config_json_camel_case() {
        let cfg = TemporalJoinConfig {
            mode: TemporalJoinMode::Reference,
            late_arrival_policy: LateArrivalPolicy::Reprocess,
            watermark: WatermarkConfig {
                max_out_of_order_ms: 0,
                idle_timeout_ms: 0,
            },
        };
        let json = serde_json::to_string(&cfg).unwrap();
        assert!(json.contains("\"lateArrivalPolicy\""));
    }

    // -- FusionBudget --

    #[test]
    fn fusion_budget_serde_roundtrip() {
        let budget = FusionBudget {
            deadline_ms: Some(1_700_000_000_000.0),
            poll_quota: 100,
            cost_quota: Some(5000),
            priority: 10,
        };
        let json = serde_json::to_string(&budget).unwrap();
        let parsed: FusionBudget = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, budget);
    }

    #[test]
    fn fusion_budget_optional_fields_omitted() {
        let budget = FusionBudget {
            deadline_ms: None,
            poll_quota: 50,
            cost_quota: None,
            priority: 5,
        };
        let json = serde_json::to_string(&budget).unwrap();
        assert!(!json.contains("deadlineMs"));
        assert!(!json.contains("costQuota"));
        assert!(json.contains("\"pollQuota\""));
        assert!(json.contains("\"priority\""));
    }

    #[test]
    fn fusion_budget_json_camel_case() {
        let budget = FusionBudget {
            deadline_ms: Some(1000.0),
            poll_quota: 1,
            cost_quota: Some(1),
            priority: 0,
        };
        let json = serde_json::to_string(&budget).unwrap();
        assert!(json.contains("\"deadlineMs\""));
        assert!(json.contains("\"pollQuota\""));
        assert!(json.contains("\"costQuota\""));
        assert!(json.contains("\"priority\""));
    }

    #[test]
    fn fusion_budget_deserialize_without_optional() {
        let json = r#"{"pollQuota":10,"priority":1}"#;
        let parsed: FusionBudget = serde_json::from_str(json).unwrap();
        assert_eq!(parsed.deadline_ms, None);
        assert_eq!(parsed.poll_quota, 10);
        assert_eq!(parsed.cost_quota, None);
        assert_eq!(parsed.priority, 1);
    }
}
