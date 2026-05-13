# Classes and Opaque Types

> up: INDEX.md
> prereqs: structs.md
> provides: schema-class, tagged-class, opaque, error-class, recursive-schemas

v4 has **three** class-like constructs. Pick the lightest one that fits.

| Need | Use | Runtime cost |
|---|---|---|
| Distinct type, no methods | `Schema.Opaque` | Zero — same plain object |
| Methods, equality, instanceof | `Schema.Class` | Class prototype |
| Discriminated union member | `Schema.TaggedClass` | Class + `_tag` field |
| Yieldable error | `Schema.TaggedErrorClass` | Error + `_tag` + Effect yield |

## Schema.Opaque — Lightest

Creates a distinct TypeScript type backed by a struct. **No methods, no `new`**, just type-level branding.

```ts
import { Schema } from "effect"

class UserId extends Schema.Opaque<UserId>()(
  Schema.Struct({ value: Schema.String.check(Schema.isNonEmpty()) })
) {}

// UserId is a distinct type, but runtime value is { value: "..." }
const id = UserId.makeUnsafe({ value: "abc" })
id.value // "abc"

// Use inside other schemas
const User = Schema.Struct({ id: UserId, name: Schema.String })
```

### Branded Opaque (prevent cross-assignment)

```ts
class OrderId extends Schema.Opaque<OrderId, { readonly brand: unique symbol }>()(
  Schema.Struct({ value: Schema.String })
) {}
class UserId extends Schema.Opaque<UserId, { readonly brand: unique symbol }>()(
  Schema.Struct({ value: Schema.String })
) {}

// OrderId and UserId are NOT assignable to each other despite same shape
```

### Recursive Opaque

```ts
class Category extends Schema.Opaque<Category>()(
  Schema.Struct({
    name: Schema.String,
    children: Schema.Array(Schema.suspend((): Schema.Codec<Category> => Category))
  })
) {}
```

## Schema.Class — Full Featured

⚠️ **v4 call signature changed from v3:**

```ts
// v3 (WRONG — do not use)
class A extends Schema.Class<A>()("A", { ... }) {}

// v4 (CORRECT)
class A extends Schema.Class<A>("A")({ ... }) {}
//                            ^^^^ identifier in first call
//                                  ^^^^ fields in second call
```

```ts
class Person extends Schema.Class<Person>("Person")({
  name: Schema.String,
  age: Schema.Finite
}) {
  // Instance methods allowed
  get displayName() { return `${this.name} (${this.age})` }

  // Regular class fields allowed
  readonly _kind = "person" as const
}

new Person({ name: "Alice", age: 30 })         // ✓ constructor validates
Person.makeUnsafe({ name: "Alice", age: 30 })  // ✓ factory
Schema.decodeUnknownSync(Person)({ ... })       // ✓ decode from unknown
```

### Filters on Classes

Pass a `Schema.Struct` (not bare fields) to use `.check()`:

```ts
class DateRange extends Schema.Class<DateRange>("DateRange")(
  Schema.Struct({
    start: Schema.Date,
    end: Schema.Date
  }).check(Schema.makeFilter(({ start, end }) => end > start, { title: "end > start" }))
) {}
```

### Extend

```ts
class Base extends Schema.Class<Base>("Base")({
  id: Schema.String
}) {
  readonly _base = true
}

class Extended extends Base.extend<Extended>("Extended")({
  extra: Schema.Number
}) {
  readonly _ext = true
}
// Extended has id + extra + _base + _ext
```

### Static Members on Subclass

```ts
class A extends Schema.Class<A>("A")({ a: Schema.String }) {
  static readonly version = 1
}

class B extends A.extend<B, typeof A>("B")({ b: Schema.Number }) {}
B.version // 1 — preserved via typeof A
```

## Schema.TaggedClass — Discriminated

Automatically adds `_tag` field. **Use for union members.**

```ts
class Cat extends Schema.TaggedClass<Cat>()("Cat", {
  lives: Schema.Number
}) {}

class Dog extends Schema.TaggedClass<Dog>()("Dog", {
  wagsTail: Schema.Boolean
}) {}

const Animal = Schema.Union([Cat, Dog])

Schema.decodeUnknownSync(Animal)({ _tag: "Cat", lives: 9 })
// Cat { _tag: 'Cat', lives: 9 }
```

Custom identifier (different from tag):
```ts
class Person extends Schema.TaggedClass<Person>("MyPerson")("Person", {
  name: Schema.String
}) {}
Person.identifier // "MyPerson"
new Person({ name: "X" })._tag // "Person"
```

## Schema.TaggedErrorClass — Yieldable Errors

```ts
import { Effect, Schema } from "effect"

class NotFound extends Schema.TaggedErrorClass<NotFound>()("NotFound", {
  path: Schema.String
}) {}

class Unauthorized extends Schema.TaggedErrorClass<Unauthorized>()("Unauthorized", {
  reason: Schema.String
}) {}

const program = Effect.gen(function*() {
  yield* new NotFound({ path: "/missing" })  // yields as typed error
})

// Catch by tag
program.pipe(
  Effect.catchTags({
    NotFound: (err) => Effect.succeed(`404: ${err.path}`),
    Unauthorized: (err) => Effect.succeed(`401: ${err.reason}`)
  })
)
```

## Schema.ErrorClass — Untagged Errors

```ts
class AppError extends Schema.ErrorClass<AppError>("AppError")({
  message: Schema.String,
  code: Schema.Number
}) {}
```

## Recursive Schemas {#recursive}

Use `Schema.suspend` to reference a class during its own definition:

```ts
class TreeNode extends Schema.Class<TreeNode>("TreeNode")({
  value: Schema.Number,
  children: Schema.Array(Schema.suspend((): Schema.Codec<TreeNode> => TreeNode))
}) {}
```

### Mutually Recursive

```ts
class Expr extends Schema.Class<Expr>("Expr")({
  type: Schema.Literal("expr"),
  value: Schema.Union([Schema.Number, Schema.suspend((): Schema.Codec<Op> => Op)])
}) {}

class Op extends Schema.Class<Op>("Op")({
  type: Schema.Literal("op"),
  operator: Schema.Literals(["+", "-"]),
  left: Expr,
  right: Expr
}) {}
```

### When Encoded ≠ Type (recursive)

Declare the encoded interface separately:

```ts
interface CategoryEncoded extends Schema.Codec.Encoded<typeof Category> {}

class Category extends Schema.Class<Category>("Category")({
  name: Schema.FiniteFromString,
  children: Schema.Array(Schema.suspend((): Schema.Codec<Category, CategoryEncoded> => Category))
}) {}
```
