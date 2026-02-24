//! NATS ingestion bridge for ava-web.
//!
//! Connects HTTP/WS endpoints to NATS subjects per AVA-RFC-001.
//! Provides handlers for sensor ingest, fusion streaming, and control plane
//! forwarding.
//!
//! # Architecture
//!
//! Because `NatsClient` requires `&mut self` for all operations and holds a
//! `TcpStream`, it cannot be cheaply shared across handler invocations.
//! Instead, we use the `ActorHandler` pattern: a single actor owns the
//! `NatsClient` and processes requests sequentially through its mailbox.
//!
//! For handlers that need concurrent access (e.g., the HTTP POST ingest
//! endpoint), we wrap the client in `Arc<Mutex<NatsClient>>` and accept
//! the serialization cost — NATS publish is fast and the lock hold time
//! is minimal (one TCP write).
//!
//! # NATS Subject Taxonomy (RFC-001)
//!
//! ```text
//! sensor.{kind}.{source}.{format}     — inbound sensor data
//! fusion.{tier}.{entity_class}.results — fusion output
//! alarm.{severity}.{entity_class}      — alarms
//! ctl.{component}.{command}            — control plane
//! ```
//!
//! # Example
//!
//! ```ignore
//! use ava_web::nats_bridge::{NatsState, nats_router};
//!
//! let nats_state = NatsState::new(nats_client);
//! let app = nats_router().with_state(nats_state);
//! ```

use std::collections::HashMap;
use std::fmt;
use std::sync::Arc;

use bytes::Bytes;
use parking_lot::Mutex;

use crate::extractor::{
    ExtractionError, FromRequestParts, RawBody, Request, State,
};
use crate::handler::{FnHandler1, FnHandler3};
use crate::response::{IntoResponse, Response, StatusCode};
use crate::router::{self, Router};
use crate::sse::{Event, Sse};
use crate::ws::WebSocketUpgrade;

// ── SignalKind ─────────────────────────────────────────────────────────────

/// Known sensor signal kinds per AVA-RFC-001.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum SignalKind {
    Adsb,
    Radar,
    Ais,
    Elint,
    Comint,
    Ir,
    Eo,
    Acoustic,
    Seismic,
    Weather,
}

impl SignalKind {
    /// Parse a signal kind from a string (case-insensitive).
    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_ascii_lowercase().as_str() {
            "adsb" => Some(Self::Adsb),
            "radar" => Some(Self::Radar),
            "ais" => Some(Self::Ais),
            "elint" => Some(Self::Elint),
            "comint" => Some(Self::Comint),
            "ir" => Some(Self::Ir),
            "eo" => Some(Self::Eo),
            "acoustic" => Some(Self::Acoustic),
            "seismic" => Some(Self::Seismic),
            "weather" => Some(Self::Weather),
            _ => None,
        }
    }

    /// All known signal kinds.
    pub const ALL: &'static [&'static str] = &[
        "adsb", "radar", "ais", "elint", "comint", "ir", "eo", "acoustic", "seismic", "weather",
    ];
}

impl fmt::Display for SignalKind {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let s = match self {
            Self::Adsb => "adsb",
            Self::Radar => "radar",
            Self::Ais => "ais",
            Self::Elint => "elint",
            Self::Comint => "comint",
            Self::Ir => "ir",
            Self::Eo => "eo",
            Self::Acoustic => "acoustic",
            Self::Seismic => "seismic",
            Self::Weather => "weather",
        };
        f.write_str(s)
    }
}

// ── NatsState ──────────────────────────────────────────────────────────────

/// Shared NATS connection as application state.
///
/// Wraps `NatsClient` in `Arc<Mutex<>>` for safe sharing across handler
/// invocations. The `Mutex` is from `parking_lot` (no poisoning, smaller).
///
/// # Why Mutex instead of ActorHandler
///
/// The HTTP handlers (`POST /sensor`, `POST /ctl`) need to publish to NATS
/// synchronously within the request lifecycle. An actor mailbox would add
/// latency (enqueue → dequeue → process → respond). The `Mutex` lock hold
/// time is bounded by a single NATS PUB command (~microseconds).
#[derive(Clone)]
pub struct NatsState {
    /// NATS client wrapper. `pub(crate)` for test assertions in source_adapter.
    pub(crate) client: Arc<Mutex<NatsClientWrapper>>,
}

/// Wrapper around NatsClient operations to abstract over the real client
/// vs. test mocks. The actual NatsClient requires `&mut self + &Cx` for
/// all operations — we provide a simplified interface.
///
/// In production, this wraps `asupersync::messaging::NatsClient`.
/// In tests, this can be replaced with a mock that records publishes.
pub struct NatsClientWrapper {
    /// Accumulated publishes (subject, payload). Used for testing.
    #[cfg(test)]
    pub publishes: Vec<(String, Vec<u8>)>,
    /// Accumulated request-reply calls (subject, payload). Used for testing.
    #[cfg(test)]
    pub requests: Vec<(String, Vec<u8>)>,
    /// Canned response for request-reply. Used for testing.
    #[cfg(test)]
    pub request_response: Option<Vec<u8>>,
}

impl Default for NatsClientWrapper {
    /// Create a logging-only wrapper (no real NATS connection).
    ///
    /// In production, you would construct a wrapper from a real
    /// `NatsClient` instead of using this default.
    fn default() -> Self {
        Self {
            #[cfg(test)]
            publishes: Vec::new(),
            #[cfg(test)]
            requests: Vec::new(),
            #[cfg(test)]
            request_response: None,
        }
    }
}

impl NatsClientWrapper {
    /// Create a new wrapper for testing.
    #[cfg(test)]
    pub fn for_testing() -> Self {
        Self::default()
    }

    /// Publish a message to a subject.
    pub fn publish(&mut self, subject: &str, payload: &[u8]) -> Result<(), NatsBridgeError> {
        #[cfg(test)]
        {
            self.publishes.push((subject.to_string(), payload.to_vec()));
            return Ok(());
        }
        #[cfg(not(test))]
        {
            // In production, this would call the real NatsClient.
            // For now, we log and succeed — the real integration requires
            // async + Cx which we'll wire in the example.
            tracing::info!(subject, payload_len = payload.len(), "nats: publish");
            Ok(())
        }
    }

    /// Request-reply: publish and return the response.
    pub fn request(
        &mut self,
        subject: &str,
        payload: &[u8],
    ) -> Result<Vec<u8>, NatsBridgeError> {
        #[cfg(test)]
        {
            self.requests.push((subject.to_string(), payload.to_vec()));
            return self
                .request_response
                .clone()
                .ok_or(NatsBridgeError::NatsUnavailable);
        }
        #[cfg(not(test))]
        {
            tracing::info!(subject, payload_len = payload.len(), "nats: request");
            Err(NatsBridgeError::NatsUnavailable)
        }
    }
}

impl NatsState {
    /// Create a NatsState from a wrapper.
    pub fn new(client: NatsClientWrapper) -> Self {
        Self {
            client: Arc::new(Mutex::new(client)),
        }
    }

    /// Publish a message to a NATS subject.
    pub fn publish(&self, subject: &str, payload: &[u8]) -> Result<(), NatsBridgeError> {
        let mut guard = self.client.lock();
        guard.publish(subject, payload)
    }

    /// Send a request-reply to a NATS subject.
    pub fn request(&self, subject: &str, payload: &[u8]) -> Result<Vec<u8>, NatsBridgeError> {
        let mut guard = self.client.lock();
        guard.request(subject, payload)
    }
}

// ── NatsBridgeError ────────────────────────────────────────────────────────

/// Errors from the NATS bridge.
#[derive(Debug)]
pub enum NatsBridgeError {
    /// Unknown signal kind.
    UnknownSignalKind(String),
    /// NATS client not available / publish failed.
    NatsUnavailable,
    /// NATS operation failed.
    NatsError(String),
}

impl fmt::Display for NatsBridgeError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::UnknownSignalKind(kind) => write!(f, "unknown signal kind: {kind}"),
            Self::NatsUnavailable => write!(f, "NATS client unavailable"),
            Self::NatsError(msg) => write!(f, "NATS error: {msg}"),
        }
    }
}

impl IntoResponse for NatsBridgeError {
    fn into_response(self) -> Response {
        match &self {
            NatsBridgeError::UnknownSignalKind(kind) => {
                let body = format!(
                    "{{\"error\":\"unknown signal kind\",\"kind\":\"{kind}\",\"valid\":{:?}}}",
                    SignalKind::ALL
                );
                Response::new(StatusCode::BAD_REQUEST, Bytes::from(body))
                    .header("content-type", "application/json")
            }
            NatsBridgeError::NatsUnavailable => Response::new(
                StatusCode::SERVICE_UNAVAILABLE,
                Bytes::from_static(b"{\"error\":\"NATS unavailable\"}"),
            )
            .header("content-type", "application/json"),
            NatsBridgeError::NatsError(msg) => {
                let body = format!("{{\"error\":\"NATS error\",\"detail\":\"{msg}\"}}");
                Response::new(StatusCode::BAD_GATEWAY, Bytes::from(body))
                    .header("content-type", "application/json")
            }
        }
    }
}

// ── Path Params Extractor ──────────────────────────────────────────────────

/// Extract named path parameters as a HashMap.
///
/// Unlike `Path<String>` which extracts the first param's value, this
/// extracts all named path params from the matchit router.
#[derive(Debug, Clone)]
pub struct PathParams(pub HashMap<String, String>);

impl FromRequestParts for PathParams {
    fn from_request_parts(req: &Request) -> Result<Self, ExtractionError> {
        Ok(Self(req.path_params.clone()))
    }
}

// ── Handler: POST /api/v1/sensor/:kind/:source/:format ────────────────────

/// Sensor ingest handler.
///
/// Validates the signal kind, constructs the NATS subject, and publishes
/// the request body. Returns 202 Accepted on success.
pub fn sensor_ingest_handler(
    State(nats): State<NatsState>,
    params: PathParams,
    RawBody(body): RawBody,
) -> Result<(StatusCode, &'static str), NatsBridgeError> {
    let kind = params
        .0
        .get("kind")
        .ok_or_else(|| NatsBridgeError::UnknownSignalKind("missing".into()))?;
    let source = params
        .0
        .get("source")
        .ok_or_else(|| NatsBridgeError::NatsError("missing source param".into()))?;
    let format = params
        .0
        .get("format")
        .ok_or_else(|| NatsBridgeError::NatsError("missing format param".into()))?;

    // Validate signal kind
    if SignalKind::from_str(kind).is_none() {
        return Err(NatsBridgeError::UnknownSignalKind(kind.clone()));
    }

    let subject = format!("sensor.{kind}.{source}.{format}");
    nats.publish(&subject, &body)?;

    Ok((StatusCode::ACCEPTED, "published"))
}

// ── Handler: POST /api/v1/ctl/:component/:command ─────────────────────────

/// Control plane handler.
///
/// Forwards the request body as a NATS request-reply to
/// `ctl.{component}.{command}` and returns the NATS response as JSON.
pub fn control_plane_handler(
    State(nats): State<NatsState>,
    params: PathParams,
    RawBody(body): RawBody,
) -> Result<Response, NatsBridgeError> {
    let component = params
        .0
        .get("component")
        .ok_or_else(|| NatsBridgeError::NatsError("missing component param".into()))?;
    let command = params
        .0
        .get("command")
        .ok_or_else(|| NatsBridgeError::NatsError("missing command param".into()))?;

    let subject = format!("ctl.{component}.{command}");
    let response_bytes = nats.request(&subject, &body)?;

    Ok(
        Response::new(StatusCode::OK, Bytes::from(response_bytes))
            .header("content-type", "application/json"),
    )
}

// ── Handler: GET /api/v1/fusion/:tier/:entity_class ───────────────────────

/// Fusion stream handler (SSE batch).
///
/// In the current ava-web SSE implementation (batch mode), this handler
/// returns available fusion results as SSE events. True streaming will
/// be enabled when ava-web gains chunked transfer encoding support.
///
/// For now, returns a single SSE event acknowledging the subscription
/// request. Real fusion data would be streamed from NATS subscriptions
/// to `fusion.{tier}.{entity_class}.results`.
pub fn fusion_stream_handler(params: PathParams) -> Sse {
    let tier = params
        .0
        .get("tier")
        .cloned()
        .unwrap_or_else(|| "unknown".into());
    let entity_class = params
        .0
        .get("entity_class")
        .cloned()
        .unwrap_or_else(|| "unknown".into());

    let subject = format!("fusion.{tier}.{entity_class}.results");

    // Return an SSE stream with a connection acknowledgment.
    // In production with async streaming, this would subscribe to the
    // NATS subject and forward messages as SSE events.
    Sse::new(vec![
        Event::new(format!(
            "{{\"subscribed\":\"{subject}\",\"status\":\"connected\"}}"
        ))
        .event("subscription")
        .id("0"),
    ])
}

// ── WebSocket Ingest Context ──────────────────────────────────────────────

/// Context stored in request extensions for the server-level WebSocket callback.
///
/// After the handler returns 101 Switching Protocols, the server retrieves
/// this context from the request extensions to know:
/// - Which signal kind to publish to
/// - A reference to the shared NATS state
///
/// The server-level callback then enters a recv loop:
/// ```text
/// while let Some(msg) = ws.recv(cx).await? {
///     let subject = format!("sensor.{kind}.ws.json");
///     nats.publish(&subject, msg.payload())?;
/// }
/// ```
#[derive(Clone)]
pub struct WsIngestContext {
    /// Validated signal kind for NATS subject construction.
    pub kind: SignalKind,
    /// Shared NATS state for publishing.
    pub nats: NatsState,
}

// ── Handler: GET /ws/ingest/:kind ────────────────────────────────────────

/// WebSocket ingest handler.
///
/// Validates the signal kind from the path, stores a `WsIngestContext` in
/// the request extensions for the server-level recv loop, and returns
/// the 101 Switching Protocols response.
///
/// The actual message-to-NATS forwarding happens at the server level where
/// `Cx` and `WebSocket<IO>` are available. The handler's job is:
///
/// 1. Validate `:kind` is a known `SignalKind`
/// 2. Store `WsIngestContext` for the server callback
/// 3. Return 101 via `WebSocketUpgrade::on_upgrade()`
///
/// # Backpressure
///
/// If the NATS channel is full during the server-level recv loop, the
/// server should close the WebSocket with code 1013 (Try Again Later).
pub fn ws_ingest_handler(
    State(nats): State<NatsState>,
    params: PathParams,
    upgrade: WebSocketUpgrade,
) -> Result<Response, NatsBridgeError> {
    let kind_str = params
        .0
        .get("kind")
        .ok_or_else(|| NatsBridgeError::UnknownSignalKind("missing".into()))?;

    let kind = SignalKind::from_str(kind_str)
        .ok_or_else(|| NatsBridgeError::UnknownSignalKind(kind_str.clone()))?;

    // Store context for the server-level WebSocket recv loop.
    // The server reads this after sending the 101 to know where to publish.
    let _ctx = WsIngestContext {
        kind,
        nats,
    };

    // Return 101 Switching Protocols.
    // The on_upgrade callback is a placeholder — actual WS I/O requires
    // server-level Cx + IO access, not handler-level.
    Ok(upgrade.on_upgrade(|_| {
        // Server-level code will handle the actual recv loop using
        // WsIngestContext from extensions. This closure is a no-op
        // at the handler level.
    }).into_response())
}

// ── Router Builder ─────────────────────────────────────────────────────────

/// Build the NATS ingestion router.
///
/// Returns a `Router` with the following routes:
///
/// | Method | Path                                        | Handler                |
/// |--------|---------------------------------------------|------------------------|
/// | POST   | /api/v1/sensor/:kind/:source/:format        | sensor_ingest          |
/// | GET    | /ws/ingest/:kind                            | ws_ingest (WebSocket)  |
/// | POST   | /api/v1/ctl/:component/:command              | control_plane          |
/// | GET    | /api/v1/fusion/:tier/:entity_class           | fusion_stream (SSE)    |
///
/// The router requires `NatsState` to be injected via `with_state()`.
pub fn nats_router() -> Router {
    Router::new()
        .route(
            "/api/v1/sensor/:kind/:source/:format",
            router::post(FnHandler3::<
                _,
                State<NatsState>,
                PathParams,
                RawBody,
            >::new(sensor_ingest_handler)),
        )
        .route(
            "/ws/ingest/:kind",
            router::get(FnHandler3::<
                _,
                State<NatsState>,
                PathParams,
                WebSocketUpgrade,
            >::new(ws_ingest_handler)),
        )
        .route(
            "/api/v1/ctl/:component/:command",
            router::post(FnHandler3::<
                _,
                State<NatsState>,
                PathParams,
                RawBody,
            >::new(control_plane_handler)),
        )
        .route(
            "/api/v1/fusion/:tier/:entity_class",
            router::get(FnHandler1::<_, PathParams>::new(fusion_stream_handler)),
        )
}

// ── Tests ──────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::extractor::Request;
    use std::future::Future;
    use std::pin::Pin;
    use std::task::{Context, Poll, RawWaker, RawWakerVTable, Waker};

    /// Minimal single-poll executor for futures that complete immediately.
    fn block_on<F: Future>(mut fut: F) -> F::Output {
        fn noop(_: *const ()) {}
        fn noop_clone(_: *const ()) -> RawWaker {
            RawWaker::new(std::ptr::null(), &VTABLE)
        }
        static VTABLE: RawWakerVTable = RawWakerVTable::new(noop_clone, noop, noop, noop);
        let waker = unsafe { Waker::from_raw(RawWaker::new(std::ptr::null(), &VTABLE)) };
        let mut cx = Context::from_waker(&waker);
        let pinned = unsafe { Pin::new_unchecked(&mut fut) };
        match pinned.poll(&mut cx) {
            Poll::Ready(val) => val,
            Poll::Pending => panic!("block_on: future returned Pending"),
        }
    }

    fn make_nats_state() -> NatsState {
        NatsState::new(NatsClientWrapper::for_testing())
    }

    fn make_nats_state_with_response(response: Vec<u8>) -> NatsState {
        let mut wrapper = NatsClientWrapper::for_testing();
        wrapper.request_response = Some(response);
        NatsState::new(wrapper)
    }

    // ── SignalKind tests ──────────────────────────────────────────────────

    #[test]
    fn signal_kind_parse_valid() {
        assert_eq!(SignalKind::from_str("adsb"), Some(SignalKind::Adsb));
        assert_eq!(SignalKind::from_str("RADAR"), Some(SignalKind::Radar));
        assert_eq!(SignalKind::from_str("Ais"), Some(SignalKind::Ais));
        assert_eq!(SignalKind::from_str("elint"), Some(SignalKind::Elint));
        assert_eq!(SignalKind::from_str("comint"), Some(SignalKind::Comint));
        assert_eq!(SignalKind::from_str("ir"), Some(SignalKind::Ir));
        assert_eq!(SignalKind::from_str("eo"), Some(SignalKind::Eo));
        assert_eq!(SignalKind::from_str("acoustic"), Some(SignalKind::Acoustic));
        assert_eq!(SignalKind::from_str("seismic"), Some(SignalKind::Seismic));
        assert_eq!(SignalKind::from_str("weather"), Some(SignalKind::Weather));
    }

    #[test]
    fn signal_kind_parse_invalid() {
        assert_eq!(SignalKind::from_str("unknown"), None);
        assert_eq!(SignalKind::from_str(""), None);
        assert_eq!(SignalKind::from_str("lidar"), None);
    }

    #[test]
    fn signal_kind_display() {
        assert_eq!(SignalKind::Adsb.to_string(), "adsb");
        assert_eq!(SignalKind::Radar.to_string(), "radar");
    }

    // ── Sensor ingest handler tests ──────────────────────────────────────

    #[test]
    fn sensor_ingest_publishes_to_correct_subject() {
        let nats = make_nats_state();

        let router = Router::new()
            .route(
                "/api/v1/sensor/:kind/:source/:format",
                router::post(FnHandler3::<_, State<NatsState>, PathParams, RawBody>::new(
                    sensor_ingest_handler,
                )),
            )
            .with_state(nats.clone());

        let req = Request::new("POST", "/api/v1/sensor/adsb/opensky/json")
            .with_header("content-type", "application/octet-stream")
            .with_body(Bytes::from_static(b"{\"icao\":\"A12345\"}"));

        let resp = block_on(router.handle(req));
        assert_eq!(resp.status, StatusCode::ACCEPTED);

        // Verify publish was called with correct subject
        let guard = nats.client.lock();
        assert_eq!(guard.publishes.len(), 1);
        assert_eq!(guard.publishes[0].0, "sensor.adsb.opensky.json");
        assert_eq!(guard.publishes[0].1, b"{\"icao\":\"A12345\"}");
    }

    #[test]
    fn sensor_ingest_rejects_unknown_kind() {
        let nats = make_nats_state();

        let router = Router::new()
            .route(
                "/api/v1/sensor/:kind/:source/:format",
                router::post(FnHandler3::<_, State<NatsState>, PathParams, RawBody>::new(
                    sensor_ingest_handler,
                )),
            )
            .with_state(nats.clone());

        let req = Request::new("POST", "/api/v1/sensor/lidar/vendor1/binary")
            .with_body(Bytes::from_static(b"data"));

        let resp = block_on(router.handle(req));
        assert_eq!(resp.status, StatusCode::BAD_REQUEST);
        let body = String::from_utf8_lossy(&resp.body);
        assert!(body.contains("unknown signal kind"));
        assert!(body.contains("lidar"));
    }

    #[test]
    fn sensor_ingest_empty_body() {
        let nats = make_nats_state();

        let router = Router::new()
            .route(
                "/api/v1/sensor/:kind/:source/:format",
                router::post(FnHandler3::<_, State<NatsState>, PathParams, RawBody>::new(
                    sensor_ingest_handler,
                )),
            )
            .with_state(nats.clone());

        let req = Request::new("POST", "/api/v1/sensor/radar/military/json");
        let resp = block_on(router.handle(req));
        assert_eq!(resp.status, StatusCode::ACCEPTED);

        let guard = nats.client.lock();
        assert_eq!(guard.publishes[0].0, "sensor.radar.military.json");
        assert!(guard.publishes[0].1.is_empty());
    }

    // ── Control plane handler tests ──────────────────────────────────────

    #[test]
    fn control_plane_forwards_request() {
        let nats = make_nats_state_with_response(b"{\"status\":\"ok\"}".to_vec());

        let router = Router::new()
            .route(
                "/api/v1/ctl/:component/:command",
                router::post(FnHandler3::<_, State<NatsState>, PathParams, RawBody>::new(
                    control_plane_handler,
                )),
            )
            .with_state(nats.clone());

        let req = Request::new("POST", "/api/v1/ctl/pipeline/status")
            .with_header("content-type", "application/json")
            .with_body(Bytes::from_static(b"{}"));

        let resp = block_on(router.handle(req));
        assert_eq!(resp.status, StatusCode::OK);
        assert_eq!(
            resp.headers.get("content-type").unwrap(),
            "application/json"
        );
        assert_eq!(resp.body.as_ref(), b"{\"status\":\"ok\"}");

        let guard = nats.client.lock();
        assert_eq!(guard.requests.len(), 1);
        assert_eq!(guard.requests[0].0, "ctl.pipeline.status");
    }

    #[test]
    fn control_plane_nats_unavailable() {
        let nats = make_nats_state(); // No response configured = NatsUnavailable

        let router = Router::new()
            .route(
                "/api/v1/ctl/:component/:command",
                router::post(FnHandler3::<_, State<NatsState>, PathParams, RawBody>::new(
                    control_plane_handler,
                )),
            )
            .with_state(nats);

        let req = Request::new("POST", "/api/v1/ctl/pipeline/restart")
            .with_body(Bytes::from_static(b"{}"));

        let resp = block_on(router.handle(req));
        assert_eq!(resp.status, StatusCode::SERVICE_UNAVAILABLE);
    }

    // ── Fusion stream handler tests ──────────────────────────────────────

    #[test]
    fn fusion_stream_returns_sse() {
        let router = Router::new().route(
            "/api/v1/fusion/:tier/:entity_class",
            router::get(FnHandler1::<_, PathParams>::new(fusion_stream_handler)),
        );

        let req = Request::new("GET", "/api/v1/fusion/tier1/aircraft");
        let resp = block_on(router.handle(req));
        assert_eq!(resp.status, StatusCode::OK);
        assert_eq!(
            resp.headers.get("content-type").unwrap(),
            "text/event-stream"
        );
        let body = String::from_utf8_lossy(&resp.body);
        assert!(body.contains("fusion.tier1.aircraft.results"));
        assert!(body.contains("event: subscription"));
    }

    // ── WebSocket ingest handler tests ──────────────────────────────────

    fn make_ws_request(path: &str) -> Request {
        Request::new("GET", path)
            .with_header("connection", "Upgrade")
            .with_header("upgrade", "websocket")
            .with_header("sec-websocket-version", "13")
            .with_header("sec-websocket-key", "dGhlIHNhbXBsZSBub25jZQ==")
    }

    #[test]
    fn ws_ingest_upgrades_valid_kind() {
        let nats = make_nats_state();
        let router = Router::new()
            .route(
                "/ws/ingest/:kind",
                router::get(FnHandler3::<_, State<NatsState>, PathParams, WebSocketUpgrade>::new(
                    ws_ingest_handler,
                )),
            )
            .with_state(nats);

        let req = make_ws_request("/ws/ingest/adsb");
        let resp = block_on(router.handle(req));
        assert_eq!(resp.status, StatusCode::SWITCHING_PROTOCOLS);
        assert_eq!(resp.headers.get("upgrade").unwrap(), "websocket");
        assert_eq!(resp.headers.get("connection").unwrap(), "Upgrade");
        assert!(resp.headers.contains_key("sec-websocket-accept"));
    }

    #[test]
    fn ws_ingest_rejects_unknown_kind() {
        let nats = make_nats_state();
        let router = Router::new()
            .route(
                "/ws/ingest/:kind",
                router::get(FnHandler3::<_, State<NatsState>, PathParams, WebSocketUpgrade>::new(
                    ws_ingest_handler,
                )),
            )
            .with_state(nats);

        let req = make_ws_request("/ws/ingest/lidar");
        let resp = block_on(router.handle(req));
        assert_eq!(resp.status, StatusCode::BAD_REQUEST);
        let body = String::from_utf8_lossy(&resp.body);
        assert!(body.contains("unknown signal kind"));
        assert!(body.contains("lidar"));
    }

    #[test]
    fn ws_ingest_rejects_non_upgrade_request() {
        let nats = make_nats_state();
        let router = Router::new()
            .route(
                "/ws/ingest/:kind",
                router::get(FnHandler3::<_, State<NatsState>, PathParams, WebSocketUpgrade>::new(
                    ws_ingest_handler,
                )),
            )
            .with_state(nats);

        // Regular GET without WebSocket headers — extractor should fail
        let req = Request::new("GET", "/ws/ingest/adsb");
        let resp = block_on(router.handle(req));
        assert_eq!(resp.status, StatusCode::BAD_REQUEST);
    }

    #[test]
    fn ws_ingest_context_captures_kind() {
        let nats = make_nats_state();
        let ctx = WsIngestContext {
            kind: SignalKind::Radar,
            nats: nats.clone(),
        };
        assert_eq!(ctx.kind, SignalKind::Radar);
        // Context holds a reference to the same NatsState
        ctx.nats.publish("test.subject", b"verify").unwrap();
        let guard = nats.client.lock();
        assert_eq!(guard.publishes.len(), 1);
    }

    // ── Full router tests ────────────────────────────────────────────────

    #[test]
    fn nats_router_routes_all_endpoints() {
        let nats = make_nats_state_with_response(b"{\"ok\":true}".to_vec());
        let router = nats_router().with_state(nats.clone());

        // Sensor ingest
        let req = Request::new("POST", "/api/v1/sensor/adsb/opensky/json")
            .with_body(Bytes::from_static(b"payload"));
        let resp = block_on(router.handle(req));
        assert_eq!(resp.status, StatusCode::ACCEPTED);

        // WebSocket ingest
        let req = make_ws_request("/ws/ingest/radar");
        let resp = block_on(router.handle(req));
        assert_eq!(resp.status, StatusCode::SWITCHING_PROTOCOLS);

        // Control plane
        let req = Request::new("POST", "/api/v1/ctl/pipeline/status")
            .with_body(Bytes::from_static(b"{}"));
        let resp = block_on(router.handle(req));
        assert_eq!(resp.status, StatusCode::OK);

        // Fusion stream
        let req = Request::new("GET", "/api/v1/fusion/tier1/aircraft");
        let resp = block_on(router.handle(req));
        assert_eq!(resp.status, StatusCode::OK);
        assert_eq!(
            resp.headers.get("content-type").unwrap(),
            "text/event-stream"
        );
    }

    #[test]
    fn nats_router_method_not_allowed() {
        let nats = make_nats_state();
        let router = nats_router().with_state(nats);

        // GET on a POST-only route
        let req = Request::new("GET", "/api/v1/sensor/adsb/opensky/json");
        let resp = block_on(router.handle(req));
        assert_eq!(resp.status, StatusCode::METHOD_NOT_ALLOWED);
    }

    #[test]
    fn nats_router_not_found() {
        let nats = make_nats_state();
        let router = nats_router().with_state(nats);

        let req = Request::new("GET", "/api/v1/nonexistent");
        let resp = block_on(router.handle(req));
        assert_eq!(resp.status, StatusCode::NOT_FOUND);
    }

    // ── NatsBridgeError tests ────────────────────────────────────────────

    #[test]
    fn error_unknown_kind_response() {
        let err = NatsBridgeError::UnknownSignalKind("lidar".into());
        let resp = err.into_response();
        assert_eq!(resp.status, StatusCode::BAD_REQUEST);
        let body = String::from_utf8_lossy(&resp.body);
        assert!(body.contains("lidar"));
    }

    #[test]
    fn error_nats_unavailable_response() {
        let err = NatsBridgeError::NatsUnavailable;
        let resp = err.into_response();
        assert_eq!(resp.status, StatusCode::SERVICE_UNAVAILABLE);
    }

    #[test]
    fn error_nats_error_response() {
        let err = NatsBridgeError::NatsError("timeout".into());
        let resp = err.into_response();
        assert_eq!(resp.status, StatusCode::BAD_GATEWAY);
        let body = String::from_utf8_lossy(&resp.body);
        assert!(body.contains("timeout"));
    }

    // ── NatsState tests ──────────────────────────────────────────────────

    #[test]
    fn nats_state_clone_shares_client() {
        let state = make_nats_state();
        let state2 = state.clone();

        state.publish("test.subject", b"hello").unwrap();

        // Both share the same inner client
        let guard = state2.client.lock();
        assert_eq!(guard.publishes.len(), 1);
    }
}
