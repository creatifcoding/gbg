---
name: spl emacs panes
overview: Tentative. Elevate lib/windows (Emacs C-x pane splits) under `@tmnl/shell` as TLA `spl`. Not OS windows (wnd). Not terminal PaneNode. Mounted today via WindowProvider in main.tsx.
todos:
  - id: disambiguate
    content: Document spl ≠ wnd ≠ terminal PaneNode ≠ pnl columns
    status: pending
  - id: lift
    content: Lift lib/windows → @tmnl/shell/spl; re-point WindowProvider mount
    status: pending
  - id: hotkeys
    content: C-x bindings stay with spl or delegate to cmd — decide at lift
    status: pending
isProject: false
---

# `@tmnl/shell` / `Spl` — Emacs panes (tentative)

**Naming SoT:** [tla-module-rose-tree-rfc.md](/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/packages/tmnl/docs/architecture/tla-module-rose-tree-rfc.md). Sequence: [TMNL execution metaplan](cursor-plan://plan/tmnl_execution_metaplan_c9d81100.plan.md).

In-webview split panes (`C-x 2/3/o/0/1`). Live, thin, load-bearing.

```
spl     recursive pane tree inside one webview
wnd     another OS webview
pnl     floating/Niri panels (chrome)
```

**Letter:** `spl` (split). Open to `pan` if you prefer — but `pn`/`pnl` already own “panel.”

## Backlinks

**Parent:** [shell cluster](cursor-plan://plan/shell_cluster_shl_wnd_a1f8c022.plan.md)  
**Siblings:** [shll](cursor-plan://plan/shll_keystone_frame_b2c10011.plan.md) · [wnd](cursor-plan://plan/wnd_os_windows_c3d20022.plan.md) · [cmd](cursor-plan://plan/cmd_command_spine_d4e30033.plan.md) · [sidebar seam](cursor-plan://plan/shll_sidebar_seam_f6a50055.plan.md)  
**Law / gate:** [rose tree](cursor-plan://plan/tla_module_rose_tree_a8c41f02.plan.md) · [cleanup](cursor-plan://plan/tmnl_cleanup_lift_3a3ae41c.plan.md)  
**Not:** [wnd](cursor-plan://plan/wnd_os_windows_c3d20022.plan.md) (OS webviews) · [pnl](cursor-plan://plan/pnl_floating_rewrite_4c958e4e.plan.md) (Niri panels)  
**Hotkeys:** stay with spl or delegate to [cmd](cursor-plan://plan/cmd_command_spine_d4e30033.plan.md) — decide at lift

Depends on: shll (host). After reconvene. Low urgency vs wnd/shll — works today; lift when shell cluster exists.
