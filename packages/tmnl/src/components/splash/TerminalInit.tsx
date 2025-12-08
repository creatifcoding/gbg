/**
 * Terminal Init Sequence
 *
 * Displays the boot log with:
 * - Staccato rhythm (pause-burst-pause)
 * - Variable text entry (instant vs typed)
 * - Color shift on completion (using animatable)
 * - Mixed typography weights
 *
 * Uses our Animatable system for smooth color transitions.
 */

import { useEffect, useState, useRef, useMemo } from 'react'
import { gsap } from 'gsap'
import {
  INIT_LINES,
  WIT_LINE,
  SPLASH_TIMING,
  SPLASH_COLORS,
  SPLASH_TYPOGRAPHY,
  type InitLine,
} from './tokens'

interface TerminalInitProps {
  /** Whether to start the sequence */
  isActive: boolean
  /** Include the wit line */
  includeWit?: boolean
  /** Callback when all lines complete */
  onComplete?: () => void
}

interface LineState {
  line: InitLine
  isVisible: boolean
  isComplete: boolean
  typedText: string
  labelRef: React.RefObject<HTMLSpanElement>
}

export function TerminalInit({
  isActive,
  includeWit = true,
  onComplete,
}: TerminalInitProps) {
  // Create refs for each line's label (for GSAP color animation)
  const lineRefs = useRef<React.RefObject<HTMLSpanElement>[]>([])

  // Memoize the lines configuration
  const allLines = useMemo(() => {
    const lines = includeWit
      ? [...INIT_LINES.slice(0, 5), WIT_LINE, INIT_LINES[5]]
      : INIT_LINES

    // Ensure we have refs for each line
    if (lineRefs.current.length !== lines.length) {
      lineRefs.current = lines.map(() => ({ current: null }))
    }

    return lines
  }, [includeWit])

  const [lines, setLines] = useState<LineState[]>([])
  const [allComplete, setAllComplete] = useState(false)
  const timeoutsRef = useRef<NodeJS.Timeout[]>([])

  // Initialize line states
  useEffect(() => {
    setLines(
      allLines.map((line, index) => ({
        line,
        isVisible: false,
        isComplete: false,
        typedText: '',
        labelRef: lineRefs.current[index],
      }))
    )
  }, [allLines])

  // Run the sequence
  useEffect(() => {
    if (!isActive || lines.length === 0) return

    // Clear any existing timeouts
    timeoutsRef.current.forEach(clearTimeout)
    timeoutsRef.current = []

    let completedCount = 0
    const totalLines = lines.length

    lines.forEach((lineState, index) => {
      const { line, labelRef } = lineState

      // Schedule line appearance
      const showTimeout = setTimeout(() => {
        setLines((prev) =>
          prev.map((l, i) => (i === index ? { ...l, isVisible: true } : l))
        )

        if (line.mode === 'instant') {
          // Instant mode: show immediately, then mark complete with color shift
          setLines((prev) =>
            prev.map((l, i) =>
              i === index ? { ...l, typedText: line.status, isComplete: true } : l
            )
          )

          // Animate color shift using GSAP (our driver uses GSAP)
          if (labelRef.current) {
            gsap.to(labelRef.current, {
              color: SPLASH_COLORS.text.success,
              duration: SPLASH_TIMING.boot.colorShiftDuration / 1000,
              ease: 'power2.out',
            })
          }

          completedCount++
          if (completedCount === totalLines) {
            setAllComplete(true)
            onComplete?.()
          }
        } else {
          // Typed mode: character by character
          const chars = line.status.split('')
          chars.forEach((char, charIndex) => {
            const charTimeout = setTimeout(() => {
              setLines((prev) =>
                prev.map((l, i) =>
                  i === index
                    ? { ...l, typedText: line.status.slice(0, charIndex + 1) }
                    : l
                )
              )

              // Mark complete on last char
              if (charIndex === chars.length - 1) {
                setTimeout(() => {
                  setLines((prev) =>
                    prev.map((l, i) =>
                      i === index ? { ...l, isComplete: true } : l
                    )
                  )

                  // Animate color shift
                  if (labelRef.current) {
                    gsap.to(labelRef.current, {
                      color: SPLASH_COLORS.text.success,
                      duration: SPLASH_TIMING.boot.colorShiftDuration / 1000,
                      ease: 'power2.out',
                    })
                  }

                  completedCount++
                  if (completedCount === totalLines) {
                    setAllComplete(true)
                    onComplete?.()
                  }
                }, 50)
              }
            }, charIndex * SPLASH_TIMING.boot.lineTypeDuration)

            timeoutsRef.current.push(charTimeout as unknown as NodeJS.Timeout)
          })
        }
      }, line.delay)

      timeoutsRef.current.push(showTimeout as unknown as NodeJS.Timeout)
    })

    return () => {
      timeoutsRef.current.forEach(clearTimeout)
    }
  }, [isActive, lines.length, onComplete])

  if (!isActive && lines.every((l) => !l.isVisible)) {
    return null
  }

  return (
    <div
      className="font-mono text-left space-y-1"
      style={{
        fontFamily: SPLASH_TYPOGRAPHY.fontFamily,
      }}
    >
      {lines.map((lineState, index) => {
        if (!lineState.isVisible) return null

        const { line, isComplete, typedText } = lineState
        const isWit = line.isWit

        return (
          <div
            key={`${line.label}-${index}`}
            className="flex items-center gap-2 transition-opacity duration-200"
            style={{
              opacity: lineState.isVisible ? 1 : 0,
            }}
          >
            {/* Timestamp - dim */}
            <span
              style={{
                color: SPLASH_COLORS.text.dim,
                fontSize: SPLASH_TYPOGRAPHY.size.xs,
                fontWeight: SPLASH_TYPOGRAPHY.weight.light,
              }}
            >
              [{String(index).padStart(2, '0')}]
            </span>

            {/* Label - heavier weight, animated color */}
            <span
              ref={(el) => {
                if (lineRefs.current[index]) {
                  (lineRefs.current[index] as { current: HTMLSpanElement | null }).current = el
                }
              }}
              style={{
                color: SPLASH_COLORS.text.primary, // Initial color, GSAP animates to success
                fontSize: SPLASH_TYPOGRAPHY.size.sm,
                fontWeight: SPLASH_TYPOGRAPHY.weight.medium,
                minWidth: '4rem',
              }}
            >
              [{line.label}]
            </span>

            {/* Status text - light weight */}
            <span
              style={{
                color: isWit
                  ? SPLASH_COLORS.text.success
                  : SPLASH_COLORS.text.secondary,
                fontSize: SPLASH_TYPOGRAPHY.size.sm,
                fontWeight: SPLASH_TYPOGRAPHY.weight.light,
                fontStyle: isWit ? 'italic' : 'normal',
              }}
            >
              {typedText}
              {!isComplete && line.mode === 'typed' && (
                <span
                  className="inline-block w-2 h-4 ml-0.5 animate-pulse"
                  style={{ backgroundColor: SPLASH_COLORS.text.primary }}
                />
              )}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export default TerminalInit
