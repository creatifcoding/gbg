---
name: fermion-patterns
description: Schema-driven Atom.family patterns for TMNL. Covers Fermion builder API, registry patterns, algebra interpreters, and React integration. (project)
model_invoked: true
triggers:
  - "Fermion"
  - "fromSchema"
  - "Atom.family"
  - "FermionAlgebra"
  - "withKey"
  - "withCompositeKey"
  - "registry.set"
  - "registry.get"
  - "RegistryProvider"
  - "IoT"
  - "sensor"
  - "entity cache"
  - "memoized atom"
---

# Fermion Patterns

Schema-driven Atom.family library for TMNL. Fermion provides type-safe, memoized
atom families with Effect-based CRUD operations.

The name "Fermion" comes from fundamental particles that obey the Pauli exclusion
principle - no two fermions can share the same quantum state. This maps to
Atom.family memoization where each key gets exactly one atom.

---

## Decision Tree

```
Need per-entity reactive state?
├── Single entity type with ID?
│   └── Fermion.fromSchema(Schema).withKey("id")
├── Composite key (userId + orderId)?
│   └── Fermion.fromSchema(Schema).withCompositeKey(["userId", "orderId"])
├── Need async fetch on access?
│   └── .withFetch((key) => Effect.tryPromise(...))
├── Need persistence?
│   └── .withPersist((value) => Effect.tryPromise(...))
└── Testing / local state only?
    └── .provideLayer(makeMemoryAlgebra())
```

---

## CRITICAL: Registry Pattern

**This is the most common source of bugs with effect-atom and Fermion.**

### The Problem

`Atom.set()` and `Atom.get()` return **Effects** that require `AtomRegistry` context:

```typescript
// Atom.set() returns Effect<void, never, AtomRegistry>
// Atom.get() returns Effect<A, never, AtomRegistry>

// WRONG - This does NOTHING! The Effect is never executed
Atom.set(myAtom, newValue)  // ❌ Returns Effect, doesn't mutate

// WRONG - This returns an Effect, not the value
const value = Atom.get(myAtom)  // ❌ Returns Effect<A>, not A
```

### The Solution: Registry Singleton

Create a registry singleton and use `registry.set()` / `registry.get()` for
synchronous mutations:

```typescript
import { Registry, RegistryContext } from "@effect-atom/atom-react"

// 1. Create singleton registry at module level
export const myRegistry = Registry.make()

// 2. Create Provider wrapper
export function MyRegistryProvider({ children }: { children: React.ReactNode }) {
  return (
    <RegistryContext.Provider value={myRegistry}>
      {children}
    </RegistryContext.Provider>
  )
}

// 3. Use registry.set() / registry.get() for sync mutations
function handleUpdate(newValue: string) {
  // ✓ Synchronous - mutates immediately
  myRegistry.set(myAtom, newValue)

  // ✓ Synchronous - returns value immediately
  const current = myRegistry.get(myAtom)
}
```

### When to Use Which

| Context | Pattern | Why |
|---------|---------|-----|
| Inside `Effect.gen()` | `Atom.set()` / `Atom.get()` | Effect context provides AtomRegistry |
| Inside `runtimeAtom.fn()` | `ctx.set()` / `ctx.get()` | Context parameter provides access |
| React callback / event handler | `registry.set()` / `registry.get()` | Synchronous, no Effect needed |
| Outside any context | `registry.set()` / `registry.get()` | Only option for sync access |

### Complete Example: IoT Sensor Pattern

```typescript
// atoms/index.ts
import { Atom, Registry, RegistryContext } from "@effect-atom/atom-react"
import * as Fermion from "@/lib/fermion"
import { Schema, Effect } from "effect"

// ─── Registry Singleton ───────────────────────────────────────
export const iotRegistry = Registry.make()

export function IoTRegistryProvider({ children }: { children: React.ReactNode }) {
  return React.createElement(
    RegistryContext.Provider,
    { value: iotRegistry },
    children
  )
}

// ─── Sensor Schema ────────────────────────────────────────────
const SensorSchema = Schema.Struct({
  id: Schema.String.pipe(Schema.brand("SensorId")),
  name: Schema.NonEmptyString,
  value: Schema.Number,
  unit: Schema.String,
  lastUpdate: Schema.DateFromSelf,
})
type Sensor = typeof SensorSchema.Type

// ─── Fermion Family ───────────────────────────────────────────
export const sensorFamily = Fermion.fromSchema(SensorSchema)
  .withKey("id")
  .withFetch((id) =>
    Effect.tryPromise(() =>
      fetch(`/api/sensors/${id}`).then(r => r.json())
    )
  )
  .build()

// ─── Log Atom (for debugging) ─────────────────────────────────
export const iotLogAtom = Atom.make<readonly string[]>([])

// ─── Sync Mutation Helper ─────────────────────────────────────
export function logMessage(msg: string) {
  const timestamp = new Date().toISOString().slice(11, 19)
  const current = iotRegistry.get(iotLogAtom)
  // Keep last 15 messages
  iotRegistry.set(iotLogAtom, [...current.slice(-14), `${timestamp}: ${msg}`])
}
```

```tsx
// Component.tsx
import { useAtomValue } from "@effect-atom/atom-react"
import { sensorFamily, iotLogAtom, logMessage, IoTRegistryProvider } from "./atoms"
import * as Result from "@effect-atom/atom/Result"

function SensorDisplay({ sensorId }: { sensorId: string }) {
  const sensorResult = useAtomValue(sensorFamily(sensorId))

  useEffect(() => {
    // Trigger fetch
    sensorFamily.fetch(sensorId).pipe(Effect.runPromise)
    logMessage(`Fetching sensor ${sensorId}`)
  }, [sensorId])

  return Result.match(sensorResult, {
    onInitial: () => <Loading />,
    onSuccess: (sensor) => (
      <div>
        <span>{sensor.name}</span>
        <span>{sensor.value} {sensor.unit}</span>
      </div>
    ),
    onFailure: (error) => <Error error={error} />,
  })
}

function SensorLog() {
  const logs = useAtomValue(iotLogAtom)
  return (
    <pre className="text-xs">
      {logs.join("\n")}
    </pre>
  )
}

// App must wrap with provider
function App() {
  return (
    <IoTRegistryProvider>
      <SensorDisplay sensorId="temp-001" />
      <SensorLog />
    </IoTRegistryProvider>
  )
}
```

---

## Builder API Reference

### Entry Point: `fromSchema()`

```typescript
import * as Fermion from "@/lib/fermion"
import { Schema } from "effect"

const UserSchema = Schema.Struct({
  id: Schema.String.pipe(Schema.brand("UserId")),
  name: Schema.NonEmptyString,
  email: Schema.String,
})

const userFamily = Fermion.fromSchema(UserSchema)
  .withKey("id")
  .withFetch(...)
  .build()
```

### Key Configuration

#### Single Key: `.withKey(field)`

```typescript
// Key type inferred from schema field
const family = Fermion.fromSchema(UserSchema)
  .withKey("id")  // Key type: string & Brand<"UserId">
```

#### Composite Key: `.withCompositeKey([...fields])`

```typescript
const OrderSchema = Schema.Struct({
  userId: Schema.String.pipe(Schema.brand("UserId")),
  orderId: Schema.String.pipe(Schema.brand("OrderId")),
  items: Schema.Array(OrderItemSchema),
})

const orderFamily = Fermion.fromSchema(OrderSchema)
  .withCompositeKey(["userId", "orderId"])
  // Key type: { readonly userId: string; readonly orderId: string }

// Usage
const orderAtom = orderFamily({ userId: "u-1", orderId: "o-42" })
```

### Operations

#### `.withFetch()` - Required

```typescript
.withFetch((id) =>
  Effect.tryPromise(() =>
    fetch(`/api/users/${id}`).then(r => r.json())
  )
)

// With service dependency
.withFetch((id) =>
  Effect.gen(function* () {
    const api = yield* UserApi
    return yield* api.fetchUser(id)
  })
)
```

#### `.withPersist()` - Optional

```typescript
.withPersist((user) =>
  Effect.tryPromise(() =>
    fetch(`/api/users/${user.id}`, {
      method: "PUT",
      body: JSON.stringify(user)
    })
  )
)
```

#### `.withRemove()` - Optional

```typescript
.withRemove((id) =>
  Effect.tryPromise(() =>
    fetch(`/api/users/${id}`, { method: "DELETE" })
  )
)
```

### Lifecycle Hooks

#### `.withBeforeFetch()`

```typescript
.withBeforeFetch((id) =>
  Effect.log(`Fetching user ${id}`)
)
```

#### `.withAfterFetch()`

```typescript
.withAfterFetch((id, user) =>
  Effect.gen(function* () {
    yield* Effect.log(`Fetched user ${user.name}`)
    // Can transform the value
    return { ...user, fetchedAt: new Date() }
  })
)
```

### Dependency Injection

#### `.provideLayer()`

```typescript
.provideLayer(HttpClient.layer)
.provideLayer(UserCacheLive)
```

#### `.provideService()`

```typescript
.provideService(UserCache, {
  get: (id) => Effect.succeed(undefined),
  set: (id, user) => Effect.void,
})
```

### Configuration

#### `.withLifecycle()`

```typescript
// Entity cache - persist indefinitely (default)
.withLifecycle({ keepAlive: true })

// Transient data - reset when no subscribers
.withLifecycle({ keepAlive: false })

// Time-limited cache
.withLifecycle({ keepAlive: true, ttl: Duration.minutes(5) })
```

#### `.withTTL()` - Shorthand

```typescript
// Equivalent to .withLifecycle({ keepAlive: true, ttl })
.withTTL(Duration.minutes(5))
```

#### `.withReactivity()` - Fine-grained subscriptions

```typescript
.withReactivity((key, user) => [user.email, user.role])
```

### Terminal Operations

#### `.build()` - All dependencies satisfied

```typescript
// Type-safe: fails to compile if R is not `never`
const family = Fermion.fromSchema(UserSchema)
  .withKey("id")
  .withFetch(...)
  .provideLayer(HttpClient.layer)  // Satisfies HttpClient requirement
  .build()  // ✓ Compiles
```

#### `.buildWithDeps()` - Runtime dependency injection

```typescript
// Use when layers will be provided at runtime via Atom.runtime
const family = Fermion.fromSchema(UserSchema)
  .withKey("id")
  .withFetch((id) => Effect.flatMap(UserApi, api => api.fetch(id)))
  .buildWithDeps()  // R = UserApi

// Provide at runtime
const runtimeAtom = Atom.runtime(UserApiLive)
```

---

## Fermion Interface

Once built, a Fermion family provides:

```typescript
interface Fermion<A, I, E, R, K> {
  // Callable - get atom for key (memoized)
  (key: K): Atom<Result<A, E>>

  // Same as callable
  atomFor(key: K): Atom<Result<A, E>>

  // Effectful operations (require AtomRegistry)
  fetch(key: K): Effect<A, E, R | AtomRegistry>
  persist(value: A): Effect<void, E, R | AtomRegistry>
  remove(key: K): Effect<void, E, R | AtomRegistry>

  // Utilities
  invalidate(key: K): Effect<void, never, AtomRegistry>
  prefetch(keys: readonly K[]): Effect<void, E, R | AtomRegistry>

  // Metadata
  schema: Schema<A, I, R>
  keyField: string | readonly string[]
}
```

### Usage

```typescript
// Get atom (memoized - same key always returns same atom)
const userAtom = userFamily("user-123")
const sameAtom = userFamily("user-123")  // Same reference

// React subscription
const userResult = useAtomValue(userFamily(userId))

// Trigger fetch
await userFamily.fetch(userId).pipe(Effect.runPromise)

// Persist changes
await userFamily.persist(updatedUser).pipe(Effect.runPromise)

// Remove entity
await userFamily.remove(userId).pipe(Effect.runPromise)

// Invalidate (force refetch on next access)
await userFamily.invalidate(userId).pipe(Effect.runPromise)

// Prefetch multiple
await userFamily.prefetch(["u-1", "u-2", "u-3"]).pipe(Effect.runPromise)
```

---

## Algebra Patterns

### What is FermionAlgebra?

The algebra defines the data operations (fetch, persist, remove) that power a
Fermion family. Different interpreters implement the same interface for
different backends.

```typescript
interface FermionAlgebra<A, E, R, K> {
  readonly fetch: (key: K) => Effect<A, E, R>
  readonly persist?: (value: A) => Effect<void, E, R>
  readonly remove?: (key: K) => Effect<void, E, R>
  readonly beforeFetch?: (key: K) => Effect<void, E, R>
  readonly afterFetch?: (key: K, value: A) => Effect<A, E, R>
}
```

### Built-in Interpreters

#### `fromFunctions()` - Effect-based CRUD

```typescript
import { fromFunctions } from "@/lib/fermion"

const userAlgebra = fromFunctions({
  fetch: (id: string) =>
    Effect.tryPromise(() => api.getUser(id)),
  persist: (user: User) =>
    Effect.tryPromise(() => api.updateUser(user)),
  remove: (id: string) =>
    Effect.tryPromise(() => api.deleteUser(id)),
})
```

#### `fromFetch()` - HTTP endpoints

```typescript
import { fromFetch } from "@/lib/fermion"

const userAlgebra = fromFetch({
  baseUrl: "/api/users",
  // GET /api/users/{id}
  // PUT /api/users/{id}
  // DELETE /api/users/{id}
})
```

#### `makeMemoryAlgebra()` - Testing / local state

```typescript
import { makeMemoryAlgebra } from "@/lib/fermion"

// Creates in-memory storage with full CRUD
const testAlgebra = makeMemoryAlgebra<User, string>()

// Usage in tests
const family = Fermion.fromSchema(UserSchema)
  .withKey("id")
  .withFetch(testAlgebra.fetch)
  .withPersist(testAlgebra.persist)
  .withRemove(testAlgebra.remove)
  .build()
```

### Composing Algebras

#### `composeAlgebra()` - Merge operations

```typescript
import { composeAlgebra } from "@/lib/fermion"

const cacheAlgebra = fromFunctions({ fetch: cacheGet })
const apiAlgebra = fromFunctions({ fetch: apiFetch })

// Cache-then-API pattern
const composedAlgebra = composeAlgebra(cacheAlgebra, apiAlgebra)
```

#### `withHooks()` - Add lifecycle hooks

```typescript
import { withHooks } from "@/lib/fermion"

const hookedAlgebra = withHooks(baseAlgebra, {
  beforeFetch: (key) => Effect.log(`Fetching ${key}`),
  afterFetch: (key, value) => {
    analytics.track("entity_fetched", { key })
    return Effect.succeed(value)
  },
})
```

---

## React Integration

### Basic Pattern

```tsx
import { useAtomValue } from "@effect-atom/atom-react"
import * as Result from "@effect-atom/atom/Result"
import { userFamily } from "./atoms"

function UserProfile({ userId }: { userId: string }) {
  const userResult = useAtomValue(userFamily(userId))

  // Trigger fetch on mount
  useEffect(() => {
    userFamily.fetch(userId).pipe(Effect.runPromise)
  }, [userId])

  return Result.match(userResult, {
    onInitial: () => <Skeleton />,
    onSuccess: (user) => <ProfileCard user={user} />,
    onFailure: (error) => <ErrorBanner error={error} />,
  })
}
```

### With Loading States

```tsx
function UserProfile({ userId }: { userId: string }) {
  const userResult = useAtomValue(userFamily(userId))
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await userFamily.fetch(userId).pipe(Effect.runPromise)
    setIsRefreshing(false)
  }

  return (
    <div>
      {Result.isSuccess(userResult) && (
        <ProfileCard user={userResult.value} />
      )}
      <button onClick={handleRefresh} disabled={isRefreshing}>
        {isRefreshing ? "Refreshing..." : "Refresh"}
      </button>
    </div>
  )
}
```

### Optimistic Updates

```tsx
function EditableUser({ userId }: { userId: string }) {
  const userResult = useAtomValue(userFamily(userId))

  const handleUpdate = async (newName: string) => {
    if (!Result.isSuccess(userResult)) return

    const user = userResult.value
    const updated = { ...user, name: newName }

    // Optimistic update via registry
    myRegistry.set(userFamily(userId), Result.success(updated))

    try {
      await userFamily.persist(updated).pipe(Effect.runPromise)
    } catch {
      // Rollback on failure
      myRegistry.set(userFamily(userId), Result.success(user))
    }
  }

  // ...
}
```

---

## Testing Patterns

### Isolated Registry

```typescript
import { Registry } from "@effect-atom/atom-react"
import { makeMemoryAlgebra } from "@/lib/fermion"

describe("UserFamily", () => {
  let testRegistry: Registry
  let testFamily: Fermion<User, ...>

  beforeEach(() => {
    testRegistry = Registry.make()

    const memoryAlgebra = makeMemoryAlgebra<User, string>()
    testFamily = Fermion.fromSchema(UserSchema)
      .withKey("id")
      .withFetch(memoryAlgebra.fetch)
      .withPersist(memoryAlgebra.persist)
      .build()
  })

  it("fetches user by id", async () => {
    // Seed data
    await testFamily.persist({
      id: "u-1",
      name: "Alice",
      email: "alice@test.com",
    }).pipe(Effect.runPromise)

    // Fetch
    const user = await testFamily.fetch("u-1").pipe(Effect.runPromise)

    expect(user.name).toBe("Alice")
  })

  it("updates atom on fetch", async () => {
    await testFamily.fetch("u-1").pipe(Effect.runPromise)

    const atomValue = testRegistry.get(testFamily("u-1"))
    expect(Result.isSuccess(atomValue)).toBe(true)
  })
})
```

### Snapshot Testing

```typescript
it("matches family state snapshot", () => {
  // ... setup and operations

  const state = testRegistry.get(testFamily("u-1"))
  expect(state).toMatchSnapshot()
})
```

---

## Anti-Patterns

### ANTIPATTERN:ATOM_SET_WITHOUT_REGISTRY

```typescript
// ❌ WRONG - Returns Effect, never executed
function handleClick() {
  Atom.set(myAtom, newValue)  // Does nothing!
}

// ✓ CORRECT - Use registry for sync mutations
function handleClick() {
  myRegistry.set(myAtom, newValue)  // Mutates immediately
}
```

### ANTIPATTERN:FAMILY_IN_COMPONENT

```typescript
// ❌ WRONG - Creates new family on every render
function Bad({ schema }) {
  const family = Fermion.fromSchema(schema).withKey("id").build()
  return <Child family={family} />
}

// ✓ CORRECT - Define at module level
const userFamily = Fermion.fromSchema(UserSchema).withKey("id").build()

function Good() {
  return <Child family={userFamily} />
}
```

### ANTIPATTERN:MISSING_PROVIDER

```typescript
// ❌ WRONG - No registry context, useAtomValue may not work
function App() {
  return <UserProfile userId="123" />
}

// ✓ CORRECT - Wrap with registry provider
function App() {
  return (
    <MyRegistryProvider>
      <UserProfile userId="123" />
    </MyRegistryProvider>
  )
}
```

### ANTIPATTERN:FORGETTING_EFFECT_EXECUTION

```typescript
// ❌ WRONG - Effect returned but never run
function handleFetch() {
  userFamily.fetch(userId)  // Returns Effect, doesn't execute!
}

// ✓ CORRECT - Run the Effect
function handleFetch() {
  userFamily.fetch(userId).pipe(Effect.runPromise)
}

// ✓ ALSO CORRECT - In Effect context
const program = Effect.gen(function* () {
  const user = yield* userFamily.fetch(userId)
})
```

---

## Canonical Files

| File | Purpose |
|------|---------|
| `src/lib/fermion/index.ts` | Public API exports |
| `src/lib/fermion/Fermion.ts` | Builder implementation |
| `src/lib/fermion/types.ts` | Type definitions |
| `src/lib/fermion/algebra/` | Algebra interface and composition |
| `src/lib/fermion/interpreters/` | Built-in interpreters (effect, memory) |
| `src/components/testbed/FermionTestbed.tsx` | Usage examples with registry pattern |

---

## Related Skills

- `/effect-atom-integration` - Atom.runtime, Atom.make, operation atoms
- `/effect-schema-mastery` - Schema.TaggedStruct, branded types
- `/effect-service-authoring` - Effect.Service patterns for algebras
- `/effect-patterns` - General Effect-TS patterns
