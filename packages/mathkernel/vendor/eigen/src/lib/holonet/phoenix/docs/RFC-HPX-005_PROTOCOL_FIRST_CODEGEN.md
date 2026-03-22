# RFC-HPX-005: Protocol-First Codegen Track

```text
RFC:           RFC-HPX-005
Status:        DRAFT
Track:         Variant C
Created:       2026-02-10
Depends On:    RFC-HPX-000/001/002
```

## Intent

Define a contract-first pipeline for TS + Elixir interoperability with explicit drift prevention.

## Normative References

- Phoenix JS client behavior: https://hexdocs.pm/phoenix/js/
- Phoenix wire framing guide: https://hexdocs.pm/phoenix/writing_a_channels_client.html
- Effect layers/services: https://effect.website/docs/requirements-management/layers/

## Scope

- Source-of-truth schema choice (Effect Schema / JSON Schema / proto strategy)
- Generated artifacts policy
- Versioning and compatibility checks
- CI drift gates

## Non-Negotiables

- Replay/session protocol remains authoritative (RFC-HPX-002).
- Generated types cannot bypass runtime validation.
- React surface remains atom-projected, not raw transport payloads.

## Atom Projection Contract

Generated code MUST support:

- validated decode for transport envelopes,
- reducer-safe domain payload types,
- projection DTOs for UI atoms (bounded views, no raw unbounded logs).

Codegen MUST NOT emit UI APIs that encourage raw stream-to-atom mirroring.

## Ingress / Overflow Policy

Codegen artifacts include machine-readable policy metadata per channel/event family:

- `overflowPolicy`: `suspend | sliding | dropping | fail-session`
- `maxBuffer`
- `criticality`

Runtime must enforce policy; CI conformance tests must prove policy behavior under stress.

## Replay Ack State Machine

Generated protocol contracts MUST include:

- join request with optional `last_seen_event_id`
- join response mode (`live | replay_required`)
- replay ack command + ack response union
- typed error union for ack timeout/reject/stale cursor

Invariant:

- Replay-required sessions cannot publish live-dispatch success until ack transition is completed.

## Observability Map

Generated observability schema should define standard fields for logs/metrics:

- spans: `connect`, `join`, `replay_apply`, `replay_ack`, `live_dispatch`
- counters: attempts/success/failure/replay-required/ack outcomes/drop/backpressure
- log keys: `topic`, `workspace_id`, `session_id`, `replay_session_id`, `cursor`, `error_code`

## Migration & Rollback

Migration path:

1. Introduce codegen in report-only mode (no hard gating).
2. Enable CI drift checks for generated artifacts.
3. Move runtime to generated contracts incrementally (join/replay first).
4. Enforce hard fail on drift only after two stable cycles.

Rollback:

- Disable hard CI drift gate and revert to handwritten schema path.
- Keep generated artifacts for diff audit during rollback.

## Research Questions

- Which source model best supports TS runtime decode + Elixir validation?
- How do we encode replay-ack invariants in generated contracts?
- What is the minimum viable codegen step before toolchain burden explodes?

## Conformance Mapping (Checklist IDs)

- A Canonical references: **covered**
- B Boundary/topology: **covered**
- C React state provisions: **covered**
- D High-volume handling: **covered**
- E Replay/session correctness: **covered**
- F Reconnect/auth: **partially covered (transport layer enforcement required)**
- G Observability: **covered**
- H Migration/rollout: **covered**
- I Variant governance: **covered**
- J Evidence quality: **covered**

## Draft Acceptance

- Toolchain recommendation with cost profile.
- Drift detection and release policy defined.
- Failure modes and fallback manual contract flow documented.
