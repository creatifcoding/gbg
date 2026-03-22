# Effect Match Pattern

> **Source**: `.edin/EFFECT_MATCH_PATTERN.md`
> **Last consolidated**: 2026-02-09

## Overview

Effect.Match provides type-safe pattern matching for discriminated unions. It uses `_tag` as the discriminator field (Effect convention) and supports exhaustive checking, return type enforcement, Option/Either wrapping, and multi-tag handlers.

---

## Quick Reference

```typescript
import { Match } from "effect"

// Match.type<T>() - Create matcher for a type
// Match.value(v)  - Create matcher for a specific value
// Match.tag("TagName", handler) - Match by _tag field
// Match.exhaustive - Ensure all cases covered (compile error if missing)
// Match.orElse - Provide fallback for unmatched cases
// Match.withReturnType<R>() - Enforce consistent return type
// Match.option - Wrap result in Option (Some if matched, None otherwise)
// Match.either - Wrap in Either (Right if matched, Left with original)
```

---

## Basic Pattern: Match.type + Match.tag

```typescript
import { Match, pipe } from "effect"

type Shape =
  | { _tag: "Circle"; radius: number }
  | { _tag: "Square"; side: number }
  | { _tag: "Triangle"; base: number; height: number }

const area = Match.type<Shape>().pipe(
  Match.tag("Circle", (s) => Math.PI * s.radius ** 2),
  Match.tag("Square", (s) => s.side ** 2),
  Match.tag("Triangle", (s) => 0.5 * s.base * s.height),
  Match.exhaustive // TypeScript error if any case is missing
)

// Usage
const result = area({ _tag: "Circle", radius: 5 }) // 78.54...
```

---

## Match.value for Inline Matching

```typescript
import { Match } from "effect"

const describe = (shape: Shape) =>
  Match.value(shape).pipe(
    Match.tag("Circle", (s) => `Circle with radius ${s.radius}`),
    Match.tag("Square", (s) => `Square with side ${s.side}`),
    Match.orElse((s) => `Other shape: ${s._tag}`)
  )
```

---

## Matching Multiple Tags

```typescript
// Match several tags with the same handler
const isSimple = Match.type<Shape>().pipe(
  Match.tag("Circle", "Square", () => true),
  Match.orElse(() => false)
)
```

---

## Return Type Enforcement

```typescript
// Ensure all branches return the same type
const toLogLevel = Match.type<AppEvent>().pipe(
  Match.withReturnType<"info" | "warn" | "error">(),
  Match.tag("UserLogin", "UserLogout", () => "info"),
  Match.tag("PermissionDenied", () => "warn"),
  Match.tag("SystemCrash", () => "error"),
  Match.orElse(() => "info")
)
```

---

## Option/Either Wrapping

```typescript
// Wrap result in Option (Some if matched, None otherwise)
const extractError = Match.type<AppEvent>().pipe(
  Match.tag("SystemCrash", (e) => e.errorMessage),
  Match.option // Returns Option<string>
)

// Wrap in Either (Right if matched, Left with original value otherwise)
const extractPayload = Match.type<AppEvent>().pipe(
  Match.tag("DataReceived", (e) => e.payload),
  Match.either // Returns Either<AppEvent, Payload>
)
```

---

## In Effect Streams

```typescript
import { Stream, Match } from "effect"

const processEvents = (events: Stream.Stream<AppEvent>) =>
  events.pipe(
    Stream.map((event) => ({
      type: event._tag,
      processed: handleEvent(event),
    })),
    Stream.filter(({ processed }) => processed.type === "data")
  )
```

---

## Integration with Atoms

```typescript
import { Atom } from "@effect-atom/atom"
import { Match } from "effect"

// Atom reducer using Match.value
export const applyDelta = (
  state: AppState,
  delta: DeltaPayload
): AppState =>
  Match.value(delta).pipe(
    Match.tag("ItemAdded", (d) => ({
      ...state,
      items: [...state.items, d.item],
    })),
    Match.tag("ItemRemoved", (d) => ({
      ...state,
      items: state.items.filter((i) => i.id !== d.itemId),
    })),
    Match.orElse(() => state) // Ignore unrecognized deltas
  )
```

---

## Exhaustive Error Matching

Use `Match.tagsExhaustive` for compile-time enforcement that all error tags are handled:

```typescript
import { Match, pipe } from "effect"

type AppError =
  | { _tag: "NotFound"; id: string }
  | { _tag: "Unauthorized"; reason: string }
  | { _tag: "ServerError"; code: number }

const toMessage = (error: AppError) => pipe(
  Match.type<AppError>(),
  Match.tagsExhaustive({
    NotFound: (e) => `Not found: ${e.id}`,
    Unauthorized: (e) => `Unauthorized: ${e.reason}`,
    ServerError: (e) => `Server error: ${e.code}`,
    // Missing case -> TypeScript compile error!
  })
)(error)
```

---

## Testing Patterns

```typescript
import { describe, it, expect } from "@effect/vitest"
import { Match } from "effect"

describe("Pattern matching", () => {
  it("handles all cases exhaustively", () => {
    const shape: Shape = { _tag: "Circle", radius: 5 }
    const result = area(shape)
    expect(result).toBeCloseTo(78.54, 1)
  })

  it("is exhaustive at compile time", () => {
    // Adding a new variant to Shape will cause a compile error
    // on the `area` matcher until you add a handler for it
  })
})
```

---

## Agent Quick Reference

### Key Imports

```typescript
import { Match, pipe } from "effect"
```

### Minimal Example

```typescript
type Status = { _tag: "Active" } | { _tag: "Inactive"; reason: string }

const describe = Match.type<Status>().pipe(
  Match.tag("Active", () => "Active"),
  Match.tag("Inactive", (s) => `Inactive: ${s.reason}`),
  Match.exhaustive
)
```

### Common Pitfalls

- Forgetting `Match.exhaustive` -- silently ignores new union variants at runtime
- Using `Match.orElse` when exhaustiveness is needed -- hides missing cases
- Not using `Match.withReturnType<T>()` when branches should return consistent types
- Using `Match.tag` with non-`_tag` discriminators -- `Match.tag` only works with `_tag` field
- Confusing `Match.type<T>()` (creates reusable matcher) with `Match.value(v)` (inline, one-shot)

### Cross-References

- [effect-errors.md](./effect-errors.md) -- `Match.tagsExhaustive` for error handling
- [effect-core.md](./effect-core.md) -- foundational Effect patterns
- [schemas.md](./schemas.md) -- Schema.TaggedClass creates `_tag` discriminators
