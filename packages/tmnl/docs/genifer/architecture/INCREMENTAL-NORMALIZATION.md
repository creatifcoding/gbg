# Incremental Normalization Pipeline — Algebraic Design

```
Topic:          Concurrent, Incremental JSON→UITree Pipeline
Platform:       Genifer (TMNL)
Author:         Val (architectural conscience)
Date:           2026-02-20
Status:         DESIGN PROPOSAL
Depends on:     NORMALIZATION-PIPELINE.md (Cluster 1-5)
References:     research-component-algebra.md, research-categorical-composition.md,
                research-tree-grammars.md, research-d2ts-streaming-json.md
```

---

## 0. The Core Question

The normalization pipeline (Clusters 1–5) operates on the **complete** response. But
a UITree is composed of many UIElements, and the streaming tokenizer already processes
chunks incrementally. The question:

**Can we normalize, validate, and repair elements incrementally — as they complete
during streaming — rather than waiting for the full response?**

The answer is yes, and the algebraic foundations from F443 tell us exactly how.

---

## 1. What "Complete" Means for a Component

### 1.1 The Streaming Parse State

The tokenizer emits tokens with `depth` tracking. The graph accumulates `partialObjects`
per depth. Currently, `onComponentIdentified` fires when the discriminator field
(`_tag`/`type`) is encountered. But identification ≠ completion.

A component traverses three completeness levels during streaming:

```
Tokens arriving...
  ╭──────────────────────────────────────────────────╮
  │ { "type": "Card",                                │ ← IDENTIFIED (type seen)
  │   "key": "c1",                                   │
  │   "props": { "title": "Dashboard" },             │ ← PROPS COMPLETE (all own-props received)
  │   "children": [                                  │
  │     { "type": "MetricCard", ... },               │   (child 1 completing independently)
  │     { "type": "Text", ... }                      │   (child 2 completing independently)
  │   ]                                              │
  │ }                                                │ ← FULLY COMPLETE (ObjectEnd at component depth)
  ╰──────────────────────────────────────────────────╯
```

| Level | Event | What We Know | What We Can Do |
|-------|-------|--------------|----------------|
| **Identified** | `_tag`/`type` field seen | Component type, possibly key | BFTA push, allocate slot in tree |
| **Props Complete** | All non-`children` fields received | Full props, key, type | Normalize props, validate schema, begin rendering skeleton |
| **Fully Complete** | `ObjectEnd` at component depth | Everything including children | Validate parent→child, finalize in tree, run repair |

### 1.2 Detecting Props-Complete

Currently the graph tracks `partialObjects` as a flat `fields` record. We can detect
"props complete" by observing when the `children` key appears (or when `ObjectEnd` fires
without a `children` key — meaning it's a leaf).

```
Props-Complete = (Key("children") token arrives) OR (ObjectEnd without children)
```

For leaf nodes (no children), props-complete = fully-complete. This is the majority of
nodes in typical genifer output (MetricCard, Text, Badge, etc. are all leaves).

### 1.3 Formal Definition

Define a **completion frontier** Φ(t) at streaming time t:

```
Φ(t) = { e ∈ Elements | ObjectEnd(depth(e)) has been received by time t }
```

The frontier grows monotonically: Φ(t₁) ⊆ Φ(t₂) for t₁ ≤ t₂. This is a **lattice**
under set inclusion. The final tree is the join: T = ⊔ Φ(t) over all t.

---

## 2. The Algebraic Structure

### 2.1 Component Algebra Recap

From `research-component-algebra.md`: UIElements form a **semiring** (S, ⊕, ⊗, 0, 1) where:
- ⊕ is horizontal composition (siblings)
- ⊗ is vertical composition (parent-child nesting)
- 0 is the empty element
- 1 is the identity container

The key property: **both operations are associative**. This means we can process
elements in any order and combine results — the algebraic laws guarantee correctness.

### 2.2 The Normalization Functor

From `research-categorical-composition.md`: the normalization pipeline is a **functor**
N: 𝒞_raw → 𝒞_canonical that maps raw LLM output to canonical UIElements.

The critical property: **N is a local functor**. It operates on individual elements,
not the whole tree. Formally:

```
N(Tree) = Tree.map(N_element)    — N distributes over tree structure
```

This means we can apply N to each element independently. The functor preserves the
tree structure — it transforms the *content* of nodes, not the *shape* of the tree.

Concretely, `N_element` is the per-element pipeline:
```
N_element = extractProps ∘ detectFormat ∘ repairKeys ∘ validateSchema
```

Each step is a natural transformation between functors — they compose.

### 2.3 The Partial Tree Monoid

A partial tree (tree with some elements not yet complete) forms a **monoid** under
element insertion:

```
∅ ⊕ {e₁} = {e₁}           — identity
{e₁} ⊕ {e₂} = {e₁, e₂}   — composition (if e₁, e₂ have distinct keys)
```

Insertion is associative and has ∅ as identity. This means we can insert elements
into the UITree in any order and get the same result. The HashMap-backed UITree
already supports this — `tree.setElement(k, e)` is order-independent.

### 2.4 Independence Criterion

Two elements e₁ and e₂ can be normalized **concurrently** if:

```
Independent(e₁, e₂) iff ¬ancestor(e₁, e₂) ∧ ¬ancestor(e₂, e₁)
```

Siblings are always independent. Parent-child pairs have a dependency: the child's
BFTA validation requires knowing the parent's type (to check the allowed-children
constraint). But:
- The child's **normalization** (format detection, key repair, schema validation) is independent
- Only the **BFTA validation** requires parent context
- And even that only requires the parent's *type*, not its full normalized form

So the pipeline is:
```
Normalize: fully parallel (no dependencies)
Repair: mostly parallel (only duplicate-key detection needs global view)
Validate: partially ordered (parent type must be known before child validation)
Insert: fully parallel (HashMap is order-independent)
```

---

## 3. Incremental Pipeline Architecture

### 3.1 Extended Graph Callbacks

Current callbacks:
```typescript
onComponentIdentified(id: ComponentIdentification): void
onToken(token: JSONToken): void
onValidation(result: ValidationResult): void
```

New callbacks for incremental normalization:
```typescript
// Fires when all non-children props are received (or ObjectEnd for leaves)
onComponentPropsComplete(element: RawComponentData): void

// Fires when ObjectEnd arrives at the component's depth
onComponentComplete(element: RawComponentData): void

// The raw data accumulated during streaming
type RawComponentData = {
  readonly type: string
  readonly key: string | undefined
  readonly depth: number
  readonly props: Record<string, unknown>
  readonly childKeys: readonly string[]    // populated at complete time
  readonly format: 'nested' | 'flat'       // detected during accumulation
  readonly offset: { start: number; end: number }
}
```

### 3.2 The Incremental Normalization Operator

Instead of one monolithic normalize step after streaming, we add a d2ts operator
that processes completed components:

```
tokens → [tokenizer] → [component-tracker] → [normalizer] → [validator] → [tree-builder]
                              ↓                     ↓              ↓
                        onIdentified          onNormalized    onValidated
```

The component-tracker extends the existing `partialObjects` map to emit
`RawComponentData` when completeness is detected.

The normalizer is a pure function:
```typescript
function normalizeElement(raw: RawComponentData): UIElement
```

It handles:
1. **Key assignment**: if `key` is undefined, generate from `type + depth + offset`
2. **Props cleanup**: remove non-prop fields that leaked into props
3. **Type normalization**: lowercase, trim, alias resolution
4. **Schema validation**: decode props against registered schema (if any)

### 3.3 Partition Strategy

Components partition naturally by **depth independence**:

```
Depth 0: [Page]
Depth 1: [Section₁, Section₂, Section₃]          ← all independent
Depth 2: [Grid₁, Card₁, Grid₂, Card₂, Alert₁]   ← all independent  
Depth 3: [MetricCard₁..₈, Text₁..₃, ListItem₁..₃] ← all independent
```

Within each depth level, all components are siblings and therefore independent.
They can be normalized concurrently.

Cross-depth: children complete before parents (bottom-up in streaming order).
So when a parent completes, all its children are already normalized and validated.

This gives us a natural **wave-front** parallelism:
```
Time →
  Leaf elements normalize ═══════════╗
  Mid-level containers normalize ════╬══╗
  Root container normalizes ═════════╬══╬══╗
                                     ▼  ▼  ▼
                                  UITree assembled
```

### 3.4 Effect Concurrency Model

The normalization of independent elements maps directly to Effect's concurrency:

```typescript
// Normalize all complete elements at a depth level concurrently
const normalizeWave = (elements: readonly RawComponentData[]) =>
  Effect.all(
    elements.map(e => normalizeElement(e)),
    { concurrency: "unbounded" }  // siblings are independent
  )

// The full pipeline as an Effect program
const incrementalPipeline = Effect.gen(function* () {
  const raw = yield* streamAndAccumulate(chunks)  // streaming phase

  // Group completed elements by depth
  const byDepth = groupByDepth(raw.completedElements)
  const maxDepth = Math.max(...byDepth.keys())

  // Process bottom-up: leaves first, then containers
  const normalized = new Map<string, UIElement>()

  for (let d = maxDepth; d >= 0; d--) {
    const wave = byDepth.get(d) ?? []
    const results = yield* Effect.all(
      wave.map(e => Effect.sync(() => normalizeElement(e, normalized))),
      { concurrency: "unbounded" }
    )
    for (const el of results) normalized.set(el.key, el)
  }

  // Assemble tree (order-independent insertion)
  return buildTreeFromElements(normalized)
})
```

---

## 4. Format Detection as Algebraic Discriminator

### 4.1 The Three Formats as a Coproduct

The three JSON formats (Nested, Flat, Hybrid) are a **coproduct** (sum type) in 𝒞_schema:

```
LLMResponse = Nested + Flat + Hybrid
```

Each injection maps to a different normalization path:

```
ι₁: NestedJSON  → LLMResponse    (nested objects, children are objects)
ι₂: FlatJSON    → LLMResponse    (root + elements map, children are string keys)
ι₃: HybridJSON  → LLMResponse    (type at root, children are string keys, defs as siblings)
```

The universal property of the coproduct gives us the normalizer for free:

```
Given:
  f₁: NestedJSON  → UITree
  f₂: FlatJSON    → UITree
  f₃: HybridJSON  → UITree

There exists a unique:
  [f₁, f₂, f₃]: LLMResponse → UITree
```

This is just `match` / `switch` — but the categorical framing tells us something
important: **the normalizer is compositional**. Adding a fourth format (Format D)
just adds another injection and handler. The rest of the pipeline doesn't change.

### 4.2 Incremental Format Detection

Here's where it gets interesting. Format detection doesn't need the full response.
We can detect format **during streaming** from the first few tokens:

| Tokens Seen | Format |
|-------------|--------|
| `ObjectStart, Key("type"), String(...)` | Nested or Hybrid |
| `ObjectStart, Key("root"), String(...)` | Flat |
| After `Key("children"), ArrayStart, ObjectStart` | Nested (children are objects) |
| After `Key("children"), ArrayStart, String(...)` | Hybrid (children are string refs) |

So by the time the first child starts, we know the format. This means the normalizer
can be configured once, early in streaming, and applied to every subsequent component.

### 4.3 Schema-Directed Parsing

The registered catalog provides schemas for each component type. Instead of parsing
JSON generically and then validating, we can **parse directed by the schema**:

```
onComponentIdentified("MetricCard") → look up MetricCard schema →
  expect: { label: string, value: string, trend?: string, color?: string }
  → parse only these fields, ignore extras, flag missing required fields
```

This is the **initial algebra** approach from the component algebra research:
the schema defines the carrier, and parsing is the unique algebra morphism from
the free algebra (raw JSON) to the carrier.

---

## 5. Progressive Rendering Bridge

### 5.1 Three-Phase Rendering

The incremental pipeline enables **progressive rendering** in React:

**Phase 1: Skeleton** (on `onComponentIdentified`)
- We know the type. Render a placeholder with correct dimensions.
- React key is assigned (even if temporary).
- Layout is reserved.

**Phase 2: Props Hydration** (on `onComponentPropsComplete`)
- We have the full props. Render the real component with content.
- But children may still be streaming — show loading indicators for child slots.

**Phase 3: Full Tree** (on `onComponentComplete`)
- All children are placed. Parent-child validation done.
- Final render with animations.

### 5.2 Atom-per-Element

Each UIElement gets its own atom (via the existing `Atom.family` pattern):

```typescript
// Already exists: streamTreeFamily keyed by StreamId
// Extension: elementFamily keyed by StreamId + elementKey

const elementAtom = Atom.family((streamId: string, elementKey: string) =>
  Atom.make<UIElement | null>(null)
)
```

When a component completes and is normalized, its atom is updated. Only the
affected component re-renders — not the whole tree. This is the
**structural sharing** property of HashMap at the React level.

---

## 6. Repair as Natural Transformation

### 6.1 Repair Steps as Endofunctors

Each repair step is an endofunctor on UIElement:

```
assignKey:       UIElement → UIElement    (fills missing key)
deduplicateKey:  UIElement → UIElement    (suffixes duplicate keys)
resolveOrphan:   UIElement → UIElement    (creates placeholder for missing child)
inferType:       UIElement → UIElement    (guesses type from props)
```

These are all **endofunctors on the carrier set** — they transform elements without
changing the tree structure. They compose:

```
repair = assignKey ∘ deduplicateKey ∘ resolveOrphan ∘ inferType
```

### 6.2 Local vs Global Repairs

| Repair | Scope | Can Parallelize? |
|--------|-------|-----------------|
| assignKey | Local (single element) | ✅ Yes |
| inferType | Local (single element) | ✅ Yes |
| deduplicateKey | **Global** (needs all keys) | ❌ Sequential pass |
| resolveOrphan | **Semi-global** (needs child list) | ⚠️ Per-parent |
| breakCircular | **Global** (needs full graph) | ❌ Sequential pass |

The global repairs run after all elements are accumulated. The local repairs
run immediately on completion — during streaming.

**Pipeline split**:
```
Streaming phase:   identify → normalize → local-repair → insert-into-partial-tree
Post-stream phase: global-repair (dedup, orphans, cycles) → final-validate → done
```

---

## 7. Information-Theoretic Prompt Optimization

From `research-info-theory-prompts.md`: the optimal prompt minimizes the entropy
of the response format while maximizing the mutual information with the user's intent.

For format compliance specifically:
- **Few-shot example**: One concrete 3-node example reduces format entropy dramatically.
  The model mirrors the example format with high probability.
- **JSON Schema in prompt**: Reduces structural entropy but increases prompt length.
  Trade-off: token cost vs format reliability.
- **Model-specific calibration**: gpt-4o-mini has ~15% non-compliance rate without
  examples, ~2% with a concrete example. Claude-3.5 has ~3% baseline, ~0.5% with example.

The incremental pipeline makes format non-compliance cheaper to handle (we detect it
after the first few tokens and adapt), which shifts the trade-off: we can use shorter
prompts and handle more format variance in the normalizer.

---

## 8. Implementation Phases

### Phase 1: Deterministic Core (No streaming changes)
- `normalize.ts`: extractJson, detectFormat, convertToCanonical
- `repair.ts`: assignKey, deduplicateKey, resolveOrphan, inferType
- Pure functions, fully testable with spike JSON samples
- No changes to existing streaming graph

### Phase 2: Extended Graph Callbacks
- Add `onComponentPropsComplete` and `onComponentComplete` to graph
- Extend `partialObjects` to track full `RawComponentData`
- Emit completed elements with all accumulated fields

### Phase 3: Incremental Normalizer Operator
- d2ts operator that normalizes completed elements in-stream
- Per-element atom updates for progressive rendering
- Local repairs applied immediately

### Phase 4: Prompt Engineering Layer
- Format specification template fragments
- Model-specific profiles
- Catalog → JSON Schema compiler
- Few-shot example generator from catalog

### Phase 5: Feedback Loop
- Validation gate (score threshold)
- Error-aware retry with prompt refinement
- Quality signal accumulation

---

## 9. Key Properties (Invariants)

1. **Monotonicity**: Φ(t₁) ⊆ Φ(t₂) — the completion frontier only grows
2. **Commutativity**: element insertion order doesn't affect final tree
3. **Idempotency**: normalizing an already-normalized element is identity
4. **Locality**: N_element depends only on the element, not siblings
5. **Bottom-up ordering**: children complete before parents (in streaming)
6. **Convergence**: the partial tree converges to the full tree as streaming completes

These properties are testable via property-based tests (fast-check).

---

## 10. Open Questions

1. **Backpressure**: If normalization is slower than token arrival, do we buffer
   completed-but-not-yet-normalized elements? Or apply backpressure to the SSE reader?

2. **Speculative parsing**: Can we start normalizing a component before it's fully
   complete? (e.g., normalize props while children are still streaming)

3. **Format switching mid-stream**: What if the model starts in nested format but
   switches to flat format mid-response? (Unlikely but theoretically possible.)

4. **Error boundaries per-element**: If one element fails normalization, should we
   skip it (partial tree) or fail the whole pipeline?

5. **Worker offloading**: Should normalization run in a Web Worker? The streaming
   tokenizer + d2ts graph already run on the main thread. If normalization is
   CPU-heavy (schema validation), it might benefit from worker offload.
