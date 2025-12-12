//! AVA Runtime - Central orchestrator for view lifecycle management
//!
//! The runtime coordinates all AVA components to provide a unified API for
//! requesting, compiling, and executing views.
//!
//! # Version Selection
//!
//! - **v1**: Tick-based pull model (DEPRECATED)
//! - **v2**: Event-driven reactive streaming (RECOMMENDED)
//!
//! # v2 Usage (Recommended)
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
//! ```
//!
//! # v1 Usage (Deprecated)
//!
//! ```ignore
//! use ava_runtime::v1::{AvaRuntime, RuntimeConfig};
//!
//! let runtime = AvaRuntime::new(RuntimeConfig::default());
//! runtime.request_view(spec, None).await?;
//! runtime.tick_all().await?;
//! let artifact = runtime.get_artifact(&view_id).await?;
//! ```

mod error;
mod spec_registry;

pub mod v1;
pub mod v2;

pub use error::RuntimeError;
pub use spec_registry::SpecRegistry;

// Re-export v2 as the default (recommended) API
pub use v2::{AvaRuntimeV2, RuntimeConfigV2, HydrationService, HydrationConfig, HydrationStrategy};

// Re-export v1 types at crate root for backward compatibility (deprecated)
#[deprecated(since = "0.2.0", note = "Use ava_runtime::v1::AvaRuntime instead, or migrate to v2")]
pub use v1::AvaRuntime;

#[deprecated(since = "0.2.0", note = "Use ava_runtime::v1::RuntimeConfig instead, or migrate to v2")]
pub use v1::RuntimeConfig;

// Re-export commonly used types from dependencies
pub use ava_compiler::{ViewCompiler, CompiledView, CompilerError};
pub use ava_adapters::{AdapterRegistry, MemoryAdapter, SqliteAdapter};
pub use ava_domain::{
    ViewProfileSpec, ViewId, ViewArtifact, ViewDelta,
    ChannelPipelineSpec, ChannelId, ChannelRole, ChannelBinding, ChannelData,
    SourceSpec, SourceId, SourceKind,
    AssemblageId, Lane, UnmountReason,
};

// Re-export v1 reconciler types (deprecated)
#[deprecated(since = "0.2.0", note = "Use ava_reconciler::v1 types directly")]
pub use ava_reconciler::v1::{
    Reconciler, ReconcilerError,
    EventLog, ViewFiber, FiberState,
    LaneScheduler, ScheduledWork, QueueStats,
    Differ, DiffResult,
};
