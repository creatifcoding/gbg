# WorkOrder `depends_on` Routing Contract

> Status: guarded opt-in via `ReactorDependsOnLive`; not enabled in `ReactorGenericLive` by default

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
| `depends_on.work-order-satisfied.satisfies-source` | asserted `satisfied` | `dependency.satisfied` | Explicitly parked as an informational no-op until a target-owned progression contract exists. |
| `depends_on.work-order-block-retracted.releases-source` | retracted `blocked` | `dependency.released` | Uses a natural constraint address from `causedByPropagationId` to retract the original block. |

## Direction

The policy observes the **target** endpoint and requests the **source** endpoint:

```text
observedEndpoint = target
requestEndpoint = source
```

So if `WO-A depends_on WO-B`, and `WO-B` fails, Reactor sends dependency pressure
to `WO-A`.

## Current guardrail

These policies are registered on the `depends_on` relationship descriptor and
packaged in `ReactorDependsOnLive`, but not included in `ReactorGenericLive`.
That is deliberate:

- `dependency.blocked` is proven in opt-in E2E coverage for upstream suspended,
  failed, and cancelled events.
- `dependency.released` is proven in opt-in E2E coverage with exact SQL natural
  address retraction and target-owned downstream resume.
- `dependency.satisfied` is explicitly parked as an informational no-op until a
  target-owned progression contract exists.

Prime, this is a guarded lane, not a sneaky workflow engine in a trench coat.
