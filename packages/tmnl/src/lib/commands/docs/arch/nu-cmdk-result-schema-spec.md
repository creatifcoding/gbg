# Schema Spec — Heterogeneous Result Rows for `NuCmdkShell`

**Status:** Proposed  
**Date:** 2026-02-13  
**Policy:** Effect Schema only for domain payload contracts

---

## 1) Purpose

Define a canonical schema model for command palette rows so `NuCmdkShell` can render mixed domains (commands, entities, actions, suggestions, history) without ad-hoc type guards.

---

## 2) Canonical Union Shape

Use tagged union rows with `_tag` discriminator.

## Row variants (initial)

- `CommandRow` — registered command entry
- `EntityRow` — entity navigation/open actions
- `ActionRow` — contextual action from current mode
- `SuggestionRow` — recommendation/system hint
- `HistoryRow` — recent command/entity selection

Each row includes shared envelope fields:

- `id` (stable selection value)
- `label`
- `description?`
- `kind` (tab/domain)
- `group` (section heading)
- `score` (ranking)
- `keywords` (cmdk aliases)
- `disabled?`

---

## 3) Parse/Normalize Pipeline

```text
unknown provider payload
  -> decodeUnknown(RowInputSchema)
  -> normalize transform (fill defaults, derive group/kind)
  -> refinement filters (valid id/label/score ranges)
  -> sort/rank
  -> render union rows via slot map
```

### Key requirements

1. Invalid payloads fail fast with parse errors (captured for observability).
2. Rows are normalized before ranking.
3. UI never receives raw provider payload.

---

## 4) Ranking Model

Ranking should be deterministic and composable:

`totalScore = baseScore + queryScore + kindAffinity + recencyBoost + contextBoost`

Where:

- `baseScore`: provider-supplied static priority.
- `queryScore`: search-text relevance score.
- `kindAffinity`: boost for active tab/kind.
- `recencyBoost`: user history favoring recent entries.
- `contextBoost`: mode-specific relevance (editor/grid/canvas/terminal).

If cmdk internal filtering is disabled (`shouldFilter={false}`), this score fully determines order.

---

## 5) Slot Rendering Contract

`NuCmdkShell.RowSlot` maps `_tag` → renderer.

## Contract rules

1. A row with unknown `_tag` uses fallback renderer.
2. Renderers receive normalized row only (no raw unknown).
3. Renderer cannot mutate shared ranking state.
4. Renderer must preserve cmdk item semantics (value/selectability).

---

## 6) Error Contract

Parsing/ranking failures should not crash palette.

Fallback behavior:

- invalid rows dropped with structured diagnostics,
- shell remains interactive,
- empty state explains no valid results,
- telemetry captures parse issues per provider.

---

## 7) Compatibility Requirements

1. Selection remains value-based, stable across remounts.
2. Grouping compatible with `Command.Group` headings.
3. Keywords map to cmdk `keywords` prop where filtering is enabled.
4. Existing command execution IDs remain unchanged.

---

## 8) Test Matrix (Schema Layer)

- decode success for each row tag
- decode failure for malformed payloads
- normalize defaults consistency
- ranking determinism (same input => same order)
- slot fallback for unknown tag
- keyword trimming/alias behavior

---

## 9) References

- cmdk API/behavior: https://github.com/pacocoursey/cmdk
- cmdk architecture notes: https://github.com/pacocoursey/cmdk/blob/main/ARCHITECTURE.md
- Effect Schema intro: https://effect.website/docs/schema/introduction/
- Effect transformations: https://effect.website/docs/schema/transformations/
