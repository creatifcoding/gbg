# RFC-HPX-003: Transport SDK Family

```text
RFC:           RFC-HPX-003
Status:        DRAFT
Track:         Variant A
Created:       2026-02-10
Depends On:    RFC-HPX-000/001/002
```

## Intent

Define a reusable SDK family for Elixir-facing transports with AVA as first adopter.

## Normative References

- Phoenix JS client behavior: https://hexdocs.pm/phoenix/js/
- Phoenix wire framing guide: https://hexdocs.pm/phoenix/writing_a_channels_client.html
- Effect layers/services: https://effect.website/docs/requirements-management/layers/

## Proposed Package Split

- `transport-core` (contracts, errors, envelopes)
- `transport-phoenix` (join/rejoin/replay/ack + heartbeat)
- `ava-sdk` (domain operations)
- `ava-react` (atom projection adapters)

## Hard Constraints

1. React state is atom-backed and projection-only.
2. High-volume ingress uses stream/queue/pubsub with explicit overflow policy.
3. Replay-required path enforces no-live-before-ack.

## Atom Projection Contract

- React-facing state MUST be exposed through atoms (`Atom.make` / `Atom.family` / derived atoms).
- UI atoms MUST be bounded projections:
  - reducer snapshots,
  - health/status tuples,
  - ring-buffered event excerpts.
- Raw ingress payload streams MUST NOT be mirrored 1:1 into UI atoms.
- Transport services MAY keep internal coordination state, but UI authority remains atom-backed projections.

## Ingress / Overflow Policy

SDK-family default policies:

- **Control lane** (connect/join/ack/replay): `Queue.bounded` + suspend/backpressure.
- **Event lane** (high-volume payloads): `Queue.sliding` (drop-oldest) with bounded capacity.
- **Critical invariant breaches** (buffer exhaustion for replay gate): fail-session.

Required observability for policy behavior:

- `transport_ingress_backpressure_total`
- `transport_ingress_drop_oldest_total`
- `transport_ingress_fail_session_total`

## Replay Ack State Machine

```text
idle -> joining -> (live | replay_required)
replay_required -> replay_buffering -> awaiting_ack
awaiting_ack -> (live | failed)
live -> joining (on reconnect)
```

Invariants:

- No live dispatch before replay ack success when replay is required.
- Replay and buffered-live flush must preserve deterministic order.
- Ack timeout/reject paths must enter `failed` and require explicit recovery.

## Observability Map

Spans:

- `transport.connect`
- `transport.join`
- `transport.replay.apply`
- `transport.replay.ack`
- `transport.live.dispatch`
- `transport.reconnect`

Counters:

- `transport_connect_attempt_total`
- `transport_connect_failure_total`
- `transport_replay_required_total`
- `transport_replay_ack_success_total`
- `transport_replay_ack_failure_total`

Structured log fields:

- `topic`, `workspace_id`, `client_session_id`, `replay_session_id`, `last_seen_event_id`, `event_id`, `correlation_id`

## Migration & Rollback

Migration sequence:

1. Land `transport-core` and `transport-phoenix` interfaces.
2. Port existing Phoenix path behind compatibility adapters.
3. Move AVA domain APIs to `ava-sdk`.
4. Move React consumers to `ava-react` atom projections.
5. Remove legacy runtime imports from `pi-orchestrator` path.

Rollback:

- Keep compatibility adapter toggle for one release window.
- On conformance failure (replay/ack or overflow), route traffic back to legacy stable transport while retaining telemetry.

## Research Questions

- Which boundaries maximize reuse without abstracting away Phoenix semantics?
- What migration path minimizes disruption to existing `pi-orchestrator` call sites?
- Which APIs remain stable across Phoenix and non-Phoenix adapters?

## Conformance Mapping (Checklist IDs)

- A Canonical references: **covered**
- B Boundary/topology: **covered (family split + migration)**
- C React state provisions: **covered**
- D High-volume handling: **covered**
- E Replay/session correctness: **covered**
- F Reconnect/auth: **partially covered (reconnect; auth specified in HPX-001)**
- G Observability: **covered**
- H Migration/rollout: **covered**
- I Variant governance: **covered**
- J Evidence quality: **covered (normative refs + explicit assumptions)**

## Draft Acceptance

- Contract package boundaries documented with anti-goals.
- Conformance checklist fully mapped.
- Migration sequencing and rollback plan included.
