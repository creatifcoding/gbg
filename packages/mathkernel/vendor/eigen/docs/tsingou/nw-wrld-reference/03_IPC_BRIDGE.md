# Doc Set 03 — IPC Bridge & Process Communication

> **Scope**: `ipcBridge.ts`, 10 bridge modules, `bridge.ts` (Projector side), `sandbox.ts`, cross-process messaging  
> **Tsingou Replacement**: Replace Electron IPC with Holonet (NATS pub/sub + typed channels), Effect.Service boundaries

---

## 1. Process Topology

nw_wrld runs as a 3-process Electron app with a 4th isolated BrowserView:

```
┌─────────────────────────────────────────────────────────────┐
│                    MAIN PROCESS (Node.js)                     │
│                                                               │
│  InputManager ←→ IPC Bridge Hub ←→ Sandbox Manager           │
│                       │                                       │
│            ┌──────────┼──────────┐                           │
│            ▼          ▼          ▼                           │
│      Dashboard    Projector    Sandbox (BrowserView)         │
│      Renderer     Renderer     (inside Projector)            │
└─────────────────────────────────────────────────────────────┘
```

### Communication Patterns

| Pattern | Example | Mechanism |
|---------|---------|-----------|
| **Renderer → Main** | Dashboard reads JSON file | `ipcRenderer.invoke("json:read", args)` |
| **Main → Renderer** | Input event broadcast | `webContents.send("input-event", payload)` |
| **Renderer → Renderer** | Dashboard → Projector | `ipcRenderer.send("dashboard-to-projector", msg)` |
| **Projector → Sandbox** | Invoke method on instance | `sandbox:request` → Main → `sandbox:fromMain` |
| **Sandbox → Main** | Read asset file | `sandbox:toMain` → Main resolves → `sandbox:request` response |

---

## 2. IPC Bridge Hub

**File**: `src/main/mainProcess/ipcBridge.ts`

```typescript
export function registerIpcBridge(): void {
  registerProjectBridge();      // Project folder selection
  registerWorkspaceBridge();    // Module source reading
  registerJsonBridge();         // JSON file I/O
  registerAppBridge();          // App metadata (version)
  registerOsBridge();           // OS operations (openExternal)
  registerInputBridge();        // Input device management
  registerTestMidiBridge();     // Test MIDI devices
  registerTestAudioBridge();    // Audio band emission
  registerTestFileBridge();     // File audio band emission
  registerLogBridge();          // Logging
}
```

### Bridge Module Detail

| Bridge | File | Channels | Pattern |
|--------|------|----------|---------|
| **Project** | `registerProjectBridge.ts` | `workspace:select` | `ipcMain.handle` → Electron dialog → returns path |
| **Workspace** | `registerWorkspaceBridge.ts` | `workspace:readModule`, `workspace:listModules`, `workspace:modulesChanged` | `ipcMain.handle` + `webContents.send` |
| **JSON** | `registerJsonBridge.ts` | `json:read`, `json:write` | `ipcMain.handle` → `jsonFileBase.read/write` |
| **App** | `registerAppBridge.ts` | `app:getVersion` | `ipcMain.handle` → `app.getVersion()` |
| **OS** | `registerOsBridge.ts` | `os:openExternal` | `ipcMain.handle` → `shell.openExternal(url)` |
| **Input** | `registerInputBridge.ts` | `input:initialize`, `input:disconnect`, `input:getStatus` | `ipcMain.handle` → `InputManager` methods |
| **Test MIDI** | `registerTestMidiBridge.ts` | `input:midi:getDevices` | `ipcMain.handle` → `InputManager.getAvailableMIDIDevices()` |
| **Test Audio** | `registerTestAudioBridge.ts` | `input:audio:emitBand` | `ipcMain.on` → `InputManager.broadcast("method-trigger", ...)` |
| **Test File** | `registerTestFileBridge.ts` | `input:file:emitBand` | `ipcMain.on` → `InputManager.broadcast("method-trigger", ...)` |
| **Log** | `registerLogBridge.ts` | `log:toMain` | `ipcMain.on` → `console.log` |

---

## 3. Cross-Process Message Channels

### Main → Renderers (Push)

| Channel | Direction | Payload | Purpose |
|---------|-----------|---------|---------|
| `input-event` | Main → Dashboard + Projector | `InputEventPayload` | Signal broadcast |
| `input-status` | Main → Dashboard | `InputStatusPayload` | Connection status |
| `workspace:modulesChanged` | Main → Dashboard + Projector | `{ modules: string[] }` | Hot reload |

### Dashboard ↔ Projector (Cross-Renderer)

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `dashboard-to-projector` | Dashboard → Projector | Track activation, playback commands |
| `from-projector` | Projector → Dashboard | Status updates, error reports |

---

## 4. Sandbox RPC Protocol

**File**: `src/main/mainProcess/sandbox.ts`

### Token-Based Authentication

```
1. Projector sends "sandbox:ensure" to Main
2. Main creates BrowserView, generates one-time token
3. BrowserView loads nw-sandbox://index.html#token={token}
4. All subsequent messages include token for validation
```

### Request/Response Flow

```
Projector                         Main                            Sandbox
    │                               │                               │
    ├──sandbox:request {rpcId, token, action, payload}──►          │
    │                               ├──sandbox:fromMain {rpcId, action, payload}──►
    │                               │                               │
    │                               │◄──sandbox:toMain {rpcId, result/error}──┤
    │◄──sandbox:response {rpcId, result/error}──┤                  │
```

### Sandbox Actions

| Action | Payload | Response |
|--------|---------|----------|
| `initTrack` | `{ track, moduleSources, assetsBaseUrl }` | `{ ok: true }` |
| `destroyTrack` | `{}` | `{ ok: true }` |
| `invokeOnInstance` | `{ instanceId, methodName, options }` | `{ ok: true }` |
| `setMatrixForInstance` | `{ instanceId, track, moduleSources, assetsBaseUrl, matrixOptions }` | `{ ok: true }` |
| `introspectModule` | `{ moduleType, source }` | `{ methods, callableNames }` |
| `sdk:readAssetText` | `{ relPath }` | `{ text }` |
| `sdk:listAssets` | `{ relDir }` | `{ files }` |

---

## 5. Projector-Side Bridge

**File**: `src/projector/internal/bridge.ts`

The Projector renderer exposes a `getMessaging()` function that provides:

```typescript
interface ProjectorMessaging {
  sendToDashboard(channel: string, data: unknown): void;
  onFromDashboard(handler: (event, data) => void): void;
  onInputEvent(handler: (event, payload) => void): void;
  invoke(channel: string, ...args: unknown[]): Promise<unknown>;
}
```

This abstracts the Electron `ipcRenderer` API behind a typed interface.

---

## 6. Validation at Boundaries

Every IPC boundary has validation:

| Boundary | Validator | File |
|----------|-----------|------|
| Input events | `normalizeInputEventPayload()` | `inputEventValidation.ts` |
| Sandbox RPC props | `sandboxValidation.ts` | Sanitizes all sandbox inputs |
| JSON file I/O | `userDataValidation.ts` | Deep normalization on read |
| File paths | `pathSafetyValidation.ts` | Prevents path traversal |
| OSC addresses | `oscValidation.ts` | Validates prefix patterns |
| Workspace structure | `workspaceValidation.ts` | Validates directory layout |

---

## Tsingou Design Derivation

| nw_wrld IPC | Tsingou Replacement | Key Change |
|---|---|---|
| `ipcMain.handle` / `ipcRenderer.invoke` | Holonet NATS request/reply | Electron IPC → typed pub/sub |
| `webContents.send` (push) | `NatsPubSubService.publish` | Point-to-point → fan-out |
| `dashboard-to-projector` channel | NATS subject `tsingou.internal.>` | Cross-renderer → same-process |
| Sandbox RPC (token-auth) | Effect.Service direct call | BrowserView isolation → component isolation |
| 10 bridge modules | Effect.Service per domain | Imperative registration → Layer composition |
| `normalizeInputEventPayload()` | `Schema.decodeUnknown(BaseSignal)` | Manual normalization → Effect.Schema |
| `pathSafetyValidation.ts` | `@tauri-apps/plugin-fs` scoping | Manual path check → Tauri security model |

### Holonet Subject Mapping

| Electron Channel | NATS Subject |
|-----------------|--------------|
| `input-event` | `tsingou.signal.>` |
| `input-status` | `tsingou.adapter.health.>` |
| `workspace:modulesChanged` | `tsingou.workspace.change` |
| `json:read` / `json:write` | `tsingou.persistence.json.>` (or direct Effect FileSystem) |
| `sandbox:request` | Direct Effect.Service call (no IPC needed) |

---

*End of Doc Set 03. The IPC bridge is the nervous system — every cross-process message maps to a NATS subject or direct Effect.Service call in Tsingou.*
