//! HTTP/2 connection handler.
//!
//! Wraps asupersync's `http::h2` module for multiplexed HTTP/2 connections.
//! Uses the same Router/Handler/Middleware stack as HTTP/1.1 — protocol
//! details are transparent to handler code.
//!
//! # Architecture
//!
//! asupersync provides a low-level HTTP/2 state machine (`Connection`,
//! `FrameCodec`, `StreamStore`) but no high-level server/listener like
//! the HTTP/1.1 `Http1Listener`. This module bridges the gap:
//!
//! 1. **`H2Config`** — HTTP/2-specific settings (window size, max streams,
//!    max frame size, server push, etc.)
//! 2. **Header bridging** — HPACK `Header` <-> `HashMap<String, String>` +
//!    pseudo-header extraction for method/path/authority
//! 3. **`H2Connection`** — Server-side connection handler that processes
//!    frames from the `FrameCodec`, reassembles streams, dispatches
//!    through the Router, and sends responses back as H2 frames.
//!
//! # Example
//!
//! ```ignore
//! use ava_web::h2::H2Config;
//!
//! let config = H2Config::default()
//!     .max_concurrent_streams(128)
//!     .initial_window_size(1 << 20)
//!     .enable_server_push(false);
//! ```
//!
//! # Protocol Transparency
//!
//! The Router/Handler/Middleware stack is identical for H1 and H2. The
//! protocol layer handles:
//! - HPACK header compression/decompression
//! - Stream multiplexing and flow control
//! - GOAWAY/RST_STREAM for graceful shutdown
//! - Server push (if enabled)
//!
//! Handlers receive the same `Request` type and return the same `Response`
//! type regardless of protocol version.

use std::collections::HashMap;
use std::net::SocketAddr;

use asupersync::http::h2::connection::{Connection, ConnectionState, ReceivedFrame};
use asupersync::http::h2::error::{ErrorCode, H2Error};
// Re-export Header so benchmarks and external consumers can construct H2 headers.
pub use asupersync::http::h2::hpack::Header;
use asupersync::http::h2::settings::Settings;
use asupersync::http::h2::FrameCodec;
use bytes::Bytes;

use crate::extractor::Request as WebRequest;
use crate::response::Response as WebResponse;
use crate::server::ConnectInfo;

// ── H2Config ────────────────────────────────────────────────────────────────

/// HTTP/2 specific server configuration.
///
/// Maps to asupersync's `Settings` with sensible server defaults.
/// Builder pattern matches `ServerConfig` style from the H1 layer.
#[derive(Debug, Clone)]
pub struct H2Config {
    /// Maximum number of concurrent streams per connection.
    pub max_concurrent_streams: u32,
    /// Initial stream-level flow control window size (bytes).
    pub initial_window_size: u32,
    /// Maximum frame payload size (bytes, 16384..16777215).
    pub max_frame_size: u32,
    /// Maximum size of the HPACK header table (bytes).
    pub header_table_size: u32,
    /// Maximum header list size (bytes).
    pub max_header_list_size: u32,
    /// Whether to enable server push (PUSH_PROMISE).
    pub enable_push: bool,
    /// Continuation frame sequence timeout (milliseconds).
    pub continuation_timeout_ms: u64,
}

impl Default for H2Config {
    fn default() -> Self {
        Self {
            max_concurrent_streams: 256,
            initial_window_size: 65535,
            max_frame_size: 16384,
            header_table_size: 4096,
            max_header_list_size: 65536,
            enable_push: false, // Disabled by default for servers
            continuation_timeout_ms: 5000,
        }
    }
}

impl H2Config {
    /// Set max concurrent streams.
    #[must_use]
    pub fn max_concurrent_streams(mut self, n: u32) -> Self {
        self.max_concurrent_streams = n;
        self
    }

    /// Set initial window size for stream-level flow control.
    #[must_use]
    pub fn initial_window_size(mut self, size: u32) -> Self {
        self.initial_window_size = size;
        self
    }

    /// Set max frame payload size.
    ///
    /// Must be between 16384 (16 KB) and 16777215 (16 MB - 1).
    /// Values outside this range will be clamped.
    #[must_use]
    pub fn max_frame_size(mut self, size: u32) -> Self {
        self.max_frame_size = size.clamp(16384, 16_777_215);
        self
    }

    /// Set HPACK header table size.
    #[must_use]
    pub fn header_table_size(mut self, size: u32) -> Self {
        self.header_table_size = size;
        self
    }

    /// Set max header list size.
    #[must_use]
    pub fn max_header_list_size(mut self, size: u32) -> Self {
        self.max_header_list_size = size;
        self
    }

    /// Enable or disable server push (PUSH_PROMISE frames).
    #[must_use]
    pub fn enable_server_push(mut self, enable: bool) -> Self {
        self.enable_push = enable;
        self
    }

    /// Set continuation timeout in milliseconds.
    #[must_use]
    pub fn continuation_timeout_ms(mut self, ms: u64) -> Self {
        self.continuation_timeout_ms = ms;
        self
    }

    /// Convert to asupersync's `Settings`.
    #[must_use]
    pub fn to_h2_settings(&self) -> Settings {
        Settings {
            header_table_size: self.header_table_size,
            enable_push: self.enable_push,
            max_concurrent_streams: self.max_concurrent_streams,
            initial_window_size: self.initial_window_size,
            max_frame_size: self.max_frame_size,
            max_header_list_size: self.max_header_list_size,
            continuation_timeout_ms: self.continuation_timeout_ms,
        }
    }

    /// Create an asupersync `Connection` in server mode with these settings.
    #[must_use]
    pub fn build_server_connection(&self) -> Connection {
        Connection::server(self.to_h2_settings())
    }

    /// Create a `FrameCodec` configured with this config's max frame size.
    #[must_use]
    pub fn build_frame_codec(&self) -> FrameCodec {
        let mut codec = FrameCodec::new();
        codec.set_max_frame_size(self.max_frame_size);
        codec
    }
}

// ── Pseudo-Header Constants ────────────────────────────────────────────────

/// HTTP/2 pseudo-header names (RFC 7540 Section 8.1.2.3).
const PSEUDO_METHOD: &str = ":method";
const PSEUDO_PATH: &str = ":path";
const PSEUDO_SCHEME: &str = ":scheme";
const PSEUDO_AUTHORITY: &str = ":authority";
const PSEUDO_STATUS: &str = ":status";

// ── Header Bridging ────────────────────────────────────────────────────────

/// Parsed pseudo-headers from an HTTP/2 request HEADERS frame.
#[derive(Debug, Clone, Default)]
pub struct PseudoHeaders {
    /// HTTP method (from `:method`).
    pub method: Option<String>,
    /// Request path (from `:path`).
    pub path: Option<String>,
    /// URI scheme (from `:scheme`).
    pub scheme: Option<String>,
    /// Authority/host (from `:authority`).
    pub authority: Option<String>,
}

/// Convert HTTP/2 HPACK headers into a web framework `Request`.
///
/// Extracts pseudo-headers (`:method`, `:path`, `:scheme`, `:authority`)
/// and maps remaining headers into the request's header map.
///
/// # Arguments
///
/// * `headers` - HPACK-decoded headers from the HEADERS frame
/// * `body` - Accumulated body data (from DATA frames)
/// * `peer_addr` - Remote peer address, if known
pub fn convert_h2_headers_to_web(
    headers: &[Header],
    body: &[u8],
    peer_addr: Option<SocketAddr>,
) -> Result<WebRequest, H2Error> {
    let mut pseudo = PseudoHeaders::default();
    let mut regular_headers = crate::extractor::HeaderMap::with_capacity(headers.len());

    for header in headers {
        let name = header.name.as_str();
        let value = header.value.as_str();

        if name.starts_with(':') {
            match name {
                PSEUDO_METHOD => pseudo.method = Some(value.to_string()),
                PSEUDO_PATH => pseudo.path = Some(value.to_string()),
                PSEUDO_SCHEME => pseudo.scheme = Some(value.to_string()),
                PSEUDO_AUTHORITY => pseudo.authority = Some(value.to_string()),
                _ => {
                    return Err(H2Error::protocol(format!(
                        "unknown pseudo-header: {name}"
                    )));
                }
            }
        } else {
            regular_headers.insert(name.to_lowercase(), value.to_string());
        }
    }

    let method_str = pseudo
        .method
        .ok_or_else(|| H2Error::protocol("missing :method pseudo-header"))?;
    let method = crate::extractor::Method::from(method_str.as_str());
    let full_path = pseudo
        .path
        .ok_or_else(|| H2Error::protocol("missing :path pseudo-header"))?;

    // Parse path into path and query components
    let (path, query) = full_path.split_once('?').map_or_else(
        || (full_path.clone(), None),
        |(p, q)| (p.to_string(), Some(q.to_string())),
    );

    // If :authority is present but no Host header, add it
    if let Some(ref authority) = pseudo.authority {
        if !regular_headers.contains_key("host") {
            regular_headers.insert("host".to_string(), authority.clone());
        }
    }

    let mut req = WebRequest {
        method,
        path,
        query,
        headers: regular_headers,
        body: Bytes::copy_from_slice(body),
        path_params: HashMap::new(),
        extensions: crate::extractor::Extensions::new(),
    };

    // Inject peer addr as extension if available
    if let Some(addr) = peer_addr {
        req.extensions.insert(ConnectInfo(addr));
    }

    Ok(req)
}

/// Convert a web framework `Response` into HTTP/2 response headers and body.
///
/// Returns a tuple of `(response_headers, body_bytes)` where:
/// - `response_headers` includes the `:status` pseudo-header followed by
///   regular headers
/// - `body_bytes` is the response body to send in DATA frames
pub fn convert_web_to_h2(resp: WebResponse) -> (Vec<Header>, Bytes) {
    let mut headers = Vec::with_capacity(resp.headers.len() + 1);

    // :status pseudo-header MUST come first
    headers.push(Header {
        name: PSEUDO_STATUS.to_string(),
        value: resp.status.as_u16().to_string(),
    });

    // Regular headers
    for (name, value) in &resp.headers {
        headers.push(Header {
            name: name.to_string(),
            value: value.to_string(),
        });
    }

    (headers, resp.body)
}

// ── H2Connection (Server-Side) ─────────────────────────────────────────────

/// Server-side HTTP/2 connection handler.
///
/// Wraps an asupersync `Connection` and dispatches received requests
/// through the Router. Each multiplexed stream maps to one request/response
/// cycle.
///
/// # Frame Processing Loop
///
/// The connection handler implements this loop:
///
/// 1. Decode frames via `FrameCodec`
/// 2. Feed frames to `Connection::process_frame`
/// 3. On `ReceivedFrame::Headers` with `end_stream` — dispatch through Router
/// 4. On `ReceivedFrame::Data` — accumulate body, dispatch on `end_stream`
/// 5. Send response headers + data via `Connection::send_headers` / `send_data`
/// 6. Process `Connection::pending_ops` into outbound frames
///
/// # Limitations (Phase 7)
///
/// - No TLS/ALPN negotiation (assumes h2c or prior-knowledge upgrade)
/// - Server push support is structural only (PUSH_PROMISE frames can be
///   queued but no high-level API for push resources)
/// - No priority-based scheduling (streams dispatched in arrival order)
pub struct H2Connection {
    /// The underlying asupersync H2 connection state machine.
    connection: Connection,
    /// Frame codec for the byte stream.
    codec: FrameCodec,
    /// Accumulated body data per stream.
    stream_bodies: HashMap<u32, Vec<u8>>,
    /// Accumulated request headers per stream (set after HEADERS frame).
    stream_headers: HashMap<u32, Vec<Header>>,
    /// Configuration snapshot.
    config: H2Config,
    /// Peer address for ConnectInfo injection.
    peer_addr: Option<SocketAddr>,
}

impl H2Connection {
    /// Create a new server-side H2 connection handler.
    #[must_use]
    pub fn new(config: H2Config) -> Self {
        let connection = config.build_server_connection();
        let codec = config.build_frame_codec();
        Self {
            connection,
            codec,
            stream_bodies: HashMap::new(),
            stream_headers: HashMap::new(),
            config,
            peer_addr: None,
        }
    }

    /// Set the peer address for ConnectInfo injection.
    #[must_use]
    pub fn with_peer_addr(mut self, addr: SocketAddr) -> Self {
        self.peer_addr = Some(addr);
        self
    }

    /// Get a reference to the underlying connection.
    #[must_use]
    pub fn connection(&self) -> &Connection {
        &self.connection
    }

    /// Get a mutable reference to the underlying connection.
    pub fn connection_mut(&mut self) -> &mut Connection {
        &mut self.connection
    }

    /// Get a reference to the frame codec.
    #[must_use]
    pub fn codec(&self) -> &FrameCodec {
        &self.codec
    }

    /// Get a mutable reference to the frame codec.
    pub fn codec_mut(&mut self) -> &mut FrameCodec {
        &mut self.codec
    }

    /// Get the connection state.
    #[must_use]
    pub fn state(&self) -> ConnectionState {
        self.connection.state()
    }

    /// Get the configuration.
    #[must_use]
    pub fn config(&self) -> &H2Config {
        &self.config
    }

    /// Process a received frame and return any completed requests.
    ///
    /// When a stream's headers and body are fully received (indicated by
    /// `end_stream`), returns the stream ID and a `WebRequest` ready
    /// for router dispatch.
    ///
    /// # Returns
    ///
    /// - `Ok(Some((stream_id, request)))` — A complete request is ready
    /// - `Ok(None)` — Frame processed, but no complete request yet
    /// - `Err(H2Error)` — Protocol error
    pub fn process_received_frame(
        &mut self,
        frame: asupersync::http::h2::Frame,
    ) -> Result<Option<(u32, WebRequest)>, H2Error> {
        let received = self.connection.process_frame(frame)?;

        match received {
            Some(ReceivedFrame::Headers {
                stream_id,
                headers,
                end_stream,
            }) => {
                self.stream_headers.insert(stream_id, headers);
                if end_stream {
                    // No body expected — dispatch immediately
                    self.build_request(stream_id)
                } else {
                    // Body will follow in DATA frames
                    self.stream_bodies.entry(stream_id).or_default();
                    Ok(None)
                }
            }
            Some(ReceivedFrame::Data {
                stream_id,
                data,
                end_stream,
            }) => {
                self.stream_bodies
                    .entry(stream_id)
                    .or_default()
                    .extend_from_slice(&data);

                if end_stream {
                    self.build_request(stream_id)
                } else {
                    Ok(None)
                }
            }
            Some(ReceivedFrame::Reset { stream_id, .. }) => {
                // Clean up stream state
                self.stream_bodies.remove(&stream_id);
                self.stream_headers.remove(&stream_id);
                Ok(None)
            }
            Some(ReceivedFrame::GoAway { .. }) | Some(ReceivedFrame::PushPromise { .. }) | None => {
                Ok(None)
            }
        }
    }

    /// Build a WebRequest from accumulated stream data.
    fn build_request(
        &mut self,
        stream_id: u32,
    ) -> Result<Option<(u32, WebRequest)>, H2Error> {
        let headers = self
            .stream_headers
            .remove(&stream_id)
            .ok_or_else(|| H2Error::protocol("no headers for completed stream"))?;
        let body = self.stream_bodies.remove(&stream_id).unwrap_or_default();

        let request = convert_h2_headers_to_web(&headers, &body, self.peer_addr)?;
        Ok(Some((stream_id, request)))
    }

    /// Send a response on a stream.
    ///
    /// Converts the web response to H2 headers + body and queues them
    /// on the connection. The caller must drain `connection.pending_ops()`
    /// and encode frames via the codec.
    pub fn send_response(
        &mut self,
        stream_id: u32,
        response: WebResponse,
    ) -> Result<(), H2Error> {
        let (headers, body) = convert_web_to_h2(response);

        let end_stream = body.is_empty();
        self.connection
            .send_headers(stream_id, headers, end_stream)?;

        if !body.is_empty() {
            let as_body = asupersync::bytes::Bytes::from(body.to_vec());
            self.connection.send_data(stream_id, as_body, true)?;
        }

        Ok(())
    }

    /// Initiate graceful shutdown.
    pub fn shutdown(&mut self) {
        self.connection
            .goaway(ErrorCode::NoError, asupersync::bytes::Bytes::new());
    }

    /// Queue the initial SETTINGS frame for the connection handshake.
    pub fn queue_initial_settings(&mut self) {
        self.connection.queue_initial_settings();
    }
}

// ── ALPN Constants ─────────────────────────────────────────────────────────

/// ALPN protocol identifier for HTTP/2 over TLS.
pub const ALPN_H2: &[u8] = b"h2";

/// ALPN protocol identifier for HTTP/2 cleartext (h2c, prior knowledge).
pub const ALPN_H2C: &[u8] = b"h2c";

/// HTTP/1.1 connection upgrade token for h2c.
pub const H2C_UPGRADE_TOKEN: &str = "h2c";

// ── Tests ──────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::response::StatusCode;

    // ── H2Config tests ─────────────────────────────────────────────────

    #[test]
    fn h2_config_defaults() {
        let config = H2Config::default();
        assert_eq!(config.max_concurrent_streams, 256);
        assert_eq!(config.initial_window_size, 65535);
        assert_eq!(config.max_frame_size, 16384);
        assert_eq!(config.header_table_size, 4096);
        assert_eq!(config.max_header_list_size, 65536);
        assert!(!config.enable_push);
        assert_eq!(config.continuation_timeout_ms, 5000);
    }

    #[test]
    fn h2_config_builder() {
        let config = H2Config::default()
            .max_concurrent_streams(128)
            .initial_window_size(1 << 20)
            .max_frame_size(32768)
            .header_table_size(8192)
            .max_header_list_size(131072)
            .enable_server_push(true)
            .continuation_timeout_ms(10000);

        assert_eq!(config.max_concurrent_streams, 128);
        assert_eq!(config.initial_window_size, 1 << 20);
        assert_eq!(config.max_frame_size, 32768);
        assert_eq!(config.header_table_size, 8192);
        assert_eq!(config.max_header_list_size, 131072);
        assert!(config.enable_push);
        assert_eq!(config.continuation_timeout_ms, 10000);
    }

    #[test]
    fn h2_config_max_frame_size_clamping() {
        // Below minimum
        let config = H2Config::default().max_frame_size(1000);
        assert_eq!(config.max_frame_size, 16384);

        // Above maximum
        let config = H2Config::default().max_frame_size(u32::MAX);
        assert_eq!(config.max_frame_size, 16_777_215);

        // Valid value passes through
        let config = H2Config::default().max_frame_size(32768);
        assert_eq!(config.max_frame_size, 32768);
    }

    #[test]
    fn h2_config_to_settings() {
        let config = H2Config::default()
            .max_concurrent_streams(100)
            .initial_window_size(131072)
            .enable_server_push(true);

        let settings = config.to_h2_settings();
        assert_eq!(settings.max_concurrent_streams, 100);
        assert_eq!(settings.initial_window_size, 131072);
        assert!(settings.enable_push);
        assert_eq!(settings.header_table_size, 4096);
        assert_eq!(settings.max_frame_size, 16384);
    }

    #[test]
    fn h2_config_builds_server_connection() {
        let config = H2Config::default().max_concurrent_streams(64);
        let conn = config.build_server_connection();

        assert!(!conn.is_client());
        assert_eq!(conn.state(), ConnectionState::Handshaking);
        assert_eq!(conn.local_settings().max_concurrent_streams, 64);
    }

    #[test]
    fn h2_config_builds_frame_codec() {
        let config = H2Config::default().max_frame_size(32768);
        let _codec = config.build_frame_codec();
        // FrameCodec doesn't expose max_frame_size publicly, but it was set
        // (verified by not panicking and being constructed)
    }

    // ── Header bridging tests ──────────────────────────────────────────

    #[test]
    fn convert_h2_headers_basic_get() {
        let headers = vec![
            Header {
                name: ":method".to_string(),
                value: "GET".to_string(),
            },
            Header {
                name: ":path".to_string(),
                value: "/users".to_string(),
            },
            Header {
                name: ":scheme".to_string(),
                value: "https".to_string(),
            },
            Header {
                name: ":authority".to_string(),
                value: "example.com".to_string(),
            },
            Header {
                name: "accept".to_string(),
                value: "application/json".to_string(),
            },
        ];

        let req = convert_h2_headers_to_web(&headers, b"", None).unwrap();
        assert_eq!(req.method, "GET");
        assert_eq!(req.path, "/users");
        assert!(req.query.is_none());
        assert_eq!(req.headers.get("accept").unwrap(), "application/json");
        assert_eq!(req.headers.get("host").unwrap(), "example.com");
        assert!(req.body.is_empty());
    }

    #[test]
    fn convert_h2_headers_with_query() {
        let headers = vec![
            Header {
                name: ":method".to_string(),
                value: "GET".to_string(),
            },
            Header {
                name: ":path".to_string(),
                value: "/search?q=rust&page=2".to_string(),
            },
            Header {
                name: ":scheme".to_string(),
                value: "https".to_string(),
            },
        ];

        let req = convert_h2_headers_to_web(&headers, b"", None).unwrap();
        assert_eq!(req.path, "/search");
        assert_eq!(req.query.as_deref(), Some("q=rust&page=2"));
    }

    #[test]
    fn convert_h2_headers_post_with_body() {
        let headers = vec![
            Header {
                name: ":method".to_string(),
                value: "POST".to_string(),
            },
            Header {
                name: ":path".to_string(),
                value: "/api/items".to_string(),
            },
            Header {
                name: ":scheme".to_string(),
                value: "https".to_string(),
            },
            Header {
                name: "content-type".to_string(),
                value: "application/json".to_string(),
            },
        ];

        let body = b"{\"name\":\"test\"}";
        let req = convert_h2_headers_to_web(&headers, body, None).unwrap();
        assert_eq!(req.method, "POST");
        assert_eq!(req.path, "/api/items");
        assert_eq!(req.headers.get("content-type").unwrap(), "application/json");
        assert_eq!(req.body.as_ref(), body);
    }

    #[test]
    fn convert_h2_headers_with_peer_addr() {
        let headers = vec![
            Header {
                name: ":method".to_string(),
                value: "GET".to_string(),
            },
            Header {
                name: ":path".to_string(),
                value: "/".to_string(),
            },
            Header {
                name: ":scheme".to_string(),
                value: "https".to_string(),
            },
        ];

        let addr: SocketAddr = "192.168.1.1:12345".parse().unwrap();
        let req = convert_h2_headers_to_web(&headers, b"", Some(addr)).unwrap();

        let info = req.extensions.get::<ConnectInfo>().unwrap();
        assert_eq!(info.0, addr);
    }

    #[test]
    fn convert_h2_headers_missing_method_errors() {
        let headers = vec![Header {
            name: ":path".to_string(),
            value: "/".to_string(),
        }];

        let result = convert_h2_headers_to_web(&headers, b"", None);
        assert!(result.is_err());
    }

    #[test]
    fn convert_h2_headers_missing_path_errors() {
        let headers = vec![Header {
            name: ":method".to_string(),
            value: "GET".to_string(),
        }];

        let result = convert_h2_headers_to_web(&headers, b"", None);
        assert!(result.is_err());
    }

    #[test]
    fn convert_h2_headers_unknown_pseudo_header_errors() {
        let headers = vec![
            Header {
                name: ":method".to_string(),
                value: "GET".to_string(),
            },
            Header {
                name: ":path".to_string(),
                value: "/".to_string(),
            },
            Header {
                name: ":bogus".to_string(),
                value: "wat".to_string(),
            },
        ];

        let result = convert_h2_headers_to_web(&headers, b"", None);
        assert!(result.is_err());
    }

    #[test]
    fn convert_h2_headers_authority_as_host_fallback() {
        let headers = vec![
            Header {
                name: ":method".to_string(),
                value: "GET".to_string(),
            },
            Header {
                name: ":path".to_string(),
                value: "/".to_string(),
            },
            Header {
                name: ":authority".to_string(),
                value: "api.example.com".to_string(),
            },
            // No explicit Host header — :authority should fill it
        ];

        let req = convert_h2_headers_to_web(&headers, b"", None).unwrap();
        assert_eq!(req.headers.get("host").unwrap(), "api.example.com");
    }

    #[test]
    fn convert_h2_headers_explicit_host_not_overwritten() {
        let headers = vec![
            Header {
                name: ":method".to_string(),
                value: "GET".to_string(),
            },
            Header {
                name: ":path".to_string(),
                value: "/".to_string(),
            },
            Header {
                name: ":authority".to_string(),
                value: "authority.example.com".to_string(),
            },
            Header {
                name: "host".to_string(),
                value: "explicit.example.com".to_string(),
            },
        ];

        let req = convert_h2_headers_to_web(&headers, b"", None).unwrap();
        // Explicit Host should be preserved, not overwritten by :authority
        assert_eq!(req.headers.get("host").unwrap(), "explicit.example.com");
    }

    // ── Response bridging tests ────────────────────────────────────────

    #[test]
    fn convert_web_to_h2_basic() {
        let resp = WebResponse::new(StatusCode::OK, Bytes::from_static(b"hello"))
            .header("content-type", "text/plain");

        let (headers, body) = convert_web_to_h2(resp);

        // First header must be :status
        assert!(matches!(&headers[0], Header { name, value }
            if name == ":status" && value == "200"));

        // Content-type should be present
        assert!(headers.iter().any(|h| matches!(h,
            Header { name, value }
            if name == "content-type" && value == "text/plain"
        )));

        assert_eq!(body.as_ref(), b"hello");
    }

    #[test]
    fn convert_web_to_h2_empty_body() {
        let resp = WebResponse::empty(StatusCode::NO_CONTENT);
        let (headers, body) = convert_web_to_h2(resp);

        assert!(matches!(&headers[0], Header { name, value }
            if name == ":status" && value == "204"));
        assert!(body.is_empty());
    }

    #[test]
    fn convert_web_to_h2_multiple_headers() {
        let resp = WebResponse::new(StatusCode::OK, Bytes::from_static(b"{}"))
            .header("content-type", "application/json")
            .header("x-request-id", "abc-123")
            .header("cache-control", "no-cache");

        let (headers, _body) = convert_web_to_h2(resp);

        // :status + 3 regular headers = 4 total
        assert_eq!(headers.len(), 4);
    }

    // ── H2Connection tests ─────────────────────────────────────────────

    #[test]
    fn h2_connection_creation() {
        let config = H2Config::default().max_concurrent_streams(64);
        let h2 = H2Connection::new(config);

        assert_eq!(h2.state(), ConnectionState::Handshaking);
        assert!(!h2.connection().is_client());
        assert_eq!(h2.config().max_concurrent_streams, 64);
    }

    #[test]
    fn h2_connection_with_peer_addr() {
        let addr: SocketAddr = "10.0.0.1:8080".parse().unwrap();
        let h2 = H2Connection::new(H2Config::default()).with_peer_addr(addr);

        assert_eq!(h2.peer_addr, Some(addr));
    }

    #[test]
    fn h2_connection_queue_initial_settings() {
        let mut h2 = H2Connection::new(H2Config::default());
        h2.queue_initial_settings();
        // Settings frame is queued — connection should have pending ops
        // (we can't inspect pending_ops directly, but this exercises the path)
    }

    #[test]
    fn h2_connection_shutdown() {
        let mut h2 = H2Connection::new(H2Config::default());
        // Move connection to Open state first
        // Shutdown queues GOAWAY
        h2.shutdown();
        assert_eq!(h2.state(), ConnectionState::Closing);
    }

    // ── ALPN constants tests ───────────────────────────────────────────

    #[test]
    fn alpn_constants() {
        assert_eq!(ALPN_H2, b"h2");
        assert_eq!(ALPN_H2C, b"h2c");
        assert_eq!(H2C_UPGRADE_TOKEN, "h2c");
    }
}
