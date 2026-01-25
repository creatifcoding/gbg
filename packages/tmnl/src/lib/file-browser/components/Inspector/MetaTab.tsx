/**
 * MetaTab Component
 *
 * Level 3: Editable metadata (title, description, tags).
 *
 * @module file-browser/components/Inspector
 */

import { memo, useState, useCallback } from 'react'
import { FileText, Tag, X } from 'lucide-react'

import { DARK_SIDE } from '../../tokens'
import { CollapsibleSection, EditableField, KVRow } from '../../primitives'
import type { FileEntry } from '../../schemas'

// =============================================================================
// Types
// =============================================================================

export interface FileMeta {
  title?: string
  description?: string
  tags?: string[]
  version?: string
  license?: string
  creator?: string
}

export interface MetaTabProps {
  /** File entry */
  entry: FileEntry
  /** User metadata */
  meta?: FileMeta
  /** Called when metadata changes */
  onMetaChange?: (meta: FileMeta) => void
  /** Additional CSS class */
  className?: string
}

// =============================================================================
// Component
// =============================================================================

export const MetaTab = memo(function MetaTab({
  entry,
  meta = {},
  onMetaChange,
  className = '',
}: MetaTabProps) {
  const [newTag, setNewTag] = useState('')

  // Handle tag removal
  const handleRemoveTag = useCallback(
    (tagToRemove: string) => {
      const newTags = (meta.tags || []).filter((t) => t !== tagToRemove)
      onMetaChange?.({ ...meta, tags: newTags })
    },
    [meta, onMetaChange]
  )

  // Handle adding new tag
  const handleAddTag = useCallback(() => {
    if (!newTag.trim()) return
    const newTags = [...(meta.tags || []), newTag.trim()]
    onMetaChange?.({ ...meta, tags: newTags })
    setNewTag('')
  }, [meta, newTag, onMetaChange])

  // Format dates
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toISOString().split('T')[0]
  }

  return (
    <div className={`meta-tab ${className}`}>
      {/* Description Section */}
      <CollapsibleSection title="Description" icon={FileText} defaultOpen>
        <EditableField
          label="TITLE"
          value={meta.title || entry.name}
          onChange={(title) => onMetaChange?.({ ...meta, title })}
        />
        <EditableField
          label="DESCRIPTION"
          value={meta.description || 'No description available.'}
          multiline
          onChange={(description) => onMetaChange?.({ ...meta, description })}
        />
      </CollapsibleSection>

      {/* Tags & Attribution Section */}
      <CollapsibleSection title="Tags & Attribution" icon={Tag} defaultOpen>
        {/* Tags */}
        <div style={{ marginBottom: DARK_SIDE.spacing['3'] }}>
          <label
            style={{
              display: 'block',
              fontSize: '9px',
              color: DARK_SIDE.colors.text.tertiary,
              marginBottom: DARK_SIDE.spacing['1'],
              textTransform: 'uppercase',
            }}
          >
            TAGS
          </label>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: DARK_SIDE.spacing['1'],
              padding: DARK_SIDE.spacing['1'],
              borderBottom: `1px solid ${DARK_SIDE.colors.border.default}`,
              minHeight: '26px',
            }}
          >
            {(meta.tags || []).map((tag) => (
              <span
                key={tag}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: DARK_SIDE.spacing['1'],
                  fontSize: '9px',
                  background: DARK_SIDE.colors.surfaceActive,
                  color: DARK_SIDE.colors.text.secondary,
                  padding: DARK_SIDE.spacing['1'],
                  border: `1px solid ${DARK_SIDE.colors.border.default}`,
                }}
              >
                {tag}
                <X
                  size={8}
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleRemoveTag(tag)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = DARK_SIDE.colors.accent.red
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'inherit'
                  }}
                />
              </span>
            ))}
            <input
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleAddTag()
                }
              }}
              placeholder="+ add tag"
              style={{
                background: 'transparent',
                border: 'none',
                fontSize: '9px',
                color: DARK_SIDE.colors.text.tertiary,
                fontStyle: 'italic',
                outline: 'none',
                width: '60px',
              }}
            />
          </div>
        </div>

        {/* Version & License */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: DARK_SIDE.spacing['4'],
            marginTop: DARK_SIDE.spacing['2'],
          }}
        >
          <EditableField
            label="VERSION"
            value={meta.version || '1.0'}
            onChange={(version) => onMetaChange?.({ ...meta, version })}
          />
          <EditableField
            label="LICENSE"
            value={meta.license || 'None'}
            onChange={(license) => onMetaChange?.({ ...meta, license })}
          />
        </div>

        {/* Creator */}
        <EditableField
          label="CREATOR"
          value={meta.creator || 'SYSTEM'}
          onChange={(creator) => onMetaChange?.({ ...meta, creator })}
        />

        {/* Timestamps (read-only) */}
        <div
          style={{
            borderTop: `1px solid ${DARK_SIDE.colors.border.subtle}`,
            paddingTop: DARK_SIDE.spacing['2'],
            marginTop: DARK_SIDE.spacing['2'],
          }}
        >
          <KVRow label="CREATED" value={formatDate(entry.createdAt)} />
          <KVRow label="MODIFIED" value={formatDate(entry.modifiedAt)} />
        </div>
      </CollapsibleSection>
    </div>
  )
})
