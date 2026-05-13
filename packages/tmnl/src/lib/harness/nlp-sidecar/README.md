# nlp-sidecar — NLP Prompt Annotation Pipeline

Tauri sidecar Rust workspace for pragmatic meaning shift capture in generative UI prompts.

## Crate Layout

```
nlp-sidecar/
├── nlp-sidecar/      Binary — main loop, JSON-RPC stdio, lifecycle
├── nlp-core/          Lib — BERT encoder (Candle), BERTScore, BLEURT (ort), embedding cache
├── nlp-ipc/           Lib — JSON-RPC protocol schemas, error codes, result envelope
├── nlp-automata/      Lib — FSM intent classifier, ambiguity detector, prefix block builder
└── models/            ONNX models (gitignored, provisioned by Nix + build.rs)
```

## Docs

See `src/lib/harness/docs/nlp-prompt-pipeline/` for research, requirements, and decisions.
