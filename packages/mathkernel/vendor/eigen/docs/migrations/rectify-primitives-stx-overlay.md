# Migration: Rectify `primitives` → `stx` → `overlays` / Interactive Surface

**Status:** Planning + implementation-ready (no UI churn)
**Owner:** Architecture Team
**Date:** 2026-02-13

## Objective

Stabilize the interaction foundation without changing UI behavior by:
1. defining strict contracts for `primitives`, `stx`, `overlays`, and interactive surfaces,
2. introducing explicit adapter seams for cycle-heavy edges,
3. migrating call paths to seam usage while preserving current exports,
4. only breaking imports if legacy seam-based compatibility path exists.

## Scope

Target modules:
- `src/lib/primitives`
- `src/lib/stx`
- `src/lib/overlays`
- `src/lib/hotkeys`
- `src/lib/minibuffer`
- `src/lib/commands`
- `src/lib/terminal`
- `src/lib/floating`

## Why this phase

Current graph indicates interactive cycles are dense and stable but hard to reason about. This phase focuses on architecture and contract enforcement, not visual redesign.

---

## Phase 1 — Documentation Lock (1–2 days)

1. Produce system map: `docs/atlas/src-lib-system-map.md`
2. Produce interactive architecture flow: `docs/systems/interactive-surface.md`
3. Author cycle seam registry: `docs/adapters/cycle-seams.md`
4. Create contract docs for target modules (`docs/contracts/*.md`)
5. Add decision log in `docs/decisions/EDIN-*.md`

**Exit criteria:** all five docs exist and are linked from `docs/README`.

---

## Phase 2 — Contract Codification (1 day)

1. Freeze contract language for:
   - `primitives` as foundational utility,
   - `stx` as zero-outbound foundational state layer,
   - `overlays` as container interaction runtime,
   - `hotkeys` as parser/binding layer,
   - `minibuffer` as prompt runtime,
   - `commands` as execution registry,
   - `terminal` as surface consumer.
2. Define explicit adapter interfaces in code comments or new files.
3. Keep all existing exports intact.

**Exit criteria:** no new public API breakage; docs describe ownership boundaries.

---

## Phase 3 — Critical seam extraction (2–3 days)

### 3.1 primitives↔overlays
- Introduce `IMapOverlayBridge` in map registry helpers.
- Keep default behavior stable for map render and registration.
- Remove hard direct dependency where possible.

### 3.2 commands/hotkeys/minibuffer cycle containment
- Add `ICommandExecutionBridge` + `ICompletionPromptBridge`.
- Route cycle calls through adapters while preserving method names.
- Keep both v1 and v2 minibuffer entry points intact.

### 3.3 terminal↔interactive cycle containment
- Introduce a terminal interaction facade consumed by commands/hotkeys/overlays integration points.
- Preserve existing command wiring behavior.

### 3.4 overlays visual-stack containment
- Introduce channel payload adapters for `overlay <-> screensaver <-> cursor/genifer` edges.

**Exit criteria:** no behavior changes; import graph annotations updated.

---

## Phase 4 — Validation (1–2 days)

1. Regression checklist:
   - command execution via keyboard,
   - M-x command execution,
   - overlay open/close,
   - which-key hints,
   - minibuffer prompt/response,
   - terminal hotkey dispatch.
2. Verify build and typecheck.
3. Generate a fresh `tmp_lib_deps` snapshot and update `docs/atlas/src-lib-system-map.md` with before/after delta.
4. Record residual cycles and owners.

**Exit criteria:** all checks green; residual cycles documented as intentional with seams.

---

## Rollback plan

If regression appears:
1. isolate by removing adapter call path (single feature branch only),
2. re-route through legacy path under compatibility shim,
3. keep docs updated and mark migration stop-point,
4. no UI rollback needed because behavior is preserved by interface fallback.

## No-Change Constraint

- No CSS/layout/DOM structural changes.
- No command keymaps, binding defaults, or visible palette behavior changes.
- No route-level behavior changes in terminal UX.

## Success Criteria

- Contracts and seam docs merged.
- Import map shows intentional rather than accidental cycles.
- Interactive operations remain functional.
- Team has a documented, repeatable path to continue rectifying additional clusters.
