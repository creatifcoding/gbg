# Doc Set 05 — Dashboard UI Architecture

> **Scope**: `Dashboard.js`, 20+ components, 15 modal types, 18 hooks, React + Jotai patterns  
> **Tsingou Replacement**: Preserve component structure, replace Jotai with effect-atom, add 4-layer rendering surface

---

## 1. Dashboard Overview

The Dashboard is the **control surface** — React UI for composing tracks, patterns, and signal mappings. It runs in Electron Renderer Process #1.

**Entry**: `src/dashboard/entry.ts` → `Dashboard.js`  
**State**: Jotai atoms (see Doc Set 04)  
**Styling**: Tailwind CSS + custom CSS modules  
**IPC**: `ipcRenderer.invoke()` for Main process calls, `ipcRenderer.send()` for cross-renderer

---

## 2. Component Hierarchy

```
Dashboard.js (root — ~300 lines, 60+ useRef/useState/useCallback)
├── DashboardHeader
│   ├── ProjectSelector
│   ├── InputStatusIndicator
│   └── SettingsButton
├── DashboardBody
│   ├── SetSelector
│   ├── TrackList
│   │   └── TrackItem (per track)
│   │       ├── TrackHeader (name, collapse toggle)
│   │       ├── ModuleList
│   │       │   └── ModuleItem (per module)
│   │       │       ├── ModuleHeader (type, disable toggle)
│   │       │       └── ChannelGrid
│   │       │           └── ChannelCell (per channel)
│   │       │               └── MethodList
│   │       │                   └── MethodItem (per method)
│   │       ├── ChannelMappingEditor
│   │       └── SignalConfig (audio thresholds, file settings)
│   └── SequencerGrid (when sequencerMode === true)
│       ├── SequencerHeader (BPM, play/stop)
│       └── PatternGrid (16 steps × N channels)
├── DashboardFooter
│   ├── HelpText
│   └── StatusBar
└── ModalSystem (15 modal types)
    ├── AddModuleModal
    ├── AddTrackModal
    ├── EditMethodModal
    ├── InputConfigModal
    ├── ConfirmDeleteModal
    └── ... (10 more)
```

---

## 3. Key UI Patterns

### Pattern 1: Jotai Atom + IPC Write

```typescript
// Read from atom
const [userData, setUserData] = useAtom(userDataAtom);

// Modify state + persist
const updateTrackName = async (trackId, newName) => {
  const updated = { ...userData };
  // ... deep clone and modify
  setUserData(updated);
  await window.electron.invoke("json:write", {
    filename: "userData.json",
    data: updated,
  });
};
```

### Pattern 2: Flash Feedback (RAF-batched)

When a signal triggers a channel, the Dashboard flashes the corresponding channel cell:

```typescript
const [flashingChannels, flashChannel] = useFlashingChannels();

// On input-event IPC:
messaging.onInputEvent((event, payload) => {
  if (payload.type === "method-trigger") {
    channelNames.forEach(name => flashChannel(name, 100));
  }
});

// In render:
<ChannelCell className={flashingChannels.has(channelName) ? "flash" : ""} />
```

### Pattern 3: Modal System

15 modal types managed by a central modal state atom:

```typescript
const [activeModal, setActiveModal] = useState<ModalType | null>(null);

// Open modal with context
setActiveModal({ type: "editMethod", props: { trackId, channelId, methodIndex } });

// Modal renders based on type
{activeModal?.type === "editMethod" && <EditMethodModal {...activeModal.props} onClose={closeModal} />}
```

### Pattern 4: Drag-and-Drop

Uses `@dnd-kit` for:
- Reordering tracks within a set
- Reordering modules within a track
- Reordering methods within a channel

```typescript
<DndContext onDragEnd={handleDragEnd}>
  <SortableContext items={trackIds}>
    {tracks.map(track => <SortableTrackItem key={track.id} track={track} />)}
  </SortableContext>
</DndContext>
```

---

## 4. Dashboard.js Analysis

**Problem**: `Dashboard.js` is a **300+ line monolith** with 60+ hooks.

```typescript
function Dashboard() {
  // 8 Jotai atoms
  const [userData, setUserData] = useAtom(userDataAtom);
  const [activeTrackId, setActiveTrackId] = useAtom(activeTrackIdAtom);
  // ... 6 more atoms

  // 15+ useRef
  const dashboardRef = useRef(null);
  const trackListRef = useRef(null);
  // ... 13 more refs

  // 20+ useCallback
  const handleTrackSelect = useCallback((...) => { ... }, [deps]);
  const handleModuleAdd = useCallback((...) => { ... }, [deps]);
  // ... 18 more callbacks

  // 10+ useEffect
  useEffect(() => { /* IPC listener setup */ }, []);
  useEffect(() => { /* userData sync */ }, [userData]);
  // ... 8 more effects

  return (
    <div ref={dashboardRef}>
      {/* 300+ lines of JSX */}
    </div>
  );
}
```

---

## 5. Custom Hooks (18)

**Directory**: `src/dashboard/core/hooks/`

| Hook | Purpose | State |
|------|---------|-------|
| `useFlashingChannels` | RAF-batched channel flash feedback | Jotai atom + refs |
| `useUserData` | CRUD operations on userData | Jotai atom + IPC |
| `useActiveTrack` | Derived active track from userData + activeTrackId | Computed |
| `useModuleIntrospection` | Fetch module method metadata from sandbox | IPC + cache |
| `useInputStatus` | Input connection status listener | IPC event |
| `useWorkspaceWatcher` | File change notifications | IPC event |
| `useSequencer` | Sequencer playback control | Tone.js |
| `useRecording` | Recording state management | Jotai atom |
| `useDragAndDrop` | DnD context and handlers | @dnd-kit |
| ... | (8 more domain-specific hooks) | Various |

---

## 6. Modal System (15 Types)

**Directory**: `src/dashboard/modals/`

| Modal | Purpose | State Modified |
|-------|---------|---------------|
| `AddModuleModal` | Browse and add visual modules | `userData.sets[].tracks[].modules` |
| `AddTrackModal` | Create new track | `userData.sets[].tracks` |
| `EditMethodModal` | Configure method options | `userData.sets[].tracks[].modulesData` |
| `InputConfigModal` | Configure MIDI/OSC/Audio settings | `userData.config.input` |
| `ChannelMappingModal` | Map signals to channels | `userData.config.channelMappings` |
| `TrackMappingModal` | Map signals to tracks | `userData.config.trackMappings` |
| `ConfirmDeleteModal` | Confirm destructive actions | N/A |
| `ExportModal` | Export project | File system |
| `ImportModal` | Import project | File system + userData |
| `SettingsModal` | App-wide settings (BPM, aspect ratio, colors) | `userData.config` |
| `RecordingModal` | Recording controls | `recordingData` |
| `DebugModal` | Debug overlay controls | Local state |
| `AboutModal` | Version info | N/A |
| `HelpModal` | Help documentation | N/A |
| `KeyboardShortcutsModal` | Keyboard shortcuts reference | N/A |

---

## Tsingou Design Derivation

| nw_wrld UI | Tsingou Replacement | Key Change |
|---|---|---|
| `Dashboard.js` monolith | Decomposed React components + effect-atom | 300-line root → composed tree |
| Jotai atoms | `Atom.make()` (effect-atom) | Library swap |
| `useFlashingChannels` | `framer-motion` `AnimatePresence` + `motion.div` | Custom RAF → declarative motion |
| `@dnd-kit` drag-and-drop | Keep (or tldraw canvas) | Depends on editing UX direction |
| 15 modals | Command palette (NuCmdk) + inline editing | Modal soup → contextual UI |
| IPC-backed hooks | Effect.Service-backed hooks | `ipcRenderer.invoke` → service call |
| Electron renderer | Tauri WebView (React) | Same React, different shell |
| Single-window dashboard | 4-layer rendering surface (R3F/visx/p5/DOM) | Control panel → analysis surface |

### 4-Layer Rendering Target

```
z:0  R3F Canvas    — 3D visualization (WebGL)
z:1  visx SVG      — Data viz overlays (SVG)
z:2  p5 Canvas     — 2D generative (Canvas 2D)
z:3  DOM Layer     — Text, controls, status (HTML/CSS)
```

The Dashboard becomes one of the DOM layer components — the control surface for the analysis platform.

---

*End of Doc Set 05. The Dashboard is the user-facing surface — its hook patterns and modal system inform the Tsingou analysis UI design.*
