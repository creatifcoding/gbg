//! OpenAPI 3.1 document builder.
//!
//! Provides structs for building an OpenAPI specification document
//! and a handler that serves it as JSON.

use std::collections::HashMap;
use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;

use bytes::Bytes;

use crate::extractor::Request;
use crate::handler::Handler;
use crate::response::{Response, StatusCode};

// ── OpenAPI Types ─────────────────────────────────────────────────────────

/// OpenAPI 3.1 document.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct OpenApiDoc {
    /// OpenAPI version.
    pub openapi: String,
    /// API metadata.
    pub info: OpenApiInfo,
    /// Available paths.
    #[serde(skip_serializing_if = "HashMap::is_empty")]
    pub paths: HashMap<String, PathItem>,
}

/// API info metadata.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct OpenApiInfo {
    /// API title.
    pub title: String,
    /// API version.
    pub version: String,
    /// Optional description.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

/// A path item describing operations available on a single path.
#[derive(Debug, Clone, Default, serde::Serialize, serde::Deserialize)]
pub struct PathItem {
    /// GET operation.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub get: Option<Operation>,
    /// POST operation.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub post: Option<Operation>,
    /// PUT operation.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub put: Option<Operation>,
    /// DELETE operation.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub delete: Option<Operation>,
    /// PATCH operation.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub patch: Option<Operation>,
}

/// An API operation (endpoint).
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Operation {
    /// Short summary of the operation.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub summary: Option<String>,
    /// Unique operation identifier.
    #[serde(rename = "operationId", skip_serializing_if = "Option::is_none")]
    pub operation_id: Option<String>,
    /// Tags for grouping.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub tags: Vec<String>,
    /// Possible responses.
    #[serde(default, skip_serializing_if = "HashMap::is_empty")]
    pub responses: HashMap<String, OperationResponse>,
}

/// A response description for an operation.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct OperationResponse {
    /// Human-readable description.
    pub description: String,
    /// Content type of the response body.
    #[serde(rename = "content", skip_serializing_if = "Option::is_none")]
    pub content_type: Option<String>,
}

// ── Builders ──────────────────────────────────────────────────────────────

impl OpenApiDoc {
    /// Create a new OpenAPI 3.1 document.
    #[must_use]
    pub fn new(title: &str, version: &str) -> Self {
        Self {
            openapi: "3.1.0".to_string(),
            info: OpenApiInfo {
                title: title.to_string(),
                version: version.to_string(),
                description: None,
            },
            paths: HashMap::new(),
        }
    }

    /// Set the API description.
    #[must_use]
    pub fn description(mut self, desc: &str) -> Self {
        self.info.description = Some(desc.to_string());
        self
    }

    /// Add a path item.
    pub fn add_path(&mut self, path: &str, item: PathItem) {
        self.paths.insert(path.to_string(), item);
    }

    /// Render as JSON string.
    #[must_use]
    pub fn to_json(&self) -> String {
        serde_json::to_string_pretty(self).unwrap_or_else(|_| "{}".to_string())
    }

    /// Create an endpoint handler that serves the OpenAPI JSON.
    pub fn into_handler(self) -> OpenApiHandler {
        OpenApiHandler {
            doc: Arc::new(self),
        }
    }
}

impl Operation {
    /// Create a new operation with optional summary.
    #[must_use]
    pub fn new() -> Self {
        Self {
            summary: None,
            operation_id: None,
            tags: Vec::new(),
            responses: HashMap::new(),
        }
    }

    /// Set the summary.
    #[must_use]
    pub fn summary(mut self, summary: &str) -> Self {
        self.summary = Some(summary.to_string());
        self
    }

    /// Set the operation ID.
    #[must_use]
    pub fn operation_id(mut self, id: &str) -> Self {
        self.operation_id = Some(id.to_string());
        self
    }

    /// Add a tag.
    #[must_use]
    pub fn tag(mut self, tag: &str) -> Self {
        self.tags.push(tag.to_string());
        self
    }

    /// Add a response for a status code.
    #[must_use]
    pub fn response(mut self, status: &str, resp: OperationResponse) -> Self {
        self.responses.insert(status.to_string(), resp);
        self
    }
}

impl Default for Operation {
    fn default() -> Self {
        Self::new()
    }
}

impl OperationResponse {
    /// Create a new response description.
    #[must_use]
    pub fn new(description: &str) -> Self {
        Self {
            description: description.to_string(),
            content_type: None,
        }
    }

    /// Set the content type.
    #[must_use]
    pub fn content_type(mut self, ct: &str) -> Self {
        self.content_type = Some(ct.to_string());
        self
    }
}

impl PathItem {
    /// Create an empty path item.
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    /// Set the GET operation.
    #[must_use]
    pub fn get(mut self, op: Operation) -> Self {
        self.get = Some(op);
        self
    }

    /// Set the POST operation.
    #[must_use]
    pub fn post(mut self, op: Operation) -> Self {
        self.post = Some(op);
        self
    }

    /// Set the PUT operation.
    #[must_use]
    pub fn put(mut self, op: Operation) -> Self {
        self.put = Some(op);
        self
    }

    /// Set the DELETE operation.
    #[must_use]
    pub fn delete(mut self, op: Operation) -> Self {
        self.delete = Some(op);
        self
    }

    /// Set the PATCH operation.
    #[must_use]
    pub fn patch(mut self, op: Operation) -> Self {
        self.patch = Some(op);
        self
    }
}

// ── Handler ───────────────────────────────────────────────────────────────

/// Handler that serves the OpenAPI JSON document.
pub struct OpenApiHandler {
    doc: Arc<OpenApiDoc>,
}

impl Handler for OpenApiHandler {
    fn call(&self, _req: Request) -> Pin<Box<dyn Future<Output = Response> + Send + '_>> {
        let json = self.doc.to_json();
        Box::pin(async move {
            Response::new(StatusCode::OK, Bytes::from(json))
                .header("content-type", "application/json")
        })
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_doc_has_version() {
        let doc = OpenApiDoc::new("Test API", "1.0.0");
        assert_eq!(doc.openapi, "3.1.0");
        assert_eq!(doc.info.title, "Test API");
        assert_eq!(doc.info.version, "1.0.0");
        assert!(doc.info.description.is_none());
    }

    #[test]
    fn doc_with_description() {
        let doc = OpenApiDoc::new("My API", "2.0.0").description("A test API");
        assert_eq!(doc.info.description.as_deref(), Some("A test API"));
    }

    #[test]
    fn add_path_with_operations() {
        let mut doc = OpenApiDoc::new("API", "1.0.0");
        doc.add_path(
            "/users",
            PathItem::new()
                .get(
                    Operation::new()
                        .summary("List users")
                        .operation_id("listUsers")
                        .tag("users")
                        .response("200", OperationResponse::new("Success").content_type("application/json")),
                )
                .post(
                    Operation::new()
                        .summary("Create user")
                        .operation_id("createUser")
                        .tag("users"),
                ),
        );

        assert!(doc.paths.contains_key("/users"));
        let path = &doc.paths["/users"];
        assert!(path.get.is_some());
        assert!(path.post.is_some());
        assert!(path.put.is_none());
        assert!(path.delete.is_none());
    }

    #[test]
    fn operation_builder() {
        let op = Operation::new()
            .summary("Get item")
            .operation_id("getItem")
            .tag("items")
            .tag("products")
            .response("200", OperationResponse::new("Item found"))
            .response("404", OperationResponse::new("Not found"));

        assert_eq!(op.summary.as_deref(), Some("Get item"));
        assert_eq!(op.operation_id.as_deref(), Some("getItem"));
        assert_eq!(op.tags, vec!["items", "products"]);
        assert_eq!(op.responses.len(), 2);
        assert!(op.responses.contains_key("200"));
        assert!(op.responses.contains_key("404"));
    }

    #[test]
    fn response_with_content_type() {
        let resp = OperationResponse::new("Success").content_type("application/json");
        assert_eq!(resp.description, "Success");
        assert_eq!(resp.content_type.as_deref(), Some("application/json"));
    }

    #[test]
    fn to_json_valid() {
        let mut doc = OpenApiDoc::new("Test", "1.0.0").description("desc");
        doc.add_path(
            "/health",
            PathItem::new().get(
                Operation::new()
                    .summary("Health check")
                    .response("200", OperationResponse::new("OK")),
            ),
        );

        let json_str = doc.to_json();
        let parsed: serde_json::Value = serde_json::from_str(&json_str).unwrap();
        assert_eq!(parsed["openapi"], "3.1.0");
        assert_eq!(parsed["info"]["title"], "Test");
        assert_eq!(parsed["info"]["version"], "1.0.0");
        assert_eq!(parsed["info"]["description"], "desc");
        assert!(parsed["paths"]["/health"]["get"].is_object());
    }

    #[test]
    fn json_roundtrip() {
        let mut doc = OpenApiDoc::new("RT", "0.1.0");
        doc.add_path(
            "/items",
            PathItem::new()
                .get(Operation::new().summary("List"))
                .post(Operation::new().summary("Create")),
        );

        let json = doc.to_json();
        let parsed: OpenApiDoc = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.info.title, "RT");
        assert!(parsed.paths.contains_key("/items"));
    }

    #[test]
    fn empty_doc_serializes() {
        let doc = OpenApiDoc::new("Empty", "0.0.1");
        let json = doc.to_json();
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed["openapi"], "3.1.0");
        // paths should be omitted when empty
        assert!(parsed.get("paths").is_none() || parsed["paths"].as_object().unwrap().is_empty());
    }

    #[test]
    fn handler_serves_json() {
        let mut doc = OpenApiDoc::new("Handler Test", "1.0.0");
        doc.add_path(
            "/test",
            PathItem::new().get(Operation::new().summary("Test")),
        );

        let handler = doc.into_handler();
        let req = Request::new("GET", "/openapi.json");
        let fut = handler.call(req);
        let resp = block_on(fut);

        assert_eq!(resp.status, StatusCode::OK);
        assert_eq!(resp.headers.get("content-type").unwrap(), "application/json");

        let body_str = std::str::from_utf8(&resp.body).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(body_str).unwrap();
        assert_eq!(parsed["info"]["title"], "Handler Test");
    }

    #[test]
    fn path_item_all_methods() {
        let item = PathItem::new()
            .get(Operation::new().summary("get"))
            .post(Operation::new().summary("post"))
            .put(Operation::new().summary("put"))
            .delete(Operation::new().summary("delete"))
            .patch(Operation::new().summary("patch"));

        assert!(item.get.is_some());
        assert!(item.post.is_some());
        assert!(item.put.is_some());
        assert!(item.delete.is_some());
        assert!(item.patch.is_some());
    }

    #[test]
    fn skip_serializing_none_fields() {
        let op = Operation::new(); // no summary, no operation_id
        let json = serde_json::to_string(&op).unwrap();
        assert!(!json.contains("summary"));
        assert!(!json.contains("operationId"));
    }

    #[test]
    fn skip_serializing_empty_tags() {
        let op = Operation::new();
        let json = serde_json::to_string(&op).unwrap();
        assert!(!json.contains("tags"));
    }

    #[test]
    fn multiple_paths() {
        let mut doc = OpenApiDoc::new("Multi", "1.0.0");
        doc.add_path("/a", PathItem::new().get(Operation::new()));
        doc.add_path("/b", PathItem::new().post(Operation::new()));
        doc.add_path("/c", PathItem::new().delete(Operation::new()));
        assert_eq!(doc.paths.len(), 3);
    }

    /// Minimal block_on for tests.
    fn block_on<T>(fut: impl Future<Output = T>) -> T {
        use std::task::{Context, Poll, RawWaker, RawWakerVTable, Waker};

        fn raw_waker() -> RawWaker {
            fn no_op(_: *const ()) {}
            fn clone(_: *const ()) -> RawWaker { raw_waker() }
            static VTABLE: RawWakerVTable = RawWakerVTable::new(clone, no_op, no_op, no_op);
            RawWaker::new(std::ptr::null(), &VTABLE)
        }

        let waker = unsafe { Waker::from_raw(raw_waker()) };
        let mut cx = Context::from_waker(&waker);
        let mut fut = std::pin::pin!(fut);

        loop {
            match fut.as_mut().poll(&mut cx) {
                Poll::Ready(val) => return val,
                Poll::Pending => std::thread::yield_now(),
            }
        }
    }
}
