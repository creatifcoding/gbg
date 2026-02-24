//! Multipart parser benchmarks.
//!
//! Tests the zero-copy parse_bytes path (Bytes::slice) and the BMH
//! boundary scanner. Adversarial tests embed boundary strings inside
//! field data to force worst-case scan behavior.

use bytes::Bytes;
use criterion::{black_box, criterion_group, criterion_main, BenchmarkId, Criterion};

use ava_web::multipart::Multipart;

// ── Helpers ──────────────────────────────────────────────────────────────────

const BOUNDARY: &str = "----WebKitFormBoundary7MA4YWxkTrZu0gW";

/// Build a valid multipart/form-data Content-Type header.
fn content_type(boundary: &str) -> String {
    format!("multipart/form-data; boundary={boundary}")
}

/// Build a multipart body with the given fields.
/// Each field is (name, optional filename, data bytes).
fn make_multipart_body(boundary: &str, fields: &[(&str, Option<&str>, &[u8])]) -> Bytes {
    let mut body = Vec::new();
    for (name, filename, data) in fields {
        body.extend_from_slice(format!("--{boundary}\r\n").as_bytes());
        if let Some(fname) = filename {
            body.extend_from_slice(
                format!(
                    "Content-Disposition: form-data; name=\"{name}\"; filename=\"{fname}\"\r\n"
                )
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
    Bytes::from(body)
}

/// Generate N bytes of pseudo-random binary data (deterministic).
fn generate_binary_data(size: usize) -> Vec<u8> {
    let mut data = Vec::with_capacity(size);
    // Simple LCG — deterministic, fast, good enough for benchmarks
    let mut state: u64 = 0xDEAD_BEEF_CAFE_BABE;
    for _ in 0..size {
        state = state.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
        data.push((state >> 33) as u8);
    }
    data
}

/// Build an adversarial body where field data contains the boundary string
/// `false_match_count` times, forcing the scanner to examine and reject each.
fn make_adversarial_body(boundary: &str, false_match_count: usize) -> Bytes {
    let boundary_bytes = format!("--{boundary}");
    let mut field_data = Vec::new();
    for i in 0..false_match_count {
        field_data.extend_from_slice(boundary_bytes.as_bytes());
        field_data.extend_from_slice(format!("_false_{i}_").as_bytes());
    }

    make_multipart_body(boundary, &[("adversarial", None, &field_data)])
}

// ── Parse benchmarks ─────────────────────────────────────────────────────────

fn bench_parse_single_field_small(c: &mut Criterion) {
    let ct = content_type(BOUNDARY);
    let body = make_multipart_body(BOUNDARY, &[("username", None, b"alice_in_wonderland_42")]);

    c.bench_function("multipart/parse/single_field_small", |b| {
        b.iter(|| {
            // Bytes::clone() is a cheap refcount bump — not a memcpy
            let _ = black_box(Multipart::parse_bytes(black_box(&ct), black_box(body.clone())));
        });
    });
}

fn bench_parse_ten_fields(c: &mut Criterion) {
    let ct = content_type(BOUNDARY);
    let fields: Vec<(String, Vec<u8>)> = (0..10)
        .map(|i| (format!("field_{i}"), format!("value_{i}_with_some_content").into_bytes()))
        .collect();
    let field_refs: Vec<(&str, Option<&str>, &[u8])> = fields
        .iter()
        .map(|(name, data)| (name.as_str(), None, data.as_slice()))
        .collect();
    let body = make_multipart_body(BOUNDARY, &field_refs);

    c.bench_function("multipart/parse/ten_fields", |b| {
        b.iter(|| {
            let _ = black_box(Multipart::parse_bytes(black_box(&ct), black_box(body.clone())));
        });
    });
}

fn bench_parse_file_uploads(c: &mut Criterion) {
    let mut group = c.benchmark_group("multipart/parse");
    let ct = content_type(BOUNDARY);

    // 10KB file upload
    let data_10kb = generate_binary_data(10 * 1024);
    let body_10kb = make_multipart_body(BOUNDARY, &[("file", Some("upload.bin"), &data_10kb)]);

    group.bench_function("file_upload_10kb", |b| {
        b.iter(|| {
            let _ = black_box(Multipart::parse_bytes(black_box(&ct), black_box(body_10kb.clone())));
        });
    });

    // 1MB file upload — THE KEY ONE
    let data_1mb = generate_binary_data(1024 * 1024);
    let body_1mb = make_multipart_body(BOUNDARY, &[("file", Some("big.bin"), &data_1mb)]);

    group.bench_function("file_upload_1mb", |b| {
        b.iter(|| {
            let _ = black_box(Multipart::parse_bytes(black_box(&ct), black_box(body_1mb.clone())));
        });
    });

    group.finish();
}

fn bench_parse_mixed_fields_plus_file(c: &mut Criterion) {
    let ct = content_type(BOUNDARY);
    let file_data = generate_binary_data(50 * 1024); // 50KB file

    let text_fields: Vec<(String, Vec<u8>)> = (0..5)
        .map(|i| {
            (
                format!("meta_{i}"),
                format!("metadata value {i} with moderate length content here").into_bytes(),
            )
        })
        .collect();

    let mut all_fields: Vec<(&str, Option<&str>, &[u8])> = text_fields
        .iter()
        .map(|(name, data)| (name.as_str(), None, data.as_slice()))
        .collect();
    all_fields.push(("document", Some("report.pdf"), &file_data));

    let body = make_multipart_body(BOUNDARY, &all_fields);

    c.bench_function("multipart/parse/mixed_fields_plus_file", |b| {
        b.iter(|| {
            let _ = black_box(Multipart::parse_bytes(black_box(&ct), black_box(body.clone())));
        });
    });
}

// ── Adversarial benchmarks ───────────────────────────────────────────────────

fn bench_adversarial_boundary_in_data(c: &mut Criterion) {
    let mut group = c.benchmark_group("adversarial/multipart");
    let ct = content_type(BOUNDARY);

    // 100 false boundary matches — moderate worst case
    let body_100 = make_adversarial_body(BOUNDARY, 100);
    group.bench_function("boundary_in_data_100x", |b| {
        b.iter(|| {
            let _ = black_box(Multipart::parse_bytes(black_box(&ct), black_box(body_100.clone())));
        });
    });

    // 1000 false boundary matches — severe worst case
    let body_1000 = make_adversarial_body(BOUNDARY, 1000);
    group.bench_function("boundary_in_data_1000x", |b| {
        b.iter(|| {
            let _ = black_box(Multipart::parse_bytes(black_box(&ct), black_box(body_1000.clone())));
        });
    });

    group.finish();
}

// ── Scaling benchmark ────────────────────────────────────────────────────────

fn bench_parse_scaling(c: &mut Criterion) {
    let mut group = c.benchmark_group("multipart/parse/scaling");
    let ct = content_type(BOUNDARY);

    for size_kb in [1, 10, 100, 1000] {
        let data = generate_binary_data(size_kb * 1024);
        let body = make_multipart_body(BOUNDARY, &[("payload", Some("data.bin"), &data)]);

        group.bench_with_input(
            BenchmarkId::new("body_kb", size_kb),
            &size_kb,
            |b, _| {
                b.iter(|| {
                    let _ = black_box(Multipart::parse_bytes(black_box(&ct), black_box(body.clone())));
                });
            },
        );
    }

    group.finish();
}

criterion_group!(
    benches,
    bench_parse_single_field_small,
    bench_parse_ten_fields,
    bench_parse_file_uploads,
    bench_parse_mixed_fields_plus_file,
    bench_adversarial_boundary_in_data,
    bench_parse_scaling,
);
criterion_main!(benches);
