# Doc Set 01 — Signal Pipeline & Input Architecture

> **Scope**: `InputManager.ts`, `inputListener.ts`, `channelDispatch.ts`, `methodExecutor.ts`, `SequencerPlayback.ts`, input types, validation  
> **Tsingou Replacement**: Replace with `@tmnl/tsingou-flow` — Effect.Service adapters, Stream composition, d2ts differential dataflow

---

## 1. Signal Flow Summary

Every visual trigger in nw_wrld — sequencer step, MIDI note, OSC message, audio band — flows through a 7-stage pipeline:

```
Signal Origin → Normalization → IPC Broadcast → Input Listener → Channel Dispatch → Method Execution → Sandbox Execution
```

### Stage-by-Stage

| # | Stage | File | Process | Description |
|---|-------|------|---------|-------------|
| 1 | **Signal Origin** | `InputManager.ts` | Main | Hardware/software source produces raw event |
| 2 | **Normalization** | `inputEventValidation.ts` | Main | `normalizeInputEventPayload()` → typed `InputEventPayload` |
| 3 | **IPC Broadcast** | `InputManager.broadcast()` | Main | `webContents.send("input-event", payload)` to Dashboard + Projector |
| 4 | **Input Listener** | `inputListener.ts` | Projector | Routes by `type`: `track-selection` vs `method-trigger` |
| 5 | **Channel Dispatch** | `channelDispatch.ts` | Projector | Resolves `channelPath` → target modules via handler map |
| 6 | **Method Execution** | `methodExecutor.ts` | Projector | `buildMethodOptions()` + `sandbox.invokeOnInstance()` |
| 7 | **Sandbox Execution** | `moduleSandboxEntry.ts` | Sandbox BrowserView | RPC → find instance → `instance[method](opts)` |

---

## 2. InputManager — The Source Hub

**File**: `src/main/InputManager.ts` (~400 lines)  
**Process**: Main (Node.js)  
**Pattern**: Classic OOP class with mutable state

### Constructor

```typescript
class InputManager {
  dashboard: WindowLike | null;
  projector: WindowLike | null;
  currentSource: CurrentSource;  // tagged union: midi | osc | audio | file | null
  config: RuntimeInputConfig | null;
  connectionStatus: InputStatus;  // "disconnected" | "connecting" | "connected" | "error"
  // ... MIDI-specific fields
}
```

### Source Types (Discriminated Union)

```typescript
type CurrentSource =
  | { type: "midi"; instance: WebMidiInput }
  | { type: "osc"; instance: UDPPort }
  | { type: "audio"; instance: { close?: () => unknown } }
  | { type: "file"; instance: { close?: () => unknown } }
  | null;
```

### Initialization Flow

`initialize(config)` → `disconnect()` existing → switch on `config.type`:

| Source | Init Method | Library | Listener Pattern |
|--------|-------------|---------|-----------------|
| MIDI | `initMIDI()` | `webmidi` | `input.addListener("noteon", handler)` |
| OSC | `initOSC()` | `osc` (UDPPort) | `udpPort.on("message", handler)` |
| Audio | `initAudio()` | None (passive) | Dashboard sends `input:audio:emitBand` IPC |
| File | `initFile()` | None (passive) | Dashboard sends `input:file:emitBand` IPC |

### MIDI Details

- WebMIDI enable with configurable timeout (env `NW_WRLD_WEBMIDI_ENABLE_TIMEOUT_MS`, default 8s)
- Device lookup: try by `deviceId` first, then by `deviceName`
- Hot-plug: WebMIDI `connected`/`disconnected` listeners auto-reconnect
- Note routing: `channel === trackSelectionChannel` → track-selection, `channel === methodTriggerChannel` → method-trigger
- Velocity: `rawAttack` (0–127), optionally `velocitySensitive: false` → always 127

### OSC Details

- UDP port binding: `new UDPPort({ localAddress: "0.0.0.0", localPort: port })`
- Address validation: `isValidOSCTrackAddress(address)` → track-selection, `isValidOSCChannelAddress(address)` → method-trigger
- Zero-value filtering: `if (value === 0) return` (noteoff equivalent)

### Broadcast Method

```typescript
broadcast(eventType, data) {
  const payload = { type: eventType, data: { ...data, timestamp: Date.now() / 1000 } };
  const normalized = normalizeInputEventPayload(payload);
  // Send to both Dashboard and Projector windows
  this.dashboard.webContents.send("input-event", normalized);
  this.projector.webContents.send("input-event", normalized);
}
```

---

## 3. Input Event Types

**File**: `src/types/input.ts`

### InputEventPayload (The Signal Envelope)

```typescript
type InputEventPayload =
  | { type: "track-selection"; data: TrackSelectionEventData }
  | { type: "method-trigger"; data: MethodTriggerEventData };
```

### Method Trigger Data (Discriminated by `source`)

```typescript
type MethodTriggerEventData =
  | { source: "midi"; note: number; channel: number; velocity: number; timestamp: number }
  | { source: "osc"; channelName: string; velocity: number; address: string; timestamp: number }
  | { source: "audio"; channelName: string; velocity: number; timestamp: number }
  | { source: "file"; channelName: string; velocity: number; timestamp: number };
```

---

## 4. Input Listener (Projector Side)

**File**: `src/projector/internal/inputListener.ts`  
**Process**: Projector renderer  
**Pattern**: `this`-bound method on Projector god-object

### Routing Logic

Receives `input-event` IPC → discriminates on `type`:

1. **`track-selection`**: Lookup `midiConfig.trackTriggersMap[key]` → `handleTrackSelection(trackName)`
2. **`method-trigger`**: Lookup `midiConfig.channelMappings[trackName][key]` → for each channel: `handleChannelMessage("/Ableton/{channelName}")`

### Note Match Modes

```
noteMatchMode: "pitchClass" → MIDI note 60 (C4) maps to pitchClass 0 (C) — octave-agnostic
noteMatchMode: "exactNote"  → MIDI note 60 maps to note 60 — octave-specific
```

---

## 5. Channel Dispatch

**File**: `src/projector/internal/track/channelDispatch.ts`  
**Process**: Projector renderer

### Handler Map

`buildChannelHandlerMap(track)` builds: `Record<channelNumber, Array<{ instanceId, moduleType }>>`

Walks `track.modules` × `track.modulesData` to find which modules have methods assigned to each channel number.

### Dispatch Logic

For each channel target:
1. Check if any methods are `matrix` → `sandbox.setMatrixForInstance()` (grid layout update)
2. Non-matrix methods → `executeMethods(methods, instanceId, moduleInstances)`

Both execute in parallel via `Promise.all`.

---

## 6. Sequencer Engine

**File**: `src/shared/sequencer/SequencerPlayback.ts`  
**Library**: Tone.js Transport

### Clock

```
Tone.Transport.scheduleRepeat(tick, "16n")  // 16th note resolution
```

### Tick Callback

```typescript
tick(time, runId) {
  1. Check pattern: which channels have this step active?
  2. Collect channelNames to trigger
  3. Call onStepCallback(stepIndex, channelsToTrigger, time, runId)
}
```

`runId` prevents stale callbacks from previous play sessions.

---

## Tsingou Design Derivation

| nw_wrld Component | Tsingou Replacement | Key Change |
|---|---|---|
| `InputManager` class | `AdapterManager` Effect.Service | OOP → scoped service, `Atom.make()` state |
| `broadcast()` to IPC | `Queue.offer(signalQueue, signal)` | IPC → in-process queue |
| `normalizeInputEventPayload()` | `Schema.decodeUnknown(BaseSignal)` | Runtime validation → Effect.Schema |
| `inputListener.ts` (this-bound) | `TsingouFlow.processCycle` | Mutable context → pure drain loop |
| `channelDispatch.ts` | d2ts derived graph | Imperative routing → differential dataflow |
| `SequencerPlayback` + Tone.js | Custom clock adapter + `Effect.repeat(Schedule)` | Library coupling → service abstraction |
| MIDI via `webmidi` | `HolonetBridgeAdapter` (sidecar) | Direct hardware → NATS bridge |
| OSC via `osc` UDPPort | `HolonetBridgeAdapter` (sidecar) | Direct UDP → NATS bridge |
| Audio/File passive | `HttpSourceAdapter` (poll/SSE) | IPC push → HTTP adapter |
| 4 source types | 8+ adapters (NATS, HTTP, WS, RSS, FileWatch, Serial, MIDI, OSC) | Fixed set → extensible |

---

## 8. Key Code Excerpts

### InputManager.broadcast() — The Normalization Gate

```typescript
// src/main/InputManager.ts:183-200
broadcast(eventType, data) {
  const payload = { type: eventType, data: { ...data, timestamp: Date.now() / 1000 } };
  const normalized = normalizeInputEventPayload(payload);
  if (!normalized) {
    console.warn("[InputManager] Invalid input-event payload:", payload);
    return;
  }
  // Fan-out to both windows
  this.dashboard.webContents.send("input-event", normalized);
  this.projector.webContents.send("input-event", normalized);
}
```

### channelDispatch — Matrix vs Non-Matrix Split

```typescript
// src/projector/internal/track/channelDispatch.ts:95-120
// For each channel target:
const matrixMethod = methods.find(m => m.name === "matrix");
if (matrixMethod) {
  matrixOverridesForChannel.set(instanceId, matrixMethod.options);
}
const nonMatrix = methods.filter(m => m.name !== "matrix");
// Matrix → sandbox.setMatrixForInstance()
// Non-matrix → executeMethods()
```

### Tsingou Equivalent — Signal Queue Push

```typescript
// src/lib/tsingou-flow/adapters/types.ts
const push = (signal: BaseSignal): Effect.Effect<void> =>
  Queue.offer(queue, signal).pipe(
    Effect.tap(() => Effect.sync(() => {
      const count = Atom.unsafeGet(signalCountAtom) + 1
      Atom.set(signalCountAtom, count)
      updateHealth({ signalCount: count, lastSignalAt: new Date(), status: 'connected' })
    })),
    Effect.asVoid,
  )
```

---

*End of Doc Set 01. Signal pipeline is the core abstraction — everything else depends on understanding this flow.*
