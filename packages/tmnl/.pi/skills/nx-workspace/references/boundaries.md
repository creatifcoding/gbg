# NX Module Boundaries — Dependency Constraints

> Back to: `../SKILL.md`

## Config Location

`eslint.config.mjs` at repo root.

## Rule: @nx/enforce-module-boundaries

Controls which projects can import from which, based on tags in `project.json`.

### Current Configuration

```js
'@nx/enforce-module-boundaries': [
  'error',
  {
    enforceBuildableLibDependency: true,
    allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
    depConstraints: [
      {
        // v4 packages: isolated ecosystem
        sourceTag: 'effect:v4',
        onlyDependOnLibsWithTags: ['effect:v4'],
        bannedExternalImports: ['effect'],
      },
      {
        // Everything else: unrestricted
        sourceTag: '*',
        onlyDependOnLibsWithTags: ['*'],
      },
    ],
  },
]
```

### What This Enforces

1. **`effect:v4` isolation** — packages tagged `effect:v4` can ONLY depend on other `effect:v4` packages. Cannot import from v3 packages.
2. **Banned bare `effect` import** — v4 packages must use the `effect-v4` alias, not the bare `effect` package (which resolves to v3 via root override).
3. **Default permissive** — all other packages (`*`) can depend on anything.

### depConstraints Options

| Option | Type | Purpose |
|---|---|---|
| `sourceTag` | string | Tag of the importing project. `*` = wildcard. Supports regex. |
| `onlyDependOnLibsWithTags` | string[] | Whitelist of allowed dependency tags |
| `notDependOnLibsWithTags` | string[] | Blacklist of forbidden dependency tags |
| `bannedExternalImports` | string[] | Forbidden npm packages (supports wildcards like `legacy-*`) |
| `allowedExternalImports` | string[] | Whitelist of allowed npm packages |

### Adding New Constraints

To restrict a new domain:

```js
{
  sourceTag: 'domain:ui',
  onlyDependOnLibsWithTags: ['domain:ui', 'domain:state', 'type:lib'],
  notDependOnLibsWithTags: ['domain:data'],
}
```

### Useful Flags

| Flag | Default | Purpose |
|---|---|---|
| `enforceBuildableLibDependency` | false | Buildable libs can only depend on buildable libs |
| `banTransitiveDependencies` | false | Ban imports of transitive deps not in package.json |
| `checkDynamicDependenciesExceptions` | [] | Allow specific dynamic imports |

### Checking Violations

```bash
bunx nx lint @tmnl/stx        # lint single project
bunx nx affected -t lint       # lint all changed projects
bunx nx run-many -t lint       # lint everything
```

Violations show as ESLint errors with clear messages like:
```
A project tagged with "effect:v4" can only depend on libs tagged with "effect:v4"
```

### Migration Pattern

When migrating a package from v3 to v4:
1. Add `effect:v4` tag to its `project.json`
2. Replace `effect` dep with `effect-v4` alias
3. Update imports: `from "effect"` → `from "effect-v4"`
4. Run `bunx nx lint <project>` — boundary violations reveal missed imports
