//! Request extractors.
//!
//! Extractors pull typed data from incoming HTTP requests. Each extractor
//! implements [`FromRequest`] or [`FromRequestParts`].

use std::any::{Any, TypeId};
use std::borrow::Cow;
use std::collections::HashMap;
use std::fmt;

use bytes::Bytes;

use crate::response::{IntoResponse, Response, StatusCode};

// ── HTTP Method ──────────────────────────────────────────────────────────────

/// HTTP request method — zero-allocation enum.
///
/// Standard methods are enum variants (no heap allocation).
/// Non-standard methods use `Custom(String)` as a fallback.
#[derive(Debug, Clone, Hash, PartialEq, Eq)]
pub enum Method {
    GET,
    POST,
    PUT,
    DELETE,
    PATCH,
    HEAD,
    OPTIONS,
    /// Non-standard methods (CONNECT, TRACE, or custom).
    Custom(String),
}

impl Method {
    /// Get the method as a string slice.
    #[must_use]
    pub fn as_str(&self) -> &str {
        match self {
            Method::GET => "GET",
            Method::POST => "POST",
            Method::PUT => "PUT",
            Method::DELETE => "DELETE",
            Method::PATCH => "PATCH",
            Method::HEAD => "HEAD",
            Method::OPTIONS => "OPTIONS",
            Method::Custom(s) => s,
        }
    }
}

impl fmt::Display for Method {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

impl From<&str> for Method {
    fn from(s: &str) -> Self {
        match s {
            "GET" => Method::GET,
            "POST" => Method::POST,
            "PUT" => Method::PUT,
            "DELETE" => Method::DELETE,
            "PATCH" => Method::PATCH,
            "HEAD" => Method::HEAD,
            "OPTIONS" => Method::OPTIONS,
            other => Method::Custom(other.to_uppercase()),
        }
    }
}

impl From<String> for Method {
    fn from(s: String) -> Self {
        Method::from(s.as_str())
    }
}

impl PartialEq<&str> for Method {
    fn eq(&self, other: &&str) -> bool {
        self.as_str() == *other
    }
}

impl PartialEq<str> for Method {
    fn eq(&self, other: &str) -> bool {
        self.as_str() == other
    }
}

// ── Request ─────────────────────────────────────────────────────────────────

/// An incoming HTTP request.
#[derive(Debug)]
pub struct Request {
    /// HTTP method — zero-allocation for standard methods.
    pub method: Method,
    /// Request path (e.g., "/users/42").
    pub path: String,
    /// Query string (everything after '?'), if present.
    pub query: Option<String>,
    /// Request headers (Vec-backed for cache-friendly scan).
    pub headers: HeaderMap,
    /// Request body bytes.
    pub body: Bytes,
    /// Path parameters extracted by the router.
    pub path_params: HashMap<String, String>,
    /// Type-safe extensions for middleware-injected state.
    pub extensions: Extensions,
}

impl Request {
    /// Create a new request (primarily for testing).
    #[must_use]
    pub fn new(method: impl Into<Method>, path: impl Into<String>) -> Self {
        Self {
            method: method.into(),
            path: path.into(),
            query: None,
            headers: HeaderMap::with_capacity(8),
            body: Bytes::new(),
            path_params: HashMap::new(),
            extensions: Extensions::new(),
        }
    }

    /// Set query string.
    #[must_use]
    pub fn with_query(mut self, query: impl Into<String>) -> Self {
        self.query = Some(query.into());
        self
    }

    /// Set request body.
    #[must_use]
    pub fn with_body(mut self, body: impl Into<Bytes>) -> Self {
        self.body = body.into();
        self
    }

    /// Set a header.
    #[must_use]
    pub fn with_header(
        mut self,
        name: impl Into<Cow<'static, str>>,
        value: impl Into<Cow<'static, str>>,
    ) -> Self {
        self.headers.insert(name, value);
        self
    }

    /// Set path parameters.
    #[must_use]
    pub fn with_path_params(mut self, params: HashMap<String, String>) -> Self {
        self.path_params = params;
        self
    }
}

// ── Extensions (TypeId-based) ───────────────────────────────────────────────

/// Type-safe extension map for middleware-injected data.
///
/// Uses `TypeId` for type-safe insertion and retrieval.
/// Backed by a `Vec` for cache-friendly linear scan — faster than
/// `HashMap` for the typical case of < 15 extension types per request.
#[derive(Default)]
pub struct Extensions {
    entries: Vec<(TypeId, Box<dyn Any + Send + Sync>)>,
}

impl Extensions {
    /// Create empty extensions.
    #[must_use]
    pub fn new() -> Self {
        Self { entries: Vec::with_capacity(4) }
    }

    /// Insert a value by type. Returns the previous value if one existed.
    pub fn insert<T: Send + Sync + 'static>(&mut self, val: T) -> Option<T> {
        let tid = TypeId::of::<T>();
        for entry in &mut self.entries {
            if entry.0 == tid {
                let prev = std::mem::replace(&mut entry.1, Box::new(val));
                return prev.downcast().ok().map(|b| *b);
            }
        }
        self.entries.push((tid, Box::new(val)));
        None
    }

    /// Get a reference by type.
    #[must_use]
    pub fn get<T: Send + Sync + 'static>(&self) -> Option<&T> {
        let tid = TypeId::of::<T>();
        self.entries
            .iter()
            .find(|(id, _)| *id == tid)
            .and_then(|(_, val)| val.downcast_ref())
    }

    /// Get a mutable reference by type.
    pub fn get_mut<T: Send + Sync + 'static>(&mut self) -> Option<&mut T> {
        let tid = TypeId::of::<T>();
        self.entries
            .iter_mut()
            .find(|(id, _)| *id == tid)
            .and_then(|(_, val)| val.downcast_mut())
    }

    /// Remove a value by type.
    pub fn remove<T: Send + Sync + 'static>(&mut self) -> Option<T> {
        let tid = TypeId::of::<T>();
        let pos = self.entries.iter().position(|(id, _)| *id == tid)?;
        let (_, val) = self.entries.swap_remove(pos);
        val.downcast().ok().map(|b| *b)
    }
}

impl fmt::Debug for Extensions {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("Extensions")
            .field("len", &self.entries.len())
            .finish()
    }
}

// ── HeaderMap (Vec-backed) ──────────────────────────────────────────────────

/// HTTP header map backed by a `Vec<(Cow<'static, str>, Cow<'static, str>)>`.
///
/// Faster than `HashMap` for the typical case of < 20 headers per
/// request/response. Uses `Cow` to avoid heap allocation for static
/// header names and values (the common case in middleware).
///
/// Case-sensitive key matching — callers should normalize to lowercase
/// at ingestion (which ava-web already does).
#[derive(Clone, Default)]
pub struct HeaderMap {
    entries: Vec<(Cow<'static, str>, Cow<'static, str>)>,
}

impl HeaderMap {
    /// Create empty header map.
    #[must_use]
    pub fn new() -> Self {
        Self { entries: Vec::new() }
    }

    /// Create with pre-allocated capacity.
    #[must_use]
    pub fn with_capacity(cap: usize) -> Self {
        Self { entries: Vec::with_capacity(cap) }
    }

    /// Insert a header. Returns the previous value if the key was already present.
    ///
    /// Accepts both `&'static str` (zero-allocation) and `String` (owned).
    pub fn insert(
        &mut self,
        key: impl Into<Cow<'static, str>>,
        value: impl Into<Cow<'static, str>>,
    ) -> Option<Cow<'static, str>> {
        let key = key.into();
        let value = value.into();
        for entry in &mut self.entries {
            if *entry.0 == *key {
                let prev = std::mem::replace(&mut entry.1, value);
                return Some(prev);
            }
        }
        self.entries.push((key, value));
        None
    }

    /// Get a header value by key.
    #[must_use]
    pub fn get(&self, key: &str) -> Option<&str> {
        self.entries
            .iter()
            .find(|(k, _)| &**k == key)
            .map(|(_, v)| &**v)
    }

    /// Check if a header key exists.
    #[must_use]
    pub fn contains_key(&self, key: &str) -> bool {
        self.entries.iter().any(|(k, _)| &**k == key)
    }

    /// Iterate over header pairs as `(&str, &str)`.
    pub fn iter(&self) -> impl Iterator<Item = (&str, &str)> {
        self.entries.iter().map(|(k, v)| (&**k, &**v))
    }

    /// Number of headers.
    #[must_use]
    pub fn len(&self) -> usize {
        self.entries.len()
    }

    /// Whether the map is empty.
    #[must_use]
    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }
}

impl fmt::Debug for HeaderMap {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_map()
            .entries(self.entries.iter().map(|(k, v)| (&**k, &**v)))
            .finish()
    }
}

/// Consuming iterator yields `(String, String)` for protocol conversion.
impl IntoIterator for HeaderMap {
    type Item = (String, String);
    type IntoIter = HeaderMapIntoIter;

    fn into_iter(self) -> Self::IntoIter {
        HeaderMapIntoIter(self.entries.into_iter())
    }
}

/// Owned iterator adapter that converts `Cow<str>` → `String`.
pub struct HeaderMapIntoIter(std::vec::IntoIter<(Cow<'static, str>, Cow<'static, str>)>);

impl Iterator for HeaderMapIntoIter {
    type Item = (String, String);
    fn next(&mut self) -> Option<Self::Item> {
        self.0.next().map(|(k, v)| (k.into_owned(), v.into_owned()))
    }
    fn size_hint(&self) -> (usize, Option<usize>) {
        self.0.size_hint()
    }
}

/// Reference iterator yields raw `&(Cow, Cow)` for zero-cost scanning.
impl<'a> IntoIterator for &'a HeaderMap {
    type Item = &'a (Cow<'static, str>, Cow<'static, str>);
    type IntoIter = std::slice::Iter<'a, (Cow<'static, str>, Cow<'static, str>)>;

    fn into_iter(self) -> Self::IntoIter {
        self.entries.iter()
    }
}

// ── Extraction Error ────────────────────────────────────────────────────────

/// Error returned when extraction fails.
#[derive(Debug, Clone)]
pub struct ExtractionError {
    /// Human-readable description.
    pub message: String,
    /// HTTP status code for the error response.
    pub status: StatusCode,
}

impl ExtractionError {
    #[must_use]
    pub fn new(status: StatusCode, message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
            status,
        }
    }

    #[must_use]
    pub fn bad_request(message: impl Into<String>) -> Self {
        Self::new(StatusCode::BAD_REQUEST, message)
    }

    #[must_use]
    pub fn unprocessable(message: impl Into<String>) -> Self {
        Self::new(StatusCode::UNPROCESSABLE_ENTITY, message)
    }
}

impl fmt::Display for ExtractionError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{} {}", self.status, self.message)
    }
}

impl std::error::Error for ExtractionError {}

impl IntoResponse for ExtractionError {
    fn into_response(self) -> Response {
        Response::new(self.status, Bytes::copy_from_slice(self.message.as_bytes()))
            .header("content-type", "text/plain; charset=utf-8")
    }
}

// ── FromRequest / FromRequestParts ──────────────────────────────────────────

/// Extract a value from request parts (headers, path, query).
pub trait FromRequestParts: Sized {
    fn from_request_parts(req: &Request) -> Result<Self, ExtractionError>;
}

/// Extract a value from the full request (may consume body).
pub trait FromRequest: Sized {
    fn from_request(req: Request) -> Result<Self, ExtractionError>;
}

// Blanket: FromRequestParts also implements FromRequest.
impl<T: FromRequestParts> FromRequest for T {
    fn from_request(req: Request) -> Result<Self, ExtractionError> {
        Self::from_request_parts(&req)
    }
}

// ── Path<T> ─────────────────────────────────────────────────────────────────

/// Extract path parameters.
#[derive(Debug, Clone)]
pub struct Path<T>(pub T);

impl FromRequestParts for Path<String> {
    fn from_request_parts(req: &Request) -> Result<Self, ExtractionError> {
        req.path_params
            .values()
            .next()
            .cloned()
            .map(Path)
            .ok_or_else(|| ExtractionError::bad_request("no path parameters found"))
    }
}

impl FromRequestParts for Path<u64> {
    fn from_request_parts(req: &Request) -> Result<Self, ExtractionError> {
        req.path_params
            .values()
            .next()
            .and_then(|v| v.parse().ok())
            .map(Path)
            .ok_or_else(|| ExtractionError::bad_request("invalid path parameter"))
    }
}

impl FromRequestParts for Path<HashMap<String, String>> {
    fn from_request_parts(req: &Request) -> Result<Self, ExtractionError> {
        Ok(Self(req.path_params.clone()))
    }
}

// ── Query<T> ────────────────────────────────────────────────────────────────

/// Extract query string parameters.
#[derive(Debug, Clone)]
pub struct Query<T>(pub T);

impl FromRequestParts for Query<HashMap<String, String>> {
    fn from_request_parts(req: &Request) -> Result<Self, ExtractionError> {
        let qs = req.query.as_deref().unwrap_or("");
        Ok(Self(parse_urlencoded(qs)))
    }
}

fn parse_urlencoded(input: &str) -> HashMap<String, String> {
    input
        .split('&')
        .filter(|s| !s.is_empty())
        .filter_map(|pair| {
            let mut parts = pair.splitn(2, '=');
            let key = parts.next()?;
            let value = parts.next().unwrap_or("");
            Some((key.to_string(), value.to_string()))
        })
        .collect()
}

// ── Json<T> ─────────────────────────────────────────────────────────────────

/// Extract JSON request body.
#[derive(Debug, Clone)]
pub struct Json<T>(pub T);

const MAX_JSON_BODY_SIZE: usize = 10 * 1024 * 1024;

impl<T: serde::de::DeserializeOwned> FromRequest for Json<T> {
    fn from_request(req: Request) -> Result<Self, ExtractionError> {
        if req.body.len() > MAX_JSON_BODY_SIZE {
            return Err(ExtractionError::new(
                StatusCode::PAYLOAD_TOO_LARGE,
                format!("JSON body too large: {} bytes (limit {MAX_JSON_BODY_SIZE})", req.body.len()),
            ));
        }

        let content_type = req.headers.get("content-type");
        if let Some(ct) = content_type {
            if !ct.contains("application/json") {
                return Err(ExtractionError::new(
                    StatusCode::UNSUPPORTED_MEDIA_TYPE,
                    format!("expected application/json, got {ct}"),
                ));
            }
        }

        json_deserialize::<T>(req.body.as_ref())
            .map(Json)
            .map_err(|e| ExtractionError::unprocessable(format!("invalid JSON: {e}")))
    }
}

/// Deserialize JSON from a byte slice.
///
/// When the `simd-json` feature is enabled, uses SIMD-accelerated parsing
/// (3-5x faster for large payloads). Falls back to `serde_json` otherwise.
#[cfg(feature = "simd-json")]
fn json_deserialize<T: serde::de::DeserializeOwned>(data: &[u8]) -> Result<T, String> {
    // simd-json requires a mutable buffer for in-place string unescaping.
    // The copy is O(n) but the SIMD parsing speedup vastly outweighs it.
    let mut buf = data.to_vec();
    simd_json::from_slice(&mut buf).map_err(|e| e.to_string())
}

#[cfg(not(feature = "simd-json"))]
fn json_deserialize<T: serde::de::DeserializeOwned>(data: &[u8]) -> Result<T, String> {
    serde_json::from_slice(data).map_err(|e| e.to_string())
}

// ── Form<T> ─────────────────────────────────────────────────────────────────

/// Extract URL-encoded form data.
#[derive(Debug, Clone)]
pub struct Form<T>(pub T);

impl FromRequest for Form<HashMap<String, String>> {
    fn from_request(req: Request) -> Result<Self, ExtractionError> {
        let body_str = std::str::from_utf8(req.body.as_ref())
            .map_err(|e| ExtractionError::bad_request(format!("invalid UTF-8 body: {e}")))?;
        Ok(Self(parse_urlencoded(body_str)))
    }
}

// ── State<T> ────────────────────────────────────────────────────────────────

/// Extract shared application state from extensions.
#[derive(Debug, Clone)]
pub struct State<T>(pub T);

impl<T: Clone + Send + Sync + 'static> FromRequestParts for State<T> {
    fn from_request_parts(req: &Request) -> Result<Self, ExtractionError> {
        req.extensions
            .get::<T>()
            .cloned()
            .map(State)
            .ok_or_else(|| {
                ExtractionError::new(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "state not configured",
                )
            })
    }
}

// ── RawBody ─────────────────────────────────────────────────────────────────

/// Extract the raw request body as bytes.
#[derive(Debug, Clone)]
pub struct RawBody(pub Bytes);

impl FromRequest for RawBody {
    fn from_request(req: Request) -> Result<Self, ExtractionError> {
        Ok(Self(req.body))
    }
}

// ── HeaderMap Extractor ─────────────────────────────────────────────────────

impl FromRequestParts for HashMap<String, String> {
    fn from_request_parts(req: &Request) -> Result<Self, ExtractionError> {
        Ok(req.headers.iter().map(|(k, v)| (k.to_owned(), v.to_owned())).collect())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn path_extraction() {
        let mut params = HashMap::new();
        params.insert("id".to_string(), "42".to_string());
        let req = Request::new("GET", "/users/42").with_path_params(params);
        let Path(id) = Path::<String>::from_request_parts(&req).unwrap();
        assert_eq!(id, "42");
    }

    #[test]
    fn path_u64_extraction() {
        let mut params = HashMap::new();
        params.insert("id".to_string(), "123".to_string());
        let req = Request::new("GET", "/items/123").with_path_params(params);
        let Path(id) = Path::<u64>::from_request_parts(&req).unwrap();
        assert_eq!(id, 123);
    }

    #[test]
    fn query_extraction() {
        let req = Request::new("GET", "/items").with_query("page=3&sort=name");
        let Query(params) = Query::<HashMap<String, String>>::from_request_parts(&req).unwrap();
        assert_eq!(params.get("page").unwrap(), "3");
        assert_eq!(params.get("sort").unwrap(), "name");
    }

    #[test]
    fn json_extraction() {
        #[derive(Debug, serde::Deserialize, PartialEq)]
        struct Input { name: String }

        let req = Request::new("POST", "/users")
            .with_header("content-type", "application/json")
            .with_body(Bytes::from_static(b"{\"name\":\"alice\"}"));
        let Json(input) = Json::<Input>::from_request(req).unwrap();
        assert_eq!(input.name, "alice");
    }

    #[test]
    fn state_extraction() {
        #[derive(Debug, Clone)]
        struct AppState { name: String }

        let mut req = Request::new("GET", "/");
        req.extensions.insert(AppState { name: "test".into() });
        let State(state) = State::<AppState>::from_request_parts(&req).unwrap();
        assert_eq!(state.name, "test");
    }

    #[test]
    fn extensions_type_safe() {
        let mut ext = Extensions::new();
        ext.insert(42u32);
        ext.insert("hello".to_string());
        assert_eq!(ext.get::<u32>(), Some(&42));
        assert_eq!(ext.get::<String>(), Some(&"hello".to_string()));
        assert_eq!(ext.get::<bool>(), None);
    }
}
