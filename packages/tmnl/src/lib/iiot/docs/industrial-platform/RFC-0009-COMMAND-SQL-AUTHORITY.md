# RFC-0009 — SQL Command Authority and Governance Records

Status: draft

## 1. Purpose

This RFC defines the SQL-backed authority model for agentic industrial commands. If Reactor taught us anything, Prime, it is this: durable authority belongs in boring records with exact IDs, not in a charismatic service method.

The command plane must support:

```text
recommendation -> proposal -> policy decision -> simulation -> interlock -> approval -> execution -> reconciliation -> audit/replay
```

Agents do not execute writes. Agents produce proposals. SQL authority, policy, approvals, interlocks, and adapter receipts determine what happens next.

## 2. Standards anchors

| Anchor | Command-authority consequence |
| --- | --- |
| `STD-IEC62443-SERIES` | Commands need lifecycle security, stakeholder/role awareness, risk assessment, security level/deployment profile, and deny-by-default posture for OT write paths. |
| `STD-OPCUA-P1-OVERVIEW` | OPC UA supports authentication, encryption, integrity, and auditing; adapter receipts should preserve audit parameters and server/client traceability. |
| `STD-OPCUA-P4-SERVICES` | OPC UA Attribute writes and Methods are explicit service classes; they must be represented as command targets/capabilities, not hidden calls. |
| `STD-SPARKPLUG-OP-BEHAVIOR` | Sparkplug commands are NCMD/DCMD and Primary Host/ACL-sensitive; platform command authority must not assume every MQTT client may publish commands. |
| `STD-ISA18-SERIES` | Alarm ack/shelve/suppress actions need lifecycle, rationalization, philosophy, prioritization, and audit context. |
| `STD-ISA95-CONCEPT` | Personnel/roles/qualifications and L3/L4 execution responsibilities matter for approval and work-management commands. |

## 3. Authority principles

1. **SQL owns command state.** Command proposal, approval, interlock, policy decision, execution receipt, denial, and reconciliation are SQL-backed records.
2. **Adapters are executors, not deciders.** Adapter capability descriptors say what can technically be done; governance decides whether it may be done.
3. **Exact target and policy identity.** No synthetic fallback when retracting, approving, or reconciling a command.
4. **Deny by default.** Unknown command class, unknown actor, unknown zone/conduit, stale data, missing approval, or failed interlock denies execution.
5. **Simulated and live profiles share schema.** Simulated commands still require governance receipts.
6. **Replay is mandatory.** Every command decision must reconstruct from durable records.

## 4. Command classes

| Command class | Target family | Typical authority posture |
| --- | --- | --- |
| `cmms.work_order.create` | CMMS/WorkOrder | approval required, low OT risk |
| `cmms.work_order.update` | CMMS/WorkOrder | approval required unless policy auto-approves narrow edits |
| `mes.schedule.update` | MES/schedule | planner approval, production impact check |
| `alarm.ack` | alarm system / SCADA | operator role required, audit required |
| `alarm.shelve` | alarm system / SCADA | operator/supervisor approval, duration/rationalization required |
| `alarm.suppress` | alarm system / SCADA | stricter approval, rationale and expiry required |
| `notification.send` | notification gateway | often auto-allowed under policy |
| `report.generate` | reporting/audit | allowed with audit |
| `opcua.method.call` | OPC UA Method | locked unless simulated or explicitly enabled |
| `opcua.attribute.write` | OPC UA writable Attribute | locked unless simulated or explicitly enabled |
| `sparkplug.ncmd` | Sparkplug Edge Node command | locked except rebirth/simulated profile by policy |
| `sparkplug.dcmd` | Sparkplug Device command | locked unless simulated or explicitly enabled |
| `plc.write` | PLC/actuator/setpoint | unavailable in v1 live profile |

## 5. SQL authority tables

### 5.1 `iiot.command_proposal`

Authority record for an intended action.

Required columns:

| Column | Meaning |
| --- | --- |
| `command_id` | stable UUID/ULID command identity |
| `command_class` | typed command class |
| `target_kind` / `target_id` | exact target |
| `requested_by_kind` / `requested_by_id` | human, agent, system actor |
| `requested_role` | role used for authorization context |
| `deployment_profile` | `dev-sim`, `edge-readonly`, `edge-supervisory`, etc. |
| `zone_id` / `conduit_id` | IEC 62443-style boundary metadata |
| `reason` | structured reason text |
| `agent_context_packet_id` | packet that produced proposal |
| `evidence_refs_json` | evidence refs from RFC-0008 |
| `standards_refs_json` | standards/decision IDs invoked |
| `idempotency_key` | exact replay/idempotency guard |
| `status` | proposed, policy_denied, awaiting_approval, approved, executing, executed, failed, reconciled, cancelled |
| `created_at` / `updated_at` | timestamps |

### 5.2 `iiot.command_policy_decision`

Records policy evaluation.

Required columns:

- `decision_id`;
- `command_id`;
- `policy_id`;
- `policy_version`;
- `input_hash`;
- `decision` (`allow`, `deny`, `requires_approval`, `requires_simulation`, `requires_interlock`, `locked`, `unavailable`);
- `reasons_json`;
- `required_approvals_json`;
- `required_interlocks_json`;
- `evaluated_at`.

### 5.3 `iiot.command_interlock_result`

Records each interlock check.

Required columns:

- `interlock_result_id`;
- `command_id`;
- `interlock_id`;
- `interlock_version`;
- `result` (`passed`, `failed`, `unknown`, `not_applicable`, `requires_operator_confirmation`);
- `input_refs_json`;
- `result_payload_json`;
- `evaluated_at`.

Unknown results fail closed for OT/supervisory classes.

### 5.4 `iiot.command_approval`

Records durable human/system approval facts.

Required columns:

- `approval_id`;
- `command_id`;
- `approver_id`;
- `approver_role`;
- `approval_state` (`requested`, `approved`, `rejected`, `expired`, `revoked`);
- `comment`;
- `separation_of_duties_group`;
- `expires_at`;
- `created_at`.

### 5.5 `iiot.command_execution_receipt`

Records adapter execution attempt/result.

Required columns:

- `receipt_id`;
- `command_id`;
- `adapter_kind`;
- `integration_id`;
- `external_operation_id`;
- `execution_state` (`started`, `succeeded`, `failed`, `timed_out`, `unknown`);
- `request_payload_hash`;
- `response_payload_hash`;
- `redacted_request_json`;
- `redacted_response_json`;
- `started_at`;
- `completed_at`.

### 5.6 `iiot.command_reconciliation`

Records post-execution observed effect.

Required columns:

- `reconciliation_id`;
- `command_id`;
- `expected_effect_json`;
- `observed_effect_refs_json`;
- `result` (`matched`, `mismatched`, `unknown`, `requires_followup`);
- `created_at`.

## 6. Command state graph

```text
proposed
  -> policy_denied
  -> awaiting_simulation
  -> awaiting_interlocks
  -> awaiting_approval
  -> approved
  -> executing
  -> executed
  -> reconciliation_pending
  -> reconciled

Any non-terminal state -> cancelled / expired / failed
```

Transitions are target-owned by the command authority service and must emit audit/domain events.

## 7. Policy inputs

Policy evaluation must consider:

| Input | Source |
| --- | --- |
| command class | proposal |
| actor and role | auth/personnel/approval context |
| target entity | graph/domain record |
| deployment profile | configuration / SQL environment registry |
| zone/conduit | IEC 62443-inspired topology/security model |
| adapter capability | integration descriptor |
| data freshness | historian/EventJournal/source quality refs |
| standards decisions | conformance matrix decision IDs |
| existing constraints | Reactor/SQL constraint authority |
| approval requirements | command policy registry |

## 8. Adapter execution contract

Adapters receive an execution request only after command authority produces an execution receipt intent.

```text
CommandAuthority -> AdapterExecutionRequest(commandId, receiptId, target, payload, capability, approvalRefs)
Adapter -> CommandExecutionReceiptUpdate
```

Adapters may reject execution if local capability/security constraints disagree. Adapter rejection becomes a receipt, not an exception swallowed by the agent.

## 9. Replay and audit

Replay must reconstruct:

1. original proposal;
2. agent context packet;
3. standards decisions invoked;
4. policy input and output;
5. interlock results;
6. approval facts;
7. adapter receipt;
8. observed reconciliation evidence;
9. final state and denial/failure/success reason.

## 10. Acceptance criteria

- Agents cannot execute integration writes directly.
- Every command has a SQL `command_id` before policy evaluation.
- Every policy/interlock/approval/execution result is durable and replayable.
- Unknown/stale/missing/unsafe inputs fail closed for OT/supervisory command classes.
- Simulators require execution receipts just like live adapters.
- The conformance matrix can trace command decisions to IEC 62443, OPC UA, Sparkplug, ISA-18.2, and ISA-95 anchors where relevant.
