/**
 * Terminal Compound Component
 *
 * A composable terminal system with:
 * - Two modes: Classic (xterm.js) and OpenWarp (block-based)
 * - Auto-fit to container
 * - Zoom controls
 * - Status bar with dimensions
 * - PTY integration via TauriPtyService
 *
 * @example
 * ```tsx
 * // Classic xterm.js mode
 * <Terminal.Root width="100%" height="100%">
 *   <Terminal.Controls />
 *   <Terminal.Screen />
 *   <Terminal.StatusBar />
 * </Terminal.Root>
 *
 * // OpenWarp block mode
 * <Terminal.Root width="100%" height="100%" mode="openwarp">
 *   <Terminal.Controls />
 *   <Terminal.BlockScreen />
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
  useEffect,
  type ReactNode,
  type RefObject,
} from 'react'
import { useAtomValue } from '@effect-atom/atom-react'
import { ZoomIn, ZoomOut, Terminal as TerminalIcon, Blocks, SquareTerminal } from 'lucide-react'
import { TMNL_FONT_SIZE } from '@/lib/tmnl-ui/tokens'
import { useTerminalHotkeys } from './hooks/useTerminalHotkeys'

// V2 Imports
import {
  XtermTerminal,
  type XtermTerminalHandle,
  BlocksView,
  BlockInput,
  type BlockInputProps,
} from './v2/components'
import {
  useBlockTerminal,
  type UseBlockTerminalOptions,
} from './v2/hooks'
import {
  terminalModeAtom,
  setTerminalMode,
  toggleTerminalMode,
  type TerminalMode,
} from './v2/atoms'
import type { TerminalConfig } from './v2/schemas'

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
  // Refs
  xtermRef: RefObject<XtermTerminalHandle | null>
  containerRef: RefObject<HTMLDivElement | null>
  blocksContainerRef: RefObject<HTMLDivElement | null>

  // State
  isReady: boolean
  setIsReady: (ready: boolean) => void
  dimensions: { cols: number; rows: number }
  setDimensions: (dims: { cols: number; rows: number }) => void
  zoom: number
  setZoom: (zoom: number) => void
  fontSize: number
  fontFamily: string

  // Mode (from atoms)
  mode: TerminalMode
  setMode: (mode: TerminalMode) => void
  toggleMode: () => void

  // Block terminal hook result (for openwarp mode)
  blockTerminal: ReturnType<typeof useBlockTerminal> | null

  // Config
  persistKey?: string
  cwd?: string
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
  /** Initial mode (default: from atom) */
  mode?: TerminalMode
  /** Key for persisting terminal across remounts */
  persistKey?: string
  /** Initial working directory */
  cwd?: string
  /** Additional className */
  className?: string
}

function TerminalRoot({
  children,
  width = '100%',
  height = '100%',
  initialZoom = 1.0,
  fontFamily = NERD_FONT_FAMILY,
  mode: initialMode,
  persistKey,
  cwd,
  className,
}: TerminalRootProps) {
  const xtermRef = useRef<XtermTerminalHandle | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const blocksContainerRef = useRef<HTMLDivElement | null>(null)

  const [isReady, setIsReady] = useState(false)
  const [dimensions, setDimensions] = useState({ cols: 0, rows: 0 })
  const [zoom, setZoom] = useState(initialZoom)

  // Mode from atom (global state)
  const atomMode = useAtomValue(terminalModeAtom)
  const mode = initialMode ?? atomMode

  // Set initial mode if provided
  useEffect(() => {
    if (initialMode && initialMode !== atomMode) {
      setTerminalMode(initialMode)
    }
  }, [initialMode, atomMode])

  // Compute actual font size from zoom
  const fontSize = Math.round(BASE_FONT_SIZE * zoom)

  // Terminal-scoped hotkeys (Ctrl+=/-, Ctrl+0)
  useTerminalHotkeys({
    zoom,
    setZoom,
    minZoom: MIN_ZOOM,
    maxZoom: MAX_ZOOM,
    zoomStep: ZOOM_STEP,
    enabled: isReady,
    containerRef,
  })

  // Block terminal hook (only active in openwarp mode)
  const blockTerminal = useBlockTerminal({
    initialCwd: cwd,
    maxBlocks: 100,
  })

  const contextValue: TerminalContextValue = {
    xtermRef,
    containerRef,
    blocksContainerRef,
    isReady,
    setIsReady,
    dimensions,
    setDimensions,
    zoom,
    setZoom,
    fontSize,
    fontFamily,
    mode,
    setMode: setTerminalMode,
    toggleMode: toggleTerminalMode,
    blockTerminal,
    persistKey,
    cwd,
  }

  return (
    <TerminalContext.Provider value={contextValue}>
      <div
        ref={containerRef}
        className={className}
        tabIndex={-1}
        style={{
          width: typeof width === 'number' ? `${width}px` : width,
          height: typeof height === 'number' ? `${height}px` : height,
          display: 'flex',
          flexDirection: 'column',
          background: '#0a0a0c',
          overflow: 'hidden',
          outline: 'none',
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
          className="font-label uppercase tracking-[0.15em]"
          style={{
            fontSize: TMNL_FONT_SIZE.xs,
            color: 'rgba(255,255,255,0.7)',
          }}
        >
          Terminal
        </span>
        {ctx.dimensions.cols > 0 && (
          <span
            className="font-stats tracking-[0.08em]"
            style={{
              fontSize: TMNL_FONT_SIZE.xs,
              color: 'rgba(255,255,255,0.4)',
            }}
          >
            {ctx.dimensions.cols}×{ctx.dimensions.rows}
          </span>
        )}
      </div>

      {/* Center: Mode Toggle */}
      {showModeToggle && (
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
            onClick={() => ctx.mode !== 'ghostty' && ctx.setMode('ghostty')}
            className="font-label uppercase tracking-[0.1em]"
            style={{
              padding: '4px 8px',
              fontSize: TMNL_FONT_SIZE.xs,
              background: ctx.mode === 'ghostty' ? 'rgba(255,255,255,0.15)' : 'transparent',
              color: ctx.mode === 'ghostty' ? '#fff' : 'rgba(255,255,255,0.5)',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
            title="Classic xterm.js mode"
          >
            <SquareTerminal size={12} />
            Classic
          </button>
          <button
            onClick={() => ctx.mode !== 'openwarp' && ctx.setMode('openwarp')}
            className="font-label uppercase tracking-[0.1em]"
            style={{
              padding: '4px 8px',
              fontSize: TMNL_FONT_SIZE.xs,
              background: ctx.mode === 'openwarp' ? 'rgba(34,211,238,0.2)' : 'transparent',
              color: ctx.mode === 'openwarp' ? '#22d3ee' : 'rgba(255,255,255,0.5)',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
            title="OpenWarp block mode"
          >
            <Blocks size={12} />
            OpenWarp
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
              className="font-stats tracking-[0.05em]"
              style={{
                padding: '4px 8px',
                background: 'rgba(255,255,255,0.05)',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                color: '#fff',
                fontSize: TMNL_FONT_SIZE.xs,
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
// Screen Component (Classic xterm.js mode)
// ============================================================================

interface TerminalScreenProps {
  /** Called when terminal outputs data */
  onData?: (data: string) => void
  /** Called when shell exits */
  onExit?: (code: number) => void
  /** Called when a URL is clicked */
  onLinkClick?: (url: string) => void
  /** Called when a file path is clicked */
  onFilePathClick?: (path: string) => void
  /** Called when pwd changes */
  onPwdChange?: (pwd: string) => void
  /** Additional className */
  className?: string
}

const TerminalScreen = forwardRef<XtermTerminalHandle, TerminalScreenProps>(
  function TerminalScreen(
    { onData, onExit, onLinkClick, onFilePathClick, onPwdChange, className },
    forwardedRef
  ) {
    const ctx = useTerminalContext()

    // Unified ref handling
    const setRefs = useCallback(
      (instance: XtermTerminalHandle | null) => {
        ;(ctx.xtermRef as React.MutableRefObject<XtermTerminalHandle | null>).current = instance
        if (typeof forwardedRef === 'function') {
          forwardedRef(instance)
        } else if (forwardedRef) {
          ;(forwardedRef as React.MutableRefObject<XtermTerminalHandle | null>).current = instance
        }
        if (instance) {
          ctx.setIsReady(true)
        }
      },
      [ctx, forwardedRef]
    )

    // Don't render if in openwarp mode
    if (ctx.mode === 'openwarp') {
      return null
    }

    return (
      <div
        className={className}
        style={{ flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative' }}
      >
        <XtermTerminal
          ref={setRefs}
          persistKey={ctx.persistKey}
          onData={onData}
          onExit={onExit}
          onLinkClick={onLinkClick}
          onFilePathClick={onFilePathClick}
          onPwdChange={onPwdChange}
          config={{
            fontSize: ctx.fontSize,
            fontFamily: ctx.fontFamily,
          }}
        />
      </div>
    )
  }
)

// ============================================================================
// BlockScreen Component (OpenWarp mode)
// ============================================================================

interface TerminalBlockScreenProps {
  /** Custom markdown renderer */
  renderMarkdown?: (content: string) => React.ReactNode
  /** Additional className for blocks container */
  className?: string
  /** Props to pass to BlockInput */
  inputProps?: Partial<BlockInputProps>
}

function TerminalBlockScreen({
  renderMarkdown,
  className,
  inputProps,
}: TerminalBlockScreenProps) {
  const ctx = useTerminalContext()

  // Don't render if in ghostty mode
  if (ctx.mode === 'ghostty' || !ctx.blockTerminal) {
    return null
  }

  const { blocks, executeCommand, executeAIQuery, containerRef, dismissBlock } = ctx.blockTerminal

  return (
    <div
      className={className}
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Blocks View */}
      <BlocksView
        blocks={blocks}
        containerRef={containerRef}
        autoScroll
        renderMarkdown={renderMarkdown}
        onDismissBlock={dismissBlock}
      />

      {/* Block Input */}
      <BlockInput
        onSubmit={(cmd, isAI, thinkingLevel) => {
          if (isAI) {
            executeAIQuery(cmd, thinkingLevel)
          } else {
            executeCommand(cmd)
          }
        }}
        {...inputProps}
      />
    </div>
  )
}

// ============================================================================
// StatusBar Component
// ============================================================================

interface TerminalStatusBarProps {
  /** Additional className */
  className?: string
}

function TerminalStatusBar({ className }: TerminalStatusBarProps) {
  const ctx = useTerminalContext()

  const getModeLabel = () => {
    if (ctx.mode === 'ghostty') return 'Classic'
    return 'OpenWarp'
  }

  const getStatusColor = () => {
    if (!ctx.isReady) return '#eab308' // yellow
    if (ctx.mode === 'openwarp') return '#22d3ee' // cyan
    return '#22c55e' // green
  }

  return (
    <div
      className={`font-label ${className ?? ''}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 12px',
        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
        fontSize: TMNL_FONT_SIZE.xs,
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
            background: getStatusColor(),
          }}
        />
        <span className="uppercase tracking-[0.1em]">
          {!ctx.isReady ? 'Loading...' : getModeLabel()}
        </span>
      </div>

      {/* Right: PWD or Block Count */}
      <div className="font-stats tracking-[0.08em]" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {ctx.mode === 'openwarp' && ctx.blockTerminal && (
          <span style={{ color: 'rgba(255,255,255,0.4)' }}>
            {ctx.blockTerminal.blocks.length} blocks
          </span>
        )}
        {ctx.mode === 'ghostty' && ctx.xtermRef.current && (
          <span style={{ color: 'rgba(255,255,255,0.4)' }}>
            {ctx.xtermRef.current.getPwd() ?? ctx.cwd ?? '~'}
          </span>
        )}
      </div>
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
  BlockScreen: TerminalBlockScreen,
  StatusBar: TerminalStatusBar,
}

// Also export individual components for flexibility
export {
  TerminalRoot,
  TerminalControls,
  TerminalScreen,
  TerminalBlockScreen,
  TerminalStatusBar,
  useTerminalContext,
  NERD_FONT_FAMILY,
  BASE_FONT_SIZE,
}

export type {
  TerminalRootProps,
  TerminalControlsProps,
  TerminalScreenProps,
  TerminalBlockScreenProps,
  TerminalStatusBarProps,
  TerminalContextValue,
}
