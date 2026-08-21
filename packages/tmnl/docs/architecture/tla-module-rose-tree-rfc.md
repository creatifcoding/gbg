# RFC — TLA module rose tree

**Status:** Law · **Date:** 2026-08-20 · **Gate:** docs (this file) → Pass 0 → reconvene → cluster lifts

A TLA is an Effect-flat ESM **module**, not an npm package. Clusters are the npm names. The public product API is unscoped `tmnl`.

**Supersedes:** [tla-package-suites-rfc.md](./tla-package-suites-rfc.md) §0 items 1, 1a, 5 (naming, cluster barrels glued on, frozen `Msh` aggregate) and §7 industrial sequencing (geo-first greenfield `dmn`).

**Does not touch:** Kind A / Kind B (§0.3), Context.Service / `static layer` / `layerTest`, MemoMap, Effect pin doctrine ([effect-v4-layer-doctrine.md](./effect-v4-layer-doctrine.md)).

**Sequence:** [TMNL execution metaplan](cursor-plan://plan/tmnl_execution_metaplan_c9d81100.plan.md) (order). Naming law also lives on [TLA module rose tree](cursor-plan://plan/tla_module_rose_tree_a8c41f02.plan.md). If order disagrees, the metaplan wins. If names disagree, this RFC wins.

**Addr:** `@tmnl/addr` is a substrate cluster. Locator law belongs in `rfc-addr-algebra.md` (same directory). That file is **not in the tree as of this RFC** — restore or rewrite it before the addr lift. Do not relitigate locators here. First identity schemes remain `doc://`, `pnl://`, `wnd://`. YDoc is impl. Instance-as-domain is addr, not `dmn`.

---

## 1. What a TLA is

Path ≅ namespace. Parents expose children only as live namespaces.

```ts
import { Design } from 'tmnl'                          // public root
import { Vnt } from '@tmnl/design'                     // cluster → TLA (Pascal export)
import * as Vnt from '@tmnl/design/vnt'                // same module, lowercase path
import { Button } from '@tmnl/design/vnt/ui/Button'    // blessed for React (leaf)
```

- Path TLA is lowercase (`vnt`, `msh`, `shll`).
- Export is Pascal (`Vnt`, `Msh`, `Shll`).
- Seam files are Pascal (`Button.ts`, `Connection.ts`).
- `.js` specifiers in every new cluster file.
- Ban `export * from` on cluster indexes.
- Frozen `export const Msh = {…}` is not public API. Use `export * as Msh from './Msh.js'`.
- Never mint `@tmnl/<tla>`. The cluster is the package.

Nx: **one project per cluster**. TLAs are source roots / tags, not Nx projects.

---

## 2. Cluster register

| Cluster npm | Dir | TLAs | Notes |
|---|---|---|---|
| `@tmnl/addr` | `packages/addr` | `addr` | Substrate. 4-letter keystone. Resource algebra. Consumed by nearly everything. Not a shell leaf. Not `pct`. Cluster name *is* the TLA. |
| `@tmnl/design` | `packages/design` | `vnt` | Exists. First post-reconvene prototype (Layout A). |
| `@tmnl/morph` | `packages/morph` | `mrph`, later `crd`, `srf`, `edt` | Never `@tmnl/mrph`. |
| `@tmnl/shell` | `packages/shell` | `shll` (keystone), `wnd`, later `cmd` / `spl` | Not getbyshell. Speaks `wnd://`. `cmd` vs `mbf` letter still open. |
| `@tmnl/chrome` | `packages/chrome` | `pnl`, `ovl`, `hud` | In-viewport. Consumes `@tmnl/shell/wnd` for pop-out. Speaks `pnl://`. Never `slt`. |
| `@tmnl/transport` | `packages/transport` | `msh`, `lnk` | One breaking fold of existing pkgs. |
| `@tmnl/state` | `packages/state` | `stx`, `qry`, `grd`, `vbl`, `flo`, `num` | Not `@tmnl/qry`. `doc://` consumers. |
| `@tmnl/runtime` | `packages/runtime` | `cog`, `rig` | Defer. |
| `@tmnl/protocol` | `packages/protocol` | `pct`, `prt` | `pct:` may supply federated `<instance>`; does not own locator grammar. |
| `@tmnl/domain` | `packages/domain` | `dmn` (core), `iot` (first consumer), later `geo` / `ams` / `sio` | Invert old §7: lift `dmn` from iiot. Business verticals only. |

No plan yet (do not invent packages): `crd` `srf` `edt` `vbl` `flo` `geo` `ams` `sio`. Transfer `txf` pending. Never `slt`.

Tags: `@tmnl/<cluster>/<tla>/<seam>/<Name>` — e.g. `@tmnl/transport/msh/nats/Connection`.

---

## 3. Layout A

No `vnt.ts` sitting next to a `vnt/` directory of the same public name. Effect-flat:

```
packages/design/src/
  index.ts                 export * as Vnt from './vnt.js'
  vnt.ts                   TLA file; export * as ui from './internal/vnt/ui.js'
  internal/vnt/
    ui.ts                  export * as Button from './ui/Button.js'
    ui/Button.ts
```

```json
{
  "exports": {
    ".": "./src/index.ts",
    "./*": "./src/*.ts",
    "./vnt/*": "./src/internal/vnt/*",
    "./internal/*": null
  }
}
```

`@tmnl/design/vnt` → `src/vnt.ts`. `@tmnl/design/vnt/ui/Button` → `src/internal/vnt/ui/Button.ts`.

**Walk-the-tree** emits the stacked `exports` map from `src/`. Not Effect `build-utils` / `prepare-v3`. Hand-edit until a cluster has more than a handful of seams.

In-repo exports point at **source**. Publish pack-to-dist. `annotate-pure-calls` is **publish-time only** — Vite bundles source; babel annotate never runs on the Tauri graph. App shake is Rollup `smallest` + `export * as`.

Delete `@tmnl/*` Vite aliases that point at index files. They kill subpaths. Legacy dist-export packages keep a temporary alias until flipped to source exports.

Bless both namespace and subpath. **React/components standardize on leaf paths.** Kind A stays `Msh.Connection` / `yield* Msh.PubSub`.

---

## 4. Public root

`import { Design } from '@tmnl'` is not publishable. Decision: unscoped **`tmnl`**. Dir `packages/std` or `packages/tmnl-std`, `"name": "tmnl"`.

```ts
export * as Addr from '@tmnl/addr'
export * as Design from '@tmnl/design'
export * as Morph from '@tmnl/morph'
export * as Chrome from '@tmnl/chrome'
export * as Shell from '@tmnl/shell'
```

Root depends on clusters it re-exports. Grows as clusters exist. `@gbg/tmnl` stays the Tauri app.

---

## 5. One breaking window

When legacy packages fold, they fold once. No `@tmnl/msh` re-export after transport is cut. Codemod.

Same window:

- `msh` + `lnk` → `@tmnl/transport`
- `stx` + `@tmnl/datagrid` + `@tmnl/mathkernel` → `@tmnl/state` (`Stx` / `Grd` / `Num`)
- `pct` → `@tmnl/protocol`

Until that window, existing packages stay. **New** TLAs are never minted as `@tmnl/<tla>`.

---

## 6. Domain sequencing (replaces old §7 order)

`dmn` is lifted **from** iiot into `@tmnl/domain`. **`iot` is the first consumer**, not geo after a greenfield kit. Instance-as-domain is `@tmnl/addr`.

---

## 7. Shell vs chrome

Shell hosts chrome. Chrome may call `@tmnl/shell/wnd`. Overlays are `ovl` (Overlay class + PortHub + LIFO). HUD is the viewport portal (ex-GlobalSlot). Never `slt`.

eDEX-shaped HUD rails (clock/sysinfo columns, sequenced boot) are a `shll` preset + `hud` slots + `vnt` motion. They are not a fourth panel stack.

---

## 8. Hard rules

- Never mint `@tmnl/<tla>`.
- Never `slt`.
- Shell ↛ chrome. Chrome → `Wnd` is fine.
- Parse ≠ authorize. Addr handlers never re-split strings.
- RFCs are notes. The metaplan can rewrite sequence the same way.

## 9. Gate

Nothing after this file (cleanup Pass 0, then reconvene, then lifts) starts until this RFC exists. It exists.

Pass 0 is [tmnl cleanup lift](cursor-plan://plan/tmnl_cleanup_lift_3a3ae41c.plan.md): repair, archive dead, gallery → `src/.testbeds/`. Do not reshape design. Do not cut addr. Do not retarget `BufferMeta.uri`.

Post-reconvene order is the metaplan table, not the cleanup plan’s mermaid.
