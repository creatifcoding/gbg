# NLP Prompt Annotation Pipeline — Requirements

> **Questionnaire ID**: `nlp-prompt-pipeline-requirements`  
> **Date**: 2026-03-01  
> **Status**: RATIFIED  

---

## Ratified Answers

### Q1: Execution Model → Tauri Sidecar

Rust binary spawned by Tauri alongside the app. Native performance, no WASM size constraints. Can use full-size quantized models (MiniLM at 22MB, bert-base at 110MB, BLEURT-D12 at 65MB). Desktop-only context is acceptable — this is TMNL.

### Q2: Annotation Target → Full Assembled Prompt (Bidirectional)

Processes the entire prompt assembly (system + user). Detects semantic collisions between catalog descriptions, user intent, and context. Also bidirectional — post-generation scoring feeds drift delta back into next annotation cycle.

User elaboration: *"bidi as well"*

### Q3: Latency Budget → 50–200ms (Acceptable)

Room for quantized BERT inference on a single input. Real-time scoring. Most Rust WASM BERT implementations land here.

User elaboration: *"we can just go for gold and do the hard thing in the latency budget we have."*

### Q4: Output Shape → Structured Prefix Block (with Semantic Tags)

Emits a `<generation-context>` block prepended to the prompt with: intent classification, component candidates, disambiguation notes, confidence score. Includes semantic tag annotations inline.

User elaboration: *"with semantic tags and the likes."*

### Q5: Rust Framework → Candle (HF) as Baseline

HF's Rust ML framework. Native BERT/BLEURT support. Most active ecosystem. But evaluate alternatives during spike.

User elaboration: *"we need to try them, but use candle as baseline."*

### Q6: First Spike → Thin E2E with Real BERT

Full pipeline shape: detect intent → annotate → score output. With actual BERT inference, not just heuristics. Also include BERTScore + BLEURT post-generation scoring.

User elaboration: *"do the e2e with bert and shi too."*

---

## Derived Constraints

| Constraint | Value | Source |
|---|---|---|
| Max pre-flight latency | 200ms | Q3 |
| Min model quality | MiniLM-L6-v2 (384-dim) | Research finding |
| Binary deployment | Tauri sidecar (`nlp-sidecar`) | Q1 |
| IPC protocol | JSON-RPC over stdin/stdout | Tauri sidecar pattern |
| Catalog embedding | Pre-computed at startup | Performance requirement |
| Post-gen scoring | Async (no UX impact) | Q2 bidi + Q3 budget |
| Output format | XML prefix block + JSON sideband | Q4 |
| Framework priority | Candle > ort > tract > rust-bert | Q5 |
| Spike scope | Full E2E with BERT inference | Q6 |
| Graceful degradation | Skip annotation on sidecar failure | Advisory pipeline |

---

## Non-Requirements (Explicitly Out of Scope)

- Browser WASM execution (sidecar only)
- Fine-tuning models (use off-the-shelf quantized)
- Custom training data (use pre-trained checkpoints)
- Blocking low-confidence generations (advisory first, gating later)
- WASM fallback for non-Tauri contexts
