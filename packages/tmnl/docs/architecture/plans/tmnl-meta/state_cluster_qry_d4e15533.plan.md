---
name: state cluster qry
overview: Create `@tmnl/state` by lifting `src/lib/search` → TLA `qry` (122/122 already green). stx stays `@tmnl/stx` until the one breaking window. Same window folds `@tmnl/datagrid` → `grd` and `@tmnl/mathkernel` → `num`. vbl/flo still need their own rewrites.
todos:
  - id: cut-state
    content: Cut packages/state; export * as Qry from './qry.js'; Layout A; source exports
    status: pending
  - id: lift-search
    content: Move src/lib/search → internal/qry; re-point ~16 importers; journal
    status: pending
  - id: stx-adopt-debt
    content: Parallel/later — migrate ~53 @/lib/stx importers onto packages/stx (adoption, not the cluster fold)
    status: pending
  - id: fold-stx
    content: One breaking window — stx + datagrid + mathkernel into @tmnl/state as Stx / Grd / Num; no re-export
    status: pending
isProject: false
---

# `@tmnl/state` / `Qry`

**Naming SoT:** [tla-module-rose-tree-rfc.md](/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/packages/tmnl/docs/architecture/tla-module-rose-tree-rfc.md). Sequence: [TMNL execution metaplan](cursor-plan://plan/tmnl_execution_metaplan_c9d81100.plan.md).

Cheapest classic extraction and the cluster's first TLA. Kind A (swappable search drivers, `SearchService.layer` — map). Layout A: `qry.ts` + `internal/qry/`. Leaf paths for any React; namespace for the service graph.

**This plan is qry + standing up the cluster.** Not vbl (v1/v2 audit), not flo (fold playground). Those get their own rewrites when we get there.

**grd / num in the breaking window (ratified):** existing `@tmnl/datagrid` and `@tmnl/mathkernel` fold into `@tmnl/state` as `Grd` / `Num` alongside `Stx`. Not a qry gate. Not new `@tmnl/<tla>` packages. Compose-once / WASM lifecycle remain in-package problems that ride the fold — they do not need a pre-fold rewrite unless reconvene says otherwise.

**stx:** ~53 in-tree `@/lib/stx` importers are **adoption onto existing `packages/stx`**, still allowed until the breaking window. Folding stx *into* `@tmnl/state` is that window, coordinated with transport/protocol, not a qry gate.

Depends on: rose-tree laws, cleanup Pass 0 green enough to typecheck. Lift-gate: existing search testbeds. Journal: `packages/state/.extraction-journal.md`.

Nx: one project `@tmnl/state`. Tags: `@tmnl/state/qry/…`.

## Backlinks

**Law:** [rose tree](cursor-plan://plan/tla_module_rose_tree_a8c41f02.plan.md) · [RFC](cursor-plan://plan/tla_module_rfc_b1e90211.plan.md)  
**Gate:** [cleanup](cursor-plan://plan/tmnl_cleanup_lift_3a3ae41c.plan.md)  
**Breaking window with:** [transport fold](cursor-plan://plan/transport_fold_e5f26644.plan.md) · [protocol cluster](cursor-plan://plan/protocol_cluster_pct_b8c59977.plan.md)
