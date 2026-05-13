# Structs

> up: INDEX.md
> prereqs: elementary.md
> provides: struct-schema, optional-keys, mutable-keys, defaults, index-signatures, deriving

## Basic Struct

```ts
import { Schema } from "effect"

const Person = Schema.Struct({
  name: Schema.String,
  age: Schema.Number
})

type Person = typeof Person.Type
// { readonly name: string; readonly age: number }

type PersonEncoded = typeof Person.Encoded
// { readonly name: string; readonly age: number }
```

## Optional and Mutable Keys

By default all keys are **required** and **readonly**.

```ts
const schema = Schema.Struct({
  a: Schema.String,                                    // readonly, required
  b: Schema.optionalKey(Schema.String),                // readonly, optional (key may be absent)
  c: Schema.mutableKey(Schema.String),                 // mutable, required
  d: Schema.optionalKey(Schema.mutableKey(Schema.String)) // mutable, optional
})
// Type: { readonly a: string; readonly b?: string; c: string; d?: string }
```

### Optional Fields (value-level optionality)

```ts
const schema = Schema.Struct({
  // Exact optional (key absent)
  a: Schema.optionalKey(Schema.FiniteFromString),
  // Optional with undefined
  b: Schema.optional(Schema.FiniteFromString),
  // Exact optional + nullable
  c: Schema.optionalKey(Schema.NullOr(Schema.FiniteFromString)),
  // Optional + nullable + undefined
  d: Schema.optional(Schema.NullOr(Schema.FiniteFromString))
})
```

## Decoding Defaults

```ts
const schema = Schema.Struct({
  // If field missing or undefined → use "1" (encoded type)
  a: Schema.FiniteFromString.pipe(Schema.withDecodingDefault(() => "1"))
})

Schema.decodeUnknownSync(schema)({})            // { a: 1 }
Schema.decodeUnknownSync(schema)({ a: undefined }) // { a: 1 }
Schema.decodeUnknownSync(schema)({ a: "2" })    // { a: 2 }
```

For optional keys specifically:
```ts
Schema.FiniteFromString.pipe(Schema.withDecodingDefaultKey(() => "1"))
```

## Index Signatures

```ts
const schema = Schema.Struct(
  { known: Schema.String },
  { key: Schema.String, value: Schema.Number } // index signature
)
// Type: { readonly known: string } & { readonly [x: string]: number }
```

## Deriving Structs

### Pick / Omit
```ts
const Full = Schema.Struct({ a: Schema.String, b: Schema.Number, c: Schema.Boolean })
const Picked = Full.pick("a", "c")   // { a: string, c: boolean }
const Omitted = Full.omit("b")       // { a: string, c: boolean }
```

### Merge
```ts
const A = Schema.Struct({ a: Schema.String })
const B = Schema.Struct({ b: Schema.Number })
const Merged = Schema.Struct.merge(A, B)  // { a: string, b: number }
```

### Mapping Fields
```ts
// Map all fields to optional
const AllOptional = Full.mapFields((field) => Schema.optionalKey(field))

// Map specific fields
const Partial = Full.mapFields((field, key) =>
  key === "b" ? Schema.optionalKey(field) : field
)
```

### Opaque Structs
```ts
const OpaqueStruct = Full.mapFields((field) => field).annotate({
  identifier: "OpaqueStruct"
})
```

## Tagged Structs

Use `Schema.tag` for the discriminant field:
```ts
const MyEvent = Schema.Struct({
  _tag: Schema.tag("MyEvent"),
  payload: Schema.String
})
// Type: { readonly _tag: "MyEvent"; readonly payload: string }
```

With default + omit on encode:
```ts
const MyEvent = Schema.Struct({
  _tag: Schema.tagDefaultOmit("MyEvent"),  // present on decode, omitted on encode
  payload: Schema.String
})

Schema.decodeUnknownSync(MyEvent)({ payload: "hi" })
// { _tag: "MyEvent", payload: "hi" }

Schema.encodeSync(MyEvent)({ _tag: "MyEvent", payload: "hi" })
// { payload: "hi" }
```

## Preserve Unexpected Keys

By default structs strip unknown keys. To keep them:
```ts
Schema.decodeUnknownSync(schema)(data, { onExcessProperty: "preserve" })
```

## Reusing Fields

```ts
const Base = Schema.Struct({ id: Schema.String, createdAt: Schema.Date })
const User = Schema.Struct({ ...Base.fields, name: Schema.String, email: Schema.String })
```
