# Collections — Arrays, Tuples, Records

> up: INDEX.md
> prereqs: elementary.md
> provides: arrays, tuples, records, rest-elements, unique-arrays

## Arrays

```ts
import { Schema } from "effect"

Schema.Array(Schema.String)           // readonly string[]
Schema.NonEmptyArray(Schema.String)   // readonly [string, ...string[]]
```

### Array with length constraint

```ts
Schema.Array(Schema.String).check(Schema.isMinLength(3))
// Structural filter — checked on the array, not items
```

## Tuples

⚠️ **v4: `Schema.Tuple` takes an ARRAY, not variadic args.**

```ts
// v3 WRONG: Schema.Tuple(Schema.String, Schema.Number)
// v4:
const Pair = Schema.Tuple([Schema.String, Schema.Number])
// Type: readonly [string, number]
```

### Rest Elements

```ts
const WithRest = Schema.Tuple(
  [Schema.String, Schema.Number],
  { rest: Schema.Boolean }
)
// Type: readonly [string, number, ...boolean[]]
```

### Element Annotations

```ts
const Annotated = Schema.Tuple([
  Schema.element(Schema.String, { title: "name" }),
  Schema.element(Schema.Number, { title: "age" })
])
```

### Deriving Tuples

```ts
const Full = Schema.Tuple([Schema.String, Schema.Number, Schema.Boolean])
const First = Full.pick([0])      // readonly [string]
const NoFirst = Full.omit([0])    // readonly [number, boolean]
```

## Records

```ts
// String keys → number values
Schema.Record({ key: Schema.String, value: Schema.Number })
// Type: { readonly [x: string]: number }

// Number keys
Schema.Record({ key: Schema.Number, value: Schema.String })

// Literal keys
Schema.Record({ key: Schema.Literals(["a", "b"]), value: Schema.Number })
// Type: { readonly a: number; readonly b: number }
```

### Mutable Records

```ts
Schema.mutableKey(Schema.Record({ key: Schema.String, value: Schema.Number }))
```

### Key Transformations

```ts
// Not built-in in v4 — use decodeTo with a custom transformation
```

### Literal Structs from Records

```ts
const Config = Schema.Record({
  key: Schema.Literals(["host", "port", "debug"]),
  value: Schema.String
})
// Type: { readonly host: string; readonly port: string; readonly debug: string }
```
