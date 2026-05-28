# RFC-0008 — Agent Context Packets, Evidence, and Explanation Contracts

Status: draft

## 1. Purpose

Industrial agents need more than chat memory. They need bounded, evidence-backed context packets that can be audited, replayed, and challenged against standards and operational facts.

This RFC defines the shape of an **Agent Context Packet**: the object an agent receives when asked to explain, recommend, simulate, or propose an action. The packet is not the authority; it is a curated view over authority-bearing records.

```text
EventJournal + SQL authority + graph projection + historian + standards ledger
        ↓
Context assembler
        ↓
AgentContextPacket
        ↓
agent explanation / recommendation / command proposal
        ↓
Command governance + audit + replay
```

## 2. Standards anchors

| Anchor | Context-packet consequence |
| --- | --- |
| `STD-ISA95-CONCEPT` | Context packets must distinguish Level 2/3/4 responsibilities, equipment, physical asset, material, personnel, maintenance, schedule, and operations context. |
| `STD-ISA18-SERIES` | Alarm-related context must include alarm philosophy/rationalization/priority/operator-action evidence where available. |
| `STD-IEC62443-SERIES` | Agent action context must include actor, role, zone/conduit, risk posture, security level/deployment profile, and approval/interlock status. |
| `STD-OPCUA-P1-OVERVIEW` | OPC UA evidence should preserve source AddressSpace, event, alarm, history, and audit provenance. |
| `STD-SPARKPLUG-OP-BEHAVIOR` | Sparkplug evidence should preserve birth/death/session/sequence/stale-quality context before agent inference. |
| `STD-ISO22400-KPI` | KPI/OEE context must include formula inputs, windows, and source evidence rather than naked KPI numbers. |
| `STD-MIMOSA-OSA-CBM` | Maintenance recommendations should preserve asset-health evidence, condition evidence, and physical asset identity. |

## 3. Context packet principles

1. **Evidence before inference.** The packet separates observed facts from inferred conclusions.
2. **Durable references over copied truth.** The packet links to EventJournal, SQL audit rows, graph snapshots, historian windows, and document refs.
3. **Standards traceability.** When the packet invokes an industrial concept, it carries a standards anchor or marks it as a TMNL extension.
4. **Action posture is explicit.** The packet states whether the agent may observe, recommend, draft, request approval, or execute through governance.
5. **Replayable.** A packet can be reconstructed from durable records at a given time/policy epoch.
6. **Bounded.** Packet assembly must respect time windows, entity scopes, and token/context budgets.

## 4. Packet taxonomy

| Packet | Purpose |
| --- | --- |
| `OperationalSituationPacket` | explain current plant/line/equipment state and impacts |
| `AlarmTriagePacket` | explain alarm condition, priority, rationalization, probable causes, and response options |
| `MaintenanceRecommendationPacket` | recommend WorkOrder/CMMS actions from condition, fault, asset, and history evidence |
| `CommandProposalPacket` | prepare command proposal with policy/interlock/approval requirements |
| `OeeImpactPacket` | explain downtime/OEE impact and formula/source windows |
| `SecurityBoundaryPacket` | explain command availability/denial under deployment profile and zones/conduits |

## 5. Common envelope

Every packet should include:

| Field | Meaning |
| --- | --- |
| `packetId` | deterministic or persisted packet identity |
| `packetKind` | packet taxonomy value |
| `assembledAt` | clock timestamp for assembly |
| `asOf` | data time boundary used for query/replay |
| `policyEpoch` | command/Reactor/standards policy epoch |
| `registryFingerprint` | relevant descriptor/registry fingerprint |
| `subject` | primary entity or operational scope |
| `timeWindow` | relevant historian/event window |
| `authorityRefs` | SQL/EventJournal records used as authority |
| `projectionRefs` | graph/read-model/historian projections used for context |
| `standardsRefs` | standards ledger IDs and decision IDs invoked |
| `observations` | observed facts only |
| `inferences` | derived claims with confidence and method |
| `recommendations` | candidate actions, not yet commands unless elevated |
| `limits` | missing data, stale data, unresolved identity, or confidence caveats |

## 6. Evidence references

`IndustrialEvidenceRef` should be a tagged union:

```text
EventJournalRef
SqlAuditRef
GraphSnapshotRef
GraphEdgeAuditRef
HistorianWindowRef
OpcUaSourceRef
SparkplugSourceRef
DocumentRef
StandardsRef
UserInputRef
ExternalSystemRef
```

Minimum fields:

- `refId`;
- `refKind`;
- `sourceSystem`;
- `sourceTimestamp`;
- `ingestedAt`;
- `authorityRank`;
- `dataQuality`;
- `entityRefs`;
- `excerpt` or structured payload hash;
- `replayLocator`.

Authority rank example:

| Rank | Meaning |
| --- | --- |
| `authority` | durable record that owns transition/audit fact |
| `projection` | derived graph/read-model/historian projection |
| `source` | raw external source payload or address |
| `interpretation` | inferred explanation or model output |
| `standard` | standards source/decision anchor |

## 7. Observation versus inference

The packet must make the following distinction machine-checkable:

```text
Observation: Sparkplug DDEATH for device D received at t, metrics M marked stale.
Inference: WorkOrder W is blocked because it depends_on equipment E whose device D is unavailable.
Recommendation: Create maintenance WorkOrder for asset A and notify shift supervisor.
Command proposal: Update CMMS ticket after approval by maintenance planner.
```

Observation/inference fields:

| Field | Observation | Inference |
| --- | --- | --- |
| source refs | required | required |
| deterministic method | optional | required |
| confidence | not applicable or quality | required |
| standard refs | if standards concept used | if standards concept used |
| replay required | yes | yes |

## 8. Standards traceability inside packets

A packet may include standards references in two forms:

```text
standardsRefs: [
  { sourceId: "STD-SPARKPLUG-OP-BEHAVIOR", decisionId: "DEC-IND-003", use: "DDEATH implies device offline and metrics stale" },
  { sourceId: "STD-IEC62443-SERIES", decisionId: "DEC-IND-007", use: "PLC write requires deny-by-default command posture" }
]
```

If a recommendation relies on a non-standard product idea, mark it:

```text
{ sourceId: "TMNL-EXTENSION", use: "Reactor propagated WorkOrder dependency constraint" }
```

## 9. Agent output contract

Agents should return structured output, not just prose.

| Output field | Required? | Meaning |
| --- | --- | --- |
| `summary` | yes | human-readable short explanation |
| `observedFacts` | yes | facts with evidence refs |
| `derivedFindings` | yes | inferences with confidence/method |
| `affectedEntities` | yes | entities and relationships impacted |
| `recommendedActions` | optional | action candidates with risk/benefit |
| `commandProposals` | optional | governed command proposals, never direct adapter calls |
| `missingEvidence` | optional | data needed for higher confidence |
| `standardsTrace` | yes | standards source/decision IDs used |
| `auditNotes` | yes | replay and retention notes |

## 10. Context assembly service

Candidate service boundary:

```ts
export interface AgentContextAssembler {
  readonly assembleOperationalSituation: (input: SituationQuery) => Effect.Effect<OperationalSituationPacket, ContextError>
  readonly assembleAlarmTriage: (input: AlarmTriageQuery) => Effect.Effect<AlarmTriagePacket, ContextError>
  readonly assembleMaintenanceRecommendation: (input: MaintenanceQuery) => Effect.Effect<MaintenanceRecommendationPacket, ContextError>
  readonly assembleCommandProposal: (input: CommandProposalQuery) => Effect.Effect<CommandProposalPacket, ContextError>
}
```

Dependencies:

- EventJournal reader;
- SQL audit repos;
- graph query services;
- historian port;
- standards conformance registry;
- command governance registry;
- identity resolver;
- document/evidence store.

## 11. Replay proof

A packet is replay-valid if:

1. all authority refs still exist;
2. projection refs can be regenerated or are explicitly snapshot-pinned;
3. standards decision IDs still exist at the referenced version;
4. policy epoch/registry fingerprint match the decision context;
5. generated observations/inferences match replay within declared tolerance.

## 12. Acceptance criteria

- Agents receive context packets, not direct unconstrained database/browser spelunking.
- Packet outputs separate observed facts from inferred claims.
- Standards anchors are explicit where standards-derived semantics appear.
- Command proposals are generated as governed records, never direct adapter mutations.
- Replay can reconstruct why an agent recommended or proposed an action.
