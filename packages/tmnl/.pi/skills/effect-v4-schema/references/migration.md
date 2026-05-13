# Migration from v3

> up: INDEX.md
> prereqs: none
> provides: v3-to-v4-mapping, removed-apis, renamed-apis

This is the "stop writing v3" reference. Every time you reach for a v3 pattern, look here first.

## Signature Changes — Array Syntax

v4 moved to array syntax for future extensibility (allows optional config objects).

| v3 | v4 |
|---|---|
| `Schema.Literal("a", "b")` | `Schema.Literals(["a", "b"])` |
| `Schema.Union(A, B)` | `Schema.Union([A, B])` |
| `Schema.Tuple(A, B)` | `Schema.Tuple([A, B])` |
| `Schema.TemplateLiteral(A, ".", B)` | `Schema.TemplateLiteral([A, ".", B])` |

Single `Schema.Literal("a")` still works. `Schema.Literals` is for unions.

## Renames — Types Represent Types Now

v4 schemas directly represent TypeScript types. No more `FromSelf` suffix:

| v3 | v4 | Reason |
|---|---|---|
| `Schema.BigIntFromSelf` | `Schema.BigInt` | Schema IS the type |
| `Schema.SymbolFromSelf` | `Schema.Symbol` | Same |
| `Schema.asSchema(s)` | `Schema.revealCodec(s)` | Schema→Codec distinction |
| `Schema.encodedSchema(s)` | `Schema.toEncoded(s)` | Clearer name |
| `Schema.typeSchema(s)` | `Schema.toType(s)` | Clearer name |

## Decode/Encode API Renames

| v3 | v4 | Return type |
|---|---|---|
| `decodeUnknown` | `decodeUnknownEffect` | `Effect` |
| `decode` | `decodeEffect` | `Effect` |
| `encodeUnknown` | `encodeUnknownEffect` | `Effect` |
| `encode` | `encodeEffect` | `Effect` |
| `decodeUnknownEither` | `decodeUnknownExit` | `Exit` (full `Cause`) |
| `decodeEither` | `decodeExit` | `Exit` |
| `encodeUnknownEither` | `encodeUnknownExit` | `Exit` |
| `encodeEither` | `encodeExit` | `Exit` |

**Sync versions unchanged:** `decodeUnknownSync`, `decodeSync`, `encodeUnknownSync`, `encodeSync`.

**Note:** `decode` is now a DIFFERENT API — it attaches a transformation to a schema. The old `decode` (run decoding) is now `decodeEffect`.

## Removed APIs

| v3 | v4 Equivalent |
|---|---|
| `Schema.validate*` | `Schema.decode*` + `Schema.toType` |
| `Schema.filter(fn)` | `.check(Schema.makeFilter(fn))` |
| `Schema.TaggedStruct("Tag", {...})` | `Schema.Struct({ _tag: Schema.tag("Tag"), ... })` or `Schema.TaggedClass` |
| `Schema.keyof` | *(no equivalent)* |
| `Schema.ArrayEnsure` | *(no equivalent)* |
| `Schema.NonEmptyArrayEnsure` | *(no equivalent)* |
| `Schema.withDefaults` | *(no equivalent — use `withDecodingDefault`)* |
| `Schema.fromKey` | *(no equivalent)* |
| `Schema.pickLiteral("a","b")` | `Schema.Literals([...]).pick(["a","b"])` |

### validate → decode + toType

```ts
// v3
Schema.validateSync(MySchema)(value)

// v4
Schema.decodeSync(Schema.toType(MySchema))(value)
```

## Transformation Overhaul

The biggest conceptual shift. Transformations are no longer inline — they're standalone objects.

### v3 → v4 Pattern

```ts
// v3 (WRONG in v4)
const NumberFromString = Schema.transform(
  Schema.String,
  Schema.Number,
  { decode: (s) => parseFloat(s), encode: (n) => String(n) }
)

// v4
import { SchemaTransformation } from "effect"

const NumberFromString = Schema.String.pipe(
  Schema.decodeTo(
    Schema.Number,
    SchemaTransformation.transform({
      decode: (s) => parseFloat(s),
      encode: (n) => String(n)
    })
  )
)
```

### v3 transformOrFail → v4

```ts
// v3 (WRONG)
Schema.transformOrFail(Source, Target, { decode: ..., encode: ... })

// v4
Source.pipe(
  Schema.decodeTo(
    Target,
    SchemaTransformation.transformOrFail({ decode: ..., encode: ... })
  )
)
```

## Optional Field Transformations

### optionalToOptional

```ts
// v3
Schema.optionalToOptional(Schema.String, Schema.String, {
  decode: Option.filter((s) => s !== ""),
  encode: identity
})

// v4
Schema.optionalKey(Schema.String).pipe(
  Schema.decodeTo(Schema.optionalKey(Schema.String), {
    decode: SchemaGetter.transformOptional(Option.filter((s) => s !== "")),
    encode: SchemaGetter.passthrough()
  })
)
```

### optionalToRequired

```ts
// v3
Schema.optionalToRequired(Schema.String, Schema.NullOr(Schema.String), {
  decode: Option.getOrElse(() => null),
  encode: Option.liftPredicate((v) => v !== null)
})

// v4
Schema.optionalKey(Schema.String).pipe(
  Schema.decodeTo(Schema.NullOr(Schema.String), {
    decode: SchemaGetter.transformOptional(Option.orElseSome(() => null)),
    encode: SchemaGetter.transformOptional(Option.filter((v) => v !== null))
  })
)
```

## Other Renames

| v3 | v4 |
|---|---|
| `Schema.extend(A, B)` | `A.pipe(Schema.extend(B))` or `Schema.Struct.merge(A, B)` |
| `Schema.compose(A, B)` | `A.pipe(Schema.decodeTo(B))` |
| `Schema.attachPropertySignature(k, v)` | `Schema.Struct({ _tag: Schema.tagDefaultOmit("v") })` |
| `Schema.annotations({...})` | `.annotate({...})` |
| `Schema.rename({a: "b"})` | Struct `.mapFields` or manual |
| `Schema.pattern(regex)` | `.check(Schema.isPattern(regex))` |
| `Schema.nonEmptyString` | `Schema.String.check(Schema.isNonEmpty())` |
| `Schema.split(sep)` | *(transformation — use SchemaTransformation)* |
| `Schema.parseJson(schema)` | `Schema.fromJsonString(schema)` |
