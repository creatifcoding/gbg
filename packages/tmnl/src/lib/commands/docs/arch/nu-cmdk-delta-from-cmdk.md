# Delta Spec — `NuCmdkShell` vs Upstream `cmdk`

**Status:** Drafted  
**Date:** 2026-02-13

---

## Principle

Use cmdk interaction primitives as substrate, then layer TMNL-specific architecture where product needs exceed base cmdk.

---

## Keep as-is (from cmdk)

- Keyboard navigation semantics
- Value-based selection contract
- Compound primitive composition (`Command.*`)
- Empty/loading/group/item affordances

---

## Extend in TMNL

1. **Banded shell layout**
   - Mode / Query / Kind / Results / Footer bands.

2. **Schema-normalized heterogeneous rows**
   - Effect Schema tagged union rows before render.

3. **Concurrent provider streaming**
   - Per-provider partial updates; no global blocking.

4. **Hybrid ranking pipeline**
   - Provider score + context boosts + query-mode-specific scoring.

5. **Multi-query-mode engine**
   - fuzzy/prefix/exact/alias/semantic/regex under one query surface.

6. **Cross-surface result federation**
   - Commands + entities + actions + docs + terminal + workflows + agents.

---

## Defer / optional

- Internal cmdk filter mode for narrow local cases.
- Secondary direct overlay host path (after minibuffer-first rollout).

---

## Risk boundary

Do not diverge so far that cmdk primitives become decorative wrappers. If we keep re-implementing core nav/select semantics ourselves, we should either re-scope or justify a custom engine explicitly.
