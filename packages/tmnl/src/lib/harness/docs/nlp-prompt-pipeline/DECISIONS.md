# NLP Prompt Pipeline — Ratified Decisions

> **Date**: 2026-03-01  
> **Status**: RATIFIED (Design Deck Round 1)

---

## Decision 1: Inference Engine → Candle + ort Hybrid

**Candle** for BERT encoding (pure-Rust, small binary, hot path) and **ort** for BLEURT scoring (ONNX Runtime, battle-tested quantization for learned metrics).

```toml
[dependencies]
candle-core = "0.8"
candle-nn = "0.8"
candle-transformers = "0.8"
ort = { version = "2.0", features = ["load-dynamic"] }
tokenizers = "0.20"
ndarray = "0.16"
```

**Rationale**: Best of both worlds — minimal deps for the hot path (Candle), proven runtime for the learned metric that must be ONNX-exported regardless (ort).

---

## Decision 2: IPC Protocol → JSON-RPC over stdio

Standard Tauri sidecar pattern. Newline-delimited JSON on stdin/stdout. Tauri manages lifecycle.

```rust
// Request framing
{ "jsonrpc": "2.0", "id": 1, "method": "annotate", "params": { "prompt": "..." } }
// Response framing  
{ "jsonrpc": "2.0", "id": 1, "result": { "prefix_block": "...", "confidence": 0.87 } }
```

**Rationale**: Simple, no ports, no networking. Tauri has first-class sidecar support. IPC overhead ~1-5ms — negligible against model inference.

---

## Decision 3: Embedding Model → Tiered (MiniLM + bert-base)

- **Hot path** (every prompt): `all-MiniLM-L6-v2` INT8 — 384-dim, 1-4ms
- **Deep path** (ambiguity flagged, confidence < 0.65): `bert-base-uncased` INT8 — 768-dim, 5-12ms

Both loaded at startup. Router checks MiniLM confidence score — if below threshold, re-encodes with bert-base for higher-fidelity disambiguation.

**Memory budget**: ~265MB total (45MB MiniLM + 220MB bert-base). Acceptable for desktop sidecar.

**Rationale**: "Go for gold" — fast path stays fast, deep path gives quality when it matters. Most prompts never hit bert-base.

---

## Decision 4: Annotation Format → JSON Block (Suggestive)

Fenced JSON block prepended to prompt. **Suggestive, not prescriptive** — candidates hint at likely components but don't constrain the model's output.

```
```generation-context
{
  "intent": { "type": "dashboard", "confidence": 0.87 },
  "candidates": [
    { "type": "MetricCard", "similarity": 0.91, "hint": "likely primary" },
    { "type": "Grid", "similarity": 0.88, "hint": "layout container" },
    { "type": "Progress", "similarity": 0.73, "hint": "if metrics present" }
  ],
  "disambiguation": [
    { "clash": ["Card", "Alert"], "reason": "'status' maps to both surface types" },
    { "ambiguity": "system", "note": "3 possible referents in context" }
  ],
  "hints": {
    "temperature": 0.3,
    "note": "high-confidence intent — prefer deterministic output"
  }
}
```

**Key design choice**: The `hint` field on each candidate is natural language — "likely primary", "layout container", "if metrics present". This gives the model *reasoning context* rather than hard constraints. The model can ignore hints if the user's intent diverges.

**Rationale**: JSON is consistent with NDJSON output format. "Suggestive in the type" — candidates are ranked suggestions, not requirements. The model retains agency.

---

## Summary

| Aspect | Decision |
|---|---|
| BERT inference | Candle (pure Rust) |
| BLEURT inference | ort (ONNX Runtime) |
| IPC | JSON-RPC over stdio |
| Hot path model | MiniLM-L6-v2 INT8 (1-4ms) |
| Deep path model | bert-base INT8 (5-12ms, confidence < 0.65) |
| Output format | Fenced JSON block |
| Output style | Suggestive hints, not prescriptive |
| Total sidecar RAM | ~265MB |
| Total sidecar disk | ~200MB (models + binary) |
