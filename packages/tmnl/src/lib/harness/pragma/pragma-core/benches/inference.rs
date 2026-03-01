use criterion::{criterion_group, criterion_main, Criterion};

fn bench_fsm_classify(c: &mut Criterion) {
    use pragma_automata::fsm;

    c.bench_function("fsm_classify_data", |b| {
        b.iter(|| fsm::classify("show me a bar chart of monthly revenue"))
    });

    c.bench_function("fsm_classify_mixed", |b| {
        b.iter(|| fsm::classify("dashboard with charts and forms and alerts"))
    });

    c.bench_function("fsm_classify_idle", |b| {
        b.iter(|| fsm::classify("what is the meaning of life?"))
    });

    c.bench_function("fsm_classify_empty", |b| {
        b.iter(|| fsm::classify(""))
    });
}

fn bench_bertscore_token_overlap(c: &mut Criterion) {
    use pragma_core::bertscore;
    use pragma_core::encoder::Embedding;

    // Pre-compute mock embeddings for benchmarking
    let make_emb = |v: Vec<f32>| Embedding {
        values: v.clone(),
        dim: v.len(),
        inference_ms: 0.0,
    };

    let ref_embs: Vec<Embedding> = (0..10)
        .map(|i| {
            let mut v = vec![0.0f32; 384];
            v[i % 384] = 1.0;
            make_emb(v)
        })
        .collect();

    let hyp_embs: Vec<Embedding> = (0..10)
        .map(|i| {
            let mut v = vec![0.0f32; 384];
            v[(i + 1) % 384] = 1.0;
            make_emb(v)
        })
        .collect();

    c.bench_function("bertscore_compute_from_embeddings", |b| {
        b.iter(|| bertscore::compute_from_embeddings(&ref_embs, &hyp_embs))
    });
}

fn bench_drift_detect(c: &mut Criterion) {
    use pragma_core::drift;
    use pragma_core::encoder::Embedding;

    let make_emb = |v: Vec<f32>| Embedding {
        values: v.clone(),
        dim: v.len(),
        inference_ms: 0.0,
    };

    let baseline: Vec<Embedding> = (0..50)
        .map(|i| {
            let mut v = vec![0.0f32; 384];
            v[i % 384] = 1.0;
            make_emb(v)
        })
        .collect();

    let current: Vec<Embedding> = (0..50)
        .map(|i| {
            let mut v = vec![0.0f32; 384];
            v[i % 384] = 0.9;
            v[(i + 1) % 384] = 0.1;
            make_emb(v)
        })
        .collect();

    let config = drift::DriftConfig::default();

    c.bench_function("drift_detect_50_embeddings", |b| {
        b.iter(|| drift::detect(&baseline, &current, &config))
    });
}

fn bench_prefix_build(c: &mut Criterion) {
    use pragma_ipc::types::*;

    let response = AnnotateResponse {
        intent: IntentClassification {
            r#type: IntentType::Data,
            confidence: 0.85,
            model_used: ModelTier::Minilm,
            tier_escalated: false,
        },
        candidates: vec![],
        disambiguation: vec![],
        hints: Hints {
            temperature: 0.3,
            note: "high confidence".into(),
        },
        prefix_block: String::new(),
        sideband: Sideband {
            models_used: vec![ModelTier::Minilm],
            latency_ms: 1.2,
            catalog_recomputed: false,
        },
    };

    c.bench_function("prefix_build_block", |b| {
        b.iter(|| pragma_automata::prefix::build_prefix_block(&response))
    });

    c.bench_function("prefix_build_compact", |b| {
        b.iter(|| pragma_automata::prefix::build_prefix_compact(&response))
    });
}

criterion_group!(
    benches,
    bench_fsm_classify,
    bench_bertscore_token_overlap,
    bench_drift_detect,
    bench_prefix_build,
);
criterion_main!(benches);
