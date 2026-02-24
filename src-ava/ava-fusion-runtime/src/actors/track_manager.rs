//! TrackManager — stateful GenServer implementing the track lifecycle
//! state machine.
//!
//! Pattern: Stateful GenServer with the track lifecycle FSM:
//!
//! ```text
//! Tentative -> Confirmed -> Coasting -> Dropped
//!                  ^          |
//!                  +----------+ (recovery)
//!          any non-terminal -> Merged
//! ```
//!
//! Supervised under `OneForOne`. State is persisted via JetStream for
//! crash recovery (the JetStream persistence layer is in `nats_kv.rs`).

use std::collections::HashMap;
use std::future::Future;
use std::pin::Pin;

use ava_fusion::{
    EntityId, TrackId, TrackLifecycleState, LifecycleTransition,
    TransitionReason, is_valid_transition,
};
use asupersync::cx::Cx;
use asupersync::gen_server::{GenServer, Reply, SystemMsg};
use asupersync::types::Budget;

// ---------------------------------------------------------------------------
// Message types
// ---------------------------------------------------------------------------

/// Calls to the track manager.
#[derive(Debug)]
pub enum TrackCall {
    /// Create a new tentative track.
    CreateTrack {
        track_id: TrackId,
        entity_id: EntityId,
    },
    /// Request a state transition for an existing track.
    Transition {
        track_id: TrackId,
        to_state: TrackLifecycleState,
        reason: TransitionReason,
    },
    /// Query the current state of a track.
    GetTrackState { track_id: TrackId },
    /// List all tracks for an entity.
    ListEntityTracks { entity_id: EntityId },
    /// Get all active (non-terminal) track count.
    ActiveTrackCount,
}

/// Reply from the track manager.
#[derive(Debug)]
pub enum TrackReply {
    /// Track created successfully.
    Created { track_id: TrackId },
    /// Transition applied.
    Transitioned {
        track_id: TrackId,
        transition: LifecycleTransition,
    },
    /// Transition rejected (invalid state transition).
    TransitionRejected {
        track_id: TrackId,
        current: TrackLifecycleState,
        requested: TrackLifecycleState,
    },
    /// Track state snapshot.
    TrackState {
        track_id: TrackId,
        state: TrackLifecycleState,
        entity_id: EntityId,
    },
    /// Track not found.
    NotFound { track_id: TrackId },
    /// List of tracks for an entity.
    EntityTracks(Vec<TrackSnapshot>),
    /// Count of active tracks.
    Count(usize),
}

/// Cast messages.
#[derive(Debug)]
pub enum TrackCast {
    /// Observation received for a track — resets coast timer.
    ObservationReceived { track_id: TrackId, timestamp_ms: f64 },
    /// Bulk purge all dropped/merged tracks older than threshold.
    PurgeTerminal { older_than_ms: f64 },
}

/// Info messages.
#[derive(Debug)]
pub enum TrackInfo {
    /// Periodic coast evaluation tick.
    CoastCheck { tick_id: u64 },
    /// System message.
    System(SystemMsg),
}

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

/// Snapshot of a single track's state.
#[derive(Debug, Clone)]
pub struct TrackSnapshot {
    pub track_id: TrackId,
    pub entity_id: EntityId,
    pub state: TrackLifecycleState,
    pub created_at_ms: f64,
    pub last_observation_ms: f64,
    pub observation_count: u32,
}

/// Internal track record.
struct TrackRecord {
    entity_id: EntityId,
    state: TrackLifecycleState,
    created_at_ms: f64,
    last_observation_ms: f64,
    observation_count: u32,
}

// ---------------------------------------------------------------------------
// Actor state
// ---------------------------------------------------------------------------

/// Track manager actor.
///
/// Maintains the lifecycle state of all fused tracks. Each track follows
/// the FSM defined in `ava_fusion::track`. Invalid transitions are
/// rejected with diagnostic information.
pub struct TrackManager {
    /// Name for tracing.
    name: String,
    /// Track ID -> record mapping.
    tracks: HashMap<TrackId, TrackRecord>,
    /// Entity ID -> track IDs reverse index.
    entity_index: HashMap<EntityId, Vec<TrackId>>,
    /// Total transitions applied.
    total_transitions: u64,
    /// Total transitions rejected.
    total_rejected: u64,
}

impl TrackManager {
    /// Create a new track manager.
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            tracks: HashMap::new(),
            entity_index: HashMap::new(),
            total_transitions: 0,
            total_rejected: 0,
        }
    }

    /// Count of non-terminal tracks.
    fn active_count(&self) -> usize {
        self.tracks
            .values()
            .filter(|r| !r.state.is_terminal())
            .count()
    }

    /// Build a track snapshot from a record.
    fn snapshot(track_id: &TrackId, record: &TrackRecord) -> TrackSnapshot {
        TrackSnapshot {
            track_id: track_id.clone(),
            entity_id: record.entity_id.clone(),
            state: record.state,
            created_at_ms: record.created_at_ms,
            last_observation_ms: record.last_observation_ms,
            observation_count: record.observation_count,
        }
    }
}

// ---------------------------------------------------------------------------
// GenServer implementation
// ---------------------------------------------------------------------------

impl GenServer for TrackManager {
    type Call = TrackCall;
    type Reply = TrackReply;
    type Cast = TrackCast;
    type Info = TrackInfo;

    fn handle_call(
        &mut self,
        cx: &Cx,
        request: Self::Call,
        reply: Reply<Self::Reply>,
    ) -> Pin<Box<dyn Future<Output = ()> + Send + '_>> {
        cx.trace("track_manager::handle_call");
        Box::pin(async move {
            let response = match request {
                TrackCall::CreateTrack { track_id, entity_id } => {
                    let record = TrackRecord {
                        entity_id: entity_id.clone(),
                        state: TrackLifecycleState::Tentative,
                        created_at_ms: 0.0, // TODO: virtual time from Cx
                        last_observation_ms: 0.0,
                        observation_count: 1,
                    };
                    self.tracks.insert(track_id.clone(), record);
                    self.entity_index
                        .entry(entity_id)
                        .or_default()
                        .push(track_id.clone());

                    tracing::debug!(
                        manager = %self.name,
                        track_id = %track_id,
                        "Track created (Tentative)"
                    );
                    TrackReply::Created { track_id }
                }

                TrackCall::Transition { track_id, to_state, reason } => {
                    if let Some(record) = self.tracks.get_mut(&track_id) {
                        let from_state = record.state;

                        if is_valid_transition(from_state, to_state) {
                            record.state = to_state;
                            self.total_transitions += 1;

                            let transition = LifecycleTransition {
                                track_id: track_id.clone(),
                                from_state,
                                to_state,
                                reason,
                                timestamp_ms: 0.0, // TODO: virtual time
                            };

                            tracing::info!(
                                manager = %self.name,
                                track_id = %track_id,
                                from = %from_state,
                                to = %to_state,
                                reason = %reason,
                                "Track transition applied"
                            );

                            TrackReply::Transitioned { track_id, transition }
                        } else {
                            self.total_rejected += 1;
                            tracing::warn!(
                                manager = %self.name,
                                track_id = %track_id,
                                current = %from_state,
                                requested = %to_state,
                                "Track transition rejected (invalid)"
                            );
                            TrackReply::TransitionRejected {
                                track_id,
                                current: from_state,
                                requested: to_state,
                            }
                        }
                    } else {
                        TrackReply::NotFound { track_id }
                    }
                }

                TrackCall::GetTrackState { track_id } => {
                    if let Some(record) = self.tracks.get(&track_id) {
                        TrackReply::TrackState {
                            track_id,
                            state: record.state,
                            entity_id: record.entity_id.clone(),
                        }
                    } else {
                        TrackReply::NotFound { track_id }
                    }
                }

                TrackCall::ListEntityTracks { entity_id } => {
                    let snapshots = self
                        .entity_index
                        .get(&entity_id)
                        .map(|ids| {
                            ids.iter()
                                .filter_map(|tid| {
                                    self.tracks
                                        .get(tid)
                                        .map(|r| Self::snapshot(tid, r))
                                })
                                .collect()
                        })
                        .unwrap_or_default();
                    TrackReply::EntityTracks(snapshots)
                }

                TrackCall::ActiveTrackCount => {
                    TrackReply::Count(self.active_count())
                }
            };
            let _ = reply.send(response);
        })
    }

    fn handle_cast(
        &mut self,
        cx: &Cx,
        msg: Self::Cast,
    ) -> Pin<Box<dyn Future<Output = ()> + Send + '_>> {
        cx.trace("track_manager::handle_cast");
        Box::pin(async move {
            match msg {
                TrackCast::ObservationReceived { track_id, timestamp_ms } => {
                    if let Some(record) = self.tracks.get_mut(&track_id) {
                        record.last_observation_ms = timestamp_ms;
                        record.observation_count += 1;
                    }
                }
                TrackCast::PurgeTerminal { older_than_ms: _ } => {
                    // TODO: Remove terminal tracks older than threshold
                    // and clean up entity_index.
                    let before = self.tracks.len();
                    self.tracks.retain(|_, r| !r.state.is_terminal());
                    let purged = before - self.tracks.len();
                    if purged > 0 {
                        // Clean up entity index
                        for ids in self.entity_index.values_mut() {
                            ids.retain(|tid| self.tracks.contains_key(tid));
                        }
                        self.entity_index.retain(|_, ids| !ids.is_empty());
                        tracing::debug!(
                            manager = %self.name,
                            purged,
                            "Purged terminal tracks"
                        );
                    }
                }
            }
        })
    }

    fn handle_info(
        &mut self,
        cx: &Cx,
        msg: Self::Info,
    ) -> Pin<Box<dyn Future<Output = ()> + Send + '_>> {
        cx.trace("track_manager::handle_info");
        Box::pin(async move {
            match msg {
                TrackInfo::CoastCheck { tick_id: _ } => {
                    // TODO: Evaluate coasting tracks for timeout -> Dropped transition.
                    // This would check `last_observation_ms` against coast config
                    // and trigger Transition calls for expired tracks.
                    let coasting = self
                        .tracks
                        .values()
                        .filter(|r| r.state == TrackLifecycleState::Coasting)
                        .count();
                    if coasting > 0 {
                        tracing::debug!(
                            manager = %self.name,
                            coasting_tracks = coasting,
                            "Coast check tick"
                        );
                    }
                }
                TrackInfo::System(_sys_msg) => {}
            }
        })
    }

    fn on_start(&mut self, cx: &Cx) -> Pin<Box<dyn Future<Output = ()> + Send + '_>> {
        cx.trace("track_manager::started");
        Box::pin(async move {
            tracing::info!(
                manager = %self.name,
                "TrackManager started"
            );
        })
    }

    fn on_stop(&mut self, cx: &Cx) -> Pin<Box<dyn Future<Output = ()> + Send + '_>> {
        cx.trace("track_manager::stopped");
        Box::pin(async move {
            tracing::info!(
                manager = %self.name,
                total_tracks = self.tracks.len(),
                active = self.active_count(),
                total_transitions = self.total_transitions,
                total_rejected = self.total_rejected,
                "TrackManager stopped"
            );
        })
    }

    fn on_stop_budget(&self) -> Budget {
        Budget::MINIMAL
    }
}
