# Local Plugin Anatomy — tools/nx-effect/

> up: INDEX.md
> prereqs: ../generators/registration.md
> provides: local-plugin-structure, plugin-registration
> children: none

## Structure

```
tools/nx-effect/
├── package.json          # "generators" → "./generators.json", "main" → "./src/index.ts"
├── generators.json       # Generator registry
└── src/
    ├── index.ts          # createNodesV2 + createDependencies exports
    └── generators/
        └── effect-v4-lib/
            ├── schema.json
            ├── schema.d.ts
            └── generator.ts
```

## package.json

```json
{
  "name": "@gbg/nx-effect",
  "main": "./src/index.ts",
  "generators": "./generators.json"
}
```

NX resolves via two paths:
- `"main"` → for `createNodesV2` / `createDependencies`
- `"generators"` → for generator discovery

## Registration in nx.json

```json
{
  "plugins": [
    {
      "plugin": "./tools/nx-effect",
      "exclude": ["submodules/**", "receipts/**", "node_modules/**"]
    }
  ]
}
```

## Cross-References
- `nx-effect.md` — what this plugin does (metadata injection, generators)
- `createNodesV2.md` — the API this plugin's `src/index.ts` implements
- `../generators/registration.md` — how `generators.json` works
