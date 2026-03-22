# Transfer Library Redesign — Document Index

**Status**: Architecture  
**Survey**: `transfer-redesign-alignment` (ID: `srKzZbVz8pBuCksED_-yq`)  
**Date**: 2026-02-13  
**Verdict**: Full redesign — sprawl, consumer tax, dead weight, scope model all need rework.

---

## Decision Record (from Questionnaire)

| Question | Answer |
|---|---|
| What bothers you? | **All of it** — sprawl, consumer tax, dead weight. "Least component ownership." |
| Job-to-be-done? | All 5: single drag, cluster drag, multi-copy, shift-copy, **cross-surface future** |
| Architecture? | **Compound hook** (`useInlineTaskTransfer()`) encapsulates everything |
| Traits? | **Keep and wire properly** — "this is where animation/styling is required" |
| Scope? | **Surface-scoped** — "smart scoping, cross boundaries, each handles if they can. Category/functional theory, curry-like pattern via Effect" |

---

## Documents

| # | Document | Scope |
|---|---|---|
| 01 | [Transfer Algebra](./01-transfer-algebra.md) | Category theory lens, curried capability model, Effect service shape |
| 02 | [Schema Redesign](./02-transfer-schema-redesign.md) | What stays/merges/dies, streamlined type surface |
| 03 | [Scope Model](./03-transfer-scope-model.md) | Surface-scoped state, cross-boundary protocol, TransferBus |
| 04 | [Trait Wiring](./04-transfer-trait-wiring.md) | How traits connect to real feedback, animation, styling |
| 05 | [Hook Consolidation](./05-transfer-hook-consolidation.md) | Compound hook design, consumer API, prop elimination |
| 06 | [Dependency Graph](./06-transfer-dependency-graph.md) | Implementation tiers, migration path, commit strategy |

---

## Invariants

1. All 5 transfer behaviors survive the redesign — no capability regression.
2. Consumer integration collapses from ~80 lines to one hook call.
3. Transfer state is surface-scoped, not a global mutable singleton.
4. Cross-surface transfer is a composition of surface capabilities, not a shared atom.
5. Traits render real feedback (animation, styling) — not `null`.
6. The algebra is curried via Effect Layer composition.
7. Schema surface shrinks — dead types get cut.
