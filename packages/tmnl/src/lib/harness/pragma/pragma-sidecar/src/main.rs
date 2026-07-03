//! # pragma-sidecar
//!
//! Tauri sidecar binary for PRAGMA.
//!
//! Reads JSON-RPC 2.0 requests from stdin (newline-delimited),
//! dispatches to pragma-core/pragma-automata,
//! writes JSON-RPC responses to stdout. Logs to stderr.
//!
//! Lifecycle: warmup → (annotate | score)* → shutdown | EOF
//!
//! ## Error Model
//! - Malformed JSON → JSON-RPC parse error, loop continues
//! - Unknown method → JSON-RPC method_not_found, loop continues
//! - Domain failure → DomainResult::Error in response, loop continues
//! - EOF on stdin → clean exit (code 0)
//! - Shutdown method → clean exit (code 0) after responding

use std::io::{self, BufRead, Write};

use pragma_ipc::{
    errors,
    protocol::{self, JsonRpcResponse, Method},
};

fn main() {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info"))
        .target(env_logger::Target::Stderr)
        .init();

    log::info!("pragma-sidecar starting (pid={})", std::process::id());

    let exit_code = run_main_loop();

    log::info!("pragma-sidecar exiting (code={exit_code})");
    std::process::exit(exit_code);
}

/// Main stdin/stdout dispatch loop.
///
/// Returns exit code: 0 for clean shutdown, 1 for fatal error.
fn run_main_loop() -> i32 {
    let stdin = io::stdin();
    let stdout = io::stdout();
    let mut stdout_lock = stdout.lock();

    for line_result in stdin.lock().lines() {
        let line = match line_result {
            Ok(l) => l,
            Err(e) => {
                log::error!("stdin read error: {e}");
                return 1;
            }
        };

        // Skip blank lines (IPC chaos resilience — TESTING.md Tier 10)
        if line.trim().is_empty() {
            continue;
        }

        // Parse the request
        let request = match protocol::parse_request(&line) {
            Ok(req) => req,
            Err(rpc_err) => {
                // Can't extract request ID from malformed JSON — use id=0
                let resp = JsonRpcResponse {
                    jsonrpc: protocol::JSONRPC_VERSION.to_string(),
                    id: 0,
                    result: None,
                    error: Some(rpc_err),
                };
                write_response(&mut stdout_lock, &resp);
                continue;
            }
        };

        let id = request.id;

        // Resolve method
        let method = match Method::from_str(&request.method) {
            Some(m) => m,
            None => {
                let resp = JsonRpcResponse {
                    jsonrpc: protocol::JSONRPC_VERSION.to_string(),
                    id,
                    result: None,
                    error: Some(errors::method_not_found(&request.method)),
                };
                write_response(&mut stdout_lock, &resp);
                continue;
            }
        };

        log::debug!("dispatch: id={id} method={}", method.as_str());

        // Dispatch
        match method {
            Method::Warmup => {
                let resp = handle_warmup(id);
                write_response(&mut stdout_lock, &resp);
            }
            Method::Annotate => {
                let resp = handle_annotate(id, &request.params);
                write_response(&mut stdout_lock, &resp);
            }
            Method::Score => {
                let resp = handle_score(id, &request.params);
                write_response(&mut stdout_lock, &resp);
            }
            Method::Shutdown => {
                log::info!("shutdown requested (id={id})");
                let resp = JsonRpcResponse::success(id, serde_json::json!({"shutdown": true}));
                write_response(&mut stdout_lock, &resp);
                return 0;
            }
        }
    }

    // EOF on stdin — clean exit
    log::info!("stdin EOF, exiting cleanly");
    0
}

/// Write a JSON-RPC response to stdout, newline-terminated, flushed.
fn write_response(out: &mut impl Write, resp: &JsonRpcResponse) {
    let serialized = protocol::serialize_response(resp);
    if let Err(e) = out.write_all(serialized.as_bytes()) {
        log::error!("stdout write error: {e}");
    }
    if let Err(e) = out.flush() {
        log::error!("stdout flush error: {e}");
    }
}

// ─── Handlers (stubs — wired to pragma-core/automata in P4/P5) ─────

fn handle_warmup(id: u64) -> JsonRpcResponse {
    use pragma_ipc::types::*;

    // Stub: report not-yet-loaded models
    let resp = WarmupResponse {
        ready: false,
        models: vec![],
        catalog_embeddings_count: 0,
        drift_status: DriftStatus::NoBaseline,
        warmup_ms: 0.0,
    };

    JsonRpcResponse::success(id, serde_json::to_value(resp).unwrap())
}

fn handle_annotate(id: u64, params: &Option<serde_json::Value>) -> JsonRpcResponse {
    use pragma_ipc::types::*;

    // Validate params
    let params = match params {
        Some(p) => p,
        None => {
            return JsonRpcResponse {
                jsonrpc: protocol::JSONRPC_VERSION.to_string(),
                id,
                result: None,
                error: Some(errors::invalid_params("missing params")),
            };
        }
    };

    let annotate_params: AnnotateParams = match serde_json::from_value(params.clone()) {
        Ok(p) => p,
        Err(e) => {
            return JsonRpcResponse {
                jsonrpc: protocol::JSONRPC_VERSION.to_string(),
                id,
                result: None,
                error: Some(errors::invalid_params(format!(
                    "invalid annotate params: {e}"
                ))),
            };
        }
    };

    // Check payload size (TESTING.md Tier 10: 100KB+ should not OOM)
    if annotate_params.prompt.len() > 1_000_000 {
        return JsonRpcResponse {
            jsonrpc: protocol::JSONRPC_VERSION.to_string(),
            id,
            result: None,
            error: Some(errors::payload_too_large(
                annotate_params.prompt.len(),
                1_000_000,
            )),
        };
    }

    log::debug!("annotate: prompt_len={}", annotate_params.prompt.len());

    let start = std::time::Instant::now();

    // Phase 1: FSM classification (deterministic, <1ms)
    let fsm_result = pragma_automata::fsm::classify(&annotate_params.prompt);

    // Phase 2: Ambiguity analysis
    let ambiguity = pragma_automata::ambiguity::analyze(&fsm_result);

    // Phase 3: Build response
    // Note: Embedding-based ranking (pragma-core) is not yet wired.
    // For now, confidence comes from FSM scores + ambiguity analysis.
    // Candidates will be populated when pragma-core encoder is integrated.
    let confidence = ambiguity.confidence;
    let should_escalate = ambiguity.should_escalate;

    let intent_classification = IntentClassification {
        intent_type: fsm_result.intent,
        confidence,
        model_used: ModelTier::Minilm, // Will be real when encoder is wired
        tier_escalated: should_escalate,
    };

    let hints = GenerationHints {
        temperature: if confidence > 0.8 {
            0.3
        } else if confidence > 0.5 {
            0.5
        } else {
            0.7
        },
        note: ambiguity.reason.clone(),
    };

    let annotate_response = AnnotateResponse {
        intent: intent_classification,
        candidates: vec![], // Populated when pragma-core catalog is wired
        disambiguation: ambiguity.disambiguation,
        hints: hints.clone(),
        prefix_block: String::new(), // Will be set below
        sideband: Sideband {
            models_used: vec![ModelTier::Minilm],
            latency_ms: start.elapsed().as_secs_f64() * 1000.0,
            catalog_recomputed: false,
        },
    };

    // Phase 4: Build prefix block
    let prefix_block = pragma_automata::prefix::build_prefix_block(&annotate_response);
    let mut final_response = annotate_response;
    final_response.prefix_block = prefix_block;

    let resp: DomainResult<AnnotateResponse> = DomainResult::Ok {
        value: final_response,
    };

    JsonRpcResponse::success(id, serde_json::to_value(resp).unwrap())
}

fn handle_score(id: u64, params: &Option<serde_json::Value>) -> JsonRpcResponse {
    use pragma_ipc::types::*;

    let params = match params {
        Some(p) => p,
        None => {
            return JsonRpcResponse {
                jsonrpc: protocol::JSONRPC_VERSION.to_string(),
                id,
                result: None,
                error: Some(errors::invalid_params("missing params")),
            };
        }
    };

    let score_params: ScoreParams = match serde_json::from_value(params.clone()) {
        Ok(p) => p,
        Err(e) => {
            return JsonRpcResponse {
                jsonrpc: protocol::JSONRPC_VERSION.to_string(),
                id,
                result: None,
                error: Some(errors::invalid_params(format!("invalid score params: {e}"))),
            };
        }
    };

    // Payload size check
    let total_size = score_params.reference.len() + score_params.hypothesis.len();
    if total_size > 2_000_000 {
        return JsonRpcResponse {
            jsonrpc: protocol::JSONRPC_VERSION.to_string(),
            id,
            result: None,
            error: Some(errors::payload_too_large(total_size, 2_000_000)),
        };
    }

    log::debug!(
        "score: ref_len={} hyp_len={}",
        score_params.reference.len(),
        score_params.hypothesis.len()
    );

    let start = std::time::Instant::now();

    // Compute word-overlap BERTScore approximation.
    // When pragma-core is wired as a dep, this will use real BERT embeddings.
    // For now: Jaccard-inspired token overlap as structural placeholder.
    let ref_tokens: std::collections::HashSet<&str> =
        score_params.reference.split_whitespace().collect();
    let hyp_tokens: std::collections::HashSet<&str> =
        score_params.hypothesis.split_whitespace().collect();

    let (precision, recall, f1) = if ref_tokens.is_empty() || hyp_tokens.is_empty() {
        (0.0_f32, 0.0_f32, 0.0_f32)
    } else {
        let overlap = ref_tokens.intersection(&hyp_tokens).count() as f32;
        let p = overlap / hyp_tokens.len() as f32;
        let r = overlap / ref_tokens.len() as f32;
        let f = if p + r > 0.0 {
            2.0 * p * r / (p + r)
        } else {
            0.0
        };
        (p, r, f)
    };

    // Drift delta: how much did the generation diverge from the reference?
    // Positive = diverged, negative/zero = faithful.
    let drift_delta = 1.0 - f1;

    let latency_ms = start.elapsed().as_secs_f64() * 1000.0;

    let resp: DomainResult<ScoreResponse> = DomainResult::Ok {
        value: ScoreResponse {
            bertscore: BertScoreResult {
                precision,
                recall,
                f1,
            },
            bleurt: None, // Wired when ort session is integrated
            drift_delta,
            sideband: Sideband {
                models_used: vec![ModelTier::Minilm],
                latency_ms,
                catalog_recomputed: false,
            },
        },
    };

    JsonRpcResponse::success(id, serde_json::to_value(resp).unwrap())
}
