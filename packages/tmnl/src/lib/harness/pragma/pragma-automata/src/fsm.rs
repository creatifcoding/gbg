//! FSM-based intent classification.
//!
//! Deterministic keyword-driven classifier that maps prompt text to `IntentType`.
//! Uses a two-phase approach:
//! 1. **Lexical scan**: count keyword hits per intent category
//! 2. **State resolution**: single winner → that intent, multiple → Mixed, none → Idle
//!
//! This is the first-pass classifier. Ambiguous results (Mixed, Idle, or low-confidence
//! single hits) can be escalated to the embedding-based deep classifier.

use pragma_ipc::types::IntentType;

/// Keyword patterns for each intent category.
///
/// Each category has primary triggers (strong signals) and secondary triggers (weak signals).
/// A primary hit counts as 2, secondary as 1. Threshold for activation: ≥ 2.
#[derive(Debug, Clone)]
struct IntentPatterns {
    intent: IntentType,
    primary: &'static [&'static str],
    secondary: &'static [&'static str],
}

/// The keyword lexicon for the FSM classifier.
const INTENT_LEXICON: &[IntentPatterns] = &[
    IntentPatterns {
        intent: IntentType::Data,
        primary: &[
            "chart", "graph", "table", "metric", "metrics", "data", "dataset",
            "visualization", "plot", "histogram", "bar chart", "line chart",
            "pie chart", "scatter", "timeseries", "time series", "sparkline",
            "kpi", "analytics",
        ],
        secondary: &[
            "show", "display", "render", "values", "numbers", "statistics",
            "stats", "trend", "compare", "aggregate", "summary",
        ],
    },
    IntentPatterns {
        intent: IntentType::Form,
        primary: &[
            "form", "input", "field", "checkbox", "radio", "select", "dropdown",
            "textarea", "submit", "validation", "login", "signup", "register",
            "settings", "preferences", "profile", "editor",
        ],
        secondary: &[
            "enter", "fill", "type", "choose", "pick", "toggle",
            "switch", "configure", "option", "save", "update",
        ],
    },
    IntentPatterns {
        intent: IntentType::Layout,
        primary: &[
            "dashboard", "layout", "grid", "panel", "sidebar", "navigation",
            "nav", "header", "footer", "toolbar", "tab", "tabs", "page",
            "workspace", "canvas", "split", "columns", "rows",
        ],
        secondary: &[
            "arrange", "organize", "section", "area", "container", "view",
            "screen", "compose", "structure", "place", "position",
        ],
    },
    IntentPatterns {
        intent: IntentType::Feedback,
        primary: &[
            "alert", "notification", "toast", "error", "warning", "success",
            "info", "banner", "badge", "status", "progress", "loading",
            "spinner", "skeleton", "dialog", "modal", "confirm", "snackbar",
        ],
        secondary: &[
            "message", "tell", "inform", "indicate", "signal", "announce",
            "feedback", "response", "result", "state",
        ],
    },
];

/// Result of FSM classification.
#[derive(Debug, Clone)]
pub struct FsmResult {
    /// Classified intent.
    pub intent: IntentType,
    /// Score per category (primary hits * 2 + secondary hits).
    pub scores: Vec<(IntentType, u32)>,
    /// Number of categories that exceeded the activation threshold.
    pub active_count: usize,
    /// Whether the result is ambiguous (Mixed or Idle).
    pub ambiguous: bool,
}

/// Activation threshold for a category to be considered "triggered".
const ACTIVATION_THRESHOLD: u32 = 2;

/// Classify a prompt into an `IntentType` using keyword FSM.
pub fn classify(prompt: &str) -> FsmResult {
    let lower = prompt.to_lowercase();
    let mut scores: Vec<(IntentType, u32)> = Vec::new();

    for pattern in INTENT_LEXICON {
        let mut score: u32 = 0;

        for &keyword in pattern.primary {
            if contains_word(&lower, keyword) {
                score += 2;
            }
        }

        for &keyword in pattern.secondary {
            if contains_word(&lower, keyword) {
                score += 1;
            }
        }

        scores.push((pattern.intent, score));
    }

    // Find active categories (score >= threshold)
    let active: Vec<(IntentType, u32)> = scores
        .iter()
        .filter(|(_, s)| *s >= ACTIVATION_THRESHOLD)
        .cloned()
        .collect();

    let active_count = active.len();

    let (intent, ambiguous) = match active_count {
        0 => (IntentType::Idle, true),
        1 => (active[0].0, false),
        _ => {
            // Multiple active: check if one dominates (>= 2x second best)
            let mut sorted = active.clone();
            sorted.sort_by(|a, b| b.1.cmp(&a.1));
            if sorted[0].1 >= sorted[1].1 * 2 {
                (sorted[0].0, false) // Clear winner
            } else {
                (IntentType::Mixed, true)
            }
        }
    };

    FsmResult {
        intent,
        scores,
        active_count,
        ambiguous,
    }
}

/// Word-boundary-aware substring check.
///
/// Matches whole words or multi-word phrases within the text.
fn contains_word(text: &str, keyword: &str) -> bool {
    if keyword.contains(' ') {
        // Multi-word: simple substring match
        text.contains(keyword)
    } else {
        // Single word: check word boundaries
        text.split_whitespace().any(|w| {
            let w = w.trim_matches(|c: char| !c.is_alphanumeric());
            w == keyword
        })
    }
}

// ─── Tests ──────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn data_intent_from_chart_keywords() {
        let r = classify("show me a bar chart of monthly revenue");
        assert_eq!(r.intent, IntentType::Data);
        assert!(!r.ambiguous);
    }

    #[test]
    fn form_intent_from_input_keywords() {
        let r = classify("create a login form with email and password fields");
        assert_eq!(r.intent, IntentType::Form);
        assert!(!r.ambiguous);
    }

    #[test]
    fn layout_intent_from_dashboard() {
        let r = classify("build a dashboard with sidebar navigation and tabs");
        assert_eq!(r.intent, IntentType::Layout);
        assert!(!r.ambiguous);
    }

    #[test]
    fn feedback_intent_from_alert() {
        let r = classify("show an error alert with a warning banner");
        assert_eq!(r.intent, IntentType::Feedback);
        assert!(!r.ambiguous);
    }

    #[test]
    fn idle_for_non_ui_prompt() {
        let r = classify("explain the theory of relativity");
        assert_eq!(r.intent, IntentType::Idle);
        assert!(r.ambiguous);
    }

    #[test]
    fn mixed_for_multiple_strong_intents() {
        let r = classify("create a dashboard with a form for data input and chart visualization");
        assert_eq!(r.intent, IntentType::Mixed);
        assert!(r.ambiguous);
        assert!(r.active_count >= 2);
    }

    #[test]
    fn case_insensitive() {
        let r = classify("SHOW ME A TABLE OF METRICS");
        assert_eq!(r.intent, IntentType::Data);
    }

    #[test]
    fn dominant_intent_not_mixed() {
        // Data has many hits, form has just one crossing threshold
        let r = classify("show a chart graph with data table and metrics visualization");
        assert_eq!(r.intent, IntentType::Data);
        assert!(!r.ambiguous);
    }

    #[test]
    fn scores_are_populated() {
        let r = classify("show a chart");
        assert_eq!(r.scores.len(), 4); // 4 intent categories
        let data_score = r.scores.iter().find(|(i, _)| *i == IntentType::Data).unwrap().1;
        assert!(data_score >= 2, "Data score should be >= 2 for 'chart', got {data_score}");
    }

    #[test]
    fn empty_prompt_is_idle() {
        let r = classify("");
        assert_eq!(r.intent, IntentType::Idle);
        assert!(r.ambiguous);
    }

    #[test]
    fn word_boundary_prevents_false_matches() {
        // "information" contains "form" but shouldn't trigger Form
        let r = classify("give me information about weather");
        assert_eq!(r.intent, IntentType::Idle);
    }

    #[test]
    fn multi_word_phrase_matching() {
        let r = classify("show me a line chart of sales over time");
        assert_eq!(r.intent, IntentType::Data);
        let data_score = r.scores.iter().find(|(i, _)| *i == IntentType::Data).unwrap().1;
        assert!(data_score >= 4, "line chart + show should score high, got {data_score}");
    }
}
