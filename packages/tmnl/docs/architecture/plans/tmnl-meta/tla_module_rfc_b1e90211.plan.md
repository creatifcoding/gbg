---
name: TLA module RFC
overview: New RFC for the module rose tree. Supersedes TLA RFC §0 naming and barrels (including §0.1a and the frozen Msh aggregate). Leaves Layer doctrine, Kind A/B, and layerTest alone. Inverts industrial sequencing (dmn from iiot; iot first consumer).
todos:
  - id: draft-rfc
    content: Draft docs/architecture RFC — cluster table, Layout A, tags, tmnl root, one breaking window
    status: completed
  - id: mark-old
    content: Banner the 2026-07-03 TLA RFC §0 naming/barrels as superseded; keep §0.3 Kind A/B and Layer doctrine
    status: completed
  - id: crosslink
    content: Point every cluster rewrite plan at the new RFC as the naming source of truth
    status: completed
isProject: false
---

# RFC — TLA module rose tree

Coordination plan. The law already lives in [TLA module rose tree](cursor-plan://plan/tla_module_rose_tree_a8c41f02.plan.md). This is the durable doc pass so lifts don't cite a superseded §0.

**Write:** `packages/tmnl/docs/architecture/tla-module-rose-tree-rfc.md` (name flexible).

**Supersedes:** TLA package-suites RFC §0 items 1, 1a, 5 (naming, cluster barrels glued on, frozen `Msh` aggregate).

**Does not touch:** Kind A/B (§0.3), Context.Service / `static layer` / `layerTest`, MemoMap, effect pin doctrine.

**Must include:** cluster register (addr substrate=`addr` / `@tmnl/addr`; design/morph/shell=`shll`+`wnd`(+`cmd`/`spl`)/chrome=`pnl`+`ovl`+`hud`/transport/state/runtime/protocol/domain), Layout A, `.js` specifiers, Effect dual exports, tags `@tmnl/<cluster>/<tla>/<seam>/<Name>`, public root `tmnl` (unscoped), one breaking window (msh/lnk + stx/grd/num + pct), walk-the-tree exports codegen (not Effect build-utils), `annotate-pure-calls` publish-only, dmn-from-iiot / iot-first. Addr law already lives in [rfc-addr-algebra.md](/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/packages/tmnl/docs/architecture/rfc-addr-algebra.md) — name it in the register; do not relitigate.

**This RFC is the docs gate.** Nothing after it (cleanup Pass 0, then reconvene, then lifts) starts until it exists.

Depends on: rose-tree plan (ratified). Blocks: cleanup Pass 0 and every rewrite.

## Backlinks

**Sequence:** [TMNL execution metaplan](cursor-plan://plan/tmnl_execution_metaplan_c9d81100.plan.md)  
**Law hub:** [TLA module rose tree](cursor-plan://plan/tla_module_rose_tree_a8c41f02.plan.md)  
**Next gate:** [tmnl cleanup lift](cursor-plan://plan/tmnl_cleanup_lift_3a3ae41c.plan.md)  
**Must name in RFC:** `@tmnl/addr` / `addr` (substrate) — [rfc-addr-algebra.md](/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/packages/tmnl/docs/architecture/rfc-addr-algebra.md); shell=`shll`+`wnd`(+`cmd`/`spl`), chrome=`pnl`+`ovl`+`hud` — see [shell cluster](cursor-plan://plan/shell_cluster_shl_wnd_a1f8c022.plan.md)
