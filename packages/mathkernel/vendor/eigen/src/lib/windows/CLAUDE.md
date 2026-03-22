# Window System — Agent Documentation

## Overview

TMNL has two distinct window systems:

1. **Emacs-Style Pane System** (`src/lib/windows/`) — Split panes within a single window
2. **Tauri Multi-Window System** (`src/lib/tauri-windows/`) — Multiple OS-level windows

This document covers both, with emphasis on the Tauri window pooling system for instant window loading.

---

## 1. Emacs-Style Pane System (`src/lib/windows/`)

### Purpose
Emacs-inspired pane management within a single window. Split, navigate, resize panes.

### Hotkeys (C-x prefix)
| Binding | Command | Action |
|---------|---------|--------|
| `C-x 2` | `window.split-below` | Split horizontal (below) |
| `C-x 3` | `window.split-right` | Split vertical (right) |
| `C-x o` | `window.next` | Focus next pane |
| `C-x O` | `window.prev` | Focus previous pane |
| `C-x 0` | `window.close` | Close current pane |
| `C-x 1` | `window.close-others` | Close other panes |

### Architecture
```
src/lib/windows/
├── atoms/index.ts       # State: rootPaneAtom, focusedPaneIdAtom, windowActions
├── schemas/index.ts     # Types: PaneNode, ContentPane, SplitPane
├── components/
│   ├── WindowProvider.tsx   # Wraps content, registers hotkeys
│   ├── WindowManager.tsx    # Renders recursive pane tree
│   └── RoutePane.tsx        # Renders route content in pane
├── hotkeys/index.ts     # Registers C-x bindings
└── index.ts             # Module exports
```

### Key Patterns
```typescript
// Atoms are source of truth
export const rootPaneAtom = Atom.make<PaneNode>(createContentPane('/'))
export const focusedPaneIdAtom = Atom.make<PaneId | null>(null)

// Actions use Effect.sync + overlayRegistry.set()
export const windowActions = {
  splitHorizontal: () => Effect.runSync(splitHorizontalOp),
  nextPane: () => Effect.runSync(nextPaneOp),
  // ...
}
```

---

## 2. Tauri Multi-Window System (`src/lib/tauri-windows/`)

### Purpose
Open testbeds in separate OS-level windows. Supports window pooling for instant loading.

### Quick-Switcher
- **`Ctrl+Shift+N`** → Opens minibuffer with testbed list
- Select testbed → Window opens instantly (if pooled)

### Architecture
```
src/lib/tauri-windows/
├── manager/
│   ├── service.ts      # WindowManagerService (Effect)
│   ├── schemas.ts      # TestbedWindowConfig
│   ├── atoms.ts        # Reactive state
│   └── ipc.ts          # Event handlers
├── sync/
│   ├── index.ts        # Cross-window state sync
│   └── hooks.ts        # useScaleSync, useWindowLabel
├── TestbedWindowProvider.ts  # Minibuffer completion provider
└── index.ts
```

### Service API
```typescript
interface IWindowManagerService {
  // Standard operations
  createTestbedWindow(id, config)     // Slow path (~300ms)
  focusWindow(label)
  closeWindow(label)
  listWindows()

  // Window Pool (FAST PATH)
  initWindowPool()                     // Pre-create hidden windows
  getPoolStatus()                      // { available, target_size }
  openTestbedWindowFast(id, config)   // ~50ms (uses pooled window)

  // Window controls
  minimizeWindow(label)
  maximizeWindow(label)
  setFullscreen(label, bool)
  toggleFullscreen(label)
}
```

---

## 3. Window Pooling — Deep Dive

### The Bottleneck
Creating a new WebView window involves:
1. OS window creation (~20ms)
2. WebView2/WKWebView initialization (~150-300ms)
3. JS bundle load + React mount (~50-100ms)

**Total: 200-400ms** — noticeable lag.

### The Solution: Window Pooling
Pre-create hidden windows at startup. When user requests a window:
1. Take pre-created window from pool (~0ms)
2. Navigate to target URL via JS (~10ms)
3. Show window (~5ms)
4. Replenish pool in background

**Total with pooling: ~50ms** — feels instant.

### Rust Implementation (`src-tauri/src/window_manager.rs`)
```rust
// Pool configuration
const POOL_SIZE: usize = 1;  // Keep low - each WebView2 uses ~80MB

// Pool state (global, thread-safe)
static WINDOW_POOL: Mutex<Vec<String>> = Mutex::new(Vec::new());

// Fast path: claim pooled window
#[tauri::command]
pub async fn open_testbed_window_fast(
    app: AppHandle,
    testbed_id: String,
    config: Option<TestbedWindowConfig>,
) -> Result<String, WindowError> {
    // 1. Check singleton (is window already open?)
    // 2. Try pool.pop()
    // 3. Navigate, show, focus
    // 4. Spawn replenish_pool() in background
    // 5. If pool empty, fall back to slow path
}
```

### Pool Initialization (`src-tauri/src/lib.rs`)
```rust
.setup(|app| {
    // Initialize window pool in background thread
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(1000));  // Wait for event loop
        window_manager::create_pool_window_from_setup(&handle);
    });
    Ok(())
})
```

### Pool Placeholder Route (`src/routes/PoolPlaceholder.tsx`)
```tsx
// Minimal component - just a dark div
export function PoolPlaceholder() {
  return (
    <div style={{ width: '100vw', height: '100vh', backgroundColor: '#09090b' }} />
  )
}
```

---

## 4. Current Configuration

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| `POOL_SIZE` | 5 | Snappy UX for rapid multi-window workflows (~400MB) |
| Init delay | 500ms | Reduced for faster first-window availability |
| Replenish delay | 50ms | Faster pool recovery after use |

### Memory Considerations
- Each WebView2 instance: **~80-120MB** (even when hidden)
- Pool of 5 = ~400-600MB dedicated to pooling
- Trade-off: memory vs. responsiveness (favoring responsiveness)

---

## 5. Optimizations (Implemented)

The following optimizations have been applied:

1. **Reduced init delay**: 1000ms → 500ms (faster first-window availability)
2. **Increased pool size**: 1 → 2 (two instant windows before slow path)
3. **Reduced replenish delay**: 100ms → 50ms (faster pool recovery)

### Future Optimization: Pre-warm Infrastructure
Instead of `/pool-placeholder` rendering nothing, consider:
```tsx
// Load common providers but no testbed-specific content
export function PoolPlaceholder() {
  return (
    <Providers> {/* ScaleProvider, etc */}
      <div style={{ backgroundColor: '#09090b' }} />
    </Providers>
  )
}
```
This pre-warms React context for faster subsequent navigation.

### Code Splitting for Testbeds
Ensure testbed components use `React.lazy()`:
```tsx
const FermionTestbed = React.lazy(() => import('./testbeds/Fermion'))
```

---

## 6. Debugging

### Check Pool Status
```typescript
// In Effect context
const svc = yield* WindowManagerService
const status = yield* svc.getPoolStatus()
console.log(`Pool: ${status.available}/${status.target_size}`)

// Via Tauri invoke
import { invoke } from '@tauri-apps/api/core'
const status = await invoke('get_pool_status')
```

### Rust Logs
```bash
# Pool operations are logged
RUST_LOG=tmnl=debug cargo tauri dev
```

### Timing Measurements
```typescript
const start = performance.now()
await invoke('open_testbed_window_fast', { testbedId: 'fermion' })
console.log(`Window opened in ${performance.now() - start}ms`)
```

---

## 7. Cross-Window State Sync

### Scale Synchronization
```typescript
// In any component
const { syncScale } = useScaleSync()

// When scale changes in main window
syncScale(1.25)  // Broadcasts to all windows
```

### State Synchronization
```typescript
import { broadcastStateChange, subscribeToStateChanges } from '@/lib/tauri-windows'

// Broadcast
broadcastStateChange('theme', { mode: 'dark' })

// Subscribe (in useEffect)
subscribeToStateChanges('theme', (payload) => {
  setTheme(payload.mode)
})
```

---

## 8. Common Issues

### "Pool empty" fallback
If you see "Window pool empty, falling back to slow path" in logs:
- First window claim is expected to work
- Pool replenishes after ~100-200ms
- Rapid successive requests may hit slow path

### WebView2 deadlock on Windows
- All WebView2 creation MUST be from background threads
- Never call `create_pool_window` directly in Tauri commands
- Use `std::thread::spawn()` with appropriate delays

### Window not appearing
Check:
1. `window.show()` was called
2. Window position is on-screen
3. No transparent background issues (macOS only has transparency)

---

## 9. Files Reference

| File | Purpose |
|------|---------|
| `src-tauri/src/window_manager.rs` | Rust window pool + commands |
| `src-tauri/src/lib.rs:83-103` | Pool initialization in setup() |
| `src/lib/tauri-windows/manager/service.ts` | TypeScript Effect service |
| `src/routes/PoolPlaceholder.tsx` | Minimal pool placeholder |
| `src/routes/WindowRoute.tsx` | Actual window content route |
| `src/lib/hotkeys/hooks/useGlobalHotkeys.tsx` | Ctrl+Shift+N handling |
| `src/lib/commands/defaults.ts:203-217` | window.openTestbed command |
