# Industrial Agentic Platform Source Ledger

Status: living source ledger for the RFC pack

## Internal repo precedents

| Source | Why it matters |
| --- | --- |
| `src/lib/iiot/docs/REACTOR-V2-CLOSEOUT-REPORT.md` | Establishes Reactor v2 as the SQL/graph/event structural consistency substrate. |
| `src/lib/iiot/docs/REACTOR-V2-PROMOTION-INDEX.md` | Activation tier and lane packaging contract; prevents silent baseline-live behavior. |
| `src/lib/iiot/docs/REACTOR-SOURCE-CLAIM-DESIGN.md` | Durable source-entry claim, checkpoint, fingerprint, and zombie recovery model. |
| `docs/specifications/research-reactive-isa95.md` | Existing research on ISA-95 limitations and reactive entity/event propagation. |
| `docs/decisions/adr-003-sparkplug-client-fork.md` | Sparkplug B client fork rationale and Effect-native MQTT/Sparkplug design direction. |
| `docs/research/iiot/sparkplug-resources.md` | Sparkplug B reference card, topic namespace, client design, and downstream ingestion role. |
| `docs/research/iiot/nats-resources.md` | NATS-only Sparkplug B broker decision and JetStream/KV role. |
| `docs/research/iiot/emqx-resources.md` | Banked EMQX activation path when third-party MQTT 5.0 or conformance requirements force it. |
| `../pct/NATS-INTEGRATION-CLOSEOUT.md` | MSH/LNK/PCT boundary precedent: substrate, durable stream bridge, typed proof/control plane. |
| `../pct/RFC-FRAME-PROJECTIONS.md` | Projection scheduler/admission and Timescale/LNK frame-stream design precedent. |
| `../effect-sui/docs/MANAGED_RUNTIME_STRATEGY.md` | ManagedRuntime is an edge object for long-lived service stacks; services themselves remain compositional Effects. |

## External source anchors

| Source | RFC relevance |
| --- | --- |
| Juna AI Agentic Factory OS | Market precedent for a shared operating layer powering multiple factory AI agents. |
| IFS Loops Industrial Agentic AI Platform | Market precedent for governed digital workers executing multi-system industrial workflows. |
| DataMesh FactVerse AI Agent | Market precedent for physical AI grounded in asset relationships and work-order actions. |
| LEK Process Industry Automation 2025 | Market framing: process automation growth, edge AI, open control, sustainability/regulatory pressure. |
| Prosys OPC — UNS and OPC UA | OPC UA + UNS pairing and manufacturing data-model context. |
| Automation World / CSIA — Beyond ISA-95 UNS | UNS as a remedy for point-to-point manufacturing integration and data silos. |
| Siemens Industrial Edge architecture | Control-plane/data-plane separation for industrial edge device management. |
| Pepr documentation and best practices | Kubernetes policy/controller precedent; TypeScript-defined transformations, HA admission-controller recommendations. |
| Red Hat Validated Patterns — Industrial Edge | Open hybrid cloud / edge deployment pattern reference. |

## Interpretation rules

1. Market precedents prove demand shape, not architecture correctness.
2. Vendor docs prove integration surfaces, not our internal authority model.
3. Standards guide schemas/workflows; they do not replace explicit contracts.
4. Reactor v2 remains the strongest internal precedent: source claims, constraints, graph projection, target-owned mutation, and replayable audit.
