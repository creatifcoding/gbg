# Workspace Map

> up: INDEX.md
> prereqs: none
> provides: project-inventory, tag-taxonomy, target-overview, polyglot-awareness
> children: none
> update-strategy: re-derive from `bunx nx show projects` and per-project `bunx nx show project <name> --json`. Rebuild registry tables, tag taxonomy, target inventory.
> update-trigger: new package added/removed in packages/, project.json tags changed, nx.json plugins changed
> update-status: current

8 NX projects. Polyglot: TypeScript, Rust (Tauri), Elixir (Phoenix), WASM (egui).

Culled from 27 on 2026-03-03. Removed 10 pi extensions (NX shouldn't track those), 7 dormant packages, 2 unused foundation packages.

## Project Registry

### Core Platform

| Project | Root | Tags | Key Targets | Notes |
|---|---|---|---|---|
| `tmnl` | `packages/tmnl` | `npm:private` | dev, test, typecheck, tauri:dev, phoenix:dev, elixir:test, e2e | **Primary app.** 90+ targets. Tauri + Vite + Phoenix + egui |
| `@tmnl/stx` | `packages/stx` | `scope:tmnl, type:lib, domain:state, effect:v4` | build, test, typecheck | State factory. Effect v4 via alias. |
| `@gbg/ctl` | `packages/ctl` | `npm:public, scope:shared, type:lib` | build, test, typecheck, compile | CLI tool. Effect-TS, SQLite, agent-guiding. |

### Libraries

| Project | Root | Tags | Key Targets | Notes |
|---|---|---|---|---|
| `@selfcharters/sparkplug-client` | `packages/sparkplug-client` | `npm:public` | build, test | MQTT Sparkplug B client. 2 dependents. |
| `spikectl` | `packages/spikectl` | `npm:public` | build, test, compile | IIoT CLI tooling. 1 dependent. |

### Infrastructure

| Project | Root | Tags | Key Targets | Notes |
|---|---|---|---|---|
| `agent-browser` | `packages/tmnl/agent-browser` | (untagged) | test, typecheck | Browser automation for pi |
| `@gbg/nx-effect` | `tools/nx-effect` | (untagged) | lint | Local NX plugin: createNodesV2 + effect-v4-lib generator |
| `@gbg/monorepo` | `.` | `npm:public` | nx-release-publish | Monorepo root config |

## Tag Taxonomy

### Scope Tags
- `scope:tmnl` — TMNL domain packages
- `scope:shared` — Cross-domain shared

### Type Tags
- `type:lib` — Library (importable)
- `type:app` — Application (runnable)

### Domain Tags
- `domain:state` — State management (`@tmnl/stx`)

### Special Tags
- `effect:v4` — Uses Effect v4 via alias. **Boundary-enforced** — can only depend on other `effect:v4` packages.
- `npm:public` / `npm:private` — Publish visibility

## Polyglot Targets

TMNL is polyglot — NX orchestrates non-JS targets:

| Language | Targets | Where |
|---|---|---|
| **Rust** (Tauri) | `tauri:dev`, `tauri:build`, `tauri:dev:windows`, `tauri:dev:both` | `tmnl` |
| **Elixir** (Phoenix) | `phoenix:dev`, `phoenix:init`, `phoenix:test`, `elixir:build`, `elixir:deps`, `elixir:init`, `elixir:test` | `tmnl` |
| **WASM** (egui) | `egui:wasm:build` | `tmnl` |
| **Shell** | `shell:build`, `shell:dev`, `shell:vite` | `tmnl` |

These are regular NX targets backed by `nx:run-commands` executors wrapping native toolchains.

## NX Cloud

- **Cloud ID**: `6900cdd87a20187029497502`
- **Default base**: `master`
- Remote caching enabled — builds shared across CI and local dev
- `bunx nx affected -t test` uses cloud cache to skip unchanged projects

## Untagged Projects

3 of 8 projects have no tags: `agent-browser`, `@gbg/nx-effect`, `@gbg/monorepo` (root only has `npm:public`). Tag as workspace matures:
1. Tag all projects with at least `scope:*` and `type:*`
2. Add `depConstraints` rules for each new scope
3. Use `bunx nx show projects --with-target build` to find projects that should have build targets but don't
