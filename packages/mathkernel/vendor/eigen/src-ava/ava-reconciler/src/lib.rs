//! AVA Reconciler - View lifecycle management
//!
//! This crate provides two versions of the reconciler:
//!
//! ## v1 (Deprecated) - Tick-based Pull Model
//!
//! The original reconciler uses cooperative scheduling where consumers
//! must call `tick()` to process work. Useful for batch processing.
//!
//! ```ignore
//! use ava_reconciler::v1::Reconciler;
//!
//! let reconciler = Reconciler::new();
//! reconciler.request(spec, Lane::Background).await?;
//! reconciler.tick().await; // Manual work processing
//! ```
//!
//! ## v2 (Recommended) - Event-Driven Reactive Streams
//!
//! The new reconciler uses an internal event loop with `tokio::broadcast`
//! channels for live artifact streaming.
//!
//! ```ignore
//! use ava_reconciler::v2::ReconcilerV2;
//!
//! let reconciler = ReconcilerV2::new();
//! let mut rx = reconciler.subscribe(spec).await;
//! while let Ok(artifact) = rx.recv().await {
//!     process(artifact); // Automatic updates on data changes
//! }
//! ```
//!
//! # Architecture (v2)
//!
//! ```text
//! ┌─────────────────────────────────────────────────────────────┐
//! │                      ReconcilerV2                            │
//! │                                                              │
//! │   subscribe_view() ──▶ broadcast::Sender<ViewArtifact>      │
//! │                               │                              │
//! │   ┌───────────────────────────┼───────────────────────────┐ │
//! │   │      Internal Event Loop  ▼                           │ │
//! │   │                                                        │ │
//! │   │   Triggers:                                            │ │
//! │   │   ├─ Source changes ─┐                                │ │
//! │   │   ├─ invalidate()  ──├──▶ recompute ──▶ broadcast     │ │
//! │   │   └─ Timer ──────────┘                                │ │
//! │   │                                                        │ │
//! │   └────────────────────────────────────────────────────────┘ │
//! └─────────────────────────────────────────────────────────────┘
//! ```

pub mod v1;
pub mod v2;

// Re-export v1 types at crate root for backward compatibility
// These will be removed in a future version
#[deprecated(since = "0.2.0", note = "Use ava_reconciler::v1::Reconciler instead")]
pub use v1::Reconciler;

#[deprecated(since = "0.2.0", note = "Use ava_reconciler::v1::ReconcilerError instead")]
pub use v1::ReconcilerError;

#[deprecated(since = "0.2.0", note = "Use ava_reconciler::v1::EventLog instead")]
pub use v1::EventLog;

#[deprecated(since = "0.2.0", note = "Use ava_reconciler::v1::ViewFiber instead")]
pub use v1::ViewFiber;

#[deprecated(since = "0.2.0", note = "Use ava_reconciler::v1::FiberState instead")]
pub use v1::FiberState;

#[deprecated(since = "0.2.0", note = "Use ava_reconciler::v1::LaneScheduler instead")]
pub use v1::LaneScheduler;

#[deprecated(since = "0.2.0", note = "Use ava_reconciler::v1::ScheduledWork instead")]
pub use v1::ScheduledWork;

#[deprecated(since = "0.2.0", note = "Use ava_reconciler::v1::QueueStats instead")]
pub use v1::QueueStats;

#[deprecated(since = "0.2.0", note = "Use ava_reconciler::v1::Differ instead")]
pub use v1::Differ;

#[deprecated(since = "0.2.0", note = "Use ava_reconciler::v1::DiffResult instead")]
pub use v1::DiffResult;
