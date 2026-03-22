# Architecture Spec — `NuCmdkShell` (Shell + Bands + Compound API)

**Status:** Proposed  
**Date:** 2026-02-13  
**Implements:** research conclusions in `../research/cmdk-effect-research.md`

---

## 1) Goals

1. Replace monolithic `nu-cmdk.tsx` with composable shell architecture.
2. Keep cmdk library as the semantic interaction primitive.
3. Preserve existing command/minibuffer/hotkey behavior.
4. Enable heterogeneous result rendering via slot contracts.
5. Avoid new cycle edges in interactive cluster.

## Non-goals (for this phase)

- No visual redesign spree.
- No keybinding semantic rewrites.
- No ownership inversion of `minibuffer` runtime.

---

## 2) Component Topology

```text
NuCmdkShell.Root
├── NuCmdkShell.ModeBand         (breadcrumb / active mode)
├── NuCmdkShell.QueryBand        (cmdk input + prompt affordances)
├── NuCmdkShell.KindBand         (query-kind tabs / domain filter)
├── NuCmdkShell.ResultsBand      (grouped/ranked results)
│   ├── NuCmdkShell.Group
│   ├── NuCmdkShell.RowSlot      (per row-tag renderer)
│   └── NuCmdkShell.Empty
└── NuCmdkShell.FooterBand       (hints/status/version/selection context)
```

This mirrors RVN shell decomposition discipline while keeping cmdk primitives at the interaction core.

---

## 3) cmdk Integration Rules

Baseline + extension policy is defined in: `./nu-cmdk-cmdk-baseline.md`

Core requirements:

1. `Command` root owns active selection value.
2. `Command.Input` owns search text eventing.
3. `Command.List` owns navigable list semantics.
4. `Command.Item` values are stable IDs, never index-derived.
5. `Command.Group` used for visual/logical grouping.
6. Default mode uses `shouldFilter={false}` (external ranked streaming).
7. `keywords` aliases required for synonym search support.

---

## 4) State Ownership (Atom-as-State, stx discipline)

Primary state should live in atoms consumed directly by React (not Ref→Atom bridge).

## Shell state domains

- query text
- active kind tab
- normalized rows
- ranked rows
- selected row id
- active mode breadcrumbs
- footer status/meta

## Ownership model

- `NuCmdkShell.Root` wires state atoms + operations.
- Bands are presentational consumers + event dispatchers.
- Provider bridge populates source payloads.
- Schema parser normalizes payloads into canonical row union before render.

---

## 5) Compound API Contract (Public)

```text
NuCmdkShell
NuCmdkShell.Root
NuCmdkShell.ModeBand
NuCmdkShell.QueryBand
NuCmdkShell.KindBand
NuCmdkShell.ResultsBand
NuCmdkShell.Group
NuCmdkShell.Empty
NuCmdkShell.FooterBand
NuCmdkShell.RowSlot
```

## Consumer shape

```text
<NuCmdkShell.Root>
  <NuCmdkShell.ModeBand />
  <NuCmdkShell.QueryBand />
  <NuCmdkShell.KindBand />
  <NuCmdkShell.ResultsBand>
    <NuCmdkShell.RowSlot tag="CommandRow" render={...} />
    <NuCmdkShell.RowSlot tag="EntityRow" render={...} />
    <NuCmdkShell.RowSlot tag="ActionRow" render={...} />
  </NuCmdkShell.ResultsBand>
  <NuCmdkShell.FooterBand />
</NuCmdkShell.Root>
```

---

## 6) Adapter Seams (Cycle-safe integration)

`NuCmdkShell` must integrate through existing seam interfaces, not raw cross-import sprawl.

## Required seam usage

- `ICommandExecutionBridge` (execute selected row command)
- `ICompletionPromptBridge` (provider query/completions)
- `OverlayActivationPolicy` where palette is overlay-hosted
- terminal interaction adapter when terminal opens palette contextually

Reference: `docs/adapters/cycle-seams.md`

---

## 7) Interaction Flow

```text
input change
  -> query atom update
  -> provider bridge fetch/filter
  -> schema decode/normalize
  -> rank + group pipeline
  -> cmdk list render
  -> selection change (value)
  -> execute via command bridge
```

All behavior equivalent to today from user perspective; only internals become explicit and testable.

---

## 8) Acceptance Criteria

1. cmdk primitives are first-class in shell implementation.
2. No behavior regressions for open/search/select/execute/escape.
3. Result rendering is tag-driven via slot registry.
4. No new undocumented cycle edges introduced.
5. Typography floor holds (`>= 12px` via tokenized sizes).

---

## 9) Architecture Decisions (Locked via Questionnaire)

Source: `../research/nu-cmdk-questionnaire-results.md`

1. **Host strategy:** Minibuffer-first (modal-capable).
2. **Ranking authority:** Hybrid (provider baseline + shell contextual boosts).
3. **Kind semantics:** Hybrid (provider-level lanes + row-kind grouping).
4. **Rollout:** Direct cutover after parity gates pass.
