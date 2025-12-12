//! AVA Runtime v1 (DEPRECATED)
//!
//! This is the original tick-based pull model runtime.
//! Use `ava_runtime::v2::AvaRuntimeV2` for the event-driven streaming model.
//!
//! # Migration Guide
//!
//! | v1 Method | v2 Equivalent |
//! |-----------|---------------|
//! | `request_view()` + `tick_all()` + `get_artifact()` | `subscribe_view()` returns `Receiver<ViewArtifact>` |
//! | `tick()` | Removed - internal event loop handles this |
//! | `tick_all()` | Removed - views stream automatically |
//! | `get_artifact()` | Removed - artifacts arrive via subscription |
//! | `unmount_view()` | `unsubscribe()` |

mod runtime;

pub use runtime::{AvaRuntime, RuntimeConfig};

// Re-export v1 reconciler types
pub use ava_reconciler::v1::{
    Reconciler, ReconcilerError,
    EventLog, ViewFiber, FiberState,
    LaneScheduler, ScheduledWork, QueueStats,
    Differ, DiffResult,
};
