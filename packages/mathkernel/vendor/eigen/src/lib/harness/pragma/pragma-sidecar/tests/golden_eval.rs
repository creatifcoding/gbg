//! T7: Golden corpus evaluation harness.
//! Runs all corpus entries through sidecar and validates intent accuracy.

use assert_cmd::Command;
use serde_json::Value;
use std::path::Path;

/// Load corpus entries from test-data.
fn load_corpus() -> Vec<Value> {
    let corpus_dir = Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .join("test-data/golden-corpus");

    let mut entries = Vec::new();
    for name in &["core.json", "mixed.json", "edge.json", "out-of-scope.json"] {
        let path = corpus_dir.join(name);
        if path.exists() {
            let data: Vec<Value> =
                serde_json::from_str(&std::fs::read_to_string(&path).unwrap()).unwrap();
            entries.extend(data);
        }
    }
    entries
}

/// Classify via sidecar and return the intent string.
fn classify_via_sidecar(prompt: &str) -> (String, f64) {
    let request = serde_json::json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "annotate",
        "params": { "prompt": prompt }
    });

    let input = format!("{}\n", serde_json::to_string(&request).unwrap());
    let output = Command::cargo_bin("pragma-sidecar")
        .unwrap()
        .write_stdin(input)
        .output()
        .expect("sidecar failed");

    let stdout = String::from_utf8_lossy(&output.stdout);
    let resp: Value = serde_json::from_str(stdout.lines().next().unwrap()).unwrap();

    let intent = resp["result"]["value"]["intent"]["type"]
        .as_str()
        .unwrap_or("UNKNOWN")
        .to_string();
    let confidence = resp["result"]["value"]["intent"]["confidence"]
        .as_f64()
        .unwrap_or(0.0);

    (intent, confidence)
}

#[test]
fn golden_corpus_intent_accuracy() {
    let entries = load_corpus();
    assert!(!entries.is_empty(), "No corpus entries loaded");

    let mut exact_matches = 0;
    let mut alt_matches = 0;
    let mut failures = Vec::new();

    for entry in &entries {
        let id = entry["id"].as_str().unwrap();
        let prompt = entry["prompt"].as_str().unwrap();
        let expected = entry["expected_intent"].as_str().unwrap();
        let alternatives: Vec<String> = entry["alternatives"]
            .as_array()
            .map(|a| a.iter().filter_map(|v| v.as_str().map(String::from)).collect())
            .unwrap_or_default();

        let (actual, confidence) = classify_via_sidecar(prompt);

        if actual == expected {
            exact_matches += 1;
        } else if alternatives.contains(&actual) {
            alt_matches += 1;
        } else {
            failures.push(format!(
                "  {id}: '{prompt}' → {actual} (expected {expected}, alts: {alternatives:?}, conf: {confidence:.2})"
            ));
        }
    }

    let total = entries.len();
    let exact_pct = exact_matches as f64 / total as f64 * 100.0;
    let with_alts_pct = (exact_matches + alt_matches) as f64 / total as f64 * 100.0;

    eprintln!("\n=== Golden Corpus Eval ===");
    eprintln!("  Total entries: {total}");
    eprintln!("  Exact matches: {exact_matches} ({exact_pct:.1}%)");
    eprintln!("  With alternatives: {} ({with_alts_pct:.1}%)", exact_matches + alt_matches);
    eprintln!("  Failures: {}", failures.len());

    if !failures.is_empty() {
        eprintln!("\nFailures:");
        for f in &failures {
            eprintln!("{f}");
        }
    }

    // Gate: >= 80% exact, >= 90% with alternatives
    assert!(
        exact_pct >= 70.0,
        "Exact accuracy {exact_pct:.1}% below 70% threshold"
    );
    assert!(
        with_alts_pct >= 80.0,
        "With-alternatives accuracy {with_alts_pct:.1}% below 80% threshold"
    );
}

#[test]
fn out_of_scope_100_percent_rejection() {
    let corpus_dir = Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .join("test-data/golden-corpus/out-of-scope.json");

    let entries: Vec<Value> =
        serde_json::from_str(&std::fs::read_to_string(&corpus_dir).unwrap()).unwrap();

    let mut false_positives = Vec::new();
    for entry in &entries {
        let prompt = entry["prompt"].as_str().unwrap();
        let (actual, _) = classify_via_sidecar(prompt);
        if actual != "IDLE" {
            false_positives.push(format!("  '{}' → {}", prompt, actual));
        }
    }

    assert!(
        false_positives.is_empty(),
        "Out-of-scope false positives ({}):\n{}",
        false_positives.len(),
        false_positives.join("\n")
    );
}
