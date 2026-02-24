//! HTTP/3 + QUIC connection handler (feature-gated).
//!
//! Gated behind `#[cfg(feature = "h3")]`. Provides the same
//! Router/Handler/Middleware stack as HTTP/1.1 and HTTP/2.
//!
//! # Current State
//!
//! asupersync provides an HTTP/3 **client** (`H3Client` / `H3Driver`) over
//! QUIC via the `h3` and `h3-quinn` crates, feature-gated behind `http3`.
//! However, there is **no server-side HTTP/3 implementation** in asupersync
//! as of v0.2.5.
//!
//! This module provides:
//! - `H3Config` — Configuration struct mirroring H2Config for future use
//! - ALPN/QUIC constants for HTTP/3
//! - Placeholder types for the server-side connection handler
//!
//! # What Would Be Needed for Full H3 Server
//!
//! 1. **QUIC listener** — asupersync would need `quinn::Endpoint` server
//!    mode wrapping (currently only client `QuicConnection` exists)
//! 2. **H3 server connection** — The `h3` crate provides
//!    `h3::server::Connection` which accepts QUIC connections and
//!    yields request/response pairs. asupersync would need to wrap this
//!    with `Cx` cancellation semantics like it does for the client.
//! 3. **Request bridging** — HTTP/3 uses the same pseudo-header scheme
//!    as HTTP/2 (`:method`, `:path`, `:scheme`, `:authority`), so the
//!    header bridging from `h2.rs` can be reused directly.
//! 4. **0-RTT support** — QUIC's 0-RTT requires careful handling to
//!    prevent replay attacks. The server must validate 0-RTT data
//!    and fall back to 1-RTT when appropriate.
//! 5. **Connection migration** — QUIC supports connection migration
//!    across network changes. The server must handle path validation
//!    and update peer address tracking.
//!
//! # Architecture Notes
//!
//! When server-side H3 is implemented, it should follow the same pattern
//! as `H2Connection`:
//!
//! ```text
//! QUIC Listener
//!   -> Accept QuicConnection
//!   -> h3::server::Connection wrapping
//!   -> For each request stream:
//!     -> Extract pseudo-headers (reuse h2::convert_h2_headers_to_web)
//!     -> Dispatch through Router
//!     -> Send response headers + body on the stream
//! ```
//!
//! The key difference from H2 is that QUIC streams are independent —
//! no head-of-line blocking between streams, unlike TCP-based H2.

// ── H3Config ────────────────────────────────────────────────────────────────

/// HTTP/3 server configuration.
///
/// Mirrors H2Config but with QUIC-specific settings. Currently a
/// placeholder — will be populated when asupersync gains server-side
/// H3 support.
#[derive(Debug, Clone)]
pub struct H3Config {
    /// Maximum number of concurrent bidirectional streams.
    pub max_concurrent_bidi_streams: u64,
    /// Maximum number of concurrent unidirectional streams.
    pub max_concurrent_uni_streams: u64,
    /// Initial stream-level flow control window size (bytes).
    pub initial_stream_window_size: u64,
    /// Initial connection-level flow control window size (bytes).
    pub initial_connection_window_size: u64,
    /// Maximum idle timeout (milliseconds). 0 = no timeout.
    pub max_idle_timeout_ms: u64,
    /// Whether to enable 0-RTT (requires TLS session tickets).
    pub enable_0rtt: bool,
    /// Maximum header list size (bytes, QPACK).
    pub max_header_list_size: u64,
}

impl Default for H3Config {
    fn default() -> Self {
        Self {
            max_concurrent_bidi_streams: 256,
            max_concurrent_uni_streams: 16,
            initial_stream_window_size: 1024 * 1024,     // 1 MB
            initial_connection_window_size: 10 * 1024 * 1024, // 10 MB
            max_idle_timeout_ms: 30_000,
            enable_0rtt: false, // Disabled by default for security
            max_header_list_size: 65536,
        }
    }
}

impl H3Config {
    /// Set max concurrent bidirectional streams.
    #[must_use]
    pub fn max_concurrent_bidi_streams(mut self, n: u64) -> Self {
        self.max_concurrent_bidi_streams = n;
        self
    }

    /// Set max concurrent unidirectional streams.
    #[must_use]
    pub fn max_concurrent_uni_streams(mut self, n: u64) -> Self {
        self.max_concurrent_uni_streams = n;
        self
    }

    /// Set initial stream window size.
    #[must_use]
    pub fn initial_stream_window_size(mut self, size: u64) -> Self {
        self.initial_stream_window_size = size;
        self
    }

    /// Set initial connection window size.
    #[must_use]
    pub fn initial_connection_window_size(mut self, size: u64) -> Self {
        self.initial_connection_window_size = size;
        self
    }

    /// Set max idle timeout in milliseconds (0 = no timeout).
    #[must_use]
    pub fn max_idle_timeout_ms(mut self, ms: u64) -> Self {
        self.max_idle_timeout_ms = ms;
        self
    }

    /// Enable or disable 0-RTT connection establishment.
    ///
    /// # Security Warning
    ///
    /// 0-RTT data is vulnerable to replay attacks. Only enable this if
    /// your application can safely handle replayed requests (e.g., GET
    /// requests for idempotent resources).
    #[must_use]
    pub fn enable_0rtt(mut self, enable: bool) -> Self {
        self.enable_0rtt = enable;
        self
    }

    /// Set max header list size (QPACK).
    #[must_use]
    pub fn max_header_list_size(mut self, size: u64) -> Self {
        self.max_header_list_size = size;
        self
    }
}

// ── ALPN / QUIC Constants ──────────────────────────────────────────────────

/// ALPN protocol identifier for HTTP/3.
pub const ALPN_H3: &[u8] = b"h3";

/// ALPN protocol identifiers for HTTP/3 draft versions (for compatibility).
pub const ALPN_H3_29: &[u8] = b"h3-29";

/// Default QUIC port for HTTP/3 (same as HTTPS).
pub const DEFAULT_H3_PORT: u16 = 443;

// ── Placeholder Types ──────────────────────────────────────────────────────

/// Server-side HTTP/3 connection handler.
///
/// **Not yet implemented.** asupersync v0.2.5 provides only client-side
/// HTTP/3 support. This placeholder documents the intended API surface.
///
/// When implemented, this will wrap a QUIC server endpoint and dispatch
/// incoming requests through the Router, similar to `h2::H2Connection`.
///
/// # Future API
///
/// ```ignore
/// use ava_web::h3::{H3Config, H3ServerConnection};
///
/// let config = H3Config::default()
///     .max_concurrent_bidi_streams(128)
///     .enable_0rtt(false);
///
/// // Future: Accept QUIC connections and dispatch through Router
/// let h3_conn = H3ServerConnection::new(config, quic_connection);
/// ```
pub struct H3ServerConnection {
    config: H3Config,
    // TODO(Phase 8): When asupersync adds server-side QUIC support:
    // - quic_endpoint: asupersync::net::quic::QuicEndpoint (server mode)
    // - h3_connection: h3::server::Connection<QuicConnection, Bytes>
    // - peer_addr: Option<SocketAddr>
}

impl H3ServerConnection {
    /// Create a new H3 server connection (placeholder).
    ///
    /// This currently only stores the configuration. Actual QUIC
    /// connection handling will be added when asupersync provides
    /// server-side QUIC support.
    #[must_use]
    pub fn new(config: H3Config) -> Self {
        Self { config }
    }

    /// Get the configuration.
    #[must_use]
    pub fn config(&self) -> &H3Config {
        &self.config
    }
}

// ── Alt-Svc Header Helper ──────────────────────────────────────────────────

/// Build an `Alt-Svc` header value for advertising HTTP/3 support.
///
/// Per RFC 9110 Section 7.4, servers advertise HTTP/3 availability via
/// the `Alt-Svc` response header so HTTP/1.1 and HTTP/2 clients can
/// upgrade.
///
/// # Example
///
/// ```
/// use ava_web::h3::alt_svc_header;
///
/// let value = alt_svc_header(443, 3600);
/// assert_eq!(value, "h3=\":443\"; ma=3600");
/// ```
#[must_use]
pub fn alt_svc_header(port: u16, max_age_secs: u32) -> String {
    format!("h3=\":{port}\"; ma={max_age_secs}")
}

// ── Tests ──────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn h3_config_defaults() {
        let config = H3Config::default();
        assert_eq!(config.max_concurrent_bidi_streams, 256);
        assert_eq!(config.max_concurrent_uni_streams, 16);
        assert_eq!(config.initial_stream_window_size, 1024 * 1024);
        assert_eq!(config.initial_connection_window_size, 10 * 1024 * 1024);
        assert_eq!(config.max_idle_timeout_ms, 30_000);
        assert!(!config.enable_0rtt);
        assert_eq!(config.max_header_list_size, 65536);
    }

    #[test]
    fn h3_config_builder() {
        let config = H3Config::default()
            .max_concurrent_bidi_streams(128)
            .max_concurrent_uni_streams(8)
            .initial_stream_window_size(2 * 1024 * 1024)
            .initial_connection_window_size(20 * 1024 * 1024)
            .max_idle_timeout_ms(60_000)
            .enable_0rtt(true)
            .max_header_list_size(131072);

        assert_eq!(config.max_concurrent_bidi_streams, 128);
        assert_eq!(config.max_concurrent_uni_streams, 8);
        assert_eq!(config.initial_stream_window_size, 2 * 1024 * 1024);
        assert_eq!(config.initial_connection_window_size, 20 * 1024 * 1024);
        assert_eq!(config.max_idle_timeout_ms, 60_000);
        assert!(config.enable_0rtt);
        assert_eq!(config.max_header_list_size, 131072);
    }

    #[test]
    fn h3_server_connection_placeholder() {
        let config = H3Config::default().max_concurrent_bidi_streams(64);
        let conn = H3ServerConnection::new(config);
        assert_eq!(conn.config().max_concurrent_bidi_streams, 64);
    }

    #[test]
    fn alt_svc_header_format() {
        let value = alt_svc_header(443, 3600);
        assert_eq!(value, "h3=\":443\"; ma=3600");

        let value = alt_svc_header(8443, 86400);
        assert_eq!(value, "h3=\":8443\"; ma=86400");
    }

    #[test]
    fn alpn_constants() {
        assert_eq!(ALPN_H3, b"h3");
        assert_eq!(ALPN_H3_29, b"h3-29");
        assert_eq!(DEFAULT_H3_PORT, 443);
    }
}
