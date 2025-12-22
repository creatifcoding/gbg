/**
 * Terminal Compound Component
 *
 * A composable terminal system with:
 * - Auto-fit to container
 * - Zoom controls
 * - Status bar with dimensions
 * - PTY/SSH backend integration
 *
 * @example
 * ```tsx
 * <Terminal.Root width="100%" height="100%">
 *   <Terminal.Controls />
 *   <Terminal.Screen
 *     onData={handleData}
 *     onReady={handleReady}
 *   />
 *   <Terminal.StatusBar />
 * </Terminal.Root>
 * ```
 *
 * @module
 */

import {
  createContext,
  useContext,
  useRef,
  useState,
  useCallback,
  forwardRef,
  type ReactNode,
  type RefObject,
} from 'react'
import { GhosttyTerminal, type GhosttyTerminalRef, type GhosttyTerminalProps } from './GhosttyTerminal'
import { useTerminalConnection, type UseTerminalConnectionOptions, type TerminalSessionInfo } from './usePtyConnection'
import { ZoomIn, ZoomOut, Maximize2, RotateCcw, Terminal as TerminalIcon } from 'lucide-react'

// ============================================================================
// Constants
// ============================================================================

const BASE_FONT_SIZE = 14
const MIN_ZOOM = 0.5
const MAX_ZOOM = 2.5
const ZOOM_STEP = 0.1

// Font stack with Nerd Font variants for Powerline/oh-my-posh support
const NERD_FONT_FAMILY = [
  "'MesloLGS Nerd Font'",
  "'JetBrainsMono Nerd Font'",
  "'FiraCode Nerd Font'",
  "'Hack Nerd Font'",
  "'JetBrains Mono'",
  "'Fira Code'",
  "'SF Mono'",
  "'Cascadia Code'",
  "Menlo",
  "Monaco",
  "monospace",
].join(', ')

// ============================================================================
// Context
// ============================================================================

interface TerminalContextValue {
  termRef: RefObject<GhosttyTerminalRef | null>
  isReady: boolean
  setIsReady: (ready: boolean) => void
  dimensions: { cols: number; rows: number }
  setDimensions: (dims: { cols: number; rows: number }) => void
  zoom: number
  setZoom: (zoom: number) => void
  fontSize: number
  fontFamily: string
  mode: 'local' | 'remote'
  setMode: (mode: 'local' | 'remote') => void
  connection: ReturnType<typeof useTerminalConnection> | null
  sessionInfo: TerminalSessionInfo | null
  setSessionInfo: (info: TerminalSessionInfo | null) => void
}

const TerminalContext = createContext<TerminalContextValue | null>(null)

function useTerminalContext() {
  const ctx = useContext(TerminalContext)
  if (!ctx) {
    throw new Error('Terminal components must be used within Terminal.Root')
  }
  return ctx
}

// ============================================================================
// Root Component
// ============================================================================

interface TerminalRootProps {
  children: ReactNode
  /** Width of terminal container (CSS value) */
  width?: string | number
  /** Height of terminal container (CSS value) */
  height?: string | number
  /** Initial zoom level (default: 1.0) */
  initialZoom?: number
  /** Custom font family (default: Nerd Font stack) */
  fontFamily?: string
  /** Enable PTY/SSH connection (default: false = local echo) */
  enableConnection?: boolean
  /** Connection options when enableConnection is true */
  connectionOptions?: UseTerminalConnectionOptions
  /** Additional className */
  className?: string
}

function TerminalRoot({
  children,
  width = '100%',
  height = '100%',
  initialZoom = 1.0,
  fontFamily = NERD_FONT_FAMILY,
  enableConnection = false,
  connectionOptions,
  className,
}: TerminalRootProps) {
  const termRef = useRef<GhosttyTerminalRef | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [dimensions, setDimensions] = useState({ cols: 0, rows: 0 })
  const [zoom, setZoom] = useState(initialZoom)
  const [mode, setMode] = useState<'local' | 'remote'>(enableConnection ? 'remote' : 'local')
  const [sessionInfo, setSessionInfo] = useState<TerminalSessionInfo | null>(null)

  // Compute actual font size from zoom
  const fontSize = Math.round(BASE_FONT_SIZE * zoom)

  // Optional connection hook
  const connection = enableConnection
    ? useTerminalConnection({
        ...connectionOptions,
        autoConnect: connectionOptions?.autoConnect ?? false,
        onReady: (session) => {
          setSessionInfo(session)
          connectionOptions?.onReady?.(session)
        },
      })
    : null

  const contextValue: TerminalContextValue = {
    termRef,
    isReady,
    setIsReady,
    dimensions,
    setDimensions,
    zoom,
    setZoom,
    fontSize,
    fontFamily,
    mode,
    setMode,
    connection,
    sessionInfo,
    setSessionInfo,
  }

  return (
    <TerminalContext.Provider value={contextValue}>
      <div
        className={className}
        style={{
          width: typeof width === 'number' ? `${width}px` : width,
          height: typeof height === 'number' ? `${height}px` : height,
          display: 'flex',
          flexDirection: 'column',
          background: '#0a0a0c',
          overflow: 'hidden',
        }}
      >
        {children}
      </div>
    </TerminalContext.Provider>
  )
}

// ============================================================================
// Controls Component
// ============================================================================

interface TerminalControlsProps {
  /** Show zoom controls (default: true) */
  showZoom?: boolean
  /** Show mode toggle (default: true) */
  showModeToggle?: boolean
  /** Custom actions to render */
  actions?: ReactNode
  /** Additional className */
  className?: string
}

function TerminalControls({
  showZoom = true,
  showModeToggle = true,
  actions,
  className,
}: TerminalControlsProps) {
  const ctx = useTerminalContext()

  const zoomIn = useCallback(() => {
    ctx.setZoom(Math.min(MAX_ZOOM, ctx.zoom + ZOOM_STEP))
  }, [ctx])

  const zoomOut = useCallback(() => {
    ctx.setZoom(Math.max(MIN_ZOOM, ctx.zoom - ZOOM_STEP))
  }, [ctx])

  const resetZoom = useCallback(() => {
    ctx.setZoom(1.0)
  }, [ctx])

  const toggleMode = useCallback(() => {
    const newMode = ctx.mode === 'local' ? 'remote' : 'local'
    ctx.setMode(newMode)
    if (ctx.connection) {
      if (newMode === 'remote') {
        ctx.connection.connect()
        ctx.connection.attachTerminal(ctx.termRef)
      } else {
        ctx.connection.disconnect()
      }
    }
  }, [ctx])

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        gap: '12px',
        flexShrink: 0,
      }}
    >
      {/* Left: Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <TerminalIcon size={14} style={{ color: 'rgba(255,255,255,0.5)' }} />
        <span
          style={{
            fontSize: '12px',
            fontFamily: 'monospace',
            color: 'rgba(255,255,255,0.7)',
          }}
        >
          Terminal
        </span>
        {ctx.dimensions.cols > 0 && (
          <span
            style={{
              fontSize: '12px',
              fontFamily: 'monospace',
              color: 'rgba(255,255,255,0.4)',
            }}
          >
            {ctx.dimensions.cols}×{ctx.dimensions.rows}
          </span>
        )}
      </div>

      {/* Center: Mode Toggle */}
      {showModeToggle && ctx.connection && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '4px',
            padding: '2px',
          }}
        >
          <button
            onClick={() => ctx.mode !== 'local' && toggleMode()}
            style={{
              padding: '4px 8px',
              fontSize: '12px',
              fontFamily: 'monospace',
              background: ctx.mode === 'local' ? 'rgba(255,255,255,0.15)' : 'transparent',
              color: ctx.mode === 'local' ? '#fff' : 'rgba(255,255,255,0.5)',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
            }}
          >
            Local
          </button>
          <button
            onClick={() => ctx.mode !== 'remote' && toggleMode()}
            style={{
              padding: '4px 8px',
              fontSize: '12px',
              fontFamily: 'monospace',
              background: ctx.mode === 'remote' ? 'rgba(34,211,238,0.2)' : 'transparent',
              color: ctx.mode === 'remote' ? '#22d3ee' : 'rgba(255,255,255,0.5)',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
            }}
          >
            Remote
          </button>
        </div>
      )}

      {/* Right: Zoom + Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {showZoom && (
          <>
            <button
              onClick={zoomOut}
              disabled={ctx.zoom <= MIN_ZOOM}
              style={{
                padding: '4px',
                background: 'rgba(255,255,255,0.05)',
                border: 'none',
                borderRadius: '4px',
                cursor: ctx.zoom <= MIN_ZOOM ? 'not-allowed' : 'pointer',
                opacity: ctx.zoom <= MIN_ZOOM ? 0.3 : 1,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Zoom out"
            >
              <ZoomOut size={14} />
            </button>
            <button
              onClick={resetZoom}
              style={{
                padding: '4px 8px',
                background: 'rgba(255,255,255,0.05)',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                color: '#fff',
                fontFamily: 'monospace',
                fontSize: '12px',
              }}
              title="Reset zoom"
            >
              {Math.round(ctx.zoom * 100)}%
            </button>
            <button
              onClick={zoomIn}
              disabled={ctx.zoom >= MAX_ZOOM}
              style={{
                padding: '4px',
                background: 'rgba(255,255,255,0.05)',
                border: 'none',
                borderRadius: '4px',
                cursor: ctx.zoom >= MAX_ZOOM ? 'not-allowed' : 'pointer',
                opacity: ctx.zoom >= MAX_ZOOM ? 0.3 : 1,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Zoom in"
            >
              <ZoomIn size={14} />
            </button>
          </>
        )}
        {actions}
      </div>
    </div>
  )
}

// ============================================================================
// Screen Component
// ============================================================================

interface TerminalScreenProps extends Omit<GhosttyTerminalProps, 'fontSize' | 'fontFamily' | 'ref'> {
  /** Handle local echo when not connected */
  localEcho?: boolean
}

const TerminalScreen = forwardRef<GhosttyTerminalRef, TerminalScreenProps>(
  function TerminalScreen(
    { onData, onResize, onReady, localEcho = true, ...props },
    forwardedRef
  ) {
    const ctx = useTerminalContext()

    // Use context ref if no forwarded ref
    const ref = (forwardedRef as RefObject<GhosttyTerminalRef | null>) ?? ctx.termRef

    const handleData = useCallback(
      (data: string) => {
        if (ctx.mode === 'remote' && ctx.connection) {
          ctx.connection.write(data)
        } else if (localEcho && ctx.termRef.current) {
          // Local echo mode
          if (data === '\r') {
            ctx.termRef.current.write('\r\n')
            ctx.termRef.current.write('\x1b[1;35m❯\x1b[0m ')
          } else if (data === '\x7f') {
            ctx.termRef.current.write('\b \b')
          } else {
            ctx.termRef.current.write(data)
          }
        }
        onData?.(data)
      },
      [ctx, localEcho, onData]
    )

    const handleResize = useCallback(
      (cols: number, rows: number) => {
        ctx.setDimensions({ cols, rows })
        if (ctx.mode === 'remote' && ctx.connection?.connected) {
          ctx.connection.resize(cols, rows)
        }
        onResize?.(cols, rows)
      },
      [ctx, onResize]
    )

    const handleReady = useCallback(
      (terminal: import('ghostty-web').Terminal) => {
        ctx.setIsReady(true)
        ctx.termRef.current?.focus()
        if (localEcho && ctx.mode === 'local') {
          ctx.termRef.current?.write('\x1b[1;35m❯\x1b[0m ')
        }
        onReady?.(terminal)
      },
      [ctx, localEcho, onReady]
    )

    return (
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <GhosttyTerminal
          ref={ref}
          fontSize={ctx.fontSize}
          fontFamily={ctx.fontFamily}
          onData={handleData}
          onResize={handleResize}
          onReady={handleReady}
          autoFit
          {...props}
          style={{ width: '100%', height: '100%', ...props.style }}
        />
      </div>
    )
  }
)

// ============================================================================
// StatusBar Component
// ============================================================================

interface TerminalStatusBarProps {
  /** Show connection status (default: true) */
  showConnection?: boolean
  /** Show session info (default: true) */
  showSession?: boolean
  /** Additional className */
  className?: string
}

function TerminalStatusBar({
  showConnection = true,
  showSession = true,
  className,
}: TerminalStatusBarProps) {
  const ctx = useTerminalContext()

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 12px',
        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
        fontSize: '12px',
        fontFamily: 'monospace',
        color: 'rgba(255,255,255,0.5)',
        flexShrink: 0,
      }}
    >
      {/* Left: Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: ctx.isReady
              ? ctx.mode === 'remote' && ctx.connection?.connected
                ? '#22d3ee'
                : '#22c55e'
              : '#eab308',
          }}
        />
        <span>
          {!ctx.isReady
            ? 'Loading...'
            : ctx.mode === 'local'
            ? 'Local Echo'
            : ctx.connection?.connected
            ? 'Connected'
            : 'Disconnected'}
        </span>
      </div>

      {/* Right: Session Info */}
      {showSession && ctx.sessionInfo && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ color: 'rgba(255,255,255,0.4)' }}>
            {ctx.sessionInfo.backend.toUpperCase()}
          </span>
          {ctx.sessionInfo.pid && (
            <span style={{ color: '#22c55e' }}>PID: {ctx.sessionInfo.pid}</span>
          )}
          {ctx.sessionInfo.id && (
            <span style={{ color: 'rgba(255,255,255,0.3)' }}>
              {ctx.sessionInfo.id.slice(0, 8)}...
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Compound Export
// ============================================================================

export const Terminal = {
  Root: TerminalRoot,
  Controls: TerminalControls,
  Screen: TerminalScreen,
  StatusBar: TerminalStatusBar,
}

// Also export individual components for flexibility
export {
  TerminalRoot,
  TerminalControls,
  TerminalScreen,
  TerminalStatusBar,
  useTerminalContext,
  NERD_FONT_FAMILY,
  BASE_FONT_SIZE,
}

export type {
  TerminalRootProps,
  TerminalControlsProps,
  TerminalScreenProps,
  TerminalStatusBarProps,
  TerminalContextValue,
}
