/**
 * ToolResultFormatted
 *
 * Tool-specific result formatting for better readability.
 * Handles bash output, file operations, grep/glob results, etc.
 */

import * as React from 'react'
import { memo, useMemo } from 'react'
import {
  RVN_DARK,
  RVN_FONTS,
  RVN_FONT_SIZES,
  darkCodeBlockStyle,
} from './rvn-tokens'
import { RvnErrorDisplay } from './RvnErrorDisplay'

// =============================================================================
// Types
// =============================================================================

export interface ToolResultFormattedProps {
  /** Tool name (may include mcp__ prefix) */
  toolName: string
  /** Tool result */
  result: {
    isError?: boolean
    errorMessage?: string | null
    result?: unknown
  }
  /** Custom className */
  className?: string
  /** Custom style overrides */
  style?: React.CSSProperties
}

// =============================================================================
// Styles
// =============================================================================

const styles = {
  codeBlock: {
    ...darkCodeBlockStyle,
  },
  resultContent: {
    fontSize: RVN_FONT_SIZES.label,
    color: RVN_DARK.text,
    fontFamily: RVN_FONTS.mono,
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-all' as const,
    maxHeight: '150px',
    overflow: 'auto',
    background: RVN_DARK.bgSecondary,
    padding: '8px',
    border: `1px solid ${RVN_DARK.borderSubtle}`,
  },
  resultError: {
    color: '#f66',
    background: RVN_DARK.errorBg,
    border: `1px solid ${RVN_DARK.errorBorder}`,
  },
  pathBadge: {
    background: '#1a1a1a',
    padding: '2px 6px',
    border: `1px solid ${RVN_DARK.border}`,
    fontFamily: RVN_FONTS.mono,
    fontSize: RVN_FONT_SIZES.label,
    color: RVN_DARK.textBright,
    display: 'inline-block',
    marginBottom: '4px',
  },
  successMessage: {
    color: RVN_DARK.success,
    fontSize: RVN_FONT_SIZES.label,
    fontFamily: RVN_FONTS.mono,
    padding: '4px 0',
  },
  matchLine: {
    marginBottom: '4px',
  },
  matchCount: {
    color: RVN_DARK.textSubtle,
    marginTop: '4px',
  },
} as const

// =============================================================================
// Helpers
// =============================================================================

const MAX_DISPLAY_LENGTH = 1000

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + '...' : str
}

function normalizeToolName(name: string): string {
  if (name.startsWith('mcp__')) {
    return name.split('__').slice(-1)[0]
  }
  return name.toLowerCase()
}

// =============================================================================
// Component
// =============================================================================

export const ToolResultFormatted = memo(function ToolResultFormatted({
  toolName,
  result,
  className,
  style,
}: ToolResultFormattedProps) {
  const name = useMemo(() => normalizeToolName(toolName), [toolName])

  // Error display - use RvnErrorDisplay for structured XML parsing
  if (result.isError) {
    return (
      <RvnErrorDisplay
        errorMessage={result.errorMessage ?? String(result.result)}
        style={style}
        className={className}
      />
    )
  }

  const data = result.result

  const content = useMemo(() => {
    switch (name) {
      case 'bash':
        return <div style={styles.codeBlock}>{truncate(String(data ?? ''), MAX_DISPLAY_LENGTH)}</div>

      case 'read':
      case 'read_file': {
        const content =
          typeof data === 'object' && data && 'content' in data
            ? (data as { content: string }).content
            : data
        return <div style={styles.codeBlock}>{truncate(String(content ?? ''), 500)}</div>
      }

      case 'edit':
      case 'edit_file':
      case 'write':
      case 'write_file':
        return <div style={styles.successMessage}>{'\u2713'} FILE UPDATED</div>

      case 'grep':
      case 'search_files':
        if (Array.isArray(data)) {
          const matches = data as Array<{ path?: string; line?: number; content?: string }>
          return (
            <div style={styles.resultContent}>
              {matches.slice(0, 10).map((match, i) => (
                <div key={i} style={styles.matchLine}>
                  <span style={styles.pathBadge}>
                    {match.path}:{match.line}
                  </span>
                  <span style={{ marginLeft: '8px', color: RVN_DARK.textMuted }}>
                    {match.content}
                  </span>
                </div>
              ))}
              {matches.length > 10 && (
                <div style={styles.matchCount}>... and {matches.length - 10} more</div>
              )}
            </div>
          )
        }
        return <div style={styles.codeBlock}>{truncate(String(data ?? ''), 500)}</div>

      case 'glob':
      case 'list_files':
        if (Array.isArray(data)) {
          const files = data as string[]
          return (
            <div style={styles.resultContent}>
              {files.slice(0, 15).map((file, i) => (
                <div key={i} style={styles.pathBadge}>
                  {file}
                </div>
              ))}
              {files.length > 15 && (
                <div style={styles.matchCount}>... and {files.length - 15} more files</div>
              )}
            </div>
          )
        }
        return <div style={styles.codeBlock}>{truncate(String(data ?? ''), 500)}</div>

      default:
        // Generic: if object, show as formatted JSON; if string, as code block
        return (
          <div style={styles.resultContent}>
            {typeof data === 'object'
              ? truncate(JSON.stringify(data, null, 2), MAX_DISPLAY_LENGTH)
              : truncate(String(data ?? ''), MAX_DISPLAY_LENGTH)}
          </div>
        )
    }
  }, [name, data])

  return (
    <div className={className} style={style}>
      {content}
    </div>
  )
})

export default ToolResultFormatted
