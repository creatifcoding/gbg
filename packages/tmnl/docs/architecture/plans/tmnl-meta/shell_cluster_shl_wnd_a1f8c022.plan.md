---
name: shell cluster shll wnd
overview: Parent coordinator for `@tmnl/shell`. Keystone `shll` (4-letter, latent). Members and seams get sibling plans. Chrome consumes Wnd. Never getbyshell. Never `@tmnl/shll`.
todos:
  - id: cut-shell
    content: Cut packages/shell barrel (Shll + Wnd exports) when first sibling lifts
    status: pending
  - id: order
    content: "After reconvene order: shll frame → wnd (or parallel) → cmd → spl; sidebar rides shll"
    status: pending
isProject: false
---

# `@tmnl/shell` — cluster coordinator

**Naming SoT:** [tla-module-rose-tree-rfc.md](/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/packages/tmnl/docs/architecture/tla-module-rose-tree-rfc.md). Sequence: [TMNL execution metaplan](cursor-plan://plan/tmnl_execution_metaplan_c9d81100.plan.md).

```
@tmnl/shell
  shll   keystone (4-letter, like mrph)
  wnd    OS webviews (greenfield)
  cmd    command spine (tentative letter)
  spl    Emacs panes (tentative)
  …      sidebar = shll seam unless it earns a letter
```

## Sibling plans (piece by piece)

| Plan | Piece | Status |
|---|---|---|
| [shll keystone frame](cursor-plan://plan/shll_keystone_frame_b2c10011.plan.md) | `lib/shell` + `lib/scale` | tentative — first lift |
| [wnd os windows](cursor-plan://plan/wnd_os_windows_c3d20022.plan.md) | OS webviews; archive tauri-windows | tentative — greenfield |
| [cmd command spine](cursor-plan://plan/cmd_command_spine_d4e30033.plan.md) | commands/hotkeys/nu-cmdk/minibuffer/indices (U5) | tentative — letter open |
| [spl emacs panes](cursor-plan://plan/spl_emacs_panes_e5f40044.plan.md) | `lib/windows` C-x splits | tentative |
| [shll sidebar seam](cursor-plan://plan/shll_sidebar_seam_f6a50055.plan.md) | sidebar (± screensaver Pass 0) | tentative — not a TLA yet |

## Latent map (short)

| Dir | Goes to |
|---|---|
| `shell`, `scale` | **shll** |
| `tauri-windows` | **archive → wnd** |
| `windows` | **spl** |
| `hotkeys`, `commands`, `nu-cmdk`, `minibuffer`, `indices` | **cmd** |
| `sidebar` | **shll seam** |
| `screensaver`, `bar`, `components/shell` | **Pass 0** |
| `getbyshell` | **not this cluster** |

## Rules

- Shell ↛ chrome. Chrome → shell (`Wnd`) ok.
- `shll` before chrome for composition root.
- Do not block shll frame on finishing cmd.
- pnl pop-out waits on wnd (or stubs).

## Backlinks

**Sequence:** [TMNL execution metaplan](cursor-plan://plan/tmnl_execution_metaplan_c9d81100.plan.md)  
**Law:** [TLA module rose tree](cursor-plan://plan/tla_module_rose_tree_a8c41f02.plan.md) · [TLA module RFC](cursor-plan://plan/tla_module_rfc_b1e90211.plan.md)  
**Gate:** [tmnl cleanup lift](cursor-plan://plan/tmnl_cleanup_lift_3a3ae41c.plan.md) (Pass 0)  
**Wnd identity:** `wnd://` — [rfc-addr-algebra.md](/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/packages/tmnl/docs/architecture/rfc-addr-algebra.md) (Addr substrate; shell does not own the grammar)  
**Children:**
- [shll keystone frame](cursor-plan://plan/shll_keystone_frame_b2c10011.plan.md)
- [wnd os windows](cursor-plan://plan/wnd_os_windows_c3d20022.plan.md)
- [cmd command spine](cursor-plan://plan/cmd_command_spine_d4e30033.plan.md)
- [spl emacs panes](cursor-plan://plan/spl_emacs_panes_e5f40044.plan.md)
- [shll sidebar seam](cursor-plan://plan/shll_sidebar_seam_f6a50055.plan.md)

**Chrome (consumes shell):** [pnl](cursor-plan://plan/pnl_floating_rewrite_4c958e4e.plan.md) · [ovl](cursor-plan://plan/ovl_overlays_rewrite_c9d60088.plan.md) · [hud](cursor-plan://plan/hud_viewport_host_d0e71199.plan.md)  
**Public root:** [tmnl public root](cursor-plan://plan/tmnl_public_root_c3d04422.plan.md)

After RFC + Pass 0 + reconvene.
