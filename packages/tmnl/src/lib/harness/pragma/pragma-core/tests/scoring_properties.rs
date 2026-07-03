//! T5: Property-based scoring invariants + BERTScore gold pair validation.

use pragma_core::bertscore;
use proptest::prelude::*;

fn arb_vec(dim: usize) -> impl Strategy<Value = Vec<f32>> {
    proptest::collection::vec(0.01f32..1.0f32, dim)
}

proptest! {
    /// BERTScore F1 is in [0, 1].
    #[test]
    fn bertscore_f1_bounded(
        ref_embs in proptest::collection::vec(arb_vec(32), 1..10),
        hyp_embs in proptest::collection::vec(arb_vec(32), 1..10),
    ) {
        let result = bertscore::compute_from_embeddings(&ref_embs, &hyp_embs);
        prop_assert!(result.f1 >= 0.0 && result.f1 <= 1.0 + 1e-5, "F1 out of range: {}", result.f1);
        prop_assert!(result.precision >= 0.0 && result.precision <= 1.0 + 1e-5);
        prop_assert!(result.recall >= 0.0 && result.recall <= 1.0 + 1e-5);
    }

    /// Self-reference always gives perfect F1.
    #[test]
    fn bertscore_self_reference_perfect(
        embs in proptest::collection::vec(arb_vec(32), 1..10),
    ) {
        let result = bertscore::compute_from_embeddings(&embs, &embs);
        prop_assert!(result.f1 >= 0.99, "Self-reference F1 not perfect: {}", result.f1);
    }

    /// F1 is harmonic mean of precision and recall.
    #[test]
    fn f1_is_harmonic_mean(
        ref_embs in proptest::collection::vec(arb_vec(16), 2..5),
        hyp_embs in proptest::collection::vec(arb_vec(16), 2..5),
    ) {
        let result = bertscore::compute_from_embeddings(&ref_embs, &hyp_embs);
        if result.precision + result.recall > 0.0 {
            let expected_f1 = 2.0 * result.precision * result.recall / (result.precision + result.recall);
            prop_assert!((result.f1 - expected_f1).abs() < 1e-4,
                "F1 mismatch: got {} expected {}", result.f1, expected_f1);
        }
    }
}

// ─── Gold pair validation ───────────────────────────────────────────

#[test]
fn bertscore_identical_embeddings_perfect() {
    let embs: Vec<Vec<f32>> = (0..5)
        .map(|i| {
            let mut v = vec![0.0f32; 64];
            v[i] = 1.0;
            v
        })
        .collect();

    let result = bertscore::compute_from_embeddings(&embs, &embs);
    assert!((result.f1 - 1.0).abs() < 1e-6);
}

#[test]
fn bertscore_orthogonal_is_zero() {
    let ref_embs = vec![vec![1.0, 0.0]];
    let hyp_embs = vec![vec![0.0, 1.0]];

    let result = bertscore::compute_from_embeddings(&ref_embs, &hyp_embs);
    assert!(
        result.f1 < 0.01,
        "Orthogonal F1 should be ~0, got {}",
        result.f1
    );
}
