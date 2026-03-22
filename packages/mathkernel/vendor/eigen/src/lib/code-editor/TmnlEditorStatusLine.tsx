/**
 * TmnlEditorStatusLine — Custom Status Bar
 *
 * Replaces Theia's status bar. Shows:
 * - Cursor position (Ln/Col)
 * - Language mode
 * - Encoding (UTF-8)
 * - LSP status indicator (phosphor green = connected, amber = connecting, rose = error)
 * - Indent mode (spaces/tabs + size)
 * - Vim mode indicator
 * - Selection count
 *
 * @module code-editor/TmnlEditorStatusLine
 */

import React from 'react'
import { useAtomValue } from '@effect-atom/atom-react'
import { VANTA_COLORS } from '@/components/portal/tokens'
import { statusLineAtom, editorConfigAtom } from './atoms'
import type { LspStatus, VimMode } from './schemas'

// =============================================================================
// LSP Status Indicator
// =============================================================================

const LSP_STATUS_COLORS: Record<LspStatus, string> = {
  connected: VANTA_COLORS.accent.emerald,
  connecting: VANTA_COLORS.accent.amber,
  disconnected: VANTA_COLORS.text.muted,
  error: VANTA_COLORS.accent.rose,
}

const LSP_STATUS_LABELS: Record<LspStatus, string> = {
  connected: 'LSP ●',
  connecting: 'LSP ◐',
  disconnected: 'LSP ○',
  error: 'LSP ✕',
}

function LspStatusIndicator({ status }: { status: LspStatus }) {
  return (
    <span
      style={{
        color: LSP_STATUS_COLORS[status],
        fontSize: 'var(--tmnl-text-xs, 12px)',
      }}
      title={`Language Server: ${status}`}
    >
      {LSP_STATUS_LABELS[status]}
    </span>
  )
}

// =============================================================================
// Vim Mode Badge
// =============================================================================

const VIM_MODE_COLORS: Record<VimMode, string> = {
  normal: VANTA_COLORS.accent.cyan,
  insert: VANTA_COLORS.accent.emerald,
  visual: VANTA_COLORS.accent.violet,
  replace: VANTA_COLORS.accent.rose,
  command: VANTA_COLORS.accent.amber,
}

function VimModeBadge({ mode }: { mode: VimMode }) {
  return (
    <span
      style={{
        color: VIM_MODE_COLORS[mode],
        fontFamily: '"Share Tech Mono", monospace',
        fontSize: 'var(--tmnl-text-xs, 12px)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}
    >
      -- {mode} --
    </span>
  )
}

// =============================================================================
// Status Line Segment
// =============================================================================

function Segment({
  children,
  title,
}: {
  children: React.ReactNode
  title?: string
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '0 8px',
        color: VANTA_COLORS.text.secondary,
        fontFamily: '"Share Tech Mono", monospace',
        fontSize: 'var(--tmnl-text-xs, 12px)',
        whiteSpace: 'nowrap',
        cursor: 'default',
      }}
      title={title}
    >
      {children}
    </span>
  )
}

function Divider() {
  return (
    <span
      style={{
        width: '1px',
        height: '12px',
        background: VANTA_COLORS.surface.border,
        flexShrink: 0,
      }}
    />
  )
}

// =============================================================================
// Status Line
// =============================================================================

export interface TmnlEditorStatusLineProps {
  /** Height of the status line */
  height?: number
}

export function TmnlEditorStatusLine({ height = 24 }: TmnlEditorStatusLineProps) {
  const statusResult = useAtomValue(statusLineAtom)
  const status =
    statusResult && 'value' in statusResult ? statusResult.value : null

  const configResult = useAtomValue(editorConfigAtom)
  const config =
    configResult && 'value' in configResult ? configResult.value : null

  if (!status) return null

  return (
    <div
      style={{
        height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: VANTA_COLORS.surface.void,
        borderTop: `1px solid ${VANTA_COLORS.surface.border}`,
        overflow: 'hidden',
        paddingLeft: '4px',
        paddingRight: '4px',
      }}
      data-tmnl-status-line
    >
      {/* Left side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
        {/* Vim mode */}
        {status.vimMode && (
          <>
            <VimModeBadge mode={status.vimMode} />
            <Divider />
          </>
        )}

        {/* Cursor position */}
        <Segment title="Cursor position">
          Ln {status.cursor.line}, Col {status.cursor.column}
        </Segment>

        {/* Selection count */}
        {status.selectionCount > 0 && (
          <>
            <Divider />
            <Segment title="Selected characters">
              ({status.selectionCount} selected)
            </Segment>
          </>
        )}
      </div>

      {/* Right side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
        {/* Language */}
        <Segment title="Language mode">{status.language}</Segment>
        <Divider />

        {/* Encoding */}
        <Segment title="File encoding">{status.encoding}</Segment>
        <Divider />

        {/* Indent */}
        <Segment title="Indentation">
          {status.indentStyle === 'spaces' ? 'Spaces' : 'Tabs'}: {status.tabSize}
        </Segment>
        <Divider />

        {/* LSP Status */}
        <Segment>
          <LspStatusIndicator status={status.lspStatus} />
        </Segment>
      </div>
    </div>
  )
}

export default TmnlEditorStatusLine
