# Conductor Chat V2 — Failure Copy + Severity Matrix v1

Owner: Val  
Date: 2026-02-10

## Severity Levels

- `S1 INFO` — transient, no user intervention required
- `S2 WARN` — degraded, recoverable in-session
- `S3 ERROR` — prompt/session failure requiring explicit action
- `S4 CRITICAL` — continuity break or repeated fatal instability

## Failure Mapping Matrix

| Severity | Trigger | Title | Body | Placement | CTA | Telemetry Key |
|---|---|---|---|---|---|---|
| S1 | delayed send acknowledgement | Message queued | Waiting for assistant stream… | Thread status row | none | `chat_v2_ack_pending` |
| S1 | reconnecting | Reconnecting | Restoring node session stream… | Composer status region | Retry now | `chat_v2_reconnecting` |
| S2 | websocket closed/fail | Connection lost | Live stream interrupted. Draft is preserved for this node. | Composer + inline banner | Reconnect | `chat_v2_transport_closed` |
| S2 | replay/snapshot sync active | Resyncing | Replaying missed events for this node… | Thread status row | none | `chat_v2_resyncing` |
| S3 | prompt execution failed | Send failed | Agent could not process this prompt. Try again or switch agent. | Inline error banner | Retry / Switch | `chat_v2_prompt_failed` |
| S3 | request timeout | Request timed out | Control plane did not respond in time. No message was sent. | Inline error banner | Retry | `chat_v2_request_timeout` |
| S3 | protocol decode issue | Sync format error | Received invalid payload. Session needs refresh. | Inline error banner | Reconnect | `chat_v2_protocol_decode` |
| S4 | session open fails | Session unavailable | Cannot open chat session for this node. | Persistent banner | Reconnect / Escalate | `chat_v2_session_open_failed` |
| S4 | repeated transport instability | Runtime unstable | Connection keeps dropping. Capture diagnostics and escalate. | Persistent banner + status rail | Copy diagnostics | `chat_v2_transport_unstable` |

## Copy Tokens

- `CHAT_ERR_PROMPT_FAILED_TITLE = "Send failed"`
- `CHAT_ERR_PROMPT_FAILED_BODY = "Agent could not process this prompt. Try again or switch agent."`
- `CHAT_ERR_TIMEOUT_TITLE = "Request timed out"`
- `CHAT_ERR_TIMEOUT_BODY = "Control plane did not respond in time. No message was sent."`
- `CHAT_ERR_OFFLINE_TITLE = "Connection lost"`
- `CHAT_ERR_OFFLINE_BODY = "Live stream interrupted. Draft is preserved for this node."`
- `CHAT_ERR_SESSION_TITLE = "Session unavailable"`
- `CHAT_ERR_SESSION_BODY = "Cannot open chat session for this node."`

## Placement Rules

1. Inline-first in thread/composer zones where action occurs.
2. Never leak node-local errors to other nodes.
3. Every `S2+` includes at least one recovery action.
4. Include correlation keys for S4 escalation flows.

## Acceptance Gates

- Every surfaced error maps to exactly one severity tier.
- Inline error UX remains stream-compatible (does not break thread render).
- Offline path preserves draft for that node.
