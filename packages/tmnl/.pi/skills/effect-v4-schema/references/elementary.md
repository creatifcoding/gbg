# Elementary Schemas

> up: INDEX.md
> prereqs: none
> provides: primitives, literals, string-checks, number-checks, dates, template-literals

## Primitives

```ts
import { Schema } from "effect" // or "effect-v4" in @tmnl/*

Schema.String    // string
Schema.Number    // number
Schema.BigInt    // bigint
Schema.Boolean   // boolean
Schema.Symbol    // symbol  (was BigIntFromSelf/SymbolFromSelf in v3)
Schema.Undefined // undefined
Schema.Null      // null
Schema.Void      // void
Schema.Unknown   // unknown
Schema.Any       // any
Schema.Never     // never
Schema.Finite    // number (no Infinity, no NaN)
```

## Literals

Single value:
```ts
Schema.Literal("tuna")   // "tuna"
Schema.Literal(12)        // 12
Schema.Literal(2n)        // 2n
Schema.Literal(true)      // true
```

Multiple values (union of literals):
```ts
// v4: array syntax (was variadic in v3)
const Status = Schema.Literals(["pending", "active", "archived"])
// type: "pending" | "active" | "archived"

// Access the literal values
Status.literals  // readonly ["pending", "active", "archived"]
Status.members   // readonly [Schema.Literal<"pending">, ...]

// Pick a subset
const Active = Status.pick(["active", "archived"])
```

## String Checks

All via `.check()` — filters are first-class reusable values:

```ts
Schema.String.check(Schema.isMaxLength(5))
Schema.String.check(Schema.isMinLength(5))
Schema.String.check(Schema.isLengthBetween(5, 10))
Schema.String.check(Schema.isPattern(/^[a-z]+$/))
Schema.String.check(Schema.isStartsWith("aaa"))
Schema.String.check(Schema.isEndsWith("zzz"))
Schema.String.check(Schema.isIncludes("---"))
Schema.String.check(Schema.isUppercased())
Schema.String.check(Schema.isLowercased())
Schema.String.check(Schema.isNonEmpty())
Schema.String.check(Schema.isTrimmed())

// Multiple checks in one call
Schema.String.check(Schema.isMinLength(3), Schema.isTrimmed())

// String formats
Schema.String.check(Schema.isUUID())
Schema.String.check(Schema.isBase64())
Schema.String.check(Schema.isBase64Url())
```

String transforms (via SchemaTransformation):
```ts
import { SchemaTransformation } from "effect"

Schema.String.transform(SchemaTransformation.trim())
Schema.String.transform(SchemaTransformation.toLowerCase())
Schema.String.transform(SchemaTransformation.toUpperCase())
```

## Number Checks

```ts
Schema.Number.check(Schema.isBetween({ minimum: 5, maximum: 10 }))
Schema.Number.check(Schema.isGreaterThan(5))
Schema.Number.check(Schema.isGreaterThanOrEqualTo(5))
Schema.Number.check(Schema.isLessThan(5))
Schema.Number.check(Schema.isLessThanOrEqualTo(5))
Schema.Number.check(Schema.isMultipleOf(5))
Schema.Number.check(Schema.isInt())
Schema.Number.check(Schema.isInt32())
```

## Dates

```ts
import { SchemaGetter } from "effect"

Schema.Date  // Date objects

// Date from string (custom transformation)
const DateFromString = Schema.Date.pipe(
  Schema.encodeTo(Schema.String, {
    decode: SchemaGetter.Date(),
    encode: SchemaGetter.String()
  })
)
```

## Template Literals

v4 uses array syntax:

```ts
// Pattern: `${string}@${string}`
const Email = Schema.TemplateLiteral([
  Schema.String.check(Schema.isMinLength(1)),
  "@",
  Schema.String.check(Schema.isMaxLength(64))
])

// Parse into components: readonly [string, "@", string]
const EmailParts = Schema.TemplateLiteralParser(Email.parts)
```
