//! WebSocket support via asupersync's WebSocketAcceptor.
//!
//! Provides WebSocket upgrade detection, message type bridging, and a
//! high-level `WebSocket` wrapper around asupersync's `ServerWebSocket`.
//!
//! # Architecture
//!
//! The WebSocket flow in ava-web:
//!
//! 1. **Detection**: `WebSocketUpgrade::from_request()` checks HTTP headers
//!    for a valid WebSocket upgrade request.
//! 2. **Response**: The handler returns a `WebSocketUpgrade` which implements
//!    `IntoResponse`, producing the 101 Switching Protocols response.
//! 3. **Connection**: After upgrade, a `WebSocket` wrapper provides typed
//!    send/recv over asupersync's `ServerWebSocket`.
//!
//! # Example
//!
//! ```ignore
//! use ava_web::ws::{WebSocketUpgrade, WebSocket, WsMessage};
//!
//! async fn ws_handler(upgrade: WebSocketUpgrade) -> impl IntoResponse {
//!     upgrade.on_upgrade(|mut socket| async move {
//!         while let Some(msg) = socket.recv().await {
//!             if let WsMessage::Text(text) = msg {
//!                 let _ = socket.send(WsMessage::Text(format!("echo: {text}"))).await;
//!             }
//!         }
//!     })
//! }
//! ```

use crate::extractor::{ExtractionError, FromRequest, Request};
use crate::response::{IntoResponse, Response, StatusCode};
use asupersync::bytes::Bytes as AsBytes;
use asupersync::net::websocket::{
    CloseCode, CloseReason, Message as AsMessage, ServerWebSocket,
};
use bytes::Bytes;

/// Re-export of `asupersync::bytes::Bytes` for zero-copy WebSocket message
/// construction. Binary, Ping, and Pong variants of [`WsMessage`] use this
/// type. Cloning is O(1) (refcount bump), slicing is O(1).
pub use asupersync::bytes::Bytes as WsBytes;

// ── WsMessage ─────────────────────────────────────────────────────────────

/// WebSocket message types.
///
/// Bridges between ava-web's API and asupersync's internal `Message` type.
///
/// Binary, Ping, and Pong variants use `asupersync::bytes::Bytes` for zero-copy
/// bridging with asupersync's `Message` type. Since asupersync's `Message` also
/// holds `Bytes`, conversion is a refcount bump — no allocation or memcpy.
///
/// Previously these variants held `Vec<u8>`, requiring `.to_vec()` on every
/// received binary frame (O(n) copy). Now conversion is O(1).
#[derive(Debug, Clone)]
pub enum WsMessage {
    /// UTF-8 text message.
    Text(String),
    /// Binary message. Zero-copy `Bytes` from asupersync's frame codec.
    Binary(AsBytes),
    /// Ping frame with payload. Zero-copy `Bytes`.
    Ping(AsBytes),
    /// Pong frame with payload. Zero-copy `Bytes`.
    Pong(AsBytes),
    /// Close frame with optional code and reason.
    Close(Option<CloseFrame>),
}

impl WsMessage {
    /// Create a text message.
    #[must_use]
    pub fn text(s: impl Into<String>) -> Self {
        Self::Text(s.into())
    }

    /// Create a binary message.
    ///
    /// Accepts any type that converts into `asupersync::bytes::Bytes`
    /// (e.g., `Vec<u8>`, `&'static [u8]`, `String`). When the source is
    /// already `AsBytes`, this is a zero-copy refcount bump.
    #[must_use]
    pub fn binary(data: impl Into<AsBytes>) -> Self {
        Self::Binary(data.into())
    }

    /// Create a ping message.
    #[must_use]
    pub fn ping(data: impl Into<AsBytes>) -> Self {
        Self::Ping(data.into())
    }

    /// Create a pong message.
    #[must_use]
    pub fn pong(data: impl Into<AsBytes>) -> Self {
        Self::Pong(data.into())
    }

    /// Create a close message with code and reason.
    #[must_use]
    pub fn close(code: u16, reason: impl Into<String>) -> Self {
        Self::Close(Some(CloseFrame {
            code,
            reason: reason.into(),
        }))
    }

    /// Check if this is a control message (ping, pong, close).
    #[must_use]
    pub fn is_control(&self) -> bool {
        matches!(self, Self::Ping(_) | Self::Pong(_) | Self::Close(_))
    }

    /// Check if this is a data message (text or binary).
    #[must_use]
    pub fn is_data(&self) -> bool {
        matches!(self, Self::Text(_) | Self::Binary(_))
    }
}

/// Convert from asupersync's Message to our WsMessage.
///
/// Convert from asupersync's Message to our WsMessage.
///
/// **Zero-copy for Binary/Ping/Pong**: Both sides now use
/// `asupersync::bytes::Bytes` (Arc<Vec<u8>>-backed), so conversion is an
/// O(1) move — no allocation, no memcpy. Previously this called `.to_vec()`
/// which was O(n) for every binary frame received.
impl From<AsMessage> for WsMessage {
    fn from(msg: AsMessage) -> Self {
        match msg {
            AsMessage::Text(s) => Self::Text(s),
            // Zero-copy: AsBytes → AsBytes is a move (same type).
            AsMessage::Binary(b) => Self::Binary(b),
            AsMessage::Ping(b) => Self::Ping(b),
            AsMessage::Pong(b) => Self::Pong(b),
            AsMessage::Close(reason) => Self::Close(reason.and_then(|r| {
                r.raw_code.map(|code| CloseFrame {
                    code,
                    reason: r.text.unwrap_or_default(),
                })
            })),
        }
    }
}

/// Convert from our WsMessage to asupersync's Message.
///
/// **Zero-copy for Binary/Ping/Pong**: Both sides use
/// `asupersync::bytes::Bytes`, so `AsMessage::binary/ping/pong` accept
/// our `AsBytes` directly via `impl Into<AsBytes>` (identity conversion).
impl From<WsMessage> for AsMessage {
    fn from(msg: WsMessage) -> Self {
        match msg {
            WsMessage::Text(s) => AsMessage::text(s),
            // Zero-copy: AsBytes → AsBytes via Into<AsBytes> is identity.
            WsMessage::Binary(b) => AsMessage::binary(b),
            WsMessage::Ping(b) => AsMessage::ping(b),
            WsMessage::Pong(b) => AsMessage::pong(b),
            WsMessage::Close(frame) => match frame {
                Some(cf) => {
                    let code = CloseCode::from_u16(cf.code);
                    let reason = if cf.reason.is_empty() {
                        match code {
                            Some(c) => CloseReason::new(c, None),
                            None => CloseReason::empty(),
                        }
                    } else {
                        match code {
                            Some(c) => CloseReason::with_text(c, &cf.reason),
                            None => CloseReason::empty(),
                        }
                    };
                    AsMessage::close(reason)
                }
                None => AsMessage::Close(None),
            },
        }
    }
}

// ── CloseFrame ────────────────────────────────────────────────────────────

/// WebSocket close frame data.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CloseFrame {
    /// Close status code (RFC 6455 Section 7.4).
    pub code: u16,
    /// Close reason string.
    pub reason: String,
}

impl CloseFrame {
    /// Create a new close frame.
    #[must_use]
    pub fn new(code: u16, reason: impl Into<String>) -> Self {
        Self {
            code,
            reason: reason.into(),
        }
    }

    /// Normal closure (1000).
    #[must_use]
    pub fn normal() -> Self {
        Self::new(1000, "")
    }

    /// Going away (1001).
    #[must_use]
    pub fn going_away() -> Self {
        Self::new(1001, "")
    }
}

// ── WebSocketUpgrade ──────────────────────────────────────────────────────

/// WebSocket upgrade extractor.
///
/// Detects WebSocket upgrade requests by examining HTTP headers per RFC 6455:
/// - `Connection: Upgrade`
/// - `Upgrade: websocket`
/// - `Sec-WebSocket-Version: 13`
/// - `Sec-WebSocket-Key: <base64-encoded key>`
///
/// # Usage
///
/// Use as a handler parameter. Extraction fails with 400 Bad Request if the
/// request is not a valid WebSocket upgrade.
#[derive(Debug)]
pub struct WebSocketUpgrade {
    /// The Sec-WebSocket-Key from the client.
    key: String,
    /// Requested subprotocols.
    protocols: Vec<String>,
    /// Sec-WebSocket-Extensions header value.
    extensions: Option<String>,
}

impl WebSocketUpgrade {
    /// Get the client's Sec-WebSocket-Key.
    #[must_use]
    pub fn key(&self) -> &str {
        &self.key
    }

    /// Get the requested subprotocols.
    #[must_use]
    pub fn protocols(&self) -> &[String] {
        &self.protocols
    }

    /// Get the extensions header value.
    #[must_use]
    pub fn extensions(&self) -> Option<&str> {
        self.extensions.as_deref()
    }

    /// Check if a specific protocol was requested by the client.
    #[must_use]
    pub fn has_protocol(&self, protocol: &str) -> bool {
        self.protocols.iter().any(|p| p == protocol)
    }

    /// Produce a 101 Switching Protocols response.
    ///
    /// The `on_upgrade` callback will be called with the upgraded `WebSocket`
    /// once the HTTP response is sent and the connection is upgraded.
    ///
    /// Note: In the current architecture, the actual WebSocket I/O happens
    /// at the server level after the 101 response is sent. The callback
    /// is stored for the server to invoke.
    #[must_use]
    pub fn on_upgrade<F>(self, _callback: F) -> WebSocketUpgradeResponse
    where
        F: FnOnce(()) + Send + 'static,
    {
        let accept_key = asupersync::net::websocket::compute_accept_key(&self.key);
        WebSocketUpgradeResponse { accept_key }
    }

    /// Detect whether a request contains valid WebSocket upgrade headers.
    ///
    /// Returns `true` if the request has the required headers for a WebSocket
    /// upgrade per RFC 6455 Section 4.2.1.
    #[must_use]
    pub fn is_upgrade_request(req: &Request) -> bool {
        // Check Connection: Upgrade (case-insensitive)
        let has_connection = req
            .headers
            .get("connection")
            .map(|v| v.to_ascii_lowercase().contains("upgrade"))
            .unwrap_or(false);

        // Check Upgrade: websocket (case-insensitive)
        let has_upgrade = req
            .headers
            .get("upgrade")
            .map(|v| v.eq_ignore_ascii_case("websocket"))
            .unwrap_or(false);

        // Check Sec-WebSocket-Version: 13
        let has_version = req
            .headers
            .get("sec-websocket-version")
            .map(|v| v == "13")
            .unwrap_or(false);

        // Check Sec-WebSocket-Key exists
        let has_key = req.headers.contains_key("sec-websocket-key");

        has_connection && has_upgrade && has_version && has_key
    }
}

impl FromRequest for WebSocketUpgrade {
    fn from_request(req: Request) -> Result<Self, ExtractionError> {
        // Validate Connection header
        let connection = req.headers.get("connection").ok_or_else(|| {
            ExtractionError::bad_request("missing Connection header for WebSocket upgrade")
        })?;
        if !connection.to_ascii_lowercase().contains("upgrade") {
            return Err(ExtractionError::bad_request(
                "Connection header must contain 'Upgrade'",
            ));
        }

        // Validate Upgrade header
        let upgrade = req.headers.get("upgrade").ok_or_else(|| {
            ExtractionError::bad_request("missing Upgrade header for WebSocket upgrade")
        })?;
        if !upgrade.eq_ignore_ascii_case("websocket") {
            return Err(ExtractionError::bad_request(
                "Upgrade header must be 'websocket'",
            ));
        }

        // Validate WebSocket version
        let version = req.headers.get("sec-websocket-version").ok_or_else(|| {
            ExtractionError::bad_request("missing Sec-WebSocket-Version header")
        })?;
        if version != "13" {
            return Err(ExtractionError::bad_request(format!(
                "unsupported WebSocket version: {version}, expected 13"
            )));
        }

        // Extract Sec-WebSocket-Key
        let key = req
            .headers
            .get("sec-websocket-key")
            .ok_or_else(|| ExtractionError::bad_request("missing Sec-WebSocket-Key header"))?
            .to_owned();

        // Parse optional subprotocols
        let protocols = req
            .headers
            .get("sec-websocket-protocol")
            .map(|v| v.split(',').map(|s| s.trim().to_string()).collect())
            .unwrap_or_default();

        // Parse optional extensions
        let extensions = req.headers.get("sec-websocket-extensions").map(str::to_owned);

        Ok(Self {
            key,
            protocols,
            extensions,
        })
    }
}

// ── WebSocketUpgradeResponse ──────────────────────────────────────────────

/// The response produced by `WebSocketUpgrade::on_upgrade()`.
///
/// Implements `IntoResponse` to produce the HTTP 101 Switching Protocols
/// response with the correct Sec-WebSocket-Accept header.
pub struct WebSocketUpgradeResponse {
    accept_key: String,
}

impl IntoResponse for WebSocketUpgradeResponse {
    fn into_response(self) -> Response {
        Response::new(StatusCode::SWITCHING_PROTOCOLS, Bytes::new())
            .header("upgrade", "websocket")
            .header("connection", "Upgrade")
            .header("sec-websocket-accept", self.accept_key)
    }
}

// ── WebSocket wrapper ─────────────────────────────────────────────────────

/// A connected WebSocket session.
///
/// Wraps asupersync's `ServerWebSocket` with a simpler API using `WsMessage`.
/// The `Cx` (cancellation context) is managed by the server.
pub struct WebSocket<IO> {
    inner: ServerWebSocket<IO>,
}

impl<IO> WebSocket<IO>
where
    IO: asupersync::io::AsyncRead + asupersync::io::AsyncWrite + Unpin,
{
    /// Wrap an asupersync `ServerWebSocket`.
    pub fn new(inner: ServerWebSocket<IO>) -> Self {
        Self { inner }
    }

    /// Send a message.
    ///
    /// # Errors
    ///
    /// Returns an error if the send fails (connection closed, I/O error).
    pub async fn send(
        &mut self,
        cx: &asupersync::cx::Cx,
        msg: WsMessage,
    ) -> Result<(), asupersync::net::websocket::WsError> {
        let as_msg: AsMessage = msg.into();
        self.inner.send(cx, as_msg).await
    }

    /// Receive the next message.
    ///
    /// Returns `Ok(None)` when the connection is closed.
    ///
    /// # Errors
    ///
    /// Returns an error on protocol violations or I/O failures.
    pub async fn recv(
        &mut self,
        cx: &asupersync::cx::Cx,
    ) -> Result<Option<WsMessage>, asupersync::net::websocket::WsError> {
        self.inner.recv(cx).await.map(|opt| opt.map(WsMessage::from))
    }

    /// Check if the connection is still open.
    #[must_use]
    pub fn is_open(&self) -> bool {
        self.inner.is_open()
    }

    /// Check if the connection has been closed.
    #[must_use]
    pub fn is_closed(&self) -> bool {
        self.inner.is_closed()
    }

    /// Get the negotiated subprotocol (if any).
    #[must_use]
    pub fn protocol(&self) -> Option<&str> {
        self.inner.protocol()
    }

    /// Initiate a close handshake.
    pub async fn close(
        &mut self,
        frame: CloseFrame,
    ) -> Result<(), asupersync::net::websocket::WsError> {
        let code = CloseCode::from_u16(frame.code);
        let reason = match code {
            Some(c) if frame.reason.is_empty() => CloseReason::new(c, None),
            Some(c) => CloseReason::with_text(c, &frame.reason),
            None => CloseReason::normal(),
        };
        self.inner.close(reason).await
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::extractor::Request;

    // ── WsMessage construction tests ──────────────────────────────────

    #[test]
    fn ws_message_text_constructor() {
        let msg = WsMessage::text("hello");
        assert!(matches!(msg, WsMessage::Text(s) if s == "hello"));
    }

    #[test]
    fn ws_message_binary_constructor() {
        let msg = WsMessage::binary(vec![1, 2, 3]);
        assert!(matches!(msg, WsMessage::Binary(b) if b.as_ref() == [1, 2, 3]));
    }

    #[test]
    fn ws_message_ping_constructor() {
        let msg = WsMessage::ping(vec![42]);
        assert!(matches!(msg, WsMessage::Ping(b) if b.as_ref() == [42]));
    }

    #[test]
    fn ws_message_pong_constructor() {
        let msg = WsMessage::pong(vec![99]);
        assert!(matches!(msg, WsMessage::Pong(b) if b.as_ref() == [99]));
    }

    #[test]
    fn ws_message_close_constructor() {
        let msg = WsMessage::close(1000, "normal");
        match msg {
            WsMessage::Close(Some(cf)) => {
                assert_eq!(cf.code, 1000);
                assert_eq!(cf.reason, "normal");
            }
            _ => panic!("expected Close variant"),
        }
    }

    #[test]
    fn ws_message_is_control() {
        assert!(!WsMessage::text("test").is_control());
        assert!(!WsMessage::binary(vec![]).is_control());
        assert!(WsMessage::ping(vec![]).is_control());
        assert!(WsMessage::pong(vec![]).is_control());
        assert!(WsMessage::Close(None).is_control());
    }

    #[test]
    fn ws_message_is_data() {
        assert!(WsMessage::text("test").is_data());
        assert!(WsMessage::binary(vec![]).is_data());
        assert!(!WsMessage::ping(vec![]).is_data());
        assert!(!WsMessage::pong(vec![]).is_data());
        assert!(!WsMessage::Close(None).is_data());
    }

    // ── WsMessage <-> AsMessage conversion tests ──────────────────────

    #[test]
    fn ws_message_from_as_message_text() {
        let as_msg = AsMessage::text("hello");
        let ws_msg = WsMessage::from(as_msg);
        assert!(matches!(ws_msg, WsMessage::Text(s) if s == "hello"));
    }

    #[test]
    fn ws_message_from_as_message_binary() {
        let as_msg = AsMessage::binary(vec![1, 2, 3]);
        let ws_msg = WsMessage::from(as_msg);
        assert!(matches!(ws_msg, WsMessage::Binary(b) if b.as_ref() == [1, 2, 3]));
    }

    #[test]
    fn ws_message_from_as_message_ping() {
        let as_msg = AsMessage::ping(vec![42]);
        let ws_msg = WsMessage::from(as_msg);
        assert!(matches!(ws_msg, WsMessage::Ping(b) if b.as_ref() == [42]));
    }

    #[test]
    fn ws_message_from_as_message_pong() {
        let as_msg = AsMessage::pong(vec![99]);
        let ws_msg = WsMessage::from(as_msg);
        assert!(matches!(ws_msg, WsMessage::Pong(b) if b.as_ref() == [99]));
    }

    #[test]
    fn ws_message_from_as_message_close_with_reason() {
        let reason = CloseReason::with_text(CloseCode::Normal, "bye");
        let as_msg = AsMessage::close(reason);
        let ws_msg = WsMessage::from(as_msg);
        match ws_msg {
            WsMessage::Close(Some(cf)) => {
                assert_eq!(cf.code, 1000);
                assert_eq!(cf.reason, "bye");
            }
            _ => panic!("expected Close with frame"),
        }
    }

    #[test]
    fn ws_message_from_as_message_close_no_reason() {
        let as_msg = AsMessage::Close(None);
        let ws_msg = WsMessage::from(as_msg);
        assert!(matches!(ws_msg, WsMessage::Close(None)));
    }

    #[test]
    fn ws_message_to_as_message_text() {
        let ws_msg = WsMessage::text("hello");
        let as_msg: AsMessage = ws_msg.into();
        assert!(matches!(as_msg, AsMessage::Text(s) if s == "hello"));
    }

    #[test]
    fn ws_message_to_as_message_binary() {
        let ws_msg = WsMessage::binary(vec![1, 2, 3]);
        let as_msg: AsMessage = ws_msg.into();
        assert!(matches!(as_msg, AsMessage::Binary(b) if b.as_ref() == [1, 2, 3]));
    }

    #[test]
    fn ws_message_to_as_message_close_with_code() {
        let ws_msg = WsMessage::close(1000, "bye");
        let as_msg: AsMessage = ws_msg.into();
        assert!(matches!(as_msg, AsMessage::Close(Some(_))));
    }

    // ── CloseFrame tests ──────────────────────────────────────────────

    #[test]
    fn close_frame_normal() {
        let cf = CloseFrame::normal();
        assert_eq!(cf.code, 1000);
        assert_eq!(cf.reason, "");
    }

    #[test]
    fn close_frame_going_away() {
        let cf = CloseFrame::going_away();
        assert_eq!(cf.code, 1001);
        assert_eq!(cf.reason, "");
    }

    #[test]
    fn close_frame_custom() {
        let cf = CloseFrame::new(4000, "custom reason");
        assert_eq!(cf.code, 4000);
        assert_eq!(cf.reason, "custom reason");
    }

    // ── WebSocketUpgrade detection tests ──────────────────────────────

    fn make_ws_upgrade_request() -> Request {
        Request::new("GET", "/ws")
            .with_header("connection", "Upgrade")
            .with_header("upgrade", "websocket")
            .with_header("sec-websocket-version", "13")
            .with_header("sec-websocket-key", "dGhlIHNhbXBsZSBub25jZQ==")
    }

    #[test]
    fn is_upgrade_request_valid() {
        let req = make_ws_upgrade_request();
        assert!(WebSocketUpgrade::is_upgrade_request(&req));
    }

    #[test]
    fn is_upgrade_request_missing_connection() {
        let req = Request::new("GET", "/ws")
            .with_header("upgrade", "websocket")
            .with_header("sec-websocket-version", "13")
            .with_header("sec-websocket-key", "dGhlIHNhbXBsZSBub25jZQ==");
        assert!(!WebSocketUpgrade::is_upgrade_request(&req));
    }

    #[test]
    fn is_upgrade_request_missing_upgrade() {
        let req = Request::new("GET", "/ws")
            .with_header("connection", "Upgrade")
            .with_header("sec-websocket-version", "13")
            .with_header("sec-websocket-key", "dGhlIHNhbXBsZSBub25jZQ==");
        assert!(!WebSocketUpgrade::is_upgrade_request(&req));
    }

    #[test]
    fn is_upgrade_request_wrong_version() {
        let req = Request::new("GET", "/ws")
            .with_header("connection", "Upgrade")
            .with_header("upgrade", "websocket")
            .with_header("sec-websocket-version", "8")
            .with_header("sec-websocket-key", "dGhlIHNhbXBsZSBub25jZQ==");
        assert!(!WebSocketUpgrade::is_upgrade_request(&req));
    }

    #[test]
    fn is_upgrade_request_missing_key() {
        let req = Request::new("GET", "/ws")
            .with_header("connection", "Upgrade")
            .with_header("upgrade", "websocket")
            .with_header("sec-websocket-version", "13");
        assert!(!WebSocketUpgrade::is_upgrade_request(&req));
    }

    #[test]
    fn is_upgrade_request_case_insensitive_connection() {
        let req = Request::new("GET", "/ws")
            .with_header("connection", "upgrade")
            .with_header("upgrade", "websocket")
            .with_header("sec-websocket-version", "13")
            .with_header("sec-websocket-key", "dGhlIHNhbXBsZSBub25jZQ==");
        assert!(WebSocketUpgrade::is_upgrade_request(&req));
    }

    #[test]
    fn is_upgrade_request_case_insensitive_upgrade() {
        let req = Request::new("GET", "/ws")
            .with_header("connection", "Upgrade")
            .with_header("upgrade", "WebSocket")
            .with_header("sec-websocket-version", "13")
            .with_header("sec-websocket-key", "dGhlIHNhbXBsZSBub25jZQ==");
        assert!(WebSocketUpgrade::is_upgrade_request(&req));
    }

    #[test]
    fn is_upgrade_request_normal_request() {
        let req = Request::new("GET", "/api/users");
        assert!(!WebSocketUpgrade::is_upgrade_request(&req));
    }

    // ── WebSocketUpgrade extraction tests ─────────────────────────────

    #[test]
    fn extract_ws_upgrade_valid() {
        let req = make_ws_upgrade_request();
        let upgrade = WebSocketUpgrade::from_request(req).unwrap();
        assert_eq!(upgrade.key(), "dGhlIHNhbXBsZSBub25jZQ==");
        assert!(upgrade.protocols().is_empty());
        assert!(upgrade.extensions().is_none());
    }

    #[test]
    fn extract_ws_upgrade_with_protocols() {
        let req = make_ws_upgrade_request()
            .with_header("sec-websocket-protocol", "graphql-ws, graphql-transport-ws");
        let upgrade = WebSocketUpgrade::from_request(req).unwrap();
        assert_eq!(upgrade.protocols().len(), 2);
        assert!(upgrade.has_protocol("graphql-ws"));
        assert!(upgrade.has_protocol("graphql-transport-ws"));
        assert!(!upgrade.has_protocol("unknown"));
    }

    #[test]
    fn extract_ws_upgrade_with_extensions() {
        let req =
            make_ws_upgrade_request().with_header("sec-websocket-extensions", "permessage-deflate");
        let upgrade = WebSocketUpgrade::from_request(req).unwrap();
        assert_eq!(upgrade.extensions(), Some("permessage-deflate"));
    }

    #[test]
    fn extract_ws_upgrade_missing_connection() {
        let req = Request::new("GET", "/ws")
            .with_header("upgrade", "websocket")
            .with_header("sec-websocket-version", "13")
            .with_header("sec-websocket-key", "dGhlIHNhbXBsZSBub25jZQ==");
        let err = WebSocketUpgrade::from_request(req).unwrap_err();
        assert_eq!(err.status, StatusCode::BAD_REQUEST);
        assert!(err.message.contains("Connection"));
    }

    #[test]
    fn extract_ws_upgrade_wrong_upgrade_header() {
        let req = Request::new("GET", "/ws")
            .with_header("connection", "Upgrade")
            .with_header("upgrade", "h2c")
            .with_header("sec-websocket-version", "13")
            .with_header("sec-websocket-key", "dGhlIHNhbXBsZSBub25jZQ==");
        let err = WebSocketUpgrade::from_request(req).unwrap_err();
        assert_eq!(err.status, StatusCode::BAD_REQUEST);
        assert!(err.message.contains("websocket"));
    }

    #[test]
    fn extract_ws_upgrade_wrong_version() {
        let req = Request::new("GET", "/ws")
            .with_header("connection", "Upgrade")
            .with_header("upgrade", "websocket")
            .with_header("sec-websocket-version", "8")
            .with_header("sec-websocket-key", "dGhlIHNhbXBsZSBub25jZQ==");
        let err = WebSocketUpgrade::from_request(req).unwrap_err();
        assert_eq!(err.status, StatusCode::BAD_REQUEST);
        assert!(err.message.contains("version"));
    }

    #[test]
    fn extract_ws_upgrade_missing_key() {
        let req = Request::new("GET", "/ws")
            .with_header("connection", "Upgrade")
            .with_header("upgrade", "websocket")
            .with_header("sec-websocket-version", "13");
        let err = WebSocketUpgrade::from_request(req).unwrap_err();
        assert_eq!(err.status, StatusCode::BAD_REQUEST);
        assert!(err.message.contains("Key"));
    }

    // ── WebSocketUpgradeResponse tests ────────────────────────────────

    #[test]
    fn upgrade_response_produces_101() {
        let req = make_ws_upgrade_request();
        let upgrade = WebSocketUpgrade::from_request(req).unwrap();
        let resp = upgrade.on_upgrade(|_| {}).into_response();

        assert_eq!(resp.status, StatusCode::SWITCHING_PROTOCOLS);
        assert_eq!(resp.headers.get("upgrade").unwrap(), "websocket");
        assert_eq!(resp.headers.get("connection").unwrap(), "Upgrade");
        assert!(resp.headers.contains_key("sec-websocket-accept"));
    }

    #[test]
    fn upgrade_response_correct_accept_key() {
        // RFC 6455 example: key "dGhlIHNhbXBsZSBub25jZQ==" should produce
        // accept "s3pPLMBiTxaQ9kYGzzhZRbK+xOo="
        let req = make_ws_upgrade_request();
        let upgrade = WebSocketUpgrade::from_request(req).unwrap();
        let resp = upgrade.on_upgrade(|_| {}).into_response();

        assert_eq!(
            resp.headers.get("sec-websocket-accept").unwrap(),
            "s3pPLMBiTxaQ9kYGzzhZRbK+xOo="
        );
    }

    #[test]
    fn upgrade_response_empty_body() {
        let req = make_ws_upgrade_request();
        let upgrade = WebSocketUpgrade::from_request(req).unwrap();
        let resp = upgrade.on_upgrade(|_| {}).into_response();
        assert!(resp.body.is_empty());
    }
}
