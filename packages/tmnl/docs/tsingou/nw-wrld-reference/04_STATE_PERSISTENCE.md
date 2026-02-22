# Doc Set 04 — State Management & Persistence

> **Scope**: `state.ts` (Jotai atoms), `Projector.ts` (mutable state), `jsonFileBase.ts`, `atomicWrite.ts`, `userDataValidation.ts`, `userData.ts` types  
> **Tsingou Replacement**: Replace Jotai with effect-atom (Atom.make), replace JSON file I/O with @effect/platform FileSystem + Schema encode/decode

---

## 1. State Architecture Overview

nw_wrld has a **split-brain state model**:

| Process | State Library | Pattern | Problem |
|---------|--------------|---------|---------|
| Dashboard | **Jotai** atoms | Reactive, immutable | Disconnected from services |
| Projector | **Mutable object** | Imperative, `this`-binding | God-object, no boundaries |
| Main | **Local variables** | Closures in bridge modules | No reactive access |

---

## 2. Dashboard State (Jotai)

**File**: `src/dashboard/core/state.ts`

### Core Atoms

```typescript
export const userDataAtom = atom<{ config: Record<string, unknown>; sets: unknown[] }>({
  config: {},
  sets: [],
});
export const recordingDataAtom = atom<Record<string, unknown>>({});
export const activeTrackIdAtom = atom<string | number | null>(null);
export const activeSetIdAtom = atom<string | null>(null);
export const selectedChannelAtom = atom<unknown>(null);
export const flashingChannelsAtom = atom<Set<string>>(new Set<string>());
export const flashingConstructorsAtom = atom<Set<string>>(new Set<string>());
export const recordingStateAtom = atom<Record<string, { startTime: number; isRecording: boolean }>>({});
export const helpTextAtom = atom<string>("");
```

### Flash Animation Pattern

`useFlashingChannels()` is the most complex hook — RAF-batched visual feedback:

```typescript
const flashChannel = (channelName, duration = 100) => {
  activeFlashesRef.current.add(channelName);
  pendingUpdatesRef.current.add(channelName);
  scheduleUpdate();  // requestAnimationFrame batched
  setTimeout(() => {
    activeFlashesRef.current.delete(channelName);
    pendingUpdatesRef.current.add(channelName);
    scheduleUpdate();
  }, duration);
};
```

### State Flow

```
JSON file on disk
    │ (read via IPC)
    ▼
userDataAtom (Jotai) ←── Dashboard renders from this
    │ (write via IPC)
    ▼
JSON file on disk
```

Changes flow: UI edit → atom update → IPC write → JSON file.  
Loads flow: App start → IPC read → JSON parse → validation → atom set.

---

## 3. Projector State (God Object)

**File**: `src/projector/Projector.ts`

The Projector is a **mutable singleton** with ~20 fields:

```typescript
const Projector = {
  activeTrack: null,                           // Currently loaded track
  activeModules: {},                           // instanceId → module instances
  activeChannelHandlers: {},                   // channelNumber → targets
  moduleClassCache: new Map(),                 // moduleType → Class
  workspaceModuleSourceCache: new Map(),       // moduleType → source text
  methodOptionNoRepeatCache: new Map(),        // key → last value
  runtimeMatrixOverrides: new Map(),           // instanceId → matrix options
  trackSandboxHost: null,                      // Sandbox connection
  trackModuleSources: null,                    // Module sources for sandbox
  userData: [],                                // Full userData copy
  config: null,                                // Config copy
  isLoadingTrack: false,                       // Loading guard
  debugOverlayActive: false,                   // Debug mode
  // ... more mutable fields
};
```

**This is the primary Effect.Service refactor target.** Each concern becomes a service:

| Current Field | Target Service |
|---------------|---------------|
| `activeTrack`, `activeModules` | `TrackService` |
| `moduleClassCache`, `workspaceModuleSourceCache` | `ModuleRegistryService` |
| `trackSandboxHost` | `SandboxService` |
| `activeChannelHandlers` | Derived from d2ts graph |
| `methodOptionNoRepeatCache` | `MethodExecutionService` |
| `runtimeMatrixOverrides` | `MatrixLayoutService` |

---

## 4. UserData — The God Object

**File**: `src/types/userData.ts` (partial) + reconstructed from validation

The entire application state lives in a single JSON file:

```typescript
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
      audio?: Record<string, string[]>;
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
  modules: Array<{ id: string; type: string; disabled?: boolean }>;
  modulesData: Record<string, {
    constructor: MethodEntry[];
    methods: Record<string, MethodEntry[]>;  // channelNumber → methods
  }>;
  channelMappings: Record<string, number>;   // channelName → slot
  signal: {
    audio: { thresholds: {...}; minIntervalMs: number };
    file: { thresholds: {...}; minIntervalMs: number; assetRelPath: string };
  };
  pattern?: Record<string, number[]>;        // channelName → step indices
};
```

---

## 5. Persistence Layer

### JSON File I/O

**File**: `src/shared/json/jsonFileBase.ts`

Pattern: Read → parse → validate → use. Write → validate → serialize → atomic write.

### Atomic Write

**File**: `src/shared/json/atomicWrite.ts`

```
1. Write to temp file (same directory)
2. Read back and verify JSON parse
3. Rename temp → target (atomic on most filesystems)
4. Keep backup of previous version
```

### Persistence Files

| File | Content | Location |
|------|---------|----------|
| `userData.json` | Tracks, modules, mappings, config | `<project>/nw_wrld_data/json/` |
| `appState.json` | Active set, workspace path | `<project>/nw_wrld_data/json/` |
| `config.json` | Aspect ratio, colors | `<project>/nw_wrld_data/json/` |
| `recordingData.json` | Recorded sequences | `<project>/nw_wrld_data/json/` |

### Migration System

`workspace.ts` handles legacy migration:
- Detects old JSON locations (`src/shared/json/`)
- Copies to project directory (`<project>/nw_wrld_data/json/`)
- Creates backups of originals

---

## 6. Validation Layer

**File**: `src/shared/validation/userDataValidation.ts`

Deep normalization that runs on every load:

```typescript
// Ensures:
// - config object exists with all required fields
// - sets array exists, each set has id/name/tracks
// - each track has modules array, modulesData object
// - channelMappings normalized to Record<string, number>
// - pattern normalized to Record<string, number[]>
// - signal thresholds have numeric values
// - method entries have name + optional options
```

This is a ~300-line validation function that rebuilds missing structure.

---

## Tsingou Design Derivation

| nw_wrld Component | Tsingou Replacement | Key Change |
|---|---|---|
| Jotai atoms (Dashboard) | `Atom.make()` (effect-atom) | Library swap, same reactive pattern |
| Projector mutable object | Multiple `Effect.Service` instances | God-object → bounded services |
| `userData.json` (god object) | Decomposed Effect.Schema per domain | Single file → multiple schemas |
| `jsonFileBase.ts` read/write | `@effect/platform FileSystem.readFileString` + `Schema.decode` | Raw fs → typed Effect pipeline |
| Atomic write pattern | `FileSystem.writeFileString` (already atomic on modern OS) | Manual temp-rename → platform |
| `userDataValidation.ts` (300 lines) | `Schema.decodeUnknown(UserData)` with defaults | Imperative validation → declarative schema |
| Migration system | Schema evolution via `Schema.transform` | Manual migration → schema versioning |

### Effect.Schema Replacement for UserData

```typescript
// Before: 300 lines of imperative validation
const normalized = normalizeUserData(rawJson);

// After: Effect.Schema with defaults
const UserData = Schema.Struct({
  config: Schema.Struct({
    sequencerMode: Schema.optionalWith(Schema.Boolean, { default: () => false }),
    input: InputConfig,
    trackMappings: Schema.optionalWith(TrackMappings, { default: () => ({}) }),
    channelMappings: Schema.optionalWith(ChannelMappings, { default: () => ({}) }),
    bpm: Schema.optionalWith(Schema.Number, { default: () => 120 }),
  }),
  sets: Schema.Array(SetSchema),
});

const result = Schema.decodeUnknownEither(UserData)(rawJson);
```

---

*End of Doc Set 04. State management is where Tsingou diverges most from nw_wrld — Jotai→effect-atom, mutable objects→Effect.Service, single JSON→decomposed Schema types.*
