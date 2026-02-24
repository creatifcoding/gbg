//! HTTP router with matchit radix-tree dispatch.
//!
//! Uses the `matchit` crate for O(log n) path matching with parameters.

use std::collections::HashMap;
use std::future::Future;
use std::pin::Pin;

use crate::extractor::{Method, Request};
use crate::handler::{ErasedHandler, Handler};
use crate::middleware::{Middleware, Next};
use crate::response::{IntoResponse, Response, StatusCode};

// ── RouteId ─────────────────────────────────────────────────────────────────

type RouteId = u32;

// ── Route ───────────────────────────────────────────────────────────────────

struct Route {
    handlers: HashMap<Method, Box<dyn ErasedHandler>>,
}

impl Route {
    fn new() -> Self {
        Self {
            handlers: HashMap::with_capacity(4),
        }
    }

    fn insert(&mut self, method: Method, handler: Box<dyn ErasedHandler>) {
        self.handlers.insert(method, handler);
    }

    fn dispatch(&self, req: Request) -> Pin<Box<dyn Future<Output = Response> + Send + '_>> {
        if let Some(handler) = self.handlers.get(&req.method) {
            handler.call_erased(req)
        } else {
            // Check if the route exists but method is wrong
            if self.handlers.is_empty() {
                Box::pin(async { StatusCode::NOT_FOUND.into_response() })
            } else {
                let allowed: Vec<&str> = self.handlers.keys().map(|m| m.as_str()).collect();
                let allow_header = allowed.join(", ");
                Box::pin(async move {
                    Response::empty(StatusCode::METHOD_NOT_ALLOWED)
                        .header("allow", allow_header)
                })
            }
        }
    }
}

// ── MethodRouter ────────────────────────────────────────────────────────────

/// A set of handlers for different HTTP methods on a single route.
pub struct MethodRouter {
    handlers: HashMap<Method, Box<dyn ErasedHandler>>,
}

impl MethodRouter {
    fn new() -> Self {
        Self {
            handlers: HashMap::with_capacity(4),
        }
    }

    fn on(mut self, method: Method, handler: impl Handler) -> Self {
        self.handlers.insert(method, Box::new(handler));
        self
    }

    /// Register a GET handler.
    #[must_use]
    pub fn get(self, handler: impl Handler) -> Self {
        self.on(Method::GET, handler)
    }

    /// Register a POST handler.
    #[must_use]
    pub fn post(self, handler: impl Handler) -> Self {
        self.on(Method::POST, handler)
    }

    /// Register a PUT handler.
    #[must_use]
    pub fn put(self, handler: impl Handler) -> Self {
        self.on(Method::PUT, handler)
    }

    /// Register a DELETE handler.
    #[must_use]
    pub fn delete(self, handler: impl Handler) -> Self {
        self.on(Method::DELETE, handler)
    }

    /// Register a PATCH handler.
    #[must_use]
    pub fn patch(self, handler: impl Handler) -> Self {
        self.on(Method::PATCH, handler)
    }

    /// Register a HEAD handler.
    #[must_use]
    pub fn head(self, handler: impl Handler) -> Self {
        self.on(Method::HEAD, handler)
    }

    /// Register an OPTIONS handler.
    #[must_use]
    pub fn options(self, handler: impl Handler) -> Self {
        self.on(Method::OPTIONS, handler)
    }
}

// ── Convenience functions ───────────────────────────────────────────────────

/// Create a method router with a GET handler.
pub fn get(handler: impl Handler) -> MethodRouter {
    MethodRouter::new().get(handler)
}

/// Create a method router with a POST handler.
pub fn post(handler: impl Handler) -> MethodRouter {
    MethodRouter::new().post(handler)
}

/// Create a method router with a PUT handler.
pub fn put(handler: impl Handler) -> MethodRouter {
    MethodRouter::new().put(handler)
}

/// Create a method router with a DELETE handler.
pub fn delete(handler: impl Handler) -> MethodRouter {
    MethodRouter::new().delete(handler)
}

/// Create a method router with a PATCH handler.
pub fn patch(handler: impl Handler) -> MethodRouter {
    MethodRouter::new().patch(handler)
}

/// Create a method router with a HEAD handler.
pub fn head(handler: impl Handler) -> MethodRouter {
    MethodRouter::new().head(handler)
}

/// Create a method router with an OPTIONS handler.
pub fn options(handler: impl Handler) -> MethodRouter {
    MethodRouter::new().options(handler)
}

// ── Router ──────────────────────────────────────────────────────────────────

/// HTTP request router using matchit radix tree.
///
/// Routes are matched using a compressed radix tree for O(log n) lookup.
/// Parameters are denoted with `{param}` or `:param` syntax.
///
/// # Example
///
/// ```ignore
/// let app = Router::new()
///     .route("/", get(index))
///     .route("/users", get(list_users).post(create_user))
///     .route("/users/{id}", get(get_user).delete(delete_user))
///     .nest("/api/v1", api_v1_routes());
/// ```
pub struct Router {
    tree: matchit::Router<RouteId>,
    routes: Vec<Route>,
    nested: Vec<(String, Router)>,
    fallback: Option<Box<dyn ErasedHandler>>,
    middlewares: Vec<Box<dyn Middleware>>,
    state: Option<Box<dyn StateInjector>>,
    next_id: RouteId,
}

// ── State Injector ─────────────────────────────────────────────────────────

/// Trait object for injecting typed state into request extensions.
trait StateInjector: Send + Sync {
    fn inject(&self, req: &mut Request);
}

/// Concrete state injector that clones T into extensions.
struct TypedStateInjector<T: Clone + Send + Sync + 'static> {
    state: T,
}

impl<T: Clone + Send + Sync + 'static> StateInjector for TypedStateInjector<T> {
    fn inject(&self, req: &mut Request) {
        req.extensions.insert(self.state.clone());
    }
}

impl Router {
    /// Create a new empty router.
    #[must_use]
    pub fn new() -> Self {
        Self {
            tree: matchit::Router::new(),
            routes: Vec::new(),
            nested: Vec::new(),
            fallback: None,
            middlewares: Vec::new(),
            state: None,
            next_id: 0,
        }
    }

    /// Register a route with method handlers.
    #[must_use]
    pub fn route(mut self, path: &str, method_router: MethodRouter) -> Self {
        let id = self.next_id;
        self.next_id += 1;

        let mut route = Route::new();
        for (method, handler) in method_router.handlers {
            route.insert(method, handler);
        }

        // matchit uses {param} syntax, but we also support :param
        let normalized = normalize_path(path);
        // Ignore errors from duplicate routes — last registration wins.
        // into_owned() is fine here: route registration is a cold path.
        let _ = self.tree.insert(normalized.into_owned(), id);
        self.routes.push(route);
        self
    }

    /// Mount a sub-router at a prefix.
    #[must_use]
    pub fn nest(mut self, prefix: &str, router: Router) -> Self {
        self.nested.push((prefix.to_string(), router));
        self
    }

    /// Merge another router's routes into this one.
    #[must_use]
    pub fn merge(mut self, other: Router) -> Self {
        for (prefix, nested) in other.nested {
            self.nested.push((prefix, nested));
        }
        // For simplicity, merge stores the other router as a nested router at "/"
        if !other.routes.is_empty() {
            self.nested.push(("/".to_string(), Router {
                tree: other.tree,
                routes: other.routes,
                nested: Vec::new(),
                fallback: other.fallback,
                middlewares: other.middlewares,
                state: other.state,
                next_id: other.next_id,
            }));
        }
        self
    }

    /// Set a fallback handler for unmatched routes.
    #[must_use]
    pub fn fallback(mut self, handler: impl Handler) -> Self {
        self.fallback = Some(Box::new(handler));
        self
    }

    /// Add a middleware layer that wraps all route dispatch.
    ///
    /// Middleware is applied in LIFO order: the last middleware added
    /// is the outermost and executes first.
    ///
    /// # Example
    ///
    /// ```ignore
    /// let app = Router::new()
    ///     .route("/", get(handler))
    ///     .layer(LoggerMiddleware)
    ///     .layer(CorsMiddleware::default());
    /// // CORS runs first (outermost), then Logger, then handler
    /// ```
    #[must_use]
    pub fn layer<M: Middleware>(mut self, middleware: M) -> Self {
        self.middlewares.push(Box::new(middleware));
        self
    }

    /// Inject typed application state into all requests.
    ///
    /// The state is inserted into request [`Extensions`] before handler
    /// dispatch, making it available via the [`State<T>`] extractor.
    ///
    /// # Example
    ///
    /// ```ignore
    /// #[derive(Clone)]
    /// struct AppState { db: Pool }
    ///
    /// let app = Router::new()
    ///     .route("/users", get(list_users))
    ///     .with_state(AppState { db: pool });
    /// ```
    #[must_use]
    pub fn with_state<T: Clone + Send + Sync + 'static>(mut self, state: T) -> Self {
        self.state = Some(Box::new(TypedStateInjector { state }));
        self
    }

    /// Handle an incoming request.
    ///
    /// If state has been configured via [`with_state`], it is injected into
    /// the request extensions before any middleware or handler runs.
    ///
    /// Middleware layers execute in LIFO order (last added = outermost).
    pub fn handle(&self, mut req: Request) -> Pin<Box<dyn Future<Output = Response> + Send + '_>> {
        // 1. Inject state into extensions (before middleware, so middleware can see it)
        if let Some(injector) = &self.state {
            injector.inject(&mut req);
        }

        // 2. If no middleware, dispatch directly
        if self.middlewares.is_empty() {
            return self.dispatch_inner(req);
        }

        // 3. Chain middleware in LIFO order (last added = outermost).
        //    Start from the outermost (last) middleware, building Next
        //    that chains through to the innermost, then to dispatch.
        let mw_count = self.middlewares.len();
        self.run_middleware(req, mw_count - 1)
    }

    /// Recursively chain middleware from index `idx` (outermost) down to 0 (innermost).
    fn run_middleware(&self, req: Request, idx: usize) -> Pin<Box<dyn Future<Output = Response> + Send + '_>> {
        let mw = &self.middlewares[idx];

        let next = if idx == 0 {
            // Innermost middleware: Next calls the actual route dispatch
            Next::new(move |r: Request| self.dispatch_inner(r))
        } else {
            // Chain to the next-inner middleware
            Next::new(move |r: Request| self.run_middleware(r, idx - 1))
        };

        mw.handle(req, next)
    }

    /// Core route dispatch without middleware.
    fn dispatch_inner(&self, mut req: Request) -> Pin<Box<dyn Future<Output = Response> + Send + '_>> {
        // Fast path: dispatch paths never contain ':' (that's registration syntax),
        // so skip normalize_path entirely and match against the raw path.
        // This avoids the contains(':') scan on every request.
        if let Ok(matched) = self.tree.at(&req.path) {
            let route_id = *matched.value;
            // Extract params — reserve exact capacity to avoid rehashing
            let param_count = matched.params.len();
            if param_count > 0 {
                req.path_params.reserve(param_count);
                for (key, value) in matched.params.iter() {
                    req.path_params.insert(key.to_string(), value.to_string());
                }
            }
            if let Some(route) = self.routes.get(route_id as usize) {
                return route.dispatch(req);
            }
        }

        // Check nested routers
        for (prefix, router) in &self.nested {
            if let Some(sub_path) = strip_prefix(&req.path, prefix) {
                req.path = sub_path;
                return router.handle(req);
            }
        }

        // Fallback
        if let Some(handler) = &self.fallback {
            return handler.call_erased(req);
        }

        Box::pin(async { StatusCode::NOT_FOUND.into_response() })
    }

    /// Number of registered routes.
    #[must_use]
    pub fn route_count(&self) -> usize {
        self.routes.len()
    }
}

impl Default for Router {
    fn default() -> Self {
        Self::new()
    }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/// Normalize path parameters from `:param` to `{param}` for matchit.
///
/// Returns a `Cow` to avoid allocation when the path needs no changes
/// (the common case at dispatch time — paths with `:` only appear at
/// route registration time).
fn normalize_path(path: &str) -> std::borrow::Cow<'_, str> {
    if !path.contains(':') {
        return std::borrow::Cow::Borrowed(path);
    }
    std::borrow::Cow::Owned(
        path.split('/')
            .map(|segment| {
                segment.strip_prefix(':').map_or_else(
                    || segment.to_string(),
                    |param| format!("{{{param}}}"),
                )
            })
            .collect::<Vec<_>>()
            .join("/"),
    )
}

/// Strip a prefix from a path.
fn strip_prefix(path: &str, prefix: &str) -> Option<String> {
    let normalized_prefix = prefix.trim_end_matches('/');
    let normalized_path = if path.is_empty() { "/" } else { path };

    if normalized_path == normalized_prefix {
        return Some("/".to_string());
    }

    normalized_path
        .strip_prefix(normalized_prefix)
        .and_then(|rest| {
            if rest.starts_with('/') || rest.is_empty() {
                Some(if rest.is_empty() { "/".to_string() } else { rest.to_string() })
            } else {
                None
            }
        })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::handler::FnHandler;

    fn ok_handler() -> &'static str { "ok" }
    fn created_handler() -> StatusCode { StatusCode::CREATED }

    /// Minimal single-poll executor for futures that complete immediately.
    fn block_on<F: Future>(mut fut: F) -> F::Output {
        use std::task::{Context, Poll, RawWaker, RawWakerVTable, Waker};
        fn noop(_: *const ()) {}
        fn noop_clone(_: *const ()) -> RawWaker {
            RawWaker::new(std::ptr::null(), &VTABLE)
        }
        static VTABLE: RawWakerVTable =
            RawWakerVTable::new(noop_clone, noop, noop, noop);
        let waker = unsafe { Waker::from_raw(RawWaker::new(std::ptr::null(), &VTABLE)) };
        let mut cx = Context::from_waker(&waker);
        // SAFETY: We never move the future after pinning
        let pinned = unsafe { Pin::new_unchecked(&mut fut) };
        match pinned.poll(&mut cx) {
            Poll::Ready(val) => val,
            Poll::Pending => panic!("block_on: future returned Pending"),
        }
    }

    #[test]
    fn normalize_colon_params() {
        assert_eq!(normalize_path("/users/:id"), "/users/{id}");
        assert_eq!(normalize_path("/users/{id}"), "/users/{id}");
        assert_eq!(normalize_path("/health"), "/health");
    }

    #[test]
    fn route_count() {
        let router = Router::new()
            .route("/a", get(FnHandler::new(ok_handler)))
            .route("/b", get(FnHandler::new(ok_handler)));
        assert_eq!(router.route_count(), 2);
    }

    #[test]
    fn strip_prefix_basic() {
        assert_eq!(
            strip_prefix("/api/v1/users", "/api/v1"),
            Some("/users".to_string())
        );
        assert_eq!(strip_prefix("/api/v1", "/api/v1"), Some("/".to_string()));
        assert!(strip_prefix("/other", "/api/v1").is_none());
    }

    // ── Middleware layer tests ──────────────────────────────────────────────

    #[test]
    fn router_layer_single_middleware() {
        use crate::middleware::{Middleware, Next};

        /// Middleware that prepends "MW:" to the response body.
        struct PrefixMiddleware;

        impl Middleware for PrefixMiddleware {
            fn handle<'a>(
                &'a self,
                req: Request,
                next: Next<'a>,
            ) -> Pin<Box<dyn Future<Output = Response> + Send + 'a>> {
                Box::pin(async move {
                    let mut resp = next.run(req).await;
                    let body = format!("MW:{}", String::from_utf8_lossy(&resp.body));
                    resp.body = bytes::Bytes::from(body);
                    resp
                })
            }
        }

        let router = Router::new()
            .route("/hello", get(FnHandler::new(ok_handler)))
            .layer(PrefixMiddleware);

        let req = Request::new("GET", "/hello");
        let resp = block_on(router.handle(req));
        assert_eq!(resp.status, StatusCode::OK);
        assert_eq!(String::from_utf8_lossy(&resp.body), "MW:ok");
    }

    #[test]
    fn router_layer_lifo_order() {
        use crate::middleware::{Middleware, Next};

        /// Middleware that wraps response body with a tag.
        struct TagMiddleware(&'static str);

        impl Middleware for TagMiddleware {
            fn handle<'a>(
                &'a self,
                req: Request,
                next: Next<'a>,
            ) -> Pin<Box<dyn Future<Output = Response> + Send + 'a>> {
                let tag = self.0;
                Box::pin(async move {
                    let mut resp = next.run(req).await;
                    let body = format!("[{tag}:{}]", String::from_utf8_lossy(&resp.body));
                    resp.body = bytes::Bytes::from(body);
                    resp
                })
            }
        }

        // LIFO: last added = outermost = runs first
        // So layer("A") then layer("B") means B wraps A wraps handler
        // handler returns "ok"
        // A wraps: [A:ok]
        // B wraps: [B:[A:ok]]
        let router = Router::new()
            .route("/test", get(FnHandler::new(ok_handler)))
            .layer(TagMiddleware("A"))
            .layer(TagMiddleware("B"));

        let req = Request::new("GET", "/test");
        let resp = block_on(router.handle(req));
        assert_eq!(String::from_utf8_lossy(&resp.body), "[B:[A:ok]]");
    }

    #[test]
    fn router_layer_middleware_can_short_circuit() {
        use crate::middleware::{Middleware, Next};

        /// Middleware that returns 403 without calling next.
        struct BlockMiddleware;

        impl Middleware for BlockMiddleware {
            fn handle<'a>(
                &'a self,
                _req: Request,
                _next: Next<'a>,
            ) -> Pin<Box<dyn Future<Output = Response> + Send + 'a>> {
                Box::pin(async move {
                    Response::new(StatusCode::FORBIDDEN, bytes::Bytes::from_static(b"blocked"))
                })
            }
        }

        let router = Router::new()
            .route("/secret", get(FnHandler::new(ok_handler)))
            .layer(BlockMiddleware);

        let req = Request::new("GET", "/secret");
        let resp = block_on(router.handle(req));
        assert_eq!(resp.status, StatusCode::FORBIDDEN);
        assert_eq!(String::from_utf8_lossy(&resp.body), "blocked");
    }

    #[test]
    fn router_layer_middleware_adds_header() {
        use crate::middleware::{Middleware, Next};

        struct HeaderMiddleware;

        impl Middleware for HeaderMiddleware {
            fn handle<'a>(
                &'a self,
                req: Request,
                next: Next<'a>,
            ) -> Pin<Box<dyn Future<Output = Response> + Send + 'a>> {
                Box::pin(async move {
                    let mut resp = next.run(req).await;
                    resp.headers.insert("x-custom", "added");
                    resp
                })
            }
        }

        let router = Router::new()
            .route("/hello", get(FnHandler::new(ok_handler)))
            .layer(HeaderMiddleware);

        let req = Request::new("GET", "/hello");
        let resp = block_on(router.handle(req));
        assert_eq!(resp.headers.get("x-custom").unwrap(), "added");
    }

    // ── with_state tests ───────────────────────────────────────────────────

    #[test]
    fn router_with_state_injects_into_extensions() {
        use crate::extractor::State;
        use crate::handler::FnHandler1;

        #[derive(Debug, Clone)]
        struct AppState {
            db_url: String,
        }

        fn state_handler(State(state): State<AppState>) -> String {
            format!("db:{}", state.db_url)
        }

        let router = Router::new()
            .route("/db", get(FnHandler1::<_, State<AppState>>::new(state_handler)))
            .with_state(AppState { db_url: "postgres://localhost".into() });

        let req = Request::new("GET", "/db");
        let resp = block_on(router.handle(req));
        assert_eq!(resp.status, StatusCode::OK);
        assert_eq!(String::from_utf8_lossy(&resp.body), "db:postgres://localhost");
    }

    #[test]
    fn router_without_state_returns_500() {
        use crate::extractor::State;
        use crate::handler::FnHandler1;

        #[derive(Debug, Clone)]
        struct AppState {
            db_url: String,
        }

        fn state_handler(State(state): State<AppState>) -> String {
            format!("db:{}", state.db_url)
        }

        // No with_state — State extractor should fail
        let router = Router::new()
            .route("/db", get(FnHandler1::<_, State<AppState>>::new(state_handler)));

        let req = Request::new("GET", "/db");
        let resp = block_on(router.handle(req));
        assert_eq!(resp.status, StatusCode::INTERNAL_SERVER_ERROR);
    }

    // ── Combined middleware + state tests ───────────────────────────────────

    #[test]
    fn router_middleware_plus_state() {
        use crate::extractor::State;
        use crate::handler::FnHandler1;
        use crate::middleware::{Middleware, Next};

        #[derive(Debug, Clone)]
        struct AppConfig {
            version: String,
        }

        fn config_handler(State(config): State<AppConfig>) -> String {
            format!("v{}", config.version)
        }

        struct VersionHeader;

        impl Middleware for VersionHeader {
            fn handle<'a>(
                &'a self,
                req: Request,
                next: Next<'a>,
            ) -> Pin<Box<dyn Future<Output = Response> + Send + 'a>> {
                Box::pin(async move {
                    let mut resp = next.run(req).await;
                    resp.headers.insert("x-version", "middleware-added");
                    resp
                })
            }
        }

        let router = Router::new()
            .route("/version", get(FnHandler1::<_, State<AppConfig>>::new(config_handler)))
            .with_state(AppConfig { version: "2.0".into() })
            .layer(VersionHeader);

        let req = Request::new("GET", "/version");
        let resp = block_on(router.handle(req));
        assert_eq!(resp.status, StatusCode::OK);
        assert_eq!(String::from_utf8_lossy(&resp.body), "v2.0");
        assert_eq!(resp.headers.get("x-version").unwrap(), "middleware-added");
    }

    #[test]
    fn router_middleware_sees_state_in_extensions() {
        use crate::middleware::{Middleware, Next};

        #[derive(Debug, Clone)]
        struct ApiKey(String);

        /// Middleware that reads the ApiKey from extensions and adds it as a header.
        struct ApiKeyHeader;

        impl Middleware for ApiKeyHeader {
            fn handle<'a>(
                &'a self,
                req: Request,
                next: Next<'a>,
            ) -> Pin<Box<dyn Future<Output = Response> + Send + 'a>> {
                Box::pin(async move {
                    let key = req.extensions.get::<ApiKey>().map(|k| k.0.clone());
                    let mut resp = next.run(req).await;
                    if let Some(k) = key {
                        resp.headers.insert("x-api-key", k);
                    }
                    resp
                })
            }
        }

        let router = Router::new()
            .route("/hello", get(FnHandler::new(ok_handler)))
            .with_state(ApiKey("secret-123".into()))
            .layer(ApiKeyHeader);

        let req = Request::new("GET", "/hello");
        let resp = block_on(router.handle(req));
        // State should be visible to middleware because with_state injects before dispatch
        assert_eq!(resp.headers.get("x-api-key").unwrap(), "secret-123");
    }
}
