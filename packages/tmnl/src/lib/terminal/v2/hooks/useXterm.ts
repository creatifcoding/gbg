/**
 * useXterm Hook
 *
 * Terminal lifecycle management with persistence registry.
 * Ported from infinitty's useTerminal.ts with TMNL adaptations.
 *
 * Key features:
 * - Terminal instance persistence across React remounts (LRU eviction)
 * - CanvasAddon recreation for font changes
 * - Direct xterm.js setup with FitAddon, CanvasAddon, WebLinksAddon
 * - OSC 7 parsing for directory change detection
 * - File path link detection with cmd+click
 */

import { useRef, useEffect, useCallback, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { CanvasAddon } from '@xterm/addon-canvas'
import { WebLinksAddon } from '@xterm/addon-web-links'
import type { ITheme, ITerminalOptions } from '@xterm/xterm'
import type { TerminalConfig, CursorStyle } from '../schemas'

// =============================================================================
// Terminal Persistence Registry
// =============================================================================

const MAX_PERSISTED_TERMINALS = 50

interface PersistedTerminal {
  terminal: Terminal
  fitAddon: FitAddon
  canvasAddon: CanvasAddon | null
  webLinksAddon: WebLinksAddon | null
  lastAccess: number
  pwd?: string
}

const terminalRegistry = new Map<string, PersistedTerminal>()

function evictOldestTerminal(): void {
  if (terminalRegistry.size <= MAX_PERSISTED_TERMINALS) return

  let oldest: string | null = null
  let oldestTime = Infinity

  for (const [key, value] of terminalRegistry) {
    if (value.lastAccess < oldestTime) {
      oldest = key
      oldestTime = value.lastAccess
    }
  }

  if (oldest) {
    const entry = terminalRegistry.get(oldest)
    if (entry) {
      entry.terminal.dispose()
      terminalRegistry.delete(oldest)
    }
  }
}

// =============================================================================
// Theme Conversion
// =============================================================================

function convertThemeToXterm(theme: Partial<ITheme>): ITheme {
  return {
    foreground: theme.foreground ?? '#c8d3d5',
    background: theme.background ?? '#0a0a0a',
    cursor: theme.cursor ?? '#c8d3d5',
    cursorAccent: theme.cursorAccent,
    selectionBackground: theme.selectionBackground ?? 'rgba(200, 211, 213, 0.3)',
    selectionForeground: theme.selectionForeground,
    selectionInactiveBackground: theme.selectionInactiveBackground,
    black: theme.black ?? '#000000',
    red: theme.red ?? '#ff5555',
    green: theme.green ?? '#50fa7b',
    yellow: theme.yellow ?? '#f1fa8c',
    blue: theme.blue ?? '#6272a4',
    magenta: theme.magenta ?? '#ff79c6',
    cyan: theme.cyan ?? '#8be9fd',
    white: theme.white ?? '#f8f8f2',
    brightBlack: theme.brightBlack ?? '#6272a4',
    brightRed: theme.brightRed ?? '#ff6e6e',
    brightGreen: theme.brightGreen ?? '#69ff94',
    brightYellow: theme.brightYellow ?? '#ffffa5',
    brightBlue: theme.brightBlue ?? '#d6acff',
    brightMagenta: theme.brightMagenta ?? '#ff92df',
    brightCyan: theme.brightCyan ?? '#a4ffff',
    brightWhite: theme.brightWhite ?? '#ffffff',
  }
}

// =============================================================================
// Hook Options
// =============================================================================

export interface UseXtermOptions {
  /** Key for persisting terminal across remounts */
  persistKey?: string
  /** Called when terminal outputs data */
  onData?: (data: string) => void
  /** Called when shell process exits */
  onExit?: (code: number) => void
  /** Called when a link is clicked */
  onLinkClick?: (url: string) => void
  /** Called when cmd+click on file path */
  onFilePathClick?: (path: string) => void
  /** Called when pwd changes (OSC 7) */
  onPwdChange?: (pwd: string) => void
  /** Terminal configuration */
  config?: Partial<TerminalConfig>
  /** Custom theme override */
  theme?: Partial<ITheme>
}

// =============================================================================
// Hook Return Type
// =============================================================================

export interface UseXtermReturn {
  /** Whether terminal is ready */
  isReady: boolean
  /** Write data to terminal */
  write: (data: string) => void
  /** Clear terminal */
  clear: () => void
  /** Focus terminal */
  focus: () => void
  /** Current working directory */
  pwd: string | undefined
  /** Terminal instance (for advanced usage) */
  terminal: Terminal | null
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useXterm(
  containerRef: React.RefObject<HTMLDivElement | null>,
  options: UseXtermOptions = {}
): UseXtermReturn {
  const {
    persistKey,
    onData,
    onExit: _onExit,
    onLinkClick,
    onFilePathClick,
    onPwdChange,
    config = {},
    theme = {},
  } = options

  const [isReady, setIsReady] = useState(false)
  const [pwd, setPwd] = useState<string | undefined>(undefined)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const canvasAddonRef = useRef<CanvasAddon | null>(null)
  const dataListenerRef = useRef<{ dispose: () => void } | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const isInitializedRef = useRef(false)

  // Build terminal options
  const terminalOptions: ITerminalOptions = {
    fontSize: config.fontSize ?? 14,
    fontFamily: config.fontFamily ?? '"JetBrains Mono", "Fira Code", monospace',
    fontWeight: config.fontWeight ?? 'normal',
    lineHeight: Math.max(1, config.lineHeight ?? 1.2),
    letterSpacing: config.letterSpacing ?? 0,
    cursorBlink: config.cursorBlink ?? true,
    cursorStyle: (config.cursorStyle as CursorStyle) ?? 'block',
    scrollback: config.scrollback ?? 10000,
    theme: convertThemeToXterm(theme),
    allowProposedApi: true,
    convertEol: true,
  }

  // Recreate canvas addon when fonts change (infinitty pattern)
  const recreateCanvasAddon = useCallback(() => {
    const terminal = terminalRef.current
    if (!terminal) return

    // Dispose old addon
    if (canvasAddonRef.current) {
      try {
        canvasAddonRef.current.dispose()
      } catch {
        // Ignore disposal errors
      }
      canvasAddonRef.current = null
    }

    // Create new addon
    try {
      const canvasAddon = new CanvasAddon()
      terminal.loadAddon(canvasAddon)
      canvasAddonRef.current = canvasAddon
    } catch (e) {
      console.warn('[useXterm] Failed to create CanvasAddon:', e)
    }
  }, [])

  // Initialize terminal
  useEffect(() => {
    const container = containerRef.current
    if (!container || isInitializedRef.current) return

    isInitializedRef.current = true

    // Check for persisted terminal
    let persisted: PersistedTerminal | undefined
    if (persistKey) {
      persisted = terminalRegistry.get(persistKey)
      if (persisted) {
        persisted.lastAccess = Date.now()
        terminalRef.current = persisted.terminal
        fitAddonRef.current = persisted.fitAddon
        canvasAddonRef.current = persisted.canvasAddon

        // Reattach to container
        container.innerHTML = ''
        persisted.terminal.open(container)
        persisted.fitAddon.fit()

        // Restore pwd
        if (persisted.pwd) {
          setPwd(persisted.pwd)
        }

        setIsReady(true)
        return
      }
    }

    // Create new terminal
    const terminal = new Terminal(terminalOptions)
    const fitAddon = new FitAddon()

    terminal.loadAddon(fitAddon)

    // Open terminal in container
    terminal.open(container)

    // Load CanvasAddon for better rendering
    try {
      const canvasAddon = new CanvasAddon()
      terminal.loadAddon(canvasAddon)
      canvasAddonRef.current = canvasAddon
    } catch (e) {
      console.warn('[useXterm] CanvasAddon not available:', e)
    }

    // Load WebLinksAddon for clickable links
    if (onLinkClick) {
      const webLinksAddon = new WebLinksAddon((_event, uri) => {
        onLinkClick(uri)
      })
      terminal.loadAddon(webLinksAddon)
    }

    // Fit terminal to container
    fitAddon.fit()

    // Store refs
    terminalRef.current = terminal
    fitAddonRef.current = fitAddon

    // Persist if key provided
    if (persistKey) {
      evictOldestTerminal()
      terminalRegistry.set(persistKey, {
        terminal,
        fitAddon,
        canvasAddon: canvasAddonRef.current,
        webLinksAddon: null,
        lastAccess: Date.now(),
      })
    }

    // Set up resize observer
    resizeObserverRef.current = new ResizeObserver(() => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit()
      }
    })
    resizeObserverRef.current.observe(container)

    setIsReady(true)

    // Cleanup on unmount (but don't dispose if persisted)
    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect()
        resizeObserverRef.current = null
      }

      if (!persistKey) {
        if (dataListenerRef.current) {
          dataListenerRef.current.dispose()
        }
        terminal.dispose()
      }

      isInitializedRef.current = false
    }
  }, [containerRef, persistKey, terminalOptions, onLinkClick])

  // Set up data listener
  useEffect(() => {
    const terminal = terminalRef.current
    if (!terminal || !onData) return

    // Remove old listener
    if (dataListenerRef.current) {
      dataListenerRef.current.dispose()
    }

    // OSC 7 regex for pwd detection
    const osc7Regex = /\x1b\]7;file:\/\/[^/]*([^\x07\x1b]*)\x07/

    // Set up new listener with OSC 7 parsing
    dataListenerRef.current = terminal.onData((data) => {
      // Check for OSC 7 (pwd announcement)
      const match = data.match(osc7Regex)
      if (match) {
        const newPwd = decodeURIComponent(match[1])
        setPwd(newPwd)
        onPwdChange?.(newPwd)

        // Update persisted pwd
        if (persistKey) {
          const persisted = terminalRegistry.get(persistKey)
          if (persisted) {
            persisted.pwd = newPwd
          }
        }
      }

      onData(data)
    })

    return () => {
      if (dataListenerRef.current) {
        dataListenerRef.current.dispose()
        dataListenerRef.current = null
      }
    }
  }, [onData, onPwdChange, persistKey])

  // Handle config/theme changes
  useEffect(() => {
    const terminal = terminalRef.current
    if (!terminal) return

    // Update theme
    terminal.options.theme = convertThemeToXterm(theme)

    // Update font options (requires canvas addon recreation)
    const needsCanvasRecreate =
      terminal.options.fontSize !== (config.fontSize ?? 14) ||
      terminal.options.fontFamily !== (config.fontFamily ?? '"JetBrains Mono", "Fira Code", monospace')

    terminal.options.fontSize = config.fontSize ?? 14
    terminal.options.fontFamily = config.fontFamily ?? '"JetBrains Mono", "Fira Code", monospace'
    terminal.options.fontWeight = config.fontWeight ?? 'normal'
    terminal.options.lineHeight = Math.max(1, config.lineHeight ?? 1.2)
    terminal.options.letterSpacing = config.letterSpacing ?? 0
    terminal.options.cursorBlink = config.cursorBlink ?? true
    terminal.options.cursorStyle = (config.cursorStyle as CursorStyle) ?? 'block'

    // Recreate canvas addon for font changes (infinitty pattern)
    if (needsCanvasRecreate) {
      recreateCanvasAddon()
    }

    // Refit after changes
    if (fitAddonRef.current) {
      fitAddonRef.current.fit()
    }
  }, [config, theme, recreateCanvasAddon])

  // File path click handler (cmd+click)
  useEffect(() => {
    const terminal = terminalRef.current
    if (!terminal || !onFilePathClick) return

    const container = containerRef.current
    if (!container) return

    const handleClick = (event: MouseEvent) => {
      // Check for cmd/ctrl + click
      if (!event.metaKey && !event.ctrlKey) return

      // Get clicked position
      const target = event.target as HTMLElement
      if (!target.closest('.xterm-screen')) return

      // Get text at position (simplified - real impl would use xterm buffer)
      const selection = terminal.getSelection()
      if (selection) {
        // Check if selection looks like a file path
        const pathRegex = /^(\.?\.?\/)?[\w\-./]+\.\w+$/
        if (pathRegex.test(selection.trim())) {
          event.preventDefault()
          onFilePathClick(selection.trim())
        }
      }
    }

    container.addEventListener('click', handleClick)
    return () => container.removeEventListener('click', handleClick)
  }, [containerRef, onFilePathClick])

  // API methods
  const write = useCallback((data: string) => {
    terminalRef.current?.write(data)
  }, [])

  const clear = useCallback(() => {
    terminalRef.current?.clear()
  }, [])

  const focus = useCallback(() => {
    terminalRef.current?.focus()
  }, [])

  return {
    isReady,
    write,
    clear,
    focus,
    pwd,
    terminal: terminalRef.current,
  }
}

// =============================================================================
// Registry Management (for external cleanup)
// =============================================================================

export function disposeTerminal(persistKey: string): void {
  const persisted = terminalRegistry.get(persistKey)
  if (persisted) {
    persisted.terminal.dispose()
    terminalRegistry.delete(persistKey)
  }
}

export function disposeAllTerminals(): void {
  for (const [key, value] of terminalRegistry) {
    value.terminal.dispose()
    terminalRegistry.delete(key)
  }
}

export function getPersistedTerminalCount(): number {
  return terminalRegistry.size
}
