//! AVA Source Adapters
//!
//! Provides implementations of the `SourceAdapter` trait for various data sources:
//!
//! - [`MemoryAdapter`] - In-memory Arrow RecordBatch storage with DataFusion SQL
//! - [`SqliteAdapter`] - SQLite database adapter with async sqlx
//! - [`SourceTableProvider`] - Wraps SourceAdapters as DataFusion TableProviders
//! - [`AdapterRegistry`] - Thread-safe registry for managing adapters
//!
//! # Architecture
//!
//! ```text
//! ┌─────────────────────────────────────────────────────────────┐
//! │                      AdapterRegistry                         │
//! │  ┌───────────────┐  ┌───────────────┐  ┌────────────────┐  │
//! │  │ MemoryAdapter │  │ SqliteAdapter │  │ StreamAdapter  │  │
//! │  │   (SourceId)  │  │   (SourceId)  │  │  (SourceId)    │  │
//! │  └───────┬───────┘  └───────┬───────┘  └───────┬────────┘  │
//! └──────────┼──────────────────┼──────────────────┼────────────┘
//!            │                  │                  │
//!            ▼                  ▼                  ▼
//!     ┌──────────────────────────────────────────────────────┐
//!     │              SourceAdapter trait                      │
//!     │  - connect() / disconnect()                          │
//!     │  - query(sql) → RecordBatch                          │
//!     │  - schema() → SchemaRef                              │
//!     │  - subscribe() (streaming)                           │
//!     └──────────────────────────────────────────────────────┘
//!                              │
//!                              ▼
//!     ┌──────────────────────────────────────────────────────┐
//!     │              SourceTableProvider                      │
//!     │  - Wraps SourceAdapter as DataFusion TableProvider   │
//!     │  - Enables federated SQL queries across sources      │
//!     └──────────────────────────────────────────────────────┘
//! ```
//!
//! # Usage
//!
//! ```ignore
//! use ava_adapters::{MemoryAdapter, SqliteAdapter, AdapterRegistry, register_adapters};
//! use ava_domain::{SourceId, SourceKind};
//! use datafusion::prelude::*;
//!
//! // Create adapters
//! let memory = MemoryAdapter::new(SourceId::new("cache"), vec![batch1]);
//! let sqlite = SqliteAdapter::new(SourceId::new("db"), "/path/to/db.sqlite");
//!
//! // Register in a SessionContext for federated queries
//! let ctx = SessionContext::new();
//! register_adapters(&ctx, vec![Arc::new(memory), Arc::new(sqlite)]).await?;
//!
//! // Query across sources
//! let df = ctx.sql("SELECT * FROM cache UNION SELECT * FROM db").await?;
//! ```

pub mod memory;
pub mod registry;
pub mod sqlite;
pub mod table_provider;

// Re-exports
pub use memory::MemoryAdapter;
pub use registry::AdapterRegistry;
pub use sqlite::SqliteAdapter;
pub use table_provider::{SourceTableProvider, create_table_providers, register_adapters};

// Re-export domain types for convenience
pub use ava_domain::{
    SourceAdapter, DynSourceAdapter, SubscriptionHandle,
    SourceId, SourceKind, SourceError,
};
