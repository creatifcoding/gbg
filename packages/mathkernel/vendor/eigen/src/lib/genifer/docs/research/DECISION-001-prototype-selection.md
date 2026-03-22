# DECISION-001: Which Formalism to Prototype First

```
Method:     Theory of Constraints (Goldratt)
Author:     Val
Date:       2026-02-19
Status:     DECIDED
Outcome:    d2ts Streaming JSON Parser
```

---

## Step 1: IDENTIFY the Constraint

Five formalisms. One prototype slot. What's the bottleneck in genifer's value delivery?

Map the dependency chain from "LLM emits tokens" to "user sees UI":

```
LLM tokens → [???] → partial tree → [validate] → [render] → user sees pixels
                ↑                        ↑             ↑
            STREAMING              TREE GRAMMAR    COMPONENT
            (F447/F437)            (F444)          ALGEBRA (F445)
```

**The streaming parser is the single point of failure.** Without it:
- Tree grammars have nothing to validate incrementally (no partial trees exist)
- Component algebra is academic (can't compose what you can't parse)
- Categorical composition describes functors that don't execute yet
- Info theory optimizes prompts for a pipeline that doesn't stream

With it:
- Every downstream formalism has a working substrate to integrate into
- The 5-stage d2ts graph is a concrete test harness for tree grammar validation (Stage 4b)
- Partial tree atoms are the carrier set for component algebra operations
- The streaming functor S: 𝒞_stream → 𝒞_tree becomes executable, not theoretical

## Step 2: EXPLOIT the Constraint

What makes the streaming prototype maximally productive?

1. **d2ts is already installed** (`@electric-sql/d2ts@0.1.8` in node_modules)
2. **Tsingou has working d2ts patterns** (ADR-001, signal pipeline) — not greenfield
3. **The implementation plan exists** (`d2ts-implementation-plan.md` — file inventory, phased plan, acceptance criteria)
4. **The theory is complete** — convergence proof, version lattice, pipeline topology all specified
5. **Effect.Schema integration path is clear** — `Schema.TaggedStruct._tag` is the discriminator, already built into genifer

The constraint is NOT "we need more theory." The constraint is "theory hasn't been instantiated as code."

## Step 3: SUBORDINATE Everything Else

| Formalism | Subordination Decision |
|---|---|
| **Tree Grammars** | WAIT. Prototype validates *after* streaming works. Stage 4b plugs into the d2ts graph. |
| **Component Algebra** | WAIT. Property tests need partial trees from the streaming parser as test fixtures. |
| **Category Theory** | WAIT. Functors describe the streaming pipeline — prototype IS the functor execution. |
| **Info Theory** | WAIT. Prompt optimization is premature until we see what the pipeline actually produces. |

Everything subordinates to getting the streaming tokenizer + d2ts graph running.

## Step 4: ELEVATE the Constraint

Prototype scope — minimum viable to unblock everything downstream:

```
MUST HAVE (prototype):
  ✓ JSON tokenizer that handles chunked input
  ✓ d2ts graph with at least stages 1 + 4 (tokenize + discriminate)
  ✓ Effect.Service wrapper (StreamingParseService)
  ✓ Atom bridge (partialTreeAtom updated from d2ts output)
  ✓ One passing test: chunked JSON → identified component type

NICE TO HAVE (defer):
  - Full 5-stage pipeline (stages 2-3 can be simplified initially)
  - Streaming Schema annotations
  - StreamingRenderer React component
  - Property tests for convergence laws
```

The smallest cut that proves the formalism works: **tokenize a chunked JSON string, feed it through d2ts, and observe the discriminator fire when `_tag` appears.**

## Step 5: REPEAT

After the streaming prototype works:
1. Next constraint becomes **validation** → prototype tree grammar BFTA as Stage 4b
2. Then **composition** → property tests using partial trees as fixtures
3. Info theory and categories remain theoretical until prompt construction is built (F440)

---

## Decision

**Prototype the d2ts streaming JSON parser.** Phase 1 only (tokenizer + graph + service + atoms). One integration test proves the concept. Everything else waits.
