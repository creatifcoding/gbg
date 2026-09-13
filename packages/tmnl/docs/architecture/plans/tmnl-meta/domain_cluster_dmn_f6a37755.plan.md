---
name: domain cluster dmn
overview: Invert RFC §7. `@tmnl/domain` with `dmn` lifted *from* iiot (not greenfield before any vertical). `iot` is the first consumer/proving vertical. geo/ams/sio later. Do not start until design/morph/chrome/state-qry have proven the tree.
todos:
  - id: extract-dmn
    content: Extract es-core / makeAggregate / EventStore from iiot into @tmnl/domain dmn module
    status: pending
  - id: iot-first
    content: Re-point iiot as first consumer of dmn (not geo-first); prove the triptych on one vertical
    status: pending
  - id: later-verticals
    content: geo / ams / sio as follow-on rewrites once iot is on dmn
    status: pending
isProject: false
---

# `@tmnl/domain` / `Dmn` — iot first

**Naming SoT:** [tla-module-rose-tree-rfc.md](/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/packages/tmnl/docs/architecture/tla-module-rose-tree-rfc.md). Sequence: [TMNL execution metaplan](cursor-plan://plan/tmnl_execution_metaplan_c9d81100.plan.md).

Old RFC: author dmn greenfield, then extract geo, then decompose iiot. **Superseded.**

New: iiot already has the pattern. Lift that kernel into `packages/domain` as TLA `dmn` (Layout A). **iot is the first user** — the vertical that proves `dmn.makeAggregate` / EventStore / the triptych. geo/ams/sio wait.

Kind A. Tags `@tmnl/domain/dmn/…`. One Nx project for the cluster.

This plan will grow a real extraction map when we open it; until then it exists so cleanup/industrial work does not silently resurrect “author dmn first.”

Depends on: transport fold far enough that realtime is `lnk` over `msh` (or an honest defer). Blocks: do not extract geoint server pipeline as `geo` before dmn+iot.

## Backlinks

**Law:** [rose tree](cursor-plan://plan/tla_module_rose_tree_a8c41f02.plan.md) · [RFC](cursor-plan://plan/tla_module_rfc_b1e90211.plan.md)  
**Depends on tree proven:** [shell cluster](cursor-plan://plan/shell_cluster_shl_wnd_a1f8c022.plan.md) · chrome · [state qry](cursor-plan://plan/state_cluster_qry_d4e15533.plan.md) · [transport](cursor-plan://plan/transport_fold_e5f26644.plan.md)  
**Instance-as-domain is not this cluster:** [rfc-addr-algebra.md](/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/packages/tmnl/docs/architecture/rfc-addr-algebra.md) (`@tmnl/addr`). `dmn` stays business verticals.
