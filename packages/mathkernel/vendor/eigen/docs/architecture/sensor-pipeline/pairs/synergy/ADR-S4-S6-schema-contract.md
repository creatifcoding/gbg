---
id: S4-S6
title: "Ingestion ↔ Client Synergy — Schema Contract & Versioning"
commitHash: "6656064"
status: draft
date: 2026-01-02
tier: pair-synergy
participants:
  - S4 (Ingestion & Normalization)
  - S6 (Client Transport)
tags:
  - schema-contract
  - versioning
  - type-safety
  - cross-cutting
---

# ADR S4-S6: Ingestion ↔ Client Synergy — Schema Contract & Versioning

## Context

The sensor data pipeline spans server and client boundaries. S4 (Ingestion & Normalization) receives raw sensor data on the server side, normalizes it to canonical formats, and validates its structure. S6 (Client Transport) delivers this data to browser clients via WebSocket/SSE channels. Between these two stages lies a critical cross-cutting concern: **how do we ensure both sides agree on data shapes?**

Without a shared schema contract:
- S4 might emit data that S6 cannot decode
- S6 might expect fields that S4 no longer provides
- Schema changes break clients silently
- Runtime type mismatches cause opaque errors
- Version skew between server deployments and client builds

This ADR establishes the schema contract and versioning strategy that binds S4 and S6 into a coherent data flow.

## Cross-Cutting Problem

The core challenge is **structural agreement across deployment boundaries**:

1. **Source Diversity**: S4 ingests from multiple protocols (MQTT, HTTP, gRPC), each with different native formats
2. **Transformation Risk**: Normalization to SenML can introduce schema drift if not validated
3. **Client Heterogeneity**: Multiple S6 client instances may run different code versions
4. **Evolution Pressure**: Sensor capabilities expand, requiring schema changes
5. **Type Safety Gap**: Server TypeScript and client TypeScript share no runtime validation without explicit contracts

The fundamental question: **How do we create a shared, versioned, runtime-validated schema contract between S4 and S6?**

## Decision

We adopt a **shared Effect Schema strategy** with semantic versioning, runtime validation at both boundaries, and explicit backward compatibility guarantees.

### 1. Shared Schema Strategy

**Single Source of Truth**: All data schemas live in `/src/lib/sensors/schemas/`, shared between server and client code.

```typescript
// /src/lib/sensors/schemas/sensor-reading.ts
import { Schema } from "effect"

export const SensorReadingV1 = Schema.Struct({
  bn: Schema.String,                    // base name
  bt: Schema.Number,                    // base time
  n: Schema.String,                     // name
  v: Schema.optional(Schema.Number),    // value
  vs: Schema.optional(Schema.String),   // string value
  vb: Schema.optional(Schema.Boolean),  // boolean value
  t: Schema.optional(Schema.Number),    // time offset
  u: Schema.optional(Schema.String),    // unit
})

export const MessageEnvelope = Schema.Struct({
  version: Schema.String.pipe(Schema.pattern(/^\d+\.\d+\.\d+$/)),
  type: Schema.Literal("SensorReading", "SensorBatch", "ErrorReport"),
  payload: Schema.Unknown, // Validated separately based on type
  timestamp: Schema.Number,
})
```

**Import Pattern**: Both S4 ingestion services and S6 transport adapters import the same schema definitions:

```typescript
// S4: src-tauri/src/ingestion/senml_validator.rs (via TS bridge)
import { SensorReadingV1 } from "@/lib/sensors/schemas/sensor-reading"

// S6: src/lib/sensors/transport/sse-adapter.ts
import { SensorReadingV1, MessageEnvelope } from "@/lib/sensors/schemas/sensor-reading"
```

**Effect Schema Benefits**:
- Runtime validation via `Schema.decode`
- Static TypeScript types via `Schema.Type<typeof SensorReadingV1>`
- Composable transformations via `Schema.transform`
- Branded types for semantic validation (e.g., `SensorId`, `ISO8601`)

### 2. Schema Versioning

**Semantic Versioning**: Schema versions follow semver (MAJOR.MINOR.PATCH):
- **MAJOR**: Breaking changes (field removal, type changes, required → optional reversals)
- **MINOR**: Backward-compatible additions (new optional fields)
- **PATCH**: Documentation, internal refactors (no wire format change)

**Version Negotiation Protocol**:

```typescript
// Client sends on connect
const ConnectMessage = Schema.Struct({
  type: Schema.Literal("Connect"),
  supportedVersions: Schema.Array(Schema.String), // ["1.0.0", "1.1.0"]
  preferredVersion: Schema.String,
})

// Server responds
const ConnectAck = Schema.Struct({
  type: Schema.Literal("ConnectAck"),
  negotiatedVersion: Schema.String,
  serverVersions: Schema.Array(Schema.String),
})
```

**Version Field**: Every message envelope includes the schema version:

```typescript
const envelope: MessageEnvelope = {
  version: "1.2.0",
  type: "SensorReading",
  payload: { /* validated against SensorReadingV1_2 */ },
  timestamp: Date.now(),
}
```

**Schema Registry**: Map versions to decoders:

```typescript
// /src/lib/sensors/schemas/registry.ts
import { Schema } from "effect"

export const SchemaRegistry = new Map<string, Schema.Schema<any, any>>([
  ["1.0.0", SensorReadingV1_0],
  ["1.1.0", SensorReadingV1_1],
  ["1.2.0", SensorReadingV1_2],
])

export const decodeMessage = (version: string, payload: unknown) =>
  Effect.gen(function* () {
    const schema = SchemaRegistry.get(version)
    if (!schema) {
      return yield* Effect.fail(new UnsupportedVersionError({ version }))
    }
    return yield* Schema.decode(schema)(payload)
  })
```

### 3. Backward Compatibility

**New Fields Are Optional**: All additions must be optional to avoid breaking older clients.

```typescript
// v1.1.0 adds location field
const SensorReadingV1_1 = SensorReadingV1_0.pipe(
  Schema.extend(Schema.Struct({
    location: Schema.optional(Schema.Struct({
      lat: Schema.Number,
      lon: Schema.Number,
    })),
  }))
)
```

**Deprecation Process**: Three-phase removal:
1. **Deprecate**: Mark field as deprecated, add warning to docs
2. **Warn**: Schema validation emits runtime warning when deprecated field is used
3. **Remove**: Major version bump, field removed from schema

**Grace Period**: Minimum 3 months between deprecation and removal.

**Schema Transforms**: Version migration via transformations:

```typescript
// Migrate v1.0.0 → v1.1.0
const migrateV1_0_to_V1_1 = Schema.transform(
  SensorReadingV1_0,
  SensorReadingV1_1,
  {
    decode: (v1_0) => ({ ...v1_0, location: undefined }), // Add missing field
    encode: (v1_1) => {
      const { location, ...rest } = v1_1
      return rest // Strip new field for downgrade
    },
  }
)
```

### 4. Runtime Validation

**S4 Validation (Ingestion)**:

```typescript
// src-tauri/src/ingestion/senml_normalizer.ts
import { Schema } from "effect"
import { SensorReadingV1_2 } from "@/lib/sensors/schemas/sensor-reading"

export const normalizeSenML = (raw: unknown) =>
  Effect.gen(function* () {
    // Decode and validate incoming data
    const validated = yield* Schema.decode(SensorReadingV1_2)(raw)

    // Normalization logic here
    const normalized = { /* ... */ }

    // Re-validate normalized output
    return yield* Schema.encode(SensorReadingV1_2)(normalized)
  }).pipe(
    Effect.catchAll((error) =>
      Effect.fail(new ValidationError({
        stage: "S4-ingestion",
        cause: error,
        input: raw,
      }))
    )
  )
```

**S6 Validation (Client Transport)**:

```typescript
// src/lib/sensors/transport/sse-adapter.ts
import { Schema } from "effect"
import { MessageEnvelope, SchemaRegistry } from "@/lib/sensors/schemas/registry"

export const parseSSEMessage = (event: MessageEvent) =>
  Effect.gen(function* () {
    // Parse envelope
    const envelope = yield* Schema.decode(MessageEnvelope)(JSON.parse(event.data))

    // Decode payload using versioned schema
    const payload = yield* decodeMessage(envelope.version, envelope.payload)

    return { envelope, payload }
  }).pipe(
    Effect.catchAll((error) =>
      Effect.fail(new TransportError({
        stage: "S6-client-decode",
        cause: error,
        rawData: event.data,
      }))
    )
  )
```

**Error Reporting**: Both S4 and S6 emit structured validation errors:

```typescript
export class ValidationError extends Schema.TaggedError<ValidationError>()("ValidationError", {
  stage: Schema.Literal("S4-ingestion", "S6-client-decode", "S6-server-encode"),
  cause: Schema.Unknown,
  input: Schema.Unknown,
  timestamp: Schema.Number,
}) {}
```

## Interfaces

### MessageEnvelope

```typescript
const MessageEnvelope = Schema.Struct({
  version: Schema.String,           // "1.2.0"
  type: Schema.Literal(              // Message type discriminator
    "SensorReading",
    "SensorBatch",
    "ErrorReport",
    "ConnectAck"
  ),
  payload: Schema.Unknown,           // Decoded separately
  timestamp: Schema.Number,          // Unix ms
  traceId: Schema.optional(Schema.String), // Distributed tracing
})
```

### SchemaRegistry

```typescript
export interface SchemaRegistry {
  get(version: string): Schema.Schema<any, any> | undefined
  register(version: string, schema: Schema.Schema<any, any>): void
  getSupportedVersions(): string[]
  getLatestVersion(): string
}
```

### Version Negotiation

```typescript
const ConnectMessage = Schema.Struct({
  type: Schema.Literal("Connect"),
  supportedVersions: Schema.Array(Schema.String),
  preferredVersion: Schema.String,
  clientId: Schema.String,
})

const ConnectAck = Schema.Struct({
  type: Schema.Literal("ConnectAck"),
  negotiatedVersion: Schema.String,
  serverVersions: Schema.Array(Schema.String),
  sessionId: Schema.String,
})
```

## Consequences

### Positive

1. **Type Safety Across Boundaries**: Compile-time and runtime guarantees that S4 and S6 speak the same language
2. **Explicit Versioning**: Schema changes are deliberate, documented, and negotiated
3. **Graceful Degradation**: Older clients can connect with version negotiation, newer features gracefully unavailable
4. **Debuggability**: Validation errors include schema version, stage, and input data
5. **Single Source of Truth**: Schema changes automatically propagate to both server and client

### Negative

1. **Shared Package Overhead**: Server and client must coordinate schema package updates
2. **Version Explosion**: Supporting multiple versions requires registry maintenance
3. **Runtime Cost**: Validation at both boundaries adds latency (mitigated by caching decoders)
4. **Migration Complexity**: Schema transforms for complex changes require careful testing

### Neutral

1. **Centralized Schema Ownership**: Requires discipline to avoid ad-hoc schema changes
2. **Deprecation Overhead**: Three-phase process adds process weight but prevents breakage

## Alternatives Considered

### Alternative 1: JSON Schema with Ajv

**Rejected**: No static TypeScript types, separate validation layer, runtime-only checks.

### Alternative 2: Protocol Buffers

**Rejected**: Requires code generation, less ergonomic in TypeScript, overkill for internal APIs.

### Alternative 3: Unversioned "Latest Schema Only"

**Rejected**: Breaks client-server version skew, no backward compatibility, production risk.

## Related ADRs

- ADR-S4: Ingestion normalization and SenML format
- ADR-S6: Client transport (WebSocket/SSE)
- ADR-S5: Stream processing (operates on validated schemas)

## Implementation Notes

1. **Schema Location**: `/src/lib/sensors/schemas/` with barrel exports
2. **Testing**: Generate test fixtures for each schema version
3. **Monitoring**: Track validation error rates by schema version
4. **Documentation**: Auto-generate schema docs from Effect Schema definitions

---

**Status**: Draft — Awaiting implementation validation
**Next Steps**:
1. Define initial SensorReadingV1_0 schema
2. Implement SchemaRegistry with version negotiation
3. Add validation to S4 normalization pipeline
4. Add validation to S6 SSE/WebSocket adapters
