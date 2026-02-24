//! WebSocket frame conversion benchmarks.
//!
//! Measures the cost of bridging between asupersync's `Message` type and
//! ava-web's `WsMessage` type, validating the zero-copy optimization.
//!
//! # Background
//!
//! asupersync's `Message` holds `asupersync::bytes::Bytes` (Arc<Vec<u8>>-backed,
//! reference-counted) for Binary/Ping/Pong variants. ava-web's `WsMessage`
//! now also uses `asupersync::bytes::Bytes`, making conversion an O(1) refcount
//! bump instead of the previous O(n) `.to_vec()` copy.
//!
//! # Benchmark Groups
//!
//! - **as_to_ws**: AsMessage → WsMessage conversion (the receive path)
//! - **ws_to_as**: WsMessage → AsMessage conversion (the send path)
//! - **roundtrip**: AsMessage → WsMessage → AsMessage (full echo cycle)
//!
//! # Expected Results
//!
//! After the zero-copy optimization, Binary/Ping/Pong conversions should show
//! **constant time** regardless of payload size — O(1) move, not O(n) copy.
//! Text conversions remain O(1) (String move, no copy).

use criterion::{black_box, criterion_group, criterion_main, Criterion};

use asupersync::bytes::Bytes as AsBytes;
use asupersync::net::websocket::Message as AsMessage;
use ava_web::ws::WsMessage;

// ── AsMessage → WsMessage (receive path) ─────────────────────────────────

fn bench_as_to_ws(c: &mut Criterion) {
    let mut group = c.benchmark_group("ws/as_to_ws");

    // Text baseline (String move, always O(1))
    group.bench_function("text/short", |b| {
        b.iter(|| {
            let msg = AsMessage::text("hello");
            black_box(WsMessage::from(black_box(msg)));
        });
    });

    // Binary — 64 bytes
    group.bench_function("binary/64B", |b| {
        let payload = AsBytes::from(vec![0xABu8; 64]);
        b.iter(|| {
            let msg = AsMessage::binary(payload.clone());
            black_box(WsMessage::from(black_box(msg)));
        });
    });

    // Binary — 1 KB
    group.bench_function("binary/1KB", |b| {
        let payload = AsBytes::from(vec![0xABu8; 1024]);
        b.iter(|| {
            let msg = AsMessage::binary(payload.clone());
            black_box(WsMessage::from(black_box(msg)));
        });
    });

    // Binary — 64 KB
    group.bench_function("binary/64KB", |b| {
        let payload = AsBytes::from(vec![0xABu8; 65_536]);
        b.iter(|| {
            let msg = AsMessage::binary(payload.clone());
            black_box(WsMessage::from(black_box(msg)));
        });
    });

    // Binary — 1 MB (stress test: should still be O(1) with zero-copy)
    group.bench_function("binary/1MB", |b| {
        let payload = AsBytes::from(vec![0xABu8; 1_048_576]);
        b.iter(|| {
            let msg = AsMessage::binary(payload.clone());
            black_box(WsMessage::from(black_box(msg)));
        });
    });

    // Ping — 64 bytes (typical heartbeat)
    group.bench_function("ping/64B", |b| {
        let payload = AsBytes::from(vec![0x42u8; 64]);
        b.iter(|| {
            let msg = AsMessage::ping(payload.clone());
            black_box(WsMessage::from(black_box(msg)));
        });
    });

    // Pong — 64 bytes
    group.bench_function("pong/64B", |b| {
        let payload = AsBytes::from(vec![0x42u8; 64]);
        b.iter(|| {
            let msg = AsMessage::pong(payload.clone());
            black_box(WsMessage::from(black_box(msg)));
        });
    });

    group.finish();
}

// ── WsMessage → AsMessage (send path) ────────────────────────────────────

fn bench_ws_to_as(c: &mut Criterion) {
    let mut group = c.benchmark_group("ws/ws_to_as");

    // Text baseline
    group.bench_function("text/short", |b| {
        b.iter(|| {
            let msg = WsMessage::text("hello");
            let as_msg: AsMessage = black_box(msg).into();
            black_box(as_msg);
        });
    });

    // Binary — 64 bytes
    group.bench_function("binary/64B", |b| {
        let payload = AsBytes::from(vec![0xABu8; 64]);
        b.iter(|| {
            let msg = WsMessage::binary(payload.clone());
            let as_msg: AsMessage = black_box(msg).into();
            black_box(as_msg);
        });
    });

    // Binary — 1 KB
    group.bench_function("binary/1KB", |b| {
        let payload = AsBytes::from(vec![0xABu8; 1024]);
        b.iter(|| {
            let msg = WsMessage::binary(payload.clone());
            let as_msg: AsMessage = black_box(msg).into();
            black_box(as_msg);
        });
    });

    // Binary — 64 KB
    group.bench_function("binary/64KB", |b| {
        let payload = AsBytes::from(vec![0xABu8; 65_536]);
        b.iter(|| {
            let msg = WsMessage::binary(payload.clone());
            let as_msg: AsMessage = black_box(msg).into();
            black_box(as_msg);
        });
    });

    // Binary — 1 MB
    group.bench_function("binary/1MB", |b| {
        let payload = AsBytes::from(vec![0xABu8; 1_048_576]);
        b.iter(|| {
            let msg = WsMessage::binary(payload.clone());
            let as_msg: AsMessage = black_box(msg).into();
            black_box(as_msg);
        });
    });

    group.finish();
}

// ── Round-trip: AsMessage → WsMessage → AsMessage ────────────────────────

fn bench_roundtrip(c: &mut Criterion) {
    let mut group = c.benchmark_group("ws/roundtrip");

    // Text round-trip
    group.bench_function("text/short", |b| {
        b.iter(|| {
            let original = AsMessage::text("hello websocket world");
            let ws_msg = WsMessage::from(original);
            let back: AsMessage = ws_msg.into();
            black_box(back);
        });
    });

    // Binary 64B round-trip
    group.bench_function("binary/64B", |b| {
        let payload = AsBytes::from(vec![0xABu8; 64]);
        b.iter(|| {
            let original = AsMessage::binary(payload.clone());
            let ws_msg = WsMessage::from(original);
            let back: AsMessage = ws_msg.into();
            black_box(back);
        });
    });

    // Binary 1KB round-trip
    group.bench_function("binary/1KB", |b| {
        let payload = AsBytes::from(vec![0xABu8; 1024]);
        b.iter(|| {
            let original = AsMessage::binary(payload.clone());
            let ws_msg = WsMessage::from(original);
            let back: AsMessage = ws_msg.into();
            black_box(back);
        });
    });

    // Binary 64KB round-trip
    group.bench_function("binary/64KB", |b| {
        let payload = AsBytes::from(vec![0xABu8; 65_536]);
        b.iter(|| {
            let original = AsMessage::binary(payload.clone());
            let ws_msg = WsMessage::from(original);
            let back: AsMessage = ws_msg.into();
            black_box(back);
        });
    });

    // Binary 1MB round-trip (the real stress test)
    group.bench_function("binary/1MB", |b| {
        let payload = AsBytes::from(vec![0xABu8; 1_048_576]);
        b.iter(|| {
            let original = AsMessage::binary(payload.clone());
            let ws_msg = WsMessage::from(original);
            let back: AsMessage = ws_msg.into();
            black_box(back);
        });
    });

    group.finish();
}

criterion_group!(benches, bench_as_to_ws, bench_ws_to_as, bench_roundtrip);
criterion_main!(benches);
