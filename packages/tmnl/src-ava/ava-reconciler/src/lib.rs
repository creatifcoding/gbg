//! AVA Reconciler - React-style view lifecycle management
//!
//! The reconciler maintains the relationship between desired state (ViewProfileSpec)
//! and actual state (ViewArtifact), producing actions to bring actual toward desired.
//!
//! # Architecture
//!
//! ```text
//! ┌─────────────────┐
//! │  Desired Views  │  (ViewProfileSpec from client requests)
//! └────────┬────────┘
//!          │
//!          ▼
//! ┌─────────────────┐
//! │    Differ       │  (Compare desired vs active)
//! └────────┬────────┘
//!          │
//!          ▼
//! ┌─────────────────┐
//! │  FiberActions   │  (Compile, Mount, Update, Unmount)
//! └────────┬────────┘
//!          │
//!          ▼
//! ┌─────────────────┐
//! │   Scheduler     │  (Lane-based priority queue)
//! └────────┬────────┘
//!          │
//!          ▼
//! ┌─────────────────┐
//! │   EventLog      │  (Durable event sourcing)
//! └─────────────────┘
//! ```

mod event_log;
mod fiber;
pub mod scheduler;
mod differ;
mod reconciler;
mod error;

pub use event_log::EventLog;
pub use fiber::{ViewFiber, FiberState};
pub use scheduler::{LaneScheduler, ScheduledWork, QueueStats};
pub use differ::{Differ, DiffResult};
pub use reconciler::Reconciler;
pub use error::ReconcilerError;
