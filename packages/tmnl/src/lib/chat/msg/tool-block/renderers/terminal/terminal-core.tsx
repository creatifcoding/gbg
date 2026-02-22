/**
 * TerminalCore — Shared ghostty-web rendering primitive.
 *
 * Handles:
 *   - WASM lazy initialization (singleton)
 *   - Terminal instance lifecycle (create → open → dispose)
 *   - FitAddon auto-resize
 *   - TMNL theme application
 *   - Imperative ref API (write, resize, clear, focus, getDimensions)
 *
 * Consumers:
 *   - TerminalOutput (read-only, streaming/static bash tool results)
 *   - InteractiveTerminal (read-write, PTY-connected interactive shell)
 *   - Future: log viewers, serial monitors, etc.
 *
 * @module chat/msg/tool-block/renderers/terminal/terminal-core
 */

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type FC,
} from 'react'
import { cn } from '@/lib/utils'

// ─────────────────────────────────────────────────────────────────────────────
// ghostty-web types (minimal — avoids importing full module at parse time)
// ─────────────────────────────────────────────────────────────────────────────

type GhosttyTerminalInstance = {
  open: (el: HTMLElement) => void
  write: (data: string | Uint8Array) => void
  writeln: (data: string) => void
  resize: (cols: number, rows: number) => void
  clear: () => void
  reset: () => void
  focus: () => void
  blur: () => void
  dispose: () => void
  getSelection: () => string
  hasSelection: () => boolean
  clearSelection: () => void
  selectAll: () => void
  scrollToBottom: () => void
  scrollToTop: () => void
  loadAddon: (addon: unknown) => void
  onData: (cb: (data: string) => void) => { dispose: () => void }
  onResize: (cb: (dims: { cols: number; rows: number }) => void) => { dispose: () => void }
  onTitleChange: (cb: (title: string) => void) => { dispose: () => void }
  onBell: (cb: () => void) => { dispose: () => void }
  onSelectionChange: (cb: () => void) => { dispose: () => void }
  options: Record<string, unknown>
  cols: number
  rows: number
}

type GhosttyFitAddon = {
  fit: () => void
  dispose: () => void
  observeResize: () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// WASM singleton loader
// ─────────────────────────────────────────────────────────────────────────────

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
  FitAddon: new () => GhosttyFitAddon
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

// ─────────────────────────────────────────────────────────────────────────────
// TMNL Terminal Theme (shared across all consumers)
// ─────────────────────────────────────────────────────────────────────────────

export const TMNL_TERMINAL_THEME = {
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
} as const

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Strip ANSI escape sequences for plain-text fallback */
export function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

/**
 * Normalize line endings for terminal emulators.
 * Terminals need \r\n — bare \n moves cursor down but NOT back to column 0.
 */
export function toTerminalLineEndings(str: string): string {
  return str.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n')
}

// ─────────────────────────────────────────────────────────────────────────────
// Ref API
// ─────────────────────────────────────────────────────────────────────────────

export interface TerminalCoreRef {
  /** Write raw data to terminal (ANSI sequences preserved) */
  write: (data: string | Uint8Array) => void
  /** Write data + newline */
  writeln: (data: string) => void
  /** Clear screen */
  clear: () => void
  /** Reset terminal state */
  reset: () => void
  /** Resize terminal grid */
  resize: (cols: number, rows: number) => void
  /** Focus terminal (enables keyboard input) */
  focus: () => void
  /** Blur terminal */
  blur: () => void
  /** Current dimensions */
  getDimensions: () => { cols: number; rows: number }
  /** Get selected text */
  getSelection: () => string
  /** Check selection state */
  hasSelection: () => boolean
  /** Clear selection */
  clearSelection: () => void
  /** Select all text */
  selectAll: () => void
  /** Scroll to bottom */
  scrollToBottom: () => void
  /** Scroll to top */
  scrollToTop: () => void
  /** Is the terminal ready (WASM loaded, DOM attached) */
  isReady: () => boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

export interface TerminalCoreProps {
  /** Number of columns (default: 120) */
  cols?: number
  /** Number of rows (default: 24) */
  rows?: number
  /** Font size in pixels (default: 13) */
  fontSize?: number
  /** Font family */
  fontFamily?: string
  /** Scrollback buffer lines (default: 5000) */
  scrollback?: number
  /** Show blinking cursor (default: false) */
  cursorBlink?: boolean
  /** Cursor style (default: 'block') */
  cursorStyle?: 'block' | 'underline' | 'bar'
  /** Theme override (default: TMNL_TERMINAL_THEME) */
  theme?: Record<string, string>
  /** Auto-fit to container using FitAddon (default: false) */
  autoFit?: boolean
  /** Disable keyboard input (default: false — set true for read-only) */
  disableStdin?: boolean

  // ── Event callbacks ──────────────────────────────────────────────────
  /** User typed or pasted text (for interactive mode) */
  onData?: (data: string) => void
  /** Terminal resized (from FitAddon or manual) */
  onResize?: (cols: number, rows: number) => void
  /** Terminal title changed via escape sequence */
  onTitleChange?: (title: string) => void
  /** Terminal is ready */
  onReady?: () => void
  /** Terminal init failed (consumer should show fallback) */
  onError?: (error: Error) => void

  /** Container className */
  className?: string
  /** Container style */
  style?: React.CSSProperties
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export const TerminalCore = forwardRef<TerminalCoreRef, TerminalCoreProps>(
  function TerminalCore(props, ref) {
    const {
      cols = 120,
      rows = 24,
      fontSize = 13,
      fontFamily = "'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, monospace",
      scrollback = 5000,
      cursorBlink = false,
      cursorStyle = 'block',
      theme = TMNL_TERMINAL_THEME,
      autoFit = false,
      disableStdin = false,
      onData,
      onResize,
      onTitleChange,
      onReady,
      onError,
      className,
      style,
    } = props

    const containerRef = useRef<HTMLDivElement>(null)
    const termRef = useRef<GhosttyTerminalInstance | null>(null)
    const fitRef = useRef<GhosttyFitAddon | null>(null)
    const [ready, setReady] = useState(false)

    // Stable callback refs
    const onDataRef = useRef(onData)
    const onResizeRef = useRef(onResize)
    const onTitleChangeRef = useRef(onTitleChange)
    useEffect(() => { onDataRef.current = onData }, [onData])
    useEffect(() => { onResizeRef.current = onResize }, [onResize])
    useEffect(() => { onTitleChangeRef.current = onTitleChange }, [onTitleChange])

    // Imperative API
    useImperativeHandle(ref, () => ({
      write: (data) => termRef.current?.write(data),
      writeln: (data) => termRef.current?.writeln(data),
      clear: () => termRef.current?.clear(),
      reset: () => termRef.current?.reset(),
      resize: (c, r) => termRef.current?.resize(c, r),
      focus: () => termRef.current?.focus(),
      blur: () => termRef.current?.blur(),
      getDimensions: () => ({
        cols: termRef.current?.cols ?? cols,
        rows: termRef.current?.rows ?? rows,
      }),
      getSelection: () => termRef.current?.getSelection() ?? '',
      hasSelection: () => termRef.current?.hasSelection() ?? false,
      clearSelection: () => termRef.current?.clearSelection(),
      selectAll: () => termRef.current?.selectAll(),
      scrollToBottom: () => termRef.current?.scrollToBottom(),
      scrollToTop: () => termRef.current?.scrollToTop(),
      isReady: () => ready,
    }))

    // ── Lifecycle: init → open → wire events → cleanup ────────────────
    useEffect(() => {
      const el = containerRef.current
      if (!el) return

      let disposed = false

      ;(async () => {
        const mod = await loadGhostty()
        if (disposed || !el) return

        const term = new mod.Terminal({
          cols,
          rows,
          fontSize,
          fontFamily,
          scrollback,
          cursorBlink,
          cursorStyle,
          theme,
          disableStdin,
          allowTransparency: true,
        })

        const fit = new mod.FitAddon()
        term.loadAddon(fit)
        term.open(el)

        // Wire events via refs
        term.onData((data) => onDataRef.current?.(data))
        term.onResize(({ cols, rows }) => onResizeRef.current?.(cols, rows))
        term.onTitleChange((title) => onTitleChangeRef.current?.(title))

        if (autoFit) {
          fit.observeResize()
          requestAnimationFrame(() => {
            if (!disposed) fit.fit()
          })
        }

        termRef.current = term
        fitRef.current = fit
        setReady(true)
        onReady?.()
      })().catch((err) => {
        if (!disposed) {
          const error = err instanceof Error ? err : new Error(String(err))
          console.warn('[TerminalCore] init failed:', error)
          onError?.(error)
        }
      })

      return () => {
        disposed = true
        fitRef.current?.dispose()
        fitRef.current = null
        termRef.current?.dispose()
        termRef.current = null
        setReady(false)
      }
    }, []) // mount-only — consumers control content via ref

    // ── Runtime option updates ────────────────────────────────────────
    useEffect(() => {
      if (!termRef.current || !ready) return
      termRef.current.options.fontSize = fontSize
      if (autoFit) requestAnimationFrame(() => fitRef.current?.fit())
    }, [fontSize, ready, autoFit])

    useEffect(() => {
      if (!termRef.current || !ready) return
      termRef.current.options.cursorBlink = cursorBlink
      termRef.current.options.cursorStyle = cursorStyle
    }, [cursorBlink, cursorStyle, ready])

    useEffect(() => {
      if (!termRef.current || !ready) return
      termRef.current.options.disableStdin = disableStdin
    }, [disableStdin, ready])

    return (
      <div
        ref={containerRef}
        data-slot="tmnl-terminal-core"
        data-ready={ready}
        className={cn('overflow-hidden bg-[#0a0a0a]', className)}
        style={{
          width: '100%',
          height: '100%',
          ...style,
        }}
      />
    )
  },
)
