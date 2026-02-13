# RFC-HPX-000: Holonet Phoenix Research Baseline

```text
RFC:           RFC-HPX-000
Title:         Holonet Phoenix Research Baseline
Status:        DRAFT
Author:        Val (architectural conscience)
Created:       2026-02-10
Target:        src/lib/holonet/phoenix
Supersedes:    N/A
Depends On:    N/A
Companion:     IMPLEMENTATION_CONTRACT.md
               PROTOCOL_SPEC.md
```

> This document is the research baseline for building a standalone Phoenix
> integration library at `src/lib/holonet/phoenix`. It identifies canonical
> references, verified behavior, and constraints that MUST inform design and
> implementation.

---

## Table of Contents

1. [Scope](#hpxr1-scope)
2. [Conventions](#hpxr2-conventions)
3. [Canonical Reference Set](#hpxr3-canonical-reference-set)
4. [Phoenix Findings](#hpxr4-phoenix-findings)
5. [Effect Findings](#hpxr5-effect-findings)
6. [effect-atom Findings](#hpxr6-effect-atom-findings)
7. [React Findings](#hpxr7-react-findings)
8. [Repo Grounding](#hpxr8-repo-grounding)
9. [Research-Derived Constraints](#hpxr9-research-derived-constraints)
10. [Open Questions](#hpxr10-open-questions)
11. [Bibliography](#hpxr11-bibliography)

---

## HPXR.1 Scope

This research covers:

- Phoenix JS socket/channel behavior relevant to reconnect, rejoin, auth, and join/reply semantics.
- Effect service/layer architecture requirements for runtime boundaries.
- effect-atom state integration patterns for consumer surfaces.
- React external subscription constraints for realtime stores.
- Current TMNL codebase placement and migration implications.

This research does NOT define final wire protocol details; see `PROTOCOL_SPEC.md`.

---

## HPXR.2 Conventions

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**,
**SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** are to be
interpreted as described in RFC 2119.

Requirement IDs in this document use the prefix **HPXR-**.

---

## HPXR.3 Canonical Reference Set

### HPXR.3.1 Fully compliant Phoenix client references (normative)

The implementation MUST treat the following as canonical for Phoenix client behavior:

1. **Phoenix JS API docs** (`[PHX-JS]`)
   - https://hexdocs.pm/phoenix/js/
2. **Phoenix upstream client source: Socket** (`[PHX-SOCKET-SRC]`)
   - https://github.com/phoenixframework/phoenix/blob/main/assets/js/phoenix/socket.js
3. **Phoenix upstream client source: Channel** (`[PHX-CHANNEL-SRC]`)
   - https://github.com/phoenixframework/phoenix/blob/main/assets/js/phoenix/channel.js
4. **Phoenix Channels guide** (`[PHX-CHANNELS-GUIDE]`)
   - https://hexdocs.pm/phoenix/channels.html
5. **Writing a Channels Client** (`[PHX-WRITING-CLIENT]`)
   - https://hexdocs.pm/phoenix/writing_a_channels_client.html
6. **Phoenix.Channel callback API** (`[PHX-CHANNEL-API]`)
   - https://hexdocs.pm/phoenix/Phoenix.Channel.html

### HPXR.3.2 Effect / effect-atom / React references

- Effect Layers guidance (`[EFFECT-LAYERS]`):
  - https://effect.website/docs/requirements-management/layers/
- Effect docs guide (MCP, writing services/observability) (`[EFFECT-GUIDE]`)
- effect-atom repository/docs (`[EFFECT-ATOM]`):
  - https://github.com/tim-smart/effect-atom
- React external store contract (`[REACT-USESYNC]`):
  - https://react.dev/reference/react/useSyncExternalStore

---

## HPXR.4 Phoenix Findings

### HPXR.4.1 Socket options and auth

**HPXR-01**: Phoenix JS Socket supports `authToken` and exposes it to server-side
`connect_info[:auth_token]` when endpoint socket auth token support is enabled.

Source: `[PHX-JS]`, `[PHX-CHANNELS-GUIDE]`, `[PHX-SOCKET-SRC]`.

### HPXR.4.2 Reconnect and rejoin behavior

**HPXR-02**: Phoenix client natively supports reconnect/rejoin timers through
`reconnectAfterMs` and `rejoinAfterMs`.

**HPXR-03**: Channel rejoin is automatic on socket recovery and channel error paths.

Source: `[PHX-JS]`, `[PHX-SOCKET-SRC]`, `[PHX-CHANNEL-SRC]`.

### HPXR.4.3 Join/reply semantics

**HPXR-04**: Server `join/3` may return `{:ok, reply, socket}` and the client
receives that payload through `channel.join().receive("ok", payload)`.

Source: `[PHX-CHANNEL-API]`, `[PHX-CHANNELS-GUIDE]`.

### HPXR.4.4 Rejoin params and replay cursors

**HPXR-05**: Channel params are part of join semantics and rejoin flows can carry
updated params (suitable for replay cursors such as `last_seen_event_id`).

Source: `[PHX-JS]`, `[PHX-CHANNELS-GUIDE]`.

### HPXR.4.5 Reliability model

**HPXR-06**: Phoenix delivery is at-most-once for server->client channel pushes.
If stronger guarantees are needed, application-level replay/catch-up logic is required.

Source: `[PHX-CHANNELS-GUIDE]`.

---

## HPXR.5 Effect Findings

### HPXR.5.1 Service boundaries

**HPXR-07**: Runtime boundaries SHOULD be represented as Effect services (`Context.Tag`
or `Effect.Service`), with construction and dependency graph managed by `Layer`.

Source: `[EFFECT-LAYERS]`, `[EFFECT-GUIDE]`.

### HPXR.5.2 Dependency leakage prohibition

**HPXR-08**: Service interfaces MUST NOT leak construction dependencies. Dependencies
belong in layer composition.

Source: `[EFFECT-LAYERS]`.

### HPXR.5.3 Observability baseline

**HPXR-09**: Connect/join/replay/dispatch paths SHOULD be span-wrapped with
`Effect.withSpan` and structured logging annotations.

Source: `[EFFECT-GUIDE]`.

---

## HPXR.6 effect-atom Findings

**HPXR-10**: `Atom.runtime(layer)` is the canonical bridge from Effect layer graphs
into reactive consumer state.

**HPXR-11**: `Atom.family` is the canonical keyed state partition strategy.

**HPXR-12**: `Atom.keepAlive` SHOULD be used where state continuity across unmount is
required.

Source: `[EFFECT-ATOM]`.

---

## HPXR.7 React Findings

**HPXR-13**: Realtime external sources SHOULD follow `useSyncExternalStore`
subscription semantics:

- stable `subscribe`
- immutable/cached `getSnapshot`
- deterministic updates

Source: `[REACT-USESYNC]`.

---

## HPXR.8 Repo Grounding

### HPXR.8.1 Existing Phoenix placement (current state)

- `src/lib/pi-orchestrator/client/PhoenixChannelClient.ts`
- `src/lib/pi-orchestrator/client/PhoenixChannelAuth.ts`
- `src/lib/pi-orchestrator/services/PhoenixEventDispatcher.ts`

Observation: class adapter + utility modules, not an Effect-first boundary.

### HPXR.8.2 Server counterpart

- `ava-elixir/lib/ava_elixir_web/user_socket.ex`
- `ava-elixir/lib/ava_elixir_web/channels/ava_event_channel.ex`
- `ava-elixir/docs/TMNL_PHOENIX_COEXISTENCE_ARCHITECTURE.md`

Observation: auth and topic plumbing exist; strict replay-ack lifecycle is not yet fully codified.

### HPXR.8.3 Existing Atom-as-State precedent

- `src/components/testbed/conductor/agent-chat-stx.ts` uses `Atom.family` + `Atom.keepAlive` + `Atom.runtime`.

### HPXR.8.4 Existing Effect service precedent

- `src/lib/pi-orchestrator/contracts/PiAgentOrchestrator.ts`
- `src/lib/pi-orchestrator/client/PiRemoteOrchestrator.ts`

Observation: strong precedent for `Context.Tag` + `Layer.scoped` runtime surfaces.

---

## HPXR.9 Research-Derived Constraints

**HPXR-14**: New package `src/lib/holonet/phoenix` MUST treat `[PHX-JS]` + upstream
source files as canonical client behavior references.

**HPXR-15**: New package MUST NOT import from `src/lib/pi-orchestrator/**`.

**HPXR-16**: Replay continuity MUST be implemented as application-layer protocol,
not assumed from Phoenix transport guarantees.

**HPXR-17**: Reconnect policy MUST support both automatic backoff and manual
operator-triggered reconnect.

**HPXR-18**: Auth token acquisition MUST be sourced from existing TMNL auth service.

**HPXR-19**: React-consumed state SHOULD expose reduced/bounded projections while high-volume ingress remains in stream/queue primitives with explicit overflow policy.

---

## HPXR.10 Open Questions

1. Ack event naming and server-side acknowledgement payload contract.
2. Replay window bounds and truncation policy.
3. Cursor invalidation behavior when server history has compacted past cursor.
4. On-demand token refresh latency budget during reconnect storms.

---

## HPXR.11 Bibliography

- **[PHX-JS]** Phoenix JavaScript client docs — https://hexdocs.pm/phoenix/js/
- **[PHX-SOCKET-SRC]** Phoenix `socket.js` — https://github.com/phoenixframework/phoenix/blob/main/assets/js/phoenix/socket.js
- **[PHX-CHANNEL-SRC]** Phoenix `channel.js` — https://github.com/phoenixframework/phoenix/blob/main/assets/js/phoenix/channel.js
- **[PHX-CHANNELS-GUIDE]** Phoenix Channels guide — https://hexdocs.pm/phoenix/channels.html
- **[PHX-WRITING-CLIENT]** Writing a Channels Client — https://hexdocs.pm/phoenix/writing_a_channels_client.html
- **[PHX-CHANNEL-API]** Phoenix.Channel API — https://hexdocs.pm/phoenix/Phoenix.Channel.html
- **[EFFECT-LAYERS]** Effect Layers docs — https://effect.website/docs/requirements-management/layers/
- **[EFFECT-GUIDE]** Effect docs MCP: Writing Effect Guide
- **[EFFECT-ATOM]** effect-atom repo/docs — https://github.com/tim-smart/effect-atom
- **[REACT-USESYNC]** React `useSyncExternalStore` — https://react.dev/reference/react/useSyncExternalStore
