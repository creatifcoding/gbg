# Integration Patterns

> up: INDEX.md
> prereqs: structs.md, classes.md, transformations.md
> provides: tmnl-aliases, effect-services, eventlog, atoms

## @tmnl/* Alias Pattern {#aliases}

In the `@tmnl/*` workspace, Effect v4 is installed via npm aliases to coexist with v3:

```ts
// @tmnl/* packages use these imports:
import { Schema, SchemaTransformation, SchemaGetter } from "effect-v4"
import { Schema as SchemaV4 } from "effect-v4"

// NOT "effect" — that resolves to v3 in the monorepo root
```

The alias mapping:

| Alias | Resolves to | Version |
|---|---|---|
| `effect-v4` | `effect@4.0.0-beta.23` | v4 |
| `effect-vitest-v4` | `@effect/vitest@4.0.0-beta.23` | v4 |
| `effect-atom-react-v4` | `@effect-atom/react@4.0.0-beta.23` | v4 |

When v4 goes GA: bulk rename `effect-v4` → `effect` across all `@tmnl/*` packages.

### Module Boundary Rules

NX enforces isolation via `eslint.config.mjs`:
- Packages tagged `effect:v4` can only depend on other `effect:v4` packages
- Bare `import from "effect"` is banned in `effect:v4` packages

## With Effect Services

Schema-defined types work naturally as service payloads:

```ts
import { Schema, Effect, Context, Layer } from "effect-v4"

// Domain type
class WorkOrder extends Schema.TaggedClass<WorkOrder>()("WorkOrder", {
  id: Schema.String,
  status: Schema.Literals(["pending", "active", "completed"]),
  priority: Schema.Number.check(Schema.isBetween({ minimum: 1, maximum: 5 }))
}) {}

// Service that uses the schema
class WorkOrderRepo extends Context.Tag("WorkOrderRepo")<WorkOrderRepo, {
  readonly create: (input: unknown) => Effect.Effect<WorkOrder>
  readonly findById: (id: string) => Effect.Effect<WorkOrder>
}>() {}

// Implementation validates with Schema
const WorkOrderRepoLive = Layer.succeed(WorkOrderRepo, {
  create: (input) => Effect.try(() => Schema.decodeUnknownSync(WorkOrder)(input)),
  findById: (id) => Effect.fail(new Error("not found"))  // stub
})
```

## With EventLog

EventLog requires Schema-backed payloads — this is non-negotiable:

```ts
import { Schema } from "effect-v4"

// Event payload — must be a Schema
const WorkOrderCreated = Schema.Struct({
  id: Schema.String,
  status: Schema.Literals(["pending", "active", "completed"]),
  createdAt: Schema.Date
})

// The schema IS the contract between producer and consumer
```

## With Atoms (effect-atom)

Schema validates data flowing into atoms:

```ts
import { Schema } from "effect-v4"
import { Atom } from "effect-v4/unstable/reactivity"

// Schema defines the shape
const AppConfig = Schema.Struct({
  theme: Schema.Literals(["light", "dark"]),
  fontSize: Schema.Number.check(Schema.isBetween({ minimum: 12, maximum: 24 }))
})

// Atom holds the validated state
const configAtom = Atom.make(
  Schema.decodeUnknownSync(AppConfig)({ theme: "dark", fontSize: 16 })
)
```

## Domain Modeling Pattern

The canonical TMNL pattern for domain types in v4:

```ts
import { Schema } from "effect-v4"

// 1. Branded IDs
const WorkOrderId = Schema.String.pipe(
  Schema.brand("WorkOrderId"),
  Schema.check(Schema.isNonEmpty())
)

// 2. Status as Literals (not raw union types)
const Status = Schema.Literals(["draft", "pending", "active", "completed", "archived"])

// 3. Domain entity as TaggedClass
class WorkOrder extends Schema.TaggedClass<WorkOrder>()("WorkOrder", {
  id: WorkOrderId,
  status: Status,
  title: Schema.String.check(Schema.isMinLength(1)),
  priority: Schema.Number.check(Schema.isBetween({ minimum: 1, maximum: 5 })),
  createdAt: Schema.Date
}) {
  get isActive() { return this.status === "active" }
  
  withStatus(s: typeof Status.Type) {
    return new WorkOrder({ ...this, status: s })
  }
}

// 4. Error types as TaggedErrorClass
class WorkOrderNotFound extends Schema.TaggedErrorClass<WorkOrderNotFound>()("WorkOrderNotFound", {
  id: WorkOrderId
}) {}

// 5. JSON codec for serialization
const WorkOrderJson = Schema.toCodecJson(WorkOrder)
```
