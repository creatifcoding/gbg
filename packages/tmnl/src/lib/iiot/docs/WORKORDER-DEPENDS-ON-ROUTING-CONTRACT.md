# WorkOrder `depends_on` Routing Contract

> Status: declared, not enabled in `ReactorGenericLive` by default

This contract defines how WorkOrder lifecycle facts can propagate over graph
edges of type `depends_on`.

Events remain primitive. The graph edge only says which WorkOrder depends on
which other WorkOrder. Reactor observes the upstream/target WorkOrder and sends
a target-owned request to the downstream/source WorkOrder.

```text
(source WorkOrder)-[:depends_on]->(target WorkOrder)

WorkOrder event on target
  -> WorkOrder dependency observation
  -> depends_on policy
  -> request to source WorkOrder
```

## Observation specs

Source: `src/lib/iiot/services/reactor/observations.ts`

| Event | Signal |
| --- | --- |
| `WorkOrderSuspended` | `work_order.execution condition_asserted blocked` |
| `WorkOrderFailed` | `work_order.execution condition_asserted blocked` |
| `WorkOrderCancelled` | `work_order.execution condition_asserted blocked` |
| `WorkOrderCompleted` | `work_order.execution condition_asserted satisfied` |
| `WorkOrderResumed` | `work_order.execution condition_retracted blocked` |

## Relationship policies

Source: `src/lib/iiot/schemas/relationships/edge-types.ts`

| Policy | Signal | Capability | Notes |
| --- | --- | --- | --- |
| `depends_on.work-order-blocked.blocks-source` | asserted `blocked` | `dependency.blocked` | Suspends/blocks the dependent source WorkOrder if target contract accepts it. |
| `depends_on.work-order-satisfied.satisfies-source` | asserted `satisfied` | `dependency.satisfied` | Future target-owned progression/no-op contract. |
| `depends_on.work-order-block-retracted.releases-source` | retracted `blocked` | `dependency.released` | Requires constraint-address enrichment before live release dispatch. |

## Direction

The policy observes the **target** endpoint and requests the **source** endpoint:

```text
observedEndpoint = target
requestEndpoint = source
```

So if `WO-A depends_on WO-B`, and `WO-B` fails, Reactor sends dependency pressure
to `WO-A`.

## Current guardrail

These policies are registered on the `depends_on` relationship descriptor, but
not included in `ReactorGenericLive`. That is deliberate:

- `dependency.blocked` can reuse the WorkOrder blocking capability once a source
  claim E2E lane is selected.
- `dependency.released` needs explicit SQL constraint identity/natural address.
  Generic policy payloads do not yet enrich release requests with that address.
- `dependency.satisfied` needs a target-owned WorkOrder capability before live
  dispatch.

Prime, this is a contract, not a sneaky workflow engine in a trench coat.
