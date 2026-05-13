# NLP Prompt Annotation Pipeline — Research

> **Status**: Research complete, pending design deck + visual explainer  
> **Date**: 2026-03-01  
> **Questionnaire**: `nlp-prompt-pipeline-requirements` (persisted)  
> **Related**: `src/lib/genifer/docs/specs/CATALOG_REBUILD_SPEC.md`, `src/lib/harness/prompt/`

---

## 1. Ratified Requirements

| Dimension | Decision | Notes |
|---|---|---|
| **Execution** | Tauri sidecar | Rust binary, native perf, no WASM size constraints |
| **Annotation target** | Full assembled prompt (system + user) | Bidirectional: pre-flight annotation + post-generation scoring |
| **Latency budget** | 50–200ms | Quantized BERT; "go for gold" |
| **Output shape** | Structured prefix block + semantic tags | `<generation-context>` prepended to prompt, sideband confidence metrics |
| **Rust framework** | Candle (HF) baseline | Evaluate ort/tract as alternatives |
| **First spike** | Thin E2E with real BERT | Full pipeline shape: detect → annotate → score |

---

## 2. Pipeline Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                         Tauri Main Process                           │
│                                                                      │
│  ┌─────────────┐    ┌──────────────────┐    ┌───────────────────┐   │
│  │  Harness     │───►│  Prompt Factory   │───►│  NLP Sidecar IPC  │   │
│  │  Engine      │    │  (assembled       │    │  (JSON-RPC over   │   │
│  │              │    │   system+user)     │    │   stdin/stdout)   │   │
│  └──────────────┘    └──────────────────┘    └────────┬──────────┘   │
│                                                        │              │
└────────────────────────────────────────────────────────┼──────────────┘
                                                         │ IPC
┌────────────────────────────────────────────────────────▼──────────────┐
│                    Rust Sidecar Binary                                 │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │                    PHASE 1: PRE-FLIGHT                          │  │
│  │                                                                 │  │
│  │  ┌────────────┐   ┌─────────────┐   ┌──────────────────────┐  │  │
│  │  │ Tokenizer  │──►│ BERT Encode │──►│ Intent Classifier     │  │  │
│  │  │ (HF        │   │ (Candle /   │   │ (cosine vs catalog    │  │  │
│  │  │ tokenizers)│   │  ort INT8)  │   │  embeddings)          │  │  │
│  │  └────────────┘   └──────┬──────┘   └──────────┬───────────┘  │  │
│  │                          │                      │               │  │
│  │                   ┌──────▼──────┐   ┌──────────▼───────────┐  │  │
│  │                   │ Ambiguity   │   │ Component Candidate   │  │  │
│  │                   │ Detector    │   │ Ranker (embedding     │  │  │
│  │                   │ (drift      │   │  similarity vs        │  │  │
│  │                   │  scoring)   │   │  catalog schemas)     │  │  │
│  │                   └──────┬──────┘   └──────────┬───────────┘  │  │
│  │                          │                      │               │  │
│  │                   ┌──────▼──────────────────────▼───────────┐  │  │
│  │                   │    Automata: Structured Prefix Builder   │  │  │
│  │                   │                                         │  │  │
│  │                   │  <generation-context>                   │  │  │
│  │                   │    intent: dashboard                    │  │  │
│  │                   │    confidence: 0.87                     │  │  │
│  │                   │    candidates: [MetricCard, Grid, Card] │  │  │
│  │                   │    disambiguation:                      │  │  │
│  │                   │      - [COMPONENT_CLASH: Card vs Alert] │  │  │
│  │                   │      - [HIGH_AMBIGUITY: "status" → 3    │  │  │
│  │                   │         possible intents]               │  │  │
│  │                   │  </generation-context>                  │  │  │
│  │                   └─────────────────────────────────────────┘  │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │                    PHASE 2: POST-GENERATION                     │  │
│  │                                                                 │  │
│  │  ┌────────────┐   ┌─────────────┐   ┌──────────────────────┐  │  │
│  │  │ NDJSON     │──►│ BERT Encode │──►│ BERTScore            │  │  │
│  │  │ Output     │   │ (output     │   │ (greedy bipartite    │  │  │
│  │  │ Parser     │   │  tokens)    │   │  matching)           │  │  │
│  │  └────────────┘   └─────────────┘   └──────────┬───────────┘  │  │
│  │                                                 │               │  │
│  │                                      ┌──────────▼───────────┐  │  │
│  │                                      │ BLEURT Score         │  │  │
│  │                                      │ (learned quality     │  │  │
│  │                                      │  judgment, ONNX)     │  │  │
│  │                                      └──────────┬───────────┘  │  │
│  │                                                 │               │  │
│  │                                      ┌──────────▼───────────┐  │  │
│  │                                      │ Drift Delta          │  │  │
│  │                                      │ Σ = intent_score -   │  │  │
│  │                                      │     output_score     │  │  │
│  │                                      │ → feeds next cycle   │  │  │
│  │                                      └──────────────────────┘  │  │
│  └─────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────┘
```

### Data Flow Summary

1. Harness `promptRegistry.build()` assembles full prompt (identity + catalog + guidelines + user message)
2. Before LLM dispatch: send assembled prompt to sidecar via IPC
3. Sidecar tokenizes, encodes via BERT, classifies intent, detects ambiguity, ranks component candidates
4. Sidecar returns `<generation-context>` prefix block + sideband scoring metadata
5. Harness prepends prefix to prompt, adjusts generation config (temperature, top-p) based on confidence
6. LLM generates NDJSON output
7. Post-generation: sidecar scores output against original intent via BERTScore + BLEURT
8. Drift delta feeds back into next annotation cycle's disambiguation logic

---

## 3. Rust Ecosystem Findings

### 3.1 Candle (Hugging Face — Primary)

**Repository**: `huggingface/candle`

**Strengths**:
- Pure Rust, no C++ deps (unlike tch-rs/libtorch)
- Native BERT model support
- ONNX import capability
- WASM compilation target (bonus for future browser mode)
- Active HF ecosystem integration
- GGUF quantization support

**Weaknesses**:
- No turnkey BERTScore implementation
- Fewer production benchmarks than ort
- Community smaller than PyTorch Rust bindings

**For our use case**: Load quantized BERT-base, extract embeddings, compute cosine similarities. Well-suited for sidecar where we control the Rust compilation.

### 3.2 ort (ONNX Runtime — Evaluate)

**Repository**: `pyke-ml/ort`

**Strengths**:
- Battle-tested ONNX Runtime underneath
- INT8 static/dynamic quantization built-in
- ~400 sentences/sec batch-32 on CPU (vs ~100 Python)
- 80-90% lower memory footprint (~100MB vs ~2GB)
- 10x faster cold starts (200-500ms)
- Proven WASM32-WASI target

**Weaknesses**:
- ONNX Runtime native library must ship with sidecar
- Larger binary size than pure-Rust solutions
- Less flexible than Candle for custom model architectures

**For our use case**: Strongest production story for quantized inference. Export BERT + BLEURT to ONNX via Python `optimum`, load in ort. Best latency/memory ratio.

### 3.3 tract (Sonos — Evaluate)

**Repository**: `sonos/tract`

**Strengths**:
- Pure Rust inference engine
- ONNX + TensorFlow support
- Excellent WASM story (no native deps)
- Smaller binary than ort
- Production-proven at Sonos for on-device NLP

**Weaknesses**:
- Smaller model coverage than ort
- Less active development than Candle
- INT8 quantization support less mature

**For our use case**: Fallback if ort binary size is problematic. Pure-Rust advantage means simpler cross-compilation.

### 3.4 rust-bert (Mature, Heavy)

**Repository**: `guillaume-be/rust-bert`

**Strengths**:
- Most mature Rust NLP library
- Ready-to-use pipelines: classification, NER, embeddings
- Full BERT, RoBERTa, DeBERTa support
- Dedicated ONNX module

**Weaknesses**:
- Depends on tch-rs (libtorch C++ bindings) — heavy
- ~2GB+ dependency footprint
- Harder to deploy as lean sidecar

**For our use case**: Good for prototyping. Production sidecar should use Candle or ort to avoid libtorch weight.

### 3.5 Recommendation

| Phase | Framework | Rationale |
|---|---|---|
| Spike (thin E2E) | **ort** | Fastest path to working BERT inference. Export ONNX from Python, load in Rust. Quantization built-in. |
| Production v1 | **Candle** or **ort** | Evaluate both in spike. Candle wins on pure-Rust simplicity; ort wins on proven perf. |
| BLEURT specifically | **ort** | BLEURT must be ONNX-exported regardless. ort is the natural host. |

---

## 4. BERTScore — Implementation Strategy

### Algorithm

BERTScore computes token-level semantic similarity between candidate and reference texts using BERT contextual embeddings.

```
BERTScore(candidate, reference):
  1. Tokenize candidate → C = [c₁, c₂, ..., cₙ]
  2. Tokenize reference → R = [r₁, r₂, ..., rₘ]
  3. Encode both through BERT → contextual embeddings
  4. Cosine similarity matrix S[i,j] = cos(cᵢ, rⱼ)
  5. Precision = (1/|C|) × Σᵢ max_j(S[i,j])
  6. Recall    = (1/|R|) × Σⱼ max_i(S[i,j])
  7. F1        = 2 × (P × R) / (P + R)
```

### Rust Implementation Sketch (ort)

```rust
use ort::{Session, inputs};
use tokenizers::Tokenizer;
use ndarray::{Array2, Axis};

pub struct BertScorer {
    session: Session,
    tokenizer: Tokenizer,
}

impl BertScorer {
    pub fn new(model_path: &str, tokenizer_path: &str) -> Result<Self> {
        let session = Session::builder()?
            .with_optimization_level(3)?
            .commit_from_file(model_path)?;
        let tokenizer = Tokenizer::from_file(tokenizer_path)?;
        Ok(Self { session, tokenizer })
    }

    pub fn score(&self, candidate: &str, reference: &str) -> BertScoreResult {
        let cand_emb = self.encode(candidate);  // [seq_len, 768]
        let ref_emb = self.encode(reference);   // [seq_len, 768]

        // Cosine similarity matrix
        let sim = cosine_similarity_matrix(&cand_emb, &ref_emb);

        // Greedy bipartite matching
        let precision = sim.map_axis(Axis(1), |row| row.iter().cloned().fold(f32::MIN, f32::max)).mean().unwrap();
        let recall = sim.map_axis(Axis(0), |col| col.iter().cloned().fold(f32::MIN, f32::max)).mean().unwrap();
        let f1 = 2.0 * precision * recall / (precision + recall + 1e-8);

        BertScoreResult { precision, recall, f1 }
    }

    fn encode(&self, text: &str) -> Array2<f32> {
        let encoding = self.tokenizer.encode(text, true).unwrap();
        let input_ids: Vec<i64> = encoding.get_ids().iter().map(|&id| id as i64).collect();
        let attention_mask: Vec<i64> = encoding.get_attention_mask().iter().map(|&m| m as i64).collect();
        let seq_len = input_ids.len();

        let outputs = self.session.run(inputs![
            "input_ids" => ndarray::Array2::from_shape_vec((1, seq_len), input_ids).unwrap(),
            "attention_mask" => ndarray::Array2::from_shape_vec((1, seq_len), attention_mask).unwrap(),
        ].unwrap()).unwrap();

        // Extract last_hidden_state: [1, seq_len, 768] → [seq_len, 768]
        outputs[0].try_extract_tensor::<f32>().unwrap()
            .to_owned()
            .into_shape((seq_len, 768)).unwrap()
    }
}

#[derive(Debug)]
pub struct BertScoreResult {
    pub precision: f32,
    pub recall: f32,
    pub f1: f32,
}
```

### Performance Expectations

| Model | Quantization | Latency (single pair) | Memory |
|---|---|---|---|
| bert-base-uncased | FP32 | ~15-25ms | ~440MB |
| bert-base-uncased | INT8 dynamic | ~5-12ms | ~110MB |
| distilbert-base | INT8 dynamic | ~3-8ms | ~65MB |
| MiniLM-L6 (all-MiniLM-L6-v2) | INT8 | ~1-4ms | ~22MB |

**Recommendation**: `all-MiniLM-L6-v2` INT8 for the scoring path (< 5ms per pair). `bert-base` INT8 for embedding quality when ambiguity detection needs higher fidelity.

---

## 5. BLEURT — Implementation Strategy

### Overview

BLEURT (Bilingual Evaluation Understudy with Representations from Transformers) is a **learned metric** trained on human quality judgments. Unlike BERTScore (unsupervised cosine matching), BLEURT fine-tunes a BERT model to predict human ratings directly.

### ONNX Export Path

```bash
# Python — export BLEURT checkpoint to ONNX
pip install optimum transformers
optimum-cli export onnx \
  --model lucadiliello/BLEURT-20-D12 \
  --task text-classification \
  bleurt-onnx/

# Quantize to INT8
python -m onnxruntime.quantization.quantize \
  --input bleurt-onnx/model.onnx \
  --output bleurt-onnx/model-quantized.onnx \
  --per_channel
```

### Rust Inference (ort)

```rust
pub struct BleurtScorer {
    session: Session,
    tokenizer: Tokenizer,
}

impl BleurtScorer {
    pub fn score(&self, reference: &str, candidate: &str) -> f32 {
        // BLEURT takes concatenated reference + candidate as input
        let encoding = self.tokenizer.encode((reference, candidate), true).unwrap();
        let input_ids: Vec<i64> = encoding.get_ids().iter().map(|&id| id as i64).collect();
        let attention_mask: Vec<i64> = encoding.get_attention_mask().iter().map(|&m| m as i64).collect();
        let token_type_ids: Vec<i64> = encoding.get_type_ids().iter().map(|&t| t as i64).collect();
        let seq_len = input_ids.len();

        let outputs = self.session.run(inputs![
            "input_ids" => Array2::from_shape_vec((1, seq_len), input_ids).unwrap(),
            "attention_mask" => Array2::from_shape_vec((1, seq_len), attention_mask).unwrap(),
            "token_type_ids" => Array2::from_shape_vec((1, seq_len), token_type_ids).unwrap(),
        ].unwrap()).unwrap();

        // BLEURT outputs a single scalar quality score
        outputs[0].try_extract_tensor::<f32>().unwrap()[[0, 0]]
    }
}
```

### Model Size & Latency

| Variant | Params | ONNX Size (FP32) | ONNX Size (INT8) | Latency (est.) |
|---|---|---|---|---|
| BLEURT-20-D12 (distilled) | ~66M | ~260MB | ~65MB | ~8-15ms |
| BLEURT-20 (full) | ~300M | ~1.2GB | ~300MB | ~30-60ms |

**Recommendation**: Use `BLEURT-20-D12` (distilled) — fits the 50-200ms budget with room to spare.

---

## 6. Pragmatic Meaning Shift Detection

### The Problem

When a user says *"show me the system status"*, the model must disambiguate:
- **Dashboard intent** → MetricCard + Grid + Progress + StatusDot
- **Single status check** → Alert or Badge
- **Detailed breakdown** → Table + KeyValue + Accordion

Pragmatic meaning shifts occur when:
1. **Context alters meaning** — "status" means different things in different domains
2. **Implicit references** — "the system" assumes shared context about which system
3. **Scalar implicature** — "some errors" implies "not many" but how few?
4. **Conversational history** — prior turn about "database" scopes "status" to DB health

### Detection Techniques

#### 6.1 Embedding-Space Drift Scoring

Compare user message embedding against catalog component embeddings:

```
drift_score(user_msg, catalog) =
  for each component C in catalog:
    sim[C] = cosine(embed(user_msg), embed(C.description))
  
  if max(sim) < AMBIGUITY_THRESHOLD (0.65):
    flag HIGH_AMBIGUITY
  
  if count(sim > CANDIDATE_THRESHOLD (0.50)) > 3:
    flag COMPONENT_CLASH with top candidates
  
  return sorted(sim, descending)[:5]  // top 5 candidates
```

#### 6.2 Finite Automaton for Intent Classification

State machine that classifies generation intent from lexical patterns:

```
States: {IDLE, DATA_INTENT, FORM_INTENT, LAYOUT_INTENT, FEEDBACK_INTENT, MIXED}

Transitions:
  IDLE → DATA_INTENT:    /\b(show|display|list|table|chart|data|metrics?)\b/
  IDLE → FORM_INTENT:    /\b(form|input|edit|create|submit|field)\b/
  IDLE → LAYOUT_INTENT:  /\b(dashboard|grid|layout|arrange|organize|section)\b/
  IDLE → FEEDBACK_INTENT: /\b(alert|warning|error|success|notification|status)\b/
  *    → MIXED:          second trigger from different category

  MIXED → requires disambiguation
```

#### 6.3 Semantic Tag Injection

Based on detection results, inject structured annotations:

```xml
<generation-context>
  <intent type="dashboard" confidence="0.87" />
  <candidates ranked="true">
    <component type="MetricCard" similarity="0.91" />
    <component type="Grid" similarity="0.88" />
    <component type="Progress" similarity="0.73" />
    <component type="Card" similarity="0.71" />
    <component type="Alert" similarity="0.68" />
  </candidates>
  <disambiguation>
    <clash components="Card,Alert" reason="'status' maps to both surface types" />
    <ambiguity term="system" note="3 possible referents in context" />
  </disambiguation>
  <quality-hints>
    <temperature suggestion="0.3" reason="high-confidence intent, prefer deterministic" />
  </quality-hints>
</generation-context>
```

---

## 7. Tauri Sidecar IPC Architecture

### Sidecar Binary Structure

```
nlp-sidecar/
├── Cargo.toml
├── src/
│   ├── main.rs              # stdin/stdout JSON-RPC loop
│   ├── bert.rs              # BERT encoder (Candle or ort)
│   ├── bertscore.rs         # BERTScore implementation
│   ├── bleurt.rs            # BLEURT scorer (ort/ONNX)
│   ├── automata.rs          # Intent classification FSM
│   ├── annotator.rs         # Structured prefix builder
│   ├── embeddings.rs        # Pre-computed catalog embeddings cache
│   └── ipc.rs               # JSON-RPC message framing
└── models/
    ├── bert-base-int8.onnx  # Quantized BERT
    ├── bleurt-d12-int8.onnx # Quantized BLEURT
    ├── tokenizer.json       # HF tokenizer
    └── catalog-embeddings/  # Pre-computed catalog component embeddings
```

### IPC Protocol (JSON-RPC over stdin/stdout)

```typescript
// Request: Harness → Sidecar
interface AnnotateRequest {
  jsonrpc: "2.0"
  id: number
  method: "annotate"
  params: {
    prompt: string                    // Full assembled prompt
    catalog_hash: string              // Cache key for catalog embeddings
    conversation_context?: string     // Prior turns for pragmatic scoping
  }
}

// Response: Sidecar → Harness
interface AnnotateResponse {
  jsonrpc: "2.0"
  id: number
  result: {
    prefix_block: string              // XML generation-context block
    confidence: number                // 0.0 - 1.0
    intent: string                    // classified intent
    candidates: ComponentCandidate[]  // ranked component suggestions
    ambiguities: Ambiguity[]          // detected clashes/drift
    latency_ms: number                // self-reported processing time
    sideband: {
      suggested_temperature: number
      suggested_top_p: number
      gate: "pass" | "warn" | "block" // low confidence → block
    }
  }
}

// Post-generation scoring
interface ScoreRequest {
  jsonrpc: "2.0"
  id: number
  method: "score"
  params: {
    original_intent: string           // User's original message
    generated_output: string          // Raw NDJSON output
    reference_prompt: string          // The annotated prompt that was sent
  }
}

interface ScoreResponse {
  jsonrpc: "2.0"
  id: number
  result: {
    bertscore: { precision: number, recall: number, f1: number }
    bleurt: number                    // Learned quality score
    drift_delta: number               // intent_confidence - output_fidelity
    latency_ms: number
  }
}
```

### Tauri Integration

```rust
// src-tauri/src/nlp_sidecar.rs
use tauri::api::process::{Command, CommandChild};

pub struct NlpSidecar {
    child: CommandChild,
}

impl NlpSidecar {
    pub fn spawn() -> Result<Self> {
        let (mut rx, child) = Command::new_sidecar("nlp-sidecar")?
            .spawn()
            .expect("Failed to spawn NLP sidecar");

        // Handle stdout messages in background
        tauri::async_runtime::spawn(async move {
            while let Some(event) = rx.recv().await {
                // Route JSON-RPC responses back to requesting handler
            }
        });

        Ok(Self { child })
    }

    pub async fn annotate(&self, prompt: &str) -> AnnotateResponse {
        let request = json!({
            "jsonrpc": "2.0",
            "id": next_id(),
            "method": "annotate",
            "params": { "prompt": prompt }
        });
        self.child.write(request.to_string().as_bytes())?;
        // ... await response
    }
}
```

---

## 8. Model Size & Memory Budget

### Sidecar Total Footprint

| Component | Model | Size (INT8) | RAM (loaded) |
|---|---|---|---|
| BERT encoder | all-MiniLM-L6-v2 | 22MB | ~45MB |
| BLEURT scorer | BLEURT-20-D12 | 65MB | ~130MB |
| Tokenizer | bert-base tokenizer | 0.5MB | ~2MB |
| Catalog embeddings cache | pre-computed | ~1MB | ~5MB |
| **Total** | | **~89MB disk** | **~182MB RAM** |

With bert-base instead of MiniLM:

| Component | Model | Size (INT8) | RAM (loaded) |
|---|---|---|---|
| BERT encoder | bert-base-uncased | 110MB | ~220MB |
| BLEURT scorer | BLEURT-20-D12 | 65MB | ~130MB |
| Tokenizer | bert-base tokenizer | 0.5MB | ~2MB |
| Catalog embeddings cache | pre-computed | ~1MB | ~5MB |
| **Total** | | **~177MB disk** | **~357MB RAM** |

**Recommendation**: Start with MiniLM for speed, upgrade to bert-base if embedding quality matters for ambiguity detection. BLEURT-D12 stays regardless.

---

## 9. Latency Budget Breakdown

Target: **50–200ms** total for pre-flight annotation.

| Step | Model | Est. Latency | Notes |
|---|---|---|---|
| Tokenize prompt | tokenizers crate | < 1ms | Pure Rust, fast |
| BERT encode user message | MiniLM-L6 INT8 | 1–4ms | Single sequence |
| BERT encode catalog (cached) | — | 0ms | Pre-computed at startup |
| Cosine similarity matrix | ndarray | < 1ms | 44 components × 384 dims |
| Intent automaton | FSM | < 0.1ms | Pure logic |
| Ambiguity detection | vector ops | < 1ms | Threshold + counting |
| Prefix block construction | string formatting | < 0.1ms | Template fill |
| IPC round-trip overhead | JSON-RPC stdio | 1–5ms | Serialization + pipe |
| **Total (MiniLM)** | | **~5–15ms** | Well under budget |
| **Total (bert-base)** | | **~15–35ms** | Still under budget |

Post-generation scoring (async, no latency impact on UX):

| Step | Model | Est. Latency |
|---|---|---|
| BERTScore (MiniLM) | greedy match | ~5–10ms |
| BLEURT (D12 INT8) | single forward pass | ~8–15ms |
| **Total post-gen** | | **~13–25ms** |

---

## 10. Catalog Embedding Pre-computation

At sidecar startup (or on catalog change), pre-compute embeddings for all catalog components:

```rust
pub struct CatalogEmbeddingCache {
    /// Component type → embedding vector [384] or [768]
    embeddings: HashMap<String, Vec<f32>>,
    /// Hash of catalog version for invalidation
    catalog_hash: String,
}

impl CatalogEmbeddingCache {
    pub fn build(encoder: &BertEncoder, catalog: &[CatalogEntry]) -> Self {
        let mut embeddings = HashMap::new();
        for entry in catalog {
            // Encode: "{type}: {description}. Props: {prop_names}"
            let text = format!(
                "{}: {}. Props: {}",
                entry.type_name,
                entry.description.unwrap_or_default(),
                entry.props_schema.keys().collect::<Vec<_>>().join(", ")
            );
            let emb = encoder.encode(&text);  // [384] or [768]
            embeddings.insert(entry.type_name.clone(), emb);
        }
        Self { embeddings, catalog_hash: compute_hash(catalog) }
    }

    pub fn similarity(&self, query_embedding: &[f32], component: &str) -> Option<f32> {
        self.embeddings.get(component).map(|emb| cosine(query_embedding, emb))
    }
}
```

With 44 components × 384 dims × 4 bytes = **~67KB** in memory. Trivial.

---

## 11. Open Questions

1. **Model selection validation**: Need to run MiniLM vs bert-base on real genifer prompts to verify embedding quality is sufficient for component disambiguation.

2. **BLEURT calibration**: BLEURT scores must be validated against our specific domain (UI generation NDJSON). May need fine-tuning or calibration curve.

3. **Conversation history window**: How many prior turns should feed into the pragmatic scoping? 1? 3? Full conversation?

4. **Confidence gating threshold**: At what confidence level should the pipeline block generation and request clarification? 0.3? 0.5?

5. **Catalog embedding drift**: When catalog changes (new components added), how quickly do we invalidate and recompute embeddings?

6. **Sidecar lifecycle**: Cold start on first generation request? Or pre-warm on app launch?

7. **Graceful degradation**: If sidecar crashes or times out, do we skip annotation and send the raw prompt? (Probably yes — advisory, not gating.)

---

## 12. Prior Art & References

### Papers

- Zhang et al., "BERTScore: Evaluating Text Generation with BERT" (ICLR 2020) — Foundational BERTScore paper
- Sellam et al., "BLEURT: Learning Robust Metrics for Text Generation" (ACL 2020) — Learned quality metric
- Reimers & Gurevych, "Sentence-BERT: Sentence Embeddings using Siamese BERT-Networks" (EMNLP 2019) — Efficient sentence embeddings
- Wang et al., "MiniLM: Deep Self-Attention Distillation for Task-Agnostic Compression" (NeurIPS 2020) — Small fast encoder

### Rust Libraries

| Library | URL | Use Case |
|---|---|---|
| candle | github.com/huggingface/candle | Pure-Rust ML, BERT inference |
| ort | github.com/pyke-ml/ort | ONNX Runtime Rust bindings |
| tract | github.com/sonos/tract | Pure-Rust ONNX inference |
| rust-bert | github.com/guillaume-be/rust-bert | Mature NLP pipelines |
| tokenizers | github.com/huggingface/tokenizers | Fast tokenization |
| ndarray | github.com/rust-ndarray/ndarray | N-dimensional arrays |

### Tauri Sidecar

- Tauri v2 Sidecar API: https://v2.tauri.app/develop/sidecar/
- Tauri IPC Concepts: https://v2.tauri.app/concept/inter-process-communication/
- Evil Martians Tauri Sidecar guide: https://evilmartians.com/chronicles/making-desktop-apps-with-revved-up-potential-rust-tauri-sidecar

---

## 13. Spike Plan

### Thin E2E Spike — "Prove the pipeline shape with real BERT"

**Goal**: Full loop working in < 1 day. Detect intent → annotate prompt → send to LLM → score output.

**Steps**:

1. **Rust sidecar skeleton** — stdin/stdout JSON-RPC loop, Cargo workspace
2. **ONNX model provisioning** — Export MiniLM-L6 + BLEURT-D12 to ONNX INT8 via Python script
3. **BertEncoder** — Load ONNX via ort, tokenize + encode single sequence
4. **Catalog embeddings** — Pre-compute from hardcoded core catalog (44 components)
5. **Intent classifier** — FSM + cosine similarity ranking
6. **Prefix builder** — Generate `<generation-context>` XML block
7. **BERTScore** — Greedy bipartite matching on output vs intent
8. **BLEURT** — Single forward pass quality score
9. **Tauri wiring** — Spawn sidecar, IPC round-trip from harness engine
10. **Evidence** — Log latency, confidence, drift delta for 5+ real prompts

**Success criteria**:
- Sidecar cold-starts in < 2s
- Annotation completes in < 100ms (MiniLM)
- Post-gen scoring completes in < 50ms
- Component candidates are plausible for 3/5 test prompts
- Pipeline doesn't block or visibly delay the user
