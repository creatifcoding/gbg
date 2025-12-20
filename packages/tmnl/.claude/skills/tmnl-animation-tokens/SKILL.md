---
name: tmnl-animation-tokens
description: Animation token system for timing, easing, and geometry. Invoke when implementing animations, transitions, or motion design. Defines duration scales, easing curves, driver architecture, and integration with GSAP/anime.js drivers.
model_invoked: true
triggers:
  - "animation tokens"
  - "timing tokens"
  - "easing"
  - "duration"
  - "GSAP"
  - "anime.js"
  - "transition"
  - "motion design"
  - "AnimationDriver"
  - "interpolator"
  - "motion blur"
---

# TMNL Animation Tokens

## Overview

TMNL animation tokens provide **standardized timing, easing, and geometry** for motion design. The system has three layers:

1. **Tokens** — Duration, easing, and spring constants
2. **Drivers** — GSAP, anime.js, and RAF implementations
3. **Primitives** — `animatable()` + `useAnimatable()` for reactive values

**Key Principle**: Never hardcode animation values. Use tokens for consistency and maintainability.

---

## Canonical Sources

### Token Definitions
- **Animation Library**: `src/lib/animation/tokens.ts` - Core TIMING, EASING, COLORS, GEOMETRY
- **VANTA Animation**: `src/components/portal/tokens.ts` - UI transition durations and easings
- **Splash Tokens**: `src/components/splash/tokens.ts` - Splash-specific timing

### Driver Implementations
- **GSAP Driver**: `src/lib/animation/drivers/gsap.ts` - GSAP timeline and tween wrappers
- **anime.js Driver**: `src/lib/animation/drivers/animejs.ts` - SVG and attribute animation
- **RAF Driver**: `src/lib/animation/Animatable.ts:187-300` - Fallback driver

### Usage Examples
- **Animatable Primitive**: `src/lib/animation/Animatable.ts` - Core reactive animation
- **Motion Blur Hook**: `src/lib/motion/useMotionBlur.ts` - Velocity-based effects
- **Parallax Lift**: `src/lib/drawer/animations/parallax-lift.ts` - 3D stack animation

---

## Part 1: Animation Driver Architecture

### AnimationDriver Interface

All animation drivers implement this interface.

```typescript
export interface AnimationDriver {
  animate<T>(
    from: T,
    to: T,
    config: {
      duration: number
      ease?: string | ((t: number) => number)
      onUpdate: (value: T) => void
      onComplete?: () => void
    },
    interpolate: Interpolator<T>
  ): () => void  // Returns cancel function

  timeline<T>(
    phases: TimelinePhase<T>[],
    config: { loop?: boolean; onComplete?: () => void }
  ): {
    play: () => void
    pause: () => void
    reverse: () => void
    seek: (time: number) => void
    kill: () => void
  }
}
```

**Canonical source**: `src/lib/animation/Animatable.ts:44-77`

### Driver Selection Decision Tree

```
Which driver should I use?
│
├─ Simple value animation (opacity, scale, position)?
│  └─ Use: gsapDriver (best timeline support)
│
├─ SVG attribute animation (x2, stroke, path d)?
│  └─ Use: animeDriver (native attr key)
│
├─ Minimal bundle size requirement?
│  └─ Use: rafDriver (zero dependencies)
│
├─ Complex multi-phase timeline?
│  └─ Use: gsapDriver (position syntax: "+=0.1")
│
├─ Spring/physics-based animation?
│  └─ Use: animeDriver or custom spring integration
│
└─ Infinite loop with yoyo?
   └─ Use: gsapDriver (repeat: -1, yoyo: true)
```

### Setting a Driver

```typescript
import { Animatable, gsapDriver, animeDriver, rafDriver } from '@/lib/animation'

// Set global driver (once at app init)
Animatable.setDriver(gsapDriver)

// Use with animatable()
const opacityAtoms = animatable(1, { duration: 200, ease: 'power2.out' })
```

---

## Part 2: Token Categories

### 1. TIMING (Duration Scales)

Animation durations in milliseconds, organized by use case.

```typescript
export const TIMING = {
  /** Sub-frame precision phases for corner emanation */
  emanation: {
    primary: { start: 0, duration: 15 },    // 0-15ms: Initial ring burst
    secondary: { start: 15, duration: 20 }, // 15-35ms: Follow-through ring
    tertiary: { start: 35, duration: 15 },  // 35-50ms: Decay ring
    total: 50,                              // Total emanation sequence
  },

  /** Reticle handle animations */
  reticle: {
    expandDuration: 80,   // Crosshair expansion on grab
    pulsePeriod: 800,     // Ring pulse cycle
    collapseDuration: 120, // Collapse on release
  },

  /** Momentum trail animations */
  trail: {
    spawnInterval: 16,    // ~60fps ghost spawning
    fadeOutDuration: 200, // Ghost fade decay
    maxTrailLength: 8,    // Max ghost shapes in trail
  },

  /** Snap feedback animations */
  snap: {
    overshoot: 50,        // Elastic overshoot duration
    settle: 150,          // Settle to final position
    rippleDuration: 300,  // Snap ripple effect
  },
} as const
```

**Canonical source**: `src/lib/animation/tokens.ts`

### 2. EASING (Timing Functions)

#### GSAP Easings

```typescript
export const EASING = {
  gsap: {
    emanationOut: 'power2.out',          // Smooth deceleration
    emanationIn: 'power1.in',            // Gentle acceleration
    reticleExpand: 'back.out(1.7)',      // Overshoot expansion
    reticleCollapse: 'power3.in',        // Sharp collapse
    snapBounce: 'elastic.out(1, 0.3)',   // Elastic bounce
    snapSettle: 'power2.out',            // Smooth settle
    trailFade: 'power1.out',             // Linear-ish fade
  },
}
```

#### CSS Easings (Keyframe Animations)

```typescript
export const EASING = {
  css: {
    emanationOut: 'cubic-bezier(0.22, 1, 0.36, 1)',        // Custom decel
    snapBounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',  // Overshoot
  },
}
```

#### Spring Configurations

```typescript
export const EASING = {
  spring: {
    snappy: { stiffness: 500, damping: 30 },  // Fast, tight response
    bouncy: { stiffness: 300, damping: 15 },  // Playful overshoot
    smooth: { stiffness: 150, damping: 25 },  // Gentle, fluid
  },
}
```

---

## Part 3: Interpolator System

### autoInterpolator — Type Detection

The system automatically selects interpolators based on value type.

```typescript
export function autoInterpolator<T>(sample: T): Interpolator<T> {
  if (typeof sample === 'number') return lerpNumber
  if (Array.isArray(sample)) return lerpArray
  if (typeof sample === 'string' && sample.startsWith('#')) return lerpColor
  if (typeof sample === 'object') return lerpObject
  // Default: discrete (snap at end)
  return ((from, to, t) => t < 1 ? from : to) as Interpolator<T>
}
```

**Canonical source**: `src/lib/animation/Animatable.ts:163-178`

### Built-in Interpolators

| Type | Interpolator | Behavior |
|------|--------------|----------|
| `number` | `lerpNumber` | Linear numeric interpolation |
| `object` | `lerpObject` | Recursively interpolate properties |
| `#hex` | `lerpColor` | Hex color channel interpolation |
| `array` | `lerpArray` | Element-wise interpolation |

### Custom Interpolator Pattern

```typescript
// Custom interpolator for { x, y, rotation }
const lerpTransform: Interpolator<Transform> = (from, to, t) => ({
  x: lerpNumber(from.x, to.x, t),
  y: lerpNumber(from.y, to.y, t),
  // Use eased t for rotation
  rotation: lerpNumber(from.rotation, to.rotation, easeOut(t)),
})

const transformAtoms = animatable(
  { x: 0, y: 0, rotation: 0 },
  { duration: 300, interpolate: lerpTransform }
)
```

---

## Part 4: Advanced Driver Patterns

### GSAP Position Syntax

GSAP timeline positions enable sub-frame precision.

```typescript
import { gsap } from 'gsap'
import { TIMING } from '@/lib/animation/tokens'

function createEmanationTimeline(targets: { primary, secondary, tertiary }) {
  const tl = gsap.timeline()

  // Primary: starts at 0
  tl.fromTo(targets.primary,
    { scale: 0, opacity: 0.8 },
    { scale: 1, opacity: 0.8, duration: TIMING.emanation.primary.duration / 1000 },
    0  // Absolute position: 0s
  )

  // Secondary: starts at 15ms
  tl.fromTo(targets.secondary,
    { scale: 0, opacity: 0.6 },
    { scale: 1.2, opacity: 0.4, duration: TIMING.emanation.secondary.duration / 1000 },
    0.015  // Absolute position: 15ms
  )

  // Tertiary: starts at 35ms
  tl.fromTo(targets.tertiary,
    { scale: 0, opacity: 0.4 },
    { scale: 1.4, opacity: 0, duration: TIMING.emanation.tertiary.duration / 1000 },
    0.035  // Absolute position: 35ms
  )

  return tl
}
```

**Position syntax reference:**
- `0` — Absolute time (seconds)
- `"+=0.1"` — Relative: 100ms after previous
- `"-=0.05"` — Relative: 50ms before previous ends
- `"labelName"` — At label position
- `"labelName+=0.2"` — 200ms after label

**Canonical source**: `src/lib/animation/drivers/gsap.ts:132-224`

### anime.js SVG Attribute Animation

anime.js excels at SVG attribute animation with the `attr` key.

```typescript
import { createTimeline } from 'animejs'

function animateCrosshair(arms: SVGLineElement[]) {
  const tl = createTimeline({
    defaults: { ease: 'outBack' }
  })

  arms.forEach((arm, i) => {
    // Animate SVG line attributes directly
    tl.add(arm, {
      attr: {
        x2: arm.dataset.targetX2,  // SVG attribute
        y2: arm.dataset.targetY2,
      },
      duration: TIMING.reticle.expandDuration,
    }, i * 20)  // 20ms stagger
  })

  return tl
}
```

**Canonical source**: `src/lib/animation/drivers/animejs.ts:258-266`

### RAF Driver (Fallback)

Zero-dependency driver for simple animations.

```typescript
export const rafDriver: AnimationDriver = {
  animate<T>(from, to, config, interpolate) {
    const startTime = performance.now()
    let rafId: number

    const tick = (currentTime: number) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / config.duration, 1)
      const easedProgress = applyEasing(progress, config.ease)

      const value = interpolate(from, to, easedProgress)
      config.onUpdate(value)

      if (progress < 1) {
        rafId = requestAnimationFrame(tick)
      } else {
        config.onComplete?.()
      }
    }

    rafId = requestAnimationFrame(tick)

    return () => cancelAnimationFrame(rafId)  // Cancel function
  },
  // ... timeline implementation
}
```

---

## Part 5: Motion Blur & Velocity Effects

### useMotionBlur Hook

Direction-aware motion blur based on velocity tracking.

```typescript
import { useMotionBlur } from '@/lib/motion'

function DraggableElement() {
  const { blurStyle, handlers, velocity } = useMotionBlur({
    maxBlur: 12,          // Maximum blur in pixels
    velocityScale: 0.3,   // Velocity to blur scaling
    decayRate: 0.95,      // Blur decay per frame
  })

  return (
    <div
      style={{
        filter: blurStyle,  // e.g., "blur(4px)"
        ...handlers.style,  // Transform for skew based on direction
      }}
      onPointerMove={handlers.onPointerMove}
    >
      Velocity: {velocity.x.toFixed(1)}, {velocity.y.toFixed(1)}
    </div>
  )
}
```

**Canonical source**: `src/lib/motion/useMotionBlur.ts`

### Velocity Tracking Pattern

```typescript
interface VelocityState {
  x: number
  y: number
  magnitude: number
  direction: number  // Radians
}

function calculateVelocity(
  current: Point,
  previous: Point,
  deltaTime: number
): VelocityState {
  const dx = current.x - previous.x
  const dy = current.y - previous.y
  const magnitude = Math.sqrt(dx * dx + dy * dy) / deltaTime

  return {
    x: dx / deltaTime,
    y: dy / deltaTime,
    magnitude,
    direction: Math.atan2(dy, dx),
  }
}
```

---

## Part 6: Multi-Element Synchronization

### Corner Emanation Pattern

Synchronized animations at four corners.

```typescript
import { TIMING } from '@/lib/animation/tokens'

function createBoundsEmanation(bounds: Bounds, onComplete: () => void) {
  const corners = [
    { x: bounds.x, y: bounds.y },                        // TL
    { x: bounds.x + bounds.width, y: bounds.y },         // TR
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height }, // BR
    { x: bounds.x, y: bounds.y + bounds.height },        // BL
  ]

  const staggerDelay = 30  // 30ms between corners
  let completedCount = 0

  corners.forEach((corner, i) => {
    setTimeout(() => {
      createEmanation(corner)
      completedCount++
      if (completedCount === corners.length) {
        setTimeout(onComplete, TIMING.emanation.total + 150)
      }
    }, i * staggerDelay)
  })
}
```

**Canonical source**: `src/lib/animation/drivers/animejs.ts:410-451`

### Parallax Stack Animation

3D depth effect for layered elements.

```typescript
interface ParallaxConfig {
  liftPerLayer: number    // Vertical offset per layer
  rotatePerLayer: number  // X rotation per layer
  blurPerLayer: number    // Blur per layer
  opacityDecay: number    // Opacity reduction per layer
  duration: number
}

export function parallaxLiftStack(
  layers: HTMLElement[],
  config: ParallaxConfig
): Promise<void> {
  return Promise.all(
    layers.map((el, i) => {
      const depth = layers.length - i - 1

      return animate(el, {
        translateY: -depth * config.liftPerLayer,
        rotateX: -depth * config.rotatePerLayer,
        filter: `blur(${depth * config.blurPerLayer}px)`,
        opacity: 1 - depth * config.opacityDecay,
        duration: config.duration,
        ease: 'outQuart',
      })
    })
  ).then(() => void 0)
}
```

**Canonical source**: `src/lib/drawer/animations/parallax-lift.ts:26-50`

---

## Part 7: Promise-Based Orchestration

### Async Animation Chaining

```typescript
async function bootSequence() {
  // Phase 1: Static noise
  await playStatic({ duration: SPLASH_TIMING.boot.staticBurst })

  // Phase 2: Terminal lines (parallel)
  await Promise.all([
    typeLines(lines),
    flashCRT(),
  ])

  // Phase 3: Logo reveal
  await revealLogo()

  // Phase 4: Transition out
  await fadeOut()
}
```

### Creating Awaitable Animations

```typescript
function createCrosshair(): CrosshairController {
  const tl = createTimeline()

  return {
    async expand() {
      return new Promise((resolve) => {
        tl.add(/* ... */)
        tl.onComplete = () => resolve()
        tl.play()
      })
    },

    async collapse() {
      return new Promise((resolve) => {
        tl.add(/* ... */)
        tl.onComplete = () => resolve()
        tl.play()
      })
    },
  }
}

// Usage
const crosshair = createCrosshair()
await crosshair.expand()
// ... do something
await crosshair.collapse()
```

**Canonical source**: `src/lib/animation/drivers/animejs.ts:252-295`

---

## Part 8: Core Animation Patterns

### Pattern 1: Animatable with Duration Token

```typescript
import { animatable, useAnimatable, TIMING } from '@/lib/animation'

const opacityAtoms = animatable(1, {
  duration: TIMING.reticle.expandDuration,
  ease: 'power2.out',
})

function FadingElement() {
  const { value, to, snap } = useAnimatable(opacityAtoms)

  return (
    <div
      style={{ opacity: value }}
      onClick={() => to(0)}
      onDoubleClick={() => snap(1)}  // Instant reset
    />
  )
}
```

### Pattern 2: GSAP Timeline with Easing Tokens

```typescript
import { gsap } from 'gsap'
import { TIMING, EASING } from '@/lib/animation/tokens'

function animateReticle(element: HTMLElement) {
  const tl = gsap.timeline()

  tl.to(element, {
    scale: 1.5,
    duration: TIMING.reticle.expandDuration / 1000,
    ease: EASING.gsap.reticleExpand,
  })

  tl.to(element, {
    opacity: 0.5,
    duration: TIMING.reticle.pulsePeriod / 1000,
    ease: EASING.gsap.snapSettle,
    yoyo: true,
    repeat: -1,
  })

  return tl
}
```

### Pattern 3: Infinite Loop with Yoyo

```typescript
const tl = gsap.timeline({
  repeat: -1,  // Infinite
  yoyo: true,  // Reverse on each repeat
  paused: true,
})

rings.forEach((ring, index) => {
  const delay = (index * TIMING.reticle.pulsePeriod) / rings.length / 1000
  tl.fromTo(
    ring,
    { scale: 1, opacity: 0.8 },
    { scale: 1.5, opacity: 0, duration: TIMING.reticle.pulsePeriod / 1000 },
    delay
  )
})

// Control
tl.play()
tl.pause()
tl.kill()
```

---

## Selection Guidelines

### Duration Selection

| Context | Duration | Token | Use Case |
|---------|----------|-------|----------|
| Micro-interaction | 80-100ms | `VANTA_ANIMATION.duration.fast` | Button hover |
| Standard transition | 200ms | `VANTA_ANIMATION.duration.normal` | Card hover |
| Deliberate motion | 300ms | `VANTA_ANIMATION.duration.slow` | Modal reveal |
| Emphasis | 500-800ms | `VANTA_ANIMATION.duration.slower` | Splash logo |

### Easing Selection

| Motion Type | Easing | Token | Use Case |
|-------------|--------|-------|----------|
| Smooth exit | Power2 Out | `EASING.gsap.snapSettle` | Fade out |
| Sharp entry | Power3 In | `EASING.gsap.reticleCollapse` | Snap in |
| Bouncy | Elastic Out | `EASING.gsap.snapBounce` | Button press |
| Overshoot | Back Out | `EASING.gsap.reticleExpand` | Reticle expand |

### Driver Selection

| Scenario | Driver | Reason |
|----------|--------|--------|
| DOM element animation | gsapDriver | Best timeline support |
| SVG attribute animation | animeDriver | Native attr key |
| Minimal bundle | rafDriver | Zero dependencies |
| Spring physics | animeDriver | Cleaner spring syntax |
| Complex timeline | gsapDriver | Position syntax |

---

## Anti-Patterns (BANNED)

### 1. Hardcoded Duration Values

```typescript
// BANNED
gsap.to(element, { opacity: 0, duration: 0.2 })

// CORRECT
gsap.to(element, {
  opacity: 0,
  duration: VANTA_ANIMATION.duration.normal / 1000,
})
```

### 2. Multiple Drivers on Same Atom

```typescript
// BANNED - Causes conflicts
Animatable.setDriver(gsapDriver)
const atoms = animatable(0)
// Later...
Animatable.setDriver(animeDriver)  // BAD: atoms still use gsap
```

### 3. SVG Attributes with GSAP

```typescript
// BANNED - GSAP doesn't handle attr well
gsap.to(svgLine, { attr: { x2: 100 } })

// CORRECT - Use anime.js for SVG attributes
anime(svgLine, { attr: { x2: 100 } })
```

### 4. Timeline Positions Without Labels

```typescript
// BANNED - Hard to debug, maintain
tl.to(el, { x: 100 }, 0.015)
tl.to(el, { y: 50 }, 0.035)

// CORRECT - Use labels for clarity
tl.addLabel('secondary', 0.015)
tl.addLabel('tertiary', 0.035)
tl.to(el, { x: 100 }, 'secondary')
tl.to(el, { y: 50 }, 'tertiary')
```

### 5. setTimeout Between Animation Phases

```typescript
// BANNED - Race conditions, hard to cancel
await animate1()
setTimeout(() => animate2(), 100)

// CORRECT - Use timeline or Promise chain
const tl = gsap.timeline()
tl.add(() => animate1())
tl.add(() => animate2(), '+=0.1')
```

---

## Conversion Cheatsheet

GSAP uses **seconds**, tokens are in **milliseconds**.

```typescript
// Token → GSAP
duration: TIMING.reticle.expandDuration / 1000  // 80ms → 0.08s

// Token → CSS
animationDuration: `${VANTA_ANIMATION.duration.normal}` // '200ms'

// Token → anime.js (uses ms)
duration: TIMING.reticle.expandDuration  // 80 (ms)
```

---

## File Locations Summary

| Component | File | Purpose |
|-----------|------|---------|
| **AnimationDriver interface** | `src/lib/animation/Animatable.ts:44-77` | Driver contract |
| **rafDriver** | `src/lib/animation/Animatable.ts:187-300` | Fallback driver |
| **gsapDriver** | `src/lib/animation/drivers/gsap.ts` | GSAP integration |
| **animeDriver** | `src/lib/animation/drivers/animejs.ts` | anime.js integration |
| **Interpolators** | `src/lib/animation/Animatable.ts:163-178` | Type-safe interpolation |
| **Motion blur** | `src/lib/motion/useMotionBlur.ts` | Velocity effects |
| **Parallax lift** | `src/lib/drawer/animations/parallax-lift.ts` | 3D stack |
| **TIMING tokens** | `src/lib/animation/tokens.ts` | Duration constants |
| **EASING tokens** | `src/lib/animation/tokens.ts` | Easing constants |

---

## Integration Points

- **tmnl-design-tokens** — Token system architecture
- **ag-grid-patterns** — Grid-specific flash animation
- **tmnl-color-system** — Color tokens for glows/flashes
- **xstate-integration** — State machine-driven animation phases

