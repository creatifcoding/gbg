/**
 * Shell & Search Renderers — bash, grep, find, ls tools.
 *
 * BashTool: command + terminal-style output
 * GrepTool: pattern + highlighted matches
 * FindTool: glob pattern + file list
 * LsTool: directory listing (tree-style)
 *
 * @module chat/msg/tool-block/renderers/shell-renderers
 */

import { memo, useState, useCallback, type FC } from 'react'
import { cn } from '@/lib/utils'
import { TerminalIcon, SearchIcon, FolderSearchIcon, FolderTreeIcon } from 'lucide-react'
import type { ToolRendererProps } from './registry'

// =============================================================================
// Helpers
// =============================================================================

function parseInput(input: unknown): Record<string, unknown> {
  if (typeof input === 'string') {
    try { return JSON.parse(input) } catch { return { raw: input } }
  }
  return (input as Record<string, unknown>) ?? {}
}

function extractText(output: unknown): string {
  if (output == null) return ''
  if (typeof output === 'string') return output
  const obj = output as Record<string, unknown>
  if (Array.isArray(obj.content)) {
    return obj.content
      .filter((c: any) => c.type === 'text')
      .map((c: any) => c.text)
      .join('\n')
  }
  if (typeof obj.text === 'string') return obj.text
  return JSON.stringify(output, null, 2)
}

// =============================================================================
// BashTool Renderer
// =============================================================================

export const BashToolRenderer: FC<ToolRendererProps> = memo(({
  input,
  output,
  errorText,
  state,
}) => {
  const params = parseInput(input)
  const command = (params.command as string) ?? ''
  const text = extractText(output)
  const [expanded, setExpanded] = useState(false)
  const toggle = useCallback(() => setExpanded((p) => !p), [])

  const lines = text.split('\n')
  const maxPreview = 20
  const needsTruncation = lines.length > maxPreview && !expanded

  return (
    <div className="px-3 pb-2 space-y-1.5" data-slot="tmnl-tool-renderer-bash">
      {/* Command line */}
      <div className="flex items-center gap-1.5">
        <TerminalIcon size={14} className="text-cyan-500 shrink-0" />
        <code className="font-mono text-cyan-300 truncate" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
          $ {command}
        </code>
      </div>

      {errorText && (
        <pre className="bg-red-500/5 border border-red-500/20 rounded p-2 text-red-400 font-mono overflow-x-auto" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
          {errorText}
        </pre>
      )}

      {/* Terminal output */}
      {text && state === 'completed' && !errorText && (
        <>
          <pre
            className="bg-neutral-950 border border-neutral-800 rounded p-2 text-neutral-400 font-mono overflow-x-auto"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)', maxHeight: expanded ? 'none' : '320px', overflowY: 'auto' }}
          >
            {needsTruncation ? lines.slice(0, maxPreview).join('\n') : text}
          </pre>
          {lines.length > maxPreview && (
            <button
              type="button"
              onClick={toggle}
              className="text-cyan-500 hover:text-cyan-400 font-mono transition-colors"
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              {expanded ? 'Collapse' : `Show ${lines.length - maxPreview} more lines`}
            </button>
          )}
        </>
      )}
    </div>
  )
})
BashToolRenderer.displayName = 'BashToolRenderer'

// =============================================================================
// GrepTool Renderer
// =============================================================================

export const GrepToolRenderer: FC<ToolRendererProps> = memo(({
  input,
  output,
  errorText,
  state,
}) => {
  const params = parseInput(input)
  const pattern = (params.pattern as string) ?? ''
  const path = (params.path as string) ?? '.'
  const text = extractText(output)
  const matchLines = text ? text.split('\n').filter(Boolean) : []

  return (
    <div className="px-3 pb-2 space-y-1.5" data-slot="tmnl-tool-renderer-grep">
      <div className="flex items-center gap-1.5">
        <SearchIcon size={14} className="text-violet-500 shrink-0" />
        <code className="font-mono text-violet-400" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
          /{pattern}/
        </code>
        {path !== '.' && (
          <span className="font-mono text-neutral-600" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
            in {path}
          </span>
        )}
        {state === 'completed' && (
          <span className="text-neutral-600 font-mono ml-auto" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
            {matchLines.length} match{matchLines.length !== 1 ? 'es' : ''}
          </span>
        )}
      </div>

      {errorText && (
        <pre className="bg-red-500/5 border border-red-500/20 rounded p-2 text-red-400 font-mono overflow-x-auto" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
          {errorText}
        </pre>
      )}

      {matchLines.length > 0 && state === 'completed' && (
        <pre
          className="bg-neutral-900/50 rounded p-2 text-neutral-400 font-mono overflow-x-auto max-h-64 overflow-y-auto"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          {matchLines.slice(0, 50).join('\n')}
          {matchLines.length > 50 && `\n... and ${matchLines.length - 50} more`}
        </pre>
      )}
    </div>
  )
})
GrepToolRenderer.displayName = 'GrepToolRenderer'

// =============================================================================
// FindTool Renderer
// =============================================================================

export const FindToolRenderer: FC<ToolRendererProps> = memo(({
  input,
  output,
  errorText,
  state,
}) => {
  const params = parseInput(input)
  const pattern = (params.pattern as string) ?? (params.glob as string) ?? ''
  const path = (params.path as string) ?? '.'
  const text = extractText(output)
  const files = text ? text.split('\n').filter(Boolean) : []

  return (
    <div className="px-3 pb-2 space-y-1.5" data-slot="tmnl-tool-renderer-find">
      <div className="flex items-center gap-1.5">
        <FolderSearchIcon size={14} className="text-amber-500 shrink-0" />
        <code className="font-mono text-amber-400" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
          {pattern}
        </code>
        {path !== '.' && (
          <span className="font-mono text-neutral-600" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
            in {path}
          </span>
        )}
        {state === 'completed' && (
          <span className="text-neutral-600 font-mono ml-auto" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
            {files.length} file{files.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {errorText && (
        <pre className="bg-red-500/5 border border-red-500/20 rounded p-2 text-red-400 font-mono overflow-x-auto" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
          {errorText}
        </pre>
      )}

      {files.length > 0 && state === 'completed' && (
        <div
          className="bg-neutral-900/50 rounded p-2 font-mono overflow-y-auto max-h-48 space-y-0.5"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          {files.slice(0, 100).map((f, i) => (
            <div key={i} className="text-neutral-400 truncate">{f}</div>
          ))}
          {files.length > 100 && (
            <div className="text-neutral-600">... and {files.length - 100} more</div>
          )}
        </div>
      )}
    </div>
  )
})
FindToolRenderer.displayName = 'FindToolRenderer'

// =============================================================================
// LsTool Renderer
// =============================================================================

export const LsToolRenderer: FC<ToolRendererProps> = memo(({
  input,
  output,
  errorText,
  state,
}) => {
  const params = parseInput(input)
  const path = (params.path as string) ?? '.'
  const text = extractText(output)
  const entries = text ? text.split('\n').filter(Boolean) : []

  return (
    <div className="px-3 pb-2 space-y-1.5" data-slot="tmnl-tool-renderer-ls">
      <div className="flex items-center gap-1.5">
        <FolderTreeIcon size={14} className="text-neutral-400 shrink-0" />
        <code className="font-mono text-neutral-300" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
          {path}
        </code>
        {state === 'completed' && (
          <span className="text-neutral-600 font-mono ml-auto" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
            {entries.length} entr{entries.length !== 1 ? 'ies' : 'y'}
          </span>
        )}
      </div>

      {errorText && (
        <pre className="bg-red-500/5 border border-red-500/20 rounded p-2 text-red-400 font-mono overflow-x-auto" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
          {errorText}
        </pre>
      )}

      {entries.length > 0 && state === 'completed' && (
        <pre
          className="bg-neutral-900/50 rounded p-2 text-neutral-400 font-mono overflow-x-auto max-h-48 overflow-y-auto"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          {entries.join('\n')}
        </pre>
      )}
    </div>
  )
})
LsToolRenderer.displayName = 'LsToolRenderer'
