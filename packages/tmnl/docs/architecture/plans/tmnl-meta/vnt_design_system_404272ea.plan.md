---
name: vnt design system
overview: Canonical TMNL design system as TLA `vnt` under the Effect-style cluster barrel `@tmnl/design` (`import { Vnt } from '@tmnl/design'`, `@tmnl/design/vnt`). StyleX compile-time tokens replace scattered VANTA/FUI/CEW hex. RVN is archived — not a theme, not a second token source.
todos:
  - id: vnt-stylex-infra
    content: Wire @stylexjs/unplugin before react plugin; first .stylex.ts + HMR proof under packages/design/src/vnt
    status: pending
  - id: vnt-tokens
    content: Encode VANTA_COLORS as defineVars on Vnt; CSS-var bridge for AG Grid/tldraw
    status: pending
  - id: vnt-primitives
    content: Absorb fui + tmnl-ui + VantaCard onto @tmnl/design/vnt ui; kill tactical split-brain
    status: pending
  - id: vnt-repoint
    content: Re-point portal/token consumers and leftover @archive/rvn importers onto Vnt
    status: pending
isProject: false
---

# `@tmnl/design/vnt` — Vantablack design system

**Naming SoT:** [tla-module-rose-tree-rfc.md](/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/packages/tmnl/docs/architecture/tla-module-rose-tree-rfc.md). Sequence: [TMNL execution metaplan](cursor-plan://plan/tmnl_execution_metaplan_c9d81100.plan.md).

Cluster barrel already scaffolded at [packages/design](/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/packages/design):

```ts
import { Vnt } from '@tmnl/design'
import * as Vnt from '@tmnl/design/vnt'
```

That is the TLA convention (RFC §0.1a): **cluster npm name + TLA module**, same as `import { Effect } from 'effect'`. Do not mint `@tmnl/vnt`.

Three overlapping live kits remain (RVN is gone from `src/lib`):

- **Vantablack (canonical):** [portal/tokens.ts](/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/packages/tmnl/src/components/portal/tokens.ts) `VANTA_COLORS`. Skill [tmnl-color-system](/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/packages/tmnl/.claude/skills/tmnl-color-system/SKILL.md). Importers: editor, charts, morphchat, genifer, nu-cmdk, foldable-panel, code-editor.
- **FUI:** [fui/tokens.ts](/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/packages/tmnl/src/lib/fui/tokens.ts) — also “vantablack,” no glows. Modal-only.
- **tmnl-ui / CEW:** [tmnl-ui/index.ts](/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/packages/tmnl/src/lib/tmnl-ui/index.ts) — parallel primitives.
- **Split-brain:** [tactical/tmnl-ui.tsx](/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/packages/tmnl/src/components/tactical/tmnl-ui.tsx) vs `tactical-ui.tsx`.

**RVN archived** at [packages/tmnl/.archive/rvn](/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/packages/tmnl/.archive/rvn). Light brutalist (`#e6e6e6`). Not a `createTheme`. Leftover product imports use `@archive/rvn` (IsolationChat, ai-core renderers, conductor chat, morph-card `skins/rvn`, TelemetryStatsPanel) — debt this plan retires onto `Vnt`.

TLA **`vnt`** owns the design layer. 2-letter `ui` stays an internal namespace under the vnt module.

## StyleX particulars (probed)

**Not in the Tauri app today.** Zero `@stylexjs` deps, zero `.stylex.ts` files. Grounded write-up: [getbyshell-stylex-30pc-bar.md](/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/packages/tmnl/docs/architecture/getbyshell-stylex-30pc-bar.md) plus `/facebook/stylex`:

- `@stylexjs/unplugin` **`stylex.vite({ useCSSLayers: true })` before `@vitejs/plugin-react`**
- `defineVars` / `defineConsts` only in `.stylex.ts`, named exports, no other exports in that file
- import vars from the defining file (no re-barrel)
- `createTheme` for subtree overrides (product has one theme: vanta)
- spare dynamic StyleX; no mix of `style={{}}` and `stylex.props()` on the same node
- set CSS layer order so unlayered legacy CSS does not silently win

GetByShell consumes `Vnt` tokens; not a second StyleX island.

## Package shape

```
packages/design/                 # cluster @tmnl/design
  src/index.ts                   # export * as Vnt from './vnt.js'
  src/vnt.ts                     # TLA file (Layout A — no vnt/ dir beside it)
  src/internal/vnt/
    ui.ts / ui/Button.ts         # Pascal seam files
    tokens/color.stylex.ts
  package.json                   # source exports in-repo; ./* → src/*.ts;
                                 # ./vnt/* → src/internal/vnt/* ; internal/* null
  project.json                   # one Nx project for the cluster
```

Kind B. `layerTest` N/A. `.js` specifiers. React consumers use **leaf** paths (`@tmnl/design/vnt/ui/Button`). Namespace `Vnt` is for tokens/recipes and for `import { Vnt } from '@tmnl/design'` / `from 'tmnl'`. No Vite alias to `index.ts`. `sideEffects: ["**/*.stylex.ts", "**/*.css"]`. Walk-the-tree for stacked `exports`. `annotate-pure-calls` is publish-time only (Vite never runs it). **Starts after RFC + cleanup Pass 0 + reconvene** — not now.

## Sequence

1. **Infra.** Reshape to Layout A if still dir-TLA. Delete `@tmnl/design` Vite aliases. StyleX unplugin on tmnl Vite. First `.stylex.ts` under `packages/design/src/internal/vnt/tokens`.
2. **Token cutover.** Encode `VANTA_COLORS` as `defineVars`. TS re-export of resolved defaults for AG Grid / tldraw / canvas.
3. **Absorb FUI + tmnl-ui** onto `vnt/ui`. `VantaCard` → `Vnt.Card` via `import { Vnt } from '@tmnl/design'`.
4. **Kill split-brain.** `tactical/tmnl-ui.tsx` re-exports `Vnt`. Archive unused `tactical-ui.tsx`.
5. **Consumers.** Portal token importers + `@archive/rvn` leftovers → `@tmnl/design` / `@tmnl/design/vnt`. Hex outside `.stylex.ts` and third-party adapters is a gate failure.

## Out of scope

- Exhibition lab (sibling plan).
- Restyling AG Grid/tldraw internals beyond CSS-var bridges.
- Reviving RVN as a theme.
- RN.

## Gates

- `import { Vnt } from '@tmnl/design'` typechecks; `Vnt.version` exists today.
- Vite HMR with StyleX before react plugin.
- `packages/design` typecheck.
- Home chrome uses vnt vars, not raw hex.
- Zero `@archive/rvn` imports in `packages/tmnl/src` when this plan completes.

## Backlinks

**Law:** [rose tree](cursor-plan://plan/tla_module_rose_tree_a8c41f02.plan.md) · [RFC](cursor-plan://plan/tla_module_rfc_b1e90211.plan.md)  
**Gate:** [cleanup](cursor-plan://plan/tmnl_cleanup_lift_3a3ae41c.plan.md)  
**Sibling:** [vnt exhibition lab](cursor-plan://plan/vnt_exhibition_lab_55c5593d.plan.md)  
**Public root:** [tmnl public root](cursor-plan://plan/tmnl_public_root_c3d04422.plan.md)  
**Tokens chrome:** [hud](cursor-plan://plan/hud_viewport_host_d0e71199.plan.md) / [shll](cursor-plan://plan/shll_keystone_frame_b2c10011.plan.md) (consumers, not owners)
