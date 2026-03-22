# spawn_panel Troubleshooting (Operator Playbook)

Use this when agent-driven Genifer panels do not appear, do not update, or do not close.

Canonical labels used throughout this playbook:

- `panel:spawned`
- `panel:surface_updated`
- `panel:closed`
- `remote:panel_event`

---

## 0) Fast triage sequence

1. Confirm build/type health:
   - `bunx tsc --noEmit`
2. Confirm `spawn_panel` tool is registered in harness startup logs.
3. Verify server emits panel events into `PanelEventBus`.
4. Verify websocket relay emits `remote:panel_event` envelopes.
5. Verify client receives and applies event via `applyReplaySafeRemotePanelEvent`.
6. Verify remote/local panel ID mapping exists for close path.

---

## 1) Symptom: panel never appears after spawn request

### Expected behavior

- Tool returns success with operation `spawn`
- Server emits `panel:spawned`
- WS relays as `remote:ws_event` / `remote:panel_event`
- Client spawns `genifer:surface` panel and records `remotePanelId -> localPanelId`

### Common causes

- `spawn_panel` tool not registered (missing services)
- `panel:spawned` event emitted but not relayed
- relayed envelope malformed or dropped
- client handler guard short-circuits (missing `surfaceId` or `panelId`)
- panel spawning returns `null` (no local mapping created)

### Verify

- `src/lib/harness/PiAiToolRuntimeBuiltins.ts`
  - confirm registration and `panel:spawned` emission path
- `src/lib/harness/server/HarnessRemoteWsServer.ts`
  - confirm `makePanelEventEnvelope(...)` and panel relay loop
- `src/lib/morphchat/hooks/panel-event-handler.ts`
  - confirm spawn guard + mapping insertion

---

## 2) Symptom: panel appears but content never updates

### Expected behavior

- update call returns operation `update`
- server emits `panel:surface_updated` when updated surface is available
- client applies `setGeniferPanelSurface(surfaceId, surface)`

### Common causes

- refine succeeds but `updatedSurface` lookup returns empty (no emit)
- payload missing `surface` or `surfaceId` and client intentionally ignores event
- stale panel/surface mapping from prior lifecycle

### Verify

- `src/lib/harness/PiAiToolRuntimeBuiltins.ts`
  - `refine(...)` block emits `panel:surface_updated` only if `updatedSurface` exists
- `src/lib/morphchat/hooks/panel-event-handler.ts`
  - update guard requires both `surfaceId` and `surface`
- `src/lib/genifer/harness/panel-visitor.tsx`
  - atom-backed surface render path is connected

---

## 3) Symptom: close command succeeds but panel remains open

### Expected behavior

- tool returns operation `close`
- server emits `panel:closed` with remote panel ID
- client resolves mapped local panel ID and closes local panel
- mapping entry removed

### Common causes

- missing `remotePanelId -> localPanelId` mapping (spawn never mapped)
- stale mapping points to already-removed local panel
- close target is remote ID but local panel uses different ID

### Verify

- `src/lib/morphchat/hooks/panel-event-handler.ts`
  - close logic: mapped local ID first, then fallback
- `src/lib/morphchat/hooks/useHarnessAdapter.ts`
  - replay-safe map pruning and alias drop behavior

---

## 4) Symptom: intermittent duplicate panels for same surface

### Expected behavior

- replay-safe handler deduplicates duplicate/replayed `panel:spawned`
- existing local panel is reused when mappings still valid

### Common causes

- duplicate events delivered while lifecycle maps are stale
- local panel manually closed but map not yet pruned

### Verify

- `applyReplaySafeRemotePanelEvent(...)` path in:
  - `src/lib/morphchat/hooks/useHarnessAdapter.ts`

This function prunes stale mappings and reuses local panels by surface ID where possible.

---

## 5) Status and error semantics (operator reference)

### Tool status/success text

- stream status: `Generating UI: "<prompt>"…`
- spawn success: `Panel spawned with surface <surfaceId>. Panel ID: <panelId>. ...`
- display success: `Displayed surface <surfaceId> in panel <panelId>.`
- update success: `Surface <surfaceId> updated: "<instruction>"`
- close success: `Panel <panelId> closed.`

### Tool error semantics

- invalid operation shape: `isError: true`, message `No operation specified...`
- runtime tool failure: `isError: true`, message prefix `Tool execution error: ...`

### WS error semantics

- malformed inbound envelope:
  - `_tag: remote:ws_response`
  - `requestId: invalid-request`
  - `response.ok: false`
  - `message: Malformed harness websocket envelope`
- command failure:
  - `_tag: remote:ws_response`
  - original requestId
  - `response.ok: false`
  - error message string

---

## 6) Canonical contracts to preserve

Do not rename or alias these labels in operator tooling:

- panel events: `panel:spawned`, `panel:closed`, `panel:surface_updated`
- remote event envelope: `remote:panel_event`
- mapping concept: **remote panel ID** vs **local panel ID**

When debugging close/update defects, always inspect mapping state first; protocol IDs and UI IDs are intentionally different layers.
