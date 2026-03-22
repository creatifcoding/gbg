# Doc Set 02 — Module System & Sandbox Architecture

> **Scope**: `moduleBase.ts`, `threeBase.ts`, `moduleSandboxEntry.ts`, `nwWrldDocblock.ts`, `sdkHelpers.ts`, sandbox RPC protocol, module contract  
> **Tsingou Replacement**: Replace with Effect.Service-based module registry, @react-three/fiber (R3F) for 3D, P5Canvas for 2D, visx for data viz

---

## 1. Module Contract

Every visual module in nw_wrld is a JavaScript file that follows a strict convention:

### Required Structure

```javascript
/*
@nwWrld name: Module Display Name
@nwWrld category: 2D | 3D | Data
@nwWrld imports: ModuleBase, THREE, assetUrl, ...
*/
class MyModule extends ModuleBase {
  static methods = [
    { name: "pulse", executeOnLoad: false, options: [
      { name: "intensity", defaultVal: 1, type: "number", min: 0, max: 10 }
    ]}
  ];
  
  constructor(element, options, assetsBasePath) {
    super(element, options, assetsBasePath);
    // Visual setup
  }
  
  pulse(options) { /* triggered by signal */ }
}
export default MyModule;
```

### Three Required Components

| Component | Purpose | Validation |
|-----------|---------|-----------|
| **Docblock** | Module metadata (`@nwWrld name`, `category`, `imports`) | `parseNwWrldDocblockMetadata()` — max 16KB scanned |
| **Default Export** | Class extending `ModuleBase` or `BaseThreeJsModule` | Dynamic `import()` in sandbox |
| **`static methods`** | Triggerable method declarations with option schemas | Introspected via prototype walk |

---

## 2. ModuleBase — The Base Class

**File**: `src/projector/helpers/moduleBase.ts`

### Inherited Methods

| Method | Purpose | Options |
|--------|---------|---------|
| `show` | Make element visible | `duration` (auto-hide after ms) |
| `hide` | Make element invisible | `duration` (auto-show after ms) |
| `offset` | Translate position | `x`, `y` (% of viewport) |
| `scale` | Scale transform | `scale` (factor) |
| `opacity` | Set opacity | `opacity` (0-1) |
| `rotate` | Continuous rotation | `direction`, `speed`, `duration` |
| `randomZoom` | Random scale + position | `scaleFrom`, `scaleTo`, `position` |
| `viewportLine` | Draw SVG line from module edge | `x`, `y`, `length`, `opacity` |
| `background` | Set background color | `color` |
| `invert` | CSS invert filter | `duration` |
| `matrix` | Grid layout (rows×cols) | `rows`, `cols`, `excludedCells`, `border` |

### Constructor Signature

```typescript
constructor(element: HTMLElement, options: Record<string, unknown>, assetsBasePath: string)
```

The element is a positioned `<div>` that the module owns for rendering.

### Method Option Schema

```typescript
type MethodOption = {
  name: string;
  defaultVal: unknown;
  type: "number" | "boolean" | "select" | "color" | "matrix" | "asset";
  min?: number;
  max?: number;
  values?: string[];           // For select type
  unit?: string;               // Display unit (ms, %, etc.)
  allowRandomization?: boolean; // Enables randomRange in method options
};
```

---

## 3. Sandbox Architecture

### Isolation Model

Modules execute in an **isolated BrowserView** (separate renderer):

| Property | Value |
|----------|-------|
| `nodeIntegration` | `false` |
| `contextIsolation` | `true` |
| `sandbox` | `true` |
| Protocol | `nw-sandbox://` (custom Electron protocol) |
| Auth | Token-based (one-time token per BrowserView) |

### RPC Protocol

```
Projector ──[sandbox:ensure]──► Main (creates BrowserView, returns token)
Projector ──[sandbox:request]──► Main ──[sandbox:fromMain]──► Sandbox
Sandbox ──[sandbox:toMain]──► Main ──[resolves Promise]──► Projector
```

### RPC Message Types

| Message | Direction | Purpose |
|---------|-----------|---------|
| `initTrack` | Projector → Sandbox | Initialize all modules for a track |
| `destroyTrack` | Projector → Sandbox | Tear down all module instances |
| `invokeOnInstance` | Projector → Sandbox | Call a method on a specific instance |
| `setMatrixForInstance` | Projector → Sandbox | Reconfigure grid layout |
| `introspectModule` | Projector → Sandbox | Extract method metadata from source |
| `sdk:readAssetText` | Sandbox → Main | Read workspace asset file |
| `sdk:listAssets` | Sandbox → Main | List workspace asset directory |

---

## 4. Module Loading Pipeline

**File**: `src/projector/moduleSandboxEntry.ts`

### Step 1: Import Injection

The sandbox parses docblock `@nwWrld imports` and injects a preamble:

```javascript
// User writes: @nwWrld imports: ModuleBase, THREE, assetUrl
// Sandbox injects before code:
const { ModuleBase } = globalThis.nwWrldSdk;
const THREE = globalThis.THREE;
const { assetUrl } = globalThis.nwWrldSdk;
```

Available SDK globals:
- `ModuleBase`, `BaseThreeJsModule` — base classes
- `THREE` — Three.js library
- `p5` — p5.js library
- `d3` — D3.js library
- `Noise` — Perlin noise (noisejs)
- `OBJLoader`, `PLYLoader`, `PCDLoader`, `GLTFLoader`, `STLLoader` — Three.js loaders
- `assetUrl(relPath)`, `readAssetText(relPath)`, `listAssets(relDir)` — asset access SDK

### Step 2: Dynamic Import

```typescript
const blob = new Blob([injectedSource], { type: "application/javascript" });
const url = URL.createObjectURL(blob);
const module = await import(url);
const ModuleClass = module.default;
```

### Step 3: Introspection

```typescript
// Walk prototype chain for callable methods
const getCallableMethodNamesFromClass = (Cls) => {
  const names = new Set();
  let proto = Cls.prototype;
  while (proto && proto !== Object.prototype) {
    for (const n of Object.getOwnPropertyNames(proto)) {
      if (n === "constructor") continue;
      const desc = Object.getOwnPropertyDescriptor(proto, n);
      if (desc && typeof desc.value === "function") names.add(n);
    }
    proto = Object.getPrototypeOf(proto);
  }
  return Array.from(names);
};
```

### Step 4: Instance Creation

```typescript
// For each module in track:
const element = document.createElement("div");
element.id = `module-${instanceId}`;
trackRoot.appendChild(element);
const instance = new ModuleClass(element, constructorOptions, assetsBaseUrl);
```

---

## 5. Matrix Grid System

A single module type can be displayed in a grid layout:

```
matrix: { rows: 3, cols: 3, excludedCells: ["2-2"] }

┌─────┬─────┬─────┐
│ 1-1 │ 1-2 │ 1-3 │  Each cell = independent instance
├─────┼─────┼─────┤  sharing same class
│ 2-1 │     │ 2-3 │  (2-2 excluded)
├─────┼─────┼─────┤
│ 3-1 │ 3-2 │ 3-3 │
└─────┴─────┴─────┘
```

When `matrix` method is called on a channel, the sandbox:
1. Destroys existing instances for that module
2. Creates `rows × cols - excludedCells.length` new instances
3. Each instance gets its own element positioned in the grid

---

## 6. 21 Starter Modules

**Directory**: `src/main/starter_modules/`

| Category | Modules |
|----------|---------|
| **2D Canvas** | Background, CircleGrow, DotGrid, FlashFade, LineSketch |
| **3D Three.js** | CubeRotate, MathLattice, MathOrbitalMap, ParticleField, SphereDeform, WireframeGlobe |
| **CSS/DOM** | ColorFlash, GlitchText, Gradient, ImageCycle, NoiseField, TextScroll, TilePattern |
| **Data** | Waveform |
| **Utility** | Debug |

### Migration Tracks

| Track | From | To | Modules |
|-------|------|-----|---------|
| Three.js → R3F | `BaseThreeJsModule` | `@react-three/fiber` Canvas | 6 modules |
| p5 → P5Canvas | `new p5(sketch, element)` | `@p5-wrapper/react` | 3 modules |
| D3 → visx | `d3.select().append()` | visx composable primitives | 1 module (MathOrbitalMap) |
| DOM → React | CSS transforms / innerHTML | React components | 11 modules |

---

## 7. Method Option Randomization

```typescript
// Methods can declare options with allowRandomization: true
// At execution time, buildMethodOptions() resolves:
//   - Static values → pass through
//   - randomRange: { min, max } → random value in range
//   - noRepeat cache → prevents same random value consecutively

const buildMethodOptions = (rawOptions, methodOptionNoRepeatCache, instanceId) => {
  // For each option:
  //   if (option.randomRange) → pick random in [min, max], check noRepeat cache
  //   else → use value directly
};
```

---

## Tsingou Design Derivation

| nw_wrld Component | Tsingou Replacement | Key Change |
|---|---|---|
| `ModuleBase` class | React component + R3F/p5/visx renderer | Class inheritance → composition |
| Docblock metadata | Effect.Schema module manifest | Parse-time → compile-time validation |
| BrowserView sandbox | React component tree (same process) | IPC isolation → component isolation |
| RPC protocol | Direct function calls / Effect.Service | Message passing → typed service |
| Module class cache | React.lazy + Suspense | Manual cache → framework caching |
| `static methods` array | Schema-declared signal handlers | Convention → typed contract |
| Import injection | Standard ES imports | Runtime injection → build-time resolution |

---

*End of Doc Set 02. The module system is the creative surface — understanding its contract is essential for understanding its contract informs Tsingou's rendering layer design.*
