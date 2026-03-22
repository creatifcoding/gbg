# Research Brief — cmdk + Effect Schema + TMNL Seam Constraints

**Status:** Complete (round 1)  
**Date:** 2026-02-13  
**Authoring Mode:** EXA-assisted + local codebase audit

---

## 1) Problem Statement

Refactor `src/lib/commands/integrate/nu-cmdk.tsx` from a monolithic visual demo into a reusable command palette system that:

- uses `cmdk` library primitives directly,
- supports shell/band composition (RVN-style compounds),
- handles heterogeneous row payloads via Effect Schema,
- respects existing interactive cluster seams (`commands ↔ hotkeys ↔ minibuffer ↔ overlays ↔ terminal`).

---

## 2) Current State Audit (Local)

### `nu-cmdk.tsx` reality

`src/lib/commands/integrate/nu-cmdk.tsx` is currently:

- standalone demo component (`App`) with local state,
- static arrays for tabs/items,
- no `cmdk` primitives (`Command`, `Command.Input`, `Command.List`, etc.),
- no integration with `commands`/`minibuffer` provider registry,
- contains hard-coded tiny text sizes (`text-[8px]`, `text-[9px]`, `text-[10px]`) that violate TMNL typography floor.

### Existing cmdk usage in codebase

`src/lib/minibuffer/v1/components/MinibufferContent.tsx` and `v2/components/MinibufferContent.tsx` already use cmdk primitives, including:

- `Command` root,
- `Command.Input`,
- `Command.List`,
- `Command.Group`,
- `Command.Item`,
- custom selection wiring + external filtering.

So the platform already has a known-good cmdk integration pattern.

---

## 3) External Research Summary (EXA)

### cmdk findings (high-signal)

From upstream `cmdk` README + architecture:

1. `cmdk` is compound-component first (not array/render-prop first).
2. It supports built-in filtering and ranking, or full external filtering via `shouldFilter={false}`.
3. `Command.Item` supports `keywords` aliases for search expansion.
4. Stable selection should use item `value` (not index bookkeeping).
5. DOM/render ordering is authoritative for selection navigation.

This aligns with shell/band + slot composition goals.

### Effect Schema findings (high-signal)

From Effect docs:

1. Schemas are runtime-capable contracts (`decode`, `encode`, `assert`, transform).
2. `Schema.Union` + tagged models support heterogeneous row payloads.
3. `Schema.transform` / `transformOrFail` is suitable for normalize/rank pipelines where source payloads vary.
4. `decodeUnknown` patterns provide safe boundary parsing for provider-fed payloads.

This matches TMNL’s schema discipline requirement.

### EXA run traceability

- `r_01khe1newjefex5d72vqx5hsex` (cmdk integration patterns)
- `r_01khe1nhj00jgs4wgy47qyxxw5` (Effect Schema + tagged unions)
- `r_01khe1nmetzp1nhr8y31nfdr66` (shell/band compounds)

Note: EXA returned mixed-quality sources; this document uses only high-confidence references in the citations list.

---

## 4) Internal Architecture Constraints (Must-Hold)

From TMNL system docs/contracts:

- `minibuffer` is generic prompt runtime; commands should consume it, not invert ownership.
- Interactive cluster is intentionally cyclic today but must be mediated by seam adapters.
- New work must use documented seam interfaces and must not introduce new ad-hoc cross-imports.

Applicable seam docs:

- `docs/adapters/cycle-seams.md`
- `docs/systems/interactive-surface.md`
- `docs/contracts/commands.md`
- `docs/contracts/minibuffer.md`
- `docs/contracts/hotkeys.md`
- `docs/contracts/overlays.md`

---

## 5) Architecture Options

## Option A — Standalone `nu-cmdk` subsystem

- Keep `nu-cmdk` mostly independent and mount where needed.
- Pros: fast isolation, low blast radius.
- Cons: duplicates minibuffer/cmdk patterns; risks second command UX stack.

## Option B — Shellized palette + minibuffer/commands bridge (**Recommended**)

- Build reusable `NuCmdkShell` compound.
- Keep cmdk view semantics in shell bands.
- Feed results through provider/bridge contracts.
- Preserve existing execution pathways while replacing monolith internals.

Why B wins: maximizes reuse, minimizes ownership drift, aligns with seam migration strategy.

---

## 6) Research Conclusions

1. **Use cmdk as the primitive interaction layer**, not custom list+keyboard emulation.
2. **Use external filtering (`shouldFilter={false}`) when ranking is domain-specific** and already computed via providers.
3. **Adopt Effect Schema tagged unions for row contracts** to parse mixed payloads deterministically.
4. **Adopt shell/band + slot API** to avoid monolithic component regression.
5. **Integrate through existing command/minibuffer seam adapters**, not direct new cycle edges.

---

## Citations

- cmdk README/API: https://github.com/pacocoursey/cmdk
- cmdk architecture notes: https://github.com/pacocoursey/cmdk/blob/main/ARCHITECTURE.md
- Effect Schema intro: https://effect.website/docs/schema/introduction/
- Effect Schema transformations: https://effect.website/docs/schema/transformations/
- Internal seam registry: `docs/adapters/cycle-seams.md`
- Internal interactive architecture: `docs/systems/interactive-surface.md`
