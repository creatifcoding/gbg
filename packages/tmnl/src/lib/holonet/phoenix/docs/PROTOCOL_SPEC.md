# RFC-HPX-002: Holonet Phoenix Replay and Session Protocol

```text
RFC:           RFC-HPX-002
Title:         Holonet Phoenix Replay and Session Protocol
Status:        DRAFT
Author:        Val (architectural conscience)
Created:       2026-02-10
Target:        src/lib/holonet/phoenix
Depends On:    RFC-HPX-000, RFC-HPX-001
```

> This RFC defines the wire-level and lifecycle protocol for channel session,
> replay catch-up, acknowledgement, and transition to live event delivery.

---

## Table of Contents

1. [Scope](#hpxp1-scope)
2. [Conventions](#hpxp2-conventions)
3. [Normative References](#hpxp3-normative-references)
4. [Envelope Model](#hpxp4-envelope-model)
5. [Session Lifecycle](#hpxp5-session-lifecycle)
6. [Join and Replay Handshake](#hpxp6-join-and-replay-handshake)
7. [State Machine](#hpxp7-state-machine)
8. [Error Model](#hpxp8-error-model)
9. [Reconnect Semantics](#hpxp9-reconnect-semantics)
10. [Backpressure and Replay Window](#hpxp10-backpressure-and-replay-window)
11. [Conformance Tests](#hpxp11-conformance-tests)
12. [Security and Audit Notes](#hpxp12-security-and-audit-notes)

---

## HPXP.1 Scope

This protocol covers:

- client join payload and join response contract
- replay batch delivery and replay acknowledgement
- live event gating rules
- reconnect behavior and cursor continuity

It does not define business event taxonomy itself, only transport/session semantics.

---

## HPXP.2 Conventions

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**,
**SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** are interpreted per RFC 2119.

Protocol requirement IDs use the prefix **HPXP-REQ-**.

---

## HPXP.3 Normative References

- `[PHX-JS]` https://hexdocs.pm/phoenix/js/
- `[PHX-SOCKET-SRC]` https://github.com/phoenixframework/phoenix/blob/main/assets/js/phoenix/socket.js
- `[PHX-CHANNEL-SRC]` https://github.com/phoenixframework/phoenix/blob/main/assets/js/phoenix/channel.js
- `[PHX-CHANNELS-GUIDE]` https://hexdocs.pm/phoenix/channels.html
- `[PHX-WRITING-CLIENT]` https://hexdocs.pm/phoenix/writing_a_channels_client.html
- `[PHX-CHANNEL-API]` https://hexdocs.pm/phoenix/Phoenix.Channel.html

---

## HPXP.4 Envelope Model

### HPXP-REQ-001 (Canonical envelope fields)
All channel events consumed by `holonet/phoenix` MUST conform to:

```json
{
  "event_id": "evt-...",
  "schema_version": 1,
  "event_type": "ava.artifact.updated",
  "workspace_id": "ws-...",
  "occurred_at": "2026-02-10T19:00:00Z",
  "payload": {}
}
```

### HPXP-REQ-002 (Ordering key)
`event_id` and/or server-provided sequence metadata MUST provide deterministic
ordering for replay application.

### HPXP-REQ-003 (Idempotence key)
`event_id` MUST be stable across retransmission in replay windows.

---

## HPXP.5 Session Lifecycle

Client lifecycle phases:

1. socket connect
2. channel join with cursor
3. replay decision (`live` vs `replay_required`)
4. replay application (if required)
5. replay ack (if required)
6. live dispatch

### HPXP-REQ-004
Client MUST include a `client_session_id` for correlation on join and ack messages.

---

## HPXP.6 Join and Replay Handshake

## HPXP.6.1 Join request

Topic: implementation-defined (workspace scoped).

Join payload:

```json
{
  "last_seen_event_id": "evt-123",
  "client_session_id": "tmnl-abc",
  "replay_required": true
}
```

### HPXP-REQ-005
`last_seen_event_id` MAY be null/omitted when no cursor exists.

### HPXP-REQ-006
If provided, `last_seen_event_id` MUST be used by server replay policy.

## HPXP.6.2 Join success reply

Mode A (no replay):

```json
{
  "mode": "live",
  "requires_ack": false
}
```

Mode B (replay required):

```json
{
  "mode": "replay_required",
  "replay_session_id": "rpl-xyz",
  "events": [/* envelope[] */],
  "cursor": {
    "from": "evt-123",
    "to": "evt-140",
    "count": 17,
    "truncated": false
  },
  "requires_ack": true
}
```

### HPXP-REQ-007
If `requires_ack=true`, client MUST NOT emit live events to downstream consumers before ack success.

### HPXP-REQ-008
If `requires_ack=false`, client MAY enter live mode immediately after join success.

## HPXP.6.3 Replay acknowledgement

Client event: `replay_ack`

```json
{
  "replay_session_id": "rpl-xyz",
  "up_to_event_id": "evt-140",
  "client_session_id": "tmnl-abc"
}
```

Server ack response:

```json
{ "ok": true }
```

or

```json
{ "ok": false, "reason": "ack_rejected" }
```

### HPXP-REQ-009
Ack response MUST be explicit and machine-decodable.

### HPXP-REQ-010
On ack success, client MUST transition to live mode and flush buffered live events in order.

### HPXP-REQ-011
On ack rejection, client MUST enter failed state and require recovery path (`reconnectNow` or policy retry).

---

## HPXP.7 State Machine

```text
idle
  -> joining
joining
  -> live                    (join says mode=live)
  -> replay_required         (join says requires_ack=true)
  -> failed                  (join error/timeout)
replay_required
  -> replay_buffering_live   (replay batches begin)
replay_buffering_live
  -> awaiting_ack            (replay applied)
  -> failed                  (replay decode/apply failure)
awaiting_ack
  -> live                    (ack success)
  -> failed                  (ack timeout/reject)
live
  -> joining                 (disconnect/reconnect)
failed
  -> joining                 (manual reconnect or retry policy)
```

### HPXP-REQ-012
State transitions MUST be deterministic and observable (span/log/counter).

### HPXP-REQ-013
Buffered live events MUST preserve arrival ordering during post-ack flush.

---

## HPXP.8 Error Model

Protocol-level error codes (minimum):

- `join_timeout`
- `join_rejected`
- `replay_decode_failed`
- `replay_apply_failed`
- `replay_ack_timeout`
- `replay_ack_rejected`
- `cursor_stale`
- `auth_failed`

### HPXP-REQ-014
Errors MUST be typed at service boundary and include correlation metadata.

### HPXP-REQ-015
`cursor_stale` handling MUST be explicit: server policy must declare reset/rebase behavior.

---

## HPXP.9 Reconnect Semantics

### HPXP-REQ-016
Implementation MUST use Phoenix reconnect/rejoin semantics compatible with `[PHX-JS]` and upstream client behavior.

### HPXP-REQ-017
Automatic reconnect MUST use bounded backoff policy.

### HPXP-REQ-018
Manual reconnect trigger MUST be available and bypass passive waiting.

### HPXP-REQ-019
On reconnect, join MUST carry last committed cursor (`last_seen_event_id`) from local session state.

---

## HPXP.10 Backpressure and Replay Window

### HPXP-REQ-020
Server replay reply MUST include replay count and truncation signal.

### HPXP-REQ-021
If replay window is truncated, client MUST emit explicit warning/error event and follow policy (continue with warning or fail hard per config).

### HPXP-REQ-022
Client live buffer during replay MUST be bounded; overflow policy MUST be explicit (drop-oldest, drop-newest, fail-session).

---

## HPXP.11 Conformance Tests

Required conformance tests:

1. **Join live fast-path**: mode=live enters live without ack.
2. **Replay required path**: replay applied, ack sent, buffered live flushed post-ack.
3. **No-live-before-ack invariant**.
4. **Ack timeout path** enters failed.
5. **Ack reject path** enters failed.
6. **Reconnect with cursor continuity**.
7. **Stale cursor handling**.
8. **Replay truncation handling**.

### HPXP-REQ-023
Conformance suite MUST be part of CI for `holonet/phoenix` package changes.

---

## HPXP.12 Security and Audit Notes

### HPXP-REQ-024
Join and ack logs MUST include correlation identifiers and MUST NOT log raw auth tokens.

### HPXP-REQ-025
Replay session and cursor transitions MUST be audit-visible via structured logs/metrics.

### HPXP-REQ-026
Token verification remains server-side responsibility (`connect_info[:auth_token]` handling in Phoenix socket connect callback).
