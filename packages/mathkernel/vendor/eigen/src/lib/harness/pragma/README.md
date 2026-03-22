# PRAGMA — Prompt Refinement via Automata-Guided Meaning Analysis

Tauri sidecar Rust workspace for pragmatic meaning shift capture in generative UI prompts.

## Crate Layout

```
pragma/
├── pragma-sidecar/    Binary — main loop, JSON-RPC stdio, lifecycle
├── pragma-core/       Lib — BERT encoder (Candle), BERTScore, BLEURT (ort), embedding cache
├── pragma-ipc/        Lib — JSON-RPC protocol schemas, error codes, result envelope
├── pragma-automata/   Lib — FSM intent classifier, ambiguity detector, prefix block builder
└── models/            ONNX models (gitignored, provisioned by Nix + build.rs)
```

## Docs

See `src/lib/harness/docs/pragma/` for research, requirements, and decisions.
