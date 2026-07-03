# GetByShell `tmnl-panel` MorphChat / harness visitor debug

Date: 2026-06-26
Task: #4835 Debug MorphChat/harness visitor path inside tmnl-panel
Feature: #F1347 GetByShell panel parity recovery

## Scope

Static diagnosis only. No live service restart, compositor reload, relogin, Nix switch, or additional panel signal was run for this task.

A read-only subagent was attempted but timed out without usable output; local inspection supplied the evidence below.

## Grounding sources

- `src-panel/panel-entry.tsx`
- `vite.config.panel.ts`
- `vite.config.ts`
- `src/lib/floating/overlay/PanelWorkspace.tsx`
- `src/lib/floating/visitors/index.ts`
- `src/lib/floating/visitors/morphchat-visitor.tsx`
- `src/lib/floating/components/PanelContentRenderer.tsx`
- `src/lib/floating/stx/spawn.ts`
- `src/lib/morphchat/atoms/registry.ts`
- `src/lib/morphchat/components/surface-root.tsx`
- `src/lib/morphchat/hooks/harness-adapter/hook.ts`
- `src/lib/morphchat/hooks/harness-adapter/atoms.ts`
- `src/lib/morphchat/hooks/harness-adapter/operations.ts`
- `src/lib/harness/HarnessBrowserTransport.ts`
- `scripts/smokes/session-drawer-live-pi-replay-smoke.ts`

## Observed mechanisms

### 1. Visitor registration itself is healthy for MorphChat

`PanelWorkspace.tsx` imports `registerAllVisitors()` and calls it at module load.

`registerAllVisitors()` calls `registerMorphChatVisitors()`, which registers:

- `morphchat`
- `morphchat:harness`

`spawnPanel('morphchat:harness', { mode: ... })` uses `panelRegistry.get(visitorId)` and stores `visitorId` on the new STX panel record.

`PanelContentRenderer` reads the panel’s `visitorId`, looks it up in `panelRegistry`, and renders the registered component.

**Verdict:** the standalone panel has the MorphChat visitor registration path it needs. The failure is not “unknown visitor” for `morphchat:harness`.

### 2. Harness panel session isolation is per panel id

`MorphChatHarnessPanelInner` calls:

```ts
useHarnessAdapter({
  instanceId: panelId,
  nodeId: `conductor:${panelId}`,
  role: 'general',
  agentName: 'Panel-Agent',
  autoConnect: true,
})
```

It reads the current session via `useAtomValue(sessionId$(panelId))` and exposes `NEW`, `RECONNECT`, and `SESSIONS` controls when connected.

**Verdict:** session identity is intentionally panel-scoped. This matches the Cursor-agent-tab style described in comments.

### 3. Registry wrapping is redundant but not currently harmful

`MorphChatHarnessPanel` wraps `MorphChatHarnessPanelInner` in `MorphChatRegistryProvider`.

`MorphChat.Surface` also wraps its inner provider in `MorphChatRegistryProvider`.

Both providers use the same singleton `morphChatRegistry` from `src/lib/morphchat/atoms/registry.ts`, and the harness hook often writes directly to that singleton registry.

**Verdict:** nested providers are redundant, but because they point at the same registry, this is not the primary failure. If cleanup happens later, remove only after verifying no consumer relies on ambient provider placement.

### 4. Standalone panel dev server lacks the harness WebSocket proxy

`HarnessBrowserTransport.defaultBrowserWebSocketUrl()` chooses:

```ts
`${wsProtocol}//${window.location.host}/api/harness/ws`
```

unless one of these overrides is present:

- `globalThis.__TMNL_HARNESS_WS_URL`
- `import.meta.env.VITE_HARNESS_WS_URL`
- `globalThis.process?.env?.HARNESS_WS_URL`

The main TMNL Vite config (`vite.config.ts`, port 1420) proxies:

```ts
'/api/harness': {
  target: 'http://localhost:8787',
  changeOrigin: true,
  ws: true,
}
```

The standalone panel Vite config (`vite.config.panel.ts`, port 1422) has no proxy stanza at all.

**Verdict:** in standalone panel dev, `morphchat:harness` tries to connect to `ws://<panel-host>:1422/api/harness/ws`, but the panel Vite server does not proxy that route to `8787`. The live harness panel will fail unless `VITE_HARNESS_WS_URL` or `globalThis.__TMNL_HARNESS_WS_URL` is set. This is a concrete standalone-only parity gap.

### 5. Session drawer smoke currently targets the main app, not standalone panel

`scripts/smokes/session-drawer-live-pi-replay-smoke.ts` drives `http://127.0.0.1:1420/` and uses the main app panel overlay:

- click Panels
- click `+ Live`
- wait for `CONNECTED`
- click `SESSIONS`
- select a pi-cli row

This validates the main app’s overlay path and main Vite proxy, not the standalone `tmnl-panel` route on port 1422 / Tauri layer-shell.

**Verdict:** existing live smoke can pass while standalone panel harness is broken.

### 6. Full visitor parity remains broader than MorphChat

Standalone `PanelWorkspace` registers MorphChat, geoint, and muse-log visitors through `registerAllVisitors()`. The main app additionally side-effect imports other panel registrations in `src/main.tsx`, including:

- `@/lib/egui/panels`
- `@/lib/code-editor/panels/CodeEditorPanel`

**Verdict:** MorphChat parity is mostly local; full panel palette parity still needs a shared registration bootstrap if those panels matter in standalone `tmnl-panel`.

## Debug conclusion

MorphChat/harness is structurally wired for standalone `tmnl-panel`, but its browser transport endpoint inherits same-origin semantics from the main app. Because `vite.config.panel.ts` does not proxy `/api/harness`, standalone dev builds fail the live harness route unless an explicit harness WS URL override is provided.

The remediation should not duplicate harness state in React. Keep the existing `useHarnessAdapter` / effect-atom registry authority. Fix the environment/transport surface.

## Recommended remediation

1. Add `/api/harness` proxy with `ws: true` to `vite.config.panel.ts`, mirroring the main app config.
2. Consider exposing a panel-specific default override in `src-panel/panel-entry.tsx` only if production/installed `tmnl-panel` needs a known remote harness endpoint. Prefer env/config over hard-coding.
3. Add a standalone panel smoke or regression assertion that can validate `window.__TMNL_HARNESS_WS_URL` / same-origin harness route resolution for the panel entry.
4. Defer redundant `MorphChatRegistryProvider` cleanup; it is not causal.
5. If full palette parity is required, create a shared panel visitor bootstrap used by both `src/main.tsx` and `src-panel/panel-entry.tsx` rather than scattering side-effect imports.
