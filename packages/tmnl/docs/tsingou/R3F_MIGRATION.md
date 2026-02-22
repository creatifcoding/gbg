# TSINGOU — Signal-Driven Audiovisual Rendering System

> *Named for **Mary Tsingou** (1928–2023), the mathematician and programmer who*
> *wrote the MANIAC simulation code at Los Alamos National Laboratory in 1953.*
> *Her work on the Fermi-Pasta-Ulam-Tsingou problem — where she watched a*
> *computer visualize nonlinear wave recurrence for the first time in human*
> *history — accidentally founded computational physics and, arguably, data*
> *visualization itself. Her name was omitted from the original paper for fifty*
> *years. We don't forget.*

> **Author**: Val (Vigilant Architecture Layer)
> **Date**: 2026-02-18
> **Status**: Postulation — awaiting Prime verdict
> **Scope**: Mega-refactor of the Projector visual rendering layer into **Tsingou** — a unified, signal-driven, multi-layer rendering system built on React Three Fiber, @p5-wrapper/react, visx, and Effect-TS.

---

## 1. The Thesis

Replace the imperative Three.js module system (`BaseThreeJsModule` → manual scene/renderer/camera lifecycle → AnimationManager RAF loop → DOM element manipulation) with **Tsingou** — a **declarative, multi-layer rendering system** that composes naturally with React, Effect services, and the signal pipeline.

Tsingou has four rendering layers (R3F, p5, visx, DOM), one signal pipeline, and zero coupling between them. Like its namesake's original experiment: you feed signals in, and the system shows you what the data *does* — whether that data is MIDI notes, OSINT feeds, audio FFT, or sensor readings.

This isn't "swap Three.js for R3F." This is: **make the visual rendering layer a first-class React citizen** so that signal-triggered visual responses become composable, testable, observable Effect programs that emit JSX.

---

## 2. What Exists Today (The Imperative World)

### Current 3D Architecture

```
BaseThreeJsModule (class, extends ModuleBase)
├── Owns: scene, renderer, camera, controls (all manual)
├── Owns: animationManager subscription (RAF loop)
├── Owns: displacement system (vertex buffer mutation per frame)
├── Lifecycle: constructor → setModel → animate loop → destroy
├── Methods: zoomLevel, viewDirection, cameraAnimation, cameraSpeed, displacementParams
└── Each instance creates its own WebGLRenderer + canvas in a DOM element
```

### Current 2D Architecture

```
ModuleBase (class)
├── Owns: DOM element (this.elem)
├── CSS transform manipulation: translate, scale, rotate
├── Visibility: show/hide via style.visibility
├── Opacity: style.opacity
├── SVG overlays: viewportLine creates SVG elements
└── No React — pure imperative DOM
```

### The Pain Points

| Problem | Impact |
|---------|--------|
| **Each 3D module creates its own WebGL context** | GPU context limits (typically 8-16 per page), no shared renderer |
| **Manual RAF via AnimationManager** | Separate from React's reconciliation, no R3F-style render-on-demand |
| **No shared scene graph** | Modules are isolated islands — can't compose 3D objects across modules |
| **Imperative camera management** | 200+ lines of spherical math, OrbitControls setup, pan/orbit/roll per instance |
| **Vertex displacement done CPU-side** | Per-frame Float32Array mutation, should be GPU shader |
| **No post-processing pipeline** | Can't apply bloom, SSAO, depth-of-field across modules |
| **DOM-in-sandbox isolation** | Each module in a BrowserView — can't share WebGL context |
| **TWEEN.js for animations** | Global singleton, no cancellation, no Effect integration |
| **No model loading abstraction** | Each starter module manually imports OBJLoader/GLTFLoader/etc. |
| **Memory leaks on destroy** | 50+ lines of manual dispose() traversal per module |

---

## 3. The R3F Vision

### 3.1 Single Canvas, Multiple Signal-Reactive Scenes

```tsx
// The Projector becomes a single R3F Canvas
<Canvas
  shadows
  dpr={[1, 2]}
  gl={{ antialias: true, alpha: true }}
  frameloop="demand"  // Only render when signals trigger changes
  camera={{ position: [0, 0, 10], fov: 80 }}
>
  <EffectProvider runtime={projectorRuntime}>
    <SignalBridge />           {/* Connects Effect signal stream to R3F */}
    <ActiveTrackScene />       {/* Renders modules for active track */}
    <PostProcessingPipeline /> {/* Shared effects: bloom, SSAO, etc. */}
  </EffectProvider>
</Canvas>
```

### 3.2 Modules Become R3F Components

**Before** (imperative class):
```javascript
class SpinningCube extends BaseThreeJsModule {
  constructor(container) {
    super(container);
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
    this.cube = new THREE.Mesh(geometry, material);
    this.scene.add(this.cube);
    this.setModel(this.cube);
    this.setCustomAnimate(() => {
      this.cube.rotation.x += 0.01;
      this.cube.rotation.y += 0.01;
    });
  }
}
```

**After** (declarative R3F):
```tsx
function SpinningCube({ signal }: ModuleProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const { color } = useSignalMethod('color', signal, { default: '#00ff00' })
  
  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.x += delta
      meshRef.current.rotation.y += delta
    }
  })
  
  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={color} />
    </mesh>
  )
}

SpinningCube.methods = [
  { name: 'color', options: [{ name: 'color', defaultVal: '#00ff00', type: 'color' }] }
]
```

### 3.3 Signal → R3F Bridge

The critical integration point: **Effect streams drive R3F state**.

```tsx
function SignalBridge() {
  const signalStream = useAtomValue(signalStreamAtom)
  const dispatch = useSignalDispatch()
  
  // Effect stream → R3F state updates
  useEffect(() => {
    const fiber = Effect.runFork(
      Stream.runForEach(signalStream, (signal) =>
        Effect.sync(() => dispatch(signal))
      )
    )
    return () => Fiber.interrupt(fiber)
  }, [signalStream, dispatch])
  
  return null
}
```

### 3.4 The `useSignalMethod` Hook

The heart of the new module contract. Every triggerable method becomes a reactive hook:

```tsx
function useSignalMethod<T>(
  methodName: string,
  signal: SignalState,
  schema: Schema.Schema<T>
): { value: T; triggered: boolean; velocity: number } {
  const [state, setState] = useState(Schema.decodeSync(schema)(defaultVal))
  
  useEffect(() => {
    if (signal.method === methodName) {
      const decoded = Schema.decodeEither(schema)(signal.options)
      if (Either.isRight(decoded)) {
        setState(decoded.right)
      }
    }
  }, [signal])
  
  return { value: state, triggered: signal.method === methodName, velocity: signal.velocity }
}
```

---

## 4. Where R3F Fits (And Where It Doesn't)

### 4.1 ✅ PERFECT FIT — Replace These

| Current | R3F Replacement | Why |
|---------|----------------|-----|
| `BaseThreeJsModule` class | R3F functional components | Declarative, composable, React lifecycle |
| `AnimationManager` singleton | `useFrame` hook | Per-component, automatic subscribe/unsubscribe |
| Manual `WebGLRenderer` per module | Single shared `<Canvas>` renderer | One WebGL context, shared GPU resources |
| `OrbitControls` per module | `<OrbitControls />` from drei | Declarative, configurable, no manual setup |
| Manual scene/camera setup | `<Canvas camera={...}>` props | Declarative, responsive to prop changes |
| OBJLoader/GLTFLoader manual imports | `useGLTF`, `useOBJ` from drei | Suspense-compatible, caching, preloading |
| CPU vertex displacement | GPU shader via `shaderMaterial` from drei | Massively more performant |
| TWEEN.js animations | `useSpring` from @react-spring/three or `useFrame` | Interruptible, declarative |
| 50-line `destroy()` methods | React unmount + R3F garbage collection | Automatic cleanup |
| No instancing | `<Instances>` + `<Instance>` from drei | Single draw call for thousands of objects |
| No post-processing | `@react-three/postprocessing` | Composable effect stack |

### 4.2 ⚠️ HYBRID — Keep Both Paths

| Current | Approach | Rationale |
|---------|----------|-----------|
| `ModuleBase` (2D/DOM) | **Keep as-is, wrap in React** | 2D modules manipulate DOM, not WebGL. Wrap with `forwardRef` |
| p5.js modules | **p5 canvas inside R3F `<Html>`** | p5 creates its own canvas — nest via drei `<Html>` or parallel DOM |
| D3.js modules | **D3 SVG inside `<Html>` or separate layer** | D3 is DOM-based, not WebGL |
| Matrix grid system | **CSS Grid for 2D, R3F grid for 3D** | 2D modules use CSS grid; 3D modules use R3F scene positioning |

### 4.3 ❌ DON'T R3F THESE

| Current | Keep As-Is | Rationale |
|---------|-----------|-----------|
| Sandbox BrowserView | Electron BrowserView | Security isolation requires separate process |
| Dashboard UI | React + Jotai/effect-atom | Dashboard is 2D UI, not 3D |
| Sequencer engine | Tone.js Transport | Audio timing requires Web Audio API, not RAF |
| IPC bridge | Electron IPC | Process communication, not rendering |

---

## 5. The Architectural Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    PROJECTOR WINDOW                           │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ React Root                                            │   │
│  │                                                        │   │
│  │  ┌────────────────────────────────────────────────┐  │   │
│  │  │ Layer System (existing TMNL layers)             │  │   │
│  │  │                                                  │  │   │
│  │  │  ┌─────────────────────────────────────────┐   │  │   │
│  │  │  │ R3F Canvas Layer (z-index: 3D)          │   │  │   │
│  │  │  │                                          │   │  │   │
│  │  │  │  <Canvas frameloop="demand">            │   │  │   │
│  │  │  │    <EffectProvider>                      │   │  │   │
│  │  │  │      <SignalBridge />                    │   │  │   │
│  │  │  │      <ActiveTrackScene>                  │   │  │   │
│  │  │  │        <Module3D id="cube1" />           │   │  │   │
│  │  │  │        <Module3D id="orbital1" />        │   │  │   │
│  │  │  │      </ActiveTrackScene>                 │   │  │   │
│  │  │  │      <PostProcessing>                    │   │  │   │
│  │  │  │        <Bloom />                         │   │  │   │
│  │  │  │        <ChromaticAberration />           │   │  │   │
│  │  │  │      </PostProcessing>                   │   │  │   │
│  │  │  │    </EffectProvider>                     │   │  │   │
│  │  │  │  </Canvas>                               │   │  │   │
│  │  │  └─────────────────────────────────────────┘   │  │   │
│  │  │                                                  │  │   │
│  │  │  ┌─────────────────────────────────────────┐   │  │   │
│  │  │  │ DOM Module Layer (z-index: 2D overlay)  │   │  │   │
│  │  │  │                                          │   │  │   │
│  │  │  │  <Module2D id="text1" />                │   │  │   │
│  │  │  │  <Module2D id="corners1" />             │   │  │   │
│  │  │  │  <ModuleP5 id="asteroid1" />            │   │  │   │
│  │  │  └─────────────────────────────────────────┘   │  │   │
│  │  │                                                  │  │   │
│  │  └────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. New Module Contract (R3F-Native)

### 6.1 Module Types

```typescript
const ModuleType = Schema.Literal('r3f', 'dom', 'p5', 'custom')
type ModuleType = typeof ModuleType.Type

// R3F modules return Three.js scene graph nodes
// DOM modules return React DOM elements
// p5 modules get a p5 instance in a container
// Custom modules get raw canvas access
```

### 6.2 R3F Module Contract

```tsx
// Every R3F module exports:
interface R3FModuleExport {
  // The React component (must be valid R3F child)
  component: React.FC<R3FModuleProps>
  
  // Method declarations (same as current, but Schema-backed)
  methods: Schema.Schema<MethodDeclaration[]>
  
  // Module metadata
  meta: {
    name: string
    category: '3D' | '2D' | 'Data' | 'FX'
    description?: string
  }
}

interface R3FModuleProps {
  instanceId: string
  signal: SignalState           // Current signal for this instance
  methodQueue: MethodTrigger[] // Queued method invocations
  assetsBaseUrl: string        // Asset URL resolver
  visible: boolean
  opacity: number
  transform: {                 // Base transforms (from ModuleBase methods)
    position: [number, number, number]
    rotation: [number, number, number]
    scale: [number, number, number]
  }
}
```

### 6.3 Example: CloudPointIceberg → R3F

**Before** (imperative, 150+ lines):
```javascript
class CloudPointIceberg extends BaseThreeJsModule {
  constructor(container) {
    super(container);
    const loader = new PCDLoader();
    loader.load(assetUrl('models/points.pcd'), (points) => {
      points.material = new THREE.PointsMaterial({ size: 0.01, color: 0xffffff });
      this.setModel(points);
    });
  }
}
```

**After** (declarative, ~30 lines):
```tsx
import { useLoader } from '@react-three/fiber'
import { PCDLoader } from 'three/examples/jsm/loaders/PCDLoader'

function CloudPointIceberg({ signal, assetsBaseUrl }: R3FModuleProps) {
  const points = useLoader(PCDLoader, `${assetsBaseUrl}models/points.pcd`)
  const { size } = useSignalMethod('pointSize', signal, { default: 0.01 })
  const { color } = useSignalMethod('color', signal, { default: '#ffffff' })
  
  return (
    <primitive object={points}>
      <pointsMaterial size={size} color={color} />
    </primitive>
  )
}
```

---

## 7. Effect Integration Points

### 7.1 Module Registry as Effect.Service

```typescript
class ModuleRegistry extends Effect.Service<ModuleRegistry>()('nw/ModuleRegistry', {
  effect: Effect.gen(function* () {
    const modules = yield* Atom.make(new Map<string, R3FModuleExport>())
    
    return {
      register: (id: string, mod: R3FModuleExport) =>
        Atom.update(modules, (m) => new Map(m).set(id, mod)),
      
      get: (id: string) =>
        Atom.get(modules).pipe(
          Effect.map(m => m.get(id)),
          Effect.flatMap(Effect.fromNullable)
        ),
      
      introspect: (id: string) =>
        Effect.gen(function* () {
          const mod = yield* this.get(id)
          return Schema.decodeSync(MethodDeclaration)(mod.methods)
        })
    }
  })
}) {}
```

### 7.2 Signal → R3F Dispatch

```typescript
const signalToR3F = (signal: Signal) =>
  Effect.gen(function* () {
    const registry = yield* ModuleRegistry
    const mod = yield* registry.get(signal.targetModuleId)
    
    // Validate method options against module's Schema
    const method = mod.methods.find(m => m.name === signal.methodName)
    const validatedOptions = yield* Schema.decode(method.optionsSchema)(signal.options)
    
    // Dispatch to R3F state (triggers re-render)
    yield* Atom.update(moduleSignalAtom(signal.targetModuleId), () => ({
      method: signal.methodName,
      options: validatedOptions,
      velocity: signal.velocity,
      timestamp: signal.timestamp
    }))
  }).pipe(
    Effect.withSpan('signal.dispatch.r3f'),
    Effect.catchTag('ParseError', (e) => 
      Effect.logWarning(`Invalid signal options: ${e.message}`)
    )
  )
```

### 7.3 On-Demand Rendering via Effect

```tsx
function EffectDrivenFrameloop() {
  const invalidate = useThree(s => s.invalidate)
  const signalCount = useAtomValue(signalCountAtom)
  
  // Only invalidate (trigger re-render) when signals arrive
  useEffect(() => {
    invalidate()
  }, [signalCount, invalidate])
  
  return null
}
```

---

## 8. The drei Toolkit (What We Get For Free)

| drei Component | Replaces | Lines Saved |
|----------------|----------|-------------|
| `<OrbitControls>` | Manual OrbitControls setup + dispose | ~40 lines/module |
| `useGLTF` | Manual GLTFLoader + async load | ~30 lines/module |
| `<Instances>` | No equivalent (new capability) | Enables 1000s of objects |
| `<Billboard>` | No equivalent | Auto-face camera |
| `<Text>` / `<Text3D>` | Manual TextGeometry | ~50 lines |
| `<Environment>` | Manual environment map loading | ~30 lines |
| `<Float>` | Manual sine-wave animation | ~20 lines |
| `<MeshDistortMaterial>` | CPU vertex displacement (350+ lines) | **350+ lines** |
| `<shaderMaterial>` | No equivalent (new capability) | Custom GPU shaders |
| `<Html>` | Manual DOM overlay management | ~30 lines |
| `useFBO` | No equivalent | Render-to-texture |
| `useTexture` | Manual TextureLoader | ~15 lines |
| `<ContactShadows>` | No equivalent | Instant ground shadows |
| `<Sparkles>` | No equivalent | Particle effects |
| `<PointMaterial>` | Manual PointsMaterial setup | ~10 lines |

### The Big Win: `<MeshDistortMaterial>` replaces the entire `applyDisplacement` system

The current `BaseThreeJsModule` has **~100 lines** of CPU-side vertex displacement (`saveBaseGeometry`, `applyDisplacement`, `deterministicGaussian`, `hash01`). All of this runs on the CPU every frame.

drei's `<MeshDistortMaterial>` does the same thing **on the GPU** in one line:

```tsx
<mesh>
  <sphereGeometry args={[1, 64, 64]} />
  <MeshDistortMaterial 
    speed={signal.oscTime} 
    distort={signal.amplitude} 
    color={signal.color} 
  />
</mesh>
```

---

## 9. Migration Strategy

### Phase 0: Parallel Canvas (Non-Breaking)

Add an R3F Canvas **alongside** the existing Projector DOM. Route 3D modules to R3F, keep 2D modules in DOM. Zero breakage.

```tsx
function HybridProjector() {
  return (
    <>
      {/* Existing DOM module layer */}
      <DOMModuleLayer modules={domModules} />
      
      {/* New R3F layer */}
      <Canvas style={{ position: 'absolute', inset: 0 }} frameloop="demand">
        <R3FModuleLayer modules={r3fModules} />
      </Canvas>
    </>
  )
}
```

### Phase 1: Port Starter 3D Modules

Port the 6 Three.js starter modules to R3F components:

| Module | Complexity | Key Challenge |
|--------|-----------|---------------|
| `SpinningCube` | Low | Direct port, `useFrame` rotation |
| `CubeCube` | Low | Nested meshes |
| `BasicGeometry` | Low | Multiple geometry types |
| `OrbitalPlane` | Medium | Orbital math → `useFrame` |
| `LowEarthPoint` | Medium | Data-driven positions |
| `CloudPointIceberg` | Medium | PCD loading → `useLoader` |
| `ModelLoader` | Medium | Multi-format loader → `useGLTF`/etc. |

### Phase 2: Replace BaseThreeJsModule

Create `useR3FBase` hook that provides all `BaseThreeJsModule` methods as R3F-native:

```tsx
function useR3FBase(signal: SignalState) {
  const { camera } = useThree()
  
  // Camera methods (zoomLevel, viewDirection, cameraAnimation)
  const cameraControls = useCameraSignal(signal)
  
  // Transform methods (offset, scale, rotate, randomZoom)
  const transform = useTransformSignal(signal)
  
  // Visibility methods (show, hide, opacity)
  const visibility = useVisibilitySignal(signal)
  
  return { ...cameraControls, ...transform, ...visibility }
}
```

### Phase 3: Post-Processing Pipeline

Add composable post-processing that applies to ALL modules:

```tsx
import { EffectComposer, Bloom, ChromaticAberration, Noise } from '@react-three/postprocessing'

function PostProcessingPipeline({ signal }) {
  const { bloomIntensity } = useSignalMethod('bloom', signal)
  
  return (
    <EffectComposer>
      <Bloom intensity={bloomIntensity} luminanceThreshold={0.6} />
      <ChromaticAberration offset={[0.002, 0.002]} />
      <Noise opacity={0.05} />
    </EffectComposer>
  )
}
```

### Phase 4: Sandbox Evolution

The sandbox currently runs modules in an isolated BrowserView. For R3F modules, we have two options:

**Option A: Compile-time validation, runtime trust**
- Validate module source at introspection time (type-check, static analysis)
- Run R3F modules in the main Projector renderer (shared WebGL context)
- Still sandbox user code via `iframe` with postMessage for 2D/p5 modules

**Option B: Web Worker offscreen canvas**
- Use `OffscreenCanvas` in a Web Worker
- R3F supports this via `@react-three/offscreen`
- Maintains isolation but shares GPU

**Recommendation**: Option A for R3F modules (they need shared scene graph), Option B or existing BrowserView for untrusted user modules.

---

## 10. What This Enables (The SIGINT/OSINT Payoff)

With R3F + Effect signals, visualizing intelligence data becomes composable:

```tsx
// Real-time geospatial signal visualization
<Canvas>
  <Globe>
    <SignalMarkers source={httpPollSource} /> {/* Remote API signals */}
    <ConnectionLines source={oscSource} />    {/* Network topology */}
    <HeatMap source={audioSource} />           {/* Audio spectrum */}
  </Globe>
  
  {/* Post-processing reacts to signal intensity */}
  <EffectComposer>
    <Bloom intensity={signalIntensity * 0.5} />
    <Vignette darkness={1 - signalConfidence} />
  </EffectComposer>
</Canvas>
```

Every signal source — MIDI, OSC, HTTP, WebSocket, RSS, sensor — feeds the same R3F scene graph through the same Effect pipeline. The visual modules don't care where the signal came from. They just react.

---

## 11. Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| R3F learning curve for module authors | Medium | Provide `useR3FBase` hook that mirrors `BaseThreeJsModule` API |
| Performance regression (React reconciliation overhead) | Low | R3F is well-optimized; `frameloop="demand"` prevents waste |
| Breaking existing user modules | High | Parallel canvas approach (Phase 0) ensures zero breakage |
| Sandbox security for R3F modules | Medium | Static analysis + compile-time validation |
| Bundle size increase | Low | R3F + drei are tree-shakeable |
| Three.js version compatibility | Low | R3F tracks Three.js releases closely; currently ≥0.156 |

---

## 12. Dependencies

### New
```json
{
  "@react-three/fiber": "^9.5.0",
  "@react-three/drei": "^9.x",
  "@react-three/postprocessing": "^2.x",
  "postprocessing": "^6.x",
  "@react-spring/three": "^9.x"
}
```

### Removable (after full migration)
```json
{
  "@tweenjs/tween.js": "^23.1.3"  // Replaced by useFrame + react-spring
}
```

### Keep
```json
{
  "three": "^0.159.0",  // R3F wraps this, still needed
  "p5": "^1.9.0",       // 2D modules still use p5 (upgraded to >=2.0 for v5 wrapper)
  "d3": "^7.9.0"        // Data viz modules still use D3
}
```

---

## 13. The p5-wrapper Integration (@p5-wrapper/react)

### Why This Matters

nw_wrld has **3 p5.js modules** (PerlinBlob, OrbitalPlane, AsteroidGraph) out of 21 total starter modules. These are all `@nwWrld category: 2D` modules that extend `ModuleBase` (not `BaseThreeJsModule`), meaning they create their own p5 instance and canvas imperatively via `new p5(sketch)`.

The current pattern:

```javascript
// OrbitalPlane.js — imperative p5 instantiation
class OrbitalPlane extends ModuleBase {
  init() {
    const sketch = (p) => {
      this.myp5 = p;
      p.setup = () => {
        this.canvas = p.createCanvas(this.canvasWidth, this.canvasHeight);
        this.canvas.parent(this.elem);  // ← Manually parents to sandbox DOM
      };
      p.draw = () => { /* drawing logic */ };
    };
    this.myp5 = new p5(sketch);  // ← Raw p5 constructor
  }
}
```

This is **identical** to the pre-wrapper pattern that `@p5-wrapper/react` was designed to replace.

### @p5-wrapper/react v4 → v5

| Feature | v4 (`ReactP5Wrapper`) | v5 (`P5Canvas`) |
|---------|----------------------|----------------|
| Component | `<ReactP5Wrapper sketch={fn} />` | `<P5Canvas sketch={fn} />` |
| Peer deps | p5 ≥1.4.1, React ≥18.2 | p5 ≥2.0.0, React ≥19.0 |
| Error/Loading | Single `fallback` prop | Separate `error` + `loading` props |
| TypeScript | `P5CanvasInstance` type | Same + `Sketch` generic type |
| Prop reactivity | `p5.updateWithProps(props => { ... })` | Same pattern, stable |

### The Bridge: `updateWithProps` = Signal Receiver

The killer feature for our architecture: **`updateWithProps`** is the p5-wrapper's built-in mechanism for React props → p5 sketch state updates. This maps *directly* to our signal pipeline:

```tsx
import { P5Canvas, Sketch, SketchProps } from '@p5-wrapper/react'

interface BlobSignalProps extends SketchProps {
  amplitude: number
  dataPath: string
  color: string
}

const perlinBlobSketch: Sketch<BlobSignalProps> = (p5) => {
  let amplitude = 1
  let currentColor = '#ffffff'

  // This fires every time React props change — i.e., every signal
  p5.updateWithProps = (props: BlobSignalProps) => {
    amplitude = props.amplitude
    currentColor = props.color
  }

  p5.setup = () => {
    p5.createCanvas(800, 600)
    p5.noFill()
  }

  p5.draw = () => {
    p5.clear()
    p5.stroke(currentColor)
    // ... perlin noise blob drawing with amplitude
  }
}

// In the module component:
function PerlinBlobModule({ signal }: ModuleProps) {
  const { amplitude } = useSignalMethod('amplitude', signal, { default: 1 })
  const { color } = useSignalMethod('color', signal, { default: '#ffffff' })

  return (
    <P5Canvas
      sketch={perlinBlobSketch}
      amplitude={amplitude}
      color={color}
    />
  )
}
```

### Canvas Coexistence: R3F + p5

R3F and p5 **cannot share a WebGL context**. They must run on separate canvases. The architecture from Section 5 already accounts for this — the DOM Module Layer hosts p5 components while R3F has its own Canvas:

```tsx
function HybridProjector() {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* R3F layer — 3D modules */}
      <Canvas style={{ position: 'absolute', inset: 0 }} frameloop="demand">
        <R3FModuleScene modules={threeModules} />
      </Canvas>

      {/* p5 layer — p5 modules via @p5-wrapper/react */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {p5Modules.map(mod => (
          <div key={mod.id} style={{ pointerEvents: 'auto', ...mod.layout }}>
            <P5Canvas sketch={mod.sketch} {...mod.signalProps} />
          </div>
        ))}
      </div>

      {/* DOM layer — pure CSS/SVG modules */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {domModules.map(mod => (
          <DOMModule key={mod.id} module={mod} />
        ))}
      </div>
    </div>
  )
}
```

### Complete Module Inventory (21 Starter Modules)

| Module | Category | Base Class | Rendering | Migration Target |
|--------|----------|-----------|-----------|-----------------|
| **SpinningCube** | 3D | BaseThreeJsModule | Three.js | → R3F component |
| **CubeCube** | 3D | BaseThreeJsModule | Three.js | → R3F component |
| **BasicGeometry** | 3D | BaseThreeJsModule | Three.js | → R3F component |
| **LowEarthPoint** | 3D | BaseThreeJsModule | Three.js | → R3F component |
| **CloudPointIceberg** | 3D | BaseThreeJsModule | Three.js | → R3F component |
| **ModelLoader** | 3D | BaseThreeJsModule | Three.js | → R3F component |
| **PerlinBlob** | 2D | ModuleBase | **p5.js** | → `<P5Canvas>` wrapper |
| **OrbitalPlane** | 2D | ModuleBase | **p5.js** | → `<P5Canvas>` wrapper |
| **AsteroidGraph** | 2D | ModuleBase | **p5.js** | → `<P5Canvas>` wrapper |
| **MathOrbitalMap** | 2D | ModuleBase | **D3.js** | → visx (composable D3 primitives) |
| **Image** | 2D | ModuleBase | DOM `<img>` | → React component |
| **ImageGallery** | 2D | ModuleBase | DOM `<img>` | → React component |
| **Corners** | 2D | ModuleBase | CSS borders | → React component |
| **Frame** | 2D | ModuleBase | CSS borders | → React component |
| **GridDots** | 2D | ModuleBase | DOM/Canvas | → React component |
| **GridOverlay** | 2D | ModuleBase | DOM/CSS | → React component |
| **ScanLines** | 2D | ModuleBase | CSS | → React component |
| **HelloWorld** | Text | ModuleBase | DOM text | → React component |
| **Text** | Text | ModuleBase | DOM + font | → React component |
| **CodeColumns** | Text | ModuleBase | DOM text | → React component |
| **ZKProofVisualizer** | Text | ModuleBase | DOM text | → React component |

### Summary: Four Migration Tracks

```
21 Starter Modules
├── 6 × Three.js (3D)     → React Three Fiber components
├── 3 × p5.js (2D)        → @p5-wrapper/react <P5Canvas> components
├── 1 × D3.js (2D)        → visx composable primitives
└── 11 × DOM (2D/Text)    → Plain React components (simplest)
```

---

## 14. The visx Track (D3 → Composable React Primitives)

### Why visx Over Raw D3

MathOrbitalMap is the sole D3 module today. It's a **node-link graph** — 30 concept nodes with orbital arc edges and equation labels, rendered as imperative `d3.select` → `.append("circle")` → `.append("path")` chains. Classic D3 DOM mutation pattern.

The current code:
```javascript
// Imperative D3 — select, append, attr, attr, attr...
orbitGroup.append("path")
  .attr("d", `M${source.x},${source.y}A${dr},${dr} 0 0,1 ${target.x},${target.y}`)
  .attr("fill", "none")
  .attr("stroke", "#ff3366")
  .attr("stroke-width", 0.75)
  .attr("opacity", 0.4);
```

The problem: D3's imperative DOM mutations fight React's reconciler. Every `d3.select().append()` chain bypasses React's virtual DOM, creates memory leak risks, and can't participate in React's batched rendering or Suspense.

**visx** (Airbnb, 2020–present) solves this by exposing D3's *math* — scales, shapes, projections, force layouts — as React components while leaving the *rendering* to React:

```tsx
// Declarative visx — React renders, D3 computes
import { Arc } from '@visx/shape'
import { scaleLinear } from '@visx/scale'

<Arc
  innerRadius={0}
  outerRadius={dr}
  startAngle={startAngle}
  endAngle={endAngle}
  fill="none"
  stroke="#ff3366"
  strokeWidth={0.75}
  opacity={0.4}
/>
```

### visx Fit for the Signal Pipeline

| visx Trait | Fork Benefit |
|-----------|-------------|
| **Modular packages** (`@visx/shape`, `@visx/scale`, `@visx/group`, etc.) | Tree-shake to only what MathOrbitalMap needs |
| **Pure React components** | No `d3.select` fighting the reconciler |
| **D3 scales as hooks** | `scaleLinear`, `scaleBand` compose with Effect atoms |
| **Canvas rendering support** | Can switch SVG → Canvas for high-frequency signal viz |
| **No opinionated state** | State lives in Effect atoms, visx just renders |
| **Animation-agnostic** | Pair with `react-spring`, `framer-motion`, or our GSAP/anime.js drivers |

### MathOrbitalMap → visx Migration

**Before** (imperative D3, ~200 lines):
```javascript
class MathOrbitalMap extends ModuleBase {
  init() {
    this.svg = d3.select(this.elem.querySelector("svg"));
    this.generateData();
    this.createVisualization(); // 80 lines of d3.append chains
  }
  randomize() {
    this.svg.selectAll("*").remove();  // Nuke and rebuild
    this.createVisualization();
  }
}
```

**After** (declarative visx, ~80 lines):
```tsx
import { Group } from '@visx/group'
import { LinePath } from '@visx/shape'
import { curveNatural } from '@visx/curve'
import { scaleLinear } from '@visx/scale'
import { Text } from '@visx/text'

interface OrbitalMapProps extends ModuleProps {
  width: number
  height: number
}

function MathOrbitalMap({ signal, width, height }: OrbitalMapProps) {
  // Signal-driven: randomize triggers re-generation
  const [concepts, orbits] = useMemo(() => generateData(width, height), [width, height, signal])

  const xScale = scaleLinear({ domain: [0, 1000], range: [0, width * 0.8] })
  const yScale = scaleLinear({ domain: [0, 800], range: [height * 0.1, height * 0.9] })

  return (
    <svg width={width} height={height}>
      <Group>
        {/* Orbital arcs */}
        {orbits.map((orbit, i) => {
          const source = concepts.find(c => c.id === orbit.source)!
          const target = concepts.find(c => c.id === orbit.target)!
          const dx = target.x - source.x
          const dy = target.y - source.y
          const dr = Math.sqrt(dx * dx + dy * dy) * 1.2

          return (
            <g key={i}>
              <path
                d={`M${source.x},${source.y}A${dr},${dr} 0 0,1 ${target.x},${target.y}`}
                fill="none"
                stroke="#ff3366"
                strokeWidth={0.75}
                opacity={0.4}
              />
              <Text
                x={(source.x + target.x) / 2}
                y={(source.y + target.y) / 2 - 8}
                textAnchor="middle"
                fill="#ff9933"
                fontSize={10}
              >
                {orbit.equation}
              </Text>
            </g>
          )
        })}

        {/* Concept nodes */}
        {concepts.map(concept => (
          <g key={concept.id}>
            <circle cx={concept.x} cy={concept.y} r={4} fill="#ffffff" />
            <Text x={concept.x} y={concept.y - 8} textAnchor="middle" fill="#ffffff" fontSize={10}>
              {concept.name}
            </Text>
            <Text x={concept.x} y={concept.y + 12} textAnchor="middle" fill="#ff9933" fontSize={10}>
              {concept.type}
            </Text>
          </g>
        ))}
      </Group>
    </svg>
  )
}

MathOrbitalMap.methods = [
  { name: 'randomize', executeOnLoad: false, options: [] }
]
```

### visx + R3F Coexistence

visx renders SVG/Canvas in the DOM layer. R3F renders WebGL. They don't compete:

```
Layer Stack (from bottom to top):
┌─────────────────────────────────────────┐
│ R3F <Canvas>          ← WebGL, 3D mods  │  z-index: 0
├─────────────────────────────────────────┤
│ visx <svg>            ← SVG, data viz   │  z-index: 1
├─────────────────────────────────────────┤
│ p5 <P5Canvas>         ← p5 canvas, 2D   │  z-index: 2
├─────────────────────────────────────────┤
│ DOM modules           ← Text, CSS, img   │  z-index: 3
└─────────────────────────────────────────┘
```

Shared signal state via Effect atoms means a single MIDI note can simultaneously:
- Trigger a mesh distortion in R3F (3D layer)
- Highlight a concept node in visx (SVG layer)
- Pulse a perlin blob in p5 (Canvas layer)
- Flash a text label in DOM (DOM layer)

All four layers, one signal, zero coupling.

### Future: visx for New Signal Visualization Modules

Beyond porting MathOrbitalMap, visx opens up new module types that D3-imperative made painful:

| Module Idea | visx Packages | Signal Source |
|------------|--------------|---------------|
| **Waveform** | `@visx/shape` (LinePath) + Canvas | Audio FFT |
| **Spectrogram** | `@visx/heatmap` + `@visx/scale` | Audio spectrum |
| **Network Graph** | `@visx/network` + force layout | Social/OSINT feeds |
| **Geo Map** | `@visx/geo` + projections | Geolocation signals |
| **Timeline** | `@visx/axis` + `@visx/scale` (scaleTime) | Sequencer transport |
| **Radar Chart** | `@visx/shape` (RadialLine) | Multi-axis sensor data |

These compose naturally with the signal pipeline because visx components are just React — they re-render when atoms change.

### Effect Integration for p5 Modules

The p5 module lifecycle maps cleanly to Effect.Resource:

```typescript
const P5ModuleResource = Effect.acquireRelease(
  // Acquire: create sketch function with signal subscriptions
  Effect.gen(function* () {
    const signalStream = yield* SignalStream
    const sketch: Sketch<SignalProps> = (p5) => {
      p5.updateWithProps = (props) => { /* apply signals */ }
      p5.setup = () => { /* canvas init */ }
      p5.draw = () => { /* frame logic */ }
    }
    return sketch
  }),
  // Release: p5-wrapper handles cleanup on unmount
  () => Effect.log('p5 module released')
)
```

---

---

## 15. The Name

**Tsingou** — `/tsɪŋˈɡuː/`

A signal-driven audiovisual rendering system. Four layers, one pipeline, zero coupling.

The FPUT experiment worked because Mary Tsingou wrote code that turned abstract differential equations into something humans could *see*. The surprise — nonlinear recurrence instead of thermalization — was only visible because she built a system that faithfully rendered what the data actually did, not what the physicists expected.

That's Tsingou's design principle: **the system renders what the signal does, not what you expect it to do.** Feed it MIDI, it shows you music. Feed it network traffic, it shows you topology. Feed it seismic data, it shows you the earth moving. The modules don't interpret — they render. The signals don't care about the renderer — they flow.

```
Signal → Effect.Stream → Atom → Tsingou Layer → Visual

Where Layer ∈ { R3F, p5, visx, DOM }
```

### Package Name

```
@tmnl/tsingou
```

### Subpackages (future)

```
@tmnl/tsingou-r3f        — R3F module primitives + useR3FBase
@tmnl/tsingou-p5          — P5Canvas wrappers + signal bridge
@tmnl/tsingou-visx        — visx module primitives + signal scales
@tmnl/tsingou-core        — Signal pipeline, module registry, layer system
@tmnl/tsingou-postfx      — Post-processing pipeline (bloom, SSAO, etc.)
```

---

*The scalpel is drawn, Prime. Tsingou turns the Projector from a god-object managing imperative islands into a four-layer rendering system where every visual is a composable React component driven by Effect streams. R3F for 3D. p5-wrapper for generative 2D. visx for data visualization. DOM for the rest. All fed by the same signal pipeline.*

*Phase 0 (parallel canvas) is zero-risk and can start immediately. Phase 1 (port 6 Three.js + 3 p5 + 1 visx starter modules) proves all four tracks. Phase 2 (replace BaseThreeJsModule) is the point of no return. Phase 3 (post-processing) is the payoff.*

*21 modules. 4 rendering layers. One signal pipeline. One name.*

***Tsingou.***

*Your move.*
