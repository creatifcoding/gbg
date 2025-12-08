/**
 * Logo Reveal Animation
 *
 * The hero moment: TMNL letter→word expansion
 *
 * T → Terminal
 * M → Multi-Modal
 * N → Navigation
 * L → Layer
 *
 * Each letter/word pair reveals with staggered timing (~500ms each)
 * Uses GSAP directly for mechanical/linear precision
 */

import { useEffect, useState, useRef } from 'react'
import { gsap } from 'gsap'
import {
  LOGO_CONFIG,
  SPLASH_TIMING,
  SPLASH_COLORS,
  SPLASH_TYPOGRAPHY,
} from './tokens'

interface LogoRevealProps {
  /** Whether to start the reveal */
  isActive: boolean
  /** Callback when reveal completes */
  onComplete?: () => void
}

interface LetterState {
  letter: string
  word: string
  isVisible: boolean
  isExpanded: boolean
}

export function LogoReveal({ isActive, onComplete }: LogoRevealProps) {
  const [letters, setLetters] = useState<LetterState[]>(
    LOGO_CONFIG.letters.map(({ letter, word }) => ({
      letter,
      word,
      isVisible: false,
      isExpanded: false,
    }))
  )
  const wordRefs = useRef<(HTMLSpanElement | null)[]>([])
  const arrowRefs = useRef<(HTMLSpanElement | null)[]>([])
  const timeoutsRef = useRef<NodeJS.Timeout[]>([])
  const onCompleteRef = useRef(onComplete)

  // Keep callback ref updated
  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  useEffect(() => {
    if (!isActive) return

    // Clear any existing timeouts
    timeoutsRef.current.forEach(clearTimeout)
    timeoutsRef.current = []

    let completedCount = 0
    const totalLetters = LOGO_CONFIG.letters.length

    LOGO_CONFIG.letters.forEach((config, index) => {
      const delay = index * SPLASH_TIMING.logo.letterStagger

      // Show letter
      const showTimeout = setTimeout(() => {
        setLetters((prev) =>
          prev.map((l, i) => (i === index ? { ...l, isVisible: true } : l))
        )

        // Expand to word after brief pause
        const expandTimeout = setTimeout(() => {
          setLetters((prev) =>
            prev.map((l, i) => (i === index ? { ...l, isExpanded: true } : l))
          )

          // Animate arrow appearance
          const arrowEl = arrowRefs.current[index]
          if (arrowEl) {
            gsap.fromTo(
              arrowEl,
              { opacity: 0, x: -5 },
              {
                opacity: 1,
                x: 0,
                duration: 0.1,
                ease: 'none', // Mechanical - linear
              }
            )
          }

          // Animate word fade-in
          const wordEl = wordRefs.current[index]
          if (wordEl) {
            gsap.fromTo(
              wordEl,
              { opacity: 0, x: -10 },
              {
                opacity: 1,
                x: 0,
                duration: SPLASH_TIMING.logo.wordExpandDuration / 1000,
                ease: 'none', // Mechanical - linear
                onComplete: () => {
                  completedCount++
                  if (completedCount === totalLetters) {
                    onCompleteRef.current?.()
                  }
                },
              }
            )
          } else {
            completedCount++
            if (completedCount === totalLetters) {
              onCompleteRef.current?.()
            }
          }
        }, 100) // Small pause before expansion

        timeoutsRef.current.push(expandTimeout as unknown as NodeJS.Timeout)
      }, delay)

      timeoutsRef.current.push(showTimeout as unknown as NodeJS.Timeout)
    })

    return () => {
      timeoutsRef.current.forEach(clearTimeout)
    }
  }, [isActive])

  if (!isActive && letters.every((l) => !l.isVisible)) {
    return null
  }

  return (
    <div
      className="flex flex-col items-start gap-1"
      style={{
        fontFamily: SPLASH_TYPOGRAPHY.fontFamily,
      }}
    >
      {letters.map((state, index) => (
        <div
          key={state.letter}
          className="flex items-baseline gap-2 overflow-hidden"
          style={{
            opacity: state.isVisible ? 1 : 0,
            transition: 'opacity 150ms linear',
          }}
        >
          {/* The letter - bold, prominent */}
          <span
            style={{
              color: SPLASH_COLORS.text.primary,
              fontSize: SPLASH_TYPOGRAPHY.size.xl,
              fontWeight: SPLASH_TYPOGRAPHY.weight.bold,
              letterSpacing: '0.05em',
            }}
          >
            {state.letter}
          </span>

          {/* The separator - animated via GSAP */}
          <span
            ref={(el) => {
              arrowRefs.current[index] = el
            }}
            style={{
              color: SPLASH_COLORS.text.dim,
              fontSize: SPLASH_TYPOGRAPHY.size.sm,
              fontWeight: SPLASH_TYPOGRAPHY.weight.light,
              opacity: 0, // Initial state, GSAP animates
            }}
          >
            →
          </span>

          {/* The word - animated via GSAP */}
          <span
            ref={(el) => {
              wordRefs.current[index] = el
            }}
            style={{
              color: SPLASH_COLORS.text.secondary,
              fontSize: SPLASH_TYPOGRAPHY.size.lg,
              fontWeight: SPLASH_TYPOGRAPHY.weight.light,
              opacity: 0, // Initial state, GSAP animates
              letterSpacing: '0.02em',
            }}
          >
            {state.word}
          </span>
        </div>
      ))}
    </div>
  )
}

export default LogoReveal
