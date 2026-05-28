# RFC-0001 — Industrial Integration Ports and ManagedRuntime Edges

Status: draft

## 1. Purpose

This RFC defines the integration boundary pattern for every industrial dependency. The platform must interface with categories of industrial systems, not hardcode vendors.

Ignition is a historian/HMI/SCADA platform. PI is a historian. SAP PM and Maximo are CMMS/EAM systems. OPC UA servers are telemetry/control endpoints. Sparkplug brokers are edge/device namespace transports. They enter the system through ports.

## 2. Core pattern

Each integration has three layers:

```text
Domain Port       Type-level contract: what role the dependency plays
Adapter Layer     Concrete implementation: Ignition, PI, OPC UA, Sparkplug, SAP, Maximo, fake
Runtime Edge      ManagedRuntime/client wrapper for long-lived external consumers
```

Internal services consume Effects. Non-Effect boundaries can hold a ManagedRuntime-backed client.

```ts
// Shape only. Keep exact schema/API in implementation RFCs.
export interface HistorianPort {
  readonly readSeries: (query: HistorianSeriesQuery) => Effect.Effect<ReadonlyArray<HistorianPoint>, HistorianError>
  readonly writePoints: (points: ReadonlyArray<HistorianPoint>) => Effect.Effect<HistorianWriteReceipt, HistorianError>
}

export class Historian extends Context.Tag('iiot/Historian')<Historian, HistorianPort>() {}

export const IgnitionHistorianLive: Layer.Layer<Historian, HistorianError, IgnitionClient> =
  Layer.effect(Historian, Effect.gen(function* () { /* adapter */ }))
```

ManagedRuntime edge rule:

```text
Service methods return Effect.
ManagedRuntime belongs at the package/application edge.
Do not hide ManagedRuntime inside service implementations.
```

This matches the existing `effect-sui/docs/MANAGED_RUNTIME_STRATEGY.md` precedent while staying compatible with Effect v3 in TMNL.

## 3. Required port families

### 3.1 Telemetry source ports

| Port | Role | First implementations |
| --- | --- | --- |
| `OpcUaTelemetrySource` | Read/browse/subscribe OPC UA nodes and events | fake/emulator, node-opcua adapter |
| `SparkplugTelemetrySource` | Subscribe/decode Sparkplug B birth/death/data/cmd topics | fake/emulator, NATS MQTT bridge adapter |
| `ModbusTelemetrySource` | Poll/register decode for Modbus devices | fake first, real later |
| `VendorPlcTelemetrySource` | Siemens/Rockwell-specific reads where required | deferred adapter family |

### 3.2 Historian/time-series ports

| Port | Role | First implementations |
| --- | --- | --- |
| `Historian` | Read/write time-series points and metadata | in-memory, Timescale/Influx, Ignition/PI later |
| `TrendQueryService` | User-facing trend and aggregation queries | historian-backed projection |
| `DowntimeSeriesWriter` | OEE/downtime frame writes | Timescale/PCT frame projection |

### 3.3 Enterprise execution ports

| Port | Role | First implementations |
| --- | --- | --- |
| `CmmsClient` | Work orders, PM plans, failure codes, assets | fake, REST fixture, SAP/Maximo later |
| `MesClient` | production orders, WIP, schedule, quality events | fake, local MES model |
| `ErpClient` | business planning/material constraints | fake/deferred |

### 3.4 Command ports

| Port | Role | Default stance |
| --- | --- | --- |
| `ScadaCommandGateway` | Alarm ack/shelve/suppress and supervisory commands | deny-by-default |
| `PlcCommandGateway` | Setpoint/equipment command request surface | unavailable/locked in v1 except explicit simulated profiles |
| `NotificationGateway` | Notify teams, open incidents, handoffs | allowed with audit |
| `ReportPublisher` | Compliance/audit report generation | allowed with audit |

### 3.5 Simulation ports

Every port family requires a fake/emulator:

- `OpcUaSimulator`
- `SparkplugSimulator`
- `HistorianInMemory`
- `CmmsInMemory`
- `MesInMemory`
- `CommandGatewaySimulated`

Simulation is not a nice-to-have. It is the only way to make demos, CI, policy simulation, and replay safe enough to develop quickly.

## 4. Contract requirements

All ports should expose:

| Requirement | Why |
| --- | --- |
| Effect Schema-backed config | runtime validation and generated fixture compatibility |
| Health check | deployment readiness and operator diagnostics |
| Capability descriptor | command governance and UI affordances |
| Stable integration identity | audit/replay attribution |
| Fake implementation | CI and demos |
| Error taxonomy | agent explanation and operator remediation |
| Resource lifecycle | acquisition/release, reconnects, backoff, disposal |

## 5. ManagedRuntime edge clients

For each external-facing adapter package, expose a client factory:

```ts
export const makeOpcUaRuntime = (layer: Layer.Layer<OpcUaServices, OpcUaError>) =>
  ManagedRuntime.make(layer)

export interface OpcUaRuntimeClient {
  readonly browse: (query: BrowseQuery) => Promise<ReadonlyArray<OpcUaNode>>
  readonly subscribe: (input: SubscribeInput) => AsyncIterable<OpcUaEvent>
  readonly dispose: () => Promise<void>
}
```

Rules:

1. Runtime clients are disposable.
2. Runtime clients do not bypass command governance.
3. Runtime clients should be memoized per integration instance, not per call.
4. Tests should prove disposal and reconnect behavior.
5. Services remain composable Effects; only edge clients translate to Promise/AsyncIterable.

## 6. Ontological mapping

Vendor/system products map to roles:

| Product/system | Ontological roles |
| --- | --- |
| Ignition | historian, SCADA tag provider, HMI/SCADA alarm source, optional command gateway |
| OSIsoft/AVEVA PI | historian, asset framework source |
| SAP PM / Maximo / Fiix | CMMS/EAM work-management source/sink |
| OPC UA server | telemetry source, browse namespace, event source, optional command gateway |
| MQTT broker + Sparkplug namespace | telemetry source, edge/device lifecycle source, command topic surface |
| PLC | device/equipment state authority below platform boundary; command target only through governed gateway |

## 7. Acceptance criteria

- Adding a vendor adapter requires implementing a port, not editing domain services.
- The virtual plant can run with only fake ports.
- The same Reactor/event/graph code can consume fake and real integrations.
- Integration health and capability descriptors are queryable.
- Command-capable ports are locked behind command governance by construction.
