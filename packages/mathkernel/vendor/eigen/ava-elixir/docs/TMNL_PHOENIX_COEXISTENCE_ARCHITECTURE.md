# TMNL ↔ Phoenix/LiveView Coexistence Architecture

## Target Topology

- **BEAM app (`ava-elixir`)**
  - Phoenix Endpoint + UserSocket
  - Channel modules (`AvaEventChannel` etc.)
  - LiveView operator pages
  - PubSub as canonical event fanout
  - AVA control-plane bridge (Rustler)

- **TMNL desktop (Tauri + React)**
  - Phoenix socket client
  - Topic subscriptions for AVA events
  - Local state atoms/services consume channel pushes

## Data Flow

1. AVA event generated (Rustler/Elixir service)
2. Publish internal event on `Phoenix.PubSub` topic
3. Channel broadcasts to TMNL subscribers
4. LiveView processes receive `handle_info` on same topic
5. Both UIs stay in sync on shared envelope

## Event Envelope (v1)

```json
{
  "event_id": "01J...",
  "schema_version": 1,
  "event_type": "ava.artifact.updated",
  "workspace_id": "ws-1",
  "view_id": "view-42",
  "occurred_at": "2026-02-10T08:00:00Z",
  "payload": {"...": "..."}
}
```

## Topic Taxonomy

- `ava:workspace:<workspace_id>:events`
- `ava:workspace:<workspace_id>:presence`
- `ava:workspace:<workspace_id>:view:<view_id>`
- `ava:user:<user_id>:inbox`

## Authentication Strategy

- Client obtains short-lived channel token.
- TMNL connects with `authToken`.
- `UserSocket.connect/3` verifies token with `Phoenix.Token.verify/4`.
- Invalid token => `:error` (no channel join).

## Reliability Strategy

- Phoenix channels are realtime transport; add reconnect catchup:
  - Client sends `last_seen_event_id` on join
  - Server returns replay window before streaming live
- Keep sidecar rollback mode available (`AVA_RUNTIME_MODE=sidecar`).

## Security Strategy

- Enforce WSS in non-dev.
- Keep channel tokens short-lived.
- Keep TMNL capability scope minimal.
- Move away from permissive CSP posture before production rollout.

## Incremental Delivery

1. Scaffold Phoenix endpoint/socket/channel inside `ava-elixir`
2. Wire PubSub event bridge from AVA control-plane
3. Add minimal LiveView page consuming same topic
4. Add TMNL channel client and state wiring
5. Add reconnect/catchup and telemetry
