# Implementation Plan — `nu-cmdk` to `NuCmdkShell`

**Status:** Execution-ready (post-approval)  
**Date:** 2026-02-13  
**Mode:** Document-led; no code changes in this phase  
**API Baseline:** `../arch/nu-cmdk-cmdk-baseline.md`

---

## 0) Guardrails

- No visual churn unless bug-fix required.
- No new dependency cycles outside documented seams.
- Preserve command execution behavior and keybinding semantics.
- Keep typography tokenized with 12px minimum floor.

---

## Phase 1 — Scaffold + Contracts

### Deliverables

1. Create `src/lib/commands/shell/` module skeleton.
2. Define public compound exports and placeholder band components.
3. Introduce row schema contract module (Effect Schema).
4. Finalize provider artifact contract baseline from `arch/nu-cmdk-provider-contract-proposals.md`.
5. Define bridge interfaces used by shell (`execution`, `completion`).

### Exit criteria

- Typecheck passes.
- No runtime behavior changes.
- API surface documented.

---

## Phase 2 — Schema Pipeline + Ranking

### Deliverables

1. Implement unknown → decoded row pipeline.
2. Implement normalize transforms.
3. Implement hybrid ranking stage (provider baseline + shell contextual boosts).
4. Add telemetry hooks for parse failures.
5. Implement query-mode operators (fuzzy, prefix, exact, alias, semantic, regex) with explicit precedence.

### Exit criteria

- Unit tests for parse/normalize/rank pass.
- Stable output ordering verified with fixture sets.

---

## Phase 3 — cmdk Shell Bands

### Deliverables

1. Implement `ModeBand`, `QueryBand`, `KindBand`, `ResultsBand`, `FooterBand`.
2. Wire cmdk primitives in `ResultsBand` and `QueryBand`.
3. Implement row-slot renderer registry.
4. Add empty/loading/error bands with graceful fallback.

### Exit criteria

- Keyboard navigation parity with existing palette.
- Selection + execute behavior parity.

---

## Phase 4 — Integration Bridges

### Deliverables

1. Implement `NuCmdkSearchBroker` lane orchestration from `arch/nu-cmdk-search-broker-service-spec.md`.
2. Connect shell query pipeline to provider bridge.
3. Implement per-provider concurrent streaming aggregation (non-blocking merge).
4. Connect selection execution to command bridge.
5. Integrate with minibuffer-first host path without API break.
6. Preserve existing open/close/escape lifecycle.

### Exit criteria

- Existing command-palette invocation paths still work.
- No new direct imports that violate seam registry.

---

## Phase 5 — Migration + Decommission

### Deliverables

1. Replace `integrate/nu-cmdk.tsx` monolith with shellized integration entry.
2. Keep compatibility wrapper for transition window.
3. Add docs update in commands README linking new shell docs.

### Exit criteria

- Legacy monolith no longer runtime source of truth.
- Backward compatibility adapter present (temporary).

---

## Validation Checklist

1. Open palette from existing hotkeys.
2. Type query and see filtered/ranked rows.
3. Verify query modes (fuzzy/prefix/exact/alias/semantic/regex).
4. Tab by kind and verify deterministic grouping.
5. Confirm per-provider streaming updates without blocking final interaction.
6. Execute command row and observe identical command side-effects.
7. Escape/cancel behavior unchanged.
8. Minibuffer-first host integration unchanged from user perspective.

---

## Risks + Mitigations

## Risk: Duplicate filtering (cmdk + external ranking)
- Mitigation: explicitly choose one mode per shell instance (`shouldFilter` policy).

## Risk: command/minibuffer ownership drift
- Mitigation: bridge-only calls at boundaries; no raw cross-module wiring.

## Risk: schema over-strictness drops useful rows
- Mitigation: fallback decode path + diagnostics; tighten incrementally.

## Risk: visual regressions from decomposition
- Mitigation: band-by-band snapshot and interaction checks.

---

## Rollback Plan

1. Keep legacy integration wrapper callable.
2. Feature-flag shell host path.
3. Revert shell path only; keep schema/ranking unit artifacts.
4. Preserve docs and migration notes for next attempt.

---

## Decision Gates (locked)

Locked via questionnaire (`research/nu-cmdk-questionnaire-results.md`):

- Gate A: **Host** = minibuffer-first.
- Gate B: **Ranking** = hybrid (provider + shell context).
- Gate C: **Kind semantics** = hybrid.
- Gate D: **Rollout** = direct cutover after parity tests pass.
