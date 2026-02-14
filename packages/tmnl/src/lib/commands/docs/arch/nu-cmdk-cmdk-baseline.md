# API Baseline — `cmdk` as Jump-off for `NuCmdkShell`

**Status:** Baseline (not strict lock)  
**Date:** 2026-02-13

---

## Intent

`cmdk` is the launch platform, **not the ceiling**.

We adopt cmdk’s compound semantics for core interaction, then extend around it with TMNL-specific shell bands, provider streaming, schema normalization, and mode-aware ranking.

---

## Baseline we inherit from `cmdk`

Core primitives we start from:

- `Command`
- `Command.Input`
- `Command.List`
- `Command.Group`
- `Command.Item`
- `Command.Empty`
- `Command.Loading`
- `Command.Separator`
- `Command.Dialog`

These define interaction semantics (keyboard nav, selection, list behavior), while TMNL layers richer architecture around them.

---

## Extension philosophy

We can extend beyond upstream cmdk as long as we preserve:

1. Value-based selection identity (`value`, not index).
2. Predictable keyboard-first navigation.
3. Accessible combobox/list behavior.
4. Stable row semantics under streaming updates.

In short: **keep cmdk interaction contracts; customize structure and data plane aggressively.**

---

## Where TMNL extends past cmdk

1. **Shell + bands**
   - Mode band, query band, kind band, results band, footer band.

2. **Schema-driven rows**
   - Effect Schema union for heterogeneous result types.

3. **Provider concurrency**
   - Per-provider streaming aggregation (non-blocking).

4. **Hybrid ranking**
   - Provider baseline score + shell contextual boosts.

5. **Multi-mode query semantics**
   - Fuzzy, prefix, exact, alias, semantic, regex.

6. **Host strategy**
   - Minibuffer-first modal path with direct overlay compatibility later if needed.

---

## Operating policy for filtering

Default for TMNL shell modes:

- `shouldFilter={false}`
- external schema+ranking pipeline determines row order
- cmdk handles interaction/navigation over already-ranked rows

Optional local mode:

- enable cmdk `filter(value, search, keywords)` if a mode explicitly wants native cmdk scoring behavior.

---

## Invariants (still non-negotiable)

1. No index-based selection identity.
2. No custom keyboard engine that fights cmdk semantics.
3. No bypass of `Command.Item` semantics in slot renderers.
4. 12px typography floor in palette UI.

---

## Reference sources

- Upstream API: https://github.com/dip/cmdk
- Upstream architecture: https://github.com/dip/cmdk/blob/main/ARCHITECTURE.md
- TMNL shell spec: `./nu-cmdk-shell-band-spec.md`
- TMNL schema spec: `./nu-cmdk-result-schema-spec.md`
