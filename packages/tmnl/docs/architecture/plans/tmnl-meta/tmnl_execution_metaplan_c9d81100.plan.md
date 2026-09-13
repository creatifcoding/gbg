---
name: TMNL execution metaplan
overview: Single execution tracker for the 21 drafted plans plus the addr RFC. Law stays on the rose-tree plan. This file owns sequence, gates, and which child to open. Now is docs RFC then Pass 0 then stop. No package cuts until reconvene.
todos:
  - id: docs-rfc
    content: Write tla-module-rose-tree RFC (docs gate). Banner old TLA RFC §0 naming/barrels.
    status: completed
  - id: pass0-repair
    content: Pass 0a — repair corruption / holonet / AVA / stx-React so tmnl semantic tsc can run
    status: pending
  - id: pass0-archive
    content: Pass 0b — git mv confirmed-dead into packages/tmnl/.archive/ (incl. screensaver, bar, components/shell, minibuffer/v1, PersistentOverlays)
    status: pending
  - id: pass0-testbeds
    content: Pass 0c — gallery → src/.testbeds/; unify CARDS/router/WindowRoute/registry; keep lift-gate testbeds live
    status: pending
  - id: reconvene
    content: Stop. Reconvene. Do not start Pass 1 / cluster cuts from this plan unprompted.
    status: pending
isProject: true
---

# TMNL execution metaplan

Twenty-one Cursor plans plus one addr RFC. They overlap, contradict, and some still describe an older lift order. This file is the **sequence**. Child plans are **how**. The rose tree is **naming law**.

If two plans disagree, this file wins on order. [TLA module rose tree](cursor-plan://plan/tla_module_rose_tree_a8c41f02.plan.md) wins on names and barrels. [rfc-addr-algebra.md](/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/packages/tmnl/docs/architecture/rfc-addr-algebra.md) wins on locators.

## Job

Make the Tauri app work. Then lift live systems into rose-tree clusters. RN is out. No `@tmnl/<tla>` packages. One breaking window for legacy folds.

## Now vs later

**Now**

1. Durable TLA rose-tree RFC — **written:** [tla-module-rose-tree-rfc.md](/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/packages/tmnl/docs/architecture/tla-module-rose-tree-rfc.md)
2. Cleanup Pass 0 ([tmnl cleanup lift](cursor-plan://plan/tmnl_cleanup_lift_3a3ae41c.plan.md))
3. Stop. Reconvene.

**Not now.** Any `packages/<cluster>` cut. Addr implementation. Morph, shell, chrome lifts. Design Layout A reshape. Public root. Breaking-window folds.

## Gates

```text
docs RFC  →  Pass 0  →  reconvene  →  lifts
```

Pass 0 green means tmnl **project** `tsc` (not root references tsconfig), existing tmnl unit tests, Tauri boot to home cards plus one `.testbeds/` route.

Each later lift means that cluster's `typecheck` + `vitest run` + its lift-gate testbed still loads. One system per pass. Journal at `packages/<cluster>/.extraction-journal.md`. Bun. Stage explicit paths. Never `git add -A`.

## Post-reconvene order

Do not use the cleanup plan's mermaid (mrph then pnl, no shell, no addr). That drawing is stale.

| # | What | Open this | Notes |
|---|---|---|---|
| 1 | Design Layout A prototype | [vnt](cursor-plan://plan/vnt_design_system_404272ea.plan.md) · [exhibition](cursor-plan://plan/vnt_exhibition_lab_55c5593d.plan.md) | `packages/design` already scaffolded. `.js` specifiers, source exports, delete design Vite aliases, walk-the-tree, StyleX. Proves the tree. |
| 2 | Shake + Fast Refresh | rose-tree CI / FR todos | Rollup marker in CI. Leaf paths for React. |
| 3 | Public root scaffold | [tmnl public root](cursor-plan://plan/tmnl_public_root_c3d04422.plan.md) | Unscoped `tmnl`. Re-export clusters that exist. Grows. |
| 4 | Addr substrate | [rfc-addr-algebra.md](/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/packages/tmnl/docs/architecture/rfc-addr-algebra.md) | `@tmnl/addr` / `Addr`. First schemes `doc://` `pnl://` `wnd://`. Before chrome/shell need handles. No rewrite plan. RFC is SoT. |
| 5 | Shell | [shell cluster](cursor-plan://plan/shell_cluster_shl_wnd_a1f8c022.plan.md) | `shll` then `wnd`. Chrome consumes `Wnd`. Not getbyshell. |
| 6 | Morph | [mrph](cursor-plan://plan/mrph_morph_substrate_055a30d0.plan.md) | Never `@tmnl/mrph`. Then `crd` leaves (no plan yet). |
| 7 | Chrome | [pnl](cursor-plan://plan/pnl_floating_rewrite_4c958e4e.plan.md) · [ovl](cursor-plan://plan/ovl_overlays_rewrite_c9d60088.plan.md) · [hud](cursor-plan://plan/hud_viewport_host_d0e71199.plan.md) | In-viewport. Consumes `Wnd` for pop-out. Never `slt`. |
| 8 | State via qry | [state cluster qry](cursor-plan://plan/state_cluster_qry_d4e15533.plan.md) | Creates `@tmnl/state`. Not `@tmnl/qry`. stx adoption debt can run parallel (53 importers onto `packages/stx`). |
| 9 | One breaking window | [transport](cursor-plan://plan/transport_fold_e5f26644.plan.md) · state fold · [protocol](cursor-plan://plan/protocol_cluster_pct_b8c59977.plan.md) | msh+lnk; stx+grd+num; pct. No compat re-export. Codemod. msh `export * as` can land in place earlier. |
| 10 | Domain last | [domain](cursor-plan://plan/domain_cluster_dmn_f6a37755.plan.md) | dmn from iiot. iot first consumer. Instance-as-domain is addr, not dmn. |
| — | Runtime | [runtime](cursor-plan://plan/runtime_cluster_cog_a7b48866.plan.md) | Defer. cog ↛ rig. |

Shell internals after `shll`+`wnd` exist. [cmd](cursor-plan://plan/cmd_command_spine_d4e30033.plan.md) then [spl](cursor-plan://plan/spl_emacs_panes_e5f40044.plan.md). [sidebar](cursor-plan://plan/shll_sidebar_seam_f6a50055.plan.md) rides `shll`. Letter `cmd` vs `mbf` is still open. Does not block Pass 0 (`minibuffer/v1` dies there).

## Pass 0 (the only code until reconvene)

Owner. [tmnl cleanup lift](cursor-plan://plan/tmnl_cleanup_lift_3a3ae41c.plan.md)

- **0a.** Repair corruption, holonet imports, AVA bootstrap, stx duplicate-React.
- **0b.** `git mv` confirmed-dead into `.archive/`. Include `screensaver`, `bar`, `components/shell`, `minibuffer/v1`, `PersistentOverlays.tsx`. Do **not** archive `Overlay.ts` or OverlayTestbed.
- **0c.** Gallery → `src/.testbeds/`. Unify App.tsx CARDS, router, WindowRoute, testbed registry. Keep MorphCardTestbed, EffectAtomTestbed, FermionTestbed, AutonomousEditorPanel, conductor shadow chat as lift-gates.
- **0d.** Product tree is live mounts only.

Do not reshape design. Do not cut addr. Do not retarget `BufferMeta.uri`.

## Catalog (all 21 + RFC)

### Law / gates

| Artifact | Role |
|---|---|
| [TLA module rose tree](cursor-plan://plan/tla_module_rose_tree_a8c41f02.plan.md) | Naming, Layout A, cluster register |
| [TLA module RFC](cursor-plan://plan/tla_module_rfc_b1e90211.plan.md) | Durable doc. **Written:** [tla-module-rose-tree-rfc.md](/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/packages/tmnl/docs/architecture/tla-module-rose-tree-rfc.md) |
| [rfc-addr-algebra.md](/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/packages/tmnl/docs/architecture/rfc-addr-algebra.md) | Addr grammar. Written. Lift after reconvene. |
| [tmnl cleanup lift](cursor-plan://plan/tmnl_cleanup_lift_3a3ae41c.plan.md) | Pass 0 only. Ignore its Pass 1 mermaid and `@tmnl/qry` leftover. |
| **This metaplan** | Sequence |

### Design / root

| Plan | Status |
|---|---|
| [vnt](cursor-plan://plan/vnt_design_system_404272ea.plan.md) | After reconvene. First lift that proves Layout A. |
| [vnt exhibition](cursor-plan://plan/vnt_exhibition_lab_55c5593d.plan.md) | With vnt |
| [tmnl public root](cursor-plan://plan/tmnl_public_root_c3d04422.plan.md) | After design prototype |

### Shell (coordinator + pieces)

| Plan | Status |
|---|---|
| [shell cluster](cursor-plan://plan/shell_cluster_shl_wnd_a1f8c022.plan.md) | Coordinator |
| [shll](cursor-plan://plan/shll_keystone_frame_b2c10011.plan.md) | First shell lift |
| [wnd](cursor-plan://plan/wnd_os_windows_c3d20022.plan.md) | Greenfield. Archive tauri-windows. |
| [cmd](cursor-plan://plan/cmd_command_spine_d4e30033.plan.md) | Tentative letter |
| [spl](cursor-plan://plan/spl_emacs_panes_e5f40044.plan.md) | Emacs panes. Not wnd. |
| [sidebar seam](cursor-plan://plan/shll_sidebar_seam_f6a50055.plan.md) | Not a TLA yet |

### Chrome / morph

| Plan | Status |
|---|---|
| [mrph](cursor-plan://plan/mrph_morph_substrate_055a30d0.plan.md) | Morph keystone |
| [pnl](cursor-plan://plan/pnl_floating_rewrite_4c958e4e.plan.md) | Niri. One registry. |
| [ovl](cursor-plan://plan/ovl_overlays_rewrite_c9d60088.plan.md) | Overlay class + OverlayTestbed |
| [hud](cursor-plan://plan/hud_viewport_host_d0e71199.plan.md) | ex-GlobalSlot. Never `slt`. |

### Later folds

| Plan | Status |
|---|---|
| [state qry](cursor-plan://plan/state_cluster_qry_d4e15533.plan.md) | First TLA in `@tmnl/state` |
| [transport](cursor-plan://plan/transport_fold_e5f26644.plan.md) | Breaking window |
| [protocol](cursor-plan://plan/protocol_cluster_pct_b8c59977.plan.md) | Breaking window. prt stays RED. |
| [domain](cursor-plan://plan/domain_cluster_dmn_f6a37755.plan.md) | After the tree is proven |
| [runtime](cursor-plan://plan/runtime_cluster_cog_a7b48866.plan.md) | Stub. Defer. |

### No plan yet (do not invent packages)

`crd` `srf` `edt` `vbl` `flo` `geo` `ams` `sio`. Transfer `txf` pending. Never `slt`.

## Conflicts this file settles

| Stale | Use instead |
|---|---|
| Cleanup mermaid. mrph → qry → stx, pnl off to the side | Post-reconvene table above |
| Cleanup todo `Extract src/lib/search → @tmnl/qry` | `@tmnl/state` / `qry` |
| Cleanup overview still selling Pass 1 lifts as this plan | Pass 0 then stop |
| Rose-tree "cut morph now" wording vs gated execution | Cuts after reconvene |
| Addr as shell leaf | `@tmnl/addr` substrate |
| Overlay.ts dead / extract System A only | ovl plan. Overlay class is core |
| `ydoc://` as identity | `doc://`. YDoc is impl |
| OS-registering `doc`/`pnl`/`wnd` | One future desktop wrap. In-app format already law |

## Still open (do not block Pass 0)

- `cmd` vs `mbf` letter
- ADDR-1 OS deep-link spelling
- ADDR-3 pty/widget as doc kinds vs later schemes
- `txf` admission
- Overlay EventLog replay (OV-H9) finish vs drop

## Hard rules

- Never mint `@tmnl/<tla>`.
- Never `slt`.
- Shell ↛ chrome. Chrome → `Wnd` is fine.
- Parse ≠ authorize. Addr handlers never re-split strings.
- RFCs are notes we wrote. This metaplan can be rewritten the same way.

## Backlinks

**Law:** [TLA module rose tree](cursor-plan://plan/tla_module_rose_tree_a8c41f02.plan.md)  
**Docs gate:** [TLA module RFC](cursor-plan://plan/tla_module_rfc_b1e90211.plan.md)  
**Code gate:** [tmnl cleanup lift](cursor-plan://plan/tmnl_cleanup_lift_3a3ae41c.plan.md)  
**Addr:** [rfc-addr-algebra.md](/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/packages/tmnl/docs/architecture/rfc-addr-algebra.md)
