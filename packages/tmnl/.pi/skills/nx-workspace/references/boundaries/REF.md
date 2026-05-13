# Module Boundaries — Conceptual Reference

> up: INDEX.md
> prereqs: ../plugins/REF.md
> provides: boundary-enforcement-mechanics, tag-system, depConstraints-internals
> children: none
> cross: ../effect-v4/REF.md

## What Module Boundaries Are

Module boundaries enforce architectural rules at **lint time** by inspecting import statements against the project graph. The rule answers: "Is this project allowed to import from that project?"

The system has three components:

1. **Tags** — labels on projects (e.g., `scope:tmnl`, `effect:v4`)
2. **depConstraints** — rules that say "projects with tag X can only depend on projects with tag Y"
3. **AST analysis** — the ESLint rule reads import statements and matches them against the graph

## How It Works Internally

```
1. ESLint loads @nx/enforce-module-boundaries rule
2. Rule reads the NX project graph (cached by daemon)
3. For each import/export statement in the file:
   a. AST parser extracts the import path
   b. Rule resolves: which project does this import target?
   c. Rule checks: which project does this SOURCE file belong to?
   d. Rule reads tags on both source and target project
   e. Rule evaluates depConstraints:
      - Does source tag match a sourceTag rule?
      - Does target project have the required tags?
      - Is the import in bannedExternalImports?
   f. If any constraint fails → ESLint error
```

The rule uses **both** AST analysis (to find the import path) and the **project graph** (to resolve which project the import points to and what tags it has).

## depConstraints Full API

```js
depConstraints: [
  {
    // Match projects with this tag
    sourceTag: 'effect:v4',

    // Target must have ALL of these tags
    onlyDependOnLibsWithTags: ['effect:v4'],

    // Target must NOT have any of these tags
    notDependOnLibsWithTags: ['legacy'],

    // These npm packages are banned (glob patterns)
    bannedExternalImports: ['effect', 'effect/*'],
  },
  {
    // Wildcard: applies to all projects
    sourceTag: '*',
    onlyDependOnLibsWithTags: ['*'],
  },
]
```

### bannedExternalImports vs notDependOnLibsWithTags

| | `bannedExternalImports` | `notDependOnLibsWithTags` |
|---|---|---|
| Targets | **npm packages** (external) | **workspace projects** (internal) |
| Matching | Glob patterns against import path | Tag matching against target project |
| Example | `['effect', '@effect/*']` bans v3 effect | `['legacy']` bans importing legacy-tagged libs |
| Our use | Ban bare `effect` in `effect:v4` packages | Not currently used |

### The Wildcard Rule

```js
{ sourceTag: '*', onlyDependOnLibsWithTags: ['*'] }
```

This is the **fallback**. Without it, any untagged project would fail ALL imports. The wildcard allows untagged projects to import anything. Constraints are evaluated in order — more specific rules (matching `effect:v4`) take precedence.

## Tag System

Tags are set in `project.json`:

```json
{
  "tags": ["scope:tmnl", "type:lib", "domain:state", "effect:v4"]
}
```

A project matches a `sourceTag` rule if it has **that exact tag**. Multiple tags allow a project to be subject to multiple constraint rules simultaneously.

## What It Catches vs What It Misses

| ✓ Catches | ✗ Misses |
|---|---|
| Static `import from '...'` | Dynamic `import('...')` (unless configured) |
| Static `export from '...'` | Runtime `require()` (evaluated, not static) |
| Re-exports through barrel files | Type-only imports (debatable — configurable) |
| npm package imports | Imports via path aliases not in the graph |

**Barrel files**: The rule resolves barrel re-exports. If `@tmnl/stx` re-exports from `@tmnl/core`, and the boundary bans `@tmnl/core`, the re-export is caught.

**Dynamic imports**: There's a `checkDynamicDependenciesExceptions` option. By default, dynamic imports are less strictly checked.

## When Checks Run

- **lint time only** — `bunx nx lint @tmnl/stx`
- NOT at build time
- NOT at runtime
- CI typically runs `bunx nx affected -t lint`

## Our Current Rules

```js
// eslint.config.mjs
depConstraints: [
  {
    sourceTag: 'effect:v4',
    onlyDependOnLibsWithTags: ['effect:v4'],
    bannedExternalImports: ['effect'],
  },
  { sourceTag: '*', onlyDependOnLibsWithTags: ['*'] },
]
```

**Effect**: Any project tagged `effect:v4`:
1. Can ONLY import from other `effect:v4` projects
2. CANNOT import bare `effect` (must use `effect-v4` alias)
3. CAN import npm packages not named `effect`

---

## Re-Acquisition Protocol

If this reference becomes stale (NX boundary API changes, new options):

```
# Full re-research
deepwiki_ask_question("nrwl/nx", "How does @nx/enforce-module-boundaries work? depConstraints, bannedExternalImports, AST analysis, project graph interaction?")

# Quick validation
bunx nx lint @tmnl/stx                                          # verify rules fire
grep -A 20 "depConstraints" eslint.config.mjs                    # audit current rules

# Source of truth
https://nx.dev/features/enforce-module-boundaries
https://deepwiki.com/nrwl/nx (search "enforce-module-boundaries")
https://github.com/nrwl/nx/blob/master/packages/eslint-plugin/src/rules/enforce-module-boundaries.ts
```

## Update Triggers

Re-research this doc when:
- NX major version changes
- New `depConstraints` options appear (check NX changelog)
- We add new tags to the workspace (new constraint rules needed)
- We discover false negatives (imports that should fail lint but don't)
- Dynamic import checking behavior changes

## Suggestions

- Add `notDependOnLibsWithTags: ['effect:v3']` when we create an explicit `effect:v3` tag to prevent reverse contamination.
- Consider banning `effect/*` in addition to `effect` — subpath imports like `effect/Schema` would bypass the current bare-name ban.
- Add a CI step that runs `bunx nx lint --all` on the entire workspace, not just affected, on a weekly schedule to catch drift.
