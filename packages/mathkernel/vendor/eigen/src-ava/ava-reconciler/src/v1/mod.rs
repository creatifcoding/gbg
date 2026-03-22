//! AVA Reconciler v1 (DEPRECATED)
//!
//! This is the original tick-based pull model reconciler.
//! It has been superseded by v2's event-driven reactive streaming architecture.
//!
//! # Deprecation Notice
//!
//! v1 uses a cooperative scheduling model where consumers must call `tick()`
//! to process work. This is useful for batch processing but not ideal for
//! real-time reactive dashboards.
//!
//! For new code, prefer `ava_reconciler::v2` which provides:
//! - Event-driven reactivity (no manual tick)
//! - `subscribe_view()` returns live artifact streams
//! - Multiple trigger modes (source changes, invalidation, timer)
//!
//! # Migration
//!
//! ```ignore
//! // v1 (deprecated)
//! let view_id = reconciler.request(spec, lane).await?;
//! reconciler.tick().await;
//! let fiber = reconciler.get_fiber(&view_id).await;
//!
//! // v2 (recommended)
//! let mut rx = reconciler.subscribe(spec).await;
//! while let Ok(artifact) = rx.recv().await {
//!     process(artifact);
//! }
//! ```

mod differ;
mod error;
mod event_log;
mod fiber;
mod reconciler;
mod scheduler;

pub use differ::{Differ, DiffResult};
pub use error::ReconcilerError;
pub use event_log::EventLog;
pub use fiber::{ViewFiber, FiberState};
pub use reconciler::Reconciler;
pub use scheduler::{LaneScheduler, ScheduledWork, QueueStats};
