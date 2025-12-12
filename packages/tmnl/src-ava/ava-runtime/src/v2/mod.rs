//! AVA Runtime v2 - Event-driven reactive streaming
//!
//! This is the production runtime using the event-driven model.
//! Views are subscribed to rather than polled, and artifacts stream
//! automatically via tokio broadcast channels.
//!
//! # Key Differences from v1
//!
//! - **No tick()**: Internal event loop handles all work processing
//! - **No get_artifact()**: Artifacts arrive via subscription receivers
//! - **subscribe_view()**: Returns `Receiver<ViewArtifact>` for continuous updates
//! - **Reactive triggers**: Source changes, invalidation, and timers all unified
//!
//! # Hydration Model (I47)
//!
//! The HydrationService populates `ChannelBinding.data` based on source type:
//! - **Server-hydrated**: SQL queries (Rows), aggregates (Inline), streams (StreamHandle)
//! - **Client-fetched**: Static assets like 3D models (AssetRef)
//!
//! # Usage
//!
//! ```ignore
//! use ava_runtime::v2::{AvaRuntimeV2, RuntimeConfigV2};
//! use ava_domain::ViewProfileSpec;
//!
//! let runtime = AvaRuntimeV2::new(RuntimeConfigV2::default());
//!
//! // Subscribe to a view - artifacts stream automatically
//! let mut rx = runtime.subscribe_view(spec).await?;
//!
//! // Receive artifacts as they're computed
//! while let Ok(artifact) = rx.recv().await {
//!     println!("Got artifact: {:?}", artifact.view_id);
//! }
//!
//! // Explicit invalidation triggers recomputation
//! runtime.invalidate(&view_id).await?;
//!
//! // Unsubscribe when done
//! runtime.unsubscribe(&view_id).await?;
//! ```

mod hydration;
mod runtime;

pub use hydration::{HydrationService, HydrationConfig, HydrationStrategy};
pub use runtime::{AvaRuntimeV2, RuntimeConfigV2};

// Re-export v2 reconciler types
pub use ava_reconciler::v2::{
    ReconcilerV2, ReconcilerConfigV2, ReconcilerErrorV2,
    ViewBroadcaster, BroadcasterConfig, LagStrategy,
    TriggerEngine, Trigger,
};
