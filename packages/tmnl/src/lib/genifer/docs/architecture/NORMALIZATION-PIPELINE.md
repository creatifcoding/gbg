Good question. Let me think about this properly before we build anything.

The spike exposed a real gap: **the space between "LLM returns bytes" and "genifer has a UITree" is currently empty.** The streaming tokenizer + d2ts graph identify components mid-stream, but there's no principled pipeline for turning the *complete* response into a normalized, validated UITree.

Here are the clusters I see:

---

## Cluster 1: Response Extraction (Deterministic)

**Problem**: The raw LLM output isn't always clean JSON.

```
"```json\n{...}\n```"          → markdown fences
"Here's your dashboard: {...}" → prose wrapper  
"{...},}"                      → trailing commas
"{...}// comment"              → JS-style comments
```

This is pure string surgery. No LLM needed. A `extractJson(raw: string): string` function with ordered strategies:

1. Strip markdown fences (`/^```(?:json)?\n?/`)
2. Find outermost `{...}` or `[...]` bracket pair
3. Remove trailing commas before `}` or `]`
4. Strip single-line comments
5. Return cleaned string or `ParseError`

**Where it lives**: `genifer/core/normalize.ts` — stateless, pure function.

---

## Cluster 2: Format Detection + Canonical Conversion (Deterministic)

**Problem**: Models return at least 3 structural formats for the same semantic content.

| Format | Shape | Frequency |
|--------|-------|-----------|
| **Nested** | `{ type, key, props, children: [{...}] }` | Most common with strong prompts |
| **Flat** | `{ root: "key", elements: { key: {...} } }` | When model mirrors UITree's own serialization |
| **Hybrid** | `{ type, key, children: ["k1","k2"], k1: {...} }` | Model invents this when tree is large |

The canonical internal form is **UITree** (HashMap-backed, `root` + `elements`). So the normalizer converts any format → UITree.

Format detection is a discriminator:
- Has `root` + `elements` + no `type` → Flat
- Has `type` + `children[0]` is string → Hybrid  
- Has `type` + `children[0]` is object → Nested
- None of the above → Unknown → error path

**This is the key insight**: format detection is a **Schema.Union discriminator problem**. We could model it with three tagged schemas and let `Schema.decodeUnknown` pick the right branch.

```typescript
const NestedFormat = Schema.Struct({ type: Schema.String, children: Schema.Array(Schema.Unknown) })
const FlatFormat = Schema.Struct({ root: Schema.String, elements: Schema.Record(...) })
const HybridFormat = ... // harder — needs refinement predicate
const LLMResponse = Schema.Union(FlatFormat, NestedFormat, HybridFormat)
```

**Where it lives**: `genifer/core/normalize.ts` — deterministic conversion functions.

---

## Cluster 3: Structural Repair (Deterministic + Heuristic)

**Problem**: Even after format normalization, the tree may be structurally broken.

- Missing `key` fields → auto-generate (content-hash or positional)
- Orphan nodes (referenced in children but no definition) → placeholder element
- Duplicate keys → suffix with `-2`, `-3`
- Missing `type` → infer from props shape or mark `"Unknown"`
- Circular references → detect and break
- Empty containers that BFTA expects children for → flag but don't reject

This is a **repair pipeline** — a chain of `UITree → UITree` transformations:

```
normalizedTree
  |> assignMissingKeys
  |> deduplicateKeys  
  |> resolveOrphans
  |> inferMissingTypes
  |> breakCircularRefs
  → repairedTree
```

**Where it lives**: `genifer/core/repair.ts` — each step is a pure function.

---

## Cluster 4: Prompt Engineering (Agentic)

**Problem**: The best normalization is not needing normalization. If the prompt is precise enough, the model returns the right format first time.

This isn't just "put better instructions in the prompt." It's:

**4a. Format Specification Template**
- A reusable prompt fragment that specifies the exact JSON schema
- Includes a concrete 3-node example (not just description)
- Tested per-model: gpt-4o-mini needs more hand-holding than claude-3.5

**4b. Model-Specific Prompt Profiles**
- Different models have different JSON compliance. A `PromptProfile` per model family:
  - `openai-4o`: reliable, minimal guardrails needed
  - `openai-4o-mini`: occasionally wraps in fences, sometimes hybrid format
  - `claude-3.5`: very reliable JSON, but sometimes adds prose preamble
  - `local-llama`: needs aggressive format enforcement + few-shot

**4c. Catalog-to-Schema Compiler**
- Auto-generate a JSON Schema from the registered catalog components
- Include it in the prompt: "Your response must conform to this schema: ..."
- Models that support structured output (OpenAI function calling, Anthropic tool use) can enforce this at the API level

**Where it lives**: 
- 4a: `genifer/core/prompts.ts` — extend PromptTemplate with format fragments
- 4b: `genifer/core/prompt-profiles.ts` — model→profile mapping
- 4c: `genifer/core/catalog-schema.ts` — catalog → JSON Schema compiler

---

## Cluster 5: Feedback Loop (Agentic)

**Problem**: Sometimes the model just gets it wrong, and no amount of prompt engineering prevents it.

**5a. Validation Gate**
- After normalize → repair → BFTA validate, score the result
- Score = (accepted nodes / total nodes) × (depth achieved / depth requested)
- If score < threshold → retry with refined prompt

**5b. Error-Aware Retry**
- Parse failure → retry with "Return ONLY valid JSON, no markdown"
- BFTA rejection → retry with specific constraint reminder
- Wrong format → retry with explicit example of correct format
- Max 2 retries, then return best-effort partial tree

**5c. Response Quality Signal**
- Feed validation results back to prompt selection
- Over time, learn which prompt profile works best for which model
- This could be a simple scoring atom — not ML, just counters

**Where it lives**: `genifer/core/pipeline.ts` — orchestrates the full flow as an Effect program.

---

## The Full Pipeline

```
User Query
    ↓
┌─────────────────────────┐
│ Prompt Engineering      │  ← Cluster 4
│ (template + profile +   │
│  catalog schema)        │
└───────────┬─────────────┘
            ↓
     LLM Call (streaming)
            ↓
    ┌───────┴───────┐
    │ SSE chunks    │ → Tokenizer → d2ts graph → BFTA (streaming validation)
    └───────┬───────┘
            ↓
     Complete Response
            ↓
┌─────────────────────────┐
│ Response Extraction     │  ← Cluster 1
│ (fences, prose, commas) │
└───────────┬─────────────┘
            ↓
┌─────────────────────────┐
│ Format Detection +      │  ← Cluster 2
│ Canonical Conversion    │
└───────────┬─────────────┘
            ↓
┌─────────────────────────┐
│ Structural Repair       │  ← Cluster 3
│ (keys, orphans, dedup)  │
└───────────┬─────────────┘
            ↓
┌─────────────────────────┐
│ BFTA Validation (full)  │  ← Already built
└───────────┬─────────────┘
            ↓
       Score Result
            ↓
    score ≥ threshold?
     ├─ yes → UITree ✅
     └─ no  → Retry  ← Cluster 5
              (max 2×)
```

---

That's my five clusters. The deterministic ones (1, 2, 3) are clear — pure functions, testable in isolation. The agentic ones (4, 5) need design decisions about scope.
