---
name: tmnl public root
overview: Unscoped product API `import { Addr, Design, Morph, Chrome } from 'tmnl'`. Clusters stay `@tmnl/<cluster>`. npm cannot publish `@tmnl` bare. Root depends only on clusters that exist; grows as they land. Addr is substrate — re-export when `@tmnl/addr` exists.
todos:
  - id: pkg-std
    content: Cut packages/std (or tmnl-std) with name "tmnl"; export * as Design from @tmnl/design
    status: pending
  - id: wire-app
    content: App may import from 'tmnl'; do not make @gbg/tmnl the barrel
    status: pending
  - id: grow
    content: Add Addr / Morph / Chrome / Shell / … re-exports as those clusters exist
    status: pending
isProject: false
---

# `tmnl` — public root barrel

**Naming SoT:** [tla-module-rose-tree-rfc.md](/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/packages/tmnl/docs/architecture/tla-module-rose-tree-rfc.md). Sequence: [TMNL execution metaplan](cursor-plan://plan/tmnl_execution_metaplan_c9d81100.plan.md).

Effect analogue: `import { Effect } from 'effect'`. Ours: `import { Design } from 'tmnl'`.

```
packages/std/          # or packages/tmnl-std
  package.json         # "name": "tmnl"
  src/index.ts         # export * as Addr from '@tmnl/addr'     // substrate; when addr exists
                       # export * as Design from '@tmnl/design'
                       # export * as Morph from '@tmnl/morph'   // when morph exists
```

Layout A / rose-tree laws apply one level up. Root is **not** an install-everything kitchen sink on day one — it only `dependsOn` clusters it re-exports. Adding a cluster to the root is a conscious product-API choice.

**Not** `@gbg/tmnl` (Tauri app). **Not** `@tmnl` (invalid npm name).

Depends on: design prototype (at least `Vnt`). **After reconvene** — RFC and cleanup Pass 0 first. Grows after morph/chrome/shell/addr land. Shake: Rollup already proved a three-cluster root costs 0 extra bytes for `Design.Vnt.ui.Button`. Chrome re-export is `Pnl`, `Ovl`, `Hud`. Shell re-export is `Shll`, `Wnd` when the cluster lands. Addr re-export is `Addr` when `@tmnl/addr` exists — substrate, not a shell leaf.

## Backlinks

**Law:** [rose tree](cursor-plan://plan/tla_module_rose_tree_a8c41f02.plan.md) · [RFC](cursor-plan://plan/tla_module_rfc_b1e90211.plan.md)  
**Addr (substrate):** [rfc-addr-algebra.md](/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/packages/tmnl/docs/architecture/rfc-addr-algebra.md)  
**Gate:** [cleanup](cursor-plan://plan/tmnl_cleanup_lift_3a3ae41c.plan.md)  
**Re-exports grow from:** [vnt](cursor-plan://plan/vnt_design_system_404272ea.plan.md) · [mrph](cursor-plan://plan/mrph_morph_substrate_055a30d0.plan.md) · [shell cluster](cursor-plan://plan/shell_cluster_shl_wnd_a1f8c022.plan.md) · chrome ([pnl](cursor-plan://plan/pnl_floating_rewrite_4c958e4e.plan.md)/[ovl](cursor-plan://plan/ovl_overlays_rewrite_c9d60088.plan.md)/[hud](cursor-plan://plan/hud_viewport_host_d0e71199.plan.md))
