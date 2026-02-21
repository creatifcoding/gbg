/**
 * File Operation Renderers — read, write, edit tools.
 *
 * ReadTool: file path + content preview (syntax highlighted via code block)
 * WriteTool: file path + content preview (shows what's being written)
 * EditTool: @pierre/diffs powered diff view — split or stacked, shiki highlighted
 *
 * @module chat/msg/tool-block/renderers/file-renderers
 */

import { memo, useState, useCallback, useMemo, useEffect, useRef, lazy, Suspense, type FC } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { SortedMap } from 'effect'
import { cn } from '@/lib/utils'
import { FileIcon, FileEditIcon, FilePlusIcon, ChevronDown, ChevronRight } from 'lucide-react'
import type { ToolRendererProps } from './registry'
import { useToolStream } from './terminal/use-tool-stream'
import { useThrottledHighlight, detectLanguage, resolveFileParts } from '../../shared/use-throttled-highlight'

// =============================================================================
// Helpers
// =============================================================================

/**
 * Parse tool input — unwraps SDK envelope.
 *
 * Engine sends two shapes:
 *   - Flat arguments: { path: "...", content: "..." }
 *   - Wrapped: { arguments: { path: "..." }, diagnostics: {...} }
 * We always want the flat arguments for renderers.
 */
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
  // Already flat arguments
  return obj
}

/**
 * Parse tool output — handles multiple SDK result formats.
 *
 * Engine sends end payload as:
 *   - Array: [{ type: 'text', text: '...' }]         (SDK tool result content)
 *   - Object: { result: [...], isError, executionMs }  (full end payload)
 *   - Object: { content: [...] }                       (legacy)
 *   - String: raw text
 */
function parseOutput(output: unknown): { text: string; truncated?: boolean; isError?: boolean } {
  if (output == null) return { text: '' }
  if (typeof output === 'string') return { text: output }

  // Direct content array: [{ type: 'text', text: '...' }]
  if (Array.isArray(output)) {
    const textParts = output.filter((c: any) => c?.type === 'text')
    if (textParts.length > 0) {
      return { text: textParts.map((c: any) => c.text ?? '').join('\n') }
    }
    return { text: JSON.stringify(output, null, 2) }
  }

  const obj = output as Record<string, unknown>

  // End payload: { result: [{ type: 'text', text: '...' }], isError, executionMs }
  if (Array.isArray(obj.result)) {
    const textParts = obj.result.filter((c: any) => c?.type === 'text')
    if (textParts.length > 0) {
      return {
        text: textParts.map((c: any) => c.text ?? '').join('\n'),
        isError: obj.isError === true,
      }
    }
  }

  // Legacy: { content: [{ type: 'text', text: '...' }] }
  if (Array.isArray(obj.content)) {
    const textParts = obj.content.filter((c: any) => c?.type === 'text')
    return {
      text: textParts.map((c: any) => c.text ?? '').join('\n'),
      truncated: obj.truncated === true,
    }
  }

  if (typeof obj.text === 'string') return { text: obj.text }
  return { text: JSON.stringify(output, null, 2) }
}

function countLines(text: string): number {
  return text.split('\n').length
}

function estimateBytes(text: string): string {
  const bytes = new Blob([text]).size
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Reconstruct full text from stream ledger (SortedMap<seq, ToolStreamLine>).
 * Each line has a `.chunk` string. Concatenates in seq order.
 */
function ledgerToText(ledger: SortedMap.SortedMap<number, { chunk: string }>): string {
  const chunks: string[] = []
  for (const [, line] of SortedMap.entries(ledger)) {
    chunks.push(line.chunk)
  }
  return chunks.join('')
}

/**
 * Try to extract a field from partial JSON (for streaming tool arguments).
 * Falls back to regex extraction if JSON.parse fails on incomplete input.
 */
function extractFieldFromPartialJson(json: string, field: string): string | undefined {
  // Try full parse first
  try {
    const obj = JSON.parse(json)
    return typeof obj[field] === 'string' ? obj[field] : undefined
  } catch { /* partial JSON */ }
  // Regex extraction for string fields: "field":"value..." or "field": "value..."
  // Handle escaped quotes within the value
  const pattern = new RegExp(`"${field}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)("?)`)
  const match = json.match(pattern)
  if (match) {
    // Unescape JSON string escapes
    try {
      return JSON.parse(`"${match[1]}${match[2] ? '' : ''}"`)
    } catch {
      return match[1].replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"').replace(/\\\\/g, '\\')
    }
  }
  return undefined
}

// =============================================================================
// ReadTool Renderer — incremental streaming via sidecar
// =============================================================================

export const ReadToolRenderer: FC<ToolRendererProps> = memo(({
  input,
  output,
  errorText,
  state,
  toolCallId,
}) => {
  const params = parseInput(input)
  const filePath = (params.path as string) ?? (params.file_path as string) ?? '(unknown)'
  const { dir, filename } = resolveFileParts(filePath)
  const language = detectLanguage(filePath)
  const { text: finalContent, truncated } = parseOutput(output)
  const stream = useToolStream(toolCallId)
  const shouldReduceMotion = useReducedMotion()

  // Line range params (offset is 1-indexed start line, limit is max lines)
  const offset = typeof params.offset === 'number' ? params.offset : undefined
  const limit = typeof params.limit === 'number' ? params.limit : undefined

  const [expanded, setExpanded] = useState(false)
  const toggle = useCallback(() => setExpanded((p) => !p), [])

  // Prefer stream data while running, fall back to final output when complete
  const streamText = useMemo(
    () => stream.hasData ? ledgerToText(stream.ledger) : '',
    [stream.hasData, stream.ledger],
  )
  const content = finalContent || streamText
  const isStreaming = stream.isStreaming || state === 'running'

  const lines = countLines(content)
  const previewLines = 14
  const needsTruncation = lines > previewLines && !expanded

  // Line range badge text: "L42–56" or "L42+" or nothing
  const lineRangeLabel = useMemo(() => {
    if (offset == null) return undefined
    if (limit != null) return `L${offset}–${offset + limit - 1}`
    return `L${offset}+`
  }, [offset, limit])

  // Throttled syntax highlighting — works during streaming
  const displayCode = needsTruncation
    ? content.split('\n').slice(0, previewLines).join('\n')
    : content
  const highlightedHtml = useThrottledHighlight(displayCode, language, isStreaming)

  return (
    <div className="px-3 pb-2 space-y-1.5" data-slot="tmnl-tool-renderer-read">
      {/* ── Path row: icon · dir/filename · [range pill] ─────── */}
      <div className="flex items-center gap-1.5 min-h-[22px]">
        <FileIcon size={13} strokeWidth={1.5} className="text-cyan-500/70 shrink-0" />
        <span className="font-mono truncate min-w-0" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
          {dir && <span className="text-neutral-600">{dir}</span>}
          <span className="text-cyan-400/90">{filename}</span>
        </span>

        {/* Line range pill — contained, subordinate to filename */}
        {lineRangeLabel && (
          <span
            className={cn(
              'inline-flex items-center shrink-0 px-1.5 py-px rounded-sm',
              'border border-cyan-500/10 bg-cyan-500/[0.04]',
              'font-mono tabular-nums text-cyan-500/50',
            )}
            style={{ fontSize: '10px', letterSpacing: '0.02em' }}
          >
            {lineRangeLabel}
          </span>
        )}

        {/* ── Right cluster: lang · streaming/stats ── */}
        <div className="flex items-center gap-2 ml-auto shrink-0">
          {language !== 'text' && (
            <span
              className="text-neutral-700/80 font-mono uppercase tracking-wider"
              style={{ fontSize: '9px', letterSpacing: '0.08em' }}
            >
              {language}
            </span>
          )}
          {isStreaming && (
            <motion.span
              initial={shouldReduceMotion ? undefined : { opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-1.5 text-cyan-500/50 font-mono tabular-nums"
              style={{ fontSize: '10px' }}
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-500 opacity-30" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-cyan-500/80" />
              </span>
              {stream.chunkCount > 0 && estimateBytes(content)}
            </motion.span>
          )}
          {state === 'completed' && (
            <span
              className="text-neutral-600/80 font-mono tabular-nums"
              style={{ fontSize: '10px' }}
            >
              {lines}L · {estimateBytes(content)}
            </span>
          )}
        </div>
      </div>

      {/* Error */}
      <AnimatePresence>
        {errorText && (
          <motion.pre
            initial={shouldReduceMotion ? undefined : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-red-500/[0.03] border border-red-500/10 rounded-md p-2 text-red-400/90 font-mono overflow-x-auto"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            {errorText}
          </motion.pre>
        )}
      </AnimatePresence>

      {/* Content — syntax highlighted, streams incrementally */}
      <AnimatePresence>
        {content && (
          <motion.div
            initial={shouldReduceMotion ? undefined : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
            className={cn(
              'rounded-md border overflow-hidden',
              isStreaming ? 'border-cyan-500/10' : 'border-neutral-900',
            )}
            style={{ background: '#000' }}
          >
            {highlightedHtml ? (
              <div
                className={cn(
                  'overflow-auto',
                  '[&>pre]:m-0 [&>pre]:bg-transparent! [&>pre]:p-2.5',
                  '[&_code]:font-mono',
                )}
                style={{
                  fontSize: 'var(--tmnl-text-xs, 12px)',
                  maxHeight: expanded ? 'none' : '280px',
                }}
                dangerouslySetInnerHTML={{ __html: highlightedHtml }}
              />
            ) : (
              <pre
                className="m-0 p-2.5 text-neutral-400 font-mono overflow-auto bg-transparent"
                style={{
                  fontSize: 'var(--tmnl-text-xs, 12px)',
                  maxHeight: expanded ? 'none' : '280px',
                }}
              >
                <code>{displayCode}</code>
              </pre>
            )}
            {isStreaming && (
              <div className="px-2.5 pb-1">
                <span className="inline-block text-cyan-400 animate-pulse font-mono" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
                  ▌
                </span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Truncation toggle */}
      {lines > previewLines && !isStreaming && (
        <motion.button
          type="button"
          onClick={toggle}
          whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
          className="text-cyan-600/70 hover:text-cyan-400/90 font-mono transition-colors"
          style={{ fontSize: '10px', letterSpacing: '0.01em' }}
        >
          {expanded ? '▴ Collapse' : `▾ ${lines - previewLines} more lines`}
        </motion.button>
      )}
      {truncated && (
        <span
          className={cn(
            'inline-flex items-center px-1.5 py-px rounded-sm',
            'border border-amber-500/10 bg-amber-500/[0.03]',
            'text-amber-500/50 font-mono',
          )}
          style={{ fontSize: '9px', letterSpacing: '0.06em' }}
        >
          TRUNCATED
        </span>
      )}
    </div>
  )
})
ReadToolRenderer.displayName = 'ReadToolRenderer'

// =============================================================================
// WriteTool Renderer
// =============================================================================

export const WriteToolRenderer: FC<ToolRendererProps> = memo(({
  input,
  output,
  errorText,
  state,
  toolCallId,
}) => {
  const params = parseInput(input)
  const rawDelta = (input as any)?.inputDelta as string | undefined

  // Resolve path from complete args OR partial inputDelta while LLM is still generating.
  const partialPath = useMemo(() => {
    if (!rawDelta) return ''
    return extractFieldFromPartialJson(rawDelta, 'path')
      ?? extractFieldFromPartialJson(rawDelta, 'file_path')
      ?? ''
  }, [rawDelta])

  const filePath = (params.path as string)
    ?? (params.file_path as string)
    ?? partialPath
    ?? '(unknown)'

  const { dir, filename } = resolveFileParts(filePath)
  const language = detectLanguage(filePath)
  const shouldReduceMotion = useReducedMotion()

  // Content from fully-parsed input (available after LLM finishes generating tool block)
  const fullContent = (params.content as string) ?? ''

  // Partial content from streaming inputDelta (while LLM is still generating)
  const partialContent = useMemo(() => {
    if (fullContent || !rawDelta) return ''
    return extractFieldFromPartialJson(rawDelta, 'content') ?? ''
  }, [fullContent, rawDelta])

  const content = fullContent || partialContent
  const isGenerating = !fullContent && !!partialContent
  const isRunning = state === 'running' || state === 'pending'
  const lines = countLines(content)
  const [expanded, setExpanded] = useState(false)
  const toggle = useCallback(() => setExpanded((p) => !p), [])

  // Tail-follow viewport (pi-like): when expanded + streaming, keep bottom pinned.
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const [tailFollow, setTailFollow] = useState(true)

  const previewLines = 12
  const canExpand = content.length > 0 && (lines > previewLines || isGenerating || isRunning)
  const needsTruncation = lines > previewLines && !expanded
  const displayCode = needsTruncation
    ? content.split('\n').slice(0, previewLines).join('\n')
    : content

  // Throttled syntax highlighting — works during streaming
  const highlightedHtml = useThrottledHighlight(displayCode, language, isGenerating || isRunning)

  useEffect(() => {
    if (!expanded || !(isGenerating || isRunning) || !tailFollow) return
    const el = viewportRef.current
    if (!el) return
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight
    })
  }, [expanded, isGenerating, isRunning, tailFollow, content, highlightedHtml])

  const handleViewportScroll = useCallback(() => {
    const el = viewportRef.current
    if (!el) return
    const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 24
    setTailFollow(nearBottom)
  }, [])

  return (
    <div className="px-3 pb-2 space-y-1.5" data-slot="tmnl-tool-renderer-write">
      {/* ── Path row: icon · dir/filename ── */}
      <div className="flex items-center gap-1.5 min-h-[22px]">
        <FilePlusIcon size={13} strokeWidth={1.5} className="text-emerald-500/70 shrink-0" />
        <span className="font-mono truncate min-w-0" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
          {dir && <span className="text-neutral-600">{dir}</span>}
          <span className="text-emerald-400/90">{filename}</span>
        </span>

        {/* ── Right cluster: lang · streaming/stats ── */}
        <div className="flex items-center gap-2 ml-auto shrink-0">
          {language !== 'text' && (
            <span
              className="text-neutral-700/80 font-mono uppercase tracking-wider"
              style={{ fontSize: '9px', letterSpacing: '0.08em' }}
            >
              {language}
            </span>
          )}
          {(isGenerating || isRunning) && (
            <motion.span
              initial={shouldReduceMotion ? undefined : { opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-1.5 text-emerald-500/50 font-mono"
              style={{ fontSize: '10px' }}
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-30" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500/80" />
              </span>
              {isGenerating ? 'generating' : 'writing'}
            </motion.span>
          )}
          {content && !isGenerating && !isRunning && (
            <span
              className="text-neutral-600/80 font-mono tabular-nums"
              style={{ fontSize: '10px' }}
            >
              {lines}L · {estimateBytes(content)}
            </span>
          )}
          <AnimatePresence mode="wait">
            {state === 'completed' && !errorText && (
              <motion.span
                key="done"
                initial={shouldReduceMotion ? undefined : { opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                className="flex items-center gap-1 text-emerald-500/60 font-mono"
                style={{ fontSize: '10px' }}
              >
                <motion.svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                  <motion.path
                    d="M2.5 6L5 8.5L9.5 3.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={shouldReduceMotion ? undefined : { pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.4, delay: 0.1, ease: 'easeOut' }}
                  />
                </motion.svg>
                written
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {errorText && (
          <motion.pre
            initial={shouldReduceMotion ? undefined : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-red-500/[0.03] border border-red-500/10 rounded-md p-2 text-red-400/90 font-mono overflow-x-auto"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            {errorText}
          </motion.pre>
        )}
      </AnimatePresence>

      {/* Content — syntax highlighted, streams incrementally as LLM generates */}
      <AnimatePresence>
        {content && (
          <motion.div
            initial={shouldReduceMotion ? undefined : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
            className={cn(
              'rounded-md border overflow-hidden',
              isGenerating ? 'border-emerald-500/10' :
              isRunning ? 'border-emerald-500/10' :
              'border-neutral-900',
            )}
            style={{ background: '#000' }}
          >
            {highlightedHtml ? (
              <div
                ref={viewportRef}
                onScroll={handleViewportScroll}
                className={cn(
                  'overflow-auto',
                  '[&>pre]:m-0 [&>pre]:bg-transparent! [&>pre]:p-2.5',
                  '[&_code]:font-mono',
                )}
                style={{
                  fontSize: 'var(--tmnl-text-xs, 12px)',
                  maxHeight: expanded ? '60vh' : '220px',
                }}
                dangerouslySetInnerHTML={{ __html: highlightedHtml }}
              />
            ) : (
              <pre
                ref={viewportRef}
                onScroll={handleViewportScroll}
                className="m-0 p-2.5 text-neutral-400 font-mono overflow-auto bg-transparent"
                style={{
                  fontSize: 'var(--tmnl-text-xs, 12px)',
                  maxHeight: expanded ? '60vh' : '220px',
                }}
              >
                <code>{displayCode}</code>
              </pre>
            )}
            {(isGenerating || isRunning) && (
              <div className="px-2.5 pb-1 flex items-center justify-between">
                <span className="inline-block text-emerald-400 animate-pulse font-mono" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
                  ▌
                </span>
                {expanded && (
                  <span className="text-neutral-600 font-mono" style={{ fontSize: '11px' }}>
                    {tailFollow ? 'tailing' : 'paused'}
                  </span>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expand / truncation toggle */}
      {canExpand && (
        <motion.button
          type="button"
          onClick={toggle}
          whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
          className="text-emerald-600/70 hover:text-emerald-400/90 font-mono transition-colors"
          style={{ fontSize: '10px', letterSpacing: '0.01em' }}
        >
          {expanded
            ? '▴ Collapse'
            : needsTruncation
              ? `▾ ${Math.max(lines - previewLines, 0)} more lines`
              : '▾ Expand tail'}
        </motion.button>
      )}
    </div>
  )
})
WriteToolRenderer.displayName = 'WriteToolRenderer'

// =============================================================================
// EditTool Renderer — @pierre/diffs, vantablack, motion-animated
// =============================================================================

import { tmnlDiffStyle, tmnlDiffUnsafeCSS } from './diff/tmnl-diff-theme'

const LazyMultiFileDiff = lazy(() =>
  import('@pierre/diffs/react').then((mod) => ({ default: mod.MultiFileDiff }))
)

/** Compute diff stats: additions, deletions */
function diffStats(oldText: string, newText: string): { additions: number; deletions: number } {
  const oldLines = oldText.split('\n')
  const newLines = newText.split('\n')
  const oldSet = new Set(oldLines)
  const newSet = new Set(newLines)
  let additions = 0
  let deletions = 0
  for (const line of newLines) if (!oldSet.has(line)) additions++
  for (const line of oldLines) if (!newSet.has(line)) deletions++
  return { additions, deletions }
}

// ── Motion config ─────────────────────────────────────────────────────────
// Emil Kowalski: ease-out default, under 300ms, asymmetric timing

const EASE_OUT: [number, number, number, number] = [0.32, 0.72, 0, 1]   // iOS-style
const EASE_SPRING = { type: 'spring' as const, stiffness: 400, damping: 30, mass: 0.8 }

const diffRevealVariants = {
  collapsed: {
    height: 0,
    opacity: 0,
    scale: 0.98,
    filter: 'blur(4px)',
  },
  expanded: {
    height: 'auto',
    opacity: 1,
    scale: 1,
    filter: 'blur(0px)',
    transition: {
      height: { duration: 0.25, ease: EASE_OUT },
      opacity: { duration: 0.2, delay: 0.05, ease: 'easeOut' },
      scale: { duration: 0.2, ease: EASE_OUT },
      filter: { duration: 0.2, delay: 0.03 },
    },
  },
  exit: {
    height: 0,
    opacity: 0,
    scale: 0.98,
    filter: 'blur(4px)',
    transition: {
      height: { duration: 0.2, ease: EASE_OUT },        // fast exit (asymmetric)
      opacity: { duration: 0.12, ease: 'easeIn' },
      scale: { duration: 0.15, ease: EASE_OUT },
      filter: { duration: 0.1 },
    },
  },
}

const summaryBarVariants = {
  hidden: { opacity: 0, y: -4, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.2, ease: EASE_OUT },
  },
  exit: {
    opacity: 0,
    y: 4,
    scale: 0.97,
    transition: { duration: 0.12, ease: 'easeIn' },
  },
}

const statsVariants = {
  hidden: { opacity: 0, x: -6 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: 0.1 + i * 0.05, duration: 0.2, ease: EASE_OUT },
  }),
}

const statusVariants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: EASE_SPRING,
  },
}

const errorBannerVariants = {
  hidden: { opacity: 0, height: 0, y: -8 },
  visible: {
    opacity: 1,
    height: 'auto',
    y: 0,
    transition: {
      height: { duration: 0.25, ease: EASE_OUT },
      opacity: { duration: 0.2, delay: 0.05 },
      y: { duration: 0.2, ease: EASE_OUT },
    },
  },
  exit: {
    opacity: 0,
    height: 0,
    y: -4,
    transition: { duration: 0.15, ease: 'easeIn' },
  },
}

export const EditToolRenderer: FC<ToolRendererProps> = memo(({
  input,
  output,
  errorText,
  state,
}) => {
  const params = parseInput(input)
  const filePath = (params.path as string) ?? (params.file_path as string) ?? '(unknown)'
  const { dir, filename } = resolveFileParts(filePath)
  const oldText = (params.oldText as string) ?? (params.old_text as string) ?? ''
  const newText = (params.newText as string) ?? (params.new_text as string) ?? ''
  const [showDiff, setShowDiff] = useState(true)
  const toggleDiff = useCallback(() => setShowDiff((p) => !p), [])
  const [diffStyle, setDiffStyle] = useState<'unified' | 'split'>('unified')
  const toggleStyle = useCallback(() => setDiffStyle((p) => p === 'unified' ? 'split' : 'unified'), [])

  const shouldReduceMotion = useReducedMotion()

  const language = detectLanguage(filePath)
  const stats = useMemo(() => diffStats(oldText, newText), [oldText, newText])

  // Edit scope — structured old/new line counts for pill rendering
  const editScope = useMemo(() => {
    const oldLines = oldText ? countLines(oldText) : 0
    const newLines = newText ? countLines(newText) : 0
    if (oldLines === 0 && newLines === 0) return undefined
    return { oldLines, newLines, isResize: oldLines !== newLines }
  }, [oldText, newText])

  const oldFile = useMemo(() => ({
    filename: filePath,
    contents: oldText,
    language,
  }), [filePath, oldText, language])

  const newFile = useMemo(() => ({
    filename: filePath,
    contents: newText,
    language,
  }), [filePath, newText, language])

  const diffOptions = useMemo(() => ({
    diffStyle,
    diffIndicators: 'bars' as const,
    lineDiffType: 'word' as const,
    theme: 'one-dark-pro' as const,
    themeType: 'dark' as const,
    overflow: 'scroll' as const,
    disableFileHeader: true,
    expandUnchanged: true,
    expansionLineCount: 3,
    unsafeCSS: tmnlDiffUnsafeCSS,
  }), [diffStyle])

  const hasContent = oldText || newText
  const isRunning = state === 'running' || state === 'pending'

  return (
    <div className="px-3 pb-2 space-y-1" data-slot="tmnl-tool-renderer-edit">
      {/* ── Header bar ─────────────────────────────────── */}
      <div className="flex items-center gap-1.5 min-h-[24px]">
        <FileEditIcon size={13} strokeWidth={1.5} className="text-amber-500/70 shrink-0" />
        <span className="font-mono truncate min-w-0" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
          {dir && <span className="text-neutral-600">{dir}</span>}
          <span className="text-amber-400/90">{filename}</span>
        </span>

        {/* Edit scope pill — structured line count transformation */}
        {editScope && (
          <span
            className={cn(
              'inline-flex items-center shrink-0 gap-0.5 px-1.5 py-px rounded-sm',
              'border border-amber-500/10 bg-amber-500/[0.04]',
              'font-mono tabular-nums',
            )}
            style={{ fontSize: '10px', letterSpacing: '0.02em' }}
          >
            {editScope.isResize ? (
              <>
                <span className="text-red-400/50">{editScope.oldLines}L</span>
                <span className="text-neutral-700 mx-px">›</span>
                <span className="text-emerald-400/50">{editScope.newLines}L</span>
              </>
            ) : (
              <span className="text-amber-500/40">{editScope.oldLines}L</span>
            )}
          </span>
        )}

        {/* ── Diff stats — staggered entrance ─── */}
        <AnimatePresence>
          {hasContent && !isRunning && (
            <div className="flex items-center gap-1 ml-1">
              {stats.additions > 0 && (
                <motion.span
                  key="add"
                  custom={0}
                  variants={shouldReduceMotion ? undefined : statsVariants}
                  initial="hidden"
                  animate="visible"
                  className="font-mono text-emerald-400/60 tabular-nums"
                  style={{ fontSize: '10px' }}
                >
                  +{stats.additions}
                </motion.span>
              )}
              {stats.deletions > 0 && (
                <motion.span
                  key="del"
                  custom={1}
                  variants={shouldReduceMotion ? undefined : statsVariants}
                  initial="hidden"
                  animate="visible"
                  className="font-mono text-red-400/60 tabular-nums"
                  style={{ fontSize: '10px' }}
                >
                  −{stats.deletions}
                </motion.span>
              )}
            </div>
          )}
        </AnimatePresence>

        {/* ── Controls — whisper-level, recede from path ─── */}
        <div className="flex items-center gap-0.5 ml-auto shrink-0">
          {hasContent && (
            <>
              <motion.button
                type="button"
                onClick={toggleStyle}
                whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
                className={cn(
                  'px-1.5 py-0.5 rounded font-mono transition-colors duration-150',
                  'hover:bg-white/[0.03]',
                  diffStyle === 'split' ? 'text-cyan-500/60' : 'text-neutral-700',
                )}
                style={{ fontSize: '10px' }}
                title={diffStyle === 'unified' ? 'Split view' : 'Unified view'}
              >
                {diffStyle === 'unified' ? '⫽ split' : '≡ unified'}
              </motion.button>

              <motion.button
                type="button"
                onClick={toggleDiff}
                whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
                className={cn(
                  'flex items-center gap-0.5 px-1.5 py-0.5 rounded font-mono transition-colors duration-150',
                  'hover:bg-white/[0.03]',
                  showDiff ? 'text-neutral-600' : 'text-neutral-700',
                )}
                style={{ fontSize: '10px' }}
              >
                <motion.div
                  animate={{ rotate: showDiff ? 0 : -90 }}
                  transition={{ duration: 0.15, ease: EASE_OUT }}
                >
                  <ChevronDown size={10} />
                </motion.div>
                diff
              </motion.button>
            </>
          )}

          {/* ── Status indicator ─── */}
          <AnimatePresence mode="wait">
            {isRunning && (
              <motion.span
                key="running"
                variants={shouldReduceMotion ? undefined : statusVariants}
                initial="hidden"
                animate="visible"
                exit="hidden"
                className="flex items-center gap-1.5 text-amber-500/70 font-mono ml-1.5"
                style={{ fontSize: '10px' }}
              >
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-30" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500/80" />
                </span>
                editing
              </motion.span>
            )}
            {state === 'completed' && !errorText && (
              <motion.span
                key="done"
                variants={shouldReduceMotion ? undefined : statusVariants}
                initial="hidden"
                animate="visible"
                className="flex items-center gap-1 text-emerald-500/60 font-mono ml-1.5"
                style={{ fontSize: '10px' }}
              >
                <motion.svg
                  width="11" height="11" viewBox="0 0 12 12" fill="none"
                  initial={shouldReduceMotion ? undefined : { pathLength: 0 }}
                  animate={shouldReduceMotion ? undefined : { pathLength: 1 }}
                  transition={{ duration: 0.3, delay: 0.1, ease: 'easeOut' }}
                >
                  <motion.path
                    d="M2.5 6L5 8.5L9.5 3.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={shouldReduceMotion ? undefined : { pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.4, delay: 0.15, ease: 'easeOut' }}
                  />
                </motion.svg>
                applied
              </motion.span>
            )}
            {state === 'error' && (
              <motion.span
                key="error"
                variants={shouldReduceMotion ? undefined : statusVariants}
                initial="hidden"
                animate="visible"
                className="text-red-500/70 font-mono ml-1.5"
                style={{ fontSize: '10px' }}
              >
                ✗ failed
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Error banner — animated entrance ───────────── */}
      <AnimatePresence>
        {errorText && (
          <motion.div
            variants={shouldReduceMotion ? undefined : errorBannerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="bg-red-500/[0.03] border border-red-500/10 rounded-md p-2.5 text-red-400/90 font-mono overflow-x-auto"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            <div className="flex items-center gap-1.5 mb-1 text-red-500/70" style={{ fontSize: '11px' }}>
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="0.8" />
                <path d="M6 3.5V6.5M6 8V8.5" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" />
              </svg>
              Error
            </div>
            <pre className="whitespace-pre-wrap break-words">{errorText}</pre>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Diff view — animated expand/collapse ───────── */}
      <AnimatePresence mode="wait" initial={false}>
        {showDiff && hasContent && (
          <motion.div
            key={`diff-${diffStyle}`}
            variants={shouldReduceMotion ? undefined : diffRevealVariants}
            initial="collapsed"
            animate="expanded"
            exit="exit"
            className={cn(
              'rounded-md border overflow-hidden',
              state === 'error' ? 'border-red-500/10' :
              state === 'running' ? 'border-amber-500/10' :
              'border-neutral-900 hover:border-neutral-800',
            )}
            style={{
              ...tmnlDiffStyle,
              background: '#000',
              willChange: 'height, opacity, transform, filter',
            }}
          >
            <div
              style={{ maxHeight: '400px', overflowY: 'auto' }}
            >
              <Suspense fallback={
                <div className="flex items-center gap-2 p-4 bg-black">
                  <motion.div
                    className="h-2.5 w-2.5 rounded-full border border-neutral-800 border-t-cyan-600"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                  />
                  <span className="text-neutral-600 font-mono" style={{ fontSize: '11px' }}>
                    Rendering diff…
                  </span>
                </div>
              }>
                <LazyMultiFileDiff
                  oldFile={oldFile}
                  newFile={newFile}
                  options={diffOptions}
                />
              </Suspense>
            </div>
          </motion.div>
        )}

        {/* ── Collapsed summary bar ────────────────────── */}
        {!showDiff && hasContent && (
          <motion.button
            key="collapsed-bar"
            type="button"
            onClick={toggleDiff}
            variants={shouldReduceMotion ? undefined : summaryBarVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            whileHover={shouldReduceMotion ? undefined : { scale: 1.005, backgroundColor: 'rgba(255,255,255,0.02)' }}
            whileTap={shouldReduceMotion ? undefined : { scale: 0.99 }}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-1.5 rounded-md',
              'bg-black border border-neutral-900',
              'text-neutral-600 hover:text-neutral-500',
              'font-mono cursor-pointer',
            )}
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            <motion.div
              animate={{ rotate: -90 }}
              transition={{ duration: 0.15, ease: EASE_OUT }}
            >
              <ChevronDown size={11} />
            </motion.div>
            <span>Show diff</span>
            {stats.additions > 0 && <span className="text-emerald-600">+{stats.additions}</span>}
            {stats.deletions > 0 && <span className="text-red-600">−{stats.deletions}</span>}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
})
EditToolRenderer.displayName = 'EditToolRenderer'
