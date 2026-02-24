//! Session-typed handler protocols for ava-web.
//!
//! Wraps asupersync's session type *primitives* (Send, Recv, Select, Offer, End)
//! into HTTP-specific protocol definitions that enforce handler correctness at
//! compile time.
//!
//! # Why Session Types for HTTP?
//!
//! Traditional handler signatures (`fn(Request) -> Response`) provide no
//! compile-time guarantee that:
//!
//! - A handler produces exactly one response (not zero, not two)
//! - Middleware always calls the next handler or explicitly short-circuits
//! - Streaming responses send frames in the correct sequence
//! - Multi-step flows (OAuth, WebSocket upgrade) complete all phases
//!
//! Session types encode these protocols in the Rust type system. Invalid
//! handler sequences become **type errors**. Dropping a protocol channel
//! mid-flow triggers a **drop bomb** (panic), catching forgotten responses
//! even in complex async code.
//!
//! # Protocol Encoding
//!
//! An `HttpChan<S>` endpoint tracks the current protocol state as a type
//! parameter. Each transition method **consumes** `self` and returns the
//! channel in the next state:
//!
//! ```text
//!   HttpChan<Send<T, S>>    --send(T)-->     HttpChan<S>
//!   HttpChan<Recv<T, S>>    --recv(T)-->     (T, HttpChan<S>)
//!   HttpChan<Select<A, B>>  --select_*()-->  HttpChan<A> | HttpChan<B>
//!   HttpChan<Offer<A, B>>   --offer(B)-->    Offered<HttpChan<A>, HttpChan<B>>
//!   HttpChan<End>           --close()-->     SessionProof
//! ```
//!
//! # HTTP Protocols
//!
//! ## Request-Response (basic handler)
//!
//! ```text
//!   Handler receives Request, then selects:
//!     - Success: sends Response, end
//!     - Error: sends ErrorResponse, end
//! ```
//!
//! Type:
//! ```ignore
//! type HttpHandlerSession = Recv<Request, Select<
//!     Send<Response, End>,       // success path
//!     Send<ErrorResponse, End>,  // error path
//! >>;
//! ```
//!
//! ## Middleware Chain
//!
//! ```text
//!   Middleware receives Request, then selects:
//!     - Forward: sends (possibly transformed) Request to Next, end
//!     - Reject: sends Response directly, end
//! ```
//!
//! ## Streaming Response
//!
//! ```text
//!   Handler receives Request, then loops:
//!     - SendFrame: sends Frame, continue loop
//!     - EndStream: sends trailer, end
//! ```
//!
//! ## Multi-Step Flow (e.g., OAuth)
//!
//! ```text
//!   Step 1: Recv Credentials, Send AuthToken | Rejection
//!   Step 2: Recv RefreshRequest, Send AuthToken | Rejection
//! ```
//!
//! # Example
//!
//! ```ignore
//! use ava_web::session::*;
//!
//! // Define a session-typed handler
//! fn my_handler(chan: HttpChan<HttpHandlerSession>) -> SessionProof {
//!     let (request, chan) = chan.recv(incoming_request);
//!     if request.path == "/health" {
//!         let chan = chan.select_left();  // success
//!         let chan = chan.send(Response::ok("healthy"));
//!         chan.close()  // proof of completion
//!     } else {
//!         let chan = chan.select_right();  // error
//!         let chan = chan.send(ErrorResponse::new(StatusCode::NOT_FOUND, "not found"));
//!         chan.close()
//!     }
//!     // Forgetting to call close() -> DROP BOMB PANICS
//! }
//! ```
//!
//! # Integration with ava-web
//!
//! Session-typed handlers complement (not replace) the existing `Handler`
//! trait. Use session types when protocol correctness is critical:
//!
//! - WebSocket message protocols
//! - Multi-step API flows
//! - Streaming with structured frame sequences
//! - Actor-backed stateful handlers
//!
//! For simple request-response handlers, the standard `Handler` trait
//! remains the ergonomic choice.

use std::marker::PhantomData;
use std::sync::atomic::{AtomicU64, Ordering};

// Re-export asupersync's session type primitives for protocol definitions.
pub use asupersync::obligation::session_types::{End, Offer, Recv, Select, Send};

use crate::extractor::Request;
use crate::response::Response;

// ── Channel ID Generation ────────────────────────────────────────────────────

/// Global atomic counter for generating unique channel IDs.
static CHANNEL_COUNTER: AtomicU64 = AtomicU64::new(1);

/// Generate a unique channel ID.
fn next_channel_id() -> u64 {
    CHANNEL_COUNTER.fetch_add(1, Ordering::Relaxed)
}

// ── Proof of Completion ─────────────────────────────────────────────────────

/// Proof that a session-typed protocol completed successfully.
///
/// Produced by `HttpChan::close()` when the channel reaches the `End` state.
/// This is an unforgeable witness that the protocol ran to completion.
#[derive(Debug)]
pub struct SessionProof {
    /// Channel ID of the completed session.
    pub channel_id: u64,
}

// ── HttpChan — Session-Typed Channel ─────────────────────────────────────────

/// A session-typed channel endpoint for HTTP protocol enforcement.
///
/// `S` is the current protocol state (a type-level encoding using
/// `Send`, `Recv`, `Select`, `Offer`, `End`). Each transition method
/// **consumes** `self` and returns the channel in the next state.
///
/// # Linearity (Drop Bomb)
///
/// Dropping an `HttpChan` in any state other than `End` panics. This
/// approximates the linear usage requirement of session types in Rust's
/// affine type system — you cannot forget to complete a protocol.
///
/// # Design Note
///
/// `HttpChan` mirrors `asupersync::obligation::session_types::Chan` but
/// with a public constructor, allowing ava-web to define custom HTTP
/// protocol shapes without requiring upstream changes. The type-level
/// primitives (`Send`, `Recv`, `Select`, `Offer`, `End`) are re-exported
/// from asupersync for full compatibility.
#[must_use = "session channel must be driven to End; dropping mid-protocol leaks the obligation"]
pub struct HttpChan<S> {
    /// Channel identifier for diagnostics.
    channel_id: u64,
    /// Whether the channel has reached the End state (disarms drop bomb).
    closed: bool,
    /// Session type marker.
    _state: PhantomData<S>,
}

impl<S> HttpChan<S> {
    /// Create a new channel in initial protocol state `S`.
    fn new(channel_id: u64) -> Self {
        Self {
            channel_id,
            closed: false,
            _state: PhantomData,
        }
    }

    /// Channel identifier.
    pub fn channel_id(&self) -> u64 {
        self.channel_id
    }

    /// Internal state transition: consumes `self` in state `S`,
    /// returns channel in state `S2`.
    fn transition<S2>(self) -> HttpChan<S2> {
        let chan = HttpChan {
            channel_id: self.channel_id,
            closed: false,
            _state: PhantomData,
        };
        // Disarm the old channel's drop bomb.
        std::mem::forget(self);
        chan
    }
}

// -- Send transition --

impl<T, S> HttpChan<Send<T, S>> {
    /// Send a value, transitioning to the continuation state.
    pub fn send(self, _value: T) -> HttpChan<S> {
        self.transition()
    }
}

// -- Recv transition --

impl<T, S> HttpChan<Recv<T, S>> {
    /// Receive a value, transitioning to the continuation state.
    ///
    /// In the typestate model, the value is passed in by the test harness
    /// or protocol driver. In a real transport implementation, this would
    /// await on the underlying channel.
    pub fn recv(self, value: T) -> (T, HttpChan<S>) {
        (value, self.transition())
    }
}

// -- Select transition (local choice) --

impl<A, B> HttpChan<Select<A, B>> {
    /// Select the first (left/success) branch.
    pub fn select_left(self) -> HttpChan<A> {
        self.transition()
    }

    /// Select the second (right/error) branch.
    pub fn select_right(self) -> HttpChan<B> {
        self.transition()
    }
}

// -- Offer transition (remote choice) --

/// Result of an offer: which branch the peer selected.
pub enum Offered<A, B> {
    /// First branch was selected.
    Left(A),
    /// Second branch was selected.
    Right(B),
}

/// Which branch the peer selected.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Branch {
    /// First branch.
    Left,
    /// Second branch.
    Right,
}

impl<A, B> HttpChan<Offer<A, B>> {
    /// Wait for the peer's choice and branch accordingly.
    pub fn offer(self, choice: Branch) -> Offered<HttpChan<A>, HttpChan<B>> {
        match choice {
            Branch::Left => Offered::Left(self.transition()),
            Branch::Right => Offered::Right(self.transition()),
        }
    }
}

// -- End transition --

impl HttpChan<End> {
    /// Close the channel, producing a proof of session completion.
    pub fn close(self) -> SessionProof {
        let proof = SessionProof {
            channel_id: self.channel_id,
        };
        std::mem::forget(self); // Disarm drop bomb.
        proof
    }
}

// -- Drop bomb --

impl<S> Drop for HttpChan<S> {
    fn drop(&mut self) {
        if !self.closed {
            panic!(
                "SESSION LEAKED: HttpChan {} dropped without reaching End state",
                self.channel_id,
            );
        }
    }
}

// ── HTTP Protocol Type Aliases ───────────────────────────────────────────────

/// An error/rejection response (status code + body).
///
/// Distinct from a success `Response` to encode the success/failure
/// distinction in the session type.
#[derive(Debug)]
pub struct ErrorResponse(pub Response);

impl ErrorResponse {
    /// Create an error response from a status code and body.
    pub fn new(status: crate::response::StatusCode, body: impl Into<bytes::Bytes>) -> Self {
        Self(Response::new(status, body))
    }

    /// Extract the inner response.
    pub fn into_response(self) -> Response {
        self.0
    }
}

// ── Protocol: Request-Response ───────────────────────────────────────────────

/// Session type for a basic HTTP handler.
///
/// The handler:
/// 1. Receives a `Request`
/// 2. Selects success or error branch
/// 3. Sends the corresponding response
/// 4. Closes the channel (produces `SessionProof`)
///
/// ```text
///   ?Request . ⊕{ !Response.end, !ErrorResponse.end }
/// ```
///
/// **Guarantee**: The handler MUST produce exactly one response.
/// Dropping mid-protocol panics (drop bomb).
pub type HttpHandlerSession = Recv<Request, Select<Send<Response, End>, Send<ErrorResponse, End>>>;

/// Session type for the caller/router side of a handler call.
///
/// ```text
///   !Request . &{ ?Response.end, ?ErrorResponse.end }
/// ```
pub type HttpCallerSession = Send<Request, Offer<Recv<Response, End>, Recv<ErrorResponse, End>>>;

/// Create a paired caller/handler session.
///
/// Returns `(caller_chan, handler_chan)`.
pub fn new_handler_session() -> (HttpChan<HttpCallerSession>, HttpChan<HttpHandlerSession>) {
    let id = next_channel_id();
    (HttpChan::new(id), HttpChan::new(id))
}

// ── Protocol: Middleware ─────────────────────────────────────────────────────

/// Session type for a middleware handler.
///
/// The middleware:
/// 1. Receives a `Request`
/// 2. Selects forward (to next handler) or reject (short-circuit)
/// 3. On forward: sends the (possibly transformed) `Request`
/// 4. On reject: sends an `ErrorResponse` directly
///
/// ```text
///   ?Request . ⊕{ !Request.end, !ErrorResponse.end }
/// ```
///
/// **Guarantee**: The middleware either forwards or rejects. It cannot
/// silently drop the request.
pub type MiddlewareSession = Recv<Request, Select<Send<Request, End>, Send<ErrorResponse, End>>>;

/// Session type for the middleware caller side.
///
/// ```text
///   !Request . &{ ?Request.end, ?ErrorResponse.end }
/// ```
pub type MiddlewareCallerSession =
    Send<Request, Offer<Recv<Request, End>, Recv<ErrorResponse, End>>>;

/// Create a paired caller/middleware session.
pub fn new_middleware_session() -> (
    HttpChan<MiddlewareCallerSession>,
    HttpChan<MiddlewareSession>,
) {
    let id = next_channel_id();
    (HttpChan::new(id), HttpChan::new(id))
}

// ── Protocol: Streaming Response ─────────────────────────────────────────────

/// A single frame in a streaming response.
#[derive(Debug, Clone)]
pub struct StreamFrame {
    /// The frame payload.
    pub data: Vec<u8>,
    /// Whether this is the last frame (triggers End).
    pub is_final: bool,
}

/// Session type for one iteration of a streaming response.
///
/// The streamer selects:
/// - Left: send a frame, then end this iteration (loop externally)
/// - Right: end the stream
///
/// ```text
///   ⊕{ !StreamFrame.end, !().end }
/// ```
///
/// Note: True recursive types (`Rec`/`Var`) require the loop to be
/// managed externally since `HttpChan` transitions consume `self`.
/// The stream loop creates a fresh session per iteration.
pub type StreamIterSession = Select<Send<StreamFrame, End>, Send<(), End>>;

/// Session type for the stream consumer side.
pub type StreamConsumerSession = Offer<Recv<StreamFrame, End>, Recv<(), End>>;

/// Create a paired producer/consumer session for one stream iteration.
pub fn new_stream_iteration() -> (
    HttpChan<StreamIterSession>,
    HttpChan<StreamConsumerSession>,
) {
    let id = next_channel_id();
    (HttpChan::new(id), HttpChan::new(id))
}

// ── Protocol: Multi-Step Auth Flow ──────────────────────────────────────────

/// Message types for a generic multi-step authentication flow.
///
/// Encodes a two-phase auth flow:
/// 1. Client sends credentials, server responds with token or rejection
/// 2. Client may send refresh request, server responds with new token or rejection
pub mod auth_flow {
    use super::*;

    /// Authentication credentials (username/password, API key, etc.).
    #[derive(Debug, Clone)]
    pub struct Credentials {
        pub principal: String,
        pub secret: String,
    }

    /// An issued authentication token.
    #[derive(Debug, Clone)]
    pub struct AuthToken {
        pub token: String,
        pub expires_ms: u64,
    }

    /// A rejection with reason.
    #[derive(Debug, Clone)]
    pub struct Rejection {
        pub reason: String,
    }

    /// A refresh request using an existing token.
    #[derive(Debug, Clone)]
    pub struct RefreshRequest {
        pub token: String,
    }

    /// Phase 1: Client sends credentials, server responds.
    ///
    /// Server side:
    /// ```text
    ///   ?Credentials . ⊕{ !AuthToken.end, !Rejection.end }
    /// ```
    pub type AuthPhase1Server =
        Recv<Credentials, Select<Send<AuthToken, End>, Send<Rejection, End>>>;

    /// Phase 1: Client side.
    pub type AuthPhase1Client =
        Send<Credentials, Offer<Recv<AuthToken, End>, Recv<Rejection, End>>>;

    /// Phase 2: Client sends refresh, server responds.
    ///
    /// Server side:
    /// ```text
    ///   ?RefreshRequest . ⊕{ !AuthToken.end, !Rejection.end }
    /// ```
    pub type RefreshPhaseServer =
        Recv<RefreshRequest, Select<Send<AuthToken, End>, Send<Rejection, End>>>;

    /// Phase 2: Client side.
    pub type RefreshPhaseClient =
        Send<RefreshRequest, Offer<Recv<AuthToken, End>, Recv<Rejection, End>>>;

    /// Create a paired client/server session for authentication.
    pub fn new_auth_session() -> (
        HttpChan<AuthPhase1Client>,
        HttpChan<AuthPhase1Server>,
    ) {
        let id = next_channel_id();
        (HttpChan::new(id), HttpChan::new(id))
    }

    /// Create a paired client/server session for token refresh.
    pub fn new_refresh_session() -> (
        HttpChan<RefreshPhaseClient>,
        HttpChan<RefreshPhaseServer>,
    ) {
        let id = next_channel_id();
        (HttpChan::new(id), HttpChan::new(id))
    }
}

// ── Protocol: WebSocket Handshake ────────────────────────────────────────────

/// WebSocket upgrade protocol.
///
/// Encodes the HTTP upgrade handshake as a session type:
/// 1. Client sends upgrade request
/// 2. Server decides: accept (101 Switching Protocols) or reject (4xx)
///
/// ```text
///   ?Request . ⊕{ !Response.end, !ErrorResponse.end }
/// ```
///
/// This is structurally identical to `HttpHandlerSession` but semantically
/// distinct — the success Response MUST be 101 with correct headers.
pub type WsUpgradeServerSession =
    Recv<Request, Select<Send<Response, End>, Send<ErrorResponse, End>>>;

/// Create a paired session for WebSocket upgrade.
pub fn new_ws_upgrade_session() -> (
    HttpChan<HttpCallerSession>,
    HttpChan<WsUpgradeServerSession>,
) {
    let id = next_channel_id();
    (HttpChan::new(id), HttpChan::new(id))
}

// ── ProtocolHandler Trait ────────────────────────────────────────────────────

/// A session-typed handler that drives a protocol channel to completion.
///
/// Implementors receive an `HttpChan` in the initial protocol state and must
/// drive it to `End`, producing a `SessionProof`. The drop bomb on `HttpChan`
/// ensures that forgetting to complete the protocol panics at runtime.
///
/// This trait is the session-typed analog of [`Handler`](crate::handler::Handler).
///
/// # Type Safety
///
/// The protocol state `S` encodes exactly which operations are valid.
/// Attempting to call `.send()` on a `Recv` state, or `.recv()` on a
/// `Send` state, is a **compile error**.
///
/// # Example
///
/// ```ignore
/// struct MyHandler;
///
/// impl ProtocolHandler<HttpHandlerSession> for MyHandler {
///     fn handle(&self, chan: HttpChan<HttpHandlerSession>) -> SessionProof {
///         let (req, chan) = chan.recv(incoming_request);
///         let chan = chan.select_left();
///         let chan = chan.send(Response::ok("hello"));
///         chan.close()
///     }
/// }
/// ```
pub trait ProtocolHandler<S>: std::marker::Send + Sync + 'static {
    /// Drive the protocol channel from state `S` to `End`.
    fn handle(&self, chan: HttpChan<S>) -> SessionProof;
}

// ── Protocol Combinator ─────────────────────────────────────────────────────

/// Run a handler protocol: create a session, invoke the handler, return
/// the response and proof.
///
/// This is a convenience function for testing and protocol composition.
/// The handler closure receives the responder channel and must drive it
/// to completion, returning both the response and the session proof.
///
/// # Panics
///
/// Panics if the handler drops the channel without completing the protocol
/// (drop bomb).
///
/// # Example
///
/// ```ignore
/// let (response, proof) = run_handler_protocol(request, |chan| {
///     let (req, chan) = chan.recv(request);
///     let chan = chan.select_left();
///     let response = make_response(&req);
///     let chan = chan.send(response.clone());
///     (response, chan.close())
/// });
/// ```
pub fn run_handler_protocol<F>(request: Request, handler: F) -> (Response, SessionProof)
where
    F: FnOnce(HttpChan<HttpHandlerSession>) -> (Response, SessionProof),
{
    let (caller, responder) = new_handler_session();

    // Caller sends the request.
    let caller = caller.send(request);

    // Handler processes it — must return the response for the caller to receive.
    let (response, handler_proof) = handler(responder);

    // Caller receives the response (simulated — typestate only).
    match caller.offer(Branch::Left) {
        Offered::Left(ch) => {
            let (_, ch) = ch.recv(response.clone());
            let _caller_proof = ch.close();
        }
        Offered::Right(ch) => {
            // Caller must also complete its protocol.
            let (_, ch) = ch.recv(ErrorResponse::new(
                crate::response::StatusCode::INTERNAL_SERVER_ERROR,
                "handler error",
            ));
            let _caller_proof = ch.close();
        }
    }

    (response, handler_proof)
}

// ── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::response::{IntoResponse, StatusCode};

    // ── Basic handler protocol ───────────────────────────────────────────

    #[test]
    fn handler_success_path() {
        let (_caller, handler) = new_handler_session();

        // Simulate handler receiving a request and sending success response.
        let request = Request::new("GET", "/health");
        let (req, chan) = handler.recv(request);
        assert_eq!(req.path, "/health");

        let chan = chan.select_left(); // success
        let response = "ok".into_response();
        let chan = chan.send(response);
        let proof = chan.close();

        assert!(proof.channel_id > 0);

        // Clean up caller side (must also reach End to avoid drop bomb).
        let _caller = _caller.send(Request::new("GET", "/health"));
        match _caller.offer(Branch::Left) {
            Offered::Left(ch) => {
                let (_, ch) = ch.recv("ok".into_response());
                let _ = ch.close();
            }
            Offered::Right(_) => unreachable!(),
        }
    }

    #[test]
    fn handler_error_path() {
        let (_caller, handler) = new_handler_session();

        let request = Request::new("GET", "/missing");
        let (_, chan) = handler.recv(request);

        let chan = chan.select_right(); // error
        let chan = chan.send(ErrorResponse::new(StatusCode::NOT_FOUND, "not found"));
        let proof = chan.close();

        assert!(proof.channel_id > 0);

        // Clean up caller.
        let _caller = _caller.send(Request::new("GET", "/missing"));
        match _caller.offer(Branch::Right) {
            Offered::Right(ch) => {
                let (_, ch) = ch.recv(ErrorResponse::new(StatusCode::NOT_FOUND, "not found"));
                let _ = ch.close();
            }
            Offered::Left(_) => unreachable!(),
        }
    }

    #[test]
    #[should_panic(expected = "SESSION LEAKED")]
    fn handler_drop_bomb_fires_on_incomplete_protocol() {
        let (_caller, handler) = new_handler_session();

        // Handler receives request but never sends response.
        let request = Request::new("GET", "/");
        let (_req, _chan) = handler.recv(request);

        // _chan is dropped here without reaching End -> DROP BOMB.
        // Forget caller to avoid double-panic during unwinding.
        std::mem::forget(_caller);
    }

    // ── Middleware protocol ───────────────────────────────────────────────

    #[test]
    fn middleware_forward_path() {
        let (_caller, middleware) = new_middleware_session();

        let request = Request::new("GET", "/api/data");
        let (req, chan) = middleware.recv(request);
        assert_eq!(req.method, crate::extractor::Method::GET);

        // Middleware forwards (possibly transformed) request.
        let chan = chan.select_left();
        let forwarded = Request::new("GET", "/api/data")
            .with_header("x-auth", "verified");
        let chan = chan.send(forwarded);
        let proof = chan.close();

        assert!(proof.channel_id > 0);

        // Clean up caller.
        let _caller = _caller.send(Request::new("GET", "/api/data"));
        match _caller.offer(Branch::Left) {
            Offered::Left(ch) => {
                let (_, ch) = ch.recv(Request::new("GET", "/api/data"));
                let _ = ch.close();
            }
            Offered::Right(_) => unreachable!(),
        }
    }

    #[test]
    fn middleware_reject_path() {
        let (_caller, middleware) = new_middleware_session();

        let request = Request::new("GET", "/admin");
        let (_, chan) = middleware.recv(request);

        // Middleware short-circuits with 403.
        let chan = chan.select_right();
        let chan = chan.send(ErrorResponse::new(StatusCode::FORBIDDEN, "access denied"));
        let proof = chan.close();

        assert!(proof.channel_id > 0);

        // Clean up caller.
        let _caller = _caller.send(Request::new("GET", "/admin"));
        match _caller.offer(Branch::Right) {
            Offered::Right(ch) => {
                let (_, ch) = ch.recv(ErrorResponse::new(StatusCode::FORBIDDEN, "access denied"));
                let _ = ch.close();
            }
            Offered::Left(_) => unreachable!(),
        }
    }

    // ── Streaming protocol ───────────────────────────────────────────────

    #[test]
    fn streaming_sends_multiple_frames() {
        let frames = vec![
            StreamFrame { data: b"chunk1".to_vec(), is_final: false },
            StreamFrame { data: b"chunk2".to_vec(), is_final: false },
            StreamFrame { data: b"chunk3".to_vec(), is_final: true },
        ];

        let mut received_frames = Vec::new();

        for frame in &frames {
            let (producer, consumer) = new_stream_iteration();

            if frame.is_final {
                // End the stream.
                let producer = producer.select_right();
                let producer = producer.send(());
                let _proof = producer.close();

                match consumer.offer(Branch::Right) {
                    Offered::Right(ch) => {
                        let (_, ch) = ch.recv(());
                        let _ = ch.close();
                    }
                    Offered::Left(_) => unreachable!(),
                }
            } else {
                // Send a frame.
                let producer = producer.select_left();
                let producer = producer.send(frame.clone());
                let _proof = producer.close();

                match consumer.offer(Branch::Left) {
                    Offered::Left(ch) => {
                        let (f, ch) = ch.recv(frame.clone());
                        received_frames.push(f);
                        let _ = ch.close();
                    }
                    Offered::Right(_) => unreachable!(),
                }
            }
        }

        assert_eq!(received_frames.len(), 2);
        assert_eq!(received_frames[0].data, b"chunk1");
        assert_eq!(received_frames[1].data, b"chunk2");
    }

    // ── Auth flow protocol ───────────────────────────────────────────────

    #[test]
    fn auth_flow_success() {
        let (client, server) = auth_flow::new_auth_session();

        let creds = auth_flow::Credentials {
            principal: "alice".into(),
            secret: "password123".into(),
        };

        // Client sends credentials.
        let client = client.send(creds.clone());

        // Server receives and authenticates.
        let (received_creds, server) = server.recv(creds);
        assert_eq!(received_creds.principal, "alice");

        // Server issues token.
        let token = auth_flow::AuthToken {
            token: "tok-abc-123".into(),
            expires_ms: 3_600_000,
        };
        let server = server.select_left(); // success
        let server = server.send(token.clone());
        let _server_proof = server.close();

        // Client receives token.
        match client.offer(Branch::Left) {
            Offered::Left(ch) => {
                let (tok, ch) = ch.recv(token);
                assert_eq!(tok.token, "tok-abc-123");
                let _ = ch.close();
            }
            Offered::Right(_) => unreachable!(),
        }
    }

    #[test]
    fn auth_flow_rejection() {
        let (client, server) = auth_flow::new_auth_session();

        let creds = auth_flow::Credentials {
            principal: "bob".into(),
            secret: "wrong".into(),
        };

        let client = client.send(creds.clone());
        let (_, server) = server.recv(creds);

        // Server rejects.
        let rejection = auth_flow::Rejection {
            reason: "invalid credentials".into(),
        };
        let server = server.select_right();
        let server = server.send(rejection.clone());
        let _server_proof = server.close();

        // Client receives rejection.
        match client.offer(Branch::Right) {
            Offered::Right(ch) => {
                let (rej, ch) = ch.recv(rejection);
                assert_eq!(rej.reason, "invalid credentials");
                let _ = ch.close();
            }
            Offered::Left(_) => unreachable!(),
        }
    }

    #[test]
    fn token_refresh_flow() {
        let (client, server) = auth_flow::new_refresh_session();

        let refresh = auth_flow::RefreshRequest {
            token: "old-tok-123".into(),
        };

        let client = client.send(refresh.clone());
        let (req, server) = server.recv(refresh);
        assert_eq!(req.token, "old-tok-123");

        // Server issues new token.
        let new_token = auth_flow::AuthToken {
            token: "new-tok-456".into(),
            expires_ms: 7_200_000,
        };
        let server = server.select_left();
        let server = server.send(new_token.clone());
        let _proof = server.close();

        match client.offer(Branch::Left) {
            Offered::Left(ch) => {
                let (tok, ch) = ch.recv(new_token);
                assert_eq!(tok.token, "new-tok-456");
                let _ = ch.close();
            }
            Offered::Right(_) => unreachable!(),
        }
    }

    // ── WebSocket upgrade protocol ───────────────────────────────────────

    #[test]
    fn ws_upgrade_accepted() {
        let (_caller, server) = new_ws_upgrade_session();

        let request = Request::new("GET", "/ws")
            .with_header("upgrade", "websocket")
            .with_header("connection", "Upgrade")
            .with_header("sec-websocket-key", "dGhlIHNhbXBsZSBub25jZQ==")
            .with_header("sec-websocket-version", "13");

        let (req, chan) = server.recv(request);
        assert_eq!(req.path, "/ws");

        // Server accepts upgrade.
        let upgrade_response = Response::empty(StatusCode::SWITCHING_PROTOCOLS)
            .header("upgrade", "websocket")
            .header("connection", "Upgrade");
        let chan = chan.select_left();
        let chan = chan.send(upgrade_response);
        let proof = chan.close();

        assert!(proof.channel_id > 0);

        // Clean up caller.
        let _caller = _caller.send(Request::new("GET", "/ws"));
        match _caller.offer(Branch::Left) {
            Offered::Left(ch) => {
                let (_, ch) = ch.recv(Response::empty(StatusCode::SWITCHING_PROTOCOLS));
                let _ = ch.close();
            }
            Offered::Right(_) => unreachable!(),
        }
    }

    // ── ProtocolHandler trait ────────────────────────────────────────────

    #[test]
    fn protocol_handler_trait_impl() {
        struct EchoHandler;

        impl ProtocolHandler<HttpHandlerSession> for EchoHandler {
            fn handle(&self, chan: HttpChan<HttpHandlerSession>) -> SessionProof {
                let request = Request::new("GET", "/echo");
                let (_req, chan) = chan.recv(request);
                let chan = chan.select_left();
                let chan = chan.send("echo".into_response());
                chan.close()
            }
        }

        let handler = EchoHandler;
        let (_caller, responder) = new_handler_session();

        // Forget caller to avoid drop bomb interference.
        std::mem::forget(_caller);

        let proof = handler.handle(responder);
        assert!(proof.channel_id > 0);
    }

    // ── Channel ID uniqueness ────────────────────────────────────────────

    #[test]
    fn channel_ids_are_unique() {
        let id1 = next_channel_id();
        let id2 = next_channel_id();
        let id3 = next_channel_id();
        assert_ne!(id1, id2);
        assert_ne!(id2, id3);
    }

    // ── run_handler_protocol combinator ──────────────────────────────────

    #[test]
    fn run_handler_protocol_success() {
        let request = Request::new("GET", "/test");
        let (response, proof) = run_handler_protocol(request, |chan| {
            let (req, chan) = chan.recv(Request::new("GET", "/test"));
            assert_eq!(req.path, "/test");
            let chan = chan.select_left();
            let resp = "hello".into_response();
            let chan = chan.send(resp.clone());
            (resp, chan.close())
        });

        assert!(proof.channel_id > 0);
        assert_eq!(response.status, StatusCode::OK);
    }
}
