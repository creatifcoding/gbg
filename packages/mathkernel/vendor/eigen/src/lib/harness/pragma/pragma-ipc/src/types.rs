//! Domain types for PRAGMA IPC.
//!
//! Every struct here corresponds to a field or response shape referenced in:
//! - DECISIONS.md (annotation format, tiered routing, DomainResult)
//! - TESTING.md (snapshot fields, golden corpus entries, assertion targets)
//! - RESEARCH.md (pipeline stages, output shapes)

use serde::{Deserialize, Serialize};

// ─── Result Envelope ────────────────────────────────────────────────

/// Three-tier domain result envelope.
///
/// Every sidecar response wraps its payload in this:
/// - `Ok`: Full success, all models available, confidence sufficient.
/// - `Degraded`: Primary result available, but with warnings
///   (e.g., bert-base unavailable → MiniLM fallback, BLEURT unavailable → BERTScore only).
/// - `Error`: No usable result. Caller must handle gracefully.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "_tag")]
pub enum DomainResult<T> {
    Ok {
        value: T,
    },
    Degraded {
        value: T,
        warnings: Vec<String>,
    },
    Error {
        code: String,
        detail: String,
    },
}

impl<T> DomainResult<T> {
    /// Extract the value if Ok or Degraded, None if Error.
    pub fn value(&self) -> Option<&T> {
        match self {
            Self::Ok { value } | Self::Degraded { value, .. } => Some(value),
            Self::Error { .. } => None,
        }
    }

    /// Whether this is an error (no usable result).
    pub fn is_error(&self) -> bool {
        matches!(self, Self::Error { .. })
    }

    /// Whether this is degraded (result available but with caveats).
    pub fn is_degraded(&self) -> bool {
        matches!(self, Self::Degraded { .. })
    }
}

// ─── Intent Classification ──────────────────────────────────────────

/// Intent types classified by the FSM.
///
/// These map 1:1 to the automata states in pragma-automata.
/// IDLE is the default / out-of-scope classification.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum IntentType {
    /// Data retrieval / metrics display
    Data,
    /// Form / input collection
    Form,
    /// Dashboard / layout composition
    Layout,
    /// Feedback / alerts / status
    Feedback,
    /// Multiple intents detected (≥2 triggers co-occur)
    Mixed,
    /// Out-of-scope or no UI intent detected
    Idle,
}

/// Intent classification result from the FSM + embedding pipeline.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct IntentClassification {
    /// Primary classified intent.
    #[serde(rename = "type")]
    pub intent_type: IntentType,
    /// Confidence score in [0.0, 1.0].
    /// Below 0.65 triggers bert-base deep path.
    pub confidence: f32,
    /// Which model produced this classification.
    pub model_used: ModelTier,
    /// Whether bert-base deep path was triggered (confidence < threshold).
    pub tier_escalated: bool,
}

// ─── Catalog Candidates ─────────────────────────────────────────────

/// A ranked catalog component candidate.
///
/// Each candidate represents a component from the Genifer catalog that
/// semantically matches the user's prompt. Ranked by cosine similarity
/// against the prompt embedding.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Candidate {
    /// Component type name from the catalog (e.g., "MetricCard", "Grid").
    #[serde(rename = "type")]
    pub component_type: String,
    /// Cosine similarity between prompt embedding and component description embedding.
    /// Range [0.0, 1.0].
    pub similarity: f32,
    /// Natural language hint for the model — suggestive, not prescriptive.
    /// e.g., "likely primary", "layout container", "if metrics present"
    pub hint: String,
}

// ─── Disambiguation ─────────────────────────────────────────────────

/// A disambiguation entry for ambiguous prompts.
///
/// When the FSM detects MIXED intent or candidates have overlapping
/// similarity scores, disambiguation entries explain the clash.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(untagged)]
pub enum DisambiguationEntry {
    /// Two or more components clash on the same semantic role.
    Clash {
        clash: Vec<String>,
        reason: String,
    },
    /// A term in the prompt has multiple possible referents.
    Ambiguity {
        ambiguity: String,
        note: String,
    },
}

// ─── Generation Hints ───────────────────────────────────────────────

/// Suggestive generation hints derived from annotation confidence.
///
/// These are advisory — the model retains full agency.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct GenerationHints {
    /// Suggested temperature (lower for high-confidence, higher for ambiguous).
    pub temperature: f32,
    /// Human-readable reasoning for the suggestion.
    pub note: String,
}

// ─── Model Tier ─────────────────────────────────────────────────────

/// Which embedding model was used for this operation.
///
/// Tests assert on this field to verify tiered routing:
/// - High confidence → MiniLM only
/// - Low confidence (< 0.65) → escalated to BertBase
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ModelTier {
    /// all-MiniLM-L6-v2 INT8 — 384-dim, 1-4ms (hot path)
    Minilm,
    /// bert-base-uncased INT8 — 768-dim, 5-12ms (deep path)
    BertBase,
}

// ─── Sideband Metadata ──────────────────────────────────────────────

/// Sideband metadata attached to every annotate/score response.
///
/// Not part of the generation-context prefix — internal telemetry
/// consumed by the harness for observability and test assertions.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Sideband {
    /// Which model(s) were used. May list both if tier escalation occurred.
    pub models_used: Vec<ModelTier>,
    /// Wall-clock latency for the full operation in milliseconds.
    pub latency_ms: f64,
    /// Whether the catalog embeddings were recomputed (hash mismatch).
    pub catalog_recomputed: bool,
}

// ─── Warmup ─────────────────────────────────────────────────────────

/// Response payload for the `warmup` method.
///
/// Returned after all models are loaded and ready.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct WarmupResponse {
    /// Whether warmup completed successfully.
    pub ready: bool,
    /// Models loaded and their status.
    pub models: Vec<ModelStatus>,
    /// Number of catalog component embeddings cached.
    pub catalog_embeddings_count: usize,
    /// Embedding drift status against baseline (if baseline exists).
    pub drift_status: DriftStatus,
    /// Cold start latency in milliseconds.
    pub warmup_ms: f64,
}

/// Status of a loaded model.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ModelStatus {
    /// Model identifier.
    pub name: String,
    /// Model tier.
    pub tier: ModelTier,
    /// Whether the model loaded successfully.
    pub loaded: bool,
    /// File size in bytes.
    pub size_bytes: u64,
    /// Embedding dimension (384 for MiniLM, 768 for bert-base).
    pub embedding_dim: usize,
}

/// Drift status from baseline comparison.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DriftStatus {
    /// No drift detected (or no baseline to compare against).
    Ok,
    /// Minor drift detected (0.05 < distance < 0.10).
    Warning,
    /// Significant drift detected (distance > 0.10).
    Alert,
    /// No baseline available (first run).
    NoBaseline,
}

// ─── Annotate ───────────────────────────────────────────────────────

/// Request params for the `annotate` method.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AnnotateParams {
    /// The user's raw prompt text.
    pub prompt: String,
}

/// Response payload for the `annotate` method.
///
/// Contains everything the harness needs to:
/// 1. Prepend a `generation-context` prefix block to the prompt
/// 2. Adjust generation parameters (temperature, top-p)
/// 3. Log telemetry for evaluation
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AnnotateResponse {
    /// Intent classification result.
    pub intent: IntentClassification,
    /// Ranked catalog component candidates (top 5).
    pub candidates: Vec<Candidate>,
    /// Disambiguation entries (empty if unambiguous).
    pub disambiguation: Vec<DisambiguationEntry>,
    /// Suggestive generation hints.
    pub hints: GenerationHints,
    /// The rendered prefix block (fenced JSON, ready to prepend).
    pub prefix_block: String,
    /// Sideband telemetry (not included in prefix block).
    pub sideband: Sideband,
}

// ─── Score ──────────────────────────────────────────────────────────

/// Request params for the `score` method.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ScoreParams {
    /// The original prompt (or reference text) the generation was based on.
    pub reference: String,
    /// The LLM's generated output (NDJSON or text).
    pub hypothesis: String,
}

/// BERTScore precision / recall / F1 triple.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub struct BertScoreResult {
    pub precision: f32,
    pub recall: f32,
    pub f1: f32,
}

/// Response payload for the `score` method.
///
/// Contains fidelity and quality metrics for a generation.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ScoreResponse {
    /// BERTScore measuring semantic similarity between reference and hypothesis.
    pub bertscore: BertScoreResult,
    /// BLEURT quality score (learned metric, ~human correlation).
    /// `None` if BLEURT model unavailable (Degraded mode).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bleurt: Option<f32>,
    /// Drift delta = confidence - fidelity.
    /// Positive → generation diverged from intent.
    /// Non-positive → generation faithful to intent.
    pub drift_delta: f32,
    /// Sideband telemetry.
    pub sideband: Sideband,
}

// ─── Generation Context Block ───────────────────────────────────────

/// The full generation-context JSON structure that gets rendered into
/// the fenced prefix block.
///
/// This is the content inside the ` ```generation-context ` fence.
/// Serialized by the prefix block builder in pragma-automata.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct GenerationContext {
    pub intent: IntentClassification,
    pub candidates: Vec<Candidate>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub disambiguation: Vec<DisambiguationEntry>,
    pub hints: GenerationHints,
}

// ─── Tests ──────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn domain_result_ok_serde_roundtrip() {
        let result: DomainResult<String> = DomainResult::Ok {
            value: "hello".to_string(),
        };
        let json = serde_json::to_string(&result).unwrap();
        assert!(json.contains(r#""_tag":"Ok""#));
        let parsed: DomainResult<String> = serde_json::from_str(&json).unwrap();
        assert_eq!(result, parsed);
        assert!(!result.is_error());
        assert!(!result.is_degraded());
        assert_eq!(result.value(), Some(&"hello".to_string()));
    }

    #[test]
    fn domain_result_degraded_carries_warnings() {
        let result: DomainResult<u32> = DomainResult::Degraded {
            value: 42,
            warnings: vec![
                "bert-base unavailable, using MiniLM fallback".to_string(),
            ],
        };
        let json = serde_json::to_string(&result).unwrap();
        assert!(json.contains(r#""_tag":"Degraded""#));
        assert!(json.contains("bert-base unavailable"));
        let parsed: DomainResult<u32> = serde_json::from_str(&json).unwrap();
        assert!(parsed.is_degraded());
        assert_eq!(parsed.value(), Some(&42));
    }

    #[test]
    fn domain_result_error_has_no_value() {
        let result: DomainResult<String> = DomainResult::Error {
            code: "MODEL_UNAVAILABLE".to_string(),
            detail: "MiniLM model file not found".to_string(),
        };
        assert!(result.is_error());
        assert_eq!(result.value(), None);
    }

    #[test]
    fn intent_type_serde_screaming_snake() {
        let json = serde_json::to_string(&IntentType::Mixed).unwrap();
        assert_eq!(json, r#""MIXED""#);
        let parsed: IntentType = serde_json::from_str(r#""IDLE""#).unwrap();
        assert_eq!(parsed, IntentType::Idle);
    }

    #[test]
    fn intent_type_all_variants_roundtrip() {
        for variant in [
            IntentType::Data,
            IntentType::Form,
            IntentType::Layout,
            IntentType::Feedback,
            IntentType::Mixed,
            IntentType::Idle,
        ] {
            let json = serde_json::to_string(&variant).unwrap();
            let parsed: IntentType = serde_json::from_str(&json).unwrap();
            assert_eq!(variant, parsed);
        }
    }

    #[test]
    fn model_tier_serde_snake_case() {
        assert_eq!(serde_json::to_string(&ModelTier::Minilm).unwrap(), r#""minilm""#);
        assert_eq!(serde_json::to_string(&ModelTier::BertBase).unwrap(), r#""bert_base""#);
    }

    #[test]
    fn drift_status_all_variants() {
        for variant in [DriftStatus::Ok, DriftStatus::Warning, DriftStatus::Alert, DriftStatus::NoBaseline] {
            let json = serde_json::to_string(&variant).unwrap();
            let parsed: DriftStatus = serde_json::from_str(&json).unwrap();
            assert_eq!(variant, parsed);
        }
    }

    #[test]
    fn annotate_response_full_shape() {
        let resp = AnnotateResponse {
            intent: IntentClassification {
                intent_type: IntentType::Layout,
                confidence: 0.87,
                model_used: ModelTier::Minilm,
                tier_escalated: false,
            },
            candidates: vec![
                Candidate {
                    component_type: "MetricCard".to_string(),
                    similarity: 0.91,
                    hint: "likely primary".to_string(),
                },
                Candidate {
                    component_type: "Grid".to_string(),
                    similarity: 0.88,
                    hint: "layout container".to_string(),
                },
            ],
            disambiguation: vec![
                DisambiguationEntry::Clash {
                    clash: vec!["Card".to_string(), "Alert".to_string()],
                    reason: "'status' maps to both surface types".to_string(),
                },
            ],
            hints: GenerationHints {
                temperature: 0.3,
                note: "high-confidence intent — prefer deterministic output".to_string(),
            },
            prefix_block: "```generation-context\n{}\n```".to_string(),
            sideband: Sideband {
                models_used: vec![ModelTier::Minilm],
                latency_ms: 3.2,
                catalog_recomputed: false,
            },
        };

        let json = serde_json::to_string_pretty(&resp).unwrap();
        let parsed: AnnotateResponse = serde_json::from_str(&json).unwrap();
        assert_eq!(resp, parsed);

        // Verify all spec-required fields are present in serialized JSON
        assert!(json.contains("intent"));
        assert!(json.contains("candidates"));
        assert!(json.contains("disambiguation"));
        assert!(json.contains("hints"));
        assert!(json.contains("prefix_block"));
        assert!(json.contains("sideband"));
        assert!(json.contains("model_used"));
        assert!(json.contains("tier_escalated"));
        assert!(json.contains("similarity"));
        assert!(json.contains("hint"));
        assert!(json.contains("latency_ms"));
    }

    #[test]
    fn score_response_full_shape() {
        let resp = ScoreResponse {
            bertscore: BertScoreResult {
                precision: 0.89,
                recall: 0.85,
                f1: 0.87,
            },
            bleurt: Some(0.72),
            drift_delta: -0.15,
            sideband: Sideband {
                models_used: vec![ModelTier::Minilm, ModelTier::BertBase],
                latency_ms: 18.5,
                catalog_recomputed: false,
            },
        };

        let json = serde_json::to_string(&resp).unwrap();
        let parsed: ScoreResponse = serde_json::from_str(&json).unwrap();
        assert_eq!(resp, parsed);
    }

    #[test]
    fn score_response_without_bleurt() {
        let resp = ScoreResponse {
            bertscore: BertScoreResult {
                precision: 0.89,
                recall: 0.85,
                f1: 0.87,
            },
            bleurt: None,
            drift_delta: 0.02,
            sideband: Sideband {
                models_used: vec![ModelTier::Minilm],
                latency_ms: 8.1,
                catalog_recomputed: false,
            },
        };

        let json = serde_json::to_string(&resp).unwrap();
        assert!(!json.contains("bleurt")); // skip_serializing_if = None
    }

    #[test]
    fn warmup_response_shape() {
        let resp = WarmupResponse {
            ready: true,
            models: vec![
                ModelStatus {
                    name: "all-MiniLM-L6-v2".to_string(),
                    tier: ModelTier::Minilm,
                    loaded: true,
                    size_bytes: 22_000_000,
                    embedding_dim: 384,
                },
                ModelStatus {
                    name: "bert-base-uncased".to_string(),
                    tier: ModelTier::BertBase,
                    loaded: true,
                    size_bytes: 110_000_000,
                    embedding_dim: 768,
                },
            ],
            catalog_embeddings_count: 44,
            drift_status: DriftStatus::Ok,
            warmup_ms: 1850.0,
        };

        let json = serde_json::to_string(&resp).unwrap();
        let parsed: WarmupResponse = serde_json::from_str(&json).unwrap();
        assert_eq!(resp, parsed);
    }

    #[test]
    fn generation_context_matches_decisions_md_shape() {
        // This mirrors the exact JSON shape from DECISIONS.md Decision 4
        let ctx = GenerationContext {
            intent: IntentClassification {
                intent_type: IntentType::Layout,
                confidence: 0.87,
                model_used: ModelTier::Minilm,
                tier_escalated: false,
            },
            candidates: vec![
                Candidate {
                    component_type: "MetricCard".to_string(),
                    similarity: 0.91,
                    hint: "likely primary".to_string(),
                },
                Candidate {
                    component_type: "Grid".to_string(),
                    similarity: 0.88,
                    hint: "layout container".to_string(),
                },
                Candidate {
                    component_type: "Progress".to_string(),
                    similarity: 0.73,
                    hint: "if metrics present".to_string(),
                },
            ],
            disambiguation: vec![
                DisambiguationEntry::Clash {
                    clash: vec!["Card".to_string(), "Alert".to_string()],
                    reason: "'status' maps to both surface types".to_string(),
                },
                DisambiguationEntry::Ambiguity {
                    ambiguity: "system".to_string(),
                    note: "3 possible referents in context".to_string(),
                },
            ],
            hints: GenerationHints {
                temperature: 0.3,
                note: "high-confidence intent — prefer deterministic output".to_string(),
            },
        };

        let json = serde_json::to_string_pretty(&ctx).unwrap();
        let parsed: GenerationContext = serde_json::from_str(&json).unwrap();
        assert_eq!(ctx, parsed);
    }

    #[test]
    fn disambiguation_entry_untagged_variants() {
        // Clash variant
        let clash = DisambiguationEntry::Clash {
            clash: vec!["Card".to_string(), "Alert".to_string()],
            reason: "test".to_string(),
        };
        let json = serde_json::to_string(&clash).unwrap();
        assert!(json.contains("clash"));
        let parsed: DisambiguationEntry = serde_json::from_str(&json).unwrap();
        assert_eq!(clash, parsed);

        // Ambiguity variant
        let ambig = DisambiguationEntry::Ambiguity {
            ambiguity: "system".to_string(),
            note: "multiple referents".to_string(),
        };
        let json = serde_json::to_string(&ambig).unwrap();
        assert!(json.contains("ambiguity"));
        let parsed: DisambiguationEntry = serde_json::from_str(&json).unwrap();
        assert_eq!(ambig, parsed);
    }

    #[test]
    fn bertscore_result_self_reference_shape() {
        // BERTScore for identical text should have F1 >= 0.99
        // This test validates the type shape, not the computation
        let self_ref = BertScoreResult {
            precision: 1.0,
            recall: 1.0,
            f1: 1.0,
        };
        assert!(self_ref.f1 >= 0.99);
    }

    #[test]
    fn bertscore_result_bounds() {
        // All values should be in [0, 1]
        let result = BertScoreResult {
            precision: 0.0,
            recall: 0.5,
            f1: 0.33,
        };
        assert!((0.0..=1.0).contains(&result.precision));
        assert!((0.0..=1.0).contains(&result.recall));
        assert!((0.0..=1.0).contains(&result.f1));
    }
}
