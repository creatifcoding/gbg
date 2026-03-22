# EDIN-0001 — Layer Contracts for Primitives / stx / Interactive Overlays

**Type:** Architecture Decision Record
**EDIN Phase:** Negotiate (stabilized)
**Date:** 2026-02-13

## Context

The `src/lib` interactive cluster is functional but dependency-cycle heavy:
- `commands`, `hotkeys`, `minibuffer`, `overlays`, and `terminal` form multiple mutual cycles.
- `primitives` is currently imported from interactive internals in map code.
- Cycles are not yet structurally broken and should not be forcefully flattened in a behaviorful way.

## Decision

1. **Hybrid enforcement model**
   - New code MUST avoid introducing additional cycles without documented seam approval.
   - Existing cycles are allowed temporarily and must be documented in `docs/adapters/cycle-seams.md`.

2. **Layer contract direction for this wave**
   - `stx` and `primitives` are foundational and should have no local dependency expansion into interactive modules.
   - Interactive cluster (`commands`, `hotkeys`, `minibuffer`, `overlays`, `terminal`, `floating`) is allowed to remain cyclic only through explicit seam interfaces.

3. **Contract-first migration**
   - Before refactoring behavior, contracts and migration plans are mandatory.
   - All changes in this area require updating:
     - module contract docs
     - seam registry
     - system map snapshot

4. **UI stability rule**
   - No visible UI churn in this pass.
   - Changes are architectural only unless explicitly justified with tested regressions.

## Consequences

- Faster onboarding for next refactor pass: teams can reason about ownership.
- Reduced incident recovery time because cycle ownership is explicit, not implicit.
- Legacy interdependencies remain operational while migration proceeds incrementally.

## Status

**Accepted** (implementation pending, documentation enforced).

## Next Review Trigger

Review after migration phase 3 (`src/lib/commands` / `hotkeys` / `minibuffer` seam extraction) to decide which cycles can be broken safely.
