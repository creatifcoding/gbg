# effect-v4-schema

> prereqs: none
> provides: effect-v4-schema-patterns, v3-to-v4-migration, schema-validation, schema-serialization, schema-classes
> children: CHANGELOG.md, GRAPH.md, references/INDEX.md
> governed-by: metaskill

Effect v4 Schema — the canonical reference for defining, validating, transforming, and serializing data with `Schema` from `effect`. Covers v4 API patterns, v3→v4 migration, and integration with the `@tmnl/*` workspace (aliased as `effect-v4`).

## When to Load

- Writing or reviewing any `Schema.*` code targeting Effect v4
- Defining domain types (Structs, Classes, TaggedClass, Opaque)
- Adding validation (`.check()`, filters, brands, refinements)
- Transforming data (`Schema.decode`, `Schema.decodeTo`, `SchemaTransformation`)
- Serializing to JSON, FormData, URLSearchParams, XML
- Migrating v3 Schema code to v4
- Wiring schemas with Effect services, EventLog, or atoms

## Quick Reference — v4 Import Map

In `@tmnl/*` packages, Effect v4 is aliased:

```ts
import { Schema, SchemaTransformation, SchemaGetter } from "effect-v4"
```

In standard v4 projects:

```ts
import { Schema, SchemaTransformation, SchemaGetter } from "effect"
```

## Router

```
What are you doing?
│
├─ Defining types
│  ├─ Primitives/Literals ─────── → references/elementary.md
│  ├─ Structs (objects) ──────── → references/structs.md
│  ├─ Classes / TaggedClass ──── → references/classes.md
│  ├─ Unions / Tagged Unions ─── → references/unions.md
│  ├─ Arrays / Tuples / Records  → references/collections.md
│  └─ Recursive schemas ──────── → references/classes.md #recursive
│
├─ Validating data
│  ├─ .check() + filters ──────── → references/validation.md
│  ├─ Brands ──────────────────── → references/validation.md #brands
│  ├─ Refinements ─────────────── → references/validation.md #refinements
│  └─ Effectful filters ───────── → references/validation.md #effectful
│
├─ Transforming data
│  ├─ decode / decodeTo ───────── → references/transformations.md
│  ├─ SchemaTransformation ────── → references/transformations.md #first-class
│  ├─ SchemaGetter ────────────── → references/transformations.md #getters
│  └─ Optional key transforms ── → references/transformations.md #optional-keys
│
├─ Serializing
│  ├─ JSON ────────────────────── → references/serialization.md #json
│  ├─ FormData / URLSearchParams  → references/serialization.md #formdata
│  └─ Canonical codecs ────────── → references/serialization.md #canonical
│
├─ Migrating from v3 ─────────── → references/migration.md
│
└─ Integration patterns
   ├─ With Effect services ────── → references/integration.md
   └─ With @tmnl/* aliases ────── → references/integration.md #aliases
```

## Critical v4 Changes (Cheat Sheet)

| v3 | v4 | Why |
|---|---|---|
| `Schema.Literal("a", "b")` | `Schema.Literals(["a", "b"])` | Array syntax for extensibility |
| `Schema.Union(A, B)` | `Schema.Union([A, B])` | Array syntax |
| `Schema.Tuple(A, B)` | `Schema.Tuple([A, B])` | Array syntax |
| `Schema.filter(fn)` | `.check(Schema.makeFilter(fn))` | Filters are first-class values |
| `Schema.brand("X")` | `Schema.brand("X")` | Same (pipe) |
| `Schema.transform(A, B, { decode, encode })` | `A.pipe(Schema.decodeTo(B, SchemaTransformation.transform({ decode, encode })))` | Transformations are standalone |
| `Schema.TaggedStruct("Tag", {...})` | *(removed)* — use `Schema.TaggedClass` or `Schema.Struct` + `Schema.tag` | TaggedStruct gone |
| `Schema.decodeUnknownEither(s)(v)` | `Schema.decodeUnknownExit(s)(v)` | Either→Exit (full Cause) |
| `Schema.decodeUnknownSync(s)(v)` | `Schema.decodeUnknownSync(s)(v)` | Same |
| `Schema.BigIntFromSelf` | `Schema.BigInt` | Schemas represent types directly |
| `Schema.SymbolFromSelf` | `Schema.Symbol` | Same reason |
| `Schema.asSchema(s)` | `Schema.revealCodec(s)` | Schema→Codec rename |
| `Schema.Class<A>()("A", {...})` | `Schema.Class<A>("A")({...})` | Simplified call signature |
| `Schema.TaggedClass<A>()("Tag", {...})` | `Schema.TaggedClass<A>()("Tag", {...})` | Same |

## ⚠️ AGENTS.md Alignment

The project's AGENTS.md says to use `Schema.TaggedStruct` and `Schema.TaggedClass`. In v4:
- **`Schema.TaggedStruct` is removed.** Use `Schema.Struct` with a `_tag: Schema.tag("MyTag")` field, or use `Schema.TaggedClass`.
- **`Schema.TaggedClass` still exists** with the same API.
- **`Schema.Class` still exists** — call signature changed slightly.

When writing v4 code, prefer:
```ts
// Discriminated data (no methods needed)
class MyEvent extends Schema.TaggedClass<MyEvent>()("MyEvent", {
  payload: Schema.String
}) {}

// Or with Schema.Struct + tag
const MyEvent = Schema.Struct({
  _tag: Schema.tag("MyEvent"),
  payload: Schema.String
})
```
