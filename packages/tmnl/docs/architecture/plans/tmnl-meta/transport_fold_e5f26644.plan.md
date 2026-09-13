---
name: transport fold
overview: One breaking window. Fold `@tmnl/msh` + `@tmnl/lnk` into `@tmnl/transport` (`export * as Msh`, `export * as Lnk`). Replace frozen `export const Msh = {…}` and index `export *`. No compat re-export. Codemod. Four NATS clients collapse to one `Msh.ConnectionLive`.
todos:
  - id: msh-namespace
    content: In place on packages/msh — export * as Msh from './Msh.js'; ban export * on the index (can land before the fold)
    status: pending
  - id: cut-transport
    content: Cut packages/transport; move msh + lnk in as modules; Layout A; source exports
    status: pending
  - id: holonet
    content: Finish holonet → Msh; one ConnectionLive instance app-wide
    status: pending
  - id: codemod
    content: Codemod @tmnl/msh and @tmnl/lnk importers; delete old packages; no re-export window
    status: pending
isProject: false
---

# `@tmnl/transport` — msh ⊕ lnk

**Naming SoT:** [tla-module-rose-tree-rfc.md](/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/packages/tmnl/docs/architecture/tla-module-rose-tree-rfc.md). Sequence: [TMNL execution metaplan](cursor-plan://plan/tmnl_execution_metaplan_c9d81100.plan.md).

Later than design/morph/chrome/qry. The fold is the **one breaking window** for these two live packages.

**Can happen earlier, in place, without the fold:** replace `export const Msh = {…}` with `export * as Msh from './Msh.js'` and stop `export * from './nats'` on the msh index. That's a shake/API fix, not a rename.

**The fold:** `packages/transport` with `Msh.ts` + `Lnk.ts` + `internal/{msh,lnk}/`. Nx one project. Tags `@tmnl/transport/msh/nats/Connection`. Holonet dies. lnk's NATS bridge consumes the same `Msh.ConnectionLive` instance.

OPEN-1 (v3 consumers of msh) still lives in the old RFC / map — decide facade vs migrate as part of this rewrite, not the rose-tree laws.

Depends on: rose-tree RFC, design prototype proving Layout A. Do not start because qry is green. Coordinate with state/protocol folds if we batch the breaking window — that same window also folds `@tmnl/datagrid` → `grd` and `@tmnl/mathkernel` → `num` into `@tmnl/state`.

## Backlinks

**Law:** [rose tree](cursor-plan://plan/tla_module_rose_tree_a8c41f02.plan.md) · [RFC](cursor-plan://plan/tla_module_rfc_b1e90211.plan.md)  
**Breaking window with:** [state cluster qry](cursor-plan://plan/state_cluster_qry_d4e15533.plan.md) (stx/grd/num) · [protocol cluster](cursor-plan://plan/protocol_cluster_pct_b8c59977.plan.md)
