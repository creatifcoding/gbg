# IIoT Rate Limiting Middleware

**Date**: 2026-02-07
**Status**: IMPLEMENTED
**Module**: `@gbg/tmnl/iiot/http/middleware/rate-limit`
**Pattern**: `HttpApiMiddleware.Tag` (same as auth middleware)

---

## What the Rate Limiter Does

Every HTTP request to `IIoTApi` (all 13 entity endpoints + 3 query groups) passes through `IIoTRateLimitMiddleware` **before** auth. The middleware:

1. Extracts a client key from `X-Forwarded-For` > `X-Real-IP` > `"unknown"`
2. Atomically checks a per-client token bucket (`Ref<Map<string, Bucket>>`)
3. Either succeeds (void -- request continues) or fails (`IIoTRateLimitExceeded` -- framework returns 429)

---

## Token Bucket Algorithm

Each client gets a bucket with `{ count, windowStart }`.

On each request:

1. If `windowStart + windowMs <= now`, reset bucket (new window)
2. If `count >= maxRequests`, fail with `IIoTRateLimitExceeded` (429)
3. Otherwise, increment count and succeed (void)

---

## Middleware Pipeline Order

```
Request
  |
  v
IIoTRateLimitMiddleware   <-- runs FIRST (rejects before auth)
  |
  v
IIoTAuthMiddleware        <-- runs SECOND (validates JWT)
  |
  v
Handler (entity proxy / query)
```

Rate limiting declared first on `IIoTApi` so clients burning requests with bad tokens still deplete their bucket.

---

## Practical Cases

### Case 1: Runaway SCADA/PLC Polling

An OPC-UA gateway misconfigured to poll every 10ms instead of every 10s. Without rate limiting, it hammers the API with thousands of requests per second:

```
POST /api/sensors/sensor-asset-create/SNS-001    <- 100x/sec
POST /api/equipment/equipment-state-get-current/MCH-001  <- 100x/sec
```

**With rate limiting (e.g., 100 req/60s):** After 100 requests, the gateway gets `429 { retryAfter: 45 }`. The server stays responsive for other clients. The gateway's retry logic (if it has any) backs off.

### Case 2: Credential Stuffing on Auth

Rate limiting runs **before** auth. An attacker brute-forcing tokens:

```
POST /api/enterprises/enterprise-create/test
Authorization: Bearer <guess-1>
Authorization: Bearer <guess-2>
...
```

**Without rate limiting:** Every guess reaches the JWT validation (CPU-expensive `jose` HS256 verify). 10,000 guesses = 10,000 crypto operations.

**With rate limiting:** After N guesses, the attacker gets `429` without the server ever touching JWT validation. The auth middleware never fires.

### Case 3: Noisy Neighbor in Multi-Tenant

Plant A's dashboard auto-refreshes every 2 seconds across 50 widgets. Plant B needs to create a work order.

```
Plant A (192.168.1.10): GET /api/queries/plants    <- 25 req/sec
Plant B (192.168.2.20): POST /api/workorders/work-order-create/WO-001
```

**Per-client isolation means:** Plant A hits their bucket ceiling -- 429. Plant B is on a completely separate bucket -- request passes normally.

### Case 4: Accidental Infinite Loop in Client Code

A React dashboard with a `useEffect` missing a dependency array, re-fetching on every render:

```javascript
useEffect(() => {
  fetch('/api/machines/machine-asset-get/MCH-001')  // fires every render
})
```

**With rate limiting:** Caps the damage. Client gets 429 after N requests, effectively circuit-breaking the bug at the server boundary.

### Case 5: DDoS / Amplification

Less relevant for IIoT (usually internal networks), but if the API is exposed:

```
1000 requests from 10.0.0.1 in 1 second
```

**With rate limiting:** First N pass, rest get `429` with `Retry-After` header. The server's entity mailbox system, cluster sharding, and database connections aren't overwhelmed.

### Case 6: Dev/Test Mode (Disabled)

```typescript
// server.ts -- dev mode
Layer.provide(IIoTRateLimitDisabledLayer)  // Effect.void passthrough
```

Running integration tests, local development, load testing -- no rate limiting. Every request passes. Zero overhead. Swap the layer for prod:

```typescript
// prod server
Layer.provide(IIoTRateLimitEnabledLayer({ maxRequests: 100, windowMs: 60_000 }))
```

---

## What It Does NOT Do

| Not This | Why |
|----------|-----|
| Per-endpoint limits | Current impl is per-client across ALL endpoints. A client's `/sensors` requests share the same bucket as `/alarms` |
| Distributed rate limiting | The `Ref<Map>` is in-process memory. If you run 3 server replicas, each has its own bucket state. Would need Redis or similar for distributed |
| Sliding window | It's a fixed window. If you make 100 requests at second 59, the window resets at second 60 and you get 100 more immediately |
| Graduated responses | No slowdown before hard cutoff. It's binary: under limit -- pass, at/over limit -- 429 |

---

## Two Modes

| Mode | Layer | Behavior |
|------|-------|----------|
| **Enabled** | `IIoTRateLimitEnabledLayer(config)` | Per-client token bucket, 429 on excess |
| **Disabled** | `IIoTRateLimitDisabledLayer` | `Effect.void` passthrough, zero overhead |

---

## Configuration

```typescript
interface RateLimitConfigShape {
  readonly maxRequests: number   // requests per window
  readonly windowMs: number      // window duration in milliseconds
}
```

---

## Error Shape

```typescript
class IIoTRateLimitExceeded extends Schema.TaggedError<IIoTRateLimitExceeded>()(
  'IIoTRateLimitExceeded',
  {
    message: Schema.String,      // "Too Many Requests"
    retryAfter: Schema.Number,   // seconds until window reset
  },
  HttpApiSchema.annotations({ status: 429 }),
)
```

The framework auto-converts this to a 429 HTTP response with the schema-encoded body.

---

## Client Key Extraction

Priority:

1. `X-Forwarded-For` header (first IP in comma-separated chain)
2. `X-Real-IP` header
3. Fallback to `"unknown"` (all headerless requests share one bucket)

---

## Exports

```typescript
// Middleware Tag (declared on IIoTApi)
export class IIoTRateLimitMiddleware

// Layer constructors
export const IIoTRateLimitEnabledLayer: (config: RateLimitConfigShape) => Layer.Layer<IIoTRateLimitMiddleware>
export const IIoTRateLimitDisabledLayer: Layer.Layer<IIoTRateLimitMiddleware>

// Error type
export class IIoTRateLimitExceeded

// Config/bucket types
export interface RateLimitConfigShape
export interface RateLimitBucket
```

---

## Test Coverage

### Unit Tests (`__tests__/unit/rate-limit.test.ts`)

| Category | Tests |
|----------|-------|
| Layer construction | 3 |
| Error type (TaggedError, Schema encode/decode) | 3 |
| Middleware Tag identity | 1 |
| Disabled layer passthrough | 1 |
| **Total** | **8** |

### Integration Tests (`__tests__/integration/rate-limit-middleware.test.ts`)

Full HTTP round-trip via `HttpApiBuilder.toWebHandler`:

| Scenario | Tests |
|----------|-------|
| Burst (3 pass, 4th/5th get 429) | 3 |
| 429 response body (`_tag`, `retryAfter`) | 2 |
| Per-client isolation (A blocked, B passes) | 3 |
| Window reset (100ms window, requests pass after expiry) | 1 |
| Disabled passthrough (20+ requests, no 429) | 2 |
| CORS & docs accessibility | 2 |
| **Total** | **13** |

---

## Files

| File | Purpose |
|------|---------|
| `src/lib/iiot/http/middleware/rate-limit.ts` | Middleware implementation |
| `src/lib/iiot/http/middleware/RATE-LIMIT.md` | This document |
| `src/lib/iiot/http/api.ts` | `.middleware(IIoTRateLimitMiddleware)` declaration |
| `src/lib/iiot/http/server.ts` | `IIoTRateLimitDisabledLayer` wired to server |
| `src/lib/iiot/http/index.ts` | Barrel exports |
| `src/lib/iiot/http/__tests__/unit/rate-limit.test.ts` | Unit tests |
| `src/lib/iiot/http/__tests__/integration/rate-limit-middleware.test.ts` | Integration tests |
| `src/lib/iiot/http/__tests__/test-helpers.ts` | `IIoTRateLimitDisabledLayer` in shared test layer |

---

## Future Hardening

The current implementation is a solid foundation for a single-process IIoT server. Production hardening would layer on top of the same `HttpApiMiddleware.Tag` pattern:

1. **Per-endpoint tiers** -- Different limits for read vs write operations
2. **Distributed state** -- Redis or similar backing store for multi-replica deployments
3. **Sliding window** -- Replace fixed window with sliding log or sliding counter
4. **Graduated responses** -- Progressive slowdown (artificial delay) before hard 429 cutoff
5. **Allowlists** -- Exempt certain client IPs or API keys from rate limiting
