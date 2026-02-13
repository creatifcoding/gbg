# RFC-HPX-004: AVA Vertical SDK

```text
RFC:           RFC-HPX-004
Status:        DRAFT
Track:         Variant B
Created:       2026-02-10
Depends On:    RFC-HPX-000/001/002
```

## Intent

Specify an AVA-first client SDK with prewired topics, schemas, commands, replay semantics, and observability.

## Normative References

- Phoenix JS client behavior: https://hexdocs.pm/phoenix/js/
- Phoenix wire framing guide: https://hexdocs.pm/phoenix/writing_a_channels_client.html
- Effect layers/services: https://effect.website/docs/requirements-management/layers/

## Scope

- AVA topic map and event taxonomy
- AVA typed command/push surface
- AVA replay + cursor continuity defaults
- AVA atom-facing projection interfaces

## Coupling Guardrails

- Domain coupling is allowed at AVA layer, not transport core.
- Protocol fields remain versioned and schema-backed.
- Legacy `pi-orchestrator` imports are migration-only and time-boxed.

## Atom Projection Contract

AVA React surfaces MUST expose:

- `connectionStateAtom` (phase + health)
- `sessionCursorAtom` (last committed cursor + replay session)
- `artifactProjectionAtomFamily(workspaceId)` (reduced domain projection)
- `eventWindowAtomFamily(workspaceId)` (bounded ring buffer)

Constraints:

- No unbounded `event[]` UI history atom.
- No direct raw transport frame atom.
- Projection reducers MUST be deterministic and idempotent for replayed events.

## Ingress / Overflow Policy

AVA vertical defaults:

- Domain-critical events: bounded + suspend/backpressure.
- Non-critical telemetry/status chatter: sliding queue.
- Replay buffer overflow during gated state: fail-session with explicit error event.

Required counters:

- `ava_ingress_backpressure_total`
- `ava_ingress_drop_oldest_total`
- `ava_replay_buffer_overflow_total`

## Replay Ack State Machine

```text
idle -> joining -> (live | replay_required)
replay_required -> applying_replay -> awaiting_ack
awaiting_ack -> (live | failed)
failed -> joining (manual reconnect / retry policy)
```

Required error paths:

- `replay_ack_timeout`
- `replay_ack_rejected`
- `cursor_stale`

Invariant:

- Any `ava.*` live event dispatch is blocked until replay ack success when replay is required.

## Observability Map

Spans:

- `ava.sdk.connect`
- `ava.sdk.join`
- `ava.sdk.replay.apply`
- `ava.sdk.replay.ack`
- `ava.sdk.live.dispatch`

Counters:

- `ava_connect_attempt_total`
- `ava_connect_failure_total`
- `ava_replay_required_total`
- `ava_replay_ack_success_total`
- `ava_replay_ack_failure_total`
- `ava_live_dispatch_total`

Logs include:

- `workspace_id`, `topic`, `client_session_id`, `replay_session_id`, `last_seen_event_id`, `event_id`, `error_code`

## Migration & Rollback

Migration:

1. Introduce `ava-sdk` as wrapper over existing Phoenix transport path.
2. Move consumers from `pi-orchestrator` Phoenix modules to AVA SDK APIs.
3. Replace ad-hoc local state with atom projection contract.
4. Remove compatibility imports and finalize hard cut.

Rollback:

- Feature flag to route to legacy adapters for one release window.
- Abort rollout if replay-ack conformance tests fail or event overflow metrics breach threshold.

## Research Questions

- What AVA-specific ergonomics justify a vertical package over pure generic transport?
- Which interfaces must remain generic to avoid lock-in?
- How do we phase extraction if AVA grows new stream families?

## Conformance Mapping (Checklist IDs)

- A Canonical references: **covered**
- B Boundary/topology: **covered**
- C React state provisions: **covered**
- D High-volume handling: **covered**
- E Replay/session correctness: **covered**
- F Reconnect/auth: **partially covered (auth delegated to HPX-001 token provider)**
- G Observability: **covered**
- H Migration/rollout: **covered**
- I Variant governance: **covered**
- J Evidence quality: **covered**

## Draft Acceptance

- AVA SDK API inventory complete.
- Coupling risks + exit strategy documented.
- Conformance checklist mapped, including high-volume stream policy.
