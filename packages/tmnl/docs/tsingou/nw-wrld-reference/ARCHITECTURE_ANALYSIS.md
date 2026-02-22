# nw_wrld — Deep Architecture Analysis

> **Author**: Val (Vigilant Architecture Layer)
> **Date**: 2026-02-18
> **Purpose**: Pre-fork structural analysis for Effect-native redesign + remote API/signal input support

---

## Executive Summary

`nw_wrld` is an **Electron-based event-driven visual sequencer**. It allows users to create audiovisual compositions by programming 16-step patterns or routing external signals (MIDI, OSC, audio capture, file upload) to trigger visual module methods.

**Architecture in one sentence**: A 3-process Electron app (Main → Dashboard + Projector) where signals flow through an InputManager → IPC bridge → channel dispatch → sandboxed module method execution.

---

## 1. Process Model

```
┌─────────────────────────────────────────────────────────────────┐
│                     MAIN PROCESS (Node.js)                       │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────┐   │
│  │ InputManager │  │  IPC Bridge  │  │  Workspace Manager  │   │
│  │  (MIDI/OSC/  │  │  (10 bridge  │  │  (fs watcher,       │   │
│  │   Audio/File)│  │   modules)   │  │   scaffold, migrate)│   │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬──────────┘   │
│         │                  │                     │               │
│         │    ┌─────────────┴─────────────┐       │               │
│         │    │    Sandbox Manager         │       │               │
│         │    │  (BrowserView, token auth, │       │               │
│         │    │   request routing)         │       │               │
│         │    └────────────────────────────┘       │               │
└─────────┼─────────────────────────────────────────┼──────────────┘
          │                                          │
          ▼                                          ▼
┌────────────────────┐              ┌──────────────────────────────┐
│   DASHBOARD        │              │   PROJECTOR                   │
│   (Renderer #1)    │ ◄──IPC──►   │   (Renderer #2)               │
│                    │              │                                │
│  React + Jotai     │              │  Projector.ts (orchestrator)  │
│  ├─ DashboardBody  │              │  ├─ inputListener             │
│  ├─ DashboardFooter│              │  ├─ channelDispatch           │
│  ├─ SequencerGrid  │              │  ├─ methodExecutor            │
│  ├─ TrackItem      │              │  └─ TrackSandboxHost          │
│  └─ 15 Modal types │              │                                │
│                    │              │  ┌────────────────────────┐   │
│  State: Jotai atoms│              │  │  SANDBOX (BrowserView) │   │
│  ├─ userDataAtom   │              │  │  (Isolated renderer)   │   │
│  ├─ activeTrackId  │              │  │                        │   │
│  ├─ recordingData  │              │  │  moduleSandboxEntry.ts │   │
│  └─ flashingChans  │              │  │  ├─ Module class cache │   │
│                    │              │  │  ├─ Instance registry  │   │
│  Playback:         │              │  │  ├─ RPC message loop   │   │
│  ├─ SequencerPlay  │              │  │  └─ SDK (assets, etc.) │   │
│  └─ Tone.js        │              │  └────────────────────────┘   │
└────────────────────┘              └──────────────────────────────┘
```

### 3 Processes

| Process | Role | Entry Point | Renderer |
|---------|------|-------------|----------|
| **Main** | Node.js backend — IPC hub, input hardware, file I/O, sandbox lifecycle | `src/main/mainProcess/entry.ts` | None |
| **Dashboard** | React UI — track/pattern editing, settings, modal system | `src/dashboard/entry.ts` → `Dashboard.js` | Webpack-bundled |
| **Projector** | Visual output — module instantiation, method execution | `src/projector/entry.ts` → `Projector.ts` | Webpack-bundled |
| **Sandbox** | Isolated BrowserView inside Projector — runs user module code | `src/projector/moduleSandboxEntry.ts` | Loaded via `nw-sandbox://` protocol |

---

## 2. Signal Flow (The Core Pipeline)

This is the beating heart. Every visual trigger — sequencer step, MIDI note, OSC message, audio band — flows through this pipeline:

```
Signal Source
    │
    ▼
┌──────────────────────────────────────────────────────────────┐
│ 1. SIGNAL ORIGIN                                              │
│    ├─ Sequencer: SequencerPlayback.tick() → onStepCallback   │
│    ├─ MIDI: InputManager.initMIDI() → noteon listener        │
│    ├─ OSC: InputManager.initOSC() → UDPPort.on("message")   │
│    ├─ Audio: Dashboard audio capture → emitBand IPC          │
│    └─ File: Dashboard file playback → emitBand IPC           │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│ 2. NORMALIZATION                                              │
│    InputManager.broadcast() → normalizeInputEventPayload()   │
│    Produces: { type: "track-selection" | "method-trigger",   │
│               data: { note, channel, velocity, source, ... } │
│             }                                                 │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│ 3. IPC BROADCAST                                              │
│    Main → Dashboard webContents.send("input-event", payload) │
│    Main → Projector webContents.send("input-event", payload) │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│ 4. PROJECTOR INPUT LISTENER (inputListener.ts)                │
│    Receives "input-event" → routes by type:                   │
│    ├─ "track-selection" → handleTrackSelection(trackName)    │
│    └─ "method-trigger"  → resolves channel mapping           │
│                            → handleChannelMessage("/Ableton/N") │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│ 5. CHANNEL DISPATCH (channelDispatch.ts)                      │
│    Resolves channelPath → target modules via handler map     │
│    For each target:                                           │
│    ├─ Matrix methods → sandbox.setMatrixForInstance()         │
│    └─ Other methods  → executeMethods()                      │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│ 6. METHOD EXECUTION (methodExecutor.ts)                       │
│    For each method:                                           │
│    ├─ buildMethodOptions() (randomization, no-repeat cache)  │
│    └─ sandbox.invokeOnInstance(instanceId, methodName, opts) │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│ 7. SANDBOX EXECUTION (moduleSandboxEntry.ts)                  │
│    Receives RPC → finds instance → calls instance[method]()  │
│    Instance is a ModuleBase subclass with DOM element         │
│    Methods manipulate CSS transforms/visibility/filters       │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. Data Model

### 3.1 UserData (The God Object)

The entire application state lives in `userData.json`. This is the central persistence artifact:

```typescript
// Reconstructed from validation code + usage patterns
type UserData = {
  config: {
    sequencerMode: boolean;
    input: InputConfig;
    trackMappings: {
      midi?: Record<string, string>;     // note/pitchClass → trackName
      osc?: Record<string, string>;      // oscAddress → trackName
      audio?: Record<string, string>;    // band → trackName
      file?: Record<string, string>;     // band → trackName
    };
    channelMappings: {
      midi?: Record<string, string[]>;   // note → channelNames
      osc?: Record<string, string[]>;
      audio?: Record<string, string[]>;  // band → channelNames
      file?: Record<string, string[]>;
    };
    bpm?: number;
    aspectRatio?: string;
    bgColor?: string;
  };
  sets: Array<{
    id: string;
    name: string;
    tracks: Array<Track>;
  }>;
};

type Track = {
  id: string;
  name: string;
  modules: Array<{
    id: string;        // instanceId
    type: string;      // moduleType (filename without .js)
    disabled?: boolean;
  }>;
  modulesData: Record<string, {
    constructor: MethodEntry[];          // Methods run on init
    methods: Record<string, MethodEntry[]>; // channelNumber → methods
  }>;
  channelMappings: Record<string, number>; // channelName → slot
  signal: {
    audio: {
      thresholds: { low: number; medium: number; high: number };
      minIntervalMs: number;
    };
    file: {
      thresholds: { low: number; medium: number; high: number };
      minIntervalMs: number;
      assetRelPath: string;
      assetName: string;
    };
  };
  pattern?: Record<string, number[]>;    // channelName → step indices
};

type MethodEntry = {
  name: string;
  options?: Record<string, unknown>;
};
```

### 3.2 InputConfig

```typescript
type InputConfig = {
  type: "midi" | "osc" | "audio" | "file";
  deviceId?: string;
  deviceName?: string;
  trackSelectionChannel: number;
  methodTriggerChannel: number;
  velocitySensitive: boolean;
  noteMatchMode?: "pitchClass" | "exactNote";
  port: number;  // OSC port
};
```

### 3.3 InputEvent (The Signal Envelope)

```typescript
type InputEventPayload =
  | { type: "track-selection"; data: TrackSelectionEventData }
  | { type: "method-trigger"; data: MethodTriggerEventData };

// Discriminated union by source
type MethodTriggerEventData =
  | { source: "midi"; note: number; channel: number; velocity: number; timestamp: number }
  | { source: "osc"; channelName: string; velocity: number; address: string; timestamp: number }
  | { source: "audio"; channelName: string; velocity: number; timestamp: number }
  | { source: "file"; channelName: string; velocity: number; timestamp: number };
```

---

## 4. Module System

### 4.1 Module Contract

Modules are JS files with a strict contract:

1. **Docblock metadata** — `@nwWrld name`, `@nwWrld category`, `@nwWrld imports`
2. **Default export** — Class extending `ModuleBase` or `BaseThreeJsModule`
3. **Static `methods` array** — Declares triggerable methods with option schemas

```javascript
/*
@nwWrld name: My Module
@nwWrld category: 2D
@nwWrld imports: ModuleBase, assetUrl
*/
class MyModule extends ModuleBase {
  static methods = [
    { name: "pulse", executeOnLoad: false, options: [
      { name: "intensity", defaultVal: 1, type: "number", min: 0, max: 10 }
    ]}
  ];
  
  pulse(options) { /* visual logic */ }
}
export default MyModule;
```

### 4.2 ModuleBase Methods (Inherited)

| Method | Purpose | Options |
|--------|---------|---------|
| `show` | Make visible | `duration` (auto-hide after ms) |
| `hide` | Make invisible | `duration` (auto-show after ms) |
| `offset` | Translate position | `x`, `y` (% of viewport) |
| `scale` | Scale transform | `scale` (factor) |
| `opacity` | Set opacity | `opacity` (0-1) |
| `rotate` | Continuous rotation | `direction`, `speed`, `duration` |
| `randomZoom` | Random scale + position | `scaleFrom`, `scaleTo`, `position` |
| `viewportLine` | Draw SVG line from module edge | `x`, `y`, `length`, `opacity` |
| `background` | Set background color | `color` |
| `invert` | CSS invert filter | `duration` |
| `matrix` | Grid layout (rows×cols) | `rows`, `cols`, `excludedCells`, `border` |

### 4.3 Method Option Types

```typescript
type MethodOption = {
  name: string;
  defaultVal: unknown;
  type: "number" | "boolean" | "select" | "color" | "matrix" | "asset";
  min?: number;
  max?: number;
  values?: string[];     // For select type
  unit?: string;         // Display unit (ms, %, etc.)
  allowRandomization?: boolean;
};
```

### 4.4 Sandbox Architecture

Modules execute in an **isolated BrowserView** with:
- `nodeIntegration: false`
- `contextIsolation: true`
- `sandbox: true`

Communication is via a **token-authenticated RPC protocol**:

```
Projector ──[sandbox:ensure]──► Main (creates BrowserView, returns token)
Projector ──[sandbox:request]──► Main ──[sandbox:fromMain]──► Sandbox
Sandbox ──[sandbox:toMain]──► Main ──[resolves Promise]──► Projector
```

**RPC Message Types**:
- `initTrack` — Initialize all modules for a track
- `destroyTrack` — Tear down all module instances
- `invokeOnInstance` — Call a method on a specific instance
- `setMatrixForInstance` — Reconfigure grid layout
- `introspectModule` — Extract method metadata from source
- `sdk:readAssetText` — Read workspace asset file
- `sdk:listAssets` — List workspace asset directory

---

## 5. State Management

### 5.1 Dashboard State (Jotai)

The Dashboard uses **Jotai atoms** for reactive state:

```typescript
// Core atoms (src/dashboard/core/state.ts)
userDataAtom        // { config, sets } — the entire user data
recordingDataAtom   // Recording state
activeTrackIdAtom   // Currently selected track
activeSetIdAtom     // Currently selected set
selectedChannelAtom // Currently focused channel
flashingChannelsAtom // Visual feedback set
helpTextAtom        // Help tooltip text
```

### 5.2 Projector State (Mutable Object)

The Projector uses a **plain mutable object** (`Projector.ts`):

```typescript
const Projector = {
  activeTrack: null,
  activeModules: {},              // instanceId → module instances
  activeChannelHandlers: {},      // channelNumber → targets
  moduleClassCache: new Map(),
  workspaceModuleSourceCache: new Map(),
  methodOptionNoRepeatCache: new Map(),
  runtimeMatrixOverrides: new Map(),
  trackSandboxHost: null,
  userData: [],
  // ... 20+ mutable fields
};
```

**This is the biggest architectural weakness.** The Projector is a god-object with mutable state, `this`-binding everywhere, and no service boundaries.

### 5.3 Persistence

JSON files written via an atomic write pattern:
- `userData.json` — Tracks, settings, mappings
- `appState.json` — Active set, workspace path
- `config.json` — Aspect ratio, colors
- `recordingData.json` — Recorded sequences

---

## 6. IPC Bridge Architecture

The main process registers **10 IPC bridge modules**:

| Bridge | Purpose | Key Channels |
|--------|---------|--------------|
| `registerProjectBridge` | Project folder selection | `workspace:select` |
| `registerWorkspaceBridge` | Module source reading | `workspace:readModule` |
| `registerJsonBridge` | JSON file I/O | `json:read`, `json:write` |
| `registerAppBridge` | App metadata | `app:getVersion` |
| `registerOsBridge` | OS operations | `os:openExternal` |
| `registerInputBridge` | Input device management | `input:initialize`, `input:disconnect` |
| `registerTestMidiBridge` | Test MIDI devices | `input:midi:getDevices` |
| `registerTestAudioBridge` | Audio band emission | `input:audio:emitBand` |
| `registerTestFileBridge` | File audio band emission | `input:file:emitBand` |
| `registerLogBridge` | Logging | `log:toMain` |

### Cross-Process Messaging

```
Dashboard ──[dashboard-to-projector]──► Projector
Projector ──[from-projector]──► Dashboard
Main ──[input-event]──► Dashboard + Projector
Main ──[input-status]──► Dashboard
Main ──[workspace:modulesChanged]──► Dashboard + Projector
```

---

## 7. Sequencer Engine

`SequencerPlayback` wraps **Tone.js Transport** for clock-accurate scheduling:

```
Tone.Transport.scheduleRepeat(tick, "16n")
    │
    ▼
tick(time, runId):
    1. Check pattern: which channels have this step active?
    2. Collect channelNames to trigger
    3. Call onStepCallback(stepIndex, channelsToTrigger, time, runId)
         │
         ▼
    Dashboard receives callback:
        4. Flash UI channels
        5. Send to Projector via IPC
             │
             ▼
        Projector handleChannelMessage() → executeMethods()
```

**Key design**: `runId` prevents stale callbacks from previous play sessions.

---

## 8. Workspace / Project Folder Model

Each project is a self-contained directory:

```
MyProject/
├── modules/           # User visual modules (.js files)
├── assets/
│   ├── images/        # Loadable via assetUrl()
│   └── json/          # Loadable via loadJson()
└── nw_wrld_data/
    └── json/          # App persistence files
```

The workspace is watched via `fs.watch()` with debounced change detection:
1. File change detected in `modules/`
2. Wait for settle (6 attempts × 120ms)
3. Broadcast `workspace:modulesChanged` to all windows
4. Dashboard re-introspects modules
5. Projector reloads module sources

---

## 9. Validation Layer

Extensive validation exists in `src/shared/validation/`:

| Validator | Purpose |
|-----------|---------|
| `userDataValidation.ts` | Deep normalization of userData structure |
| `inputEventValidation.ts` | Normalize input event payloads |
| `inputConfigValidation.ts` | Validate input configuration |
| `sandboxValidation.ts` | Sanitize sandbox RPC props/results |
| `oscValidation.ts` | Validate OSC addresses |
| `pathSafetyValidation.ts` | Prevent path traversal |
| `optionValidator.ts` | Validate method option values |
| `workspaceValidation.ts` | Validate workspace structure |

---

## 10. Critical Observations for Fork

### 10.1 Strengths to Preserve

1. **Signal abstraction** — The `InputEventPayload` discriminated union is clean
2. **Sandbox security model** — Token-based auth, BrowserView isolation
3. **Module contract** — Docblock metadata + class convention is extensible
4. **Validation layer** — Deep normalization prevents corrupted state
5. **Hot reload** — fs.watch + debounce + settle detection is battle-tested

### 10.2 Architectural Weaknesses (Fork Targets)

1. **Projector god-object** — Mutable state, `this`-binding, no service boundaries. **Effect.Service with Ref/Atom is the obvious replacement.**

2. **Imperative IPC** — Raw `ipcMain.handle` / `webContents.send`. **Replace with Effect-based request/response with Schema validation.**

3. **InputManager class** — Classic OOP with mutable state. **Replace with Effect.Service + tagged union for source types.**

4. **No remote/HTTP signal source** — Roadmap item. **Effect HttpClient + Stream for WebSocket/SSE inputs.**

5. **Raw TypeScript types** — All data types are plain interfaces. **Replace with Effect Schema for runtime validation + type inference.**

6. **Jotai atoms in Dashboard** — Good but disconnected from services. **Migrate to effect-atom for unified state.**

7. **No error recovery** — Try/catch everywhere, errors silently swallowed. **Effect error channel with typed failures.**

8. **No observability** — Console.log debugging. **Effect spans + structured logging.**

9. **Sequencer tightly coupled to Tone.js** — **Abstract behind Effect.Service for swappable clock sources.**

10. **No signal composition** — Signals are point-to-point. **Add signal combinators: merge, filter, map, debounce via Effect Stream.**

### 10.3 Fork Strategy: Effect-Native Redesign

#### Phase 1: Core Services
- `SignalSource.Service` — Tagged union: Sequencer | MIDI | OSC | Audio | File | **HTTP** | **WebSocket** | **Arbitrary**
- `InputManager.Service` — Effect-based, replacing the class
- `ModuleRegistry.Service` — Module loading, caching, introspection
- `SandboxManager.Service` — Sandbox lifecycle + RPC
- `ProjectManager.Service` — Workspace/project folder management

#### Phase 2: Signal Pipeline
- `Signal.Schema` — Effect Schema for all signal types
- `SignalStream` — `Stream<Signal>` for each source
- `SignalRouter` — Pattern matching on signal type → track/channel dispatch
- `SignalCombinator` — `merge`, `filter`, `map`, `throttle`, `debounce`

#### Phase 3: Remote API Input
- `RemoteSignalSource` — HTTP polling, WebSocket, SSE
- `SignalTransform` — Normalize external API responses to Signal schema
- `SignalBuffer` — Backpressure-aware buffering for high-rate sources

#### Phase 4: SIGINT/OSINT Magic
- Arbitrary signal adapters (RSS, webhooks, sensor data, social feeds)
- Signal enrichment pipeline (metadata injection, scoring, filtering)
- Signal recording + replay (Effect EventLog)

---

## 11. Dependency Map

### Runtime Dependencies

| Package | Version | Used By | Fork Relevance |
|---------|---------|---------|----------------|
| `react` | ^18.3.1 | Dashboard UI | Keep |
| `jotai` | ^2.10.0 | Dashboard state | **Replace with effect-atom** |
| `three` | ^0.159.0 | 3D modules | Keep |
| `p5` | ^1.9.0 | 2D modules | Keep |
| `d3` | ^7.9.0 | Data viz modules | Keep |
| `tone` | ^15.1.22 | Sequencer clock | **Abstract behind Effect.Service** |
| `webmidi` | ^3.1.7 | MIDI input | **Wrap in Effect** |
| `osc` | ^2.4.4 | OSC input | **Wrap in Effect** |
| `immer` | ^10.1.1 | State updates | **Remove (Effect handles this)** |
| `@dnd-kit/*` | ^6-8 | Drag-and-drop | Keep |
| `@tweenjs/tween.js` | ^23.1.3 | Animations | **Replace with animatable()** |
| `noisejs` | ^2.1.0 | Perlin noise | Keep |
| `react-icons` | ^5.3.0 | UI icons | Keep |

### New Dependencies for Fork

| Package | Purpose |
|---------|---------|
| `effect` | Core runtime, Schema, Service, Stream |
| `@effect/platform` | HTTP client, WebSocket, FileSystem |
| `effect-atom` | Reactive state for React |
| `@effect/experimental` | EventLog for signal recording |

---

## 12. File-to-Concept Index

### Signal Pipeline
- `src/main/InputManager.ts` — Signal source management (MIDI, OSC, Audio, File)
- `src/projector/internal/inputListener.ts` — Signal routing in Projector
- `src/projector/internal/track/channelDispatch.ts` — Channel → module dispatch
- `src/projector/internal/track/methodExecutor.ts` — Method invocation on instances
- `src/shared/sequencer/SequencerPlayback.ts` — Built-in 16-step sequencer

### Module System
- `src/projector/helpers/moduleBase.ts` — Base class for all visual modules
- `src/projector/helpers/threeBase.ts` — Three.js base class
- `src/projector/moduleSandboxEntry.ts` — Sandbox runtime (module loading, RPC)
- `src/shared/nwWrldDocblock.ts` — Module metadata parser
- `src/shared/utils/sdkHelpers.ts` — SDK API (assetUrl, readText, loadJson)
- `src/main/starter_modules/` — 21 starter module templates

### IPC & Process Communication
- `src/main/mainProcess/ipcBridge.ts` — Bridge registration hub
- `src/main/mainProcess/ipcBridge/*.ts` — 10 bridge modules
- `src/projector/internal/bridge.ts` — Projector-side bridge types
- `src/main/mainProcess/sandbox.ts` — Sandbox lifecycle + RPC routing

### State & Persistence
- `src/dashboard/core/state.ts` — Jotai atoms
- `src/shared/json/jsonFileBase.ts` — JSON file I/O abstraction
- `src/shared/json/atomicWrite.ts` — Safe write with backup
- `src/shared/validation/userDataValidation.ts` — Deep state normalization

### Workspace
- `src/main/mainProcess/workspace.ts` — Project scaffold, watcher, migration
- `src/main/workspaceStarterModules.ts` — Starter module seeding
- `src/main/workspaceStarterAssets.ts` — Starter asset seeding

### Dashboard UI
- `src/dashboard/Dashboard.js` — Main component (300+ lines, 60+ hooks)
- `src/dashboard/components/` — 20 UI components
- `src/dashboard/modals/` — 15 modal types
- `src/dashboard/core/hooks/` — 18 custom hooks

### Types
- `src/types/userData.ts` — InputConfig type
- `src/types/input.ts` — Input event types (discriminated unions)
- `src/types/nwWrldBridge.d.ts` — Bridge type declarations

---

## 13. Key Patterns Worth Understanding

### Pattern 1: Method Options with Randomization

```typescript
// Methods can declare options with `allowRandomization: true`
// At execution time, buildMethodOptions() resolves:
//   - Static values → pass through
//   - randomRange: { min, max } → random value in range
//   - noRepeat cache → prevents same random value consecutively
```

### Pattern 2: Matrix Grid System

```
A single module instance can be displayed in a grid layout:
  matrix: { rows: 3, cols: 3, excludedCells: ["2-2"] }
  
  ┌─────┬─────┬─────┐
  │ 1-1 │ 1-2 │ 1-3 │  Each cell gets its own ModuleBase instance
  ├─────┼─────┼─────┤  sharing the same class but independent state
  │ 2-1 │     │ 2-3 │  (cell 2-2 excluded)
  ├─────┼─────┼─────┤
  │ 3-1 │ 3-2 │ 3-3 │
  └─────┴─────┴─────┘
```

### Pattern 3: Module Introspection

The sandbox can introspect a module's class without instantiating it:
1. Load source → inject import preamble
2. Dynamic `import()` via blob URL
3. Walk prototype chain for callable methods
4. Merge base methods with declared methods
5. Return metadata to Dashboard for UI generation

### Pattern 4: Workspace Module Import Injection

User modules declare imports via docblock:
```
@nwWrld imports: ModuleBase, THREE, assetUrl
```

The sandbox injects a preamble before execution:
```javascript
const { ModuleBase } = globalThis.nwWrldSdk;
const THREE = globalThis.THREE;
const { assetUrl } = globalThis.nwWrldSdk;
```

This provides SDK access without giving modules direct runtime access.

---

## 14. Signal Type Taxonomy (For SIGINT/OSINT Extension)

Current signal types form a clean taxonomy that can be extended:

```
Signal
├── Internal
│   └── Sequencer (step-based, clock-driven)
├── Hardware
│   ├── MIDI (note-based, channel-routed)
│   └── Audio Capture (band-based, threshold-driven)
├── Network
│   └── OSC (address-based, value-typed)
├── File
│   └── Audio File (band-based, playback-driven)
│
│ ── PROPOSED EXTENSIONS ──
│
├── Remote API
│   ├── HTTP Poll (interval-based, transform-driven)
│   ├── WebSocket (stream-based, event-driven)
│   └── SSE (stream-based, event-driven)
├── Feed
│   ├── RSS/Atom (poll-based, entry-driven)
│   ├── Webhook (push-based, payload-driven)
│   └── Social API (poll/stream, entity-driven)
├── Sensor
│   ├── Serial Port (hardware sensor data)
│   └── GPIO (hardware signal)
└── Computed
    ├── Signal Merge (combine multiple sources)
    ├── Signal Filter (predicate-based)
    ├── Signal Map (transform payload)
    └── Signal Aggregate (window-based reduction)
```

---

*End of analysis. The scalpel is sharp, Prime. Where do we cut first?*
