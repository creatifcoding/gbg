/**
 * Text Morph Animation
 *
 * 4-phase character morphing between strings of varying lengths.
 * Uses anime.js v4 for timeline orchestration.
 *
 * @see .claude/skills/animation-techniques/techniques/text-morph-animation.md
 * @bead tmnl-ypwpb (parent feature)
 */

import { createTimeline, stagger } from "animejs"

// =============================================================================
// Types
// =============================================================================

/**
 * Character mapping between source and target strings
 * @bead tmnl-qaako
 */
export interface CharMapping {
  /** Index in source string (null = new char, fade in) */
  sourceIndex: number | null
  /** Index in target string (-1 = removed, fade out) */
  targetIndex: number
  /** The character at target position */
  char: string
  /** Animation operation for this character */
  operation: "keep" | "fadeOut" | "fadeIn" | "transform"
}

export interface MorphOptions {
  /** Total animation duration in ms (default: 500) */
  duration?: number
  /** Width of each character in px for positioning (default: 8) */
  charWidth?: number
  /** Callback when animation completes */
  onComplete?: () => void
  /** Skip animation entirely (for reduced motion) */
  skipAnimation?: boolean
}

// =============================================================================
// Character Mapping Algorithm
// @bead tmnl-qaako
// =============================================================================

/**
 * Compute character mappings between two strings.
 *
 * Algorithm:
 * 1. Pass 1: Match identical chars in same position (keep)
 * 2. Pass 2: Map remaining source chars to target positions (transform/fadeOut)
 * 3. Pass 3: Add new chars for growing strings (fadeIn)
 *
 * @example
 * computeCharMapping("Low", "Medium")
 * // [
 * //   { sourceIndex: 0, targetIndex: 0, char: "M", operation: "transform" },
 * //   { sourceIndex: 1, targetIndex: 1, char: "e", operation: "transform" },
 * //   { sourceIndex: 2, targetIndex: 2, char: "d", operation: "transform" },
 * //   { sourceIndex: null, targetIndex: 3, char: "i", operation: "fadeIn" },
 * //   { sourceIndex: null, targetIndex: 4, char: "u", operation: "fadeIn" },
 * //   { sourceIndex: null, targetIndex: 5, char: "m", operation: "fadeIn" },
 * // ]
 */
export function computeCharMapping(from: string, to: string): CharMapping[] {
  const result: CharMapping[] = []
  const fromChars = from.split("")
  const toChars = to.split("")
  const used = new Set<number>()

  // Pass 1: Match identical chars in same position
  for (let i = 0; i < Math.min(fromChars.length, toChars.length); i++) {
    if (fromChars[i] === toChars[i]) {
      result.push({
        sourceIndex: i,
        targetIndex: i,
        char: toChars[i],
        operation: "keep",
      })
      used.add(i)
    }
  }

  // Pass 2: Map remaining source chars to target positions
  for (let i = 0; i < fromChars.length; i++) {
    if (used.has(i)) continue

    if (i < toChars.length) {
      result.push({
        sourceIndex: i,
        targetIndex: i,
        char: toChars[i],
        operation: "transform",
      })
      used.add(i)
    } else {
      // Source char has no target position - fade out
      result.push({
        sourceIndex: i,
        targetIndex: -1,
        char: fromChars[i],
        operation: "fadeOut",
      })
    }
  }

  // Pass 3: Add new chars for growing strings
  for (let i = fromChars.length; i < toChars.length; i++) {
    result.push({
      sourceIndex: null,
      targetIndex: i,
      char: toChars[i],
      operation: "fadeIn",
    })
  }

  // Sort by target index (fadeOuts use source index)
  return result.sort(
    (a, b) =>
      (a.targetIndex === -1 ? a.sourceIndex! : a.targetIndex) -
      (b.targetIndex === -1 ? b.sourceIndex! : b.targetIndex)
  )
}

// =============================================================================
// Container Setup
// @bead tmnl-uucmu
// =============================================================================

/**
 * Initialize container with character spans for animation.
 * Each character gets its own span for individual animation control.
 */
export function initCharSpans(
  container: HTMLElement,
  text: string
): HTMLSpanElement[] {
  // Clear existing content
  container.innerHTML = ""

  const spans: HTMLSpanElement[] = []

  for (const char of text) {
    const span = document.createElement("span")
    span.textContent = char
    span.style.cssText = "display:inline-block;position:relative;"
    container.appendChild(span)
    spans.push(span)
  }

  return spans
}

// =============================================================================
// Animation Phases
// =============================================================================

/**
 * Morph text from one string to another with 4-phase animation.
 *
 * Phases:
 * 1. Fade out unmapped characters (0-20%)
 * 2. Compress remaining characters to close gaps (20-40%)
 * 3. Scramble to target positions + letter swap (40-80%)
 * 4. Fade in new characters (80-100%)
 *
 * @bead tmnl-yxssu (phase 1)
 * @bead tmnl-j17b7 (phase 2)
 * @bead tmnl-7zorg (phase 3)
 * @bead tmnl-az4jt (phase 4)
 */
export function morphText(
  container: HTMLElement,
  fromText: string,
  toText: string,
  options: MorphOptions = {}
): ReturnType<typeof createTimeline> | null {
  const { duration = 500, charWidth = 8, onComplete, skipAnimation } = options

  // Skip animation path
  if (skipAnimation) {
    container.textContent = toText
    onComplete?.()
    return null
  }

  // Phase durations as fractions of total
  const p1 = duration * 0.2 // 0-20%: fade out
  const p2 = duration * 0.2 // 20-40%: compress
  const p3 = duration * 0.4 // 40-80%: scramble
  const p4 = duration * 0.2 // 80-100%: fade in

  // Initialize char spans if not already present
  let charSpans = Array.from(container.querySelectorAll("span")) as HTMLSpanElement[]
  if (charSpans.length === 0 || charSpans.length !== fromText.length) {
    charSpans = initCharSpans(container, fromText)
  }

  // Compute character mapping
  const mapping = computeCharMapping(fromText, toText)

  // Categorize by operation
  const fadeOuts = mapping.filter((m) => m.operation === "fadeOut")
  const keeps = mapping.filter(
    (m) => m.operation === "keep" || m.operation === "transform"
  )
  const fadeIns = mapping.filter((m) => m.operation === "fadeIn")

  // Helper: compute compression offset
  const getCompressionX = (m: CharMapping) => {
    const fadeOutsBefore = fadeOuts.filter(
      (x) => x.sourceIndex! < m.sourceIndex!
    ).length
    return -fadeOutsBefore * charWidth
  }

  // Build timeline
  const tl = createTimeline({
    onComplete: () => {
      // Clean up: set final text content
      container.textContent = toText
      onComplete?.()
    },
  })

  // Phase 1: Fade out unmapped chars
  // @bead tmnl-yxssu
  if (fadeOuts.length > 0) {
    const fadeOutTargets = fadeOuts.map((m) => charSpans[m.sourceIndex!])
    tl.add(
      fadeOutTargets,
      {
        opacity: [1, 0],
        scale: [1, 0.5],
        filter: ["blur(0px)", "blur(4px)"],
        duration: p1,
        delay: stagger(p1 / Math.max(fadeOuts.length, 1), { from: "center" }),
        ease: "outQuad",
      },
      0
    )
  }

  // Phase 2: Compress remaining chars
  // @bead tmnl-j17b7
  if (keeps.length > 0 && fadeOuts.length > 0) {
    const keepTargets = keeps.map((m) => charSpans[m.sourceIndex!])
    tl.add(
      keepTargets,
      {
        translateX: ((_target: unknown, i: number) =>
          getCompressionX(keeps[i])) as unknown as number,
        duration: p2,
        ease: "inOutQuad",
      },
      p1
    )
  }

  // Phase 3: Scramble to target + letter swap
  // @bead tmnl-7zorg
  if (keeps.length > 0) {
    let lettersSwapped = false
    const keepTargets = keeps.map((m) => charSpans[m.sourceIndex!])

    tl.add(
      keepTargets,
      {
        translateX: ((_target: unknown, i: number) => {
          const m = keeps[i]
          const compression = fadeOuts.length > 0 ? getCompressionX(m) : 0
          const targetOffset = (m.targetIndex - m.sourceIndex!) * charWidth
          return compression + targetOffset
        }) as unknown as number,
        translateY: [
          {
            value: ((_target: unknown, i: number) =>
              i % 2 === 0 ? -8 : 8) as unknown as number,
            duration: p3 * 0.5,
          },
          { value: 0, duration: p3 * 0.5 },
        ],
        duration: p3,
        delay: stagger(p3 / Math.max(keeps.length, 1) / 2, { from: "first" }),
        ease: "outQuad",
        onUpdate: (anim: { progress: number }) => {
          // Swap letters at 50% progress
          if (anim.progress >= 50 && !lettersSwapped) {
            keeps.forEach((m) => {
              if (m.operation === "transform") {
                charSpans[m.sourceIndex!].textContent = m.char
              }
            })
            lettersSwapped = true
          }
        },
      },
      fadeOuts.length > 0 ? p1 + p2 : 0
    )
  }

  // Phase 4: Fade in new chars
  // @bead tmnl-az4jt
  if (fadeIns.length > 0) {
    // Create new spans for incoming characters
    const newSpans: HTMLSpanElement[] = []
    fadeIns.forEach((m) => {
      const span = document.createElement("span")
      span.textContent = m.char
      span.style.cssText =
        "display:inline-block;position:relative;opacity:0;transform:scale(0.5);filter:blur(4px);"
      container.appendChild(span)
      newSpans.push(span)
    })

    tl.add(
      newSpans,
      {
        opacity: [0, 1],
        scale: [0.5, 1],
        filter: ["blur(4px)", "blur(0px)"],
        duration: p4,
        delay: stagger(p4 / Math.max(fadeIns.length, 1)),
        ease: "outQuad",
      },
      fadeOuts.length > 0 || keeps.length > 0 ? p1 + p2 + p3 : 0
    )
  }

  return tl
}

