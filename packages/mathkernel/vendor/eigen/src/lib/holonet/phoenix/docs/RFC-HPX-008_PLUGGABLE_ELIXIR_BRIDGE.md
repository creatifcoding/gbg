# RFC-HPX-008: Pluggable Elixir Bridge

```text
RFC:           RFC-HPX-008
Status:        DRAFT
Track:         Variant F
Created:       2026-02-10
Depends On:    RFC-HPX-000/001/002
```

## Intent

Define a capability-oriented bridge for multiple Elixir-facing transports (Phoenix, Absinthe, SSE, etc.) while preserving protocol discipline.

## Normative References

- Phoenix JS client behavior: https://hexdocs.pm/phoenix/js/
- Phoenix wire framing guide: https://hexdocs.pm/phoenix/writing_a_channels_client.html
- Effect layers/services: https://effect.website/docs/requirements-management/layers/

## Scope

- capability interface (`connect`, `join`, `push`, `requestReplay`, `ackReplay`, `health`)
- adapter lifecycle and error model
- compatibility with `holonet/phoenix` as first-class adapter

## Anti-Abstraction Guardrails

- Do not erase transport-specific semantics needed for correctness.
- New adapter must justify itself with measurable value.
- Core capability layer must remain minimal and testable.

## Capability Contract

Core interface must include:

- lifecycle ops: `connect`, `disconnect`, `reconnectNow`
- channel/session ops: `join`, `leave`, `push`
- replay ops: `requestReplay`, `ackReplay`
- health/telemetry hooks.

Each adapter declares a conformance profile:

- join semantics,
- replay support level,
- overflow policy,
- reconnect behavior,
- auth capabilities.

## Atom Projection Contract

- Adapter outputs are normalized into a shared projection model consumed by atoms.
- UI atoms remain transport-agnostic and bounded.
- Adapter-specific raw frame formats stay internal.

## Ingress / Overflow Policy

Every adapter MUST declare one explicit overflow mode:

- `suspend` (bounded backpressure),
- `sliding`,
- `dropping`,
- `fail-session`.

Conformance tests must validate each adapter’s declared mode under load.

## Replay Ack State Machine

A minimum replay contract is mandatory for adapters that claim replay support:

```text
join -> (live | replay_required)
replay_required -> replay_apply -> awaiting_ack -> (live | failed)
```

Adapters lacking replay support must explicitly declare `replay: unsupported` and cannot be used for replay-required channels.

## Observability Map

Spans:

- `bridge.adapter.connect`
- `bridge.adapter.join`
- `bridge.adapter.replay.apply`
- `bridge.adapter.replay.ack`
- `bridge.adapter.dispatch`

Counters:

- per-adapter connect/reconnect failures,
- per-adapter overflow/drop totals,
- replay-required + ack outcome totals.

Logs include:

- `adapter_id`, `workspace_id`, `topic`, `session_id`, `replay_session_id`, `event_id`, `error_code`.

## Migration & Rollback

Migration:

1. Introduce bridge with Phoenix adapter only.
2. Prove parity with existing holonet/phoenix behavior.
3. Add second adapter only after utility case is validated.
4. Keep adapter admission checklist strict.

Rollback:

- Disable non-Phoenix adapters by config.
- Route all sessions through Phoenix adapter baseline.

## Research Questions

- Which capabilities are truly universal vs adapter-specific?
- What extension points avoid dependency inversion chaos?
- How do we keep replay and state invariants consistent across adapters?

## Conformance Mapping (Checklist IDs)

- A Canonical references: **covered**
- B Boundary/topology: **covered**
- C React state provisions: **covered**
- D High-volume handling: **covered**
- E Replay/session correctness: **covered**
- F Reconnect/auth: **covered at capability profile level**
- G Observability: **covered**
- H Migration/rollout: **covered**
- I Variant governance: **covered**
- J Evidence quality: **covered**

## Draft Acceptance

- Capability model and adapter contract finalized.
- Guardrails for abstraction creep documented.
- Migration implications for existing Phoenix path explicit.
