---
name: shll sidebar seam
overview: Tentative. lib/sidebar is AppShell.Sidebar content — a shll seam (or chrome plugin), not its own TLA unless it earns a layer. Screensaver is mostly dead (Pass 0).
todos:
  - id: seat
    content: Decide sidebar = shll/ui/Sidebar seam vs chrome content plugin. Default shll seam (mounted only via AppShell.Sidebar)
    status: pending
  - id: lift
    content: Move with shll or immediately after; keep SidebarConfig API
    status: pending
  - id: screensaver
    content: Pass 0 archive unless a live mount is rediscovered
    status: pending
isProject: false
---

# Sidebar / screensaver under shell (tentative)

**Naming SoT:** [tla-module-rose-tree-rfc.md](/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/packages/tmnl/docs/architecture/tla-module-rose-tree-rfc.md). Sequence: [TMNL execution metaplan](cursor-plan://plan/tmnl_execution_metaplan_c9d81100.plan.md).

Not a TLA by default. `lib/sidebar` (14) mounts only as AppShell.Sidebar. Map called it an overlays content plugin historically — under the extract flip it is **shell chrome furniture**, not ovl.

Screensaver production mount died with PersistentOverlays → Pass 0.

If sidebar later grows a Layer/service graph, mint a letter then. Until then: `@tmnl/shell/shll/ui/Sidebar`.

## Backlinks

**Parent:** [shell cluster](cursor-plan://plan/shell_cluster_shl_wnd_a1f8c022.plan.md)  
**Host:** [shll keystone frame](cursor-plan://plan/shll_keystone_frame_b2c10011.plan.md)  
**Siblings:** [wnd](cursor-plan://plan/wnd_os_windows_c3d20022.plan.md) · [cmd](cursor-plan://plan/cmd_command_spine_d4e30033.plan.md) · [spl](cursor-plan://plan/spl_emacs_panes_e5f40044.plan.md)  
**Law / gate:** [rose tree](cursor-plan://plan/tla_module_rose_tree_a8c41f02.plan.md) · [cleanup](cursor-plan://plan/tmnl_cleanup_lift_3a3ae41c.plan.md) (screensaver/bar/`components/shell` Pass 0)  
**Not:** [ovl](cursor-plan://plan/ovl_overlays_rewrite_c9d60088.plan.md) / [hud](cursor-plan://plan/hud_viewport_host_d0e71199.plan.md) — sidebar is shell furniture, not overlay core
