# Transformations

> up: INDEX.md
> prereqs: elementary.md, structs.md
> provides: transform, decodeTo, schema-transformation, schema-getter, composition, optional-key-transforms

⚠️ **v4: Transformations are standalone objects, NOT inline in schemas.**

The v3 pattern `Schema.transform(Source, Target, { decode, encode })` is gone. In v4, transformations are **first-class values** you compose with schemas via `Schema.decodeTo`.

## The Three Modules

| Module | Purpose | Think of it as |
|---|---|---|
| `SchemaTransformation` | Reusable decode+encode pairs | The transformation itself |
| `SchemaGetter` | One-direction functions (decode OR encode) | Half a transformation |
| `Schema.decodeTo` | Attach a transformation to a schema | The wiring |

## SchemaTransformation — First-Class {#first-class}

```ts
import { SchemaTransformation } from "effect"

// Built-in transformations
SchemaTransformation.trim()              // string → trimmed string
SchemaTransformation.toLowerCase()       // string → lowercase
SchemaTransformation.toUpperCase()       // string → uppercase
SchemaTransformation.numberFromString    // string → number (and back)

// Custom transformation
SchemaTransformation.transform({
  decode: (meters: number) => meters / 1000,
  encode: (km: number) => km * 1000
})

// Failable transformation
SchemaTransformation.transformOrFail({
  decode: (s: string) => Effect.try({
    try: () => new URL(s),
    catch: (e) => new SchemaIssue.InvalidValue(Option.some(s), { cause: e })
  }),
  encode: (url: URL) => Effect.succeed(url.toString())
})
```

### Composing Transformations

```ts
const trimToLower = SchemaTransformation.trim().compose(SchemaTransformation.toLowerCase())
// decode: trim → lowercase
// encode: passthrough (both sides)
```

## Schema.transform — Same Schema, Apply Transform

When source and target schemas are the same type:

```ts
import { Schema, SchemaTransformation } from "effect"

const TrimmedString = Schema.String.pipe(
  Schema.transform(SchemaTransformation.trim())
)
// Decodes: "  hello  " → "hello"
// Encodes: "hello" → "hello" (passthrough)
```

## Schema.decodeTo — Different Source → Target

When transforming between different schemas:

```ts
const NumberFromString = Schema.String.pipe(
  Schema.decodeTo(Schema.Number, SchemaTransformation.numberFromString)
)
// Decodes: "123" → 123
// Encodes: 123 → "123"
```

### Schema Composition (no transformation)

If target's encoded type matches source's type, omit the transformation:

```ts
const KmFromMeters = Schema.Finite.pipe(
  Schema.transform(SchemaTransformation.transform({
    decode: (m) => m / 1000,
    encode: (km) => km * 1000
  }))
)

const MilesFromKm = Schema.Finite.pipe(
  Schema.transform(SchemaTransformation.transform({
    decode: (km) => km * 0.621371,
    encode: (mi) => mi / 0.621371
  }))
)

// Compose: meters → km → miles
const MilesFromMeters = KmFromMeters.pipe(Schema.decodeTo(MilesFromKm))
```

## SchemaGetter — One-Direction Helpers {#getters}

```ts
import { SchemaGetter } from "effect"

SchemaGetter.passthrough()     // identity — return input as-is
SchemaGetter.String()          // coerce to string
SchemaGetter.Date()            // parse date from string
SchemaGetter.trim()            // trim whitespace
SchemaGetter.toLowerCase()     // lowercase
SchemaGetter.omit()            // return Option.none() → key removed from struct
SchemaGetter.withDefault(() => "fallback")  // provide default for missing/undefined

// Effectful check (for async validation)
SchemaGetter.checkEffect((value) => Effect.gen(function*() { ... }))

// Optional key transform
SchemaGetter.transformOptional(Option.filter(x => x !== ""))
```

## Passthrough Helpers

When composing schemas via `decodeTo`, declare the type relationship:

```ts
// To.Encoded === From.Type
SchemaTransformation.passthrough()

// From.Type is subtype of To.Encoded
SchemaTransformation.passthroughSubtype()

// To.Encoded is subtype of From.Type
SchemaTransformation.passthroughSupertype()

// Turn off strict checking
SchemaTransformation.passthrough({ strict: false })
```

## Optional Key Transforms {#optional-keys}

Transform optional keys using `SchemaGetter.transformOptional`:

```ts
import { Option, Schema, SchemaGetter } from "effect"

// Optional string → omit if empty
const schema = Schema.Struct({
  name: Schema.optionalKey(Schema.String).pipe(
    Schema.decodeTo(Schema.optionalKey(Schema.String), {
      decode: SchemaGetter.transformOptional(Option.filter(s => s !== "")),
      encode: SchemaGetter.passthrough()
    })
  )
})

Schema.decodeUnknownSync(schema)({ name: "" })   // {}
Schema.decodeUnknownSync(schema)({ name: "hi" }) // { name: "hi" }
```

## Omitting Keys on Encode

```ts
const schema = Schema.Struct({
  visible: Schema.String,
  internal: Schema.String.pipe(
    Schema.encodeTo(Schema.optionalKey(Schema.String), {
      decode: SchemaGetter.withDefault(() => "default"),
      encode: SchemaGetter.omit()  // dropped on encode
    })
  )
})
```

## Flipping

Swap decode and encode directions:

```ts
const NumberFromString = Schema.String.pipe(
  Schema.decodeTo(Schema.Number, SchemaTransformation.numberFromString)
)

// StringFromNumber — reversed
const StringFromNumber = Schema.flip(NumberFromString)
```
