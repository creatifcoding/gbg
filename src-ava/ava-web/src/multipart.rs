//! Multipart form/file upload parsing.
//!
//! Parses `multipart/form-data` request bodies per RFC 7578.
//! Supports field name extraction, filename detection, and
//! per-part content-type headers.

use bytes::Bytes;
use std::fmt;

use crate::extractor::{ExtractionError, FromRequest, Request};
use crate::response::StatusCode;

// ── Error ─────────────────────────────────────────────────────────────────

/// Errors during multipart parsing.
#[derive(Debug, Clone)]
pub enum MultipartError {
    /// Content-Type header missing `boundary` parameter.
    MissingBoundary,
    /// Boundary parameter is empty or malformed.
    InvalidBoundary,
    /// A part lacks required Content-Disposition header or field name.
    MalformedPart,
    /// Body ended before final boundary marker.
    IncompleteBody,
}

impl fmt::Display for MultipartError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::MissingBoundary => write!(f, "missing boundary in Content-Type"),
            Self::InvalidBoundary => write!(f, "invalid boundary value"),
            Self::MalformedPart => write!(f, "malformed multipart part"),
            Self::IncompleteBody => write!(f, "incomplete multipart body"),
        }
    }
}

impl std::error::Error for MultipartError {}

// ── Field ─────────────────────────────────────────────────────────────────

/// A multipart form field.
#[derive(Debug, Clone)]
pub struct Field {
    /// Field name from Content-Disposition.
    pub name: String,
    /// Filename if present (file uploads).
    pub filename: Option<String>,
    /// Content-Type of the field.
    pub content_type: Option<String>,
    /// Field data.
    pub data: Bytes,
}

// ── Multipart ─────────────────────────────────────────────────────────────

/// Multipart form extractor.
///
/// Parses `multipart/form-data` request bodies.
///
/// # Example
///
/// ```ignore
/// use ava_web::multipart::Multipart;
///
/// fn handle(mp: Multipart) {
///     for field in mp.iter() {
///         println!("{}: {} bytes", field.name, field.data.len());
///     }
/// }
/// ```
#[derive(Debug)]
pub struct Multipart {
    /// Parsed fields.
    pub fields: Vec<Field>,
}

impl Multipart {
    /// Parse multipart/form-data from Content-Type header and body bytes.
    ///
    /// This copies field data. For zero-copy parsing, use [`parse_bytes`].
    pub fn parse(content_type: &str, body: &[u8]) -> Result<Self, MultipartError> {
        let boundary = extract_boundary(content_type)?;
        let fields = parse_parts(body, &boundary)?;
        Ok(Self { fields })
    }

    /// Parse multipart/form-data with zero-copy field data.
    ///
    /// Field `data` is a `Bytes::slice()` into the original buffer —
    /// no memcpy for large uploads.
    pub fn parse_bytes(content_type: &str, body: Bytes) -> Result<Self, MultipartError> {
        let boundary = extract_boundary(content_type)?;
        let fields = parse_parts_zerocopy(&body, &boundary)?;
        Ok(Self { fields })
    }

    /// Get a field by name.
    #[must_use]
    pub fn field(&self, name: &str) -> Option<&Field> {
        self.fields.iter().find(|f| f.name == name)
    }

    /// Iterator over fields.
    pub fn iter(&self) -> impl Iterator<Item = &Field> {
        self.fields.iter()
    }
}

impl FromRequest for Multipart {
    fn from_request(req: Request) -> Result<Self, ExtractionError> {
        let content_type = req
            .headers
            .get("content-type")
            .map(str::to_owned)
            .ok_or_else(|| ExtractionError::bad_request("missing Content-Type header"))?;

        if !content_type.contains("multipart/form-data") {
            return Err(ExtractionError::new(
                StatusCode::UNSUPPORTED_MEDIA_TYPE,
                format!("expected multipart/form-data, got {content_type}"),
            ));
        }

        Self::parse_bytes(&content_type, req.body)
            .map_err(|e| ExtractionError::bad_request(e.to_string()))
    }
}

// ── Internal Parsing ──────────────────────────────────────────────────────

/// Extract boundary string from Content-Type header.
fn extract_boundary(content_type: &str) -> Result<String, MultipartError> {
    // Content-Type: multipart/form-data; boundary=----WebKitFormBoundary...
    for part in content_type.split(';') {
        let trimmed = part.trim();
        if let Some(value) = trimmed.strip_prefix("boundary=") {
            let boundary = value.trim().trim_matches('"');
            if boundary.is_empty() {
                return Err(MultipartError::InvalidBoundary);
            }
            return Ok(boundary.to_string());
        }
    }
    Err(MultipartError::MissingBoundary)
}

/// Parse body into fields by splitting on boundary markers.
fn parse_parts(body: &[u8], boundary: &str) -> Result<Vec<Field>, MultipartError> {
    let delimiter = format!("--{boundary}");
    let end_marker = format!("--{boundary}--");

    // Find all boundary positions
    let body_str = body;
    let delim_bytes = delimiter.as_bytes();
    let end_bytes = end_marker.as_bytes();

    // Check for end marker presence
    if !contains_bytes(body_str, end_bytes) {
        return Err(MultipartError::IncompleteBody);
    }

    // Split by delimiter
    let parts = split_by_boundary(body_str, delim_bytes);
    let mut fields = Vec::new();

    for part in parts {
        // Skip preamble (before first boundary) and epilogue/end marker
        if part.is_empty() || part.starts_with(b"--") {
            continue;
        }

        // Each part starts with \r\n after boundary, then headers, then \r\n\r\n, then data
        let part = strip_leading_crlf(part);

        if let Some(field) = parse_single_part(part)? {
            fields.push(field);
        }
    }

    Ok(fields)
}

/// Zero-copy variant: fields reference the original Bytes buffer via slice().
fn parse_parts_zerocopy(body: &Bytes, boundary: &str) -> Result<Vec<Field>, MultipartError> {
    let delimiter = format!("--{boundary}");
    let end_marker = format!("--{boundary}--");

    let delim_bytes = delimiter.as_bytes();
    let end_bytes = end_marker.as_bytes();

    if !contains_bytes(body, end_bytes) {
        return Err(MultipartError::IncompleteBody);
    }

    let parts = split_by_boundary(body, delim_bytes);
    let body_base = body.as_ptr() as usize;
    let mut fields = Vec::new();

    for part in parts {
        if part.is_empty() || part.starts_with(b"--") {
            continue;
        }

        let part = strip_leading_crlf(part);

        if let Some(field) = parse_single_part_zerocopy(part, body, body_base)? {
            fields.push(field);
        }
    }

    Ok(fields)
}

/// Zero-copy single part parser — uses Bytes::slice() for field data.
fn parse_single_part_zerocopy(
    part: &[u8],
    body: &Bytes,
    body_base: usize,
) -> Result<Option<Field>, MultipartError> {
    let separator = b"\r\n\r\n";
    let sep_pos = match find_bytes(part, separator) {
        Some(pos) => pos,
        None => {
            let sep2 = b"\n\n";
            match find_bytes(part, sep2) {
                Some(pos) => {
                    let headers_bytes = &part[..pos];
                    let body_data = &part[pos + 2..];
                    let body_data = strip_trailing_crlf(body_data);
                    return parse_headers_and_build_zerocopy(headers_bytes, body_data, body, body_base);
                }
                None => return Ok(None),
            }
        }
    };

    let headers_bytes = &part[..sep_pos];
    let body_data = &part[sep_pos + 4..];
    let body_data = strip_trailing_crlf(body_data);

    parse_headers_and_build_zerocopy(headers_bytes, body_data, body, body_base)
}

/// Build a Field with zero-copy data via Bytes::slice().
fn parse_headers_and_build_zerocopy(
    headers_bytes: &[u8],
    body_data: &[u8],
    body: &Bytes,
    body_base: usize,
) -> Result<Option<Field>, MultipartError> {
    let headers_str = std::str::from_utf8(headers_bytes).map_err(|_| MultipartError::MalformedPart)?;

    let mut name: Option<String> = None;
    let mut filename: Option<String> = None;
    let mut content_type: Option<String> = None;

    for line in headers_str.split('\n') {
        let line = line.trim_end_matches('\r').trim();
        if line.is_empty() {
            continue;
        }

        let lower = line.to_lowercase();
        if lower.starts_with("content-disposition:") {
            let value = &line["content-disposition:".len()..].trim();
            name = extract_param(value, "name");
            filename = extract_param(value, "filename");
        } else if lower.starts_with("content-type:") {
            content_type = Some(line["content-type:".len()..].trim().to_string());
        }
    }

    let field_name = match name {
        Some(n) => n,
        None => return Err(MultipartError::MalformedPart),
    };

    // Zero-copy: compute offset into original Bytes buffer and slice
    let data = if body_data.is_empty() {
        Bytes::new()
    } else {
        let offset = body_data.as_ptr() as usize - body_base;
        body.slice(offset..offset + body_data.len())
    };

    Ok(Some(Field {
        name: field_name,
        filename,
        content_type,
        data,
    }))
}

/// Boyer-Moore-Horspool bad-character skip table for O(n/m) average search.
struct BMHSearcher {
    needle: Vec<u8>,
    skip: [usize; 256],
}

impl BMHSearcher {
    /// Build a skip table for the given needle.
    fn new(needle: &[u8]) -> Self {
        let len = needle.len();
        let mut skip = [len; 256];
        // Last byte excluded — its skip stays at needle.len() (full shift)
        for (i, &b) in needle[..len.saturating_sub(1)].iter().enumerate() {
            skip[b as usize] = len - 1 - i;
        }
        Self {
            needle: needle.to_vec(),
            skip,
        }
    }

    /// Find first occurrence of needle in haystack. O(n/m) average.
    fn find_in(&self, haystack: &[u8]) -> Option<usize> {
        let n = haystack.len();
        let m = self.needle.len();
        if m == 0 || m > n {
            return None;
        }

        let mut i = m - 1;
        while i < n {
            let mut j = m - 1;
            let mut k = i;
            while haystack[k] == self.needle[j] {
                if j == 0 {
                    return Some(k);
                }
                j -= 1;
                k -= 1;
            }
            i += self.skip[haystack[i] as usize];
        }
        None
    }
}

/// Check if haystack contains needle.
fn contains_bytes(haystack: &[u8], needle: &[u8]) -> bool {
    if needle.len() > haystack.len() {
        return false;
    }
    find_bytes(haystack, needle).is_some()
}

/// Split body bytes by boundary delimiter.
/// Builds the BMH skip table once and reuses it for every scan.
fn split_by_boundary<'a>(body: &'a [u8], delimiter: &[u8]) -> Vec<&'a [u8]> {
    let searcher = BMHSearcher::new(delimiter);
    let mut parts = Vec::new();
    let mut start = 0;

    while start <= body.len() {
        if let Some(pos) = searcher.find_in(&body[start..]) {
            parts.push(&body[start..start + pos]);
            start += pos + delimiter.len();
        } else {
            parts.push(&body[start..]);
            break;
        }
    }

    parts
}

/// Find needle position in haystack using Boyer-Moore-Horspool.
fn find_bytes(haystack: &[u8], needle: &[u8]) -> Option<usize> {
    if needle.is_empty() || needle.len() > haystack.len() {
        return None;
    }
    BMHSearcher::new(needle).find_in(haystack)
}

/// Strip leading \r\n from a byte slice.
fn strip_leading_crlf(data: &[u8]) -> &[u8] {
    if data.starts_with(b"\r\n") {
        &data[2..]
    } else if data.starts_with(b"\n") {
        &data[1..]
    } else {
        data
    }
}

/// Parse a single part (headers + body) into a Field.
fn parse_single_part(part: &[u8]) -> Result<Option<Field>, MultipartError> {
    // Find header/body separator: \r\n\r\n
    let separator = b"\r\n\r\n";
    let sep_pos = match find_bytes(part, separator) {
        Some(pos) => pos,
        None => {
            // Try \n\n for lenient parsing
            let sep2 = b"\n\n";
            match find_bytes(part, sep2) {
                Some(pos) => {
                    let headers_bytes = &part[..pos];
                    let body_data = &part[pos + 2..];
                    let body_data = strip_trailing_crlf(body_data);
                    return parse_headers_and_build(headers_bytes, body_data);
                }
                None => return Ok(None),
            }
        }
    };

    let headers_bytes = &part[..sep_pos];
    let body_data = &part[sep_pos + 4..];
    let body_data = strip_trailing_crlf(body_data);

    parse_headers_and_build(headers_bytes, body_data)
}

/// Strip trailing \r\n from body data.
fn strip_trailing_crlf(data: &[u8]) -> &[u8] {
    if data.ends_with(b"\r\n") {
        &data[..data.len() - 2]
    } else if data.ends_with(b"\n") {
        &data[..data.len() - 1]
    } else {
        data
    }
}

/// Parse headers and build a Field.
fn parse_headers_and_build(headers_bytes: &[u8], body_data: &[u8]) -> Result<Option<Field>, MultipartError> {
    let headers_str = std::str::from_utf8(headers_bytes).map_err(|_| MultipartError::MalformedPart)?;

    let mut name: Option<String> = None;
    let mut filename: Option<String> = None;
    let mut content_type: Option<String> = None;

    for line in headers_str.split('\n') {
        let line = line.trim_end_matches('\r').trim();
        if line.is_empty() {
            continue;
        }

        let lower = line.to_lowercase();
        if lower.starts_with("content-disposition:") {
            let value = &line["content-disposition:".len()..].trim();
            name = extract_param(value, "name");
            filename = extract_param(value, "filename");
        } else if lower.starts_with("content-type:") {
            content_type = Some(line["content-type:".len()..].trim().to_string());
        }
    }

    let field_name = match name {
        Some(n) => n,
        None => return Err(MultipartError::MalformedPart),
    };

    Ok(Some(Field {
        name: field_name,
        filename,
        content_type,
        data: Bytes::copy_from_slice(body_data),
    }))
}

/// Extract a named parameter from a Content-Disposition value.
///
/// Handles: `form-data; name="field1"; filename="file.txt"`
fn extract_param(header_value: &str, param_name: &str) -> Option<String> {
    let search = format!("{param_name}=");
    for part in header_value.split(';') {
        let trimmed = part.trim();
        if let Some(rest) = trimmed.strip_prefix(&search) {
            let value = rest.trim().trim_matches('"');
            return Some(value.to_string());
        }
    }
    None
}

// ── Tests ─────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::extractor::Request;

    fn make_multipart_body(boundary: &str, fields: &[(&str, Option<&str>, &[u8])]) -> Vec<u8> {
        let mut body = Vec::new();
        for (name, filename, data) in fields {
            body.extend_from_slice(format!("--{boundary}\r\n").as_bytes());
            if let Some(fname) = filename {
                body.extend_from_slice(
                    format!("Content-Disposition: form-data; name=\"{name}\"; filename=\"{fname}\"\r\n")
                        .as_bytes(),
                );
                body.extend_from_slice(b"Content-Type: application/octet-stream\r\n");
            } else {
                body.extend_from_slice(
                    format!("Content-Disposition: form-data; name=\"{name}\"\r\n").as_bytes(),
                );
            }
            body.extend_from_slice(b"\r\n");
            body.extend_from_slice(data);
            body.extend_from_slice(b"\r\n");
        }
        body.extend_from_slice(format!("--{boundary}--\r\n").as_bytes());
        body
    }

    #[test]
    fn parse_simple_text_fields() {
        let boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW";
        let body = make_multipart_body(boundary, &[
            ("field1", None, b"value1"),
            ("field2", None, b"value2"),
        ]);
        let ct = format!("multipart/form-data; boundary={boundary}");
        let mp = Multipart::parse(&ct, &body).unwrap();
        assert_eq!(mp.fields.len(), 2);
        assert_eq!(mp.field("field1").unwrap().data.as_ref(), b"value1");
        assert_eq!(mp.field("field2").unwrap().data.as_ref(), b"value2");
    }

    #[test]
    fn parse_file_upload() {
        let boundary = "abc123";
        let body = make_multipart_body(boundary, &[
            ("document", Some("report.pdf"), b"PDF-CONTENT-HERE"),
        ]);
        let ct = format!("multipart/form-data; boundary={boundary}");
        let mp = Multipart::parse(&ct, &body).unwrap();
        assert_eq!(mp.fields.len(), 1);
        let field = mp.field("document").unwrap();
        assert_eq!(field.filename.as_deref(), Some("report.pdf"));
        assert_eq!(field.content_type.as_deref(), Some("application/octet-stream"));
        assert_eq!(field.data.as_ref(), b"PDF-CONTENT-HERE");
    }

    #[test]
    fn parse_mixed_fields_and_files() {
        let boundary = "boundary-mixed";
        let body = make_multipart_body(boundary, &[
            ("title", None, b"My Document"),
            ("file", Some("data.csv"), b"a,b,c\n1,2,3\n"),
            ("description", None, b"A test file"),
        ]);
        let ct = format!("multipart/form-data; boundary={boundary}");
        let mp = Multipart::parse(&ct, &body).unwrap();
        assert_eq!(mp.fields.len(), 3);
        assert_eq!(mp.field("title").unwrap().data.as_ref(), b"My Document");
        assert!(mp.field("file").unwrap().filename.is_some());
        assert_eq!(mp.field("description").unwrap().data.as_ref(), b"A test file");
    }

    #[test]
    fn iter_fields() {
        let boundary = "iter-test";
        let body = make_multipart_body(boundary, &[
            ("a", None, b"1"),
            ("b", None, b"2"),
            ("c", None, b"3"),
        ]);
        let ct = format!("multipart/form-data; boundary={boundary}");
        let mp = Multipart::parse(&ct, &body).unwrap();
        let names: Vec<&str> = mp.iter().map(|f| f.name.as_str()).collect();
        assert_eq!(names, vec!["a", "b", "c"]);
    }

    #[test]
    fn missing_boundary_error() {
        let ct = "multipart/form-data";
        let err = Multipart::parse(ct, b"irrelevant").unwrap_err();
        assert!(matches!(err, MultipartError::MissingBoundary));
    }

    #[test]
    fn empty_boundary_error() {
        let ct = "multipart/form-data; boundary=";
        let err = Multipart::parse(ct, b"irrelevant").unwrap_err();
        assert!(matches!(err, MultipartError::InvalidBoundary));
    }

    #[test]
    fn incomplete_body_error() {
        let ct = "multipart/form-data; boundary=abc";
        // Body without end marker --abc--
        let body = b"--abc\r\nContent-Disposition: form-data; name=\"x\"\r\n\r\ndata";
        let err = Multipart::parse(ct, body).unwrap_err();
        assert!(matches!(err, MultipartError::IncompleteBody));
    }

    #[test]
    fn malformed_part_no_name() {
        let boundary = "bad";
        let mut body = Vec::new();
        body.extend_from_slice(b"--bad\r\n");
        body.extend_from_slice(b"Content-Disposition: form-data\r\n"); // no name=
        body.extend_from_slice(b"\r\n");
        body.extend_from_slice(b"data\r\n");
        body.extend_from_slice(b"--bad--\r\n");

        let ct = format!("multipart/form-data; boundary={boundary}");
        let err = Multipart::parse(&ct, &body).unwrap_err();
        assert!(matches!(err, MultipartError::MalformedPart));
    }

    #[test]
    fn boundary_with_quotes() {
        let ct = "multipart/form-data; boundary=\"quoted-boundary\"";
        let body = make_multipart_body("quoted-boundary", &[
            ("key", None, b"val"),
        ]);
        let mp = Multipart::parse(ct, &body).unwrap();
        assert_eq!(mp.fields.len(), 1);
    }

    #[test]
    fn from_request_extraction() {
        let boundary = "extract-test";
        let body = make_multipart_body(boundary, &[
            ("user", None, b"alice"),
        ]);
        let req = Request::new("POST", "/upload")
            .with_header("content-type", format!("multipart/form-data; boundary={boundary}"))
            .with_body(Bytes::from(body));
        let mp = Multipart::from_request(req).unwrap();
        assert_eq!(mp.field("user").unwrap().data.as_ref(), b"alice");
    }

    #[test]
    fn from_request_wrong_content_type() {
        let req = Request::new("POST", "/upload")
            .with_header("content-type", "application/json")
            .with_body(Bytes::from_static(b"{}"));
        let err = Multipart::from_request(req).unwrap_err();
        assert_eq!(err.status, StatusCode::UNSUPPORTED_MEDIA_TYPE);
    }

    #[test]
    fn from_request_missing_content_type() {
        let req = Request::new("POST", "/upload").with_body(Bytes::from_static(b"data"));
        let err = Multipart::from_request(req).unwrap_err();
        assert_eq!(err.status, StatusCode::BAD_REQUEST);
    }

    #[test]
    fn binary_data_preserved() {
        let boundary = "bin-test";
        let binary_data: Vec<u8> = (0..=255).collect();
        let body = make_multipart_body(boundary, &[
            ("binary", Some("data.bin"), &binary_data),
        ]);
        let ct = format!("multipart/form-data; boundary={boundary}");
        let mp = Multipart::parse(&ct, &body).unwrap();
        assert_eq!(mp.field("binary").unwrap().data.as_ref(), &binary_data[..]);
    }

    #[test]
    fn field_not_found_returns_none() {
        let boundary = "none-test";
        let body = make_multipart_body(boundary, &[("exists", None, b"yes")]);
        let ct = format!("multipart/form-data; boundary={boundary}");
        let mp = Multipart::parse(&ct, &body).unwrap();
        assert!(mp.field("nonexistent").is_none());
    }
}
