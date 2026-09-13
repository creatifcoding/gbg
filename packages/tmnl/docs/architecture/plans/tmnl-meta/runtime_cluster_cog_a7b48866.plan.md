---
name: runtime cluster cog
overview: Placeholder rewrite for `@tmnl/runtime` (`cog` = ai-core+mcp, `rig` = harness − pragma + agents auth). They never import each other — keep them as sibling TLAs in one cluster, not a merge. Defer full rig (132 TaggedStruct). Near-term only if `@tmnl/runtime/rig/session-schemas` is needed by morph adapter-harness.
todos:
  - id: session-schemas
    content: If morph adapter-harness needs it — extract harness session schemas as a contract leaf under runtime/rig (can precede the full cluster)
    status: pending
  - id: cut-runtime
    content: Cut packages/runtime when cog or rig actually lifts; export * as Cog / Rig
    status: pending
  - id: defer-rig
    content: Full rig conversion stays last — do not pull 132 TaggedStruct forward
    status: pending
isProject: false
---

# `@tmnl/runtime` — cog ⊕ rig

**Naming SoT:** [tla-module-rose-tree-rfc.md](/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/packages/tmnl/docs/architecture/tla-module-rose-tree-rfc.md). Sequence: [TMNL execution metaplan](cursor-plan://plan/tmnl_execution_metaplan_c9d81100.plan.md).

Coordination stub. Two runtimes, zero shared imports today — the cluster names them honestly instead of merging.

**Do not start** as a package lift. Morph's adapter-harness may need a **session-schemas contract leaf** earlier; that leaf can live under a future `rig` path without dragging the engine.

pragma → `packages/pragma` (Rust, non-TLA) remains a cleanup relocation, not this cluster.

## Backlinks

**Law:** [rose tree](cursor-plan://plan/tla_module_rose_tree_a8c41f02.plan.md)  
**May unblock early:** [mrph](cursor-plan://plan/mrph_morph_substrate_055a30d0.plan.md) adapter-harness (session-schemas leaf)
