/**
 * TerminalOutput — Read-only terminal renderer powered by restty (libghostty WASM).
 *
 * Two modes:
 * 1. STREAMING: receives pendingChunk → term.write(chunk) incrementally into WASM VT.
 *    restty accumulates state internally, WebGPU renders from screen buffer.
 * 2. STATIC: receives full content string → term.write(all) on mount.
 *
 * On mount with existing ledger (late-join/reconnect): replays all chunks in order.
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

// =============================================================================
// Helpers
// =============================================================================

/** Strip ANSI escape sequences for plain-text fallback */
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

/**
 * Normalize line endings for terminal emulators.
 * Terminals need \r\n — bare \n moves the cursor down but NOT back to column 0,
 * producing the classic "staircase" effect.
 */
function toTerminalLineEndings(str: string): string {
  // First normalize any existing \r\n to \n, then convert all \n to \r\n
  return str.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n')
}

// =============================================================================
// TMNL Ghostty theme (ITheme object — same format as GhosttyTerminal.tsx)
// =============================================================================

const TMNL_TERMINAL_THEME_OBJ = {
  foreground: '#a3a3a3',
  background: '#0a0a0a',
  cursor: '#06b6d4',
  cursorAccent: '#0a0a0a',
  selectionBackground: 'rgba(6, 182, 212, 0.25)',
  selectionForeground: '#f5f5f5',
  black: '#171717',
  red: '#ef4444',
  green: '#22c55e',
  yellow: '#eab308',
  blue: '#06b6d4',
  magenta: '#a855f7',
  cyan: '#06b6d4',
  white: '#a3a3a3',
  brightBlack: '#404040',
  brightRed: '#f87171',
  brightGreen: '#4ade80',
  brightYellow: '#facc15',
  brightBlue: '#22d3ee',
  brightMagenta: '#c084fc',
  brightCyan: '#22d3ee',
  brightWhite: '#f5f5f5',
}

// =============================================================================
// ghostty-web lazy loader (same lib as GhosttyTerminal.tsx)
// =============================================================================

type GhosttyTerminalInstance = {
  open: (el: HTMLElement) => void
  write: (data: string | Uint8Array) => void
  resize: (cols: number, rows: number) => void
  dispose: () => void
  options: Record<string, unknown>
}

let wasmInitPromise: Promise<void> | null = null
let wasmReady = false

async function ensureGhosttyInit(): Promise<void> {
  if (wasmReady) return
  if (!wasmInitPromise) {
    wasmInitPromise = import('ghostty-web').then(async (mod) => {
      await mod.init()
      wasmReady = true
    })
  }
  return wasmInitPromise
}

let ghosttyModule: {
  Terminal: new (opts?: Record<string, unknown>) => GhosttyTerminalInstance
  FitAddon: new () => { fit: () => void; dispose: () => void; observeResize: () => void }
} | null = null

async function loadGhostty() {
  await ensureGhosttyInit()
  if (!ghosttyModule) {
    const mod = await import('ghostty-web')
    ghosttyModule = {
      Terminal: mod.Terminal as any,
      FitAddon: mod.FitAddon as any,
    }
  }
  return ghosttyModule
}

// =============================================================================
// Props
// =============================================================================

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

// =============================================================================
// Component
// =============================================================================

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
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<GhosttyTerminalInstance | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [noGpu, setNoGpu] = useState(false)
  const replayedRef = useRef(false)
  // Fallback text accumulator for no-GPU mode
  const [fallbackText, setFallbackText] = useState('')

  // Calculate row count
  const contentLines = content ? content.split('\n').length : 10
  const autoRows = Math.max(4, Math.min(contentLines + 1, 50))
  const resolvedRows = rowsProp ?? autoRows
  const lineHeight = Math.ceil(fontSize * 1.4)
  const estimatedHeight = Math.min(maxHeight, Math.max(56, resolvedRows * lineHeight))

  // ── Initialize ghostty-web terminal ──────────────────────
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    let disposed = false
    let term: GhosttyTerminalInstance | null = null

    ;(async () => {
      const mod = await loadGhostty()
      if (disposed || !el) return

      term = new mod.Terminal({
        cols,
        rows: resolvedRows,
        fontSize,
        fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, monospace",
        scrollback: 5000,
        cursorBlink: false,
        cursorStyle: 'block',
        theme: TMNL_TERMINAL_THEME_OBJ,
        disableStdin: true,
        allowTransparency: true,
      })

      term.open(el)

      // Suppress keyboard input (read-only, allow copy)
      const blockInput = (e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'c') return
        e.preventDefault()
        e.stopPropagation()
      }
      el.addEventListener('keydown', blockInput, true)

      termRef.current = term
      setReady(true)
    })().catch((err) => {
      if (!disposed) {
        console.warn('[TerminalOutput] ghostty-web init failed, using fallback:', err)
        setNoGpu(true)
        if (content) setFallbackText(content)
        else if (ledger && !SortedMap.isEmpty(ledger)) {
          let acc = ''
          for (const [, line] of SortedMap.entries(ledger)) acc += stripAnsi(line.chunk)
          setFallbackText(acc)
        }
      }
    })

    return () => {
      disposed = true
      if (term) {
        try { term.dispose() } catch { /* ignore */ }
      }
      termRef.current = null
      setReady(false)
      replayedRef.current = false
    }
  }, [cols, resolvedRows, fontSize])

  // ── Replay ledger on mount (late-join/reconnect) ────────
  useEffect(() => {
    if (!ready || !termRef.current || replayedRef.current) return
    if (!ledger || SortedMap.isEmpty(ledger)) {
      // Static mode: write full content
      if (content) {
        termRef.current.write(toTerminalLineEndings(content))
      }
      replayedRef.current = true
      return
    }
    // Streaming mode: replay all ledger entries (normalize \n → \r\n)
    for (const [, line] of SortedMap.entries(ledger)) {
      termRef.current.write(toTerminalLineEndings(line.chunk))
    }
    replayedRef.current = true
  }, [ready, ledger, content])

  // ── Write pending chunks incrementally (streaming) ──────
  useEffect(() => {
    if (!pendingChunk) return
    // GPU mode: write to ghostty-web (normalize \n → \r\n)
    if (ready && termRef.current) {
      termRef.current.write(toTerminalLineEndings(pendingChunk))
      return
    }
    // No-GPU fallback: append stripped text
    if (noGpu) {
      setFallbackText(prev => prev + stripAnsi(pendingChunk))
    }
  }, [ready, noGpu, pendingChunk])

  // ── Update static content (non-streaming) ───────────────
  useEffect(() => {
    if (!ready || !termRef.current || streaming || !content) return
    if (replayedRef.current) return // already written
    termRef.current.write('\x1b[2J\x1b[H') // clear + home
    termRef.current.write(toTerminalLineEndings(content))
  }, [ready, content, streaming])

  // ── Error fallback ──────────────────────────────────────
  if (error) {
    return (
      <pre
        className={cn('bg-neutral-950 border border-neutral-800 rounded p-2 text-neutral-400 font-mono overflow-x-auto', className)}
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        {...divProps}
      >
        {content ?? '(terminal failed to load)'}
      </pre>
    )
  }

  // ── No-GPU fallback: scrollable <pre> with streaming ────
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
      ref={containerRef}
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
    />
  )
})

TerminalOutput.displayName = 'TerminalOutput'
