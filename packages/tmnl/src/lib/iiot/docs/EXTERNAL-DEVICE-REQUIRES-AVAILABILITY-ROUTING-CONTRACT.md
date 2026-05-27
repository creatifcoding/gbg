# External/Device `requires` Availability Routing Contract

> Status: guarded opt-in via `ReactorExternalDeviceAvailabilityLive`; not enabled in `ReactorGenericLive` by default

This contract defines how WorkOrder `requires` relationships react to external
and device availability facts in the guarded opt-in Reactor lane. It completes
the remaining candidate routing lane under the Reactor relationship program.

Events remain primitive. The graph is a projection. Reactor may plan requests
from durable observations and graph topology, but the target WorkOrder owns
eligibility, idempotency, transitions, SQL audit, and emitted events.

Prime, this is a dependency pressure declaration — not a permission slip for
ContextEvents to cosplay as a workflow engine.

## Observations

Source: `src/lib/iiot/services/reactor/observations.ts`

### External references

There is no dedicated `ExternalAvailabilityChanged` event yet. The current
contract uses context reference lifecycle events as the only durable external
facts available today:

| Event | Subject | Signal | Propagation identity |
| --- | --- | --- | --- |
| `ExternalRefLinked` | `external` | `external.availability condition_asserted available` | current journal entry; `causedByPropagationId = externalRefId` for exact release |
| `ExternalRefUnlinked` | `external` | `external.availability condition_asserted unavailable` | `externalRefId` for stable exact constraint assertion |

This is intentionally conservative. `ExternalRefLinked` / `ExternalRefUnlinked`
are primarily topology facts; the lane treats unlink as dependency pressure only
for WorkOrders with an audited `requires` edge to that external reference.

### Devices

| Event | Subject | Signals | Propagation identity |
| --- | --- | --- | --- |
| `DeviceDecommissioned` | `device` | `structural.lifecycle condition_asserted decommissioned`; `device.availability condition_asserted unavailable` | `deviceId` for stable unavailable assertion |

There is currently no durable `DeviceReturnedToService` or
`DeviceAvailabilityChanged` event. Device release policy is therefore declared
for future compatibility but has no production observation source yet.

## Relationship policies

Source: `src/lib/iiot/schemas/relationships/edge-types.ts`

All policies route over `requires`:

```text
WorkOrder -[:requires]-> External
WorkOrder -[:requires]-> Device
```

| Policy | Signal | Capability |
| --- | --- | --- |
| `requires.external-unavailable.blocks-source` | `external.availability = unavailable` | `dependency.blocked` |
| `requires.external-available.releases-source` | `external.availability = available` | `dependency.released` |
| `requires.device-unavailable.blocks-source` | `device.availability = unavailable` | `dependency.blocked` |
| `requires.device-available.releases-source` | `device.availability = available` | `dependency.released` |

Direction:

```text
observedEndpoint = target
requestEndpoint  = source
```

So if `WO-A -[:requires]-> EXT-1` and `EXT-1` is observed unavailable, Reactor
may plan a dependency request for `WO-A`.

## Projection-order resolution

`ExternalRefUnlinked` closes `requires`/`produces` graph edges in the
ContextEvents graph projector. The guarded opt-in lane no longer depends on
active-edge expansion alone: `GraphClient.expandPropagationTargets` now unions
active graph traversal with an event-time relationship-audit traversal.

For unlink, this means Reactor can still find the WorkOrder that required the
external reference even if the projection already soft-deleted the live AGE edge.
The audit query treats an edge as active at the event time when:

1. an `upsert` audit row exists at or before the observed event time; and
2. no `soft_delete` audit row exists before that event time.

That preserves the event/log/projection ordering boundary without asking the
ContextEvents projector to dispatch Reactor mutations. Very polite. Very not a
Rube Goldberg machine.

## Current guardrail

These policies are registered on the `requires` descriptor and wired into the
opt-in `ReactorExternalDeviceAvailabilityLive` bundle. They are still excluded
from `ReactorGenericLive`.

Proven in E2E:

1. External unlink blocks the exact requiring WorkOrder even after projection
   closes the active graph edge.
2. External relink retracts only the matching external constraint using SQL
   natural-address release.
3. Device decommission blocks WorkOrders that require the device.

Still parked:

1. Device release remains descriptor-registered for future compatibility, but no
   durable `DeviceReturnedToService` / `DeviceAvailabilityChanged` event exists.
2. External reference events are topology lifecycle facts, not a general upstream
   health feed. Broader external health needs a dedicated durable event before
   default-live promotion.
