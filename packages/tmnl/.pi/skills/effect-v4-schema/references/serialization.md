# Serialization

> up: INDEX.md
> prereqs: structs.md, transformations.md
> provides: json-serialization, formdata, urlsearchparams, canonical-codecs

## JSON {#json}

### Parse JSON string → unknown

```ts
import { Schema } from "effect"

Schema.decodeUnknownSync(Schema.UnknownFromJsonString)('{"a":1}')
// { a: 1 }
```

### Parse JSON string → typed value

```ts
const UserFromJson = Schema.fromJsonString(
  Schema.Struct({ name: Schema.String, age: Schema.Number })
)

Schema.decodeUnknownSync(UserFromJson)('{"name":"Alice","age":30}')
// { name: "Alice", age: 30 }
```

### Canonical JSON Codec

Convert a schema into one that encodes to/from JSON-safe values:

```ts
const Person = Schema.Struct({
  name: Schema.String,
  createdAt: Schema.Date
})

// toCodecJson converts Date → ISO string, BigInt → string, etc.
const PersonJson = Schema.toCodecJson(Person)

Schema.encodeUnknownSync(PersonJson)({ name: "Alice", createdAt: new Date() })
// { name: "Alice", createdAt: "2026-03-02T..." }
```

## FormData {#formdata}

```ts
const schema = Schema.fromFormData(
  Schema.Struct({
    name: Schema.String,
    age: Schema.String
  })
)

const fd = new FormData()
fd.append("name", "Alice")
fd.append("age", "30")

Schema.decodeUnknownSync(schema)(fd)
// { name: "Alice", age: "30" }
```

### Nested FormData (bracket notation)

```ts
const schema = Schema.fromFormData(
  Schema.Struct({
    user: Schema.Struct({
      name: Schema.String,
      email: Schema.String
    })
  })
)

const fd = new FormData()
fd.append("user[name]", "Alice")
fd.append("user[email]", "a@b.com")
```

### Non-string FormData values

Use `toCodecStringTree` with `keepDeclarations: true`:

```ts
const schema = Schema.fromFormData(
  Schema.toCodecStringTree(
    Schema.Struct({ count: Schema.Int }),
    { keepDeclarations: true }
  )
)
// Parses "3" → 3 (number)
```

## URLSearchParams {#urlsearchparams}

Same pattern as FormData:

```ts
const schema = Schema.fromURLSearchParams(
  Schema.Struct({ q: Schema.String, page: Schema.String })
)

Schema.decodeUnknownSync(schema)(new URLSearchParams("q=hello&page=2"))
// { q: "hello", page: "2" }
```

Nested with brackets:
```ts
const schema = Schema.fromURLSearchParams(
  Schema.Struct({
    filter: Schema.Struct({ status: Schema.String, sort: Schema.String })
  })
)
new URLSearchParams("filter[status]=active&filter[sort]=date")
```

## Canonical Codecs {#canonical}

v4 provides codec generators that convert schemas into format-specific codecs:

| Function | Output format | Key behavior |
|---|---|---|
| `Schema.toCodecJson(s)` | JSON-safe values | Date→ISO, BigInt→string, etc. |
| `Schema.toCodecStringTree(s)` | `{ [key]: string }` tree | All values stringified |
| `Schema.fromFormData(s)` | Decodes `FormData` | Bracket notation for nesting |
| `Schema.fromURLSearchParams(s)` | Decodes `URLSearchParams` | Bracket notation |
| `Schema.fromJsonString(s)` | Decodes JSON string | `JSON.parse` + schema decode |

### Custom Serialization on Classes

```ts
class Person extends Schema.Opaque<Person>()(
  Schema.Struct({ name: Schema.String, createdAt: Schema.Date })
) {
  static readonly json = Schema.toCodecJson(this)
}

Schema.encodeUnknownSync(Person.json)({ name: "X", createdAt: new Date() })
```
