---
name: protocol cluster pct
overview: Placeholder rewrite for `@tmnl/protocol` (`pct` Pact, `prt` ports/dataplane). pct already exists as `@tmnl/pct`. Fold is part of the one breaking window, not a now-lift. prt stays RED until v3→v4 + dataplane tests.
todos:
  - id: pct-in-place
    content: pct grows project.json / source exports / export * as Pct if missing — no rename yet
    status: pending
  - id: fold-protocol
    content: One breaking window — packages/protocol with Pct + Prt modules; delete @tmnl/pct
    status: pending
  - id: prt-repair
    content: Separate rewrite — dataplane tests + deprecate NatsPort/DurableStreamsPort in favor of Msh+Lnk
    status: pending
isProject: false
---

# `@tmnl/protocol` — pct ⊕ prt

**Naming SoT:** [tla-module-rose-tree-rfc.md](/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/packages/tmnl/docs/architecture/tla-module-rose-tree-rfc.md). Sequence: [TMNL execution metaplan](cursor-plan://plan/tmnl_execution_metaplan_c9d81100.plan.md).

Coordination stub. pct is live; don't rename it until the breaking window. prt is a sibling TLA, not a pct subpath — dataplane has zero transport imports and should stay that way.

LO-6 (pct-as-facade vs `@effect/rpc` in iiot/geoint) stays a spike before domain leans on pct.

## Backlinks

**Law:** [rose tree](cursor-plan://plan/tla_module_rose_tree_a8c41f02.plan.md)  
**Breaking window with:** [transport](cursor-plan://plan/transport_fold_e5f26644.plan.md) · [state](cursor-plan://plan/state_cluster_qry_d4e15533.plan.md)  
**Does not own locators:** [rfc-addr-algebra.md](/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/packages/tmnl/docs/architecture/rfc-addr-algebra.md) — `pct:` `nodeId` may BE Addr `<instance>` when federated
