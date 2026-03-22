# AVA NATS Subject Matrix (Phase 1)

Status: Draft v1  
Canonical prefix: `tmnl.ava`  
Canonical command key: `view_id`

---

## 1) Scope and invariants

This matrix defines the canonical NATS subject namespace for AVA Phase 1.

**Invariants**
1. All AVA runtime subjects resolve under `tmnl.ava.*`.
2. Command payloads use **snake_case** with `view_id` (never `viewId`).
3. Subject suffix identity and payload `view_id` must match for single-view subjects.
4. Wildcard subscriptions (`*`) are for observers/aggregators, not command publishers.

---

## 2) Command subjects (TS -> bridge/runtime)

| Intent | Subject template | Publisher | Consumer | Required payload keys |
|---|---|---|---|---|
| Invalidate view | `tmnl.ava.invalidate.{view_id}` | TS AVA v2 client | Elixir bridge / runtime | `view_id` |
| Subscribe view | `tmnl.ava.subscribe.{view_id}` | TS AVA v2 client | Elixir bridge / runtime | `view_id` |
| Unsubscribe view | `tmnl.ava.unsubscribe.{view_id}` | TS AVA v2 client | Elixir bridge / runtime | `view_id` |

Optional keys by command:
- `invalidate`: `reason`, `force`
- `subscribe`: no additional required fields
- `unsubscribe`: no additional required fields

---

## 3) Stream/event subjects (runtime/bridge -> TS)

| Stream | Subject template | Producer | Consumer | Payload anchor |
|---|---|---|---|---|
| Artifacts (single) | `tmnl.ava.artifacts.{view_id}` | Elixir bridge/runtime | TS AVA subscribers | `view_id` |
| Artifacts (all) | `tmnl.ava.artifacts.*` | Elixir bridge/runtime | Observers/diagnostics | `view_id` |
| Deltas (single) | `tmnl.ava.deltas.{view_id}` | Elixir bridge/runtime | TS AVA subscribers | `view_id` |
| Deltas (all) | `tmnl.ava.deltas.*` | Elixir bridge/runtime | Observers/diagnostics | `view_id` |
| Status (single) | `tmnl.ava.status.{view_id}` | Elixir bridge/runtime | TS AVA subscribers | `view_id` |
| Status (all) | `tmnl.ava.status.*` | Elixir bridge/runtime | Observers/diagnostics | `view_id` |

---

## 4) Payload/casing contract

Canonical command payload baseline:

```json
{
  "view_id": "view-42",
  "reason": "optional",
  "force": false
}
```

Rules:
- Accept: `view_id`
- Reject: `viewId` at runtime boundary
- Reject if subject `{view_id}` and payload `view_id` disagree

---

## 5) Validation checks

### Subject parity gate
- Every TS publish subject in AVA v2 must have a corresponding bridge subscription.

### Casing gate
- Commands with `viewId` are rejected and routed to error telemetry.

### Round-trip gate
- For one `view_id`, execute:
  1. invalidate
  2. subscribe
  3. unsubscribe
- Assert status/artifact stream events arrive on canonical subjects.

### Drift gate
- Fail CI if subject prefix drifts from `tmnl.ava`.

---

## 6) Example trace

Given `view_id = "view-42"`:

1. Publish command:
   - subject: `tmnl.ava.invalidate.view-42`
   - payload: `{ "view_id": "view-42", "reason": "operator", "force": false }`
2. Bridge validates + dispatches runtime operation.
3. Runtime emits:
   - `tmnl.ava.status.view-42`
   - `tmnl.ava.artifacts.view-42` (if artifact mutation occurs)
4. TS client receives and updates view-scoped state.
