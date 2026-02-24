//! Static file serving with ETag and content-type detection.
//!
//! Serves files from a directory with:
//! - Content-Type detection from file extension
//! - ETag headers (FNV-1a hash of file content)
//! - If-None-Match support (304 Not Modified)
//! - Directory traversal prevention
//! - Optional index.html fallback

use std::future::Future;
use std::path::{Path, PathBuf};
use std::pin::Pin;

use bytes::Bytes;

use crate::extractor::Request;
use crate::handler::Handler;
use crate::response::{Response, StatusCode};

// ── StaticFiles ───────────────────────────────────────────────────────────

/// Serve static files from a directory.
///
/// # Example
///
/// ```ignore
/// use ava_web::static_files::StaticFiles;
/// use ava_web::{Router, get};
///
/// let files = StaticFiles::new("./public").index_file("index.html");
/// let app = Router::new().route("/static/*path", get(files));
/// ```
pub struct StaticFiles {
    root: PathBuf,
    index_file: Option<String>,
}

impl StaticFiles {
    /// Create a new static file server rooted at the given directory.
    pub fn new(root: impl Into<PathBuf>) -> Self {
        Self {
            root: root.into(),
            index_file: Some("index.html".to_string()),
        }
    }

    /// Set the index file name (served when path is a directory or "/").
    /// Pass `""` or call with an empty string to disable.
    #[must_use]
    pub fn index_file(mut self, name: &str) -> Self {
        if name.is_empty() {
            self.index_file = None;
        } else {
            self.index_file = Some(name.to_string());
        }
        self
    }

    /// No index file fallback.
    #[must_use]
    pub fn no_index(mut self) -> Self {
        self.index_file = None;
        self
    }

    /// Serve a file at the given relative path.
    ///
    /// Returns `None` if the file doesn't exist or the path is invalid.
    /// Rejects directory traversal attempts (`..` components).
    #[must_use]
    pub fn serve(&self, path: &str) -> Option<Response> {
        self.serve_with_etag(path, None)
    }

    /// Serve a file, checking If-None-Match for 304 responses.
    #[must_use]
    pub fn serve_with_etag(&self, path: &str, if_none_match: Option<&str>) -> Option<Response> {
        // Reject directory traversal
        if contains_traversal(path) {
            return None;
        }

        let clean_path = path.trim_start_matches('/');
        let mut file_path = self.root.join(clean_path);

        // Try index file if path points to directory or is empty
        if clean_path.is_empty() || file_path.is_dir() {
            if let Some(ref index) = self.index_file {
                file_path = file_path.join(index);
            } else {
                return None;
            }
        }

        // Canonicalize and verify still under root
        let canonical = match std::fs::canonicalize(&file_path) {
            Ok(p) => p,
            Err(_) => return None,
        };
        let root_canonical = match std::fs::canonicalize(&self.root) {
            Ok(p) => p,
            Err(_) => return None,
        };
        if !canonical.starts_with(&root_canonical) {
            return None;
        }

        // Read file
        let content = match std::fs::read(&canonical) {
            Ok(c) => c,
            Err(_) => return None,
        };

        // Compute ETag
        let etag = compute_etag(&content);
        let etag_header = format!("\"{etag}\"");

        // Check If-None-Match
        if let Some(client_etag) = if_none_match {
            let client_etag = client_etag.trim();
            if client_etag == etag_header || client_etag.trim_matches('"') == etag {
                return Some(
                    Response::empty(StatusCode::NOT_MODIFIED)
                        .header("etag", etag_header),
                );
            }
        }

        // Determine content type
        let content_type = mime_from_path(&canonical);

        Some(
            Response::new(StatusCode::OK, Bytes::from(content))
                .header("content-type", content_type)
                .header("etag", etag_header),
        )
    }
}

impl Handler for StaticFiles {
    fn call(&self, req: Request) -> Pin<Box<dyn Future<Output = Response> + Send + '_>> {
        let path = req.path.clone();
        let if_none_match = req.headers.get("if-none-match").map(str::to_owned);

        Box::pin(async move {
            self.serve_with_etag(&path, if_none_match.as_deref())
                .unwrap_or_else(|| Response::empty(StatusCode::NOT_FOUND))
        })
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────

/// Check if a path contains directory traversal components.
pub fn contains_traversal(path: &str) -> bool {
    // Check for ".." path segments
    for segment in path.split('/') {
        if segment == ".." {
            return true;
        }
    }
    // Also check backslash-separated on Windows-style paths
    for segment in path.split('\\') {
        if segment == ".." {
            return true;
        }
    }
    false
}

/// Compute a hex-encoded hash of file content for use as an ETag.
///
/// Uses a 4-lane parallel FNV-1a variant to break the multiply dependency
/// chain and allow ILP. Processes 32 bytes per iteration, then folds the
/// four accumulators into one final hash.
pub fn compute_etag(content: &[u8]) -> String {
    const PRIME: u64 = 0x00000100000001B3;
    // Four independent accumulators with distinct bases
    let mut h0: u64 = 0xcbf29ce484222325;
    let mut h1: u64 = 0xcbf29ce484222325_u64.wrapping_mul(PRIME);
    let mut h2: u64 = 0xcbf29ce484222325_u64.wrapping_mul(PRIME).wrapping_mul(PRIME);
    let mut h3: u64 = 0xcbf29ce484222325_u64
        .wrapping_mul(PRIME)
        .wrapping_mul(PRIME)
        .wrapping_mul(PRIME);

    let chunks = content.chunks_exact(32);
    let remainder = chunks.remainder();

    for chunk in chunks {
        let w0 = u64::from_le_bytes(chunk[0..8].try_into().unwrap());
        let w1 = u64::from_le_bytes(chunk[8..16].try_into().unwrap());
        let w2 = u64::from_le_bytes(chunk[16..24].try_into().unwrap());
        let w3 = u64::from_le_bytes(chunk[24..32].try_into().unwrap());
        h0 = (h0 ^ w0).wrapping_mul(PRIME);
        h1 = (h1 ^ w1).wrapping_mul(PRIME);
        h2 = (h2 ^ w2).wrapping_mul(PRIME);
        h3 = (h3 ^ w3).wrapping_mul(PRIME);
    }

    // Fold four lanes into one
    let mut hash = h0
        .wrapping_mul(PRIME)
        ^ h1.wrapping_mul(PRIME.wrapping_mul(PRIME))
        ^ h2.wrapping_mul(PRIME.wrapping_mul(PRIME).wrapping_mul(PRIME))
        ^ h3;

    // Handle remaining bytes
    for &byte in remainder {
        hash ^= byte as u64;
        hash = hash.wrapping_mul(PRIME);
    }

    format!("{:016x}", hash)
}

/// Determine MIME type from file extension.
pub fn mime_from_path(path: &Path) -> &'static str {
    match path.extension().and_then(|e| e.to_str()) {
        Some("html") | Some("htm") => "text/html; charset=utf-8",
        Some("css") => "text/css; charset=utf-8",
        Some("js") | Some("mjs") => "application/javascript; charset=utf-8",
        Some("json") => "application/json; charset=utf-8",
        Some("xml") => "application/xml; charset=utf-8",
        Some("txt") => "text/plain; charset=utf-8",
        Some("csv") => "text/csv; charset=utf-8",
        Some("png") => "image/png",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("gif") => "image/gif",
        Some("svg") => "image/svg+xml",
        Some("ico") => "image/x-icon",
        Some("webp") => "image/webp",
        Some("woff") => "font/woff",
        Some("woff2") => "font/woff2",
        Some("ttf") => "font/ttf",
        Some("otf") => "font/otf",
        Some("wasm") => "application/wasm",
        Some("pdf") => "application/pdf",
        Some("zip") => "application/zip",
        Some("gz") | Some("gzip") => "application/gzip",
        Some("mp4") => "video/mp4",
        Some("webm") => "video/webm",
        Some("mp3") => "audio/mpeg",
        Some("ogg") => "audio/ogg",
        _ => "application/octet-stream",
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    /// Create a temp directory with test files and return its path.
    fn setup_test_dir() -> tempfile::TempDir {
        let dir = tempfile::TempDir::new().unwrap();
        fs::write(dir.path().join("index.html"), "<h1>Hello</h1>").unwrap();
        fs::write(dir.path().join("style.css"), "body { color: red; }").unwrap();
        fs::write(dir.path().join("app.js"), "console.log('hi')").unwrap();
        fs::write(dir.path().join("data.json"), r#"{"key":"value"}"#).unwrap();
        fs::write(dir.path().join("image.png"), &[0x89, 0x50, 0x4E, 0x47]).unwrap();
        fs::write(dir.path().join("binary.wasm"), &[0x00, 0x61, 0x73, 0x6D]).unwrap();
        dir
    }

    // Use a module-level tempdir helper since tempfile may not be in deps.
    // We'll use std::env::temp_dir instead.
    mod tempfile {
        use std::path::{Path, PathBuf};

        pub struct TempDir {
            path: PathBuf,
        }

        impl TempDir {
            pub fn new() -> Result<Self, std::io::Error> {
                let mut path = std::env::temp_dir();
                let id = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_nanos();
                path.push(format!("ava-web-test-{id}"));
                std::fs::create_dir_all(&path)?;
                Ok(Self { path })
            }

            pub fn path(&self) -> &Path {
                &self.path
            }
        }

        impl Drop for TempDir {
            fn drop(&mut self) {
                let _ = std::fs::remove_dir_all(&self.path);
            }
        }
    }

    #[test]
    fn serve_html_file() {
        let dir = setup_test_dir();
        let sf = StaticFiles::new(dir.path());
        let resp = sf.serve("/index.html").unwrap();
        assert_eq!(resp.status, StatusCode::OK);
        assert_eq!(
            resp.headers.get("content-type").unwrap(),
            "text/html; charset=utf-8"
        );
        assert_eq!(resp.body.as_ref(), b"<h1>Hello</h1>");
    }

    #[test]
    fn serve_css_file() {
        let dir = setup_test_dir();
        let sf = StaticFiles::new(dir.path());
        let resp = sf.serve("/style.css").unwrap();
        assert_eq!(
            resp.headers.get("content-type").unwrap(),
            "text/css; charset=utf-8"
        );
    }

    #[test]
    fn serve_js_file() {
        let dir = setup_test_dir();
        let sf = StaticFiles::new(dir.path());
        let resp = sf.serve("/app.js").unwrap();
        assert_eq!(
            resp.headers.get("content-type").unwrap(),
            "application/javascript; charset=utf-8"
        );
    }

    #[test]
    fn serve_json_file() {
        let dir = setup_test_dir();
        let sf = StaticFiles::new(dir.path());
        let resp = sf.serve("/data.json").unwrap();
        assert_eq!(
            resp.headers.get("content-type").unwrap(),
            "application/json; charset=utf-8"
        );
    }

    #[test]
    fn serve_binary_png() {
        let dir = setup_test_dir();
        let sf = StaticFiles::new(dir.path());
        let resp = sf.serve("/image.png").unwrap();
        assert_eq!(resp.headers.get("content-type").unwrap(), "image/png");
    }

    #[test]
    fn serve_wasm() {
        let dir = setup_test_dir();
        let sf = StaticFiles::new(dir.path());
        let resp = sf.serve("/binary.wasm").unwrap();
        assert_eq!(
            resp.headers.get("content-type").unwrap(),
            "application/wasm"
        );
    }

    #[test]
    fn etag_header_present() {
        let dir = setup_test_dir();
        let sf = StaticFiles::new(dir.path());
        let resp = sf.serve("/index.html").unwrap();
        assert!(resp.headers.contains_key("etag"));
        let etag = resp.headers.get("etag").unwrap();
        assert!(etag.starts_with('"'));
        assert!(etag.ends_with('"'));
    }

    #[test]
    fn etag_consistent_for_same_content() {
        let dir = setup_test_dir();
        let sf = StaticFiles::new(dir.path());
        let resp1 = sf.serve("/index.html").unwrap();
        let resp2 = sf.serve("/index.html").unwrap();
        assert_eq!(
            resp1.headers.get("etag"),
            resp2.headers.get("etag")
        );
    }

    #[test]
    fn if_none_match_returns_304() {
        let dir = setup_test_dir();
        let sf = StaticFiles::new(dir.path());

        // First request to get the ETag
        let resp1 = sf.serve("/index.html").unwrap();
        let etag = resp1.headers.get("etag").unwrap();

        // Second request with If-None-Match
        let resp2 = sf.serve_with_etag("/index.html", Some(etag)).unwrap();
        assert_eq!(resp2.status, StatusCode::NOT_MODIFIED);
        assert!(resp2.body.is_empty());
    }

    #[test]
    fn if_none_match_mismatch_returns_200() {
        let dir = setup_test_dir();
        let sf = StaticFiles::new(dir.path());
        let resp = sf
            .serve_with_etag("/index.html", Some("\"wrong-etag\""))
            .unwrap();
        assert_eq!(resp.status, StatusCode::OK);
    }

    #[test]
    fn directory_traversal_rejected() {
        let dir = setup_test_dir();
        let sf = StaticFiles::new(dir.path());

        assert!(sf.serve("/../etc/passwd").is_none());
        assert!(sf.serve("/../../etc/shadow").is_none());
        assert!(sf.serve("/..").is_none());
        assert!(sf.serve("/subdir/../../etc/hosts").is_none());
    }

    #[test]
    fn nonexistent_file_returns_none() {
        let dir = setup_test_dir();
        let sf = StaticFiles::new(dir.path());
        assert!(sf.serve("/does-not-exist.txt").is_none());
    }

    #[test]
    fn index_file_fallback() {
        let dir = setup_test_dir();
        let sf = StaticFiles::new(dir.path()).index_file("index.html");
        let resp = sf.serve("/").unwrap();
        assert_eq!(resp.status, StatusCode::OK);
        assert_eq!(resp.body.as_ref(), b"<h1>Hello</h1>");
    }

    #[test]
    fn no_index_file() {
        let dir = setup_test_dir();
        let sf = StaticFiles::new(dir.path()).no_index();
        assert!(sf.serve("/").is_none());
    }

    #[test]
    fn handler_impl_serves_file() {
        let dir = setup_test_dir();
        let sf = StaticFiles::new(dir.path());
        let req = Request::new("GET", "/style.css");
        let fut = sf.call(req);

        // Simple block_on
        let resp = block_on(fut);
        assert_eq!(resp.status, StatusCode::OK);
        assert!(resp.body.len() > 0);
    }

    #[test]
    fn handler_impl_returns_404_for_missing() {
        let dir = setup_test_dir();
        let sf = StaticFiles::new(dir.path());
        let req = Request::new("GET", "/nope.txt");
        let resp = block_on(sf.call(req));
        assert_eq!(resp.status, StatusCode::NOT_FOUND);
    }

    #[test]
    fn handler_if_none_match_from_request() {
        let dir = setup_test_dir();
        let sf = StaticFiles::new(dir.path());

        // Get ETag
        let resp1 = block_on(sf.call(Request::new("GET", "/index.html")));
        let etag = resp1.headers.get("etag").unwrap().to_owned();

        // Send with If-None-Match
        let req2 = Request::new("GET", "/index.html")
            .with_header("if-none-match", etag);
        let resp2 = block_on(sf.call(req2));
        assert_eq!(resp2.status, StatusCode::NOT_MODIFIED);
    }

    #[test]
    fn unknown_extension_returns_octet_stream() {
        let dir = setup_test_dir();
        std::fs::write(dir.path().join("data.xyz"), b"unknown").unwrap();
        let sf = StaticFiles::new(dir.path());
        let resp = sf.serve("/data.xyz").unwrap();
        assert_eq!(
            resp.headers.get("content-type").unwrap(),
            "application/octet-stream"
        );
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
