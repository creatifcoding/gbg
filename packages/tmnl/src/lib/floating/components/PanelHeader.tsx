/**
 * PanelHeader
 *
 * Title bar for floating panels — Soft-Machine inspired chrome.
 * Tab-style title with close button, mode/maximize/minimize controls.
 *
 * @module
 */

import { memo, useCallback, type ReactNode } from 'react'
import { PANEL } from '../tokens'
import { ChromeBtn } from './ChromeBtn'
import {
  MinimizeIcon,
  CollapseIcon,
  ExpandIcon,
  MaximizeIcon,
  RestoreIcon,
} from './PanelIcons'

export interface PanelHeaderProps {
  title: string
  borderColor: string
  isMaximized: boolean
  mode: string | undefined
  closable: boolean
  minimizable: boolean
  onClose: () => void
  onMinimize: () => void
  onToggleMode: () => void
  onMaximizeToggle: () => void
  /** Activator ref for dnd-kit drag handle */
  activatorRef: React.Ref<HTMLDivElement>
  /** dnd-kit listener props */
  listeners: Record<string, any> | undefined
}

export const PanelHeader = memo(function PanelHeader({
  title,
  borderColor,
  isMaximized,
  mode,
  closable,
  minimizable,
  onClose,
  onMinimize,
  onToggleMode,
  onMaximizeToggle,
  activatorRef,
  listeners,
}: PanelHeaderProps) {
  return (
    <div
      ref={activatorRef}
      data-slot="panel-header"
      style={{
        display: 'flex',
        alignItems: 'stretch',
        height: PANEL.headerHeight,
        backgroundColor: PANEL.headerBg,
        borderBottom: `1px solid ${borderColor}`,
        flexShrink: 0,
        cursor: isMaximized ? 'default' : 'grab',
        userSelect: 'none' as const,
      }}
      onDoubleClick={onMaximizeToggle}
      {...listeners}
    >
      {/* Title tab */}
      <div style={{ display: 'flex', alignItems: 'center', maxWidth: '70%', minWidth: 0, paddingLeft: 8, paddingRight: 4 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            maxWidth: '100%',
            minWidth: 0,
            height: '100%',
            paddingInline: 10,
            borderLeft: `1px solid ${borderColor}`,
            borderRight: `1px solid ${borderColor}`,
            backgroundColor: PANEL.tabBg,
          }}
        >
          <span
            style={{
              fontFamily: 'var(--tmnl-font-mono, monospace)',
              fontSize: 'var(--tmnl-text-xs, 12px)',
              fontWeight: 500,
              color: PANEL.textStrong,
              letterSpacing: '0.01em',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap' as const,
              minWidth: 0,
            }}
          >
            {title}
          </span>
          {closable && (
            <button
              onClick={(e) => { e.stopPropagation(); onClose() }}
              aria-label="Close"
              title="Close"
              className="fp-panel-tab-close"
              style={{
                border: 'none',
                background: 'transparent',
                color: PANEL.btnIdle,
                width: 16,
                height: 16,
                lineHeight: '16px',
                fontSize: '12px',
                padding: 0,
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Controls */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 2, marginLeft: 'auto', paddingRight: 6 }}
        onClick={(e) => e.stopPropagation()}
      >
        <ChromeBtn onClick={(e) => { e.stopPropagation(); onToggleMode() }} label={mode === 'floating' ? 'Collapse' : 'Expand'}>
          {mode === 'floating' ? <CollapseIcon /> : <ExpandIcon />}
        </ChromeBtn>

        <ChromeBtn onClick={(e) => { e.stopPropagation(); onMaximizeToggle() }} label={isMaximized ? 'Restore' : 'Maximize'}>
          {isMaximized ? <RestoreIcon /> : <MaximizeIcon />}
        </ChromeBtn>

        {minimizable && (
          <ChromeBtn onClick={(e) => { e.stopPropagation(); onMinimize() }} label="Minimize">
            <MinimizeIcon />
          </ChromeBtn>
        )}
      </div>
    </div>
  )
})
