# RFC-HPX Conformance Checklist

Use this checklist for RFC-HPX-003 through RFC-HPX-010.

## A. Canonical Reference Compliance

- [ ] Phoenix JS behavior sourced from official docs + upstream source.
- [ ] Writing-a-client wire semantics included (`join_ref`, `ref`, heartbeat, topic/event/payload framing).
- [ ] Effect service/layer guidance cited for boundary composition.

## B. Boundary and Topology

- [ ] No forbidden dependency from `src/lib/holonet/phoenix/**` to `src/lib/pi-orchestrator/**`.
- [ ] Services are explicit (`Context.Tag`/`Effect.Service`) and layer-composed.
- [ ] Schema ownership is local and versioned.

## C. React-Consumed State Provisions

- [ ] React-facing state uses effect-atom as canonical authority.
- [ ] UI atoms expose bounded projections only (reduced/windowed/ring-buffered).
- [ ] No raw event ingress mirrored directly into atoms.

## D. High-Volume Event Payload Handling

- [ ] Ingress path uses `Stream`/`Queue`/`PubSub`.
- [ ] Overflow policy declared: suspend | sliding | dropping | fail-session.
- [ ] Overflow/backpressure behavior is observable via counters and logs.
- [ ] Policy behavior is test-covered under stress.

## E. Replay / Session Correctness

- [ ] Join supports `last_seen_event_id` / cursor continuity semantics.
- [ ] Replay-required path buffers live events until ack success.
- [ ] No-live-before-ack invariant is explicit and test-proven.
- [ ] Ack timeout/reject/stale-cursor paths are defined and tested.

## F. Reconnect and Auth

- [ ] Auto reconnect with bounded backoff is defined.
- [ ] Manual reconnect override path exists.
- [ ] Auth token flow uses TMNL auth service and avoids token leakage in logs.

## G. Observability

- [ ] Span map defined for connect/join/replay/ack/live/reconnect.
- [ ] Counter map defined for attempts, failures, replay gates, buffering, dispatch.
- [ ] Structured logs include correlation/session/cursor fields.

## H. Migration / Rollout

- [ ] Hard-cut migration path is explicit (legacy modules identified).
- [ ] Compatibility shims (if any) are time-boxed with removal criteria.
- [ ] Rollback and fallback strategy documented.

## I. Variant-Specific Governance

- [ ] Variant-specific risks and anti-goals documented.
- [ ] Complexity budget called out.
- [ ] Clear acceptance criteria and failure/kill criteria defined.

## J. Evidence Quality

- [ ] Claims are citation-backed (repo files, official docs).
- [ ] Assumptions and unknowns are listed explicitly.
- [ ] Final recommendation is matrix-based (not preference-based).
