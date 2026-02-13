# RFC-HPX-006: Dual-Plane Client Model

```text
RFC:           RFC-HPX-006
Status:        DRAFT
Track:         Variant D
Created:       2026-02-10
Depends On:    RFC-HPX-000/001/002
```

## Intent

Split client communication into control-plane (Phoenix) and data-plane (high-throughput transport) for AVA scale.

## Normative References

- Phoenix JS client behavior: https://hexdocs.pm/phoenix/js/
- Phoenix wire framing guide: https://hexdocs.pm/phoenix/writing_a_channels_client.html
- Effect layers/services: https://effect.website/docs/requirements-management/layers/

## Scope

- Plane partitioning rules
- Cursor and replay ownership
- Failure containment boundaries
- Cross-plane observability coherence

## Baseline Assumption

Phoenix channels remain authoritative for session orchestration and replay gating; heavy payload transfer may be delegated.

## Partition Matrix (v0)

- **Control plane (Phoenix)**:
  - connect/join/rejoin,
  - replay-required decision + ack gate,
  - control commands and heartbeats.
- **Data plane (stream transport)**:
  - high-cardinality payload transfer,
  - large artifact/result chunks,
  - bulk updates where channel framing becomes bottleneck.

## Atom Projection Contract

- React atoms consume merged projections from both planes via deterministic reducer.
- No raw data-plane burst stream may be directly mounted as UI atom history.
- UI receives bounded slices + summaries; full payload replay remains service-side.

## Ingress / Overflow Policy

- Control plane: bounded + suspend (correctness first).
- Data plane: bounded + sliding or dropping (configurable by stream criticality).
- If cross-plane coherence cannot be guaranteed (e.g., replay gap), fail-session and require reconnect/replay.

Counters:

- `dual_plane_control_backpressure_total`
- `dual_plane_data_drop_total`
- `dual_plane_coherence_fail_total`

## Replay Ack State Machine

```text
control.join -> (live | replay_required)
replay_required -> apply_replay(control) -> awaiting_ack(control)
awaiting_ack -> enable_data_plane_dispatch -> live
```

Rules:

- Data-plane dispatch to UI is blocked until control-plane replay ack success.
- Reconnect uses control-plane cursor continuity; data-plane session keys refresh after control live transition.

## Observability Map

Spans:

- `dual.control.connect`
- `dual.control.join`
- `dual.control.replay.ack`
- `dual.data.stream.start`
- `dual.data.dispatch`
- `dual.reconnect`

Counters:

- control attempts/failures/replay-required/ack outcomes
- data stream open/close/drop/backpressure
- cross-plane coherence faults

Logs include:

- `workspace_id`, `topic`, `control_session_id`, `data_session_id`, `last_seen_event_id`, `event_id`, `coherence_state`

## Migration & Rollback

Migration:

1. Keep current single-plane path as baseline.
2. Introduce data-plane behind feature flag for selected AVA topics.
3. Enable dual-plane reducer projections with conformance tests.
4. Expand scope only after soak metrics clear.

Rollback:

- Disable data-plane flag and keep control-plane only.
- Preserve cursor and replay continuity on fallback.

## Research Questions

- Which AVA workloads belong to control plane vs data plane?
- How do we preserve ordering and consistency across planes?
- What happens when one plane degrades and the other remains healthy?

## Conformance Mapping (Checklist IDs)

- A Canonical references: **covered**
- B Boundary/topology: **covered**
- C React state provisions: **covered**
- D High-volume handling: **covered**
- E Replay/session correctness: **covered**
- F Reconnect/auth: **partially covered (auth policy delegated to HPX-001)**
- G Observability: **covered**
- H Migration/rollout: **covered**
- I Variant governance: **covered**
- J Evidence quality: **covered**

## Draft Acceptance

- Partition matrix with explicit examples.
- Error recovery paths for partial plane failures.
- Stream policy + bounded UI projection requirements mapped.
