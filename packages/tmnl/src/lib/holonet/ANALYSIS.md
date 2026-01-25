# Holonet Architecture Analysis

**Date**: 2025-01-12
**Author**: Val (Vigilant Architecture Layer)
**Status**: Analysis Complete — Awaiting Direction

---

## Executive Summary

The Holonet module is **architecturally shallow** with **severe code duplication** (~70% repeated patterns). The code is **not Effectual** — it reimplements Effect primitives rather than leveraging them. The lack of granular error discrimination reveals that the service hierarchy exists only superficially.

---

## 1. Code Duplication Inventory

### 1.1 JSON Codec Pattern (8 identical implementations)

Every service repeats this exact sequence:

```typescript
// DECODE (8x across 4 services)
const jsonStr = new TextDecoder().decode(msg.data);
const parsed =
  yield *
  Effect.try({
    try: () => JSON.parse(jsonStr) as unknown,
    catch: (err) =>
      new HolonetDecodeError({
        message: `Invalid JSON...`,
        subject,
        cause: err,
      }),
  });
const decoded = yield * Schema.decodeUnknown(schema)(parsed);

// ENCODE (14x across 5 services)
const encoded = yield * Schema.encode(schema)(data);
const jsonStr = JSON.stringify(encoded);
const bytes = new TextEncoder().encode(jsonStr);
```

**Files affected**:

- `NatsPubSubService.ts`: Lines 146-158, 250-262, 351-353, 106-108
- `NatsConsumerService.ts`: Lines 254-266, 288-300
- `NatsMonitoringService.ts`: Lines 63-75
- `NatsRpcService.ts`: Lines 64-66, 97-105, 141-152

### 1.2 Stream.async Boilerplate (5 identical implementations)

Every streaming method follows the exact same pattern:

```typescript
Stream.async<T, E>((emit) => {
  let sub: Subscription | null = null;
  let cancelled = false;

  const decodeMessage = (msg: Msg) =>
    Effect.gen(function* () {
      /* ... */
    });

  const run = async () => {
    const subscribeExit = await Effect.runPromiseExit(/* ... */);
    if (Exit.isFailure(subscribeExit)) {
      const error = Cause.failureOption(subscribeExit.cause);
      if (error._tag === 'Some') emit.fail(error.value);
      return;
    }
    sub = subscribeExit.value;

    for await (const msg of sub) {
      if (cancelled) break;
      const messageExit = await Effect.runPromiseExit(decodeMessage(msg));
      if (Exit.isFailure(messageExit)) {
        const error = Cause.failureOption(messageExit.cause);
        if (error._tag === 'Some') emit.fail(error.value);
        return;
      }
      emit.single(messageExit.value);
    }
    emit.end();
  };

  run();

  return Effect.sync(() => {
    cancelled = true;
    if (sub) sub.unsubscribe();
  });
});
```

**Files affected**:

- `NatsPubSubService.ts`: `subscribe()`, `queueSubscribe()`
- `NatsConsumerService.ts`: `consume()`
- `NatsMonitoringService.ts`: `subscribeSystem()`
- `NatsObjectService.ts`: `watch()`

### 1.3 Effect.tryPromise Wrapper (27 implementations)

All NATS operations wrapped identically:

```typescript
yield *
  Effect.tryPromise({
    try: () => natsOperation(),
    catch: (err) =>
      new HolonetSpecificError({
        message: `Failed to ${operation}: ${err}`,
        cause: err,
      }),
  });
```

---

## 2. Anti-Patterns Identified

### 2.1 Effect.runPromiseExit Inside Stream.async

**Current approach** (antipattern):

```typescript
Stream.async((emit) => {
  const run = async () => {
    const exit = await Effect.runPromiseExit(effect);
    if (Exit.isFailure(exit)) {
      const error = Cause.failureOption(exit.cause);
      if (error._tag === 'Some') emit.fail(error.value);
    }
  };
  run();
});
```

**Problem**: This drops out of Effect context, loses fiber semantics, and requires manual Exit/Cause handling.

**Effect provides**: `Stream.asyncEffect`, `Stream.asyncPush`, `Stream.fromQueue` which maintain Effect context.

### 2.2 Service Layer Without Composition

**Current structure**:

```
NatsConnectionService (scoped)
├── NatsPubSubService (effect) — reimplements publish/subscribe
├── NatsStreamService (effect) — reimplements JetStream publish
├── NatsConsumerService (effect) — reimplements consume
├── NatsObjectService (effect) — reimplements object store
├── NatsRpcService (effect) — reimplements request/reply
└── NatsMonitoringService (effect) — reimplements advisory subscribe
```

**Problem**: Each service reimplements the same patterns instead of composing from a base abstraction. For example:

- `NatsPubSubService.subscribe()` and `NatsMonitoringService.subscribeSystem()` are nearly identical
- `NatsPubSubService.request()` and `NatsRpcService.request()` duplicate timeout/reply handling
- All services duplicate JSON codec logic

### 2.3 Utility Methods in Service Interfaces

**Current approach**:

```typescript
interface NatsConsumerServiceShape {
  readonly getConnection: () => Effect.Effect<NatsConnection, never>;
  readonly getJetStream: () => Effect.Effect<JetStreamClient, never>;
  readonly getJetStreamManager: () => Effect.Effect<JetStreamManager, never>;
  readonly close: () => Effect.Effect<void, never>;
  // ... actual business methods
}
```

**Problem**: These are implementation leakage, not service contracts. They exist because the architecture lacks proper composition.

### 2.4 Error Type Explosion Without Discrimination

**17 error types defined**, but most follow identical pattern:

```typescript
class HolonetXxxError extends Data.TaggedError('HolonetXxxError')<{
  readonly message: string;
  readonly cause?: unknown;
  // maybe one context field
}>
```

**The errors don't discriminate behavior** — they're just string wrappers. A truly Effectual design would have:

- Errors that encode **recovery strategies** (retryable vs terminal)
- Errors that compose (e.g., `DecodeError` wrapping `JsonParseError`)
- Errors with **defect** vs **failure** distinction

---

## 3. What Effect Already Provides

### 3.1 PubSub<A> Module

Effect has a built-in `PubSub` module for typed publish/subscribe:

```typescript
import { PubSub, Queue } from 'effect';

// Create a bounded pubsub
const pubsub = yield * PubSub.bounded<Message>(100);

// Publish
yield * PubSub.publish(pubsub, message);

// Subscribe (returns Queue)
const queue = yield * PubSub.subscribe(pubsub);
const msg = yield * Queue.take(queue);
```

**Implication**: We should bridge NATS to Effect's PubSub, not reimplement pub/sub semantics.

### 3.2 Stream.asyncEffect / Stream.asyncPush

For callback-based sources that need Effect context:

```typescript
// asyncEffect - returns Stream<A, E, R>
Stream.asyncEffect<A, E, R>((emit) =>
  Effect.gen(function* () {
    const subscription = yield* subscribe(subject);
    // Setup happens in Effect context!

    return Effect.async<void>((resume) => {
      subscription.on('message', (msg) => emit.single(msg));
      subscription.on('error', (err) => emit.fail(new MyError(err)));
      subscription.on('end', () => emit.end());
    });
  })
);
```

### 3.3 Schema Transformation Pipelines

Instead of manual JSON.parse + Schema.decode:

```typescript
import { Schema } from 'effect';

// Compose decode pipeline
const JsonMessage = <A, I>(schema: Schema.Schema<A, I>) =>
  Schema.transform(Schema.Uint8ArrayFromSelf, schema, {
    decode: (bytes) => JSON.parse(new TextDecoder().decode(bytes)),
    encode: (data) => new TextEncoder().encode(JSON.stringify(data)),
  });

// Use as single operation
const decoded = yield * Schema.decodeUnknown(JsonMessage(MySchema))(bytes);
```

### 3.4 @effect/rpc

Effect has a full RPC framework that handles:

- Request/response correlation
- Timeout handling
- Schema validation
- Error propagation

**We reimplemented this from scratch** in `NatsRpcService`.

---

## 4. Service Interface Inconsistencies

| Operation | NatsPubSub                                           | NatsStream                             | NatsConsumer                              | NatsRpc                                                 | NatsMonitoring                     |
| --------- | ---------------------------------------------------- | -------------------------------------- | ----------------------------------------- | ------------------------------------------------------- | ---------------------------------- |
| Publish   | `publish(subject, data, schema)`                     | `publish(subject, data, schema, opts)` | —                                         | —                                                       | —                                  |
| Subscribe | `subscribe(subject, schema)`                         | —                                      | `consume(stream, consumer, opts, schema)` | —                                                       | `subscribeSystem(subject, schema)` |
| Request   | `request(subject, data, reqSchema, resSchema, opts)` | —                                      | —                                         | `request(subject, data, reqSchema, resSchema, timeout)` | —                                  |

**Inconsistencies**:

1. Parameter ordering varies (`opts` sometimes last, sometimes before schema)
2. `subscribe` vs `consume` vs `subscribeSystem` for the same concept
3. `request` exists in two services with different signatures
4. No common `Message<A>` type — each service defines its own

---

## 5. Missing Abstractions

### 5.1 No Codec Layer

Should exist: `src/lib/holonet/codec/`

```typescript
// json.ts
export const JsonCodec = {
  encode: <A>(data: A) =>
    Effect.try(() => new TextEncoder().encode(JSON.stringify(data))),
  decode: <A>(bytes: Uint8Array) =>
    Effect.try(() => JSON.parse(new TextDecoder().decode(bytes))),
};

// schema.ts
export const SchemaCodec = <A, I>(schema: Schema.Schema<A, I>) => ({
  encode: (data: A) =>
    Schema.encode(schema)(data).pipe(Effect.flatMap(JsonCodec.encode)),
  decode: (bytes: Uint8Array) =>
    JsonCodec.decode(bytes).pipe(Effect.flatMap(Schema.decodeUnknown(schema))),
});
```

### 5.2 No Base Subscription Abstraction

Should exist: `src/lib/holonet/subscription.ts`

```typescript
export const createSubscription = <A, E>(
  setup: () => Effect.Effect<AsyncIterable<unknown>, E>,
  decode: (raw: unknown) => Effect.Effect<A, E>,
  cleanup: () => Effect.Effect<void>
) => Stream.asyncEffect(/* ... */);
```

### 5.3 No Typed Subject Pattern

Should exist: branded subjects with schema association

```typescript
const UserEvents = Subject.make('users.events', UserEventSchema);

// Type-safe publish
yield * pubsub.publish(UserEvents, { type: 'created', userId: '123' });

// Type-safe subscribe (schema inferred)
const stream = pubsub.subscribe(UserEvents);
```

---

## 6. Quantified Impact

| Metric                 | Current                       | With Refactoring                 |
| ---------------------- | ----------------------------- | -------------------------------- |
| Total lines (services) | ~1,700                        | ~600 (estimated)                 |
| Duplicated patterns    | ~1,200 lines                  | ~0                               |
| Error types            | 17                            | 5-7 (with proper discrimination) |
| Service methods        | 35+                           | 15-20 (unified interface)        |
| Type safety            | Medium (many `unknown` casts) | High (schema-driven)             |

---

## 7. Questions for Direction

Before proposing a refactoring plan, I need clarification:

1. **Scope priority**: Should we focus on fixing the immediate type errors, or take this opportunity for deeper architectural refactoring?

2. **Effect integration depth**: How far should we go with Effect primitives?

   - **Minimal**: Extract shared codec/stream helpers, fix type errors
   - **Medium**: Replace Stream.async with Stream.asyncEffect, add proper Schema composition
   - **Full**: Bridge NATS to Effect PubSub, use @effect/rpc, typed subjects

3. **Breaking changes**: Are breaking changes to the public API acceptable? The current service shapes have inconsistencies that would benefit from unification.

4. **Timeline**: Is this a "fix it right" situation (weeks) or "stop the bleeding" (hours)?

5. **Usage context**: Where is Holonet consumed? This affects how aggressive the refactoring can be.

---

## 8. Proposed Research (Pending Direction)

Once you answer the questions above, I'll launch parallel research agents for:

1. **Effect Stream.asyncEffect patterns** — canonical usage from Effect source/tests
2. **Effect PubSub bridge patterns** — how to wrap external pub/sub systems
3. **@effect/rpc integration** — can we use it with NATS as transport?
4. **Schema transformation composition** — building codec pipelines

---

_This analysis was generated from reading all 9 Holonet files totaling ~2,200 lines of code._
