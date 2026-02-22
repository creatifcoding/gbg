/**
 * TerminalOutput — Read-only terminal renderer for bash tool results.
 *
 * Built on TerminalCore. Adds:
 *   - Ledger replay for streaming tools (late-join/reconnect)
 *   - Pending chunk incremental write
 *   - Auto height estimation from content
 *   - No-GPU fallback to <pre>
 *   - Input blocking (disableStdin: true)
 *
 * @module chat/msg/tool-block/renderers/terminal/terminal-output
 */

import {
  useRef,
  useEffect,
  useState,
  memo,
  type FC,
  type ComponentPropsWithoutRef,
} from 'react'
import { cn } from '@/lib/utils'
import { SortedMap } from 'effect'
import type { ToolStreamLine } from './schemas'
import {
  TerminalCore,
  type TerminalCoreRef,
  stripAnsi,
  toTerminalLineEndings,
} from './terminal-core'

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

export interface TerminalOutputProps extends ComponentPropsWithoutRef<'div'> {
  /** Static content (for completed tools without streaming data) */
  content?: string
  /** Latest pending chunk to write into terminal (streaming mode) */
  pendingChunk?: string | null
  /** Ledger for replay on mount (streaming mode) */
  ledger?: SortedMap.SortedMap<number, ToolStreamLine>
  /** Whether tool is actively streaming */
  streaming?: boolean
  /** Number of columns (default: 120) */
  cols?: number
  /** Number of rows (default: auto from content) */
  rows?: number
  /** Max height in pixels (default: 400) */
  maxHeight?: number
  /** Font size in pixels (default: 13) */
  fontSize?: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export const TerminalOutput: FC<TerminalOutputProps> = memo(({
  content,
  pendingChunk,
  ledger,
  streaming = false,
  cols = 120,
  rows: rowsProp,
  maxHeight = 400,
  fontSize = 13,
  className,
  ...divProps
}) => {
  const coreRef = useRef<TerminalCoreRef>(null)
  const [ready, setReady] = useState(false)
  const [noGpu, setNoGpu] = useState(false)
  const replayedRef = useRef(false)
  const [fallbackText, setFallbackText] = useState('')

  // Calculate row count + height
  const contentLines = content ? content.split('\n').length : 10
  const autoRows = Math.max(4, Math.min(contentLines + 1, 50))
  const resolvedRows = rowsProp ?? autoRows
  const lineHeight = Math.ceil(fontSize * 1.4)
  const estimatedHeight = Math.min(maxHeight, Math.max(56, resolvedRows * lineHeight))

  // ── Replay ledger / static content on ready ─────────────────────────
  useEffect(() => {
    if (!ready || !coreRef.current || replayedRef.current) return
    const core = coreRef.current

    if (!ledger || SortedMap.isEmpty(ledger)) {
      if (content) {
        core.write(toTerminalLineEndings(content))
      }
      replayedRef.current = true
      return
    }

    // Streaming: replay all ledger entries
    for (const [, line] of SortedMap.entries(ledger)) {
      core.write(toTerminalLineEndings(line.chunk))
    }
    replayedRef.current = true
  }, [ready, ledger, content])

  // ── Write pending chunks incrementally (streaming) ──────────────────
  useEffect(() => {
    if (!pendingChunk) return
    if (ready && coreRef.current) {
      coreRef.current.write(toTerminalLineEndings(pendingChunk))
      return
    }
    if (noGpu) {
      setFallbackText(prev => prev + stripAnsi(pendingChunk))
    }
  }, [ready, noGpu, pendingChunk])

  // ── Update static content (non-streaming) ───────────────────────────
  useEffect(() => {
    if (!ready || !coreRef.current || streaming || !content) return
    if (replayedRef.current) return
    coreRef.current.write('\x1b[2J\x1b[H')
    coreRef.current.write(toTerminalLineEndings(content))
  }, [ready, content, streaming])

  // ── No-GPU fallback ─────────────────────────────────────────────────
  if (noGpu) {
    return (
      <pre
        data-slot="tmnl-terminal-output"
        data-streaming={streaming ? 'true' : 'false'}
        data-backend="none"
        className={cn(
          'rounded border overflow-x-auto overflow-y-auto bg-[#0a0a0a] p-3 text-neutral-400 font-mono',
          streaming ? 'border-cyan-500/30' : 'border-neutral-800',
          className,
        )}
        style={{
          fontSize: `${fontSize}px`,
          maxHeight: `${maxHeight}px`,
          minHeight: '56px',
          lineHeight: 1.4,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
        }}
        {...divProps}
      >
        {fallbackText || content || ''}
      </pre>
    )
  }

  return (
    <div
      data-slot="tmnl-terminal-output"
      data-streaming={streaming ? 'true' : 'false'}
      className={cn(
        'rounded border overflow-hidden bg-[#0a0a0a]',
        streaming ? 'border-cyan-500/30' : 'border-neutral-800',
        streaming && 'animate-pulse',
        !ready && 'opacity-50',
        className,
      )}
      style={{
        height: `${estimatedHeight}px`,
        maxHeight: `${maxHeight}px`,
      }}
      {...divProps}
    >
      <TerminalCore
        ref={coreRef}
        cols={cols}
        rows={resolvedRows}
        fontSize={fontSize}
        disableStdin={true}
        cursorBlink={false}
        onReady={() => setReady(true)}
        onError={(err) => {
          console.warn('[TerminalOutput] ghostty-web init failed, using fallback:', err)
          setNoGpu(true)
          if (content) setFallbackText(content)
          else if (ledger && !SortedMap.isEmpty(ledger)) {
            let acc = ''
            for (const [, line] of SortedMap.entries(ledger)) acc += stripAnsi(line.chunk)
            setFallbackText(acc)
          }
        }}
      />
    </div>
  )
})

TerminalOutput.displayName = 'TerminalOutput'
