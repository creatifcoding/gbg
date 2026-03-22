# spawn_panel Event Flow (Harness → WS → Client Floating Panels)

Phase C operator reference for agent-spawned panels.

This document defines the canonical event contract and the expected runtime behavior for:

- `spawn_panel` tool execution
- `PanelEventBus` relay
- WS envelope transport (`remote:panel_event`)
- client-side panel lifecycle (spawn/update/close)

---

## Canonical labels and envelopes

### Panel event labels (authoritative)

- `panel:spawned`
- `panel:closed`
- `panel:surface_updated`

Defined in: `src/lib/genifer/harness/panel-events.ts`

### WS event envelope labels

- outer envelope: `remote:ws_event`
- inner event envelope: `remote:panel_event`
- payload: `PanelEvent`

Defined in: `src/lib/harness/HarnessBrowserRemoteSchemas.ts`

---

## End-to-end runtime flow

## 1) Tool registration (server)

File: `src/lib/harness/PiAiToolRuntimeBuiltins.ts`

`createSpawnPanelTool(...)` is registered as `spawn_panel` when:

- `PanelEventBus` is available
- `GeniferHarnessService` is available

Bridge operations:

- `generate(prompt, threadId)` → `GeniferHarnessService.generate(...)`
- `refine(surfaceId, instruction)` → `GeniferHarnessService.refine(...)`
- `spawnPanel(surfaceId, opts)` → emits `panel:spawned`
- `closePanel(panelId)` → emits `panel:closed`

## 2) Panel event bus (server)

File: `src/lib/harness/panel-events/PanelEventBus.ts`

`PanelEventBus` is an Effect service with:

- `events: Stream<PanelEvent>`
- `emit(event): Effect<void>`

`HarnessRuntimeLive` provides a single shared bus instance so tool execution and WS relay observe the same stream.

## 3) WS relay loop

File: `src/lib/harness/server/HarnessRemoteWsServer.ts`

Server subscribes to `PanelEventBus.events` and wraps each event as:

- `remote:ws_event` → `remote:panel_event` → `PanelEvent`

Then sends over the existing websocket `send(...)` path.

## 4) Client listener and panel lifecycle

Files:

- `src/lib/morphchat/hooks/useHarnessAdapter.ts`
- `src/lib/morphchat/hooks/panel-event-handler.ts`

On `remote:panel_event`:

- `panel:spawned`
  - `registerGeniferPanelVisitor()` (idempotent)
  - `setGeniferPanelSurface(surfaceId, surface)` when surface included
  - `spawnPanel('genifer:surface', { data: { surfaceId, prompt, threadId }, title, mode })`
  - store `remotePanelId -> localPanelId` mapping
- `panel:closed`
  - resolve mapped local ID
  - fallback to remote ID if no mapping
  - `closePanel(localId)`
  - remove mapping
- `panel:surface_updated`
  - `setGeniferPanelSurface(surfaceId, surface)`

## 5) Surface render path

File: `src/lib/genifer/harness/panel-visitor.tsx`

- surface state is atom-backed (`Atom.family`)
- updates occur through registry mutation (`setGeniferPanelSurface`)
- rendering subscribes with `useAtomValue`

This keeps panel updates in atom state (not React local state).

---

## Expected operation semantics (tool layer)

File: `src/lib/genifer/harness/spawn-panel-tool.ts`

`spawn_panel` returns `details.operation` as one of:

- `spawn`
- `display`
- `update`
- `close`

Streaming status update (spawn path):

- `Generating UI: "<prompt>"…`

Success text patterns:

- Spawn: `Panel spawned with surface <surfaceId>. Panel ID: <panelId>. ...`
- Display: `Displayed surface <surfaceId> in panel <panelId>.`
- Update: `Surface <surfaceId> updated: "<instruction>"`
- Close: `Panel <panelId> closed.`

---

## Expected status/error semantics (operator-facing)

### Tool execution errors

- Invalid operation shape (missing `prompt`, `surfaceId`, and `panelId+close`) returns:
  - `isError: true`
  - text: `No operation specified. Provide either prompt, surfaceId, or panelId + close.`
- Runtime failure in built-in tool execution is normalized to:
  - `isError: true`
  - text prefix: `Tool execution error: ...`

### WS request/response errors

File: `src/lib/harness/server/HarnessRemoteWsServer.ts`

- malformed inbound websocket envelope:
  - response `_tag: remote:ws_response`
  - `requestId: "invalid-request"`
  - `response.ok: false`
  - message: `Malformed harness websocket envelope`
- command handling failure:
  - response `_tag: remote:ws_response`
  - same requestId as inbound envelope
  - `response.ok: false`
  - message from thrown error
- encoding failure fallback:
  - response `_tag: remote:ws_response`
  - `requestId: "encode-failure"`
  - `response.ok: false`

### Client-side guard behavior

Files:

- `src/lib/morphchat/hooks/panel-event-handler.ts`
- `src/lib/morphchat/hooks/useHarnessAdapter.ts`

Malformed panel events are ignored (no throw):

- `panel:spawned` without `surfaceId` or `panelId` → ignored
- `panel:surface_updated` without `surfaceId` or `surface` → ignored

Replay-safe lifecycle handling deduplicates duplicate `panel:spawned` and prunes stale mappings.

---

## Remote/local panel ID mapping contract

Server panel IDs are protocol IDs (authoritative for events). Client panel IDs are UI-local IDs from `spawnPanel(...)`.

Contract:

1. on `panel:spawned`, map `remotePanelId -> localPanelId` when local spawn succeeds
2. on `panel:closed`, close mapped local panel first, then delete mapping
3. if mapping is missing, close path may attempt direct remote ID as fallback
4. replay-safe layer also tracks `remotePanelId -> surfaceId` and `surfaceId -> localPanelId` to prevent duplicate panels

---

## Quick observability pointers

- Spawn tool wiring: `src/lib/harness/PiAiToolRuntimeBuiltins.ts`
- WS relay spans:
  - `harness.ws.panel-events-loop`
  - `harness.ws.socket-run-loop`
- Client panel event application:
  - `applyReplaySafeRemotePanelEvent(...)`
  - `applyRemotePanelEvent(...)`

Use these as first-stop inspection points during incidents.
