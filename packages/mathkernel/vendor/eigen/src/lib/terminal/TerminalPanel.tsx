/**
 * TerminalPanel - Floating Panel Terminal Integration
 *
 * A pre-configured terminal component designed for use in floating panels.
 * Combines Terminal compound component with FloatingPanel-aware lifecycle.
 *
 * @example
 * ```tsx
 * import { FloatingPanel } from '@/lib/floating'
 * import { TerminalPanel } from '@/lib/terminal'
 *
 * <FloatingPanel id="terminal" title="Terminal">
 *   <TerminalPanel panelId="terminal" />
 * </FloatingPanel>
 * ```
 *
 * @module
 */

import { useRef, useEffect, useCallback } from 'react'
import {
  Terminal,
  useTerminalContext,
  type GhosttyTerminalRef,
} from './index'
import { useFloatingDimensions } from '@/lib/floating'

// ============================================================================
// Types
// ============================================================================

export interface TerminalPanelProps {
  /** Panel ID for lifecycle management */
  panelId: string
  /** Enable PTY connection (default: true) */
  enableConnection?: boolean
  /** Shell to use (default: uses system preference) */
  shell?: string
  /** Initial zoom level */
  initialZoom?: number
  /** Called when terminal is ready */
  onReady?: () => void
  /** Called when terminal exits */
  onExit?: (exitCode: number) => void
}

// ============================================================================
// Component
// ============================================================================

/**
 * Terminal panel content optimized for floating panels.
 *
 * Features:
 * - Auto-adapts to panel dimensions
 * - Zoom controls in toolbar
 * - Connection status in status bar
 * - Proper cleanup on panel close
 */
export function TerminalPanel({
  panelId,
  enableConnection = true,
  shell,
  initialZoom = 1.0,
  onReady,
  onExit,
}: TerminalPanelProps) {
  const termRef = useRef<GhosttyTerminalRef | null>(null)

  // Handle terminal ready
  const handleReady = useCallback(() => {
    onReady?.()
  }, [onReady])

  return (
    <Terminal.Root
      width="100%"
      height="100%"
      initialZoom={initialZoom}
      enableConnection={enableConnection}
      connectionOptions={{
        autoConnect: true,
        onError: (error) => {
          console.error(`[TerminalPanel ${panelId}] Connection error:`, error)
        },
      }}
    >
      <Terminal.Controls showZoom showModeToggle />
      <Terminal.Screen
        ref={termRef}
        onReady={handleReady}
      />
      <Terminal.StatusBar showConnection showSession />
    </Terminal.Root>
  )
}

// ============================================================================
// Panel Registry Entry
// ============================================================================

/**
 * Terminal panel configuration for the floating panel registry.
 */
export const terminalPanelConfig = {
  id: 'terminal',
  title: 'Terminal',
  component: TerminalPanel,
  defaultDimensions: { width: 800, height: 500 },
  minDimensions: { width: 400, height: 300 },
  resizable: true,
  closable: true,
} as const

export type TerminalPanelConfig = typeof terminalPanelConfig
