# Holonet NATS Service Refactoring Plan

**Date**: 2025-01-12
**Status**: Analysis Complete, Ready for Implementation
**Goal**: Proper hierarchy, deduplication, Effect-native patterns

---

## Executive Summary

The Holonet NATS services have significant code duplication and some anti-patterns (Effect.runPromise usage). We've created new generic stream utilities (`stream.ts`) that provide Effect-native wrappers for async patterns. This plan outlines refactoring to:

1. **Eliminate duplication** via shared utilities and base classes
2. **Fix anti-patterns** (Effect.runPromise → proper Effect.gen)
3. **Establish hierarchy** (BaseNatsService + service-specific implementations)
4. **Migrate to callback-based streams** where NATS API supports it

---

## Current Architecture Analysis

### Services Inventory

| Service                   | Lines | Primary Function                    | Effect Dependencies   | Application Usage      |
| ------------------------- | ----- | ----------------------------------- | --------------------- | ---------------------- |
| **NatsConnectionService** | 98    | Shared connection lifecycle         | HolonetConfigTag      | Foundation for all     |
| **NatsPubSubService**     | 277   | Core pub/sub + request-reply        | NatsConnectionService | **Most commonly used** |
| **NatsConsumerService**   | 425   | JetStream consumers (fetch/consume) | NatsConnectionService | Less common            |
| **NatsObjectService**     | 287   | Object store operations             | NatsConnectionService | Less common            |
| **NatsMonitoringService** | ~100  | System monitoring                   | NatsConnectionService | Specialized use        |

### Dependency Chain

```
HolonetConfigTag
       ↓
NatsConnectionService (provides: nc, js, jsm, config)
       ↓
┌──────┴──────┬──────────────┬──────────────┐
↓             ↓              ↓              ↓
PubSub    Consumer      ObjectStore    Monitoring
(PRIMARY) (SECONDARY)   (SECONDARY)    (SPECIALIZED)
```

**Critical Note**: While services don't have Effect `dependencies` on each other, **PubSub is the most commonly used service in application code**. Refactoring it first will:

1. Establish patterns for other services to follow
2. Validate the `BaseNatsService` hierarchy early
3. Provide immediate value (most-used service gets benefits first)

### Code Duplication Found

1. **Schema Validation** (4+ per service):

   ```typescript
   const validated = yield * Schema.decodeUnknown(MySchema)(input);
   ```

2. **JSON Encoding** (3-4 per service):

   ```typescript
   const encoded = yield * Schema.encode(schema)(data);
   const jsonStr = JSON.stringify(encoded);
   const bytes = new TextEncoder().encode(jsonStr);
   ```

3. **Error Wrapping** (10+ instances):

   ```typescript
   yield *
     Effect.tryPromise({
       try: () => natsOp(),
       catch: (err) => new CustomError({ message: '...', cause: err }),
     });
   ```

4. **Typed Message Construction** (3 services):
   ```typescript
   return {
     subject: msg.subject,
     data: decoded,
     reply: msg.reply,
     sid: msg.sid,
     size: msg.data.length,
   } as TypedMessage<A>;
   ```

### Anti-Patterns Identified

**Critical**: `NatsConsumerService.consume()` (lines 304-396)

- Uses `Effect.runPromiseExit` inside `Stream.async` callback
- Breaks Effect's fiber model
- **Must be fixed** to use proper Effect.gen patterns

**Non-critical**: Some services could migrate to callback-based streams for better performance

---

## New Generic Utilities (Already Implemented)

Located in `src/lib/holonet/utils/stream.ts`:

### 1. `fromCallback` (Most Effect-native)

```typescript
const stream = fromCallback<Msg, MyError>((onValue, onError, onEnd) => {
  const sub = nc.subscribe('events', {
    callback: (err, msg) => {
      if (err) onError(new MyError({ cause: err }));
      else onValue(msg);
    },
  });
  return () => sub.unsubscribe();
});
```

**Use when**: NATS API supports callback option

### 2. `fromAsyncIterable` (Fallback)

```typescript
const stream = fromAsyncIterable(
  asyncIterable,
  (err) => new MyError({ cause: err }),
  () => cleanup()
);
```

**Use when**: Only AsyncIterable available (JetStream watch, batch processing)

### 3. `fromEffectAsyncIterable` (Lazy initialization)

```typescript
const stream = fromEffectAsyncIterable(
  Effect.tryPromise(() => getWatcher()),
  (err) => new MyError({ cause: err })
);
```

**Use when**: Need Effect to get the iterable first

### 4. `fromEffectAsyncIterableWithTransform` (With decode step)

```typescript
const stream = fromEffectAsyncIterableWithTransform(
  Effect.tryPromise(() => nc.subscribe('events')),
  (msg) => decodeMessage(msg),
  (err) => new SubscribeError({ cause: err })
);
```

**Use when**: Need to transform each item

---

## Refactoring Strategy

### Phase 1: Shared Utilities (Foundation)

**Goal**: Extract common patterns into reusable utilities

#### 1.1 Create `utils/codec.ts` Enhancements

```typescript
// Already exists, enhance with:
export const NatsCodec = {
  encodeJson: <A, I>(schema: Schema.Schema<A, I>, data: A) =>
    Effect.gen(function* () {
      const encoded = yield* Schema.encode(schema)(data);
      return new TextEncoder().encode(JSON.stringify(encoded));
    }),

  decodeJson: <A, I>(
    schema: Schema.Schema<A, I>,
    data: Uint8Array,
    context?: object
  ) => decodeJson(schema, context)(data), // Already exists
};
```

**Files to modify**:

- `utils/codec.ts` - Add `NatsCodec.encodeJson`
- All services - Replace manual JSON encoding

**Complexity**: Low
**Impact**: Removes ~20 lines of duplication per service

#### 1.2 Create `utils/validation.ts`

```typescript
export const validateSchema = <A, I>(
  schema: Schema.Schema<A, I>,
  input: unknown
): Effect.Effect<A, ParseResult.ParseError> =>
  Schema.decodeUnknown(schema)(input);
```

**Files to create**: `utils/validation.ts`
**Files to modify**: All services - Replace manual validation
**Complexity**: Low
**Impact**: Removes ~5 lines of duplication per service

#### 1.3 Create `utils/errors.ts`

```typescript
export const wrapNatsError =
  <E>(createError: (cause: unknown) => E) =>
  (operation: string) =>
  (err: unknown) =>
    createError(err);
```

**Files to create**: `utils/errors.ts`
**Files to modify**: All services - Standardize error wrapping
**Complexity**: Low
**Impact**: Cleaner error handling patterns

### Phase 2: Service Hierarchy (Core Refactoring)

**Goal**: Establish base service class with common functionality

#### 2.1 Create `services/BaseNatsService.ts`

```typescript
export abstract class BaseNatsService extends Effect.Service<BaseNatsService>()(
  'tmnl/holonet/BaseNatsService',
  {
    effect: Effect.gen(function* () {
      const { nc, js, jsm, config } = yield* NatsConnectionService;

      // Common getters
      const getConnection = () => Effect.succeed(nc);
      const getJetStream = () => Effect.succeed(js);
      const getJetStreamManager = () => Effect.succeed(jsm);
      const getConfig = () => Effect.succeed(config);

      // Common utilities
      const validateInput = <A, I>(
        schema: Schema.Schema<A, I>,
        input: unknown
      ) => validateSchema(schema, input);

      const encodeJson = NatsCodec.encodeJson;
      const decodeJson = NatsCodec.decodeJson;

      const close = () =>
        Effect.logDebug('cleanup handled by NatsConnectionService scope');

      return {
        getConnection,
        getJetStream,
        getJetStreamManager,
        getConfig,
        validateInput,
        encodeJson,
        decodeJson,
        close,
      };
    }),
    dependencies: [NatsConnectionService.Default],
  }
) {}
```

**Files to create**: `services/BaseNatsService.ts`
**Complexity**: Medium
**Impact**: Foundation for all service refactoring

#### 2.2 Refactor PubSub FIRST (Pattern Establishment)

**Why PubSub first**:

- Most commonly used service in application code
- Establishes patterns for other services
- Immediate value delivery
- Validates BaseNatsService design

```typescript
export class NatsPubSubService extends BaseNatsService {
  // Service-specific operations only
  readonly publish: (...) => ...;
  readonly subscribe: (...) => ...;
  readonly queueSubscribe: (...) => ...;
  readonly request: (...) => ...;
}
```

#### 2.3 Refactor Remaining Services

**Order**:

1. ✅ NatsPubSubService (Week 2)
2. NatsMonitoringService (Week 2) - Simple, validates pattern
3. NatsConsumerService (Week 3) - Complex, has anti-pattern
4. NatsObjectService (Week 3) - Medium complexity

**Files to modify**:

- `NatsPubSubService.ts`
- `NatsMonitoringService.ts`
- `NatsConsumerService.ts`
- `NatsObjectService.ts`

**Complexity**: High
**Impact**: Significant LOC reduction, clearer service boundaries

### Phase 3: Stream Pattern Migration

**Goal**: Migrate eligible services to callback-based streams

#### 3.1 Migrate NatsPubSubService.subscribe

**Status**: Can use `fromCallback`
**Reason**: NATS core subscribe supports callbacks
**Complexity**: Low
**Priority**: HIGH (done during PubSub refactor)

#### 3.2 Migrate NatsMonitoringService

**Status**: Can use `fromCallback`
**Reason**: Simple monitoring, no batching needed
**Complexity**: Low

#### 3.3 Keep AsyncIterable Where Required

**Services**: NatsConsumerService (batch processing), NatsObjectService.watch (iterator-only API)
**Reason**: Business logic requires iteration control
**Complexity**: N/A (no change)

### Phase 4: Fix Anti-Patterns

**Goal**: Eliminate `Effect.runPromise` usage

#### 4.1 Fix NatsConsumerService.consume()

**Problem**: Lines 304-396 use `Effect.runPromiseExit` in async callback
**Solution**: Rewrite using `Stream.asyncEffect` + proper Effect.gen

**Before** (anti-pattern):

```typescript
Stream.async<...>((emit) => {
  const run = async () => {
    const validatedExit = await Effect.runPromiseExit(...);
    // More Effect.runPromiseExit calls...
  };
  run();
});
```

**After** (Effect-native):

```typescript
Stream.unwrap(
  Effect.gen(function* () {
    const validated = yield* validateInput(ConsumeOptionsSchema, options);
    const consumer = yield* Effect.tryPromise(() => js.consumers.get(...));

    return fromCallback<TypedConsumerMessage<A>, Error>(
      (onValue, onError, onEnd) => {
        // Use JetStream callback API if available, or AsyncIterable wrapper
      }
    );
  })
);
```

**Files to modify**: `NatsConsumerService.ts`
**Complexity**: High
**Impact**: Fixes critical anti-pattern, improves fiber management

---

## Implementation Order (REVISED)

### Week 1: Foundation (Phase 1)

- [ ] Day 1: Create `utils/validation.ts` and `utils/errors.ts`
- [ ] Day 2: Enhance `utils/codec.ts` with `NatsCodec.encodeJson`
- [ ] Day 3: Migrate services to use new codec utilities
- [ ] Day 4: Test all services with new utilities
- [ ] Day 5: Buffer for fixes

### Week 2: PubSub First (Phase 2 + 3)

- [ ] Day 1: Create `BaseNatsService.ts`
- [ ] Day 2-3: Refactor `NatsPubSubService` to extend base + migrate to `fromCallback`
- [ ] Day 4: Refactor `NatsMonitoringService` to extend base + migrate to `fromCallback`
- [ ] Day 5: Test both services thoroughly

### Week 3: Remaining Services (Phase 2 cont.)

- [ ] Day 1-2: Refactor `NatsObjectService` to extend base
- [ ] Day 3-4: Refactor `NatsConsumerService` to extend base + fix anti-pattern
- [ ] Day 5: Integration testing across all services

### Week 4: Final Validation

- [ ] Day 1-2: Full regression testing
- [ ] Day 3: Performance benchmarking
- [ ] Day 4: Documentation updates
- [ ] Day 5: Code review and cleanup

---

## Success Criteria

1. **Zero `Effect.runPromise` calls** in holonet package
2. **All services extend `BaseNatsService`** (or equivalent hierarchy)
3. **~30% LOC reduction** via shared utilities
4. **Build passes** with `pnpm tsc --noEmit`
5. **All tests pass** (unit + integration)
6. **Callback-based streams** for eligible services (PubSub, Monitoring)

---

## Risk Mitigation

1. **Incremental Migration**: Refactor one service at a time, test before moving to next
2. **Legacy Exports**: Keep deprecated functions during migration (already done in `stream.ts`)
3. **Type Safety**: Use `Effect.provide` for testing individual services
4. **Rollback Plan**: Git branches for each phase, easy to revert if issues arise
5. **PubSub First**: Most-used service refactored early = early validation + quick wins

---

## Notes

- **NATS Callback API**: Core NATS supports callbacks, JetStream may not (verify each operation)
- **Schema Validation**: Ensure all schemas use Effect Schema (no raw TS types)
- **Error Handling**: Maintain consistent error types across services
- **Tracing**: Preserve `Effect.withSpan()` calls for observability
- **PubSub Priority**: Refactoring PubSub first validates the entire approach since it's most commonly used

---

**Next Steps**: Begin Phase 1, Day 1 - Create validation and error utilities
