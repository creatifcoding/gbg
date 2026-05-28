# RFC-0003 — Agent Command Governance, Safety, and Autonomy

Status: draft

## 1. Purpose

This RFC defines how agents act. The platform may support every autonomy tier, but tiers must be explicit, governable, testable, and auditable.

The command governance plane is the difference between an industrial AI product and a future deposition exhibit. We prefer the former.

## 2. Autonomy ladder

| Tier | Name | Allowed behavior |
| --- | --- | --- |
| A0 | Observe | ingest, correlate, explain; no recommended action |
| A1 | Recommend | propose action and evidence; no mutation |
| A2 | Draft | prepare WorkOrder/incident/schedule/alarm action for human review |
| A3 | Enterprise execute | execute approved MES/CMMS/notification/reporting actions |
| A4 | Supervisory execute | execute approved SCADA/supervisory commands after interlocks |
| A5 | Closed-loop | continuous command execution without per-action approval; out of v1 live scope |

The platform may model A5 for completeness, but v1 live profile should default it to `locked` or `unavailable`.

## 3. Command lifecycle

```text
Agent intent
  -> CommandProposal
  -> policy classification
  -> simulation / dry-run
  -> interlock checks
  -> approval workflow
  -> execution adapter
  -> execution receipt
  -> audit event
  -> reconciliation / follow-up
```

Each command must be a durable entity with a traceable lifecycle. Nothing important should live only in an agent transcript.

## 4. Command classes

| Command class | Examples | Default v1 posture |
| --- | --- | --- |
| `work_order.create_update` | create, assign, reprioritize, add failure code | approval required |
| `alarm.response` | recommend response, escalate, create incident | approval required |
| `alarm.ack` | acknowledge alarm | approval required; role-gated |
| `alarm.shelve_suppress` | shelve/suppress nuisance alarm | strict approval, duration limits, audit |
| `incident.handoff` | shift log, incident record, notification | approval or auto under policy |
| `production.schedule` | change dispatch priority or schedule | approval required; MES policy |
| `report.generate` | compliance/OEE/audit report | allowed with audit |
| `scada.supervisory` | start/stop mode request, setpoint request | locked unless simulated or explicitly enabled |
| `plc.write` | direct register/tag write | unavailable in v1 live profile |

## 5. Command schema requirements

Every command record should include:

- `commandId`
- `commandClass`
- `target`
- `requestedBy` actor/agent identity
- `reason`
- `evidenceRefs`
- `proposedAt`
- `requiredRole`
- `zoneConduitPolicy`
- `interlockPlan`
- `dryRunResult`
- `approvalState`
- `executionState`
- `executionAdapter`
- `externalReceipt`
- `auditTrail`

## 6. IEC 62443-inspired boundary

The platform should model zones and conduits explicitly.

| Concept | Platform interpretation |
| --- | --- |
| Zone | trust/criticality boundary: cloud control, site edge, SCADA, PLC cell, safety zone |
| Conduit | approved path between zones: API gateway, OPC UA read channel, command gateway, message bridge |
| Security level | required authn/authz/audit strength for command classes |
| Least privilege | connector credentials and command capabilities are scoped per integration |

Command policy must consider:

1. source actor/agent zone;
2. target entity zone;
3. conduit allowed direction;
4. command class;
5. approval role;
6. interlock result;
7. deployment profile.

## 7. Interlock model

Interlocks are explicit Effects returning structured decisions:

```ts
export interface CommandInterlock {
  readonly id: InterlockId
  readonly evaluate: (command: CommandProposal) => Effect.Effect<InterlockDecision, InterlockError>
}
```

Interlock decisions:

- `passed`
- `failed`
- `unknown`
- `not_applicable`
- `requires_operator_confirmation`

Unknown should fail closed for OT/supervisory command classes.

## 8. Approval model

Approvals are not UI checkboxes. They are durable facts.

Approval dimensions:

- role required;
- number of approvers;
- separation of duties;
- timeout;
- revocation;
- escalation;
- emergency override policy;
- deployment profile.

All approvals produce audit events.

## 9. Agent explanation obligations

For every non-trivial recommendation, the agent must provide:

1. observed facts;
2. inferred state;
3. affected entities;
4. proposed command;
5. expected effect;
6. risks;
7. required approvals;
8. why alternatives were rejected;
9. replay/audit references.

If evidence is incomplete, the command proposal must say so. Industrial confidence theatre is how you get unsafe automation wearing a tie.

## 10. Simulation before activation

Before any command policy moves from `declared` to `live`, it must pass simulation:

- fake integration adapter;
- virtual plant scenario;
- success path;
- denied path;
- stale data path;
- missing approval path;
- interlock failure path;
- replay/audit verification.

This mirrors Reactor lane promotion discipline.

## 11. Acceptance criteria

- Agents cannot call integration write methods directly.
- Every executable action has a command class and policy descriptor.
- Unsafe commands produce explainable denial records.
- Human approvals are durable and replayable.
- Simulated and live profiles use the same command schema, with different capability states.
- The UI can show why a command is available, locked, denied, or approval-required.
