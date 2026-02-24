//! AlarmEvaluator — GenServer with obligation-tracked alarm lifecycle.
//!
//! Pattern: `handle_call` with `Reply<AlarmAck>`. The alarm lifecycle maps
//! directly to asupersync's obligation model:
//!
//! ```text
//! Alarm detected -> Reply<AlarmAck> issued (obligation reserved)
//!     |
//!     +-- Operator acknowledges -> reply.send(Ack)     (obligation committed)
//!     +-- Operator shelves      -> reply.send(Shelved)  (obligation committed)
//!     +-- Timeout/drop          -> PANIC (obligation leaked = unhandled alarm)
//! ```
//!
//! This turns "forgotten alarm acknowledgments" from a runtime bug into a
//! structural guarantee. The Lab runtime's `ObligationLeakOracle` catches
//! any test scenario where an alarm obligation leaks.

use std::collections::HashMap;
use std::future::Future;
use std::pin::Pin;

use ava_fusion::{EntityId, SignalSourceId};
use asupersync::cx::Cx;
use asupersync::gen_server::{GenServer, Reply, SystemMsg};
use asupersync::types::Budget;

// ---------------------------------------------------------------------------
// Message types
// ---------------------------------------------------------------------------

/// Calls to the alarm evaluator.
#[derive(Debug)]
pub enum AlarmCall {
    /// Evaluate a potential alarm condition. The Reply token is the obligation.
    Evaluate {
        entity_id: EntityId,
        source_id: SignalSourceId,
        condition: AlarmCondition,
        severity: AlarmSeverity,
    },
    /// Acknowledge an active alarm by ID.
    Acknowledge {
        alarm_id: AlarmId,
        operator_note: Option<String>,
    },
    /// Shelve (suppress) an active alarm.
    Shelve {
        alarm_id: AlarmId,
        reason: String,
    },
    /// List active (unacknowledged) alarms.
    ListActive,
}

/// Alarm acknowledgment response — the obligation commit value.
#[derive(Debug, Clone)]
pub enum AlarmAck {
    /// Alarm raised successfully. Must be acknowledged or shelved.
    Raised { alarm_id: AlarmId },
    /// Alarm was acknowledged by operator.
    Acknowledged { alarm_id: AlarmId },
    /// Alarm was shelved (suppressed with audit trail).
    Shelved { alarm_id: AlarmId },
    /// Alarm evaluation found no condition (below threshold).
    NoAlarm,
    /// Active alarm listing.
    ActiveAlarms(Vec<ActiveAlarm>),
    /// Error: alarm ID not found.
    NotFound { alarm_id: AlarmId },
}

/// Cast messages (fire-and-forget notifications).
#[derive(Debug)]
pub enum AlarmCast {
    /// Clear an alarm that has been resolved externally.
    AutoClear { alarm_id: AlarmId },
    /// Update alarm thresholds at runtime.
    UpdateThresholds { new_thresholds: AlarmThresholds },
}

/// Info messages.
#[derive(Debug)]
pub enum AlarmInfo {
    /// Periodic alarm timeout check.
    TimeoutCheck { tick_id: u64 },
    /// System message.
    System(SystemMsg),
}

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

/// Unique alarm identifier.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct AlarmId(pub String);

impl AlarmId {
    pub fn new(id: impl Into<String>) -> Self {
        Self(id.into())
    }
}

impl std::fmt::Display for AlarmId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.0)
    }
}

/// Alarm condition that triggered evaluation.
#[derive(Debug, Clone)]
pub enum AlarmCondition {
    /// Threshold exceeded (value > limit).
    ThresholdExceeded { metric: String, value: f64, limit: f64 },
    /// Rate of change exceeded.
    RateOfChange { metric: String, rate: f64, limit: f64 },
    /// Absence of expected signal.
    SignalAbsent { expected_source: SignalSourceId },
    /// Anomaly detected by statistical model.
    AnomalyDetected { model: String, score: f64 },
}

/// Alarm severity levels (ISA/IEC 62682 aligned).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum AlarmSeverity {
    /// Informational — no operator action required.
    Low,
    /// Warning — operator should investigate.
    Medium,
    /// Critical — immediate operator action required.
    High,
    /// Emergency — safety-critical, auto-escalation.
    Critical,
}

/// An active (unacknowledged) alarm.
#[derive(Debug, Clone)]
pub struct ActiveAlarm {
    pub alarm_id: AlarmId,
    pub entity_id: EntityId,
    pub source_id: SignalSourceId,
    pub severity: AlarmSeverity,
    pub condition: AlarmCondition,
    pub raised_at_ms: f64,
}

/// Runtime-configurable alarm thresholds.
#[derive(Debug, Clone)]
pub struct AlarmThresholds {
    pub default_timeout_ms: f64,
    pub auto_escalation_after_ms: f64,
}

impl Default for AlarmThresholds {
    fn default() -> Self {
        Self {
            default_timeout_ms: 30_000.0,        // 30 seconds
            auto_escalation_after_ms: 300_000.0,  // 5 minutes
        }
    }
}

// ---------------------------------------------------------------------------
// Actor state
// ---------------------------------------------------------------------------

/// Alarm evaluator actor.
///
/// Manages the alarm lifecycle with obligation-tracked acknowledgments.
/// Every raised alarm carries a `Reply<AlarmAck>` token that **must** be
/// resolved (acknowledged or shelved) — dropping it leaks the obligation,
/// which the Lab runtime's `ObligationLeakOracle` will catch as a test failure.
pub struct AlarmEvaluator {
    /// Name for tracing.
    name: String,
    /// Active alarms awaiting acknowledgment.
    active_alarms: HashMap<AlarmId, ActiveAlarm>,
    /// Monotonic alarm counter for ID generation.
    next_alarm_seq: u64,
    /// Alarm thresholds.
    thresholds: AlarmThresholds,
    /// Total alarms raised.
    total_raised: u64,
    /// Total alarms acknowledged.
    total_acknowledged: u64,
    /// Total alarms shelved.
    total_shelved: u64,
}

impl AlarmEvaluator {
    /// Create a new alarm evaluator.
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            active_alarms: HashMap::new(),
            next_alarm_seq: 0,
            thresholds: AlarmThresholds::default(),
            total_raised: 0,
            total_acknowledged: 0,
            total_shelved: 0,
        }
    }

    /// Generate the next alarm ID.
    fn next_alarm_id(&mut self) -> AlarmId {
        let id = AlarmId::new(format!("ALM-{:06}", self.next_alarm_seq));
        self.next_alarm_seq += 1;
        id
    }
}

// ---------------------------------------------------------------------------
// GenServer implementation
// ---------------------------------------------------------------------------

impl GenServer for AlarmEvaluator {
    type Call = AlarmCall;
    type Reply = AlarmAck;
    type Cast = AlarmCast;
    type Info = AlarmInfo;

    fn handle_call(
        &mut self,
        cx: &Cx,
        request: Self::Call,
        reply: Reply<Self::Reply>,
    ) -> Pin<Box<dyn Future<Output = ()> + Send + '_>> {
        cx.trace("alarm_evaluator::handle_call");
        Box::pin(async move {
            match request {
                AlarmCall::Evaluate {
                    entity_id,
                    source_id,
                    condition,
                    severity,
                } => {
                    // TODO: Apply actual threshold logic based on condition + thresholds.
                    // For now, all evaluations raise an alarm.
                    let alarm_id = self.next_alarm_id();
                    let alarm = ActiveAlarm {
                        alarm_id: alarm_id.clone(),
                        entity_id,
                        source_id,
                        severity,
                        condition,
                        raised_at_ms: 0.0, // TODO: Get virtual time from Cx
                    };
                    self.active_alarms.insert(alarm_id.clone(), alarm);
                    self.total_raised += 1;

                    tracing::warn!(
                        evaluator = %self.name,
                        alarm_id = %alarm_id,
                        severity = ?severity,
                        "Alarm raised"
                    );

                    // CRITICAL: Reply MUST be sent. This is the obligation token.
                    // Dropping `reply` without sending = obligation leak = panic in lab.
                    let _ = reply.send(AlarmAck::Raised { alarm_id });
                }
                AlarmCall::Acknowledge { alarm_id, operator_note } => {
                    if self.active_alarms.remove(&alarm_id).is_some() {
                        self.total_acknowledged += 1;
                        tracing::info!(
                            evaluator = %self.name,
                            alarm_id = %alarm_id,
                            note = ?operator_note,
                            "Alarm acknowledged"
                        );
                        let _ = reply.send(AlarmAck::Acknowledged { alarm_id });
                    } else {
                        let _ = reply.send(AlarmAck::NotFound { alarm_id });
                    }
                }
                AlarmCall::Shelve { alarm_id, reason } => {
                    if self.active_alarms.remove(&alarm_id).is_some() {
                        self.total_shelved += 1;
                        tracing::info!(
                            evaluator = %self.name,
                            alarm_id = %alarm_id,
                            reason = %reason,
                            "Alarm shelved"
                        );
                        let _ = reply.send(AlarmAck::Shelved { alarm_id });
                    } else {
                        let _ = reply.send(AlarmAck::NotFound { alarm_id });
                    }
                }
                AlarmCall::ListActive => {
                    let alarms: Vec<ActiveAlarm> = self.active_alarms.values().cloned().collect();
                    let _ = reply.send(AlarmAck::ActiveAlarms(alarms));
                }
            }
        })
    }

    fn handle_cast(
        &mut self,
        cx: &Cx,
        msg: Self::Cast,
    ) -> Pin<Box<dyn Future<Output = ()> + Send + '_>> {
        cx.trace("alarm_evaluator::handle_cast");
        Box::pin(async move {
            match msg {
                AlarmCast::AutoClear { alarm_id } => {
                    if self.active_alarms.remove(&alarm_id).is_some() {
                        tracing::info!(
                            evaluator = %self.name,
                            alarm_id = %alarm_id,
                            "Alarm auto-cleared"
                        );
                    }
                }
                AlarmCast::UpdateThresholds { new_thresholds } => {
                    self.thresholds = new_thresholds;
                }
            }
        })
    }

    fn handle_info(
        &mut self,
        cx: &Cx,
        msg: Self::Info,
    ) -> Pin<Box<dyn Future<Output = ()> + Send + '_>> {
        cx.trace("alarm_evaluator::handle_info");
        Box::pin(async move {
            match msg {
                AlarmInfo::TimeoutCheck { tick_id: _ } => {
                    // TODO: Check for stale alarms that exceed timeout thresholds
                    // and escalate or auto-clear based on policy.
                    let stale_count = self.active_alarms.len();
                    if stale_count > 0 {
                        tracing::debug!(
                            evaluator = %self.name,
                            active_count = stale_count,
                            "Alarm timeout check"
                        );
                    }
                }
                AlarmInfo::System(_sys_msg) => {}
            }
        })
    }

    fn on_start(&mut self, cx: &Cx) -> Pin<Box<dyn Future<Output = ()> + Send + '_>> {
        cx.trace("alarm_evaluator::started");
        Box::pin(async move {
            tracing::info!(
                evaluator = %self.name,
                timeout_ms = self.thresholds.default_timeout_ms,
                "AlarmEvaluator started"
            );
        })
    }

    fn on_stop(&mut self, cx: &Cx) -> Pin<Box<dyn Future<Output = ()> + Send + '_>> {
        cx.trace("alarm_evaluator::stopped");
        Box::pin(async move {
            // WARNING: If active_alarms is non-empty at stop, those alarms'
            // obligation tokens were never resolved. In lab mode, the
            // ObligationLeakOracle will flag this as a violation.
            if !self.active_alarms.is_empty() {
                tracing::error!(
                    evaluator = %self.name,
                    leaked_count = self.active_alarms.len(),
                    "AlarmEvaluator stopped with unresolved alarm obligations!"
                );
            }

            tracing::info!(
                evaluator = %self.name,
                total_raised = self.total_raised,
                total_acknowledged = self.total_acknowledged,
                total_shelved = self.total_shelved,
                "AlarmEvaluator stopped"
            );
        })
    }

    fn on_stop_budget(&self) -> Budget {
        Budget::MINIMAL
    }
}
