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
                error: Some(errors::invalid_params(format!("invalid annotate params: {e}"))),
            };
        }
    };

    // Check payload size (TESTING.md Tier 10: 100KB+ should not OOM)
    if annotate_params.prompt.len() > 1_000_000 {
        return JsonRpcResponse {
            jsonrpc: protocol::JSONRPC_VERSION.to_string(),
            id,
            result: None,
            error: Some(errors::payload_too_large(annotate_params.prompt.len(), 1_000_000)),
        };
    }

    log::debug!("annotate: prompt_len={}", annotate_params.prompt.len());

    // Stub response — P4 will wire to real FSM + encoder
    let resp: DomainResult<AnnotateResponse> = DomainResult::Ok {
        value: AnnotateResponse {
            intent: IntentClassification {
                intent_type: IntentType::Idle,
                confidence: 0.0,
                model_used: ModelTier::Minilm,
                tier_escalated: false,
            },
            candidates: vec![],
            disambiguation: vec![],
            hints: GenerationHints {
                temperature: 0.7,
                note: "stub — no model loaded".to_string(),
            },
            prefix_block: String::new(),
            sideband: Sideband {
                models_used: vec![],
                latency_ms: 0.0,
                catalog_recomputed: false,
            },
        },
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

    // Stub response — P5 will wire to real BERTScore + BLEURT
    let resp: DomainResult<ScoreResponse> = DomainResult::Ok {
        value: ScoreResponse {
            bertscore: BertScoreResult {
                precision: 0.0,
                recall: 0.0,
                f1: 0.0,
            },
            bleurt: None,
            drift_delta: 0.0,
            sideband: Sideband {
                models_used: vec![],
                latency_ms: 0.0,
                catalog_recomputed: false,
            },
        },
    };

    JsonRpcResponse::success(id, serde_json::to_value(resp).unwrap())
}
