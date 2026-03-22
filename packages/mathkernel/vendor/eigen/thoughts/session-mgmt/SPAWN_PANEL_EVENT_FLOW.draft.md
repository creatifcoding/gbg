# spawn_panel Integration Note (Event Flow)

## 1) Tool registration + server emit
- `spawn_panel` is registered in `src/lib/harness/PiAiToolRuntimeBuiltins.ts` via `createSpawnPanelTool(...)`.
- Bridge emits panel domain events through `PanelEventBus.emit(...)`:
  - `panel:spawned { surfaceId, panelId, title, prompt, threadId, width, height, mode, surface? }`
  - `panel:closed { panelId }`

## 2) Server relay to websocket
- Bus implementation: `src/lib/harness/panel-events/PanelEventBus.ts` (`Stream.asyncPush`).
- Relay in `src/lib/harness/server/HarnessRemoteWsServer.ts` wraps as:
  - `remote:ws_event` -> `remote:panel_event` -> `PanelEvent`.

## 3) Schema boundary
- `remote:panel_event` is modeled in `src/lib/harness/HarnessBrowserRemoteSchemas.ts` as `HarnessRemotePanelEventEnvelope`.
- It is included in `HarnessRemoteEventEnvelope` for client decoding.

## 4) Client listener + floating spawn/close
- Listener path: `transport.events` handling in `src/lib/morphchat/hooks/useHarnessAdapter.ts`.
- On `panel:spawned`:
  1. `registerGeniferPanelVisitor()`
  2. optional hydration: `setGeniferPanelSurface(event.surfaceId, event.surface)`
  3. local panel spawn: `spawnPanel('genifer:surface', { data: { surfaceId, prompt, threadId }, ... })`
  4. map server->local IDs in `remoteToLocalPanelIds`
- On `panel:closed`:
  1. resolve local panel ID from `remoteToLocalPanelIds`
  2. `closePanel(localId)`
  3. remove mapping

## 5) Operational notes
- This path is event-driven (server emit -> client listener), not request/response.
- `registerGeniferPanelVisitor()` must remain idempotent (safe across repeated calls/HMR).
- `remoteToLocalPanelIds` is required because remote panel IDs may differ from local floating IDs.
