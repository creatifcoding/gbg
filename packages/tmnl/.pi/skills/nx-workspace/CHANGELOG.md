# NX Workspace Skill — Changelog

> up: SKILL.md
> meta: true — tracks every structural change to this skill

Format: Each entry logs the file, the action (`+` create, `~` modify, `-` delete, `→` rename), and what changed. Grouped by version.

---

## [0.3.0] — 2026-03-02

REF.md pattern + integration protocols + re-acquisition.

| Action | File | What changed |
|---|---|---|
| `+` | `references/plugins/REF.md` | Created. Compiled research: project graph construction, createNodesV2 lifecycle, target inference order (last-wins), caching/hashing, NX daemon, plugin resolution. Re-acquisition protocol via deepwiki. |
| `+` | `references/generators/REF.md` | Created. Compiled research: generator lifecycle (CLI → Tree → flush), Tree API methods, generateFiles vs tree.write, template interpolation (__name__, __tmpl__), devkit utilities table, generator composition. Re-acquisition protocol via deepwiki. |
| `+` | `references/boundaries/REF.md` | Created. Compiled research: ESLint AST analysis + project graph, depConstraints full API, bannedExternalImports vs notDependOnLibsWithTags, wildcard rule, tag matching, dynamic imports, barrel files. Re-acquisition protocol via deepwiki. |
| `+` | `references/effect-v4/REF.md` | Created. Compiled research: Bun hoisting model, npm alias mechanics, node_modules structure, import resolution, enforcement stack (alias + ESLint + metadata), TypeScript considerations, GA rename cost. Re-acquisition protocol via deepwiki + bun cli. |
| `~` | `TEMPLATE.md` | Added: Shape: REF.md entity template. Added: Protocol: Refreshing a REF.md. Updated: Protocol: New Reference Directory to include REF.md creation step. Added: verification steps on all protocols. |
| `~` | `SKILL.md` | Router expanded: added REF.md routes under every topic branch. |
| `~` | `GRAPH.md` | Added 4 REF.md nodes. Added prereqs edges (REF→REF cross-deps). Node count 31, edge count 47. Added "REF.md Pattern" section explaining INDEX vs REF separation. |
| `~` | `CHANGELOG.md` | Switched to granular per-file format. |
| `~` | `references/generators/INDEX.md` | Rewrote: now teaches the generator concept ("What Generators Are" section), not just a file list. Explains plugin→generator relationship. Links to REF.md. |
| `~` | `references/effect-v4/INDEX.md` | Added frontmatter protocol. Added REF.md to children. Added Contents table. Added Cross-References section. |
| `~` | `references/effect-v4/why-not-alternatives.md` | Replaced breadcrumb with full frontmatter (up, prereqs→REF.md, provides, children). |
| `~` | `references/effect-v4/ga-migration.md` | Replaced breadcrumb with full frontmatter. Added prereqs: REF.md, boundaries/migration-pattern.md. |
| `~` | `references/effect-v4/version-bumping.md` | Replaced breadcrumb with full frontmatter. Added prereqs: REF.md, plugins/nx-effect.md. |
| `~` | `references/generators/registration.md` | Replaced breadcrumb with full frontmatter. |
| `~` | `references/generators/schema.md` | Replaced breadcrumb with full frontmatter. |
| `~` | `references/generators/tree-api.md` | Replaced breadcrumb with full frontmatter. Added prereqs: registration.md, schema.md. |
| `~` | `references/boundaries/INDEX.md` | Rewrote with full frontmatter, cross reference to effect-v4, Contents table, checking commands. |
| `~` | `references/boundaries/dep-constraints.md` | Replaced breadcrumb with full frontmatter. |
| `~` | `references/boundaries/migration-pattern.md` | Replaced breadcrumb with full frontmatter. Added prereqs: effect-v4/INDEX.md, effect-v4/version-bumping.md. |

## [0.2.0] — 2026-03-02

Standardized structure + meta files + per-plugin briefs.

| Action | File | What changed |
|---|---|---|
| `+` | `TEMPLATE.md` | Created. Entity shapes: Plugin Brief, Generator Doc, Boundary Rule, Strategy Doc, INDEX Router. Frontmatter protocol (up, prereqs, provides, children). Edge types (routes, contains, prereqs, cross). |
| `+` | `GRAPH.md` | Created. Full topology with typed edges. Node count, edge summary. |
| `+` | `CHANGELOG.md` | Created. |
| `+` | `references/plugins/js-typescript.md` | Created. Plugin brief: @nx/js/typescript. Targets: typecheck, build. Options table. |
| `+` | `references/plugins/vite.md` | Created. Plugin brief: @nx/vite/plugin. Targets: build, test, dev, serve. Options table. |
| `+` | `references/plugins/eslint.md` | Created. Plugin brief: @nx/eslint/plugin. Targets: lint. Cross-ref to boundaries/. |
| `+` | `references/plugins/next.md` | Created. Plugin brief: @nx/next/plugin. Targets: build, dev, start. Generator defaults. |
| `+` | `references/plugins/playwright.md` | Created. Plugin brief: @nx/playwright/plugin. Targets: e2e. |
| `+` | `references/plugins/jest.md` | Created. Plugin brief: @nx/jest/plugin. Targets: test. Note: legacy, prefer vitest. |
| `+` | `references/plugins/rollup.md` | Created. Plugin brief: @nx/rollup/plugin. Targets: build. |
| `+` | `references/plugins/nx-effect.md` | Created. Plugin brief: ./tools/nx-effect. Metadata injection, constants, generator listing. Cross-refs to generators/, boundaries/, effect-v4/. |
| `~` | `SKILL.md` | Added meta routes (TEMPLATE, GRAPH, CHANGELOG). Expanded router tree. Added Skill Meta table. |
| `~` | `references/INDEX.md` | Added frontmatter. Added Cross-References section. |
| `~` | `references/plugins/INDEX.md` | Converted from flat heading inventory to structured table linking per-plugin briefs. Added frontmatter, NX Cloud info, cross-references. |
| `~` | `references/plugins/createNodesV2.md` | Added frontmatter (up, prereqs→boundaries, provides, children). |
| `~` | `references/plugins/local-plugin.md` | Added frontmatter. Added cross-references section. |

## [0.1.0] — 2026-03-02

Initial creation.

| Action | File | What changed |
|---|---|---|
| `+` | `SKILL.md` | Created. 80-line router with decision tree, commands, scaffold, tags, diagnostics, key files. |
| `+` | `references/INDEX.md` | Created. Directory router to 4 subdirectories. |
| `+` | `references/plugins/INDEX.md` | Created. Flat inventory of 8 registered NX plugins. |
| `+` | `references/plugins/createNodesV2.md` | Created. Type signature, createNodesFromFiles helper pattern, return shape, v1 vs v2 comparison. |
| `+` | `references/plugins/local-plugin.md` | Created. tools/nx-effect/ directory structure, package.json fields, nx.json registration. |
| `+` | `references/generators/INDEX.md` | Created. Usage commands, available generators table, writing guide. |
| `+` | `references/generators/registration.md` | Created. generators.json format, factory resolution, description field. |
| `+` | `references/generators/schema.md` | Created. schema.json format, JSON Schema properties, x-prompt, positional args. |
| `+` | `references/generators/tree-api.md` | Created. Tree methods, @nx/devkit utilities, generator function signature. |
| `+` | `references/boundaries/INDEX.md` | Created. eslint.config.mjs location, current depConstraints rules, checking commands. |
| `+` | `references/boundaries/dep-constraints.md` | Created. Full depConstraints API: sourceTag, onlyDependOnLibsWithTags, bannedExternalImports, notDependOnLibsWithTags. |
| `+` | `references/boundaries/migration-pattern.md` | Created. Per-package v3→v4 migration steps. |
| `+` | `references/effect-v4/INDEX.md` | Created. npm alias protocol, import paths, install commands, deep dive table. |
| `+` | `references/effect-v4/why-not-alternatives.md` | Created. Rejection table: nested overrides, nohoist, tsconfig paths, separate node_modules, root pin. |
| `+` | `references/effect-v4/ga-migration.md` | Created. Trigger conditions, rename steps, scope estimate, verification. |
| `+` | `references/effect-v4/version-bumping.md` | Created. When to bump, constant locations, step-by-step, verification commands. |
