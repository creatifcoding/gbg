---
name: shll keystone frame
overview: Tentative. Lift the composition frame into `@tmnl/shell` / `Shll` (4-letter keystone). First slice = lib/shell + lib/scale. Census decides what else folds as seams vs sibling TLAs. Never `@tmnl/shll`.
todos:
  - id: cut-shell-pkg
    content: Cut packages/shell if not already; export * as Shll from './shll.js'; Layout A
    status: pending
  - id: lift-frame
    content: Lift AppShell / HeaderContent / WindowLayout / WindowHeaderContent → internal/shll
    status: pending
  - id: lift-scale
    content: Lift ScaleProvider + scale atoms into shll/scale seam (cross-window zoom rides wnd later)
    status: pending
  - id: mount-main
    content: main.tsx mounts Shll; child windows use Shll.WindowLayout
    status: pending
isProject: false
---

# `@tmnl/shell` / `Shll` — composition frame (tentative)

**Naming SoT:** [tla-module-rose-tree-rfc.md](/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/packages/tmnl/docs/architecture/tla-module-rose-tree-rfc.md). Sequence: [TMNL execution metaplan](cursor-plan://plan/tmnl_execution_metaplan_c9d81100.plan.md).

Parent: [shell cluster](cursor-plan://plan/shell_cluster_shl_wnd_a1f8c022.plan.md). This is the keystone lift only.

**In v1:** `lib/shell` + `lib/scale`. That is what `main.tsx` wraps the world in today.

**Not in v1 (sibling plans):** `wnd`, command spine (`cmd`), Emacs panes (`spl`), sidebar (seam or later).

```
Shll
  scale/     ScaleProvider
  ui/        AppShell, Header, Sidebar slot, Workspace, WindowLayout
```

HeaderContent today wires commands/hotkeys — keep the wire, do not drag U5 into this pass. Command spine re-homes under `cmd` later; Header stays a consumer.

Pass 0 runway: delete `components/shell`, archive PersistentOverlays (Header’s dead twin).

## Backlinks

**Parent:** [shell cluster](cursor-plan://plan/shell_cluster_shl_wnd_a1f8c022.plan.md)  
**Siblings:** [wnd](cursor-plan://plan/wnd_os_windows_c3d20022.plan.md) · [cmd](cursor-plan://plan/cmd_command_spine_d4e30033.plan.md) · [spl](cursor-plan://plan/spl_emacs_panes_e5f40044.plan.md) · [sidebar seam](cursor-plan://plan/shll_sidebar_seam_f6a50055.plan.md)  
**Law / gate:** [rose tree](cursor-plan://plan/tla_module_rose_tree_a8c41f02.plan.md) · [cleanup Pass 0](cursor-plan://plan/tmnl_cleanup_lift_3a3ae41c.plan.md)  
**Consumed by:** [pnl](cursor-plan://plan/pnl_floating_rewrite_4c958e4e.plan.md) / [ovl](cursor-plan://plan/ovl_overlays_rewrite_c9d60088.plan.md) / [hud](cursor-plan://plan/hud_viewport_host_d0e71199.plan.md) (mount inside Shll) · [cmd](cursor-plan://plan/cmd_command_spine_d4e30033.plan.md) (HeaderContent wire)

Depends on: rose-tree, Pass 0, reconvene. Blocks: honest composition root. Journal: `packages/shell/.extraction-journal.md`.
