/**
 * XtermTerminal Component
 *
 * xterm.js-based terminal component for TMNL.
 * Ported from infinitty's Terminal.tsx with TMNL styling.
 *
 * Features:
 * - Persistent terminal instances across remounts
 * - TMNL theme integration
 * - Automatic resize handling
 * - Link and file path click handlers
 * - Imperative handle for parent control
 */

import { useRef, useEffect, useImperativeHandle, forwardRef, useMemo } from 'react'
import { useXterm, type UseXtermOptions } from '../hooks/useXterm'
import type { ITheme } from '@xterm/xterm'
import type { TerminalConfig } from '../schemas'
import '@xterm/xterm/css/xterm.css'

// =============================================================================
// TMNL Default Theme
// =============================================================================

const TMNL_TERMINAL_THEME: ITheme = {
  foreground: '#c8d3d5',
  background: '#0a0a0a',
  cursor: '#c8d3d5',
  cursorAccent: '#0a0a0a',
  selectionBackground: 'rgba(200, 211, 213, 0.25)',
  selectionForeground: '#ffffff',
  black: '#0a0a0a',
  red: '#ff5555',
  green: '#50fa7b',
  yellow: '#f1fa8c',
  blue: '#6272a4',
  magenta: '#ff79c6',
  cyan: '#8be9fd',
  white: '#f8f8f2',
  brightBlack: '#6272a4',
  brightRed: '#ff6e6e',
  brightGreen: '#69ff94',
  brightYellow: '#ffffa5',
  brightBlue: '#d6acff',
  brightMagenta: '#ff92df',
  brightCyan: '#a4ffff',
  brightWhite: '#ffffff',
}

// =============================================================================
// Default Config
// =============================================================================

const DEFAULT_CONFIG: TerminalConfig = {
  fontSize: 14,
  fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
  fontWeight: 'normal',
  lineHeight: 1.2,
  letterSpacing: 0,
  cursorBlink: true,
  cursorStyle: 'block',
  scrollback: 10000,
  theme: TMNL_TERMINAL_THEME as any, // Schema type vs ITheme
}

// =============================================================================
// Utility: Hex to RGBA
// =============================================================================

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// =============================================================================
// Props & Handle Types
// =============================================================================

export interface XtermTerminalProps {
  /** Called when terminal outputs data (for PTY relay) */
  onData?: (data: string) => void
  /** Called when shell process exits */
  onExit?: (code: number) => void
  /** Called when a URL link is clicked */
  onLinkClick?: (url: string) => void
  /** Called when cmd+click on a file path */
  onFilePathClick?: (path: string) => void
  /** Called when current directory changes */
  onPwdChange?: (pwd: string) => void
  /** CSS class for container */
  className?: string
  /** Key for persisting terminal across remounts */
  persistKey?: string
  /** Terminal configuration */
  config?: Partial<TerminalConfig>
  /** Custom theme override */
  theme?: Partial<ITheme>
  /** Window opacity (0-1) for transparency support */
  windowOpacity?: number
}

export interface XtermTerminalHandle {
  /** Write data to terminal */
  write: (data: string) => void
  /** Clear terminal content */
  clear: () => void
  /** Focus terminal */
  focus: () => void
  /** Get current working directory */
  getPwd: () => string | undefined
}

// =============================================================================
// Component Implementation
// =============================================================================

export const XtermTerminal = forwardRef<XtermTerminalHandle, XtermTerminalProps>(
  function XtermTerminal(
    {
      onData,
      onExit,
      onLinkClick,
      onFilePathClick,
      onPwdChange,
      className = '',
      persistKey,
      config = {},
      theme = {},
      windowOpacity = 1,
    },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null)

    // Merge config with defaults
    const mergedConfig = useMemo(
      () => ({
        ...DEFAULT_CONFIG,
        ...config,
      }),
      [config]
    )

    // Merge theme with TMNL defaults and handle transparency
    const mergedTheme = useMemo(() => {
      const baseTheme = { ...TMNL_TERMINAL_THEME, ...theme }

      // Apply transparency if windowOpacity < 1
      if (windowOpacity < 1) {
        return {
          ...baseTheme,
          background: hexToRgba(
            baseTheme.background ?? '#0a0a0a',
            windowOpacity * 0.3
          ),
        }
      }

      return baseTheme
    }, [theme, windowOpacity])

    // Use xterm hook
    const { isReady, write, clear, focus, pwd } = useXterm(containerRef, {
      persistKey,
      onData,
      onExit,
      onLinkClick,
      onFilePathClick,
      onPwdChange,
      config: mergedConfig,
      theme: mergedTheme,
    })

    // Expose imperative handle
    useImperativeHandle(
      ref,
      () => ({
        write: (data: string) => write(data),
        clear: () => clear(),
        focus: () => focus(),
        getPwd: () => pwd,
      }),
      [write, clear, focus, pwd]
    )

    // Auto-focus when ready
    useEffect(() => {
      if (isReady) {
        focus()
      }
    }, [isReady, focus])

    return (
      <div
        className={`xterm-terminal-wrapper ${className}`}
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: 'transparent',
          padding: '10px 10px 12px 10px',
          boxSizing: 'border-box',
        }}
      >
        <div
          ref={containerRef}
          className="xterm-terminal-container"
          style={{
            width: '100%',
            height: '100%',
            position: 'relative',
            zIndex: 1,
          }}
        />
      </div>
    )
  }
)

// =============================================================================
// Display Name
// =============================================================================

XtermTerminal.displayName = 'XtermTerminal'

// =============================================================================
// Re-exports for convenience
// =============================================================================

export { disposeTerminal, disposeAllTerminals, getPersistedTerminalCount } from '../hooks/useXterm'
