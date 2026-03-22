/**
 * HexPreview Primitive
 *
 * Hex dump display with glitch aesthetics.
 *
 * @module file-browser/primitives
 */

import { memo, useMemo } from 'react'

import { DARK_SIDE } from '../tokens'

// =============================================================================
// Types
// =============================================================================

export interface HexPreviewProps {
  /** Hex string (space-separated bytes) */
  hex?: string
  /** Number of columns before line break */
  columns?: number
  /** Max height */
  maxHeight?: string
  /** Additional CSS class */
  className?: string
}

// =============================================================================
// Component
// =============================================================================

export const HexPreview = memo(function HexPreview({
  hex,
  columns = 8,
  maxHeight = '128px',
  className = '',
}: HexPreviewProps) {
  // Parse and format hex bytes
  const formattedBytes = useMemo(() => {
    if (!hex) return null

    const bytes = hex.split(' ')
    const lines: string[][] = []
    let currentLine: string[] = []

    bytes.forEach((byte, i) => {
      currentLine.push(byte)
      if ((i + 1) % columns === 0) {
        lines.push(currentLine)
        currentLine = []
      }
    })

    if (currentLine.length > 0) {
      lines.push(currentLine)
    }

    return lines
  }, [hex, columns])

  return (
    <div className={`hex-preview ${className}`}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '10px',
          color: DARK_SIDE.colors.text.tertiary,
          marginBottom: DARK_SIDE.spacing['2'],
        }}
      >
        <span>HEX_DUMP_PREVIEW</span>
        <span>0x00</span>
      </div>

      {/* Hex content */}
      <div
        style={{
          background: DARK_SIDE.colors.surfaceAlt,
          padding: DARK_SIDE.spacing['2'],
          border: `1px solid ${DARK_SIDE.colors.border.subtle}`,
          fontSize: '10px',
          fontFamily: DARK_SIDE.typography.family.mono,
          color: DARK_SIDE.colors.text.tertiary,
          lineHeight: DARK_SIDE.typography.lineHeight.tight,
          height: maxHeight,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {formattedBytes ? (
          formattedBytes.map((line, lineIdx) => (
            <div key={lineIdx}>
              {line.map((byte, byteIdx) => (
                <span
                  key={byteIdx}
                  style={{
                    // Random opacity for glitch effect
                    opacity: Math.random() > 0.8 ? 0.5 : 1,
                    marginRight: DARK_SIDE.spacing['1'],
                  }}
                >
                  {byte}
                </span>
              ))}
            </div>
          ))
        ) : (
          <span
            style={{
              color: DARK_SIDE.colors.text.muted,
              fontStyle: 'italic',
            }}
          >
            // NO DATA ACCESS
          </span>
        )}

        {/* Glitch overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: DARK_SIDE.colors.accent.greenGlow,
            pointerEvents: 'none',
            mixBlendMode: 'overlay',
            opacity: 0.05,
          }}
        />
      </div>
    </div>
  )
})
