//! FusionEngine — supervised actor tree for multi-tier fusion.
//!
//! Pattern: Region-scoped GenServer that manages join path execution for a
//! single fusion tier. Supervised under `OneForAll` — if one tier fails,
//! all correlated tiers must restart together (shared fusion state).
//!
//! Each FusionEngine instance handles one tier:
//! - Tier 1 (hard-key): deterministic identity joins (ICAO, MMSI, IP)
//! - Tier 2 (soft-key): probabilistic correlation (spatial, temporal, spectral)
//! - Tier 3 (derived): statistical / behavioral patterns (R8)
//!
//! The engine delegates computation to a [`DataflowWorker`] running on a
//! dedicated OS thread. Communication uses crossbeam channels:
//! - `handle_cast(IngestReading)` → `DataflowCommand::Insert` via `cmd_tx`
//! - `handle_info(WindowFlush)` → `DataflowCommand::AdvanceTime` + drain results
//! - `on_start()` creates the worker; `on_stop()` shuts it down and joins the thread.
//!
//! ## asupersync Integration
//!
//! - `cx.masked()` — Cancel-masks `process_results()` and `TrackEvent` mutations
//!   to guarantee entity_tracks consistency even during supervisor-initiated shutdown.
//! - `cx.checkpoint()` — Records progress after batch processing for observability
//!   (stuck-task detection, work-stealing scheduler hints).
//! - `cx.trace()` — Structured telemetry events for each handler invocation.

use std::collections::HashMap;
use std::future::Future;
use std::pin::Pin;

use ava_fusion::{EntityId, FusionTier, JoinPathEntryV2, JoinPathId, SignalSourceId, TrackId};
use asupersync::cx::Cx;
use asupersync::gen_server::{GenServer, Reply, SystemMsg};
use asupersync::types::Budget;

use crate::dataflow::{DataflowCommand, DataflowWorker, FusionResult};

// ---------------------------------------------------------------------------
// Message types
// ---------------------------------------------------------------------------

/// Calls to the fusion engine.
#[derive(Debug)]
pub enum FusionCall {
    /// Evaluate a correlation between two observations.
    Correlate {
        source_a: SignalSourceId,
        source_b: SignalSourceId,
        /// Serialized observation payloads.
        payload_a: Vec<u8>,
        payload_b: Vec<u8>,
    },
    /// Query the current fusion state for an entity.
    GetEntityFusionState { entity_id: EntityId },
    /// List active join paths for this tier.
    ListActiveJoinPaths,
}

/// Reply from the fusion engine.
#[derive(Debug)]
pub enum FusionReply {
    /// Correlation result: confidence score and optional track assignment.
    CorrelationResult {
        confidence: f64,
        track_id: Option<TrackId>,
        join_path_id: JoinPathId,
    },
    /// Entity fusion state snapshot.
    EntityState {
        entity_id: EntityId,
        active_tracks: Vec<TrackId>,
        tier: FusionTier,
    },
    /// Active join paths in this tier.
    ActiveJoinPaths(Vec<JoinPathId>),
}

/// Cast messages (fire-and-forget sensor data feed).
#[derive(Debug)]
pub enum FusionCast {
    /// New sensor reading for fusion consideration.
    IngestReading {
        source_id: SignalSourceId,
        payload: Vec<u8>,
        timestamp_ms: f64,
    },
    /// Track lifecycle event from TrackManager.
    TrackEvent {
        track_id: TrackId,
        event: TrackEventKind,
    },
}

/// Track event kinds forwarded from TrackManager.
#[derive(Debug, Clone)]
pub enum TrackEventKind {
    Confirmed,
    Dropped,
    Merged { surviving_track: TrackId },
}

/// Info messages (system + timer ticks for windowed aggregation).
#[derive(Debug)]
pub enum FusionInfo {
    /// Periodic window flush tick.
    WindowFlush { window_id: u64 },
    /// System message.
    System(SystemMsg),
}

// ---------------------------------------------------------------------------
// Actor state
// ---------------------------------------------------------------------------

/// Fusion engine state for a single tier.
///
/// Manages active join paths, the dataflow worker thread, and track assignments
/// within a bounded region. Cancel propagation ensures all in-flight
/// join operators are cleaned up on region close.
pub struct FusionEngine {
    /// Which fusion tier this engine handles.
    tier: FusionTier,
    /// Human-readable name for tracing (e.g., "tier1-hard-key").
    name: String,
    /// Active join paths registered for this tier.
    active_join_paths: Vec<JoinPathId>,
    /// Full join path configs for dataflow graph construction.
    join_path_configs: Vec<JoinPathEntryV2>,
    /// Entity -> active tracks mapping for this tier's outputs.
    entity_tracks: HashMap<EntityId, Vec<TrackId>>,
    /// Handle to the dataflow worker thread (None before on_start).
    worker: Option<DataflowWorker>,
    /// Monotonic window counter for logical time.
    current_window: u64,
    /// Total correlations evaluated.
    total_evaluated: u64,
    /// Total results received from the dataflow worker.
    total_results: u64,
}

impl FusionEngine {
    /// Create a new fusion engine for the given tier.
    pub fn new(
        name: impl Into<String>,
        tier: FusionTier,
        join_paths: Vec<JoinPathId>,
        join_path_configs: Vec<JoinPathEntryV2>,
    ) -> Self {
        Self {
            tier,
            name: name.into(),
            active_join_paths: join_paths,
            join_path_configs,
            entity_tracks: HashMap::new(),
            worker: None,
            current_window: 0,
            total_evaluated: 0,
            total_results: 0,
        }
    }

    /// The fusion tier this engine handles.
    pub fn tier(&self) -> FusionTier {
        self.tier
    }

    /// Process a batch of fusion results from the dataflow worker.
    ///
    /// Updates entity_tracks for positive diffs (new matches) and
    /// removes tracks for negative diffs (retracted matches).
    fn process_results(&mut self, results: &[FusionResult]) {
        for result in results {
            self.total_results += 1;

            if result.diff > 0 {
                // New match: create/update entity track entry.
                let entity_id = EntityId::new(&result.left_key);
                let track_id = TrackId::new(format!(
                    "{}-{}-{}",
                    result.join_path_id, result.left_key, result.right_key
                ));
                let tracks = self.entity_tracks.entry(entity_id).or_default();
                if !tracks.contains(&track_id) {
                    tracks.push(track_id);
                }
            } else if result.diff < 0 {
                // Retracted match: remove track from entity.
                let entity_id = EntityId::new(&result.left_key);
                let track_id = TrackId::new(format!(
                    "{}-{}-{}",
                    result.join_path_id, result.left_key, result.right_key
                ));
                if let Some(tracks) = self.entity_tracks.get_mut(&entity_id) {
                    tracks.retain(|t| *t != track_id);
                    if tracks.is_empty() {
                        self.entity_tracks.remove(&entity_id);
                    }
                }
            }
        }
    }
}

// ---------------------------------------------------------------------------
// GenServer implementation
//
// NOTE: All handler logic is synchronous (no .await needed), so processing
// happens BEFORE the Box::pin(async {}) return. This allows free use of
// cx methods (checkpoint, masked, trace) without lifetime conflicts — the
// GenServer trait's return type Pin<Box<dyn Future + '_>> binds the lifetime
// to &mut self, not &Cx.
// ---------------------------------------------------------------------------

impl GenServer for FusionEngine {
    type Call = FusionCall;
    type Reply = FusionReply;
    type Cast = FusionCast;
    type Info = FusionInfo;

    fn handle_call(
        &mut self,
        cx: &Cx,
        request: Self::Call,
        reply: Reply<Self::Reply>,
    ) -> Pin<Box<dyn Future<Output = ()> + Send + '_>> {
        cx.trace("fusion_engine::handle_call");

        let response = match request {
            FusionCall::Correlate {
                source_a,
                source_b,
                payload_a: _,
                payload_b: _,
            } => {
                self.total_evaluated += 1;

                // Synchronous state lookup — doesn't go through the dataflow
                // worker. The dataflow handles streaming joins; Correlate is
                // for on-demand queries against current state.
                let confidence = match self.tier {
                    FusionTier::Tier1Kinematic => {
                        if source_a == source_b { 0.99 } else { 0.0 }
                    }
                    FusionTier::Tier2Attribute => 0.5,
                    FusionTier::Tier3Behavioral => 0.3,
                };

                FusionReply::CorrelationResult {
                    confidence,
                    track_id: None,
                    join_path_id: self
                        .active_join_paths
                        .first()
                        .cloned()
                        .unwrap_or_else(|| JoinPathId::new("default")),
                }
            }
            FusionCall::GetEntityFusionState { entity_id } => {
                let tracks = self
                    .entity_tracks
                    .get(&entity_id)
                    .cloned()
                    .unwrap_or_default();
                FusionReply::EntityState {
                    entity_id,
                    active_tracks: tracks,
                    tier: self.tier,
                }
            }
            FusionCall::ListActiveJoinPaths => {
                FusionReply::ActiveJoinPaths(self.active_join_paths.clone())
            }
        };
        let _ = reply.send(response);

        Box::pin(async {})
    }

    fn handle_cast(
        &mut self,
        cx: &Cx,
        msg: Self::Cast,
    ) -> Pin<Box<dyn Future<Output = ()> + Send + '_>> {
        cx.trace("fusion_engine::handle_cast");

        match msg {
            FusionCast::IngestReading {
                source_id,
                payload,
                timestamp_ms,
            } => {
                // Extract key from payload (use source_id as the routing key).
                let key = source_id.as_str().to_owned();

                if let Some(ref worker) = self.worker {
                    let _ = worker.send(DataflowCommand::Insert {
                        source_id: source_id.to_string(),
                        key,
                        value: payload,
                        timestamp_ms,
                        lat_deg: None, // TODO: extract from payload when spatial metadata available
                        lon_deg: None,
                    });
                }

                tracing::debug!(
                    engine = %self.name,
                    source = %source_id,
                    ts = timestamp_ms,
                    "Forwarded reading to dataflow worker"
                );
            }
            FusionCast::TrackEvent { track_id, event } => {
                // Cancel-mask track mutations to prevent partial updates
                // across entity_tracks when the supervisor cancels us.
                cx.masked(|| {
                    match event {
                        TrackEventKind::Dropped => {
                            for tracks in self.entity_tracks.values_mut() {
                                tracks.retain(|t| *t != track_id);
                            }
                        }
                        TrackEventKind::Merged { surviving_track } => {
                            for tracks in self.entity_tracks.values_mut() {
                                tracks.retain(|t| *t != track_id);
                                if !tracks.contains(&surviving_track) {
                                    tracks.push(surviving_track.clone());
                                }
                            }
                        }
                        TrackEventKind::Confirmed => {
                            // No-op; track already assigned.
                        }
                    }
                });
            }
        }

        Box::pin(async {})
    }

    fn handle_info(
        &mut self,
        cx: &Cx,
        msg: Self::Info,
    ) -> Pin<Box<dyn Future<Output = ()> + Send + '_>> {
        cx.trace("fusion_engine::handle_info");

        match msg {
            FusionInfo::WindowFlush { window_id: _ } => {
                // 1. Increment the monotonic window counter.
                self.current_window += 1;

                // 2. Drain results from the worker. We separate the immutable
                // worker borrow (send + drain) from the mutable self borrow
                // (process_results) to satisfy the borrow checker.
                let results = self.worker.as_ref().map(|worker| {
                    let _ = worker.send(DataflowCommand::AdvanceTime(self.current_window));
                    worker.drain_results()
                });

                // 3. Check budget before processing — if the budget is
                // exhausted, skip processing to avoid starving other actors.
                // Budget tracks poll_quota and cost_quota; exhaustion means
                // the supervisor wants us to yield.
                let budget = cx.budget();
                if budget.is_exhausted() {
                    tracing::warn!(
                        engine = %self.name,
                        window = self.current_window,
                        "Window flush: budget exhausted, deferring processing"
                    );
                    return Box::pin(async {});
                }

                // 4. Cancel-mask the state update: even if the supervisor
                // cancels us mid-flush, entity_tracks remains consistent.
                // cx.masked() defers cancellation until the closure returns.
                if let Some(results) = results {
                    let count = results.len();

                    cx.masked(|| {
                        self.process_results(&results);
                    });

                    if count > 0 {
                        // Record progress with context message for observability
                        // (detects stuck tasks, aids work-stealing decisions).
                        let _ = cx.checkpoint_with(format!(
                            "window {} processed {} results ({} entities)",
                            self.current_window, count, self.entity_tracks.len()
                        ));
                        tracing::info!(
                            engine = %self.name,
                            window = self.current_window,
                            results = count,
                            total_results = self.total_results,
                            entities = self.entity_tracks.len(),
                            "Window flush: processed results"
                        );
                    } else {
                        tracing::debug!(
                            engine = %self.name,
                            window = self.current_window,
                            "Window flush: no results"
                        );
                    }
                }
            }
            FusionInfo::System(_sys_msg) => {}
        }

        Box::pin(async {})
    }

    fn on_start(&mut self, cx: &Cx) -> Pin<Box<dyn Future<Output = ()> + Send + '_>> {
        cx.trace("fusion_engine::started");
        Box::pin(async move {
            // Create the DataflowWorker from join_path_configs.
            if !self.join_path_configs.is_empty() {
                let worker = DataflowWorker::new(self.join_path_configs.clone());
                self.worker = Some(worker);
                tracing::info!(
                    name = %self.name,
                    tier = ?self.tier,
                    join_paths = self.active_join_paths.len(),
                    configs = self.join_path_configs.len(),
                    "FusionEngine started with DataflowWorker"
                );
            } else {
                tracing::info!(
                    name = %self.name,
                    tier = ?self.tier,
                    join_paths = self.active_join_paths.len(),
                    "FusionEngine started (no configs, worker not created)"
                );
            }
        })
    }

    fn on_stop(&mut self, cx: &Cx) -> Pin<Box<dyn Future<Output = ()> + Send + '_>> {
        cx.trace("fusion_engine::stopped");
        Box::pin(async move {
            // 1. Shut down the dataflow worker thread.
            if let Some(mut worker) = self.worker.take() {
                // Signal cooperative cancel (belt).
                worker.request_cancel();
                // Send Shutdown command via channel (suspenders).
                worker.shutdown();
                tracing::info!(
                    name = %self.name,
                    "DataflowWorker thread joined"
                );
            }

            // 2. Log final stats.
            tracing::info!(
                name = %self.name,
                total_evaluated = self.total_evaluated,
                total_results = self.total_results,
                entities_tracked = self.entity_tracks.len(),
                "FusionEngine stopped"
            );
        })
    }

    fn on_start_budget(&self) -> Budget {
        Budget::INFINITE
    }

    fn on_stop_budget(&self) -> Budget {
        Budget::MINIMAL
    }
}
