# ADR-006: Tagged Errors Everywhere — Data.TaggedError for Typed Error Channels

**Status**: Accepted  
**Date**: 2026-02-18  
**Decision Makers**: Prime (user), Val (architect)  
**Evidence**: AGENTS.md project rules, all adapter questionnaires

---

## Context

nw_wrld uses `try/catch` with `console.error` — errors are silently swallowed. The InputManager catches errors and broadcasts a status string. No typed error channels, no recovery logic, no error composition.

Effect-TS provides typed error channels via `Data.TaggedError` — errors are first-class values that appear in the type signature and can be caught, mapped, and recovered from precisely.

## Decision

**All adapter and service errors are `Data.TaggedError` subclasses.** Each error has a `_tag` discriminator for `Effect.catchTag`/`Effect.catchTags` precision recovery.

### Error Hierarchy

```typescript
// adapters/errors.ts — 17 tagged error classes

// Connection lifecycle
AdapterConnectError    // Generic connection failure

// HTTP-specific
HttpRequestError       // Request failed (network, DNS, timeout)
HttpParseError         // Response body decode failed
HttpAuthError          // 401/403 authentication failure
HttpTimeoutError       // Request exceeded timeout
SseConnectionError     // SSE stream connection failed

// WebSocket-specific
WsConnectError         // WebSocket handshake failed
WsMessageError         // Frame decode or protocol error

// NATS-specific
NatsSubscribeError     // Subscription creation failed

// File-specific
FileWatchError         // File watch initialization failed
FileParseError         // File content parse failed

// RSS-specific
RssFetchError          // HTTP fetch of RSS feed failed
RssParseError          // XML parse of RSS/Atom failed

// Serial-specific
SerialConnectError     // Serial port open failed

// Universal
SignalValidationError   // Signal schema decode failed
SignalQueueFullError    // Bounded queue rejected signal (backpressure)
```

### Error Shape

```typescript
export class HttpRequestError extends Data.TaggedError('HttpRequestError')<{
  readonly adapterId: string
  readonly url: string
  readonly method: string
  readonly statusCode?: number
  readonly message: string
  readonly cause?: unknown
}> {}
```

### Recovery Patterns

```typescript
// Precise catch by tag
yield* adapter.connect().pipe(
  Effect.catchTag('HttpAuthError', (err) =>
    Effect.log(`Auth failed for ${err.url}: ${err.message}`)
  ),
  Effect.catchTag('HttpTimeoutError', (err) =>
    Effect.retry(Schedule.exponential('1 second'))
  ),
)

// Catch multiple tags
yield* operation.pipe(
  Effect.catchTags({
    HttpRequestError: (e) => Effect.retry(Schedule.spaced('5 seconds')),
    HttpParseError: (e) => Effect.log(`Parse error, skipping: ${e.message}`),
    HttpAuthError: (e) => Effect.die(e), // Fatal — cannot recover
  })
)
```

### XML Parser Errors

```typescript
// adapters/xml.ts — separate boundary
XmlParseError          // fast-xml-parser parse failure
XmlValidationError     // Parsed XML doesn't match expected RSS/Atom structure
```

## Consequences

### Positive
- **Type-safe error channels** — compiler shows which errors each function can produce
- **Precise recovery** — `catchTag` handles specific failures without catch-all
- **Composable** — `Effect.mapError` transforms errors through pipeline
- **Traceable** — each error carries `adapterId`, `url`, timestamps, etc.
- **Exhaustive** — 17 errors cover all adapter failure modes

### Negative
- Verbose — each error is a class definition (~5 lines each)
- Tag strings must be unique across the codebase (convention: module-scoped)

## Implementation

- **Error file**: `src/lib/tsingou-flow/adapters/errors.ts` — 17 `Data.TaggedError` classes
- **XML errors**: `src/lib/tsingou-flow/adapters/xml.ts` — 2 XML-specific errors
- **Union type**: `AdapterError` = union of all 17 errors (for catch-all scenarios)
- **Usage**: Every adapter uses tagged errors — HTTP (5 errors), WS (2), RSS (2), etc.
