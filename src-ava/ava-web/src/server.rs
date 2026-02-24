//! HTTP server — GenServer-supervised accept loop.
//!
//! Wraps asupersync's `Http1Listener` + `Http1Server` with our Router
//! and provides the bridge between the web framework's types and the
//! HTTP/1.1 protocol layer.

use std::collections::HashMap;
use std::io;
use std::net::{SocketAddr, ToSocketAddrs};
use std::sync::Arc;
use std::time::Duration;

use asupersync::http::h1::listener::{Http1Listener, Http1ListenerConfig};
use asupersync::http::h1::server::Http1Config;
use asupersync::http::h1::types as h1;
use asupersync::runtime::RuntimeHandle;
use asupersync::server::shutdown::ShutdownSignal;
use bytes::Bytes;

use crate::extractor::Request as WebRequest;
use crate::response::Response as WebResponse;
#[cfg(test)]
use crate::response::StatusCode;
use crate::router::Router;

// ── ServerConfig ────────────────────────────────────────────────────────────

/// Configuration for the HTTP server.
#[derive(Debug, Clone)]
pub struct ServerConfig {
    /// Maximum concurrent connections.
    pub max_connections: Option<usize>,
    /// Per-connection idle timeout.
    pub idle_timeout: Option<Duration>,
    /// Maximum requests per keep-alive connection.
    pub max_requests_per_connection: Option<u64>,
    /// Maximum header block size in bytes.
    pub max_headers_size: usize,
    /// Maximum body size in bytes.
    pub max_body_size: usize,
    /// Drain timeout for graceful shutdown.
    pub drain_timeout: Duration,
}

impl Default for ServerConfig {
    fn default() -> Self {
        Self {
            max_connections: Some(10_000),
            idle_timeout: Some(Duration::from_secs(60)),
            max_requests_per_connection: Some(1000),
            max_headers_size: 64 * 1024,
            max_body_size: 16 * 1024 * 1024,
            drain_timeout: Duration::from_secs(30),
        }
    }
}

impl ServerConfig {
    /// Set max concurrent connections.
    #[must_use]
    pub fn max_connections(mut self, max: usize) -> Self {
        self.max_connections = Some(max);
        self
    }

    /// Set idle timeout.
    #[must_use]
    pub fn idle_timeout(mut self, timeout: Duration) -> Self {
        self.idle_timeout = Some(timeout);
        self
    }

    /// Set max body size.
    #[must_use]
    pub fn max_body_size(mut self, size: usize) -> Self {
        self.max_body_size = size;
        self
    }

    /// Set drain timeout.
    #[must_use]
    pub fn drain_timeout(mut self, timeout: Duration) -> Self {
        self.drain_timeout = timeout;
        self
    }

    /// Convert to asupersync h1 configuration types.
    ///
    /// Returns `(Http1ListenerConfig, Http1Config)` — the listener-level config
    /// (max connections, drain timeout) and per-connection HTTP config (headers
    /// size, body size, idle timeout, keep-alive limits).
    pub fn to_h1_configs(&self) -> (Http1ListenerConfig, Http1Config) {
        let http_config = Http1Config::default()
            .max_headers_size(self.max_headers_size)
            .max_body_size(self.max_body_size)
            .idle_timeout(self.idle_timeout)
            .max_requests(self.max_requests_per_connection);

        let listener_config = Http1ListenerConfig::default()
            .http_config(http_config.clone())
            .max_connections(self.max_connections)
            .drain_timeout(self.drain_timeout);

        (listener_config, http_config)
    }
}

// ── HttpServer ──────────────────────────────────────────────────────────────

/// GenServer-native HTTP server.
///
/// Binds a TCP listener, accepts connections, and dispatches requests
/// through the provided Router. Each connection is handled by asupersync's
/// Http1Server.
///
/// # Example
///
/// ```ignore
/// use ava_web::{HttpServer, Router, get};
///
/// let app = Router::new()
///     .route("/", get(FnHandler::new(|| "Hello!")));
///
/// HttpServer::bind("127.0.0.1:3000")
///     .await?
///     .serve(app)
///     .await?;
/// ```
pub struct HttpServer {
    tcp_listener: asupersync::net::tcp::listener::TcpListener,
    addr: SocketAddr,
    config: ServerConfig,
    shutdown_signal: ShutdownSignal,
}

impl HttpServer {
    /// Bind to an address.
    ///
    /// Binds the TCP listener immediately so `local_addr()` returns the
    /// actual bound address (including the ephemeral port when binding to
    /// `:0`). Call `.serve(router)` or `.serve_on(router, handle)` to
    /// begin accepting connections.
    ///
    /// A `ShutdownSignal` is created at bind time. Retrieve it via
    /// [`shutdown_signal()`](Self::shutdown_signal) before moving `self`
    /// into `serve_on`.
    pub async fn bind<A: ToSocketAddrs + Send + 'static>(addr: A) -> io::Result<Self> {
        let tcp_listener = asupersync::net::tcp::listener::TcpListener::bind(addr).await?;
        let addr = tcp_listener.local_addr()?;
        Ok(Self {
            tcp_listener,
            addr,
            config: ServerConfig::default(),
            shutdown_signal: ShutdownSignal::new(),
        })
    }

    /// Set the server configuration.
    #[must_use]
    pub fn config(mut self, config: ServerConfig) -> Self {
        self.config = config;
        self
    }

    /// Get the bound address.
    #[must_use]
    pub fn local_addr(&self) -> SocketAddr {
        self.addr
    }

    /// Returns a clone of the shutdown signal.
    ///
    /// Use this to trigger graceful shutdown from outside the serve loop:
    ///
    /// ```ignore
    /// let signal = server.shutdown_signal();
    /// // In another task:
    /// signal.begin_drain(Duration::from_secs(30));
    /// ```
    #[must_use]
    pub fn shutdown_signal(&self) -> ShutdownSignal {
        self.shutdown_signal.clone()
    }

    /// Start serving requests using the provided router (blocking).
    ///
    /// Creates an asupersync `Runtime` internally and blocks the calling
    /// thread until the server shuts down.
    ///
    /// # Example
    ///
    /// ```ignore
    /// HttpServer::bind("127.0.0.1:3000")
    ///     .await?
    ///     .serve(app)?;
    /// ```
    pub fn serve(self, router: Router) -> io::Result<()> {
        use asupersync::runtime::RuntimeBuilder;

        let runtime = RuntimeBuilder::current_thread()
            .build()
            .map_err(|e| io::Error::other(format!("failed to build runtime: {e}")))?;
        let handle = runtime.handle();

        runtime.block_on(async move {
            self.serve_on(router, &handle).await
        })
    }

    /// Start serving requests on an existing asupersync runtime.
    ///
    /// This is the async entry point. It:
    /// 1. Binds a TCP listener via asupersync
    /// 2. Creates an `Http1Listener` with a handler closure that bridges
    ///    h1 protocol types to the web framework's Router
    /// 3. Runs the accept loop until shutdown
    ///
    /// The `RuntimeHandle` is required because `Http1Listener::run()`
    /// spawns per-connection tasks on the runtime.
    pub async fn serve_on(
        self,
        router: Router,
        runtime: &RuntimeHandle,
    ) -> io::Result<()> {
        let router = Arc::new(router);
        let addr = self.addr;
        let (listener_config, _) = self.config.to_h1_configs();

        tracing::info!(%addr, "ava-web server starting");

        // Build the handler closure that bridges h1 types to our web types.
        // The router Arc is moved into the closure and cloned per-invocation.
        //
        // PERF: Uses convert_h1_request_owned (not convert_h1_to_web) to take
        // ownership of the h1::Request. This eliminates:
        // - Body memcpy: Vec<u8> → Bytes is O(1) pointer move, not O(n) copy
        // - Header string clones: String → Cow::Owned is a discriminant write
        // - URI clone: direct ownership transfer
        let handler = {
            let router = Arc::clone(&router);
            move |h1_req: h1::Request| {
                let router = Arc::clone(&router);
                async move {
                    // Bridge h1 -> web (zero-copy ownership transfer)
                    let web_req = convert_h1_request_owned(h1_req);

                    // Dispatch through router
                    let web_resp = router.handle(web_req).await;

                    // Bridge web -> h1
                    let (status, headers, body) = convert_web_to_h1(web_resp);
                    let reason = h1::default_reason(status);
                    let mut resp = h1::Response::new(status, reason, body);
                    resp.headers = headers;
                    resp
                }
            }
        };

        // Create the Http1Listener from our already-bound TCP listener.
        // This avoids a second bind and ensures local_addr() is accurate.
        let listener = Http1Listener::from_listener(
            self.tcp_listener,
            handler,
            listener_config,
        );

        // Propagate our shutdown signal into the listener's signal.
        // The Http1Listener creates its own ShutdownSignal internally;
        // we bridge our external signal to it.
        let listener_shutdown = listener.shutdown_signal();
        let our_shutdown = self.shutdown_signal.clone();

        if our_shutdown.is_shutting_down() {
            // Already shutting down — propagate immediately
            let _ = listener_shutdown.begin_drain(self.config.drain_timeout);
        } else {
            // Spawn a watcher task that propagates shutdown
            let drain_timeout = self.config.drain_timeout;
            let _ = runtime.try_spawn(async move {
                let mut rx = our_shutdown.subscribe();
                rx.wait().await;
                let _ = listener_shutdown.begin_drain(drain_timeout);
            });
        }

        tracing::info!(%addr, "ava-web server listening");

        // Run the accept loop — blocks until shutdown completes
        let stats = listener.run(runtime).await?;

        tracing::info!(
            %addr,
            drained = stats.drained,
            force_closed = stats.force_closed,
            "ava-web server stopped"
        );

        Ok(())
    }
}

// ── Type Bridge ─────────────────────────────────────────────────────────────

/// Convert an asupersync h1::Request into our web::Request (borrowing variant).
///
/// This is the borrowing API — useful for tests and benchmarks where the caller
/// retains ownership of the h1 request fields. For the hot path in `serve_on`,
/// use [`convert_h1_request_owned`] which takes ownership and avoids copies.
pub fn convert_h1_to_web(
    method: &str,
    uri: &str,
    headers: &[(String, String)],
    body: &[u8],
    peer_addr: Option<SocketAddr>,
) -> WebRequest {
    // Parse URI into path and query
    let (path, query) = uri.split_once('?').map_or_else(
        || (uri.to_string(), None),
        |(p, q)| (p.to_string(), Some(q.to_string())),
    );

    let mut header_map = crate::extractor::HeaderMap::with_capacity(headers.len());
    for (name, value) in headers {
        header_map.insert(name.to_lowercase(), value.clone());
    }

    let mut req = WebRequest {
        method: crate::extractor::Method::from(method),
        path,
        query,
        headers: header_map,
        body: Bytes::copy_from_slice(body),
        path_params: HashMap::new(),
        extensions: crate::extractor::Extensions::new(),
    };

    if let Some(addr) = peer_addr {
        req.extensions.insert(ConnectInfo(addr));
    }

    req
}

/// Convert an asupersync h1::Request into our web::Request (owning variant).
///
/// # Zero-copy design
///
/// Takes the h1::Request by value to transfer ownership of heap allocations:
///
/// - **Body (`Vec<u8>` → `Bytes`)**: `Bytes::from(vec)` is O(1) — it takes
///   ownership of the `Vec`'s allocation with no memcpy. This is the critical
///   optimization: a 1MB POST body that was previously copied byte-by-byte is
///   now a pointer/length/capacity move.
///
/// - **Headers (`Vec<(String, String)>`)**: Each header `String` is moved into
///   `Cow::Owned(String)` via `Cow::from(string)` — no allocation, just a
///   discriminant write. The `to_lowercase()` on the name is unavoidable (HTTP
///   header names are case-insensitive, our HeaderMap is case-sensitive), but
///   we lowercase in-place when possible using `String::make_ascii_lowercase`.
///
/// - **URI (String → String)**: Direct ownership transfer for path; only the
///   `split_once` for query separation requires work.
///
/// - **Method**: Enum conversion is always O(1) for standard methods.
pub fn convert_h1_request_owned(h1_req: h1::Request) -> WebRequest {
    // Parse URI into path and query — we own the String, so split in-place
    let (path, query) = match h1_req.uri.find('?') {
        Some(pos) => {
            let query = h1_req.uri[pos + 1..].to_string();
            let mut path = h1_req.uri;
            path.truncate(pos);
            (path, Some(query))
        }
        None => (h1_req.uri, None),
    };

    // Transfer header ownership: String → Cow::Owned(String), no allocation.
    // Only the to_lowercase on the name is unavoidable work.
    let mut header_map = crate::extractor::HeaderMap::with_capacity(h1_req.headers.len());
    for (mut name, value) in h1_req.headers {
        // In-place ASCII lowercasing avoids a new String allocation.
        // HTTP header names are ASCII-only per RFC 7230 §3.2.6.
        name.make_ascii_lowercase();
        header_map.insert(
            std::borrow::Cow::Owned(name),
            std::borrow::Cow::Owned(value),
        );
    }

    // Zero-copy body transfer: Vec<u8> → Bytes is O(1) ownership move.
    // Bytes::from(Vec<u8>) takes the Vec's heap allocation without copying.
    let body = Bytes::from(h1_req.body);

    let mut req = WebRequest {
        method: crate::extractor::Method::from(h1_req.method.as_str()),
        path,
        query,
        headers: header_map,
        body,
        path_params: HashMap::new(),
        extensions: crate::extractor::Extensions::new(),
    };

    if let Some(addr) = h1_req.peer_addr {
        req.extensions.insert(ConnectInfo(addr));
    }

    req
}

/// Convert our web::Response back to h1 protocol response parts.
///
/// # Allocation analysis
///
/// - **Headers**: `HeaderMap::into_iter()` yields `(String, String)` via
///   `Cow::into_owned()` — if the Cow was `Owned` (the common case for
///   response headers set via `.header("name", value)`), this is a no-op move.
///   Static `&'static str` Cows require a String allocation.
///
/// - **Body**: `Bytes::into()` → `Vec<u8>`. When the `Bytes` is the sole
///   owner of a `Vec<u8>` backing (which is the case for `Bytes::from(Vec<u8>)`
///   and `Bytes::from(String)`), the `bytes` crate can sometimes reclaim the
///   Vec without copying. We use `Vec::from(bytes)` which the `bytes` crate
///   implements as a zero-copy path when possible, falling back to copy when
///   the Bytes is shared or a slice.
pub fn convert_web_to_h1(resp: WebResponse) -> (u16, Vec<(String, String)>, Vec<u8>) {
    let status = resp.status.as_u16();
    let headers: Vec<(String, String)> = resp.headers.into_iter().collect();
    // Vec::from(Bytes) uses the bytes crate's optimized path:
    // if the Bytes uniquely owns a Vec<u8>, this is O(1) ownership transfer.
    // Otherwise it copies — but that's the best we can do without restructuring
    // the entire response pipeline to use Vec<u8> natively.
    let body = Vec::from(resp.body);
    (status, headers, body)
}

/// Peer address information injected by the server.
#[derive(Debug, Clone, Copy)]
pub struct ConnectInfo(pub SocketAddr);

#[cfg(test)]
mod tests {
    use super::*;
    use crate::handler::FnHandler;
    use crate::router::get;

    #[test]
    fn convert_h1_to_web_basic() {
        let req = convert_h1_to_web(
            "GET",
            "/users?page=1",
            &[("content-type".into(), "application/json".into())],
            b"",
            None,
        );
        assert_eq!(req.method, "GET"); // Method implements PartialEq<&str>
        assert_eq!(req.path, "/users");
        assert_eq!(req.query.as_deref(), Some("page=1"));
        assert_eq!(req.headers.get("content-type").unwrap(), "application/json");
    }

    #[test]
    fn convert_web_to_h1_basic() {
        let resp = WebResponse::new(StatusCode::OK, Bytes::from_static(b"hello"))
            .header("content-type", "text/plain");
        let (status, headers, body) = convert_web_to_h1(resp);
        assert_eq!(status, 200);
        assert_eq!(body, b"hello");
        assert!(headers.iter().any(|(k, v)| k == "content-type" && v == "text/plain"));
    }

    #[test]
    fn server_config_to_h1_config_conversion() {
        let config = ServerConfig::default();
        let (listener_config, http_config) = config.to_h1_configs();
        assert_eq!(listener_config.max_connections, Some(10_000));
        assert_eq!(listener_config.drain_timeout, Duration::from_secs(30));
        assert_eq!(http_config.max_headers_size, 64 * 1024);
        assert_eq!(http_config.max_body_size, 16 * 1024 * 1024);
        assert_eq!(http_config.idle_timeout, Some(Duration::from_secs(60)));
        assert_eq!(http_config.max_requests_per_connection, Some(1000));
    }

    #[test]
    fn server_config_custom_to_h1_config() {
        let config = ServerConfig {
            max_connections: Some(500),
            idle_timeout: Some(Duration::from_secs(30)),
            max_requests_per_connection: Some(100),
            max_headers_size: 8 * 1024,
            max_body_size: 1024 * 1024,
            drain_timeout: Duration::from_secs(5),
        };
        let (listener_config, http_config) = config.to_h1_configs();
        assert_eq!(listener_config.max_connections, Some(500));
        assert_eq!(listener_config.drain_timeout, Duration::from_secs(5));
        assert_eq!(http_config.max_headers_size, 8 * 1024);
        assert_eq!(http_config.max_body_size, 1024 * 1024);
        assert_eq!(http_config.idle_timeout, Some(Duration::from_secs(30)));
        assert_eq!(http_config.max_requests_per_connection, Some(100));
    }

    #[test]
    fn serve_with_immediate_shutdown() {
        use asupersync::runtime::RuntimeBuilder;

        let router = Router::new()
            .route("/", get(FnHandler::new(|| "Hello")));

        let runtime = RuntimeBuilder::current_thread()
            .build()
            .expect("build runtime");
        let handle = runtime.handle();

        runtime.block_on(async {
            let server = HttpServer::bind("127.0.0.1:0")
                .await
                .expect("bind failed");

            let shutdown_signal = server.shutdown_signal();

            let h = handle.clone();
            let serve_handle = handle.try_spawn(async move {
                server.serve_on(router, &h).await
            }).expect("spawn serve");

            // Immediately trigger shutdown
            let _ = shutdown_signal.begin_drain(Duration::from_millis(100));

            let result: io::Result<()> = serve_handle.await;
            assert!(result.is_ok(), "serve should return Ok on clean shutdown");
        });
    }

    #[test]
    fn serve_accepts_single_request() {
        use asupersync::runtime::RuntimeBuilder;
        use asupersync::io::AsyncWriteExt;

        let router = Router::new()
            .route("/hello", get(FnHandler::new(|| "world")));

        let runtime = RuntimeBuilder::current_thread()
            .build()
            .expect("build runtime");
        let rt_handle = runtime.handle();

        runtime.block_on(async {
            let server = HttpServer::bind("127.0.0.1:0")
                .await
                .expect("bind failed");
            let addr = server.local_addr();
            let shutdown_signal = server.shutdown_signal();

            let h = rt_handle.clone();
            let serve_handle = rt_handle.try_spawn(async move {
                server.serve_on(router, &h).await
            }).expect("spawn serve");

            // Yield to let the serve task start its accept loop
            asupersync::runtime::yield_now().await;

            // Connect and send a request
            let mut client = asupersync::net::tcp::stream::TcpStream::connect(addr)
                .await
                .expect("connect");

            client.write_all(
                b"GET /hello HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n"
            ).await.expect("write");

            // Read response using read_to_end (connection will close due to Connection: close)
            let mut buf = Vec::new();
            asupersync::io::AsyncReadExt::read_to_end(&mut client, &mut buf)
                .await
                .expect("read");
            let response = String::from_utf8_lossy(&buf);

            assert!(response.contains("200"), "expected 200 OK, got: {response}");
            assert!(response.contains("world"), "expected body 'world', got: {response}");

            // Shutdown
            let _ = shutdown_signal.begin_drain(Duration::from_millis(100));
            let result: io::Result<()> = serve_handle.await;
            assert!(result.is_ok());
        });
    }
}
