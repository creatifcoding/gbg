/**
 * Animation v2 - Basic Testbed
 *
 * Simplest possible usage pattern.
 * Just one animated value, one button.
 */

import { useState } from 'react'
import { createAnimation, useAnimation } from '../index'

// =============================================================================
// TEST 1: Numeric Value
// =============================================================================

// Create animation atom OUTSIDE component
const opacityAnim = createAnimation(1, { duration: 500, ease: 'power2.out' })

export function Test1_Opacity() {
  const { value, state, to } = useAnimation(opacityAnim)

  return (
    <div className="p-4 border border-neutral-700 rounded-lg bg-neutral-900/50">
      <h3 className="text-sm font-mono text-neutral-400 mb-4">
        Test 1: Opacity (number)
      </h3>

      {/* The animated element */}
      <div
        className="w-24 h-24 bg-cyan-500 rounded-lg mx-auto mb-4"
        style={{ opacity: value }}
      />

      {/* Controls */}
      <div className="flex gap-2 justify-center">
        <button
          onClick={() => to(0)}
          className="px-3 py-1 bg-neutral-800 hover:bg-neutral-700 rounded text-sm"
        >
          Fade Out
        </button>
        <button
          onClick={() => to(1)}
          className="px-3 py-1 bg-neutral-800 hover:bg-neutral-700 rounded text-sm"
        >
          Fade In
        </button>
      </div>

      {/* Debug info */}
      <div className="mt-4 text-xs text-neutral-500 font-mono text-center">
        value: {value.toFixed(2)} | state: {state}
      </div>
    </div>
  )
}

// =============================================================================
// TEST 2: Scale with snap
// =============================================================================

const scaleAnim = createAnimation(1, { duration: 300, ease: 'back.out(1.7)' })

export function Test2_Scale() {
  const { value, state, to, snap } = useAnimation(scaleAnim)

  return (
    <div className="p-4 border border-neutral-700 rounded-lg bg-neutral-900/50">
      <h3 className="text-sm font-mono text-neutral-400 mb-4">
        Test 2: Scale with snap
      </h3>

      {/* The animated element */}
      <div className="flex justify-center mb-4">
        <div
          className="w-16 h-16 bg-green-500 rounded-lg"
          style={{ transform: `scale(${value})` }}
        />
      </div>

      {/* Controls */}
      <div className="flex gap-2 justify-center flex-wrap">
        <button
          onClick={() => to(1.5)}
          className="px-3 py-1 bg-neutral-800 hover:bg-neutral-700 rounded text-sm"
        >
          Scale Up
        </button>
        <button
          onClick={() => to(0.5)}
          className="px-3 py-1 bg-neutral-800 hover:bg-neutral-700 rounded text-sm"
        >
          Scale Down
        </button>
        <button
          onClick={() => snap(1)}
          className="px-3 py-1 bg-red-900 hover:bg-red-800 rounded text-sm"
        >
          Snap Reset
        </button>
      </div>

      {/* Debug info */}
      <div className="mt-4 text-xs text-neutral-500 font-mono text-center">
        value: {value.toFixed(2)} | state: {state}
      </div>
    </div>
  )
}

// =============================================================================
// TEST 3: Pause/Resume
// =============================================================================

const progressAnim = createAnimation(0, { duration: 2000, ease: 'none' })

export function Test3_PauseResume() {
  const { value, state, progress, to, pause, resume, cancel } = useAnimation(progressAnim)

  return (
    <div className="p-4 border border-neutral-700 rounded-lg bg-neutral-900/50">
      <h3 className="text-sm font-mono text-neutral-400 mb-4">
        Test 3: Pause/Resume (2s duration)
      </h3>

      {/* Progress bar */}
      <div className="h-4 bg-neutral-800 rounded-full overflow-hidden mb-4">
        <div
          className="h-full bg-purple-500 transition-none"
          style={{ width: `${value * 100}%` }}
        />
      </div>

      {/* Controls */}
      <div className="flex gap-2 justify-center flex-wrap">
        <button
          onClick={() => to(1)}
          disabled={state === 'running'}
          className="px-3 py-1 bg-green-900 hover:bg-green-800 disabled:opacity-50 rounded text-sm"
        >
          Start
        </button>
        <button
          onClick={pause}
          disabled={state !== 'running'}
          className="px-3 py-1 bg-yellow-900 hover:bg-yellow-800 disabled:opacity-50 rounded text-sm"
        >
          Pause
        </button>
        <button
          onClick={resume}
          disabled={state !== 'paused'}
          className="px-3 py-1 bg-blue-900 hover:bg-blue-800 disabled:opacity-50 rounded text-sm"
        >
          Resume
        </button>
        <button
          onClick={() => { cancel(); progressAnim.snap(0) }}
          className="px-3 py-1 bg-red-900 hover:bg-red-800 rounded text-sm"
        >
          Reset
        </button>
      </div>

      {/* Debug info */}
      <div className="mt-4 text-xs text-neutral-500 font-mono text-center">
        value: {value.toFixed(2)} | progress: {progress.toFixed(2)} | state: {state}
      </div>
    </div>
  )
}

// =============================================================================
// MAIN TESTBED
// =============================================================================

export function AnimationV2Testbed() {
  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-mono mb-2">Animation v2 Testbed</h1>
        <p className="text-neutral-500 text-sm mb-8">
          Basic usage patterns for the v2 animation API
        </p>

        <div className="space-y-6">
          <Test1_Opacity />
          <Test2_Scale />
          <Test3_PauseResume />
        </div>
      </div>
    </div>
  )
}

export default AnimationV2Testbed
