---
name: TLA module rose tree
overview: Ratified 2026-08-13. TLA is a module in an Effect-flat rose tree. Clusters are npm names. Public product API is an unscoped `tmnl` root (not `@tmnl` — invalid npm). Layout A everywhere. Leaf paths for React. One breaking window. New RFC supersedes §0 naming/barrels.
todos:
  - id: new-rfc
    content: Author new RFC (module rose tree) superseding TLA RFC §0 naming/barrels; leave Layer doctrine alone
    status: completed
  - id: walk-the-tree
    content: Walk-the-tree script emits stacked exports maps from src/ (not Effect build-utils). Hand-edit until a cluster has enough seams.
    status: pending
  - id: design-prototype
    content: "AFTER reconvene: design as Layout A prototype — vnt.ts + internal/vnt/, .js specifiers, source exports, delete Vite aliases, walk-the-tree"
    status: pending
  - id: ci-shake
    content: Check in Rollup marker test (CI) proving unused sibling namespaces drop
    status: pending
  - id: fr-spike
    content: Spike Fast Refresh on Vnt.ui.Button vs leaf import; standardize on leaf for components
    status: pending
  - id: public-root
    content: Scaffold unscoped tmnl root (import { Design } from 'tmnl'); re-export clusters it already depends on
    status: pending
  - id: morph-first
    content: Cut packages/morph; mrph born as module — never @tmnl/mrph
    status: pending
  - id: shell-cluster
    content: Cut packages/shell; Shll (4-letter keystone) + Wnd — wnd greenfield, archive tauri-windows. Never @tmnl/shll / @tmnl/wnd
    status: pending
  - id: chrome-cluster
    content: Cut packages/chrome; Pnl + Ovl + Hud — never @tmnl/pnl, @tmnl/ovl, @tmnl/hud. Consumes shell/wnd
    status: pending
  - id: domain-dmn
    content: Domain cluster later — dmn lifted from iiot, iot is first consumer (invert RFC §7)
    status: pending
  - id: one-break-legacy
    content: One breaking window — msh/lnk → transport, stx/datagrid/mathkernel → state (grd/num), pct → protocol; no compat re-export; codemod
    status: pending
isProject: false
---

# Recursive tree-shakeable TLA modules (ratified)

A TLA is **not** an npm package. It is a node in a rose tree of ESM modules. Parents expose children only as live namespaces (`export * as Child from './child.js'`). Path ≅ namespace. Spike: `tmp/tla-modules/` (gitignored).

```ts
import { Design } from 'tmnl'                          // public root
import { Vnt } from '@tmnl/design'                     // cluster → TLA (Pascal export)
import * as Vnt from '@tmnl/design/vnt'                // same module, lowercase path
import { Button } from '@tmnl/design/vnt/ui/Button'    // blessed for React (leaf)
```

## Ratified cluster register

| Cluster npm | Dir | TLAs | Notes |
|---|---|---|---|
| `@tmnl/addr` | `packages/addr` | `addr` | **substrate.** 4-letter keystone. Resource algebra (`doc://` `pnl://` `wnd://`). Consumed by nearly everything. NOT a shell leaf. NOT `pct`. Instance-as-domain. Never mint a second `@tmnl/<tla>` for this — cluster name *is* the TLA. Law: [rfc-addr-algebra.md](/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/packages/tmnl/docs/architecture/rfc-addr-algebra.md). Lift after reconvene |
| `@tmnl/design` | `packages/design` | `vnt` | exists; prototype |
| `@tmnl/morph` | `packages/morph` | `mrph`, later `crd`, `srf`, `edt` | cut now; never `@tmnl/mrph` |
| `@tmnl/chrome` | `packages/chrome` | `pnl`, `ovl`, `hud` | in-viewport UI. Consumes `@tmnl/shell/wnd` for OS windows. Speaks `pnl://` (Addr) |
| `@tmnl/shell` | `packages/shell` | `shll` (keystone), `wnd`, later `cmd`/`spl` | 4-letter keystone. Latent. Sibling plans per piece. Not getbyshell. Speaks `wnd://` (Addr) |
| `@tmnl/transport` | `packages/transport` | `msh`, `lnk` | one breaking fold of existing pkgs |
| `@tmnl/state` | `packages/state` | `stx`, `qry`, `grd`, `vbl`, `flo`, `num` | stx last among these. `doc://` consumers; stx `autoLens` is Addr's in-memory optic half |
| `@tmnl/runtime` | `packages/runtime` | `cog`, `rig` | |
| `@tmnl/protocol` | `packages/protocol` | `pct`, `prt` | `pct:` `nodeId` may BE Addr `<instance>` when federated; does not own locator grammar |
| `@tmnl/domain` | `packages/domain` | `dmn` (core), `iot` (first consumer), later `geo`/`ams`/`sio` | **invert RFC §7**: dmn is lifted *from* iiot; iot is the proving vertical, not a follow-on after geo. Business verticals only — instance-as-domain is `@tmnl/addr` |

Nx: **one project per cluster**. TLAs are source roots / tags, not Nx projects.

Tags: `@tmnl/<cluster>/<tla>/<seam>/<Name>` e.g. `@tmnl/transport/msh/nats/Connection`.

## Public root (npm-legal)

`import { Design } from '@tmnl'` is **not publishable** — npm scoped packages require `@scope/name`.

**Decision: unscoped `tmnl`** (the Effect analogue: `import { Effect } from 'effect'`). Package dir `packages/std` or `packages/tmnl-std`, `"name": "tmnl"`.

```ts
// packages/std/src/index.ts
export * as Addr from '@tmnl/addr'       // substrate; when the cluster exists
export * as Design from '@tmnl/design'
export * as Morph from '@tmnl/morph'
export * as Chrome from '@tmnl/chrome'
export * as Shell from '@tmnl/shell'
// …add clusters as they exist. Root depends on clusters it re-exports.
```

`@gbg/tmnl` (the Tauri app) stays app-tier. `tmnl` is the product API; `@tmnl/*` clusters are implementation. Root install *does* pull depended clusters — that is intended.

## Layout A everywhere (including design)

No `vnt.ts` next to `vnt/`. Effect-flat:

```
packages/design/src/
  index.ts                 export * as Vnt from './vnt.js'
  vnt.ts                   TLA file; export * as ui from './internal/vnt/ui.js'
  internal/vnt/
    ui.ts                  export * as Button from './ui/Button.js'
    ui/Button.ts           Pascal seam file
    tokens/color.stylex.ts
```

Leaf path maps through `internal/` (not a public directory name):

```json
{
  "exports": {
    ".": "./src/index.ts",
    "./*": "./src/*.ts",
    "./vnt/*": "./src/internal/vnt/*",
    "./internal/*": null
  }
}
```

`@tmnl/design/vnt` → `src/vnt.ts`. `@tmnl/design/vnt/ui/Button` → `src/internal/vnt/ui/Button.ts`.

**Walk-the-tree script** emits the stacked `exports` map from `src/` (TLA files at root, `internal/<tla>/` for seams). Not Effect `build-utils` / `prepare-v3` — those pack dist, they do not emit `./vnt/*` keys. Hand-edit is fine until a cluster has more than a handful of seams.

Naming: **path TLA lowercase** (`vnt`, `msh`); **export Pascal** (`Vnt`, `Msh`); **seam files Pascal** (`Button.ts`, `Connection.ts`).

`.js` specifiers in every new cluster file.

**In-repo exports point at source** (Effect dual). Publish pack-to-dist. `annotate-pure-calls` is **publish-time only** — Vite bundles source; babel annotate never runs on the Tauri graph. App shake is Rollup `smallest` + `export * as`.

## Consumer style

Bless both namespace and subpath (same module). **Standardize React/components on leaf/seam paths** (`@tmnl/design/vnt/ui/Button`). Kind A stays `Msh.Connection` / `yield* Msh.PubSub`. Spike Fast Refresh before anyone puts a component on the namespace; if FR dies, leaf was already the standard.

## Vite aliases (recommendation, accepted as the plan)

**Delete `@tmnl/*` aliases that point at index files.** They kill subpaths.

Load-bearing today only because msh/stx/datagrid `exports` target **dist**. Rule:

1. Any cluster with source `exports` (design now): no alias. Vite resolves `workspace:*` + `exports`.
2. Legacy dist-export packages keep a temporary alias until flipped to source exports, then the alias dies.
3. Never alias a package name to a single file.

## Shake

| Bundler | unused `export * as` sibling |
|---|---|
| bun / esbuild (dev) | **kept** |
| rollup `smallest` (Vite prod) | **dropped** |

Check in a Rollup marker test under `packages/design` (or `packages/std/test/shake`) and run it in CI. Do not use `bun build` as the oracle. `sideEffects`: `["**/*.stylex.ts", "**/*.css"]` on design.

## Compat

**One breaking window.** No `@tmnl/msh` re-export when transport is cut. Codemod. Until that window, legacy packages stay; **new** TLAs are never minted as `@tmnl/<tla>`. Same window folds existing `@tmnl/datagrid` → state/`grd` and `@tmnl/mathkernel` → state/`num` (they already exist; they are not new `@tmnl/<tla>` mints).

Frozen `export const Msh = {…}` is deprecated as public API. `export * as Msh from './Msh.js'`. Ban `export * from` on cluster indexes.

## RFC

**New RFC** (module rose tree). Supersedes TLA RFC §0 naming + barrels (including the glued-on §0.1a and the Kind A frozen-aggregate blessing in §0.5). **Leave Layer doctrine** (`effect-v4-layer-doctrine.md`, Kind A/B, `layerTest`) alone.

Also supersedes RFC §7 sequencing for industrial: dmn is extracted *from* iiot into `@tmnl/domain`; **iot is the first consumer**, not geo-first after a greenfield dmn.

Addr is a **sibling RFC**, already written: [rfc-addr-algebra.md](/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/packages/tmnl/docs/architecture/rfc-addr-algebra.md). The rose-tree RFC names `@tmnl/addr` in the register; it does not relitigate resource algebra.

## Execution order (gated)

**Block on docs, then cleanup, then reconvene. Real work after that.** Design Layout A, **addr (substrate)**, **shell (`shll`+`wnd`)**, morph, chrome (pnl+ovl+hud), qry, `tmnl` root, CI shake — none until reconvene. Addr ranks with the first post-reconvene cuts (before chrome/shell need handles). Shell ranks above chrome; `shll` is latent across many `src/lib` dirs.

1. **New RFC** — this plan’s laws, cluster table, layout A, tags, root name `tmnl`. **This is the docs gate.**
2. **Sibling plans** — already rewritten (including ovl). Keep coordinating here; do not execute them yet.
3. **Cleanup Pass 0** — repair, archive dead, migrate testbeds to `src/.testbeds/`. Stop. Do not sneak a design reshape into Pass 0.
4. **Reconvene.** Then the real work:
5. **design prototype** — Layout A reshape, `.js` specifiers, source exports, delete design Vite aliases, walk-the-tree exports, StyleX `sideEffects` when tokens land.
6. **CI shake test** + **FR spike** (confirms leaf standard).
7. **`tmnl` root** scaffolding, re-exporting design (and morph/chrome/addr as they appear).
8. **`packages/addr`** — substrate (`Addr`). Layout A. First schemes `doc://` `pnl://` `wnd://`. Land before chrome/shell need resource handles, or those lifts stub locators. Law: [rfc-addr-algebra.md](/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/packages/tmnl/docs/architecture/rfc-addr-algebra.md). **Do not cut before reconvene.**
9. **`packages/shell`** — `shll` keystone (frame + census of latent bits) then `wnd` greenfield. Archive `lib/tauri-windows`. Ahead of chrome. Speaks `wnd://`.
10. **`packages/morph`** — mrph module first. Never `packages/mrph`.
11. **`packages/chrome`** — `pnl`, `ovl`, `hud`. Consumes `@tmnl/shell/wnd` when popping OS windows. Speaks `pnl://`.
12. **qry** lifts into `@tmnl/state` (may create the state cluster around qry before stx moves).
13. **One breaking window** later: msh+lnk → transport; stx + datagrid + mathkernel → state (`Stx`/`Grd`/`Num`); pct → protocol. Codemod. No re-exports.
14. **domain** last among clusters: dmn from iiot, iot as first consumer. Instance-as-domain is `@tmnl/addr`, not `dmn`.

Working paper: `tmp/tla-modules/DOSSIER.md`.

## Coordination index

**Execution tracker:** [TMNL execution metaplan](cursor-plan://plan/tmnl_execution_metaplan_c9d81100.plan.md). Sequence and gates live there. This file stays naming law. If order disagrees, the metaplan wins.

Law vs rewrite. These evolve; the metaplan is the tracker. This table is the inventory.

| Plan | Role | Cluster / TLA | When |
|---|---|---|---|
| **[TMNL execution metaplan](cursor-plan://plan/tmnl_execution_metaplan_c9d81100.plan.md)** | sequence | all | tracker |
| **[TLA module rose tree](cursor-plan://plan/tla_module_rose_tree_a8c41f02.plan.md)** (this) | law | all | ratified |
| **[TLA module RFC](cursor-plan://plan/tla_module_rfc_b1e90211.plan.md)** | durable doc | all | first doc pass |
| **[addr resource algebra](/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/packages/tmnl/docs/architecture/rfc-addr-algebra.md)** | law | `@tmnl/addr` / `addr` | RFC written 2026-08-15; lift after reconvene. Never a shell leaf |
| **[tmnl cleanup lift](cursor-plan://plan/tmnl_cleanup_lift_3a3ae41c.plan.md)** | Pass 0 archive/testbeds | app | after RFC; stop at Pass 0 |
| **[vnt design system](cursor-plan://plan/vnt_design_system_404272ea.plan.md)** | rewrite | `@tmnl/design` / `vnt` | after reconvene |
| **[vnt exhibition lab](cursor-plan://plan/vnt_exhibition_lab_55c5593d.plan.md)** | rewrite | `/testbed/vnt` | with design |
| **[tmnl public root](cursor-plan://plan/tmnl_public_root_c3d04422.plan.md)** | rewrite | unscoped `tmnl` | after design prototype |
| **[mrph morph substrate](cursor-plan://plan/mrph_morph_substrate_055a30d0.plan.md)** | rewrite | `@tmnl/morph` / `mrph` | after reconvene; never `@tmnl/mrph` |
| **[shell cluster](cursor-plan://plan/shell_cluster_shl_wnd_a1f8c022.plan.md)** | coordinator | `@tmnl/shell` | after reconvene; ahead of chrome |
| **[shll keystone frame](cursor-plan://plan/shll_keystone_frame_b2c10011.plan.md)** | rewrite | `shll` | shell + scale first |
| **[wnd os windows](cursor-plan://plan/wnd_os_windows_c3d20022.plan.md)** | rewrite | `wnd` | greenfield; archive tauri-windows |
| **[cmd command spine](cursor-plan://plan/cmd_command_spine_d4e30033.plan.md)** | tentative | `cmd`? | U5; letter open |
| **[spl emacs panes](cursor-plan://plan/spl_emacs_panes_e5f40044.plan.md)** | tentative | `spl` | lib/windows; ≠ wnd |
| **[shll sidebar seam](cursor-plan://plan/shll_sidebar_seam_f6a50055.plan.md)** | tentative | seam | not a TLA yet |
| **[pnl floating rewrite](cursor-plan://plan/pnl_floating_rewrite_4c958e4e.plan.md)** | rewrite | `@tmnl/chrome` / `pnl` | after reconvene; consumes wnd |
| **[ovl overlays rewrite](cursor-plan://plan/ovl_overlays_rewrite_c9d60088.plan.md)** | rewrite | `@tmnl/chrome` / `ovl` | after reconvene; Overlay class + OverlayTestbed |
| **[hud viewport host](cursor-plan://plan/hud_viewport_host_d0e71199.plan.md)** | rewrite | `@tmnl/chrome` / `hud` | after reconvene; ex-GlobalSlot. Never `slt` |
| **[state cluster qry](cursor-plan://plan/state_cluster_qry_d4e15533.plan.md)** | rewrite | `@tmnl/state` / `qry` | cheapest extraction; stx fold later |
| **[transport fold](cursor-plan://plan/transport_fold_e5f26644.plan.md)** | rewrite | `@tmnl/transport` / msh⊕lnk | breaking window |
| **[domain cluster dmn](cursor-plan://plan/domain_cluster_dmn_f6a37755.plan.md)** | rewrite | `@tmnl/domain` / dmn, iot first | after tree is proven |
| **[runtime cluster cog](cursor-plan://plan/runtime_cluster_cog_a7b48866.plan.md)** | stub | `@tmnl/runtime` / cog⊕rig | defer |
| **[protocol cluster pct](cursor-plan://plan/protocol_cluster_pct_b8c59977.plan.md)** | stub | `@tmnl/protocol` / pct⊕prt | breaking window + prt repair |

crd / srf / edt / vbl / flo / geo / ams / sio are **not** plans yet. Shell pieces → [shell cluster](cursor-plan://plan/shell_cluster_shl_wnd_a1f8c022.plan.md). Transfer = `txf` pending. Never `slt`. Addr has no rewrite plan — the RFC is source of truth.

## Backlinks

This file is the **law hub**. Every rewrite plan should link here. Children do not replace this index — they deep-link back.
