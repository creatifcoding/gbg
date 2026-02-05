/**
 * ToolArgsFormatted
 *
 * Tool-specific argument formatting for better readability.
 * Handles bash, read, edit, write, grep, glob, and design tools.
 */

import * as React from 'react'
import { memo } from 'react'
import { SideBySideDiff } from './SideBySideDiff'
import {
  RVN_DARK,
  RVN_FONTS,
  RVN_FONT_SIZES,
  RVN_FONT_WEIGHTS,
  darkCodeBlockStyle,
} from './rvn-tokens'

// =============================================================================
// Types
// =============================================================================

export interface ToolArgsFormattedProps {
  /** Tool name (may include mcp__ prefix) */
  toolName: string
  /** Tool arguments */
  args: unknown
  /** Custom className */
  className?: string
  /** Custom style overrides */
  style?: React.CSSProperties
}

// =============================================================================
// Styles
// =============================================================================

const styles = {
  fieldRow: {
    display: 'flex',
    gap: '8px',
    marginBottom: '4px',
    alignItems: 'flex-start',
  },
  fieldLabel: {
    color: RVN_DARK.textSubtle,
    fontSize: RVN_FONT_SIZES.label,
    fontWeight: RVN_FONT_WEIGHTS.semibold,
    textTransform: 'uppercase' as const,
    minWidth: '70px',
    flexShrink: 0,
  },
  fieldValue: {
    color: RVN_DARK.text,
    fontSize: RVN_FONT_SIZES.label,
    fontFamily: RVN_FONTS.mono,
    wordBreak: 'break-all' as const,
  },
  pathBadge: {
    background: '#1a1a1a',
    padding: '2px 6px',
    border: `1px solid ${RVN_DARK.border}`,
    fontFamily: RVN_FONTS.mono,
    fontSize: RVN_FONT_SIZES.label,
    color: RVN_DARK.textBright,
  },
  codeBlock: {
    ...darkCodeBlockStyle,
    maxHeight: '120px',
  },
  diffLabel: {
    color: RVN_DARK.textSubtle,
    fontSize: RVN_FONT_SIZES.label,
    fontWeight: RVN_FONT_WEIGHTS.semibold,
    textTransform: 'uppercase' as const,
    marginBottom: '4px',
  },
} as const

// =============================================================================
// Helper Components
// =============================================================================

interface FieldRowProps {
  label: string
  value: unknown
  isCode?: boolean
  isPath?: boolean
}

function FieldRow({ label, value, isCode, isPath }: FieldRowProps) {
  const displayValue = String(value ?? '')

  return (
    <div style={styles.fieldRow}>
      <span style={styles.fieldLabel}>{label}</span>
      {isPath ? (
        <span style={styles.pathBadge}>{displayValue}</span>
      ) : isCode ? (
        <div style={styles.codeBlock}>{displayValue}</div>
      ) : (
        <span style={styles.fieldValue}>{displayValue}</span>
      )}
    </div>
  )
}

interface DiffBlockProps {
  oldContent: unknown
  newContent: unknown
}

function DiffBlock({ oldContent, newContent }: DiffBlockProps) {
  return (
    <div style={{ marginBottom: '8px' }}>
      <div style={styles.diffLabel}>DIFF</div>
      <SideBySideDiff
        oldText={String(oldContent ?? '')}
        newText={String(newContent ?? '')}
      />
    </div>
  )
}

interface GenericFieldsProps {
  args: Record<string, unknown>
}

function GenericFields({ args }: GenericFieldsProps) {
  return (
    <>
      {Object.entries(args).map(([key, value]) => (
        <FieldRow
          key={key}
          label={key.toUpperCase()}
          value={typeof value === 'object' ? JSON.stringify(value, null, 2) : value}
        />
      ))}
    </>
  )
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Normalize tool name (strip mcp__ prefix)
 */
function normalizeToolName(name: string): string {
  if (name.startsWith('mcp__')) {
    return name.split('__').slice(-1)[0]
  }
  return name.toLowerCase()
}

// =============================================================================
// Component
// =============================================================================

export const ToolArgsFormatted = memo(function ToolArgsFormatted({
  toolName,
  args,
  className,
  style,
}: ToolArgsFormattedProps) {
  const argsObj =
    typeof args === 'object' && args !== null
      ? (args as Record<string, unknown>)
      : {}

  const get = (key: string) => argsObj[key]
  const name = normalizeToolName(toolName)

  const content = (() => {
    switch (name) {
      case 'bash':
        return (
          <>
            <FieldRow label="COMMAND" value={get('command')} isCode />
            {get('cwd') && <FieldRow label="CWD" value={get('cwd')} isPath />}
            {get('timeout') && <FieldRow label="TIMEOUT" value={`${get('timeout')}ms`} />}
          </>
        )

      case 'read':
      case 'read_file':
        return (
          <>
            <FieldRow label="FILE" value={get('file_path') ?? get('path')} isPath />
            {(get('offset') || get('limit') || get('startLine') || get('endLine')) && (
              <FieldRow
                label="LINES"
                value={`${get('offset') ?? get('startLine') ?? 0}–${
                  Number(get('offset') ?? get('startLine') ?? 0) +
                  Number(get('limit') ?? get('endLine') ?? '∞')
                }`}
              />
            )}
          </>
        )

      case 'edit':
      case 'edit_file':
        return (
          <>
            <FieldRow label="FILE" value={get('file_path') ?? get('path')} isPath />
            <DiffBlock
              oldContent={get('old_string') ?? get('oldString')}
              newContent={get('new_string') ?? get('newString')}
            />
            {get('replace_all') && <FieldRow label="MODE" value="REPLACE ALL" />}
          </>
        )

      case 'write':
      case 'write_file':
        return (
          <>
            <FieldRow label="FILE" value={get('file_path') ?? get('path')} isPath />
            <FieldRow
              label="CONTENT"
              value={
                String(get('content') ?? '').slice(0, 200) +
                (String(get('content') ?? '').length > 200 ? '...' : '')
              }
              isCode
            />
          </>
        )

      case 'grep':
      case 'search_files':
        return (
          <>
            <FieldRow label="PATTERN" value={get('pattern') ?? get('query')} />
            {get('path') && <FieldRow label="PATH" value={get('path')} isPath />}
            {get('glob') && <FieldRow label="GLOB" value={get('glob')} />}
            {get('type') && <FieldRow label="TYPE" value={get('type')} />}
          </>
        )

      case 'glob':
      case 'list_files':
        return (
          <>
            <FieldRow label="PATTERN" value={get('pattern')} />
            {get('path') && <FieldRow label="PATH" value={get('path')} isPath />}
          </>
        )

      case 'apply_style':
      case 'suggest_prop':
      case 'modify_style':
        // Design tools - show all props
        return <GenericFields args={argsObj} />

      default:
        return <GenericFields args={argsObj} />
    }
  })()

  return (
    <div className={className} style={style}>
      {content}
    </div>
  )
})

export default ToolArgsFormatted
