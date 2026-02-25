# AVA Contract Matrix (NATS-first, `view_id` canonical)

Status: Draft v1  
Scope: TS AVA v2 (`src/lib/ava`) ↔ Elixir AVA (`ava-elixir`) merge seam  
Decision anchor: fast integration, NATS-first runtime, snake_case command payloads

---

## 1) Canonical decisions

1. **Transport target (runtime):** NATS subjects under `tmnl.ava.*`.
2. **Command payload casing:** snake_case (`view_id`) is canonical.
3. **Bridge role:** Elixir AVA bridge must map Phoenix channel/event envelope to NATS subject model and back.
4. **UI runtime path:** TS AVA v2 atoms/hooks are primary consumer path.

---

## 2) Subject and topic map

## 2.1 TS AVA v2 subjects (current)

| Intent | Subject template (before prefix) | Effective subject (default prefix) | TS source |
|---|---|---|---|
| Artifact stream (single view) | `artifacts.{viewId}` | `tmnl.ava.artifacts.{viewId}` | `src/lib/ava/services/AvaClientV2.ts` |
| Artifact stream (all) | `artifacts.*` | `tmnl.ava.artifacts.*` | same |
| Delta stream (single view) | `deltas.{viewId}` | `tmnl.ava.deltas.{viewId}` | same |
| Delta stream (all) | `deltas.*` | `tmnl.ava.deltas.*` | same |
| Status stream (all) | `status.*` | `tmnl.ava.status.*` | same |
| Status stream (single view) | `status.{viewId}` | `tmnl.ava.status.{viewId}` | same |
| Invalidate command | `invalidate.{viewId}` | `tmnl.ava.invalidate.{viewId}` | same |
| Subscribe command | `subscribe.{viewId}` | `tmnl.ava.subscribe.{viewId}` | same |
| Unsubscribe command | `unsubscribe.{viewId}` | `tmnl.ava.unsubscribe.{viewId}` | same |

Subject prefix behavior is enforced in `src/lib/ava/services/NatsClient.ts` (`buildSubject`).

## 2.2 Elixir AVA Phoenix topics/events (current)

| Intent | Phoenix shape | Elixir source |
|---|---|---|
| Workspace event topic | `ava:workspace:{workspace_id}:events` | `ava-elixir/lib/ava_elixir/channel_topics.ex` |
| Presence topic | `ava:workspace:{workspace_id}:presence` | same |
| User inbox topic | `ava:user:{user_id}:inbox` | same |
| Channel route | `"ava:*"` | `ava-elixir/lib/ava_elixir_web/user_socket.ex` |
| Inbound channel event | `"publish"` with `%{"event" => envelope}` | `ava-elixir/lib/ava_elixir_web/channels/ava_event_channel.ex` |
| Outbound channel event | `"ava_event"` | same |

---

## 3) Canonical envelope contract (bridge-facing)

Elixir envelope requires:
- `event_id`
- `schema_version`
- `event_type`
- `workspace_id`
- `occurred_at`
- `payload`

Source: `ava-elixir/lib/ava_elixir/event_envelope.ex`

### Bridge rule
- **NATS stream messages** MAY carry payload-native forms for TS decoders.
- **Elixir↔Phoenix boundary** MUST validate against required envelope keys above.

---

## 4) Command contract (canonical)

Canonical payload form for all AVA command messages:

```json
{
  "view_id": "<string>",
  "reason": "<string?>",
  "force": false
}
```

Required by command type:
- `invalidate`: `view_id`, optional `reason`, optional `force` (default `false`)
- `subscribe`: `view_id`
- `unsubscribe`: `view_id`

TS evidence: `src/lib/ava/services/AvaClientV2.ts` and `src/lib/ava/__tests__/ava-v2-services.test.ts`.

---

## 5) Mapping rules for Elixir NATS bridge (proposed)

| Direction | Rule |
|---|---|
| NATS command → Elixir | `tmnl.ava.invalidate.{viewId}` / `subscribe` / `unsubscribe` mapped to AVA runtime ops keyed by `view_id` |
| Elixir event → NATS artifact | AVA artifact updates published on `tmnl.ava.artifacts.{view_id}` |
| Elixir event → NATS delta | delta updates published on `tmnl.ava.deltas.{view_id}` |
| Elixir state/event → NATS status | lifecycle/status events published on `tmnl.ava.status.{view_id}` or wildcard fanout |
| Phoenix publish → NATS | validated envelope is projected to NATS message + subject routing |
| NATS ingress → Phoenix | bridge synthesizes envelope fields when forwarding to Phoenix consumers |

---

## 6) Non-negotiable invariants

1. **No mixed casing drift** in command payloads at runtime boundary (`view_id` only).
2. **No subject-prefix drift**: all AVA subjects must resolve under one prefix (`tmnl.ava` unless explicitly overridden).
3. **No envelope omissions** when crossing Elixir/Phoenix contract boundary.
4. **No dual source of truth** for command schema (bridge and TS tests must assert same shape).

---

## 7) Immediate validation gates

1. **Subject parity gate**: TS publish subjects exactly match bridge subscriptions.
2. **Payload parity gate**: command payload keys are snake_case only.
3. **Envelope gate**: missing required envelope keys fail bridge forwarding.
4. **Round-trip gate**: one invalidate + one subscribe + one unsubscribe full path from TS→NATS→Elixir and back to TS status/artifact stream.

---

## 8) Open items

1. Confirm whether status fanout remains `status.*` only, or also needs explicit status domain subtypes.
2. Confirm if Phoenix `ava_event` payload should remain envelope-full for UI consumers, or permit projection variants.
3. Decide when to lift this matrix into generated `@ava-fusion/contracts` artifacts.
