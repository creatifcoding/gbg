# External/Device `requires` Availability Routing Contract

> Status: declared, not enabled in `ReactorGenericLive` by default

This contract defines how WorkOrder `requires` relationships can react to
external and device availability facts. It completes the remaining candidate
routing lane under the Reactor relationship program.

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

| Event | Subject | Signal |
| --- | --- | --- |
| `ExternalRefLinked` | `external` | `external.availability condition_asserted available` |
| `ExternalRefUnlinked` | `external` | `external.availability condition_asserted unavailable` |

This is intentionally conservative and documented as a live-activation guardrail.
`ExternalRefLinked` / `ExternalRefUnlinked` are primarily topology facts; they do
not prove upstream system health in the general case.

### Devices

| Event | Subject | Signals |
| --- | --- | --- |
| `DeviceDecommissioned` | `device` | `structural.lifecycle condition_asserted decommissioned`; `device.availability condition_asserted unavailable` |

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

## Projection-order warning

`ExternalRefUnlinked` currently closes `requires`/`produces` graph edges in the
ContextEvents graph projector. A live Reactor lane cannot rely on active-edge
expansion after the edge is closed unless one of these is true:

1. Reactor processes the event before the projection closes the edge.
2. Graph expansion supports temporal/as-of traversal over relationship audit.
3. The event carries enough target identity to bypass graph expansion safely.

Until one of those exists, external unlink unavailability is a declared contract,
not a production mutation lane.

## Current guardrail

These policies are registered on the `requires` descriptor but are not included
in `ReactorGenericLive`.

Activation requires:

1. SQL constraint/source-claim address mapping for external and device dependency
   pressure.
2. Target-owned WorkOrder handling for `dependency.blocked` with
   `dependencyKind = external | device`.
3. Target-owned WorkOrder release handling that can retract only the matching
   external/device constraint, never unrelated active pressure.
4. A durable external availability event or temporal graph expansion for
   unlink-driven external unavailability.
5. A durable device availability recovery event before enabling device release.

Until then, the lane is deliberately declaration-first: typed observations,
registry policies, documentation, and tests — no live dispatch.
