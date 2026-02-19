# Research: d2ts as Streaming JSON Engine for Genifer

```
Topic:          Differential Dataflow for Incremental JSON Parsing
Platform:       Genifer (Generative UI subsystem of TMNL)
Author:         Val (architectural conscience)
Date:           2026-02-19
Status:         DRAFT
Lines:          ~500
Sections:       8
Frameworks:     Differential Dataflow, Lattice Theory, Visibly Pushdown Languages
Purpose:        Formal foundation for F437 (Streaming JSON Parser) + F447 (d2ts Streaming Theory)
Bibliography:   docs/genifer/research/BIBLIOGRAPHY.md
Extrapolates:   [TSG-DIFF-DATAFLOW], [TSG-ADR001], [TSG-FUSION-ONTOLOGY]
```

---

## 1. Problem Statement

### 1.1 The Streaming UI Generation Problem

An LLM generates a JSON payload describing a UI tree. The payload may be thousands of tokens. Between the first token and the last, the user sees nothing — or sees a loading spinner. This is unacceptable for interactive generative UI.

**Goal**: Render UI components *incrementally* as the LLM generates JSON tokens, identifying component types as early as possible and streaming partial props to renderers.

### 1.2 Why This Is a Differential Dataflow Problem

The key insight: **streaming JSON parsing is incremental computation over a monotonically growing input.**

| Differential Dataflow Concept | JSON Streaming Analog |
|---|----|
| Collection (MultiSet) | Set of parsed JSON tokens |
| Version (partially ordered) | (byte_offset, nesting_depth) |
| Difference (+1 insert) | New token arrives |
| Operator (map/filter/reduce) | Tokenize → bracket-match → assemble → discriminate |
| Antichain (frontier) | Set of components whose parsing is "in progress" |
| Consolidation | Final complete JSON object |

This mapping is not metaphorical — it is structurally exact. The same d2ts engine that processes tsingou's signal pipeline can process genifer's JSON token stream.

### 1.3 What Hashbrown Does (And How We Improve)

Hashbrown implements a custom streaming JSON parser with these properties:
- Eagerly parses incoming JSON to minimize latency [HASHBROWN]
- Uses `s.literal` discriminators for immediate component identification
- Generates simplified schemas for `anyOf` elements
- Supports `s.streaming.string()`, `s.streaming.array()`, `s.streaming.object()`

**Our improvement**: Instead of a bespoke parser, we use d2ts — a mathematically grounded incremental computation engine with formal convergence guarantees. This gives us:
1. **Proven correctness** via lattice fixed-point theory
2. **Composability** via d2ts operator algebra
3. **Reuse** of the same engine used by tsingou's signal pipeline
4. **Backpressure** via Effect.Stream integration

---

## 2. Mathematical Foundations

### 2.1 The Version Lattice

**Definition (JSON Parse Version).** Define the version space V = ℕ × ℕ as pairs (byte_offset, nesting_depth), equipped with the product order:

```
(b₁, d₁) ≤ (b₂, d₂)  iff  b₁ ≤ b₂  AND  d₁ ≤ d₂
```

This forms a product lattice [TSG-DIFF-DATAFLOW §2.3]:
- Join: (b₁, d₁) ∨ (b₂, d₂) = (max(b₁, b₂), max(d₁, d₂))
- Meet: (b₁, d₁) ∧ (b₂, d₂) = (min(b₁, b₂), min(d₁, d₂))

**Significance**: Two JSON tokens at different byte offsets but the same nesting depth are comparable. Two tokens at the same byte offset but different depths are comparable. But a token at (100, 3) and a token at (50, 5) are incomparable — neither subsumes the other. This correctly models the fact that a deeply nested value at byte 50 and a shallow value at byte 100 are independent parsing events.

This is structurally identical to tsingou's [tick, source_seq] version space [TSG-ADR001].

### 2.2 The Token MultiSet

**Definition (Token Collection).** The input to the d2ts graph is a Collection<JSONToken> where:

```typescript
type JSONToken =
  | { _tag: "ObjectStart" }          // {
  | { _tag: "ObjectEnd" }            // }
  | { _tag: "ArrayStart" }           // [
  | { _tag: "ArrayEnd" }             // ]
  | { _tag: "Key"; value: string }   // "key":
  | { _tag: "String"; value: string } // "value" (may be partial during streaming)
  | { _tag: "Number"; value: number }
  | { _tag: "Boolean"; value: boolean }
  | { _tag: "Null" }
```

**MultiSet semantics**: Insert-only (+1 per token, never -1). This matches tsingou's signal pipeline semantics [TSG-ADR001 §MultiSet semantics: Event accumulation (+1 only)].

**Rationale for insert-only**: JSON tokens, once emitted by the LLM, are never retracted. The stream is append-only. This simplifies the d2ts graph because we never need to handle negative multiplicities.

### 2.3 JSON as a Visibly Pushdown Language

**Key connection**: JSON is a *visibly pushdown language* [ALUR-VPL2004]. The structural tokens (`{`, `}`, `[`, `]`) form a well-nested word where:
- `{` and `[` are *call* symbols (push onto stack)
- `}` and `]` are *return* symbols (pop from stack)
- Keys and values are *internal* symbols

This means a tree automaton can recognize valid JSON structure [COMON-TATA2007 §1.6]. More importantly, the *partial* prefix of a JSON stream always has a well-defined parse state: the current stack of open brackets.

**Consequence**: At any point during streaming, we can determine:
1. Current nesting depth (= stack size)
2. Whether we're inside an object or array at each depth
3. The key path to the current position (e.g., `elements.root.props.title`)

This parse state is the **antichain frontier** of the d2ts computation.

---

## 3. The d2ts Graph Topology

### 3.1 Five-Stage Pipeline

Following tsingou's tiered graph pattern [TSG-ADR001 §Graph topology: Tiered: ingest → derived]:

```
Stage 1: TOKENIZE
  Input:  Stream<string>  (raw bytes from LLM)
  Output: Collection<JSONToken>
  Operator: D2.map()
  
Stage 2: BRACKET-MATCH
  Input:  Collection<JSONToken>
  Output: Collection<BracketPair>  (matched open/close with depth)
  Operator: D2.reduce()  (stateful: maintains bracket stack)
  
Stage 3: OBJECT-ASSEMBLE
  Input:  Collection<BracketPair> + Collection<JSONToken>
  Output: Collection<PartialObject>  (key-value pairs within matched brackets)
  Operator: D2.join()  (join tokens with their enclosing bracket pair)
  
Stage 4: DISCRIMINATE
  Input:  Collection<PartialObject>
  Output: Collection<ComponentIdentification>  (type + partial props)
  Operator: D2.filter() + D2.map()
  Filter: objects containing `_tag` or `type` key → component identified
  
Stage 5: PROP-STREAM
  Input:  Collection<ComponentIdentification>
  Output: Collection<PartialComponentProps>
  Operator: D2.map()
  Maps identified components to renderable partial props
```

### 3.2 Discriminator-Based Early Identification

**The critical optimization**: Stage 4 fires as soon as the `_tag` (or `type`) field appears in a partial object. Because genifer uses `Schema.TaggedStruct` with `_tag` as the discriminator field, the component type is identified from the *first few tokens* of each object.

For a genifer UIElement:
```json
{"key":"e1","type":"Grid","props":{"columns":3,"gap":"1rem",...},...}
```

The discriminator fires at byte ~25 (after `"type":"Grid"` is parsed), long before the full props object is complete. Stage 5 then streams partial props as they arrive.

**Effect.Schema connection**: The discriminator field is the same `_tag` used in `Schema.TaggedStruct`. The d2ts filter in Stage 4 matches against the catalog's registered component types.

### 3.3 Output Path

Following tsingou's pattern [TSG-ADR001 §Output path]:

```
d2ts output() → Effect.Queue → consumer fiber → Atom.set()
```

Specifically:
1. Stage 5 `output()` emits `PartialComponentProps` to an `Effect.Queue`
2. A consumer fiber reads from the queue
3. Fiber calls `Atom.set(partialTreeAtom, updatedTree)` 
4. React re-renders via `useAtomValue(partialTreeAtom)`

This is backpressure-aware: if React rendering falls behind, the queue applies backpressure to the d2ts graph, which buffers at stage boundaries.

---

## 4. Convergence Proof (Sketch)

### 4.1 The Lattice of Partial UI States

**Definition (Partial UI State).** Let S be the set of all partial UI trees, where a partial tree is a UITree with some elements having incomplete props (represented as `Partial<Record<string, unknown>>`).

Define the information ordering ⊑ on S:
```
s₁ ⊑ s₂  iff  for every element e in s₁, e exists in s₂ with props(e, s₁) ⊆ props(e, s₂)
```

That is, s₂ has at least all the elements and props that s₁ has.

**Claim**: (S, ⊑) is a directed-complete partial order (dcpo) with least element ⊥ = UITree.empty().

**Proof sketch**: 
- S is closed under directed limits (the union of a directed set of partial trees is a partial tree)
- UITree.empty() is the least element (it has no information)
- The complete UITree (full props for all elements) is the greatest element for any given tree shape

### 4.2 Monotonicity of the Parse Operator

**Definition (Parse Operator).** Let F: S → S be the function that incorporates one batch of new JSON tokens into the partial UI state.

**Claim**: F is monotone: if s₁ ⊑ s₂ then F(s₁) ⊑ F(s₂).

**Proof sketch**: F only adds information (new props, new elements). It never removes information. If s₁ already contains some information and s₂ contains all of s₁'s information plus more, then applying F (which adds the same new tokens to both) produces F(s₁) ⊑ F(s₂) because the additional information in s₂ is preserved.

### 4.3 Convergence via Kleene's Fixed-Point Theorem

By the Kleene fixed-point theorem [KLEENE-FPT]:

Since F is monotone and (S, ⊑) is a dcpo with ⊥, the ascending Kleene chain:

```
⊥ ⊑ F(⊥) ⊑ F²(⊥) ⊑ ... ⊑ Fⁿ(⊥) ⊑ ...
```

converges to the least fixed point lfp(F) = sup({Fⁿ(⊥) | n ∈ ℕ}).

**Interpretation**: Starting from an empty tree (⊥), each batch of tokens (application of F) produces a more complete partial UI state. The sequence converges to the complete UI tree (the fixed point where no more tokens remain to process).

**Finite convergence**: Since JSON payloads are finite, the chain is finitely long. There exists some k such that Fᵏ(⊥) = Fᵏ⁺¹(⊥) — the complete tree.

### 4.4 Intermediate Rendering Guarantee

**Theorem (Valid Prefix Rendering).** For any n, Fⁿ(⊥) is a valid partial rendering of the final UI tree.

**Proof**: Each Fⁿ(⊥) contains only information that appears in the final tree (monotonicity ensures no spurious information is added). The partial tree is a "prefix" of the final tree in the information ordering. Components rendered from partial props will display a subset of their final state.

**Practical consequence**: At any point during streaming, the rendered UI is a valid subset of the final UI. No "flickering" or "rewriting" occurs — only progressive enrichment.

---

## 5. Connection to Tsingou's Differential Dataflow

### 5.1 Structural Isomorphism

| Tsingou Signal Pipeline | Genifer JSON Streaming |
|---|---|
| Signal source (RSS, HTTP, WebSocket) | LLM response stream |
| BaseSignal schema | JSONToken schema |
| Source adapter normalization | JSON tokenization (Stage 1) |
| d2ts `map`/`filter` (entity extraction) | Bracket matching + object assembly (Stages 2–3) |
| d2ts `join` (cross-source correlation) | Token-to-bracket-pair join (Stage 3) |
| Statistical operators (anomaly scoring) | Discriminator filter (Stage 4) |
| Output → Atom.set() → React render | Output → Atom.set() → React render |

### 5.2 Shared Infrastructure

Both systems use:
- `@electric-sql/d2ts@0.1.8` as the d2ts implementation
- 2D version tuples as product lattices
- Insert-only MultiSet semantics
- Effect.Queue for backpressure-aware output
- Atom-as-State pattern for React integration

### 5.3 Fusion Ontology Analogy

Tsingou's fusion ontology [TSG-FUSION-ONTOLOGY] answers: "which signal kinds can observe which entity classes?"

Genifer's catalog ontology answers: "which component types accept which prop schemas?"

Both are declarative layers between raw input and structured output. Both define valid pairings. Both can be formalized as regular tree grammars (see separate research: research-tree-grammars.md).

---

## 6. d2ts API Mapping

### 6.1 Concrete Operator Mapping

```typescript
import { D2 } from '@electric-sql/d2ts'

// Stage 1: Tokenize
const tokenStream = input.pipe(
  D2.map((chunk: string) => tokenize(chunk))  // string → JSONToken[]
)

// Stage 2: Bracket matching (stateful reduce)
const bracketPairs = tokenStream.pipe(
  D2.reduce(
    (state, token) => matchBrackets(state, token),
    { stack: [], pairs: [] }
  )
)

// Stage 3: Object assembly (join tokens with brackets)
const partialObjects = tokenStream
  .pipe(D2.keyBy(t => t.depth))
  .pipe(D2.join(bracketPairs.pipe(D2.keyBy(b => b.depth))))
  .pipe(D2.map(([token, bracket]) => assembleObject(token, bracket)))

// Stage 4: Discriminate (filter for _tag/type field)
const identified = partialObjects.pipe(
  D2.filter(obj => '_tag' in obj.fields || 'type' in obj.fields),
  D2.map(obj => ({
    componentType: obj.fields['_tag'] || obj.fields['type'],
    partialProps: obj.fields,
    elementKey: obj.fields['key'],
  }))
)

// Stage 5: Output to Effect.Queue → Atom
identified.pipe(D2.output())
```

### 6.2 Version Semantics

```typescript
import { v } from '@electric-sql/d2ts'

// 2D version: [byte_offset, nesting_depth]
// Uses d2ts's built-in version comparison (product order)
const version = v([byteOffset, nestingDepth])
```

### 6.3 Integration with Effect.Stream

```typescript
import { Effect, Queue, Stream } from 'effect'
import { Atom } from '@effect-atom/atom'

const processLLMStream = (llmStream: Stream.Stream<string>) =>
  Effect.gen(function* () {
    const queue = yield* Queue.bounded<PartialComponentProps>(16)
    
    // d2ts output → Effect.Queue
    identified.output().subscribe((props) => {
      Effect.runSync(Queue.offer(queue, props))
    })
    
    // Feed LLM stream into d2ts input
    yield* Stream.runForEach(llmStream, (chunk) =>
      Effect.sync(() => input.sendData(v([nextOffset(), 0]), [[chunk, 1]]))
    )
    
    // Consumer fiber → Atom.set
    yield* Effect.fork(
      Stream.fromQueue(queue).pipe(
        Stream.runForEach((props) =>
          Effect.sync(() => Atom.set(partialTreeAtom, updateTree(props)))
        )
      )
    )
  })
```

---

## 7. Streaming-Aware Schema Annotations

### 7.1 Design

Inspired by hashbrown's `s.streaming.*` types, but implemented as Effect.Schema annotations:

```typescript
import { Schema } from 'effect'

// Annotation key for streaming behavior
const StreamingAnnotation = Symbol.for('genifer/streaming')

// Mark a prop as streaming-capable
const StreamingString = Schema.String.pipe(
  Schema.annotations({ [StreamingAnnotation]: 'progressive' })
)

const StreamingArray = <A, I>(item: Schema.Schema<A, I>) =>
  Schema.Array(item).pipe(
    Schema.annotations({ [StreamingAnnotation]: 'incremental' })
  )

// Usage in component schema
const MarkdownComponentSchema = Schema.Struct({
  content: StreamingString,        // renders progressively as tokens arrive
  items: StreamingArray(Schema.String), // renders items as each completes
  title: Schema.String,            // waits until complete
})
```

### 7.2 Renderer Behavior

| Annotation | Renderer Behavior |
|---|---|
| `progressive` | Render partial string, update as more tokens arrive |
| `incremental` | Render array items one by one as each completes |
| (none) | Render only when prop is fully parsed |

The renderer checks annotations at render time:
```typescript
const isStreaming = Schema.getAnnotation(propSchema, StreamingAnnotation)
if (isStreaming === 'progressive') {
  // Render partial value with cursor/shimmer
} else if (isStreaming === 'incremental') {
  // Render completed items, skeleton for pending
} else {
  // Wait for complete value before rendering
}
```

---

## 8. Open Questions & Future Work

1. **Performance at scale**: d2ts Index state grows with token count. For large JSON payloads (>100KB), what's the memory profile? Need benchmarks.

2. **Error recovery**: What happens when the LLM emits invalid JSON mid-stream? The bracket-matching stage will detect the error, but what's the recovery strategy? Options: (a) halt and render error, (b) attempt repair using grammar constraints, (c) render last valid state.

3. **Nested components**: UITree elements can contain children. The discriminator fires per-object, but child elements may be deeply nested. How does the antichain frontier track nested component parsing?

4. **d2ts version cleanup**: d2ts retains version history for incremental recomputation. For streaming JSON (which is one-shot, not continuously updated), we can aggressively compact after consolidation. Implement a custom compaction strategy.

5. **Relationship to tree grammars**: The discriminator-based identification (Stage 4) is a special case of top-down tree automaton execution [COMON-TATA2007 §1.6]. Can we formalize the full d2ts pipeline as a tree transducer?

---

## References

See [BIBLIOGRAPHY.md](./BIBLIOGRAPHY.md) for full citations. Key references for this document:

- [MCSHERRY-CIDR2013] — Differential dataflow introduction
- [ABADI-FOSSACS2015] — Formal foundations (Abelian groups, Möbius inversion)
- [D2TS-REPO] — TypeScript implementation we target
- [KLEENE-FPT] — Fixed-point convergence theorem
- [ALUR-VPL2004] — JSON as visibly pushdown language
- [COMON-TATA2007] — Tree automata and grammars
- [HASHBROWN] — Competitor streaming parser (comparison point)
- [TSG-DIFF-DATAFLOW] — Tsingou's differential dataflow research (extrapolation source)
- [TSG-ADR001] — Tsingou's d2ts architecture decision (structural template)
- [TSG-FUSION-ONTOLOGY] — Tsingou's fusion ontology (catalog analogy)
