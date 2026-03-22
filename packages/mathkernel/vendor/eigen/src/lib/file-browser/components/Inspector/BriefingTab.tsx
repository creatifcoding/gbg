/**
 * BriefingTab Component
 *
 * Level 3: Quick overview with file preview, hash, and status.
 *
 * @module file-browser/components/Inspector
 */

import { memo } from 'react'
import { Folder, FileBox, ShieldAlert } from 'lucide-react'

import { DARK_SIDE } from '../../tokens'
import { KVRow, HexPreview } from '../../primitives'
import type { FileEntry } from '../../schemas'
import type { FileMetadata } from '../../schemas/file-metadata'

// =============================================================================
// Types
// =============================================================================

export interface BriefingTabProps {
  /** File entry */
  entry: FileEntry
  /** Extended metadata (optional) */
  metadata?: FileMetadata
  /** Is file encrypted/locked */
  isLocked?: boolean
  /** Additional CSS class */
  className?: string
}

// =============================================================================
// Component
// =============================================================================

export const BriefingTab = memo(function BriefingTab({
  entry,
  metadata,
  isLocked = false,
  className = '',
}: BriefingTabProps) {
  // Determine accent color based on lock status
  const accentColor = isLocked
    ? DARK_SIDE.colors.accent.red
    : DARK_SIDE.colors.accent.green

  return (
    <div
      className={`briefing-tab ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        padding: DARK_SIDE.spacing['4'],
      }}
    >
      {/* Preview Box */}
      <div
        style={{
          height: '160px',
          border: `1px solid ${DARK_SIDE.colors.border.subtle}`,
          background: DARK_SIDE.colors.surfaceAlt,
          marginBottom: DARK_SIDE.spacing['6'],
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        {/* Shimmer overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(45deg, transparent 25%, rgba(255,255,255,0.02) 50%, transparent 75%, transparent 100%)',
            backgroundSize: '250% 250%',
            animation: 'shimmer 3s infinite',
          }}
        />

        {/* Icon */}
        {entry.type === 'directory' ? (
          <Folder size={64} color={DARK_SIDE.colors.text.muted} />
        ) : isLocked ? (
          <ShieldAlert size={64} color={DARK_SIDE.colors.accent.redMuted} />
        ) : (
          <FileBox size={64} color={DARK_SIDE.colors.accent.greenMuted} />
        )}

        {/* Encrypted overlay */}
        {isLocked && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0, 0, 0, 0.8)',
              backdropFilter: 'blur(4px)',
              border: `1px solid ${DARK_SIDE.colors.accent.redMuted}`,
            }}
          >
            <span
              style={{
                color: DARK_SIDE.colors.accent.red,
                fontSize: DARK_SIDE.typography.size.xs,
                fontWeight: DARK_SIDE.typography.weight.bold,
                letterSpacing: DARK_SIDE.typography.letterSpacing.wider,
                border: `1px solid ${DARK_SIDE.colors.accent.red}`,
                padding: `${DARK_SIDE.spacing['1']} ${DARK_SIDE.spacing['2']}`,
                transform: 'rotate(-12deg)',
              }}
            >
              ENCRYPTED
            </span>
          </div>
        )}

        {/* Glitch overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: accentColor,
            opacity: 0.02,
            pointerEvents: 'none',
            mixBlendMode: 'overlay',
          }}
        />
      </div>

      {/* Quick Stats Grid */}
      <div style={{ marginBottom: DARK_SIDE.spacing['6'] }}>
        <KVRow label="FILENAME" value={entry.name} highlight mono={false} />
        <KVRow
          label="HASH"
          value={metadata?.hash?.value?.slice(0, 16) + '...' || '—'}
        />
        <KVRow
          label="OWNER"
          value={metadata?.uid?.toString() || 'USER'}
          highlight={metadata?.uid === 0}
        />
        <KVRow
          label="STATUS"
          value={isLocked ? 'LOCKED' : 'READY'}
          highlight={!isLocked}
        />
      </div>

      {/* Hex Dump Preview (at bottom) */}
      <div style={{ marginTop: 'auto' }}>
        <HexPreview
          hex={metadata?.magicBytes?.headerHex}
          columns={8}
          maxHeight="128px"
        />
      </div>

      {/* Shimmer animation keyframes */}
      <style>{`
        @keyframes shimmer {
          0% { background-position: 0% 0%; }
          100% { background-position: 100% 100%; }
        }
      `}</style>
    </div>
  )
})
