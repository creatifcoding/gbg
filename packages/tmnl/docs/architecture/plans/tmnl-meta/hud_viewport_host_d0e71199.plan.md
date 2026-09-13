---
name: hud viewport host
overview: Admit TLA `hud` under `@tmnl/chrome` (`export * as Hud`). The viewport portal host — ex-GlobalSlot, no type switch. Opener attaches Host at open; Hud sorts by z and mounts `instance.Host`. Sibling of ovl (capability) and pnl (panels). Never `slt`. Never `@tmnl/hud`.
todos:
  - id: hud-host
    content: Lift GlobalSlot → packages/chrome hud as a portal target (sort by z, mount instance.Host). Kill the VisualOverlayType switch.
    status: pending
  - id: hud-attach
    content: useDrawer/useModal/useToast/useTopBar/useSidebar/useCommandPalette attach Host at open. top-bar hole closes because useTopBar brings a Host.
    status: pending
  - id: hud-mount
    content: main.tsx mounts Hud, not GlobalSlot. Archive unused PanelSlot unless a panel-scoped host is still wanted as Hud.Panel.
    status: pending
isProject: false
---

# `@tmnl/chrome` / `Hud` — viewport portal

**Naming SoT:** [tla-module-rose-tree-rfc.md](/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/packages/tmnl/docs/architecture/tla-module-rose-tree-rfc.md). Sequence: [TMNL execution metaplan](cursor-plan://plan/tmnl_execution_metaplan_c9d81100.plan.md).

Ratified 2026-08-13. `slt` was the obvious abbreviation and is rejected on taste. **`hud`** is the name.

Not a dispatcher. A hole in the viewport:

```
open({ Host, content, z })
Hud:
  position:fixed; inset:0; pointer-events:none
  sort by z
  <instance.Host />
```

An instance never changes type. GlobalSlot's `switch (type)` was re-deriving chrome on every paint (`top-bar` = silent `default: null`). Type, if it survives, is a z-tier default only.

## Split with ovl

| TLA | Owns |
|---|---|
| **`ovl`** | Overlay class, PortHub, LIFO, OverlayTestbed |
| **`hud`** | The portal host. `Overlay.render` / `instance.Host` paints here |
| **`pnl`** | Floating panels / Niri |

Hud does not own Overlay. Ovl does not own the viewport hole.

## Package shape

- `@tmnl/chrome` — `export * as Hud from './hud.js'` (alongside `Pnl`, `Ovl`)
- Layout A: `hud.ts` + `internal/hud/`
- Leaf: `@tmnl/chrome/hud/Host` (or the root component is `Hud` itself)
- Tags `@tmnl/chrome/hud/…`
- **No** `@tmnl/hud`. **No** `slt`.

`main.tsx` today: `VisualOverlayProvider` + `GlobalSlot`. Becomes Hud mount. VisualOverlayProvider either folds into ovl or dies once Overlay.`render` is the attachment.

## Coupling

- After RFC + cleanup Pass 0 + reconvene.
- Parallel with ovl/pnl. Whoever cuts `packages/chrome` first owns the barrel.
- Transfer v3 receivers embed; drag ghost is Overlay.render into Hud — not a fourth chrome TLA.

## Backlinks

**Law:** [rose tree](cursor-plan://plan/tla_module_rose_tree_a8c41f02.plan.md) · [RFC](cursor-plan://plan/tla_module_rfc_b1e90211.plan.md)  
**Gate:** [cleanup](cursor-plan://plan/tmnl_cleanup_lift_3a3ae41c.plan.md)  
**Chrome siblings:** [pnl](cursor-plan://plan/pnl_floating_rewrite_4c958e4e.plan.md) · [ovl](cursor-plan://plan/ovl_overlays_rewrite_c9d60088.plan.md)  
**Shell (host):** [shell cluster](cursor-plan://plan/shell_cluster_shl_wnd_a1f8c022.plan.md) · [shll](cursor-plan://plan/shll_keystone_frame_b2c10011.plan.md)  
**May call:** [cmd](cursor-plan://plan/cmd_command_spine_d4e30033.plan.md) (palette) · [ovl](cursor-plan://plan/ovl_overlays_rewrite_c9d60088.plan.md) (`Overlay.render` → Hud)
