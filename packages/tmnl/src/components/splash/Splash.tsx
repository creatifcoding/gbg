/**
 * Splash Screen
 *
 * Orchestrates the boot sequence:
 * 1. Static burst (CRT power-on)
 * 2. Terminal init sequence (staccato log lines)
 * 3. Logo reveal (TMNL letter→word)
 * 4. Morph/dissolve to app
 *
 * Q-Branch Brutalist aesthetic:
 * - Warm gray, scanlines, mechanical timing
 * - Bond-style choreographed reveals
 * - Timeline guides focus
 *
 * Uses our Animatable system for smooth transitions.
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import {
  animatable,
  useAnimatable,
  gsapDriver,
  Animatable,
} from '@/lib/animation'
import { CRTEffect } from './CRTEffect'
import { TerminalInit } from './TerminalInit'
import { LogoReveal } from './LogoReveal'
import { SPLASH_TIMING, SPLASH_COLORS, SPLASH_TYPOGRAPHY } from './tokens'

// Set GSAP driver for precision timing
Animatable.setDriver(gsapDriver)

type SplashPhase =
  | 'static'      // Initial static burst
  | 'boot'        // Terminal init sequence
  | 'logo'        // Logo reveal
  | 'transition'  // Morphing to app
  | 'complete'    // Done, app visible

interface SplashProps {
  /** Callback when splash completes */
  onComplete?: () => void
  /** Allow skip on click/key */
  skippable?: boolean
}

// Create animatable atoms outside component for stable references
const containerOpacityAtoms = animatable(1, {
  duration: SPLASH_TIMING.transition.morphDuration,
  ease: 'power2.inOut',
})

const scanlineOpacityAtoms = animatable(1, {
  duration: SPLASH_TIMING.crt.scanlineFade,
  ease: 'power2.out',
})

export function Splash({ onComplete, skippable = true }: SplashProps) {
  const [phase, setPhase] = useState<SplashPhase>('static')
  const onCompleteRef = useRef(onComplete)

  // Keep callback ref updated
  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  // Use our animatable hooks for transitions
  const containerOpacity = useAnimatable(containerOpacityAtoms)
  const scanlineOpacity = useAnimatable(scanlineOpacityAtoms)

  // Phase transitions
  const handleStaticComplete = useCallback(() => {
    setPhase('boot')
  }, [])

  const handleBootComplete = useCallback(() => {
    // Small pause before logo
    setTimeout(() => {
      setPhase('logo')
    }, 200)
  }, [])

  const handleLogoComplete = useCallback(() => {
    // Begin transition
    setTimeout(() => {
      setPhase('transition')
    }, 300)
  }, [])

  // Transition phase: fade out using animatable
  useEffect(() => {
    if (phase !== 'transition') return

    // Fade out scanlines first
    scanlineOpacity.to(0)

    // Then fade out the whole splash after overlap delay
    const timer = setTimeout(() => {
      containerOpacity.to(0)
    }, SPLASH_TIMING.transition.fadeOverlap)

    return () => clearTimeout(timer)
  }, [phase, scanlineOpacity, containerOpacity])

  // Watch for container fade completion
  useEffect(() => {
    if (
      phase === 'transition' &&
      containerOpacity.state === 'completed' &&
      containerOpacity.value === 0
    ) {
      setPhase('complete')
      onCompleteRef.current?.()
    }
  }, [phase, containerOpacity.state, containerOpacity.value])

  // Skip handler
  const handleSkip = useCallback(() => {
    if (!skippable) return
    if (phase === 'complete' || phase === 'transition') return

    // Immediately transition
    setPhase('transition')
  }, [skippable, phase])

  // Keyboard skip
  useEffect(() => {
    if (!skippable) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') {
        handleSkip()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [skippable, handleSkip])

  // Don't render if complete
  if (phase === 'complete') {
    return null
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{
        backgroundColor: SPLASH_COLORS.bg.primary,
        opacity: containerOpacity.value,
        zIndex: 10000,
        cursor: skippable ? 'pointer' : 'default',
      }}
      onClick={handleSkip}
    >
      {/* CRT Effects Layer */}
      <CRTEffect
        isActive={phase !== 'complete'}
        showStatic={phase === 'static'}
        showScanlines={scanlineOpacity.value > 0.01}
        onStaticComplete={handleStaticComplete}
      />

      {/* Content Container */}
      <div
        className="relative z-10 p-8 max-w-lg"
        style={{
          fontFamily: SPLASH_TYPOGRAPHY.fontFamily,
        }}
      >
        {/* Terminal Init - visible during boot phase */}
        {(phase === 'boot' || phase === 'logo' || phase === 'transition') && (
          <div
            className="mb-8"
            style={{
              opacity: phase === 'boot' ? 1 : 0.3,
              transition: 'opacity 300ms',
            }}
          >
            <TerminalInit
              isActive={phase === 'boot'}
              includeWit={true}
              onComplete={handleBootComplete}
            />
          </div>
        )}

        {/* Logo Reveal - visible during logo phase */}
        {(phase === 'logo' || phase === 'transition') && (
          <div className="mt-8">
            <LogoReveal
              isActive={phase === 'logo'}
              onComplete={handleLogoComplete}
            />
          </div>
        )}
      </div>

      {/* Skip hint */}
      {skippable && phase !== 'transition' && (
        <div
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
          style={{
            color: SPLASH_COLORS.text.dim,
            fontSize: SPLASH_TYPOGRAPHY.size.xs,
            fontFamily: SPLASH_TYPOGRAPHY.fontFamily,
          }}
        >
          press any key to skip
        </div>
      )}
    </div>
  )
}

export default Splash
