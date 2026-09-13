---
name: wnd os windows
overview: Tentative. Greenfield TLA `wnd` under `@tmnl/shell` — OS webview windows. Archive broken lib/tauri-windows. openSurface API; pool stays Rust. pnl and testbeds consume. Never create_testbed_window. Never `@tmnl/wnd`.
todos:
  - id: contract
    content: Author Wnd.openSurface / focus / close / list + events. One surface registry (kill WindowRoute TESTBED_COMPONENTS parallel map)
    status: pending
  - id: rust-thin
    content: Thin src-tauri window commands to match contract; steal pool ideas, drop testbed-shaped API
    status: pending
  - id: ts-service
    content: Kind A Effect facade + atoms; Layout A under packages/shell/wnd
    status: pending
  - id: archive-old
    content: Archive lib/tauri-windows; re-point minibuffer/nu-cmdk open paths
    status: pending
  - id: chrome-consume
    content: pnl pop-out → Wnd.openSurface (coordinate with pnl plan)
    status: pending
isProject: false
---

# `@tmnl/shell` / `Wnd` — OS windows (tentative)

**Naming SoT:** [tla-module-rose-tree-rfc.md](/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/packages/tmnl/docs/architecture/tla-module-rose-tree-rfc.md). Sequence: [TMNL execution metaplan](cursor-plan://plan/tmnl_execution_metaplan_c9d81100.plan.md).

Parent: [shell cluster](cursor-plan://plan/shell_cluster_shl_wnd_a1f8c022.plan.md). **From scratch.** Current tauri-windows does not work as product.

```
Wnd.openSurface({ id, url, title?, singleton? })
      │
      ▼
  pool claim → navigate → show   (Rust)
```

Not testbed-shaped. Testbeds are one consumer via a single registry (testbed registry ∪ WindowRoute map → one).

**Not this plan:** Emacs `lib/windows` panes (`spl`). Scale sync hooks into shll/scale + wnd events.

## Backlinks

**Parent:** [shell cluster](cursor-plan://plan/shell_cluster_shl_wnd_a1f8c022.plan.md)  
**Siblings:** [shll](cursor-plan://plan/shll_keystone_frame_b2c10011.plan.md) · [cmd](cursor-plan://plan/cmd_command_spine_d4e30033.plan.md) · [spl](cursor-plan://plan/spl_emacs_panes_e5f40044.plan.md) · [sidebar seam](cursor-plan://plan/shll_sidebar_seam_f6a50055.plan.md)  
**Law / gate:** [rose tree](cursor-plan://plan/tla_module_rose_tree_a8c41f02.plan.md) · [cleanup](cursor-plan://plan/tmnl_cleanup_lift_3a3ae41c.plan.md)  
**Identity:** `wnd://` — [rfc-addr-algebra.md](/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/packages/tmnl/docs/architecture/rfc-addr-algebra.md) (consume Addr; do not implement it)  
**Consumers:** [pnl](cursor-plan://plan/pnl_floating_rewrite_4c958e4e.plan.md) (pop-out) · testbeds / WindowRoute · [cmd](cursor-plan://plan/cmd_command_spine_d4e30033.plan.md) (open-surface commands)  
**Depends on:** [shll](cursor-plan://plan/shll_keystone_frame_b2c10011.plan.md) (WindowLayout) — or parallel if layout already exists

Depends on: shll frame mount (or parallel if WindowLayout exists). After reconvene. pnl may stub pop-out until wnd lands.
