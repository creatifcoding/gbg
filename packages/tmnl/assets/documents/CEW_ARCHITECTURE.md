# CEW Domain Architecture

## Spectral Battlespace — Proposed Architecture

TMNL's canvas represents a **Spectral Battlespace** — a tactical EM environment where Emitters, Effects, and Actors interact through observable, transformable, and intentional structures.

---

## Core Ontology

Three orthogonal categories form the minimal partition:

```
CEW := {
  Emitters  : raw EM sources           (object space)
  Effects   : transforms on EM signals (morphism space)
  Actors    : agents applying/receiving (agent space)
}
```

### Categorical Triple

```
Emitters →[Effects]→ Actors
```

Closed under observation, transformation, and action.

---

## 1. Emitters

All sources of electromagnetic energy — cooperative, hostile, or environmental.

**Ontologically:** `Emitter := (Signature, Behavior, Platform, Intent)`
**Signal Model:** The *raw signal space* — observable manifold.

### Schema

```typescript
interface Emitter {
  id: string
  signature: {
    frequency: FrequencyBand
    modulation: ModulationType
    polarization: Polarization
    power: number // dBm
  }
  behavior: {
    pri: number | 'stagger' | 'jitter'  // Pulse Repetition Interval
    pw: number                           // Pulse Width (μs)
    scanPattern: ScanPattern
    waveform: WaveformType
  }
  platform: string      // Parent Actor ID
  intent: 'cooperative' | 'hostile' | 'ambient' | 'unknown'
}

type FrequencyBand =
  | 'HF' | 'VHF' | 'UHF'
  | 'L' | 'S' | 'C' | 'X' | 'Ku' | 'K' | 'Ka'
  | 'V' | 'W' | 'mm'

type ModulationType =
  | 'CW' | 'FMCW' | 'pulse' | 'LPI'
  | 'chirp' | 'barker' | 'polyphase'
  | 'AM' | 'FM' | 'PM' | 'QAM' | 'OFDM'

type ScanPattern =
  | 'circular' | 'sector' | 'raster'
  | 'conical' | 'track-while-scan' | 'electronically-steered'

type WaveformType =
  | 'unmodulated' | 'linear-chirp' | 'nonlinear-chirp'
  | 'phase-coded' | 'frequency-hopped' | 'noise-like'
```

### Subtypes

| Type | Examples |
|------|----------|
| **Radar** | CW, FMCW, pulse, LPI, SAR, MTI |
| **Comms** | VHF/UHF tac, SATCOM, datalinks |
| **Navigation** | GNSS, TACAN, ILS, beacons |
| **Incidental** | Power systems, reflections, leakage |

---

## 2. Effects

All transformations applied to electromagnetic signals — intentional or environmental.

**Ontologically:** `Effect := (Transform, Context, Objective)`
**Signal Model:** The *operator space* — morphisms of the EM category.

### Schema

```typescript
interface Effect {
  id: string
  category: EffectCategory
  transform: {
    operator: OperatorType
    parameters: Record<string, number | string>
  }
  context: {
    source: string      // Actor ID applying effect
    target: string      // Emitter or Actor ID receiving
    medium: PropagationContext
  }
  objective: EffectObjective
}

type EffectCategory =
  | 'EA'          // Electronic Attack
  | 'EP'          // Electronic Protection
  | 'ES'          // Electronic Support
  | 'propagation' // Environmental
  | 'processing'  // Signal processing

type EffectObjective =
  | 'deny'        // Prevent target from operating
  | 'degrade'     // Reduce target effectiveness
  | 'deceive'     // Cause target to act on false info
  | 'detect'      // Identify target presence/parameters
  | 'protect'     // Shield friendly from effects
  | 'extract'     // Derive information from signal
```

### Subtypes

| Category | Techniques |
|----------|------------|
| **EA (Attack)** | Jamming, spoofing, seduction, masking, barrage, deceptive R/V |
| **EP (Protection)** | Filtering, nulling, beamforming, ECCM, frequency hopping |
| **ES (Support)** | Demod, dechirp, pulse compression, threat extraction, DF |
| **Propagation** | Atmospheric, multipath, occlusion, ducting, diffraction |
| **Processing** | STFT, wavelet, microlocal, HOTT-HAL transforms |

### EA Techniques Detail

```typescript
interface JammingEffect extends Effect {
  category: 'EA'
  transform: {
    operator: 'jam'
    parameters: {
      technique: 'noise' | 'spot' | 'barrage' | 'sweep' | 'responsive'
      j_s_ratio: number   // Jammer-to-signal (dB)
      bandwidth: number   // MHz
      duty_cycle: number  // 0-1
    }
  }
}

interface SpoofingEffect extends Effect {
  category: 'EA'
  transform: {
    operator: 'spoof'
    parameters: {
      technique: 'range-gate-pull-off' | 'velocity-gate-pull-off' | 'angle-deception'
      false_target: {
        range_offset: number   // meters
        velocity_offset: number // m/s
        angle_offset: number   // degrees
      }
    }
  }
}
```

---

## 3. Actors

Agents that create, manipulate, or respond to the EM environment.

**Ontologically:** `Actor := (Capabilities, Behaviors, EW-State, Mission-Role)`
**Signal Model:** The *actor graph* — intentional top-level agents.

### Schema

```typescript
interface Actor {
  id: string
  type: ActorType
  affiliation: 'blue' | 'red' | 'neutral' | 'unknown'
  capabilities: {
    emitters: string[]        // Emitter IDs this actor controls
    effects: EffectCategory[] // Effect types this actor can apply
    sensors: SensorConfig[]
  }
  behaviors: {
    doctrine: string
    reactions: ReactionRule[]
    autonomy: AutonomyLevel
  }
  ewState: {
    mode: 'passive' | 'active' | 'reactive'
    threats: ThreatAssessment[]
    resources: ResourceState
  }
  missionRole: MissionRole
}

type ActorType =
  | 'platform'      // Aircraft, ship, vehicle
  | 'system'        // EW suite, radar system
  | 'subsystem'     // Individual jammer, receiver
  | 'formation'     // Wolf-pack, swarm
  | 'c2-node'       // Command & control
  | 'autonomous'    // AI agent, micro-agent
  | 'human'         // Operator, crew

type AutonomyLevel =
  | 'manual'        // Human-in-the-loop for all decisions
  | 'assisted'      // AI recommends, human approves
  | 'supervised'    // AI acts, human can override
  | 'autonomous'    // AI acts independently within rules
  | 'adaptive'      // AI modifies own rules based on outcomes
```

### Examples

| Type | Blue Force | Red Force |
|------|------------|-----------|
| **Platform** | F-35, EA-18G, DDG-51 | Su-57, S-400, Corvette |
| **System** | AN/ALQ-239, AN/SLQ-32 | Krasukha-4, Zhitel |
| **Subsystem** | Towed decoy, MALD-J | SAM illuminator, ARM seeker |
| **Formation** | Distributed aperture, CEC | Drone swarm, layered IADS |
| **Autonomous** | Micro-agents, reductors | AI-guided decoys |

---

## Typed Relations

### Emitter ↔ Actor

```typescript
// An Actor OWNS Emitters
interface OwnershipRelation {
  actor: string    // Actor ID
  emitter: string  // Emitter ID
  control: 'organic' | 'attached' | 'networked'
}

// An Emitter is MOUNTED ON an Actor
interface MountingRelation {
  emitter: string
  actor: string
  position: {
    location: 'nose' | 'tail' | 'wing' | 'fuselage' | 'mast' | 'turret'
    azimuth_coverage: [number, number]  // degrees
    elevation_coverage: [number, number]
  }
}
```

### Actor →[Effect]→ Target

```typescript
// An Actor APPLIES an Effect TO a Target
interface EffectApplication {
  source: string      // Actor ID
  effect: string      // Effect ID
  target: string      // Emitter or Actor ID

  // Geometry
  geometry: {
    range: number         // meters
    bearing: number       // degrees from source
    aspect: number        // degrees (target heading relative)
    altitude_delta: number // meters
  }

  // Effectiveness
  assessment: {
    predicted_effect: number  // 0-1 effectiveness
    confidence: number        // 0-1
    time_to_effect: number    // seconds
  }
}
```

### Emitter ↔ Emitter (Interference)

```typescript
// Two Emitters INTERFERE
interface InterferenceRelation {
  emitter_a: string
  emitter_b: string
  type: 'co-channel' | 'adjacent-channel' | 'harmonic' | 'intermod'
  severity: number  // dB degradation
}
```

---

## Deployed State Model

When an entity is dragged from the grid to the canvas, it becomes "deployed" with runtime state.

### Deployed Emitter

```typescript
interface DeployedEmitter {
  // Identity
  emitter: Emitter
  cardId: string     // tldraw shape ID

  // Spatial
  position: { x: number; y: number }
  orientation: number  // degrees, antenna boresight

  // Runtime state
  state: EmitterState
  detections: Detection[]
  effects_received: EffectApplication[]
}

type EmitterState =
  | 'off'
  | 'standby'
  | 'transmitting'
  | 'tracking'
  | 'jammed'
  | 'degraded'
  | 'destroyed'
```

### Deployed Actor

```typescript
interface DeployedActor {
  // Identity
  actor: Actor
  cardId: string     // tldraw shape ID

  // Spatial
  position: { x: number; y: number }
  heading: number    // degrees
  velocity: { x: number; y: number }

  // Runtime state
  state: ActorState
  emitters: DeployedEmitter[]
  effects_applying: EffectApplication[]
  threats: ThreatAssessment[]
}

type ActorState =
  | 'inactive'
  | 'passive'        // Sensors on, emitters off
  | 'active'         // Transmitting
  | 'engaged'        // In EW combat
  | 'evading'
  | 'mission-killed'
  | 'destroyed'
```

---

## UI Mapping

How the ontology maps to TMNL components:

| Domain Concept | UI Component | Interaction |
|----------------|--------------|-------------|
| **Emitter** | EmitterCard (DataCard variant) | Drag from grid, configure signature |
| **Actor** | ActorCard (DataCard variant) | Drag from grid, assign capabilities |
| **Effect** | EffectArrow (tldraw binding) | Draw connection, select effect type |
| **Battlespace** | tldraw Canvas | Spatial arrangement, zoom, pan |
| **Inventory** | AG-Grid | Browse, filter, drag-out |

---

## Data Flow

```
┌─────────────────┐     drag-out     ┌─────────────────┐
│    AG-Grid      │ ───────────────► │   DataCard      │
│   (Palette)     │                  │   (Deployed)    │
│                 │                  │                 │
│ ┌─────────────┐ │                  │ EmitterCard or  │
│ │ Emitters    │ │                  │ ActorCard       │
│ ├─────────────┤ │                  └────────┬────────┘
│ │ Actors      │ │                           │
│ └─────────────┘ │                           │ connect
└─────────────────┘                           ▼
                                    ┌─────────────────┐
                                    │  Effect Arrow   │
                                    │  (Morphism)     │
                                    │                 │
                                    │ EA: red pulse   │
                                    │ EP: blue solid  │
                                    │ ES: yellow dash │
                                    └────────┬────────┘
                                             │
                                             │ applies to
                                             ▼
                                    ┌─────────────────┐
                                    │  Target Card    │
                                    │ (state changes) │
                                    └─────────────────┘
```

---

## Typed DataCard Variants

### EmitterCard

```typescript
interface EmitterCardProps {
  type: 'emitter'
  data: Emitter
  displayMode: 'compact' | 'detailed' | 'signature'
  state: EmitterState
}
```

**Visual Elements:**
- Frequency band indicator (colored bar)
- Waveform glyph (pulse shape icon)
- Power meter (dBm gauge)
- Intent badge (cooperative/hostile/unknown)
- State indicator (transmitting pulse animation when active)

### ActorCard

```typescript
interface ActorCardProps {
  type: 'actor'
  data: Actor
  displayMode: 'compact' | 'detailed' | 'tactical'
  state: ActorState
}
```

**Visual Elements:**
- Affiliation color (blue/red/neutral border)
- Type icon (aircraft/ship/vehicle silhouette)
- Capability badges (EA/EP/ES icons)
- Threat status (warning indicators)
- Emitter attachment points (connection anchors)

---

## Effect Arrows

Connections between cards representing EM interactions:

```typescript
interface EffectArrow {
  id: string
  source: string      // Card ID
  target: string      // Card ID
  effect: Effect
  visual: {
    style: ArrowStyle
    color: string
    label: string
    animation: AnimationType
  }
}

type ArrowStyle = 'solid' | 'dashed' | 'dotted'
type AnimationType = 'none' | 'pulse' | 'flow' | 'strobe'
```

| Effect Category | Color | Style | Animation |
|-----------------|-------|-------|-----------|
| **EA (Attack)** | `#ff4444` | solid | pulse toward target |
| **EP (Protection)** | `#4488ff` | solid | static glow |
| **ES (Support)** | `#ffcc00` | dashed | flow toward source |
| **Propagation** | `#888888` | dotted | none |

---

## Integration with Animation Library

Effects should use the TMNL Animation Library for visual feedback:

```typescript
import { createAnimation, gsapDriver } from '@/lib/animation/v2'

// Jamming effect animation
const jamAnimation = createAnimation(0, {
  duration: 200,
  ease: 'power2.out'
})

// When jamming starts
jamAnimation.to(1)  // Fade in red overlay on target

// Effect pulse along arrow
const pulseAnimation = createAnimation(0, {
  duration: 500,
  ease: 'none'
})
// Animate gradient position along arrow path
```

---

## Implementation Phases

### Phase 1: Typed DataCards
- [ ] Split DataCardShape into EmitterCardShape / ActorCardShape
- [ ] Define visual language for each card type
- [ ] Implement state-driven styling

### Phase 2: Effect Bindings
- [ ] Create EffectArrow as tldraw binding type
- [ ] Arrow drawing tool with effect type selector
- [ ] Visual styling per effect category

### Phase 3: Grid Palette
- [ ] Separate AG-Grid instances for Emitters vs Actors
- [ ] Filtering by type, affiliation, frequency band
- [ ] Drag-out creates appropriate card type

### Phase 4: Signature Visualization
- [ ] Waveform glyph rendering
- [ ] Spectrum display component
- [ ] Real-time state animations

### Phase 5: Simulation Layer
- [ ] Effects modify target states
- [ ] Propagation calculations
- [ ] Threat assessment updates

---

## References

- ORION Ontology Framework
- Typed Heterogeneous Signal Modeling (THSM)
- EW Doctrine (EA/EP/ES taxonomy)
- Joint Publication 3-13.1 (Electronic Warfare)

---

*Document generated during TMNL CEW integration architecture (EDIN Design phase)*
