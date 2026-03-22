# RFC-HPX-009: AVA Edge Gateway (Rustler-aware)

```text
RFC:           RFC-HPX-009
Status:        DRAFT
Track:         Variant G
Created:       2026-02-10
Depends On:    RFC-HPX-000/001/002
```

## Intent

Define a split where Elixir handles orchestration/session policy while Rust hot paths handle expensive AVA transformations with strict safety boundaries.

## Normative References

- Phoenix JS client behavior: https://hexdocs.pm/phoenix/js/
- Phoenix wire framing guide: https://hexdocs.pm/phoenix/writing_a_channels_client.html
- Effect layers/services: https://effect.website/docs/requirements-management/layers/

## Scope

- control-plane vs hot-path partitioning
- NIF/sidecar tradeoff and fallback policy
- scheduler safety and containment
- protocol consistency with client-facing replay/session model

## Safety Guardrails

- Dirty scheduler policy for blocking/high CPU NIF segments.
- Fallback path required when Rust path fails/degrades.
- Client protocol semantics must remain stable regardless of backend execution path.

## Partition Contract

- **Elixir control plane** owns:
  - auth, connect/join,
  - replay-required decision and ack,
  - session lifecycle + topic authorization.
- **Rust hot path** owns:
  - high-cost transform/aggregation steps,
  - optional artifact packing/stream shaping.

Client contract remains unchanged across both paths.

## Atom Projection Contract

- React atoms consume stable AVA projections, independent of whether backend execution came from NIF or sidecar.
- Raw hot-path payload bursts are reduced/windowed before entering UI atoms.

## Ingress / Overflow Policy

- Control channel ingress: bounded + suspend.
- Hot-path output ingress: bounded sliding with criticality tags.
- If hot-path cannot keep replay order guarantees, fail-session and recover via control-plane replay.

Counters:

- `edge_hotpath_drop_total`
- `edge_hotpath_fallback_total`
- `edge_control_replay_recovery_total`

## Replay Ack State Machine

```text
join(control) -> (live | replay_required)
replay_required -> replay_apply(control) -> awaiting_ack(control)
awaiting_ack -> enable_hotpath_output -> live
```

Rules:

- Hot-path output dispatch is blocked until replay ack success.
- Fallback from hot-path to sidecar/control path must preserve cursor continuity.

## Observability Map

Spans:

- `edge.control.join`
- `edge.control.replay.ack`
- `edge.hotpath.invoke`
- `edge.hotpath.fallback`
- `edge.live.dispatch`

Counters:

- hot-path invoke success/failure,
- fallback count,
- replay ack outcomes,
- dispatch drops/backpressure.

Logs include:

- `workspace_id`, `topic`, `session_id`, `replay_session_id`, `execution_mode(nif|sidecar|fallback)`, `event_id`, `error_code`.

## Migration & Rollback

Migration:

1. Keep sidecar-only baseline.
2. Enable Rust hot path for one AVA flow behind runtime flag.
3. Validate scheduler safety + replay conformance + failure containment.
4. Expand only after soak and rollback drills.

Rollback:

- Force `execution_mode=fallback` globally.
- Continue serving client contract via control-plane replay continuity.

## Research Questions

- Which AVA operations justify hot-path extraction?
- NIF vs sidecar criteria under reliability/perf constraints?
- How do we preserve observability and rollback simplicity across split runtime?

## Conformance Mapping (Checklist IDs)

- A Canonical references: **covered**
- B Boundary/topology: **covered**
- C React state provisions: **covered**
- D High-volume handling: **covered**
- E Replay/session correctness: **covered**
- F Reconnect/auth: **partially covered (control-plane ownership explicit)**
- G Observability: **covered**
- H Migration/rollout: **covered**
- I Variant governance: **covered**
- J Evidence quality: **covered**

## Draft Acceptance

- Partition decision framework documented.
- Safety and failure containment model explicit.
- Rollout and rollback criteria aligned to gate matrix.
