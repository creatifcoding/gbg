//! Test harness for ava-web applications.
//!
//! Provides [`TestServer`] for integration testing with a fluent
//! request-building API and rich assertion helpers. No real networking —
//! requests are routed directly through the [`Router`].
//!
//! # Example
//!
//! ```ignore
//! use ava_web::testing::TestServer;
//! use ava_web::{Router, get};
//!
//! fn hello() -> &'static str { "hello" }
//!
//! let server = TestServer::new(Router::new().route("/", get(hello)));
//! let resp = server.get("/").send();
//! resp.assert_status(200);
//! resp.assert_body_text("hello");
//! ```

use std::future::Future;
use std::pin::Pin;
use std::task::{Context, Poll, RawWaker, RawWakerVTable, Waker};

use bytes::Bytes;

use crate::extractor::Request;
use crate::response::Response;
use crate::router::Router;

// ── Block-on helper ──────────────────────────────────────────────────────────

/// Minimal single-poll executor for futures that resolve immediately.
///
/// All ava-web handlers are sync or immediately-ready async, so a
/// single poll is sufficient.
fn block_on<F: Future>(mut fut: F) -> F::Output {
    fn noop(_: *const ()) {}
    fn noop_clone(_: *const ()) -> RawWaker {
        RawWaker::new(std::ptr::null(), &VTABLE)
    }
    static VTABLE: RawWakerVTable = RawWakerVTable::new(noop_clone, noop, noop, noop);
    let waker = unsafe { Waker::from_raw(RawWaker::new(std::ptr::null(), &VTABLE)) };
    let mut cx = Context::from_waker(&waker);
    // SAFETY: we never move the future after pinning.
    let pinned = unsafe { Pin::new_unchecked(&mut fut) };
    match pinned.poll(&mut cx) {
        Poll::Ready(val) => val,
        Poll::Pending => panic!("block_on: future returned Pending — handlers must resolve immediately"),
    }
}

// ── TestServer ───────────────────────────────────────────────────────────────

/// A test server that wraps a [`Router`] for integration testing.
///
/// Routes requests directly through the router — no TCP sockets, no
/// ports, no flakiness. Build requests with a fluent API and assert
/// against the response.
pub struct TestServer {
    router: Router,
}

impl TestServer {
    /// Create a test server from a configured router.
    pub fn new(router: Router) -> Self {
        Self { router }
    }

    /// Start building a GET request.
    pub fn get(&self, path: &str) -> TestRequest<'_> {
        self.request("GET", path)
    }

    /// Start building a POST request.
    pub fn post(&self, path: &str) -> TestRequest<'_> {
        self.request("POST", path)
    }

    /// Start building a PUT request.
    pub fn put(&self, path: &str) -> TestRequest<'_> {
        self.request("PUT", path)
    }

    /// Start building a DELETE request.
    pub fn delete(&self, path: &str) -> TestRequest<'_> {
        self.request("DELETE", path)
    }

    /// Start building a PATCH request.
    pub fn patch(&self, path: &str) -> TestRequest<'_> {
        self.request("PATCH", path)
    }

    /// Start building a request with an arbitrary HTTP method.
    pub fn request(&self, method: &str, path: &str) -> TestRequest<'_> {
        TestRequest {
            server: self,
            method: crate::extractor::Method::from(method),
            path: path.to_string(),
            headers: crate::extractor::HeaderMap::new(),
            body: None,
            query: None,
        }
    }
}

// ── TestRequest ──────────────────────────────────────────────────────────────

/// Fluent request builder for [`TestServer`].
pub struct TestRequest<'a> {
    server: &'a TestServer,
    method: crate::extractor::Method,
    path: String,
    headers: crate::extractor::HeaderMap,
    body: Option<Bytes>,
    query: Option<String>,
}

impl<'a> TestRequest<'a> {
    /// Add a header.
    pub fn header(mut self, name: &str, value: &str) -> Self {
        self.headers.insert(name.to_string(), value.to_string());
        self
    }

    /// Set JSON body (auto-sets `Content-Type: application/json`).
    pub fn json(self, value: &impl serde::Serialize) -> Self {
        let body = serde_json::to_vec(value).expect("TestRequest::json: serialization failed");
        self.header("content-type", "application/json")
            .body(body)
    }

    /// Set raw body bytes.
    pub fn body(mut self, body: impl Into<Bytes>) -> Self {
        self.body = Some(body.into());
        self
    }

    /// Set query string (without the leading `?`).
    pub fn query(mut self, query: &str) -> Self {
        self.query = Some(query.to_string());
        self
    }

    /// Set the `Content-Type` header.
    pub fn content_type(self, ct: &str) -> Self {
        self.header("content-type", ct)
    }

    /// Set an `Authorization: Bearer <token>` header.
    pub fn bearer(self, token: &str) -> Self {
        self.header("authorization", &format!("Bearer {token}"))
    }

    /// Execute the request and return the response.
    pub fn send(self) -> TestResponse {
        let mut req = Request::new(self.method, &self.path);

        for (k, v) in self.headers {
            req = req.with_header(k, v);
        }

        if let Some(body) = self.body {
            req = req.with_body(body);
        }

        if let Some(query) = self.query {
            req = req.with_query(query);
        }

        let response = block_on(self.server.router.handle(req));
        TestResponse { response }
    }
}

// ── TestResponse ─────────────────────────────────────────────────────────────

/// Response wrapper with assertion helpers for testing.
///
/// All assertion methods return `&Self` for chaining.
pub struct TestResponse {
    /// The underlying response.
    pub response: Response,
}

impl TestResponse {
    // ── Status assertions ────────────────────────────────────────────────

    /// Assert the response has the given status code.
    pub fn assert_status(&self, expected: u16) -> &Self {
        let actual = self.response.status.as_u16();
        assert_eq!(
            actual, expected,
            "expected status {expected}, got {actual}"
        );
        self
    }

    /// Assert 2xx success status.
    pub fn assert_ok(&self) -> &Self {
        let code = self.response.status.as_u16();
        assert!(
            self.response.status.is_success(),
            "expected 2xx success, got {code}"
        );
        self
    }

    /// Assert 201 Created.
    pub fn assert_created(&self) -> &Self {
        self.assert_status(201)
    }

    /// Assert 204 No Content.
    pub fn assert_no_content(&self) -> &Self {
        self.assert_status(204)
    }

    /// Assert 404 Not Found.
    pub fn assert_not_found(&self) -> &Self {
        self.assert_status(404)
    }

    /// Assert 400 Bad Request.
    pub fn assert_bad_request(&self) -> &Self {
        self.assert_status(400)
    }

    /// Assert 401 Unauthorized.
    pub fn assert_unauthorized(&self) -> &Self {
        self.assert_status(401)
    }

    /// Assert 500 Internal Server Error.
    pub fn assert_internal_error(&self) -> &Self {
        self.assert_status(500)
    }

    // ── Header assertions ────────────────────────────────────────────────

    /// Assert a header exists with the given exact value.
    pub fn assert_header(&self, name: &str, value: &str) -> &Self {
        let actual = self.response.headers.get(name);
        assert_eq!(
            actual,
            Some(value),
            "expected header '{name}' = '{value}', got {:?}",
            actual
        );
        self
    }

    /// Assert a header exists (any value).
    pub fn assert_header_exists(&self, name: &str) -> &Self {
        assert!(
            self.response.headers.contains_key(name),
            "expected header '{name}' to exist, but it was absent"
        );
        self
    }

    /// Assert the `Content-Type` header.
    pub fn assert_content_type(&self, ct: &str) -> &Self {
        self.assert_header("content-type", ct)
    }

    /// Assert `Content-Type: application/json`.
    pub fn assert_json_content_type(&self) -> &Self {
        self.assert_content_type("application/json")
    }

    // ── Body assertions ──────────────────────────────────────────────────

    /// Assert the body equals the exact text.
    pub fn assert_body_text(&self, expected: &str) -> &Self {
        let actual = self.text();
        assert_eq!(
            actual, expected,
            "expected body text '{expected}', got '{actual}'"
        );
        self
    }

    /// Assert the body contains the given substring.
    pub fn assert_body_contains(&self, substring: &str) -> &Self {
        let body = self.text();
        assert!(
            body.contains(substring),
            "expected body to contain '{substring}', but body was '{body}'"
        );
        self
    }

    /// Assert the body is empty.
    pub fn assert_body_empty(&self) -> &Self {
        assert!(
            self.response.body.is_empty(),
            "expected empty body, got {} bytes: '{}'",
            self.response.body.len(),
            self.text()
        );
        self
    }

    /// Parse the body as JSON.
    ///
    /// # Panics
    ///
    /// Panics if the body is not valid JSON or cannot be deserialized
    /// into `T`.
    pub fn json<T: serde::de::DeserializeOwned>(&self) -> T {
        serde_json::from_slice(&self.response.body).unwrap_or_else(|e| {
            panic!(
                "failed to parse response body as JSON: {e}\nbody: '{}'",
                self.text()
            )
        })
    }

    /// Assert the JSON body equals the given value.
    pub fn assert_json(&self, expected: &serde_json::Value) -> &Self {
        let actual: serde_json::Value = self.json();
        assert_eq!(
            actual, *expected,
            "JSON body mismatch:\n  expected: {expected}\n  actual:   {actual}"
        );
        self
    }

    /// Assert the JSON body contains the given key at the top level.
    pub fn assert_json_key(&self, key: &str) -> &Self {
        let val: serde_json::Value = self.json();
        assert!(
            val.get(key).is_some(),
            "expected JSON body to contain key '{key}', but it was absent.\nbody: {val}"
        );
        self
    }

    // ── Accessors ────────────────────────────────────────────────────────

    /// Get the status code as a u16.
    pub fn status(&self) -> u16 {
        self.response.status.as_u16()
    }

    /// Get a header value.
    pub fn header(&self, name: &str) -> Option<&str> {
        self.response.headers.get(name)
    }

    /// Get the body as a UTF-8 string.
    pub fn text(&self) -> String {
        String::from_utf8_lossy(&self.response.body).into_owned()
    }

    /// Get the raw body bytes.
    pub fn bytes(&self) -> &[u8] {
        &self.response.body
    }
}

// ── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;
    use crate::handler::{FnHandler, FnHandler1};
    use crate::middleware::{Cors, Middleware, Next};
    use crate::response::StatusCode;
    use crate::router::{get, post, put, delete, patch};
    use crate::extractor::{Json as ExtractJson, State};

    // ── Handler helpers ──────────────────────────────────────────────────

    fn hello() -> &'static str {
        "hello"
    }

    fn no_content_handler() -> StatusCode {
        StatusCode::NO_CONTENT
    }

    fn json_handler() -> crate::response::Json<serde_json::Value> {
        crate::response::Json(serde_json::json!({"status": "ok", "count": 42}))
    }

    // ── 1. Basic routing ─────────────────────────────────────────────────

    #[test]
    fn test_get_request() {
        let server = TestServer::new(
            Router::new().route("/hello", get(FnHandler::new(hello))),
        );
        let resp = server.get("/hello").send();
        resp.assert_status(200);
        resp.assert_body_text("hello");
    }

    #[test]
    fn test_post_request() {
        fn handle_post() -> StatusCode {
            StatusCode::CREATED
        }
        let server = TestServer::new(
            Router::new().route("/items", post(FnHandler::new(handle_post))),
        );
        let resp = server.post("/items").send();
        resp.assert_created();
    }

    #[test]
    fn test_put_request() {
        fn handle_put() -> &'static str {
            "updated"
        }
        let server = TestServer::new(
            Router::new().route("/items", put(FnHandler::new(handle_put))),
        );
        let resp = server.put("/items").send();
        resp.assert_ok();
        resp.assert_body_text("updated");
    }

    #[test]
    fn test_delete_request() {
        let server = TestServer::new(
            Router::new().route("/items", delete(FnHandler::new(no_content_handler))),
        );
        let resp = server.delete("/items").send();
        resp.assert_no_content();
    }

    #[test]
    fn test_patch_request() {
        fn handle_patch() -> &'static str {
            "patched"
        }
        let server = TestServer::new(
            Router::new().route("/items", patch(FnHandler::new(handle_patch))),
        );
        let resp = server.patch("/items").send();
        resp.assert_ok();
        resp.assert_body_text("patched");
    }

    #[test]
    fn test_custom_method() {
        let server = TestServer::new(
            Router::new().route("/hello", get(FnHandler::new(hello))),
        );
        let resp = server.request("GET", "/hello").send();
        resp.assert_status(200);
        resp.assert_body_text("hello");
    }

    // ── 2. JSON request/response ─────────────────────────────────────────

    #[test]
    fn test_json_request_body() {
        #[derive(Debug, serde::Deserialize)]
        struct Input {
            name: String,
        }

        fn handle_json(ExtractJson(input): ExtractJson<Input>) -> String {
            format!("hello, {}", input.name)
        }

        let server = TestServer::new(
            Router::new().route("/greet", post(FnHandler1::<_, ExtractJson<Input>>::new(handle_json))),
        );

        let resp = server
            .post("/greet")
            .json(&serde_json::json!({"name": "alice"}))
            .send();

        resp.assert_ok();
        resp.assert_body_text("hello, alice");
    }

    #[test]
    fn test_json_response_parsing() {
        let server = TestServer::new(
            Router::new().route("/data", get(FnHandler::new(json_handler))),
        );

        let resp = server.get("/data").send();
        resp.assert_ok();
        resp.assert_json_content_type();

        let body: serde_json::Value = resp.json();
        assert_eq!(body["status"], "ok");
        assert_eq!(body["count"], 42);
    }

    #[test]
    fn test_assert_json_value() {
        let server = TestServer::new(
            Router::new().route("/data", get(FnHandler::new(json_handler))),
        );

        let resp = server.get("/data").send();
        resp.assert_json(&serde_json::json!({"status": "ok", "count": 42}));
    }

    #[test]
    fn test_assert_json_key() {
        let server = TestServer::new(
            Router::new().route("/data", get(FnHandler::new(json_handler))),
        );

        let resp = server.get("/data").send();
        resp.assert_json_key("status");
        resp.assert_json_key("count");
    }

    // ── 3. Query string ──────────────────────────────────────────────────

    #[test]
    fn test_query_string() {
        fn handle_query(
            crate::extractor::Query(params): crate::extractor::Query<HashMap<String, String>>,
        ) -> String {
            format!(
                "page={},sort={}",
                params.get("page").unwrap_or(&"?".into()),
                params.get("sort").unwrap_or(&"?".into()),
            )
        }

        let server = TestServer::new(
            Router::new().route(
                "/items",
                get(FnHandler1::<_, crate::extractor::Query<HashMap<String, String>>>::new(handle_query)),
            ),
        );

        let resp = server.get("/items").query("page=2&sort=name").send();
        resp.assert_ok();
        resp.assert_body_text("page=2,sort=name");
    }

    // ── 4. Header assertions ─────────────────────────────────────────────

    #[test]
    fn test_request_header_sent() {
        fn echo_auth(headers: HashMap<String, String>) -> String {
            headers.get("authorization").cloned().unwrap_or_default()
        }

        let server = TestServer::new(
            Router::new().route(
                "/auth",
                get(FnHandler1::<_, HashMap<String, String>>::new(echo_auth)),
            ),
        );

        let resp = server
            .get("/auth")
            .bearer("my-token")
            .send();

        resp.assert_ok();
        resp.assert_body_text("Bearer my-token");
    }

    #[test]
    fn test_content_type_shortcut() {
        fn echo_ct(headers: HashMap<String, String>) -> String {
            headers.get("content-type").cloned().unwrap_or_default()
        }

        let server = TestServer::new(
            Router::new().route(
                "/ct",
                post(FnHandler1::<_, HashMap<String, String>>::new(echo_ct)),
            ),
        );

        let resp = server
            .post("/ct")
            .content_type("text/xml")
            .body("data")
            .send();

        resp.assert_ok();
        resp.assert_body_text("text/xml");
    }

    #[test]
    fn test_assert_header_value() {
        fn with_header() -> Response {
            Response::new(StatusCode::OK, Bytes::from_static(b"ok"))
                .header("x-custom", "test-value")
        }

        let server = TestServer::new(
            Router::new().route("/h", get(FnHandler::new(with_header))),
        );

        let resp = server.get("/h").send();
        resp.assert_header("x-custom", "test-value");
        resp.assert_header_exists("x-custom");
    }

    // ── 5. Status code assertions ────────────────────────────────────────

    #[test]
    fn test_assert_ok_range() {
        let server = TestServer::new(
            Router::new().route("/ok", get(FnHandler::new(hello))),
        );
        let resp = server.get("/ok").send();
        resp.assert_ok();
    }

    #[test]
    fn test_assert_not_found() {
        let server = TestServer::new(Router::new());
        let resp = server.get("/nope").send();
        resp.assert_not_found();
    }

    #[test]
    fn test_assert_bad_request() {
        fn bad() -> (StatusCode, &'static str) {
            (StatusCode::BAD_REQUEST, "bad input")
        }
        let server = TestServer::new(
            Router::new().route("/bad", get(FnHandler::new(bad))),
        );
        let resp = server.get("/bad").send();
        resp.assert_bad_request();
    }

    #[test]
    fn test_assert_unauthorized() {
        fn unauth() -> StatusCode {
            StatusCode::UNAUTHORIZED
        }
        let server = TestServer::new(
            Router::new().route("/secret", get(FnHandler::new(unauth))),
        );
        let resp = server.get("/secret").send();
        resp.assert_unauthorized();
    }

    #[test]
    fn test_assert_internal_error() {
        fn err() -> StatusCode {
            StatusCode::INTERNAL_SERVER_ERROR
        }
        let server = TestServer::new(
            Router::new().route("/err", get(FnHandler::new(err))),
        );
        let resp = server.get("/err").send();
        resp.assert_internal_error();
    }

    // ── 6. Body assertions ───────────────────────────────────────────────

    #[test]
    fn test_assert_body_contains() {
        fn long_text() -> &'static str {
            "the quick brown fox jumps over the lazy dog"
        }
        let server = TestServer::new(
            Router::new().route("/text", get(FnHandler::new(long_text))),
        );
        let resp = server.get("/text").send();
        resp.assert_body_contains("quick brown fox");
        resp.assert_body_contains("lazy dog");
    }

    #[test]
    fn test_assert_body_empty() {
        let server = TestServer::new(
            Router::new().route("/empty", get(FnHandler::new(no_content_handler))),
        );
        let resp = server.get("/empty").send();
        resp.assert_body_empty();
    }

    #[test]
    fn test_body_accessors() {
        let server = TestServer::new(
            Router::new().route("/hello", get(FnHandler::new(hello))),
        );
        let resp = server.get("/hello").send();
        assert_eq!(resp.text(), "hello");
        assert_eq!(resp.bytes(), b"hello");
        assert_eq!(resp.status(), 200);
    }

    // ── 7. Middleware integration ─────────────────────────────────────────

    #[test]
    fn test_server_with_cors_middleware() {
        let server = TestServer::new(
            Router::new()
                .route("/api", get(FnHandler::new(hello)))
                .layer(Cors::default()),
        );

        let resp = server.get("/api").send();
        resp.assert_ok();
        resp.assert_header("access-control-allow-origin", "*");
        resp.assert_header_exists("access-control-allow-methods");
    }

    #[test]
    fn test_server_with_custom_middleware() {
        struct PrefixMiddleware;

        impl Middleware for PrefixMiddleware {
            fn handle<'a>(
                &'a self,
                req: Request,
                next: Next<'a>,
            ) -> Pin<Box<dyn Future<Output = Response> + Send + 'a>> {
                Box::pin(async move {
                    let mut resp = next.run(req).await;
                    let body = format!("[wrapped]{}", String::from_utf8_lossy(&resp.body));
                    resp.body = Bytes::from(body);
                    resp
                })
            }
        }

        let server = TestServer::new(
            Router::new()
                .route("/hello", get(FnHandler::new(hello)))
                .layer(PrefixMiddleware),
        );

        let resp = server.get("/hello").send();
        resp.assert_ok();
        resp.assert_body_text("[wrapped]hello");
    }

    // ── 8. State injection ───────────────────────────────────────────────

    #[test]
    fn test_server_with_state() {
        #[derive(Debug, Clone)]
        struct AppState {
            name: String,
        }

        fn state_handler(State(state): State<AppState>) -> String {
            format!("app:{}", state.name)
        }

        let server = TestServer::new(
            Router::new()
                .route(
                    "/state",
                    get(FnHandler1::<_, State<AppState>>::new(state_handler)),
                )
                .with_state(AppState {
                    name: "test-app".into(),
                }),
        );

        let resp = server.get("/state").send();
        resp.assert_ok();
        resp.assert_body_text("app:test-app");
    }

    // ── 9. Nested router ─────────────────────────────────────────────────

    #[test]
    fn test_nested_router() {
        fn api_hello() -> &'static str {
            "api-hello"
        }
        fn api_users() -> &'static str {
            "api-users"
        }

        let api = Router::new()
            .route("/hello", get(FnHandler::new(api_hello)))
            .route("/users", get(FnHandler::new(api_users)));

        let server = TestServer::new(Router::new().nest("/api", api));

        let resp = server.get("/api/hello").send();
        resp.assert_ok();
        resp.assert_body_text("api-hello");

        let resp = server.get("/api/users").send();
        resp.assert_ok();
        resp.assert_body_text("api-users");
    }

    // ── 10. Assertion failure messages ────────────────────────────────────

    #[test]
    #[should_panic(expected = "expected status 404, got 200")]
    fn test_status_assertion_panic_message() {
        let server = TestServer::new(
            Router::new().route("/ok", get(FnHandler::new(hello))),
        );
        server.get("/ok").send().assert_status(404);
    }

    #[test]
    #[should_panic(expected = "expected body text")]
    fn test_body_text_assertion_panic_message() {
        let server = TestServer::new(
            Router::new().route("/hello", get(FnHandler::new(hello))),
        );
        server.get("/hello").send().assert_body_text("world");
    }

    #[test]
    #[should_panic(expected = "expected body to contain")]
    fn test_body_contains_assertion_panic_message() {
        let server = TestServer::new(
            Router::new().route("/hello", get(FnHandler::new(hello))),
        );
        server.get("/hello").send().assert_body_contains("xyz");
    }

    #[test]
    #[should_panic(expected = "expected header")]
    fn test_header_assertion_panic_message() {
        let server = TestServer::new(
            Router::new().route("/hello", get(FnHandler::new(hello))),
        );
        server.get("/hello").send().assert_header("x-missing", "val");
    }

    #[test]
    #[should_panic(expected = "expected header 'x-nope' to exist")]
    fn test_header_exists_assertion_panic_message() {
        let server = TestServer::new(
            Router::new().route("/hello", get(FnHandler::new(hello))),
        );
        server.get("/hello").send().assert_header_exists("x-nope");
    }

    // ── Additional edge cases ────────────────────────────────────────────

    #[test]
    fn test_method_not_allowed() {
        let server = TestServer::new(
            Router::new().route("/get-only", get(FnHandler::new(hello))),
        );
        let resp = server.post("/get-only").send();
        resp.assert_status(405);
    }

    #[test]
    fn test_raw_body_bytes() {
        fn echo_body(crate::extractor::RawBody(body): crate::extractor::RawBody) -> Vec<u8> {
            body.to_vec()
        }

        let server = TestServer::new(
            Router::new().route(
                "/echo",
                post(FnHandler1::<_, crate::extractor::RawBody>::new(echo_body)),
            ),
        );

        let resp = server
            .post("/echo")
            .body(Bytes::from_static(b"\x00\x01\x02"))
            .send();

        resp.assert_ok();
        assert_eq!(resp.bytes(), &[0x00, 0x01, 0x02]);
    }

    #[test]
    fn test_response_chaining() {
        let server = TestServer::new(
            Router::new().route("/data", get(FnHandler::new(json_handler))),
        );

        // All assertions return &Self for chaining
        server
            .get("/data")
            .send()
            .assert_ok()
            .assert_json_content_type()
            .assert_json_key("status")
            .assert_json_key("count");
    }

    #[test]
    fn test_multiple_routes() {
        fn route_a() -> &'static str { "a" }
        fn route_b() -> &'static str { "b" }
        fn route_c() -> &'static str { "c" }

        let server = TestServer::new(
            Router::new()
                .route("/a", get(FnHandler::new(route_a)))
                .route("/b", get(FnHandler::new(route_b)))
                .route("/c", get(FnHandler::new(route_c))),
        );

        server.get("/a").send().assert_body_text("a");
        server.get("/b").send().assert_body_text("b");
        server.get("/c").send().assert_body_text("c");
    }

    #[test]
    fn test_path_params_through_router() {
        fn user_handler(crate::extractor::Path(id): crate::extractor::Path<String>) -> String {
            format!("user:{id}")
        }

        let server = TestServer::new(
            Router::new().route(
                "/users/{id}",
                get(FnHandler1::<_, crate::extractor::Path<String>>::new(user_handler)),
            ),
        );

        let resp = server.get("/users/42").send();
        resp.assert_ok();
        resp.assert_body_text("user:42");
    }

    #[test]
    fn test_multi_method_route() {
        fn get_items() -> &'static str { "list" }
        fn post_items() -> &'static str { "created" }

        let server = TestServer::new(
            Router::new().route(
                "/items",
                get(FnHandler::new(get_items)).post(FnHandler::new(post_items)),
            ),
        );

        server.get("/items").send().assert_body_text("list");
        server.post("/items").send().assert_body_text("created");
    }

    #[test]
    #[should_panic(expected = "expected 2xx success")]
    fn test_assert_ok_panics_on_error() {
        let server = TestServer::new(Router::new());
        server.get("/missing").send().assert_ok();
    }

    #[test]
    #[should_panic(expected = "expected empty body")]
    fn test_assert_body_empty_panics_on_content() {
        let server = TestServer::new(
            Router::new().route("/hello", get(FnHandler::new(hello))),
        );
        server.get("/hello").send().assert_body_empty();
    }

    #[test]
    fn test_header_accessor_returns_none_for_missing() {
        let server = TestServer::new(
            Router::new().route("/hello", get(FnHandler::new(hello))),
        );
        let resp = server.get("/hello").send();
        assert!(resp.header("x-nonexistent").is_none());
    }
}
