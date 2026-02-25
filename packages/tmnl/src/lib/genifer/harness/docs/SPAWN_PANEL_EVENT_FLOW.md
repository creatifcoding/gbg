# spawn_panel Event Flow (Harness → WS → Client Floating Panels)

This document describes the runtime flow for agent-driven panel spawning with Genifer surfaces.

## 1) Tool registration (server)

File: `src/lib/harness/PiAiToolRuntimeBuiltins.ts`

- `createSpawnPanelTool(...)` is registered as `spawn_panel` when:
  - `PanelEventBus` is available
  - `GeniferHarnessService` is available
- Bridge methods:
  - `generate(prompt, threadId)` → `GeniferHarnessService.generate(...)`
  - `refine(surfaceId, instruction)` → `GeniferHarnessService.refine(...)`
  - `spawnPanel(surfaceId, opts)` → emits `panel:spawned`
  - `closePanel(panelId)` → emits `panel:closed`

## 2) Panel event bus (server)

File: `src/lib/harness/panel-events/PanelEventBus.ts`

- `PanelEventBus` is an Effect service with:
  - `events: Stream<PanelEvent>`
  - `emit(event): Effect<void>`
- `HarnessRuntimeLive` provides `PanelEventBusLive` so tool execution and WS relay share one singleton event stream.

## 3) WS envelope and schema

File: `src/lib/harness/HarnessBrowserRemoteSchemas.ts`

- Added envelope:
  - `HarnessRemotePanelEventEnvelope` tagged as `remote:panel_event`
- Added to union:
  - `HarnessRemoteEventEnvelope = Union(remote:chat_v2_event, remote:shell_event, remote:panel_event)`

Panel event payload schemas are defined in:
- `src/lib/genifer/harness/panel-events.ts`
  - `panel:spawned`
  - `panel:closed`
  - `panel:surface_updated`

## 4) WS relay loop

File: `src/lib/harness/server/HarnessRemoteWsServer.ts`

- Server subscribes to `PanelEventBus.events`
- Each event is wrapped as:
  - `remote:ws_event` → `remote:panel_event` → `PanelEvent`
- Sent to client via existing `send(...)` WS path.

## 5) Client listener and floating spawn

File: `src/lib/morphchat/hooks/useHarnessAdapter.ts`

- In `transport.events` daemon fiber:
  - On `remote:panel_event`:
    - `panel:spawned`:
      - `registerGeniferPanelVisitor()` (idempotent)
      - `setGeniferPanelSurface(surfaceId, surface)` if payload contains surface
      - `spawnPanel('genifer:surface', { data: { surfaceId, prompt, threadId }, title, mode, ... })`
      - store `remotePanelId -> localPanelId` mapping
    - `panel:closed`:
      - close via mapped local id (`closePanel(localId)`)
      - cleanup mapping
    - `panel:surface_updated`:
      - `setGeniferPanelSurface(surfaceId, surface)`

## 6) Surface render path

File: `src/lib/genifer/harness/panel-visitor.tsx`

- `geniferPanelSurfaces` is `Atom.family(surfaceId => Atom.make<GeniferSurface | null>(null))`
- `setGeniferPanelRegistry(registry)` wires the registry from morphchat
- `setGeniferPanelSurface(surfaceId, surface)` mutates atom via `registry.set(...)`
- Visitor reads atom with `useAtomValue` and renders the surface content.

## Operational notes

1. **Idempotent registration**
   - `registerGeniferPanelVisitor()` may be called multiple times; registry overwrite is safe.

2. **Remote/local panel id mapping**
   - Server-generated panel ids (`panel:spawned.panelId`) are authoritative for protocol.
   - Client `spawnPanel(...)` returns local panel ids. Keep a mapping to support remote close commands.

3. **Shared ownership model**
   - Agent can spawn/update/close via `spawn_panel`.
   - User can still drag/resize/close locally using floating panel controls.

4. **Atom-as-state**
   - Surface updates are atom mutations (`Registry.set`) not React local state.
   - Rendering uses `useAtomValue` subscriptions.
