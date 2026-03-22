# RFC-HPX-007: Offline / Resilient Sync Client

```text
RFC:           RFC-HPX-007
Status:        DRAFT
Track:         Variant E
Created:       2026-02-10
Depends On:    RFC-HPX-000/001/002
```

## Intent

Define a client durability model for intermittent connectivity and crash-safe replay continuation.

## Normative References

- Phoenix JS client behavior: https://hexdocs.pm/phoenix/js/
- Phoenix wire framing guide: https://hexdocs.pm/phoenix/writing_a_channels_client.html
- Effect layers/services: https://effect.website/docs/requirements-management/layers/

## Scope

- local append-log/checkpoint storage
- replay resume semantics
- reconciliation strategy
- storage/privacy/retention bounds

## Guardrails

- Local event buffers must be bounded by policy.
- Sensitive token/auth material must never be persisted in plain logs.
- UI remains atom-projected summaries, not full unbounded local history.

## Atom Projection Contract

Offline-capable UI atoms expose:

- sync state (`online | offline | resyncing | failed`),
- replay checkpoint state,
- bounded reconciliation log window,
- conflict summary counters.

UI atoms MUST NOT expose raw full append log.

## Ingress / Overflow Policy

- Persisted append log: bounded by size + time retention.
- In-memory catch-up buffer: bounded sliding queue.
- If persistent log cap reached before successful sync, fail-session with explicit operator-visible error.

Counters:

- `offline_append_log_pruned_total`
- `offline_buffer_drop_total`
- `offline_sync_fail_session_total`

## Replay Ack State Machine

```text
online -> offline_buffering -> reconnecting -> replay_required?
replay_required -> apply_local_then_server_replay -> awaiting_ack -> live
awaiting_ack -> (live | failed)
```

Rules:

- Local buffered events are never considered committed until server replay ack is successful.
- Stale cursor path must enter explicit recovery (`reset_cursor` / full snapshot replay).

## Observability Map

Spans:

- `offline.mode.enter`
- `offline.reconnect`
- `offline.replay.apply`
- `offline.replay.ack`
- `offline.reconcile`

Counters:

- offline transitions, replay-required count, ack outcomes, stale-cursor count, reconciliation conflicts.

Logs include:

- `workspace_id`, `session_id`, `offline_duration_ms`, `checkpoint_id`, `last_seen_event_id`, `replay_session_id`, `error_code`.

## Migration & Rollback

Migration:

1. Introduce persistence in passive mode (checkpoint only, no resend).
2. Enable offline append log for selected tenant/workspace scopes.
3. Enable reconciliation + replay ack enforcement.
4. Expand only after retention/security review passes.

Rollback:

- Disable offline append log and revert to online-only replay model.
- Preserve last stable checkpoint to avoid data loss on rollback.

## Research Questions

- Which checkpoint granularity is sufficient for AVA consistency needs?
- How do we detect and resolve stale/rebased cursors after long offline periods?
- What retention policy balances forensic value vs storage/sensitivity risk?

## Conformance Mapping (Checklist IDs)

- A Canonical references: **covered**
- B Boundary/topology: **covered**
- C React state provisions: **covered**
- D High-volume handling: **covered**
- E Replay/session correctness: **covered**
- F Reconnect/auth: **partially covered (auth persistence explicitly prohibited)**
- G Observability: **covered**
- H Migration/rollout: **covered**
- I Variant governance: **covered**
- J Evidence quality: **covered**

## Draft Acceptance

- Durability lifecycle state machine documented.
- Reconciliation policy includes conflict classes and outcomes.
- Security + retention constraints reviewed and testable.
