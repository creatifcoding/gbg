# RFC-0002 — DMN Data/Message Network

Status: draft

## 1. Purpose

DMN is the platform's Data/Message Network: the normalization and routing fabric between industrial protocols, durable events, time-series storage, graph projection, Reactor, and governed commands.

DMN is not a broker by itself. It is a semantic layer over transport substrates.

```text
OPC UA / Sparkplug / Modbus / PLC adapters
        ↓
Telemetry normalization + identity resolution
        ↓
DMN envelopes
        ↓
EventJournal + Historian + Graph projections + Reactor
        ↓
Agent context + Command governance
        ↓
Approved command adapters / MES / CMMS / SCADA gateways
```

## 2. Relationship to existing MSH/PCT/LNK

Existing precedent suggests a clean split:

| Existing substrate | Role DMN can consume |
| --- | --- |
| MSH | generic NATS/micro substrate; no IIoT semantics |
| LNK | durable stream framing, append semantics, offsets, bridge conformance |
| PCT | typed control-plane contracts, schema resolver, projection scheduler/admission |
| Reactor | structural consistency pressure from durable domain events over graph topology |

DMN should not shove IIoT semantics into MSH. DMN should either:

1. wrap PCT/LNK/MSH behind IIoT-specific ports; or
2. define a narrower IIoT facade that later binds to PCT/LNK/MSH.

Either way, boundaries stay clean. The substrate should not learn what a WorkOrder is.

## 3. Envelope taxonomy

DMN should define a small number of canonical envelope families.

### 3.1 Telemetry envelope

Represents observed values from field/device/SCADA/historian sources.

Fields:

- `integrationId`
- `sourceProtocol`
- `sourceAddress`
- `assetIdentityHint`
- `timestamp`
- `quality`
- `metrics`
- `rawRef`
- `normalizationVersion`

### 3.2 Lifecycle envelope

Represents device/node/broker/edge birth/death, OPC UA node availability, connector health, or integration lifecycle.

Fields:

- `integrationId`
- `lifecycleKind`
- `subject`
- `state`
- `occurredAt`
- `sequence`
- `cause`

### 3.3 Alarm envelope

Represents alarm lifecycle changes before projection into ISA-18.2 domain events.

Fields:

- `alarmSource`
- `alarmId`
- `subject`
- `condition`
- `severity`
- `lifecycleState`
- `ackState`
- `shelvingState`
- `suppressionState`
- `occurredAt`

### 3.4 Command envelope

Represents requested/approved/executed/denied actions.

Fields:

- `commandId`
- `commandClass`
- `target`
- `requestedBy`
- `agentContextRef`
- `requiredApprovals`
- `interlockResults`
- `policyDecision`
- `executionAdapter`
- `auditRef`

## 4. Hot/warm/cold paths

DMN needs explicit latency/authority tiers.

| Path | Example | Storage | Semantics |
| --- | --- | --- | --- |
| Hot | live telemetry and connector health | pub/sub / stream | fast, lossy-tolerant where quality flags preserve truth |
| Warm | domain events, alarms, commands | EventJournal + SQL audit | durable, replayable, authority-bearing |
| Cold | documents, compliance exports, long retention | object/archive/vector index | search, evidence, regulatory retention |

Reactor consumes warm durable events, not raw hot telemetry. Hot telemetry can trigger domain event creation when normalized rules detect state transitions.

## 5. Identity resolution

A DMN message is not useful until it can be tied to platform identity.

Resolution order:

1. explicit platform entity ID;
2. integration address mapping table;
3. Sparkplug group/edge/device namespace mapping;
4. OPC UA NodeId/browse path mapping;
5. historian tag mapping;
6. operator/manual import mapping;
7. unresolved quarantine.

Unresolved data should be retained as quarantine evidence but must not drive Reactor target mutations.

## 6. OPC UA ingestion shape

OPC UA adapter responsibilities:

- browse namespace;
- subscribe to monitored items/events;
- map NodeId/browse path to entity identity;
- preserve quality/status code;
- emit telemetry/lifecycle/alarm envelopes;
- expose fake server/emulator in CI.

OPC UA command writes remain command-governed. The adapter may know how to write; it may not decide it is allowed to write.

## 7. Sparkplug B ingestion shape

Sparkplug adapter responsibilities:

- subscribe to Sparkplug namespace topics;
- decode protobuf payloads;
- track NBIRTH/NDEATH/DBIRTH/DDEATH/DDATA lifecycle;
- map group/edge/device to entity identity;
- preserve sequence/bdSeq and quality;
- emit telemetry/lifecycle envelopes;
- support NATS MQTT bridge initially, with EMQX banked for MQTT 5/conformance pressure.

Internal precedent: `docs/decisions/adr-003-sparkplug-client-fork.md` and `docs/research/iiot/sparkplug-resources.md`.

## 8. Historian relation

The historian is not the same as EventJournal.

| Store | Contents | Authority |
| --- | --- | --- |
| Historian/time-series | sampled/streaming measured values | value history, trends, OEE/downtime calculations |
| EventJournal | domain events | state transitions and replay input |
| SQL audit | claims, constraints, command decisions | operational authority and proof |
| Graph | relationships/topology projections | impact analysis; not sole truth |

## 9. Projection policy

DMN writes should feed projections via explicit handlers:

```text
DMN telemetry -> state detector -> domain event -> EventJournal
DMN lifecycle -> device/edge lifecycle event -> EventJournal
DMN alarm -> alarm lifecycle event -> EventJournal
EventJournal -> graph projection / SQL state / Reactor / read models
```

Projection handlers must remain projection-only unless they are target-owned entity handlers. This follows the Reactor v2 boundary.

## 10. Acceptance criteria

- OPC UA and Sparkplug emulators emit the same DMN envelope shapes as real adapters.
- Unresolved identity is quarantined, not ignored and not acted upon.
- EventJournal entries can be replayed into graph/Reactor without hot telemetry.
- Command envelopes can be denied with explainable policy/interlock reasons.
- DMN can bind to PCT/LNK/MSH without leaking IIoT domain semantics into substrate packages.
