//! T2: Golden token comparison — Candle tokenizer vs Python reference.
//! Requires provisioned models for full validation.

use std::path::Path;

/// Load golden corpus entries from test-data.
fn load_corpus() -> Vec<serde_json::Value> {
    let corpus_dir = Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .join("test-data/golden-corpus");

    let mut entries = Vec::new();
    for name in &["core.json", "mixed.json", "edge.json", "adversarial.json", "out-of-scope.json"] {
        let path = corpus_dir.join(name);
        if path.exists() {
            let data: Vec<serde_json::Value> =
                serde_json::from_str(&std::fs::read_to_string(&path).unwrap()).unwrap();
            entries.extend(data);
        }
    }
    entries
}

#[test]
fn corpus_loads_all_entries() {
    let entries = load_corpus();
    assert!(entries.len() >= 50, "Expected >= 50 corpus entries, got {}", entries.len());
}

#[test]
fn all_entries_have_required_fields() {
    let entries = load_corpus();
    for e in &entries {
        assert!(e["id"].is_string(), "Missing id: {:?}", e);
        assert!(e["prompt"].is_string(), "Missing prompt in {}", e["id"]);
        assert!(e["expected_intent"].is_string(), "Missing expected_intent in {}", e["id"]);
        assert!(e["category"].is_string(), "Missing category in {}", e["id"]);
    }
}

#[test]
fn intent_values_are_valid() {
    let valid = ["DATA", "FORM", "LAYOUT", "FEEDBACK", "MIXED", "IDLE"];
    let entries = load_corpus();
    for e in &entries {
        let intent = e["expected_intent"].as_str().unwrap();
        assert!(valid.contains(&intent), "Invalid intent '{}' in {}", intent, e["id"]);
    }
}

#[test]
#[ignore = "requires provisioned tokenizer model"]
fn tokenizer_output_matches_python_reference() {
    // Will compare Candle tokenizer output against reference/tokenizer_reference.json
    let ref_path = Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .join("test-data/golden-corpus/reference/tokenizer_reference.json");

    if !ref_path.exists() {
        eprintln!("Reference file not found. Run pragma-golden-gen.py first.");
        return;
    }

    let _reference: Vec<serde_json::Value> =
        serde_json::from_str(&std::fs::read_to_string(&ref_path).unwrap()).unwrap();

    // Compare each entry's input_ids against Candle tokenizer
    // TODO: Wire when PragmaTokenizer is available in test env
}
