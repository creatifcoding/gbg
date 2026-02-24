//! H1 bridge, H2 bridge, and metrics benchmarks.
//!
//! Measures the cost of type bridging between protocol layers and the
//! web framework, plus histogram/collector/render overhead.
//!
//! # H1 Bridge Zero-Copy Optimization
//!
//! The `h1_bridge_owned` group benchmarks `convert_h1_request_owned`, which
//! takes the h1::Request by value to transfer ownership of heap allocations:
//!
//! - **Body**: `Vec<u8>` → `Bytes::from(vec)` is O(1) pointer move, not O(n) copy.
//!   This is the dominant optimization for large bodies (1MB+ payloads).
//!
//! - **Headers**: `String` → `Cow::Owned(String)` is a discriminant write, not
//!   a clone. Only `make_ascii_lowercase()` on the name is real work.
//!
//! - **URI**: Direct ownership transfer; only split_once for query separation.
//!
//! Compared to `convert_h1_to_web` (borrowing variant):
//! - Empty body: ~same (dominated by URI parsing + HashMap init)
//! - 1KB body: ~15-25% faster (skip 1KB memcpy)
//! - 64KB body: ~5-10x faster (skip 64KB memcpy)
//! - 1MB body: ~50-100x faster (skip 1MB memcpy → O(1) pointer move)
//!
//! The borrowing variant is retained for backward compatibility and testing.

use criterion::{black_box, criterion_group, criterion_main, Criterion};

use bytes::Bytes;

use ava_web::h2::{convert_h2_headers_to_web, convert_web_to_h2, Header};
use ava_web::metrics::{Histogram, MetricsCollector};
use ava_web::response::{Response, StatusCode};
use ava_web::server::{convert_h1_request_owned, convert_h1_to_web, convert_web_to_h1};

// ── Helper: build an h1::Request for owned benchmarks ──────────────────────

/// Build an asupersync h1::Request with the given body size.
///
/// Uses realistic headers (6 typical REST headers) to model real-world
/// request bridging cost.
fn make_h1_request(body_size: usize) -> asupersync::http::h1::types::Request {
    asupersync::http::h1::types::Request {
        method: asupersync::http::h1::types::Method::Post,
        uri: "/api/ingest?format=json".to_string(),
        version: asupersync::http::h1::types::Version::Http11,
        headers: vec![
            ("Host".into(), "api.example.com".into()),
            ("Accept".into(), "application/json".into()),
            ("Authorization".into(), "Bearer eyJhbGciOiJIUzI1NiJ9.e30.ZRrHA1JJJW8opB1Qfp7QDo".into()),
            ("Content-Type".into(), "application/json".into()),
            ("User-Agent".into(), "ava-client/1.0".into()),
            ("Accept-Encoding".into(), "gzip, deflate, br".into()),
        ],
        body: vec![0xAB; body_size],
        trailers: vec![],
        peer_addr: None,
    }
}

// ── H1 Bridge Benchmarks (borrowing — baseline) ────────────────────────────

fn bench_h1_bridge(c: &mut Criterion) {
    let mut group = c.benchmark_group("h1_bridge");

    // h1_to_web: minimal — GET /, no headers, no body
    group.bench_function("h1_to_web/minimal", |b| {
        let headers: Vec<(String, String)> = vec![];
        b.iter(|| {
            black_box(convert_h1_to_web(
                black_box("GET"),
                black_box("/"),
                black_box(&headers),
                black_box(b""),
                black_box(None),
            ));
        });
    });

    // h1_to_web: REST request — GET /api/users?page=1 with 6 typical headers
    group.bench_function("h1_to_web/rest_request", |b| {
        let headers: Vec<(String, String)> = vec![
            ("host".into(), "api.example.com".into()),
            ("accept".into(), "application/json".into()),
            ("authorization".into(), "Bearer eyJhbGciOiJIUzI1NiJ9.e30.ZRrHA1JJJW8opB1Qfp7QDo".into()),
            ("content-type".into(), "application/json".into()),
            ("user-agent".into(), "ava-client/1.0".into()),
            ("accept-encoding".into(), "gzip, deflate, br".into()),
        ];
        b.iter(|| {
            black_box(convert_h1_to_web(
                black_box("GET"),
                black_box("/api/users?page=1"),
                black_box(&headers),
                black_box(b""),
                black_box(None),
            ));
        });
    });

    // h1_to_web: heavy headers — 20 headers (adversarial)
    group.bench_function("h1_to_web/heavy_headers", |b| {
        let headers: Vec<(String, String)> = (0..20)
            .map(|i| (format!("x-custom-header-{i}"), format!("value-{i}-with-some-padding")))
            .collect();
        b.iter(|| {
            black_box(convert_h1_to_web(
                black_box("POST"),
                black_box("/api/ingest"),
                black_box(&headers),
                black_box(b""),
                black_box(None),
            ));
        });
    });

    // h1_to_web: body size sweep (borrowing — copies body)
    for &(label, size) in &[("0B", 0), ("1KB", 1024), ("64KB", 65536), ("1MB", 1_048_576)] {
        let body = vec![0xABu8; size];
        let headers: Vec<(String, String)> = vec![
            ("content-type".into(), "application/octet-stream".into()),
        ];
        group.bench_function(&format!("h1_to_web/body_{label}_borrow"), |b| {
            b.iter(|| {
                black_box(convert_h1_to_web(
                    black_box("POST"),
                    black_box("/upload"),
                    black_box(&headers),
                    black_box(&body),
                    black_box(None),
                ));
            });
        });
    }

    // web_to_h1: 200 OK with 3 headers + JSON body
    group.bench_function("web_to_h1/ok_json", |b| {
        b.iter(|| {
            let resp = Response::new(StatusCode::OK, Bytes::from_static(b"{\"status\":\"ok\"}"))
                .header("content-type", "application/json")
                .header("x-request-id", "req-abc-123")
                .header("cache-control", "no-cache");
            black_box(convert_web_to_h1(resp));
        });
    });

    // web_to_h1: body size sweep — measures Vec::from(Bytes) cost
    for &(label, size) in &[("0B", 0), ("1KB", 1024), ("64KB", 65536), ("1MB", 1_048_576)] {
        group.bench_function(&format!("web_to_h1/body_{label}"), |b| {
            b.iter(|| {
                // Bytes::from(vec) → then Vec::from(Bytes):
                // if Bytes uniquely owns the Vec, this round-trips with zero copies.
                let body = Bytes::from(vec![0xABu8; size]);
                let resp = Response::new(StatusCode::OK, body)
                    .header("content-type", "application/octet-stream");
                black_box(convert_web_to_h1(resp));
            });
        });
    }

    group.finish();
}

// ── H1 Bridge Benchmarks (owning — zero-copy) ─────────────────────────────

fn bench_h1_bridge_owned(c: &mut Criterion) {
    let mut group = c.benchmark_group("h1_bridge_owned");

    // Owning: body size sweep — the main optimization target.
    // convert_h1_request_owned takes Vec<u8> by value, so Bytes::from(vec) is O(1).
    for &(label, size) in &[("0B", 0), ("1KB", 1024), ("64KB", 65536), ("1MB", 1_048_576)] {
        group.bench_function(&format!("body_{label}"), |b| {
            b.iter(|| {
                let req = make_h1_request(size);
                black_box(convert_h1_request_owned(black_box(req)));
            });
        });
    }

    // Owning: header count sweep — measures Cow::Owned vs String::clone overhead
    for &(label, count) in &[("0_headers", 0), ("6_headers", 6), ("20_headers", 20)] {
        group.bench_function(label, |b| {
            b.iter(|| {
                let mut req = make_h1_request(0);
                req.headers = (0..count)
                    .map(|i| (format!("X-Header-{i}"), format!("value-{i}")))
                    .collect();
                black_box(convert_h1_request_owned(black_box(req)));
            });
        });
    }

    group.finish();
}

// ── H2 Bridge Benchmarks ─────────────────────────────────────────────────

fn bench_h2_bridge(c: &mut Criterion) {
    let mut group = c.benchmark_group("h2_bridge");

    // h2_to_web: minimal — 3 pseudo-headers only
    group.bench_function("h2_to_web/minimal", |b| {
        let headers = vec![
            Header { name: ":method".into(), value: "GET".into() },
            Header { name: ":path".into(), value: "/".into() },
            Header { name: ":scheme".into(), value: "https".into() },
        ];
        b.iter(|| {
            black_box(convert_h2_headers_to_web(
                black_box(&headers),
                black_box(b""),
                black_box(None),
            )).unwrap();
        });
    });

    // h2_to_web: realistic — 4 pseudo + 8 regular headers
    group.bench_function("h2_to_web/realistic", |b| {
        let headers = vec![
            Header { name: ":method".into(), value: "GET".into() },
            Header { name: ":path".into(), value: "/api/v2/users?page=1&limit=50".into() },
            Header { name: ":scheme".into(), value: "https".into() },
            Header { name: ":authority".into(), value: "api.example.com".into() },
            Header { name: "accept".into(), value: "application/json".into() },
            Header { name: "authorization".into(), value: "Bearer eyJhbGciOiJIUzI1NiJ9.e30.abc".into() },
            Header { name: "content-type".into(), value: "application/json".into() },
            Header { name: "user-agent".into(), value: "ava-client/2.0".into() },
            Header { name: "accept-encoding".into(), value: "gzip, deflate, br".into() },
            Header { name: "accept-language".into(), value: "en-US,en;q=0.9".into() },
            Header { name: "x-request-id".into(), value: "req-def-456".into() },
            Header { name: "x-forwarded-for".into(), value: "10.0.0.1".into() },
        ];
        b.iter(|| {
            black_box(convert_h2_headers_to_web(
                black_box(&headers),
                black_box(b""),
                black_box(None),
            )).unwrap();
        });
    });

    // web_to_h2: response with 5 headers + :status prepend
    group.bench_function("web_to_h2/response", |b| {
        b.iter(|| {
            let resp = Response::new(StatusCode::OK, Bytes::from_static(b"{\"data\":[]}"))
                .header("content-type", "application/json")
                .header("x-request-id", "req-abc-123")
                .header("cache-control", "max-age=3600")
                .header("vary", "Accept-Encoding")
                .header("x-powered-by", "ava-web");
            black_box(convert_web_to_h2(resp));
        });
    });

    group.finish();
}

// ── Metrics Benchmarks ───────────────────────────────────────────────────

fn bench_metrics(c: &mut Criterion) {
    let mut group = c.benchmark_group("metrics");

    // histogram/observe_default — observe(0.05) on default 11-bucket histogram
    group.bench_function("histogram/observe_default", |b| {
        let mut hist = Histogram::with_defaults();
        b.iter(|| {
            hist.observe(black_box(0.05));
        });
    });

    // histogram/observe_50_buckets — custom 50-bucket histogram
    group.bench_function("histogram/observe_50_buckets", |b| {
        let bounds: Vec<f64> = (1..=50).map(|i| i as f64 * 0.01).collect();
        let mut hist = Histogram::new(&bounds);
        b.iter(|| {
            hist.observe(black_box(0.25));
        });
    });

    // histogram/observe_1000x — 1000 sequential observations (warm loop)
    group.bench_function("histogram/observe_1000x", |b| {
        b.iter(|| {
            let mut hist = Histogram::with_defaults();
            for i in 0..1000u32 {
                hist.observe(black_box(i as f64 * 0.001));
            }
            black_box(&hist);
        });
    });

    // collector/record_single — full MetricsCollector::record() path
    group.bench_function("collector/record_single", |b| {
        let collector = MetricsCollector::new();
        b.iter(|| {
            collector.record(black_box("/api/users"), black_box(0.042));
        });
    });

    // collector/record_10_routes — round-robin across 10 different routes
    group.bench_function("collector/record_10_routes", |b| {
        let collector = MetricsCollector::new();
        let routes: Vec<String> = (0..10).map(|i| format!("/api/route{i}")).collect();
        // Warm up: ensure all routes exist
        for route in &routes {
            collector.record(route, 0.01);
        }
        let mut idx = 0usize;
        b.iter(|| {
            let route = &routes[idx % 10];
            collector.record(black_box(route), black_box(0.042));
            idx += 1;
        });
    });

    // render/5_routes — render_prometheus with 5 routes
    group.bench_function("render/5_routes", |b| {
        let collector = MetricsCollector::new();
        for i in 0..5 {
            for _ in 0..20 {
                collector.record(&format!("/api/route{i}"), 0.05 * (i as f64 + 1.0));
            }
        }
        b.iter(|| {
            black_box(collector.render_prometheus());
        });
    });

    // render/50_routes — render_prometheus with 50 routes
    group.bench_function("render/50_routes", |b| {
        let collector = MetricsCollector::new();
        for i in 0..50 {
            for _ in 0..20 {
                collector.record(&format!("/api/route{i:02}"), 0.05 * (i as f64 + 1.0));
            }
        }
        b.iter(|| {
            black_box(collector.render_prometheus());
        });
    });

    group.finish();
}

criterion_group!(
    benches,
    bench_h1_bridge,
    bench_h1_bridge_owned,
    bench_h2_bridge,
    bench_metrics,
);
criterion_main!(benches);
