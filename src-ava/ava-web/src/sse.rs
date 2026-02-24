//! Server-Sent Events (SSE) streaming.
//!
//! Provides the `Sse` and `SseStream` response types for streaming events
//! to clients using the `text/event-stream` content type.
//!
//! # Event Format (per W3C spec)
//!
//! Each event is encoded as:
//! ```text
//! event: <type>\n
//! id: <id>\n
//! retry: <ms>\n
//! data: <line1>\n
//! data: <line2>\n
//! \n
//! ```
//!
//! # Example
//!
//! ```ignore
//! use ava_web::sse::{Event, Sse, SseStream};
//!
//! // Batch mode: all events in one response
//! async fn batch_events() -> Sse {
//!     Sse::new(vec![
//!         Event::new("first event"),
//!         Event::new("second event").event("update").id("2"),
//!     ])
//! }
//!
//! // Stream mode: from an iterator
//! async fn stream_events() -> SseStream<std::vec::IntoIter<Event>> {
//!     let events = vec![
//!         Event::new("tick 1"),
//!         Event::new("tick 2"),
//!         Event::new("tick 3"),
//!     ];
//!     SseStream::new(events.into_iter())
//! }
//! ```

use crate::response::{IntoResponse, Response, StatusCode};
use bytes::Bytes;

// ── Event ─────────────────────────────────────────────────────────────────

/// A Server-Sent Event.
///
/// At minimum, an event has `data`. Optionally, it may have:
/// - `event`: Named event type (client uses `addEventListener(type, ...)`)
/// - `id`: Event ID for `Last-Event-ID` reconnection
/// - `retry`: Reconnection interval in milliseconds
/// - `comment`: Comment line (prefixed with `:`)
#[derive(Debug, Clone)]
pub struct Event {
    /// Event data (required).
    pub data: String,
    /// Event type name (optional).
    pub event: Option<String>,
    /// Event ID for reconnection (optional).
    pub id: Option<String>,
    /// Retry interval in milliseconds (optional).
    pub retry: Option<u64>,
    /// Comment (optional, useful for keepalive).
    pub comment: Option<String>,
}

impl Event {
    /// Create a new event with data.
    pub fn new(data: impl Into<String>) -> Self {
        Self {
            data: data.into(),
            event: None,
            id: None,
            retry: None,
            comment: None,
        }
    }

    /// Create a comment-only event (useful for keepalive).
    ///
    /// Comment events are lines prefixed with `:` and are ignored by
    /// the EventSource API but keep the connection alive.
    pub fn comment(text: impl Into<String>) -> Self {
        Self {
            data: String::new(),
            event: None,
            id: None,
            retry: None,
            comment: Some(text.into()),
        }
    }

    /// Set the event type.
    #[must_use]
    pub fn event(mut self, event: impl Into<String>) -> Self {
        self.event = Some(event.into());
        self
    }

    /// Set the event ID.
    #[must_use]
    pub fn id(mut self, id: impl Into<String>) -> Self {
        self.id = Some(id.into());
        self
    }

    /// Set the retry interval.
    #[must_use]
    pub fn retry(mut self, ms: u64) -> Self {
        self.retry = Some(ms);
        self
    }

    /// Set the event as JSON data.
    ///
    /// Serializes the value to JSON and sets it as the event data.
    /// Returns the original event unchanged if serialization fails.
    #[must_use]
    pub fn json_data<T: serde::Serialize>(mut self, value: &T) -> Self {
        if let Ok(json) = serde_json::to_string(value) {
            self.data = json;
        }
        self
    }

    /// Encode as SSE wire format.
    ///
    /// Produces a string following the W3C Server-Sent Events spec:
    /// - Each field on its own line with `field: value\n`
    /// - Multi-line data split into multiple `data:` lines
    /// - Terminated by an empty line `\n`
    pub fn encode(&self) -> String {
        use std::fmt::Write;

        // Pre-calculate capacity to avoid reallocations.
        let mut cap = 1; // trailing '\n' separator

        if let Some(ref comment) = self.comment {
            // ": " (2) + line + "\n" (1) per line
            for line in comment.lines() {
                cap += 2 + line.len() + 1;
            }
        }

        let has_fields = !self.data.is_empty() || self.event.is_some() || self.id.is_some();
        if has_fields {
            if let Some(ref event) = self.event {
                // "event: " (7) + value + "\n" (1)
                cap += 7 + event.len() + 1;
            }
            if let Some(ref id) = self.id {
                // "id: " (4) + value + "\n" (1)
                cap += 4 + id.len() + 1;
            }
            if self.retry.is_some() {
                // "retry: " (7) + up to 20 digits + "\n" (1)
                cap += 7 + 20 + 1;
            }
            // "data: " (6) + line + "\n" (1) per line
            if self.data.is_empty() {
                // Empty data still won't emit data lines (loop over .lines() yields nothing)
            } else {
                for line in self.data.lines() {
                    cap += 6 + line.len() + 1;
                }
            }
        }

        let mut out = String::with_capacity(cap);

        // Comment lines
        if let Some(ref comment) = self.comment {
            for line in comment.lines() {
                out.push_str(": ");
                out.push_str(line);
                out.push('\n');
            }
        }

        // Only emit event fields if we have data (not a comment-only event)
        if has_fields {
            if let Some(ref event) = self.event {
                out.push_str("event: ");
                out.push_str(event);
                out.push('\n');
            }
            if let Some(ref id) = self.id {
                out.push_str("id: ");
                out.push_str(id);
                out.push('\n');
            }
            if let Some(retry) = self.retry {
                out.push_str("retry: ");
                let _ = write!(out, "{retry}");
                out.push('\n');
            }
            for line in self.data.lines() {
                out.push_str("data: ");
                out.push_str(line);
                out.push('\n');
            }
        }

        // Event separator
        out.push('\n');
        out
    }

    /// Calculate the encoded byte length (useful for Content-Length).
    pub fn encoded_len(&self) -> usize {
        self.encode().len()
    }
}

// ── Sse (batch mode) ──────────────────────────────────────────────────────

/// SSE response that sends all events in a single response body.
///
/// This is the simplest SSE mode -- all events are collected and sent as
/// one response. For true streaming, use `SseStream`.
pub struct Sse {
    events: Vec<Event>,
}

impl Sse {
    /// Create an SSE response from a vec of events.
    pub fn new(events: Vec<Event>) -> Self {
        Self { events }
    }

    /// Create an SSE response from a single event.
    pub fn single(event: Event) -> Self {
        Self {
            events: vec![event],
        }
    }
}

impl IntoResponse for Sse {
    fn into_response(self) -> Response {
        let body: String = self.events.iter().map(Event::encode).collect();
        Response::new(StatusCode::OK, Bytes::from(body))
            .header("content-type", "text/event-stream")
            .header("cache-control", "no-cache")
            .header("connection", "keep-alive")
    }
}

// ── SseStream ─────────────────────────────────────────────────────────────

/// SSE response from an iterator of events.
///
/// Currently operates in batch mode (collects all events from the iterator
/// into the response body). When ava-web gains chunked transfer encoding
/// support, this will stream events incrementally.
///
/// # Type Parameter
///
/// `S` must implement `Iterator<Item = Event>`.
pub struct SseStream<S> {
    stream: S,
    /// Optional keepalive comment to prepend.
    keepalive_comment: Option<String>,
}

impl<S> SseStream<S>
where
    S: Iterator<Item = Event>,
{
    /// Create an SSE stream from an iterator.
    pub fn new(stream: S) -> Self {
        Self {
            stream,
            keepalive_comment: None,
        }
    }

    /// Set a keepalive comment that is sent as the first event.
    ///
    /// This is useful for immediately establishing the connection
    /// without sending actual data.
    #[must_use]
    pub fn with_keepalive(mut self, comment: impl Into<String>) -> Self {
        self.keepalive_comment = Some(comment.into());
        self
    }
}

impl<S> IntoResponse for SseStream<S>
where
    S: Iterator<Item = Event>,
{
    fn into_response(self) -> Response {
        let mut body = String::new();

        // Prepend keepalive comment if set
        if let Some(comment) = self.keepalive_comment {
            body.push_str(&Event::comment(comment).encode());
        }

        // Collect all events
        for event in self.stream {
            body.push_str(&event.encode());
        }

        Response::new(StatusCode::OK, Bytes::from(body))
            .header("content-type", "text/event-stream")
            .header("cache-control", "no-cache")
            .header("connection", "keep-alive")
    }
}

// ── Convenience constructors ──────────────────────────────────────────────

/// Create an SSE response from a vector of events.
pub fn sse(events: Vec<Event>) -> Sse {
    Sse::new(events)
}

/// Create an SSE stream from an iterator.
pub fn sse_stream<I>(iter: I) -> SseStream<I::IntoIter>
where
    I: IntoIterator<Item = Event>,
{
    SseStream::new(iter.into_iter())
}

// ── Tests ─────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    // ── Event encoding tests ──────────────────────────────────────────

    #[test]
    fn event_encode_data_only() {
        let event = Event::new("hello world");
        let encoded = event.encode();
        assert_eq!(encoded, "data: hello world\n\n");
    }

    #[test]
    fn event_encode_with_type() {
        let event = Event::new("payload").event("message");
        let encoded = event.encode();
        assert!(encoded.contains("event: message\n"));
        assert!(encoded.contains("data: payload\n"));
        assert!(encoded.ends_with("\n\n"));
    }

    #[test]
    fn event_encode_with_id() {
        let event = Event::new("data").id("42");
        let encoded = event.encode();
        assert!(encoded.contains("id: 42\n"));
        assert!(encoded.contains("data: data\n"));
    }

    #[test]
    fn event_encode_with_retry() {
        let event = Event::new("data").retry(3000);
        let encoded = event.encode();
        assert!(encoded.contains("retry: 3000\n"));
    }

    #[test]
    fn event_encode_full() {
        let event = Event::new("hello world")
            .event("message")
            .id("1")
            .retry(5000);
        let encoded = event.encode();
        assert!(encoded.contains("event: message\n"));
        assert!(encoded.contains("id: 1\n"));
        assert!(encoded.contains("retry: 5000\n"));
        assert!(encoded.contains("data: hello world\n"));
        assert!(encoded.ends_with("\n\n"));
    }

    #[test]
    fn event_encode_multiline_data() {
        let event = Event::new("line one\nline two\nline three");
        let encoded = event.encode();
        assert!(encoded.contains("data: line one\n"));
        assert!(encoded.contains("data: line two\n"));
        assert!(encoded.contains("data: line three\n"));
    }

    #[test]
    fn event_encode_comment_only() {
        let event = Event::comment("keepalive");
        let encoded = event.encode();
        assert_eq!(encoded, ": keepalive\n\n");
    }

    #[test]
    fn event_encode_comment_multiline() {
        let event = Event::comment("line 1\nline 2");
        let encoded = event.encode();
        assert!(encoded.contains(": line 1\n"));
        assert!(encoded.contains(": line 2\n"));
    }

    #[test]
    fn event_json_data() {
        #[derive(serde::Serialize)]
        struct Msg {
            text: String,
        }
        let event = Event::new("").json_data(&Msg {
            text: "hello".into(),
        });
        assert!(event.data.contains("\"text\":\"hello\""));
    }

    #[test]
    fn event_encoded_len() {
        let event = Event::new("test");
        assert_eq!(event.encoded_len(), event.encode().len());
    }

    // ── Sse batch response tests ──────────────────────────────────────

    #[test]
    fn sse_into_response_headers() {
        let sse = Sse::new(vec![Event::new("test")]);
        let resp = sse.into_response();
        assert_eq!(resp.status, StatusCode::OK);
        assert_eq!(
            resp.headers.get("content-type").unwrap(),
            "text/event-stream"
        );
        assert_eq!(resp.headers.get("cache-control").unwrap(), "no-cache");
        assert_eq!(resp.headers.get("connection").unwrap(), "keep-alive");
    }

    #[test]
    fn sse_into_response_body() {
        let sse = Sse::new(vec![
            Event::new("first"),
            Event::new("second").event("update"),
        ]);
        let resp = sse.into_response();
        let body = std::str::from_utf8(&resp.body).unwrap();
        assert!(body.contains("data: first\n"));
        assert!(body.contains("event: update\n"));
        assert!(body.contains("data: second\n"));
    }

    #[test]
    fn sse_single() {
        let sse = Sse::single(Event::new("only one"));
        let resp = sse.into_response();
        let body = std::str::from_utf8(&resp.body).unwrap();
        assert!(body.contains("data: only one\n"));
    }

    // ── SseStream tests ───────────────────────────────────────────────

    #[test]
    fn sse_stream_into_response_headers() {
        let events = vec![Event::new("a"), Event::new("b")];
        let stream = SseStream::new(events.into_iter());
        let resp = stream.into_response();
        assert_eq!(resp.status, StatusCode::OK);
        assert_eq!(
            resp.headers.get("content-type").unwrap(),
            "text/event-stream"
        );
        assert_eq!(resp.headers.get("cache-control").unwrap(), "no-cache");
        assert_eq!(resp.headers.get("connection").unwrap(), "keep-alive");
    }

    #[test]
    fn sse_stream_into_response_body() {
        let events = vec![
            Event::new("tick 1").id("1"),
            Event::new("tick 2").id("2"),
            Event::new("tick 3").id("3"),
        ];
        let stream = SseStream::new(events.into_iter());
        let resp = stream.into_response();
        let body = std::str::from_utf8(&resp.body).unwrap();
        assert!(body.contains("data: tick 1\n"));
        assert!(body.contains("id: 1\n"));
        assert!(body.contains("data: tick 2\n"));
        assert!(body.contains("id: 2\n"));
        assert!(body.contains("data: tick 3\n"));
        assert!(body.contains("id: 3\n"));
    }

    #[test]
    fn sse_stream_with_keepalive() {
        let events = vec![Event::new("data")];
        let stream = SseStream::new(events.into_iter()).with_keepalive("connected");
        let resp = stream.into_response();
        let body = std::str::from_utf8(&resp.body).unwrap();
        // Keepalive comment should come first
        assert!(body.starts_with(": connected\n"));
        assert!(body.contains("data: data\n"));
    }

    #[test]
    fn sse_stream_empty_iterator() {
        let events: Vec<Event> = vec![];
        let stream = SseStream::new(events.into_iter());
        let resp = stream.into_response();
        assert!(resp.body.is_empty());
    }

    // ── Convenience function tests ────────────────────────────────────

    #[test]
    fn sse_convenience_fn() {
        let resp = sse(vec![Event::new("test")]).into_response();
        assert_eq!(
            resp.headers.get("content-type").unwrap(),
            "text/event-stream"
        );
    }

    #[test]
    fn sse_stream_convenience_fn() {
        let events = vec![Event::new("a"), Event::new("b")];
        let resp = sse_stream(events).into_response();
        let body = std::str::from_utf8(&resp.body).unwrap();
        assert!(body.contains("data: a\n"));
        assert!(body.contains("data: b\n"));
    }
}
