# TSG.13 BaseSignal ↔ STIX Codec

```
Section:     TSG.13
Title:       BaseSignal ↔ STIX Codec
Status:      DRAFT
Author:      stix-specialist
RFC:         TMNL-RFC-002
Depends:     TSG.8 (BaseSignal Schema), TSG.12 (STIX 2.1 Data Model)
```

---

## TSG.13.1 Introduction

This section specifies the bidirectional codec that transforms between Tsingou's BaseSignal format (TSG.8) and STIX 2.1 bundles (TSG.12). The codec is the critical interoperability boundary — it preserves signal fidelity during conversion while ensuring STIX compliance for external consumers.

The codec operates in two directions:

1. **Encode** (BaseSignal → STIX): Transforms internal signals into STIX bundles for export via TAXII (TSG.14) or direct file output.
2. **Decode** (STIX → BaseSignal): Transforms incoming STIX objects from external CTI platforms into BaseSignal format for internal processing.

### TSG.13.1.1 Normative References

| Key | Reference |
|-----|-----------|
| [STIX21] | OASIS, "STIX Version 2.1", Committee Specification 03, June 2020 |
| [RFC2119] | IETF, "Key words for use in RFCs to Indicate Requirement Levels", March 1997 |
| [RFC4122] | IETF, "A Universally Unique IDentifier (UUID) URN Namespace", July 2005 |
| [EFFECT] | Effect-TS, "Effect: The Missing Standard Library for TypeScript" |

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in BCP 14 [RFC2119] [RFC8174].

### TSG.13.1.2 Design Principles

1. **Lossless round-trip for Tsingou-generated signals**: `decode(encode(signal))` MUST produce a signal equivalent to the original.
2. **Best-effort import for external STIX**: External STIX objects MAY lack Tsingou-specific metadata; the codec MUST NOT reject valid STIX.
3. **Schema-driven transforms**: All transformations are defined as Effect Schema encode/decode pipelines.
4. **Streaming codec**: The codec MUST support both single-object and streaming (batched) transformation.
5. **Fail-fast validation**: Invalid STIX or BaseSignal objects MUST be rejected at the codec boundary, not silently dropped.

---

## TSG.13.2 Codec Architecture

### TSG.13.2.1 Service Model

The codec is an Effect.Service with the following contract:

```typescript
interface StixCodec {
  // Single signal encode
  readonly encodeSignal: (
    signal: BaseSignal
  ) => Effect<StixBundle, CodecError>

  // Batch signal encode
  readonly encodeBatch: (
    signals: ReadonlyArray<BaseSignal>
  ) => Effect<StixBundle, CodecError>

  // Stream encode (for pipeline integration)
  readonly encodeStream: (
    signals: Stream<BaseSignal>
  ) => Stream<StixBundle>

  // Single bundle decode
  readonly decodeBundle: (
    bundle: StixBundle
  ) => Effect<ReadonlyArray<BaseSignal>, CodecError>

  // Single observed-data decode
  readonly decodeObservedData: (
    observedData: ObservedData,
    referencedScos: ReadonlyArray<StixCyberObservable>
  ) => Effect<BaseSignal, CodecError>

  // Indicator to signal pattern decode
  readonly decodeIndicatorPattern: (
    indicator: Indicator
  ) => Effect<SignalFilter, CodecError>
}
```

### TSG.13.2.2 Dependency Graph

```
StixCodec
  ├── UuidMapper          (deterministic UUID generation)
  ├── IdentityProvider    (platform + adapter identities)
  ├── MarkingProvider     (TLP markings)
  ├── ExtensionRegistry   (custom SCO extension-definitions)
  ├── SignalSchemaRegistry (signal kind schemas from TSG.8)
  └── Clock               (timestamp generation)
```

### TSG.13.2.3 Error Model

The codec defines tagged errors for each failure mode:

```typescript
const CodecError = Schema.Union(
  Schema.TaggedStruct("InvalidSignal", {
    message: Schema.String,
    signalId: Schema.optional(Schema.String),
    field: Schema.optional(Schema.String),
  }),
  Schema.TaggedStruct("InvalidStix", {
    message: Schema.String,
    stixId: Schema.optional(Schema.String),
    stixType: Schema.optional(Schema.String),
  }),
  Schema.TaggedStruct("UnsupportedSignalKind", {
    kind: Schema.String,
  }),
  Schema.TaggedStruct("UnsupportedStixType", {
    stixType: Schema.String,
  }),
  Schema.TaggedStruct("UuidMappingFailed", {
    signalId: Schema.String,
    reason: Schema.String,
  }),
  Schema.TaggedStruct("SchemaValidationFailed", {
    path: Schema.String,
    expected: Schema.String,
    received: Schema.String,
  }),
)
```

---

## TSG.13.3 Encode Pipeline

### TSG.13.3.1 Pipeline Stages

The encode pipeline transforms a BaseSignal through four stages:

```
Stage 1: Signal Validation
  │  Validate BaseSignal against Schema (TSG.8)
  │  Reject malformed signals with InvalidSignal error
  ▼
Stage 2: SCO Generation
  │  Dispatch on signal.kind
  │  Generate primary + secondary SCOs from payload
  │  Apply UUID v5 deterministic mapping
  ▼
Stage 3: SDO Generation
  │  Wrap SCOs in observed-data SDO
  │  Attach identity, marking, confidence
  │  Generate STIX timestamps from BaseSignal.timestamp
  ▼
Stage 4: Bundle Assembly
  │  Collect all objects (identities, extensions, SDOs, SCOs)
  │  Validate bundle composition (TSG.12.8.1)
  │  Generate bundle ID
  ▼
Output: StixBundle
```

### TSG.13.3.2 Stage 1: Signal Validation

Implementations MUST validate the input BaseSignal before encoding:

```typescript
const validateSignal = (signal: unknown): Effect<BaseSignal, CodecError> =>
  Schema.decodeUnknown(BaseSignal)(signal).pipe(
    Effect.mapError((parseError) =>
      CodecError.InvalidSignal({
        message: `BaseSignal validation failed: ${parseError.message}`,
        field: parseError.path?.join("."),
      })
    )
  )
```

**Validation checks:**
1. All required fields present (id, sourceId, timestamp, kind, payload)
2. `kind` matches a known KnownSignalKind literal
3. `payload` validates against the kind-specific schema
4. `timestamp` is a valid Date
5. `version` (if present) is a valid [tick, source_seq] tuple

### TSG.13.3.3 Stage 2: SCO Generation

The SCO generator dispatches on `signal.kind` to produce type-specific STIX Cyber-observable Objects:

```typescript
const generateScos = (signal: BaseSignal): Effect<ReadonlyArray<StixSco>, CodecError> => {
  switch (signal.kind) {
    case "nats":     return generateNatsScos(signal)
    case "http":     return generateHttpScos(signal)
    case "websocket": return generateWebSocketScos(signal)
    case "midi":     return generateMidiScos(signal)
    case "osc":      return generateOscScos(signal)
    case "serial":   return generateSerialScos(signal)
    case "rss":      return generateRssScos(signal)
    case "file-watch": return generateFileWatchScos(signal)
    default:         return Effect.fail(CodecError.UnsupportedSignalKind({ kind: signal.kind }))
  }
}
```

**Per-kind SCO generation:**

| Kind | Generator Function | Primary SCO | Secondary SCOs |
|------|-------------------|-------------|----------------|
| nats | generateNatsScos | x-tsingou-nats-message | ipv4-addr (conditional) |
| http | generateHttpScos | network-traffic | url, ipv4-addr, domain-name |
| websocket | generateWebSocketScos | network-traffic | url, ipv4-addr |
| midi | generateMidiScos | x-tsingou-midi-event | software (conditional) |
| osc | generateOscScos | x-tsingou-osc-message | ipv4-addr (conditional) |
| serial | generateSerialScos | x-tsingou-serial-data | artifact, software (conditional) |
| rss | generateRssScos | url | artifact, email-addr (conditional) |
| file-watch | generateFileWatchScos | file | directory, artifact (conditional) |

### TSG.13.3.4 Stage 2 Example: HTTP SCO Generation

```typescript
const generateHttpScos = (signal: BaseSignal): Effect<ReadonlyArray<StixSco>, CodecError> =>
  Effect.gen(function* () {
    const payload = signal.payload as HttpPayload
    const uuidMapper = yield* UuidMapper

    const scos: StixSco[] = []

    // 1. URL SCO (always generated for HTTP signals)
    const urlId = yield* uuidMapper.scoId(signal.id, "url", 0)
    scos.push({
      type: "url",
      id: urlId,
      value: payload.url,
    })

    // 2. Parse URL for IP/domain
    const parsed = new URL(payload.url)

    // 3. Domain SCO
    if (parsed.hostname && !isIpAddress(parsed.hostname)) {
      const domainId = yield* uuidMapper.scoId(signal.id, "domain-name", 0)
      scos.push({
        type: "domain-name",
        id: domainId,
        value: parsed.hostname,
      })
    }

    // 4. IP Address SCO (if resolvable)
    if (isIpAddress(parsed.hostname)) {
      const ipType = parsed.hostname.includes(":") ? "ipv6-addr" : "ipv4-addr"
      const ipId = yield* uuidMapper.scoId(signal.id, ipType, 0)
      scos.push({
        type: ipType,
        id: ipId,
        value: parsed.hostname,
      })
    }

    // 5. Network Traffic SCO
    const netId = yield* uuidMapper.scoId(signal.id, "network-traffic", 0)
    const networkTraffic: any = {
      type: "network-traffic",
      id: netId,
      dst_port: parsed.port ? parseInt(parsed.port) : (parsed.protocol === "https:" ? 443 : 80),
      protocols: ["tcp", parsed.protocol.replace(":", "")],
      extensions: {},
    }

    // 6. HTTP Request Extension
    if (payload.method) {
      networkTraffic.extensions["http-request-ext"] = {
        request_method: payload.method,
        request_value: parsed.pathname + parsed.search,
        ...(payload.headers && { request_header: payload.headers }),
      }
    }

    scos.push(networkTraffic)

    return scos
  })
```

### TSG.13.3.5 Stage 3: SDO Generation

The SDO generator wraps SCOs in an `observed-data` container:

```typescript
const generateObservedData = (
  signal: BaseSignal,
  scos: ReadonlyArray<StixSco>
): Effect<ObservedData, CodecError> =>
  Effect.gen(function* () {
    const uuidMapper = yield* UuidMapper
    const identityProvider = yield* IdentityProvider
    const markingProvider = yield* MarkingProvider
    const clock = yield* Clock

    const observedDataId = yield* uuidMapper.sdoId(signal.id, "observed-data")
    const timestamp = signal.timestamp.toISOString()
    const now = (yield* clock.currentTimeMillis).toString()

    return {
      type: "observed-data" as const,
      spec_version: "2.1" as const,
      id: observedDataId,
      created: timestamp,
      modified: timestamp,
      created_by_ref: yield* identityProvider.adapterIdentityId(signal.sourceId),
      first_observed: timestamp,
      last_observed: timestamp,
      number_observed: 1,
      object_refs: scos.map((sco) => sco.id),
      object_marking_refs: yield* markingProvider.defaultMarkings(),
      confidence: 95,  // Direct observation
    }
  })
```

### TSG.13.3.6 Stage 4: Bundle Assembly

```typescript
const assembleBundle = (
  observedData: ReadonlyArray<ObservedData>,
  scos: ReadonlyArray<StixSco>,
  signal: BaseSignal
): Effect<StixBundle, CodecError> =>
  Effect.gen(function* () {
    const uuidMapper = yield* UuidMapper
    const identityProvider = yield* IdentityProvider
    const extensionRegistry = yield* ExtensionRegistry

    // Collect required extension definitions
    const customTypes = new Set(
      scos
        .filter((sco) => sco.type.startsWith("x-tsingou-"))
        .map((sco) => sco.type)
    )
    const extensionDefs = yield* extensionRegistry.getDefinitions(customTypes)

    // Collect identity objects
    const identities = yield* identityProvider.allIdentities()

    // Assemble bundle
    const bundleId = yield* uuidMapper.bundleId(signal.id)

    return {
      type: "bundle" as const,
      id: bundleId,
      objects: [
        ...identities,
        ...extensionDefs,
        ...observedData,
        ...scos,
      ],
    }
  })
```

---

## TSG.13.4 Decode Pipeline

### TSG.13.4.1 Pipeline Stages

The decode pipeline transforms a STIX bundle into BaseSignal(s) through four stages:

```
Stage 1: Bundle Validation
  │  Validate STIX bundle structure
  │  Extract and index objects by ID
  ▼
Stage 2: Object Resolution
  │  Resolve object_refs in observed-data
  │  Match SCOs to signal kind discriminator
  │  Build SCO dependency graph
  ▼
Stage 3: Signal Reconstruction
  │  Map SCO properties back to BaseSignal payload
  │  Recover SignalId from UUID reverse mapping
  │  Reconstruct metadata and version
  ▼
Stage 4: Validation
  │  Validate reconstructed BaseSignal against Schema
  │  Report unrecoverable objects as warnings
  ▼
Output: ReadonlyArray<BaseSignal>
```

### TSG.13.4.2 Stage 1: Bundle Validation

```typescript
const validateBundle = (raw: unknown): Effect<StixBundle, CodecError> =>
  Schema.decodeUnknown(StixBundle)(raw).pipe(
    Effect.mapError((parseError) =>
      CodecError.InvalidStix({
        message: `STIX bundle validation failed: ${parseError.message}`,
      })
    ),
    Effect.tap((bundle) =>
      bundle.objects.length === 0
        ? Effect.fail(CodecError.InvalidStix({ message: "Empty bundle" }))
        : Effect.void
    )
  )
```

### TSG.13.4.3 Stage 2: Object Resolution

The resolver builds an index and resolves observed-data → SCO references:

```typescript
const resolveObjects = (bundle: StixBundle) =>
  Effect.gen(function* () {
    // Index all objects by STIX ID
    const index = new Map<string, StixObject>()
    for (const obj of bundle.objects) {
      index.set(obj.id, obj)
    }

    // Find all observed-data SDOs
    const observations = bundle.objects.filter(
      (obj) => obj.type === "observed-data"
    ) as ObservedData[]

    // Resolve object_refs for each observation
    const resolved = observations.map((od) => ({
      observedData: od,
      scos: od.object_refs
        .map((ref) => index.get(ref))
        .filter(Boolean) as StixCyberObservable[],
      missingRefs: od.object_refs.filter((ref) => !index.has(ref)),
    }))

    return resolved
  })
```

### TSG.13.4.4 Stage 3: Signal Reconstruction — Kind Discriminator

The codec determines the BaseSignal kind by inspecting the primary SCO type:

```typescript
const discriminateKind = (scos: ReadonlyArray<StixSco>): Effect<KnownSignalKind, CodecError> => {
  const primaryType = scos[0]?.type

  const kindMap: Record<string, KnownSignalKind> = {
    "x-tsingou-nats-message": "nats",
    "x-tsingou-midi-event": "midi",
    "x-tsingou-osc-message": "osc",
    "x-tsingou-serial-data": "serial",
    "x-tsingou-sdr-capture": "sdr",
    "network-traffic": "http",  // refined below
    "url": "rss",               // refined below
    "file": "file-watch",
  }

  const kind = kindMap[primaryType]

  if (!kind) {
    return Effect.fail(CodecError.UnsupportedStixType({ stixType: primaryType }))
  }

  // Refine http vs websocket based on protocol
  if (kind === "http") {
    const netTraffic = scos.find((s) => s.type === "network-traffic") as any
    if (netTraffic?.protocols?.includes("websocket")) {
      return Effect.succeed("websocket" as const)
    }
  }

  // Refine url → rss vs http
  if (kind === "rss") {
    const hasNetTraffic = scos.some((s) => s.type === "network-traffic")
    if (hasNetTraffic) {
      return Effect.succeed("http" as const)
    }
  }

  return Effect.succeed(kind)
}
```

### TSG.13.4.5 Stage 3: Signal Reconstruction — Payload Mapping

Each signal kind has a reverse mapper from STIX SCO properties to BaseSignal payload:

**NATS reverse mapping:**

```typescript
const decodeNatsPayload = (scos: ReadonlyArray<StixSco>): Effect<NatsPayload, CodecError> => {
  const natsMsg = scos.find((s) => s.type === "x-tsingou-nats-message") as any
  if (!natsMsg) {
    return Effect.fail(CodecError.InvalidStix({
      message: "No x-tsingou-nats-message SCO found",
    }))
  }

  return Effect.succeed({
    subject: natsMsg.subject,
    data: natsMsg.data ?? natsMsg.raw_data,
    headers: natsMsg.headers ?? {},
    sequence: natsMsg.sequence,
    stream: natsMsg.stream,
    consumer: natsMsg.consumer,
    replyTo: natsMsg.reply_to ?? undefined,
    serverTimestamp: natsMsg.server_timestamp
      ? new Date(natsMsg.server_timestamp)
      : undefined,
  })
}
```

**HTTP reverse mapping:**

```typescript
const decodeHttpPayload = (scos: ReadonlyArray<StixSco>): Effect<HttpPayload, CodecError> => {
  const netTraffic = scos.find((s) => s.type === "network-traffic") as any
  const urlSco = scos.find((s) => s.type === "url") as any

  if (!urlSco) {
    return Effect.fail(CodecError.InvalidStix({
      message: "No url SCO found for HTTP signal decode",
    }))
  }

  const httpExt = netTraffic?.extensions?.["http-request-ext"]

  return Effect.succeed({
    url: urlSco.value,
    method: httpExt?.request_method ?? "GET",
    statusCode: undefined,  // Not preserved in STIX network-traffic
    body: undefined,
    headers: httpExt?.request_header ?? {},
    contentType: httpExt?.request_header?.["Content-Type"],
    responseTimeMs: undefined,  // Lost in STIX encoding
  })
}
```

### TSG.13.4.6 Information Loss Matrix

Not all BaseSignal fields survive round-trip through STIX. This table documents known information loss:

| Signal Kind | Lost Fields | Reason | Severity |
|------------|------------|--------|----------|
| http | responseTimeMs | No STIX equivalent | LOW |
| http | statusCode | Not in http-request-ext (response-ext needed) | MEDIUM |
| http | sseEventType, sseEventId | No STIX equivalent | LOW |
| nats | consumer | No standard equivalent (preserved in custom SCO) | NONE |
| websocket | connectionSeq | No STIX equivalent | LOW |
| websocket | protocol (subprotocol) | Partially in protocols array | LOW |
| serial | parserType, delimiter | Preserved in custom SCO | NONE |
| midi | pitchBend range encoding | Integer precision preserved | NONE |
| rss | feedTitle | Lost unless wrapped in report SDO | LOW |
| file-watch | lineRange | No STIX equivalent | LOW |
| all | version [tick, source_seq] | Custom property in observed-data | NONE |
| all | metadata (arbitrary) | Custom property in observed-data | NONE |

**Mitigation:** Implementations SHOULD add a custom property `x_tsingou_metadata` to `observed-data` objects to preserve fields that have no STIX equivalent:

```json
{
  "type": "observed-data",
  "id": "observed-data--...",
  "x_tsingou_metadata": {
    "signal_id": "sig_abc123",
    "signal_version": [42, 1],
    "response_time_ms": 123,
    "sse_event_type": "update"
  }
}
```

---

## TSG.13.5 UUID Mapper Service

### TSG.13.5.1 Service Contract

```typescript
interface UuidMapper {
  // Generate deterministic STIX ID for an SDO
  readonly sdoId: (
    signalId: string,
    stixType: string
  ) => Effect<string, UuidMappingFailed>

  // Generate deterministic STIX ID for an SCO
  readonly scoId: (
    signalId: string,
    stixType: string,
    index: number
  ) => Effect<string, UuidMappingFailed>

  // Generate bundle ID
  readonly bundleId: (
    signalId: string
  ) => Effect<string, UuidMappingFailed>

  // Reverse lookup: STIX UUID → SignalId
  readonly reverseMap: (
    stixUuid: string
  ) => Effect<Option<string>, UuidMappingFailed>

  // Register a forward mapping
  readonly register: (
    signalId: string,
    stixUuid: string
  ) => Effect<void, UuidMappingFailed>
}
```

### TSG.13.5.2 UUID Generation Algorithm

```
Input: signalId, stixType, index?
Namespace: TSINGOU_STIX_NS (deployment-specific UUID v5)

SDO: UUIDv5(TSINGOU_STIX_NS, signalId + ":" + stixType)
SCO: UUIDv5(TSINGOU_STIX_NS, signalId + ":sco:" + stixType + ":" + index)
Bundle: UUIDv5(TSINGOU_STIX_NS, signalId + ":bundle")

Output: "<stixType>--" + uuid
```

**Example trace:**

```
signalId = "sig_abc123"
stixType = "observed-data"

namespace input = "sig_abc123:observed-data"
UUIDv5(NS, "sig_abc123:observed-data") = "7f3a8b2c-4d5e-5f6a-8b9c-0d1e2f3a4b5c"

result = "observed-data--7f3a8b2c-4d5e-5f6a-8b9c-0d1e2f3a4b5c"
```

### TSG.13.5.3 Reverse Mapping Store

Implementations MUST maintain a bidirectional mapping store:

| Store Backend | Use Case | Persistence |
|--------------|----------|-------------|
| In-memory Map | Single-session codec operations | None (ephemeral) |
| NATS KV | Multi-instance bridge deployments | JetStream persistence |
| SQLite | Tauri desktop deployments | Local file |

---

## TSG.13.6 Batch and Stream Encoding

### TSG.13.6.1 Batch Encoding

When encoding multiple signals into a single bundle, implementations MUST:

1. Deduplicate identity and extension-definition objects (include each once)
2. Generate one `observed-data` SDO per signal
3. Include all SCOs for all signals
4. Respect bundle size constraints (TSG.12.8.3)

```typescript
const encodeBatch = (signals: ReadonlyArray<BaseSignal>): Effect<StixBundle, CodecError> =>
  Effect.gen(function* () {
    const allSdos: ObservedData[] = []
    const allScos: StixSco[] = []

    for (const signal of signals) {
      const scos = yield* generateScos(signal)
      const sdo = yield* generateObservedData(signal, scos)
      allSdos.push(sdo)
      allScos.push(...scos)
    }

    // Assemble with deduplication
    return yield* assembleBatchBundle(allSdos, allScos)
  })
```

### TSG.13.6.2 Stream Encoding

For pipeline integration, the codec provides a streaming interface:

```typescript
const encodeStream = (
  signals: Stream<BaseSignal>,
  batchSize: number = 100,
  flushIntervalMs: number = 5000
): Stream<StixBundle> =>
  signals.pipe(
    Stream.grouped(batchSize),
    // Also flush on time interval
    Stream.mapEffect((batch) => encodeBatch(batch)),
  )
```

### TSG.13.6.3 Backpressure

The streaming codec MUST respect backpressure from downstream consumers (TAXII POST, file write, etc.):

1. If downstream is slow, the stream buffers up to `maxBatchSize` signals
2. If buffer is full, upstream signal production is paused
3. Backpressure propagates through the NATS consumer (Flow Control)

---

## TSG.13.7 Indicator Encoding

### TSG.13.7.1 d2ts Anomaly → STIX Indicator

When the d2ts analysis engine detects anomalies, the codec MUST encode them as STIX `indicator` objects with patterns:

```typescript
const encodeAnomaly = (anomaly: D2tsAnomaly): Effect<Indicator, CodecError> =>
  Effect.gen(function* () {
    const uuidMapper = yield* UuidMapper
    const identityProvider = yield* IdentityProvider

    const indicatorId = yield* uuidMapper.sdoId(anomaly.id, "indicator")
    const now = new Date().toISOString()

    return {
      type: "indicator" as const,
      spec_version: "2.1" as const,
      id: indicatorId,
      created: now,
      modified: now,
      created_by_ref: yield* identityProvider.platformIdentityId(),
      name: anomaly.name,
      description: anomaly.description,
      indicator_types: [mapAnomalyTypeToIndicatorType(anomaly.type)],
      pattern: yield* generateStixPattern(anomaly),
      pattern_type: "stix" as const,
      valid_from: now,
      confidence: anomaly.confidence,
    }
  })
```

### TSG.13.7.2 STIX Pattern Generation

The codec generates STIX Patterning Language [STIXPATT] expressions from d2ts anomaly parameters:

| Anomaly Type | STIX Pattern Template |
|-------------|----------------------|
| High NATS throughput | `[x-tsingou-nats-message:subject MATCHES '<subject>' AND x-tsingou-nats-message:data.payload_size > <threshold>]` |
| Suspicious HTTP endpoint | `[url:value MATCHES '<url_pattern>' AND network-traffic:extensions.'http-request-ext'.request_method = '<method>']` |
| MIDI velocity anomaly | `[x-tsingou-midi-event:velocity > <threshold> AND x-tsingou-midi-event:channel = <channel>]` |
| File modification burst | `[file:name MATCHES '<pattern>' AND file:size > <threshold>]` |
| OSC address spike | `[x-tsingou-osc-message:address MATCHES '<pattern>']` |
| Serial data anomaly | `[x-tsingou-serial-data:port = '<port>' AND x-tsingou-serial-data:baud_rate = <baud>]` |

### TSG.13.7.3 Pattern Validation

Generated patterns MUST comply with the STIX Patterning Language grammar. Implementations MUST validate patterns before including them in indicator objects:

1. All object types in patterns MUST be valid STIX object types (including custom x-tsingou-* types)
2. Property paths MUST use dot notation for nested properties
3. Comparison operators MUST be valid (=, !=, <, >, <=, >=, MATCHES, LIKE, IN, ISSUBSET, ISSUPERSET)
4. Observation expressions MAY use AND, OR, FOLLOWEDBY combinators
5. Qualifiers (WITHIN, REPEATS, START/STOP) are OPTIONAL

---

## TSG.13.8 Sighting and Relationship Encoding

### TSG.13.8.1 Sighting Generation

When a signal matches a known indicator, the codec MUST generate a `sighting` SRO:

```typescript
const encodeSighting = (
  signal: BaseSignal,
  matchedIndicator: Indicator
): Effect<Sighting, CodecError> =>
  Effect.gen(function* () {
    const uuidMapper = yield* UuidMapper
    const identityProvider = yield* IdentityProvider

    const sightingId = yield* uuidMapper.sdoId(
      `${signal.id}:sighting:${matchedIndicator.id}`,
      "sighting"
    )
    const now = new Date().toISOString()

    return {
      type: "sighting" as const,
      spec_version: "2.1" as const,
      id: sightingId,
      created: now,
      modified: now,
      created_by_ref: yield* identityProvider.platformIdentityId(),
      first_seen: signal.timestamp.toISOString(),
      last_seen: signal.timestamp.toISOString(),
      count: 1,
      sighting_of_ref: matchedIndicator.id,
      observed_data_refs: [
        yield* uuidMapper.sdoId(signal.id, "observed-data"),
      ],
      where_sighted_refs: [
        yield* identityProvider.platformIdentityId(),
      ],
      confidence: 80,
    }
  })
```

### TSG.13.8.2 Relationship Generation

When d2ts correlates signals, the codec generates `relationship` SROs:

| Source Type | Relationship Type | Target Type | Description |
|------------|------------------|-------------|-------------|
| observed-data | derived-from | observed-data | Signal A derived from Signal B |
| indicator | based-on | observed-data | Indicator derived from observations |
| indicator | indicates | malware | Indicator matches known malware |
| observed-data | related-to | observed-data | Temporal or spatial correlation |
| sighting | sighting-of | indicator | Signal matches indicator |

```typescript
const encodeRelationship = (
  sourceId: string,
  relationshipType: string,
  targetId: string,
  description?: string
): Effect<Relationship, CodecError> =>
  Effect.gen(function* () {
    const uuidMapper = yield* UuidMapper
    const now = new Date().toISOString()

    const relId = yield* uuidMapper.sdoId(
      `${sourceId}:rel:${relationshipType}:${targetId}`,
      "relationship"
    )

    return {
      type: "relationship" as const,
      spec_version: "2.1" as const,
      id: relId,
      created: now,
      modified: now,
      relationship_type: relationshipType,
      source_ref: sourceId,
      target_ref: targetId,
      description,
    }
  })
```

---

## TSG.13.9 Effect Layer Composition

### TSG.13.9.1 Service Layer Stack

```typescript
// Live implementation
const StixCodecLive = Layer.effect(
  StixCodec,
  Effect.gen(function* () {
    const uuidMapper = yield* UuidMapper
    const identityProvider = yield* IdentityProvider
    const markingProvider = yield* MarkingProvider
    const extensionRegistry = yield* ExtensionRegistry
    const clock = yield* Clock

    return StixCodec.of({
      encodeSignal: (signal) => /* ... */,
      encodeBatch: (signals) => /* ... */,
      encodeStream: (signals) => /* ... */,
      decodeBundle: (bundle) => /* ... */,
      decodeObservedData: (od, scos) => /* ... */,
      decodeIndicatorPattern: (indicator) => /* ... */,
    })
  })
)

// Full dependency graph
const StixCodecFull = StixCodecLive.pipe(
  Layer.provide(UuidMapperLive),
  Layer.provide(IdentityProviderLive),
  Layer.provide(MarkingProviderLive),
  Layer.provide(ExtensionRegistryLive),
  Layer.provide(Clock.Live),
)
```

### TSG.13.9.2 Test Layer

```typescript
const StixCodecTest = StixCodecLive.pipe(
  Layer.provide(UuidMapperTest),      // Predictable UUIDs
  Layer.provide(IdentityProviderTest), // Fixed identity
  Layer.provide(MarkingProviderTest),  // TLP:CLEAR only
  Layer.provide(ExtensionRegistryTest), // All extensions
  Layer.provide(Clock.Test),           // Fixed timestamp
)
```

---

## TSG.13.10 Validation and Conformance

### TSG.13.10.1 Encode Conformance

Implementations MUST verify that encoded STIX output passes:

1. STIX 2.1 JSON Schema validation
2. Bundle composition completeness (no dangling object_refs)
3. Extension-definition inclusion for all custom types
4. Identity presence for all created_by_ref references
5. Timestamp format compliance (RFC 3339 with Z suffix)

### TSG.13.10.2 Decode Conformance

Implementations MUST handle the following decode scenarios:

| Scenario | Behavior |
|----------|----------|
| Valid Tsingou-generated STIX | Full round-trip reconstruction |
| Valid external STIX with standard SCOs | Best-effort signal reconstruction |
| Valid external STIX with unknown SCO types | Skip unknown, decode known |
| Invalid STIX bundle structure | Reject with CodecError.InvalidStix |
| STIX with missing object_refs targets | Decode available, warn on missing |
| STIX 2.0 objects | Reject with version mismatch error |

### TSG.13.10.3 Round-Trip Test Suite

Implementations MUST pass the following round-trip tests:

| Test | Input | Expected |
|------|-------|----------|
| RT-1 | BaseSignal(kind=nats) | decode(encode(signal)).payload ≡ signal.payload |
| RT-2 | BaseSignal(kind=http) | decode(encode(signal)).payload.url ≡ signal.payload.url |
| RT-3 | BaseSignal(kind=midi) | decode(encode(signal)).payload.note ≡ signal.payload.note |
| RT-4 | BaseSignal(kind=file-watch) | decode(encode(signal)).payload.path ≡ signal.payload.path |
| RT-5 | BaseSignal(kind=rss) | decode(encode(signal)).payload.feedUrl ≡ signal.payload.feedUrl |
| RT-6 | BaseSignal(kind=serial) | decode(encode(signal)).payload.port ≡ signal.payload.port |
| RT-7 | BaseSignal(kind=osc) | decode(encode(signal)).payload.address ≡ signal.payload.address |
| RT-8 | BaseSignal(kind=websocket) | decode(encode(signal)).payload.url ≡ signal.payload.url |
| RT-9 | Batch(100 mixed signals) | decode(encode(batch)).length === 100 |
| RT-10 | External STIX indicator | decodeIndicatorPattern produces valid filter |

---

## TSG.13.11 Performance Considerations

### TSG.13.11.1 Codec Throughput Targets

| Operation | Target (signals/sec) | Rationale |
|-----------|---------------------|-----------|
| Single encode | 10,000+ | Must keep up with NATS ingestion |
| Batch encode (100) | 50,000+ | Amortized bundle overhead |
| Single decode | 5,000+ | External import is less latency-sensitive |
| Stream encode | Wire-rate | Must not bottleneck the d2ts pipeline |

### TSG.13.11.2 Optimization Strategies

1. **Pre-compute identities and extensions**: Resolve once per service lifecycle, not per signal
2. **UUID caching**: Cache UUIDv5 computations for repeated namespace inputs
3. **Schema pre-compilation**: Compile Effect Schema validators once at startup
4. **Object pooling**: Reuse STIX object templates, mutate only variable fields
5. **Batch bundle assembly**: Amortize identity/extension inclusion across batch

---

## TSG.13.12 Security Considerations

### TSG.13.12.1 Payload Sanitization

When encoding signals to STIX, implementations MUST:

1. Sanitize string fields to prevent STIX pattern injection
2. Base64-encode binary payloads (serial raw data, file content)
3. Truncate oversized payloads to bundle size limits
4. Redact sensitive fields per TLP marking level

### TSG.13.12.2 Decode Validation

When decoding external STIX, implementations MUST:

1. Validate all JSON inputs against Schema before processing
2. Reject objects with suspiciously large payloads (DoS mitigation)
3. Sanitize decoded string values before NATS publishing (subject injection prevention)
4. Rate-limit decode operations per source identity

---

## References

| Key | Citation |
|-----|----------|
| [STIX21] | OASIS, "STIX Version 2.1", Committee Specification 03, June 2020 |
| [RFC2119] | IETF, "Key words for use in RFCs to Indicate Requirement Levels", March 1997 |
| [RFC8174] | IETF, "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words", May 2017 |
| [RFC4122] | IETF, "A Universally Unique IDentifier (UUID) URN Namespace", July 2005 |
| [STIXPATT] | OASIS, "STIX Patterning Language", Part 9 of STIX 2.1, June 2020 |
| [EFFECT] | Effect-TS, "Effect: The Missing Standard Library for TypeScript" |

---

*End of Section TSG.13*
