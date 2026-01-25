/**
 * DrillDownOverlay Component
 *
 * Level 3: Deep scan visualization overlay.
 *
 * @module file-browser/components/Actions
 */

import { memo, useEffect, useState } from 'react'
import { X, Activity, Lock, Cpu, FileText } from 'lucide-react'

import { DARK_SIDE } from '../../tokens'
import type { FileEntry } from '../../schemas'

// =============================================================================
// Types
// =============================================================================

export interface DrillDownOverlayProps {
  /** File being scanned */
  entry: FileEntry
  /** Is file locked/encrypted */
  isLocked?: boolean
  /** Is binary file */
  isBinary?: boolean
  /** Called when overlay should close */
  onClose: () => void
  /** Analysis text to display */
  analysisText?: string[]
  /** Additional CSS class */
  className?: string
}

// =============================================================================
// Component
// =============================================================================

export const DrillDownOverlay = memo(function DrillDownOverlay({
  entry,
  isLocked = false,
  isBinary = false,
  onClose,
  analysisText = [],
  className = '',
}: DrillDownOverlayProps) {
  const [rotation, setRotation] = useState(0)
  const [innerRotation, setInnerRotation] = useState(0)
  const [scanPosition, setScanPosition] = useState(0)
  const [scale, setScale] = useState(1)

  // Animation loops
  useEffect(() => {
    const interval = setInterval(() => {
      setRotation((r) => (r + 1) % 360)
      setInnerRotation((r) => (r - 1.5) % 360)
      setScanPosition((p) => (p + 1) % 100)
      setScale((s) => 1 + Math.sin(Date.now() / 500) * 0.05)
    }, 50)

    return () => clearInterval(interval)
  }, [])

  // Colors based on lock status
  const accentColor = isLocked
    ? DARK_SIDE.colors.accent.red
    : DARK_SIDE.colors.accent.green
  const glowColor = isLocked
    ? DARK_SIDE.colors.accent.redGlow
    : DARK_SIDE.colors.accent.greenGlow

  return (
    <div
      className={`drill-down-overlay ${className}`}
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.95)',
        backdropFilter: 'blur(8px)',
        zIndex: DARK_SIDE.zIndex.modal,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: DARK_SIDE.spacing['8'],
      }}
    >
      {/* Header */}
      <div
        style={{
          position: 'absolute',
          top: DARK_SIDE.spacing['8'],
          left: DARK_SIDE.spacing['8'],
          display: 'flex',
          alignItems: 'center',
          gap: DARK_SIDE.spacing['2'],
          fontSize: DARK_SIDE.typography.size.xs,
          fontFamily: DARK_SIDE.typography.family.mono,
          color: accentColor,
          letterSpacing: DARK_SIDE.typography.letterSpacing.wider,
        }}
      >
        <Activity size={16} style={{ animation: 'pulse 1s infinite' }} />
        DEEP_SCAN_ACTIVE // {entry.name}
      </div>

      {/* Close button */}
      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: DARK_SIDE.spacing['8'],
          right: DARK_SIDE.spacing['8'],
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: DARK_SIDE.colors.text.tertiary,
          padding: DARK_SIDE.spacing['2'],
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = DARK_SIDE.colors.text.primary
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = DARK_SIDE.colors.text.tertiary
        }}
      >
        <X size={24} />
      </button>

      {/* Central HUD */}
      <div
        style={{
          position: 'relative',
          width: '384px',
          height: '384px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Outer ring */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: `1px dashed ${accentColor}`,
            opacity: 0.3,
            transform: `rotate(${rotation}deg)`,
          }}
        />

        {/* Inner ring */}
        <div
          style={{
            position: 'absolute',
            inset: '48px',
            borderRadius: '50%',
            border: `1px dotted ${accentColor}`,
            opacity: 0.5,
            transform: `rotate(${innerRotation}deg)`,
          }}
        />

        {/* Scanning reticle */}
        <div
          style={{
            position: 'absolute',
            inset: '96px',
            borderRadius: '50%',
            border: `2px solid ${accentColor}`,
            transform: `scale(${scale})`,
            boxShadow: `0 0 20px ${glowColor}`,
          }}
        />

        {/* Central icon */}
        <div style={{ color: accentColor, zIndex: 1 }}>
          {isLocked ? (
            <Lock size={64} />
          ) : isBinary ? (
            <Cpu size={64} />
          ) : (
            <FileText size={64} />
          )}
        </div>

        {/* Scanning line */}
        <div
          style={{
            position: 'absolute',
            width: '100%',
            height: '2px',
            background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)`,
            top: `${scanPosition}%`,
            boxShadow: `0 0 15px ${glowColor}`,
            opacity: 0.5,
          }}
        />
      </div>

      {/* Analysis text */}
      {analysisText.length > 0 && (
        <div
          style={{
            marginTop: DARK_SIDE.spacing['8'],
            textAlign: 'center',
            maxWidth: '400px',
          }}
        >
          {analysisText.map((line, i) => (
            <div
              key={i}
              style={{
                fontSize: DARK_SIDE.typography.size.xs,
                fontFamily: DARK_SIDE.typography.family.mono,
                color:
                  i === analysisText.length - 1
                    ? accentColor
                    : DARK_SIDE.colors.text.tertiary,
                marginBottom: DARK_SIDE.spacing['1'],
                opacity: 0.8 + (i / analysisText.length) * 0.2,
              }}
            >
              {line}
            </div>
          ))}
        </div>
      )}

      {/* Animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  )
})
