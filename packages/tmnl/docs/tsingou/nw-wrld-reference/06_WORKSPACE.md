# Doc Set 06 — Workspace & Project Management

> **Scope**: `workspace.ts`, `workspaceStarterModules.ts`, `workspaceStarterAssets.ts`, project folder structure, file watching, migration system  
> **Tsingou Replacement**: Replace with @effect/platform FileSystem, Tauri plugin-fs for scoped access, Holonet file-watch bridge

---

## 1. Workspace Model

Each nw_wrld project is a self-contained directory:

```
MyProject/
├── modules/                    # User visual modules (.js files)
│   ├── MyModule.js
│   └── AnotherModule.js
├── assets/
│   ├── images/                 # Loadable via assetUrl()
│   │   ├── photo.jpg
│   │   └── texture.png
│   └── json/                   # Loadable via loadJson()
│       └── data.json
└── nw_wrld_data/
    └── json/                   # App persistence files
        ├── userData.json        # Tracks, modules, mappings, config
        ├── appState.json        # Active set, workspace path
        ├── config.json          # Aspect ratio, colors
        └── recordingData.json   # Recorded sequences
```

---

## 2. Workspace Initialization

**File**: `src/main/mainProcess/workspace.ts`

### Project Selection Flow

```
1. User selects folder via Electron dialog (registerProjectBridge)
2. workspace.ts validates structure
3. If new project: scaffold directories + seed starter modules/assets
4. If existing project: check for legacy migrations
5. Start file watcher on modules/ directory
6. Broadcast workspace:ready to all windows
```

### Directory Scaffolding

```typescript
// Creates if not exists:
fs.mkdirSync(path.join(projectDir, "modules"), { recursive: true });
fs.mkdirSync(path.join(projectDir, "assets", "images"), { recursive: true });
fs.mkdirSync(path.join(projectDir, "assets", "json"), { recursive: true });
fs.mkdirSync(path.join(projectDir, "nw_wrld_data", "json"), { recursive: true });
```

---

## 3. Starter Module Seeding

**File**: `src/main/workspaceStarterModules.ts`

When a new project is created, starter modules are copied from `src/main/starter_modules/` into the project's `modules/` directory.

### 21 Starter Modules

| File | Category | Rendering |
|------|----------|-----------|
| `Background.js` | 2D | CSS background |
| `CircleGrow.js` | 2D | CSS border-radius animation |
| `ColorFlash.js` | DOM | CSS background-color |
| `CubeRotate.js` | 3D | Three.js BoxGeometry |
| `Debug.js` | Utility | DOM text overlay |
| `DotGrid.js` | 2D | Canvas 2D dots |
| `FlashFade.js` | 2D | CSS opacity transition |
| `GlitchText.js` | DOM | CSS clip-path + transform |
| `Gradient.js` | DOM | CSS linear-gradient |
| `ImageCycle.js` | DOM | Image rotation |
| `LineSketch.js` | 2D | Canvas 2D lines |
| `MathLattice.js` | 3D | Three.js point lattice |
| `MathOrbitalMap.js` | Data | D3.js force simulation |
| `NoiseField.js` | 2D | p5.js Perlin noise |
| `ParticleField.js` | 3D | Three.js particles |
| `SphereDeform.js` | 3D | Three.js SphereGeometry |
| `TextScroll.js` | DOM | CSS transform translateY |
| `TilePattern.js` | DOM | CSS grid |
| `Waveform.js` | Data | Canvas 2D waveform |
| `WireframeGlobe.js` | 3D | Three.js wireframe sphere |

---

## 4. File Watching

**File**: `src/main/mainProcess/workspace.ts`

### Watch Pattern

```typescript
// Watch modules/ directory for changes
fs.watch(modulesDir, { recursive: true }, (eventType, filename) => {
  if (!filename) return;
  if (!filename.endsWith(".js")) return;
  
  // Debounce: wait for file to settle
  // 6 attempts × 120ms = 720ms max wait
  waitForFileSettle(filePath, 6, 120).then(() => {
    // Broadcast to all windows
    dashboard.webContents.send("workspace:modulesChanged", { modules: listModules() });
    projector.webContents.send("workspace:modulesChanged", { modules: listModules() });
  });
});
```

### File Settle Detection

```typescript
const waitForFileSettle = async (filePath, maxAttempts, intervalMs) => {
  let lastSize = -1;
  for (let i = 0; i < maxAttempts; i++) {
    const stat = fs.statSync(filePath);
    if (stat.size === lastSize && stat.size > 0) return; // Settled
    lastSize = stat.size;
    await new Promise(r => setTimeout(r, intervalMs));
  }
};
```

### Hot Reload Pipeline

```
modules/ file change detected
    │
    ├─ Wait for file settle (debounced)
    │
    ├─ Broadcast workspace:modulesChanged to Dashboard
    │   └─ Dashboard re-introspects module metadata
    │
    └─ Broadcast workspace:modulesChanged to Projector
        └─ Projector invalidates module cache
        └─ Next trigger reloads from fresh source
```

---

## 5. JSON Location Resolution

**File**: `src/main/mainProcess/workspace.ts`

### Priority Chain

```typescript
getJsonDirForBridge(projectDir):
  1. If projectDir valid → <projectDir>/nw_wrld_data/json/
  2. Else → <srcDir>/shared/json/ (fallback)
```

### Legacy Migration

```typescript
maybeMigrateJsonIntoProject(projectDir):
  For each ["userData.json", "appState.json", "config.json", "recordingData.json"]:
    1. Check if exists in project dir → skip
    2. Check legacy location (src/shared/json/) → copy to project
    3. Copy .backup files too
```

---

## 6. Asset Access SDK

**File**: `src/shared/utils/sdkHelpers.ts`

Modules access assets through the SDK:

```typescript
const { assetUrl, readAssetText, loadJson, listAssets } = createSdkHelpers(assetsBaseUrl);

// assetUrl("images/photo.jpg") → "nw-sandbox://assets/images/photo.jpg"
// readAssetText("json/data.json") → IPC → Main reads file → returns text
// loadJson("json/data.json") → readAssetText → JSON.parse
// listAssets("images") → IPC → Main lists directory → returns filenames
```

### Path Safety

```typescript
// safeAssetRelPath prevents:
// - Absolute paths (/etc/passwd)
// - Parent traversal (../../secrets)
// - Protocol URLs (file://, http://)
// - Null bytes
const safePath = safeAssetRelPath(userInput);
if (!safePath) throw new Error("Invalid asset path");
```

---

## Tsingou Design Derivation

| nw_wrld Component | Tsingou Replacement | Key Change |
|---|---|---|
| Electron dialog (project select) | Tauri `dialog.open()` | Electron → Tauri |
| `fs.watch(modules/)` | `@effect/platform FileSystem.watch` (sidecar) → NATS | Node fs → Effect Stream → Holonet bridge |
| File settle detection | `Stream.debounce(Duration.millis(500))` | Manual polling → stream operator |
| `fs.mkdirSync` scaffolding | `FileSystem.makeDirectory(path, { recursive: true })` | Raw fs → Effect |
| `fs.copyFileSync` seeding | `FileSystem.copy(src, dest)` | Raw fs → Effect |
| JSON location resolution | Tauri `$APPDATA` base directory | Electron path → Tauri path |
| Asset URL (`nw-sandbox://`) | Tauri asset protocol or HTTP serve | Custom protocol → Tauri protocol |
| `readAssetText` via IPC | `FileSystem.readFileString` or Tauri `readTextFile` | IPC roundtrip → direct read |
| Path safety validation | Tauri fs scoping (permission-based) | Manual check → platform security |
| Legacy migration | Schema versioning (`Schema.transform`) | File copy → schema evolution |

### Tsingou Workspace Structure

```
~/.tsingou/                         # App data (Tauri $APPDATA)
├── config.json                      # App-wide settings
├── sessions/                        # Analysis session snapshots
│   └── session-{id}/
│       ├── manifest.json            # Session metadata (Schema-encoded)
│       ├── signals/                  # Signal recordings (NDJSON)
│       └── derived/                  # Derived state snapshots
└── schemas/                         # Custom signal schemas

<project>/                           # User project directory
├── modules/                         # Visual modules (unchanged)
├── assets/                          # Assets (unchanged)
├── adapters/                        # Custom adapter configs (new)
│   ├── rss-feeds.json
│   └── http-sources.json
└── tsingou_data/                    # Project persistence (renamed from nw_wrld_data)
    └── json/
        ├── userData.json             # Backwards-compatible
        └── flowConfig.json           # d2ts graph configuration (new)
```

---

## 8. File Watch → Holonet Bridge Pattern

In Tsingou, file watching follows the sidecar pattern:

```
Sidecar (Node/Bun)                  Webview (Tauri)
┌───────────────────────┐           ┌───────────────────────┐
│ @effect/platform      │           │ HolonetBridgeAdapter  │
│ FileSystem.watch()    │           │   kind: "file-watch"  │
│   → Stream<WatchEvent>│──NATS──►  │   subjects: [         │
│   → publish to NATS   │           │     "tsingou.signal.  │
│     subject per path  │           │      file-watch.>"    │
└───────────────────────┘           │   ]                   │
                                    │   → push(signal)      │
                                    │   → signalQueue       │
                                    └───────────────────────┘
```

The sidecar uses `@effect/platform` `FileSystem.watch` which returns `Stream<WatchEvent>` with tagged events:
- `WatchEvent.Create` — file created
- `WatchEvent.Update` — file modified
- `WatchEvent.Remove` — file deleted

Each event is published to NATS subject `tsingou.signal.file-watch.<path>`.

---

*End of Doc Set 06. The workspace is the project container — its structure informs Tsingou's workspace model, with additions for adapter configs and session data.*
