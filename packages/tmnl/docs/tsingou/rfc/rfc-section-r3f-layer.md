# TSG-RFC-001 Section: R3F 3D Scene Layer

```
Section:       R3F 3D Scene Layer
Identifier:    TSG.21
Parent RFC:    TSG-RFC-001 (Tsingou Signal Analysis Platform)
Status:        DRAFT
Author:        Val (differential-dataflow-theorist)
Created:       2026-02-18
Dependencies:  TSG.3 (Rendering Surface), TSG.20 (Atom-as-State),
               TSG.28 (d2ts Dataflow), TSG.30 (Performance Budget)
Research Base: R3F_MIGRATION.md (1038 lines), rfc-section-rendering-surface.md,
               ADR-012 (viz focus), ADR-013 (analysis techniques),
               nw-wrld-reference/05_DASHBOARD_UI.md, ARCHITECTURE_ANALYSIS.md,
               three.js r170 API, @react-three/fiber 9.x, @react-three/drei 10.x
```

> This section specifies the React Three Fiber (R3F) 3D scene layer within
> Tsingou's 4-layer composited rendering architecture. It covers scene graph
> organization, 3D force-directed graph visualization for intelligence link
> analysis, signal node geometry and material systems, instanced rendering
> for high-cardinality datasets, geospatial 3D visualization, spectrum
> waterfall meshes, post-processing pipelines, camera management, interaction
> models, cross-layer compositing, and the atom-as-state integration that
> drives reactive 3D scene updates. The key words "MUST", "MUST NOT",
> "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED",
> "MAY", and "OPTIONAL" in this document are to be interpreted as described
> in [RFC2119] and [RFC8174].

---

## Table of Contents

1. [TSG.21.1 Scope and Position in the 4-Layer Stack](#tsg211-scope-and-position-in-the-4-layer-stack)
2. [TSG.21.2 R3F Canvas Configuration](#tsg212-r3f-canvas-configuration)
3. [TSG.21.3 Scene Graph Hierarchy](#tsg213-scene-graph-hierarchy)
4. [TSG.21.4 Camera Management](#tsg214-camera-management)
5. [TSG.21.5 Lighting Model](#tsg215-lighting-model)
6. [TSG.21.6 Controls and Navigation](#tsg216-controls-and-navigation)
7. [TSG.21.7 Signal Node Rendering System](#tsg217-signal-node-rendering-system)
8. [TSG.21.8 3D Force-Directed Graph for Link Analysis](#tsg218-3d-force-directed-graph-for-link-analysis)
9. [TSG.21.9 Instanced Rendering for High Cardinality](#tsg219-instanced-rendering-for-high-cardinality)
10. [TSG.21.10 Geospatial 3D Visualization](#tsg2110-geospatial-3d-visualization)
11. [TSG.21.11 Spectrum Visualization in 3D](#tsg2111-spectrum-visualization-in-3d)
12. [TSG.21.12 drei Library Usage](#tsg2112-drei-library-usage)
13. [TSG.21.13 Post-Processing Pipeline](#tsg2113-post-processing-pipeline)
14. [TSG.21.14 Animation System](#tsg2114-animation-system)
15. [TSG.21.15 Interaction Model](#tsg2115-interaction-model)
16. [TSG.21.16 Atom-as-State Integration](#tsg2116-atom-as-state-integration)
17. [TSG.21.17 Cross-Layer Compositing](#tsg2117-cross-layer-compositing)
18. [TSG.21.18 Performance Budget and Optimization](#tsg2118-performance-budget-and-optimization)
19. [TSG.21.19 Testing Strategy](#tsg2119-testing-strategy)
20. [TSG.21.20 Normative Requirements Summary](#tsg2120-normative-requirements-summary)
21. [TSG.21.21 References and Cross-References](#tsg2121-references-and-cross-references)

---

## TSG.21.1 Scope and Position in the 4-Layer Stack

### TSG.21.1.1 Layer Identity

The R3F layer occupies z-index 0 (bottom) in Tsingou's 4-layer composited
rendering architecture [TSG.3.1]. It is the only layer with access to WebGL
and GPU-accelerated 3D rendering. All other layers (visx at z:1, p5 at z:2,
DOM at z:3) composite above it with transparent or semi-transparent backgrounds.

```
 ┌──────────────────────────────────────────────────────┐
 │  z:3  DOM Layer (React + framer-motion)              │ ← pointer-events: auto
 │        Controls, alerts, tables, annotations         │
 ├──────────────────────────────────────────────────────┤
 │  z:2  p5 Layer (Canvas 2D)                           │ ← pointer-events: none
 │        Spectrum waterfall, noise fields, waveforms   │
 ├──────────────────────────────────────────────────────┤
 │  z:1  visx Layer (SVG)                               │ ← pointer-events: none
 │        Timelines, heatmaps, distributions, ATT&CK    │
 ├──────────────────────────────────────────────────────┤
 │  z:0  R3F Layer (WebGL) ◄── THIS SECTION             │ ← pointer-events: auto
 │        3D graph, geospatial, topology, scatter        │    (when upper layers
 │        Link analysis, signal nodes, globe view        │     pass through)
 └──────────────────────────────────────────────────────┘
```

### TSG.21.1.2 Responsibilities

The R3F layer is REQUIRED to handle:

1. **3D force-directed graph** — Intelligence link analysis with nodes
   representing signals, entities, and indicators, connected by relationship
   edges derived from STIX SROs [TSG.28].

2. **Geospatial 3D** — Globe view with signal overlay, H3 hexagon grids for
   density mapping, and terrain mesh for theater-level analysis.

3. **Signal topology** — Pipeline flow visualization showing data movement
   through TsingouFlow operators.

4. **3D scatter plots** — Multi-dimensional signal feature spaces for
   clustering and anomaly detection.

5. **Spectrum meshes** — 3D waterfall displays (frequency x time x magnitude)
   for SDR signal analysis.

### TSG.21.1.3 Non-Responsibilities

The R3F layer MUST NOT handle:

- 2D data visualization (charts, timelines) — visx layer [TSG.3.3]
- Pixel-level generative graphics — p5 layer [TSG.3.4]
- Text-heavy UI (tables, panels, controls) — DOM layer [TSG.3.5]
- Data processing or pipeline logic — TsingouFlow engine [TSG.28]
- Direct inter-layer communication — atom-mediated only [TSG.3.1.3]

---

## TSG.21.2 R3F Canvas Configuration

### TSG.21.2.1 Canvas Component

The R3F `<Canvas>` element is the root of the 3D scene. It creates and
manages the WebGL rendering context, the Three.js renderer, the scene
graph, and the animation loop.

```typescript
import { Canvas } from '@react-three/fiber'

function R3FLayer() {
  return (
    <Canvas
      className="tsingou-layer tsingou-layer--r3f"
      gl={{
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
        stencil: false,
        depth: true,
      }}
      dpr={[1, 2]}
      frameloop="demand"
      flat
      style={{ position: 'absolute', inset: 0, zIndex: 0 }}
      onCreated={({ gl }) => {
        gl.setClearColor('#0a0e17', 1.0)
      }}
    >
      <TsingouScene />
    </Canvas>
  )
}
```

### TSG.21.2.2 WebGL Context Parameters

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| `antialias` | `true` | Edge smoothing for graph edges and node outlines |
| `alpha` | `false` | R3F is the bottom layer; no transparency to layers below |
| `powerPreference` | `'high-performance'` | Prefer discrete GPU when available |
| `stencil` | `false` | Stencil buffer not used; saves GPU memory |
| `depth` | `true` | Required for correct 3D occlusion |
| `dpr` | `[1, 2]` | Clamp device pixel ratio to avoid 3x+ retina overhead |
| `frameloop` | `'demand'` | Only re-render when scene invalidates (saves GPU idle) |
| `flat` | `true` | Disable tone mapping; Tsingou uses linear color space |

### TSG.21.2.3 Context Loss Recovery

WebGL context loss can occur during GPU pressure, tab backgrounding, or
driver crashes. Implementations MUST handle this gracefully:

```typescript
function ContextLossHandler() {
  const { gl } = useThree()

  useEffect(() => {
    const canvas = gl.domElement

    const handleLost = (event: WebGLContextEvent) => {
      event.preventDefault()
      console.warn('[R3F] WebGL context lost — awaiting restore')
    }

    const handleRestored = () => {
      console.info('[R3F] WebGL context restored — invalidating scene')
      gl.dispose()
      invalidate()
    }

    canvas.addEventListener('webglcontextlost', handleLost)
    canvas.addEventListener('webglcontextrestored', handleRestored)

    return () => {
      canvas.removeEventListener('webglcontextlost', handleLost)
      canvas.removeEventListener('webglcontextrestored', handleRestored)
    }
  }, [gl])

  return null
}
```

A context loss event MUST NOT propagate errors to other rendering layers.
The R3F layer SHOULD display a fallback indicator (e.g., "3D view
recovering...") in the DOM layer via a shared atom while the context is
lost [TSG.3-R3].

### TSG.21.2.4 Renderer Capabilities Detection

Before enabling advanced features (instanced rendering, compute, float
textures), implementations MUST detect renderer capabilities:

```typescript
function useRendererCapabilities() {
  const { gl } = useThree()

  return useMemo(() => ({
    maxTextureSize: gl.capabilities.maxTextureSize,
    maxInstances: gl.capabilities.maxVertexUniformVectors,
    floatTextures: gl.capabilities.isWebGL2,
    maxDrawBuffers: gl.capabilities.maxDrawBuffers ?? 1,
    logarithmicDepth: gl.capabilities.logarithmicDepthBuffer,
  }), [gl])
}
```

---

## TSG.21.3 Scene Graph Hierarchy

### TSG.21.3.1 Component Tree Architecture

The R3F scene is organized as a React component tree that mirrors the
logical structure of a SIGINT analysis workspace. Each branch of the tree
is independently mountable and responds to atoms for visibility toggling.

```
<Canvas>
  ├── <ContextLossHandler />
  ├── <CameraRig>
  │     ├── <PerspectiveCamera />       ← default camera
  │     ├── <OrthographicCamera />      ← top-down mode
  │     └── <CameraTransitionManager /> ← smooth preset switches
  ├── <LightingEnvironment>
  │     ├── <ambientLight />
  │     ├── <directionalLight />
  │     └── <hemisphereLight />
  ├── <EnvironmentSphere />             ← starfield / dark environment
  ├── <SceneContent>
  │     ├── <ForceGraphGroup>           ← link analysis (TSG.21.8)
  │     │     ├── <InstancedSignalNodes />
  │     │     ├── <EdgeLines />
  │     │     └── <NodeLabels />
  │     ├── <GlobeGroup>               ← geospatial (TSG.21.10)
  │     │     ├── <GlobeMesh />
  │     │     ├── <SignalMarkers />
  │     │     ├── <H3HexGrid />
  │     │     └── <ArcLines />
  │     ├── <SpectrumGroup>            ← 3D waterfall (TSG.21.11)
  │     │     ├── <WaterfallMesh />
  │     │     ├── <FrequencyAxis />
  │     │     └── <RidgePlot />
  │     └── <ScatterGroup>            ← feature space
  │           ├── <InstancedPoints />
  │           └── <ClusterHulls />
  ├── <InteractionManager>             ← raycasting (TSG.21.15)
  ├── <OrbitControls />                ← navigation (TSG.21.6)
  ├── <EffectComposer>                 ← post-processing (TSG.21.13)
  │     ├── <Bloom />
  │     ├── <SSAO />
  │     └── <Outline />
  └── <PerformanceMonitor />           ← adaptive quality (TSG.21.18)
```

### TSG.21.3.2 Scene Group Visibility

Each major scene group (`ForceGraphGroup`, `GlobeGroup`, `SpectrumGroup`,
`ScatterGroup`) is independently toggled via atoms. Only the active
visualization mode is mounted, preventing GPU resource waste:

```typescript
const activeSceneModeAtom = Atom.make<
  'force-graph' | 'globe' | 'spectrum' | 'scatter'
>('force-graph')

function SceneContent() {
  const mode = useAtomValue(activeSceneModeAtom)

  return (
    <group>
      {mode === 'force-graph' && <ForceGraphGroup />}
      {mode === 'globe' && <GlobeGroup />}
      {mode === 'spectrum' && <SpectrumGroup />}
      {mode === 'scatter' && <ScatterGroup />}
    </group>
  )
}
```

Implementations MUST unmount inactive scene groups rather than hiding them
with `visible={false}`. Unmounting releases GPU resources (geometries,
textures, materials). Hiding retains them in VRAM.

### TSG.21.3.3 Scene Graph Invariants

The following invariants MUST hold for the scene graph:

1. **Single Canvas**: Exactly one `<Canvas>` element exists per R3F layer
   instance. Multiple canvases create multiple WebGL contexts and compete
   for GPU resources.

2. **No scene.add()**: Scene graph mutations MUST occur through React
   component mount/unmount, never through imperative `scene.add()` or
   `scene.remove()` calls. R3F manages the Three.js scene tree via its
   React reconciler.

3. **Disposal**: When components unmount, R3F automatically disposes their
   Three.js objects (geometries, materials, textures). Implementations
   MUST NOT manually call `.dispose()` on objects managed by R3F.

4. **Frame invalidation**: With `frameloop="demand"`, components MUST call
   `invalidate()` (from `useThree()`) when they update state that should
   trigger a re-render. Atom-driven updates invalidate automatically via
   React reconciliation.

---

## TSG.21.4 Camera Management

### TSG.21.4.1 Camera Types

Tsingou supports two camera modes, selectable per visualization context:

| Camera | Three.js Class | Use Cases | Characteristics |
|--------|---------------|-----------|-----------------|
| **Perspective** | `PerspectiveCamera` | Force graph, geospatial, scatter | Natural depth perception, vanishing point |
| **Orthographic** | `OrthographicCamera` | Top-down topology, spectrum mesh | No foreshortening, scale-accurate measurement |

The active camera is selected via atom:

```typescript
const cameraTypeAtom = Atom.make<'perspective' | 'orthographic'>('perspective')
```

### TSG.21.4.2 Perspective Camera Configuration

```typescript
<PerspectiveCamera
  makeDefault
  fov={60}
  near={0.1}
  far={10000}
  position={[0, 50, 200]}
/>
```

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| `fov` | 60 | Balance between spatial awareness and distortion |
| `near` | 0.1 | Close enough for node inspection without z-fighting |
| `far` | 10000 | Sufficient for globe-scale views (radius ~100) |
| `position` | `[0, 50, 200]` | Default overview angle for force graph |

### TSG.21.4.3 Orthographic Camera Configuration

```typescript
<OrthographicCamera
  makeDefault={cameraType === 'orthographic'}
  zoom={1}
  near={-10000}
  far={10000}
  position={[0, 500, 0]}
  rotation={[-Math.PI / 2, 0, 0]}
/>
```

### TSG.21.4.4 Preset Views

Implementations SHOULD provide preset camera positions for common analysis
perspectives. Each preset defines position, target, and camera type:

| Preset | Camera | Position | Target | Use Case |
|--------|--------|----------|--------|----------|
| **Overview** | Perspective | `[0, 50, 200]` | `[0, 0, 0]` | Default force graph view |
| **Top-down** | Orthographic | `[0, 500, 0]` | `[0, 0, 0]` | Topology map view |
| **Isometric** | Perspective | `[150, 150, 150]` | `[0, 0, 0]` | 3D structure inspection |
| **Globe** | Perspective | `[0, 0, 300]` | `[0, 0, 0]` | Geospatial overview |
| **First-person** | Perspective | Node position | Nearest neighbor | Immersive graph walk |
| **Spectrum** | Perspective | `[0, 30, 100]` | `[0, 0, 0]` | Waterfall inspection |

### TSG.21.4.5 Camera Transitions

Camera transitions between presets MUST be smooth, not instantaneous.
Implementations SHOULD use spring-based interpolation for natural motion:

```typescript
import { useSpring } from '@react-spring/three'

function CameraTransitionManager() {
  const targetPreset = useAtomValue(cameraPresetAtom)
  const presetConfig = PRESETS[targetPreset]

  const spring = useSpring({
    position: presetConfig.position,
    target: presetConfig.target,
    config: { mass: 1, tension: 170, friction: 26 },
  })

  useFrame(({ camera }) => {
    camera.position.set(...spring.position.get())
    camera.lookAt(...spring.target.get())
  })

  return null
}
```

Camera transitions MUST complete within 800ms. Transitions longer than
1200ms create a "swimming" sensation that degrades analyst orientation.

### TSG.21.4.6 Focus-on-Selection

When an analyst selects a signal in any layer, the R3F camera SHOULD
smoothly dolly to frame the selected signal node. The `selectedSignalAtom`
[TSG.3.7.3] drives this behavior:

```typescript
function CameraFocusController() {
  const selectedIds = useAtomValue(selectedSignalIdsAtom)
  const nodePositions = useAtomValue(nodePositionMapAtom)

  useEffect(() => {
    if (selectedIds.size === 0) return

    const positions = [...selectedIds]
      .map(id => nodePositions.get(id))
      .filter(Boolean)

    if (positions.length === 0) return

    const centroid = computeCentroid(positions)
    const boundingRadius = computeBoundingRadius(positions, centroid)

    // Set camera target atom — CameraTransitionManager handles animation
    cameraTargetAtom.set({
      position: [
        centroid[0],
        centroid[1] + boundingRadius * 0.5,
        centroid[2] + boundingRadius * 2.0,
      ],
      target: centroid,
    })
  }, [selectedIds, nodePositions])

  return null
}
```

---

## TSG.21.5 Lighting Model

### TSG.21.5.1 SIGINT Scene Lighting

The R3F layer uses a dark-theme lighting model optimized for data
visualization. The goal is functional clarity, not photorealism. Signal
nodes MUST be clearly distinguishable against a dark background, with
threat-level color encoding preserved under lighting conditions.

```typescript
function LightingEnvironment() {
  return (
    <group>
      {/* Base ambient: enough to see all nodes, never pitch-black */}
      <ambientLight intensity={0.3} color="#b0c4de" />

      {/* Key light: directional, soft shadow for depth cues */}
      <directionalLight
        position={[50, 100, 50]}
        intensity={0.6}
        color="#ffffff"
        castShadow={false}
      />

      {/* Fill: hemisphere for ground/sky gradient */}
      <hemisphereLight
        skyColor="#1a1a2e"
        groundColor="#0a0a14"
        intensity={0.4}
      />
    </group>
  )
}
```

### TSG.21.5.2 Lighting Constraints

| Constraint | Value | Rationale |
|------------|-------|-----------|
| Ambient minimum | 0.2 intensity | Nodes must be visible without direct light |
| Directional maximum | 0.8 intensity | Avoid washing out color-encoded threat levels |
| Shadow casting | Disabled by default | Shadows add visual noise to dense graphs |
| Color temperature | Neutral white (6500K) | Preserve hue accuracy for color encoding |

Implementations MUST NOT use colored directional lights that shift the
perceived hue of signal nodes. Threat-level color encoding (TSG.21.7.4)
depends on accurate color reproduction.

### TSG.21.5.3 Environment Map

For the dark SIGINT aesthetic, the scene SHOULD use a procedural starfield
environment rather than an HDR environment map:

```typescript
import { Stars } from '@react-three/drei'

function EnvironmentSphere() {
  return (
    <Stars
      radius={500}
      depth={50}
      count={2000}
      factor={4}
      saturation={0}
      fade
      speed={0.5}
    />
  )
}
```

The starfield provides spatial orientation cues during camera rotation
without the overhead of loading and sampling an HDR environment map.

---

## TSG.21.6 Controls and Navigation

### TSG.21.6.1 OrbitControls as Default

The primary navigation control for the R3F layer is `OrbitControls` from
`@react-three/drei`. It provides orbit (left-click drag), zoom (scroll),
and pan (right-click drag) as a unified interaction model:

```typescript
import { OrbitControls } from '@react-three/drei'

function NavigationControls() {
  const controlsRef = useRef<OrbitControlsImpl>(null)

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.08}
      minDistance={5}
      maxDistance={2000}
      minPolarAngle={0}
      maxPolarAngle={Math.PI}
      makeDefault
    />
  )
}
```

### TSG.21.6.2 Control Parameters

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| `enableDamping` | `true` | Smooth deceleration after drag release |
| `dampingFactor` | `0.08` | Low damping = longer coast, feels "weightless" |
| `minDistance` | `5` | Prevent clipping into node geometry |
| `maxDistance` | `2000` | Allow full-scene overview without losing context |
| `minPolarAngle` | `0` | Allow looking straight down (top-down view) |
| `maxPolarAngle` | `Math.PI` | Allow looking straight up (bottom view) |

### TSG.21.6.3 Control Mode Switching

Different visualization modes require different control behaviors. The
active control mode is determined by the scene mode atom:

| Scene Mode | Control | Orbit Center | Constraints |
|------------|---------|-------------|-------------|
| Force Graph | OrbitControls | Graph centroid | Free rotation |
| Globe | OrbitControls | Globe center `[0,0,0]` | Lock distance to globe radius + offset |
| Spectrum | OrbitControls | Mesh center | Limit polar angle to prevent underside view |
| First-Person | PointerLockControls | Camera position | WASD movement, mouse look |

### TSG.21.6.4 Keyboard Shortcuts

Implementations SHOULD support keyboard navigation within the R3F layer
when it has focus:

| Key | Action | Context |
|-----|--------|---------|
| `1` | Switch to Overview preset | All modes |
| `2` | Switch to Top-down preset | All modes |
| `3` | Switch to Isometric preset | All modes |
| `F` | Focus on selection | When signal selected |
| `R` | Reset camera to default | All modes |
| `+` / `-` | Zoom in / out | All modes |
| `Space` | Toggle force simulation pause | Force graph mode |

---

## TSG.21.7 Signal Node Rendering System

### TSG.21.7.1 Signal-to-Geometry Mapping

Each signal type in Tsingou's STIX-aligned taxonomy [TSG.28] is rendered
with a distinct 3D geometry. Geometry selection follows the principle of
pre-attentive visual processing: analysts should identify signal type by
shape alone, without reading labels.

| Signal Kind | STIX Type | Geometry | Three.js Class | Segment Count | Rationale |
|-------------|-----------|----------|---------------|---------------|-----------|
| `indicator` | `indicator` | Octahedron | `OctahedronGeometry` | 1 | Diamond-like, suggests "alert" |
| `observed-data` | `observed-data` | Sphere | `SphereGeometry` | 16, 12 | Neutral, most common signal type |
| `malware` | `malware` | Icosahedron | `IcosahedronGeometry` | 1 | Spiky, irregular, suggests threat |
| `attack-pattern` | `attack-pattern` | Tetrahedron | `TetrahedronGeometry` | 0 | Sharp, minimal facets, aggressive |
| `threat-actor` | `threat-actor` | Box | `BoxGeometry` | 1, 1, 1 | Solid, human-scale, blocky |
| `campaign` | `campaign` | Cylinder | `CylinderGeometry` | 0.5, 0.5, 1, 8 | Pillar, connotes organization |
| `vulnerability` | `vulnerability` | Torus | `TorusGeometry` | 0.7, 0.3, 8, 16 | Ring/hole, suggests exploit surface |
| `infrastructure` | `infrastructure` | Cone | `ConeGeometry` | 0.5, 1, 6 | Beacon shape, directional |
| `identity` | `identity` | Dodecahedron | `DodecahedronGeometry` | 0 | Many faces, represents persona |
| `location` | `location` | Plane (marker) | `PlaneGeometry` | 1, 1 | Flat marker for map overlay |
| `sdr-signal` | `artifact` (SigMF) | Ring (Torus) | `TorusGeometry` | 1.0, 0.1, 8, 32 | Waveform ring, RF connotation |
| `generic` | Any unmatched | Sphere (small) | `SphereGeometry` | 8, 6 | Fallback, lower detail |

### TSG.21.7.2 Geometry Registry

Geometries MUST be created once and shared across all instances of the same
signal kind. This prevents per-node geometry allocation:

```typescript
import { useMemo } from 'react'
import * as THREE from 'three'

const GEOMETRY_REGISTRY: Record<string, THREE.BufferGeometry> = {}

function getGeometryForKind(kind: string): THREE.BufferGeometry {
  if (GEOMETRY_REGISTRY[kind]) return GEOMETRY_REGISTRY[kind]

  const geom = createGeometryForKind(kind)
  GEOMETRY_REGISTRY[kind] = geom
  return geom
}

function createGeometryForKind(kind: string): THREE.BufferGeometry {
  switch (kind) {
    case 'indicator':    return new THREE.OctahedronGeometry(1, 1)
    case 'observed-data': return new THREE.SphereGeometry(1, 16, 12)
    case 'malware':      return new THREE.IcosahedronGeometry(1, 1)
    case 'attack-pattern': return new THREE.TetrahedronGeometry(1, 0)
    case 'threat-actor': return new THREE.BoxGeometry(1, 1, 1)
    case 'campaign':     return new THREE.CylinderGeometry(0.5, 0.5, 1, 8)
    case 'vulnerability': return new THREE.TorusGeometry(0.7, 0.3, 8, 16)
    case 'infrastructure': return new THREE.ConeGeometry(0.5, 1, 6)
    case 'identity':     return new THREE.DodecahedronGeometry(1, 0)
    case 'sdr-signal':   return new THREE.TorusGeometry(1.0, 0.1, 8, 32)
    default:             return new THREE.SphereGeometry(1, 8, 6)
  }
}
```

### TSG.21.7.3 Material System

Signal nodes use `MeshStandardMaterial` for consistent lighting response.
Material properties encode signal metadata:

| Material Property | Encoding | Range |
|-------------------|----------|-------|
| `color` | Threat level (TSG.21.7.4) | Gradient blue → red |
| `emissive` | Active/selected state | `#000000` (inactive) → color (active) |
| `emissiveIntensity` | Alert urgency | 0.0 (normal) → 1.0 (critical) |
| `opacity` | Confidence score | 0.3 (low) → 1.0 (high) |
| `metalness` | Corroborated vs raw | 0.0 (raw) → 0.6 (corroborated) |
| `roughness` | Recency | 0.8 (stale) → 0.2 (fresh) |

```typescript
function createMaterialForSignal(signal: BaseSignal): THREE.MeshStandardMaterial {
  const color = threatLevelToColor(signal.threatLevel)
  return new THREE.MeshStandardMaterial({
    color,
    emissive: new THREE.Color(color),
    emissiveIntensity: signal.isActive ? 0.4 : 0.0,
    transparent: signal.confidence < 1.0,
    opacity: Math.max(0.3, signal.confidence),
    metalness: signal.corroborated ? 0.6 : 0.0,
    roughness: mapRecencyToRoughness(signal.lastSeen),
  })
}
```

### TSG.21.7.4 Threat Level Color Encoding

Threat level maps to a perceptually uniform color gradient designed for
dark backgrounds. Colors are chosen to be distinguishable under the
neutral-white lighting model (TSG.21.5.2) and to analysts with common
forms of color vision deficiency (deuteranopia).

| Threat Level | Numeric | Hex Color | RGB | Visual |
|-------------|---------|-----------|-----|--------|
| `none` | 0 | `#4a9eff` | (74, 158, 255) | Cool blue |
| `low` | 1 | `#22d3ee` | (34, 211, 238) | Cyan |
| `medium` | 2 | `#facc15` | (250, 204, 21) | Amber/yellow |
| `high` | 3 | `#f97316` | (249, 115, 22) | Orange |
| `critical` | 4 | `#ef4444` | (239, 68, 68) | Red |
| `unknown` | -1 | `#94a3b8` | (148, 163, 184) | Slate gray |

```typescript
const THREAT_COLORS: Record<number, string> = {
  [-1]: '#94a3b8', // unknown
  [0]:  '#4a9eff', // none
  [1]:  '#22d3ee', // low
  [2]:  '#facc15', // medium
  [3]:  '#f97316', // high
  [4]:  '#ef4444', // critical
}

function threatLevelToColor(level: number): string {
  return THREAT_COLORS[level] ?? THREAT_COLORS[-1]
}
```

Implementations MUST NOT use green/red only encoding. The blue-to-red
gradient via cyan/amber provides CVD-accessible differentiation.

### TSG.21.7.5 Node Sizing

Node radius encodes a secondary data dimension. The default encoding is
signal weight (derived from corroboration count, source reliability, and
temporal recency):

| Weight Range | Radius | Scale Factor |
|-------------|--------|-------------|
| 0.0 - 0.2 | Small | 0.5 |
| 0.2 - 0.5 | Medium | 0.8 |
| 0.5 - 0.8 | Large | 1.2 |
| 0.8 - 1.0 | Extra Large | 1.8 |

```typescript
function weightToRadius(weight: number): number {
  // Clamp weight to [0, 1]
  const w = Math.max(0, Math.min(1, weight))
  // Non-linear scaling: sqrt for perceptual area proportionality
  return 0.5 + Math.sqrt(w) * 1.3
}
```

The sqrt scaling ensures that a signal with 4x the weight appears 2x the
radius, which is 4x the projected area — maintaining perceptual
proportionality.

---

## TSG.21.8 3D Force-Directed Graph for Link Analysis

### TSG.21.8.1 Architecture

The 3D force-directed graph is the primary visualization for intelligence
link analysis. It renders STIX SDOs as nodes and STIX SROs (relationships)
as edges in 3D space, using force simulation to produce a spatial layout
that reveals community structure, hub entities, and isolated clusters.

```
┌─────────────────────────────────────────────────────────────────┐
│                    Force Graph Pipeline                         │
│                                                                 │
│  activeSignalsAtom ──▶ ┌───────────────┐                       │
│                        │  d3-force-3d   │ ──▶ nodePositionMapAtom│
│  correlationAtom ────▶ │  Simulation    │                       │
│                        │  (Web Worker)  │ ──▶ edgePositionAtom  │
│  selectedIdsAtom ────▶ └───────────────┘                       │
│                              │                                  │
│                              ▼                                  │
│                     ┌──────────────────┐                       │
│                     │  R3F Components   │                       │
│                     │  InstancedNodes   │                       │
│                     │  EdgeLines        │                       │
│                     │  NodeLabels       │                       │
│                     └──────────────────┘                       │
└─────────────────────────────────────────────────────────────────┘
```

### TSG.21.8.2 d3-force-3d Integration

The force simulation runs in a Web Worker to avoid blocking the main thread.
The `d3-force-3d` library extends d3-force with a z-axis:

```typescript
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
} from 'd3-force-3d'

interface GraphNode {
  id: string
  kind: string
  threatLevel: number
  weight: number
  x?: number
  y?: number
  z?: number
  vx?: number
  vy?: number
  vz?: number
}

interface GraphLink {
  source: string
  target: string
  type: string   // STIX SRO relationship type
  weight: number // correlation strength
}

function createSimulation(nodes: GraphNode[], links: GraphLink[]) {
  return forceSimulation(nodes, 3) // 3 = three dimensions
    .force('link', forceLink(links)
      .id((d: GraphNode) => d.id)
      .distance((l: GraphLink) => 30 / (l.weight + 0.1))
      .strength((l: GraphLink) => Math.min(1, l.weight))
    )
    .force('charge', forceManyBody()
      .strength(-120)
      .distanceMax(300)
    )
    .force('center', forceCenter(0, 0, 0))
    .force('collide', forceCollide()
      .radius((d: GraphNode) => weightToRadius(d.weight) * 2)
      .iterations(2)
    )
    .alphaDecay(0.02)
    .velocityDecay(0.3)
}
```

### TSG.21.8.3 Force Parameters

| Force | Parameter | Value | Rationale |
|-------|-----------|-------|-----------|
| `link` | `distance` | `30 / (weight + 0.1)` | Strong correlations pull nodes closer |
| `link` | `strength` | `min(1, weight)` | Proportional to correlation confidence |
| `charge` | `strength` | `-120` | Repulsion prevents node overlap |
| `charge` | `distanceMax` | `300` | Limit repulsion range for performance |
| `center` | position | `(0, 0, 0)` | Keep graph centered in view |
| `collide` | `radius` | `nodeRadius * 2` | Prevent visual overlap |
| `collide` | `iterations` | `2` | Balance accuracy vs performance |
| — | `alphaDecay` | `0.02` | Slow cooldown for stable layout |
| — | `velocityDecay` | `0.3` | Moderate friction, not too bouncy |

### TSG.21.8.4 Web Worker Simulation

The force simulation MUST run in a Web Worker for graphs exceeding 500
nodes. The worker receives node/link updates via `postMessage` and emits
position arrays each simulation tick:

```
Main Thread                              Web Worker
─────────────                            ──────────

 atomUpdate ──▶ postMessage({
   type: 'UPDATE_GRAPH',
   nodes: [...],   ──────────────────▶   simulation.nodes(nodes)
   links: [...]                          simulation.force('link').links(links)
 })
                                         simulation.on('tick', () => {
 nodePositionMapAtom ◀── postMessage({     postMessage({
   type: 'TICK',           ◀─────────       type: 'TICK',
   positions: Float32Array                   positions: Float32Array
 })                                        })
                                         })
```

The position data is transferred as `Float32Array` via structured clone
(not JSON serialization) to minimize transfer overhead. For 10,000 nodes,
this is 10,000 * 3 * 4 = 120KB per tick — acceptable at 60 ticks/sec.

### TSG.21.8.5 Edge Rendering

Edges between nodes represent STIX SRO relationships. They are rendered
as `<Line>` elements from `@react-three/drei`:

| Edge Property | Encoding | Visual |
|---------------|----------|--------|
| Width | Correlation strength | 0.5px (weak) → 3px (strong) |
| Color | Relationship type | See table below |
| Opacity | Recency | 0.2 (stale) → 1.0 (fresh) |
| Dash pattern | Confidence | Solid (high) → dashed (low) |

**Edge Color by Relationship Type:**

| STIX Relationship | Color | Hex |
|-------------------|-------|-----|
| `uses` | Purple | `#a855f7` |
| `targets` | Red | `#ef4444` |
| `attributed-to` | Orange | `#f97316` |
| `indicates` | Cyan | `#22d3ee` |
| `related-to` | Gray | `#6b7280` |
| `derived-from` | Blue | `#3b82f6` |
| `mitigates` | Green | `#22c55e` |
| `communicates-with` | Yellow | `#eab308` |

### TSG.21.8.6 Node Label Rendering

Labels are rendered using drei's `<Html>` component for crisp text that
scales with the DOM, not with 3D perspective:

```typescript
import { Html } from '@react-three/drei'

function NodeLabel({ node, position }: { node: GraphNode; position: [number, number, number] }) {
  const isSelected = useAtomValue(selectedSignalIdsAtom).has(node.id)

  return (
    <Html
      position={position}
      center
      distanceFactor={10}
      style={{
        fontSize: 'var(--tmnl-text-xs, 12px)',
        color: 'white',
        background: 'rgba(0, 0, 0, 0.6)',
        padding: '2px 6px',
        borderRadius: '3px',
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
        opacity: isSelected ? 1 : 0.7,
      }}
    >
      {node.id.slice(0, 12)}
    </Html>
  )
}
```

Labels MUST NOT render below 12px font size [TSG.3-R7]. The `distanceFactor`
prop scales label visibility by camera distance — labels fade when zoomed
out to prevent visual clutter.

### TSG.21.8.7 Graph Layout Strategies

Beyond the default force-directed layout, implementations SHOULD support
alternative layout strategies selectable via atom:

| Layout | Algorithm | Use Case | Library |
|--------|-----------|----------|---------|
| **Force-directed** | d3-force-3d | General link analysis | `d3-force-3d` |
| **Hierarchical** | Sugiyama / Dagre | Kill chain, campaign flow | `dagre` |
| **Radial** | Concentric circles | Ego network (focal entity) | Custom |
| **Clustered** | Force + cluster force | Community detection | `d3-force-3d` + custom |
| **Geographic** | Lat/lon projection | Location-aware graph | `d3-geo` |

---

## TSG.21.9 Instanced Rendering for High Cardinality

### TSG.21.9.1 The Instanced Rendering Imperative

For datasets exceeding 1,000 nodes, individual `<mesh>` components per
node become prohibitively expensive. Each `<mesh>` is a separate draw call,
and at 10,000+ draw calls, GPU driver overhead dominates frame time.

`InstancedMesh` solves this by rendering all instances of a geometry in a
single draw call. A 10,000-node graph with one geometry type requires 1
draw call instead of 10,000.

```
Without InstancedMesh:                With InstancedMesh:
─────────────────────                 ────────────────────
10,000 <mesh> components              1 <instancedMesh>
= 10,000 draw calls                   = 1 draw call
= ~16ms+ per frame                    = ~0.5ms per frame
= <60 FPS (failure)                   = 60+ FPS (target)
```

### TSG.21.9.2 Per-Kind Instanced Meshes

Since each signal kind has a distinct geometry (TSG.21.7.1), the scene uses
one `InstancedMesh` per signal kind. With ~12 signal kinds, this means 12
draw calls total — well within the performance budget.

```typescript
function InstancedSignalNodes() {
  const signals = useAtomValue(activeSignalsAtom)
  const positions = useAtomValue(nodePositionMapAtom)

  // Group signals by kind
  const grouped = useMemo(() => {
    const groups = new Map<string, BaseSignal[]>()
    for (const signal of signals) {
      const list = groups.get(signal.kind) ?? []
      list.push(signal)
      groups.set(signal.kind, list)
    }
    return groups
  }, [signals])

  return (
    <group>
      {[...grouped.entries()].map(([kind, kindSignals]) => (
        <KindInstancedMesh
          key={kind}
          kind={kind}
          signals={kindSignals}
          positions={positions}
        />
      ))}
    </group>
  )
}
```

### TSG.21.9.3 Buffer Attribute Updates

Instance transforms (position, rotation, scale) and per-instance colors
are written to buffer attributes. These updates MUST use `useFrame` with
ref-based mutation to avoid React reconciliation overhead:

```typescript
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

function KindInstancedMesh({
  kind,
  signals,
  positions,
}: {
  kind: string
  signals: BaseSignal[]
  positions: Map<string, [number, number, number]>
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null!)
  const tempObject = useMemo(() => new THREE.Object3D(), [])
  const tempColor = useMemo(() => new THREE.Color(), [])
  const geometry = useMemo(() => getGeometryForKind(kind), [kind])

  useFrame(() => {
    if (!meshRef.current) return

    for (let i = 0; i < signals.length; i++) {
      const signal = signals[i]
      const pos = positions.get(signal.id)
      if (!pos) continue

      // Position
      tempObject.position.set(pos[0], pos[1], pos[2])

      // Scale by weight
      const radius = weightToRadius(signal.weight)
      tempObject.scale.setScalar(radius)

      tempObject.updateMatrix()
      meshRef.current.setMatrixAt(i, tempObject.matrix)

      // Per-instance color
      tempColor.set(threatLevelToColor(signal.threatLevel))
      meshRef.current.setColorAt(i, tempColor)
    }

    meshRef.current.instanceMatrix.needsUpdate = true
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true
    }
  })

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, undefined, signals.length]}
    >
      <meshStandardMaterial vertexColors />
    </instancedMesh>
  )
}
```

### TSG.21.9.4 Instance Count Management

When signal count changes (signals added or removed), the `InstancedMesh`
must be re-created with the new count. Implementations SHOULD over-allocate
by 20% to absorb minor count fluctuations without full re-creation:

```typescript
function useInstanceCount(actualCount: number): number {
  const [allocatedCount, setAllocatedCount] = useState(
    Math.ceil(actualCount * 1.2)
  )

  useEffect(() => {
    if (actualCount > allocatedCount || actualCount < allocatedCount * 0.5) {
      setAllocatedCount(Math.ceil(actualCount * 1.2))
    }
  }, [actualCount, allocatedCount])

  return allocatedCount
}
```

### TSG.21.9.5 drei Helpers: Instances and Merged

For simpler use cases, `@react-three/drei` provides `<Instances>` and
`<Merged>` components that abstract the `InstancedMesh` API:

```typescript
import { Instances, Instance } from '@react-three/drei'

function SimpleInstancedNodes({ signals }: { signals: BaseSignal[] }) {
  return (
    <Instances limit={signals.length}>
      <sphereGeometry args={[1, 16, 12]} />
      <meshStandardMaterial />
      {signals.map(signal => (
        <Instance
          key={signal.id}
          position={getPosition(signal.id)}
          scale={weightToRadius(signal.weight)}
          color={threatLevelToColor(signal.threatLevel)}
        />
      ))}
    </Instances>
  )
}
```

Implementations SHOULD use the raw `<instancedMesh>` API (TSG.21.9.3) for
maximum performance in the force graph, and MAY use drei's `<Instances>`
for secondary visualizations with lower node counts (<1,000).

### TSG.21.9.6 Performance Scaling Table

| Node Count | Rendering Strategy | Expected Draw Calls | Target FPS |
|-----------|-------------------|--------------------|-----------|
| < 100 | Individual `<mesh>` | ~100 | 60 |
| 100 - 1,000 | drei `<Instances>` | ~12 (per kind) | 60 |
| 1,000 - 10,000 | Raw `<instancedMesh>` | ~12 (per kind) | 60 |
| 10,000 - 50,000 | `<instancedMesh>` + LOD + culling | ~12 + LOD overhead | 30-60 |
| > 50,000 | Server-side aggregation required | N/A | N/A |

---

## TSG.21.10 Geospatial 3D Visualization

### TSG.21.10.1 Globe View Architecture

The globe view renders signals on a 3D Earth sphere, providing geographic
context for signal source locations. This is the primary view for
geospatial analysis [TSG.3.7, Technique #3].

```
┌─────────────────────────────────────────────────────────────┐
│                    Globe View Stack                          │
│                                                             │
│  ┌────────────────────────────────────────────────────┐     │
│  │  <GlobeGroup>                                      │     │
│  │    ├── <GlobeMesh>         Earth sphere, texture    │     │
│  │    │     ├── land masses   (low-poly or textured)   │     │
│  │    │     └── grid lines    latitude/longitude       │     │
│  │    ├── <AtmosphereShell>   Fresnel glow effect      │     │
│  │    ├── <SignalMarkers>     Instanced points on      │     │
│  │    │                       sphere surface           │     │
│  │    ├── <ArcLines>          Great-circle arcs for     │     │
│  │    │                       signal-to-signal links   │     │
│  │    ├── <H3HexGrid>        Hexagonal density bins    │     │
│  │    └── <CountryBorders>   GeoJSON boundary lines    │     │
│  └────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

### TSG.21.10.2 Globe Mesh

The globe uses a `SphereGeometry` with either a procedural or textured
surface:

```typescript
function GlobeMesh() {
  const texture = useTexture('/textures/earth-blue-marble-4k.jpg')
  const bumpMap = useTexture('/textures/earth-topology-2k.jpg')

  return (
    <mesh>
      <sphereGeometry args={[100, 64, 64]} />
      <meshStandardMaterial
        map={texture}
        bumpMap={bumpMap}
        bumpScale={0.5}
        metalness={0.1}
        roughness={0.8}
      />
    </mesh>
  )
}
```

For lightweight deployments, implementations MAY use a procedural globe
with GeoJSON country outlines rendered as `<Line>` elements instead of
a textured sphere:

```typescript
function ProceduralGlobe() {
  return (
    <group>
      {/* Dark sphere base */}
      <mesh>
        <sphereGeometry args={[100, 48, 48]} />
        <meshStandardMaterial color="#0a1628" />
      </mesh>

      {/* GeoJSON country outlines */}
      <CountryBorders radius={100.1} color="#1e3a5f" />

      {/* Atmosphere Fresnel */}
      <AtmosphereShell radius={102} />
    </group>
  )
}
```

### TSG.21.10.3 Latitude/Longitude to 3D Conversion

All geographic coordinates MUST be converted from (lat, lon) to (x, y, z)
on the sphere surface using the standard spherical-to-Cartesian transform:

```typescript
function latLonToXYZ(
  lat: number,   // degrees, -90 to +90
  lon: number,   // degrees, -180 to +180
  radius: number // sphere radius
): [number, number, number] {
  const phi   = (90 - lat) * (Math.PI / 180)
  const theta = (lon + 180) * (Math.PI / 180)

  return [
    -(radius * Math.sin(phi) * Math.cos(theta)),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.sin(theta),
  ]
}
```

### TSG.21.10.4 Signal Markers on Globe

Signals with location data are rendered as instanced points on the globe
surface. Each marker is offset slightly above the sphere to prevent
z-fighting:

```typescript
function SignalMarkers({ signals, radius }: Props) {
  const meshRef = useRef<THREE.InstancedMesh>(null!)
  const tempObject = useMemo(() => new THREE.Object3D(), [])
  const tempColor = useMemo(() => new THREE.Color(), [])

  useFrame(() => {
    if (!meshRef.current) return

    let i = 0
    for (const signal of signals) {
      if (!signal.location) continue

      const [x, y, z] = latLonToXYZ(
        signal.location.lat,
        signal.location.lon,
        radius + 0.5 // offset above surface
      )

      tempObject.position.set(x, y, z)
      tempObject.lookAt(0, 0, 0) // orient marker outward
      tempObject.rotateX(Math.PI / 2)
      tempObject.scale.setScalar(weightToRadius(signal.weight) * 0.3)
      tempObject.updateMatrix()

      meshRef.current.setMatrixAt(i, tempObject.matrix)
      tempColor.set(threatLevelToColor(signal.threatLevel))
      meshRef.current.setColorAt(i, tempColor)
      i++
    }

    meshRef.current.count = i
    meshRef.current.instanceMatrix.needsUpdate = true
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true
    }
  })

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, signals.length]}>
      <coneGeometry args={[0.5, 1.5, 4]} />
      <meshStandardMaterial vertexColors />
    </instancedMesh>
  )
}
```

### TSG.21.10.5 Arc Lines (Great Circle Connections)

Edges between geographically located signals are rendered as 3D arcs
(great circle segments with altitude) above the globe surface:

```typescript
import { QuadraticBezierLine } from '@react-three/drei'

function ArcLine({
  from,
  to,
  radius,
  color,
}: {
  from: [number, number]  // [lat, lon]
  to: [number, number]    // [lat, lon]
  radius: number
  color: string
}) {
  const start = latLonToXYZ(from[0], from[1], radius + 0.5)
  const end   = latLonToXYZ(to[0], to[1], radius + 0.5)

  // Midpoint elevated above the surface for arc visibility
  const mid: [number, number, number] = [
    (start[0] + end[0]) / 2,
    (start[1] + end[1]) / 2,
    (start[2] + end[2]) / 2,
  ]
  const midLength = Math.sqrt(mid[0]**2 + mid[1]**2 + mid[2]**2)
  const arcHeight = radius * 1.3 // 30% above surface
  const scale = arcHeight / midLength
  const control: [number, number, number] = [
    mid[0] * scale,
    mid[1] * scale,
    mid[2] * scale,
  ]

  return (
    <QuadraticBezierLine
      start={start}
      end={end}
      mid={control}
      color={color}
      lineWidth={1.5}
      transparent
      opacity={0.6}
    />
  )
}
```

### TSG.21.10.6 H3 Hexagonal Grid

For signal density visualization, the globe surface is divided into
H3 hexagonal cells [Uber H3]. Each cell aggregates signal count and renders
as a hexagonal prism extruded from the sphere surface. Height encodes
signal density, color encodes maximum threat level in the cell:

```
             Top-down view of H3 hexagons
            on globe (Mercator approximation)

          ╱╲    ╱╲    ╱╲    ╱╲    ╱╲
         ╱  ╲  ╱  ╲  ╱  ╲  ╱  ╲  ╱  ╲
        │    ││ 3  ││ 7  ││ 2  ││    │
         ╲  ╱  ╲  ╱  ╲  ╱  ╲  ╱  ╲  ╱
          ╲╱    ╲╱    ╲╱    ╲╱    ╲╱
         ╱╲    ╱╲    ╱╲    ╱╲    ╱╲
        ╱  ╲  ╱  ╲  ╱  ╲  ╱  ╲  ╱  ╲
       │    ││ 12 ││ 45 ││ 8  ││    │   ← number = signal count
        ╲  ╱  ╲  ╱  ╲  ╱  ╲  ╱  ╲  ╱      height = extrusion
         ╲╱    ╲╱    ╲╱    ╲╱    ╲╱
```

| H3 Resolution | Hex Area (avg) | Use Case |
|---------------|---------------|----------|
| 2 | ~86,745 km^2 | Continental overview |
| 3 | ~12,392 km^2 | Regional analysis |
| 4 | ~1,770 km^2 | City-level clusters |
| 5 | ~252 km^2 | Neighborhood precision |

Implementations SHOULD use H3 resolution 3 as the default and allow
analysts to adjust resolution via the DOM layer controls.

### TSG.21.10.7 Terrain Overlays

For theater-level analysis (military/operational SIGINT), the globe view
MAY support terrain mesh overlays using heightmap-displaced planes:

```typescript
function TerrainOverlay({
  bounds,
  heightmap,
  resolution,
}: {
  bounds: { north: number; south: number; east: number; west: number }
  heightmap: Float32Array
  resolution: [number, number]
}) {
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(
      1, 1,
      resolution[0] - 1, resolution[1] - 1
    )
    const positions = geo.attributes.position

    for (let i = 0; i < positions.count; i++) {
      const elevation = heightmap[i] * 0.001 // scale meters to scene units
      positions.setZ(i, elevation)
    }

    positions.needsUpdate = true
    geo.computeVertexNormals()
    return geo
  }, [heightmap, resolution])

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial
        color="#2d4a2d"
        wireframe={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}
```

---

## TSG.21.11 Spectrum Visualization in 3D

### TSG.21.11.1 3D Waterfall Mesh

While the primary spectrum waterfall is rendered in the p5 layer (z:2)
[TSG.3.4], the R3F layer provides a complementary 3D waterfall visualization
that maps frequency x time x magnitude to a scrolling mesh surface. This
allows analysts to rotate and inspect the waterfall from arbitrary angles.

```
        Frequency →
    ┌───────────────────────┐
    │                       │  ↑
    │   ╱╲    ╱╲  ╱╲       │  │ Magnitude
    │  ╱  ╲╱╲╱  ╲╱  ╲╱╲   │  │ (height)
    │ ╱              ╲  ╲  │  ↓
    │╱                 ╲╱  │
    │                       │
  T ├───────────────────────┤  ← newest FFT frame
  i │   ╱╲                  │
  m │  ╱  ╲   ╱╲╱╲         │
  e │ ╱    ╲ ╱    ╲        │
    │╱      ╲╱      ╲      │
  ↓ ├───────────────────────┤
    │  ╱╲╱╲                 │  ← oldest visible frame
    │ ╱    ╲  ╱╲            │
    │╱      ╲╱  ╲           │
    └───────────────────────┘

    3D view allows rotation around all axes
```

### TSG.21.11.2 Waterfall Mesh Implementation

The waterfall uses a `PlaneGeometry` with vertex height displacement driven
by FFT magnitude data. New FFT frames scroll the vertex buffer:

```typescript
function WaterfallMesh({
  fftHistory,
  bins,
  historyLength,
}: {
  fftHistory: Float32Array[]  // ring buffer of FFT frames
  bins: number                // FFT bin count (e.g., 1024)
  historyLength: number       // visible history frames (e.g., 256)
}) {
  const meshRef = useRef<THREE.Mesh>(null!)

  const geometry = useMemo(() => {
    return new THREE.PlaneGeometry(
      bins * 0.1,           // width
      historyLength * 0.1,  // depth
      bins - 1,             // widthSegments
      historyLength - 1     // heightSegments
    )
  }, [bins, historyLength])

  useFrame(() => {
    if (!meshRef.current) return

    const positions = geometry.attributes.position as THREE.BufferAttribute
    const colors = geometry.attributes.color as THREE.BufferAttribute

    for (let t = 0; t < historyLength; t++) {
      const frame = fftHistory[t]
      if (!frame) continue

      for (let f = 0; f < bins; f++) {
        const idx = t * bins + f
        const magnitude = frame[f] ?? -100

        // Height = magnitude mapped from [-100, 0] dB to [0, 10] units
        const height = ((magnitude + 100) / 100) * 10
        positions.setZ(idx, height)

        // Color: blue (-100dB) → red (0dB)
        const hue = ((magnitude + 100) / 100)  // 0 (cold) → 1 (hot)
        const r = hue
        const g = hue * 0.3
        const b = 1 - hue
        if (colors) {
          colors.setXYZ(idx, r, g, b)
        }
      }
    }

    positions.needsUpdate = true
    if (colors) colors.needsUpdate = true
    geometry.computeVertexNormals()
  })

  return (
    <mesh ref={meshRef} geometry={geometry} rotation={[-Math.PI / 4, 0, 0]}>
      <meshStandardMaterial
        vertexColors
        side={THREE.DoubleSide}
        wireframe={false}
      />
    </mesh>
  )
}
```

### TSG.21.11.3 Frequency Ridge Plots

An alternative spectrum visualization renders each time slice as an
independent line (ridge) stacked in the z-axis, creating a "joy plot"
effect in 3D:

```typescript
import { Line } from '@react-three/drei'

function RidgePlot({
  fftHistory,
  bins,
  visibleFrames,
}: Props) {
  return (
    <group>
      {fftHistory.slice(0, visibleFrames).map((frame, t) => {
        const points: [number, number, number][] = []

        for (let f = 0; f < bins; f++) {
          const x = (f / bins) * 100 - 50
          const y = ((frame[f] + 100) / 100) * 5
          const z = t * 0.5
          points.push([x, y, z])
        }

        return (
          <Line
            key={t}
            points={points}
            color={`hsl(${240 - t * (240 / visibleFrames)}, 80%, 60%)`}
            lineWidth={1}
          />
        )
      })}
    </group>
  )
}
```

### TSG.21.11.4 Spectrum Performance Constraints

| Parameter | Budget | Rationale |
|-----------|--------|-----------|
| FFT bins | 1024 max per frame | Vertex count = bins x history |
| History frames | 256 max | Total vertices = 1024 x 256 = 262K |
| Update rate | 30 Hz | Half of target FPS to leave headroom |
| Vertex updates | 262,144 per frame (max) | ~1MB buffer write per frame |

For SDR data arriving at 60+ frames/sec, implementations MUST decimate to
30 Hz for the 3D waterfall. The p5 layer (z:2) MAY render at full rate for
its 2D waterfall since Canvas 2D pixel writes are lighter than vertex
buffer updates.

---

## TSG.21.12 drei Library Usage

### TSG.21.12.1 drei Component Inventory

`@react-three/drei` provides helper components that simplify common R3F
patterns. The following components are used in the Tsingou R3F layer:

| Component | drei Export | Use in Tsingou | Section |
|-----------|-----------|---------------|---------|
| `OrbitControls` | `@react-three/drei` | Primary camera navigation | TSG.21.6 |
| `Html` | `@react-three/drei` | Node labels, info overlays | TSG.21.8.6 |
| `Text` | `@react-three/drei` | 3D axis labels, titles | TSG.21.11 |
| `Billboard` | `@react-three/drei` | Labels that face camera | TSG.21.8.6 |
| `Line` | `@react-three/drei` | Graph edges, ridge plots | TSG.21.8.5 |
| `QuadraticBezierLine` | `@react-three/drei` | Globe arc connections | TSG.21.10.5 |
| `Instances` / `Instance` | `@react-three/drei` | Simple instanced rendering | TSG.21.9.5 |
| `Stars` | `@react-three/drei` | Environment starfield | TSG.21.5.3 |
| `Environment` | `@react-three/drei` | HDR environment maps (optional) | TSG.21.5 |
| `useTexture` | `@react-three/drei` | Globe textures | TSG.21.10.2 |
| `PerspectiveCamera` | `@react-three/drei` | Managed perspective camera | TSG.21.4.2 |
| `OrthographicCamera` | `@react-three/drei` | Managed orthographic camera | TSG.21.4.3 |
| `Merged` | `@react-three/drei` | Multi-geometry instancing | TSG.21.9 |
| `PerformanceMonitor` | `@react-three/drei` | Adaptive quality | TSG.21.18 |
| `AdaptiveDpr` | `@react-three/drei` | Dynamic DPR reduction | TSG.21.18 |
| `Preload` | `@react-three/drei` | Asset preloading | TSG.21.18 |
| `useHelper` | `@react-three/drei` | Debug light/camera helpers | Debug only |

### TSG.21.12.2 Text Rendering with drei

drei's `<Text>` component uses MSDF (Multi-channel Signed Distance Field)
font rendering for crisp 3D text at any camera distance. It is preferred
over `<Html>` when text must exist in 3D space (e.g., axis labels):

```typescript
import { Text } from '@react-three/drei'

function FrequencyAxisLabel() {
  return (
    <Text
      position={[50, -2, 0]}
      fontSize={1.5}
      color="#94a3b8"
      anchorX="center"
      anchorY="top"
      font="/fonts/inter-medium.woff"
    >
      Frequency (MHz)
    </Text>
  )
}
```

`<Text>` font size is in 3D scene units, not pixels. Implementations MUST
ensure that text remains legible at the expected camera distances. For axis
labels viewed from the default camera distance of ~200 units, a `fontSize`
of 1.5 scene units corresponds to approximately 14-16px on screen.

### TSG.21.12.3 Billboard Components

`<Billboard>` wraps its children so they always face the camera, regardless
of the camera's rotation. This is used for node labels and info cards that
should remain readable from any angle:

```typescript
import { Billboard, Text } from '@react-three/drei'

function NodeInfo({ position, label }: Props) {
  return (
    <Billboard position={position} follow lockX={false} lockY={false}>
      <Text fontSize={0.8} color="white" anchorY="bottom">
        {label}
      </Text>
    </Billboard>
  )
}
```

---

## TSG.21.13 Post-Processing Pipeline

### TSG.21.13.1 Effect Composer

Post-processing effects are applied after the main scene render using
`@react-three/postprocessing`, which wraps the `postprocessing` library
with React components:

```typescript
import { EffectComposer, Bloom, SSAO, Outline } from '@react-three/postprocessing'
import { BlendFunction, KernelSize } from 'postprocessing'

function PostProcessingPipeline() {
  const selectedMeshes = useAtomValue(selectedMeshRefsAtom)

  return (
    <EffectComposer multisampling={0}>
      {/* Bloom: active/alert signals glow */}
      <Bloom
        intensity={0.8}
        luminanceThreshold={0.6}
        luminanceSmoothing={0.3}
        kernelSize={KernelSize.MEDIUM}
        mipmapBlur
      />

      {/* SSAO: depth perception for dense graphs */}
      <SSAO
        samples={16}
        radius={5}
        intensity={20}
        luminanceInfluence={0.5}
        color="#000000"
      />

      {/* Outline: selection highlight */}
      <Outline
        selection={selectedMeshes}
        edgeStrength={3}
        pulseSpeed={0}
        visibleEdgeColor={0xffffff}
        hiddenEdgeColor={0x444444}
        blur
        xRay={false}
      />
    </EffectComposer>
  )
}
```

### TSG.21.13.2 Effect Configuration

| Effect | Purpose | Performance Cost | When Active |
|--------|---------|-----------------|-------------|
| **Bloom** | Glow on emissive nodes (alerts, active signals) | Medium (mipmapBlur) | Always |
| **SSAO** | Ambient occlusion for depth cues in dense graphs | High (16 samples) | >100 nodes |
| **Outline** | White outline on selected nodes | Low (edge detection) | When selection active |
| **Vignette** | Subtle edge darkening for focus | Very low | Optional |
| **ChromaticAberration** | Alert/critical state visual warning | Low | Threat level >= critical |

### TSG.21.13.3 Bloom Configuration for Threat Signals

Bloom creates a halo/glow effect around emissive objects. In Tsingou,
signal nodes with high threat levels emit light (via `emissiveIntensity`
in TSG.21.7.3), and Bloom amplifies this emission visually:

| Signal State | `emissiveIntensity` | Bloom Response |
|-------------|--------------------|--------------|
| Normal (no threat) | 0.0 | No bloom |
| Low threat | 0.1 | Faint glow |
| Medium threat | 0.3 | Visible glow |
| High threat | 0.6 | Prominent glow |
| Critical threat | 1.0 | Intense bloom halo |
| Selected | 0.4 | Moderate glow + outline |

The `luminanceThreshold` of 0.6 ensures that only nodes with
`emissiveIntensity >= 0.6` trigger significant bloom, preventing the
entire scene from glowing.

### TSG.21.13.4 SSAO for Dense Graphs

Screen-Space Ambient Occlusion adds subtle shadows in crevices between
closely packed nodes, providing depth perception that flat ambient lighting
cannot:

```
Without SSAO:                    With SSAO:
  ○ ○ ○ ○ ○                      ○ ○ ○ ○ ○
  ○ ○ ○ ○ ○  ← all same shade    ○◐○◐○◐○ ○  ← darker in tight clusters
  ○ ○ ○ ○ ○                      ○ ○◐○ ○ ○     reveals 3D structure
  ○ ○ ○ ○ ○                      ○ ○ ○ ○ ○
```

SSAO SHOULD be disabled when node count is below 100 (insufficient
density to benefit from occlusion cues).

### TSG.21.13.5 Outline for Selection

The `<Outline>` effect renders a screen-space edge detection pass around
selected meshes. It provides a clear visual indicator that does not depend
on color (important for CVD accessibility):

```typescript
// Selection drives outline effect via mesh refs
const selectedMeshRefsAtom = Atom.make<THREE.Mesh[]>([])

function useSelectionOutline(
  meshRef: React.RefObject<THREE.Mesh>,
  isSelected: boolean
) {
  useEffect(() => {
    if (!meshRef.current) return

    if (isSelected) {
      selectedMeshRefsAtom.update(refs => [...refs, meshRef.current!])
    }

    return () => {
      selectedMeshRefsAtom.update(refs =>
        refs.filter(r => r !== meshRef.current)
      )
    }
  }, [isSelected, meshRef])
}
```

### TSG.21.13.6 Adaptive Post-Processing

Post-processing effects SHOULD be dynamically toggled based on frame
performance. The `PerformanceMonitor` from drei drives these decisions:

| Frame Time | Action |
|-----------|--------|
| < 12ms (>83 FPS) | Enable all effects |
| 12-16ms (60-83 FPS) | Normal operation, all effects |
| 16-20ms (50-60 FPS) | Reduce SSAO samples to 8 |
| 20-33ms (30-50 FPS) | Disable SSAO entirely |
| > 33ms (<30 FPS) | Disable Bloom, reduce DPR |

---

## TSG.21.14 Animation System

### TSG.21.14.1 Signal Pulse Animations

Active signals emit a periodic "pulse" animation — a sphere that expands
outward and fades. This provides a visual heartbeat for live signal sources:

```typescript
function SignalPulse({
  position,
  color,
  active,
}: {
  position: [number, number, number]
  color: string
  active: boolean
}) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const materialRef = useRef<THREE.MeshBasicMaterial>(null!)

  useFrame(({ clock }) => {
    if (!active || !meshRef.current || !materialRef.current) return

    const t = (clock.getElapsedTime() % 2) / 2 // 0-1 over 2 seconds
    const scale = 1 + t * 3                     // expand 1x → 4x
    const opacity = 1 - t                        // fade 1 → 0

    meshRef.current.scale.setScalar(scale)
    materialRef.current.opacity = opacity * 0.4
  })

  if (!active) return null

  return (
    <mesh ref={meshRef} position={position}>
      <sphereGeometry args={[1, 16, 12]} />
      <meshBasicMaterial
        ref={materialRef}
        color={color}
        transparent
        opacity={0.4}
        depthWrite={false}
      />
    </mesh>
  )
}
```

### TSG.21.14.2 Edge Flow Particles

Edges in the force graph MAY display animated particles flowing along them
to indicate data flow direction (e.g., "communicates-with" relationships):

```typescript
function EdgeFlowParticle({
  start,
  end,
  speed,
  color,
}: {
  start: [number, number, number]
  end: [number, number, number]
  speed: number
  color: string
}) {
  const meshRef = useRef<THREE.Mesh>(null!)

  useFrame(({ clock }) => {
    if (!meshRef.current) return

    const t = (clock.getElapsedTime() * speed) % 1 // loop 0-1
    meshRef.current.position.lerpVectors(
      new THREE.Vector3(...start),
      new THREE.Vector3(...end),
      t
    )
  })

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[0.15, 8, 6]} />
      <meshBasicMaterial color={color} />
    </mesh>
  )
}
```

For edges with many flow particles, implementations SHOULD use instanced
rendering with a shared particle geometry and per-particle offset stored
in an attribute buffer.

### TSG.21.14.3 Threat Escalation Visual Effects

When a signal's threat level increases, the transition SHOULD be visually
emphasized:

| Transition | Visual Effect | Duration |
|-----------|--------------|----------|
| Any → `high` | Color lerp + scale bounce (1.0 → 1.5 → 1.2) | 400ms |
| Any → `critical` | Color lerp + bloom spike + camera shake (subtle) | 600ms |
| `critical` → lower | Color lerp, no special effect | 300ms |
| Node first appearance | Fade in (opacity 0 → 1) + scale (0 → 1) | 500ms |
| Node removal | Fade out (opacity 1 → 0) + scale (1 → 0) | 300ms |

```typescript
function useThreatEscalation(
  meshRef: React.RefObject<THREE.Mesh>,
  prevLevel: number,
  currentLevel: number
) {
  useEffect(() => {
    if (!meshRef.current || prevLevel >= currentLevel) return

    if (currentLevel >= 4) {
      // Critical escalation: scale bounce
      const mesh = meshRef.current
      const originalScale = mesh.scale.x

      // Frame-based animation via useFrame would be preferred,
      // but this demonstrates the transition intent
      const bounce = () => {
        mesh.scale.setScalar(originalScale * 1.5)
        setTimeout(() => {
          mesh.scale.setScalar(originalScale * 1.2)
        }, 200)
        setTimeout(() => {
          mesh.scale.setScalar(originalScale)
        }, 400)
      }
      bounce()
    }
  }, [currentLevel, prevLevel, meshRef])
}
```

### TSG.21.14.4 Animation Performance Budget

| Animation Type | Instances | Frame Cost | Budget |
|---------------|-----------|-----------|--------|
| Signal pulse | Max 50 active | ~0.5ms (50 scale/opacity writes) | 3% of frame |
| Edge flow particles | Max 200 | ~1ms (200 position lerps) | 6% of frame |
| Threat escalation | Max 5 simultaneous | ~0.1ms (5 scale writes) | <1% of frame |
| Camera transition | 1 | ~0.1ms (1 position/target lerp) | <1% of frame |
| **Total animation** | — | ~1.7ms | **10% of 16ms budget** |

---

## TSG.21.15 Interaction Model

### TSG.21.15.1 Raycasting for Selection

R3F provides built-in raycasting via the `onPointerDown`, `onPointerOver`,
and `onPointerOut` event handlers on `<mesh>` elements. For instanced
meshes, raycasting requires manual intersection testing:

```typescript
import { ThreeEvent } from '@react-three/fiber'

function InteractionManager() {
  const { raycaster, camera, scene } = useThree()
  const signals = useAtomValue(activeSignalsAtom)
  const positions = useAtomValue(nodePositionMapAtom)

  const handlePointerDown = useCallback((event: ThreeEvent<PointerEvent>) => {
    // For InstancedMesh, event.instanceId gives the instance index
    if (event.instanceId !== undefined) {
      const signal = signals[event.instanceId]
      if (signal) {
        selectedSignalIdsAtom.update(ids => {
          const next = new Set(ids)
          if (event.nativeEvent.shiftKey) {
            // Shift+click: toggle in selection
            if (next.has(signal.id)) next.delete(signal.id)
            else next.add(signal.id)
          } else {
            // Click: replace selection
            next.clear()
            next.add(signal.id)
          }
          return next
        })
      }
    }
  }, [signals])

  return null // Interaction is handled via mesh event props
}
```

### TSG.21.15.2 Hover State Management

Hover state is tracked via `hoveredSignalIdAtom` [TSG.3.7.3]. When a
signal node is hovered, the R3F layer provides visual feedback (scale
increase, emissive boost) and the DOM layer shows a tooltip:

```typescript
const hoveredSignalIdAtom = Atom.make<string | null>(null)

function useHoverFeedback(
  meshRef: React.RefObject<THREE.Mesh>,
  signalId: string
) {
  const isHovered = useAtomValue(hoveredSignalIdAtom) === signalId

  useFrame(() => {
    if (!meshRef.current) return

    // Scale up on hover
    const targetScale = isHovered ? 1.3 : 1.0
    meshRef.current.scale.lerp(
      new THREE.Vector3(targetScale, targetScale, targetScale),
      0.15
    )
  })
}
```

### TSG.21.15.3 Selection Interaction Patterns

| Interaction | Input | Behavior |
|------------|-------|----------|
| **Select single** | Click on node | Clear selection, add clicked node |
| **Add to selection** | Shift + click | Toggle node in selection set |
| **Box select** | Click + drag on background | Select all nodes in screen-space rectangle |
| **Deselect all** | Click on background | Clear selection |
| **Hover inspect** | Mouse over node | Show tooltip, scale up node |
| **Drill down** | Double-click on node | Open detail panel in DOM layer |
| **Context menu** | Right-click on node | Show context menu in DOM layer |

### TSG.21.15.4 Box Selection

Box selection (marquee select) requires projecting 3D node positions to
screen space and testing against the 2D selection rectangle:

```typescript
function useBoxSelection() {
  const { camera, size } = useThree()
  const positions = useAtomValue(nodePositionMapAtom)
  const signals = useAtomValue(activeSignalsAtom)

  const selectInBox = useCallback((
    screenStart: [number, number],
    screenEnd: [number, number]
  ) => {
    const selected = new Set<string>()

    const minX = Math.min(screenStart[0], screenEnd[0])
    const maxX = Math.max(screenStart[0], screenEnd[0])
    const minY = Math.min(screenStart[1], screenEnd[1])
    const maxY = Math.max(screenStart[1], screenEnd[1])

    for (const signal of signals) {
      const pos = positions.get(signal.id)
      if (!pos) continue

      const projected = new THREE.Vector3(...pos).project(camera)
      const screenX = (projected.x + 1) / 2 * size.width
      const screenY = (-projected.y + 1) / 2 * size.height

      if (screenX >= minX && screenX <= maxX &&
          screenY >= minY && screenY <= maxY) {
        selected.add(signal.id)
      }
    }

    selectedSignalIdsAtom.set(selected)
  }, [camera, size, positions, signals])

  return selectInBox
}
```

### TSG.21.15.5 Pointer Events and Layer Compositing

The R3F canvas sits at z-index 0. Upper layers (visx, p5) have
`pointer-events: none` [TSG.3.1.2], so pointer events fall through to the
R3F canvas unless intercepted by the DOM layer (z:3).

```
Pointer event flow:

  User clicks at (x, y)
        │
        ▼
  DOM layer (z:3)
  ┌──────────────────────┐
  │ Has interactive       │
  │ element at (x, y)?    │──── YES ──▶ DOM handles event
  │                       │
  └──────────┬────────────┘
             │ NO (pointer-events: auto, but no target)
             ▼
  p5 layer (z:2)  pointer-events: none → passes through
             │
             ▼
  visx layer (z:1)  pointer-events: none → passes through
             │
             ▼
  R3F layer (z:0)
  ┌──────────────────────┐
  │ Raycast into 3D scene │
  │ Hit node? ────────────│──── YES ──▶ Select/hover node
  │                       │
  │ No hit ───────────────│──── YES ──▶ Deselect / start box select
  └───────────────────────┘
```

---

## TSG.21.16 Atom-as-State Integration

### TSG.21.16.1 Reactive 3D Scene Updates

The R3F layer subscribes to atoms for all data and configuration. It MUST
NOT receive data via props from parent components (which would couple it to
the component hierarchy) or via direct imports from pipeline modules (which
would couple it to TsingouFlow).

**Data flow atoms** (populated by OutputBridge [TSG.3.6]):

| Atom | Type | Source | R3F Consumer |
|------|------|--------|-------------|
| `activeSignalsAtom` | `BaseSignal[]` | OutputBridge batch | InstancedSignalNodes |
| `crossCorrelationAtom` | `Correlation[]` | OutputBridge | EdgeLines |
| `nodePositionMapAtom` | `Map<string, Vec3>` | Force worker | All positioned elements |
| `fftMagnitudesAtom` | `Float32Array` | SDR adapter | WaterfallMesh |
| `anomalyAtom` | `Anomaly[]` | Anomaly detector | Alert markers |

**Selection/interaction atoms** (shared across layers [TSG.3.7.3]):

| Atom | Type | Writers | Readers |
|------|------|---------|---------|
| `selectedSignalIdsAtom` | `Set<string>` | InteractionManager (R3F, DOM) | All layers |
| `hoveredSignalIdAtom` | `string \| null` | InteractionManager | All layers |
| `activeSceneModeAtom` | `SceneMode` | DOM controls | SceneContent |
| `cameraPresetAtom` | `CameraPreset` | DOM controls, keyboard | CameraTransitionManager |
| `cameraTypeAtom` | `CameraType` | DOM controls | CameraRig |

**Configuration atoms** (set by DOM layer controls):

| Atom | Type | Default | Controls |
|------|------|---------|----------|
| `forceSimulationPausedAtom` | `boolean` | `false` | Pause/resume simulation |
| `showLabelsAtom` | `boolean` | `true` | Toggle node labels |
| `showEdgesAtom` | `boolean` | `true` | Toggle edge visibility |
| `bloomIntensityAtom` | `number` | `0.8` | Post-processing strength |
| `h3ResolutionAtom` | `number` | `3` | Globe hex grid resolution |
| `lodThresholdAtom` | `number` | `500` | Distance for LOD switch |

### TSG.21.16.2 useAtomValue in useFrame

A critical performance constraint: `useAtomValue()` triggers React
re-renders when the atom changes. Inside a `useFrame` callback (which runs
every animation frame), re-renders from atom changes are acceptable because
R3F batches them efficiently. However, for high-frequency atoms (e.g.,
`nodePositionMapAtom` updating at 60Hz from the force worker), implementations
SHOULD use a ref-based pattern to avoid re-render storms:

```typescript
function InstancedSignalNodes() {
  // useAtomValue is fine for low-frequency atoms
  const signals = useAtomValue(activeSignalsAtom)

  // For high-frequency position data, use a ref updated by effect
  const positionsRef = useRef<Map<string, [number, number, number]>>(new Map())

  // Subscribe to high-frequency atom outside React render cycle
  useEffect(() => {
    const unsubscribe = nodePositionMapAtom.subscribe((positions) => {
      positionsRef.current = positions
      invalidate() // Request R3F re-render
    })
    return unsubscribe
  }, [])

  useFrame(() => {
    // Read from ref, not from atom (avoids React re-render)
    updateInstanceMatrices(positionsRef.current)
  })

  return <instancedMesh /* ... */ />
}
```

### TSG.21.16.3 selectedSignalAtom Drives Camera Focus

The `selectedSignalIdsAtom` is the primary cross-layer coordination
mechanism. When selection changes in any layer, the R3F camera
smoothly transitions to frame the selected nodes (TSG.21.4.6):

```
  User clicks signal in DOM table
          │
          ▼
  selectedSignalIdsAtom.update({ 'signal-42' })
          │
          ├──▶ R3F: CameraFocusController reads atom
          │         → computes centroid of selected nodes
          │         → triggers camera spring animation
          │
          ├──▶ R3F: InstancedNodes reads atom
          │         → sets emissiveIntensity on selected instances
          │         → triggers Outline post-processing
          │
          ├──▶ visx: TimelinePoint reads atom
          │         → highlights selected point on timeline
          │
          └──▶ DOM: DetailPanel reads atom
                    → shows signal detail card
```

---

## TSG.21.17 Cross-Layer Compositing

### TSG.21.17.1 R3F at Z-Index 0

The R3F canvas MUST render at z-index 0, forming the base of the
compositing stack. Its CSS configuration:

```css
.tsingou-layer--r3f {
  position: absolute;
  inset: 0;
  z-index: 0;
  /* R3F canvas has alpha: false — opaque dark background */
}

.tsingou-layer--r3f canvas {
  display: block;
  width: 100% !important;
  height: 100% !important;
}
```

### TSG.21.17.2 Pointer Events Pass-Through

The R3F canvas captures pointer events by default. Upper layers (visx at
z:1, p5 at z:2) have `pointer-events: none`, allowing clicks to fall
through to the R3F canvas. The DOM layer (z:3) has `pointer-events: auto`
only on its interactive children, not on the layer itself:

```css
.tsingou-layer--dom {
  position: absolute;
  inset: 0;
  z-index: 3;
  pointer-events: none; /* layer itself passes through */
}

.tsingou-layer--dom > .interactive {
  pointer-events: auto; /* interactive children capture events */
}
```

This ensures that clicking "through" the DOM controls area reaches the R3F
canvas for node selection.

### TSG.21.17.3 drei Html Overlays and Layer Z-Index

drei's `<Html>` component renders DOM elements positioned in 3D space. These
elements are injected into the DOM outside the R3F canvas, which means they
participate in the CSS z-index stacking context. Implementations MUST
ensure that `<Html>` elements have a z-index that places them above the visx
and p5 layers but below (or alongside) the DOM layer:

```typescript
<Html
  style={{
    zIndex: 5,           // above p5 (z:2) and visx (z:1)
    pointerEvents: 'none' // labels should not capture events
  }}
  prepend={false}
>
  {/* label content */}
</Html>
```

### TSG.21.17.4 Compositing Stack Diagram

```
 Browser viewport
 ┌────────────────────────────────────────────────────────────┐
 │                                                            │
 │  ┌── z:5+ ──────────────────────────────────────────────┐  │
 │  │  drei <Html> overlays (node labels, info cards)       │  │
 │  │  pointer-events: none                                 │  │
 │  └──────────────────────────────────────────────────────┘  │
 │                                                            │
 │  ┌── z:3 ───────────────────────────────────────────────┐  │
 │  │  DOM layer: controls, alerts, tables                  │  │
 │  │  pointer-events: none (layer) / auto (children)       │  │
 │  └──────────────────────────────────────────────────────┘  │
 │                                                            │
 │  ┌── z:2 ───────────────────────────────────────────────┐  │
 │  │  p5 layer: spectrum waterfall, noise fields           │  │
 │  │  pointer-events: none | background: transparent       │  │
 │  └──────────────────────────────────────────────────────┘  │
 │                                                            │
 │  ┌── z:1 ───────────────────────────────────────────────┐  │
 │  │  visx layer: timelines, heatmaps, SVG overlays        │  │
 │  │  pointer-events: none | background: transparent       │  │
 │  └──────────────────────────────────────────────────────┘  │
 │                                                            │
 │  ┌── z:0 ───────────────────────────────────────────────┐  │
 │  │  R3F layer: WebGL canvas (this section)               │  │
 │  │  pointer-events: auto | background: opaque #0a0e17    │  │
 │  │                                                       │  │
 │  │  ┌─────────────┐  ┌────────────────────┐              │  │
 │  │  │ Force Graph  │  │ Globe / Spectrum   │              │  │
 │  │  │ (active mode)│  │ (inactive, unmounted)│            │  │
 │  │  └─────────────┘  └────────────────────┘              │  │
 │  └──────────────────────────────────────────────────────┘  │
 │                                                            │
 └────────────────────────────────────────────────────────────┘
```

---

## TSG.21.18 Performance Budget and Optimization

### TSG.21.18.1 Frame Time Budget

The R3F layer MUST maintain 60 FPS (16.67ms frame time) for graphs up to
5,000 nodes, and SHOULD maintain 30 FPS (33.33ms frame time) for graphs
up to 50,000 nodes.

| Phase | Budget (ms) | Components |
|-------|------------|-----------|
| Force simulation (worker) | 0ms main thread | Web Worker, does not block |
| Instance buffer update | 3.0ms | Matrix writes for all instances |
| Scene graph traversal | 1.0ms | R3F reconciler + Three.js |
| WebGL draw calls | 4.0ms | ~12 instanced + edges + environment |
| Post-processing | 3.0ms | Bloom + SSAO + Outline |
| Animation updates | 1.7ms | Pulses, particles, camera (TSG.21.14.4) |
| React overhead | 1.0ms | Atom subscriptions, re-renders |
| **Headroom** | **3.0ms** | Buffer for GC, OS jank |
| **Total** | **16.7ms** | 60 FPS target |

### TSG.21.18.2 Level of Detail (LOD)

For large graphs, implementations MUST implement LOD to reduce geometric
complexity for distant nodes:

| Distance from Camera | LOD Level | Geometry Segments | Visual |
|---------------------|-----------|------------------|--------|
| < 50 units | High | Full (TSG.21.7.1 values) | Full detail geometry |
| 50 - 200 units | Medium | Half segments | Simplified geometry |
| 200 - 500 units | Low | Billboard sprite | 2D circle facing camera |
| > 500 units | Culled | Not rendered | Frustum culled |

```typescript
import { Detailed } from '@react-three/drei'

function LODSignalNode({ position, kind, threatLevel }: Props) {
  return (
    <Detailed distances={[0, 50, 200, 500]}>
      {/* LOD 0: Full geometry */}
      <mesh geometry={getGeometryForKind(kind)}>
        <meshStandardMaterial color={threatLevelToColor(threatLevel)} />
      </mesh>

      {/* LOD 1: Simplified geometry */}
      <mesh>
        <sphereGeometry args={[1, 8, 6]} />
        <meshStandardMaterial color={threatLevelToColor(threatLevel)} />
      </mesh>

      {/* LOD 2: Billboard sprite */}
      <Billboard>
        <mesh>
          <circleGeometry args={[1, 8]} />
          <meshBasicMaterial color={threatLevelToColor(threatLevel)} />
        </mesh>
      </Billboard>

      {/* LOD 3: null (culled) */}
      <group />
    </Detailed>
  )
}
```

Note: LOD with `InstancedMesh` requires splitting instances into LOD
groups, which increases draw calls. Implementations SHOULD use LOD only
when node count exceeds 5,000.

### TSG.21.18.3 Frustum Culling

Three.js performs automatic frustum culling for objects with computed
bounding spheres. Implementations MUST ensure that:

1. All geometries have computed bounding spheres (Three.js computes
   these automatically for standard geometries).
2. `InstancedMesh` frustum culling is handled at the instance group level,
   not per-instance (Three.js does not cull individual instances).
3. Off-screen scene groups are unmounted entirely via conditional rendering
   (TSG.21.3.2), not hidden with `visible={false}`.

### TSG.21.18.4 Adaptive Quality with PerformanceMonitor

drei's `<PerformanceMonitor>` tracks frame rate and triggers quality
adjustments:

```typescript
import { PerformanceMonitor, AdaptiveDpr } from '@react-three/drei'

function AdaptiveQuality() {
  const [degraded, setDegraded] = useState(false)

  return (
    <>
      <PerformanceMonitor
        onDecline={() => setDegraded(true)}
        onIncline={() => setDegraded(false)}
        flipflops={3}       // require 3 consecutive changes
        factor={0.5}        // DPR reduction factor
        threshold={0.75}    // 75% of target FPS (45 of 60)
      >
        <AdaptiveDpr pixelated />
      </PerformanceMonitor>

      <EffectComposer>
        <Bloom intensity={degraded ? 0.3 : 0.8} />
        {!degraded && <SSAO samples={16} radius={5} intensity={20} />}
        <Outline /* always active, low cost */ />
      </EffectComposer>
    </>
  )
}
```

### TSG.21.18.5 Memory Budget

| Resource | Budget | Monitoring |
|----------|--------|-----------|
| WebGL textures | 256 MB VRAM | `gl.getParameter(gl.TEXTURE_BINDING_2D)` |
| Geometry buffers | 128 MB | Instance count x vertex size |
| Post-processing FBOs | 64 MB | Screen resolution x effect count |
| **Total GPU memory** | **448 MB** | Below integrated GPU limit (~512 MB) |

For the globe view with 4K Earth texture:
- Earth diffuse: 4096 x 2048 x 4 bytes = 32 MB
- Earth bump: 2048 x 1024 x 1 byte = 2 MB
- Total texture: ~34 MB (within budget)

### TSG.21.18.6 Performance Optimization Checklist

| Optimization | When to Apply | Impact |
|-------------|--------------|--------|
| `InstancedMesh` for repeated geometries | Always (>100 nodes) | 100x fewer draw calls |
| `frameloop="demand"` | Always | Eliminates idle GPU work |
| `useRef` + imperative mutation in `useFrame` | Animations, high-frequency | Avoids React re-renders |
| `Float32Array` transfer from worker | Force simulation | Avoids JSON parse overhead |
| Geometry registry (shared geometries) | Always | Reduces GPU memory |
| `dpr={[1, 2]}` clamping | Always | Prevents 3x+ DPR overhead |
| SSAO conditional on node count | >100 nodes to enable | Saves ~3ms per frame |
| LOD with distance thresholds | >5,000 nodes | Reduces vertex count |
| Unmount inactive scene groups | Always | Releases GPU resources |
| `AdaptiveDpr` via PerformanceMonitor | Always | Graceful degradation |

---

## TSG.21.19 Testing Strategy

### TSG.21.19.1 @react-three/test-renderer

R3F provides a headless test renderer that creates a Three.js scene without
a browser or WebGL context:

```typescript
import ReactThreeTestRenderer from '@react-three/test-renderer'

describe('SignalNode', () => {
  it('renders correct geometry for indicator kind', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <SignalNode
        signal={{
          id: 'sig-1',
          kind: 'indicator',
          threatLevel: 3,
          weight: 0.5,
        }}
        position={[0, 0, 0]}
      />
    )

    const mesh = renderer.scene.children[0]
    expect(mesh.type).toBe('Mesh')
    // OctahedronGeometry for 'indicator' kind
    expect(mesh.instance.geometry.type).toBe('OctahedronGeometry')
  })
})
```

### TSG.21.19.2 Scene Graph Snapshot Tests

Snapshot tests capture the scene graph structure to detect unintended
changes:

```typescript
describe('ForceGraphGroup', () => {
  it('renders correct number of instances', async () => {
    const testSignals = generateTestSignals(100)
    const testPositions = generateTestPositions(testSignals)

    // Set atoms for test
    activeSignalsAtom.set(testSignals)
    nodePositionMapAtom.set(testPositions)

    const renderer = await ReactThreeTestRenderer.create(
      <ForceGraphGroup />
    )

    const instancedMeshes = renderer.scene.findAll(
      (node) => node.type === 'InstancedMesh'
    )

    // One InstancedMesh per signal kind present in test data
    const uniqueKinds = new Set(testSignals.map(s => s.kind))
    expect(instancedMeshes.length).toBe(uniqueKinds.size)
  })
})
```

### TSG.21.19.3 Interaction Tests

Interaction tests verify that raycasting and selection behave correctly:

```typescript
describe('Selection', () => {
  it('selects node on pointer down', async () => {
    const testSignals = [
      { id: 'sig-1', kind: 'indicator', threatLevel: 2, weight: 0.5 },
    ]
    activeSignalsAtom.set(testSignals)
    selectedSignalIdsAtom.set(new Set())

    const renderer = await ReactThreeTestRenderer.create(
      <Canvas>
        <ForceGraphGroup />
        <InteractionManager />
      </Canvas>
    )

    // Simulate pointer event on first instance
    const instancedMesh = renderer.scene.findByType('InstancedMesh')
    await renderer.fireEvent(instancedMesh, 'onPointerDown', {
      instanceId: 0,
      nativeEvent: { shiftKey: false },
    })

    expect(selectedSignalIdsAtom.get().has('sig-1')).toBe(true)
  })

  it('adds to selection with shift+click', async () => {
    selectedSignalIdsAtom.set(new Set(['sig-1']))

    const renderer = await ReactThreeTestRenderer.create(
      <Canvas>
        <ForceGraphGroup />
        <InteractionManager />
      </Canvas>
    )

    const instancedMesh = renderer.scene.findByType('InstancedMesh')
    await renderer.fireEvent(instancedMesh, 'onPointerDown', {
      instanceId: 1,
      nativeEvent: { shiftKey: true },
    })

    expect(selectedSignalIdsAtom.get().has('sig-1')).toBe(true)
    expect(selectedSignalIdsAtom.get().has('sig-2')).toBe(true)
  })
})
```

### TSG.21.19.4 Test Matrix

| Test Category | Tool | Assertions | Coverage Target |
|--------------|------|-----------|----------------|
| **Unit: Geometry registry** | vitest | Correct geometry type per kind | 100% of kinds |
| **Unit: Color encoding** | vitest | Correct hex per threat level | 100% of levels |
| **Unit: lat/lon conversion** | vitest | Correct XYZ for known coordinates | Poles, equator, dateline |
| **Scene: Component mounting** | @react-three/test-renderer | Correct scene graph structure | All scene groups |
| **Scene: Instance count** | @react-three/test-renderer | Instance count matches signal count | Per-kind verification |
| **Interaction: Selection** | @react-three/test-renderer | Atom update on pointer events | Click, shift+click, deselect |
| **Interaction: Hover** | @react-three/test-renderer | hoveredSignalIdAtom updated | Enter, leave |
| **Integration: Cross-layer** | @testing-library/react | Selection propagates to DOM | R3F select → DOM reflects |
| **Performance: Frame time** | performance.now() benchmark | < 16ms for N nodes | 1K, 5K, 10K node counts |

---

## TSG.21.20 Normative Requirements Summary

### MUST Requirements

| ID | Requirement | Source |
|----|------------|--------|
| TSG.21-R1 | The R3F layer MUST render at z-index 0 in the compositing stack | TSG.21.1.1 |
| TSG.21-R2 | The R3F layer MUST NOT handle 2D charts, pixel graphics, or text-heavy UI | TSG.21.1.3 |
| TSG.21-R3 | Exactly one `<Canvas>` element MUST exist per R3F layer instance | TSG.21.3.3 |
| TSG.21-R4 | Scene graph mutations MUST occur through React component mount/unmount, not imperative scene.add() | TSG.21.3.3 |
| TSG.21-R5 | WebGL context loss MUST NOT propagate errors to other rendering layers | TSG.21.2.3 |
| TSG.21-R6 | Implementations MUST handle WebGL context loss and restore events | TSG.21.2.3 |
| TSG.21-R7 | Camera transitions between presets MUST complete within 800ms | TSG.21.4.5 |
| TSG.21-R8 | Implementations MUST NOT use colored directional lights that shift perceived hue of signal nodes | TSG.21.5.2 |
| TSG.21-R9 | Geometries MUST be created once and shared via a geometry registry | TSG.21.7.2 |
| TSG.21-R10 | Threat-level color encoding MUST NOT rely on green/red only differentiation (CVD accessibility) | TSG.21.7.4 |
| TSG.21-R11 | Node labels MUST NOT render below 12px font size | TSG.21.8.6 |
| TSG.21-R12 | Force simulation MUST run in a Web Worker for graphs exceeding 500 nodes | TSG.21.8.4 |
| TSG.21-R13 | Position data from the force worker MUST be transferred as Float32Array | TSG.21.8.4 |
| TSG.21-R14 | Geographic coordinates MUST be converted using the standard spherical-to-Cartesian transform | TSG.21.10.3 |
| TSG.21-R15 | The R3F layer MUST maintain 60 FPS for graphs up to 5,000 nodes | TSG.21.18.1 |
| TSG.21-R16 | Inactive scene groups MUST be unmounted, not hidden with visible=false | TSG.21.3.2 |
| TSG.21-R17 | The R3F layer MUST subscribe to atoms for all data; it MUST NOT receive data via props from parent components | TSG.21.16.1 |
| TSG.21-R18 | drei `<Html>` overlays MUST have z-index above visx/p5 layers but compatible with DOM layer | TSG.21.17.3 |

### SHOULD Requirements

| ID | Requirement | Source |
|----|------------|--------|
| TSG.21-S1 | Implementations SHOULD provide preset camera positions for common analysis perspectives | TSG.21.4.4 |
| TSG.21-S2 | Camera SHOULD smoothly dolly to frame selected signal nodes | TSG.21.4.6 |
| TSG.21-S3 | The scene SHOULD use a procedural starfield environment | TSG.21.5.3 |
| TSG.21-S4 | Implementations SHOULD support alternative graph layout strategies beyond force-directed | TSG.21.8.7 |
| TSG.21-S5 | The R3F layer SHOULD maintain 30 FPS for graphs up to 50,000 nodes | TSG.21.18.1 |
| TSG.21-S6 | Implementations SHOULD over-allocate InstancedMesh count by 20% | TSG.21.9.4 |
| TSG.21-S7 | SSAO SHOULD be disabled when node count is below 100 | TSG.21.13.4 |
| TSG.21-S8 | Post-processing effects SHOULD be dynamically toggled based on frame performance | TSG.21.13.6 |
| TSG.21-S9 | H3 resolution 3 SHOULD be the default for globe hex grids | TSG.21.10.6 |
| TSG.21-S10 | High-frequency atom reads SHOULD use ref-based pattern to avoid re-render storms | TSG.21.16.2 |
| TSG.21-S11 | LOD SHOULD be applied when node count exceeds 5,000 | TSG.21.18.2 |
| TSG.21-S12 | Edge flow particles SHOULD use instanced rendering for >50 particles | TSG.21.14.2 |
| TSG.21-S13 | Keyboard navigation shortcuts SHOULD be supported when the R3F layer has focus | TSG.21.6.4 |

### MAY Requirements

| ID | Requirement | Source |
|----|------------|--------|
| TSG.21-M1 | Implementations MAY use drei's `<Instances>` for secondary visualizations with <1,000 nodes | TSG.21.9.5 |
| TSG.21-M2 | Edge animations MAY display particles flowing along edges to indicate data direction | TSG.21.14.2 |
| TSG.21-M3 | The globe view MAY support terrain mesh overlays using heightmap-displaced planes | TSG.21.10.7 |
| TSG.21-M4 | Implementations MAY use a procedural globe with GeoJSON outlines instead of textured sphere | TSG.21.10.2 |
| TSG.21-M5 | ChromaticAberration MAY be applied during critical threat state as a visual warning | TSG.21.13.2 |
| TSG.21-M6 | Vignette MAY be applied for subtle edge darkening to focus attention | TSG.21.13.2 |

---

## TSG.21.21 References and Cross-References

### Internal Cross-References

| Key | Reference | Relationship |
|-----|-----------|-------------|
| [TSG.3] | Rendering Surface | Parent architecture — 4-layer compositing model |
| [TSG.3.1] | 4-Layer Composited Architecture | R3F position at z:0, compositing rules |
| [TSG.3.2] | R3F Layer (z:0, WebGL 3D) | Overview of R3F role (this section expands) |
| [TSG.3.6] | OutputBridge Routing | Atom-mediated data flow to rendering layers |
| [TSG.3.7] | Analysis Technique Mapping | R3F serves: Link Analysis, Geospatial, Signal Flow |
| [TSG.3-R3] | Crash isolation requirement | Context loss must not propagate |
| [TSG.3-R7] | 12px text floor | Node labels must comply |
| [TSG.20] | Atom-as-State | Reactive state management for scene data |
| [TSG.28] | d2ts Dataflow | STIX signal types, correlation outputs |
| [TSG.30] | Performance Budget | Frame time allocation, GPU memory limits |

### External References

| Key | Reference |
|-----|-----------|
| [RFC2119] | Bradner, S., "Key words for use in RFCs to Indicate Requirement Levels", BCP 14, RFC 2119, March 1997 |
| [RFC8174] | Leiba, B., "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words", BCP 14, RFC 8174, May 2017 |
| [R3F] | Poimandres. "React Three Fiber — React renderer for Three.js." https://docs.pmnd.rs/react-three-fiber |
| [DREI] | Poimandres. "@react-three/drei — Useful helpers for React Three Fiber." https://github.com/pmndrs/drei |
| [R3F-PP] | Poimandres. "@react-three/postprocessing — Post-processing for R3F." https://github.com/pmndrs/react-postprocessing |
| [R3F-TEST] | Poimandres. "@react-three/test-renderer — Headless test renderer for R3F." https://docs.pmnd.rs/react-three-fiber/api/hooks#testing |
| [THREE] | Three.js. "Three.js — JavaScript 3D Library." https://threejs.org/ |
| [D3-FORCE-3D] | Vasco Asturiano. "d3-force-3d — Force-directed graph layout in 3D." https://github.com/vasturiano/d3-force-3d |
| [REACT-SPRING-THREE] | Poimandres. "@react-spring/three — Spring animations for R3F." https://www.react-spring.dev/ |
| [H3] | Uber Technologies. "H3 — Hexagonal hierarchical geospatial indexing system." https://h3geo.org/ |
| [STIX-2.1] | OASIS. "STIX Version 2.1." https://oasis-open.github.io/cti-documentation/stix/intro.html |
| [POSTPROCESSING] | vanruesc. "postprocessing — Post-processing library for Three.js." https://github.com/pmndrs/postprocessing |

### ADR References

| Key | Reference |
|-----|-----------|
| [ADR-007] | ADR-007: Framer Motion for Animation. `docs/tsingou/adr/ADR-007-framer-motion-for-animation.md` |
| [ADR-012] | ADR-012: Visualization-Focused Platform. `docs/tsingou/adr/ADR-012-visualization-focused-platform.md` |
| [ADR-013] | ADR-013: Eight Analysis Techniques. `docs/tsingou/adr/ADR-013-analysis-techniques.md` |

### R3F Migration Reference

| Key | Reference |
|-----|-----------|
| [R3F_MIGRATION] | R3F Migration Document. `docs/tsingou/R3F_MIGRATION.md` |

---

*End of TSG.21: R3F 3D Scene Layer*
