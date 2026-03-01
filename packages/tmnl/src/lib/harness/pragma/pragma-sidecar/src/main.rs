//! # pragma-sidecar
//!
//! Tauri sidecar binary for PRAGMA.
//!
//! Reads JSON-RPC 2.0 requests from stdin, dispatches to pragma-core/pragma-automata,
//! writes JSON-RPC responses to stdout. Logs to stderr.
//!
//! Lifecycle: warmup → (annotate | score)* → shutdown | EOF

fn main() {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info"))
        .target(env_logger::Target::Stderr)
        .init();

    log::info!("pragma-sidecar starting");

    // Main loop will be implemented in P1 task #3178
    // For now, just exit cleanly to prove the binary compiles
    log::info!("pragma-sidecar shutting down (stub)");
}
