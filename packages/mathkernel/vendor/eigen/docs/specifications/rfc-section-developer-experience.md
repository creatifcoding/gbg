# RFC-001 Section: Developer Experience

```
Section:       Developer Experience
Parent RFC:    RFC-001 (Entity Lifecycle Event Distribution)
Status:        DRAFT
Author:        Val (dx-writer)
Created:       2026-02-09
Research Base: rfc-section-effect-architecture.md (Effect patterns)
               rfc-section-introduction.md (manufacturing commons context)
               src/lib/iiot/rpc/ (RPC inventory)
               src/lib/iiot/entity/ (entity system)
               src/lib/iiot/schemas/ (schema definitions)
Bibliography:  docs/specifications/bibliography.md
```

> This section specifies developer experience requirements for the TMNL IIoT
> platform — a metropolitan-scale manufacturing commons serving 200K+
> organizations. The DX surface must accommodate a spectrum from non-technical
> operator (zero code) to senior Effect-TS engineer (full stack). Every API
> example references existing codebase implementations. File paths are relative
> to `packages/tmnl/src/`.

---

## Table of Contents

- [DX.1 Scope](#dx1-scope)
- [DX.2 Conventions](#dx2-conventions)
- [DX.3 Developer Personas](#dx3-developer-personas)
- [DX.4 SDK Architecture](#dx4-sdk-architecture)
- [DX.5 API Surface](#dx5-api-surface)
- [DX.6 Client Libraries](#dx6-client-libraries)
- [DX.7 CLI Tools](#dx7-cli-tools)
- [DX.8 Documentation Strategy](#dx8-documentation-strategy)
- [DX.9 Error Messages and Diagnostics](#dx9-error-messages-and-diagnostics)
- [DX.10 Testing Support](#dx10-testing-support)
- [DX.11 Codebase Grounding](#dx11-codebase-grounding)

---

## DX.1 Scope

This section defines normative requirements for the developer-facing surface
of the TMNL manufacturing commons. The DX specification covers:

1. **SDK architecture** — TypeScript client library (`@tmnl/sdk`) exposing both
   Effect-native and Promise-based APIs for consuming entity lifecycle events,
   executing RPCs, and subscribing to real-time streams.

2. **API surface** — The full RPC inventory derived from `IIoTRpcs`
   (`lib/iiot/rpc/index.ts`), including 16 RPC groups spanning entity
   lifecycle, hierarchy queries, time-series telemetry, and streaming
   subscriptions.

3. **Client libraries** — Language-specific bindings (TypeScript primary,
   Python and Rust secondary) providing idiomatic access to the platform's
   RPC and streaming APIs.

4. **CLI tools** — Terminal-based operations for device registration,
   monitoring, alarm management, and diagnostic testing.

5. **Documentation** — Persona-targeted guides, auto-generated API reference,
   interactive playground, and example applications.

6. **Error handling** — Structured error taxonomy with machine-readable codes,
   Effect Cause traces, and suggested remediation steps.

7. **Testing support** — Mock services, entity test harnesses, event replay,
   and per-developer sandbox environments.

This section does NOT specify:

- Internal service implementation (covered in Effect Architecture section)
- Wire protocol details (covered in Edge Architecture section)
- Deployment topology (covered in Deployment section)
- Security authentication flows (covered in Security & Trust section)

---

## DX.2 Conventions

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be
interpreted as described in [RFC2119] and [RFC8174].

Additional conventions:

| Convention | Meaning |
|---|---|
| `Effect<A, E, R>` | Effect-TS computation with success `A`, error `E`, requirements `R` |
| `Stream<A, E, R>` | Effect-TS pull-based stream emitting `A` values |
| `Schema.TaggedClass` | Effect Schema class with `_tag` discriminator |
| `Schema.TaggedError` | Effect Schema error with `_tag` discriminator |
| `RpcGroup.make(...)` | Composition of multiple RPCs into a named group |
| `EntityProxy.toRpcGroup(E)` | Auto-generation of entity lifecycle RPCs |

---

## DX.3 Developer Personas

The TMNL platform serves four distinct developer personas, each with different
technical depth, tooling needs, and interaction patterns. SDK design decisions
MUST consider all four personas as primary consumers.

### DX.3.1 Non-Developer Operator ("Earl")

**Profile**: Owner of a 2-person machine shop. NOT a software developer.
Needs to register equipment, view dashboards, acknowledge alarms, and
manage work orders — all via web interface. Zero code required.

**Interaction surface**:
- Web dashboard (React, pre-built components)
- Alarm acknowledgment via single button press
- Work order submission via form wizard
- Device registration via guided onboarding flow

**DX requirements**:
- Platform MUST provide a zero-code path for all core operations
- Web dashboard MUST NOT require Effect-TS knowledge
- Error messages MUST be written in plain language, not technical jargon
- Onboarding MUST complete in under 15 minutes for a single-device setup

**Relevant RPCs consumed (via dashboard, not directly)**:

| Operation | RPC | Source |
|---|---|---|
| View sensor readings | `SensorReading.GetLatest` | `lib/iiot/rpc/SensorRpcs.ts:26` |
| Acknowledge alarm | `Alarm.Acknowledge` | `lib/iiot/entity/AlarmEntity.ts` |
| View plant hierarchy | `PlantHierarchy.Get` | `lib/iiot/rpc/AssetRpcs.ts:55` |
| Submit work order | `WorkOrder.Create` | `lib/iiot/entity/WorkOrderEntity.ts` |

### DX.3.2 Integration Developer

**Profile**: Mid-level developer integrating TMNL into existing MES/ERP
systems. Comfortable with REST/WebSocket APIs and JavaScript. May use
Effect-TS but does not require it. Builds custom dashboards, alerting
pipelines, and data export workflows.

**Interaction surface**:
- `@tmnl/client` — Promise-based TypeScript client
- REST API via HTTP endpoints
- WebSocket subscriptions for real-time data
- CLI for device management and diagnostics

**DX requirements**:
- SDK MUST provide a Promise-based API that does not require Effect-TS
- WebSocket client MUST handle reconnection automatically
- All RPC payloads and responses MUST have corresponding JSON Schema
  documentation auto-generated from Effect Schema definitions [EFFECT-SCHEMA]
- API reference MUST include runnable code examples

### DX.3.3 Platform Developer

**Profile**: Senior Effect-TS engineer building custom entity types,
extending the RPC surface, or implementing complex stream processing
pipelines. Works with `@effect/cluster`, `@effect/rpc`, and raw
`Stream<A, E, R>` composition.

**Interaction surface**:
- `@tmnl/sdk` — Full Effect-native API (`Effect<A, E, R>`)
- Direct `@effect/rpc` client with type-safe RPC invocation
- `Stream` API for composing real-time pipelines
- Entity definition toolkit for custom entity types
- Layer composition for service dependency management

**DX requirements**:
- SDK MUST expose the full `Effect<A, E, R>` type including error channel
- Stream subscriptions MUST preserve backpressure semantics [EFFECT-STREAM]
- Entity definition MUST follow the `Schema.TaggedClass` + `Machine` +
  `Entity` composition pattern established in existing entities
- Layer composition MUST be documented with dependency graph visualization

### DX.3.4 Hardware Developer

**Profile**: Firmware engineer programming edge devices (PLC, gateway, sensor
module) to publish data to TMNL. Works in C/Rust, speaks MQTT/Sparkplug-B,
and does NOT use TypeScript.

**Interaction surface**:
- MQTT/Sparkplug-B protocol for telemetry publishing [SPARKPLUG-B]
- `tmnl-rs` Rust client for edge device integration
- HTTP REST fallback for simple device registration
- CLI for device provisioning and certificate management

**DX requirements**:
- Edge devices MUST be able to publish readings using standard Sparkplug-B
  payloads without custom protocol extensions
- Device registration MUST support both CLI-driven and API-driven workflows
- TLS certificates MUST be provisionable via CLI (`tmnl devices provision`)
- Firmware SDK documentation MUST include memory and CPU overhead estimates

---

## DX.4 SDK Architecture

### DX.4.1 Package Structure

Implementations MUST provide the following npm packages:

| Package | Description | Primary Persona |
|---|---|---|
| `@tmnl/sdk` | Full Effect-native SDK — `Effect<A, E, R>` API | Platform developer |
| `@tmnl/client` | Promise-based wrapper — `async/await` API | Integration developer |
| `@tmnl/testing` | Mock services, test harnesses, event replay | All developers |
| `@tmnl/types` | Shared TypeScript types and Schema definitions | All developers |

### DX.4.2 Effect-Native API (`@tmnl/sdk`)

The primary SDK MUST expose RPCs as typed Effect computations. The client
MUST be constructed from the `IIoTRpcs` group definition
(`lib/iiot/rpc/index.ts:91-112`).

**Normative example — creating an RPC client**:

```typescript
import { RpcClient } from '@effect/rpc'
import { RpcSerialization } from '@effect/rpc'
import { IIoTRpcs } from '@tmnl/sdk'
import { Effect, Layer } from 'effect'

// Create typed RPC client from IIoTRpcs group
const client = RpcClient.make(IIoTRpcs)

// Request-response RPC
const getPlant = client.Plant.Get({
  plantId: 'PLT-chicago-main' as PlantId,
}).pipe(
  Effect.provide(RpcSerialization.layerJson),
  Effect.provide(WebSocketTransportLive),
)

// Streaming RPC — returns Stream<SensorReading, RealtimeError>
const readings = client.Realtime.SubscribeReadings({
  deviceId: 'DEV-temp-01' as DeviceId,
  throttleMs: 1000,
})
```

**Codebase proof**: The `IIoTRpcs` group is defined at `lib/iiot/rpc/index.ts:91-112`
by composing all 16 RPC sub-groups via `RpcGroup.make()` with spread of
`requests.values()`. This single group definition is the canonical source
for the SDK's type-safe client surface.

### DX.4.3 Promise-Based Wrapper (`@tmnl/client`)

For integration developers who do not use Effect-TS, the client library
MUST provide a Promise-based API that wraps the Effect computation with
`Effect.runPromise`.

**Normative example — Promise wrapper**:

```typescript
import { TmnlClient } from '@tmnl/client'

const client = new TmnlClient({
  endpoint: 'wss://api.tmnl.io/ws/iiot',
  token: process.env.TMNL_API_TOKEN,
})

// Request-response — returns Promise<Plant>
const plant = await client.plants.get('PLT-chicago-main')

// Streaming — returns AsyncIterable<SensorReading>
for await (const reading of client.realtime.subscribeReadings({
  deviceId: 'DEV-temp-01',
})) {
  console.log(`${reading.metricName}: ${reading.value} ${reading.unit}`)
}

// Alarm acknowledgment — returns Promise<void>
await client.alarms.acknowledge('ALM-001', {
  acknowledgedBy: 'earl@machineshop.com',
})
```

The Promise wrapper MUST:

1. **Preserve error typing** — Errors from `Schema.TaggedError` MUST be
   converted to structured JavaScript Error subclasses with `code`, `_tag`,
   and `details` properties.

2. **Handle WebSocket lifecycle** — Connection, reconnection, and subscription
   management MUST be automatic with configurable retry parameters.

3. **Convert Streams to AsyncIterables** — All `stream: true` RPCs
   MUST be exposed as `AsyncIterable<T>` using `Stream.toAsyncIterable`
   [EFFECT-STREAM].

4. **Provide JSON Schema for payloads** — Every RPC payload MUST have a
   JSON Schema generated via `JSONSchema.make()` [EFFECT-SCHEMA] for
   validation and documentation.

### DX.4.4 WebSocket Client with Auto-Reconnect

The SDK WebSocket transport MUST implement the following reconnection protocol:

| Parameter | Default | Description |
|---|---|---|
| `initialDelayMs` | 1000 | First reconnect delay |
| `maxDelayMs` | 30000 | Maximum backoff ceiling |
| `backoffMultiplier` | 2.0 | Exponential backoff factor |
| `maxRetries` | Infinity | Unlimited by default |
| `jitterFactor` | 0.2 | Random jitter (0-20% of delay) |

On reconnection, the client MUST:

1. Re-establish WebSocket connection to `wss://{host}/ws/iiot`
2. Re-subscribe to all active stream subscriptions
3. Emit a `reconnected` event to application code
4. NOT replay missed events (subscriptions are stateless;
   use `SensorReading.Query` with time range for gap-fill)

**Codebase grounding**: The reconnection model aligns with the stateless
subscription design documented in Phase 5 architecture plans. Clients manage
reconnect and re-subscribe; the server does not track session state.

### DX.4.5 Stream API for Real-Time Entity Events

The SDK MUST expose four real-time subscription streams, corresponding to
the `RealtimeRpcs` group (`lib/iiot/rpc/RealtimeRpcs.ts:183-188`):

| Stream RPC | Success Type | Filter Parameters | Source |
|---|---|---|---|
| `Realtime.SubscribeReadings` | `SensorReading` | `deviceId?`, `plantId?`, `throttleMs?` | `RealtimeRpcs.ts:107` |
| `Realtime.SubscribeAlarms` | `AlarmEvent` | `deviceId?`, `minSeverity?`, `onlyUnacknowledged?` | `RealtimeRpcs.ts:129` |
| `Realtime.SubscribeEquipmentState` | `EquipmentStateChange` | `entityType?`, `plantId?` | `RealtimeRpcs.ts:149` |
| `Realtime.SubscribeInvalidations` | `CacheInvalidation` | `patterns` | `RealtimeRpcs.ts:169` |

All stream RPCs use `stream: true` in their `Rpc.make()` definition,
which causes the RPC server to emit events as an `Effect.Stream`
rather than a single response [EFFECT-RPCGROUP].

---

## DX.5 API Surface

### DX.5.1 RPC Group Inventory

The complete API surface is defined by `IIoTRpcs` (`lib/iiot/rpc/index.ts`),
which composes 16 RPC sub-groups. Implementations MUST expose all groups
through the SDK client.

#### Stateless Query RPCs

| Group | Operations | Style | Source |
|---|---|---|---|
| `SensorRpcs` | `GetLatest`, `Query` (stream), `QueryAggregated` (stream), `Subscribe` (stream) | Request/Stream | `lib/iiot/rpc/SensorRpcs.ts` |
| `AssetRpcs` | `ListPlants` (stream), `GetPlant`, `GetPlantHierarchy`, `ListLinesForPlant` (stream), `ListMachinesForLine` (stream), `GetMachineWithSensors`, `ListSensorsForMachine` (stream), `GetSensorHierarchy` | Request/Stream | `lib/iiot/rpc/AssetRpcs.ts` |

#### Entity-Derived RPCs (via `EntityProxy.toRpcGroup`)

Each entity automatically generates `${Entity}.${Operation}` and
`${Entity}.${Operation}Discard` (fire-and-forget) RPCs via
`EntityProxy.toRpcGroup()` [EFFECT-ENTITY].

| Group | Entity Operations | Source |
|---|---|---|
| `AlarmRpcs` | `Create`, `Get`, `Acknowledge`, `Clear` + `Query` (stream), `GetContext`, `GetStats` | `lib/iiot/rpc/AlarmRpcs.ts` |
| `WorkOrderRpcs` | `Create`, `Get`, `Submit`, `Approve`, `Reject`, `Start`, `Suspend`, `Resume`, `Complete`, `Fail`, `Cancel`, `Close` | `lib/iiot/rpc/WorkOrderRpcs.ts` |
| `EquipmentStateRpcs` | `GetCurrent`, `GetHistory`, `Transition`, `UpdateReason`, `GetOee`, `GetDurations` | `lib/iiot/rpc/EquipmentStateRpcs.ts` |
| `PlantRpcs` | `Create`, `Get`, `CompleteCommissioning`, `ScheduledShutdown`, `Restart`, `EmergencyShutdown` | `lib/iiot/rpc/PlantRpcs.ts` |
| `LineRpcs` | `Create`, `Get`, `Start`, `Stop`, `BeginChangeover`, `CompleteChangeover`, `MarkStarved` | `lib/iiot/rpc/LineRpcs.ts` |
| `WorkCellRpcs` | `Create`, `Get`, `BeginSetup`, `CompleteSetup`, `Stop`, `MarkBlocked`, `ClearBlocked` | `lib/iiot/rpc/WorkCellRpcs.ts` |
| `MachineAssetRpcs` | `Create`, `Get`, `Activate`, `GoIdle`, `Resume`, `MarkFaulted`, `ScheduleRepair` | `lib/iiot/rpc/MachineAssetRpcs.ts` |
| `DeviceRpcs` | `Create`, `Get`, `GoOnline`, `GoOffline`, `MarkFaulted`, `ClearFault` | `lib/iiot/rpc/DeviceRpcs.ts` |
| `SensorAssetRpcs` | `Create`, `Get`, `StartCalibration`, `CompleteCalibration`, `FailCalibration` | `lib/iiot/rpc/SensorAssetRpcs.ts` |
| `EnterpriseRpcs` | `Create`, `Get`, `Restructure`, `CompleteRestructuring`, `Merge`, `Dissolve` | `lib/iiot/rpc/EnterpriseRpcs.ts` |
| `SiteRpcs` | `Create`, `Get`, `BeginConstruction`, `Commission`, `SeasonalShutdown`, `Reopen`, `Close`, `Decommission` | `lib/iiot/rpc/SiteRpcs.ts` |
| `AreaRpcs` | `Create`, `Get`, `Restrict`, `ClearRestriction`, `EnterMaintenance`, `ExitMaintenance` | `lib/iiot/rpc/AreaRpcs.ts` |
| `AssetEntityRpcs` | `Get`, `GetChildren`, `GetHierarchy`, `Update` | `lib/iiot/rpc/AssetEntityRpcs.ts` |
| `SensorEntityRpcs` | `GetState`, `GetLatest`, `GetAggregated`, `GetStats` | `lib/iiot/rpc/SensorEntityRpcs.ts` |

#### Realtime Streaming RPCs

| Group | Operations | Source |
|---|---|---|
| `RealtimeRpcs` | `SubscribeReadings`, `SubscribeAlarms`, `SubscribeEquipmentState`, `SubscribeInvalidations` | `lib/iiot/rpc/RealtimeRpcs.ts` |

### DX.5.2 Schema-First API Design

All RPC inputs and outputs are defined via Effect Schema [EFFECT-SCHEMA].
This ensures:

1. **Runtime validation** — Every incoming RPC payload is validated against
   its Schema before handler execution. Invalid payloads produce a structured
   `ParseError` with path information.

2. **Type inference** — TypeScript types are inferred from Schema definitions,
   eliminating type drift between runtime validation and compile-time types.

3. **JSON Schema generation** — Every Schema produces a JSON Schema via
   `JSONSchema.make()`, used for OpenAPI documentation and client-side
   validation.

4. **Encode/decode transformations** — Schemas handle serialization concerns
   (e.g., `DateTimeUtc` to ISO string, `Option` to nullable) transparently.

**Normative example — Schema-driven RPC definition**:

```typescript
// From lib/iiot/rpc/SensorRpcs.ts:26-32
export const GetLatest = Rpc.make(SensorReadingGetLatestTag, {
  payload: Schema.Struct({
    deviceId: DeviceId,          // Branded string: /^DEV-[a-zA-Z0-9-]+$/
  }),
  success: Schema.OptionFromNullOr(SensorReading),
  error: RpcQueryError,          // Schema.TaggedError with _tag discriminator
})
```

**Normative example — Entity Schema with branded identifiers**:

```typescript
// From lib/iiot/schemas/assets/sensor/schema.ts:30-37
export const SensorId = Schema.String.pipe(
  Schema.pattern(/^SNS-[a-zA-Z0-9-]+$/),
  Schema.brand('SensorId'),
  Schema.annotations({
    identifier: '@gbg/tmnl/iiot/SensorId',
    description: 'Sensor identifier with SNS- prefix',
  })
)
```

### DX.5.3 Error Schema Taxonomy

All RPC errors MUST use `Schema.TaggedError` from `lib/iiot/rpc/errors.ts`.
Error types are organized by domain:

| Error Class | Tag | Domain | Source |
|---|---|---|---|
| `RpcQueryError` | `RpcQueryError` | Generic query failure | `errors.ts:18` |
| `RpcGraphError` | `RpcGraphError` | Hierarchy graph failure | `errors.ts:24` |
| `RpcDeviceNotFoundError` | `RpcDeviceNotFoundError` | Sensor/device lookup | `errors.ts:33` |
| `RpcPlantNotFoundError` | `RpcPlantNotFoundError` | Plant lookup | `errors.ts:62` |
| `RpcMachineNotFoundError` | `RpcMachineNotFoundError` | Machine lookup | `errors.ts:54` |
| `RpcAlarmNotFoundError` | `RpcAlarmNotFoundError` | Alarm lookup | `errors.ts:79` |
| `RpcAlarmAlreadyAcknowledgedError` | `RpcAlarmAlreadyAcknowledgedError` | Alarm state conflict | `errors.ts:87` |
| `RpcAlarmAlreadyClearedError` | `RpcAlarmAlreadyClearedError` | Alarm state conflict | `errors.ts:95` |
| `RpcHierarchyError` | `RpcHierarchyError` | ISA-95 hierarchy failure | `errors.ts:70` |
| `RealtimeError` | `RealtimeError` | Subscription failure | `RealtimeRpcs.ts:31` |

---

## DX.6 Client Libraries

### DX.6.1 TypeScript/JavaScript (Primary): `@tmnl/client`

**Status**: Primary client. MUST be maintained in lockstep with `IIoTRpcs`.

**Architecture**:
- Generated from `IIoTRpcs` type definition
- Promise-based API wrapping Effect computations
- WebSocket transport with auto-reconnect (DX.4.4)
- AsyncIterable for all streaming RPCs
- Tree-shakeable — unused RPC groups are excluded by bundler

**Installation**:

```bash
bun add @tmnl/client
# or
npm install @tmnl/client
```

**Configuration**:

```typescript
import { TmnlClient } from '@tmnl/client'

const client = new TmnlClient({
  // Required
  endpoint: 'wss://api.tmnl.io/ws/iiot',
  token: '<api-token>',

  // Optional
  reconnect: {
    enabled: true,           // default: true
    maxRetries: Infinity,    // default: Infinity
    initialDelayMs: 1000,    // default: 1000
    maxDelayMs: 30000,       // default: 30000
  },
  serialization: 'json',    // default: 'json', future: 'msgpack'
  timeout: 30000,            // default: 30000ms per request
})
```

### DX.6.2 Python: `tmnl-py`

**Status**: Secondary client. RECOMMENDED for data science and ML integration.

**Architecture**:
- HTTP REST transport (WebSocket OPTIONAL)
- `asyncio`-native with `async/await` API
- Pydantic models generated from JSON Schema
- pandas DataFrame integration for time-series queries

**Example**:

```python
from tmnl import TmnlClient

client = TmnlClient(
    endpoint="https://api.tmnl.io",
    token=os.environ["TMNL_API_TOKEN"],
)

# Get sensor readings as DataFrame
readings = await client.sensors.query(
    device_id="DEV-temp-01",
    since=datetime(2026, 1, 1),
    until=datetime(2026, 2, 1),
)
df = readings.to_dataframe()  # pandas DataFrame
```

### DX.6.3 Rust: `tmnl-rs`

**Status**: Secondary client. RECOMMENDED for edge device firmware.

**Architecture**:
- MQTT/Sparkplug-B transport for telemetry publishing [SPARKPLUG-B]
- HTTP REST transport for device registration and management
- `no_std`-compatible core for embedded targets
- `tokio` async runtime for gateway applications

**Example**:

```rust
use tmnl::DeviceClient;

let client = DeviceClient::new(
    "mqtt://broker.tmnl.io:1883",
    &device_cert,
)?;

// Publish sensor reading via Sparkplug-B
client.publish_reading(Reading {
    device_id: "DEV-temp-01",
    metric_name: "motor_temperature",
    value: 72.5,
    unit: "celsius",
    timestamp: Utc::now(),
}).await?;
```

### DX.6.4 HTTP REST Fallback

For any language without a dedicated client library, the platform MUST
expose all request-response RPCs via HTTP REST endpoints.

| HTTP Method | Path Pattern | Corresponding RPC |
|---|---|---|
| `GET` | `/api/v1/plants` | `Plant.List` |
| `GET` | `/api/v1/plants/{plantId}` | `Plant.Get` |
| `GET` | `/api/v1/plants/{plantId}/hierarchy` | `PlantHierarchy.Get` |
| `POST` | `/api/v1/alarms/{alarmId}/acknowledge` | `Alarm.Acknowledge` |
| `GET` | `/api/v1/sensors/{deviceId}/latest` | `SensorReading.GetLatest` |
| `GET` | `/api/v1/sensors/{deviceId}/readings` | `SensorReading.Query` |
| `POST` | `/api/v1/work-orders` | `WorkOrder.Create` |

Streaming RPCs (e.g., `Realtime.SubscribeReadings`) are NOT available via
REST. Clients MUST use WebSocket for streaming subscriptions.

---

## DX.7 CLI Tools

### DX.7.1 `tmnl` CLI

The `tmnl` command-line tool MUST provide terminal-based access to platform
operations. It targets integration developers and hardware developers who
prefer terminal workflows over web dashboards.

**Installation**:

```bash
# Via npm/bun
bun add -g @tmnl/cli

# Via Nix
nix profile install github:gbg/tmnl#cli
```

### DX.7.2 Command Reference

#### Organization and Connection

```bash
# Initialize a new org connection (interactive wizard)
tmnl init

# Show current connection status
tmnl status

# List organizations the current token can access
tmnl orgs list
```

#### Device Management

```bash
# List registered devices
tmnl devices list

# Register a new device
tmnl devices register --name "Motor Temp Sensor" \
  --type temperature --unit celsius \
  --machine MCH-motor-01

# Provision TLS certificates for a device
tmnl devices provision DEV-temp-01 --output ./certs/

# Show device details and current state
tmnl devices show DEV-temp-01
```

#### Real-Time Monitoring

```bash
# Tail live sensor readings (streams to stdout)
tmnl stream readings --device DEV-temp-01

# Tail readings for all devices in a plant
tmnl stream readings --plant PLT-chicago-main

# Stream equipment state changes
tmnl stream equipment --entity-type Machine

# Stream alarm events, filtered by severity
tmnl stream alarms --min-severity critical
```

#### Alarm Management

```bash
# List active alarms
tmnl alarms list --status active

# Acknowledge an alarm
tmnl alarms ack ALM-001 --by "earl@machineshop.com"

# View alarm context (readings around trigger time)
tmnl alarms context ALM-001 --window 5m
```

#### Work Order Management

```bash
# List work orders by status
tmnl work-orders list --status in_progress

# Create a new work order
tmnl work-orders create --title "Replace motor bearing" \
  --machine MCH-motor-01 --priority high

# Advance work order state
tmnl work-orders submit WO-001
tmnl work-orders approve WO-001 --by "supervisor@plant.com"
tmnl work-orders start WO-001
tmnl work-orders complete WO-001
```

#### Diagnostics

```bash
# Test connection to platform
tmnl diagnostics connection-test

# Check device connectivity
tmnl diagnostics device-health DEV-temp-01

# Validate Sparkplug-B topic structure
tmnl diagnostics sparkplug-validate --namespace spBv1.0/MyOrg
```

### DX.7.3 Output Formats

The CLI MUST support multiple output formats:

| Flag | Format | Use Case |
|---|---|---|
| (default) | Human-readable table | Interactive terminal |
| `--json` | JSON | Script integration |
| `--csv` | CSV | Spreadsheet export |
| `--jsonl` | JSON Lines | Stream processing |

---

## DX.8 Documentation Strategy

### DX.8.1 Getting Started Guide

Implementations MUST provide a "zero to first data" guide that completes
in under 15 minutes. The guide MUST cover:

1. **Install CLI** (2 minutes): `bun add -g @tmnl/cli`
2. **Initialize connection** (1 minute): `tmnl init` (interactive wizard)
3. **Register a device** (2 minutes): `tmnl devices register ...`
4. **Publish a reading** (3 minutes): curl or Sparkplug-B example
5. **View live data** (2 minutes): `tmnl stream readings --device DEV-001`
6. **Acknowledge an alarm** (1 minute): `tmnl alarms ack ALM-001`

The guide MUST include copy-pasteable commands and expected output.

### DX.8.2 API Reference (Auto-Generated)

The API reference MUST be auto-generated from Effect Schema definitions.
For each RPC:

- **Request Schema**: JSON Schema with property descriptions, types, and
  constraints (patterns, ranges, enums)
- **Response Schema**: JSON Schema for success type
- **Error Schema**: JSON Schema for each error variant with `_tag`
  discriminator
- **Code example**: TypeScript (`@tmnl/client`) and curl

**Generation pipeline**:

```
Effect Schema → JSONSchema.make() → OpenAPI 3.1 Spec → Rendered docs
```

**Codebase proof**: Every schema in `lib/iiot/schemas/` uses
`Schema.annotations()` with `identifier` and `description` fields
(e.g., `lib/iiot/schemas/assets/sensor/schema.ts:33-36`). These
annotations propagate to the generated JSON Schema.

### DX.8.3 Tutorials by Persona

| Persona | Tutorial | Content |
|---|---|---|
| Operator (Earl) | "Your First Dashboard" | Web wizard, alarm ack, work order form |
| Integration Dev | "Connect Your MES" | REST API, WebSocket subscriptions, error handling |
| Integration Dev | "Build an Alerting Bot" | Subscribe to alarms, send Slack/email notifications |
| Platform Dev | "Custom Entity Type" | Schema.TaggedClass, Machine graph, Entity definition |
| Platform Dev | "Stream Processing Pipeline" | Stream.filter, Stream.aggregate, backpressure |
| Hardware Dev | "Sparkplug-B Device" | MQTT publish, topic structure, certificate setup |
| Hardware Dev | "Edge Gateway" | Rust client, batch publish, offline buffering |

### DX.8.4 Interactive Playground

The platform MUST provide a browser-based playground for testing WebSocket
subscriptions and RPC calls without writing code. The playground MUST:

1. Authenticate via browser session token
2. Provide a WebSocket test panel with subscription builder
3. Show real-time event stream with JSON syntax highlighting
4. Allow sending RPC requests with form-based payload editor
5. Display request/response timing and error details

### DX.8.5 Example Applications

The documentation MUST include complete, runnable example applications:

| Example | Language | Concepts |
|---|---|---|
| `examples/dashboard` | TypeScript + React | `@tmnl/client`, WebSocket subscription, live charts |
| `examples/alerting-bot` | TypeScript | `@tmnl/sdk`, `Stream.filter`, Slack webhook |
| `examples/capacity-monitor` | Python | `tmnl-py`, pandas, equipment state aggregation |
| `examples/edge-gateway` | Rust | `tmnl-rs`, Sparkplug-B publish, offline buffer |
| `examples/oee-calculator` | TypeScript | `@tmnl/sdk`, `EquipmentState.GetOee`, time-series |

---

## DX.9 Error Messages and Diagnostics

### DX.9.1 Structured Error Model

All platform errors MUST follow the structured error model:

```typescript
interface TmnlError {
  /** Machine-readable error code (TMNL-E-001 through TMNL-E-999) */
  code: string

  /** Error tag from Schema.TaggedError */
  _tag: string

  /** Human-readable message suitable for operator display */
  message: string

  /** Suggested remediation steps (1-3 sentences) */
  suggestion?: string

  /** Structured details (varies by error type) */
  details?: Record<string, unknown>

  /** Effect Cause trace (platform developers only, opt-in) */
  cause?: string
}
```

### DX.9.2 Error Code Registry

Error codes MUST follow the format `TMNL-E-{category}{number}`:

| Range | Category | Examples |
|---|---|---|
| `TMNL-E-1xx` | Authentication & Authorization | `TMNL-E-101`: Token expired, `TMNL-E-102`: Insufficient permissions |
| `TMNL-E-2xx` | Entity Not Found | `TMNL-E-201`: Device not found, `TMNL-E-202`: Alarm not found |
| `TMNL-E-3xx` | Validation | `TMNL-E-301`: Invalid payload, `TMNL-E-302`: Schema validation failed |
| `TMNL-E-4xx` | State Transition | `TMNL-E-401`: Invalid transition, `TMNL-E-402`: Alarm already acknowledged |
| `TMNL-E-5xx` | Subscription | `TMNL-E-501`: Subscription failed, `TMNL-E-502`: Rate limited |
| `TMNL-E-6xx` | Infrastructure | `TMNL-E-601`: Database unavailable, `TMNL-E-602`: Broker disconnected |
| `TMNL-E-7xx` | Hierarchy | `TMNL-E-701`: Hierarchy cycle detected, `TMNL-E-702`: Orphaned entity |
| `TMNL-E-8xx` | Work Order | `TMNL-E-801`: Approval required, `TMNL-E-802`: Compliance violation |
| `TMNL-E-9xx` | Reserved | Future expansion |

### DX.9.3 Error Message Quality Standards

Every error message MUST include:

1. **What happened** — Factual description of the failure
2. **Why it happened** — Root cause or context
3. **What to do** — Actionable next step

**Normative examples**:

```
TMNL-E-201: Device 'DEV-temp-01' not found.
  The device may not be registered or may belong to a different organization.
  Suggestion: Run `tmnl devices list` to see available devices, or
  `tmnl devices register` to add a new device.

TMNL-E-402: Alarm 'ALM-001' has already been acknowledged.
  Alarm was acknowledged by earl@machineshop.com at 2026-02-09T14:30:00Z.
  Suggestion: Use `tmnl alarms list --status acknowledged` to see acknowledged alarms.

TMNL-E-301: Invalid payload for WorkOrder.Create.
  Field 'priority' must be one of: 'low', 'medium', 'high', 'critical'.
  Received: 'urgent'.
  Suggestion: Check the API reference for valid WorkOrder.Create parameters.
```

### DX.9.4 Diagnostic Endpoint

Implementations MUST expose a diagnostic endpoint for connection testing:

```
POST /diagnostics/connection-test
Content-Type: application/json

{
  "checks": ["websocket", "database", "broker", "auth"]
}
```

Response:

```json
{
  "status": "partial",
  "checks": {
    "websocket": { "status": "ok", "latencyMs": 12 },
    "database": { "status": "ok", "latencyMs": 3 },
    "broker": { "status": "degraded", "latencyMs": 450, "message": "High latency to NATS cluster" },
    "auth": { "status": "ok", "latencyMs": 8 }
  },
  "timestamp": "2026-02-09T14:30:00Z"
}
```

---

## DX.10 Testing Support

### DX.10.1 `@tmnl/testing` Package

The testing package MUST provide mock implementations of all platform
services for integration testing without requiring a running backend.

**Architecture**:

```typescript
import { TestRunner, MockEntities, EventReplay } from '@tmnl/testing'
```

### DX.10.2 Mock Services

Mock services MUST replicate the behavior of the full entity lifecycle
including state machine validation.

**Normative example — testing alarm acknowledgment**:

```typescript
import { TestRunner } from '@tmnl/testing'
import { Effect } from 'effect'
import { AlarmEntity } from '@tmnl/sdk'

const runner = TestRunner.make({
  entities: [AlarmEntity],
  // Uses in-memory storage, no database required
})

// Create and acknowledge an alarm
const test = Effect.gen(function* () {
  const alarm = yield* runner.send(AlarmEntity, 'ALM-001', {
    _tag: 'Create',
    deviceId: 'DEV-temp-01',
    severity: 'critical',
    message: 'Motor temperature exceeded threshold',
  })

  yield* runner.send(AlarmEntity, 'ALM-001', {
    _tag: 'Acknowledge',
    acknowledgedBy: 'operator@plant.com',
  })

  const state = yield* runner.getState(AlarmEntity, 'ALM-001')
  expect(state.status).toBe('acknowledged')
})
```

**Codebase proof**: The test harness pattern mirrors `EntityTestingStack`
at `lib/iiot/entity/EntityStack.ts`, which provides `EntityHandlersLayer`
and `EntityProductionHandlersWithEvents` for composable test layers [EFFECT-LAYER].

### DX.10.3 Entity Test Harness

For platform developers creating custom entity types, the testing package
MUST provide a harness that validates:

1. **State machine transitions** — Every transition defined in the Machine
   graph is reachable and tested
2. **Invalid transition rejection** — Illegal state transitions produce
   appropriate errors
3. **Event sourcing** — Events are recorded and state is reconstructable
   from the event log
4. **Concurrent access** — Multiple simultaneous commands to the same
   entity are serialized correctly

### DX.10.4 Recorded Event Replay

The testing package MUST support replaying recorded production events
for regression testing:

```typescript
import { EventReplay } from '@tmnl/testing'

const replay = EventReplay.fromFile('./fixtures/alarm-cascade-2026-02-01.jsonl')

// Replay events at 10x speed
await replay.run({
  speed: 10,
  onEvent: (event) => {
    // Verify system behavior for each replayed event
  },
})
```

### DX.10.5 Sandbox Environment

Each developer MUST have access to an isolated sandbox environment:

| Feature | Sandbox Behavior |
|---|---|
| Data isolation | Separate NATS account per developer [NATS-ACCOUNTS] |
| Entity state | Ephemeral — reset on sandbox restart |
| Rate limits | Relaxed (10x production limits) |
| Retention | 24-hour data retention |
| Monitoring | Full observability (traces, metrics, logs) |

---

## DX.11 Codebase Grounding

This section maps DX concepts to existing implementations in the codebase.

### DX.11.1 RPC Definitions

| File | Role | Line Count |
|---|---|---|
| `lib/iiot/rpc/index.ts` | Barrel export, `IIoTRpcs` composition | 116 lines |
| `lib/iiot/rpc/SensorRpcs.ts` | Time-series query RPCs | 99 lines |
| `lib/iiot/rpc/AssetRpcs.ts` | ISA-95 hierarchy RPCs | 144 lines |
| `lib/iiot/rpc/AlarmRpcs.ts` | Alarm lifecycle + query RPCs | 154 lines |
| `lib/iiot/rpc/WorkOrderRpcs.ts` | Work order lifecycle RPCs | 36 lines |
| `lib/iiot/rpc/EquipmentStateRpcs.ts` | OEE tracking RPCs | ~50 lines |
| `lib/iiot/rpc/RealtimeRpcs.ts` | WebSocket streaming subscriptions | 192 lines |
| `lib/iiot/rpc/errors.ts` | Error schema taxonomy | 129 lines |
| `lib/iiot/rpc/PlantRpcs.ts` | Plant entity lifecycle | ~40 lines |
| `lib/iiot/rpc/LineRpcs.ts` | Line entity lifecycle | ~40 lines |
| `lib/iiot/rpc/WorkCellRpcs.ts` | WorkCell entity lifecycle | ~40 lines |
| `lib/iiot/rpc/MachineAssetRpcs.ts` | Machine entity lifecycle | ~40 lines |
| `lib/iiot/rpc/DeviceRpcs.ts` | Device entity lifecycle | ~40 lines |
| `lib/iiot/rpc/SensorAssetRpcs.ts` | Sensor asset lifecycle | ~40 lines |
| `lib/iiot/rpc/EnterpriseRpcs.ts` | Enterprise entity lifecycle | ~40 lines |
| `lib/iiot/rpc/SiteRpcs.ts` | Site entity lifecycle | ~40 lines |
| `lib/iiot/rpc/AreaRpcs.ts` | Area entity lifecycle | ~40 lines |

### DX.11.2 Entity Definitions

| File | Entity | Event Sourced | Source |
|---|---|---|---|
| `lib/iiot/entity/AlarmEntity.ts` | Alarm | YES — ISA-18.2 | `entity/index.ts:24-33` |
| `lib/iiot/entity/WorkOrderEntity.ts` | WorkOrder | YES — FDA 21 CFR Part 11 | `entity/index.ts:75-108` |
| `lib/iiot/entity/EquipmentStateEntity.ts` | EquipmentState | YES — OEE | `entity/index.ts:110-133` |
| `lib/iiot/entity/AssetEntity.ts` | Asset | NO — hierarchy queries | `entity/index.ts:35-53` |
| `lib/iiot/entity/SensorEntity.ts` | Sensor | NO — time-series reads | `entity/index.ts:55-73` |
| `lib/iiot/entity/EntityStack.ts` | Layer composition | N/A | `entity/index.ts:156-160` |

ISA-95 asset entities (Enterprise, Site, Area, Plant, Line, WorkCell, Machine,
Device, SensorAsset) are defined in individual files under `lib/iiot/entity/`
and composed in `EntityStack.EntityHandlersLayer` (`entity/index.ts:152-153`).

### DX.11.3 Schema Definitions

| Directory | Content | Example |
|---|---|---|
| `lib/iiot/schemas/assets/sensor/` | Sensor schema with `SensorId`, `SensorType`, `MeasurementUnit` | `schema.ts:203` — `Schema.TaggedClass<Sensor>()` |
| `lib/iiot/schemas/assets/device/` | Device schema with `DeviceId`, `DeviceStatus` | |
| `lib/iiot/schemas/assets/machine/` | Machine schema with `MachineId`, `MachineStatus` | |
| `lib/iiot/schemas/assets/plant/` | Plant schema with `PlantId`, `PlantStatus` | |
| `lib/iiot/schemas/assets/line/` | Line schema with `LineId`, `LineStatus` | |
| `lib/iiot/schemas/assets/workcell/` | WorkCell schema with `WorkCellId` | |
| `lib/iiot/schemas/assets/area/` | Area schema with `AreaId` | |
| `lib/iiot/schemas/assets/site/` | Site schema with `SiteId` | |
| `lib/iiot/schemas/assets/enterprise/` | Enterprise schema with `EnterpriseId` | |
| `lib/iiot/schemas/alarms/` | Alarm severity, lifecycle schemas | |
| `lib/iiot/schemas/readings/` | `SensorReading`, `AggregatedReading`, `TimeBucket` | |
| `lib/iiot/schemas/identifiers.ts` | Branded identifier types (`DeviceId`, `PlantId`, etc.) | |

### DX.11.4 Key Patterns for SDK Generation

The following codebase patterns are the foundation for SDK generation:

1. **RPC Group composition** (`lib/iiot/rpc/index.ts:91-112`):
   `IIoTRpcs = RpcGroup.make(...)` composing all sub-groups. The SDK client
   type is derived directly from this group definition.

2. **EntityProxy.toRpcGroup** (`lib/iiot/rpc/AlarmRpcs.ts:45`):
   Auto-generates entity lifecycle RPCs. The SDK MUST expose these with
   the same `${Entity}.${Operation}` naming convention.

3. **Schema.TaggedError** (`lib/iiot/rpc/errors.ts`):
   All RPC errors use tagged errors. The SDK MUST preserve `_tag`
   discriminators for pattern matching in client code.

4. **Stream RPCs** (`lib/iiot/rpc/RealtimeRpcs.ts:107-177`):
   All realtime RPCs use `stream: true`. The SDK MUST expose these as
   `Stream<A, E>` (Effect-native) or `AsyncIterable<A>` (Promise wrapper).

5. **Branded identifiers** (`lib/iiot/schemas/identifiers.ts`):
   All entity IDs use `Schema.brand()`. The SDK MUST preserve brand
   constraints in TypeScript types to prevent ID type confusion.

---

## References

- [RFC2119] Bradner, S. "Key words for use in RFCs to Indicate Requirement Levels."
- [RFC8174] Leiba, B. "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words."
- [EFFECT-SCHEMA] Effect Contributors. "effect/Schema."
- [EFFECT-STREAM] Effect Contributors. "effect/Stream."
- [EFFECT-LAYER] Effect Contributors. "effect/Layer."
- [EFFECT-ENTITY] Effect Contributors. "@effect/cluster/Entity."
- [EFFECT-RPCGROUP] Effect Contributors. "@effect/rpc/RpcGroup."
- [SPARKPLUG-B] Eclipse Foundation. "Eclipse Sparkplug Specification v3.0.0."
- [NATS-ACCOUNTS] Synadia Communications. "NATS Account-Based Security."
- [ISA-95-1] ANSI/ISA-95.00.01-2010 (IEC 62264-1).
- [ISA-18.2] ANSI/ISA-18.2-2016 (IEC 62682).
- [FDA-CFR11] U.S. FDA, 21 CFR Part 11.
