/**
 * Tool Header Metas — small components rendered inline in the collapsed
 * tool-block header. Each tool decides what contextual metadata to surface.
 *
 * Registered via registerToolHeaderMeta(). The header renders whichever
 * meta component matches the tool name — no fixed schema.
 *
 * @module chat/msg/tool-block/renderers/header-metas
 */

import { memo, useMemo, type FC } from 'react'
import { cn } from '@/lib/utils'
import type { ToolRendererProps } from './registry'

// =============================================================================
// Shared helpers
// =============================================================================

function parseInput(input: unknown): Record<string, unknown> {
  if (input == null) return {}
  if (typeof input === 'string') {
    try { return parseInput(JSON.parse(input)) } catch { return { raw: input } }
  }
  const obj = input as Record<string, unknown>
  if (obj.arguments && typeof obj.arguments === 'object' && !Array.isArray(obj.arguments)) {
    return obj.arguments as Record<string, unknown>
  }
  return obj
}

/** Last two path segments: dir + filename */
function shortPath(full: string): string {
  const parts = full.replace(/\\/g, '/').split('/')
  if (parts.length <= 2) return full
  return parts.slice(-2).join('/')
}

function countLines(text: string): number {
  return text.split('\n').length
}

// =============================================================================
// Pill — reusable micro-badge
// =============================================================================

function MetaPill({ children, color = 'neutral' }: {
  children: React.ReactNode
  color?: 'cyan' | 'amber' | 'emerald' | 'violet' | 'red' | 'neutral'
}) {
  const border = {
    cyan: 'border-cyan-500/10 bg-cyan-500/[0.04] text-cyan-500/50',
    amber: 'border-amber-500/10 bg-amber-500/[0.04] text-amber-500/50',
    emerald: 'border-emerald-500/10 bg-emerald-500/[0.04] text-emerald-500/50',
    violet: 'border-violet-500/10 bg-violet-500/[0.04] text-violet-500/50',
    red: 'border-red-500/10 bg-red-500/[0.04] text-red-500/50',
    neutral: 'border-neutral-700/30 bg-neutral-800/20 text-neutral-500/60',
  }[color]

  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 px-1.5 py-px rounded-sm border font-mono tabular-nums',
        border,
      )}
      style={{ fontSize: '10px', letterSpacing: '0.02em' }}
    >
      {children}
    </span>
  )
}

// =============================================================================
// ReadTool — path · line range
// =============================================================================

export const ReadHeaderMeta: FC<ToolRendererProps> = memo(({ input }) => {
  const params = parseInput(input)
  const filePath = (params.path as string) ?? (params.file_path as string) ?? ''
  const offset = typeof params.offset === 'number' ? params.offset : undefined
  const limit = typeof params.limit === 'number' ? params.limit : undefined

  if (!filePath) return null

  const rangeLabel = useMemo(() => {
    if (offset == null) return undefined
    if (limit != null) return `L${offset}–${offset + limit - 1}`
    return `L${offset}+`
  }, [offset, limit])

  return (
    <span className="inline-flex items-center gap-1.5 min-w-0">
      <span className="font-mono text-cyan-500/40 truncate" style={{ fontSize: '10px' }}>
        {shortPath(filePath)}
      </span>
      {rangeLabel && <MetaPill color="cyan">{rangeLabel}</MetaPill>}
    </span>
  )
})
ReadHeaderMeta.displayName = 'ReadHeaderMeta'

// =============================================================================
// WriteTool — path
// =============================================================================

export const WriteHeaderMeta: FC<ToolRendererProps> = memo(({ input }) => {
  const params = parseInput(input)

  // Resolve path from parsed args or partial inputDelta while generating
  const rawDelta = (input as any)?.inputDelta as string | undefined
  let filePath = (params.path as string) ?? (params.file_path as string) ?? ''
  if (!filePath && rawDelta) {
    const m = rawDelta.match(/"(?:path|file_path)"\s*:\s*"((?:[^"\\]|\\.)*)"/)
    if (m) filePath = m[1]
  }

  if (!filePath) return null

  return (
    <span className="font-mono text-emerald-500/40 truncate" style={{ fontSize: '10px' }}>
      {shortPath(filePath)}
    </span>
  )
})
WriteHeaderMeta.displayName = 'WriteHeaderMeta'

// =============================================================================
// EditTool — path · scope pill (NL → ML)
// =============================================================================

export const EditHeaderMeta: FC<ToolRendererProps> = memo(({ input }) => {
  const params = parseInput(input)
  const filePath = (params.path as string) ?? (params.file_path as string) ?? ''
  const oldText = (params.oldText as string) ?? (params.old_text as string) ?? ''
  const newText = (params.newText as string) ?? (params.new_text as string) ?? ''

  if (!filePath) return null

  const scope = useMemo(() => {
    const oldLines = oldText ? countLines(oldText) : 0
    const newLines = newText ? countLines(newText) : 0
    if (oldLines === 0 && newLines === 0) return undefined
    return { oldLines, newLines, isResize: oldLines !== newLines }
  }, [oldText, newText])

  return (
    <span className="inline-flex items-center gap-1.5 min-w-0">
      <span className="font-mono text-amber-500/40 truncate" style={{ fontSize: '10px' }}>
        {shortPath(filePath)}
      </span>
      {scope && (
        <MetaPill color="amber">
          {scope.isResize ? (
            <>
              <span className="text-red-400/50">{scope.oldLines}L</span>
              <span className="text-neutral-700 mx-px">›</span>
              <span className="text-emerald-400/50">{scope.newLines}L</span>
            </>
          ) : (
            <span>{scope.oldLines}L</span>
          )}
        </MetaPill>
      )}
    </span>
  )
})
EditHeaderMeta.displayName = 'EditHeaderMeta'

// =============================================================================
// BashTool — command
// =============================================================================

export const BashHeaderMeta: FC<ToolRendererProps> = memo(({ input }) => {
  const params = parseInput(input)
  let command = (params.command as string) ?? ''

  // Partial extraction from streaming delta
  if (!command && params.inputDelta) {
    const delta = params.inputDelta as string
    try {
      command = (JSON.parse(delta) as any).command ?? ''
    } catch {
      const m = delta.match(/"command"\s*:\s*"((?:[^"\\]|\\.)*)"?/)
      if (m) command = m[1].replace(/\\n/g, ' ').replace(/\\"/g, '"').replace(/\\\\/g, '\\')
    }
  }

  if (!command) return null

  // Truncate long commands — just the first segment
  const short = command.length > 60 ? command.slice(0, 57) + '…' : command

  return (
    <span className="font-mono text-cyan-400/30 truncate" style={{ fontSize: '10px' }}>
      $ {short}
    </span>
  )
})
BashHeaderMeta.displayName = 'BashHeaderMeta'

// =============================================================================
// GrepTool — /pattern/ · path
// =============================================================================

export const GrepHeaderMeta: FC<ToolRendererProps> = memo(({ input }) => {
  const params = parseInput(input)
  const pattern = (params.pattern as string) ?? ''
  const path = (params.path as string) ?? ''

  if (!pattern) return null

  return (
    <span className="inline-flex items-center gap-1.5 min-w-0">
      <span className="font-mono text-violet-400/40 truncate" style={{ fontSize: '10px' }}>
        /{pattern.length > 30 ? pattern.slice(0, 27) + '…' : pattern}/
      </span>
      {path && path !== '.' && (
        <span className="font-mono text-neutral-600 truncate" style={{ fontSize: '10px' }}>
          {shortPath(path)}
        </span>
      )}
    </span>
  )
})
GrepHeaderMeta.displayName = 'GrepHeaderMeta'

// =============================================================================
// FindTool — pattern · path
// =============================================================================

export const FindHeaderMeta: FC<ToolRendererProps> = memo(({ input }) => {
  const params = parseInput(input)
  const pattern = (params.pattern as string) ?? (params.glob as string) ?? ''
  const path = (params.path as string) ?? ''

  if (!pattern) return null

  return (
    <span className="inline-flex items-center gap-1.5 min-w-0">
      <span className="font-mono text-amber-400/40 truncate" style={{ fontSize: '10px' }}>
        {pattern}
      </span>
      {path && path !== '.' && (
        <span className="font-mono text-neutral-600 truncate" style={{ fontSize: '10px' }}>
          {shortPath(path)}
        </span>
      )}
    </span>
  )
})
FindHeaderMeta.displayName = 'FindHeaderMeta'

// =============================================================================
// LsTool — path
// =============================================================================

export const LsHeaderMeta: FC<ToolRendererProps> = memo(({ input }) => {
  const params = parseInput(input)
  const path = (params.path as string) ?? ''

  if (!path || path === '.') return null

  return (
    <span className="font-mono text-neutral-400/40 truncate" style={{ fontSize: '10px' }}>
      {shortPath(path)}
    </span>
  )
})
LsHeaderMeta.displayName = 'LsHeaderMeta'
