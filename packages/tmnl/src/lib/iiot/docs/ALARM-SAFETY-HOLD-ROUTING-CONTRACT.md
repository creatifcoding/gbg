# Alarm Safety-Hold Routing Contract

> Status: guarded opt-in via `ReactorAlarmSafetyLive`; not enabled in `ReactorGenericLive` by default

This contract defines how alarm facts become WorkOrder safety pressure without
turning Reactor into a workflow orchestrator. Alarms remain durable EventLog
facts. The graph remains projected topology. WorkOrders own hold/release
eligibility, idempotency, transitions, audit, and any emitted events.

Prime, alarms may scream. They do not get to grab the state machine controls.

## Observation shape

Source: `src/lib/iiot/services/reactor/observations.ts`

Alarm events are observed on their `deviceId` endpoint so the current generic
single-edge graph expansion can route through existing WorkOrder asset edges:

```text
WorkOrder -[:targets]-> Device
WorkOrder -[:requires]-> Device
AlarmTriggered(deviceId = Device)
  -> subject = Device
  -> signal = alarm.safety asserted hold
  -> request WorkOrder safety.hold
```

| Event | Subject | Signal |
| --- | --- | --- |
| `AlarmTriggered` with `critical` / `emergency` severity | `device` | `alarm.safety condition_asserted hold` |
| `AlarmTriggered` with `info` / `warning` severity | `device` | `alarm.safety condition_asserted informational` |
| `AlarmEscalated` | `device` | `alarm.safety condition_asserted hold` |
| `AlarmCleared` | `device` | `alarm.safety condition_retracted hold` |

Non-critical `AlarmTriggered` observations are intentionally informational. They
produce an observation for audit/explainability, but declared hold policies only
match `value = hold`.

## Relationship policies

Source: `src/lib/iiot/schemas/relationships/edge-types.ts`

| Policy | Edge | Signal | Capability |
| --- | --- | --- | --- |
| `targets.alarm-safety-hold.holds-source` | `targets` | asserted `hold` | `safety.hold` |
| `requires.alarm-safety-hold.holds-source` | `requires` | asserted `hold` | `safety.hold` |
| `targets.alarm-safety-hold-retracted.releases-source` | `targets` | retracted `hold` | `safety.release` |
| `requires.alarm-safety-hold-retracted.releases-source` | `requires` | retracted `hold` | `safety.release` |

Direction is the same as equipment availability pressure:

```text
observedEndpoint = target
requestEndpoint = source
```

So if `WO-A -[:requires]-> DEV-1` and `DEV-1` emits a critical alarm,
Reactor may plan a `safety.hold` request for `WO-A`.

## Why device subject instead of alarm subject?

The graph already supports direct one-edge expansion from an observed target to
WorkOrders that `targets` or `requires` it. Alarm graph topology currently lives
behind the alarm asset relation (`alarm -[:triggered_by]-> device`) and may later
use multi-hop traversal:

```text
Alarm -[:triggered_by]-> Device <-[:targets|requires]- WorkOrder
```

That multi-hop expansion is not part of the generic Reactor planner today. This
contract chooses the conservative one-edge subject (`device`) while retaining the
alarm payload in the observation for explainability.

## Current guardrail

These policies are registered on `targets` and `requires` descriptors and
packaged in `ReactorAlarmSafetyLive`, but are not included in
`ReactorGenericLive`.

Opt-in activation now has:

1. Target-owned WorkOrder `safety.hold` capability.
2. Target-owned WorkOrder `safety.release` capability backed by SQL constraint
   authority and WorkOrder-owned resume eligibility.
3. Alarm-id-addressed SQL safety constraints so clearing one alarm retracts only
   that alarm's hold.
4. E2E coverage for critical alarm hold propagation over both `targets` and
   `requires`, plus exact single-alarm release.

Still future: optional graph projection for alarm nodes and `triggered_by` edges
if/when the planner grows multi-hop policy expansion.
