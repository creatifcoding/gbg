# depConstraints — Full API

> Back to: `INDEX.md`

## Options Per Constraint

| Option | Type | Purpose |
|---|---|---|
| `sourceTag` | string | Tag of importing project. `*` = wildcard. Supports regex. |
| `onlyDependOnLibsWithTags` | string[] | Whitelist: can only depend on libs with these tags |
| `notDependOnLibsWithTags` | string[] | Blacklist: cannot depend on libs with these tags |
| `bannedExternalImports` | string[] | Forbidden npm packages. Supports globs like `legacy-*` |
| `allowedExternalImports` | string[] | Whitelist of allowed npm packages |

## Rule-Level Options

| Option | Default | Purpose |
|---|---|---|
| `enforceBuildableLibDependency` | false | Buildable libs only depend on buildable libs |
| `banTransitiveDependencies` | false | Ban imports not in own package.json |
| `allow` | [] | Regex whitelist for import paths to skip |

## Examples

```js
// UI packages can only use UI + state + shared libs
{ sourceTag: 'domain:ui', onlyDependOnLibsWithTags: ['domain:ui', 'domain:state', 'type:shared'] }

// Apps can depend on anything
{ sourceTag: 'type:app', onlyDependOnLibsWithTags: ['*'] }

// No package should use a deprecated lib
{ sourceTag: '*', notDependOnLibsWithTags: ['deprecated'] }

// Data packages can't import React
{ sourceTag: 'domain:data', bannedExternalImports: ['react', 'react-dom'] }
```
