//! Durable Streams Adapter
//!
//! HTTP client and NATS bridge for the Durable Streams protocol.
//! Provides persistent, offset-based replay for AVA artifacts and deltas.
//!
//! # Architecture
//!
//! ```text
//! NATS JetStream → DurableStreamsBridge → HTTP POST → Durable Streams Server
//!                                                            │
//!                                                            ▼
//! Frontend ← HTTP GET (offset-based replay) ← Durable Streams Server
//! ```
//!
//! # Protocol
//!
//! Implements the Durable Streams Protocol v1.0:
//! - PUT /v1/stream/{path} - Create stream
//! - POST /v1/stream/{path} - Append data
//! - GET /v1/stream/{path}?offset={offset}&live={mode} - Read with replay
//!
//! # Usage
//!
//! ```ignore
//! use ava_adapters::durable_streams::{DurableStreamsClient, DurableStreamsBridge, DurableStreamsConfig};
//!
//! // Create client
//! let config = DurableStreamsConfig {
//!     base_url: "http://localhost:3030".into(),
//!     ..Default::default()
//! };
//! let client = DurableStreamsClient::new(config)?;
//!
//! // Create stream
//! client.create_stream("tmnl/artifacts", ContentType::Json).await?;
//!
//! // Append data
//! let offset = client.append("tmnl/artifacts", &artifact_json).await?;
//!
//! // Read from beginning
//! let (data, next_offset) = client.read("tmnl/artifacts", Offset::Beginning).await?;
//! ```
//!
//! # NATS Bridge
//!
//! ```ignore
//! // Bridge NATS subjects to durable streams
//! let bridge = DurableStreamsBridge::new(nats_client, ds_client)
//!     .map_subject("tmnl.ava.artifacts.*", "tmnl/artifacts")
//!     .map_subject("tmnl.ava.deltas.*", "tmnl/deltas");
//!
//! bridge.start().await?;
//! ```

mod client;
mod config;
mod error;
mod bridge;

pub use client::{DurableStreamsClient, Offset, ContentType, ReadResult};
pub use config::DurableStreamsConfig;
pub use error::DurableStreamsError;
pub use bridge::{DurableStreamsBridge, SubjectMapping};
