# RFC-HPX-001: Holonet Phoenix Library Implementation Contract

```text
RFC:           RFC-HPX-001
Title:         Holonet Phoenix Library Implementation Contract
Status:        DRAFT
Author:        Val (architectural conscience)
Created:       2026-02-10
Target:        src/lib/holonet/phoenix
Depends On:    RFC-HPX-000 (RESEARCH.md)
Companion:     PROTOCOL_SPEC.md
```

> This RFC defines the build contract for extracting Phoenix integration into a
> standalone library rooted at `src/lib/holonet/phoenix`.

---

## Table of Contents

1. [Scope](#hpx1-scope)
2. [Conventions](#hpx2-conventions)
3. [Normative References](#hpx3-normative-references)
4. [Architecture Requirements](#hpx4-architecture-requirements)
5. [Package Topology](#hpx5-package-topology)
6. [Service Contracts](#hpx6-service-contracts)
7. [Runtime Behavior Requirements](#hpx7-runtime-behavior-requirements)
8. [Observability Requirements](#hpx8-observability-requirements)
9. [Migration Requirements (Hard Cut)](#hpx9-migration-requirements-hard-cut)
10. [Validation Requirements](#hpx10-validation-requirements)
11. [Done Criteria](#hpx11-done-criteria)

---

## HPX.1 Scope

This contract governs:

- New Phoenix integration package under `src/lib/holonet/phoenix`
- Effect service and layer boundaries
- Replay-aware channel lifecycle
- Hard-cut migration from `pi-orchestrator` Phoenix modules

This document does not define all wire payload details; see `PROTOCOL_SPEC.md`.

---

## HPX.2 Conventions

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**,
**SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** are to be
interpreted as described in RFC 2119.

Requirement IDs in this document use the prefix **HPX-REQ-**.

---

## HPX.3 Normative References

### Phoenix client/runtime behavior
- `[PHX-JS]` https://hexdocs.pm/phoenix/js/
- `[PHX-SOCKET-SRC]` https://github.com/phoenixframework/phoenix/blob/main/assets/js/phoenix/socket.js
- `[PHX-CHANNEL-SRC]` https://github.com/phoenixframework/phoenix/blob/main/assets/js/phoenix/channel.js
- `[PHX-CHANNELS-GUIDE]` https://hexdocs.pm/phoenix/channels.html
- `[PHX-WRITING-CLIENT]` https://hexdocs.pm/phoenix/writing_a_channels_client.html
- `[PHX-CHANNEL-API]` https://hexdocs.pm/phoenix/Phoenix.Channel.html

### Effect / integration behavior
- `[EFFECT-LAYERS]` https://effect.website/docs/requirements-management/layers/
- `[EFFECT-GUIDE]` Effect docs MCP (Writing Effect Guide)
- `[EFFECT-ATOM]` https://github.com/tim-smart/effect-atom
- `[REACT-USESYNC]` https://react.dev/reference/react/useSyncExternalStore

---

## HPX.4 Architecture Requirements

### HPX-REQ-001 (Boundary)
`src/lib/holonet/phoenix/**` MUST NOT import from `src/lib/pi-orchestrator/**`.

### HPX-REQ-002 (Service-first)
Public runtime API MUST be defined via Effect services (`Context.Tag` or `Effect.Service`).

### HPX-REQ-003 (Layer composition)
Transport/auth/replay dependencies MUST be composed by `Layer`, not embedded as ad-hoc globals.

### HPX-REQ-004 (Schema locality)
Protocol schemas MUST live under `src/lib/holonet/phoenix/schemas`.

### HPX-REQ-005 (Replay gate)
Live event dispatch MUST be gated behind replay acknowledgement when replay is required.

### HPX-REQ-006 (No hidden fallback dependency)
Any compatibility shim MAY exist temporarily during migration, but final runtime path MUST exclusively use `holonet/phoenix`.

### HPX-REQ-033 (Atom authority for UI-consumed state)
State consumed by React/UI MUST use effect-atom as the canonical source (`Atom.make`, `Atom.family`, `Atom.runtime` facades).
Service-side `Ref`/`SubscriptionRef` mirrors MUST NOT be used as the primary UI state model.

### HPX-REQ-034 (SubscriptionRef scope)
`SubscriptionRef` MAY be used only for headless service-internal coordination where multiple fibers need both:

1. current value access, and
2. a continuous changes stream.

### HPX-REQ-035 (SubscriptionRef approved domains)
If `SubscriptionRef` is introduced, it MUST be limited to runtime internals such as:

- Phoenix transport lifecycle phase,
- replay gate progression (e.g., replay-required → ack → live),
- reconnect policy/attempt state,
- auth/session health state.

`SubscriptionRef` MUST NOT be exposed as the direct React state surface.

---

## HPX.5 Package Topology

Required structure:

```text
src/lib/holonet/phoenix/
  index.ts
  schemas/
    envelope.ts
    protocol.ts
    errors.ts
  services/
    PhoenixChannelService.ts
    PhoenixAuthTokenProvider.ts
    PhoenixReplayCoordinator.ts
  transport/
    PhoenixJsTransport.ts
  atoms/
    index.ts                 # optional facades only
  docs/
    RESEARCH.md
    IMPLEMENTATION_CONTRACT.md
    PROTOCOL_SPEC.md
```

### HPX-REQ-007 (Transport responsibility)
`PhoenixJsTransport` MUST wrap canonical Phoenix JS behavior; it MUST NOT reimplement alternative channel semantics that contradict `[PHX-JS]` or upstream client source.

---

## HPX.6 Service Contracts

### HPX.6.1 `PhoenixAuthTokenProvider`

### HPX-REQ-008
MUST expose token acquisition as Effect API returning `{ token, expiresAtMs }` or typed failure.

### HPX-REQ-009
MUST source token from existing TMNL auth service.

### HPX-REQ-010
v1 policy is on-demand refresh only (per questionnaire lock).

### HPX.6.2 `PhoenixReplayCoordinator`

### HPX-REQ-011
MUST model replay lifecycle states explicitly (idle/joining/replay/ack/live/failed).

### HPX-REQ-012
MUST buffer live events while replay gate is unresolved.

### HPX-REQ-013
MUST expose deterministic transition on ack success/failure/timeout.

### HPX.6.3 `PhoenixChannelService`

### HPX-REQ-014
MUST expose Effect operations for `connect`, `disconnect`, `reconnectNow`, `publish`, and `ping`.

### HPX-REQ-015
MUST expose event stream as Effect stream surface.

### HPX-REQ-016
MUST integrate reconnect auto behavior and manual reconnect override.

---

## HPX.7 Runtime Behavior Requirements

### HPX-REQ-017 (Auth token pass-through)
Socket creation MUST use `authToken` semantics aligned with `[PHX-JS]` and `[PHX-SOCKET-SRC]`.

### HPX-REQ-018 (Join semantics)
Join flow MUST use `channel.join().receive("ok"|"error"|"timeout")` semantics.

### HPX-REQ-019 (Rejoin params)
Channel params MUST support cursor updates (`last_seen_event_id`) and be rejoin-safe.

### HPX-REQ-020 (Push discipline)
Service MUST enforce join-before-push behavior consistent with upstream channel client behavior.

### HPX-REQ-021 (Replay continuity)
Given Phoenix at-most-once delivery, service MUST implement application-level replay strategy as defined in `PROTOCOL_SPEC.md`.

---

## HPX.8 Observability Requirements

### HPX-REQ-022 (Spans)
The following spans are REQUIRED:

- `holonet.phoenix.connect`
- `holonet.phoenix.join`
- `holonet.phoenix.replay.apply`
- `holonet.phoenix.replay.ack`
- `holonet.phoenix.live.dispatch`
- `holonet.phoenix.reconnect.auto`
- `holonet.phoenix.reconnect.manual`

### HPX-REQ-023 (Counters)
At minimum:

- `phoenix_connect_attempt_total`
- `phoenix_connect_success_total`
- `phoenix_connect_failure_total`
- `phoenix_rejoin_total`
- `phoenix_replay_required_total`
- `phoenix_replay_ack_success_total`
- `phoenix_replay_ack_failure_total`
- `phoenix_live_event_buffered_total`
- `phoenix_live_event_dispatched_total`

### HPX-REQ-024 (Structured logs)
Logs MUST include correlation/context fields:

- `workspace_id`, `topic`, `client_session_id`, `replay_session_id`, `last_seen_event_id`, `event_id`, `correlation_id`

---

## HPX.9 Migration Requirements (Hard Cut)

### HPX-REQ-025
Consumers MUST migrate off:

- `src/lib/pi-orchestrator/client/PhoenixChannelClient.ts`
- `src/lib/pi-orchestrator/client/PhoenixChannelAuth.ts`
- `src/lib/pi-orchestrator/services/PhoenixEventDispatcher.ts`

### HPX-REQ-026
Final runtime MUST remove legacy Phoenix integration from active orchestrator path.

### HPX-REQ-027 (Boundary audit)
The following checks MUST pass in final state:

```bash
rg -n "pi-orchestrator/client/Phoenix|pi-orchestrator/services/Phoenix" src
rg -n "from '@/lib/pi-orchestrator'" src/lib/holonet/phoenix
```

Expected: zero runtime dependency leaks.

---

## HPX.10 Validation Requirements

### HPX-REQ-028 (Unit)
Replay state transitions MUST be covered by deterministic unit tests.

### HPX-REQ-029 (Integration)
Reconnect + replay-required + ack path MUST have integration tests.

### HPX-REQ-030 (Negative)
Ack reject/timeout and stale cursor paths MUST be tested.

### HPX-REQ-031 (Invariant)
Test MUST prove no live event dispatch occurs before replay ack.

### HPX-REQ-032 (Manual override)
Manual reconnect trigger MUST be tested.

### HPX-REQ-036 (State model conformance)
Tests and/or static checks MUST verify that UI-facing holonet Phoenix state is atom-backed and that `SubscriptionRef` (if present) remains internal to service coordination boundaries.

### HPX-REQ-037 (High-volume event stream handling)
High-volume payload ingress MUST be handled in stream/queue primitives (`Stream`, `Queue`, or `PubSub`) with explicit overflow policy.
Raw ingress streams MUST NOT be mirrored 1:1 into React-facing atoms.

### HPX-REQ-038 (React projection boundary)
React-facing atoms MUST expose bounded, consumption-ready projections (e.g., reduced state, windowed/ring-buffered logs, counters, health summaries), not unbounded raw event payload history.

### HPX-REQ-039 (Backpressure policy declaration)
Implementations handling high event volume MUST declare and test one of:

- bounded + suspend/backpressure,
- sliding (drop-oldest),
- dropping (drop-newest),
- fail-session.

Selected policy MUST be observable via counters/logs.

---

## HPX.11 Done Criteria

This RFC is satisfied only when all are true:

1. `holonet/phoenix` is sole runtime Phoenix integration boundary.
2. Strict replay-ack gating is enforced and tested.
3. Existing TMNL auth service is the token source.
4. Reconnect auto + manual paths are validated.
5. Observability requirements are implemented.
6. Boundary audit commands are clean.
7. Documentation under `src/lib/holonet/phoenix/docs` is coherent and current.
8. State model policy is enforced: atom-backed UI surfaces, `SubscriptionRef` only for approved headless coordination domains.
9. High-volume ingress path is stream/queue-based with explicit tested backpressure/overflow policy and bounded React-facing projections.
