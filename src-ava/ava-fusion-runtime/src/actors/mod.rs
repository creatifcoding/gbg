//! GenServer actor implementations for the Tsingou fusion pipeline.
//!
//! Six actors model the IIoT processing pipeline stages, each implementing
//! the asupersync [`GenServer`] trait with typed mailboxes:
//!
//! | Actor | Pattern | Key Trait |
//! |-------|---------|-----------|
//! | [`SensorIngestor`] | `handle_info` for NATS messages | Backpressure via `CastOverflowPolicy::DropOldest` |
//! | [`FusionEngine`] | Supervised actor tree + DataflowWorker | Region-scoped cancel propagation, differential-dataflow integration |
//! | [`AlarmEvaluator`] | `handle_call` with `Reply<AlarmAck>` | Obligation-tracked alarm lifecycle |
//! | [`TrackManager`] | Stateful GenServer | State machine: Tentative→Confirmed→Coasting→Dropped→Merged |
//! | [`AbsenceDetector`] | Timer-driven `handle_info(Timeout)` | Budget-bounded detection deadline |
//! | [`EntityResolver`] | Singleton via `NameRegistry` | `NameLease` obligation for registry entry |

pub mod sensor_ingestor;
pub mod fusion_engine;
pub mod alarm_evaluator;
pub mod track_manager;
pub mod absence_detector;
pub mod entity_resolver;

pub use sensor_ingestor::SensorIngestor;
pub use fusion_engine::FusionEngine;
pub use alarm_evaluator::{AlarmEvaluator, AlarmCall, AlarmAck};
pub use track_manager::TrackManager;
pub use absence_detector::{AbsenceDetector, AbsenceInfo};
pub use entity_resolver::EntityResolver;
