# Effect-Atom Result Pattern Guide

**EPOCH-0003: Canonical Result Handling Patterns**

> This document covers the **correct** way to handle `Result<A, E>` types from effect-atom when atoms contain Effects or Streams.

---

## TL;DR: Two Different Types

| Type               | From                | When Used                                    | States                        |
| ------------------ | ------------------- | -------------------------------------------- | ----------------------------- |
| **`Result<A, E>`** | `@effect-atom/atom` | `useAtomValue` on atoms with Effects/Streams | Initial, Success, Failure     |
| **`Exit<A, E>`**   | `effect`            | `useAtomSet` with `mode: "promiseExit"`      | Success, Failure (no Initial) |

**Key Difference**: `Result` has an `Initial` state for "not yet executed" which `Exit` does not have.

---

## Result Type Structure

```typescript
import { Result } from '@effect-atom/atom-react';

// Result has 3 states
type Result<A, E = unknown> =
  | Result.Initial // Not yet executed (important for lazy atoms!)
  | Result.Failure<E> // Failed with typed error
  | Result.Success<A>; // Succeeded with value
```

### Success Type

```typescript
interface Success<A> {
  readonly value: A;
  readonly waiting?: boolean; // For streams: true if waiting for next chunk
}
```

### Failure Type

```typescript
interface Failure<E> {
  readonly cause: Cause.Cause<E>; // Effect Cause (includes defects, interruptions)
}
```

---

## Pattern 1: Result.match (Recommended)

**Use when**: You want explicit handling of all states.

```typescript
import { Atom, Result } from '@effect-atom/atom-react';
import { Effect, Cause } from 'effect';

const userAtom = Atom.make(
  Effect.gen(function* () {
    const user = yield* fetchUser();
    return user;
  })
);

function UserProfile() {
  const result = useAtomValue(userAtom);

  return Result.match(result, {
    onInitial: () => <div>Loading user...</div>,
    onFailure: (error) => <div>Error: {Cause.pretty(error.cause)}</div>,
    onSuccess: (success) => (
      <div>
        <h1>{success.value.name}</h1>
        <p>{success.value.email}</p>
      </div>
    ),
  });
}
```

---

## Pattern 2: Result.builder (Fluent API)

**Use when**: You prefer a chainable API.

```typescript
function UserProfile() {
  const result = useAtomValue(userAtom);

  return Result.builder(result)
    .onInitial(() => <div>Loading...</div>)
    .onFailure((cause) => <div>Error: {Cause.pretty(cause)}</div>)
    .onSuccess((data) => (
      <div>
        <h1>{data.name}</h1>
        <p>{data.email}</p>
      </div>
    ))
    .render();
}
```

---

## Pattern 3: Type Guards (Manual)

**Use when**: You need imperative control flow.

```typescript
function UserProfile() {
  const result = useAtomValue(userAtom);

  if (Result.isInitial(result)) {
    return <div>Loading...</div>;
  }

  if (Result.isFailure(result)) {
    return <div>Error: {Cause.pretty(result.cause)}</div>;
  }

  // TypeScript knows result.value is available here
  const user = result.value;
  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
    </div>
  );
}
```

---

## Pattern 4: Result Utilities

```typescript
// Extract value or provide default
const user = Result.getOrElse(result, () => defaultUser);

// Map over success value
const nameResult = Result.map(result, (user) => user.name);

// FlatMap for chaining
const emailResult = Result.flatMap(result, (user) =>
  user.email ? Result.success(user.email) : Result.initial
);

// Check state
if (Result.isSuccess(result)) {
  console.log(result.value);
}
```

---

## Stream Pattern: Progressive Data

**Use when**: Atom emits values over time (e.g., WebSocket, polling).

```typescript
import { Stream, Schedule } from 'effect';

// Emits incrementing number every second
const tickAtom = Atom.make(Stream.fromSchedule(Schedule.spaced('1 second')));

function TickDisplay() {
  const result = useAtomValue(tickAtom);

  return Result.match(result, {
    onInitial: () => <div>Starting...</div>,
    onFailure: (error) => <div>Error: {Cause.pretty(error.cause)}</div>,
    onSuccess: (success) => (
      <div>
        Tick: {success.value}
        {success.waiting && <span className="pulse">●</span>}
      </div>
    ),
  });
}
```

**Key Feature**: `success.waiting` indicates stream is waiting for next value.

---

## Pull Pattern: Infinite Scroll / Pagination

**Use when**: You want to load data in chunks on demand.

```typescript
import { useAtom } from '@effect-atom/atom-react';

const itemsStream = Stream.fromIterable(
  Array.from({ length: 100 }, (_, i) => i)
);

const itemsPullAtom = Atom.pull(
  itemsStream.pipe(
    Stream.rechunk(10) // Pull 10 items at a time
  )
);

function InfiniteScroll() {
  const [result, pullMore] = useAtom(itemsPullAtom);

  return Result.match(result, {
    onInitial: () => (
      <button onClick={() => pullMore()}>Load first batch</button>
    ),
    onFailure: (error) => <div>Error loading items</div>,
    onSuccess: (success) => (
      <div>
        <ul>
          {success.value.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <button onClick={() => pullMore()} disabled={success.waiting}>
          {success.waiting ? 'Loading...' : 'Load more'}
        </button>
      </div>
    ),
  });
}
```

**How it works**:

- Initial state until first `pullMore()` call
- Each `pullMore()` pulls next chunk from stream
- `success.value.items` accumulates all chunks
- `success.waiting` shows loading state during pull

---

## Anti-Patterns

### ❌ Accessing .value Without Checking

```typescript
// WRONG - runtime error if Initial or Failure
const user = result.value;
```

### ❌ Using mode: 'promise' to Bypass Result

```typescript
// WRONG - loses Initial state and type safety
const data = useAtomValue(dataAtom, { mode: 'promise' });
```

### ❌ Not Handling Initial State

```typescript
// WRONG - flickers blank before showing data
if (Result.isFailure(result)) return <Error />;
return <Data data={result.value} />; // Crashes on Initial!
```

### ✅ CORRECT

```typescript
if (Result.isInitial(result)) return <Loading />;
if (Result.isFailure(result)) return <Error />;
return <Data data={result.value} />;
```

---

## When to Use Result vs Exit

### Use `Result<A, E>` (from effect-atom)

- ✅ Reading atoms with `useAtomValue`
- ✅ Atoms created with `Atom.make(Effect)` or `Atom.make(Stream)`
- ✅ When you need to handle "not yet loaded" state (Initial)
- ✅ Progressive/reactive data (streams, polling)

### Use `Exit<A, E>` (from effect)

- ✅ Operations with `useAtomSet` + `mode: "promiseExit"`
- ✅ One-shot mutations (create, update, delete)
- ✅ When Initial state doesn't apply (operation already ran)
- ✅ Testing Effect programs directly

---

## Real-World Example: Document List

```typescript
import { Atom, Result } from '@effect-atom/atom-react';
import { Effect } from 'effect';

// Atom contains Effect - returns Result
const documentsAtom = Atom.make(
  Effect.gen(function* () {
    const registry = yield* DocumentRegistryService;
    return yield* registry.list();
  })
);

// Component handles Result states
function DocumentList() {
  const result = useAtomValue(documentsAtom);

  return Result.match(result, {
    onInitial: () => <div className="animate-pulse">Loading documents...</div>,

    onFailure: (error) => (
      <div className="error">
        Failed to load: {Cause.pretty(error.cause)}
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    ),

    onSuccess: (success) => {
      const docs = success.value;

      if (docs.length === 0) {
        return <div>No documents yet</div>;
      }

      return (
        <ul>
          {docs.map((doc) => (
            <li key={doc.id}>{doc.title}</li>
          ))}
        </ul>
      );
    },
  });
}
```

---

## Migration Checklist

When converting atoms to use Result pattern:

- [ ] Change `useAtomValue(atom)` type from `T` to `Result<T, E>`
- [ ] Add `Result.match` or `Result.builder` to handle all states
- [ ] Handle `Initial` state (loading spinner, skeleton, etc.)
- [ ] Handle `Failure` state (error message, retry button)
- [ ] Use `success.value` to access data in `Success` state
- [ ] For streams, check `success.waiting` for loading indicator
- [ ] Use `Cause.pretty(error.cause)` for human-readable errors

---

## Quick Reference

### Result Type Guards

```typescript
Result.isInitial(result); // true if not yet executed
Result.isSuccess(result); // true if succeeded
Result.isFailure(result); // true if failed
```

### Result Utilities

```typescript
Result.getOrElse(result, () => defaultValue)
Result.map(result, (value) => transform(value))
Result.flatMap(result, (value) => anotherResult)
Result.match(result, { onInitial, onFailure, onSuccess })
Result.builder(result).onInitial(...).onFailure(...).onSuccess(...).render()
```

### Cause Utilities

```typescript
Cause.pretty(cause); // Human-readable error message
Cause.isDie(cause); // Check if defect (unexpected error)
Cause.isInterrupt(cause); // Check if interrupted (canceled)
```

---

## Resources

- [effect-atom README](https://github.com/tim-smart/effect-atom#working-with-streams)
- [Result API Docs](https://tim-smart.github.io/effect-atom/atom/Result.ts.html)
- [Effect Cause Docs](https://effect.website/docs/guides/error-management/unexpected-errors/)
- `.edin/EFFECT_PATTERNS.md` - General Effect-Atom patterns

---

**Last Updated**: 2025-12-26  
**Author**: Val (TMNL Architect)  
**Status**: Canonical reference for Result handling
