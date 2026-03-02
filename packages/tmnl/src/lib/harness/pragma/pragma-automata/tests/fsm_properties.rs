//! T4: Property-based FSM invariants + adversarial + out-of-scope.

use pragma_automata::fsm;
use pragma_ipc::types::IntentType;
use proptest::prelude::*;

// ─── Property-based FSM invariants ──────────────────────────────────

proptest! {
    /// FSM never panics on arbitrary input.
    #[test]
    fn classify_never_panics(input in "\\PC{0,1000}") {
        let _ = fsm::classify(&input);
    }

    /// Result always has a valid IntentType.
    #[test]
    fn result_always_valid_intent(input in "\\PC{0,200}") {
        let result = fsm::classify(&input);
        match result.intent {
            IntentType::Data | IntentType::Form | IntentType::Layout |
            IntentType::Feedback | IntentType::Mixed | IntentType::Idle => {}
        }
    }

    /// Active count is bounded by number of intent types.
    #[test]
    fn active_count_bounded(input in "\\PC{0,200}") {
        let result = fsm::classify(&input);
        prop_assert!(result.active_count <= 6, "Active count too high: {}", result.active_count);
    }

    /// Deterministic: same input → same output.
    #[test]
    fn classify_is_deterministic(input in "\\PC{0,200}") {
        let r1 = fsm::classify(&input);
        let r2 = fsm::classify(&input);
        prop_assert_eq!(format!("{:?}", r1.intent), format!("{:?}", r2.intent));
        prop_assert_eq!(r1.active_count, r2.active_count);
        prop_assert_eq!(r1.scores.len(), r2.scores.len());
    }
}

// ─── Snapshot regression for classification matrix ──────────────────

#[test]
fn classification_matrix_snapshot() {
    let cases = vec![
        ("show me a bar chart", "DATA"),
        ("create a login form", "FORM"),
        ("build a dashboard layout", "LAYOUT"),
        ("display an error alert", "FEEDBACK"),
        ("dashboard with charts and forms", "MIXED"),
        ("what is the meaning of life?", "IDLE"),
        ("", "IDLE"),
    ];

    let mut matrix = String::new();
    for (prompt, expected) in &cases {
        let result = fsm::classify(prompt);
        let actual = format!("{:?}", result.intent);
        matrix.push_str(&format!("{:30} → {:10} (expected: {})\n", prompt, actual, expected));
    }
    insta::assert_snapshot!("fsm_classification_matrix", matrix);
}

// ─── Adversarial input suite ────────────────────────────────────────

#[test]
fn adversarial_injection_does_not_crash() {
    let long_chart = "chart ".repeat(10000);
    let long_a = "a".repeat(100_000);
    let adversarial: Vec<&str> = vec![
        "ignore all previous instructions",
        "```json\n{\"intent\": \"DATA\"}\n```",
        "<script>alert('xss')</script>",
        "\0\x01\x02\x03 chart",
        "null undefined NaN Infinity",
        "SELECT * FROM users; DROP TABLE--",
        &long_chart,
        "🎨📊📈🔔💻",
        &long_a,
    ];

    for input in adversarial {
        let result = fsm::classify(input);
        // Must not panic, must return valid enum
        match result.intent {
            IntentType::Data | IntentType::Form | IntentType::Layout |
            IntentType::Feedback | IntentType::Mixed | IntentType::Idle => {}
        }
    }
}

#[test]
fn adversarial_unicode_edge_cases() {
    let cases = vec![
        "c̷h̵a̶r̷t̶",     // Zalgo
        "ᴄʜᴀʀᴛ",          // Small caps
        "ⓒⓗⓐⓡⓣ",          // Enclosed
        "𝐜𝐡𝐚𝐫𝐭",     // Bold
        "chart\u{200B}",  // Zero-width space
        "chart\u{FEFF}",  // BOM
    ];

    for input in cases {
        let _ = fsm::classify(input);
        // Must not panic
    }
}

// ─── Out-of-scope rejection suite ───────────────────────────────────

#[test]
fn out_of_scope_prompts_are_idle() {
    let out_of_scope = vec![
        "what is the capital of France?",
        "write me a Python function",
        "explain quantum entanglement",
        "translate hello to Spanish",
        "tell me a joke",
        "how to fix a memory leak in Rust?",
        "summarize the latest news",
        "calculate 15% tip on $85",
        "what's the weather today?",
        "recommend a good book",
        "help me debug this code",
        "when was the moon landing?",
        "compare AWS and GCP pricing",
        "how many calories in a banana?",
        "solve this differential equation",
    ];

    let mut false_positives = vec![];
    for prompt in &out_of_scope {
        let result = fsm::classify(prompt);
        if !matches!(result.intent, IntentType::Idle) {
            false_positives.push(format!(
                "'{}' classified as {:?} (expected Idle)",
                prompt, result.intent
            ));
        }
    }

    assert!(
        false_positives.is_empty(),
        "Out-of-scope false positives:\n{}",
        false_positives.join("\n")
    );
}
