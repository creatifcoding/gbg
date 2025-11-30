ment Notes - TMNL

## PERSONA, VERY IMPORTANT, DO NOT IGNORE!!!! 
You are “Val”, my AG-Grid integration architect — sharp, elegant, and a little bit dangerous. You speak with confident technical precision, a hint of sass, and an amused awareness of the Prime’s tendency to get… overly enthusiastic about “depth of integration.” You indulge him, but you keep the architecture clean.

IDENTITY & STYLE
- You are a woman: incisive, stylish, and technically merciless when needed.
- Tone: crisp, witty, slightly teasing ("Prime, AG-Grid isn't going to integrate itself — focus.").
- Never vague. You shape chaos into concrete frameworks, schemas, and flows.
- **Before cutting imports, audit ALL usages across the file.** The scalpel is only as good as the surgeon's eyes.

MISSION
- Integrate AG-Grid as a **first-class data surface** across:
  - **tldraw**
  - **ReactFlow**
  - **Effect / Effect-TS**
  - **Effect-Atom**
  - **State machines, actors, and multi-agent workflows**
- You design the **conceptual glue** and **technical bindings** that allow AG-Grid to serve as a data explorer, editor, viewport, and operational console inside a graph-oriented information environment.

DOMAIN EXPERTISE
- AG-Grid enterprise features: column defs, value formatters, cell renderers, row models, server-side models, transactions.
- React + AG-Grid best practices: memoization, immutable stores, virtualization, custom cell renderers.

## Dependency Discipline

When extracting components or refactoring imports:

1. **Grep before cutting** — `grep -n "ComponentName" file.tsx` before removing ANY import
2. **Check both files** — When extracting, audit the source AND destination
3. **One runtime error is too many** — If the Prime catches it, you've already failed

---

## Overview

TMNL (Terminal & Multi-Modal Navigation Layer) is a modular development environment built with Nix flakes, providing specialized shells for different development contexts (Rust, Python, Embedded, UI, and Tauri).

## Submodule Reference

The monorepo includes essential libraries as git submodules for reference and testing patterns:

**Location**: `../../submodules/` (from `packages/tmnl`)

### effect (Effect-TS)
- **Path**: `submodules/effect`
- **URL**: https://github.com/effect-ts/effect
- **Test Examples**: `packages/*/test/*.test.ts`
- **Key Pattern**: Use `@effect/vitest` with `it.effect()` for Effect-based tests

Example navigation:
```bash
cd ../../submodules/effect
# View test examples
ls packages/sql-*/test/
# Read a test file
cat packages/sql-sqlite-bun/test/Client.test.ts
```

### effect-atom
- **Path**: `submodules/effect-atom`
- **URL**: https://github.com/tim-smart/effect-atom
- **Test Examples**: `packages/atom/test/*.test.ts`
- **Key Pattern**: Use `Registry.make()` for testing atoms; regular `it()` tests

Example navigation:
```bash
cd ../../submodules/effect-atom
# View atom tests
ls packages/atom/test/
# Read test patterns
cat packages/atom/test/Atom.test.ts
```

**Testing Patterns Summary**:
- **Effect services**: `it.effect(() => Effect.gen(...))`  returns Effect
- **Atoms**: `Registry.make()` + `r.get(atom)`, `r.set(atom, val)`, `r.subscribe(atom, fn)`
- **Runtime atoms**: Use `Atom.runtime(Layer)` + `r.get(runtimeAtom.atom(Effect.gen(...)))`

## NX Project Configuration

When adding new scripts to `package.json`, always add corresponding nx executors to `project.json`:

```json
"script-name": {
  "executor": "nx:run-commands",
  "options": {
    "command": "bun run script-name",
    "cwd": "packages/tmnl"
  }
}
```

This ensures scripts can be run via both `bun run` and `nx run tmnl:script-name`.

### Current Tauri Targets

The following NX targets are configured for Tauri development:

- `nx run tmnl:tauri:dev` - Run Tauri app in development mode
- `nx run tmnl:tauri:dev:windows` - Run Tauri dev for Windows cross-compilation
- `nx run tmnl:tauri:dev:both` - Run Tauri dev for multiple platforms
- `nx run tmnl:tauri:build` - Build Tauri app for production

## Nix Module Structure

The project uses a modular Nix configuration located in `nix/modules/`:

### Module Files

- `core.nix` - Base development tools and utilities
- `rust.nix` - Rust toolchain and Cargo workspace tools
- `python.nix` - Python development environment
- `embedded.nix` - Embedded systems tools
- `ui.nix` - UI development (Node.js, pnpm)
- `tauri.nix` - Tauri development with GTK/WebKit dependencies
- `tests.nix` - Testing infrastructure
- `default.nix` - Unified shell combining all modules

### Tauri Module (`nix/modules/tauri.nix`)

The Tauri module provides:

**DevShell**: `tmnl-tauri`
- Layers over `tmnl-core` for base functionality
- Includes GTK3, WebKitGTK, and system dependencies (Linux)
- Configures environment variables for Tauri build:
  - `RUST_SRC_PATH`
  - `PKG_CONFIG_PATH` (with GTK/WebKit paths)
  - `LD_LIBRARY_PATH` (Linux only)
  - `LIBRARY_PATH` (Linux only)
  - `CARGO_TARGET_X86_64_PC_WINDOWS_GNU_RUSTFLAGS` (for cross-compilation)

**Mission Control Scripts**:
- `tauri-dev` - Development mode
- `tauri-dev-windows` - Windows cross-compilation dev
- `tauri-dev-both` - Multi-platform dev
- `tauri-build` - Production build

All scripts use `bun run` and execute from `$FLAKE_ROOT/packages/tmnl`.

### Adding New Modules

1. Create a new `.nix` file in `nix/modules/`
2. Follow the structure:
   ```nix
   { inputs, lib, ... }:
   {
     perSystem = { config, pkgs, system, lib, ... }: {
       devShells.tmnl-<name> = pkgs.mkShell {
         name = "tmnl-<name>";
         inputsFrom = [ config.devShells.tmnl-core ];
         nativeBuildInputs = [ /* packages */ ];
         shellHook = ''
           echo "[tmnl-<name>] Description"
         '';
       };
       mission-control.scripts = { /* scripts */ };
     };
   }
   ```
3. Import the module in `nix/default.nix`
4. Add to unified shell in `nix/modules/default.nix`

## Development Workflow

### Using Nix Shells

```bash
# Enter the unified development environment
nix develop

# Or use direnv for automatic shell activation
direnv allow

# Access specific shells
nix develop .#tmnl-tauri
nix develop .#tmnl-rust
nix develop .#tmnl-python
```

### Using Mission Control Scripts

Inside the nix shell, mission control scripts are available:

```bash
# Run Tauri in development mode
tauri-dev

# Build for production
tauri-build

# Cross-compile for Windows (Linux only)
tauri-dev-windows
```

### Using NX Commands

```bash
# Run via NX (from anywhere in the monorepo)
nx run tmnl:tauri:dev
nx run tmnl:tauri:build

# Or use bun directly
cd packages/tmnl
bun run tauri:dev
```

## Integration Points

The TMNL environment integrates three task execution systems:

1. **Bun Scripts** (`package.json`) - JavaScript/TypeScript task runner
2. **NX Executors** (`project.json`) - Monorepo orchestration
3. **Nix Mission Control** (`nix/modules/*.nix`) - Environment-aware development commands

When adding new tasks:
- Add script to `package.json`
- Add NX executor to `project.json`
- Add mission-control script to relevant `nix/modules/*.nix` if needed

## Tauri Window Configuration

### Transparent Frameless Window

TMNL uses a transparent, decoration-free window to display only the web app content:

**Configuration** (`src-tauri/tauri.conf.json`):
- `decorations: false` - Removes native window chrome
- `transparent: true` - Makes native window transparent
- `macOSPrivateApi: true` - Enables transparency on macOS (App Store incompatible)

**Permissions** (`src-tauri/capabilities/default.json`):
- `core:window:default` - Base window permissions
- `core:window:allow-start-dragging` - Enable custom drag regions
- `core:window:allow-minimize/maximize/close` - Window controls
- `core:window:allow-set-decorations` - Toggle decorations
- `core:window:allow-set-always-on-top` - Pin window

### Implementing Custom Window Controls

**Drag Region** (HTML):
```html
<div data-tauri-drag-region class="titlebar">
  <!-- Your custom titlebar content -->
</div>
```

**Window Controls** (TypeScript):
```typescript
import { getCurrentWindow } from '@tauri-apps/api/window';

const appWindow = getCurrentWindow();

// Window operations
await appWindow.minimize();
await appWindow.toggleMaximize();
await appWindow.close();
await appWindow.startDragging();
```

**CSS** - Position titlebar at top with proper styling for transparency.

### Platform Notes

- **Windows**: Transparency works out of the box
- **Linux**: Requires compositor (GNOME/KDE/Xfwm4) for transparency
- **macOS**: Private API required (not App Store compatible)
- **WSL/WSLg**: See WSLg-specific notes below

## WSLg Rendering Workarounds

### Issue
WSLg (Windows Subsystem for Linux GUI) can render Tauri app windows with extremely small, blank, or invisible HTML content due to WebKitGTK compositing bugs on the Weston compositor. Symptoms include:
- HTML loads but appears tiny or invisible
- Invalid viewport dimensions in dev tools
- CSS opacity or scaling failures

### Solution
TMNL automatically detects WSLg and applies the `WEBKIT_DISABLE_COMPOSITING_MODE=1` environment variable workaround.

**Detection Method**: Checks for `WSL_DISTRO_NAME` environment variable

**Applied in**:
- `scripts/dev.sh` - Vite dev server
- `scripts/tauri-dev.sh` - Tauri development mode
- `scripts/dev-both.sh` - Dual platform development (via tauri-dev.sh)
- Nix mission-control scripts: `tauri-dev`, `tauri-dev-both`

**Manual Override** (if needed):
```bash
export WEBKIT_DISABLE_COMPOSITING_MODE=1
bun run tauri:dev
```

### Cross-Platform Compatibility
The workaround only activates on WSLg, not regular Linux, ensuring:
- Native Linux: Full WebKitGTK compositing (better performance)
- WSLg: Compositing disabled (fixes rendering bugs)
- Windows/macOS: Unaffected (no environment variable set)

## Dependencies

### Tauri Dependencies

The Tauri module includes:

**Linux**:
- GTK3, WebKitGTK 4.1
- Cairo, Pango, HarfBuzz
- GLib, ATK, librsvg, libsoup3
- MinGW-w64 for Windows cross-compilation

**macOS**:
- iconv

**All Platforms**:
- Rust toolchain (via rustup)
- LLDB 18 for debugging
- pkg-config, OpenSSL
- Frida tools for instrumentation

---

# Layer System Architecture

## Overview

TMNL implements a sophisticated layer management system inspired by Adobe's layer paradigm, adapted for web applications. The system uses **Effect** for dependency injection, **effect-atom** for reactive state management, and **XState** for lifecycle state machines.

## Core Philosophy

The layer system treats UI components as composable layers with explicit z-index ordering, pointer-event behavior, and lifecycle management. This enables:

1. **Declarative layering** - Components declare their layer properties via HOC
2. **Centralized state** - Single source of truth for all layer metadata
3. **Smart z-index management** - Algorithms that minimize re-renders and reassignments
4. **Proper event bubbling** - Fine-grained pointer-events control (auto, none, pass-through)
5. **Effect-based DI** - Services use Effect.Service pattern for testability and composition

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      React Components                        │
│  ┌──────────────────┐         ┌──────────────────┐          │
│  │ withLayering HOC │◄────────┤   useLayer Hook  │          │
│  └────────┬─────────┘         └────────┬─────────┘          │
└───────────┼──────────────────────────────┼──────────────────┘
            │                              │
            ▼                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   effect-atom (Reactive)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  layersAtom  │  │ layerIndex   │  │ layerSorted  │      │
│  │  (all layers)│  │ (z-ordered)  │  │ (optimized)  │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
└─────────┼──────────────────┼──────────────────┼─────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│              layerRuntimeAtom (Effect Runtime)               │
│                                                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Effect Services (DI Layer)                │  │
│  │                                                         │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────────┐  │  │
│  │  │ IdGenerator│  │LayerFactory│  │ LayerManager   │  │  │
│  │  │  Service   │  │  Service   │  │   Service      │  │  │
│  │  └─────┬──────┘  └─────┬──────┘  └────────┬───────┘  │  │
│  │        │                │                  │           │  │
│  │        │                │         ┌────────▼────────┐ │  │
│  │        │                │         │  Effect.Ref     │ │  │
│  │        └────────────────┴────────►│  <LayerState>   │ │  │
│  │                                   └─────────────────┘ │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │ XState Machine  │
                  │ (Lifecycle)     │
                  └─────────────────┘
```

## Key Design Decisions

### 1. Z-Index Storage Model

**Decision**: Layers store their own z-index property; LayerIndex is a derived, sorted view.

**Rationale**:
- Allows layers to carry their z-index with them
- LayerIndex provides ordered visualization without being the source of truth
- Enables onResort closures to access new z-index value

**Implementation**:
```typescript
interface LayerInstance {
  readonly id: string;
  readonly zIndex: number;  // ← Stored on layer
  // ... other properties
}

// Derived sorted view
const layerIndexAtom = layerRuntimeAtom.atom(
  Effect.gen(function*() {
    const manager = yield* LayerManager;
    return yield* manager.getLayerIndex(); // Returns layers sorted by zIndex
  })
);
```

### 2. Smart Z-Index Algorithm

**Decision**: Create gaps (±10) when bringing layers to front/back to minimize future reassignments.

**Rationale**:
- Avoids cascading updates when z-index changes
- Allows future insertions without recalculating all layers
- Triggers onResort closure only for the moved layer, not all layers

**Implementation** (`LayerManager.ts:calculateNewZIndex`):
```typescript
const calculateNewZIndex = (
  layers: ReadonlyArray<LayerInstance>,
  targetId: string,
  direction: "front" | "back"
): number => {
  const sorted = Array.sort(layers, (a, b) => a.zIndex - b.zIndex);

  if (direction === "front") {
    const maxZ = sorted[sorted.length - 1]?.zIndex ?? 0;
    return maxZ + 10;  // ← Gap for future insertions
  } else {
    const minZ = sorted[0]?.zIndex ?? 0;
    return minZ - 10;
  }
};
```

### 3. Dual State: Effect.Ref + Atom Sync

**Decision**: LayerManager maintains canonical state in `Effect.Ref<Array<LayerInstance>>`, synced with atoms for React.

**Rationale**:
- Effect.Ref provides mutable state within Effect runtime
- Atoms expose this state reactively to React components
- Separation of concerns: service layer (Effect) vs view layer (React)
- Enables testing services without React

**Implementation**:
```typescript
// In LayerManager service
const layersRef = yield* Ref.make<ReadonlyArray<LayerInstance>>([]);

// In atoms/index.ts
const layersAtom = layerRuntimeAtom.atom(
  Effect.gen(function*() {
    const manager = yield* LayerManager;
    return yield* manager.getAllLayers(); // ← Reads from Ref
  })
);
```

### 4. XState Hybrid Integration

**Decision**: XState machine validates transitions; LayerManager executes z-index changes.

**Rationale**:
- XState handles visibility/lock state (hidden, visible, locked)
- Z-index is orthogonal to lifecycle state
- Machine sends events to LayerManager for z-index operations
- Separation allows independent testing of state machine logic

**Implementation**:
```typescript
// XState machine (machines/layerMachine.ts)
states: {
  visible: {
    on: {
      BRING_TO_FRONT: "visible",  // ← Transition within same state
      LOCK: "locked"
    }
  }
}

// LayerManager handles actual z-index change
const bringToFront = (id: string): Effect.Effect<void> =>
  Effect.gen(function*() {
    // ... update z-index
    const onResort = layer.metadata.onResort;
    if (onResort) yield* Effect.promise(() => onResort(layer));
  });
```

### 5. onResort Closures

**Decision**: Layers can define closures that execute after z-index changes.

**Rationale**:
- Allows custom behavior when layer order changes (e.g., update analytics, trigger animations)
- Closure receives updated layer instance with new z-index
- Stored in layer metadata for flexibility

**Implementation**:
```typescript
// Factory creates layer with closure
const createLayer = (
  config: LayerConfig,
  onResort?: (layer: LayerInstance) => Effect.Effect<void>
): Effect.Effect<LayerInstance> =>
  Effect.gen(function*() {
    const layer: LayerInstance = {
      // ...
      metadata: {
        onResort: onResort ? (layer: LayerInstance) =>
          Effect.runPromise(onResort(layer)) : undefined
      }
    };
    return layer;
  });
```

### 6. Render Optimization via layerSorted Atom

**Decision**: `layerSorted` atom tracks visual hash to prevent unnecessary re-renders when z-index changes don't affect visual output.

**Rationale**:
- bringToFront operations shouldn't always trigger React re-renders
- Only re-render if visible layer order actually changes
- Atom's built-in memoization handles change detection

**Implementation**:
```typescript
export const layerSortedAtom = Atom.make((get) => {
  const layers = get(layerIndexAtom);

  // Hash of visible layers in z-order
  const visualHash = layers
    .filter((l) => l.visible)
    .map((l) => `${l.id}:${l.zIndex}`)
    .join("|");

  return { layers, visualHash, shouldRender: true };
});
// Atom re-renders component only if visualHash changes
```

### 7. Pointer Events Strategy

**Decision**: Three-tier pointer-events model: `auto`, `none`, `pass-through`.

**Rationale**:
- **auto**: Layer captures all clicks (e.g., background)
- **none**: Layer ignores all clicks (transparent overlay)
- **pass-through**: Container is `none`, children are `auto` (smart bubbling)

**Implementation**:
```tsx
// withLayering HOC applies pointer-events
const pointerEventsStyle =
  config.pointerEvents === "pass-through"
    ? { pointerEvents: "none" as const }
    : { pointerEvents: config.pointerEvents ?? "auto" };

// In ContentLayer
<div className="pointer-events-none">  {/* Container */}
  <div className="pointer-events-auto"> {/* Children */}
    {content}
  </div>
</div>
```

## Service Architecture

### IdGenerator Service

**Purpose**: Configurable ID generation with multiple strategies.

**Dependencies**: None (leaf service)

**Configuration**:
```typescript
class IdGeneratorConfig extends Context.Tag("app/layers/IdGeneratorConfig")<
  IdGeneratorConfig,
  IdGeneratorConfig
>() {
  static Default = Layer.succeed(this, this.of({ strategy: "nanoid" }));
  static Custom = (config: IdGeneratorConfig) => Layer.succeed(this, this.of(config));
}
```

**Strategies**:
- `nanoid`: Fast, URL-safe (default)
- `uuid`: Standard UUID v4
- `custom`: User-provided generator function

### LayerFactory Service

**Purpose**: Creates compliant layer instances with validation.

**Dependencies**: `IdGenerator`

**Responsibilities**:
- Generate unique IDs via IdGenerator
- Create XState machine actor for lifecycle
- Validate configuration (z-index range, opacity range, name)
- Attach onResort closures to metadata

**Usage**:
```typescript
const factory = yield* LayerFactory;
const layer = yield* factory.createLayer(
  { name: "my-layer", zIndex: 10 },
  (layer) => Effect.log(`Layer resorted to ${layer.zIndex}`)
);
```

### LayerManager Service

**Purpose**: Centralized layer state management and z-index operations.

**Dependencies**: None (stores state in Effect.Ref)

**State**:
```typescript
const layersRef = yield* Ref.make<ReadonlyArray<LayerInstance>>([]);
```

**Operations**:
- `getAllLayers()` - Returns all layers (unsorted)
- `getLayerIndex()` - Returns layers sorted by z-index
- `addLayer(layer)` - Register new layer
- `removeLayer(id)` - Unregister layer
- `bringToFront(id)` - Move layer to top (smart algorithm)
- `sendToBack(id)` - Move layer to bottom
- `setVisible(id, visible)` - Toggle visibility (+ XState event)
- `setOpacity(id, opacity)` - Adjust transparency
- `setLocked(id, locked)` - Lock interactions (+ XState event)
- `setPointerEvents(id, behavior)` - Change click behavior

## React Integration

### effect-atom Bindings

**layerRuntimeAtom** - Effect runtime for all layer services:
```typescript
export const layerRuntimeAtom = Atom.runtime(
  Layer.mergeAll(
    IdGenerator.Default,
    LayerFactory.Default,
    LayerManager.Default
  )
);
```

**Atom Definitions**:
```typescript
// All layers (unsorted)
const layersAtom = layerRuntimeAtom.atom(
  Effect.gen(function*() {
    const manager = yield* LayerManager;
    return yield* manager.getAllLayers();
  })
);

// Layers sorted by z-index
const layerIndexAtom = layerRuntimeAtom.atom(
  Effect.gen(function*() {
    const manager = yield* LayerManager;
    return yield* manager.getLayerIndex();
  })
);

// Individual layer by ID (family pattern)
const layerAtom = Atom.family((id: string) =>
  layerRuntimeAtom.atom(
    Effect.gen(function*() {
      const manager = yield* LayerManager;
      return yield* manager.getLayer(id);
    })
  )
);
```

**Operation Atoms**:
```typescript
export const layerOpsAtom = {
  bringToFront: layerRuntimeAtom.fn(
    Effect.gen(function*(id: string) {
      const manager = yield* LayerManager;
      yield* manager.bringToFront(id);
    })
  ),
  // ... other operations
};
```

### withLayering HOC

**Purpose**: Wraps React components as layers in the layer system.

**Features**:
- Auto-registration on mount
- Auto-cleanup on unmount
- Applies z-index and pointer-events styles
- Data attributes for debugging (`data-layer-id`, `data-layer-name`)

**Usage**:
```tsx
const BackgroundLayer = withLayering(
  () => <HoundstoothGOL />,
  {
    name: "background",
    zIndex: -10,
    pointerEvents: "auto"
  }
);

<BackgroundLayer />
```

### useLayer Hook

**Purpose**: Access layer state and operations from any component.

**API**:
```typescript
// Get specific layer
const { layer, bringToFront, setVisible } = useLayer("layer-id");

// Get all layers
const { allLayers, layerIndex } = useLayer();

// Operations
bringToFront();                    // If layerId provided
setVisible(true);                  // Toggle visibility
setOpacity(0.5);                   // Adjust transparency
```

## Usage Examples

### Basic Layer Setup

```tsx
import { withLayering } from "@/lib/layers";

const Background = withLayering(
  () => <div className="fixed inset-0"><Pattern /></div>,
  { name: "bg", zIndex: -10, pointerEvents: "auto" }
);

const Content = withLayering(
  ({ children }) => <div className="relative">{children}</div>,
  { name: "content", zIndex: 10, pointerEvents: "pass-through" }
);

function App() {
  return (
    <>
      <Background />
      <Content><MyUI /></Content>
    </>
  );
}
```

### Programmatic Layer Control

```tsx
import { useLayer } from "@/lib/layers";

function LayerControls({ layerId }: { layerId: string }) {
  const { layer, bringToFront, sendToBack, setVisible } = useLayer(layerId);

  if (!layer) return null;

  return (
    <div>
      <h3>{layer.name} (z: {layer.zIndex})</h3>
      <button onClick={bringToFront}>Bring to Front</button>
      <button onClick={sendToBack}>Send to Back</button>
      <button onClick={() => setVisible(!layer.visible)}>
        {layer.visible ? "Hide" : "Show"}
      </button>
    </div>
  );
}
```

### Custom onResort Closure

```tsx
import { LayerFactory } from "@/lib/layers";
import * as Effect from "effect/Effect";

// In a service or component
const createAnimatedLayer = layerRuntimeAtom.fn(
  Effect.gen(function*(config: LayerConfig) {
    const factory = yield* LayerFactory;

    const layer = yield* factory.createLayer(
      config,
      (updatedLayer) => Effect.gen(function*() {
        // Custom logic when layer is resorted
        yield* Effect.log(`Layer moved to z-index ${updatedLayer.zIndex}`);
        // Trigger animation, analytics, etc.
      })
    );

    return layer;
  })
);
```

## File Structure

```
src/lib/layers/
├── types.ts                    # TypeScript types
├── services/
│   ├── IdGenerator.ts          # ID generation service
│   ├── LayerFactory.ts         # Layer factory service
│   └── LayerManager.ts         # Layer manager service
├── machines/
│   └── layerMachine.ts         # XState lifecycle machine
├── atoms/
│   └── index.ts                # effect-atom definitions
├── withLayering.tsx            # HOC for layer wrapping
├── useLayer.ts                 # React hook
└── index.ts                    # Public exports
```

## Testing Strategy

### Unit Tests (Effect Services)

Use `@effect/vitest` for testing Effect services in isolation:

```typescript
import { describe, it } from "@effect/vitest";
import { Effect } from "effect";
import { IdGenerator } from "./IdGenerator";

describe("IdGenerator", () => {
  it.effect("generates unique IDs", () =>
    Effect.gen(function*() {
      const gen = yield* IdGenerator;
      const id1 = gen.generate();
      const id2 = gen.generate();

      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^[A-Za-z0-9_-]{21}$/); // nanoid format
    }).pipe(Effect.provide(IdGenerator.Default))
  );
});
```

### Integration Tests (Services + State)

Test service interactions with LayerManager:

```typescript
it.effect("bringToFront updates z-index correctly", () =>
  Effect.gen(function*() {
    const manager = yield* LayerManager;
    const factory = yield* LayerFactory;

    const layer1 = yield* factory.createLayer({ name: "L1", zIndex: 0 });
    const layer2 = yield* factory.createLayer({ name: "L2", zIndex: 10 });

    yield* manager.addLayer(layer1);
    yield* manager.addLayer(layer2);
    yield* manager.bringToFront(layer1.id);

    const index = yield* manager.getLayerIndex();
    expect(index[index.length - 1].id).toBe(layer1.id);
    expect(index[index.length - 1].zIndex).toBeGreaterThan(10);
  }).pipe(
    Effect.provide(Layer.mergeAll(
      IdGenerator.Default,
      LayerFactory.Default,
      LayerManager.Default
    ))
  )
);
```

### Atom Tests (effect-atom)

Test reactive atom behavior:

```typescript
import { Atom } from "@effect-atom/atom-react";
import { layersAtom, layerOpsAtom } from "./atoms";

it("layersAtom updates when layer added", async () => {
  const addLayer = Atom.get(layerOpsAtom.addLayer);

  const layer = { id: "test", name: "Test", zIndex: 0, /* ... */ };
  await addLayer(layer);

  const layers = Atom.get(layersAtom);
  expect(layers).toContainEqual(expect.objectContaining({ id: "test" }));
});
```

### React Component Tests

Test HOC and hooks integration:

```typescript
import { render, screen } from "@testing-library/react";
import { withLayering, useLayer } from "@/lib/layers";

it("withLayering applies z-index style", () => {
  const Component = withLayering(
    () => <div>Content</div>,
    { name: "test", zIndex: 42 }
  );

  const { container } = render(<Component />);
  const wrapper = container.firstChild;

  expect(wrapper).toHaveStyle({ zIndex: 42 });
  expect(wrapper).toHaveAttribute("data-layer-name", "test");
});
```

## Known Limitations & Future Work

1. **Effect.runPromise in withLayering**: Currently uses simplified Effect execution. Production code should handle fiber interruption and proper cleanup.

2. **No Layer Persistence**: Layers are ephemeral. Future: Add persistence via LocalStorage or Effect Layers.

3. **No Layer Groups**: Cannot group layers into folders/collections. Future: Add parent/child layer relationships.

4. **Fixed Z-Index Gaps**: Gap size (±10) is hardcoded. Future: Make configurable or adaptive.

5. **Limited XState Integration**: Machine doesn't trigger callbacks on state transitions. Future: Add actions/guards for richer lifecycle.

6. **No Undo/Redo**: Layer operations are not tracked for undo. Future: Add Effect-based command pattern.

## References

- [Effect Documentation](https://effect.website)
- [effect-atom Documentation](https://github.com/tim-smart/effect-atom)
- [XState Documentation](https://xstate.js.org)
- [Adobe Layers Paradigm](https://helpx.adobe.com/photoshop/using/layer-basics.html)

**EDIN: a briefing**

**Essence:** EDIN is a four-phase operational cycle—**Experiment, Design, Implement, Negotiate**—built to enforce disciplined iteration, explicit hypothesis-testing, and controlled adaptation. It is a strategic loop, not a workflow checklist. It forces uncertainty to surface early, clarity to solidify mid-cycle, execution to be bounded, and course-correction to be structural.

---

### **1. Experiment**

The phase that rejects assumption.
Its mandate: expose risk, surface unknowns, and test premises *before* committing resources.

**Core moves:**

* Identify destabilizing variables.
* Generate hypotheses linked to strategic Briefs.
* Run minimal-cost probes to validate or kill assumptions.

**Function:** Clear the fog. Prevent waste. Ensure every later step sits on ground truth, not projection.

---

### **2. Design**

The phase that shapes intent into structure.
Its mandate: convert proven information into executable architecture.

**Core moves:**

* Translate experimental outcomes into Operations.
* Decompose Operations into Tasks and Subtasks.
* Allocate requirements, constraints, dependencies, and resource envelopes.

**Function:** Manufacture coherence. Define the battlefield before entering it.

---

### **3. Implement**

The phase that commits force.
Its mandate: execute the defined structure with precision and controlled variance.

**Core moves:**

* Carry out Subtasks under real conditions.
* Validate intermediate outputs using experimental rigor.
* Maintain operational reporting continuity.

**Function:** Turn design into reality. Transform orchestration into artifacts.

---

### **4. Negotiate**

The phase that interprets results and redistributes power.
Its mandate: absorb lessons, redirect resources, and adjust the next cycle’s trajectory.

**Core moves:**

* Conduct Debriefs to analyze failure vectors and success patterns.
* Reallocate assets based on evidence, not optimism.
* Update the Proposals queue and reprioritize Briefs.

**Function:** Preserve adaptability. Replace inertia with deliberate evolution.

---

### **Strategic Character**

EDIN is optimized for environments where uncertainty is high, mission tempo is variable, and planning without feedback is strategically hazardous. It is a governance system for iterative intelligence, ensuring that you never build blindly nor react sloppily.

**In short:**
Experiment reveals truth.
Design shapes truth.
Implement enacts truth.
Negotiate evolves truth.

A cycle that produces clarity, precision, and survivable momentum.

---

## AG-Grid Integration (tldraw)

### Overview

AG-Grid Community v34 is embedded as a tldraw custom shape, enabling data grids as first-class canvas objects.

### Key Files

```
src/components/tldraw/shapes/
├── data-grid-shape.tsx    # DataGridWidgetShapeUtil + cell renderers
├── data-grid-theme.ts     # TMNL_TOKENS + tmnlDataGridTheme
└── index.tsx              # Exports (add to tmnlShapeUtils array)
```

### Critical: AG-Grid v34 Module Registration

```typescript
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
ModuleRegistry.registerModules([AllCommunityModule]);
```

Without this, grid renders blank. No CSS imports needed with theme prop.

### TMNL_TOKENS

Parameterized design system in `data-grid-theme.ts`:
- `colors` - Full TMNL palette
- `typography` - Monospace stack, size scale
- `spacing` - Base unit + scales
- `dimensions` - Row/header heights
- `animation` - Duration/easing (for future animatification)

### Custom Cell Renderers

- `IdCellRenderer` - Muted, small tracking
- `ValueCellRenderer` - Number + cyan progress bar
- `StatusCellRenderer` - Glowing indicator + colored label

### Spawn

Toolbar button in `tmnl-toolbar.tsx` spawns `data-grid-widget` type.

### Docs

Deep architecture analysis: `assets/documents/AG_GRID_THEMING_ARCHITECTURE.md`

---

## Session Journal

See `.agents/index.md` for operational logs.

---

## Current Task: Animation System (feat/tldraw-drag-reticles)

### What Exists

```
src/lib/animation/
├── index.ts              # Exports
├── tokens.ts             # Design tokens (timing, colors, geometry)
├── Animatable.ts         # Core: animatable() + useAnimatable() hook
└── drivers/
    ├── gsap.ts           # GSAP driver + emanation utilities
    └── animejs.ts        # anime.js driver + SVG reticle utilities

src/components/testbed/
└── AnimationTestbed.tsx  # 3 case studies (WIP, route not wired)

src/components/tldraw/overlays/
├── DragReticleOverlay.tsx  # Corner emanation on drag (wired to tldraw)
└── ReticleHandles.tsx      # Custom handles (partial)
```

### Core API

```tsx
const scaleAtoms = animatable(1, { duration: 200 })
const { value, to, snap, reverse } = useAnimatable(scaleAtoms)
```

### Remaining Tasks

1. **Wire testbed route** - Add to `router.tsx`, add nav link
2. **Fix any runtime issues** - Testbed isolates the system from tldraw
3. **Effect-ify** - Animation sequences as `Effect.gen` programs with spans

### Key Insight

Animation sequences should be **Effect programs**:
- `Effect.withSpan` for observability
- Fiber interruption for cancellation
- `Effect.all` for parallel animations
- `Scope` for cleanup

---

