---
name: vnt exhibition lab
overview: Copy the archived RVN exhibition pattern (RvnTestbed + ComponentBox/TestbedProvider) into `src/.testbeds/vnt` as the working lab for `@tmnl/design/vnt`. Vantablack chrome only. RVN stays archived.
todos:
  - id: lab-route
    content: Scaffold src/.testbeds/vnt + wire /testbed/vnt in all four routing SOTs
    status: pending
  - id: lab-tokens
    content: Tokens swatch section on StyleX vars; vanta page chrome
    status: pending
  - id: lab-components
    content: ComponentBoxes for Vnt primitives as they land from @tmnl/design/vnt
    status: pending
isProject: false
---

# Vantablack exhibition lab

**Naming SoT:** [tla-module-rose-tree-rfc.md](/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/packages/tmnl/docs/architecture/tla-module-rose-tree-rfc.md). Sequence: [TMNL execution metaplan](cursor-plan://plan/tmnl_execution_metaplan_c9d81100.plan.md).

The pattern to copy is **archived**: [RvnTestbed.tsx](/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/packages/tmnl/.archive/rvn/testbeds/RvnTestbed.tsx) — sectioned gallery, `TestbedProvider` + `ComponentBox` (isolate / source / design-mode). RVN product routes are unhooked. Do not resurrect `/testbed/rvn` or an RVN `createTheme` fixture.

Copy the **pattern**, not the light brutalist page (`#e6e6e6`, 80px Helvetica). Lab at **`src/.testbeds/vnt/`**. Lift-gate for `@tmnl/design` / `Vnt`.

## What to copy

- Sectioned gallery (Primitives / Forms / Layout / Feedback / Cards / Data)
- Per-component `ComponentBox`
- `TestbedProvider` + design mode ([ComponentBox.tsx](/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/packages/tmnl/src/lib/testbed/ComponentBox.tsx))

Keep: `SourceViewer`, `useDesignMode`, registry entry. IsolationChat still pulls `@archive/rvn` tokens (debt on the design-system plan) — do not make the lab depend on IsolationChat.

## What to leave

- Entire RVN kit (archived)
- Inline hex in the lab (must eat `Vnt` tokens)
- ComponentBox `#f9f9f9` prop-doc styles — restyle onto vnt when convenient

## Shape

```
packages/tmnl/src/.testbeds/vnt/
  VntLab.tsx
  sections/
    primitives.tsx
    forms.tsx
    layout.tsx
    feedback.tsx
    cards.tsx
    tokens.tsx
  index.ts
```

Route `/testbed/vnt` in **all four** SOT files in one change. CARD: `VANTABLACK SYSTEM`. Demo primitives via **leaf** paths (`@tmnl/design/vnt/ui/Button`); tokens via `import { Vnt } from '@tmnl/design'` / `import { Design } from 'tmnl'`.

Empty sections ok on day one; tokens section mandatory once StyleX vars exist.

## Sequence

1. Scaffold gallery shell + wire `/testbed/vnt` (App.tsx, router, WindowRoute, registry).
2. Tokens swatches from StyleX vars (no hardcoded hex in the lab).
3. ComponentBoxes as `vnt/ui` primitives land.

## Gates

- `/testbed/vnt` loads from a home CARD.
- Isolate still opens ComponentBox.
- Lab has zero raw hex except `.stylex.ts` definitions.
- No import of `@archive/rvn` from the lab.

## Coupling

- StyleX infra is the sibling design-system plan.
- Create at destination `src/.testbeds/` so cleanup Pass 0 does not move it twice.
- RVN archive is reference material only.

## Backlinks

**Parent design:** [vnt design system](cursor-plan://plan/vnt_design_system_404272ea.plan.md)  
**Law / gate:** [rose tree](cursor-plan://plan/tla_module_rose_tree_a8c41f02.plan.md) · [cleanup](cursor-plan://plan/tmnl_cleanup_lift_3a3ae41c.plan.md) (`src/.testbeds/`)
