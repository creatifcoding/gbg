# RFC-0007 — OPC UA and Sparkplug Emulator Contracts

Status: draft

## 1. Purpose

The platform needs real adapters, but the first implementation should start with emulators. Emulators let us prove the event spine, graph impact, Reactor behavior, command governance, and agent explanation without touching live plant hardware.

The rule is simple: **fake and real adapters must implement the same ports**. A fake that uses a special backdoor is not a simulator; it is a demo prop.

## 2. Standards anchors

This RFC is grounded by the following ledger entries in `STANDARDS-RESEARCH-LEDGER.md`:

| Anchor | Emulator consequence |
| --- | --- |
| `STD-OPCUA-P1-OVERVIEW` | OPC UA emulator must expose AddressSpace semantics: Nodes, References, Objects, Variables, Methods, Alarms/Events, history-related identity, and security/audit metadata. |
| `STD-OPCUA-P4-SERVICES` | Contract tests must cover browse/view, attribute read/write denial, method call denial/execution under governance, monitored items, subscriptions, and recovery behavior. |
| `STD-OPCUA-P9-ALARMS` | Alarm/Condition emissions must preserve OPC UA event/condition/ack state before mapping to ISA-18.2 lifecycle concepts. |
| `STD-SPARKPLUG-OP-BEHAVIOR` | Sparkplug emulator must implement STATE, NBIRTH/NDEATH, DBIRTH/DDEATH, DDATA, NCMD/DCMD, seq, bdSeq, primary-host behavior, UTC timestamps, and stale quality semantics. |
| `STD-SPARKPLUG-PAYLOAD` | Sparkplug payload handling must preserve protobuf metric name/alias/datatype/value/timestamp/properties/metadata provenance while normalizing into DMN envelopes. |
| `STD-IEC62443-SERIES` | Simulated command execution must still flow through policy/interlock/approval/audit; simulator profile changes capability, not architecture. |

The emulator is therefore a standards conformance harness, not just a toy plant. Prime, yes, it may look pretty in a demo; it also needs to be mean enough to catch bad protocol assumptions.

## 3. Emulator goals

1. Run deterministic virtual plant scenarios in CI.
2. Emit the same DMN envelopes as real OPC UA and Sparkplug adapters.
3. Produce golden traces that can be replayed and diffed.
4. Support command-governance dry-runs and denial tests.
5. Exercise identity mapping, quality, stale data, node/device birth/death, alarms, and downtime.

## 4. Shared emulator contract

Every emulator should expose:

| Operation | Purpose |
| --- | --- |
| `loadManifest` | load virtual plant topology, source addresses, metrics, and mapping hints |
| `startScenario` | run a deterministic scenario timeline |
| `pause` / `resume` | test restart and backpressure behavior |
| `injectFault` | introduce operator/test-triggered conditions |
| `readSnapshot` | inspect current simulated plant state |
| `subscribe` | stream DMN envelopes |
| `handleCommandDryRun` | simulate command effect without mutating live state |
| `handleCommandExecute` | mutate simulated state only under command-governance receipt |

The simulator should be an Effect service and should also support a ManagedRuntime edge client for test harnesses and browser demos.

## 5. Virtual plant manifest

A virtual plant manifest should define:

```text
site/area/line/cell/equipment/device hierarchy
source protocol addresses
metric definitions and units
alarm definitions
PackML-capable machines
historian tags
CMMS/MES external references
command capabilities
scenario fixtures
```

Recommended file family:

```text
src/lib/iiot/simulation/
├── manifests/
│   ├── bottling-line.plant.ts
│   └── utility-skid.plant.ts
├── scenarios/
│   ├── machine-fault-impact.ts
│   ├── alarm-flood-triage.ts
│   ├── unsafe-command-blocked.ts
│   └── external-dependency-unavailable.ts
└── golden-traces/
    └── machine-fault-impact.trace.json
```

## 6. OPC UA emulator contract

The OPC UA emulator should model enough of an OPC UA server to exercise the adapter boundary:

### Required capabilities

- namespace browse tree;
- NodeId and browse-path addressing;
- variable reads;
- monitored item subscriptions;
- event/alarm emission;
- quality/status code changes;
- node availability changes;
- method/write targets for simulated command tests.

### Node manifest shape

Each virtual node should carry:

- `nodeId`;
- `browseName`;
- `displayName`;
- `nodeClass`;
- `dataType`;
- `unit`;
- `initialValue`;
- `quality`;
- `mappedEntityRef` or identity hints;
- optional alarm definition;
- optional command capability descriptor.

### OPC UA adapter compatibility tests

The real OPC UA adapter must pass the same contract tests as the emulator:

1. browse namespace;
2. map NodeId to platform entity identity;
3. subscribe to values and preserve quality;
4. normalize alarms;
5. deny command writes unless command governance supplies an execution receipt.

## 7. Sparkplug B emulator contract

The Sparkplug emulator should model the topic and lifecycle semantics that matter for IIoT state.

### Required capabilities

- group/edge/device namespace;
- NBIRTH/NDEATH lifecycle;
- DBIRTH/DDEATH lifecycle;
- DDATA metric updates;
- sequence and bdSeq behavior;
- metric quality and timestamp;
- command-topic dry-run/execution in simulated profile.

### Topic family

```text
spBv1.0/{group_id}/NBIRTH/{edge_node_id}
spBv1.0/{group_id}/NDEATH/{edge_node_id}
spBv1.0/{group_id}/DBIRTH/{edge_node_id}/{device_id}
spBv1.0/{group_id}/DDEATH/{edge_node_id}/{device_id}
spBv1.0/{group_id}/DDATA/{edge_node_id}/{device_id}
spBv1.0/{group_id}/DCMD/{edge_node_id}/{device_id}
```

The adapter should preserve Sparkplug sequence metadata because edge lifecycle correctness depends on it.

### Metric manifest shape

Each Sparkplug metric should carry:

- group ID;
- edge node ID;
- device ID;
- metric name/path;
- datatype;
- unit;
- initial value;
- quality;
- mapping hints;
- optional alarm/condition mapping;
- optional command capability descriptor.

## 8. DMN golden trace shape

A golden trace should capture all layers, not just source messages:

```text
source message
  -> DMN envelope
  -> domain event
  -> historian write
  -> graph projection
  -> Reactor observation/plan/dispatch
  -> command proposal/approval/denial/execution
  -> read-model snapshot
```

Each step should include:

- deterministic timestamp;
- deterministic ID where possible;
- source scenario step;
- input payload;
- normalized output;
- expected side effects;
- audit references.

## 9. Scenario DSL

A scenario should be a sequence of typed steps:

| Step | Meaning |
| --- | --- |
| `emitTelemetry` | source sends metric value(s) |
| `changeQuality` | source quality becomes bad/uncertain/stale/good |
| `birth` / `death` | Sparkplug node/device lifecycle event |
| `nodeAvailable` / `nodeUnavailable` | OPC UA namespace availability event |
| `raiseAlarm` / `clearAlarm` | alarm lifecycle condition |
| `advanceTime` | deterministic clock movement |
| `expectEvent` | EventJournal expectation |
| `expectGraph` | graph projection expectation |
| `expectReactor` | Reactor constraint/action expectation |
| `expectCommandDecision` | governance approval/denial expectation |

## 10. Command simulation

Simulated command execution is allowed only in simulator profiles.

The emulator must require a command execution receipt even when simulated:

```text
CommandProposal -> policy/interlock/approval -> ExecutionReceipt -> emulator mutation
```

This prevents test code from teaching the architecture that direct writes are acceptable.

## 11. Standards proof model

A simulator scenario is accepted only when it can produce a trace like this:

| Trace layer | Required evidence |
| --- | --- |
| source protocol | OPC UA NodeId/BrowseName/service or Sparkplug topic/verb/seq/bdSeq/payload reference |
| standards anchor | source ID and observed requirement from the standards research ledger |
| normalized DMN | Schema-decoded telemetry/lifecycle/alarm/command envelope |
| durable event | EventJournal entry or explicit reason why no domain event is emitted |
| projection | graph/historian/read-model effects, marked projection-only where appropriate |
| Reactor | observation/plan/dispatch details when a durable event is eligible |
| command governance | proposal, policy, interlock, approval/denial, execution receipt, audit |
| replay assertion | deterministic replay reconstructs the same result from durable records |

This gives us a concrete reconciliation path:

```text
standards source -> emulator obligation -> scenario step -> golden trace -> CI assertion
```

## 12. Acceptance criteria

- OPC UA and Sparkplug emulators emit DMN envelopes compatible with real adapters.
- Virtual plant scenarios are deterministic and replayable.
- Golden traces include EventJournal, graph, Reactor, command, and read-model expectations.
- Command simulation requires the same governance receipt as live commands.
- Real adapters can be contract-tested against emulator expectations.
