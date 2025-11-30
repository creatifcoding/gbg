/**
 * Animation Testbed
 *
 * Isolated test cases for the Animatable system.
 * Three case studies demonstrating the core animation primitives.
 */

import { useState, useRef, useEffect } from 'react'
import { Link } from '@tanstack/react-router'
import { motion } from 'framer-motion'
import { gsap } from 'gsap'
import {
  animatable,
  useAnimatable,
  gsapDriver,
  Animatable,
  createCornerEmanation,
  createCrosshair,
  createReticleRings,
  COLORS,
  TIMING,
} from '@/lib/animation'

// Initialize GSAP driver
Animatable.setDriver(gsapDriver)

// =============================================================================
// CASE 1: Basic Animatable - Scale & Opacity
// =============================================================================

// Create animatable atoms outside component (stable references)
const scaleAtoms = animatable(1, { duration: 300, ease: 'power2.out' })
const opacityAtoms = animatable(1, { duration: 200, ease: 'linear' })
const rotationAtoms = animatable(0, { duration: 400, ease: 'back.out(1.7)' })

function Case1_BasicAnimatable() {
  const scale = useAnimatable(scaleAtoms)
  const opacity = useAnimatable(opacityAtoms)
  const rotation = useAnimatable(rotationAtoms)

  return (
    <div className="p-6 border border-neutral-700 rounded-lg bg-neutral-900/50">
      <h3 className="text-sm font-mono text-neutral-400 mb-4">
        Case 1: Basic Animatable Values
      </h3>

      {/* Animated Target */}
      <div className="flex justify-center mb-6">
        <div
          className="w-24 h-24 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg"
          style={{
            transform: `scale(${scale.value}) rotate(${rotation.value}deg)`,
            opacity: opacity.value,
          }}
        />
      </div>

      {/* Controls */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="space-y-2">
          <div className="text-neutral-500">Scale: {scale.value.toFixed(2)}</div>
          <button
            onClick={() => scale.to(scale.value === 1 ? 1.5 : 1)}
            className="w-full px-2 py-1 bg-cyan-800/50 hover:bg-cyan-700/50 rounded"
          >
            Toggle Scale
          </button>
        </div>

        <div className="space-y-2">
          <div className="text-neutral-500">Opacity: {opacity.value.toFixed(2)}</div>
          <button
            onClick={() => opacity.to(opacity.value === 1 ? 0.3 : 1)}
            className="w-full px-2 py-1 bg-blue-800/50 hover:bg-blue-700/50 rounded"
          >
            Toggle Opacity
          </button>
        </div>

        <div className="space-y-2">
          <div className="text-neutral-500">Rotation: {rotation.value.toFixed(0)}deg</div>
          <button
            onClick={() => rotation.to(rotation.value + 90)}
            className="w-full px-2 py-1 bg-purple-800/50 hover:bg-purple-700/50 rounded"
          >
            Rotate +90
          </button>
        </div>
      </div>

      {/* State indicators */}
      <div className="mt-4 flex gap-4 text-xs text-neutral-600">
        <span>Scale: {scale.state}</span>
        <span>Opacity: {opacity.state}</span>
        <span>Rotation: {rotation.state}</span>
      </div>
    </div>
  )
}

// =============================================================================
// CASE 2: GSAP Timeline - Corner Emanation Sequence
// =============================================================================

function Case2_EmanationSequence() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)

  const triggerEmanation = () => {
    const container = containerRef.current
    if (!container || isPlaying) return

    setIsPlaying(true)

    // Get center of the target box
    const box = container.querySelector('.emanation-target')
    if (!box) return

    const rect = box.getBoundingClientRect()
    const containerRect = container.getBoundingClientRect()

    // Create emanation at each corner
    const corners = [
      { x: rect.left - containerRect.left, y: rect.top - containerRect.top },
      { x: rect.right - containerRect.left, y: rect.top - containerRect.top },
      { x: rect.right - containerRect.left, y: rect.bottom - containerRect.top },
      { x: rect.left - containerRect.left, y: rect.bottom - containerRect.top },
    ]

    let completed = 0
    corners.forEach((corner, i) => {
      setTimeout(() => {
        const emanation = createCornerEmanation(container, corner, {
          onComplete: () => {
            completed++
            if (completed === 4) {
              setIsPlaying(false)
            }
          },
        })
        emanation.play()
      }, i * 15) // Stagger by 15ms
    })
  }

  return (
    <div className="p-6 border border-neutral-700 rounded-lg bg-neutral-900/50">
      <h3 className="text-sm font-mono text-neutral-400 mb-4">
        Case 2: Corner Emanation (GSAP Timeline)
      </h3>

      {/* Emanation Container */}
      <div
        ref={containerRef}
        className="relative flex justify-center items-center h-40 mb-4 bg-neutral-800/30 rounded overflow-hidden"
      >
        <div
          className="emanation-target w-20 h-20 border-2 border-dashed border-neutral-600 rounded-lg flex items-center justify-center cursor-pointer hover:border-cyan-500 transition-colors"
          onClick={triggerEmanation}
        >
          <span className="text-xs text-neutral-500">Click me</span>
        </div>
      </div>

      {/* Info */}
      <div className="text-xs text-neutral-600 space-y-1">
        <div>Phases: 0-15ms (primary) | 15-35ms (secondary) | 35-50ms (tertiary)</div>
        <div>Status: {isPlaying ? 'Playing...' : 'Ready'}</div>
      </div>

      <button
        onClick={triggerEmanation}
        disabled={isPlaying}
        className="mt-4 w-full px-3 py-2 bg-green-800/50 hover:bg-green-700/50 disabled:opacity-50 rounded text-sm"
      >
        Trigger Emanation
      </button>
    </div>
  )
}

// =============================================================================
// CASE 3: Interactive Reticle - Crosshair + Pulsing Rings
// =============================================================================

function Case3_InteractiveReticle() {
  const containerRef = useRef<HTMLDivElement>(null)
  const reticleRef = useRef<{
    crosshair: ReturnType<typeof createCrosshair> | null
    rings: ReturnType<typeof createReticleRings> | null
  }>({ crosshair: null, rings: null })
  const [isActive, setIsActive] = useState(false)

  const handlePointerDown = (e: React.PointerEvent) => {
    const container = containerRef.current
    if (!container) return

    // Clean up previous
    reticleRef.current.crosshair?.destroy()
    reticleRef.current.rings?.destroy()

    // Get click position relative to container
    const rect = container.getBoundingClientRect()
    const center = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }

    // Create crosshair
    const crosshair = createCrosshair(container, center, {
      color: COLORS.reticle.primary,
      armLength: 16,
      gap: 6,
    })

    // Create pulsing rings
    const rings = createReticleRings(container, center, {
      ringCount: 3,
      baseRadius: 20,
      color: COLORS.reticle.primary,
      period: 1000,
    })

    reticleRef.current = { crosshair, rings }

    // Animate in
    crosshair.expand()
    rings.start()
    setIsActive(true)
  }

  const handlePointerUp = () => {
    if (reticleRef.current.crosshair) {
      reticleRef.current.crosshair.collapse().then(() => {
        reticleRef.current.rings?.stop()
        setIsActive(false)
      })
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      reticleRef.current.crosshair?.destroy()
      reticleRef.current.rings?.destroy()
    }
  }, [])

  return (
    <div className="p-6 border border-neutral-700 rounded-lg bg-neutral-900/50">
      <h3 className="text-sm font-mono text-neutral-400 mb-4">
        Case 3: Interactive Reticle (anime.js)
      </h3>

      {/* Interactive Area */}
      <div
        ref={containerRef}
        className="relative h-48 bg-neutral-800/30 rounded cursor-crosshair overflow-hidden"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-xs text-neutral-600">
            {isActive ? 'Release to collapse' : 'Press and hold anywhere'}
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="mt-4 text-xs text-neutral-600">
        <div>Crosshair expands on press, rings pulse continuously</div>
        <div>Status: {isActive ? 'Active' : 'Idle'}</div>
      </div>
    </div>
  )
}

// =============================================================================
// MAIN TESTBED COMPONENT
// =============================================================================

export function AnimationTestbed() {
  return (
    <div className="min-h-screen bg-black text-white p-8">
      {/* Header */}
      <div className="max-w-4xl mx-auto mb-8">
        <Link to="/" className="text-neutral-500 hover:text-white text-sm mb-2 block">
          &larr; Back to Home
        </Link>
        <h1 className="text-2xl font-mono mb-2">Animation Testbed</h1>
        <p className="text-neutral-500 text-sm">
          Isolated case studies for the Animatable system
        </p>
      </div>

      {/* Test Cases Grid */}
      <div className="max-w-4xl mx-auto grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Case1_BasicAnimatable />
        <Case2_EmanationSequence />
        <Case3_InteractiveReticle />
      </div>

      {/* Effect-ification Notes */}
      <div className="max-w-4xl mx-auto mt-12 p-6 border border-neutral-800 rounded-lg">
        <h2 className="text-lg font-mono text-cyan-400 mb-4">
          Effect-ification Roadmap
        </h2>
        <div className="text-sm text-neutral-400 space-y-4 font-mono">
          <div>
            <span className="text-yellow-500">// Current:</span> Animation drivers use callbacks (onUpdate, onComplete)
          </div>
          <div>
            <span className="text-green-500">// Future:</span> Animation sequences as Effect programs
          </div>
          <pre className="bg-neutral-900 p-4 rounded overflow-x-auto text-xs">
{`// Animation as Effect program with spans
const emanationSequence = Effect.gen(function*() {
  yield* Effect.logInfo("Starting emanation sequence")

  yield* Effect.withSpan("phase:primary", { attributes: { duration: 15 } })(
    AnimationEffect.to(ringScale, 1, { duration: 15 })
  )

  yield* Effect.withSpan("phase:secondary", { attributes: { duration: 20 } })(
    AnimationEffect.to(ringScale, 1.1, { duration: 20 })
  )

  yield* Effect.withSpan("phase:tertiary", { attributes: { duration: 15 } })(
    AnimationEffect.to(ringOpacity, 0, { duration: 15 })
  )
})

// Run with tracing
const fiber = yield* Effect.fork(emanationSequence)
`}
          </pre>
          <div className="text-neutral-500 text-xs mt-4">
            Key wins: Fiber interruption for animation cancellation, spans for DevTools visibility,
            Effect.all for parallel animations, Scope for cleanup
          </div>
        </div>
      </div>
    </div>
  )
}

export default AnimationTestbed
