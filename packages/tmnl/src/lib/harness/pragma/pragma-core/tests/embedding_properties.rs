//! T3: Property-based embedding mathematical invariants.

use pragma_core::encoder::Embedding;
use proptest::prelude::*;

fn arb_embedding(dim: usize) -> impl Strategy<Value = Embedding> {
    proptest::collection::vec(-10.0f32..10.0f32, dim).prop_map(move |values| Embedding {
        values,
        dim,
        inference_ms: 0.0,
    })
}

proptest! {
    /// Cosine similarity is symmetric: sim(a, b) == sim(b, a).
    #[test]
    fn cosine_similarity_symmetric(
        a in arb_embedding(64),
        b in arb_embedding(64),
    ) {
        let ab = a.cosine_similarity(&b);
        let ba = b.cosine_similarity(&a);
        prop_assert!((ab - ba).abs() < 1e-5, "Asymmetric: sim(a,b)={ab} vs sim(b,a)={ba}");
    }

    /// Cosine similarity is in [-1, 1].
    #[test]
    fn cosine_similarity_bounded(
        a in arb_embedding(64),
        b in arb_embedding(64),
    ) {
        let sim = a.cosine_similarity(&b);
        prop_assert!(sim >= -1.0 - 1e-5 && sim <= 1.0 + 1e-5, "Out of range: {sim}");
    }

    /// Self-similarity is 1.0 (for non-zero vectors).
    #[test]
    fn cosine_self_similarity_is_one(a in arb_embedding(64)) {
        let norm: f32 = a.values.iter().map(|x| x * x).sum::<f32>().sqrt();
        if norm > 1e-6 {
            let sim = a.cosine_similarity(&a);
            prop_assert!((sim - 1.0).abs() < 1e-4, "Self-sim != 1.0: {sim}");
        }
    }

    /// L2 distance is non-negative.
    #[test]
    fn l2_distance_non_negative(
        a in arb_embedding(64),
        b in arb_embedding(64),
    ) {
        let dist = a.l2_distance(&b);
        prop_assert!(dist >= 0.0, "Negative L2 distance: {dist}");
    }

    /// L2 distance to self is 0.
    #[test]
    fn l2_distance_self_is_zero(a in arb_embedding(64)) {
        let dist = a.l2_distance(&a);
        prop_assert!(dist.abs() < 1e-5, "Self-distance non-zero: {dist}");
    }

    /// Triangle inequality: d(a,c) <= d(a,b) + d(b,c).
    #[test]
    fn l2_triangle_inequality(
        a in arb_embedding(16),
        b in arb_embedding(16),
        c in arb_embedding(16),
    ) {
        let ab = a.l2_distance(&b);
        let bc = b.l2_distance(&c);
        let ac = a.l2_distance(&c);
        prop_assert!(ac <= ab + bc + 1e-4, "Triangle inequality violated: {ac} > {ab} + {bc}");
    }
}

// ─── Cross-backend equivalence stubs ────────────────────────────────

#[test]
#[ignore = "requires provisioned models + Python reference data"]
fn cross_backend_embedding_equivalence() {
    // T3 #3236: Compare Candle embeddings against Python reference.
    // Max diff threshold: < 1e-5 (float32), < 1e-3 (int8).
    // Wired when models are provisioned.
}

#[test]
#[ignore = "requires provisioned models + Python reference data"]
fn cross_backend_bertscore_equivalence() {
    // T3 #3237: Compare Candle BERTScore against Python reference.
    // Max delta threshold: < 0.02 for F1.
}
