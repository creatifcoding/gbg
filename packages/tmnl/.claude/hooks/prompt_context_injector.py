#!/usr/bin/env python3
"""
UserPromptSubmit Hook: Keyphrase-Triggered Context Injector

Detects domain keywords and injects structured keyphrases that trigger skill loading.
Format: [EFFECT:<CONCEPT>:<ACTION>]

Input (stdin): JSON with prompt
Output (stdout): JSON with additionalContext containing keyphrases

Exit codes:
  0 - Success
"""

import json
import re
import sys
from dataclasses import dataclass, field
from typing import Optional


# =============================================================================
# KEYPHRASE TAXONOMY
# =============================================================================
@dataclass
class TriggerRule:
    """Maps keywords to keyphrases."""
    concept: str
    action: str
    keywords: list[str]
    skill: str
    context: str

    @property
    def keyphrase(self) -> str:
        return f"[EFFECT:{self.concept}:{self.action}]"


# Service patterns
SERVICE_RULES = [
    TriggerRule(
        concept="SERVICE",
        action="CREATE",
        keywords=["create service", "new service", "define service", "service class", "Effect.Service", "database service", "build service", "implement service"],
        skill="effect-service-authoring",
        context="""**Service Creation Pattern:**
```typescript
class MyService extends Effect.Service<MyService>()("MyService", {
  effect: Effect.gen(function* () {
    return { method: () => Effect.succeed("result") }
  }),
  dependencies: []
}) {}
```"""
    ),
    TriggerRule(
        concept="SERVICE",
        action="COMPOSE",
        keywords=["compose layer", "layer composition", "merge layer", "combine service", "Layer.merge", "compose multiple layers", "layers together", "layer.provide"],
        skill="effect-service-authoring",
        context="""**Layer Composition Pattern:**
```typescript
const AppLayer = Layer.mergeAll(
  DatabaseService.Default,
  ConfigService.Default,
  LoggingService.Default
)
```"""
    ),
    TriggerRule(
        concept="SERVICE",
        action="PROVIDE",
        keywords=["provide service", "inject dependency", "Effect.provide", "dependency injection", "inject dependencies", "provide dependencies"],
        skill="effect-service-authoring",
        context="""**Service Provision Pattern:**
```typescript
const program = Effect.gen(function* () {
  const db = yield* DatabaseService
  return yield* db.query("SELECT * FROM users")
})

Effect.runPromise(program.pipe(Effect.provide(DatabaseService.Default)))
```"""
    ),
]

# Schema patterns
SCHEMA_RULES = [
    TriggerRule(
        concept="SCHEMA",
        action="DEFINE",
        keywords=["define schema", "create schema", "Schema.Struct", "TaggedClass", "branded type", "Schema.brand", "user schema", "define a schema"],
        skill="effect-schema-mastery",
        context="""**Schema Definition Pattern:**
```typescript
// Tagged class for domain entities
class User extends Schema.TaggedClass<User>()("User", {
  id: Schema.String.pipe(Schema.brand("UserId")),
  email: Schema.NonEmptyString,
  role: Schema.Literal("admin", "user")
}) {}

// Branded types for type safety
const UserId = Schema.String.pipe(Schema.brand("UserId"))
type UserId = Schema.Schema.Type<typeof UserId>
```"""
    ),
    TriggerRule(
        concept="SCHEMA",
        action="TRANSFORM",
        keywords=["transform schema", "encode decode", "Schema.transform", "schema conversion"],
        skill="effect-schema-mastery",
        context="""**Schema Transform Pattern:**
```typescript
const DateFromString = Schema.transform(
  Schema.String,
  Schema.DateFromSelf,
  {
    decode: (s) => new Date(s),
    encode: (d) => d.toISOString()
  }
)
```"""
    ),
    TriggerRule(
        concept="SCHEMA",
        action="VALIDATE",
        keywords=["validate", "parse", "decode", "Schema.decodeUnknown", "runtime validation"],
        skill="effect-schema-mastery",
        context="""**Schema Validation Pattern:**
```typescript
const decodeUser = Schema.decodeUnknown(User)

// Sync (throws on error)
const user = Schema.decodeUnknownSync(User)(data)

// Effect (typed error channel)
const userEffect = Schema.decodeUnknown(User)(data)
// Effect<User, ParseError, never>
```"""
    ),
]

# Error patterns
ERROR_RULES = [
    TriggerRule(
        concept="ERROR",
        action="DEFINE",
        keywords=["custom error", "tagged error", "Data.TaggedError", "error type", "define error"],
        skill="effect-error-handling",
        context="""**Error Definition Pattern:**
```typescript
class NotFound extends Data.TaggedError("NotFound")<{
  readonly resource: string
  readonly id: string
}> {}

class ValidationError extends Data.TaggedError("ValidationError")<{
  readonly field: string
  readonly message: string
}> {}
```"""
    ),
    TriggerRule(
        concept="ERROR",
        action="HANDLE",
        keywords=["handle error", "catch error", "error handling", "catchTag", "catchAll", "handles errors", "handle errors"],
        skill="effect-error-handling",
        context="""**Error Handling Pattern:**
```typescript
const handled = program.pipe(
  Effect.catchTag("NotFound", (e) =>
    Effect.succeed({ fallback: true, resource: e.resource })
  ),
  Effect.catchTag("ValidationError", (e) =>
    Effect.fail(new UserFacingError({ message: e.message }))
  )
)
```"""
    ),
    TriggerRule(
        concept="ERROR",
        action="RECOVER",
        keywords=["recover", "fallback", "retry", "orElse", "error recovery"],
        skill="effect-error-handling",
        context="""**Error Recovery Pattern:**
```typescript
const withRetry = program.pipe(
  Effect.retry(Schedule.exponential("100 millis").pipe(
    Schedule.compose(Schedule.recurs(3))
  ))
)

const withFallback = program.pipe(
  Effect.orElse(() => Effect.succeed(defaultValue))
)
```"""
    ),
]

# Stream patterns
STREAM_RULES = [
    TriggerRule(
        concept="STREAM",
        action="CREATE",
        keywords=["create stream", "Stream.async", "stream from", "emit stream"],
        skill="effect-stream-patterns",
        context="""**Stream Creation Pattern:**
```typescript
const events = Stream.async<Event, Error>((emit) => {
  socket.on("message", (data) => emit.single(data))
  socket.on("error", (err) => emit.fail(err))
  socket.on("close", () => emit.end())
  return Effect.sync(() => socket.close())
})
```"""
    ),
    TriggerRule(
        concept="STREAM",
        action="CONSUME",
        keywords=["consume stream", "stream forEach", "runCollect", "stream subscription"],
        skill="effect-stream-patterns",
        context="""**Stream Consumption Pattern:**
```typescript
// Collect all
const items = yield* Stream.runCollect(myStream)

// Process each
yield* Stream.runForEach(myStream, (item) =>
  Effect.log(`Processing: ${item}`)
)
```"""
    ),
    TriggerRule(
        concept="STREAM",
        action="TRANSFORM",
        keywords=["transform stream", "stream map", "stream filter", "stream pipe"],
        skill="effect-stream-patterns",
        context="""**Stream Transform Pattern:**
```typescript
const processed = stream.pipe(
  Stream.map((x) => x * 2),
  Stream.filter((x) => x > 10),
  Stream.mapEffect((x) => saveToDb(x)),
  Stream.tap((x) => Effect.log(`Saved: ${x}`))
)
```"""
    ),
]

# Fiber patterns
FIBER_RULES = [
    TriggerRule(
        concept="FIBER",
        action="SPAWN",
        keywords=["fork", "spawn fiber", "background task", "Effect.fork", "parallel"],
        skill="effect-fiber-concurrency",
        context="""**Fiber Spawn Pattern:**
```typescript
const fiber = yield* Effect.fork(longRunningTask)

// Fork daemon (survives parent)
const daemon = yield* Effect.forkDaemon(backgroundSync)

// Fork scoped (tied to scope)
const scoped = yield* Effect.forkScoped(scopedTask)
```"""
    ),
    TriggerRule(
        concept="FIBER",
        action="JOIN",
        keywords=["join fiber", "await fiber", "Fiber.join", "wait for fiber"],
        skill="effect-fiber-concurrency",
        context="""**Fiber Join Pattern:**
```typescript
const fiber = yield* Effect.fork(task)
// ... do other work ...
const result = yield* Fiber.join(fiber)

// Join with timeout
const result = yield* Fiber.join(fiber).pipe(
  Effect.timeout("5 seconds")
)
```"""
    ),
    TriggerRule(
        concept="FIBER",
        action="INTERRUPT",
        keywords=["interrupt", "cancel fiber", "Fiber.interrupt", "cancellation"],
        skill="effect-fiber-concurrency",
        context="""**Fiber Interruption Pattern:**
```typescript
const fiber = yield* Effect.fork(task)
// ...
yield* Fiber.interrupt(fiber)

// Interruptible region
const interruptible = Effect.interruptible(task)

// Uninterruptible region
const critical = Effect.uninterruptible(criticalSection)
```"""
    ),
]

# Scope patterns
SCOPE_RULES = [
    TriggerRule(
        concept="SCOPE",
        action="ACQUIRE",
        keywords=["acquire resource", "Scope", "acquireRelease", "resource management", "open file", "connection pool"],
        skill="effect-scope-resources",
        context="""**Resource Acquisition Pattern:**
```typescript
const managed = Effect.acquireRelease(
  Effect.sync(() => openConnection()),
  (conn) => Effect.sync(() => conn.close())
)

// Use with scoped
const program = Effect.scoped(
  Effect.gen(function* () {
    const conn = yield* managed
    return yield* conn.query("SELECT 1")
  })
)
```"""
    ),
    TriggerRule(
        concept="SCOPE",
        action="RELEASE",
        keywords=["release resource", "cleanup", "finalizer", "addFinalizer", "ensuring"],
        skill="effect-scope-resources",
        context="""**Resource Release Pattern:**
```typescript
const withCleanup = Effect.gen(function* () {
  const scope = yield* Scope.make()
  yield* Scope.addFinalizer(scope, Effect.log("Cleaning up..."))
  // ... work ...
})

// Ensuring always runs
const ensured = task.pipe(
  Effect.ensuring(Effect.log("Always runs"))
)
```"""
    ),
]

# Match patterns
MATCH_RULES = [
    TriggerRule(
        concept="MATCH",
        action="EXHAUSTIVE",
        keywords=["exhaustive match", "Match.exhaustive", "pattern match all", "exhaustively", "match exhaustive"],
        skill="effect-match-patterns",
        context="""**Exhaustive Match Pattern:**
```typescript
const handle = Match.type<Event>().pipe(
  Match.tag("Created", (e) => `Created: ${e.id}`),
  Match.tag("Updated", (e) => `Updated: ${e.id}`),
  Match.tag("Deleted", (e) => `Deleted: ${e.id}`),
  Match.exhaustive
)
```"""
    ),
    TriggerRule(
        concept="MATCH",
        action="DISCRIMINATE",
        keywords=["discriminate", "_tag", "tagged union", "discriminated union"],
        skill="effect-match-patterns",
        context="""**Discriminated Union Pattern:**
```typescript
type Event =
  | { _tag: "Created"; id: string }
  | { _tag: "Updated"; id: string; data: unknown }
  | { _tag: "Deleted"; id: string }

const process = (event: Event) => {
  switch (event._tag) {
    case "Created": return handleCreate(event)
    case "Updated": return handleUpdate(event)
    case "Deleted": return handleDelete(event)
  }
}
```"""
    ),
]

# Atom patterns
ATOM_RULES = [
    TriggerRule(
        concept="ATOM",
        action="SYNC",
        keywords=["registry.set", "registry.get", "sync atom", "react callback atom", "useState replacement"],
        skill="fermion-patterns",
        context="""**Sync Atom Pattern (React callbacks):**
```typescript
// Module level
export const registry = Registry.make()
export const countAtom = Atom.make(0)

// In React component
const increment = () => {
  registry.set(countAtom, registry.get(countAtom) + 1)
}
```"""
    ),
    TriggerRule(
        concept="ATOM",
        action="EFFECT",
        keywords=["Atom.set", "Atom.get", "yield* Atom", "atom in effect"],
        skill="fermion-patterns",
        context="""**Effect Atom Pattern (inside Effect.gen):**
```typescript
const program = Effect.gen(function* () {
  const current = yield* Atom.get(countAtom)
  yield* Atom.set(countAtom, current + 1)
})
```"""
    ),
    TriggerRule(
        concept="ATOM",
        action="FAMILY",
        keywords=["Atom.family", "parameterized atom", "dynamic atom", "atom factory"],
        skill="fermion-patterns",
        context="""**Atom Family Pattern:**
```typescript
// Module level - NEVER inside component
const userAtom = Atom.family({
  key: (id: string) => id,
  make: (id) => Atom.make<User | null>(null)
})

// Usage
const user = registry.get(userAtom("user-123"))
```"""
    ),
    TriggerRule(
        concept="ATOM",
        action="RUNTIME",
        keywords=["Atom.runtime", "runtimeAtom", "atom runtime", "global layer", "addGlobalLayer", "runtimeAtom.fn"],
        skill="fermion-patterns",
        context="""**Atom Runtime Pattern:**
```typescript
// Create runtime with global layers
const runtimeAtom = Atom.runtime(
  Layer.mergeAll(DatabaseLayer, LoggingLayer)
)

// Runtime function for service operations
const ops = {
  fetchUser: runtimeAtom.fn<string>()(
    (id, ctx) => Effect.gen(function* () {
      ctx.set(loadingAtom, true)
      const user = yield* UserService.getById(id)
      ctx.set(userAtom, user)
      return user
    })
  )
}
```"""
    ),
    TriggerRule(
        concept="ATOM",
        action="RESULT",
        keywords=["Result type", "Result.waiting", "Result.success", "Result.failure", "loading state atom", "async result"],
        skill="fermion-patterns",
        context="""**Result Pattern (async state):**
```typescript
// Result = Initial | Waiting | Success | Failure
const resultAtom = Atom.make<Result.Result<User, Error>>(Result.initial())

// In Effect
ctx.set(resultAtom, Result.waiting())
const user = yield* UserService.get(id)
ctx.set(resultAtom, Result.success(user))

// In React - pattern match
Result.match(result, {
  onInitial: () => <Placeholder />,
  onWaiting: () => <Spinner />,
  onSuccess: (user) => <UserCard user={user} />,
  onFailure: (err) => <ErrorBanner error={err} />
})
```"""
    ),
    TriggerRule(
        concept="ATOM",
        action="BATCH",
        keywords=["Atom.batch", "batch atom", "batch updates", "atomic updates", "batch mutation"],
        skill="fermion-patterns",
        context="""**Batch Pattern (atomic updates):**
```typescript
// Batch multiple updates atomically
registry.batch(() => {
  registry.set(loadingAtom, false)
  registry.set(dataAtom, newData)
  registry.set(errorAtom, null)
})
// Single re-render, not three
```"""
    ),
]

# Combine all rules
ALL_RULES = (
    SERVICE_RULES +
    SCHEMA_RULES +
    ERROR_RULES +
    STREAM_RULES +
    FIBER_RULES +
    SCOPE_RULES +
    MATCH_RULES +
    ATOM_RULES
)


# =============================================================================
# EFFECT ANTI-PATTERNS
# =============================================================================
EFFECT_ANTI_PATTERNS = """
⚠️ **EFFECT ANTI-PATTERNS (avoid these):**
- `throw new Error` → use `Data.TaggedError`
- `await` inside `Effect.gen` → use `yield*`
- `as any` casts → validate with `Schema.decode`
- Global state → provide via `Layer`
- Raw `new Promise` → use `Effect.promise`
- Non-exhaustive match → use `Match.exhaustive`
"""


def detect_triggers(prompt: str) -> list[TriggerRule]:
    """Detect which rules match the prompt."""
    prompt_lower = prompt.lower()
    matches: list[TriggerRule] = []

    for rule in ALL_RULES:
        for keyword in rule.keywords:
            if keyword.lower() in prompt_lower:
                if rule not in matches:
                    matches.append(rule)
                break

    return matches


def build_injection(matches: list[TriggerRule]) -> str:
    """Build the context injection with keyphrases."""
    if not matches:
        return ""

    parts = []

    # Header with keyphrases
    keyphrases = " ".join(m.keyphrase for m in matches)
    parts.append(f"📌 **EFFECT CONTEXT TRIGGERED**")
    parts.append(f"Keyphrases: {keyphrases}")
    parts.append("")

    # Skill references
    skills = list(set(m.skill for m in matches))
    parts.append(f"Skills: {', '.join(f'/{s}' for s in skills)}")
    parts.append("")

    # Context snippets
    for match in matches[:3]:  # Limit to 3 contexts
        parts.append(f"### {match.keyphrase}")
        parts.append(match.context)
        parts.append("")

    # Always include anti-patterns for Effect-related queries
    parts.append(EFFECT_ANTI_PATTERNS)

    return "\n".join(parts)


def main():
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError:
        input_data = {}

    prompt = input_data.get("prompt", "")
    if not prompt:
        sys.exit(0)

    # Detect triggers
    matches = detect_triggers(prompt)

    if not matches:
        sys.exit(0)

    # Build injection
    injection = build_injection(matches)

    # Output as JSON
    output = {
        "hookSpecificOutput": {
            "hookEventName": "UserPromptSubmit",
            "additionalContext": injection
        }
    }

    print(json.dumps(output))
    sys.exit(0)


if __name__ == "__main__":
    main()
