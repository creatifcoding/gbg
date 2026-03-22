/**
 * ScanlineMarkdownRenderer
 *
 * Hybrid component combining:
 * 1. StreamingRenderer - Full TipTap markdown rendering
 * 2. Scanline overlay - Brutalist reveal effect using CSS mask
 *
 * The overlay progressively reveals content from left-to-right,
 * creating a declassification/redaction aesthetic. Content is
 * rendered as full markdown underneath, revealed via CSS mask-image.
 *
 * @module testbed/ScanlineMarkdownRenderer
 */

import * as React from 'react'
import { useEffect, useState, useRef, memo } from 'react'
import { cn } from '@/lib/utils'
import { StreamingRenderer } from '@/lib/terminal/v3'

// =============================================================================
// Types
// =============================================================================

export interface ScanlineMarkdownRendererProps {
  /** Markdown text to render and reveal */
  text: string
  /** Whether content is still streaming */
  isStreaming: boolean
  /** Characters revealed per second (default: 400) */
  revealSpeed?: number
  /** Delay before starting reveal (ms) */
  initialDelay?: number
  /** Additional CSS class */
  className?: string
  /** Custom style */
  style?: React.CSSProperties
  /** Show redaction block overlay (default: true) */
  showRedactionOverlay?: boolean
  /** Scanline character for unrevealed content */
  scanlineChar?: string
}

// =============================================================================
// Constants
// =============================================================================

const REDACTED_CHAR = '\u2593' // Medium shade block

// =============================================================================
// Keyframes (injected once)
// =============================================================================

const KEYFRAMES_ID = 'scanline-markdown-keyframes'

function ensureKeyframes() {
  if (typeof document === 'undefined') return
  if (document.getElementById(KEYFRAMES_ID)) return

  const style = document.createElement('style')
  style.id = KEYFRAMES_ID
  style.textContent = `
    @keyframes scanline-sweep {
      0% { background-position: -100% 0; }
      100% { background-position: 200% 0; }
    }
    @keyframes scanline-cursor-blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0; }
    }
  `
  document.head.appendChild(style)
}

// =============================================================================
// CSS Mask-based Overlay
// =============================================================================

interface MaskOverlayProps {
  revealPercent: number
  children: React.ReactNode
}

const MaskOverlay = memo(function MaskOverlay({
  revealPercent,
  children,
}: MaskOverlayProps) {
  // Use CSS mask-image for progressive reveal
  // This approach keeps the markdown content intact and uses a gradient mask
  const maskStyle: React.CSSProperties = {
    maskImage: `linear-gradient(
      90deg,
      black 0%,
      black ${revealPercent}%,
      transparent ${revealPercent + 2}%,
      transparent 100%
    )`,
    WebkitMaskImage: `linear-gradient(
      90deg,
      black 0%,
      black ${revealPercent}%,
      transparent ${revealPercent + 2}%,
      transparent 100%
    )`,
    transition: 'mask-image 50ms linear, -webkit-mask-image 50ms linear',
  }

  return <div style={maskStyle}>{children}</div>
})

// =============================================================================
// Redaction Underlay (visible where content is masked)
// =============================================================================

interface RedactionUnderlayProps {
  revealPercent: number
  height: number
  scanlineChar: string
}

const RedactionUnderlay = memo(function RedactionUnderlay({
  revealPercent,
  height,
  scanlineChar,
}: RedactionUnderlayProps) {
  // Generate grid of redaction characters
  const lines = Math.max(1, Math.ceil(height / 20)) // Approximate line height

  return (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none"
      style={{
        fontFamily: "'Courier New', monospace",
        fontSize: '13px',
        lineHeight: 1.6,
        color: '#bbb',
        background: '#f5f5f5',
        // Show only the unrevealed portion
        clipPath: `inset(0 0 0 ${revealPercent}%)`,
        transition: 'clip-path 50ms linear',
      }}
    >
      {Array(lines)
        .fill(null)
        .map((_, i) => (
          <div key={i} style={{ whiteSpace: 'pre' }}>
            {scanlineChar.repeat(100)}
          </div>
        ))}

      {/* Scanline edge glow */}
      <div
        className="absolute top-0 bottom-0"
        style={{
          left: 0,
          width: '6px',
          background: 'linear-gradient(90deg, #999 0%, transparent 100%)',
        }}
      />
    </div>
  )
})

// =============================================================================
// Main Component
// =============================================================================

function ScanlineMarkdownRendererComponent({
  text,
  isStreaming,
  revealSpeed = 400,
  initialDelay = 100,
  className,
  style,
  showRedactionOverlay = true,
  scanlineChar = REDACTED_CHAR,
}: ScanlineMarkdownRendererProps) {
  const [revealedChars, setRevealedChars] = useState(0)
  const [started, setStarted] = useState(false)
  const [containerHeight, setContainerHeight] = useState(100)
  const containerRef = useRef<HTMLDivElement>(null)
  const prevTextLengthRef = useRef(0)

  // Inject keyframes
  useEffect(() => {
    ensureKeyframes()
  }, [])

  // Start delay
  useEffect(() => {
    if (text.length === 0) return

    const timer = setTimeout(() => {
      setStarted(true)
    }, initialDelay)

    return () => clearTimeout(timer)
  }, [initialDelay, text.length])

  // Track container height for underlay
  useEffect(() => {
    if (!containerRef.current) return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        setContainerHeight(entry.contentRect.height)
      }
    })

    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  // Reveal animation
  useEffect(() => {
    if (!started) return

    // If text shrinks significantly, reset
    if (text.length < prevTextLengthRef.current - 20) {
      setRevealedChars(0)
      setStarted(false)
      prevTextLengthRef.current = text.length
      return
    }
    prevTextLengthRef.current = text.length

    // Already revealed all
    if (revealedChars >= text.length && !isStreaming) return

    const interval = 1000 / revealSpeed
    const timer = setInterval(() => {
      setRevealedChars((prev) => {
        const target = text.length
        if (prev >= target) {
          if (!isStreaming) {
            clearInterval(timer)
          }
          return prev
        }
        // Reveal multiple chars per tick for speed
        return Math.min(prev + 5, target)
      })
    }, interval)

    return () => clearInterval(timer)
  }, [started, text.length, revealSpeed, isStreaming, revealedChars])

  // Calculate reveal percentage
  const revealPercent = text.length > 0 ? (revealedChars / text.length) * 100 : 0
  const isComplete = revealedChars >= text.length && !isStreaming

  // Container styles for relative positioning
  const containerStyle: React.CSSProperties = {
    position: 'relative',
    minHeight: '24px',
    ...style,
  }

  return (
    <div ref={containerRef} className={cn('', className)} style={containerStyle}>
      {/* Redaction underlay - visible where content is masked */}
      {showRedactionOverlay && !isComplete && (
        <RedactionUnderlay
          revealPercent={revealPercent}
          height={containerHeight}
          scanlineChar={scanlineChar}
        />
      )}

      {/* Markdown content with mask */}
      <MaskOverlay revealPercent={isComplete ? 100 : revealPercent}>
        <StreamingRenderer text={text} isStreaming={isStreaming} />
      </MaskOverlay>

      {/* Scanline cursor at reveal edge */}
      {!isComplete && started && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: `${revealPercent}%`,
            top: 0,
            bottom: 0,
            width: '2px',
            background: '#000',
            boxShadow: '-2px 0 4px rgba(0,0,0,0.2)',
            transition: 'left 50ms linear',
            zIndex: 10,
          }}
        />
      )}

      {/* Blinking cursor when streaming and caught up */}
      {isStreaming && revealedChars >= text.length && (
        <span
          style={{
            display: 'inline-block',
            width: '8px',
            height: '14px',
            background: '#000',
            marginLeft: '2px',
            verticalAlign: 'middle',
            animation: 'scanline-cursor-blink 0.8s step-end infinite',
          }}
        />
      )}
    </div>
  )
}

export const ScanlineMarkdownRenderer = memo(ScanlineMarkdownRendererComponent)
export default ScanlineMarkdownRenderer

// =============================================================================
// Convenience Exports
// =============================================================================

/**
 * Static version - reveals immediately without animation.
 */
export function StaticScanlineRenderer({
  text,
  className,
}: {
  text: string
  className?: string
}) {
  return (
    <ScanlineMarkdownRenderer
      text={text}
      isStreaming={false}
      revealSpeed={10000} // Very fast reveal
      initialDelay={0}
      className={className}
    />
  )
}

/**
 * Declassify mode - slow dramatic reveal.
 */
export function DeclassifyRenderer({
  text,
  isStreaming = false,
  className,
}: {
  text: string
  isStreaming?: boolean
  className?: string
}) {
  return (
    <ScanlineMarkdownRenderer
      text={text}
      isStreaming={isStreaming}
      revealSpeed={200} // Slower for dramatic effect
      initialDelay={300}
      className={className}
    />
  )
}
