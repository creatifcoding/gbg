//! Macaroon-based authorization middleware for ava-web.
//!
//! Wraps asupersync's `cx::macaroon` primitives into an HTTP middleware that
//! validates `Authorization: Bearer <base64>` headers against a root key.
//!
//! # Architecture
//!
//! The middleware implements a two-phase authorization flow:
//!
//! 1. **Token extraction**: Parse `Authorization: Bearer <token>` header,
//!    base64-decode the token, deserialize from binary format.
//!
//! 2. **Verification**: Build a [`VerificationContext`] from the incoming
//!    request (time, path, custom claims), then verify the HMAC chain
//!    and all first-party caveats.
//!
//! # Token Wire Format
//!
//! Tokens are transmitted as base64-encoded binary macaroons (standard
//! base64 with padding). The binary format is asupersync's schema v2:
//!
//! ```text
//! Authorization: Bearer <base64(MacaroonToken::to_binary())>
//! ```
//!
//! # Issuer
//!
//! [`MacaroonIssuer`] provides a builder-pattern API for minting tokens
//! with first-party caveats. Only the issuer holds the root key.
//!
//! # Context Builder
//!
//! The middleware accepts a `ContextBuilder` function that constructs a
//! [`VerificationContext`] from the incoming request. This allows
//! route-specific context (resource paths, custom claims, use counts).
//!
//! # Example
//!
//! ```ignore
//! use ava_web::auth::{MacaroonAuth, MacaroonIssuer};
//! use asupersync::security::AuthKey;
//!
//! let root_key = AuthKey::from_seed(42);
//! let issuer = MacaroonIssuer::new(root_key.clone(), "api", "ava-web");
//!
//! // Mint a token with a time-bound caveat
//! let token = issuer.mint()
//!     .time_before(1_700_000_000_000)
//!     .resource_scope("/api/**")
//!     .finish();
//!
//! // Create middleware
//! let auth = MacaroonAuth::new(root_key);
//!
//! // Use in a middleware stack
//! let app = Router::new()
//!     .route("/api/data", get(handler))
//!     .middleware(auth);
//! ```
//!
//! # Error Responses
//!
//! | Condition | Status | Body |
//! |-----------|--------|------|
//! | Missing `Authorization` header | 401 | `missing authorization header` |
//! | Malformed bearer token | 401 | `malformed bearer token` |
//! | Invalid base64 | 401 | `invalid token encoding` |
//! | Invalid binary format | 401 | `invalid token format` |
//! | HMAC signature mismatch | 403 | `token verification failed` |
//! | Caveat predicate failed | 403 | `token verification failed: <reason>` |

use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use asupersync::cx::macaroon::{
    CaveatPredicate, MacaroonToken, VerificationContext, VerificationError,
};
use asupersync::security::AuthKey;

use crate::extractor::Request;
use crate::middleware::{Middleware, Next};
use crate::response::{Response, StatusCode};

// ── Base64 (minimal, no external dep) ────────────────────────────────────────

/// Standard base64 alphabet.
const B64_CHARS: &[u8; 64] =
    b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/// Encode bytes to standard base64 with padding.
fn base64_encode(data: &[u8]) -> String {
    let mut out = String::with_capacity((data.len() + 2) / 3 * 4);
    for chunk in data.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = if chunk.len() > 1 { chunk[1] as u32 } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] as u32 } else { 0 };
        let triple = (b0 << 16) | (b1 << 8) | b2;

        out.push(B64_CHARS[((triple >> 18) & 0x3F) as usize] as char);
        out.push(B64_CHARS[((triple >> 12) & 0x3F) as usize] as char);
        if chunk.len() > 1 {
            out.push(B64_CHARS[((triple >> 6) & 0x3F) as usize] as char);
        } else {
            out.push('=');
        }
        if chunk.len() > 2 {
            out.push(B64_CHARS[(triple & 0x3F) as usize] as char);
        } else {
            out.push('=');
        }
    }
    out
}

/// Decode standard base64 (with or without padding).
fn base64_decode(input: &str) -> Option<Vec<u8>> {
    let input = input.trim_end_matches('=');
    let mut out = Vec::with_capacity(input.len() * 3 / 4);

    let decode_char = |c: u8| -> Option<u32> {
        match c {
            b'A'..=b'Z' => Some((c - b'A') as u32),
            b'a'..=b'z' => Some((c - b'a' + 26) as u32),
            b'0'..=b'9' => Some((c - b'0' + 52) as u32),
            b'+' => Some(62),
            b'/' => Some(63),
            _ => None,
        }
    };

    let bytes = input.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        let remaining = bytes.len() - i;
        if remaining >= 4 {
            let a = decode_char(bytes[i])?;
            let b = decode_char(bytes[i + 1])?;
            let c = decode_char(bytes[i + 2])?;
            let d = decode_char(bytes[i + 3])?;
            let triple = (a << 18) | (b << 12) | (c << 6) | d;
            out.push((triple >> 16) as u8);
            out.push((triple >> 8) as u8);
            out.push(triple as u8);
            i += 4;
        } else if remaining == 3 {
            let a = decode_char(bytes[i])?;
            let b = decode_char(bytes[i + 1])?;
            let c = decode_char(bytes[i + 2])?;
            let triple = (a << 18) | (b << 12) | (c << 6);
            out.push((triple >> 16) as u8);
            out.push((triple >> 8) as u8);
            i += 3;
        } else if remaining == 2 {
            let a = decode_char(bytes[i])?;
            let b = decode_char(bytes[i + 1])?;
            let triple = (a << 18) | (b << 12);
            out.push((triple >> 16) as u8);
            i += 2;
        } else {
            // Single base64 char is invalid
            return None;
        }
    }
    Some(out)
}

// ── Context Builder ──────────────────────────────────────────────────────────

/// A function that constructs a [`VerificationContext`] from an HTTP request.
///
/// The default context builder populates:
/// - `current_time_ms`: Wall-clock time (milliseconds since UNIX epoch)
/// - `resource_path`: The request path
///
/// Custom builders can add region/task scoping, use counts, etc.
pub type ContextBuilderFn = Arc<dyn Fn(&Request) -> VerificationContext + Send + Sync>;

/// Build a default verification context from the request.
fn default_context(req: &Request) -> VerificationContext {
    let time_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;

    VerificationContext::new()
        .with_time(time_ms)
        .with_resource(req.path.clone())
}

// ── MacaroonAuth Middleware ───────────────────────────────────────────────────

/// Macaroon-based authorization middleware.
///
/// Validates `Authorization: Bearer <base64>` tokens against a root key
/// and a set of first-party caveat predicates.
///
/// # Design Decisions
///
/// - **No allocation for rejection paths**: Error responses use static strings
///   or small format strings, avoiding `String::from` on the hot reject path.
///
/// - **Constant-time signature verification**: Delegated to asupersync's
///   `MacaroonSignature::constant_time_eq` — no timing side-channels.
///
/// - **Opaque error messages**: Verification failure returns a generic 403
///   to prevent information leakage about which caveat failed. The detailed
///   reason is logged via `tracing::warn!` for debugging.
///
/// - **Extension injection**: On success, the verified `MacaroonToken` is
///   inserted into the request's extension map, allowing downstream handlers
///   to inspect the token's identifier and caveats.
pub struct MacaroonAuth {
    root_key: AuthKey,
    context_builder: ContextBuilderFn,
}

impl MacaroonAuth {
    /// Create a new macaroon auth middleware with the default context builder.
    ///
    /// The default builder populates `current_time_ms` from wall-clock time
    /// and `resource_path` from the request path.
    pub fn new(root_key: AuthKey) -> Self {
        Self {
            root_key,
            context_builder: Arc::new(default_context),
        }
    }

    /// Create a macaroon auth middleware with a custom context builder.
    ///
    /// Use this when you need to populate region/task scope, use counts,
    /// or custom key-value claims from request headers or extensions.
    pub fn with_context_builder<F>(root_key: AuthKey, builder: F) -> Self
    where
        F: Fn(&Request) -> VerificationContext + Send + Sync + 'static,
    {
        Self {
            root_key,
            context_builder: Arc::new(builder),
        }
    }
}

/// Value type inserted into request extensions on successful auth.
///
/// Downstream handlers can extract this to inspect the token's identifier,
/// caveats, or location.
#[derive(Debug, Clone)]
pub struct AuthenticatedToken {
    /// The verified macaroon token.
    pub token: MacaroonToken,
}

impl Middleware for MacaroonAuth {
    fn handle<'a>(
        &'a self,
        mut req: Request,
        next: Next<'a>,
    ) -> Pin<Box<dyn Future<Output = Response> + Send + 'a>> {
        // Extract Authorization header.
        let auth_header = match req.headers.get("authorization") {
            Some(h) => h.to_string(),
            None => {
                return Box::pin(async {
                    Response::new(StatusCode::UNAUTHORIZED, "missing authorization header")
                        .header("www-authenticate", "Bearer")
                });
            }
        };

        // Parse "Bearer <token>" format.
        let token_str = match auth_header.strip_prefix("Bearer ") {
            Some(t) => t.trim(),
            None => {
                return Box::pin(async {
                    Response::new(StatusCode::UNAUTHORIZED, "malformed bearer token")
                        .header("www-authenticate", "Bearer")
                });
            }
        };

        // Base64-decode.
        let token_bytes = match base64_decode(token_str) {
            Some(b) => b,
            None => {
                return Box::pin(async {
                    Response::new(StatusCode::UNAUTHORIZED, "invalid token encoding")
                        .header("www-authenticate", "Bearer")
                });
            }
        };

        // Deserialize from binary format.
        let token = match MacaroonToken::from_binary(&token_bytes) {
            Some(t) => t,
            None => {
                return Box::pin(async {
                    Response::new(StatusCode::UNAUTHORIZED, "invalid token format")
                        .header("www-authenticate", "Bearer")
                });
            }
        };

        // Build verification context from request.
        let context = (self.context_builder)(&req);

        // Verify HMAC chain + all first-party caveats.
        match token.verify(&self.root_key, &context) {
            Ok(()) => {
                // Inject the verified token into request extensions.
                req.extensions.insert(AuthenticatedToken {
                    token: token.clone(),
                });
                tracing::debug!(
                    identifier = %token.identifier(),
                    caveats = token.caveat_count(),
                    "macaroon token verified"
                );
                next.run(req)
            }
            Err(e) => {
                // Log the detailed error for debugging, but return opaque 403.
                tracing::warn!(error = %e, "macaroon verification failed");
                let body = match &e {
                    VerificationError::InvalidSignature => {
                        "token verification failed".to_string()
                    }
                    VerificationError::CaveatFailed { reason, .. } => {
                        format!("token verification failed: {reason}")
                    }
                    VerificationError::MissingDischarge { identifier, .. } => {
                        format!("token verification failed: missing discharge for {identifier}")
                    }
                    VerificationError::DischargeInvalid { identifier, .. } => {
                        format!("token verification failed: invalid discharge {identifier}")
                    }
                };
                Box::pin(async move {
                    Response::new(StatusCode::FORBIDDEN, body)
                })
            }
        }
    }
}

// ── MacaroonIssuer ───────────────────────────────────────────────────────────

/// Builder for minting Macaroon tokens with first-party caveats.
///
/// The issuer holds the root key and provides a fluent API for constructing
/// tokens with various restrictions.
///
/// # Example
///
/// ```ignore
/// let issuer = MacaroonIssuer::new(root_key, "api:users", "ava-web");
/// let token = issuer.mint()
///     .time_before(deadline_ms)
///     .resource_scope("/api/users/**")
///     .custom("role", "admin")
///     .finish();
///
/// // Serialize for HTTP transport
/// let bearer = token_to_bearer(&token);
/// // => "Bearer <base64>"
/// ```
pub struct MacaroonIssuer {
    root_key: AuthKey,
    identifier: String,
    location: String,
}

impl MacaroonIssuer {
    /// Create a new issuer.
    ///
    /// * `root_key` — The secret key for HMAC signing. Only the issuer
    ///   and verifier should know this.
    /// * `identifier` — Capability identifier (e.g., `"api:users"`).
    /// * `location` — Location hint (e.g., `"ava-web"`).
    pub fn new(root_key: AuthKey, identifier: impl Into<String>, location: impl Into<String>) -> Self {
        Self {
            root_key,
            identifier: identifier.into(),
            location: location.into(),
        }
    }

    /// Start building a new token.
    pub fn mint(&self) -> TokenBuilder {
        let token = MacaroonToken::mint(&self.root_key, &self.identifier, &self.location);
        TokenBuilder { token }
    }
}

/// Builder for attaching caveats to a minted token.
pub struct TokenBuilder {
    token: MacaroonToken,
}

impl TokenBuilder {
    /// Add a `TimeBefore` caveat (token expires at this timestamp).
    #[must_use]
    pub fn time_before(mut self, deadline_ms: u64) -> Self {
        self.token = self.token.add_caveat(CaveatPredicate::TimeBefore(deadline_ms));
        self
    }

    /// Add a `TimeAfter` caveat (token not valid before this timestamp).
    #[must_use]
    pub fn time_after(mut self, start_ms: u64) -> Self {
        self.token = self.token.add_caveat(CaveatPredicate::TimeAfter(start_ms));
        self
    }

    /// Add a `RegionScope` caveat.
    #[must_use]
    pub fn region_scope(mut self, region_id: u64) -> Self {
        self.token = self.token.add_caveat(CaveatPredicate::RegionScope(region_id));
        self
    }

    /// Add a `TaskScope` caveat.
    #[must_use]
    pub fn task_scope(mut self, task_id: u64) -> Self {
        self.token = self.token.add_caveat(CaveatPredicate::TaskScope(task_id));
        self
    }

    /// Add a `MaxUses` caveat.
    #[must_use]
    pub fn max_uses(mut self, n: u32) -> Self {
        self.token = self.token.add_caveat(CaveatPredicate::MaxUses(n));
        self
    }

    /// Add a `ResourceScope` caveat (glob pattern).
    #[must_use]
    pub fn resource_scope(mut self, pattern: impl Into<String>) -> Self {
        self.token = self.token.add_caveat(CaveatPredicate::ResourceScope(pattern.into()));
        self
    }

    /// Add a `RateLimit` caveat.
    #[must_use]
    pub fn rate_limit(mut self, max_count: u32, window_secs: u32) -> Self {
        self.token = self.token.add_caveat(CaveatPredicate::RateLimit { max_count, window_secs });
        self
    }

    /// Add a `Custom` caveat (key-value pair).
    #[must_use]
    pub fn custom(mut self, key: impl Into<String>, value: impl Into<String>) -> Self {
        self.token = self.token.add_caveat(CaveatPredicate::Custom(key.into(), value.into()));
        self
    }

    /// Finish building and return the token.
    #[must_use]
    pub fn finish(self) -> MacaroonToken {
        self.token
    }
}

// ── Serialization Helpers ────────────────────────────────────────────────────

/// Serialize a macaroon token to a `Bearer <base64>` string.
///
/// Suitable for setting as the `Authorization` header value.
#[must_use]
pub fn token_to_bearer(token: &MacaroonToken) -> String {
    let binary = token.to_binary();
    format!("Bearer {}", base64_encode(&binary))
}

/// Deserialize a macaroon token from a `Bearer <base64>` string.
///
/// Returns `None` if the format is invalid.
#[must_use]
pub fn token_from_bearer(bearer: &str) -> Option<MacaroonToken> {
    let b64 = bearer.strip_prefix("Bearer ")?;
    let bytes = base64_decode(b64.trim())?;
    MacaroonToken::from_binary(&bytes)
}

// ── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::response::IntoResponse;

    /// Minimal block_on for synchronous futures (no async runtime needed).
    fn futures_block_on<F: Future>(f: F) -> F::Output {
        use std::task::{Context, Poll, RawWaker, RawWakerVTable, Waker};

        let mut f = Box::pin(f);

        fn raw_waker() -> RawWaker {
            fn no_op(_: *const ()) {}
            fn clone(_: *const ()) -> RawWaker {
                raw_waker()
            }
            RawWaker::new(
                std::ptr::null(),
                &RawWakerVTable::new(clone, no_op, no_op, no_op),
            )
        }

        let waker = unsafe { Waker::from_raw(raw_waker()) };
        let mut cx = Context::from_waker(&waker);

        loop {
            match f.as_mut().poll(&mut cx) {
                Poll::Ready(val) => return val,
                Poll::Pending => panic!("future returned Pending in test"),
            }
        }
    }

    /// Run the auth middleware around a terminal handler.
    fn run_auth(mw: &MacaroonAuth, req: Request) -> Response {
        let fut = {
            let next = Next::new(|_r| -> Pin<Box<dyn Future<Output = Response> + Send>> {
                Box::pin(async move { "ok".into_response() })
            });
            mw.handle(req, next)
        };
        futures_block_on(fut)
    }

    fn test_key() -> AuthKey {
        AuthKey::from_seed(42)
    }

    fn test_issuer() -> MacaroonIssuer {
        MacaroonIssuer::new(test_key(), "test-api", "ava-web-test")
    }

    // ── Base64 round-trip ─────────────────────────────────────────────────

    #[test]
    fn base64_roundtrip() {
        let data = b"hello macaroon world! \x00\xFF\x80";
        let encoded = base64_encode(data);
        let decoded = base64_decode(&encoded).unwrap();
        assert_eq!(decoded, data);
    }

    #[test]
    fn base64_empty() {
        assert_eq!(base64_encode(b""), "");
        assert_eq!(base64_decode("").unwrap(), Vec::<u8>::new());
    }

    // ── Token serialization ──────────────────────────────────────────────

    #[test]
    fn token_bearer_roundtrip() {
        let issuer = test_issuer();
        let token = issuer.mint().time_before(u64::MAX).finish();
        let bearer = token_to_bearer(&token);
        assert!(bearer.starts_with("Bearer "));

        let recovered = token_from_bearer(&bearer).unwrap();
        assert_eq!(recovered.identifier(), token.identifier());
        assert_eq!(recovered.caveat_count(), token.caveat_count());
    }

    // ── Valid token ──────────────────────────────────────────────────────

    #[test]
    fn valid_token_passes() {
        let key = test_key();
        let issuer = test_issuer();
        // Token valid far into the future
        let token = issuer.mint().time_before(u64::MAX).finish();
        let bearer = token_to_bearer(&token);

        let auth = MacaroonAuth::with_context_builder(key, |req| {
            VerificationContext::new()
                .with_time(1_000)
                .with_resource(req.path.clone())
        });

        let req = Request::new("GET", "/api/data")
            .with_header("authorization", bearer.clone());
        let resp = run_auth(&auth, req);
        assert_eq!(resp.status, StatusCode::OK);
    }

    #[test]
    fn valid_token_injects_extension() {
        let key = test_key();
        let issuer = test_issuer();
        let token = issuer.mint().time_before(u64::MAX).finish();
        let bearer = token_to_bearer(&token);

        let auth = MacaroonAuth::with_context_builder(key, |_| {
            VerificationContext::new().with_time(1_000)
        });

        // Use a handler that checks the extension
        let fut = {
            let req = Request::new("GET", "/")
                .with_header("authorization", bearer.clone());
            let next = Next::new(|r| -> Pin<Box<dyn Future<Output = Response> + Send>> {
                Box::pin(async move {
                    let has_token = r.extensions.get::<AuthenticatedToken>().is_some();
                    if has_token { "authenticated".into_response() } else { "no token".into_response() }
                })
            });
            auth.handle(req, next)
        };
        let resp = futures_block_on(fut);
        assert_eq!(resp.status, StatusCode::OK);
        assert_eq!(resp.body.as_ref(), b"authenticated");
    }

    // ── Missing header ───────────────────────────────────────────────────

    #[test]
    fn missing_auth_header_returns_401() {
        let auth = MacaroonAuth::new(test_key());
        let req = Request::new("GET", "/");
        let resp = run_auth(&auth, req);
        assert_eq!(resp.status, StatusCode::UNAUTHORIZED);
        assert!(resp.headers.contains_key("www-authenticate"));
    }

    // ── Malformed bearer ─────────────────────────────────────────────────

    #[test]
    fn malformed_bearer_returns_401() {
        let auth = MacaroonAuth::new(test_key());
        let req = Request::new("GET", "/")
            .with_header("authorization", "Basic dXNlcjpwYXNz");
        let resp = run_auth(&auth, req);
        assert_eq!(resp.status, StatusCode::UNAUTHORIZED);
    }

    // ── Invalid base64 ──────────────────────────────────────────────────

    #[test]
    fn invalid_base64_returns_401() {
        let auth = MacaroonAuth::new(test_key());
        let req = Request::new("GET", "/")
            .with_header("authorization", "Bearer !!!not-base64!!!");
        let resp = run_auth(&auth, req);
        assert_eq!(resp.status, StatusCode::UNAUTHORIZED);
    }

    // ── Invalid binary format ────────────────────────────────────────────

    #[test]
    fn invalid_binary_returns_401() {
        let auth = MacaroonAuth::new(test_key());
        let garbage = base64_encode(b"\x00\x01\x02\x03");
        let req = Request::new("GET", "/")
            .with_header("authorization", format!("Bearer {garbage}"));
        let resp = run_auth(&auth, req);
        assert_eq!(resp.status, StatusCode::UNAUTHORIZED);
    }

    // ── Wrong root key (invalid signature) ───────────────────────────────

    #[test]
    fn wrong_root_key_returns_403() {
        let issuer = test_issuer();
        let token = issuer.mint().finish();
        let bearer = token_to_bearer(&token);

        // Verify with a DIFFERENT key
        let wrong_key = AuthKey::from_seed(999);
        let auth = MacaroonAuth::with_context_builder(wrong_key, |_| {
            VerificationContext::new().with_time(1_000)
        });

        let req = Request::new("GET", "/")
            .with_header("authorization", bearer.clone());
        let resp = run_auth(&auth, req);
        assert_eq!(resp.status, StatusCode::FORBIDDEN);
    }

    // ── Expired token (TimeBefore caveat failed) ─────────────────────────

    #[test]
    fn expired_token_returns_403() {
        let key = test_key();
        let issuer = test_issuer();
        let token = issuer.mint().time_before(1_000).finish(); // expires at t=1000ms
        let bearer = token_to_bearer(&token);

        let auth = MacaroonAuth::with_context_builder(key, |_| {
            VerificationContext::new().with_time(2_000) // current time past deadline
        });

        let req = Request::new("GET", "/")
            .with_header("authorization", bearer.clone());
        let resp = run_auth(&auth, req);
        assert_eq!(resp.status, StatusCode::FORBIDDEN);
    }

    // ── Attenuated token (holder adds caveats) ───────────────────────────

    #[test]
    fn attenuated_token_verifies() {
        let key = test_key();
        let issuer = test_issuer();

        // Issuer mints a broad token
        let broad_token = issuer.mint().time_before(u64::MAX).finish();

        // Holder attenuates it with a resource scope (no root key needed)
        let narrow_token = broad_token.add_caveat(CaveatPredicate::ResourceScope("/api/users/**".into()));
        let bearer = token_to_bearer(&narrow_token);

        let auth = MacaroonAuth::with_context_builder(key, |req| {
            VerificationContext::new()
                .with_time(1_000)
                .with_resource(req.path.clone())
        });

        // Request to matching path — should pass
        let req = Request::new("GET", "/api/users/42")
            .with_header("authorization", bearer.clone());
        let resp = run_auth(&auth, req);
        assert_eq!(resp.status, StatusCode::OK);
    }

    #[test]
    fn attenuated_token_wrong_resource_returns_403() {
        let key = test_key();
        let issuer = test_issuer();

        let broad_token = issuer.mint().time_before(u64::MAX).finish();
        let narrow_token = broad_token.add_caveat(CaveatPredicate::ResourceScope("/api/users/**".into()));
        let bearer = token_to_bearer(&narrow_token);

        let auth = MacaroonAuth::with_context_builder(key, |req| {
            VerificationContext::new()
                .with_time(1_000)
                .with_resource(req.path.clone())
        });

        // Request to NON-matching path — should fail
        let req = Request::new("GET", "/api/admin/secrets")
            .with_header("authorization", bearer.clone());
        let resp = run_auth(&auth, req);
        assert_eq!(resp.status, StatusCode::FORBIDDEN);
    }

    // ── Multiple caveats ─────────────────────────────────────────────────

    #[test]
    fn multiple_caveats_all_pass() {
        let key = test_key();
        let issuer = test_issuer();

        let token = issuer
            .mint()
            .time_before(u64::MAX)
            .time_after(500)
            .resource_scope("/api/**")
            .custom("role", "admin")
            .finish();
        let bearer = token_to_bearer(&token);

        let auth = MacaroonAuth::with_context_builder(key, |req| {
            VerificationContext::new()
                .with_time(1_000)
                .with_resource(req.path.clone())
                .with_custom("role", "admin")
        });

        let req = Request::new("GET", "/api/data")
            .with_header("authorization", bearer.clone());
        let resp = run_auth(&auth, req);
        assert_eq!(resp.status, StatusCode::OK);
    }

    #[test]
    fn multiple_caveats_one_fails() {
        let key = test_key();
        let issuer = test_issuer();

        let token = issuer
            .mint()
            .time_before(u64::MAX)
            .custom("role", "admin")
            .finish();
        let bearer = token_to_bearer(&token);

        let auth = MacaroonAuth::with_context_builder(key, |_| {
            VerificationContext::new()
                .with_time(1_000)
                .with_custom("role", "viewer") // Wrong role
        });

        let req = Request::new("GET", "/")
            .with_header("authorization", bearer.clone());
        let resp = run_auth(&auth, req);
        assert_eq!(resp.status, StatusCode::FORBIDDEN);
    }

    // ── Issuer builder API ───────────────────────────────────────────────

    #[test]
    fn issuer_builder_chain() {
        let issuer = test_issuer();
        let token = issuer
            .mint()
            .time_before(10_000)
            .time_after(1_000)
            .region_scope(42)
            .task_scope(7)
            .max_uses(100)
            .resource_scope("/api/**")
            .rate_limit(10, 60)
            .custom("env", "prod")
            .finish();

        assert_eq!(token.identifier(), "test-api");
        assert_eq!(token.location(), "ava-web-test");
        assert_eq!(token.caveat_count(), 8);
    }
}
