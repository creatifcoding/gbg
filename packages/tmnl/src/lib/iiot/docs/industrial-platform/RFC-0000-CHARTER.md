# RFC-0000 — Industrial Agentic Digital Twin Platform Charter

Status: draft

## 1. Executive thesis

The platform should become an **agentic industrial digital twin and control-plane substrate**. Its job is to unify plant topology, live telemetry, alarms, production execution, maintenance execution, documents/SOPs, and command governance into an auditable environment where agents can explain, recommend, simulate, and — after approval/interlocks — execute bounded actions.

This is a layer below a product feature list and above raw transport protocols.

It must support SCADA/MES/CMMS-class applications without being trapped inside any single category:

- SCADA/HMI: live plant visibility, alarms, supervisory commands.
- MES/MOM: production execution, downtime/OEE, quality, schedule impact.
- CMMS/EAM: work orders, PM plans, failure codes, maintenance history.
- Digital twin: topology, relationships, operating context, constraints.
- Agentic operations: explain, recommend, simulate, request approval, execute, audit.

## 2. Position in the industrial stack

Primary center of gravity: **ISA-95 Level 3**.

Required reach:

| Level | Role | Platform posture |
| --- | --- | --- |
| L4 | ERP, enterprise planning, finance, EAM/CMMS | integrate through ports; do not assume one vendor |
| L3 | MES/MOM, maintenance coordination, operations intelligence | primary product domain |
| L2 | SCADA/HMI, alarms, historian, supervisory gateways | integrate and eventually provide adjunct surfaces |
| L1/L0 | PLCs, devices, sensors, actuators | ingest first; command only through strict gateway/interlock contracts |

The platform may become cross-level, but its authority must be explicit. No component gets to smuggle a write path into OT because it has an API client and confidence. Charming, Prime, but no.

## 3. Product interpretation

The first product should be understood as a **graph-intelligence operating layer for industrial agents**.

The platform exposes:

1. A living asset/process/relationship graph.
2. A durable event and audit plane.
3. Time-series and historian access.
4. Work/order/alarm/production state machines.
5. Agent-readable operational context.
6. Agent-action governance.
7. Replayable evidence for why a recommendation/action occurred.

## 4. First undeniable demo

The first demo should prove the whole spine, not a toy dashboard:

```text
OPC UA/Sparkplug simulated machine fault
  -> normalized DMN telemetry
  -> durable event + time-series write
  -> ISA-18.2 alarm lifecycle
  -> graph/Reactor identifies impacted WorkOrders and production context
  -> agent explains root cause and affected entities
  -> agent drafts maintenance/operations action
  -> human approves under role/interlock policy
  -> CMMS/MES update emitted through injected port
  -> audit/replay shows every causal step
  -> unsafe command attempt is blocked with explanation
```

## 5. Scope boundaries

### In scope

- OPC UA and Sparkplug B ingestion.
- Virtual plant emulation.
- Historian/time-series abstraction.
- Asset/relationship graph and event journal.
- Reactor-backed structural consistency.
- ISA-18.2 alarm lifecycle support.
- WorkOrder and maintenance integration.
- OEE/downtime read models.
- Agent command governance.
- Hybrid edge/cloud deployment model.
- Kubernetes/Pepr policy-driven deployment research.

### Out of scope for the first implementation slice

- Certified safety control.
- Hard real-time PLC loop replacement.
- Unapproved closed-loop command execution.
- Vendor-specific lock-in as architecture.
- Treating Ignition/PI/SAP/Maximo as primitives rather than port implementations.

## 6. Architectural laws

1. **Ports over vendors.** A dependency is represented by an interface and layer, not a product name.
2. **ManagedRuntime at edges.** Long-lived non-Effect consumers may hold ManagedRuntime clients; internal services remain compositional Effects.
3. **Events before projections.** Durable events are primitive; graph/read models are projections.
4. **SQL authority for irreversible facts.** Claims, constraints, checkpoints, command audit, and transition authority live in SQL-backed records.
5. **Graph for topology and impact.** Graph accelerates impact analysis but does not become truth.
6. **Target-owned mutation.** The target entity owns eligibility, transition, audit, and emitted events.
7. **Agent actions are governed commands.** Agents may propose; execution requires policy, approval, interlock, and audit.
8. **Simulation is first-class.** Every integration class needs an emulator/fake layer for CI and demos.

## 7. Standards posture

Standards shape schemas and workflows, not just documentation:

| Standard / pattern | Role |
| --- | --- |
| ISA-95 | hierarchy, operation context, L2/L3/L4 integration model |
| ISA-18.2 | alarm lifecycle, shelving/suppression/ack/escalation concepts |
| IEC 62443 | zones/conduits, roles, secure-by-default command boundaries |
| Sparkplug B | MQTT topic/state model for edge/device birth/death/data |
| PackML | machine state vocabulary and transition expectations |
| ISO 22400 | OEE/KPI definitions and production performance metrics |
| ISA-88 | batch/recipe compatibility path |
| MIMOSA / OSA-CBM | condition-based maintenance and asset health semantics |

## 8. Open decisions

1. Which commercial wedge gets market validation first?
2. Which historian implementation becomes the first real adapter?
3. Does DMN use existing PCT/LNK/MSH directly, or define a narrower IIoT facade over them?
4. What is the first Kubernetes/Pepr deployment target: local k3d/kind, k3s edge appliance, or full cluster?
5. What command classes are allowed in v1 beyond CMMS/MES enterprise actions?

## 9. Acceptance criteria for this RFC pack

- The architecture can explain how to build SCADA/MES/CMMS-grade applications without collapsing those products into one monolith.
- Every external system has a port-shaped integration boundary.
- The first demo can run without real plant hardware.
- Agent autonomy is represented as command governance, not a magical permission bypass.
- Deployment and CI environments are treated as architecture, not late-stage DevOps confetti.
