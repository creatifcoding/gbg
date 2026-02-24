//! # ava-web — GenServer-Native HTTP Framework
//!
//! Built entirely on asupersync's executor, reactor, and I/O primitives.
//! Zero tokio. Zero hyper. Stateful, supervised, budget-aware.
//!
//! ## Quick Start
//!
//! ```ignore
//! use ava_web::{Router, get, HttpServer, ServerConfig};
//! use ava_web::response::Json;
//!
//! async fn hello() -> &'static str {
//!     "Hello from ava-web!"
//! }
//!
//! async fn users() -> Json<Vec<&'static str>> {
//!     Json(vec!["alice", "bob"])
//! }
//!
//! let app = Router::new()
//!     .route("/", get(hello))
//!     .route("/users", get(users));
//!
//! // Blocking — creates its own runtime and blocks until shutdown
//! HttpServer::bind("127.0.0.1:3000")
//!     .await?
//!     .serve(app)?;
//!
//! // Or async on an existing runtime:
//! // server.serve_on(app, &runtime_handle).await?;
//! ```
//!
//! ## Architecture
//!
//! Every long-lived concern is a supervised GenServer actor:
//! - Connection handlers
//! - WebSocket sessions
//! - Rate limiters
//! - Metrics collectors
//!
//! Stateless handlers (`async fn` with extractors) are first-class citizens.
//! Actor handlers (GenServer-backed routes) are the differentiator.

pub mod auth;
pub mod error;
pub mod session;
pub mod extractor;
pub mod handler;
pub mod middleware;
pub mod response;
pub mod router;
pub mod server;
pub mod state;
pub mod sse;
pub mod ws;

// Protocol handlers — gated behind features due to API drift with asupersync
#[cfg(feature = "h2")]
pub mod h2;
#[cfg(feature = "h3")]
pub mod h3;

// HTTP client + source adapter actors (outbound data ingestion)
pub mod client;
pub mod source_adapter;
pub mod adapter_server;

// Advanced features
pub mod metrics;
pub mod multipart;
pub mod nats_bridge;
pub mod openapi;
pub mod static_files;
pub mod testing;

// Lab-powered testing (chaos, fuzz, virtual time, scenarios)
#[cfg(feature = "lab")]
pub mod lab;

// ── Re-exports ──────────────────────────────────────────────────────────────

pub use router::{Router, MethodRouter};
pub use router::{get, post, put, delete, patch, head, options};
pub use server::{ConnectInfo, HttpServer, ServerConfig};
pub use handler::Handler;
pub use extractor::{FromRequest, FromRequestParts, HeaderMap, Method, Path, Query, Json, State, Form};
pub use response::IntoResponse;
pub use error::AppError;
pub use state::{ActorHandler, ActorPool, ActorHandlerWrapper, ActorPoolHandler};
pub use auth::{MacaroonAuth, MacaroonIssuer, AuthenticatedToken, token_to_bearer, token_from_bearer};
pub use session::{
    HttpChan, SessionProof as HttpSessionProof, ProtocolHandler,
    HttpHandlerSession, HttpCallerSession,
    MiddlewareSession, MiddlewareCallerSession,
    StreamIterSession, StreamConsumerSession, StreamFrame,
    WsUpgradeServerSession, ErrorResponse,
    new_handler_session, new_middleware_session,
    new_stream_iteration, new_ws_upgrade_session,
    run_handler_protocol,
};
pub use client::{FetchClient, FetchConfig, FetchRequest, FetchResponse, FetchStatus, FetchError};
pub use source_adapter::{
    SourceAdapter, AdapterActor, AdapterState, AdapterMetrics, PollOutcome, FetchResult, Record,
    CircuitBreaker, CircuitState, RetryPolicy, RateLimitState, ConditionalCache, AdapterError,
};
pub use adapter_server::{
    AdapterServer, AdapterServerBuilder, AdapterInfo, AdapterCall, AdapterReply, AdapterHealth,
};
