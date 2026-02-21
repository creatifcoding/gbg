/**
 * Shell & Search Renderers — bash, grep, find, ls tools.
 *
 * BashTool: command + restty terminal (streaming) or static fallback
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
import { TerminalOutput } from './terminal'
import { useToolStream } from './terminal/use-tool-stream'

// =============================================================================
// Helpers
// =============================================================================

function parseInput(input: unknown): Record<string, unknown> {
  if (input == null) return {}
  if (typeof input === 'string') {
    try { return parseInput(JSON.parse(input)) } catch { return { raw: input } }
  }
  const obj = input as Record<string, unknown>
  // Unwrap SDK envelope: { arguments: {...} }
  if (obj.arguments && typeof obj.arguments === 'object' && !Array.isArray(obj.arguments)) {
    return obj.arguments as Record<string, unknown>
  }
  return obj
}

function extractText(output: unknown): string {
  if (output == null) return ''
  if (typeof output === 'string') return output

  // Direct array: [{ type: 'text', text: '...' }]
  if (Array.isArray(output)) {
    const textParts = output.filter((c: any) => c?.type === 'text')
    if (textParts.length > 0) return textParts.map((c: any) => c.text ?? '').join('\n')
    return JSON.stringify(output, null, 2)
  }

  const obj = output as Record<string, unknown>
  // End payload: { result: [...] }
  if (Array.isArray(obj.result)) {
    const textParts = obj.result.filter((c: any) => c?.type === 'text')
    if (textParts.length > 0) return textParts.map((c: any) => c.text ?? '').join('\n')
  }
  // Legacy: { content: [...] }
  if (Array.isArray(obj.content)) {
    return obj.content
      .filter((c: any) => c?.type === 'text')
      .map((c: any) => c.text ?? '')
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
  toolCallId,
}) => {
  const params = parseInput(input)
  // Try inputDelta for streaming command during LLM generation
  let command = (params.command as string) ?? ''
  if (!command && params.inputDelta) {
    const delta = params.inputDelta as string
    try {
      const parsed = JSON.parse(delta)
      command = parsed.command ?? ''
    } catch {
      // Extract command from partial JSON
      const m = delta.match(/"command"\s*:\s*"((?:[^"\\]|\\.)*)"?/)
      if (m) command = m[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\')
    }
  }
  const text = extractText(output)
  const stream = useToolStream(toolCallId)

  // Determine rendering mode:
  // 1. Streaming data exists → restty terminal (live or replayed)
  // 2. No stream data + completed → static fallback
  const useTerminal = stream.hasData || state === 'running'

  return (
    <div className="px-3 pb-2 space-y-1.5" data-slot="tmnl-tool-renderer-bash">
      {/* Command line */}
      <div className="flex items-center gap-1.5">
        <TerminalIcon size={14} className="text-cyan-500 shrink-0" />
        <code className="font-mono text-cyan-300 truncate" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
          $ {command}
        </code>
        {stream.isStreaming && (
          <span className="text-cyan-500/60 font-mono ml-auto" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
            {(stream.totalBytes / 1024).toFixed(1)} KB · {stream.chunkCount} chunks
          </span>
        )}
      </div>

      {errorText && (
        <pre className="bg-red-500/5 border border-red-500/20 rounded p-2 text-red-400 font-mono overflow-x-auto" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
          {errorText}
        </pre>
      )}

      {/* restty terminal (streaming or replay) */}
      {useTerminal && !errorText && (
        <TerminalOutput
          pendingChunk={stream.pendingChunk}
          ledger={stream.ledger}
          streaming={stream.isStreaming}
          content={!stream.hasData && text ? text : undefined}
          maxHeight={400}
          fontSize={13}
        />
      )}

      {/* Static fallback for completed tools without streaming data */}
      {!useTerminal && text && state === 'completed' && !errorText && (
        <TerminalOutput
          content={text}
          streaming={false}
          maxHeight={400}
          fontSize={13}
        />
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

      {matchLines.length > 0 && (
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

      {files.length > 0 && (
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

      {entries.length > 0 && (
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
