# Validation

> up: INDEX.md
> prereqs: elementary.md
> provides: check-api, filters, filter-groups, brands, refinements, effectful-filters

⚠️ **v4: `Schema.filter()` is gone. Use `.check()` with filter values.**

The v3 pattern `Schema.filter(predicate)` piped inline doesn't exist. In v4, filters are **standalone reusable values** applied via `.check()`.

## .check() — The Only Way

```ts
import { Schema } from "effect"

// Single filter
Schema.String.check(Schema.isMinLength(3))

// Multiple filters in one call
Schema.String.check(Schema.isMinLength(3), Schema.isTrimmed())

// Filters are first-class — define once, reuse
const isShortString = Schema.isMaxLength(50)
const isNonBlank = Schema.isMinLength(1)

Schema.String.check(isShortString, isNonBlank)
```

### .check() preserves the schema type

```ts
const s = Schema.String.check(Schema.isNonEmpty())
// s is still Schema.String — you can call .check() again, access Schema.String methods
```

### Struct fields retain their type after .check()

```ts
const s = Schema.Struct({ a: Schema.String, b: Schema.Number })
  .check(Schema.makeFilter(() => true))
s.fields // still accessible
```

## Custom Filters

```ts
const isEven = Schema.makeFilter<number>(
  (n) => n % 2 === 0 || `expected even, got ${n}`,
  { title: "isEven", description: "an even number" }
)

Schema.Number.check(isEven)
```

Boolean return = pass/fail. String return = custom error message.

## Filter Groups

Bundle multiple filters into a reusable unit:

```ts
const isInt32 = Schema.makeFilterGroup(
  [Schema.isInt(), Schema.isBetween({ minimum: -2147483648, maximum: 2147483647 })],
  { title: "isInt32", description: "a 32-bit integer" }
)

Schema.Number.check(isInt32)
```

## Aborting Early

By default with `{ errors: "all" }`, ALL filters run. Use `.abort()` to short-circuit:

```ts
Schema.String.check(
  Schema.isMinLength(3).abort(),  // stop here if fails
  Schema.isTrimmed()              // won't run if minLength fails
)
```

## Multiple Issue Reporting

```ts
Schema.decodeUnknownExit(schema)(value, { errors: "all" })
// Reports ALL failing filters, not just the first
```

## Brands {#brands}

Type-level branding — zero runtime cost, prevents cross-assignment:

```ts
const UserId = Schema.String.pipe(Schema.brand("UserId"))
type UserId = typeof UserId.Type  // string & Brand<"UserId">

const OrderId = Schema.String.pipe(Schema.brand("OrderId"))
type OrderId = typeof OrderId.Type  // string & Brand<"OrderId">

// UserId and OrderId are NOT assignable to each other
```

## Refinements {#refinements}

Narrow the TypeScript type via a type predicate:

```ts
const AtLeastTwo = Schema.Array(Schema.String).pipe(
  Schema.refine(
    (arr): arr is readonly [string, string, ...string[]] => arr.length >= 2
  )
)
```

## Structural Filters

Filters that check shape (length, size, properties count) rather than item content. They run **separately** from item-level filters:

```ts
const Tags = Schema.Array(
  Schema.String.check(Schema.isNonEmpty())  // item-level
).check(
  Schema.isMinLength(3)                      // structural
)

// With { errors: "all" }, BOTH item failures and structural failures reported
```

## Effectful Filters {#effectful}

When validation needs async/services, use `SchemaGetter.checkEffect` inside a transformation:

```ts
import { Effect, Option, Schema, SchemaGetter, SchemaIssue } from "effect"

const ValidUserId = Schema.Finite.pipe(
  Schema.decode({
    decode: SchemaGetter.checkEffect((id) =>
      Effect.gen(function*() {
        const exists = yield* checkUserExists(id)  // your async call
        return exists
          ? undefined                                // valid
          : new SchemaIssue.InvalidValue(Option.some(id), { title: "user not found" })
      })
    ),
    encode: SchemaGetter.passthrough()
  })
)
```

⚠️ Regular `.check()` filters must be synchronous. Effectful validation uses `Schema.decode` + `SchemaGetter.checkEffect`.

## Filter Factories

Build parameterized filters for custom ordered types:

```ts
import { Order, Schema } from "effect"

const makeIsGreaterThan = Schema.makeIsGreaterThan({ order: Order.number })
const isPositive = makeIsGreaterThan(0)

Schema.Number.check(isPositive)
```
