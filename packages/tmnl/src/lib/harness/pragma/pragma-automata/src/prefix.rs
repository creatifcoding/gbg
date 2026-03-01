//! Annotation prefix block builder.
//!
//! Produces the fenced JSON `generation-context` block that gets prepended
//! to the LLM prompt. Format per DECISIONS.md:
//!
//! ```text
//! ```generation-context
//! {
//!   "intent": "Data",
//!   "confidence": 0.87,
//!   "components": ["Chart", "DataGrid", "MetricCard"],
//!   "hints": { ... }
//! }
//! ```

use pragma_ipc::types::{AnnotateResponse, IntentType};

/// Build the fenced generation-context block for prompt injection.
pub fn build_prefix_block(response: &AnnotateResponse) -> String {
    let components: Vec<&str> = response
        .candidates
        .iter()
        .map(|c| c.component_type.as_str())
        .collect();

    let json = serde_json::json!({
        "intent": format_intent(&response.intent.intent_type),
        "confidence": round2(response.intent.confidence),
        "components": components,
        "hints": {
            "temperature": response.hints.temperature,
            "note": &response.hints.note,
            "model_tier": format!("{:?}", response.intent.model_used),
        },
    });

    let json_str = serde_json::to_string_pretty(&json).unwrap_or_else(|_| "{}".to_string());
    format!("```generation-context\n{}\n```", json_str)
}

/// Build a compact single-line version for token efficiency.
pub fn build_prefix_compact(response: &AnnotateResponse) -> String {
    let components: Vec<&str> = response
        .candidates
        .iter()
        .map(|c| c.component_type.as_str())
        .collect();

    let json = serde_json::json!({
        "intent": format_intent(&response.intent.intent_type),
        "confidence": round2(response.intent.confidence),
        "components": components,
    });

    let json_str = serde_json::to_string(&json).unwrap_or_else(|_| "{}".to_string());
    format!("```generation-context\n{}\n```", json_str)
}

fn format_intent(intent: &IntentType) -> &'static str {
    match intent {
        IntentType::Data => "Data",
        IntentType::Form => "Form",
        IntentType::Layout => "Layout",
        IntentType::Feedback => "Feedback",
        IntentType::Mixed => "Mixed",
        IntentType::Idle => "Idle",
    }
}

fn round2(v: f32) -> f32 {
    (v * 100.0).round() / 100.0
}

// ─── Tests ──────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use pragma_ipc::types::*;

    fn make_response(
        intent: IntentType,
        confidence: f32,
        components: Vec<&str>,
    ) -> AnnotateResponse {
        AnnotateResponse {
            intent: IntentClassification {
                intent_type: intent,
                confidence,
                model_used: ModelTier::Minilm,
                tier_escalated: false,
            },
            candidates: components
                .into_iter()
                .map(|c| Candidate {
                    component_type: c.to_string(),
                    similarity: 0.9,
                    hint: "test".to_string(),
                })
                .collect(),
            disambiguation: vec![],
            hints: GenerationHints {
                temperature: 0.3,
                note: "test note".to_string(),
            },
            prefix_block: String::new(),
            sideband: Sideband {
                models_used: vec![ModelTier::Minilm],
                latency_ms: 2.5,
                catalog_recomputed: false,
            },
        }
    }

    #[test]
    fn prefix_block_has_fences() {
        let resp = make_response(IntentType::Data, 0.87, vec!["Chart", "DataGrid"]);
        let block = build_prefix_block(&resp);
        assert!(block.starts_with("```generation-context\n"));
        assert!(block.ends_with("\n```"));
    }

    #[test]
    fn prefix_block_contains_intent() {
        let resp = make_response(IntentType::Form, 0.9, vec!["Input"]);
        let block = build_prefix_block(&resp);
        assert!(block.contains("\"Form\""));
    }

    #[test]
    fn prefix_block_contains_confidence() {
        let resp = make_response(IntentType::Layout, 0.753, vec![]);
        let block = build_prefix_block(&resp);
        assert!(block.contains("0.75"));
    }

    #[test]
    fn prefix_block_contains_components() {
        let resp = make_response(IntentType::Data, 0.8, vec!["Chart", "MetricCard"]);
        let block = build_prefix_block(&resp);
        assert!(block.contains("Chart"));
        assert!(block.contains("MetricCard"));
    }

    #[test]
    fn compact_is_three_lines() {
        let resp = make_response(IntentType::Feedback, 0.95, vec!["Alert"]);
        let block = build_prefix_compact(&resp);
        let lines: Vec<&str> = block.lines().collect();
        assert_eq!(lines.len(), 3);
        assert_eq!(lines[0], "```generation-context");
        assert_eq!(lines[2], "```");
    }

    #[test]
    fn round2_works() {
        assert_eq!(round2(0.876), 0.88);
        assert_eq!(round2(0.1), 0.1);
        assert_eq!(round2(1.0), 1.0);
    }

    #[test]
    fn all_intent_types_format() {
        assert_eq!(format_intent(&IntentType::Data), "Data");
        assert_eq!(format_intent(&IntentType::Form), "Form");
        assert_eq!(format_intent(&IntentType::Layout), "Layout");
        assert_eq!(format_intent(&IntentType::Feedback), "Feedback");
        assert_eq!(format_intent(&IntentType::Mixed), "Mixed");
        assert_eq!(format_intent(&IntentType::Idle), "Idle");
    }
}
