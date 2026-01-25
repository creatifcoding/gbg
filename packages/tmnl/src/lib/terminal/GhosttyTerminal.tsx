/**
 * GhosttyTerminal - React wrapper for ghostty-web
 *
 * Provides a React component that wraps the ghostty-web Terminal
 * with proper lifecycle management, ref API, and TMNL integration.
 *
 * @example
 * ```tsx
 * import { GhosttyTerminal } from '@/lib/terminal';
 *
 * function MyTerminal() {
 *   const termRef = useRef<GhosttyTerminalRef>(null);
 *
 *   const handleData = (data: string) => {
 *     // Send to PTY backend
 *     pty.write(data);
 *   };
 *
 *   useEffect(() => {
 *     // Write incoming data
 *     pty.onData((data) => termRef.current?.write(data));
 *   }, []);
 *
 *   return (
 *     <GhosttyTerminal
 *       ref={termRef}
 *       onData={handleData}
 *       fontSize={14}
 *       autoFit
 *     />
 *   );
 * }
 * ```
 */

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { init, Terminal, FitAddon } from 'ghostty-web';
import type { ITerminalOptions, ITheme } from 'ghostty-web';
import { tmnlTerminalTheme } from './theme';

// ============================================================================
// Types
// ============================================================================

/**
 * Imperative handle exposed via ref
 */
export interface GhosttyTerminalRef {
  /** Write data to terminal */
  write: (data: string | Uint8Array) => void;
  /** Write data and add newline */
  writeln: (data: string) => void;
  /** Clear terminal screen */
  clear: () => void;
  /** Reset terminal state */
  reset: () => void;
  /** Resize terminal to specific dimensions */
  resize: (cols: number, rows: number) => void;
  /** Focus the terminal */
  focus: () => void;
  /** Blur the terminal */
  blur: () => void;
  /** Get current dimensions */
  getDimensions: () => { cols: number; rows: number };
  /** Get selection text */
  getSelection: () => string;
  /** Check if terminal has selection */
  hasSelection: () => boolean;
  /** Clear selection */
  clearSelection: () => void;
  /** Select all text */
  selectAll: () => void;
  /** Scroll to bottom */
  scrollToBottom: () => void;
  /** Scroll to top */
  scrollToTop: () => void;
  /** Get underlying Terminal instance (for advanced usage) */
  getTerminal: () => Terminal | null;
}

/**
 * Props for GhosttyTerminal component
 */
export interface GhosttyTerminalProps {
  /** Initial columns (default: 80) */
  cols?: number;
  /** Initial rows (default: 24) */
  rows?: number;
  /** Font size in pixels (default: 14) */
  fontSize?: number;
  /** Font family (default: monospace) */
  fontFamily?: string;
  /** Scrollback buffer size (default: 10000) */
  scrollback?: number;
  /** Enable cursor blinking (default: false) */
  cursorBlink?: boolean;
  /** Cursor style (default: 'block') */
  cursorStyle?: 'block' | 'underline' | 'bar';
  /** Theme configuration */
  theme?: ITheme;
  /** Auto-fit to container size (default: true) */
  autoFit?: boolean;
  /** Disable keyboard input (default: false) */
  disableStdin?: boolean;

  // Event callbacks
  /** Called when user types or pastes */
  onData?: (data: string) => void;
  /** Called when terminal is resized */
  onResize?: (cols: number, rows: number) => void;
  /** Called when terminal title changes (via escape sequence) */
  onTitleChange?: (title: string) => void;
  /** Called when bell character received */
  onBell?: () => void;
  /** Called when selection changes */
  onSelectionChange?: () => void;
  /** Called when terminal is ready */
  onReady?: (terminal: Terminal) => void;

  /** Additional className for container */
  className?: string;
  /** Additional style for container */
  style?: React.CSSProperties;
}

// ============================================================================
// WASM Initialization
// ============================================================================

// Track global init state
let wasmInitPromise: Promise<void> | null = null;
let wasmInitialized = false;

/**
 * Ensure WASM is initialized (idempotent)
 */
async function ensureWasmInit(): Promise<void> {
  if (wasmInitialized) return;

  if (!wasmInitPromise) {
    wasmInitPromise = init().then(() => {
      wasmInitialized = true;
    });
  }

  return wasmInitPromise;
}

// ============================================================================
// Component
// ============================================================================

export const GhosttyTerminal = forwardRef<GhosttyTerminalRef, GhosttyTerminalProps>(
  function GhosttyTerminal(props, ref) {
    const {
      cols = 80,
      rows = 24,
      fontSize = 14,
      fontFamily = "'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, monospace",
      scrollback = 10000,
      cursorBlink = false,
      cursorStyle = 'block',
      theme = tmnlTerminalTheme,
      autoFit = true,
      disableStdin = false,
      onData,
      onResize,
      onTitleChange,
      onBell,
      onSelectionChange,
      onReady,
      className,
      style,
    } = props;

    // Refs
    const containerRef = useRef<HTMLDivElement>(null);
    const terminalRef = useRef<Terminal | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);

    // Callback refs to avoid stale closures - these always point to current props
    const onDataRef = useRef(onData);
    const onResizeRef = useRef(onResize);
    const onTitleChangeRef = useRef(onTitleChange);
    const onBellRef = useRef(onBell);
    const onSelectionChangeRef = useRef(onSelectionChange);

    // State
    const [isReady, setIsReady] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    // Keep callback refs in sync with props (avoids stale closures)
    useEffect(() => {
      onDataRef.current = onData;
    }, [onData]);

    useEffect(() => {
      onResizeRef.current = onResize;
    }, [onResize]);

    useEffect(() => {
      onTitleChangeRef.current = onTitleChange;
    }, [onTitleChange]);

    useEffect(() => {
      onBellRef.current = onBell;
    }, [onBell]);

    useEffect(() => {
      onSelectionChangeRef.current = onSelectionChange;
    }, [onSelectionChange]);

    // Expose imperative API via ref
    useImperativeHandle(ref, () => ({
      write: (data: string | Uint8Array) => {
        terminalRef.current?.write(data);
      },
      writeln: (data: string) => {
        terminalRef.current?.writeln(data);
      },
      clear: () => {
        terminalRef.current?.clear();
      },
      reset: () => {
        terminalRef.current?.reset();
      },
      resize: (cols: number, rows: number) => {
        terminalRef.current?.resize(cols, rows);
      },
      focus: () => {
        terminalRef.current?.focus();
      },
      blur: () => {
        terminalRef.current?.blur();
      },
      getDimensions: () => {
        const term = terminalRef.current;
        return {
          cols: term?.cols ?? cols,
          rows: term?.rows ?? rows,
        };
      },
      getSelection: () => {
        return terminalRef.current?.getSelection() ?? '';
      },
      hasSelection: () => {
        return terminalRef.current?.hasSelection() ?? false;
      },
      clearSelection: () => {
        terminalRef.current?.clearSelection();
      },
      selectAll: () => {
        terminalRef.current?.selectAll();
      },
      scrollToBottom: () => {
        terminalRef.current?.scrollToBottom();
      },
      scrollToTop: () => {
        terminalRef.current?.scrollToTop();
      },
      getTerminal: () => terminalRef.current,
    }));

    // Initialize terminal
    useEffect(() => {
      if (!containerRef.current) return;

      let disposed = false;
      const container = containerRef.current;

      async function initTerminal() {
        try {
          // Ensure WASM is loaded
          await ensureWasmInit();

          if (disposed) return;

          // Create terminal options
          const options: ITerminalOptions = {
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
          };

          // Create terminal instance
          const term = new Terminal(options);
          terminalRef.current = term;

          // Create and load FitAddon
          const fitAddon = new FitAddon();
          fitAddonRef.current = fitAddon;
          term.loadAddon(fitAddon);

          // Wire up event handlers via refs (avoids stale closures when props change)
          term.onData((data) => {
            onDataRef.current?.(data);
          });

          term.onResize(({ cols, rows }) => {
            onResizeRef.current?.(cols, rows);
          });

          term.onTitleChange((title) => {
            onTitleChangeRef.current?.(title);
          });

          term.onBell(() => {
            onBellRef.current?.();
          });

          term.onSelectionChange(() => {
            onSelectionChangeRef.current?.();
          });

          // Open terminal in container
          term.open(container);

          // Setup auto-fit with FitAddon's built-in ResizeObserver (debounced)
          if (autoFit) {
            // Use FitAddon's observeResize() - handles ResizeObserver + debouncing
            fitAddon.observeResize();

            // Initial fit after container has dimensions
            requestAnimationFrame(() => {
              if (!disposed && fitAddonRef.current) {
                fitAddonRef.current.fit();
              }
            });
          }

          setIsReady(true);

          // Notify ready callback
          if (onReady) {
            onReady(term);
          }
        } catch (err) {
          console.error('[GhosttyTerminal] Initialization failed:', err);
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      }

      initTerminal();

      // Cleanup
      return () => {
        disposed = true;

        // FitAddon.dispose() handles its own ResizeObserver cleanup
        if (fitAddonRef.current) {
          fitAddonRef.current.dispose();
          fitAddonRef.current = null;
        }

        if (terminalRef.current) {
          terminalRef.current.dispose();
          terminalRef.current = null;
        }
      };
    }, []); // Only run once on mount

    // Update font size at runtime
    useEffect(() => {
      if (terminalRef.current && isReady) {
        terminalRef.current.options.fontSize = fontSize;
        if (autoFit && fitAddonRef.current) {
          // Delay fit to next frame so terminal can recalculate glyph metrics
          requestAnimationFrame(() => {
            fitAddonRef.current?.fit();
          });
        }
      }
    }, [fontSize, isReady, autoFit]);

    // Update font family at runtime
    useEffect(() => {
      if (terminalRef.current && isReady) {
        terminalRef.current.options.fontFamily = fontFamily;
        if (autoFit && fitAddonRef.current) {
          // Delay fit to next frame so terminal can recalculate glyph metrics
          requestAnimationFrame(() => {
            fitAddonRef.current?.fit();
          });
        }
      }
    }, [fontFamily, isReady, autoFit]);

    // Update cursor settings at runtime
    useEffect(() => {
      if (terminalRef.current && isReady) {
        terminalRef.current.options.cursorBlink = cursorBlink;
        terminalRef.current.options.cursorStyle = cursorStyle;
      }
    }, [cursorBlink, cursorStyle, isReady]);

    // Update disableStdin at runtime
    useEffect(() => {
      if (terminalRef.current && isReady) {
        terminalRef.current.options.disableStdin = disableStdin;
      }
    }, [disableStdin, isReady]);

    // Error state
    if (error) {
      return (
        <div
          className={className}
          style={{
            ...style,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#0a0a0c',
            color: '#ff5555',
            fontFamily: 'monospace',
            fontSize: 'var(--tmnl-text-sm, 14px)',
            padding: '20px',
          }}
        >
          <div>
            <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>
              Terminal initialization failed
            </div>
            <div style={{ opacity: 0.7 }}>{error.message}</div>
          </div>
        </div>
      );
    }

    return (
      <div
        ref={containerRef}
        className={className}
        style={{
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          background: theme?.background ?? '#0a0a0c',
          ...style,
        }}
        data-terminal-ready={isReady}
      />
    );
  }
);
