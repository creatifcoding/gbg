# Industrial Agentic Platform RFC Pack

Status: draft spine after Reactor v2 closeout

## Thesis

TMNL's IIoT suite should mature into an **agentic industrial digital-twin/control-plane platform**. It is not merely a SCADA clone, not merely an MES, and not merely a CMMS bridge. It is the layer that composes industrial telemetry, topology, production context, maintenance context, command governance, and agent reasoning into one auditable substrate.

The strong center of gravity is ISA-95 Level 3, but the platform must touch Level 2 and Level 4 through strict dependency-injected integration boundaries.

```text
Level 4       ERP / planning / enterprise systems
              ↑          ↓
Level 3       Agentic digital twin + MES/MOM/CMMS intelligence layer
              ↑          ↓
Level 2       SCADA / HMI / historian / supervisory gateways
              ↑          ↓
Level 1/0     PLCs / devices / sensors / actuators
```

Prime's architectural constraint is decisive: **every integration point is a port implemented by an Effect Layer**. Ignition, PI, SAP PM, Maximo, OPC UA servers, Sparkplug brokers, and PLC gateways are not special cases. They are implementations of ontological roles: historian, telemetry source, alarm source, work-management system, command gateway, and simulation source.

## RFC documents

| RFC | Document | Purpose |
| --- | --- | --- |
| RFC-0000 | `RFC-0000-CHARTER.md` | Product and architecture charter for the agentic industrial platform |
| RFC-0001 | `RFC-0001-INTEGRATION-PORTS.md` | Dependency-injected integration port model and ManagedRuntime edge pattern |
| RFC-0002 | `RFC-0002-DMN-DATA-MESSAGE-NETWORK.md` | DMN telemetry/event/command fabric spanning OPC UA, Sparkplug B, PCT/LNK/MSH, EventJournal, historian, graph, and Reactor |
| RFC-0003 | `RFC-0003-COMMAND-GOVERNANCE.md` | Agent autonomy, approval, interlocks, IEC 62443 safety boundaries, and command audit |
| RFC-0004 | `RFC-0004-VIRTUAL-PLANT-DEPLOYMENT.md` | Virtual plant, simulation, Kubernetes/Pepr deployment matrix, and CI/CD environment strategy |
| RFC-0005 | `RFC-0005-MARKET-WEDGES.md` | Market-informed feature wedges and demo acceptance strategy |
| Ledger | `SOURCE-LEDGER.md` | Internal and external source anchors used by this RFC pack |

## Reader artifact

A self-contained guided reader is generated at:

```text
/home/getbygenius/.agent/diagrams/industrial-agentic-platform-rfc-reader.html
```

The reader mirrors the FRKNK RFC guided-reader pattern: sticky table of contents, recommended reading route, card summaries, and embedded RFC excerpts.

Regenerate it after RFC edits with:

```bash
bun run scripts/industrial-platform-rfc-reader.ts
```

## Non-negotiables

1. **No hidden baseline activation.** Reactor lanes remain explicit activation bundles.
2. **No direct agent write path to OT.** Commands go through capability, approval, interlock, and audit gates.
3. **No integration hardcoding.** All external systems arrive as injected ports/layers.
4. **No graph-as-authority.** Graph is still a projection; SQL/event logs remain authoritative.
5. **No PLC safety-loop fantasy.** Millisecond safety remains PLC/SIS territory. We provide supervisory intelligence and auditable orchestration.
6. **No Effect v4 migration by accident.** TMNL stays on Effect v3 unless an explicit migration program exists.

## Recommended implementation order

1. Industrial integration port contracts.
2. OPC UA and Sparkplug B emulators.
3. Virtual plant topology + fault/alarm scenarios.
4. DMN normalized telemetry and command envelopes.
5. Command governance registry and policy simulator.
6. First demo: live simulated fault -> alarm lifecycle -> graph/Reactor impact -> agent recommendation -> human approval -> CMMS update -> audit replay.
