# Generator Registration — generators.json

> Back to: `INDEX.md`

## Format

```json
{
  "generators": {
    "<name>": {
      "factory": "./src/generators/<name>/generator",
      "schema": "./src/generators/<name>/schema.json",
      "description": "What this generator does",
      "x-type": "library",
      "aliases": ["short-name"],
      "hidden": false
    }
  }
}
```

## Fields

| Field | Required | Purpose |
|---|---|---|
| `factory` | ✓ | Path to module with default export (generator fn). Relative to this JSON file. |
| `schema` | ✓ | Path to JSON Schema for options |
| `description` | ✓ | Shown in `bunx nx list` |
| `x-type` | | `"application"` or `"library"` — categorization for Nx Console |
| `aliases` | | Alternative names for the generator |
| `hidden` | | Hide from listings |

## Resolution Chain

```
bunx nx g ./tools/nx-effect:effect-v4-lib
    │
    ├─ NX reads tools/nx-effect/package.json
    ├─ Finds "generators": "./generators.json"
    ├─ Reads generators.json
    ├─ Finds "effect-v4-lib" entry
    ├─ Loads factory: ./src/generators/effect-v4-lib/generator
    └─ Calls default export with (tree, options)
```

## Linked From

`package.json` must declare: `"generators": "./generators.json"`
