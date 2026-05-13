# ./tools/nx-effect (local)

> up: INDEX.md
> prereqs: ../generators/INDEX.md, ../boundaries/INDEX.md
> provides: effect-v4-metadata, effect-v4-lib-generator
> children: none

## Source
`./tools/nx-effect` — local workspace plugin at `tools/nx-effect/`

## Infers From
`project.json` files where `tags` includes `"effect:v4"`.

## Targets
None inferred. Injects **metadata** only:

```json
{
  "effectVersion": "v4",
  "aliasPackage": "effect-v4",
  "effectNpmVersion": "4.0.0-beta.23"
}
```

Visible via `bunx nx show project @tmnl/stx` under `metadata`.

## Generators

| Generator | Purpose |
|---|---|
| `effect-v4-lib` | Scaffold @tmnl/* package with v4 alias deps |

Usage: `bunx nx g ./tools/nx-effect:effect-v4-lib <name> --domain=<d>`

## Constants (in source)

| Constant | Value | Location |
|---|---|---|
| `EFFECT_V4_TAG` | `"effect:v4"` | `src/index.ts` |
| `EFFECT_V4_ALIAS` | `"effect-v4"` | `src/index.ts` |
| `EFFECT_V4_VERSION` | `"4.0.0-beta.23"` | `src/index.ts` + generator |

**Update these when bumping the Effect beta.** See `../effect-v4/version-bumping.md`.

## When To Care
Any time you create a new @tmnl/* package, check that it's tagged `effect:v4`, and the metadata is injected. Any time you bump the Effect beta version, update the constants here.

## Cross-References
- `../generators/INDEX.md` — the generator this plugin provides
- `../boundaries/INDEX.md` — the boundary rules that `effect:v4` tag enables
- `../effect-v4/version-bumping.md` — how to update the version constants
- `local-plugin.md` — the file structure and registration of this plugin
