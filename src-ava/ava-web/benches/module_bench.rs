//! SSE, WebSocket, and Static Files benchmarks.
//!
//! Measures per-module hot paths:
//! - SSE event encoding and batch serialization
//! - WebSocket upgrade detection and message construction
//! - Static file traversal checks, ETag computation, and MIME detection

use criterion::{black_box, criterion_group, criterion_main, BenchmarkId, Criterion};
use std::path::Path;

use ava_web::extractor::Request;
use ava_web::sse::Event;
use ava_web::static_files::{compute_etag, contains_traversal, mime_from_path};
use ava_web::ws::{WebSocketUpgrade, WsMessage};

// ── SSE Event Encoding ──────────────────────────────────────────────────────

fn bench_sse_event_encode(c: &mut Criterion) {
    let mut group = c.benchmark_group("sse/event_encode");

    // Data-only short event
    group.bench_function("data_only_short", |b| {
        let event = Event::new("hello world");
        b.iter(|| {
            let _ = black_box(event.encode());
        });
    });

    // Full fields: event type + id + retry + data
    group.bench_function("full_fields", |b| {
        let event = Event::new("hello world")
            .event("message")
            .id("42")
            .retry(5000);
        b.iter(|| {
            let _ = black_box(event.encode());
        });
    });

    // Multiline: 10-line data field (tests per-line String::push_str)
    group.bench_function("multiline_10_lines", |b| {
        let data = (0..10)
            .map(|i| format!("line {i}: some payload data here"))
            .collect::<Vec<_>>()
            .join("\n");
        let event = Event::new(data);
        b.iter(|| {
            let _ = black_box(event.encode());
        });
    });

    // JSON data field
    group.bench_function("json_data_field", |b| {
        #[derive(serde::Serialize)]
        struct Msg {
            action: &'static str,
            user_id: u64,
            timestamp: u64,
        }
        let payload = Msg {
            action: "login",
            user_id: 42,
            timestamp: 1700000000,
        };
        b.iter(|| {
            let event = Event::new("").json_data(black_box(&payload));
            let _ = black_box(event.encode());
        });
    });

    group.finish();
}

fn bench_sse_batch_encode(c: &mut Criterion) {
    let mut group = c.benchmark_group("sse/batch_encode");

    for count in [10, 100, 1000] {
        let events: Vec<Event> = (0..count)
            .map(|i| {
                Event::new(format!("event data payload {i}"))
                    .event("update")
                    .id(&i.to_string())
            })
            .collect();

        group.bench_with_input(
            BenchmarkId::new("events", count),
            &count,
            |b, _| {
                b.iter(|| {
                    let encoded: String = events.iter().map(Event::encode).collect();
                    let _ = black_box(encoded);
                });
            },
        );
    }

    group.finish();
}

// ── WebSocket ───────────────────────────────────────────────────────────────

fn bench_ws_upgrade(c: &mut Criterion) {
    let mut group = c.benchmark_group("ws/upgrade");

    // Plain GET request, no upgrade headers (most common hot path)
    group.bench_function("is_upgrade_false", |b| {
        let req = Request::new("GET", "/api/users");
        b.iter(|| {
            let _ = black_box(WebSocketUpgrade::is_upgrade_request(black_box(&req)));
        });
    });

    // Valid upgrade headers present
    group.bench_function("is_upgrade_true", |b| {
        let req = Request::new("GET", "/ws")
            .with_header("connection", "Upgrade")
            .with_header("upgrade", "websocket")
            .with_header("sec-websocket-version", "13")
            .with_header("sec-websocket-key", "dGhlIHNhbXBsZSBub25jZQ==");
        b.iter(|| {
            let _ = black_box(WebSocketUpgrade::is_upgrade_request(black_box(&req)));
        });
    });

    group.finish();
}

fn bench_ws_message(c: &mut Criterion) {
    let mut group = c.benchmark_group("ws/message");

    // Short text
    group.bench_function("text_short", |b| {
        b.iter(|| {
            let _ = black_box(WsMessage::text(black_box("hello")));
        });
    });

    // 1KB text
    group.bench_function("text_1kb", |b| {
        let text = "x".repeat(1024);
        b.iter(|| {
            let _ = black_box(WsMessage::text(black_box(text.clone())));
        });
    });

    // 1KB binary
    group.bench_function("binary_1kb", |b| {
        let data = vec![0xABu8; 1024];
        b.iter(|| {
            let _ = black_box(WsMessage::binary(black_box(data.clone())));
        });
    });

    // 64KB binary
    group.bench_function("binary_64kb", |b| {
        let data = vec![0xABu8; 65536];
        b.iter(|| {
            let _ = black_box(WsMessage::binary(black_box(data.clone())));
        });
    });

    group.finish();
}

// ── Static Files (pure computation, no I/O) ─────────────────────────────────

fn bench_static_files_traversal(c: &mut Criterion) {
    let mut group = c.benchmark_group("static_files/traversal");

    group.bench_function("clean_path", |b| {
        b.iter(|| {
            let _ = black_box(contains_traversal(black_box("/index.html")));
        });
    });

    group.bench_function("deep_clean", |b| {
        b.iter(|| {
            let _ = black_box(contains_traversal(black_box("/a/b/c/d/e/f.html")));
        });
    });

    group.bench_function("attack_dotdot", |b| {
        b.iter(|| {
            let _ = black_box(contains_traversal(black_box("/../../../etc/passwd")));
        });
    });

    group.bench_function("attack_backslash", |b| {
        b.iter(|| {
            let _ = black_box(contains_traversal(black_box("\\..\\..\\etc\\passwd")));
        });
    });

    group.finish();
}

fn bench_static_files_etag(c: &mut Criterion) {
    let mut group = c.benchmark_group("static_files/etag");

    for (label, size) in [
        ("compute_512b", 512),
        ("compute_4kb", 4096),
        ("compute_64kb", 65536),
        ("compute_1mb", 1_048_576),
    ] {
        let content = vec![0x42u8; size];
        group.bench_function(label, |b| {
            b.iter(|| {
                let _ = black_box(compute_etag(black_box(&content)));
            });
        });
    }

    group.finish();
}

fn bench_static_files_mime(c: &mut Criterion) {
    let mut group = c.benchmark_group("static_files/mime");

    group.bench_function("known_html", |b| {
        let path = Path::new("index.html");
        b.iter(|| {
            let _ = black_box(mime_from_path(black_box(path)));
        });
    });

    group.bench_function("known_wasm", |b| {
        let path = Path::new("module.wasm");
        b.iter(|| {
            let _ = black_box(mime_from_path(black_box(path)));
        });
    });

    group.bench_function("unknown_xyz", |b| {
        let path = Path::new("data.xyz");
        b.iter(|| {
            let _ = black_box(mime_from_path(black_box(path)));
        });
    });

    group.finish();
}

// ── Criterion harness ───────────────────────────────────────────────────────

criterion_group!(
    benches,
    bench_sse_event_encode,
    bench_sse_batch_encode,
    bench_ws_upgrade,
    bench_ws_message,
    bench_static_files_traversal,
    bench_static_files_etag,
    bench_static_files_mime,
);
criterion_main!(benches);
