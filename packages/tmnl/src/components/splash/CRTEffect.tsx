/**
 * CRT Effect Layer
 *
 * Provides the analog CRT aesthetics:
 * - Scanlines (horizontal lines overlay)
 * - Flicker/jitter (random opacity variance)
 * - Moiré interference patterns
 * - Static burst on power-on
 *
 * Uses our Animatable system with GSAP driver for precision timing.
 */

import { useEffect, useRef, useMemo } from 'react'
import {
  animatable,
  useAnimatable,
  gsapDriver,
  Animatable,
} from '@/lib/animation'
import { CRT_EFFECTS, SPLASH_TIMING, SPLASH_COLORS } from './tokens'

// Set GSAP driver for precision timing
Animatable.setDriver(gsapDriver)

interface CRTEffectProps {
  /** Whether the CRT is powered on */
  isActive: boolean
  /** Whether to show static burst */
  showStatic: boolean
  /** Whether to show scanlines */
  showScanlines: boolean
  /** Callback when static burst completes */
  onStaticComplete?: () => void
}

// Create animatable atoms outside component for stable references
const staticIntensityAtoms = animatable(1, {
  duration: SPLASH_TIMING.boot.staticBurst,
  ease: 'power3.out',
})

export function CRTEffect({
  isActive,
  showStatic,
  showScanlines,
  onStaticComplete,
}: CRTEffectProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const moireRef = useRef<number>(0)
  const onStaticCompleteRef = useRef(onStaticComplete)

  // Keep callback ref updated
  useEffect(() => {
    onStaticCompleteRef.current = onStaticComplete
  }, [onStaticComplete])

  // Use our animatable hook for static intensity
  const staticAnim = useAnimatable(staticIntensityAtoms)

  // Trigger static burst animation
  useEffect(() => {
    if (showStatic) {
      // Reset to full intensity then animate to 0
      staticAnim.snap(1)
      // Small delay to ensure snap completes before animation
      const timer = setTimeout(() => {
        staticAnim.to(0)
      }, 16)
      return () => clearTimeout(timer)
    } else {
      staticAnim.snap(0)
    }
  }, [showStatic, staticAnim])

  // Watch for animation completion
  useEffect(() => {
    if (staticAnim.state === 'completed' && staticAnim.value === 0 && showStatic) {
      onStaticCompleteRef.current?.()
    }
  }, [staticAnim.state, staticAnim.value, showStatic])

  // Draw static noise on canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || staticAnim.value <= 0.01) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const width = canvas.width
    const height = canvas.height
    const imageData = ctx.createImageData(width, height)
    const data = imageData.data
    const intensity = staticAnim.value

    for (let i = 0; i < data.length; i += 4) {
      if (Math.random() < CRT_EFFECTS.static.density * intensity) {
        const brightness = Math.random() * 255
        data[i] = brightness     // R
        data[i + 1] = brightness // G
        data[i + 2] = brightness // B
        data[i + 3] = Math.floor(255 * intensity) // A
      }
    }

    ctx.putImageData(imageData, 0, 0)
  }, [staticAnim.value])

  // Flicker effect loop - uses RAF directly (intentionally random, not smooth)
  useEffect(() => {
    if (!isActive) return

    let rafId: number

    const flicker = () => {
      if (Math.random() < CRT_EFFECTS.flicker.frequency) {
        const container = containerRef.current
        if (container) {
          const intensity = Math.random() * CRT_EFFECTS.flicker.intensity
          container.style.opacity = `${1 - intensity}`
          setTimeout(() => {
            if (container) container.style.opacity = '1'
          }, 50)
        }
      }
      rafId = requestAnimationFrame(flicker)
    }

    rafId = requestAnimationFrame(flicker)
    return () => cancelAnimationFrame(rafId)
  }, [isActive])

  // Moiré animation - continuous rotation using RAF
  useEffect(() => {
    if (!isActive) return

    let rafId: number
    const startTime = performance.now()

    const animateMoire = (now: number) => {
      const elapsed = now - startTime
      moireRef.current = (elapsed / SPLASH_TIMING.crt.moireSpeed) * 360
      rafId = requestAnimationFrame(animateMoire)
    }

    rafId = requestAnimationFrame(animateMoire)
    return () => cancelAnimationFrame(rafId)
  }, [isActive])

  // Resize canvas to match container
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 9999 }}
    >
      {/* Static noise layer */}
      {staticAnim.value > 0.01 && (
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ mixBlendMode: 'screen' }}
        />
      )}

      {/* Scanlines overlay */}
      {showScanlines && (
        <div
          className="absolute inset-0"
          style={{
            background: `repeating-linear-gradient(
              0deg,
              transparent,
              transparent ${CRT_EFFECTS.scanlines.spacing - CRT_EFFECTS.scanlines.thickness}px,
              ${SPLASH_COLORS.bg.scanline} ${CRT_EFFECTS.scanlines.spacing - CRT_EFFECTS.scanlines.thickness}px,
              ${SPLASH_COLORS.bg.scanline} ${CRT_EFFECTS.scanlines.spacing}px
            )`,
            opacity: CRT_EFFECTS.scanlines.opacity,
          }}
        />
      )}

      {/* Moiré interference pattern */}
      {isActive && (
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(
                ellipse at 50% 50%,
                transparent 0%,
                ${SPLASH_COLORS.fx.flicker} 50%,
                transparent 100%
              )
            `,
            backgroundSize: `${CRT_EFFECTS.moire.scale}px ${CRT_EFFECTS.moire.scale}px`,
            opacity: CRT_EFFECTS.moire.opacity,
            animation: `moire-shift ${SPLASH_TIMING.crt.moireSpeed}ms linear infinite`,
          }}
        />
      )}

      {/* Vignette */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(
            ellipse at 50% 50%,
            transparent 0%,
            transparent 60%,
            rgba(0, 0, 0, 0.4) 100%
          )`,
        }}
      />

      {/* Global styles for moiré animation */}
      <style>{`
        @keyframes moire-shift {
          from { transform: rotate(0deg) scale(1); }
          to { transform: rotate(360deg) scale(1.02); }
        }
      `}</style>
    </div>
  )
}

export default CRTEffect
