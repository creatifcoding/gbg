# RFC-0004 — Virtual Plant, Deployment Matrix, and CI/CD

Status: draft

## 1. Purpose

The platform must be demoable and testable without real plant hardware. It must also be deployable across many virtualized environments early, not after the architecture calcifies.

This RFC defines the virtual plant and deployment matrix needed for an agentic industrial platform.

## 2. Virtual plant mission

The virtual plant is a deterministic industrial scenario engine.

It should emulate:

- ISA-95 hierarchy;
- OPC UA namespace;
- Sparkplug B group/edge/device lifecycle;
- historian time-series;
- alarms;
- WorkOrders;
- machine/device states;
- faults, downtime, quality loss, and maintenance response;
- safe and unsafe command attempts.

It feeds the same ports as real integrations. If fake and real paths diverge, the fake is not a simulator; it is a lie with a prettier hat.

## 3. Virtual plant scenarios

### Scenario A — Machine fault impact

```text
Machine M faults
  -> OPC UA/Sparkplug telemetry emits unavailable state
  -> alarm condition enters active/unacked lifecycle
  -> EventJournal records state/alarm events
  -> graph/Reactor finds impacted WorkOrders
  -> downtime/OEE read model updates
  -> agent recommends maintenance action
  -> human approves WorkOrder update
```

### Scenario B — Alarm flood triage

```text
Device cluster emits many alarm conditions
  -> alarm lifecycle normalizes by source/condition/severity
  -> agent groups probable common cause
  -> nuisance/shelving policy explains allowed/denied actions
  -> ISA-18.2 audit records rationale
```

### Scenario C — Unsafe command blocked

```text
Agent proposes setpoint/PLC write
  -> command policy detects live OT zone and disallowed class
  -> interlock fails closed
  -> denial event records policy, zone, target, actor, evidence
```

### Scenario D — External dependency unavailable

```text
MES/ERP/vendor dependency goes unavailable
  -> DMN lifecycle event
  -> graph/Reactor identifies dependent WorkOrders/processes
  -> agent opens incident and notifies owners
  -> relink/recovery exact-releases constraints
```

## 4. CI environment tiers

| Tier | Name | Purpose |
| --- | --- | --- |
| CI-0 | pure unit/fake | schema, policy, state machine, command governance tests |
| CI-1 | in-memory virtual plant | deterministic event traces without containers |
| CI-2 | containerized plant | Postgres/AGE, NATS/MQTT, OPC UA fake, Sparkplug fake |
| CI-3 | Kubernetes local | kind/k3d/k3s deployment, Pepr policy admission, Helm/manifests |
| CI-4 | edge appliance profile | on-prem edge runtime with optional cloud control plane |
| CI-5 | air-gapped profile | offline bundle, no cloud dependency, sealed update path |

## 5. Kubernetes and Pepr posture

User direction: deployment must be factored immediately, using Kubernetes with Pepr or equivalent policy automation.

Pepr-like responsibilities:

- inject common labels/annotations;
- enforce network/security policies;
- validate required secrets/config maps;
- prevent unsafe command-gateway deployments in live profiles;
- enforce simulator/live profile separation;
- mutate workloads for edge resource constraints;
- validate zone/conduit declarations;
- require audit/log sinks for command-capable services.

Research anchors:

- Pepr docs: TypeScript-defined Kubernetes transformations and controllers.
- Pepr best practices: HA admission-controller deployment, failure policy considerations.
- Siemens Industrial Edge: separated control plane/data plane for distributed industrial edge.
- Red Hat Validated Patterns Industrial Edge: hybrid edge deployment reference.

## 6. Deployment units

Candidate units:

| Unit | Role |
| --- | --- |
| `edge-core` | site-local EventJournal, SQL authority, graph projection, Reactor, command governance |
| `dmn-ingestion` | OPC UA/Sparkplug/Modbus adapters and normalization |
| `virtual-plant` | simulation services and deterministic trace player |
| `historian` | Timescale/Influx/adapter-backed time-series storage |
| `agent-runtime` | agent planning/explanation surface, command proposal generation |
| `control-plane` | optional cloud fleet management, policy distribution, deployment inventory |
| `reader/docs` | operator/developer docs, RFC reader, runbooks |

## 7. Configuration model

Deployments need profiles:

| Profile | Command posture | Data posture |
| --- | --- | --- |
| `dev-sim` | simulated command execution allowed | fake plant data |
| `ci-sim` | deterministic command assertions | fake plant data |
| `edge-readonly` | OT writes disabled | live ingest allowed |
| `edge-supervisory` | approved supervisory commands allowed | live ingest allowed |
| `airgapped` | local-only control plane | local ingest/storage only |
| `cloud-fleet` | no direct OT writes | fleet monitoring and policy distribution |

## 8. Golden trace testing

Each virtual plant scenario should emit a golden trace:

- source telemetry/lifecycle envelopes;
- domain events;
- graph changes;
- Reactor decisions;
- command proposals;
- approvals/denials;
- target transitions;
- audit receipts;
- read-model outputs.

Golden traces become regression fixtures for agents and deployment changes.

## 9. Acceptance criteria

- The first demo runs entirely in `dev-sim` without external hardware.
- The same scenario can run in CI-2 containers with Postgres/AGE and NATS/MQTT.
- Kubernetes profile validation can block unsafe command gateway deployment.
- Air-gapped mode has a documented path and no accidental cloud dependency.
- Virtual plant traces are replayable and comparable.
