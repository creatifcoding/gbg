# TMNL `src/lib` System Map (Latest Snapshot)

_Date: 2026-02-13 (generated from current repo import graph)_

## Executive Summary

`src/lib` currently has **84 modules** and **130 local `@/lib/*` dependency edges**.
The module graph is still strongly feature-heavy with **29 cycles**.
The project will be stabilized by targeting a **hybrid strategy**:
- prefer acyclic structure for all new work,
- preserve existing cycles in legacy zones behind documented adapter seams,
- use contracts + migration notes to prevent boundary erosion.

This document is the baseline for the `primitives -> stx -> overlays` + interactive rectification wave.

---

## Dependency Topology Snapshot

### Import Graph (all `@/lib/*` imports)
- Source file set: all `src/lib/**/*.ts` and `src/lib/**/*.tsx`
- Local module nodes: first path segment after `@/lib/` (e.g., `@/lib/overlays/...` → `overlays`)
- Edges are transitive file-level imports collapsed per pair.

- **Modules:** 84
- **Edges:** 130
- **Cycles:** 29

---

## Primitive / Order Classification (Current Snapshot)

### Primitive-like modules (no local `@/lib/*` dependencies)

```text
fui, blocks, debug, axiom, motion, foldable-panel, search, panels,
capabilities, stx, scale, charting, variables, theia, harness, pty,
agents, context, instrumentation, hypothesis-lab, polyfills, traits,
animation, session, editor-ai, ecs, fermion, canvas, nats, actors, mcp,
bfo, tmnl-ui, ai, rag, adr-review
```

- **Count:** 36
- Note: `stx` is intentionally foundational here.

### First-order modules (dependencies ⊆ primitives)

```text
kori, transfer, eisenhower, drag, ams, slider, selection,
telegram, data-manager, chat-shell
```

- **Count:** 10

### Second-order modules (dependencies ⊆ primitives + first-order)

```text
rvn, connection-ports
```

- **Count:** 2

### Complex (requires broader graph / cycle-aware treatment)

**Count:** 36

---

## Top-degree Modules (Global)

### Highest outbound

| Module | Out-degree | In-degree | Direct Dependencies |
|---|---:|---:|---|
| `editor` | 12 | 3 | ava, charts, connection-ports, data-grid, dataplane, file-browser, foldable-panel, hotkeys, kori, layout, minibuffer, nats |
| `terminal` | 10 | 4 | ai-core, commands, editor, floating, hotkeys, genifer, mcp, overlays, primitives, tmnl-ui |
| `commands` | 7 | 3 | hotkeys, minibuffer, overlays, screensaver, search, tauri-windows, terminal |
| `geoint` | 7 | 2 | durable-streams, ecs, floating, hotkeys, kori, overlays, streams |
| `overlays` | 7 | 13 | cursor, floating, hotkeys, minibuffer, screensaver, sidebar, terminal |
| `genifer` | 6 | 5 | charts, foldable-panel, geoint, layout, morph-card, rvn |
| `morph-card` | 6 | 2 | animation, connection-ports, genifer, overlays, rvn, tmnl-ui |
| `cursor` | 5 | 1 | ai-core, charts, durable-streams, genifer, morph-card |
| `hotkeys` | 4 | 7 | commands, minibuffer, primitives, tauri-windows |
| `dataplane` | 2 | 2 | editor, overlays |

---

## Interactive-focused Subgraph

This is the cluster we treat as first rectification wave.

```text
primitives → terminal → overlays → hotkeys → minibuffer → commands → terminal
primitives   ↘         ↘ cursor → charts → dataplane ↘ editor → data-grid ↘ drawer → floating
hotkeys      → screensaver → overlays        ↑                                  │
        tauri-windows ↔ commands                              data-grid → table-service → data-grid
```

### Focus module adjacency (direct deps)

- `primitives` → `overlays`
- `stx` → *(none)*
- `overlays` → `cursor`, `floating`, `hotkeys`, `minibuffer`, `screensaver`, `sidebar`, `terminal`
- `hotkeys` → `commands`, `minibuffer`, `primitives`, `tauri-windows`
- `minibuffer` → `commands`, `hotkeys`, `overlays`
- `commands` → `hotkeys`, `minibuffer`, `overlays`, `screensaver`, `search`, `tauri-windows`, `terminal`
- `terminal` → `commands`, `hotkeys`, `floating`, `overlays`, `primitives`, `tmnl-ui`, and backend deps (`ai-core`, `editor`, `genifer`, `mcp`)
- `floating` → `capabilities`, `drag`, `drawer`, `stx`

---

## Critical Cycle Registry (29 total)

### Highest-priority cycles

1. `commands -> hotkeys -> commands`
2. `commands -> hotkeys -> minibuffer -> commands`
3. `hotkeys -> minibuffer -> hotkeys`
4. `terminal -> commands -> hotkeys -> minibuffer -> overlays -> terminal`
5. `terminal -> commands -> terminal`
6. `overlays -> cursor -> charts -> dataplane -> editor -> ava -> overlays`
7. `overlays -> cursor -> charts -> dataplane -> editor -> layout -> genifer -> geoint -> overlays`
8. `overlays -> cursor -> charts -> dataplane -> editor -> layout -> genifer -> morph-card -> overlays`
9. `overlays -> cursor -> charts -> dataplane -> editor -> data-grid -> drawer -> overlays`
10. `overlays -> cursor -> charts -> dataplane -> overlays`

### Additional cycles (medium/low impact)

- `charts -> dataplane -> editor -> charts`
- `dataplane -> editor -> dataplane`
- `layout -> genifer -> layout`
- `genifer -> morph-card -> genifer`
- `data-grid -> table-service -> data-grid`
- `durable-streams -> holonet -> durable-streams`
- `geoint -> streams -> geoint`
- `minibuffer -> overlays -> minibuffer`
- `hotkeys -> minibuffer -> overlays -> hotkeys`
- `overlays -> screensaver -> overlays`
- `overlays -> sidebar -> overlays`
- `ai-core -> testbed -> terminal -> ai-core`
- `ai-core -> testbed -> ai-core`
- `testbed -> terminal -> commands -> hotkeys -> tauri-windows -> testbed`
- `ai-core -> testbed -> terminal -> commands -> hotkeys -> minibuffer -> overlays -> cursor -> ai-core`
- `overlays -> cursor -> charts -> dataplane -> editor -> layout -> genifer -> geoint -> overlays` *(captured with normalized path variants)*

---

## Structural Debt Notes (by rule: hybrid enforcement)

### Accepted temporary cycles (documented seam candidates)
- `commands <-> hotkeys <-> minibuffer` cycle currently carries input-command execution semantics.
- `terminal <-> commands <-> hotkeys <-> minibuffer <-> overlays <-> terminal` bundles terminal UI eventing + command invocation.
- `overlays -> cursor -> charts -> dataplane -> editor -> ... -> overlays` cross-cuts canvas, layout, and data layers.

### High-risk violation candidates
- `overlays` + `terminal` + `commands/hotkeys/minibuffer` cluster: multiple mutual imports make ownership unclear.
- `primitives` currently imports `overlays` via map internals (`primitives/map/registries.ts`), which violates intended low-level layering.

---

## Recommended Layering Direction (working hypothesis)

1. Keep **`stx` + `primitives` as base layer services** (minimal imports).
2. Keep **`overlays`, `hotkeys`, `minibuffer`, `commands`, `terminal`** as interactive-first-order application surface with explicit adapter seams.
3. Introduce/solidify adapter boundaries for each cycle node before removing any imports.
4. Freeze current architecture via contracts before each migration tranche.

---

## Next Deliverables (tracked in architecture runbook)

- `docs/contracts/{primitives,stx,overlays,hotkeys,minibuffer,commands,terminal,floating}.md`
- `docs/systems/interactive-surface.md`
- `docs/adapters/cycle-seams.md`
- `docs/migrations/rectify-primitives-stx-overlay.md`
- `docs/decisions/EDIN-*.md`
