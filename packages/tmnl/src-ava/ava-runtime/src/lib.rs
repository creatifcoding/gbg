//! AVA Runtime - Central orchestrator for view lifecycle management
//!
//! The runtime coordinates all AVA components to provide a unified API for
//! requesting, compiling, and executing views.
//!
//! # Architecture
//!
//! ```text
//! ┌─────────────────────────────────────────────────────────────────┐
//! │                         AvaRuntime                               │
//! │  ┌──────────────────────────────────────────────────────────┐  │
//! │  │                     SpecRegistry                          │  │
//! │  │  (ViewProfileSpec storage + versioning)                   │  │
//! │  └──────────────────────────────────────────────────────────┘  │
//! │                              │                                   │
//! │                              ▼                                   │
//! │  ┌──────────────────────────────────────────────────────────┐  │
//! │  │                     Reconciler                            │  │
//! │  │  (Desired → Actual state reconciliation)                  │  │
//! │  │  - EventLog (event sourcing)                              │  │
//! │  │  - Scheduler (lane-based priority)                        │  │
//! │  │  - ViewFibers (lifecycle state machines)                  │  │
//! │  └──────────────────────────────────────────────────────────┘  │
//! │                              │                                   │
//! │                              ▼                                   │
//! │  ┌──────────────────────────────────────────────────────────┐  │
//! │  │                    ViewCompiler                           │  │
//! │  │  (ChannelPipelineSpec → DataFusion LogicalPlan)           │  │
//! │  └──────────────────────────────────────────────────────────┘  │
//! │                              │                                   │
//! │                              ▼                                   │
//! │  ┌──────────────────────────────────────────────────────────┐  │
//! │  │                   AdapterRegistry                         │  │
//! │  │  (Source adapters: Memory, SQLite, Stream)                │  │
//! │  └──────────────────────────────────────────────────────────┘  │
//! └─────────────────────────────────────────────────────────────────┘
//! ```
//!
//! # Usage
//!
//! ```ignore
//! use ava_runtime::{AvaRuntime, RuntimeConfig};
//! use ava_domain::{ViewProfileSpec, ViewId, Lane};
//!
//! // Create runtime with default config
//! let runtime = AvaRuntime::new(RuntimeConfig::default());
//!
//! // Register a view spec
//! runtime.register_spec(spec).await?;
//!
//! // Request view instantiation
//! let view_id = runtime.request_view(&spec_id, Lane::Background).await?;
//!
//! // Wait for compilation and mounting
//! runtime.tick_all().await;
//!
//! // Get the computed artifact
//! let artifact = runtime.get_artifact(&view_id).await?;
//! ```

mod error;
mod spec_registry;
mod runtime;

pub use error::RuntimeError;
pub use spec_registry::SpecRegistry;
pub use runtime::{AvaRuntime, RuntimeConfig};

// Re-export commonly used types from dependencies
pub use ava_reconciler::{
    Reconciler, ReconcilerError,
    EventLog, ViewFiber, FiberState,
    LaneScheduler, ScheduledWork, QueueStats,
    Differ, DiffResult,
};
pub use ava_compiler::{ViewCompiler, CompiledView, CompilerError};
pub use ava_adapters::{AdapterRegistry, MemoryAdapter, SqliteAdapter};
pub use ava_domain::{
    ViewProfileSpec, ViewId, ViewArtifact, ViewDelta,
    ChannelPipelineSpec, ChannelId, ChannelRole,
    SourceSpec, SourceId, SourceKind,
    AssemblageId, Lane, UnmountReason,
};
