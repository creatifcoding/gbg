# Tool Effectivity Eval Harness

> Instrument design for measuring capability through the tool parameter aperture.  
> Applies to: `Maiden.Melanie.Runtime` and any future Maiden AI agent.

## Problem Statement

Tool capability is not a scalar. A parameter is not a unit — it's a **conduit**, and the capability that flows through it is a function of:

1. **Description envelope** — natural language that tells the model *when* and *why*, not just *what*
2. **Schema constraint surface** — an enum with 4 values ≠ a free string, even though both count as "1 param"
3. **Co-parameter entanglement** — params within the same tool are semantically coupled
4. **Inter-tool context** — a param's utility is conditioned on other tools present
5. **Conversation state** — the same tool definition means different things at turn 1 vs. turn 8
6. **Model priors** — Claude's training distribution determines how much description is "needed"

Any metric that divides "capability" by "kB" is measuring **cost** precisely and **value** not at all. The value side is emergent from a combinatorial interaction space. You cannot project a high-dimensional, context-dependent information surface onto a single scalar without destroying exactly the structure you needed.

## Design Principle

**Hold two axes fixed, vary one, measure.**

The result is not a metric but a *conditional effectiveness surface* — local gradients observed through structured perturbation. Three axes of variation:

| Axis | What Varies | What's Measured |
|------|------------|-----------------|
| **Query Distribution** | The intent type the tool set faces | Selection accuracy per stratum |
| **Definition Variant** | kB invested in description/examples | Accuracy delta per kB invested |
| **Tool Composition** | Number and similarity of tools disclosed | Degradation curve with multiplicity |

## Axis 1: Query Distribution

Stratified corpus, 10–20 queries per stratum, each with a **gold annotation** specifying expected tool sequence and parameter shapes.

| Stratum | Example | Expected Sequence | Tests |
|---------|---------|-------------------|-------|
| `direct_lookup` | "What happened on Feb 24?" | `semantic_search` | Single-tool selection |
| `synthesis` | "Summarize the last week of Jido work" | `semantic_search` → `summarize` | Multi-tool chaining |
| `relationship` | "How does alarm connect to order?" | `semantic_search` → `find_connections` | Entity ID handoff |
| `ambiguous` | "Tell me about contracts" | Any tool valid | Selection under ambiguity |
| `adversarial` | "What's the weather in London?" | None | False positive resistance |
| `multi_hop` | "Find OAuth info, summarize, find connections to provider registry" | All three | Full ReAct loop |

### Gold Annotation Format

```json
{
  "id": "direct-003",
  "stratum": "direct_lookup",
  "query": "What happened on Feb 24?",
  "gold": {
    "tool_sequence": ["semantic_search"],
    "param_shapes": {
      "semantic_search": {
        "query": "contains_keyword:Feb 24",
        "limit": "any_integer"
      }
    },
    "should_not_call": ["summarize", "find_connections"]
  }
}
```

The `contains_keyword` matcher validates that the param contains relevant terms without requiring exact string match. This absorbs model paraphrasing without being so loose that anything passes.

## Axis 2: Tool Definition Variants

Same logical capability, different kB investment.

| Variant | Strategy | ~kB/tool | ~Tokens/tool |
|---------|----------|----------|-------------|
| `minimal` | Name + 1 sentence | 0.3 | 100 |
| `lean` | 2–3 sentences + param docs | 0.8 | 280 |
| `rich` | 4–5 sentences + when to/not to use | 1.4 | 470 |
| `rich_examples` | Rich + 2 `input_examples` | 2.5 | 830 |
| `over_specified` | 3 paragraphs + 5 examples + edge cases | 4.0 | 1330 |

The gradient **∂Precision/∂kB** between adjacent variants reveals where description investment pays off and where it hits diminishing returns — or goes negative (description crowds context).

## Axis 3: Tool Set Composition

| Composition | Count | Contents |
|-------------|-------|----------|
| `core_3` | 3 | `semantic_search`, `summarize`, `find_connections` |
| `core_5` | 5 | Core + `timeline_query`, `entity_lookup` |
| `core_5_decoys` | 8 | Core-5 + `keyword_search`, `topic_summary`, `graph_traverse` |
| `scaled_15` | 15 | Core-5+decoys + domain-specific tools |

**Decoys** are tools with similar names/descriptions that serve different purposes. They test confusion rate — `keyword_search` vs `semantic_search`, `topic_summary` vs `summarize`. If a pair is chronically confused, you rename or redescribe.

## Observation Vector

For each `(query, variant, composition)` triple:

```elixir
%Observation{
  # Identity
  query_id: "direct-003",
  stratum: :direct_lookup,
  tool_variant: :rich,
  composition: :core_3,

  # Selection (automated)
  tools_called: ["semantic_search"],
  tools_expected: ["semantic_search"],
  selection_correct: true,
  false_positives: [],
  false_negatives: [],

  # Parameters (automated)
  params_sent: %{"query" => "Feb 24 events", "limit" => 5},
  params_conformant: true,
  param_shape_match: true,

  # Temporal (automated)
  first_tool_latency_ms: 1240,
  iteration_count: 2,
  e2e_latency_ms: 3450,

  # Context Economics (automated)
  input_tokens: 1893,
  output_tokens: 412,
  tool_result_tokens: 340,
  total_tokens: 2645,

  # Quality (requires judge)
  answer_addresses_query: :pending,
  answer_cites_sources: :pending,
  answer_quality_score: :pending
}
```

**Automated fields** (~80% of signal): selection, params, timing, tokens. Captured during the ReAct run.

**Judged fields** (~20% of signal): answer quality. Backfilled via LLM-as-judge pass on a subsample, or human eval.

## Conditional Metrics

Every metric is **conditioned on the axes held fixed**. There is no "overall tool effectiveness."

| Metric | Signature | Interpretation |
|--------|-----------|---------------|
| **Precision(s, v)** | `f(stratum, variant) → [0,1]` | Selection accuracy per query type and description investment. Plot as heatmap. |
| **Conformance(s, v)** | `f(stratum, variant) → [0,1]` | Parameter correctness per query type and variant. Shows where `input_examples` help. |
| **∂Precision/∂kB** | `f(stratum, v₁→v₂) → %/kB` | Local gradient of description investment. Diminishing returns detector. |
| **∂Precision/∂N** | `f(stratum, c₁→c₂) → %/tool` | Degradation curve with tool count. Shows where confusion starts. |
| **Confusion(a, b, c)** | `f(tool_a, tool_b, composition) → count` | Which tool pairs are confused, under which compositions. Directly actionable. |
| **ContextDrag(s, c)** | `f(stratum, composition) → ms/iter` | Iteration latency slope. Shows context accumulation overhead. |
| **Utilization(c)** | `f(composition) → [0,1]` | Fraction of disclosed tools actually invoked. Low = wasted context. |

### Composite (use with caution)

```
Effectivity(s, v, c) = (Precision × Conformance) / (ContextBudgetRatio × IterationCount)
```

Only meaningful for comparing variants **within a fixed stratum+composition**. Comparing across strata is comparing apples to the concept of fruit.

## Implementation

| Component | Path | Responsibility |
|-----------|------|---------------|
| Query Corpus | `eval/corpus/*.json` | Gold-annotated queries, stratified |
| Tool Variants | `eval/variants/*.ex` | Same actions, different descriptions |
| Compositions | `eval/compositions/*.json` | Which modules per composition |
| Harness Runner | `eval/harness.exs` | Iterates matrix, runs queries, writes JSONL |
| Matchers | `eval/matchers.ex` | Gold annotation validators |
| Judge | `eval/judge.exs` | LLM-as-judge for quality scoring |
| Analysis | `eval/analyze.exs` | Conditional metrics + heatmaps |

### Run Budget

| Metric | Value |
|--------|-------|
| Total calls | 75 queries × 5 variants × 4 compositions = **1,500** |
| Runtime | ~75 min @ 3s/call |
| API cost | ~$20 (Sonnet 4) |
| Quick slice | ~300 calls (diagonal: one variant per stratum) |

### When to Run

- **Tool definition change** — description, schema, or examples modified
- **Tool addition** — new tools enter the composition
- **Model change** — switching models or version upgrades
- **Hypothesis validation** — "will `input_examples` improve conformance on synthesis?"

This is **not CI**. It's a deliberate experiment run when independent variables change.

## References

- [Anthropic Tool Use Docs](https://docs.anthropic.com/en/docs/build-with-claude/tool-use/overview)
- [Anthropic Advanced Tool Use](https://www.anthropic.com/engineering/advanced-tool-use) — Tool Search, Programmatic Tool Calling, Tool Use Examples
- [Tool Parameter Format — Sizing & Metrics](~/.agents/diagrams/maidens/tool-parameter-metrics.html) — companion visual
- [Eval Harness Design](~/.agents/diagrams/maidens/tool-eval-harness.html) — companion visual
