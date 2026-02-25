# spawn_panel Smoke Checklist (Copy/Paste)

Operator checklist for validating spawn/update/close behavior end-to-end.

Canonical labels validated in this checklist:

- `panel:spawned`
- `panel:surface_updated`
- `panel:closed`
- `remote:panel_event`

---

## A) Preflight

- [ ] From `packages/tmnl`, run:

```bash
bunx tsc --noEmit
```

Expected:

- [ ] command exits `0`
- [ ] no type errors

---

## B) Spawn path verification

### Copy/paste prompt (agent/tool invocation)

Use this exact intent in your harness chat:

```text
Call spawn_panel with:
{
  "prompt": "Build a compact status panel with a title and one KPI row",
  "title": "Smoke Spawn Panel",
  "mode": "floating",
  "width": 520,
  "height": 360
}
```

### Expected outcomes

- [ ] Stream status contains: `Generating UI: "..."…`
- [ ] Tool result includes `details.operation = "spawn"`
- [ ] Tool result includes `details.surfaceId`
- [ ] Tool result includes `details.panelId`
- [ ] Server emits `panel:spawned`
- [ ] WS relays `remote:panel_event` with inner event `_tag = panel:spawned`
- [ ] Client opens one floating Genifer panel
- [ ] Remote/local mapping created (`remotePanelId -> localPanelId`)

Record for next steps:

- [ ] `surfaceId = ____________________`
- [ ] `remotePanelId = ____________________`

---

## C) Update path verification

### Copy/paste prompt

```text
Call spawn_panel with:
{
  "surfaceId": "<surfaceId-from-step-B>",
  "update": "Change the KPI value color to cyan and add a timestamp row"
}
```

### Expected outcomes

- [ ] Tool result includes `details.operation = "update"`
- [ ] Tool result text contains `Surface <surfaceId> updated`
- [ ] Server emits `panel:surface_updated` (when updated surface is present)
- [ ] WS relays `remote:panel_event` with inner event `_tag = panel:surface_updated`
- [ ] Existing panel content refreshes in place (no duplicate panel)

---

## D) Close path verification

### Copy/paste prompt

```text
Call spawn_panel with:
{
  "panelId": "<remotePanelId-from-step-B>",
  "close": true
}
```

### Expected outcomes

- [ ] Tool result includes `details.operation = "close"`
- [ ] Tool result text contains `Panel <panelId> closed.`
- [ ] Server emits `panel:closed`
- [ ] WS relays `remote:panel_event` with inner event `_tag = panel:closed`
- [ ] Client closes the mapped local panel
- [ ] Mapping entry removed for the remote panel ID

---

## E) Negative/error checks

### Invalid operation shape

Copy/paste:

```text
Call spawn_panel with: {}
```

Expected:

- [ ] tool returns `isError: true`
- [ ] text contains `No operation specified...`

### Malformed WS envelope (transport-level)

Expected semantics:

- [ ] response `_tag = remote:ws_response`
- [ ] `requestId = invalid-request`
- [ ] `response.ok = false`
- [ ] message `Malformed harness websocket envelope`

---

## F) Pass criteria

Mark smoke run complete only when all are true:

- [ ] spawn path passes
- [ ] update path passes
- [ ] close path passes
- [ ] canonical labels observed exactly (`panel:*`, `remote:panel_event`)
- [ ] remote/local panel ID mapping behaves as expected
