---
name: nx-workspace
description: NX workspace architecture — monorepo structure, generators, plugins, boundaries, Effect v4 isolation, dependency constraints, and workspace-map navigation.
---

# NX Workspace

> prereqs: none
> provides: monorepo-orchestration, build-system, module-boundaries
> children: TEMPLATE.md, GRAPH.md, CHANGELOG.md, references/INDEX.md
> meta-refs: TEMPLATE.md (how to write docs), GRAPH.md (topology), CHANGELOG.md (history)

NX 22.x · Bun workspaces · 8 plugins · NX Cloud enabled

## When to Load

- Running builds/tests/lint across the monorepo
- Creating or scaffolding workspace packages
- Writing or debugging NX plugins/generators
- Modifying module boundaries or tags
- Effect v3 → v4 migration questions

## Router

```
What are you doing?
│
├─ Running a target ────────────────── § Commands (below)
│
├─ Creating a new package ──────────── § Scaffold (below)
│                                      then → references/generators/INDEX.md
│
├─ Understanding registered plugins
│  ├─ Which plugins exist & what
│  │  targets they infer ───────────── references/plugins/INDEX.md
│  ├─ Specific plugin detail ───────── references/plugins/<name>.md
│  │  (js-typescript, vite, eslint, next, playwright, jest, rollup, nx-effect)
│  └─ How createNodesV2 works ──────── references/plugins/createNodesV2.md
│
├─ Writing a plugin or generator
│  ├─ Generator registration ───────── references/generators/registration.md
│  ├─ Generator schema.json ────────── references/generators/schema.md
│  ├─ Tree API & utilities ─────────── references/generators/tree-api.md
│  └─ Local plugin structure ───────── references/plugins/local-plugin.md
│
├─ Enforcing module boundaries
│  ├─ Current rules ────────────────── references/boundaries/INDEX.md
│  ├─ depConstraints full API ──────── references/boundaries/dep-constraints.md
│  └─ Migrating a package v3→v4 ────── references/boundaries/migration-pattern.md
│                                      prereqs → references/effect-v4/INDEX.md
│
├─ Effect v4 alias / isolation
│  ├─ Strategy & install commands ──── references/effect-v4/INDEX.md
│  ├─ Why not alternatives ─────────── references/effect-v4/why-not-alternatives.md
│  ├─ GA migration plan ────────────── references/effect-v4/ga-migration.md
│  └─ Bumping beta version ─────────── references/effect-v4/version-bumping.md
│
├─ Modifying this skill
│  ├─ Doc shapes & frontmatter ─────── TEMPLATE.md
│  ├─ Full topology map ────────────── GRAPH.md
│  └─ Change history ──────────────── CHANGELOG.md
│
└─ Debugging project graph ─────────── § Diagnostics (below)
```

## Commands

**`bunx nx` — always. Never `npx`, never bare `nx`.**

```bash
bunx nx <target> <project>              # one target, one project
bunx nx run-many -t build test          # multiple targets, all projects
bunx nx affected -t <target>            # only changed projects
bunx nx graph                           # visual dependency graph
bunx nx show project @tmnl/stx         # full config + metadata
bunx nx list ./tools/nx-effect          # plugin capabilities
```

## Scaffold

```bash
bunx nx g ./tools/nx-effect:effect-v4-lib <name> --domain=<domain> [--withReact] [--withXState]
bunx nx g ./tools/nx-effect:effect-v4-lib <name> --dry-run
```

## Tags

| Tag | Purpose |
|---|---|
| `scope:tmnl` / `scope:gbg` | Ownership |
| `type:lib` / `type:app` | Package type |
| `domain:state` / `ui` / `data` / `canvas` | Domain |
| `effect:v4` | Uses Effect v4 via alias — boundary-enforced |

## Diagnostics

```bash
bunx nx show project @tmnl/stx          # inspect config + inferred metadata
bunx nx show projects --with-target build  # all projects with a target
bunx nx report                           # workspace health
NX_DAEMON=false bunx nx <cmd>            # bypass daemon for debug output
```

## Key Files

| File | What |
|---|---|
| `nx.json` | Plugin list, target defaults, NX Cloud |
| `eslint.config.mjs` | Module boundary depConstraints |
| `tsconfig.base.json` | `@tmnl/*` path aliases |
| `tools/nx-effect/` | Local plugin source |
| `packages/*/project.json` | Per-project config |

## Skill Meta

| File | Purpose | When to read |
|---|---|---|
| `TEMPLATE.md` | Entity shapes + frontmatter protocol | Before writing/modifying any doc in this skill |
| `GRAPH.md` | Full topology with typed edges | Planning traversal, or after adding/removing nodes |
| `CHANGELOG.md` | Structural change history | After modifying the skill, to log changes |
| `references/INDEX.md` | Entry to all reference docs | When the router above doesn't have a direct match |
