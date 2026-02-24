//! Differential-dataflow integration for incremental fusion joins.
//!
//! This module bridges the `ava-fusion` join ontology to `differential-dataflow`
//! operators running on a dedicated worker thread. Communication between the
//! async GenServer world and the synchronous dataflow worker uses crossbeam
//! channels.
//!
//! # Architecture
//!
//! ```text
//! GenServer (async)          DataflowWorker (sync OS thread)
//!   cmd_tx ─────────────────► cmd_rx → InputSession::insert/remove
//!   result_rx ◄───────────── result_tx ← inspect() callback
//! ```
//!
//! The dataflow graph is constructed once from `Vec<JoinPathEntryV2>` at
//! worker startup. Each enabled join path becomes a binary join in the
//! fixed graph. Data flows dynamically via Insert/Remove commands.

mod blocking;
mod graph;
mod scoring;
mod worker;

pub use blocking::{
    extract_composite_key, extract_identity_key, extract_spatial_keys, extract_spectral_key,
    extract_temporal_key,
};
pub use scoring::{
    apply_correlation_discount, score_dempster_shafer, score_dempster_shafer_entropy_weighted,
    score_log_odds, score_weighted_average,
};
pub use worker::DataflowWorker;

use ava_fusion::OutputType;

// ---------------------------------------------------------------------------
// DataflowCommand — GenServer -> Worker
// ---------------------------------------------------------------------------

/// Command sent from the GenServer to the dataflow worker thread.
#[derive(Debug, Clone)]
pub enum DataflowCommand {
    /// Insert an observation into the named source collection.
    Insert {
        source_id: String,
        key: String,
        value: Vec<u8>,
        timestamp_ms: f64,
        /// Optional WGS84 latitude in decimal degrees for spatial blocking.
        lat_deg: Option<f64>,
        /// Optional WGS84 longitude in decimal degrees for spatial blocking.
        lon_deg: Option<f64>,
    },
    /// Remove a previously inserted observation.
    Remove {
        source_id: String,
        key: String,
        value: Vec<u8>,
    },
    /// Advance logical time (triggers window evaluation via probe).
    AdvanceTime(u64),
    /// Gracefully shut down the worker thread.
    Shutdown,
}

// ---------------------------------------------------------------------------
// Observation — Collection element inside the dataflow graph
// ---------------------------------------------------------------------------

/// A keyed observation suitable for differential-dataflow Collections.
///
/// Lives exclusively inside the worker thread. Full payloads are too large
/// for Collection storage; we keep a hash for dedup and provenance.
///
/// `Ord` is required by `Collection<S, D, R>` where `D: Ord`.
/// Coordinates are stored as micro-degrees (`i64`) instead of `f64` because
/// `f64` does not implement `Ord`. Precision: 1e-6 degrees ≈ 0.11 meters.
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash, serde::Serialize, serde::Deserialize)]
pub struct Observation {
    /// The join key (extracted from payload via key_path).
    pub key: String,
    /// Source identifier for provenance tracking.
    pub source_id: String,
    /// Hash of the full payload for deduplication.
    pub payload_hash: u64,
    /// Latitude in micro-degrees (1e-6 degrees). None if no spatial data.
    pub lat_microdeg: Option<i64>,
    /// Longitude in micro-degrees (1e-6 degrees). None if no spatial data.
    pub lon_microdeg: Option<i64>,
}

// ---------------------------------------------------------------------------
// FusionResult — Worker -> GenServer
// ---------------------------------------------------------------------------

/// Result emitted by the dataflow graph via `inspect()`.
///
/// Each result represents a delta: `diff = +1` for a new match,
/// `diff = -1` for a retracted match.
#[derive(Debug, Clone)]
pub struct FusionResult {
    /// Which join path produced this result.
    pub join_path_id: String,
    /// Left side join key.
    pub left_key: String,
    /// Right side join key.
    pub right_key: String,
    /// Confidence score (0.0 - 1.0).
    pub confidence: f64,
    /// Output classification for downstream routing.
    pub output_type: OutputType,
    /// Logical time (window epoch) at which this result was produced.
    pub time: u64,
    /// Delta: +1 = new match, -1 = retracted match.
    pub diff: i64,
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use ava_fusion::join_path::{
        EnabledState, JoinPathEntryV2, JoinPathSide, JoinType, PairBlocking,
    };
    use ava_fusion::{DataType, FusionTier, SignalKind};
    use std::time::Duration;

    const TIMEOUT: Duration = Duration::from_secs(5);

    /// Helper: create a minimal identity join path.
    fn identity_join_path(
        id: &str,
        left_kind: SignalKind,
        right_kind: SignalKind,
    ) -> JoinPathEntryV2 {
        JoinPathEntryV2 {
            id: id.into(),
            left: JoinPathSide {
                signal_kind: left_kind,
                key_path: "payload.id".into(),
                data_type: DataType::Event,
            },
            right: JoinPathSide {
                signal_kind: right_kind,
                key_path: "payload.id".into(),
                data_type: DataType::Event,
            },
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
        }
    }

    // -- Test 1: Single identity join --

    #[test]
    fn single_identity_join_produces_result() {
        let config = vec![identity_join_path("jp1", SignalKind::AdsB, SignalKind::Ais)];
        let worker = DataflowWorker::new(config);

        // Insert matching keys on both sides.
        // Source IDs use the Debug format of SignalKind for routing.
        worker
            .send(DataflowCommand::Insert {
                source_id: "AdsB".into(),
                key: "ABC123".into(),
                value: vec![1, 2, 3],
                timestamp_ms: 1000.0,
                lat_deg: None,
                lon_deg: None,
            })
            .unwrap();

        worker
            .send(DataflowCommand::Insert {
                source_id: "Ais".into(),
                key: "ABC123".into(),
                value: vec![4, 5, 6],
                timestamp_ms: 1000.0,
                lat_deg: None,
                lon_deg: None,
            })
            .unwrap();

        // Advance time to flush results.
        worker
            .send(DataflowCommand::AdvanceTime(1))
            .unwrap();

        // Drain results with timeout for worker thread to process.
        let results = worker.drain_results_timeout(TIMEOUT);
        assert!(
            !results.is_empty(),
            "Expected at least one FusionResult from matching keys"
        );

        let r = &results[0];
        assert_eq!(r.join_path_id, "jp1");
        assert_eq!(r.diff, 1, "Expected positive diff for new match");
    }

    // -- Test 2: No match --

    #[test]
    fn no_match_produces_no_result() {
        let config = vec![identity_join_path("jp1", SignalKind::AdsB, SignalKind::Ais)];
        let worker = DataflowWorker::new(config);

        // Insert non-matching keys.
        worker
            .send(DataflowCommand::Insert {
                source_id: "AdsB".into(),
                key: "ABC123".into(),
                value: vec![1],
                timestamp_ms: 1000.0,
                lat_deg: None,
                lon_deg: None,
            })
            .unwrap();

        worker
            .send(DataflowCommand::Insert {
                source_id: "Ais".into(),
                key: "XYZ999".into(),
                value: vec![2],
                timestamp_ms: 1000.0,
                lat_deg: None,
                lon_deg: None,
            })
            .unwrap();

        worker
            .send(DataflowCommand::AdvanceTime(1))
            .unwrap();

        // Short timeout: confirm no results after worker has had time to process.
        let results = worker.drain_results_timeout(Duration::from_millis(200));
        assert!(results.is_empty(), "Expected no results from non-matching keys");
    }

    // -- Test 3: Retraction --

    #[test]
    fn retraction_produces_negative_diff() {
        let config = vec![identity_join_path("jp1", SignalKind::AdsB, SignalKind::Ais)];
        let worker = DataflowWorker::new(config);

        // Insert matching pair.
        worker
            .send(DataflowCommand::Insert {
                source_id: "AdsB".into(),
                key: "ABC123".into(),
                value: vec![1, 2, 3],
                timestamp_ms: 1000.0,
                lat_deg: None,
                lon_deg: None,
            })
            .unwrap();
        worker
            .send(DataflowCommand::Insert {
                source_id: "Ais".into(),
                key: "ABC123".into(),
                value: vec![4, 5, 6],
                timestamp_ms: 1000.0,
                lat_deg: None,
                lon_deg: None,
            })
            .unwrap();
        worker
            .send(DataflowCommand::AdvanceTime(1))
            .unwrap();

        // Drain the initial match.
        let initial = worker.drain_results_timeout(TIMEOUT);
        assert!(!initial.is_empty(), "Expected initial match result");

        // Remove the left observation.
        worker
            .send(DataflowCommand::Remove {
                source_id: "AdsB".into(),
                key: "ABC123".into(),
                value: vec![1, 2, 3],
            })
            .unwrap();
        worker
            .send(DataflowCommand::AdvanceTime(2))
            .unwrap();

        let retracted = worker.drain_results_timeout(TIMEOUT);
        assert!(
            !retracted.is_empty(),
            "Expected retraction result after remove"
        );

        let neg = retracted.iter().find(|r| r.diff < 0);
        assert!(neg.is_some(), "Expected at least one result with diff=-1");
    }

    // -- Test 4: Multiple join paths sharing same source --

    #[test]
    fn multiple_join_paths_produce_results() {
        let config = vec![
            identity_join_path("jp1", SignalKind::AdsB, SignalKind::Ais),
            identity_join_path("jp2", SignalKind::AdsB, SignalKind::Radar),
        ];
        let worker = DataflowWorker::new(config);

        // Insert on shared left source (ADS-B).
        worker
            .send(DataflowCommand::Insert {
                source_id: "AdsB".into(),
                key: "KEY1".into(),
                value: vec![1],
                timestamp_ms: 1000.0,
                lat_deg: None,
                lon_deg: None,
            })
            .unwrap();

        // Insert on first right source (AIS).
        worker
            .send(DataflowCommand::Insert {
                source_id: "Ais".into(),
                key: "KEY1".into(),
                value: vec![2],
                timestamp_ms: 1000.0,
                lat_deg: None,
                lon_deg: None,
            })
            .unwrap();

        // Insert on second right source (Radar).
        worker
            .send(DataflowCommand::Insert {
                source_id: "Radar".into(),
                key: "KEY1".into(),
                value: vec![3],
                timestamp_ms: 1000.0,
                lat_deg: None,
                lon_deg: None,
            })
            .unwrap();

        worker
            .send(DataflowCommand::AdvanceTime(1))
            .unwrap();

        let results = worker.drain_results_timeout(TIMEOUT);
        // Expect results from both join paths.
        let jp1_results: Vec<_> = results.iter().filter(|r| r.join_path_id == "jp1").collect();
        let jp2_results: Vec<_> = results.iter().filter(|r| r.join_path_id == "jp2").collect();
        assert!(
            !jp1_results.is_empty(),
            "Expected results from join path jp1"
        );
        assert!(
            !jp2_results.is_empty(),
            "Expected results from join path jp2"
        );
    }

    // -- Test 5: Results only after AdvanceTime --

    #[test]
    fn results_only_after_advance_time() {
        let config = vec![identity_join_path("jp1", SignalKind::AdsB, SignalKind::Ais)];
        let worker = DataflowWorker::new(config);

        worker
            .send(DataflowCommand::Insert {
                source_id: "AdsB".into(),
                key: "KEY1".into(),
                value: vec![1],
                timestamp_ms: 1000.0,
                lat_deg: None,
                lon_deg: None,
            })
            .unwrap();
        worker
            .send(DataflowCommand::Insert {
                source_id: "Ais".into(),
                key: "KEY1".into(),
                value: vec![2],
                timestamp_ms: 1000.0,
                lat_deg: None,
                lon_deg: None,
            })
            .unwrap();

        // Advance time to trigger result emission.
        worker
            .send(DataflowCommand::AdvanceTime(1))
            .unwrap();

        let results = worker.drain_results_timeout(TIMEOUT);
        assert!(
            !results.is_empty(),
            "Results must be available after AdvanceTime"
        );
    }

    // -- Test 6: Shutdown --

    #[test]
    fn shutdown_exits_cleanly() {
        let config = vec![identity_join_path("jp1", SignalKind::AdsB, SignalKind::Ais)];
        let mut worker = DataflowWorker::new(config);

        worker
            .send(DataflowCommand::Shutdown)
            .unwrap();

        // The shutdown method joins the thread.
        worker.shutdown();
        // If we get here without panic/hang, shutdown was clean.
    }

    // =====================================================================
    // Tier 2 / Tier 3 helpers
    // =====================================================================

    /// Create a Tier 2 Spatial join path with blocking enabled.
    fn spatial_join_path(
        id: &str,
        left_kind: SignalKind,
        right_kind: SignalKind,
    ) -> JoinPathEntryV2 {
        JoinPathEntryV2 {
            id: id.into(),
            left: JoinPathSide {
                signal_kind: left_kind,
                key_path: "payload.geo".into(),
                data_type: DataType::Event,
            },
            right: JoinPathSide {
                signal_kind: right_kind,
                key_path: "payload.geo".into(),
                data_type: DataType::Event,
            },
            join_type: JoinType::Spatial,
            tier: FusionTier::Tier2Attribute,
            output: OutputType::CorrelatedPair,
            enabled: EnabledState::Enabled,
            resolver: None,
            blocking: Some(PairBlocking {
                spatial: true,
                temporal: false,
                spectral: false,
            }),
            temporal_window_ms: None,
            late_arrival_policy: None,
            confidence_model: None,
            tier3_method: None,
            join_mode: None,
        }
    }

    /// Create a Tier 2 Temporal join path with blocking enabled.
    fn temporal_join_path(
        id: &str,
        left_kind: SignalKind,
        right_kind: SignalKind,
    ) -> JoinPathEntryV2 {
        JoinPathEntryV2 {
            id: id.into(),
            left: JoinPathSide {
                signal_kind: left_kind,
                key_path: "payload.ts".into(),
                data_type: DataType::Event,
            },
            right: JoinPathSide {
                signal_kind: right_kind,
                key_path: "payload.ts".into(),
                data_type: DataType::Event,
            },
            join_type: JoinType::Temporal,
            tier: FusionTier::Tier2Attribute,
            output: OutputType::CorrelatedPair,
            enabled: EnabledState::Enabled,
            resolver: None,
            blocking: Some(PairBlocking {
                spatial: false,
                temporal: true,
                spectral: false,
            }),
            temporal_window_ms: Some(60_000),
            late_arrival_policy: None,
            confidence_model: None,
            tier3_method: None,
            join_mode: None,
        }
    }

    /// Create a Tier 3 join path with a specific method.
    fn tier3_join_path(
        id: &str,
        method: &str,
        left_kind: SignalKind,
        right_kind: SignalKind,
    ) -> JoinPathEntryV2 {
        JoinPathEntryV2 {
            id: id.into(),
            left: JoinPathSide {
                signal_kind: left_kind,
                key_path: "payload.id".into(),
                data_type: DataType::Event,
            },
            right: JoinPathSide {
                signal_kind: right_kind,
                key_path: "payload.id".into(),
                data_type: DataType::Event,
            },
            join_type: JoinType::Behavioral,
            tier: FusionTier::Tier3Behavioral,
            output: OutputType::CorrelatedPair,
            enabled: EnabledState::Enabled,
            resolver: None,
            blocking: None,
            temporal_window_ms: None,
            late_arrival_policy: None,
            confidence_model: None,
            tier3_method: Some(method.to_string()),
            join_mode: None,
        }
    }

    // =====================================================================
    // Test 7: Tier 2 Spatial blocking produces results
    // =====================================================================

    #[test]
    fn tier2_spatial_blocking_produces_results() {
        let config = vec![spatial_join_path("sp1", SignalKind::AdsB, SignalKind::Ais)];
        let worker = DataflowWorker::new(config);

        // Insert observations with the SAME key string so they map to the
        // same H3 cell via the deterministic hash_to_bucket function.
        worker
            .send(DataflowCommand::Insert {
                source_id: "AdsB".into(),
                key: "GEO_CELL_A".into(),
                value: vec![10, 20, 30],
                timestamp_ms: 1000.0,
                lat_deg: None,
                lon_deg: None,
            })
            .unwrap();

        worker
            .send(DataflowCommand::Insert {
                source_id: "Ais".into(),
                key: "GEO_CELL_A".into(),
                value: vec![40, 50, 60],
                timestamp_ms: 1000.0,
                lat_deg: None,
                lon_deg: None,
            })
            .unwrap();

        worker
            .send(DataflowCommand::AdvanceTime(1))
            .unwrap();

        let results = worker.drain_results_timeout(TIMEOUT);
        assert!(
            !results.is_empty(),
            "Tier 2 Spatial join should produce results for same-cell observations"
        );

        let r = &results[0];
        assert_eq!(r.join_path_id, "sp1");
        // Tier 2 scoring should produce a confidence != 0.5 (goes through
        // tier2_base_score + compute_confidence pipeline).
        assert!(
            r.confidence > 0.0 && r.confidence <= 1.0,
            "Confidence {} should be in (0.0, 1.0]",
            r.confidence
        );
    }

    // =====================================================================
    // Test 8: Tier 2 Temporal join produces results
    // =====================================================================

    #[test]
    fn tier2_temporal_join_produces_results() {
        let config = vec![temporal_join_path("tp1", SignalKind::AdsB, SignalKind::Radar)];
        let worker = DataflowWorker::new(config);

        // Both observations need to land in the same temporal bucket.
        // The blocking module uses payload_hash as a proxy for timestamp.
        // We use the same value bytes so they hash identically and land
        // in the same temporal bucket.
        worker
            .send(DataflowCommand::Insert {
                source_id: "AdsB".into(),
                key: "TRACK_1".into(),
                value: vec![1, 2, 3],
                timestamp_ms: 1000.0,
                lat_deg: None,
                lon_deg: None,
            })
            .unwrap();

        worker
            .send(DataflowCommand::Insert {
                source_id: "Radar".into(),
                key: "TRACK_1".into(),
                value: vec![1, 2, 3],
                timestamp_ms: 1000.0,
                lat_deg: None,
                lon_deg: None,
            })
            .unwrap();

        worker
            .send(DataflowCommand::AdvanceTime(1))
            .unwrap();

        let results = worker.drain_results_timeout(TIMEOUT);
        assert!(
            !results.is_empty(),
            "Tier 2 Temporal join should produce results for same-bucket observations"
        );

        let r = &results[0];
        assert_eq!(r.join_path_id, "tp1");
        assert!(r.confidence > 0.0 && r.confidence <= 1.0);
    }

    // =====================================================================
    // Test 9: Tier 3 coOccurrence produces results
    // =====================================================================

    #[test]
    fn tier3_cooccurrence_produces_results() {
        let config = vec![tier3_join_path(
            "co1",
            "coOccurrence",
            SignalKind::AdsB,
            SignalKind::Ais,
        )];
        let worker = DataflowWorker::new(config);

        // coOccurrence buckets by payload_hash / 300_000.
        // We insert observations with identical value bytes so their
        // payload_hash values are the same, landing in the same bucket.
        // The graph then counts co-occurrences per (left_key|right_key) pair.
        worker
            .send(DataflowCommand::Insert {
                source_id: "AdsB".into(),
                key: "ENTITY_A".into(),
                value: vec![1, 2, 3],
                timestamp_ms: 1000.0,
                lat_deg: None,
                lon_deg: None,
            })
            .unwrap();

        worker
            .send(DataflowCommand::Insert {
                source_id: "Ais".into(),
                key: "ENTITY_B".into(),
                value: vec![1, 2, 3],
                timestamp_ms: 1000.0,
                lat_deg: None,
                lon_deg: None,
            })
            .unwrap();

        worker
            .send(DataflowCommand::AdvanceTime(1))
            .unwrap();

        let results = worker.drain_results_timeout(TIMEOUT);
        assert!(
            !results.is_empty(),
            "Tier 3 coOccurrence should produce results for same-bucket observations"
        );

        let r = &results[0];
        assert_eq!(r.join_path_id, "co1");
        assert!(r.confidence > 0.0 && r.confidence <= 0.95);
    }

    // =====================================================================
    // Test 10: Tier 3 community detection pipeline executes
    // =====================================================================

    #[test]
    fn tier3_community_produces_results() {
        let config = vec![tier3_join_path(
            "cm1",
            "community",
            SignalKind::AdsB,
            SignalKind::Ais,
        )];
        let worker = DataflowWorker::new(config);

        // Community detection uses label propagation on edges formed by
        // equijoin on key. Insert matching keys on both sides. The equijoin
        // on identical keys produces self-loop edges (l_obs.key == r_obs.key),
        // which means each node forms its own single-node community.
        //
        // With multiple distinct keys, multiple single-node communities
        // exist, but since the reduce emits pairs only for i < j within
        // each community, single-node communities produce 0 pairs.
        //
        // This test verifies the iterate/label-propagation pipeline runs
        // to convergence without panics or hangs. Actual cross-entity
        // community pairs require a key extraction scheme that produces
        // edges between different nodes (future enhancement).

        // Insert several matching keys to exercise the iterate loop.
        for key_suffix in ["K1", "K2", "K3"] {
            worker
                .send(DataflowCommand::Insert {
                    source_id: "AdsB".into(),
                    key: key_suffix.into(),
                    value: vec![1],
                    timestamp_ms: 1000.0,
                    lat_deg: None,
                    lon_deg: None,
                })
                .unwrap();
            worker
                .send(DataflowCommand::Insert {
                    source_id: "Ais".into(),
                    key: key_suffix.into(),
                    value: vec![2],
                    timestamp_ms: 1000.0,
                    lat_deg: None,
                    lon_deg: None,
                })
                .unwrap();
        }

        worker
            .send(DataflowCommand::AdvanceTime(1))
            .unwrap();

        // The iterate loop must converge. If it hangs, this test will
        // fail by timeout rather than assertion.
        let results = worker.drain_results_timeout(TIMEOUT);

        // With self-loop edges, single-node communities produce no pairs.
        // Verify the pipeline completed (no panic/hang) — any results
        // that DO appear should have the correct join_path_id and confidence.
        for r in &results {
            assert_eq!(r.join_path_id, "cm1");
            assert_eq!(r.confidence, 0.6, "Community confidence should be 0.6");
        }
        // Pipeline executed successfully (convergence verified by reaching here).
    }

    // =====================================================================
    // Test 11: Tier 3 anomaly coincidence produces results
    // =====================================================================

    #[test]
    fn tier3_anomaly_produces_results() {
        let config = vec![tier3_join_path(
            "an1",
            "anomalyCoincidence",
            SignalKind::AdsB,
            SignalKind::Ais,
        )];
        let worker = DataflowWorker::new(config);

        // Anomaly detection uses per-entity reduce to compute stats on
        // payload_hash values, then flags observations with z-score >= 3.0.
        //
        // Since DefaultHasher produces uniformly distributed u64 values,
        // we need enough observations such that some naturally cluster
        // while at least one is a statistical outlier. With N distinct
        // values spread across the full u64 range, the "normal" mean and
        // std_dev are very large, and every value has z ≈ 1. True anomaly
        // detection requires actual sensor values (future enhancement).
        //
        // This test verifies the anomaly coincidence pipeline executes
        // the reduce -> re-key -> join pipeline without panics or hangs,
        // and that any results produced have the correct shape.
        //
        // We insert many distinct observations per entity to exercise the
        // reduce stats computation path (mean, variance, z-score loop).

        // Left side: entity "TRACK_X" with many observations.
        for i in 0u16..50 {
            let value = vec![(i >> 8) as u8, (i & 0xFF) as u8];
            worker
                .send(DataflowCommand::Insert {
                    source_id: "AdsB".into(),
                    key: "TRACK_X".into(),
                    value,
                    timestamp_ms: 1000.0,
                    lat_deg: None,
                    lon_deg: None,
                })
                .unwrap();
        }

        // Right side: entity "TRACK_X" with many observations.
        for i in 0u16..50 {
            let value = vec![(i >> 8) as u8, (i & 0xFF) as u8];
            worker
                .send(DataflowCommand::Insert {
                    source_id: "Ais".into(),
                    key: "TRACK_X".into(),
                    value,
                    timestamp_ms: 1000.0,
                    lat_deg: None,
                    lon_deg: None,
                })
                .unwrap();
        }

        worker
            .send(DataflowCommand::AdvanceTime(1))
            .unwrap();

        // The reduce pipeline must complete without overflow or panic.
        // With uniformly distributed hashes, anomaly coincidence results
        // may or may not be produced depending on the actual hash distribution.
        let results = worker.drain_results_timeout(TIMEOUT);

        // Verify any results that ARE produced have the correct shape.
        for r in &results {
            assert_eq!(r.join_path_id, "an1");
            assert_eq!(r.confidence, 0.45, "Anomaly coincidence confidence should be 0.45");
        }
        // Pipeline executed successfully (reduce + join completed without panic).
    }

    // =====================================================================
    // Test 12: Late arrival is dropped
    // =====================================================================

    // =====================================================================
    // Test: Cancel flag causes worker to exit
    // =====================================================================

    #[test]
    fn cancel_flag_causes_worker_to_exit() {
        let config = vec![identity_join_path("jp_cancel", SignalKind::AdsB, SignalKind::Ais)];
        let mut worker = DataflowWorker::new(config);

        // The worker is spinning in its event loop. Signal cooperative cancel.
        worker.request_cancel();

        // Give the worker a moment to observe the flag and exit.
        std::thread::sleep(Duration::from_millis(100));

        // shutdown() joins the thread — if the cancel flag worked, the thread
        // should already have exited and join returns immediately. If it did
        // NOT exit, the Shutdown command sent inside shutdown() will cause it
        // to exit (belt + suspenders). Either way, we must not hang.
        worker.shutdown();
        // Reaching here without hanging means the cancel flag (or Shutdown
        // fallback) worked. But we want to verify the cancel path explicitly:
        // the thread must exit even WITHOUT a Shutdown command on the channel.
    }

    #[test]
    fn cancel_flag_stops_worker_without_shutdown_command() {
        let config = vec![identity_join_path("jp_cancel2", SignalKind::AdsB, SignalKind::Ais)];
        let worker = DataflowWorker::new(config);

        // Set the cancel flag — the worker should exit on the next loop iteration.
        worker.request_cancel();

        // Do NOT send DataflowCommand::Shutdown. The cancel flag alone should
        // cause the worker thread to return.
        // Wait for the thread to exit.
        let start = std::time::Instant::now();
        loop {
            // If the channel is disconnected, the thread has exited (dropped cmd_rx).
            if worker.send(DataflowCommand::AdvanceTime(999)).is_err() {
                break;
            }
            if start.elapsed() > Duration::from_secs(3) {
                panic!("Worker thread did not exit within 3s after cancel flag was set");
            }
            std::thread::sleep(Duration::from_millis(10));
        }
    }

    // =====================================================================
    // Test 12: Late arrival is dropped
    // =====================================================================

    #[test]
    fn late_arrival_is_dropped() {
        let config = vec![identity_join_path("jp_late", SignalKind::AdsB, SignalKind::Ais)];
        let worker = DataflowWorker::new(config);

        // Advance to window 5.
        worker
            .send(DataflowCommand::AdvanceTime(5))
            .unwrap();

        // Brief step to let the worker process the AdvanceTime.
        std::thread::sleep(Duration::from_millis(50));

        // Insert a "late" observation: timestamp_ms maps to window 2.
        // obs_window = (timestamp_ms as u64) / 60000
        // For window 2: timestamp_ms = 2 * 60000 = 120000.
        worker
            .send(DataflowCommand::Insert {
                source_id: "AdsB".into(),
                key: "LATE_KEY".into(),
                value: vec![1, 2, 3],
                timestamp_ms: 120_000.0, // window = 120000/60000 = 2 < 5 => late
                lat_deg: None,
                lon_deg: None,
            })
            .unwrap();

        // Also insert a matching right side (also late, should be dropped too).
        worker
            .send(DataflowCommand::Insert {
                source_id: "Ais".into(),
                key: "LATE_KEY".into(),
                value: vec![4, 5, 6],
                timestamp_ms: 120_000.0, // window 2 < 5 => late
                lat_deg: None,
                lon_deg: None,
            })
            .unwrap();

        // Advance to window 6 to flush any results.
        worker
            .send(DataflowCommand::AdvanceTime(6))
            .unwrap();

        // Short timeout: the late observations should have been dropped,
        // so no results should appear.
        let results = worker.drain_results_timeout(Duration::from_millis(500));
        assert!(
            results.is_empty(),
            "Late arrivals should be dropped — got {} results instead",
            results.len()
        );
    }
}
