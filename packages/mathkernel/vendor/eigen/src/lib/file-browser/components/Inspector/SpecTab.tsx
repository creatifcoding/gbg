/**
 * SpecTab Component
 *
 * Level 3: Technical specifications (type, permissions, inode, etc.).
 *
 * @module file-browser/components/Inspector
 */

import { memo } from 'react'
import { Info, MapPin, Database, Link as LinkIcon, Layers } from 'lucide-react'

import { DARK_SIDE } from '../../tokens'
import { CollapsibleSection, KVRow, Chip } from '../../primitives'
import type { FileEntry } from '../../schemas'
import type { FileMetadata } from '../../schemas/file-metadata'

// =============================================================================
// Types
// =============================================================================

export interface FileRelation {
  type: string
  target: string
}

export interface SpecTabProps {
  /** File entry */
  entry: FileEntry
  /** Extended metadata */
  metadata?: FileMetadata
  /** File flags (e.g., ENCRYPTED, HIDDEN) */
  flags?: string[]
  /** File relations (dependencies, symlinks, etc.) */
  relations?: FileRelation[]
  /** Is file locked/encrypted */
  isLocked?: boolean
  /** Additional CSS class */
  className?: string
}

// =============================================================================
// Component
// =============================================================================

export const SpecTab = memo(function SpecTab({
  entry,
  metadata,
  flags = [],
  relations = [],
  isLocked = false,
  className = '',
}: SpecTabProps) {
  const accentColor = isLocked
    ? DARK_SIDE.colors.accent.red
    : DARK_SIDE.colors.text.secondary

  // Format permissions
  const perms = entry.permissions
    ? `${entry.permissions.readable ? 'r' : '-'}${entry.permissions.writable ? 'w' : '-'}${entry.permissions.executable ? 'x' : '-'}`
    : metadata?.modeRwx || '---'

  return (
    <div className={`spec-tab ${className}`}>
      {/* Core Info Section */}
      <CollapsibleSection title="Core Info" icon={Info} defaultOpen color={accentColor}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: DARK_SIDE.spacing['4'],
            marginBottom: DARK_SIDE.spacing['3'],
            paddingBottom: DARK_SIDE.spacing['3'],
            borderBottom: `1px solid ${DARK_SIDE.colors.border.subtle}`,
          }}
        >
          <div>
            <KVRow label="TYPE" value={entry.type.toUpperCase()} highlight />
            <KVRow label="PERMS" value={metadata?.modeRwx || perms} />
          </div>
          <div>
            <KVRow label="SIZE" value={entry.formattedSize} highlight />
            <KVRow
              label="OWNER"
              value={`${metadata?.uid ?? 'USER'}:${metadata?.gid ?? 'GROUP'}`}
            />
          </div>
        </div>

        {/* Inode info grid */}
        <div style={{ marginBottom: DARK_SIDE.spacing['3'] }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: DARK_SIDE.spacing['2'],
              fontSize: '9px',
              color: DARK_SIDE.colors.text.tertiary,
              marginBottom: DARK_SIDE.spacing['1'],
            }}
          >
            <span>INODE</span>
            <span>LINKS</span>
            <span>DEVICE</span>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: DARK_SIDE.spacing['2'],
              fontSize: '10px',
              color: DARK_SIDE.colors.text.secondary,
              fontFamily: DARK_SIDE.typography.family.mono,
            }}
          >
            <span>{metadata?.inode ?? '—'}</span>
            <span>{metadata?.nlink ?? 1}</span>
            <span>{metadata?.device ? `0x${metadata.device.toString(16)}` : '—'}</span>
          </div>
        </div>
      </CollapsibleSection>

      {/* Location & Flags Section */}
      <CollapsibleSection title="Location & Flags" icon={MapPin} defaultOpen>
        {/* Full path */}
        <div style={{ marginBottom: DARK_SIDE.spacing['3'] }}>
          <span
            style={{
              display: 'block',
              fontSize: '9px',
              color: DARK_SIDE.colors.text.tertiary,
              marginBottom: DARK_SIDE.spacing['1'],
            }}
          >
            FULL PATH
          </span>
          <div
            style={{
              fontSize: '10px',
              color: DARK_SIDE.colors.text.secondary,
              fontFamily: DARK_SIDE.typography.family.mono,
              wordBreak: 'break-all',
              lineHeight: DARK_SIDE.typography.lineHeight.tight,
            }}
          >
            {entry.path}
          </div>
        </div>

        <KVRow label="MOUNT" value="/dev/sda1" />

        {/* Flags */}
        <div style={{ marginTop: DARK_SIDE.spacing['3'], marginBottom: DARK_SIDE.spacing['3'] }}>
          <span
            style={{
              display: 'block',
              fontSize: '9px',
              color: DARK_SIDE.colors.text.tertiary,
              marginBottom: DARK_SIDE.spacing['1'],
            }}
          >
            FLAGS
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap' }}>
            {flags.length > 0 ? (
              flags.map((flag) => (
                <Chip
                  key={flag}
                  label={flag}
                  color={flag === 'ENCRYPTED' || flag === 'HIDDEN' ? 'red' : 'blue'}
                />
              ))
            ) : (
              <span
                style={{
                  fontSize: '10px',
                  color: DARK_SIDE.colors.text.muted,
                }}
              >
                NONE
              </span>
            )}
          </div>
        </div>

        <KVRow label="ACL" value="Standard" />
      </CollapsibleSection>

      {/* Structure Section */}
      <CollapsibleSection title="Structure" icon={Database} defaultOpen>
        {/* Relations */}
        {relations.length > 0 ? (
          <div style={{ marginBottom: DARK_SIDE.spacing['4'] }}>
            <span
              style={{
                display: 'block',
                fontSize: '9px',
                color: DARK_SIDE.colors.text.tertiary,
                marginBottom: DARK_SIDE.spacing['2'],
              }}
            >
              RELATIONSHIPS
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: DARK_SIDE.spacing['1'] }}>
              {relations.map((rel, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: DARK_SIDE.spacing['2'],
                    fontSize: '10px',
                    cursor: 'pointer',
                    padding: DARK_SIDE.spacing['1'],
                    border: '1px solid transparent',
                    transition: `all ${DARK_SIDE.animation.duration.fast}`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = DARK_SIDE.colors.surfaceHover
                    e.currentTarget.style.borderColor = DARK_SIDE.colors.border.default
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.borderColor = 'transparent'
                  }}
                >
                  <LinkIcon size={10} color={DARK_SIDE.colors.text.tertiary} />
                  <span
                    style={{
                      color: DARK_SIDE.colors.text.tertiary,
                      textTransform: 'uppercase',
                    }}
                  >
                    {rel.type}:
                  </span>
                  <span
                    style={{
                      color: DARK_SIDE.colors.accent.greenMuted,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {rel.target}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div
            style={{
              fontSize: '10px',
              color: DARK_SIDE.colors.text.muted,
              fontStyle: 'italic',
              marginBottom: DARK_SIDE.spacing['4'],
            }}
          >
            No known relations.
          </div>
        )}

        {/* File structure (for structured files) */}
        {metadata?.structure && (
          <div
            style={{
              border: `1px solid ${DARK_SIDE.colors.border.subtle}`,
              background: DARK_SIDE.colors.surfaceAlt,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: DARK_SIDE.colors.surfaceHover,
                padding: `${DARK_SIDE.spacing['1']} ${DARK_SIDE.spacing['2']}`,
                fontSize: '9px',
                color: DARK_SIDE.colors.text.tertiary,
                borderBottom: `1px solid ${DARK_SIDE.colors.border.subtle}`,
              }}
            >
              <span>INTERNAL STRUCTURE ({metadata.structure.format.toUpperCase()})</span>
              <Layers size={10} />
            </div>
            <div
              style={{
                padding: DARK_SIDE.spacing['2'],
                fontFamily: DARK_SIDE.typography.family.mono,
                fontSize: '10px',
                color: DARK_SIDE.colors.text.secondary,
              }}
            >
              <div style={{ display: 'flex', gap: DARK_SIDE.spacing['2'] }}>
                <span style={{ color: DARK_SIDE.colors.text.tertiary, width: '60px' }}>
                  elements:
                </span>
                <span>{metadata.structure.elementCount ?? '—'}</span>
              </div>
              <div style={{ display: 'flex', gap: DARK_SIDE.spacing['2'] }}>
                <span style={{ color: DARK_SIDE.colors.text.tertiary, width: '60px' }}>
                  depth:
                </span>
                <span>{metadata.structure.depth ?? '—'}</span>
              </div>
              {metadata.structure.schemaId && (
                <div style={{ display: 'flex', gap: DARK_SIDE.spacing['2'] }}>
                  <span style={{ color: DARK_SIDE.colors.text.tertiary, width: '60px' }}>
                    schema:
                  </span>
                  <span>{metadata.structure.schemaId}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </CollapsibleSection>
    </div>
  )
})
