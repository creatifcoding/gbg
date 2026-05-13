# Research: Information-Theoretic Prompt Optimization

```
Topic:          Entropy, Divergence, and Channel Capacity for LLM Prompt Design
Platform:       Genifer (Generative UI subsystem of TMNL)
Author:         Val (architectural conscience)
Date:           2026-02-19
Status:         DRAFT
Sections:       6
Frameworks:     Information Theory, Rate-Distortion Theory, Channel Capacity
Purpose:        Formal foundation for F448 (Info Theory for Prompts)
Tasks:          #1629 (entropy model), #1630 (KL-optimal prompts)
Bibliography:   docs/genifer/research/BIBLIOGRAPHY.md
Extrapolates:   [TSG-INFO-THEORY]
```

---

## 1. Problem Statement

### 1.1 The Prompt Engineering Problem

Genifer must construct prompts that guide an LLM to produce valid UI trees. The prompt includes:
- System instructions (role, constraints, output format)
- Component catalog (available types, their schemas)
- User intent (natural language request)
- Context (conversation history, application state)

**The fundamental question**: How much information must the prompt contain to reliably produce a valid output?

### 1.2 Information-Theoretic Framing

Model the LLM as a **noisy channel** [SHANNON1948]:

```
Prompt (X) → [LLM Channel] → Generated JSON (Y)
```

- **Source**: The "ideal" UI tree the user wants (unknown, described by intent)
- **Encoder**: The prompt construction system (maps intent → prompt tokens)
- **Channel**: The LLM (maps prompt → generated output, with noise/hallucination)
- **Decoder**: The streaming parser + validator (maps generated JSON → valid UITree or error)

The information-theoretic question: what is the **channel capacity** of this system, and how do we approach it?

---

## 2. Entropy of UI Trees

### 2.1 Shannon Entropy of Component Trees

**Definition (Tree Entropy).** For a generative UI system with component catalog Σ, define the entropy of the tree distribution:

```
H(T) = -Σ_t P(t) log₂ P(t)
```

where the sum is over all valid trees t ∈ L(G_genifer) and P(t) is the probability the LLM generates tree t.

**Practical interpretation**: H(T) measures the "uncertainty" about which tree the LLM will produce. High entropy = many equally likely trees. Low entropy = the LLM strongly favors specific structures.

### 2.2 Conditional Entropy

Given a prompt X, the conditional entropy of the tree:

```
H(T|X) = -Σ_{x,t} P(x,t) log₂ P(t|x)
```

**Interpretation**: H(T|X) is the residual uncertainty about the tree *after* reading the prompt. A good prompt minimizes H(T|X) — it constrains the LLM to produce the right tree.

### 2.3 Mutual Information

The information the prompt provides about the tree:

```
I(X;T) = H(T) - H(T|X)
```

**Interpretation**: I(X;T) is the "useful information" in the prompt. We want to maximize this — every prompt token should reduce uncertainty about the output.

**Relationship to prompt length**: There's a trade-off. Longer prompts contain more information but:
- Cost more tokens (latency, money)
- May exceed context windows
- May contain redundant/confusing information (noise)

The **rate-distortion** framework gives the optimal trade-off.

---

## 3. Rate-Distortion Theory for Prompts

### 3.1 Distortion Measure

**Definition (Tree Distortion).** Define a distortion function d: T × T → ℝ≥0 that measures how "wrong" a generated tree t̂ is compared to the intended tree t:

```
d(t, t̂) = w₁ · d_type(t, t̂) + w₂ · d_props(t, t̂) + w₃ · d_structure(t, t̂)
```

Where:
- **d_type**: Fraction of components with wrong type (0 if all correct)
- **d_props**: Fraction of props that don't match schema (after decode)
- **d_structure**: Tree edit distance normalized by tree size

**Weights**: w₁ > w₂ > w₃ — getting the component type right is most important (because the discriminator drives early rendering), then props, then exact tree shape.

### 3.2 Rate-Distortion Function

The **rate-distortion function** R(D) gives the minimum number of bits needed in the prompt to achieve average distortion ≤ D:

```
R(D) = min_{P(t̂|t): E[d(t,t̂)] ≤ D} I(T; T̂)
```

**Interpretation**: 
- R(0) = H(T) — to get zero distortion, you need full information (enumerate the exact tree)
- R(D_max) = 0 — if you accept maximum distortion, you need no prompt at all
- For intermediate D, R(D) is convex and decreasing

### 3.3 Practical Application: Prompt Budget Allocation

Given a token budget B for the prompt, allocate information to minimize distortion:

| Prompt Section | Information Content | Priority |
|---|---|---|
| Component type list | log₂(|Σ|) bits per component | Critical (enables discriminator) |
| Prop schema per type | H(Props_T) bits per type | High (validates generated props) |
| Structural constraints | H(Grammar rules) bits | Medium (prevents invalid nesting) |
| Examples | Reduces H(T\|X) empirically | Medium-High (few-shot learning) |
| Formatting instructions | Reduces H(Format\|X) | Low (LLMs know JSON) |

**Key insight**: The component type list is the most information-dense section. With 20 registered types, log₂(20) ≈ 4.3 bits per component. For a 10-component tree, that's ~43 bits — negligible in token count. **Always include the full type catalog.**

---

## 4. KL Divergence for Prompt Evaluation

### 4.1 Measuring Prompt Quality

Given two prompts X₁ and X₂ that produce tree distributions P₁ and P₂ respectively, which prompt is "closer" to the ideal distribution P* (the distribution over trees the user actually wants)?

**KL Divergence** [KULLBACK1951]:

```
D_KL(P* || Pᵢ) = Σ_t P*(t) log₂(P*(t) / Pᵢ(t))
```

The prompt with lower D_KL is better — it produces a distribution more similar to the ideal.

### 4.2 Jensen-Shannon Divergence for Prompt Comparison

When we don't know P* but want to compare two prompts:

**JSD** [LIN1991]:

```
JSD(P₁ || P₂) = ½ D_KL(P₁ || M) + ½ D_KL(P₂ || M)
```

where M = ½(P₁ + P₂).

**Properties**:
- Symmetric: JSD(P₁ || P₂) = JSD(P₂ || P₁)
- Bounded: 0 ≤ JSD ≤ 1 (with log₂)
- Metric: √JSD is a proper distance metric

**Application**: A/B test two prompt strategies. If JSD ≈ 0, they produce essentially the same trees. If JSD is large, one is strictly better (check D_KL against held-out examples).

### 4.3 Prompt Entropy as Quality Signal

**Definition (Prompt Entropy).** For a prompt X, measure the entropy of the LLM's output distribution:

```
H_prompt(X) = -Σ_t P(t|X) log₂ P(t|X)
```

**Interpretation**:
- **Low H_prompt**: The prompt is highly constraining — the LLM consistently produces the same tree. Good if that tree is correct; bad if it's consistently wrong.
- **High H_prompt**: The prompt is ambiguous — the LLM produces diverse trees. Bad for determinism; indicates the prompt needs more constraints.

**Target**: We want H_prompt to be low (deterministic generation) AND the generated tree to be valid. This means maximizing I(X;T) while minimizing H(T|X).

---

## 5. Channel Capacity of the LLM

### 5.1 Modeling the LLM as a Channel

The LLM is a discrete memoryless channel (approximately — context window violates memorylessness, but per-generation it's a reasonable model):

```
Channel capacity C = max_{P(X)} I(X;Y)
```

where X is the prompt and Y is the generated output.

### 5.2 Practical Capacity Estimation

We can estimate the effective channel capacity empirically:

1. Generate N prompts with varying information content
2. For each prompt, sample K generated trees
3. Estimate I(X;T) via the plugin estimator or MINE (mutual information neural estimation)
4. The maximum observed I(X;T) approximates C

### 5.3 Implications for Prompt Design

If we're operating below capacity (I(X;T) < C), we can improve by adding more information to the prompt. If we're near capacity, adding more prompt tokens gives diminishing returns — the bottleneck is the LLM's ability to follow instructions, not the information in the prompt.

**Hypothesis**: For current LLMs (Claude, GPT-4), the effective capacity for structured JSON generation is high (~90%+ accuracy) when:
- The schema is fully specified in the prompt
- Examples are provided (few-shot)
- The component catalog is small (< 50 types)

The bottleneck shifts to *ambiguity of intent* (the user's request is unclear) rather than *channel capacity* (the LLM can't follow instructions).

---

## 6. Practical Prompt Construction Algorithm

### 6.1 Information-Optimal Prompt Template

Based on the analysis above, the optimal prompt structure (maximizing I(X;T) per token):

```
1. SYSTEM MESSAGE (high information density):
   - Role: "You generate UI trees in JSON format"
   - Format: JSON schema specification (UITree shape)
   - Constraints: Grammar rules (parent-child, depth limits)

2. COMPONENT CATALOG (critical, always include):
   - Type names + brief descriptions
   - Prop schemas (TypeScript notation for token efficiency)
   - Nesting rules (which types accept which children)

3. EXAMPLES (high empirical value, 1-3 shots):
   - Small complete examples demonstrating format
   - Examples covering the main component types in the request

4. USER INTENT (variable information):
   - Natural language description of desired UI
   - Application context (if relevant)

5. GENERATION INSTRUCTIONS (low but necessary):
   - "Respond with valid JSON only"
   - "Use _tag field for component type discrimination"
```

### 6.2 Token Budget Allocation (Recommended)

For a 4K token prompt budget:

| Section | Tokens | Rationale |
|---|---|---|
| System message | ~200 | Highly compressed, high info density |
| Component catalog | ~800-1200 | Scales with catalog size |
| Examples | ~500-800 | 1-2 examples sufficient |
| User intent | ~200-500 | Usually brief |
| Generation instructions | ~100 | Minimal |
| **Remaining (context)** | ~1000-2000 | Conversation history, app state |

### 6.3 Connection to Effect.Schema

The component catalog section is auto-generated from Effect.Schema definitions:

```typescript
const generateCatalogPromptSection = (catalog: DomainCatalog): string => {
  return catalog.components.map(comp => {
    // Extract type and prop schema as concise TypeScript notation
    const propsDescription = Schema.format(comp.schema) // hypothetical
    return `- ${comp.type}: ${propsDescription}`
  }).join('\n')
}
```

**Information content**: Each component entry contributes log₂(|Σ|) + H(Props_T) bits to the prompt's mutual information. The catalog section is the highest-ROI section of the prompt.

---

## Open Questions

1. **Empirical validation**: The rate-distortion framework is elegant but needs experimental validation. Run prompt ablation studies: remove catalog info, remove examples, remove constraints — measure distortion increase per section.

2. **Dynamic prompt compression**: Given a specific user intent, not all catalog entries are relevant. Can we use the mutual information I(ComponentType; UserIntent) to prune the catalog to only relevant types, saving tokens?

3. **Context window as bandwidth**: The LLM context window is a hard constraint on prompt size. How does this interact with the rate-distortion bound? Are current context windows (128K+) sufficient to achieve near-zero distortion for typical UI generation tasks?

4. **Streaming and information accumulation**: During streaming (research-d2ts-streaming-json.md), information about the generated tree accumulates token by token. Can we model the streaming process as information-theoretic channel coding, where each new token reduces H(T|seen_so_far)?

5. **Connection to tsingou's information theory**: Tsingou uses entropy for anomaly detection in signal streams [TSG-INFO-THEORY]. Can the same measures detect "anomalous" LLM outputs (hallucinated components, schema violations) during streaming?

---

## References

See [BIBLIOGRAPHY.md](./BIBLIOGRAPHY.md). Key references:

- [SHANNON1948] — Information theory foundations
- [KULLBACK1951] — KL divergence
- [LIN1991] — Jensen-Shannon divergence
- [TSG-INFO-THEORY] — Tsingou's information theory research (extrapolation source)
- [MAHADEVAN-GAIA2024] — Categorical foundations (Kan extensions connect to prompt optimization)
- [RIEHL2017] — Category theory (adjunctions, Kan extensions)
