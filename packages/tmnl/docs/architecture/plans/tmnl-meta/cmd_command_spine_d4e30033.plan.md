---
name: cmd command spine
overview: Tentative. Map U5 — commands↔hotkeys pair, nu-cmdk spoke, minibuffer/v2 shared, indices (Consult). Homed under `@tmnl/shell` as TLA `cmd` (letter pending ratification). Do not block shll frame. minibuffer/v1 Pass 0 delete.
todos:
  - id: letter
    content: Ratify TLA letter (proposal cmd). Alternatives mbf (minibuffer-first) if cmd collides with mental model
    status: pending
  - id: topology
    content: Keep commands↔hotkeys as pair; nu-cmdk as spoke; minibuffer/v2 shared host; indices as source composition
    status: pending
  - id: docs-mv
    content: git mv ~70 misfiled commands/docs → nu-cmdk/docs (hygiene, can precede lift)
    status: pending
  - id: lift
    content: Lift into @tmnl/shell/cmd (or seams under shll if too thin for a letter). HeaderContent consumes Cmd
    status: pending
isProject: false
---

# `@tmnl/shell` / `Cmd` — command spine (tentative)

**Naming SoT:** [tla-module-rose-tree-rfc.md](/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/packages/tmnl/docs/architecture/tla-module-rose-tree-rfc.md). Sequence: [TMNL execution metaplan](cursor-plan://plan/tmnl_execution_metaplan_c9d81100.plan.md).

Map [U5](/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/packages/tmnl/docs/architecture/latent-systems-map.md): Emacs command layer.

```
commands ↔ hotkeys     bidirectional pair
     ▲
nu-cmdk                one-way spoke (own runtime; 6 tests green)
     │
minibuffer/v2          shared host (113/113 green)
indices                Consult multi-source (not filesystem)
```

**Why shell, not chrome:** HeaderContent / minibuffer / which-key are shell input, not viewport chrome. Chrome (hud) may render a command-palette Host that *calls* Cmd.

**Pass 0:** delete `minibuffer/v1`. Do not wait on this rewrite.

**Letter:** proposal `cmd`. Open if you want `mbf` (minibuffer as the noun) instead.

## Backlinks

**Parent:** [shell cluster](cursor-plan://plan/shell_cluster_shl_wnd_a1f8c022.plan.md)  
**Siblings:** [shll](cursor-plan://plan/shll_keystone_frame_b2c10011.plan.md) · [wnd](cursor-plan://plan/wnd_os_windows_c3d20022.plan.md) · [spl](cursor-plan://plan/spl_emacs_panes_e5f40044.plan.md) · [sidebar seam](cursor-plan://plan/shll_sidebar_seam_f6a50055.plan.md)  
**Law / gate:** [rose tree](cursor-plan://plan/tla_module_rose_tree_a8c41f02.plan.md) · [cleanup](cursor-plan://plan/tmnl_cleanup_lift_3a3ae41c.plan.md) (minibuffer/v1 Pass 0)  
**Consumes:** [shll](cursor-plan://plan/shll_keystone_frame_b2c10011.plan.md) (HeaderContent host)  
**Consumed by:** [hud](cursor-plan://plan/hud_viewport_host_d0e71199.plan.md) (command-palette Host may call Cmd) · [wnd](cursor-plan://plan/wnd_os_windows_c3d20022.plan.md) (open-surface commands)

Depends on: shll frame (consumer). After reconvene; after or parallel with shll lift. Does not block wnd.
