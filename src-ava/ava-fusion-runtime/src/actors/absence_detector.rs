//! AbsenceDetector — timer-driven GenServer for missing signal detection.
//!
//! Pattern: `handle_info(Timeout)` triggers periodic absence evaluation.
//! Uses asupersync's `Budget` to enforce detection deadlines — if the
//! budget expires before detection completes, the evaluation is cancelled
//! (budget-bounded computation).
//!
//! Monitors expected signal sources and raises absence events when signals
//! are not received within their configured deadlines. Integrates with
//! `AlarmEvaluator` for alarm lifecycle management and `TrackManager`
//! for coasting track detection.

use std::collections::HashMap;
use std::future::Future;
use std::pin::Pin;

use ava_fusion::{EntityId, SignalKind, SignalSourceId};
use asupersync::cx::Cx;
use asupersync::gen_server::{GenServer, Reply, SystemMsg};
use asupersync::types::Budget;

// ---------------------------------------------------------------------------
// Message types
// ---------------------------------------------------------------------------

/// Calls to the absence detector.
#[derive(Debug)]
pub enum AbsenceCall {
    /// Register an expected signal source with its deadline.
    RegisterExpected {
        source_id: SignalSourceId,
        signal_kind: SignalKind,
        entity_id: Option<EntityId>,
        /// Maximum allowed silence in milliseconds before absence is declared.
        deadline_ms: f64,
    },
    /// Unregister an expected signal source.
    Unregister { source_id: SignalSourceId },
    /// Query current absence status.
    GetStatus,
    /// List all registered expectations.
    ListExpectations,
}

/// Reply from the absence detector.
#[derive(Debug)]
pub enum AbsenceReply {
    /// Registration confirmed.
    Registered { source_id: SignalSourceId },
    /// Unregistration confirmed.
    Unregistered { source_id: SignalSourceId },
    /// Source not found for unregistration.
    NotFound { source_id: SignalSourceId },
    /// Current absence status.
    Status {
        registered_count: usize,
        absent_count: usize,
        absent_sources: Vec<AbsentSource>,
    },
    /// All registered expectations.
    Expectations(Vec<ExpectedSignal>),
}

/// Cast messages.
#[derive(Debug)]
pub enum AbsenceCast {
    /// Signal received — reset the absence timer for this source.
    SignalReceived {
        source_id: SignalSourceId,
        timestamp_ms: f64,
    },
    /// Bulk signal received (multiple sources in one batch).
    BulkSignalReceived {
        signals: Vec<(SignalSourceId, f64)>,
    },
}

/// Info messages.
#[derive(Debug)]
pub enum AbsenceInfo {
    /// Periodic absence evaluation tick (timer-driven).
    EvaluationTick {
        tick_id: u64,
        /// Current virtual time in milliseconds for deadline comparison.
        current_time_ms: f64,
    },
    /// System message.
    System(SystemMsg),
}

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

/// An expected signal source registration.
#[derive(Debug, Clone)]
pub struct ExpectedSignal {
    pub source_id: SignalSourceId,
    pub signal_kind: SignalKind,
    pub entity_id: Option<EntityId>,
    pub deadline_ms: f64,
    pub last_seen_ms: Option<f64>,
}

/// A source that has been declared absent.
#[derive(Debug, Clone)]
pub struct AbsentSource {
    pub source_id: SignalSourceId,
    pub signal_kind: SignalKind,
    pub entity_id: Option<EntityId>,
    /// How long the source has been silent (ms).
    pub silence_duration_ms: f64,
    /// The configured deadline (ms).
    pub deadline_ms: f64,
}

/// Internal record for tracking expected signals.
struct ExpectationRecord {
    signal_kind: SignalKind,
    entity_id: Option<EntityId>,
    deadline_ms: f64,
    last_seen_ms: Option<f64>,
    /// Whether this source is currently in absence state.
    is_absent: bool,
}

// ---------------------------------------------------------------------------
// Actor state
// ---------------------------------------------------------------------------

/// Absence detector actor.
///
/// Timer-driven evaluation of expected signals. On each `EvaluationTick`,
/// all registered expectations are checked against their deadlines.
/// Sources exceeding their deadline are flagged as absent and emitted
/// as `AbsentSource` events for downstream consumers (AlarmEvaluator,
/// TrackManager).
pub struct AbsenceDetector {
    /// Name for tracing.
    name: String,
    /// Source ID → expectation record.
    expectations: HashMap<SignalSourceId, ExpectationRecord>,
    /// Total absence events raised.
    total_absences_detected: u64,
    /// Total recoveries (source came back after absence).
    total_recoveries: u64,
    /// Total evaluation ticks processed.
    total_ticks: u64,
}

impl AbsenceDetector {
    /// Create a new absence detector.
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            expectations: HashMap::new(),
            total_absences_detected: 0,
            total_recoveries: 0,
            total_ticks: 0,
        }
    }

    /// Evaluate all expectations against the current time.
    /// Returns newly absent sources (those that transitioned to absent this tick).
    fn evaluate(&mut self, current_time_ms: f64) -> Vec<AbsentSource> {
        let mut newly_absent = Vec::new();

        for (source_id, record) in &mut self.expectations {
            let silence = match record.last_seen_ms {
                Some(last) => current_time_ms - last,
                None => current_time_ms, // Never seen = silent since start
            };

            if silence > record.deadline_ms {
                if !record.is_absent {
                    // Transition to absent.
                    record.is_absent = true;
                    newly_absent.push(AbsentSource {
                        source_id: source_id.clone(),
                        signal_kind: record.signal_kind,
                        entity_id: record.entity_id.clone(),
                        silence_duration_ms: silence,
                        deadline_ms: record.deadline_ms,
                    });
                }
            } else if record.is_absent {
                // Recovery: was absent, now within deadline.
                record.is_absent = false;
                self.total_recoveries += 1;
            }
        }

        newly_absent
    }
}

// ---------------------------------------------------------------------------
// GenServer implementation
// ---------------------------------------------------------------------------

impl GenServer for AbsenceDetector {
    type Call = AbsenceCall;
    type Reply = AbsenceReply;
    type Cast = AbsenceCast;
    type Info = AbsenceInfo;

    fn handle_call(
        &mut self,
        cx: &Cx,
        request: Self::Call,
        reply: Reply<Self::Reply>,
    ) -> Pin<Box<dyn Future<Output = ()> + Send + '_>> {
        cx.trace("absence_detector::handle_call");
        Box::pin(async move {
            let response = match request {
                AbsenceCall::RegisterExpected {
                    source_id,
                    signal_kind,
                    entity_id,
                    deadline_ms,
                } => {
                    self.expectations.insert(
                        source_id.clone(),
                        ExpectationRecord {
                            signal_kind,
                            entity_id,
                            deadline_ms,
                            last_seen_ms: None,
                            is_absent: false,
                        },
                    );
                    tracing::debug!(
                        detector = %self.name,
                        source = %source_id,
                        deadline_ms,
                        "Registered expected signal"
                    );
                    AbsenceReply::Registered { source_id }
                }

                AbsenceCall::Unregister { source_id } => {
                    if self.expectations.remove(&source_id).is_some() {
                        AbsenceReply::Unregistered { source_id }
                    } else {
                        AbsenceReply::NotFound { source_id }
                    }
                }

                AbsenceCall::GetStatus => {
                    let absent_sources: Vec<AbsentSource> = self
                        .expectations
                        .iter()
                        .filter(|(_, r)| r.is_absent)
                        .map(|(sid, r)| AbsentSource {
                            source_id: sid.clone(),
                            signal_kind: r.signal_kind,
                            entity_id: r.entity_id.clone(),
                            silence_duration_ms: 0.0, // TODO: compute from current time
                            deadline_ms: r.deadline_ms,
                        })
                        .collect();
                    AbsenceReply::Status {
                        registered_count: self.expectations.len(),
                        absent_count: absent_sources.len(),
                        absent_sources,
                    }
                }

                AbsenceCall::ListExpectations => {
                    let expectations: Vec<ExpectedSignal> = self
                        .expectations
                        .iter()
                        .map(|(sid, r)| ExpectedSignal {
                            source_id: sid.clone(),
                            signal_kind: r.signal_kind,
                            entity_id: r.entity_id.clone(),
                            deadline_ms: r.deadline_ms,
                            last_seen_ms: r.last_seen_ms,
                        })
                        .collect();
                    AbsenceReply::Expectations(expectations)
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
        cx.trace("absence_detector::handle_cast");
        Box::pin(async move {
            match msg {
                AbsenceCast::SignalReceived { source_id, timestamp_ms } => {
                    if let Some(record) = self.expectations.get_mut(&source_id) {
                        record.last_seen_ms = Some(timestamp_ms);
                        // If was absent, recovery will be detected on next tick.
                    }
                }
                AbsenceCast::BulkSignalReceived { signals } => {
                    for (source_id, timestamp_ms) in signals {
                        if let Some(record) = self.expectations.get_mut(&source_id) {
                            record.last_seen_ms = Some(timestamp_ms);
                        }
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
        cx.trace("absence_detector::handle_info");

        // NOTE: All handler logic is synchronous — process BEFORE Box::pin.
        // GenServer trait's Pin<Box<dyn Future + '_>> binds '_ to &mut self,
        // not &Cx. Capturing cx in the async block causes lifetime conflicts.
        match msg {
            AbsenceInfo::EvaluationTick { tick_id: _, current_time_ms } => {
                self.total_ticks += 1;

                // Checkpoint with context message before evaluation —
                // allows the supervisor to cancel us between ticks and
                // provides rich diagnostics for stuck-task detection.
                if cx.checkpoint_with(format!(
                    "tick {} evaluating {} expectations",
                    self.total_ticks, self.expectations.len()
                )).is_err() {
                    tracing::debug!(
                        detector = %self.name,
                        "Evaluation cancelled by supervisor"
                    );
                    return Box::pin(async {});
                }

                // Use virtual time from timer_driver if available,
                // falling back to the message's wall-clock timestamp.
                // Virtual time enables deterministic testing under LabRuntime.
                let eval_time_ms = cx.timer_driver()
                    .map(|d| d.now().as_millis() as f64)
                    .unwrap_or(current_time_ms);

                let newly_absent = self.evaluate(eval_time_ms);
                if !newly_absent.is_empty() {
                    self.total_absences_detected += newly_absent.len() as u64;
                    for absent in &newly_absent {
                        tracing::warn!(
                            detector = %self.name,
                            source = %absent.source_id,
                            signal_kind = ?absent.signal_kind,
                            silence_ms = absent.silence_duration_ms,
                            deadline_ms = absent.deadline_ms,
                            "Absence detected"
                        );
                    }
                    // TODO: Forward absence events to AlarmEvaluator
                    // via cast or through a shared channel.
                }
            }
            AbsenceInfo::System(_sys_msg) => {}
        }

        Box::pin(async {})
    }

    fn on_start(&mut self, cx: &Cx) -> Pin<Box<dyn Future<Output = ()> + Send + '_>> {
        cx.trace("absence_detector::started");
        Box::pin(async move {
            tracing::info!(
                detector = %self.name,
                registered = self.expectations.len(),
                "AbsenceDetector started"
            );
        })
    }

    fn on_stop(&mut self, cx: &Cx) -> Pin<Box<dyn Future<Output = ()> + Send + '_>> {
        cx.trace("absence_detector::stopped");
        Box::pin(async move {
            tracing::info!(
                detector = %self.name,
                total_ticks = self.total_ticks,
                total_absences = self.total_absences_detected,
                total_recoveries = self.total_recoveries,
                "AbsenceDetector stopped"
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
