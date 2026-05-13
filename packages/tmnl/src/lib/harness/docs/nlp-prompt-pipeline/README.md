# NLP Prompt Annotation Pipeline

Pragmatic meaning shift capture for generative UI prompt optimization.

## What Is This?

A Tauri sidecar Rust binary that intercepts the assembled harness prompt before LLM dispatch, runs NLP analysis (BERT embeddings, BERTScore, BLEURT), and injects a structured `<generation-context>` prefix block that guides the model toward higher-fidelity UI generation.

**Bidirectional**: Also scores LLM output post-generation, computing drift delta that feeds back into the next annotation cycle.

## Documents

| File | Purpose |
|---|---|
| `REQUIREMENTS.md` | Ratified requirements from alignment questionnaire |
| `RESEARCH.md` | Full research: ecosystem analysis, architecture, implementation strategies, latency budgets, model sizing, spike plan |

## Quick Architecture

```
Harness Engine → Prompt Factory → [NLP Sidecar IPC] → Annotated Prompt → LLM
                                         ↑                                  │
                                         │          ┌──────────────────────┘
                                         │          ▼
                                  Drift Delta ← [Post-Gen Scorer]
```

## Key Numbers

| Metric | Target |
|---|---|
| Pre-flight latency (MiniLM) | 5–15ms |
| Pre-flight latency (bert-base) | 15–35ms |
| Post-gen scoring | 13–25ms (async) |
| Sidecar RAM (MiniLM + BLEURT-D12) | ~182MB |
| Sidecar disk (ONNX INT8 models) | ~89MB |
| Catalog embedding cache | ~67KB |

## Status

- [x] Requirements alignment (questionnaire)
- [x] Research (ecosystem, architecture, implementation)
- [ ] Visual explainer
- [ ] Design deck
- [ ] Spike implementation
