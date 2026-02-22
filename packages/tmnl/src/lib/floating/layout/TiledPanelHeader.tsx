/**
 * TiledPanelHeader — MorphChat frame-chrome style header bar.
 *
 * @module floating/layout/TiledPanelHeader
 */

import { memo, useCallback } from 'react'
import { setPanelCollapsed } from '../stx/actions'
import { PANEL } from '../tokens'
import { ChromeButton } from './ChromeButton'

const ICON_SIZE = 14
const ICON_STROKE = 1.5

export const TiledPanelHeader = memo(function TiledPanelHeader({
  id,
  title,
  accent,
  headerHidden,
  onFloat,
}: {
  id: string
  title: string
  accent?: string
  headerHidden: boolean
  onFloat?: (id: string) => void
}) {
  if (headerHidden) return null

  const handleFloat = useCallback(() => onFloat?.(id), [id, onFloat])
  const handleCollapse = useCallback(() => setPanelCollapsed(id, true), [id])

  return (
    <div
      data-slot="tiled-panel-header"
      style={{
        display: 'flex',
        alignItems: 'center',
        height: PANEL.headerHeight,
        background: PANEL.headerBg,
        borderBottom: `1px solid ${PANEL.border}`,
        borderTop: accent ? `2px solid ${accent}` : undefined,
        flexShrink: 0,
        cursor: 'grab',
        userSelect: 'none',
        gap: 6,
        paddingLeft: 8,
        paddingRight: 6,
      }}
    >
      {/* Grip — 6-dot pattern, muted */}
      <svg
        width="8" height="14" viewBox="0 0 8 14"
        fill={PANEL.btnIdle}
        style={{ flexShrink: 0, opacity: 0.5 }}
      >
        <circle cx="2" cy="2" r="1" />
        <circle cx="6" cy="2" r="1" />
        <circle cx="2" cy="7" r="1" />
        <circle cx="6" cy="7" r="1" />
        <circle cx="2" cy="12" r="1" />
        <circle cx="6" cy="12" r="1" />
      </svg>

      {/* Title — font-mono tracking-wider uppercase (MorphChat DNA) */}
      <span
        style={{
          flex: 1,
          fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
          fontSize: 'var(--tmnl-text-xs, 12px)',
          fontWeight: 500,
          color: PANEL.text,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}
      >
        {title}
      </span>

      {/* Chrome buttons */}
      <div style={{ display: 'flex', gap: 1, alignItems: 'center', flexShrink: 0 }}>
        <ChromeButton title="Collapse" onClick={handleCollapse}>
          <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={ICON_STROKE} strokeLinecap="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </ChromeButton>

        {onFloat && (
          <ChromeButton title="Float as window" onClick={handleFloat}>
            <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={ICON_STROKE} strokeLinecap="round">
              <polyline points="15 3 21 3 21 9" />
              <polyline points="9 21 3 21 3 15" />
              <line x1="21" y1="3" x2="14" y2="10" />
              <line x1="3" y1="21" x2="10" y2="14" />
            </svg>
          </ChromeButton>
        )}
      </div>
    </div>
  )
})
