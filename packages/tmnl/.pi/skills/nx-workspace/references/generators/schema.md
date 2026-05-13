# Generator Schema — schema.json

> Back to: `INDEX.md`

## Minimal Example

```json
{
  "$schema": "https://json-schema.org/schema",
  "$id": "MyGenerator",
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "$default": { "$source": "argv", "index": 0 },
      "x-prompt": "What name?"
    }
  },
  "required": ["name"]
}
```

## NX-Specific Extensions

| Extension | Purpose | Example |
|---|---|---|
| `$default.$source: "argv"` | Positional CLI arg | `"index": 0` → first positional |
| `x-prompt` | Interactive prompt | String or `{ message, type, items }` |
| `x-dropdown` | Dropdown in Nx Console | `"enum": ["a", "b"]` |

## Companion schema.d.ts

```ts
export interface MyGeneratorSchema {
  name: string
  description?: string
  domain?: string
}
```

Keep in sync with schema.json. Generator function receives this typed.
