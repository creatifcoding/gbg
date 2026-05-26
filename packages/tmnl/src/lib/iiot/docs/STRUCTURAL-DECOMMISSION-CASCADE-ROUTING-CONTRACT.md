# Structural Decommission Cascade Routing Contract

> Status: guarded opt-in via `ReactorStructuralDecommissionLive`; not enabled in `ReactorGenericLive` by default

This contract defines how structural decommission facts can propagate through the
relationship graph without making Reactor the owner of lifecycle state.

Events remain primitive. Structural graph nodes and `contains` edges are
projection artifacts. Reactor may plan requests from those facts, but the target
entity owns eligibility, idempotency, transition, audit, and emitted events.

Prime, decommission cascades are not a license to invent a distributed delete
button. We are declaring pressure, not swinging an axe.

## Observation specs

Source: `src/lib/iiot/services/reactor/observations.ts`

Each decommission event becomes a structural lifecycle observation on the entity
it decommissions:

```text
StructuralEvent(entityId)
  -> subject = relationship node for entityId
  -> signal = structural.lifecycle condition_asserted decommissioned
```

| Event | Subject |
| --- | --- |
| `EnterpriseDecommissioned` | `enterprise` |
| `SiteDecommissioned` | `site` |
| `AreaDecommissioned` | `area` |
| `PlantDecommissioned` | `plant` |
| `LineDecommissioned` | `line` |
| `WorkCellDecommissioned` | `workcell` |
| `MachineDecommissioned` | `machine` |
| `SensorDecommissioned` | `sensor` |
| `DeviceDecommissioned` | `device` |

All observations use:

```text
axis  = structural.lifecycle
kind  = condition_asserted
value = decommissioned
```

## Relationship policies

Source: `src/lib/iiot/schemas/relationships/edge-types.ts`

| Policy | Edge | Direction | Capability | Purpose |
| --- | --- | --- | --- | --- |
| `contains.structural-decommission.inherits-target` | `contains` | observed source -> request target | `lifecycle.inherited` | Propagate lifecycle pressure from parent structural node to contained child node. |
| `targets.structural-decommission.blocks-source` | `targets` | observed target -> request source | `dependency.blocked` | Block WorkOrders targeting a decommissioned asset. |
| `requires.structural-decommission.blocks-source` | `requires` | observed target -> request source | `dependency.blocked` | Block WorkOrders requiring a decommissioned asset. |

## Topology meaning

### Containment cascade

```text
Enterprise -[:contains]-> Site -[:contains]-> Area -[:contains]-> Plant
Plant -[:contains]-> Line -[:contains]-> WorkCell -[:contains]-> Machine

PlantDecommissioned(PLT-1)
  -> subject PLT-1
  -> contains policy requests lifecycle.inherited on child Lines
```

The child structural entity decides what inherited lifecycle pressure means. It
may emit its own domain event, soft-close projection edges, defer, or no-op.
Reactor does not directly mutate child graph state.

### WorkOrder dependency pressure

```text
WorkOrder -[:targets]-> Machine
WorkOrder -[:requires]-> Device

MachineDecommissioned(MCH-1)
  -> dependency.blocked request to WorkOrders targeting/requiring MCH-1
```

The WorkOrder target contract remains authoritative for whether the request
becomes a suspend transition and which SQL constraint/source claim records are
created.

## Current guardrail

These policies are registered on `contains`, `targets`, and `requires`
descriptors and packaged in `ReactorStructuralDecommissionLive`, but are not
included in `ReactorGenericLive`.

Opt-in activation now has:

1. Target-owned structural `lifecycle.inherited` capability for structural nodes.
   The first promoted contract is deliberately projection-only/no-op: it accepts
   inherited decommission pressure but emits no child StructuralEvents and writes
   no graph mutation.
2. SQL constraint/source-claim mapping for WorkOrder structural decommission
   pressure through the existing target-owned `dependency.blocked` capability.
3. A bounded cascade execution policy: direct `contains` children are routed in
   deterministic order; recursive cascade requires emitted child events and is
   intentionally not performed by Reactor.
4. E2E coverage for direct-child containment cascade and WorkOrder blocking over
   `targets`/`requires`.

Still future: a product decision on whether inherited child decommission should
emit child StructuralEvents or remain a derived projection/request state.
