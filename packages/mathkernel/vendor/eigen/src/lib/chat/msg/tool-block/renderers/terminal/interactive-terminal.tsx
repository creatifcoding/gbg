/**
 * InteractiveTerminal — Read-write terminal renderer for interactive shell sessions.
 *
 * Built on TerminalCore. Adds:
 *   - Bidirectional PTY connection via WS (onData → server, server → write)
 *   - Resize relay to server
 *   - Session status indicator (running/exited/error)
 *   - Focus management (click-to-focus, blur-on-exit)
 *   - Auto-fit to container
 *
 * Does NOT handle keyboard encoding — ghostty-web's WASM VT100 parser does that.
 *
 * @module chat/msg/tool-block/renderers/terminal/interactive-terminal
 */

import {
  useRef,
  useEffect,
  useState,
  useCallback,
  forwardRef,
  useImperativeHandle,
  type ComponentPropsWithoutRef,
} from 'react'
import { cn } from '@/lib/utils'
import {
  TerminalCore,
  type TerminalCoreRef,
  toTerminalLineEndings,
} from './terminal-core'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type SessionStatus = 'starting' | 'running' | 'exited' | 'killed' | 'error'

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

export interface InteractiveTerminalProps extends ComponentPropsWithoutRef<'div'> {
  /** Shell session ID for WS routing */
  sessionId: string
  /** Session display name */
  name?: string
  /** Current session status */
  status?: SessionStatus
  /** Exit code (when status is 'exited') */
  exitCode?: number
  /** Send raw input to server PTY */
  onInput?: (sessionId: string, data: string) => void
  /** Send resize to server PTY */
  onResizeRequest?: (sessionId: string, cols: number, rows: number) => void
  /** Request session kill */
  onKill?: (sessionId: string) => void
  /** Font size (default: 13) */
  fontSize?: number
  /** Max height in pixels (default: 600) */
  maxHeight?: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Ref API (exposed to parent)
// ─────────────────────────────────────────────────────────────────────────────

export interface InteractiveTerminalRef {
  /** Write server data to terminal display */
  write: (data: string) => void
  /** Focus the terminal */
  focus: () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Status badge component
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<SessionStatus, string> = {
  starting: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  running: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  exited: 'bg-neutral-500/20 text-neutral-400 border-neutral-500/30',
  killed: 'bg-red-500/20 text-red-400 border-red-500/30',
  error: 'bg-red-500/20 text-red-400 border-red-500/30',
}

const STATUS_DOTS: Record<SessionStatus, string> = {
  starting: 'bg-yellow-400 animate-pulse',
  running: 'bg-emerald-400',
  exited: 'bg-neutral-500',
  killed: 'bg-red-400',
  error: 'bg-red-400',
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export const InteractiveTerminal = forwardRef<TerminalCoreRef, InteractiveTerminalProps>(
  function InteractiveTerminal({
  sessionId,
  name,
  status = 'starting',
  exitCode,
  onInput,
  onResizeRequest,
  onKill,
  fontSize = 13,
  maxHeight = 600,
  className,
  ...divProps
}, forwardedRef) {
  const coreRef = useRef<TerminalCoreRef>(null)

  // Forward the internal coreRef so parents can write data
  useImperativeHandle(forwardedRef, () => ({
    write: (data) => coreRef.current?.write(data),
    writeln: (data) => coreRef.current?.writeln(data),
    clear: () => coreRef.current?.clear(),
    reset: () => coreRef.current?.reset(),
    resize: (c, r) => coreRef.current?.resize(c, r),
    focus: () => coreRef.current?.focus(),
    blur: () => coreRef.current?.blur(),
    getDimensions: () => coreRef.current?.getDimensions() ?? { cols: 80, rows: 24 },
    getSelection: () => coreRef.current?.getSelection() ?? '',
    hasSelection: () => coreRef.current?.hasSelection() ?? false,
    clearSelection: () => coreRef.current?.clearSelection(),
    selectAll: () => coreRef.current?.selectAll(),
    scrollToBottom: () => coreRef.current?.scrollToBottom(),
    scrollToTop: () => coreRef.current?.scrollToTop(),
    isReady: () => coreRef.current?.isReady() ?? false,
  }))
  const [ready, setReady] = useState(false)
  const [noGpu, setNoGpu] = useState(false)
  const isAlive = status === 'starting' || status === 'running'

  // ── Data handler: user input → server ─────────────────────────────
  const handleData = useCallback(
    (data: string) => {
      if (!isAlive) return
      onInput?.(sessionId, data)
    },
    [sessionId, onInput, isAlive],
  )

  // ── Resize handler: terminal resize → server ──────────────────────
  const handleResize = useCallback(
    (cols: number, rows: number) => {
      if (!isAlive) return
      onResizeRequest?.(sessionId, cols, rows)
    },
    [sessionId, onResizeRequest, isAlive],
  )

  // ── Auto-focus on ready ───────────────────────────────────────────
  useEffect(() => {
    if (ready && coreRef.current && isAlive) {
      // Small delay to avoid focus-stealing during layout
      const id = setTimeout(() => coreRef.current?.focus(), 100)
      return () => clearTimeout(id)
    }
  }, [ready, isAlive])

  // ── Disable stdin when session dies ───────────────────────────────
  // (TerminalCore's disableStdin prop handles this reactively)

  const statusLabel = status === 'exited' && exitCode !== undefined
    ? `exited (${exitCode})`
    : status

  // ── No-GPU fallback ───────────────────────────────────────────────
  if (noGpu) {
    return (
      <div
        data-slot="tmnl-interactive-terminal"
        data-session={sessionId}
        className={cn(
          'rounded border border-neutral-800 bg-[#0a0a0a] p-3 text-neutral-400 font-mono',
          className,
        )}
        style={{ fontSize: `${fontSize}px`, maxHeight: `${maxHeight}px` }}
        {...divProps}
      >
        <div className="text-red-400" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
          WebGPU not available — interactive terminal requires GPU rendering.
        </div>
      </div>
    )
  }

  return (
    <div
      data-slot="tmnl-interactive-terminal"
      data-session={sessionId}
      data-status={status}
      className={cn(
        'rounded border overflow-hidden bg-[#0a0a0a] flex flex-col',
        isAlive ? 'border-cyan-500/40' : 'border-neutral-700',
        className,
      )}
      style={{ maxHeight: `${maxHeight}px` }}
      {...divProps}
    >
      {/* ── Header bar ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-neutral-800 bg-neutral-900/50 shrink-0">
        {/* Status dot + badge */}
        <div className={cn(
          'flex items-center gap-1.5 px-2 py-0.5 rounded-full border',
          STATUS_COLORS[status],
        )}>
          <span className={cn('w-1.5 h-1.5 rounded-full', STATUS_DOTS[status])} />
          <span style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>{statusLabel}</span>
        </div>

        {/* Session name / ID */}
        <span
          className="text-neutral-500 font-mono truncate"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          {name || sessionId}
        </span>

        <div className="flex-1" />

        {/* Kill button */}
        {isAlive && (
          <button
            onClick={() => onKill?.(sessionId)}
            className="text-neutral-500 hover:text-red-400 transition-colors px-1.5 py-0.5 rounded hover:bg-red-500/10"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            title="Kill session"
          >
            ✕
          </button>
        )}
      </div>

      {/* ── Terminal body ───────────────────────────────────────────── */}
      <div className="flex-1 min-h-[200px]" style={{ maxHeight: `${maxHeight - 36}px` }}>
        <TerminalCore
          ref={coreRef}
          fontSize={fontSize}
          autoFit={true}
          disableStdin={!isAlive}
          cursorBlink={isAlive}
          cursorStyle={isAlive ? 'block' : 'underline'}
          onData={handleData}
          onResize={handleResize}
          onReady={() => setReady(true)}
          onError={() => setNoGpu(true)}
        />
      </div>
    </div>
  )
})
