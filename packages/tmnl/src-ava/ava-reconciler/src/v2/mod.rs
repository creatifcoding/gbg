//! AVA Reconciler v2 - Event-Driven Reactive Streams
//!
//! This is the new reconciler architecture that replaces the tick-based
//! pull model with an event-driven reactive streaming approach.
//!
//! # Key Components
//!
//! - [`ViewBroadcaster`] - Multi-consumer artifact distribution via tokio::broadcast
//! - [`TriggerEngine`] - Event-driven reactivity (source changes, invalidation, timer)
//! - [`ReconcilerV2`] - Main orchestrator with internal event loop
//!
//! # Usage
//!
//! ```ignore
//! use ava_reconciler::v2::ReconcilerV2;
//!
//! let reconciler = ReconcilerV2::new(ReconcilerConfigV2::default());
//!
//! // Subscribe to a view - returns live artifact stream
//! let mut rx = reconciler.subscribe(spec).await;
//!
//! // Artifacts pushed automatically on data changes
//! while let Ok(artifact) = rx.recv().await {
//!     process(artifact);
//! }
//!
//! // Manual invalidation if needed
//! reconciler.invalidate(&view_id).await;
//!
//! // Graceful shutdown
//! reconciler.shutdown().await;
//! ```
//!
//! # Trigger Modes
//!
//! Views are recomputed when:
//! 1. **Source Changes** - Underlying data source is mutated
//! 2. **Invalidation** - `invalidate()` called explicitly
//! 3. **Timer** - `refresh_ms` interval elapsed

mod broadcaster;
mod trigger;
mod reconciler;
mod config;
mod error;

pub use broadcaster::{ViewBroadcaster, BroadcasterConfig, LagStrategy};
pub use trigger::{TriggerEngine, Trigger};
pub use reconciler::ReconcilerV2;
pub use config::ReconcilerConfigV2;
pub use error::ReconcilerErrorV2;
